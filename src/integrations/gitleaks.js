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
# RapidFire Gitleaks pre-push hook
echo "[rapidfire] Scanning outgoing changes for leaked secrets with gitleaks..."

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "[rapidfire-warning] gitleaks binary is not installed on PATH. Skipping leak check."
  echo "To enable secret protection, install gitleaks (e.g. pacman -S gitleaks or brew install gitleaks)."
  exit 0
fi

# Protect against secret leaks in staged/outgoing commits
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
