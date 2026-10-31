const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const fse = require('fs-extra');
const {
  RULES,
  redactSecret,
  scanFileContent,
  parseDiffForSecrets,
  scanStagedChanges,
  scanUnpushedCommits,
  scanDirectory,
  installSecurityHooks,
  verifySecurityHooksInstalled
} = require('../src/security/secretScanner');
const { run, runCapture } = require('../src/utils/proc');
const { handlePush } = require('../src/commands/push');

async function runTests() {
  console.log('=== TEST SUITE: RAPIDFIRE SECRET SHIELD REWORK ===\n');

// Test 1: Pattern Rule Coverage
console.log('[Test 1] Testing comprehensive secret rule pattern detection...');

const testVectors = [
  {
    name: 'OpenAI Standard Key',
    secret: 'sk-abcdef1234567890abcdef1234567890',
    ruleId: 'openai-api-key'
  },
  {
    name: 'OpenAI Project Key',
    secret: 'sk-proj-testexposedkey1234567890abcdef1234567890',
    ruleId: 'openai-api-key'
  },
  {
    name: 'Google Cloud / Gemini Key',
    secret: 'AIzaSyDummyTestKey1234567890abcdef12345',
    ruleId: 'google-api-key'
  },
  {
    name: 'AWS Access Key ID',
    secret: 'AKIAIOSFODNN7EXAMPLE',
    ruleId: 'aws-access-key-id'
  },
  {
    name: 'AWS Secret Access Key',
    secret: 'aws_secret_access_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"',
    ruleId: 'aws-secret-access-key'
  },
  {
    name: 'GitHub Classic PAT',
    secret: ['ghp', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'].join('_'),
    ruleId: 'github-access-token'
  },
  {
    name: 'Slack Bot Token',
    secret: ['xoxb', '123456789012', '1234567890123', 'abcdefghijklmnopqrstuvwx'].join('-'),
    ruleId: 'slack-token'
  },
  {
    name: 'Stripe Live Secret Key',
    secret: ['sk', 'live', '51AbcdefghijklmnopqrstuvwxyzA1B2C3D4'].join('_'),
    ruleId: 'stripe-secret-key'
  },
  {
    name: 'Private RSA Key Header',
    secret: '-----BEGIN RSA PRIVATE KEY-----',
    ruleId: 'private-key'
  },
  {
    name: 'Database URI with credentials',
    secret: 'postgres://app_user:s3cur3_p@ssw0rd@db.example.com:5432/production',
    ruleId: 'db-connection-string'
  }
];

for (const tv of testVectors) {
  const content = `// Config line\nconst KEY = "${tv.secret}";\n`;
  const findings = scanFileContent(content, 'test_file.js');
  assert(findings.length > 0, `Expected secret detected for: ${tv.name}`);
  const match = findings.find(f => f.ruleId === tv.ruleId);
  assert(match, `Expected ruleId '${tv.ruleId}' for ${tv.name}`);
}

console.log('✓ All 10 major secret categories matched accurately.\n');

// Test 2: Redaction Safety
console.log('[Test 2] Testing secret redaction masking...');
assert.strictEqual(redactSecret('sk-proj-testexposedkey1234567890abcdef1234567890'), 'sk-proj-...7890');
assert.strictEqual(redactSecret('AIzaSyDummyTestKey1234567890abcdef12345'), 'AIzaSyDu...2345');
assert.strictEqual(redactSecret('AKIAIOSFODNN7EXAMPLE'), 'AKIAIO...MPLE');
console.log('✓ Secret redaction masks middle characters safely.\n');

// Test 3: Live Git Pre-Commit Blocking via handlePush
console.log('[Test 3] Testing live handlePush blocks staging/commit when exposed keys exist...');
const tmpRoot = path.join(os.tmpdir(), `test_shield_${Date.now()}`);
const bareRemote = path.join(tmpRoot, 'remote.git');
const localRepo = path.join(tmpRoot, 'project');

fse.ensureDirSync(bareRemote);
fse.ensureDirSync(localRepo);

try {
  run('git init --bare', { cwd: bareRemote, stdio: 'ignore' });
  run('git init -b main', { cwd: localRepo, stdio: 'ignore' });
  run('git config user.name "Shield Tester"', { cwd: localRepo, stdio: 'ignore' });
  run('git config user.email "shield@rapidfire.dev"', { cwd: localRepo, stdio: 'ignore' });
  run(`git remote add origin "${bareRemote.replace(/\\/g, '/')}"`, { cwd: localRepo, stdio: 'ignore' });

  // Initial clean commit
  fs.writeFileSync(path.join(localRepo, 'app.js'), 'console.log("Safe App");\n', 'utf8');
  const res1 = await handlePush('push -m -commit "Initial safe commit"', { cwd: localRepo });
  assert(res1.success, 'Clean push should succeed');

  // Attempting to push with exposed keys
  fs.writeFileSync(path.join(localRepo, 'config.js'), `
    const OPENAI = "sk-proj-testexposedkey1234567890abcdef1234567890";
    const GOOGLE = "AIzaSyDummyTestKey1234567890abcdef12345";
    const AWS = "AKIAIOSFODNN7EXAMPLE";
  `, 'utf8');

  const resLeak = await handlePush('git add . push -m -commit "Exposed keys leak"', { cwd: localRepo });
  assert.strictEqual(resLeak.success, false, 'handlePush MUST fail when secrets are present');
  assert.strictEqual(resLeak.blocked, true, 'handlePush MUST report blocked: true');
  assert.strictEqual(resLeak.error, 'LEAKED_SECRETS_DETECTED', 'Error code must match');
  assert.strictEqual(resLeak.findings.length, 3, 'Must report all 3 exposed keys');

  // Verify that the commit was never created on the branch
  const latestLog = runCapture('git log -1 --pretty=%B', { cwd: localRepo }).trim();
  assert.strictEqual(latestLog, 'Initial safe commit', 'Commit must NOT be created in Git history');

  console.log('✓ Pre-commit Secret Shield stopped commit from ever entering Git history.\n');

  // Test 4: Pre-Push Outgoing Commit Blocking (Even if committed via raw git)
  console.log('[Test 4] Testing pre-push scanning intercepts raw commits with secrets before push...');
  // Force commit bypassing hooks with --no-verify
  run('git add config.js', { cwd: localRepo, stdio: 'ignore' });
  run('git commit --no-verify -m "Forced secret commit"', { cwd: localRepo, stdio: 'ignore' });

  // Now attempt to push the unpushed commit via handlePush
  const resPushBlocked = await handlePush('push', { cwd: localRepo });
  assert.strictEqual(resPushBlocked.success, false, 'handlePush MUST block pushing existing commits with secrets');
  assert.strictEqual(resPushBlocked.blocked, true, 'Must report blocked: true');
  assert.strictEqual(resPushBlocked.error, 'LEAKED_SECRETS_DETECTED');

  console.log('✓ Pre-push Secret Shield stopped unpushed commits from reaching remote.\n');

  // Test 5: Standalone Directory Scanner
  console.log('[Test 5] Testing scanDirectory on target project...');
  const dirScan = scanDirectory(localRepo);
  assert.strictEqual(dirScan.clean, false, 'Directory scan should report clean: false');
  assert(dirScan.findings.length >= 3, 'Directory scan should find at least 3 credentials');
  assert(dirScan.scannedFiles > 0, 'Should count scanned files');

  console.log(`✓ scanDirectory successfully identified ${dirScan.findings.length} secret(s) across ${dirScan.scannedFiles} file(s).\n`);

  // Test 6: Hook Installation & Verification
  console.log('[Test 6] Testing installSecurityHooks and verifySecurityHooksInstalled...');
  const hookInstall = installSecurityHooks(localRepo);
  assert(hookInstall.success, 'Hook installation must succeed');
  assert(verifySecurityHooksInstalled(localRepo), 'Hook verification must return true');
  assert(fs.existsSync(path.join(localRepo, '.git', 'hooks', 'pre-commit')), 'pre-commit hook must exist');
  assert(fs.existsSync(path.join(localRepo, '.git', 'hooks', 'pre-push')), 'pre-push hook must exist');

  console.log('✓ Git hooks installed and verified.\n');

} finally {
  fse.removeSync(tmpRoot);
}

  console.log('======================================================');
  console.log('ALL RAPIDFIRE SECRET SHIELD TESTS PASSED FLAWLESSLY!');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
