const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  findRepoRoot,
  initRepoDatabase,
  loadRepoMemory,
  saveRepoMemory,
  recordConversationTurn,
  getConversationTurns,
  recordExplanationEntry,
  clearRepoMemory
} = require('../src/utils/repoMemory');

function createTempRepo() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-repo-mem-'));
  fs.mkdirSync(path.join(tmpDir, '.git'));
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'temp-repo-test' }, null, 2));
  return tmpDir;
}

function cleanupTempRepo(tmpDir) {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
}

async function runTests() {
  console.log('--- TEST: REPO-SPECIFIC AI MEMORY DATABASE ---');

  const repoDir = createTempRepo();

  try {
    console.log('[Test 1] Locating repository root...');
    const foundRoot = findRepoRoot(repoDir);
    assert.strictEqual(foundRoot, repoDir, 'Should identify temp repo root via package.json');
    console.log('[OK] Root detection verified.');

    console.log('[Test 2] Initializing repository memory database...');
    const memDb = initRepoDatabase(repoDir);
    assert.strictEqual(memDb.repoName, 'temp-repo-test', 'Should set repoName from package.json');
    assert.strictEqual(Array.isArray(memDb.conversations), true, 'Conversations should be array');
    assert.strictEqual(Array.isArray(memDb.explanations), true, 'Explanations should be array');

    const dbFile = path.join(repoDir, '.rapidfire', 'memory.json');
    assert.strictEqual(fs.existsSync(dbFile), true, 'Database file must exist on disk');

    const gitignorePath = path.join(repoDir, '.gitignore');
    assert.strictEqual(fs.existsSync(gitignorePath), true, '.gitignore must be generated');
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    assert(gitignoreContent.includes('.rapidfire/'), '.gitignore must ignore .rapidfire/');
    console.log('[OK] Database initialization and .gitignore rule verified.');

    console.log('[Test 3] Recording and retrieving conversation turns...');
    recordConversationTurn(repoDir, 'How does authentication work here?', 'It uses JWT tokens in src/auth.js');
    const turns = getConversationTurns(repoDir, 10);
    assert.strictEqual(turns.length, 2, 'Should have 1 user turn and 1 model turn');
    assert.strictEqual(turns[0].role, 'user');
    assert.strictEqual(turns[0].parts[0].text, 'How does authentication work here?');
    assert.strictEqual(turns[1].role, 'model');
    assert.strictEqual(turns[1].parts[0].text, 'It uses JWT tokens in src/auth.js');
    console.log('[OK] Turn recording and retrieval verified.');

    console.log('[Test 4] Simulating terminal restart & persistent reload...');
    const reloaded = loadRepoMemory(repoDir);
    assert.strictEqual(reloaded.conversations.length, 1, 'Conversations should persist across reload');
    assert.strictEqual(reloaded.conversations[0].user, 'How does authentication work here?');
    assert.strictEqual(reloaded.conversations[0].model, 'It uses JWT tokens in src/auth.js');
    console.log('[OK] Cross-session persistence verified.');

    console.log('[Test 5] Recording architectural explanation entry...');
    recordExplanationEntry(repoDir, 'src/auth.js', 'Authentication module with token verification', 'md/explanation.md');
    const dbWithExp = loadRepoMemory(repoDir);
    assert.strictEqual(dbWithExp.explanations.length, 1, 'Should record 1 explanation entry');
    assert.strictEqual(dbWithExp.explanations[0].target, 'src/auth.js');
    assert.strictEqual(dbWithExp.explanations[0].docPath, 'md/explanation.md');
    console.log('[OK] Explanation logging verified.');

    console.log('[Test 6] Clearing conversation memory...');
    clearRepoMemory(repoDir);
    const clearedDb = loadRepoMemory(repoDir);
    assert.strictEqual(clearedDb.conversations.length, 0, 'Conversations must be emptied');
    assert.strictEqual(clearedDb.explanations.length, 1, 'Explanations must remain intact after conversation reset');
    console.log('[OK] Memory clearing behavior verified.');

    console.log('\nALL REPO MEMORY DATABASE TESTS PASSED!\n');
  } finally {
    cleanupTempRepo(repoDir);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
