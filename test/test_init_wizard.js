const assert = require('assert');
const path = require('path');
const fse = require('fs-extra');
const { matchCommand } = require('../src/commands');
const { STACK_PRESETS, askQuestion, runInitWizard } = require('../src/commands/wizard');

console.log('--- TEST: INIT WIZARD COMMAND MATCHING ---');

const initCmd = matchCommand('init');
assert(initCmd, 'init command must be recognized');
assert.strictEqual(initCmd.name, 'init');

const initRapidfireCmd = matchCommand('init rapidfire');
assert(initRapidfireCmd, 'init rapidfire must be recognized as wizard');
assert.strictEqual(initRapidfireCmd.name, 'init');

const initSetupAliasCmd = matchCommand('init react+fastapi my_app');
assert(initSetupAliasCmd, 'init with stack args must delegate to setup');
assert.strictEqual(initSetupAliasCmd.name, 'setup');

console.log('OK: init command matching verified.');

console.log('--- TEST: WIZARD QUESTION RUNNER & FALLBACK ---');

process.env.RAPIDFIRE_NON_INTERACTIVE = '1';
askQuestion({}, 'Test prompt?', 'fallback_val').then(async (res) => {
  assert.strictEqual(res, 'fallback_val', 'Non-interactive mode must return fallback value');
  delete process.env.RAPIDFIRE_NON_INTERACTIVE;

  console.log('OK: Non-interactive prompt fallback verified.');

  console.log('--- TEST: WIZARD WORKFLOW EXECUTION ---');

  const testFolder = path.join(__dirname, 'test_wizard_output_dir');
  fse.removeSync(testFolder);

  process.env.RAPIDFIRE_SKIP_INSTALL = '1';
  process.env.RAPIDFIRE_AUTO_GIT = '0';

  const mockAnswers = ['1', testFolder, 'n'];
  let askIndex = 0;
  const mockContext = {
    ask: async () => {
      const val = mockAnswers[askIndex++] || '';
      return val;
    }
  };

  try {
    await runInitWizard(mockContext, []);
    assert(fse.existsSync(testFolder), 'Wizard must scaffold the requested project folder');
    assert(fse.existsSync(path.join(testFolder, 'frontend')), 'Fullstack frontend must exist');
    assert(fse.existsSync(path.join(testFolder, 'backend')), 'Fullstack backend must exist');
    assert(fse.existsSync(path.join(testFolder, '.rapidfire.json')), 'Project manifest must exist');
    console.log('OK: Wizard step-by-step workflow execution verified.');
  } finally {
    fse.removeSync(testFolder);
    delete process.env.RAPIDFIRE_SKIP_INSTALL;
    delete process.env.RAPIDFIRE_AUTO_GIT;
    delete process.env.RAPIDFIRE_AUTO_VENV;
  }
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
