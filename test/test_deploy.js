const assert = require('assert');
const { matchCommand } = require('../src/commands');
const {
  isVercelInstalled,
  isVercelGlobal,
  getVercelExecutable,
  isVercelAuthenticated,
  getVercelUser,
  deployFrontend
} = require('../src/integrations/vercel');

console.log('--- TEST: DEPLOY COMMAND MATCHING ---');

const deployCmd = matchCommand('deploy');
assert(deployCmd, 'deploy command must be recognized');
assert.strictEqual(deployCmd.name, 'deploy');

const deployFolderCmd = matchCommand('deploy my_app');
assert(deployFolderCmd, 'deploy with folder argument must be recognized');
assert.strictEqual(deployFolderCmd.name, 'deploy');

console.log('✓ Deploy command recognized and routed correctly.');

console.log('--- TEST: VERCEL INTEGRATION METHODS ---');

const installed = isVercelInstalled();
assert.strictEqual(typeof installed, 'boolean', 'isVercelInstalled must return a boolean');

const globalInstalled = isVercelGlobal();
assert.strictEqual(typeof globalInstalled, 'boolean', 'isVercelGlobal must return a boolean');

const executable = getVercelExecutable();
assert(typeof executable === 'string' && executable.includes('vercel'), 'getVercelExecutable must return a valid command');

const authenticated = isVercelAuthenticated();
assert.strictEqual(typeof authenticated, 'boolean', 'isVercelAuthenticated must return a boolean');

const user = getVercelUser();
assert(user === null || typeof user === 'string', 'getVercelUser must return null or string');

const failResult = deployFrontend('/non_existent_path_rapidfire_test');
assert.strictEqual(failResult.success, false, 'deploying non-existent directory must return failure object');
assert(failResult.reason, 'failure object must contain reason');

console.log('✓ Vercel CLI integration helper suite passed.');
