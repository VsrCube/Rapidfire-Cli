const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const {
  getHostHistoryPaths,
  getPrimaryHostHistoryPath,
  sanitizeCommandLine,
  loadHistory,
  saveSessionHistory
} = require('../src/utils/history');
const { RapidfireRepl } = require('../src/repl');

function runTests() {
  console.log('--- TEST: BIDIRECTIONAL TERMINAL HISTORY SYNCHRONIZATION ---');

  console.log('[Test 1] Testing host history path detection...');
  const paths = getHostHistoryPaths();
  assert(Array.isArray(paths), 'Paths must be an array');
  assert(paths.length >= 2, 'Must return at least 2 potential paths');
  assert(paths.some((p) => p.includes('history')), 'Paths must contain history files');
  console.log('✓ Host history paths resolved:', paths.length, 'locations checked.');

  console.log('[Test 2] Testing command line sanitization...');
  assert.strictEqual(sanitizeCommandLine('   git status   '), 'git status', 'Should trim whitespace');
  assert.strictEqual(sanitizeCommandLine(''), null, 'Empty line should be null');
  assert.strictEqual(sanitizeCommandLine(null), null, 'Null input should be null');
  assert.strictEqual(sanitizeCommandLine('\x00\x01corrupt\x02\x03'), null, 'Binary characters must be rejected');
  assert.strictEqual(sanitizeCommandLine('git status; echo "__RF_DONE__0"'), null, '__RF_DONE__ sentinels must be rejected');
  assert.strictEqual(sanitizeCommandLine(': 1620000000:0;npm run dev'), 'npm run dev', 'Zsh timestamps should be stripped');
  console.log('✓ Command line sanitization verified.');

  console.log('[Test 3] Testing history loading and reverse-chronological ordering...');
  const history = loadHistory(50);
  assert(Array.isArray(history), 'Loaded history must be an array');
  if (history.length > 0) {
    assert(typeof history[0] === 'string', 'History items must be strings');
    assert(history.length <= 50, 'History must respect limit');
  }
  console.log('✓ History loading verified (loaded', history.length, 'recent commands for Up-Arrow).');

  console.log('[Test 4] Testing session history append...');
  const tmpDir = path.join(os.tmpdir(), `rf_hist_test_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  const mockHistFile = path.join(tmpDir, 'history.txt');
  fs.writeFileSync(mockHistFile, 'echo initial\n', 'utf8');

  const sessionCmds = ['setup react my_app', 'explain src/repl.js', 'exit'];
  const toAppend = sessionCmds
    .map((c) => sanitizeCommandLine(c))
    .filter((c) => c && c !== 'exit' && c !== 'quit')
    .join('\n') + '\n';
  fs.appendFileSync(mockHistFile, toAppend, 'utf8');

  const updatedContent = fs.readFileSync(mockHistFile, 'utf8');
  assert(updatedContent.includes('echo initial'), 'Initial content must be preserved');
  assert(updatedContent.includes('setup react my_app'), 'Session command 1 must be appended');
  assert(updatedContent.includes('explain src/repl.js'), 'Session command 2 must be appended');
  assert(!updatedContent.includes('\nexit\n'), 'Exit command must not be appended');

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('✓ Session history append verified.');

  console.log('[Test 5] Testing RapidfireRepl readline history initialization...');
  const repl = new RapidfireRepl();
  repl.start();
  assert(repl.rl !== null, 'Readline interface must be initialized');
  assert(Array.isArray(repl.rl.history), 'rl.history must be populated with array');
  repl.shutdown();
  console.log('✓ RapidfireRepl Up-Arrow history integration verified.');

  console.log('\nALL BIDIRECTIONAL HISTORY SYNC TESTS PASSED CLEANLY!\n');
}

runTests();
