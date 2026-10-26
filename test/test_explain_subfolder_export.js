const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { handleExplain } = require('../src/commands/explain');
const { handleOverview } = require('../src/commands/overview');
const { loadRepoMemory } = require('../src/utils/repoMemory');

function createMultiTierProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-subfolder-explain-'));
  fs.mkdirSync(path.join(tmpDir, '.git'));
  fs.writeFileSync(path.join(tmpDir, '.rapidfire.json'), JSON.stringify({
    recipe: 'react+django',
    folderName: 'sample-multitier'
  }, null, 2));

  const feDir = path.join(tmpDir, 'frontend');
  fs.mkdirSync(feDir);
  fs.mkdirSync(path.join(feDir, 'src'));
  fs.writeFileSync(path.join(feDir, 'package.json'), JSON.stringify({
    name: 'sample-frontend',
    version: '1.0.0',
    dependencies: { react: '^18.0.0' }
  }, null, 2));
  fs.writeFileSync(path.join(feDir, 'src', 'App.jsx'), 'export default function App() { return <div>App</div>; }\n');

  const beDir = path.join(tmpDir, 'backend');
  fs.mkdirSync(beDir);
  fs.writeFileSync(path.join(beDir, 'manage.py'), '#!/usr/bin/env python\n');
  fs.writeFileSync(path.join(beDir, 'requirements.txt'), 'django>=4.0\n');

  return tmpDir;
}

function cleanupTempProject(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

async function runTests() {
  console.log('--- TEST: SUBFOLDER EXPLAIN & OVERVIEW ROOT MD DIRECTORY PLACEMENT ---');

  const origCwd = process.cwd();
  const testProjectDir = createMultiTierProject();

  try {
    process.chdir(testProjectDir);

    console.log('[Test 1] Running explain frontend from project root...');
    const resFe = await handleExplain(['frontend']);
    assert.strictEqual(resFe.success, true, 'explain frontend should succeed');

    const rootMdDir = path.join(testProjectDir, 'md');
    const feMdDir = path.join(testProjectDir, 'frontend', 'md');
    const beMdDir = path.join(testProjectDir, 'backend', 'md');

    assert.strictEqual(fs.existsSync(rootMdDir), true, 'Root md/ directory must exist');
    assert.strictEqual(fs.existsSync(feMdDir), false, 'frontend/md directory must NOT exist');
    assert.strictEqual(fs.existsSync(beMdDir), false, 'backend/md directory must NOT exist');

    const expectedFeFile = path.join(rootMdDir, resFe.mdFileName);
    assert.strictEqual(fs.existsSync(expectedFeFile), true, 'Target explain file must exist in root md/ directory');
    assert.strictEqual(fs.existsSync(path.join(rootMdDir, 'explanation.md')), true, 'root md/explanation.md must exist');
    assert.strictEqual(fs.existsSync(path.join(rootMdDir, 'explaination.md')), true, 'root md/explaination.md must exist');
    console.log('[OK] frontend explain files correctly placed in root md/.');

    console.log('[Test 2] Running explain backend from project root...');
    const resBe = await handleExplain(['backend']);
    assert.strictEqual(resBe.success, true, 'explain backend should succeed');

    assert.strictEqual(fs.existsSync(beMdDir), false, 'backend/md directory must NOT exist');
    const expectedBeFile = path.join(rootMdDir, resBe.mdFileName);
    assert.strictEqual(fs.existsSync(expectedBeFile), true, 'Target backend explain file must exist in root md/ directory');
    console.log('[OK] backend explain files correctly placed in root md/.');

    console.log('[Test 3] Verifying database memory logging points to root md/...');
    const memory = loadRepoMemory(testProjectDir);
    assert.strictEqual(memory.explanations.length >= 2, true, 'Memory must record at least 2 explanations');
    const lastFe = memory.explanations.find(e => e.target === 'frontend');
    const lastBe = memory.explanations.find(e => e.target === 'backend');
    assert(lastFe && lastFe.docPath.startsWith('md/'), 'Frontend docPath must start with md/');
    assert(lastBe && lastBe.docPath.startsWith('md/'), 'Backend docPath must start with md/');
    console.log('[OK] Memory logs point to root md/ files.');

    console.log('[Test 4] Running overview frontend from project root...');
    const resOverview = await handleOverview(['frontend']);
    assert.strictEqual(resOverview.success, true, 'overview frontend should succeed');
    assert.strictEqual(fs.existsSync(feMdDir), false, 'frontend/md directory must NOT exist after overview');
    assert.strictEqual(fs.existsSync(path.join(rootMdDir, 'overview.md')), true, 'root md/overview.md must exist');
    console.log('[OK] overview file correctly placed in root md/.');

    console.log('\nALL SUBFOLDER EXPLAIN & OVERVIEW TESTS PASSED!\n');
  } finally {
    process.chdir(origCwd);
    cleanupTempProject(testProjectDir);
  }
}

runTests().catch(err => {
  console.error('[FAIL] Test threw unexpected error:', err);
  process.exit(1);
});
