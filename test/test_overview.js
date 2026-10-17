const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { handleOverview } = require('../src/commands/overview');
const { matchCommand } = require('../src/commands');
const { loadRepoMemory } = require('../src/utils/repoMemory');

function createTempProject(prefix = 'rf-overview-test-') {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
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
    const criticDedicatedFile = path.join(mdDir, 'overview_critic.md');

    assert.strictEqual(fs.existsSync(mdDir), true, 'md/ directory must exist');
    assert.strictEqual(fs.existsSync(overviewFile), true, 'md/overview.md must exist');
    assert.strictEqual(fs.existsSync(criticDedicatedFile), false, 'overview_critic.md must NOT exist for standard overview');

    const content1 = fs.readFileSync(overviewFile, 'utf8');
    assert(content1.includes('Agenda / Goal'), 'Must contain Agenda / Goal');
    assert(content1.includes('Use Case'), 'Must contain Use Case');
    assert(content1.includes('Key Features'), 'Must contain Key Features');
    assert(content1.includes('Folder Architecture'), 'Must contain Folder Architecture');
    assert(content1.includes('Data Pipeline Flowchart'), 'Must contain Data Pipeline Flowchart');
    assert(content1.includes('File Overview / Directory Overview'), 'Must contain File/Directory Overview');
    assert(content1.includes('Working Flowchart'), 'Must contain Working Flowchart');
    assert(content1.includes('Technology Used'), 'Must contain Technology Used');
    assert(content1.includes('Security'), 'Must contain Security');
    assert(content1.includes('Conclusion'), 'Must contain Conclusion');
    assert(content1.includes('Things to Work On / Fixes'), 'Must contain Things to Work On / Fixes');

    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    assert.strictEqual(emojiRegex.test(content1), false, 'Overview markdown must not contain emojis');
    console.log('[OK] Overview 11-section generation and markdown export verified.');

    console.log('[Test 2] Verifying overview rewrite behavior...');
    fs.writeFileSync(path.join(testProjectDir, 'src', 'extra.js'), 'module.exports = {};\n');
    const result2 = await handleOverview([]);
    assert.strictEqual(result2.success, true, 'Second overview execution should succeed');

    const content2 = fs.readFileSync(overviewFile, 'utf8');
    assert(content2.length > 50, 'Rewritten overview content must be valid');
    console.log('[OK] Overview file overwrite verified.');

    console.log('[Test 3] Executing overview with --critic flag in dedicated project...');
    const criticProjectDir = createTempProject('rf-critic-exclusive-');
    try {
      process.chdir(criticProjectDir);
      const resultCritic = await handleOverview(['--critic']);
      assert.strictEqual(resultCritic.success, true, 'Critic overview should succeed');
      assert.strictEqual(resultCritic.isCritic, true, 'Critic mode must be true');

      const criticMdDir = path.join(criticProjectDir, 'md');
      const criticFile = path.join(criticMdDir, 'overview_critic.md');
      const standardFile = path.join(criticMdDir, 'overview.md');

      assert.strictEqual(fs.existsSync(criticFile), true, 'overview_critic.md must be generated');
      assert.strictEqual(fs.existsSync(standardFile), false, 'overview.md must NOT be generated when --critic is specified');

      const criticContent = fs.readFileSync(criticFile, 'utf8');
      assert(criticContent.includes('Architectural Critique'), 'Must contain critique heading');
      assert(criticContent.includes('Agenda / Goal'), 'Must contain Agenda / Goal');
      assert(criticContent.includes('Use Case'), 'Must contain Use Case');
      assert(criticContent.includes('Key Features'), 'Must contain Key Features');
      assert(criticContent.includes('Folder Architecture'), 'Must contain Folder Architecture');
      assert(criticContent.includes('Data Pipeline Flowchart'), 'Must contain Data Pipeline Flowchart');
      assert(criticContent.includes('File Overview / Directory Overview'), 'Must contain File/Directory Overview');
      assert(criticContent.includes('Working Flowchart'), 'Must contain Working Flowchart');
      assert(criticContent.includes('Technology Used'), 'Must contain Technology Used');
      assert(criticContent.includes('Security'), 'Must contain Security');
      assert(criticContent.includes('Conclusion'), 'Must contain Conclusion');
      assert(criticContent.includes('Things to Work On / Fixes'), 'Must contain Things to Work On / Fixes');
      assert(criticContent.includes('Pros'), 'Must contain Pros section');
      assert(criticContent.includes('Cons'), 'Must contain Cons section');
      assert(criticContent.includes('No critical architectural flaws detected') || criticContent.toLowerCase().includes('flaw'), 'Must evaluate architectural flaws');
      assert.strictEqual(emojiRegex.test(criticContent), false, 'Critic markdown must not contain emojis');
      console.log('[OK] Critic evaluation exclusive export and 14-section layout verified.');
    } finally {
      process.chdir(testProjectDir);
      cleanupTempProject(criticProjectDir);
    }

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

    console.log('[Test 8] Handling empty directory overview without hallucination...');
    const emptyTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-empty-test-'));
    try {
      const emptyResult = await handleOverview([emptyTestDir]);
      assert.strictEqual(emptyResult.success, true, 'Empty directory overview should succeed');
      assert.strictEqual(emptyResult.isEmpty, true, 'Empty directory must set isEmpty flag');
      const emptyMdFile = path.join(emptyTestDir, 'md', 'overview.md');
      assert.strictEqual(fs.existsSync(emptyMdFile), true, 'md/overview.md must exist in target empty dir');
      const emptyContent = fs.readFileSync(emptyMdFile, 'utf8');
      assert(emptyContent.includes('currently empty'), 'Must report directory is empty');
      assert(emptyContent.includes('Security'), 'Must contain Security section in empty overview');
      assert(!emptyContent.includes('Cargo.toml'), 'Must not hallucinate phantom files');
      console.log('[OK] Empty directory handling verified without hallucination.');
    } finally {
      cleanupTempProject(emptyTestDir);
    }

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
