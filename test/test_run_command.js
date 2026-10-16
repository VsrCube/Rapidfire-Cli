const assert = require('assert');
const path = require('path');
const fse = require('fs-extra');
const { handleRun } = require('../src/commands/run');
const { matchCommand } = require('../src/commands');

console.log('--- TEST: IN-TERMINAL RUN COMMAND & DISCOVERY ---');

async function runTests() {
  console.log('[Test 1] Testing non-existent directory handling...');
  const resMissing = handleRun(['non_existent_folder_xyz_123']);
  assert.strictEqual(resMissing.success, false, 'Should fail gracefully on missing directory');
  console.log('  ✔ Missing folder handled cleanly with descriptive message');

  console.log('[Test 2] Testing command matcher routing for run, start, and serve...');
  const matchRun = matchCommand('run my_app');
  assert(matchRun && matchRun.name === 'run', 'Matcher must route "run"');
  const matchStart = matchCommand('start my_app');
  assert(matchStart && matchStart.name === 'run', 'Matcher must route "start"');
  const matchServe = matchCommand('serve my_app');
  assert(matchServe && matchServe.name === 'run', 'Matcher must route "serve"');
  console.log('  ✔ REPL command matcher accurately routes run, start, and serve');

  console.log('\n\x1b[32mALL RUN COMMAND TESTS PASSED CLEANLY!\x1b[0m\n');
}

runTests().catch(err => {
  console.error('\x1b[31mRun test failed:\x1b[0m', err);
  process.exit(1);
});
