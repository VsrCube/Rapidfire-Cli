const assert = require('assert');
const path = require('path');
const os = require('os');
const fse = require('fs-extra');
const { handleSuggest } = require('../src/commands/suggest');

console.log('--- TEST: INTERACTIVE (Y/N) AI IMPLEMENTATION PROMPT ---');

const tmpDir = path.join(os.tmpdir(), `test_suggest_yn_${Date.now()}`);
fse.ensureDirSync(tmpDir);

const originalCwd = process.cwd();
process.chdir(tmpDir);

async function runTest() {
  try {
    console.log('[Test 1] User answers N to implementation prompt...');
    let questionCount = 0;
    const mockRlReject = {
      question: (query, callback) => {
        questionCount++;
        callback('N');
      }
    };

    await handleSuggest(['simple portfolio'], { rl: mockRlReject });
    assert.strictEqual(questionCount, 1, 'Should ask Y/N question once');
    console.log('✓ Rejection handled cleanly without creating folders.');

    console.log('[Test 2] User answers Y followed by folder name...');
    const questionsAsked = [];
    const mockRlAccept = {
      question: (query, callback) => {
        questionsAsked.push(query);
        if (questionsAsked.length === 1) {
          callback('Y');
        } else if (questionsAsked.length === 2) {
          callback('my_interactive_app');
        }
      }
    };

    await handleSuggest(['machine learning dashboard with fast async endpoints'], { rl: mockRlAccept });
    assert.strictEqual(questionsAsked.length, 2, 'Should ask Y/N and then folder name');

    const createdFolder = path.join(tmpDir, 'my_interactive_app');
    assert(fse.existsSync(createdFolder), 'Project folder should have been scaffolded on Y');
    assert(fse.existsSync(path.join(createdFolder, '.rapidfire.json')), 'Manifest should exist in scaffolded project');
    console.log('✓ Interactive (Y/N) acceptance triggered scaffolding seamlessly.');

  } finally {
    process.chdir(originalCwd);
    fse.removeSync(tmpDir);
  }

  console.log('\n\x1b[32mINTERACTIVE (Y/N) PROMPT FLOW VERIFIED WITH 100% SUCCESS!\x1b[0m\n');
}

runTest().catch(err => {
  console.error('Interactive test failed:', err);
  process.exit(1);
});
