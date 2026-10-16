const path = require('path');
const os = require('os');
const fs = require('fs');
const { commandExists, runCapture } = require('../utils/proc');

function isVercelGlobal() {
  return commandExists('vercel');
}

function isVercelInstalled() {
  return commandExists('vercel') || commandExists('npx');
}

function getVercelExecutable() {
  if (commandExists('vercel')) {
    return 'vercel';
  }
  return 'npx --yes vercel';
}

function getVercelConfigDir() {
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'com.vercel.cli');
  }
  return path.join(os.homedir(), '.vercel');
}

function hasLocalVercelAuth() {
  const configDir = getVercelConfigDir();
  const authFile = path.join(configDir, 'auth.json');
  if (fs.existsSync(authFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(authFile, 'utf8'));
      return Boolean(data.token);
    } catch {
      return false;
    }
  }
  return false;
}

function isVercelAuthenticated() {
  if (hasLocalVercelAuth()) {
    return true;
  }
  if (!commandExists('vercel')) {
    return false;
  }
  try {
    const output = runCapture('vercel whoami', { timeout: 3000 });
    return Boolean(output && !output.includes('Error') && !output.includes('not logged in'));
  } catch {
    return false;
  }
}

function getVercelUser() {
  if (!isVercelAuthenticated()) {
    return null;
  }
  const configDir = getVercelConfigDir();
  const authFile = path.join(configDir, 'auth.json');
  if (fs.existsSync(authFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(authFile, 'utf8'));
      if (data.username) return data.username;
    } catch { }
  }
  if (commandExists('vercel')) {
    try {
      const output = runCapture('vercel whoami', { timeout: 3000 });
      if (output && !output.includes('Error')) {
        return output.trim();
      }
    } catch { }
  }
  return null;
}

function deployFrontend(frontendPath, options = {}) {
  if (!frontendPath || !fs.existsSync(frontendPath)) {
    return {
      success: false,
      reason: 'not_found',
      message: `Frontend path does not exist: ${frontendPath}`
    };
  }

  const isProd = options.isProd !== false;
  const timeout = options.timeout || 120000;
  const exe = getVercelExecutable();
  const prodFlag = isProd ? '--prod' : '';
  const cmd = `${exe} ${prodFlag} --yes`.trim();

  try {
    const output = runCapture(cmd, { cwd: frontendPath, timeout });
    const match = output.match(/https:\/\/[a-zA-Z0-9.-]+\.vercel\.app/i) || output.match(/https:\/\/[a-zA-Z0-9.-]+/);
    const url = match ? match[0] : null;
    return {
      success: true,
      url,
      output
    };
  } catch (err) {
    const combinedMsg = (err.stdout || '') + (err.stderr || '') + (err.message || '');
    const isAuth = combinedMsg.includes('login') ||
                   combinedMsg.includes('authentication') ||
                   combinedMsg.includes('Not authenticated') ||
                   combinedMsg.includes('credential');
    return {
      success: false,
      reason: isAuth ? 'unauthenticated' : 'deploy_failed',
      message: isAuth
        ? 'Vercel authentication required. Please run "npx vercel login" or "vercel login" first.'
        : err.message,
      error: err.message,
      stderr: err.stderr || ''
    };
  }
}

module.exports = {
  isVercelInstalled,
  isVercelGlobal,
  getVercelExecutable,
  isVercelAuthenticated,
  getVercelUser,
  deployFrontend
};
