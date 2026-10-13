const fs = require('fs');
const path = require('path');
const os = require('os');
const { getRapidfireDir } = require('./configPath');

function getHostHistoryPaths() {
  const home = os.homedir();
  const paths = [];

  const isWindows = process.platform === 'win32';
  if (isWindows) {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    paths.push(path.join(appData, 'Microsoft', 'Windows', 'PowerShell', 'PSReadLine', 'ConsoleHost_history.txt'));
    paths.push(path.join(home, '.bash_history'));
  } else {
    paths.push(path.join(home, '.local', 'share', 'powershell', 'PSReadLine', 'ConsoleHost_history.txt'));
    paths.push(path.join(home, '.bash_history'));
    paths.push(path.join(home, '.zsh_history'));
  }

  const rfDir = getRapidfireDir ? getRapidfireDir() : path.join(home, '.rapidfire');
  paths.push(path.join(rfDir, 'history.txt'));

  return paths;
}

function getActiveHostHistoryPath() {
  const home = os.homedir();
  const isWindows = process.platform === 'win32';
  const isPwsh = Boolean(
    isWindows ||
    process.env.PSModulePath ||
    process.env.POWERSHELL_DISTRIBUTION_CHANNEL ||
    (process.env.SHELL && (process.env.SHELL.includes('pwsh') || process.env.SHELL.includes('powershell')))
  );

  if (isPwsh) {
    if (isWindows) {
      const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
      const pwshPath = path.join(appData, 'Microsoft', 'Windows', 'PowerShell', 'PSReadLine', 'ConsoleHost_history.txt');
      if (fs.existsSync(pwshPath)) return pwshPath;
    } else {
      const pwshPath = path.join(home, '.local', 'share', 'powershell', 'PSReadLine', 'ConsoleHost_history.txt');
      if (fs.existsSync(pwshPath)) return pwshPath;
    }
  }

  const userShell = process.env.SHELL || '';
  if (userShell.includes('zsh')) {
    const zshPath = path.join(home, '.zsh_history');
    if (fs.existsSync(zshPath)) return zshPath;
  }

  if (userShell.includes('bash')) {
    const bashPath = path.join(home, '.bash_history');
    if (fs.existsSync(bashPath)) return bashPath;
  }

  const candidates = [
    path.join(home, '.local', 'share', 'powershell', 'PSReadLine', 'ConsoleHost_history.txt'),
    path.join(home, '.bash_history'),
    path.join(home, '.zsh_history')
  ];
  let best = null;
  let bestMtime = 0;
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        const stat = fs.statSync(c);
        if (stat.mtimeMs > bestMtime) {
          bestMtime = stat.mtimeMs;
          best = c;
        }
      }
    } catch {}
  }
  return best;
}

function getPrimaryHostHistoryPath() {
  const active = getActiveHostHistoryPath();
  if (active) return active;

  const paths = getHostHistoryPaths();
  for (const p of paths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  const home = os.homedir();
  const rfDir = getRapidfireDir ? getRapidfireDir() : path.join(home, '.rapidfire');
  return path.join(rfDir, 'history.txt');
}

function sanitizeCommandLine(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let line = raw.trim();
  if (!line) return null;

  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/.test(line)) {
    return null;
  }

  if (line.includes('__RF_DONE__') || line.includes('__RF_') || line.includes('__rapidfire_')) {
    return null;
  }

  const zshMatch = line.match(/^:\s*\d+:\d+;(.*)$/);
  if (zshMatch) {
    line = zshMatch[1].trim();
  }

  return line;
}

function loadHistory(limit = 100) {
  const historyLines = [];
  const home = os.homedir();
  const rfDir = getRapidfireDir ? getRapidfireDir() : path.join(home, '.rapidfire');
  const rfPath = path.join(rfDir, 'history.txt');

  const pathsToLoad = [];
  if (fs.existsSync(rfPath)) {
    pathsToLoad.push(rfPath);
  }

  const hostPath = getActiveHostHistoryPath();
  if (hostPath && hostPath !== rfPath && fs.existsSync(hostPath)) {
    pathsToLoad.push(hostPath);
  } else if (!pathsToLoad.length) {
    const candidates = getHostHistoryPaths();
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        pathsToLoad.push(p);
        break;
      }
    }
  }

  for (const filePath of pathsToLoad) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const rawLines = content.split(/\r?\n/);

      for (const raw of rawLines) {
        const clean = sanitizeCommandLine(raw);
        if (!clean) continue;
        historyLines.push(clean);
      }
    } catch {
    }
  }

  if (historyLines.length === 0) {
    return [];
  }

  const deduped = [];
  let prev = null;
  for (const cmd of historyLines) {
    if (cmd !== prev) {
      deduped.push(cmd);
      prev = cmd;
    }
  }

  const recent = deduped.slice(-limit);

  return recent.reverse();
}

function saveSessionHistory(sessionCommands) {
  if (!Array.isArray(sessionCommands) || sessionCommands.length === 0) {
    return;
  }

  const cleanCommands = [];
  let last = null;
  for (const raw of sessionCommands) {
    const clean = sanitizeCommandLine(raw);
    if (!clean) continue;
    if (clean === 'exit' || clean === 'quit') continue;
    if (clean !== last) {
      cleanCommands.push(clean);
      last = clean;
    }
  }

  if (cleanCommands.length === 0) return;

  const textToAppend = cleanCommands.join('\n') + '\n';

  const home = os.homedir();
  const rfDir = getRapidfireDir ? getRapidfireDir() : path.join(home, '.rapidfire');
  try {
    if (!fs.existsSync(rfDir)) {
      fs.mkdirSync(rfDir, { recursive: true, mode: 0o700 });
    }
    const rfHistPath = path.join(rfDir, 'history.txt');
    fs.appendFileSync(rfHistPath, textToAppend, 'utf8');
  } catch {}

  const hostPath = getPrimaryHostHistoryPath();
  if (hostPath && !hostPath.includes('.rapidfire')) {
    try {
      const dir = path.dirname(hostPath);
      if (fs.existsSync(dir)) {
        fs.appendFileSync(hostPath, textToAppend, 'utf8');
      }
    } catch {}
  }
}

module.exports = {
  getHostHistoryPaths,
  getActiveHostHistoryPath,
  getPrimaryHostHistoryPath,
  sanitizeCommandLine,
  loadHistory,
  saveSessionHistory
};
