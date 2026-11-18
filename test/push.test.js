const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const fse = require('fs-extra');
const { parsePushArgs, handlePush } = require('../src/commands/push');
const { scanStagedChanges, installSecurityHooks } = require('../src/security/secretScanner');
const { run, runCapture } = require('../src/utils/proc');

console.log('Running Push & Git Shield Tests...');

// 1. Argument parsing tests
const p1 = parsePushArgs('git add . push -branch main -commit "first commit"');
assert.deepStrictEqual(p1.files, ['.']);
assert.strictEqual(p1.branch, 'main');
assert.strictEqual(p1.message, 'first commit');

const p2 = parsePushArgs('push -b feature-test -m "feat: branch flag"');
assert.strictEqual(p2.branch, 'feature-test');
assert.strictEqual(p2.message, 'feat: branch flag');

const p3 = parsePushArgs(['push', '-b', 'feature-auth', '-m', 'feat: array input']);
assert.strictEqual(p3.branch, 'feature-auth');
assert.strictEqual(p3.message, 'feat: array input');

const p4 = parsePushArgs('push file1.js file2.js -m "specific files"');
assert.deepStrictEqual(p4.files, ['file1.js', 'file2.js']);
assert.strictEqual(p4.message, 'specific files');

console.log('  ✔ Argument parser verified across string and array token variations');

// 2. Secret Shield git staging interception test
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf_push_test_'));
try {
  run('git init -b main', { cwd: tempDir, stdio: 'ignore' });
  run('git config user.name "Tester"', { cwd: tempDir, stdio: 'ignore' });
  run('git config user.email "test@rapidfire.dev"', { cwd: tempDir, stdio: 'ignore' });

  // Install hooks
  installSecurityHooks(tempDir);
  assert(fs.existsSync(path.join(tempDir, '.git', 'hooks', 'pre-commit')), 'pre-commit hook installed');
  assert(fs.existsSync(path.join(tempDir, '.git', 'hooks', 'pre-push')), 'pre-push hook installed');
  console.log('  ✔ Secret Shield git hooks verified');

  // Stage a clean file
  fs.writeFileSync(path.join(tempDir, 'clean.js'), 'console.log("clean code");\n');
  run('git add clean.js', { cwd: tempDir });
  const cleanScan = scanStagedChanges(tempDir);
  assert.strictEqual(cleanScan.clean, true, 'Clean file should have no findings');
  console.log('  ✔ Clean staged changes allowed');

  // Stage a dirty file with OpenAI secret
  fs.writeFileSync(path.join(tempDir, 'dirty.env'), 'OPENAI_KEY=' + 'sk-' + 'proj-123456789012345678901234\n');
  run('git add dirty.env', { cwd: tempDir });
  const dirtyScan = scanStagedChanges(tempDir);
  assert.strictEqual(dirtyScan.clean, false, 'Staged secrets should be caught');
  assert.strictEqual(dirtyScan.findings[0].ruleId, 'openai-api-key');
  console.log('  ✔ Staged leaked secrets intercepted by Secret Shield');
} finally {
  fse.removeSync(tempDir);
}

console.log('\x1b[32m[PASS] Push & Git Shield Tests Passed!\x1b[0m\n');
