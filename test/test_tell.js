const assert = require('assert');
const path = require('path');
const fse = require('fs-extra');
const { instructGemini, fallbackInstructGenerator } = require('../src/ai/gemini');
const { handleTell } = require('../src/commands/tell');

async function runTests() {
  console.log('[test_tell] Testing tell command and generative instruction...');

  const testInstruction = 'create 2 cpp files named m1 m2';
  const generated = fallbackInstructGenerator(testInstruction);

  assert(generated && generated.files, 'Should return generated object with files');
  assert.strictEqual(generated.files.length, 2, 'Should generate exactly 2 files');
  assert.strictEqual(generated.files[0].filename, 'm1.cpp', 'First file should be m1.cpp');
  assert.strictEqual(generated.files[1].filename, 'm2.cpp', 'Second file should be m2.cpp');
  assert(generated.files[0].content.includes('#include <iostream>'), 'C++ file must have #include <iostream>');
  assert(generated.files[0].content.includes('main()'), 'C++ file must have main function');
  console.log('  ✔ fallbackInstructGenerator accurately parsed "create 2 cpp files named m1 m2"');

  const pyGen = fallbackInstructGenerator('create python files named parser test');
  assert.strictEqual(pyGen.files[0].filename, 'parser.py', 'Should generate parser.py');
  assert(pyGen.files[0].content.includes('def main():'), 'Python file should have main function');
  console.log('  ✔ fallbackInstructGenerator accurately parsed Python files');

  const scratchDir = path.resolve(__dirname, 'scratch_tell_test');
  fse.ensureDirSync(scratchDir);
  const origCwd = process.cwd();
  process.chdir(scratchDir);

  try {
    const res = await handleTell(['create', '2', 'cpp', 'files', 'named', 'm1', 'm2'], {
      ask: async () => 'Y'
    });

    assert(res && res.success, 'handleTell should succeed when confirmed with Y');
    assert.strictEqual(res.count, 2, 'Should report 2 files created');
    assert(fse.existsSync(path.join(scratchDir, 'm1.cpp')), 'm1.cpp must exist on disk');
    assert(fse.existsSync(path.join(scratchDir, 'm2.cpp')), 'm2.cpp must exist on disk');
    console.log('  ✔ handleTell created m1.cpp and m2.cpp on disk upon user Y confirmation');

    fse.removeSync(path.join(scratchDir, 'm1.cpp'));
    fse.removeSync(path.join(scratchDir, 'm2.cpp'));

    const cancelRes = await handleTell(['create', '2', 'cpp', 'files', 'named', 'm1', 'm2'], {
      ask: async () => 'N'
    });

    assert(cancelRes && cancelRes.cancelled, 'handleTell should report cancelled when user answers N');
    assert(!fse.existsSync(path.join(scratchDir, 'm1.cpp')), 'm1.cpp must NOT exist when cancelled');
    console.log('  ✔ handleTell respects user N cancellation without modifying filesystem');
  } finally {
    process.chdir(origCwd);
    fse.removeSync(scratchDir);
  }

  console.log('[test_tell] All tell tests passed successfully!');
}

runTests().catch(err => {
  console.error('[test_tell] Test failure:', err);
  process.exit(1);
});
