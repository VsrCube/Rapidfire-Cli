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
    path.join(os.homedir(), '.cargo', 'bin'),
    path.join(os.homedir(), '.local', 'bin'),
    path.join(os.homedir(), 'bin'),
    path.join(os.homedir(), 'go', 'bin'),
    '/usr/local/bin'
  ];

  if (isWindows) {
    const sysRoot = process.env.SystemRoot || process.env.SYSTEMROOT || 'C:\\Windows';
    candidateDirs.push(path.join(sysRoot, 'System32'));
    candidateDirs.push(sysRoot);
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

      const pyExe = getPythonExecutable();
      const pythonCandidates = [pyExe, 'python3', 'python', 'py'].filter(Boolean);
      for (const py of pythonCandidates) {
        try {
          execSync(`${py} -m django --version`, { stdio: ['ignore', 'pipe', 'ignore'] });
          return true;
        } catch { }
      }
      return false;
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
  try {
    execSync('django-admin --version', { stdio: 'ignore' });
    return 'django-admin';
  } catch {
    if (fs.existsSync(directLocal)) return directLocal;
  }
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

function hasRust() {
  ensurePath();
  return commandExists('cargo') || commandExists('rustc');
}

function hasGo() {
  ensurePath();
  return commandExists('go');
}

function hasDotnet() {
  ensurePath();
  return commandExists('dotnet');
}

function hasRuby() {
  ensurePath();
  return commandExists('ruby');
}

function hasPhp() {
  ensurePath();
  return commandExists('php');
}

function getPythonInstallInstructions() {
  if (process.platform === 'win32') {
    return '  • Windows:       Run "winget install Python.Python.3.12" or download from https://python.org';
  } else if (process.platform === 'darwin') {
    return '  • macOS:         Run "brew install python" or download from https://python.org';
  } else {
    return '  • Debian/Ubuntu: sudo apt update && sudo apt install -y python3 python3-pip python3-venv\n  • Fedora/RHEL:   sudo dnf install -y python3 python3-pip\n  • Arch Linux:    sudo pacman -S python python-pip';
  }
}

function getNodeInstallInstructions() {
  if (process.platform === 'win32') {
    return '  • Windows:       Run "winget install OpenJS.NodeJS.LTS" or download from https://nodejs.org';
  } else if (process.platform === 'darwin') {
    return '  • macOS:         Run "brew install node" or download from https://nodejs.org';
  } else {
    return '  • Debian/Ubuntu: sudo apt update && sudo apt install -y nodejs npm (or via nvm: https://github.com/nvm-sh/nvm)\n  • Fedora/RHEL:   sudo dnf install -y nodejs npm\n  • Arch Linux:    sudo pacman -S nodejs npm';
  }
}

function getRustInstallInstructions() {
  if (process.platform === 'win32') {
    return '  • Windows:       Run "winget install Rustlang.Rustup" or download from https://rustup.rs';
  } else if (process.platform === 'darwin') {
    return '  • macOS:         Run "brew install rust" or "curl --proto \'=https\' --tlsv1.2 -sSf https://sh.rustup.rs | sh"';
  } else {
    return '  • Recommended:   curl --proto \'=https\' --tlsv1.2 -sSf https://sh.rustup.rs | sh\n  • Arch Linux:    sudo pacman -S rust\n  • Debian/Ubuntu: sudo apt install -y cargo rustc\n  • Fedora/RHEL:   sudo dnf install -y cargo rust';
  }
}

function getGoInstallInstructions() {
  if (process.platform === 'win32') {
    return '  • Windows:       Run "winget install GoLang.Go" or download from https://go.dev/dl/';
  } else if (process.platform === 'darwin') {
    return '  • macOS:         Run "brew install go" or download from https://go.dev/dl/';
  } else {
    return '  • Download from: https://go.dev/doc/install\n  • Arch Linux:    sudo pacman -S go\n  • Debian/Ubuntu: sudo apt install -y golang-go\n  • Fedora/RHEL:   sudo dnf install -y golang';
  }
}

function getDotnetInstallInstructions() {
  if (process.platform === 'win32') {
    return '  • Windows:       Run "winget install Microsoft.DotNet.SDK.8" or download from https://dotnet.microsoft.com/download';
  } else if (process.platform === 'darwin') {
    return '  • macOS:         Run "brew install dotnet-sdk" or download from https://dotnet.microsoft.com/download';
  } else {
    return '  • Download from: https://dotnet.microsoft.com/download\n  • Arch Linux:    sudo pacman -S dotnet-sdk\n  • Debian/Ubuntu: sudo apt install -y dotnet-sdk-8.0\n  • Fedora/RHEL:   sudo dnf install -y dotnet-sdk-8.0';
  }
}

function getRubyInstallInstructions() {
  if (process.platform === 'win32') {
    return '  • Windows:       Run "winget install RubyInstallerTeam.Ruby" or download from https://rubyinstaller.org';
  } else if (process.platform === 'darwin') {
    return '  • macOS:         Run "brew install ruby"';
  } else {
    return '  • Arch Linux:    sudo pacman -S ruby\n  • Debian/Ubuntu: sudo apt install -y ruby-full\n  • Fedora/RHEL:   sudo dnf install -y ruby';
  }
}

function getPhpInstallInstructions() {
  if (process.platform === 'win32') {
    return '  • Windows:       Download from https://windows.php.net/download/';
  } else if (process.platform === 'darwin') {
    return '  • macOS:         Run "brew install php"';
  } else {
    return '  • Arch Linux:    sudo pacman -S php\n  • Debian/Ubuntu: sudo apt install -y php\n  • Fedora/RHEL:   sudo dnf install -y php';
  }
}

function getToolInstallHint(toolName) {
  const name = String(toolName || '').toLowerCase().trim();
  if (name.includes('rust') || name.includes('cargo') || name.includes('axum') || name.includes('actix')) {
    return getRustInstallInstructions();
  }
  if (name.includes('go') || name.includes('gin') || name.includes('golang')) {
    return getGoInstallInstructions();
  }
  if (name.includes('dotnet') || name.includes('csharp') || name === 'cs' || name === '.net') {
    return getDotnetInstallInstructions();
  }
  if (name.includes('python') || name.includes('fastapi') || name.includes('flask') || name.includes('django')) {
    return getPythonInstallInstructions();
  }
  if (name.includes('ruby') || name.includes('sinatra')) {
    return getRubyInstallInstructions();
  }
  if (name.includes('php')) {
    return getPhpInstallInstructions();
  }
  if (name.includes('node') || name.includes('npm')) {
    return getNodeInstallInstructions();
  }
  return null;
}

function checkPrerequisites({
  requiresNode = false,
  requiresPython = false,
  requiresDjango = false,
  requiresRust = false,
  requiresGo = false,
  requiresDotnet = false,
  requiresRuby = false,
  requiresPhp = false
} = {}) {
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

  if (requiresRust) {
    if (!hasRust()) {
      missing.push('Rust (cargo)');
      instructions.push(getRustInstallInstructions());
    }
  }

  if (requiresGo) {
    if (!hasGo()) {
      missing.push('Go');
      instructions.push(getGoInstallInstructions());
    }
  }

  if (requiresDotnet) {
    if (!hasDotnet()) {
      missing.push('.NET SDK (dotnet)');
      instructions.push(getDotnetInstallInstructions());
    }
  }

  if (requiresRuby) {
    if (!hasRuby()) {
      missing.push('Ruby');
      instructions.push(getRubyInstallInstructions());
    }
  }

  if (requiresPhp) {
    if (!hasPhp()) {
      missing.push('PHP');
      instructions.push(getPhpInstallInstructions());
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
  hasRust,
  hasGo,
  hasDotnet,
  hasRuby,
  hasPhp,
  getPythonInstallInstructions,
  getNodeInstallInstructions,
  getRustInstallInstructions,
  getGoInstallInstructions,
  getDotnetInstallInstructions,
  getRubyInstallInstructions,
  getPhpInstallInstructions,
  getToolInstallHint,
  checkPrerequisites
};
