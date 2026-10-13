const assert = require('assert');
const path = require('path');
const fs = require('fs');
const {
  explainFile,
  explainDirectory,
  fallbackExplainFile,
  fallbackExplainDirectory
} = require('../src/ai/gemini');
const { handleExplain } = require('../src/commands/explain');

async function runTests() {
  console.log('--- TEST: EXPLAIN CODEBASE & FILE ARCHITECTURE ---');

  console.log('[Test 1] Inspecting package.json manifest...');
  const pkgRes = fallbackExplainFile(path.join(__dirname, '../package.json'));
  assert.strictEqual(pkgRes.success, true, 'package.json explanation should succeed');
  assert(pkgRes.text.includes('FILE INSPECTION: package.json'), 'Should contain file header');
  assert(pkgRes.text.includes('JSON Configuration'), 'Should detect JSON type');
  assert(pkgRes.text.includes('rapidfire-cli'), 'Should include package name in summary');
  console.log('✓ package.json inspection verified.');

  console.log('[Test 2] Inspecting src/repl.js source module...');
  const jsRes = fallbackExplainFile(path.join(__dirname, '../src/repl.js'));
  assert.strictEqual(jsRes.success, true, 'src/repl.js explanation should succeed');
  assert(jsRes.text.includes('FILE INSPECTION: repl.js'), 'Should contain repl.js header');
  assert(jsRes.text.includes('JavaScript'), 'Should detect JavaScript');
  assert(jsRes.text.includes('RapidfireRepl'), 'Should extract RapidfireRepl class');
  console.log('✓ src/repl.js code inspection verified.');

  console.log('[Test 3] Inspecting src/ directory architecture...');
  const dirRes = fallbackExplainDirectory(path.join(__dirname, '../src'));
  assert.strictEqual(dirRes.success, true, 'Directory explanation should succeed');
  assert(dirRes.text.includes('CODEBASE ARCHITECTURE: src'), 'Should contain directory header');
  assert(dirRes.text.includes('commands'), 'Should list commands directory in tree');
  assert(dirRes.text.includes('utils'), 'Should list utils directory in tree');
  console.log('✓ Directory architecture inspection verified.');

  console.log('[Test 4] Handling non-existent target...');
  const missingRes = fallbackExplainFile(path.join(__dirname, '../non_existent_target.xyz'));
  assert.strictEqual(missingRes.success, false, 'Non-existent target should return success: false');
  assert.strictEqual(missingRes.error, 'FILE_NOT_FOUND', 'Should return FILE_NOT_FOUND');
  console.log('✓ Missing target error handling verified.');

  console.log('[Test 5] Executing handleExplain command handler...');
  const cmdRes = await handleExplain(['package.json']);
  assert.strictEqual(cmdRes.success, true, 'handleExplain should return success: true');
  console.log('✓ handleExplain execution verified.');

  console.log('\nALL EXPLAIN CODEBASE TESTS PASSED CLEANLY!\n');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
