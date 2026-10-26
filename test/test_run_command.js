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
  console.log('  [OK] REPL command matcher accurately routes run, start, and serve');

  console.log('[Test 3] Testing command matcher routing for stop, kill, and typos...');
  const matchStop = matchCommand('stop');
  assert(matchStop && matchStop.name === 'stop', 'Matcher must route "stop"');
  const matchKill = matchCommand('kill');
  assert(matchKill && matchKill.name === 'stop', 'Matcher must route "kill"');
  const matchTypo = matchCommand('stopp');
  assert(matchTypo && matchTypo.name === 'stop', 'Matcher must route typo "stopp" to stop');
  console.log('  [OK] Matcher accurately routes stop, kill, and typos');

  console.log('[Test 4] Testing stopProcesses execution...');
  const { stopProcesses } = require('../src/commands/run');
  const stoppedResult = stopProcesses();
  assert.strictEqual(stoppedResult.success, true, 'stopProcesses should return success: true');
  assert.strictEqual(typeof stoppedResult.count, 'number', 'stopProcesses should return count number');
  console.log('  [OK] stopProcesses executes safely and cleanly');

  console.log('[Test 5] Testing frameworkless static project discovery...');
  const scratchStatic = path.join(__dirname, 'scratch_static_test');
  fse.ensureDirSync(scratchStatic);
  fse.writeFileSync(path.join(scratchStatic, 'index.html'), '<!DOCTYPE html><html><body><h1>Vanilla App</h1></body></html>');
  const runPromise = handleRun([scratchStatic]);
  assert(runPromise && typeof runPromise.then === 'function', 'handleRun should return a promise');
  assert.strictEqual(runPromise.success, true, 'handleRun should report success: true on static project');
  const runRes = await runPromise;
  assert.strictEqual(runRes.success, true, 'handleRun resolved result should be success: true');
  const killRes = stopProcesses();
  assert.strictEqual(killRes.success, true, 'stopProcesses should kill static server cleanly');
  fse.removeSync(scratchStatic);
  console.log('[Test 6] Testing already-running application detection when run is invoked multiple times...');
  fse.ensureDirSync(scratchStatic);
  fse.writeFileSync(path.join(scratchStatic, 'index.html'), '<!DOCTYPE html><html><body><h1>Vanilla App</h1></body></html>');
  const runFirst = await handleRun([scratchStatic]);
  assert.strictEqual(runFirst.success, true, 'First run should succeed');

  const runSecond = await handleRun([scratchStatic]);
  assert.strictEqual(runSecond.success, true, 'Second run should succeed safely');
  assert.strictEqual(runSecond.alreadyRunning, true, 'Second run should detect application is already running');
  console.log('  [OK] Already-running application detected without duplicate server launch');

  console.log('[Test 7] Testing individual port kill (stop <port> / kill <port>)...');
  const killPortRes = stopProcesses(['3000']);
  assert.strictEqual(killPortRes.success, true, 'stopProcesses for port should succeed');
  assert.deepStrictEqual(killPortRes.ports, [3000], 'stopProcesses should target port 3000');

  const killColonPortRes = stopProcesses([':3001']);
  assert.strictEqual(killColonPortRes.success, true, 'stopProcesses for :3001 should succeed');
  assert.deepStrictEqual(killColonPortRes.ports, [3001], 'stopProcesses should target port 3001');

  stopProcesses();
  fse.removeSync(scratchStatic);
  console.log('  [OK] Individual port killing verified');

  console.log('\n\x1b[32mALL RUN AND STOP COMMAND TESTS PASSED CLEANLY!\x1b[0m\n');
}

runTests().catch(err => {
  console.error('\x1b[31mRun test failed:\x1b[0m', err);
  process.exit(1);
});
