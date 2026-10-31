const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const fse = require('fs-extra');
const { installPrePushHook, verifyHookInstalled } = require('../src/integrations/gitleaks');
const { isGhInstalled } = require('../src/integrations/gh');
const { isVercelInstalled } = require('../src/integrations/vercel');
const { run } = require('../src/utils/proc');

console.log('--- TEST: INTEGRATIONS (GITLEAKS, GH, VERCEL) ---');

const tmpDir = path.join(os.tmpdir(), `test_integrations_${Date.now()}`);
fse.ensureDirSync(tmpDir);

try {
  run('git init', { cwd: tmpDir, stdio: 'ignore' });
  const hookResult = installPrePushHook(tmpDir);
  assert(hookResult.success, 'installPrePushHook should succeed in a git repo');
  assert(verifyHookInstalled(tmpDir), 'verifyHookInstalled should return true');

  const hookContent = fs.readFileSync(path.join(tmpDir, '.git', 'hooks', 'pre-push'), 'utf8');
  assert(hookContent.includes('gitleaks'), 'Hook script must reference gitleaks');
  assert(hookContent.includes('SCAN_RANGES'), 'Hook script must compute outgoing commit SCAN_RANGES');

  // Verify pre-commit hook blocks commits containing secrets
  run('git config user.name "Tester"', { cwd: tmpDir, stdio: 'ignore' });
  run('git config user.email "tester@test.com"', { cwd: tmpDir, stdio: 'ignore' });
  fs.writeFileSync(path.join(tmpDir, 'leak.js'), 'const KEY = "AIzaSyDummyTestKey1234567890abcdef12345";\n', 'utf8');
  run('git add leak.js', { cwd: tmpDir, stdio: 'ignore' });

  let commitBlocked = false;
  try {
    run('git commit -m "leak commit"', { cwd: tmpDir, stdio: 'pipe' });
  } catch (err) {
    commitBlocked = true;
  }
  assert(commitBlocked, 'Pre-commit hook must block committing exposed credentials');

  // Even if someone bypasses pre-commit with --no-verify, pre-push hook must still block push
  run('git commit --no-verify -m "leak commit"', { cwd: tmpDir, stdio: 'ignore' });
  const hookPath = path.join(tmpDir, '.git', 'hooks', 'pre-push');
  let pushBlocked = false;
  try {
    const { execSync } = require('child_process');
    if (process.platform === 'win32') {
      try {
        execSync(`sh "${hookPath.replace(/\\/g, '/')}"`, { cwd: tmpDir, stdio: 'pipe' });
      } catch {
        pushBlocked = true;
      }
    } else {
      execSync(`"${hookPath}"`, { cwd: tmpDir, stdio: 'pipe' });
    }
  } catch (err) {
    pushBlocked = err.status !== 0;
  }
  assert(pushBlocked, 'Pre-push hook must block commit containing leaked credentials');

  console.log('✓ Secret Shield pre-commit and pre-push hook blocking verified.');

  const ghInstalled = isGhInstalled();
  console.log(`  gh CLI detected on system: ${ghInstalled}`);

  const vercelInstalled = isVercelInstalled();
  console.log(`  Vercel CLI detected on system: ${vercelInstalled}`);

  console.log('✓ Integration detection functions ran cleanly without errors.');
} finally {
  fse.removeSync(tmpDir);
}
