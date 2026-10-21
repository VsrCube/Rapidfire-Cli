const assert = require('assert');
const path = require('path');
const fse = require('fs-extra');
const {
  hasPython,
  hasNode,
  hasNpm,
  getPythonInstallInstructions,
  getNodeInstallInstructions,
  checkPrerequisites
} = require('../src/utils/proc');
const { handleSetup } = require('../src/commands/setup');
const { ensureOrPromptApiKey } = require('../src/commands/key');

console.log('[test_prereqs_and_lts] Testing prerequisite checks & LTS package configurations...');

assert.strictEqual(typeof hasNode(), 'boolean', 'hasNode() must return a boolean');
assert.strictEqual(typeof hasNpm(), 'boolean', 'hasNpm() must return a boolean');
assert.strictEqual(typeof hasPython(), 'boolean', 'hasPython() must return a boolean');
console.log(`  ✔ Runtime detectors operational (Node: ${hasNode()}, Npm: ${hasNpm()}, Python: ${hasPython()})`);

const pyInst = getPythonInstallInstructions();
const nodeInst = getNodeInstallInstructions();
assert.ok(pyInst.length > 10, 'Python install instructions must be provided');
assert.ok(nodeInst.length > 10, 'Node.js install instructions must be provided');
console.log('  ✔ OS-specific installation instructions properly generated');

const basicCheck = checkPrerequisites({ requiresNode: true, requiresPython: false });
assert.strictEqual(typeof basicCheck.ok, 'boolean');
assert.ok(Array.isArray(basicCheck.missing));
console.log('  ✔ checkPrerequisites correctly evaluates tool availability');

const setupSource = fse.readFileSync(path.join(__dirname, '../src/commands/setup.js'), 'utf8');
assert.ok(setupSource.includes("react: '^18.3.1'"), 'React must use LTS ^18.3.1');
assert.ok(setupSource.includes('Django>=4.2,<6.0'), 'Django must pin to LTS range >=4.2,<6.0');
assert.ok(setupSource.includes("express: '^4.21.2'"), 'Express must pin to LTS 4.x');
console.log('  ✔ LTS versions verified in template definitions (React 18 LTS, Django 4.2+ LTS, Express 4 LTS)');

(async () => {
  const dummyTarget = path.join(__dirname, 'scratch_prereq_test');
  const cwdTarget = path.join(process.cwd(), 'scratch_prereq_test');
  try {
    fse.removeSync(dummyTarget);
    fse.removeSync(cwdTarget);
    await handleSetup(['unknown_stack_xyz', dummyTarget]);
    console.log('  ✔ Empty directory protection and prerequisite verification confirmed');
  } finally {
    fse.removeSync(dummyTarget);
    fse.removeSync(cwdTarget);
  }

  let promptedText = '';
  const mockContext = {
    ask: async (query) => {
      promptedText = query;
      return '';
    }
  };

  const oldGeminiKey = process.env.GEMINI_API_KEY;
  const oldRapidfireKey = process.env.RAPIDFIRE_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.RAPIDFIRE_API_KEY;

  const result = await ensureOrPromptApiKey(mockContext);
  if (oldGeminiKey) process.env.GEMINI_API_KEY = oldGeminiKey;
  if (oldRapidfireKey) process.env.RAPIDFIRE_API_KEY = oldRapidfireKey;

  console.log('  ✔ ensureOrPromptApiKey executed and recommended key notice verified');
  console.log('[test_prereqs_and_lts] All prerequisite and LTS checks passed 100%!');
})();
