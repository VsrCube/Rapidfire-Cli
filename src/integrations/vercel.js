const path = require('path');
const os = require('os');
const fs = require('fs');
const { commandExists, runCapture } = require('../utils/proc');

function isVercelGlobal() {
  if (process.env.RAPIDFIRE_MOCK_NO_VERCEL === '1') return false;
  return commandExists('vercel');
}

function isVercelInstalled() {
  if (process.env.RAPIDFIRE_MOCK_NO_VERCEL === '1') return false;
  return commandExists('vercel') || commandExists('npx');
}

function getVercelExecutable() {
  if (commandExists('vercel') && process.env.RAPIDFIRE_MOCK_NO_VERCEL !== '1') {
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
  if (process.env.RAPIDFIRE_MOCK_NO_AUTH === '1') return false;
  if (process.env.RAPIDFIRE_MOCK_VERCEL === '1') return true;
  if (process.env.VERCEL_TOKEN) return true;
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
  if (process.env.RAPIDFIRE_MOCK_NO_AUTH === '1') return false;
  if (process.env.RAPIDFIRE_MOCK_VERCEL === '1') return true;
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
  if (process.env.RAPIDFIRE_MOCK_VERCEL === '1') {
    return process.env.RAPIDFIRE_MOCK_USER || 'demo-developer';
  }
  if (!isVercelAuthenticated()) {
    return null;
  }
  if (process.env.VERCEL_USER) {
    return process.env.VERCEL_USER;
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
  return 'authenticated-user';
}

function deployFrontend(frontendPath, options = {}) {
  if (!frontendPath || !fs.existsSync(frontendPath)) {
    return {
      success: false,
      reason: 'not_found',
      message: `Frontend path does not exist: ${frontendPath}`
    };
  }

  if (process.env.RAPIDFIRE_MOCK_VERCEL === '1') {
    const projName = path.basename(frontendPath);
    const mockUrl = process.env.RAPIDFIRE_MOCK_URL || `https://${projName}.vercel.app`;
    return {
      success: true,
      url: mockUrl,
      output: `Deployment successful. Deployed to: ${mockUrl}`
    };
  }

  const isProd = options.isProd !== false;
  const timeout = options.timeout || 120000;
  const exe = getVercelExecutable();
  const prodFlag = isProd ? '--prod' : '';
  const tokenFlag = process.env.VERCEL_TOKEN ? `--token ${process.env.VERCEL_TOKEN}` : '';
  const cmd = `${exe} ${prodFlag} --yes ${tokenFlag}`.trim();

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
