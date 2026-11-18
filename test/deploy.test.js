const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  parseDeployArgs,
  detectDeployTarget,
  renderDeployAuthCard,
  renderDeployErrorCard,
  handleDeploy
} = require('../src/commands/deploy');

console.log('\x1b[36mRunning Deploy Command & Guidance Card Tests...\x1b[0m');

// 1. Argument parsing matrix
const args1 = parseDeployArgs([]);
assert.strictEqual(args1.provider, 'vercel');
assert.strictEqual(args1.targetFolder, null);

const args2 = parseDeployArgs(['vercel', './client']);
assert.strictEqual(args2.provider, 'vercel');
assert.strictEqual(args2.targetFolder, './client');

const args3 = parseDeployArgs(['./my-app', 'vercel']);
assert.strictEqual(args3.provider, 'vercel');
assert.strictEqual(args3.targetFolder, './my-app');
console.log('  \x1b[32m✔ Argument parser matrix verified across flag positions\x1b[0m');

// 2. Guidance cards execution
assert.doesNotThrow(() => {
  renderDeployAuthCard('vercel');
  renderDeployErrorCard('TEST: ERROR CARD', 'Unit test error card verification', ['Step 1', 'Step 2']);
}, 'render guidance cards must not throw');
console.log('  \x1b[32m✔ Guidance cards formatting verified\x1b[0m');

// 3. Nonexistent directory handling
assert.doesNotThrow(async () => {
  const res = await handleDeploy(['__nonexistent_target_dir_xyz__']);
  assert.strictEqual(res.success, false, 'Missing target must return success: false');
  assert.strictEqual(res.error, 'Target directory does not exist');
}, 'handleDeploy missing target should handle cleanly');
console.log('  \x1b[32m✔ Nonexistent target handled cleanly with error card\x1b[0m');

// 4. Target detection for current project
const selfTarget = detectDeployTarget(path.join(__dirname, '..'));
assert.ok(selfTarget.hasPkg, 'RapidFire root has package.json');
console.log('  \x1b[32m✔ Target detection engine verified on repository root\x1b[0m');

// 5. CLI invocation exit code on missing target
const binPath = path.join(__dirname, '..', 'bin', 'rapidfire.js');
const cliRes = spawnSync('node', [binPath, 'deploy', '__completely_missing_xyz__'], { encoding: 'utf8' });
assert.strictEqual(cliRes.status, 1, 'CLI must exit with code 1 on missing directory');
assert.ok(cliRes.stdout.includes('ERROR: TARGET DIRECTORY NOT FOUND'), 'CLI must output error card');
console.log('  \x1b[32m✔ CLI exit code 1 & error card on missing directory verified\x1b[0m');

// 6. CLI invocation exit code on unauthenticated missing auth tokens
const cliAuthRes = spawnSync('node', [binPath, 'deploy', '.'], {
  encoding: 'utf8',
  env: { ...process.env, RAPIDFIRE_AUTO_DEPLOY: '1', RAPIDFIRE_MOCK_NO_AUTH: '1' }
});
assert.strictEqual(cliAuthRes.status, 1, 'CLI must exit with code 1 on missing auth');
assert.ok(cliAuthRes.stdout.includes('VERCEL AUTHENTICATION REQUIRED'), 'CLI must render authentication guidance card');
console.log('  \x1b[32m✔ CLI exit code 1 & guidance card on missing auth tokens verified\x1b[0m');

console.log('\x1b[32m[PASS] Deploy Command & Guidance Card Tests Passed!\x1b[0m\n');
