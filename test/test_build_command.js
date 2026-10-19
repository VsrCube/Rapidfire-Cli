const assert = require('assert');
const path = require('path');
const os = require('os');
const fse = require('fs-extra');
const { handleBuild } = require('../src/commands/build');
const { matchCommand } = require('../src/commands');

console.log('--- TEST: BUILD COMMAND & FRONTEND DISCOVERY ---');

async function runTests() {
  console.log('[Test 1] Testing non-existent directory handling...');
  const resMissing = handleBuild(['non_existent_dir_99999']);
  assert.strictEqual(resMissing.success, false, 'Should fail gracefully on missing directory');
  console.log('  [OK] Missing folder handled cleanly with descriptive message');

  console.log('[Test 2] Testing command matcher routing for build...');
  const matchBuild = matchCommand('build my_app');
  assert(matchBuild && matchBuild.name === 'build', 'Matcher must route "build"');
  console.log('  [OK] REPL command matcher accurately routes build');

  console.log('[Test 3] Testing execution of build in isolated mock project...');
  const tempProject = path.join(os.tmpdir(), `rf_build_test_${Date.now()}`);
  fse.ensureDirSync(path.join(tempProject, 'frontend'));
  fse.writeJsonSync(path.join(tempProject, 'frontend', 'package.json'), {
    name: 'test-fe',
    version: '1.0.0',
    scripts: {
      build: 'node -e "process.exit(0)"'
    }
  });

  const resBuild = handleBuild([tempProject]);
  assert.strictEqual(resBuild.success, true, 'Build must succeed for mock frontend');
  fse.removeSync(tempProject);
  console.log('  [OK] Project build executed and succeeded');

  console.log('\n\x1b[32mALL BUILD COMMAND TESTS PASSED CLEANLY!\x1b[0m\n');
}

runTests().catch(err => {
  console.error('\x1b[31mBuild test failed:\x1b[0m', err);
  process.exit(1);
});
