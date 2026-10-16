const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { handleOverview } = require('../src/commands/overview');
const { matchCommand } = require('../src/commands');
const { loadRepoMemory } = require('../src/utils/repoMemory');

function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-overview-test-'));
  fs.mkdirSync(path.join(tmpDir, '.git'));
  fs.mkdirSync(path.join(tmpDir, 'src'));
  fs.writeFileSync(path.join(tmpDir, 'src', 'index.js'), 'console.log("hello");\n');
  fs.mkdirSync(path.join(tmpDir, 'test'));
  fs.writeFileSync(path.join(tmpDir, 'test', 'index.test.js'), 'assert(true);\n');

  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
    name: 'sample-overview-app',
    version: '1.2.0',
    description: 'A test project for overview verification',
    scripts: {
      start: 'node src/index.js',
      test: 'node test/index.test.js'
    },
    dependencies: {
      express: '^4.19.0'
    }
  }, null, 2));

  return tmpDir;
}

function cleanupTempProject(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

async function runTests() {
  console.log('--- TEST: OVERVIEW COMMAND & --CRITIC EVALUATION ---');

  const origCwd = process.cwd();
  const testProjectDir = createTempProject();

  try {
    process.chdir(testProjectDir);

    console.log('[Test 1] Executing overview command in project...');
    const result1 = await handleOverview([]);
    assert.strictEqual(result1.success, true, 'handleOverview should succeed');
    assert.strictEqual(result1.isCritic, false, 'Standard overview should not be critic mode');

    const mdDir = path.join(testProjectDir, 'md');
    const overviewFile = path.join(mdDir, 'overview.md');

    assert.strictEqual(fs.existsSync(mdDir), true, 'md/ directory must exist');
    assert.strictEqual(fs.existsSync(overviewFile), true, 'md/overview.md must exist');

    const content1 = fs.readFileSync(overviewFile, 'utf8');
    assert(content1.includes('Architecture Overview') || content1.includes('Overview'), 'Must contain overview heading');
    assert(content1.includes('Tech Stack') || content1.includes('Stack'), 'Must contain tech stack section');

    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    assert.strictEqual(emojiRegex.test(content1), false, 'Overview markdown must not contain emojis');
    console.log('[OK] Overview generation and markdown export verified.');

    console.log('[Test 2] Verifying overview rewrite behavior...');
    fs.writeFileSync(path.join(testProjectDir, 'src', 'extra.js'), 'module.exports = {};\n');
    const result2 = await handleOverview([]);
    assert.strictEqual(result2.success, true, 'Second overview execution should succeed');

    const content2 = fs.readFileSync(overviewFile, 'utf8');
    assert(content2.length > 50, 'Rewritten overview content must be valid');
    console.log('[OK] Overview file overwrite verified.');

    console.log('[Test 3] Executing overview with --critic flag...');
    const resultCritic = await handleOverview(['--critic']);
    assert.strictEqual(resultCritic.success, true, 'Critic overview should succeed');
    assert.strictEqual(resultCritic.isCritic, true, 'Critic mode must be true');

    const criticContent = fs.readFileSync(overviewFile, 'utf8');
    assert(criticContent.includes('Critique'), 'Must contain critique heading');
    assert(criticContent.includes('The Goods') || criticContent.includes('Goods'), 'Must contain Goods section');
    assert(criticContent.includes('The Bads') || criticContent.includes('Flaws') || criticContent.includes('Bads'), 'Must contain Bads/Flaws section');
    assert(criticContent.includes('Pros') && criticContent.includes('Cons'), 'Must contain Pros and Cons');

    const criticDedicatedFile = path.join(mdDir, 'overview_critic.md');
    assert.strictEqual(fs.existsSync(criticDedicatedFile), true, 'overview_critic.md must be generated');
    assert.strictEqual(emojiRegex.test(criticContent), false, 'Critic markdown must not contain emojis');
    console.log('[OK] Critic evaluation, goods/bads/flaws/pros/cons verified.');

    console.log('[Test 4] Verifying typo tolerance with --cirtic...');
    const resultTypo = await handleOverview(['--cirtic']);
    assert.strictEqual(resultTypo.success, true, 'overview --cirtic should succeed');
    assert.strictEqual(resultTypo.isCritic, true, '--cirtic must activate critic mode');
    console.log('[OK] Typo tolerance --cirtic verified.');

    console.log('[Test 5] Verifying REPL command matching for overview...');
    const match1 = matchCommand('overview');
    assert(match1, 'matchCommand should recognize overview');
    assert.strictEqual(match1.name, 'overview', 'Command name must be overview');

    const match2 = matchCommand('overview --critic');
    assert(match2, 'matchCommand should recognize overview --critic');
    assert.strictEqual(match2.name, 'overview', 'Command name must be overview');
    console.log('[OK] REPL command matcher verified.');

    console.log('[Test 6] Verifying repository memory database tracking...');
    const memory = loadRepoMemory(testProjectDir);
    assert(Array.isArray(memory.overviews), 'Memory database must contain overviews array');
    assert(memory.overviews.length >= 3, 'Memory database should record overview entries');
    const hasCriticEntry = memory.overviews.some(o => o.type === 'critic');
    const hasStandardEntry = memory.overviews.some(o => o.type === 'overview');
    assert.strictEqual(hasCriticEntry, true, 'Must record critic entry');
    assert.strictEqual(hasStandardEntry, true, 'Must record standard overview entry');
    console.log('[OK] Database logging verified.');

    console.log('[Test 7] Handling missing directory target...');
    const missingResult = await handleOverview(['non_existent_dir_99999']);
    assert.strictEqual(missingResult.success, false, 'Missing directory should return success: false');
    assert.strictEqual(missingResult.error, 'NOT_FOUND', 'Should return NOT_FOUND error');
    console.log('[OK] Missing target handled gracefully.');

    console.log('\nALL OVERVIEW COMMAND TESTS PASSED!\n');
  } finally {
    process.chdir(origCwd);
    cleanupTempProject(testProjectDir);
  }
}

runTests().catch(err => {
  console.error('[FAIL] Test threw unexpected error:', err);
  process.exit(1);
});
