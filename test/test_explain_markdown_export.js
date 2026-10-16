const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { handleExplain } = require('../src/commands/explain');
const { loadRepoMemory } = require('../src/utils/repoMemory');

function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-explain-test-'));
  fs.mkdirSync(path.join(tmpDir, '.git'));
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
    name: 'explain-sample-app',
    version: '1.0.0',
    description: 'A test project for explanation export validation'
  }, null, 2));
  return tmpDir;
}

function cleanupTempProject(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

async function runTests() {
  console.log('--- TEST: EXPLAIN MARKDOWN EXPORT & DB INTEGRATION ---');

  const origCwd = process.cwd();
  const testProjectDir = createTempProject();

  try {
    process.chdir(testProjectDir);

    console.log('[Test 1] Executing explain command on manifest...');
    const result = await handleExplain(['package.json']);
    assert.strictEqual(result.success, true, 'handleExplain should succeed');
    console.log('[OK] Execution completed.');

    console.log('[Test 2] Verifying md/ directory and file generation...');
    const mdDir = path.join(testProjectDir, 'md');
    const primaryFile = path.join(mdDir, 'explanation.md');
    const aliasFile = path.join(mdDir, 'explaination.md');

    assert.strictEqual(fs.existsSync(mdDir), true, 'md directory must exist');
    assert.strictEqual(fs.existsSync(primaryFile), true, 'md/explanation.md must exist');
    assert.strictEqual(fs.existsSync(aliasFile), true, 'md/explaination.md must exist');

    const primaryContent = fs.readFileSync(primaryFile, 'utf8');
    const aliasContent = fs.readFileSync(aliasFile, 'utf8');
    assert.strictEqual(primaryContent, aliasContent, 'Both files must have identical content');
    assert(primaryContent.length > 50, 'Generated documentation must be substantive');
    console.log('[OK] File generation and alias sync verified.');

    console.log('[Test 3] Verifying emoji absence in markdown export...');
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    assert.strictEqual(emojiRegex.test(primaryContent), false, 'Markdown must contain no emojis');
    console.log('[OK] Zero emoji verification passed.');

    assert.strictEqual(fs.existsSync(result.mdPath), true, 'Target-specific markdown file must exist');
    assert(result.mdFileName.includes('explain'), 'Filename must include explain');

    const db = loadRepoMemory(testProjectDir);
    assert.strictEqual(db.explanations.length >= 1, true, 'Explanation entry must be logged');
    const entry = db.explanations[db.explanations.length - 1];
    assert.strictEqual(entry.target, 'package.json', 'Target must match package.json');
    assert(entry.docPath.includes('explain') && entry.docPath.endsWith('.md'), 'Doc path must point to generated markdown file');
    console.log('[OK] Database logging verified.');

    console.log('\nALL EXPLAIN MARKDOWN EXPORT TESTS PASSED!\n');
  } finally {
    process.chdir(origCwd);
    cleanupTempProject(testProjectDir);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
