const assert = require('assert');
const { matchCommand } = require('../src/commands');
const { parseDeployArgs, handleDeploy } = require('../src/commands/deploy');
const {
  isVercelInstalled,
  isVercelGlobal,
  getVercelExecutable,
  isVercelAuthenticated,
  getVercelUser,
  deployFrontend
} = require('../src/integrations/vercel');

console.log('--- TEST: DEPLOY COMMAND MATCHING & ARG PARSING ---');

const deployCmd = matchCommand('deploy');
assert(deployCmd, 'deploy command must be recognized');
assert.strictEqual(deployCmd.name, 'deploy');

const deployVercelCmd = matchCommand('deploy vercel');
assert(deployVercelCmd, 'deploy vercel command must be recognized');
assert.strictEqual(deployVercelCmd.name, 'deploy');

const deployFolderCmd = matchCommand('deploy my_app');
assert(deployFolderCmd, 'deploy with folder argument must be recognized');
assert.strictEqual(deployFolderCmd.name, 'deploy');

const deployVercelFolderCmd = matchCommand('deploy vercel my_app');
assert(deployVercelFolderCmd, 'deploy vercel with folder argument must be recognized');
assert.strictEqual(deployVercelFolderCmd.name, 'deploy');

const parsed1 = parseDeployArgs([]);
assert.strictEqual(parsed1.provider, 'vercel');
assert.strictEqual(parsed1.targetFolder, null);

const parsed2 = parseDeployArgs(['vercel']);
assert.strictEqual(parsed2.provider, 'vercel');
assert.strictEqual(parsed2.targetFolder, null, 'Passing "vercel" must not treat it as a target folder');

const parsed3 = parseDeployArgs(['vercel', 'my-client-app']);
assert.strictEqual(parsed3.provider, 'vercel');
assert.strictEqual(parsed3.targetFolder, 'my-client-app');

const parsed4 = parseDeployArgs(['my-client-app']);
assert.strictEqual(parsed4.provider, 'vercel');
assert.strictEqual(parsed4.targetFolder, 'my-client-app');

const parsed5 = parseDeployArgs(['vercel', '--prod', 'subfolder']);
assert.strictEqual(parsed5.provider, 'vercel');
assert.strictEqual(parsed5.targetFolder, 'subfolder');

console.log('OK: Deploy argument parsing verified.');

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

console.log('OK: Vercel CLI integration helper suite passed.');
