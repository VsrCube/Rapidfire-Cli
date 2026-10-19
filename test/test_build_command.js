const assert = require('assert');
const path = require('path');
const { handleBuild } = require('../src/commands/build');
const { matchCommand } = require('../src/commands');

console.log('--- TEST: BUILD COMMAND & FRONTEND DISCOVERY ---');

async function runTests() {
  console.log('[Test 1] Testing non-existent directory handling...');
  const resMissing = handleBuild(['non_existent_dir_99999']);
  assert.strictEqual(resMissing.success, false, 'Should fail gracefully on missing directory');
  console.log('  [OK] Missing folder handled cleanly with descriptive message');

  console.log('[Test 2] Testing command matcher routing for build...');
  const matchBuild = matchCommand('build crazy');
  assert(matchBuild && matchBuild.name === 'build', 'Matcher must route "build"');
  console.log('  [OK] REPL command matcher accurately routes build');

  console.log('[Test 3] Testing execution of build crazy...');
  const resBuild = handleBuild(['crazy']);
  assert.strictEqual(resBuild.success, true, 'Build crazy must succeed');
  console.log('  [OK] Project build executed and succeeded');

  console.log('\n\x1b[32mALL BUILD COMMAND TESTS PASSED CLEANLY!\x1b[0m\n');
}

runTests().catch(err => {
  console.error('\x1b[31mBuild test failed:\x1b[0m', err);
  process.exit(1);
});
