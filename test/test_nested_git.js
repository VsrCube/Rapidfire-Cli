const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const fse = require('fs-extra');
const { handleSetup } = require('../src/commands/setup');
const { handlePush } = require('../src/commands/push');
const { run, runCapture } = require('../src/utils/proc');

console.log('=== TEST SUITE: NESTED GIT PREVENTION & ON-DEMAND GIT INITIALIZATION ===\n');

async function runTests() {
  const tmpRoot = path.join(os.tmpdir(), `test_nested_git_${Date.now()}`);
  fse.ensureDirSync(tmpRoot);

  try {
    console.log('[Test 1] Testing nested Git prevention inside existing repository...');
    const parentRepo = path.join(tmpRoot, 'my_monorepo');
    fse.ensureDirSync(parentRepo);
    try {
      run('git init -b main', { cwd: parentRepo, stdio: 'ignore' });
    } catch {
      run('git init', { cwd: parentRepo, stdio: 'ignore' });
    }
    run('git config user.name "Tester"', { cwd: parentRepo, stdio: 'ignore' });
    run('git config user.email "tester@test.com"', { cwd: parentRepo, stdio: 'ignore' });

    const originalCwd = process.cwd();
    process.chdir(parentRepo);

    try {
      console.log('  -> Scaffolding frontend (react) inside parent repo...');
      await handleSetup(['react', 'frontend'], { ask: async () => 'y' });

      console.log('  -> Scaffolding backend (fastapi) inside parent repo...');
      await handleSetup(['fastapi', 'backend'], { ask: async () => 'y' });

      assert.ok(fse.existsSync(path.join(parentRepo, 'frontend', 'package.json')), 'Frontend package.json should exist');
      assert.ok(fse.existsSync(path.join(parentRepo, 'backend', 'main.py')), 'Backend main.py should exist');

      assert.strictEqual(
        fse.existsSync(path.join(parentRepo, 'frontend', '.git')),
        false,
        'Frontend must NOT have a nested .git folder'
      );
      assert.strictEqual(
        fse.existsSync(path.join(parentRepo, 'backend', '.git')),
        false,
        'Backend must NOT have a nested .git folder'
      );

      run('git add .', { cwd: parentRepo, stdio: 'ignore' });
      const statusOutput = runCapture('git status --porcelain', { cwd: parentRepo });
      assert.ok(statusOutput.includes('frontend/package.json'), 'Parent git should track frontend files directly');
      assert.ok(statusOutput.includes('backend/main.py'), 'Parent git should track backend files directly');
      console.log('✔ Successfully prevented nested .git repositories in subfolders.');
    } finally {
      process.chdir(originalCwd);
    }

    console.log('\n[Test 2] Testing standalone setup when user declines local Git init (n)...');
    const nonGitDir = path.join(tmpRoot, 'standalone_area');
    fse.ensureDirSync(nonGitDir);
    process.chdir(nonGitDir);

    try {
      await handleSetup(['react', 'my_plain_app'], { ask: async () => 'n' });
      const appDir = path.join(nonGitDir, 'my_plain_app');
      assert.ok(fse.existsSync(path.join(appDir, 'package.json')), 'App package.json should exist');
      assert.strictEqual(
        fse.existsSync(path.join(appDir, '.git')),
        false,
        'Declined setup must NOT create a .git folder'
      );
      console.log('✔ Declined Git initialization leaves project clean without .git.');
    } finally {
      process.chdir(originalCwd);
    }

    console.log('\n[Test 3] Testing standalone setup when user approves local Git init (y)...');
    process.chdir(nonGitDir);

    try {
      await handleSetup(['vue', 'my_git_app'], { ask: async () => 'y' });
      const gitAppDir = path.join(nonGitDir, 'my_git_app');
      assert.ok(fse.existsSync(path.join(gitAppDir, 'package.json')), 'Vue package.json should exist');
      assert.strictEqual(
        fse.existsSync(path.join(gitAppDir, '.git')),
        true,
        'Approved setup must initialize a .git folder'
      );
      assert.strictEqual(
        fse.existsSync(path.join(gitAppDir, '.git', 'hooks', 'pre-push')),
        true,
        'Gitleaks pre-push hook must be installed'
      );
      console.log('✔ Approved Git initialization successfully creates .git and security hooks.');
    } finally {
      process.chdir(originalCwd);
    }

    console.log('\n[Test 4] Testing push rejection (n) in non-git directory...');
    const nonGitPushDir = path.join(tmpRoot, 'push_no_git_dir');
    fse.ensureDirSync(nonGitPushDir);
    fs.writeFileSync(path.join(nonGitPushDir, 'index.js'), 'console.log("hello");', 'utf8');

    const pushResReject = await handlePush('push -m "attempt push"', {
      cwd: nonGitPushDir,
      ask: async () => 'n'
    });

    assert.strictEqual(pushResReject.success, false, 'Push must fail when user rejects git init');
    assert.strictEqual(pushResReject.aborted, true, 'Push should report aborted status');
    assert.strictEqual(
      fse.existsSync(path.join(nonGitPushDir, '.git')),
      false,
      'Rejected push must not leave behind a .git folder'
    );
    console.log('✔ Rejected push aborts cleanly with zero filesystem modifications.');

    console.log('\n[Test 5] Testing push approval (y) in non-git directory...');
    const pushApproveDir = path.join(tmpRoot, 'push_approve_git_dir');
    fse.ensureDirSync(pushApproveDir);
    fs.writeFileSync(path.join(pushApproveDir, 'main.js'), 'console.log("init test");', 'utf8');

    const pushResApprove = await handlePush('push -m "initial push"', {
      cwd: pushApproveDir,
      ask: async (question) => {
        if (question.includes('initialize')) return 'y';
        if (question.includes('remote') || question.includes('GitHub')) return 'n';
        return 'n';
      }
    });

    assert.strictEqual(
      fse.existsSync(path.join(pushApproveDir, '.git')),
      true,
      'Approved push must initialize a .git folder'
    );
    assert.strictEqual(
      fse.existsSync(path.join(pushApproveDir, '.git', 'hooks', 'pre-push')),
      true,
      'Gitleaks pre-push hook must be installed'
    );
    console.log('✔ Approved push initializes Git repo and security hook on-demand.');

    console.log('\n======================================================');
    console.log('ALL NESTED GIT & ON-DEMAND INIT TESTS PASSED 100%!');
    console.log('======================================================\n');
  } finally {
    fse.removeSync(tmpRoot);
  }
}

runTests().catch((err) => {
  console.error('\n[ERROR] Test failed with error:', err);
  process.exit(1);
});
