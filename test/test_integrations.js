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

  console.log('✓ Gitleaks pre-push hook installation and verification passed.');

  const ghInstalled = isGhInstalled();
  console.log(`  gh CLI detected on system: ${ghInstalled}`);

  const vercelInstalled = isVercelInstalled();
  console.log(`  Vercel CLI detected on system: ${vercelInstalled}`);

  console.log('✓ Integration detection functions ran cleanly without errors.');
} finally {
  fse.removeSync(tmpDir);
}
