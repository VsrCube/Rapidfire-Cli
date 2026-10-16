const { execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

function ensurePath() {
  const isWindows = process.platform === 'win32';
  const delimiter = path.delimiter;
  const currentPath = process.env.PATH || '';
  const paths = currentPath.split(delimiter);

  const candidateDirs = [
    path.join(os.homedir(), '.local', 'bin'),
    path.join(os.homedir(), 'bin')
  ];

  if (isWindows) {
    if (process.env.LOCALAPPDATA) {
      candidateDirs.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'Python'));
      candidateDirs.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'Python', 'Python312', 'Scripts'));
      candidateDirs.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'Python', 'Python311', 'Scripts'));
      candidateDirs.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'Python', 'Python310', 'Scripts'));
      candidateDirs.push(path.join(process.env.LOCALAPPDATA, 'bin'));
    }
    if (process.env.APPDATA) {
      candidateDirs.push(path.join(process.env.APPDATA, 'npm'));
      candidateDirs.push(path.join(process.env.APPDATA, 'Python', 'Python312', 'Scripts'));
      candidateDirs.push(path.join(process.env.APPDATA, 'Python', 'Python311', 'Scripts'));
      candidateDirs.push(path.join(process.env.APPDATA, 'Python', 'Python310', 'Scripts'));
    }
  }

  if (process.platform === 'darwin') {
    candidateDirs.push('/opt/homebrew/bin');
    candidateDirs.push('/usr/local/bin');
  }

  for (const dir of candidateDirs) {
    if (dir && !paths.includes(dir) && fs.existsSync(dir)) {
      process.env.PATH = `${dir}${delimiter}${process.env.PATH}`;
    }
  }
}

ensurePath();

function commandExists(cmd) {
  ensurePath();
  const isWindows = process.platform === 'win32';
  const checkCmd = isWindows ? `where ${cmd}` : `which ${cmd}`;

  try {
    execSync(checkCmd, { stdio: ['ignore', 'pipe', 'ignore'] });
    return true;
  } catch {
    if (cmd === 'django-admin') {
      const directLocal = path.join(os.homedir(), '.local', 'bin', 'django-admin');
      if (fs.existsSync(directLocal)) return true;

      try {
        execSync('python3 -m django --version', { stdio: ['ignore', 'pipe', 'ignore'] });
        return true;
      } catch {
        try {
          execSync('python -m django --version', { stdio: ['ignore', 'pipe', 'ignore'] });
          return true;
        } catch {
          return false;
        }
      }
    }
    return false;
  }
}

function run(command, options = {}) {
  ensurePath();
  const defaultOptions = {
    stdio: 'inherit',
    env: { ...process.env, ...(options.env || {}) }
  };
  return execSync(command, { ...defaultOptions, ...options });
}

function runCapture(command, options = {}) {
  ensurePath();
  const defaultOptions = {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...(options.env || {}) }
  };
  return execSync(command, { ...defaultOptions, ...options }).trim();
}

function getDjangoAdminCmd() {
  ensurePath();
  const directLocal = path.join(os.homedir(), '.local', 'bin', 'django-admin');
  if (commandExists('django-admin')) {
    try {
      execSync('django-admin --version', { stdio: 'ignore' });
      return 'django-admin';
    } catch {
      if (fs.existsSync(directLocal)) return directLocal;
    }
  }
  if (fs.existsSync(directLocal)) return directLocal;
  const py = getPythonExecutable();
  return `${py} -m django`;
}

function getPythonExecutable() {
  ensurePath();
  const candidates = process.platform === 'win32'
    ? ['python', 'py', 'python3']
    : ['python3', 'python'];

  for (const cmd of candidates) {
    try {
      execSync(`${cmd} --version`, { stdio: 'ignore' });
      return cmd;
    } catch { }
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

function getVenvPython(venvPath) {
  const isWindows = process.platform === 'win32';
  return isWindows
    ? path.join(venvPath, 'Scripts', 'python.exe')
    : path.join(venvPath, 'bin', 'python');
}
function createVirtualEnvironment(targetDir) {
  const pythonCmd = getPythonExecutable();
  const venvPath = path.join(targetDir, 'venv');
  const isWindows = process.platform === 'win32';
  const pythonPath = getVenvPython(venvPath);

  try {
    execSync(`${pythonCmd} -m venv "${venvPath}"`, { stdio: 'inherit' });
    const activateCmd = isWindows ? '.\\venv\\Scripts\\activate' : 'source venv/bin/activate';
    return {
      success: true,
      venvPath,
      pythonPath,
      activateCmd
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

function hasPython() {
  ensurePath();
  const candidates = process.platform === 'win32'
    ? ['python', 'py', 'python3']
    : ['python3', 'python'];

  for (const cmd of candidates) {
    try {
      execSync(`${cmd} --version`, { stdio: 'ignore' });
      return true;
    } catch { }
  }
  return false;
}

function hasNode() {
  return commandExists('node');
}

function hasNpm() {
  return commandExists('npm');
}

function getPythonInstallInstructions() {
  if (process.platform === 'win32') {
    return '  • Windows: Run "winget install Python.Python.3.12" or download from https://python.org';
  } else if (process.platform === 'darwin') {
    return '  • macOS:   Run "brew install python" or download from https://python.org';
  } else {
    return '  • Debian/Ubuntu: sudo apt update && sudo apt install -y python3 python3-pip python3-venv\n  • Fedora/RHEL:   sudo dnf install -y python3 python3-pip\n  • Arch Linux:    sudo pacman -S python python-pip';
  }
}

function getNodeInstallInstructions() {
  if (process.platform === 'win32') {
    return '  • Windows: Run "winget install OpenJS.NodeJS.LTS" or download from https://nodejs.org';
  } else if (process.platform === 'darwin') {
    return '  • macOS:   Run "brew install node" or download from https://nodejs.org';
  } else {
    return '  • Debian/Ubuntu: sudo apt update && sudo apt install -y nodejs npm (or via nvm: https://github.com/nvm-sh/nvm)\n  • Fedora/RHEL:   sudo dnf install -y nodejs npm\n  • Arch Linux:    sudo pacman -S nodejs npm';
  }
}

function checkPrerequisites({ requiresNode = false, requiresPython = false, requiresDjango = false } = {}) {
  const missing = [];
  const instructions = [];

  if (requiresNode) {
    if (!hasNode() || !hasNpm()) {
      missing.push('Node.js (LTS) & npm');
      instructions.push(getNodeInstallInstructions());
    }
  }

  if (requiresPython) {
    if (!hasPython()) {
      missing.push('Python 3');
      instructions.push(getPythonInstallInstructions());
    }
  }

  if (requiresDjango) {
    if (hasPython() && !commandExists('django-admin')) {
      missing.push('Django (django-admin)');
      instructions.push('  • Install Django: Run "pip install django" (or "python3 -m pip install django")');
    }
  }

  if (missing.length > 0) {
    return {
      ok: false,
      missing,
      instructions: instructions.join('\n\n')
    };
  }

  return { ok: true, missing: [], instructions: '' };
}

module.exports = {
  ensurePath,
  commandExists,
  run,
  runCapture,
  getDjangoAdminCmd,
  getPythonExecutable,
  getVenvPython,
  createVirtualEnvironment,
  hasPython,
  hasNode,
  hasNpm,
  getPythonInstallInstructions,
  getNodeInstallInstructions,
  checkPrerequisites
};
