const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');
const { commandExists } = require('../utils/proc');

function isGitleaksInstalled() {
  return commandExists('gitleaks');
}

function installPrePushHook(projectPath) {
  const gitDir = path.join(projectPath, '.git');
  if (!fs.existsSync(gitDir)) {
    return {
      success: false,
      reason: 'no_git_dir',
      message: 'Not a git repository. Run "git init" first.'
    };
  }

  const hooksDir = path.join(gitDir, 'hooks');
  fse.ensureDirSync(hooksDir);

  const hookScript = `#!/bin/sh
echo "[rapidfire] Scanning outgoing changes for leaked secrets with gitleaks..."

if command -v gitleaks >/dev/null 2>&1; then
  gitleaks protect --verbose
  EXIT_CODE=$?
  if [ $EXIT_CODE -ne 0 ]; then
    echo ""
    echo "[BLOCKED] [rapidfire-security] Gitleaks detected sensitive credentials in your commits!"
    echo "Push has been blocked to prevent secret leaks."
    echo "Review the output above and revoke/remove exposed tokens before pushing."
    exit 1
  fi
  echo "[OK] [rapidfire-security] No leaks detected. Push proceeding."
  exit 0
fi

if command -v node >/dev/null 2>&1; then
  node -e "
    const { execSync } = require('child_process');
    try {
      const diff = execSync('git diff --cached 2>/dev/null || git diff HEAD~1 2>/dev/null || true', { encoding: 'utf8' });
      const patterns = [
        /(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/,
        /ghp_[a-zA-Z0-9]{36}/,
        /gho_[a-zA-Z0-9]{36}/,
        /glpat-[a-zA-Z0-9\\\\-_]{20,}/,
        /AIza[0-9A-Za-z\\\\-_]{35}/,
        /-----BEGIN (RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY-----/,
        /sk-[a-zA-Z0-9]{20,}/
      ];
      for (const p of patterns) {
        if (p.test(diff)) {
          console.error('[BLOCKED] [rapidfire-security] High-entropy credential or secret key detected in commits!');
          console.error('Offending pattern detected. Push has been blocked to protect your credentials.');
          process.exit(1);
        }
      }
    } catch {}
  "
  SCAN_CODE=$?
  if [ $SCAN_CODE -ne 0 ]; then
    exit 1
  fi
  echo "[OK] [rapidfire-security] No leaks detected. Push proceeding."
  exit 0
fi

echo "[rapidfire-security] Warning: Neither gitleaks nor node found to scan secrets. Push proceeding."
exit 0
`;

  const hookPath = path.join(hooksDir, 'pre-push');
  fs.writeFileSync(hookPath, hookScript, { mode: 0o755 });

  return {
    success: true,
    hookPath
  };
}

function verifyHookInstalled(projectPath) {
  const hookPath = path.join(projectPath, '.git', 'hooks', 'pre-push');
  return fs.existsSync(hookPath);
}

module.exports = {
  isGitleaksInstalled,
  installPrePushHook,
  verifyHookInstalled
};
