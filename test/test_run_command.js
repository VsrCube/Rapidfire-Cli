const assert = require('assert');
const path = require('path');
const fse = require('fs-extra');
const { spawn, execSync } = require('child_process');
const { handleRun } = require('../src/commands/run');
const { matchCommand } = require('../src/commands');

console.log('--- TEST: IN-TERMINAL RUN COMMAND & DISCOVERY ---');

async function runTests() {
  console.log('[Test 1] Testing non-existent directory handling...');
  const resMissing = handleRun(['non_existent_folder_xyz_123']);
  assert.strictEqual(resMissing.success, false, 'Should fail gracefully on missing directory');
  console.log('  [OK] Missing folder handled cleanly with descriptive message');

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
  console.log('[Test 8] Testing preflight missing node_modules detection without auto-install...');
  const scratchNode = path.join(__dirname, 'scratch_node_uninstalled');
  fse.ensureDirSync(scratchNode);
  fse.writeFileSync(path.join(scratchNode, 'package.json'), JSON.stringify({ name: 'test-app', scripts: { dev: 'node server.js' } }), 'utf8');
  fse.writeFileSync(path.join(scratchNode, 'server.js'), 'console.log("ready");', 'utf8');

  const nodeRunRes = await handleRun([scratchNode]);
  assert.strictEqual(nodeRunRes.success, false, 'Run must halt if dependencies are missing');
  assert.strictEqual(nodeRunRes.error, 'MISSING_DEPENDENCIES', 'Error must be MISSING_DEPENDENCIES');
  assert.strictEqual(fse.existsSync(path.join(scratchNode, 'node_modules')), false, 'Run must NOT auto-install node_modules');
  fse.removeSync(scratchNode);
  console.log('  [OK] Preflight missing dependencies trapped cleanly without auto-install');

  console.log('[Test 9] Testing preflight missing Python venv detection without auto-install...');
  const scratchPy = path.join(__dirname, 'scratch_py_uninstalled');
  fse.ensureDirSync(scratchPy);
  fse.writeFileSync(path.join(scratchPy, 'main.py'), 'from fastapi import FastAPI\napp = FastAPI()', 'utf8');
  fse.writeFileSync(path.join(scratchPy, 'requirements.txt'), 'fastapi\nuvicorn\n', 'utf8');

  const pyRunRes = await handleRun([scratchPy]);
  assert.strictEqual(pyRunRes.success, false, 'Run must halt if Python venv is missing');
  assert.strictEqual(pyRunRes.error, 'MISSING_DEPENDENCIES', 'Error must be MISSING_DEPENDENCIES');
  fse.removeSync(scratchPy);
  console.log('  [OK] Python venv preflight validated cleanly');

  console.log('[Test 10] Testing autonomous detection of client/server folder pairs without .rapidfire.json...');
  const { detectProject } = require('../src/runner/detector');
  const scratchClientServer = path.join(__dirname, 'scratch_client_server');
  fse.ensureDirSync(path.join(scratchClientServer, 'client'));
  fse.ensureDirSync(path.join(scratchClientServer, 'server'));
  fse.writeFileSync(path.join(scratchClientServer, 'client', 'package.json'), JSON.stringify({ scripts: { dev: 'vite' } }));
  fse.writeFileSync(path.join(scratchClientServer, 'server', 'main.py'), 'from fastapi import FastAPI');

  const detectedPair = detectProject(scratchClientServer);
  assert.strictEqual(detectedPair.type, 'fullstack', 'Should detect client/server as fullstack pair');
  assert.strictEqual(detectedPair.frontend.tierName, 'client');
  assert.strictEqual(detectedPair.backend.tierName, 'server');
  fse.removeSync(scratchClientServer);
  console.log('  [OK] Universal monorepo pairing detected successfully');

  console.log('[Test 11] Testing unstructured folder diagnosis...');
  const scratchUnstructured = path.join(__dirname, 'scratch_unstructured');
  fse.ensureDirSync(scratchUnstructured);
  fse.writeFileSync(path.join(scratchUnstructured, 'notes.txt'), 'random notes');

  const unstructRes = await handleRun([scratchUnstructured]);
  assert.strictEqual(unstructRes.success, false, 'Unstructured folder must report no runnable app');
  assert.strictEqual(unstructRes.error, 'No runnable application found');
  fse.removeSync(scratchUnstructured);
  console.log('[Test 12] Testing CLI stop command invocation...');
  const stopOut = execSync(`node "${path.resolve(__dirname, '../bin/rapidfire.js')}" stop`, { encoding: 'utf8' });
  assert(stopOut.includes('Stopping all active servers') || stopOut.includes('All servers stopped'), 'CLI stop must invoke stopProcesses');
  console.log('  [OK] CLI stop command executes and exits cleanly');

  console.log('[Test 13] Testing CLI run SIGINT signal handling...');
  const scratchCli = path.join(__dirname, 'scratch_cli_sigint');
  fse.ensureDirSync(scratchCli);
  fse.writeFileSync(path.join(scratchCli, 'index.html'), '<h1>CLI Signal Test</h1>', 'utf8');

  const binPath = path.resolve(__dirname, '../bin/rapidfire.js');
  const cliProc = spawn('node', [binPath, 'run', scratchCli], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  await new Promise((resolve, reject) => {
    let output = '';
    cliProc.stdout.on('data', (d) => {
      output += d.toString();
      if (output.includes('Application is live')) {
        cliProc.kill('SIGINT');
      }
    });
    cliProc.on('exit', (code) => {
      fse.removeSync(scratchCli);
      assert.strictEqual(code, 0, 'CLI run must exit with 0 on SIGINT');
      resolve();
    });
    setTimeout(() => {
      cliProc.kill('SIGKILL');
      reject(new Error('CLI process did not terminate on SIGINT within 5 seconds'));
    }, 5000);
  });
  console.log('  [OK] CLI run process terminates and exits cleanly on SIGINT');

  console.log('[Test 14] Testing CLI run terminal input stop handling...');
  const scratchInput = path.join(__dirname, 'scratch_cli_input');
  fse.ensureDirSync(scratchInput);
  fse.writeFileSync(path.join(scratchInput, 'index.html'), '<h1>CLI Input Test</h1>', 'utf8');

  const inputProc = spawn('node', [binPath, 'run', scratchInput], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  await new Promise((resolve, reject) => {
    let output = '';
    inputProc.stdout.on('data', (d) => {
      output += d.toString();
      if (output.includes('Application is live')) {
        inputProc.stdin.write('stop\n');
      }
    });
    inputProc.on('exit', (code) => {
      fse.removeSync(scratchInput);
      assert.strictEqual(code, 0, 'CLI run must exit with 0 when typing stop');
      resolve();
    });
    setTimeout(() => {
      inputProc.kill('SIGKILL');
      reject(new Error('CLI process did not terminate on stop input within 5 seconds'));
    }, 5000);
  });
  console.log('  [OK] CLI run process terminates and exits cleanly when user types stop');

  console.log('\n\x1b[32mALL RUN AND STOP COMMAND TESTS PASSED CLEANLY!\x1b[0m\n');
}

runTests().catch(err => {
  console.error('\x1b[31mRun test failed:\x1b[0m', err);
  process.exit(1);
});
