const assert = require('assert');
const { RapidfireRepl } = require('../src/repl');

console.log('--- TEST: REPL PROMPT RESTORATION AFTER SHELL COMMANDS ---');

async function runTests() {
  const repl = new RapidfireRepl();
  let promptCount = 0;
  const origPrompt = repl.prompt.bind(repl);

  repl.prompt = () => {
    promptCount++;
    origPrompt();
  };

  repl.start();

  console.log('[Test 1] Testing initial REPL prompt generation...');
  assert.strictEqual(promptCount, 1, 'Initial prompt should be displayed upon start');
  assert.strictEqual(repl.isPassthroughRunning, false, 'isPassthroughRunning should be false initially');

  const waitForPrompt = async (target, timeout = 2500) => {
    const start = Date.now();
    while (promptCount < target && Date.now() - start < timeout) {
      await new Promise((r) => setTimeout(r, 50));
    }
  };

  console.log('[Test 2] Testing prompt restoration after command with stdout...');
  await repl.handleLine('echo "RAPIDFIRE_TEST_STREAM"');
  await waitForPrompt(2);

  assert.strictEqual(promptCount, 2, 'Prompt must be called after command finishes');
  assert.strictEqual(repl.isPassthroughRunning, false, 'isPassthroughRunning must return to false');

  console.log('[Test 3] Testing prompt restoration after silent command (no stdout)...');
  await repl.handleLine('echo -n ""');
  await waitForPrompt(3);

  assert.strictEqual(promptCount, 3, 'Prompt must be called even when command has zero stdout');
  assert.strictEqual(repl.isPassthroughRunning, false, 'isPassthroughRunning must return to false for silent command');

  console.log('[Test 4] Testing delayed/network command execution without premature timeout...');
  const isWin = process.platform === 'win32';
  const sleepCmd = isWin ? 'Start-Sleep -Seconds 2' : 'sleep 2';

  await repl.handleLine(sleepCmd);

  await new Promise((r) => setTimeout(r, 600));
  assert.strictEqual(promptCount, 3, 'Prompt should NOT fire prematurely while command is running');
  assert.strictEqual(repl.isPassthroughRunning, true, 'isPassthroughRunning should stay true during execution');

  await waitForPrompt(4, 8000);
  assert.strictEqual(promptCount, 4, 'Prompt must fire automatically when long command finishes');
  assert.strictEqual(repl.isPassthroughRunning, false, 'isPassthroughRunning must be reset to false');

  console.log('[Test 5] Testing command with mid-stream pause to verify NO mid-stream prompt...');
  const pauseCmd = isWin
    ? 'Write-Host "Phase 1"; Start-Sleep -Milliseconds 700; Write-Host "Phase 2"'
    : 'echo "Phase 1"; sleep 0.7; echo "Phase 2"';

  await repl.handleLine(pauseCmd);

  await new Promise((r) => setTimeout(r, 300));
  assert.strictEqual(promptCount, 4, 'Prompt must NOT fire during mid-stream pause');
  assert.strictEqual(repl.isPassthroughRunning, true, 'isPassthroughRunning must stay true during pause');

  await waitForPrompt(5, 8000);
  assert.strictEqual(promptCount, 5, 'Prompt must fire exactly once after the command finishes');
  assert.strictEqual(repl.isPassthroughRunning, false, 'isPassthroughRunning must reset to false');

  console.log('[Test 6] Testing rapidfire command while active...');
  await repl.handleLine('rapidfire');
  assert.strictEqual(promptCount, 6, 'Prompt must return immediately after typing rapidfire');
  assert.strictEqual(repl.isPassthroughRunning, false, 'isPassthroughRunning must be false after rapidfire command');

  console.log('[Test 7] Testing clear command prompt return...');
  await repl.handleLine('clear');
  assert.strictEqual(promptCount, 7, 'Prompt must return immediately after typing clear');
  assert.strictEqual(repl.isPassthroughRunning, false, 'isPassthroughRunning must be false after clear command');

  console.log('[Test 8] Testing empty line Enter prompt recovery...');
  repl.isPassthroughRunning = true;
  await repl.handleLine('');
  assert.strictEqual(promptCount, 8, 'Prompt must be called on empty line Enter');
  assert.strictEqual(repl.isPassthroughRunning, false, 'isPassthroughRunning must be reset on empty line Enter');

  console.log('[Test 9] Testing shell parser error prompt recovery...');
  await repl.handleLine('np, run build');
  await waitForPrompt(9, 4000);
  assert.strictEqual(promptCount, 9, 'Prompt must return even when command causes a shell parser error');
  assert.strictEqual(repl.isPassthroughRunning, false, 'isPassthroughRunning must return to false after parser error');

  console.log('✓ All REPL prompt return test scenarios verified successfully!');

  repl.shutdown();
}

runTests().catch((err) => {
  console.error('REPL prompt test failed:', err);
  process.exit(1);
});
