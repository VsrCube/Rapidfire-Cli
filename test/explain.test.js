const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');
const { handleExplain, renderExplainErrorCard } = require('../src/commands/explain');
const { fallbackExplainFile, fallbackExplainDirectory } = require('../src/ai/provider');

console.log('\x1b[36mRunning Explain Command & Error Card Tests...\x1b[0m');

// 1. renderExplainErrorCard execution
assert.doesNotThrow(() => {
  renderExplainErrorCard('TEST: ERROR CARD', 'Unit test error card verification');
}, 'renderExplainErrorCard must not throw');
console.log('  \x1b[32m✔ Error card formatting verified\x1b[0m');

// 2. Nonexistent path handling
assert.doesNotThrow(async () => {
  const res = await handleExplain(['__nonexistent_target_dir__']);
  assert.strictEqual(res.success, false, 'Missing target must return success: false');
  assert.strictEqual(res.error, 'NOT_FOUND', 'Missing target must return error: NOT_FOUND');
}, 'handleExplain missing target should handle cleanly');
console.log('  \x1b[32m✔ Nonexistent target handled cleanly with NOT_FOUND error\x1b[0m');

// 3. Fallback file inspection
const fileRes = fallbackExplainFile(path.join(__dirname, '..', 'src', 'repl.js'));
assert.ok(fileRes.success, 'fallbackExplainFile must succeed');
assert.ok(fileRes.isFallback, 'Must be marked as fallback');
assert.ok(fileRes.text.includes('FILE INSPECTION: repl.js'), 'Must format file header');
assert.ok(fileRes.text.includes('DECLARED SYMBOLS & FUNCTIONS'), 'Must extract symbols');
console.log('  \x1b[32m✔ Deterministic fallback file inspection verified\x1b[0m');

// 4. Fallback directory inspection
const dirRes = fallbackExplainDirectory(path.join(__dirname, '..'));
assert.ok(dirRes.success, 'fallbackExplainDirectory must succeed');
assert.ok(dirRes.isFallback, 'Must be marked as fallback');
assert.ok(dirRes.text.includes('CODEBASE ARCHITECTURE: miniproject'), 'Must format directory header');
console.log('  \x1b[32m✔ Deterministic fallback directory inspection verified\x1b[0m');

// 5. CLI invocation exit code for nonexistent target
const binPath = path.join(__dirname, '..', 'bin', 'rapidfire.js');
const cliRes = spawnSync('node', [binPath, 'explain', 'completely_missing_xyz'], { encoding: 'utf8' });
assert.strictEqual(cliRes.status, 1, 'CLI must exit with code 1 on nonexistent target');
assert.ok(cliRes.stdout.includes('ERROR: TARGET DOES NOT EXIST'), 'CLI must output error card header');
console.log('  \x1b[32m✔ CLI exit code 1 & error card on missing target verified\x1b[0m');

console.log('\x1b[32m[PASS] Explain Command & Error Card Tests Passed!\x1b[0m\n');
