const { commandExists } = require('../utils/proc');
const { installSecurityHooks, verifySecurityHooksInstalled } = require('../security/secretScanner');

function isGitleaksInstalled() {
  return commandExists('gitleaks');
}

function installPrePushHook(projectPath) {
  const res = installSecurityHooks(projectPath);
  return {
    success: res.success,
    hookPath: res.prePushPath,
    ...res
  };
}

function verifyHookInstalled(projectPath) {
  return verifySecurityHooksInstalled(projectPath);
}

module.exports = {
  isGitleaksInstalled,
  installPrePushHook,
  verifyHookInstalled
};
