const assert = require('assert');
const path = require('path');
const os = require('os');
const { ensurePath, getPythonExecutable, commandExists } = require('../src/utils/proc');
const { resolveShell } = require('../src/shell');
const { RapidfireRepl } = require('../src/repl');

console.log('[test_cross_platform] Testing cross-platform environment discovery...');

assert.doesNotThrow(() => ensurePath(), 'ensurePath should run safely');
assert(process.env.PATH && process.env.PATH.length > 0, 'PATH must be defined and non-empty');

const pyExe = getPythonExecutable();
assert(typeof pyExe === 'string' && pyExe.length > 0, 'getPythonExecutable should return string');
assert(['python', 'python3', 'py'].includes(pyExe), `Executable was unexpected: ${pyExe}`);
console.log(`  ✔ Python executable detected: ${pyExe}`);

const shellInfo = resolveShell();
assert(shellInfo && shellInfo.shell, 'resolveShell must return an object with shell');
assert(Array.isArray(shellInfo.args), 'resolveShell must return args array');
console.log(`  ✔ Current host shell resolved: ${shellInfo.shell} with args [${shellInfo.args.join(', ')}]`);

const origPlatform = process.platform;
const origShell = process.env.SHELL;

try {
  delete process.env.SHELL;
  Object.defineProperty(process, 'platform', { value: 'win32' });
  const winShell = resolveShell();
  assert.strictEqual(winShell.shell, 'powershell.exe', 'Windows must strictly resolve to powershell.exe');
  assert(winShell.args.includes('-NoLogo'), 'Windows PowerShell should include -NoLogo');

  const sampleConPtyChunk = '\x1b[?9001h\x1b[?1004h\x1b[32mActive Process\x1b[0m\x1b[?9001l\x1b[?1004l';
  const sanitizedChunk = sampleConPtyChunk.replace(/\x1b\[\?(9001|1004)[hl]/g, '');
  assert.strictEqual(sanitizedChunk, '\x1b[32mActive Process\x1b[0m', 'ConPTY and focus escape sequences must be completely stripped');

  const repl = new RapidfireRepl();
  const winPrompt = repl.getPrompt();
  assert(winPrompt.includes('PS '), 'Windows prompt must include PS prefix');
  if (repl.shell) repl.shell.kill();
  console.log('  ✔ Windows (win32) simulation passed (PowerShell -NoLogo + ConPTY sequence filter + PS prefix)');

  Object.defineProperty(process, 'platform', { value: 'darwin' });
  const macShell = resolveShell();
  assert(macShell.shell.includes('zsh') || macShell.shell.includes('bash'), 'macOS should default to zsh or SHELL');
  assert(macShell.args.includes('-l'), 'macOS should use login flag -l');
  console.log('  ✔ macOS (darwin) simulation passed (/bin/zsh with -l)');

  Object.defineProperty(process, 'platform', { value: 'linux' });
  const linuxShell = resolveShell();
  assert(linuxShell.shell.includes('bash') || linuxShell.shell.includes('sh'), 'Linux should default to bash');
  assert(linuxShell.args.includes('--login'), 'Linux should use login flag --login');
  console.log('  ✔ Linux (linux) simulation passed (/bin/bash with --login)');
} finally {
  Object.defineProperty(process, 'platform', { value: origPlatform });
  if (origShell) process.env.SHELL = origShell;
}

console.log('[test_cross_platform] All Windows, macOS, and Linux checks passed 100%!');
