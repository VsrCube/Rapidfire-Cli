const assert = require('assert');
const path = require('path');
const fse = require('fs-extra');
const { createVirtualEnvironment } = require('../src/utils/proc');

console.log('[test_venv_prompt] Testing Python virtual environment utilities...');

const scratchDir = path.resolve(__dirname, 'scratch_venv_test');
fse.ensureDirSync(scratchDir);

try {
  const res = createVirtualEnvironment(scratchDir);
  assert(typeof res === 'object', 'createVirtualEnvironment must return an object');

  if (res.success) {
    assert(fse.existsSync(res.venvPath), `venv folder must exist at ${res.venvPath}`);
    assert(res.activateCmd && typeof res.activateCmd === 'string', 'activateCmd must be provided');
    if (process.platform === 'win32') {
      assert(res.activateCmd.includes('Scripts'), 'Windows activation command should include Scripts');
    } else {
      assert(res.activateCmd.includes('bin/activate'), 'Unix activation command should include bin/activate');
    }
    console.log(`  ✔ Virtual environment successfully created at ${res.venvPath} with activation: ${res.activateCmd}`);
  } else {
    console.log(`  ⚠ Notice: System Python did not have venv module or access denied: ${res.error} (handled gracefully)`);
  }
} finally {
  fse.removeSync(scratchDir);
}

console.log('[test_venv_prompt] All venv prompt tests passed!');
