const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const fse = require('fs-extra');
const { parsePushArgs, handlePush } = require('../src/commands/push');
const { matchCommand } = require('../src/commands/index');
const { run, runCapture } = require('../src/utils/proc');

console.log('--- TEST: CUSTOM GIT PUSH & AUTO WORKFLOW ---');

async function runTests() {
  console.log('[Test 1] Testing flexible command syntax parsing...');

  const p1 = parsePushArgs('git add . push -branch main -commit "first commit"');
  assert.deepStrictEqual(p1.files, ['.'], 'Should parse files as [.]');
  assert.strictEqual(p1.branch, 'main', 'Should parse branch as main');
  assert.strictEqual(p1.message, 'first commit', 'Should parse message correctly');

  const p2 = parsePushArgs('add file1.js file2.js push -m -commit "compound flag test"');
  assert.deepStrictEqual(p2.files, ['file1.js', 'file2.js'], 'Should parse multiple files');
  assert.strictEqual(p2.branch, 'main', 'Should parse -m with -commit as branch: main');
  assert.strictEqual(p2.message, 'compound flag test', 'Should parse compound -m -commit flag');

  const p3 = parsePushArgs('git add README.md push -m -commit "updated"');
  assert.deepStrictEqual(p3.files, ['README.md'], 'Should parse single file in git add');
  assert.strictEqual(p3.branch, 'main', 'Should parse -m with -commit as branch: main');
  assert.strictEqual(p3.message, 'updated', 'Should parse message correctly');

  const pUserExact = parsePushArgs('git add . push -m -commit "gitpush command fix 1.8v"');
  assert.deepStrictEqual(pUserExact.files, ['.'], 'Should parse files as [.]');
  assert.strictEqual(pUserExact.branch, 'main', 'Should parse -m as branch main');
  assert.strictEqual(pUserExact.message, 'gitpush command fix 1.8v', 'Should parse commit message correctly');

  const pMainFlag = parsePushArgs('git add . push -main -commit "test main"');
  assert.strictEqual(pMainFlag.branch, 'main', 'Should parse -main as branch main');
  assert.strictEqual(pMainFlag.message, 'test main', 'Should parse message correctly');

  const p4 = parsePushArgs('git add . push -2nd branch -commit "new fix"');
  assert.deepStrictEqual(p4.files, ['.'], 'Should parse files as [.]');
  assert.strictEqual(p4.branch, '2nd', 'Should parse -2nd branch correctly');
  assert.strictEqual(p4.message, 'new fix', 'Should parse message correctly');

  const p5 = parsePushArgs('push -m "quick update"');
  assert.deepStrictEqual(p5.files, ['.'], 'Default files should be [.]');
  assert.strictEqual(p5.branch, null, 'Branch should remain null (current branch) when standard -m msg is used without -commit');
  assert.strictEqual(p5.message, 'quick update', 'Should parse -m flag');

  const p6 = parsePushArgs('push -b feature-123 -commit "wip commit"');
  assert.strictEqual(p6.branch, 'feature-123', 'Should parse -b flag');
  assert.strictEqual(p6.message, 'wip commit', 'Should parse -commit flag');

  const p7 = parsePushArgs('git add . push -b branch3 -commit "test b flag"');
  assert.strictEqual(p7.branch, 'branch3', 'Should parse -b branch3 correctly');

  const p8 = parsePushArgs('git add . push -branch3 -commit "attached branch"');
  assert.strictEqual(p8.branch, 'branch3', 'Should parse attached -branch3 correctly');

  const p9 = parsePushArgs('git add . push -brach3 -commit "typo branch"');
  assert.strictEqual(p9.branch, 'branch3', 'Should tolerate -brach3 typo as branch3');

  const p10 = parsePushArgs('push -b feat -m "message with -b and -m"');
  assert.strictEqual(p10.branch, 'feat', 'Should parse -b as branch');
  assert.strictEqual(p10.message, 'message with -b and -m', 'Should parse -m as message');

  const p11 = parsePushArgs('git add . push -m');
  assert.strictEqual(p11.branch, 'main', 'Standalone -m should target main branch');

  const pNoPush = parsePushArgs('git add . -m -commit "new"');
  assert.deepStrictEqual(pNoPush.files, ['.'], 'Should parse files as [.] without push keyword');
  assert.strictEqual(pNoPush.branch, 'main', 'Should parse -m as branch main when paired with -commit');
  assert.strictEqual(pNoPush.message, 'new', 'Should parse commit message correctly without push keyword');

  const matchNoPush = matchCommand('git add . -m -commit "new"');
  assert(matchNoPush, 'matchCommand must match git add with commit flags');
  assert.strictEqual(matchNoPush.name, 'push', 'Command name should be push');

  const matchAddCommit = matchCommand('add . -commit "only commit flag"');
  assert(matchAddCommit, 'matchCommand must match add with commit flag');
  assert.strictEqual(matchAddCommit.name, 'push', 'Command name should be push');

  console.log('✓ All syntax parsing combinations verified successfully.');

  console.log('[Test 2] Testing staging, committing, and pushing in an active repository...');
  const tmpRoot = path.join(os.tmpdir(), `test_push_${Date.now()}`);
  const bareRemote = path.join(tmpRoot, 'remote.git');
  const localProject = path.join(tmpRoot, 'my_project');
  const mockBin = path.join(tmpRoot, 'mock_bin');

  fse.ensureDirSync(bareRemote);
  fse.ensureDirSync(localProject);
  fse.ensureDirSync(mockBin);

  fs.writeFileSync(path.join(mockBin, 'gitleaks.cmd'), '@exit /b 0\r\n', 'utf8');
  fs.writeFileSync(path.join(mockBin, 'gitleaks'), '#!/bin/sh\nexit 0\n', 'utf8');
  try { fs.chmodSync(path.join(mockBin, 'gitleaks'), 0o755); } catch { }
  const origPath = process.env.PATH;
  process.env.PATH = mockBin + path.delimiter + process.env.PATH;

  try {
    run('git init --bare', { cwd: bareRemote, stdio: 'ignore' });

    try {
      run('git init -b main', { cwd: localProject, stdio: 'ignore' });
    } catch {
      run('git init', { cwd: localProject, stdio: 'ignore' });
    }

    run('git config user.name "Rapidfire Tester"', { cwd: localProject, stdio: 'ignore' });
    run('git config user.email "tester@rapidfire.dev"', { cwd: localProject, stdio: 'ignore' });

    run(`git remote add origin "${bareRemote.replace(/\\/g, '/')}"`, { cwd: localProject, stdio: 'ignore' });

    fs.writeFileSync(path.join(localProject, 'app.js'), 'console.log("Rapidfire Push 1");\n', 'utf8');

    const res1 = await handlePush('push -m "Add initial app.js"', { cwd: localProject });
    assert(res1.success, 'First push should succeed');
    assert.strictEqual(res1.commitMade, true, 'Commit should be created');

    const log1 = runCapture('git log -1 --pretty=%B', { cwd: localProject }).trim();
    assert.strictEqual(log1, 'Add initial app.js', 'Commit message should match');

    console.log('[Test 3] Testing compound "git add . push -branch main -commit ..." syntax...');
    fs.writeFileSync(path.join(localProject, 'server.js'), 'console.log("Rapidfire Server");\n', 'utf8');

    const res2 = await handlePush('git add . push -branch main -commit "Add server module"', { cwd: localProject });
    assert(res2.success, 'Second push should succeed');
    assert.strictEqual(res2.commitMade, true, 'Second commit should be created');

    const log2 = runCapture('git log -1 --pretty=%B', { cwd: localProject }).trim();
    assert.strictEqual(log2, 'Add server module', 'Second commit message should match');

    console.log('[Test 4] Testing single-file staging with "git add README.md push -m -commit \"updated\""...');
    fs.writeFileSync(path.join(localProject, 'README.md'), '# Rapidfire Test Repo\n', 'utf8');
    fs.writeFileSync(path.join(localProject, 'untracked.txt'), 'Do not stage me\n', 'utf8');

    const resSingle = await handlePush('git add README.md push -m -commit "updated"', { cwd: localProject });
    assert(resSingle.success, 'Single file push should succeed');
    assert.strictEqual(resSingle.commitMade, true, 'Commit should be created for README.md');

    const statusAfterSingle = runCapture('git status --porcelain', { cwd: localProject });
    assert(statusAfterSingle.includes('untracked.txt'), 'untracked.txt should remain untracked');
    assert(!statusAfterSingle.includes('README.md'), 'README.md should be committed');

    console.log('[Test 5] Testing custom branch creation with "git add . push -2nd branch -commit \"new fix\""...');
    fs.writeFileSync(path.join(localProject, 'fix.js'), 'console.log("Bug fix");\n', 'utf8');

    const resBranch = await handlePush('git add . push -2nd branch -commit "new fix"', { cwd: localProject });
    assert(resBranch.success, 'Push to 2nd branch should succeed');
    assert.strictEqual(resBranch.commitMade, true, 'Commit should be created on 2nd branch');

    const currentBranch = runCapture('git branch --show-current', { cwd: localProject }).trim();
    assert.strictEqual(currentBranch, '2nd', 'Active branch should now be 2nd');

    console.log('[Test 6] Testing push when working tree has no changes...');
    const res3 = await handlePush('push -m "no changes"', { cwd: localProject });
    assert(res3.success, 'Push on clean working tree should succeed cleanly');
    assert.strictEqual(res3.commitMade, false, 'No new commit should be created when clean');

    console.log('[Test 7] Testing pushing new branch with clean working tree...');
    const resNewBranchClean = await handlePush('git add . push -b branch3 -commit "README.md update"', { cwd: localProject });
    assert(resNewBranchClean.success, 'Push to new branch branch3 should succeed');
    assert.strictEqual(resNewBranchClean.commitMade, false, 'No new commit should be created since tree is clean');
    const branch3RemoteExists = runCapture('git rev-parse --verify origin/branch3', { cwd: localProject }).trim();
    assert(branch3RemoteExists, 'Remote origin/branch3 should exist after push');

    console.log('[Test 8] Testing push back to main with "git add . push -m -commit \"switch back to main\""...');
    fs.writeFileSync(path.join(localProject, 'main_update.js'), 'console.log("Main update");\n', 'utf8');

    const resMain = await handlePush('git add . push -m -commit "switch back to main"', { cwd: localProject });
    assert(resMain.success, 'Push back to main should succeed');
    assert.strictEqual(resMain.commitMade, true, 'Commit should be created on main branch');

    const finalBranch = runCapture('git branch --show-current', { cwd: localProject }).trim();
    assert.strictEqual(finalBranch, 'main', 'Active branch must now be switched to main');

    console.log('[Test 9] Testing Secret Shield intercepts exposed API key before committing or pushing...');
    fs.writeFileSync(path.join(localProject, 'secret_leak.js'), 'const OPENAI = "sk-proj-testexposedkey1234567890abcdef1234567890";\n', 'utf8');

    const resBlocked = await handlePush('git add . push -m -commit "attempting leak"', { cwd: localProject });
    assert.strictEqual(resBlocked.success, false, 'Push must fail when secrets are present');
    assert.strictEqual(resBlocked.blocked, true, 'Operation must be blocked by Secret Shield');
    assert.strictEqual(resBlocked.error, 'LEAKED_SECRETS_DETECTED', 'Error code must be LEAKED_SECRETS_DETECTED');
    assert(resBlocked.findings.length > 0, 'Must report findings');

    const latestCommitMsg = runCapture('git log -1 --pretty=%B', { cwd: localProject }).trim();
    assert.notStrictEqual(latestCommitMsg, 'attempting leak', 'Commit must not be added to git history');

    console.log('✓ Secret Shield verified: blocked commit and push cleanly!');
    console.log('✓ Full unified push workflow verified with 100% success!');
  } finally {
    fse.removeSync(tmpRoot);
  }

  console.log('\n\x1b[32mALL CUSTOM GIT PUSH TESTS PASSED CLEANLY!\x1b[0m\n');
}

runTests().catch((err) => {
  console.error('Push test failed:', err);
  process.exit(1);
});
