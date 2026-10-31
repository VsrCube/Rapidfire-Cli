#!/usr/bin/env node

const { startRepl } = require('../src/repl');

process.on('SIGTERM', () => {
  try {
    const { stopProcesses } = require('../src/commands/run');
    stopProcesses();
  } catch {}
  process.exit(0);
});

const args = process.argv.slice(2);
if (args.includes('-v') || args.includes('--version') || (args.length === 1 && args[0] === 'version')) {
  const pkg = require('../package.json');
  console.log(`RapidFire CLI v${pkg.version}`);
  process.exit(0);
}

if (args[0] === 'stop' || args[0] === 'kill') {
  const { stopProcesses } = require('../src/commands/run');
  stopProcesses(args.slice(1));
  process.exit(0);
}

if (args[0] === 'run' || args[0] === 'start' || args[0] === 'serve') {
  const { handleCliRun } = require('../src/commands/run');
  handleCliRun(args.slice(1));
  return;
}

if (args[0] === 'setup') {
  const readline = require('readline');
  const { handleSetup } = require('../src/commands/setup');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  handleSetup(args.slice(1), { rl })
    .then(() => { rl.close(); process.exit(0); })
    .catch((err) => { rl.close(); console.error(err); process.exit(1); });
  return;
}

if (args[0] === 'explain') {
  const { handleExplain } = require('../src/commands/explain');
  handleExplain(args.slice(1)).then(() => process.exit(0)).catch(() => process.exit(1));
  return;
}

if (args[0] === 'overview') {
  const { handleOverview } = require('../src/commands/overview');
  handleOverview(args.slice(1)).then(() => process.exit(0)).catch(() => process.exit(1));
  return;
}

if (args[0] === 'ask') {
  const { handleAsk } = require('../src/commands/ask');
  handleAsk(args.slice(1)).then(() => process.exit(0)).catch(() => process.exit(1));
  return;
}

if (args[0] === 'scan') {
  const { scanDirectory, renderSecurityBanner } = require('../src/security/secretScanner');
  const targetDir = args[1] || process.cwd();
  console.log(`\n\x1b[36m[rapidfire-security] Scanning directory '${targetDir}' for leaked secrets...\x1b[0m`);
  const res = scanDirectory(targetDir);
  if (!res.clean) {
    renderSecurityBanner(res.findings, 'scan');
    process.exit(1);
  } else {
    console.log(`\x1b[32m[OK] [rapidfire-security] Scanned ${res.scannedFiles} file(s). No leaked secrets or credentials detected!\x1b[0m\n`);
    process.exit(0);
  }
}

if (args.includes('-h') || args.includes('--help') || (args.length === 1 && args[0] === 'help')) {
  const { showHelp } = require('../src/commands/help');
  showHelp();
  process.exit(0);
}

try {
  startRepl();
} catch (err) {
  console.error('[rapidfire] Fatal error during startup:', err);
  process.exit(1);
}
