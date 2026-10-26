const path = require('path');
const fs = require('fs');
const { spawn, exec, execSync } = require('child_process');
const { readManifest } = require('../utils/manifest');
const { isBinaryInPath } = require('../utils/fsHelpers');
const {
  getToolInstallHint,
  getRustInstallInstructions,
  getGoInstallInstructions,
  getDotnetInstallInstructions,
  getRubyInstallInstructions,
  getPhpInstallInstructions,
  getPythonInstallInstructions,
  getNodeInstallInstructions,
  hasNode,
  hasNpm,
  hasPython
} = require('../utils/proc');

const activeProcesses = [];
let pendingStartupTimer = null;
let pendingResolve = null;
let currentRunningApp = null;

function resolvePythonCmd(dir) {
  const candidateVenvs = [
    path.join(dir, 'venv'),
    path.join(dir, '.venv'),
    path.join(dir, '..', 'venv'),
    path.join(dir, '..', '.venv')
  ];

  for (const venvDir of candidateVenvs) {
    if (fs.existsSync(venvDir)) {
      const isWin = process.platform === 'win32';
      const venvPy = isWin
        ? path.join(venvDir, 'Scripts', 'python.exe')
        : path.join(venvDir, 'bin', 'python');
      if (fs.existsSync(venvPy)) {
        return venvPy;
      }
    }
  }

  return process.platform === 'win32' ? 'python' : 'python3';
}

function openBrowser(url) {
  const startCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${startCmd} ${url}`, () => {});
}

function killProcessTree(proc) {
  if (!proc || !proc.pid) return;
  try {
    if (proc.port) {
      freeKnownPorts([proc.port]);
    }
    if (process.platform === 'win32') {
      exec(`taskkill /pid ${proc.pid} /T /F`, () => {});
    } else {
      try {
        process.kill(-proc.pid, 'SIGTERM');
      } catch {
        try {
          process.kill(proc.pid, 'SIGTERM');
        } catch {}
      }
      setTimeout(() => {
        try {
          process.kill(-proc.pid, 'SIGKILL');
        } catch {
          try {
            process.kill(proc.pid, 'SIGKILL');
          } catch {}
        }
      }, 300);
    }
  } catch {}
}

function freeKnownPorts(ports = [3000, 3001, 5000, 8000]) {
  if (!ports || !Array.isArray(ports) || ports.length === 0) return;
  try {
    if (process.platform === 'win32') {
      for (const port of ports) {
        try {
          execSync(`for /f "tokens=5" %a in ('netstat -aon ^| findstr :${port}') do taskkill /f /pid %a 2>nul || true`, { stdio: 'ignore', shell: true });
        } catch {}
      }
    } else {
      for (const port of ports) {
        try {
          execSync(`fuser -k ${port}/tcp 2>/dev/null || true`, { stdio: 'ignore' });
        } catch {}
        try {
          execSync(`lsof -ti tcp:${port} -sTCP:LISTEN 2>/dev/null | xargs -r kill -9 2>/dev/null || true`, { stdio: 'ignore' });
        } catch {}
      }
    }
  } catch {}
}

function stopProcesses(args = []) {
  if (pendingStartupTimer) {
    clearTimeout(pendingStartupTimer);
    pendingStartupTimer = null;
  }
  if (pendingResolve) {
    try {
      pendingResolve({ success: false, aborted: true });
    } catch {}
    pendingResolve = null;
  }

  const portsToKill = [];
  if (Array.isArray(args)) {
    for (const arg of args) {
      const matches = String(arg).match(/\d+/g);
      if (matches) {
        for (const m of matches) {
          const p = parseInt(m, 10);
          if (p > 0 && p <= 65535 && !portsToKill.includes(p)) {
            portsToKill.push(p);
          }
        }
      }
    }
  } else if (typeof args === 'number' || typeof args === 'string') {
    const matches = String(args).match(/\d+/g);
    if (matches) {
      for (const m of matches) {
        const p = parseInt(m, 10);
        if (p > 0 && p <= 65535 && !portsToKill.includes(p)) {
          portsToKill.push(p);
        }
      }
    }
  }

  if (portsToKill.length > 0) {
    let killedCount = 0;
    for (let i = activeProcesses.length - 1; i >= 0; i--) {
      const proc = activeProcesses[i];
      if (proc && portsToKill.includes(proc.port)) {
        killProcessTree(proc);
        activeProcesses.splice(i, 1);
        killedCount++;
      }
    }
    freeKnownPorts(portsToKill);
    if (activeProcesses.length === 0) {
      currentRunningApp = null;
    }
    console.log(`\n\x1b[32m[rapidfire] Stopped process(es) on port: ${portsToKill.join(', ')}.\x1b[0m\n`);
    return { success: true, ports: portsToKill, count: killedCount };
  }

  const count = activeProcesses.length;
  while (activeProcesses.length > 0) {
    const proc = activeProcesses.pop();
    killProcessTree(proc);
  }
  freeKnownPorts([3000, 3001, 5000, 8000]);
  currentRunningApp = null;
  console.log(`\n\x1b[32m[rapidfire] Stopped all running application servers.\x1b[0m\n`);
  return { success: true, count };
}

function getInstallHint(cmd) {
  switch (cmd) {
    case 'cargo':
      return 'Install Rust via: curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh';
    case 'go':
      return 'Install Go via: https://go.dev/doc/install';
    case 'dotnet':
      return 'Install .NET SDK via: https://dotnet.microsoft.com/download';
    case 'ruby':
      return 'Install Ruby via your system package manager';
    case 'php':
      return 'Install PHP via your system package manager';
    case 'python':
    case 'python3':
      return 'Install Python via: https://www.python.org/downloads/';
    default:
      return null;
  }
}

function ensureUserBinPaths() {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (!home) return;
  const candidates = [
    path.join(home, '.cargo', 'bin'),
    path.join(home, '.local', 'bin'),
    path.join(home, 'go', 'bin'),
    '/usr/local/bin'
  ];
  const currentDirs = (process.env.PATH || '').split(path.delimiter);
  for (const c of candidates) {
    if (fs.existsSync(c) && !currentDirs.includes(c)) {
      process.env.PATH = `${c}${path.delimiter}${process.env.PATH}`;
    }
  }
}

function safeSpawn(cmd, args, options, processName, port) {
  try {
    const proc = spawn(cmd, args, options);
    if (proc) {
      proc.cmd = cmd;
      proc.port = port;
      proc.failed = false;
      proc.processName = processName || cmd;
      proc.on('error', (err) => {
        proc.failed = true;
        const idx = activeProcesses.indexOf(proc);
        if (idx !== -1) {
          activeProcesses.splice(idx, 1);
        }
        if (err.code === 'ENOENT') {
          console.error(`\x1b[31m[rapidfire] Error: No ${processName || cmd} ('${cmd}') found in your system PATH.\x1b[0m`);
          const hint = getToolInstallHint(cmd);
          if (hint) {
            console.log(`\x1b[33m[rapidfire] Hint: Installation instructions for your system:\x1b[0m\n${hint}`);
          } else {
            console.error(`\x1b[33m[rapidfire] Hint: Please install ${processName || cmd} and ensure '${cmd}' is available in your PATH.\x1b[0m`);
          }
        } else {
          console.error(`\x1b[31m[rapidfire] Error launching ${processName || cmd}: ${err.message}\x1b[0m`);
        }
      });
      proc.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          proc.failed = true;
          const idx = activeProcesses.indexOf(proc);
          if (idx !== -1) {
            activeProcesses.splice(idx, 1);
          }
        }
      });
      activeProcesses.push(proc);
    }
    return proc;
  } catch (err) {
    console.error(`\x1b[31m[rapidfire] Failed to spawn ${processName || cmd}: ${err.message}\x1b[0m`);
    return null;
  }
}

function ensureDependencies(target, hasFrontend, hasRootPkg) {
  if (hasFrontend) {
    const frontendDir = path.join(target, 'frontend');
    const pkgPath = path.join(frontendDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        let needsInstall = false;
        let pkgChanged = false;

        if (pkg.dependencies?.['@angular/core'] || pkg.devDependencies?.['@analogjs/vite-plugin-angular']) {
          pkg.dependencies = pkg.dependencies || {};
          pkg.devDependencies = pkg.devDependencies || {};
          if (!pkg.dependencies['@angular/router']) {
            pkg.dependencies['@angular/router'] = '^18.2.0';
            pkgChanged = true;
          }
          if (!pkg.devDependencies['@angular/compiler-cli']) {
            pkg.devDependencies['@angular/compiler-cli'] = '^18.2.0';
            pkgChanged = true;
          }
          if (!pkg.devDependencies['@angular/build']) {
            pkg.devDependencies['@angular/build'] = '^18.2.0';
            pkgChanged = true;
          }
          if (!pkg.devDependencies['vite'] || pkg.devDependencies['vite'].startsWith('^5.')) {
            pkg.devDependencies['vite'] = '^6.0.0';
            pkgChanged = true;
          }
          const tsconfigAppPath = path.join(frontendDir, 'tsconfig.app.json');
          if (!fs.existsSync(tsconfigAppPath)) {
            fs.writeFileSync(tsconfigAppPath, JSON.stringify({
              extends: './tsconfig.json',
              compilerOptions: { outDir: './out-tsc/app', types: [] },
              files: ['src/main.ts'],
              include: ['src/**/*.d.ts']
            }, null, 2), 'utf8');
          }
          const nodeModulesDir = path.join(frontendDir, 'node_modules');
          if (!fs.existsSync(nodeModulesDir) || !fs.existsSync(path.join(nodeModulesDir, '@angular', 'compiler-cli')) || !fs.existsSync(path.join(nodeModulesDir, '@angular', 'build')) || !fs.existsSync(path.join(nodeModulesDir, '@angular', 'router'))) {
            needsInstall = true;
          }
        }

        if (!fs.existsSync(path.join(frontendDir, 'node_modules'))) {
          needsInstall = true;
        }

        if (pkgChanged) {
          fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
          needsInstall = true;
        }

        if (needsInstall && process.env.RAPIDFIRE_SKIP_INSTALL !== '1') {
          console.log('\x1b[36m[*] Installing missing LTS frontend dependencies...\x1b[0m');
          const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
          try {
            execSync(`"${npmCmd}" install`, { cwd: frontendDir, stdio: 'inherit' });
          } catch {
            execSync(`"${npmCmd}" install --legacy-peer-deps`, { cwd: frontendDir, stdio: 'inherit' });
          }
          console.log('\x1b[32m[OK] Frontend dependencies installed successfully.\x1b[0m');
        }
      } catch (err) {
        console.warn('\x1b[33m[rapidfire] Dependency preflight notice:\x1b[0m', err.message);
      }
    }

    const backendDir = path.join(target, 'backend');
    const backendPkgPath = path.join(backendDir, 'package.json');
    if (fs.existsSync(backendPkgPath)) {
      try {
        const backendNodeModules = path.join(backendDir, 'node_modules');
        if (!fs.existsSync(backendNodeModules) && process.env.RAPIDFIRE_SKIP_INSTALL !== '1') {
          console.log('\x1b[36m[*] Installing missing LTS backend dependencies...\x1b[0m');
          const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
          try {
            execSync(`"${npmCmd}" install`, { cwd: backendDir, stdio: 'inherit' });
          } catch {
            execSync(`"${npmCmd}" install --legacy-peer-deps`, { cwd: backendDir, stdio: 'inherit' });
          }
          console.log('\x1b[32m[OK] Backend dependencies installed successfully.\x1b[0m');
        }
      } catch (err) {
        console.warn('\x1b[33m[rapidfire] Backend dependency preflight notice:\x1b[0m', err.message);
      }
    }
  } else if (hasRootPkg) {
    const pkgPath = path.join(target, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        let needsInstall = false;
        let pkgChanged = false;

        if (pkg.dependencies?.['@angular/core'] || pkg.devDependencies?.['@analogjs/vite-plugin-angular']) {
          pkg.dependencies = pkg.dependencies || {};
          pkg.devDependencies = pkg.devDependencies || {};
          if (!pkg.dependencies['@angular/router']) {
            pkg.dependencies['@angular/router'] = '^18.2.0';
            pkgChanged = true;
          }
          if (!pkg.devDependencies['@angular/compiler-cli']) {
            pkg.devDependencies['@angular/compiler-cli'] = '^18.2.0';
            pkgChanged = true;
          }
          if (!pkg.devDependencies['@angular/build']) {
            pkg.devDependencies['@angular/build'] = '^18.2.0';
            pkgChanged = true;
          }
          if (!pkg.devDependencies['vite'] || pkg.devDependencies['vite'].startsWith('^5.')) {
            pkg.devDependencies['vite'] = '^6.0.0';
            pkgChanged = true;
          }
          const tsconfigAppPath = path.join(target, 'tsconfig.app.json');
          if (!fs.existsSync(tsconfigAppPath)) {
            fs.writeFileSync(tsconfigAppPath, JSON.stringify({
              extends: './tsconfig.json',
              compilerOptions: { outDir: './out-tsc/app', types: [] },
              files: ['src/main.ts'],
              include: ['src/**/*.d.ts']
            }, null, 2), 'utf8');
          }
          const nodeModulesDir = path.join(target, 'node_modules');
          if (!fs.existsSync(nodeModulesDir) || !fs.existsSync(path.join(nodeModulesDir, '@angular', 'compiler-cli')) || !fs.existsSync(path.join(nodeModulesDir, '@angular', 'build')) || !fs.existsSync(path.join(nodeModulesDir, '@angular', 'router'))) {
            needsInstall = true;
          }
        }

        if (!fs.existsSync(path.join(target, 'node_modules'))) {
          needsInstall = true;
        }

        if (pkgChanged) {
          fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
          needsInstall = true;
        }

        if (needsInstall && process.env.RAPIDFIRE_SKIP_INSTALL !== '1') {
          console.log('\x1b[36m[*] Installing missing LTS project dependencies...\x1b[0m');
          const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
          try {
            execSync(`"${npmCmd}" install`, { cwd: target, stdio: 'inherit' });
          } catch {
            execSync(`"${npmCmd}" install --legacy-peer-deps`, { cwd: target, stdio: 'inherit' });
          }
          console.log('\x1b[32m[OK] Dependencies installed successfully.\x1b[0m');
        }
      } catch (err) {
        console.warn('\x1b[33m[rapidfire] Dependency preflight notice:\x1b[0m', err.message);
      }
    }
  }
}

function handleRun(args = [], context = null) {
  const target = args[0] ? path.resolve(process.cwd(), args[0]) : process.cwd();

  for (let i = activeProcesses.length - 1; i >= 0; i--) {
    const p = activeProcesses[i];
    if (!p || p.killed) {
      activeProcesses.splice(i, 1);
      continue;
    }
    try {
      process.kill(p.pid, 0);
    } catch {
      activeProcesses.splice(i, 1);
    }
  }

  if (activeProcesses.length > 0) {
    console.log('\n\x1b[33m[rapidfire] Application server is already running!\x1b[0m');
    const runningTarget = currentRunningApp ? currentRunningApp.target : null;
    const feUrl = currentRunningApp ? currentRunningApp.frontendUrl : (activeProcesses[0]?.port ? `http://localhost:${activeProcesses[0].port}` : 'http://localhost:3000');
    const beUrl = currentRunningApp ? currentRunningApp.backendUrl : null;
    if (feUrl) {
      console.log(`  Frontend:  \x1b[36m${feUrl}\x1b[0m`);
    }
    if (beUrl) {
      console.log(`  Backend:   \x1b[36m${beUrl}\x1b[0m`);
    }
    if (runningTarget) {
      console.log(`  Directory: \x1b[2m${runningTarget}\x1b[0m`);
    }
    console.log(`\n\x1b[2mType 'stop' (or 'kill') to stop all servers, or 'stop <port>' to stop a specific port.\x1b[0m\n`);

    const res = {
      success: true,
      alreadyRunning: true,
      frontendUrl: feUrl,
      backendUrl: beUrl,
      primaryUrl: currentRunningApp ? currentRunningApp.primaryUrl : feUrl
    };
    const p = Promise.resolve(res);
    Object.assign(p, res);
    return p;
  }

  if (!fs.existsSync(target)) {
    console.error(`\x1b[31m[rapidfire] Error: Directory '${args[0]}' not found.\x1b[0m`);
    const res = { success: false, error: 'Directory not found' };
    const p = Promise.resolve(res);
    Object.assign(p, res);
    return p;
  }

  const manifest = readManifest(target);
  const hasFrontend = fs.existsSync(path.join(target, 'frontend'));
  const hasBackend = fs.existsSync(path.join(target, 'backend'));
  const hasRootPkg = fs.existsSync(path.join(target, 'package.json'));
  const hasCargo = fs.existsSync(path.join(target, 'Cargo.toml'));
  const hasHtml = fs.existsSync(path.join(target, 'index.html')) || fs.existsSync(path.join(target, 'public', 'index.html'));
  const hasMainPy = fs.existsSync(path.join(target, 'main.py'));
  const hasManagePy = fs.existsSync(path.join(target, 'manage.py'));
  const hasAppPy = fs.existsSync(path.join(target, 'app.py'));
  const hasGo = fs.existsSync(path.join(target, 'main.go')) || fs.existsSync(path.join(target, 'go.mod'));
  const hasRuby = fs.existsSync(path.join(target, 'app.rb')) || fs.existsSync(path.join(target, 'Gemfile'));
  const hasPhp = fs.existsSync(path.join(target, 'router.php')) || fs.existsSync(path.join(target, 'index.php'));
  const hasDotnet = fs.existsSync(path.join(target, 'Backend.csproj')) || fs.existsSync(path.join(target, 'Program.cs'));

  if (!hasFrontend && !hasBackend && !hasRootPkg && !hasCargo && !hasHtml && !hasMainPy && !hasManagePy && !hasAppPy && !hasGo && !hasRuby && !hasPhp && !hasDotnet) {
    console.log('\n\x1b[33m[rapidfire] No runnable frontend, backend, or index.html detected in directory.\x1b[0m');
    console.log('Run setup to scaffold an application first: \x1b[36msetup react <folder>\x1b[0m\n');
    const res = { success: false, error: 'No runnable application found' };
    const p = Promise.resolve(res);
    Object.assign(p, res);
    return p;
  }

  console.log('\n\x1b[36m╔══════════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[36m║               RAPIDFIRE APPLICATION RUNNER               ║\x1b[0m');
  console.log('\x1b[36m║         Dual-Tier Microservice Process Launcher          ║\x1b[0m');
  console.log('\x1b[36m╚══════════════════════════════════════════════════════════╝\x1b[0m\n');
  console.log(`\x1b[2mTarget Directory:\x1b[0m ${target}\n`);

  ensureUserBinPaths();
  freeKnownPorts([3000, 5000, 8000]);
  ensureDependencies(target, hasFrontend, hasRootPkg);

  let backendUrl = null;
  let backendType = null;
  let frontendUrl = null;
  let detectedFrontendUrl = null;
  let backendProc = null;
  let frontendProc = null;

  if (hasBackend) {
    const backendDir = path.join(target, 'backend');
    if (fs.existsSync(path.join(backendDir, 'main.py'))) {
      console.log('\x1b[32m[*] Launching Python FastAPI backend (Uvicorn on port 8000)...\x1b[0m');
      const pyCmd = resolvePythonCmd(backendDir);
      backendProc = safeSpawn(pyCmd, ['-m', 'uvicorn', 'main:app', '--reload', '--port', '8000'], {
        cwd: backendDir,
        stdio: ['ignore', 'inherit', 'inherit'],
        detached: process.platform !== 'win32'
      }, 'Python (FastAPI)', 8000);
      backendUrl = 'http://localhost:8000';
      backendType = 'fastapi';
    } else if (fs.existsSync(path.join(backendDir, 'app.py'))) {
      console.log('\x1b[32m[*] Launching Python Flask backend (Port 5000)...\x1b[0m');
      const pyCmd = resolvePythonCmd(backendDir);
      backendProc = safeSpawn(pyCmd, ['app.py'], {
        cwd: backendDir,
        stdio: ['ignore', 'inherit', 'inherit'],
        detached: process.platform !== 'win32'
      }, 'Python (Flask)', 5000);
      backendUrl = 'http://localhost:5000';
      backendType = 'flask';
    } else if (fs.existsSync(path.join(backendDir, 'server.js'))) {
      console.log('\x1b[32m[*] Launching Node.js backend (Port 5000)...\x1b[0m');
      backendProc = safeSpawn('node', ['server.js'], {
        cwd: backendDir,
        stdio: ['ignore', 'inherit', 'inherit'],
        detached: process.platform !== 'win32'
      }, 'Node.js', 5000);
      backendUrl = 'http://localhost:5000';
      backendType = 'node';
    } else if (fs.existsSync(path.join(backendDir, 'index.js'))) {
      console.log('\x1b[32m[*] Launching Node.js backend (Port 5000)...\x1b[0m');
      backendProc = safeSpawn('node', ['index.js'], {
        cwd: backendDir,
        stdio: ['ignore', 'inherit', 'inherit'],
        detached: process.platform !== 'win32'
      }, 'Node.js', 5000);
      backendUrl = 'http://localhost:5000';
      backendType = 'node';
    } else if (fs.existsSync(path.join(backendDir, 'manage.py'))) {
      const pyCmd = resolvePythonCmd(backendDir);
      if (!fs.existsSync(path.join(backendDir, 'db.sqlite3')) || fs.statSync(path.join(backendDir, 'db.sqlite3')).size === 0) {
        try {
          execSync(`"${pyCmd}" manage.py migrate`, { cwd: backendDir, stdio: 'pipe' });
        } catch {}
      }
      console.log('\x1b[32m[*] Launching Django backend (Port 8000)...\x1b[0m');
      backendProc = safeSpawn(pyCmd, ['manage.py', 'runserver', '8000'], {
        cwd: backendDir,
        stdio: ['ignore', 'inherit', 'inherit'],
        detached: process.platform !== 'win32'
      }, 'Django', 8000);
      backendUrl = 'http://localhost:8000';
      backendType = 'django';
    } else if (fs.existsSync(path.join(backendDir, 'Cargo.toml'))) {
      if (!isBinaryInPath('cargo')) {
        console.error('\x1b[31m[rapidfire] Error: No Rust (cargo) found in your system PATH.\x1b[0m');
        console.log(`\x1b[33m[rapidfire] Hint: Installation instructions for your system:\x1b[0m\n${getRustInstallInstructions()}`);
        backendProc = { cmd: 'cargo', failed: true };
      } else {
        console.log('\x1b[32m[*] Launching Rust backend (Port 5000)...\x1b[0m');
        backendProc = safeSpawn('cargo', ['run'], {
          cwd: backendDir,
          stdio: ['ignore', 'inherit', 'inherit'],
          detached: process.platform !== 'win32'
        }, 'Rust (Cargo)', 5000);
        backendUrl = 'http://localhost:5000';
        backendType = 'rust';
      }
    } else if (fs.existsSync(path.join(backendDir, 'main.go'))) {
      if (!isBinaryInPath('go')) {
        console.error('\x1b[31m[rapidfire] Error: No Go runtime found in your system PATH.\x1b[0m');
        console.log(`\x1b[33m[rapidfire] Hint: Installation instructions for your system:\x1b[0m\n${getGoInstallInstructions()}`);
        backendProc = { cmd: 'go', failed: true };
      } else {
        console.log('\x1b[32m[*] Launching Go backend (Port 5000)...\x1b[0m');
        backendProc = safeSpawn('go', ['run', '.'], {
          cwd: backendDir,
          stdio: ['ignore', 'inherit', 'inherit'],
          detached: process.platform !== 'win32'
        }, 'Go', 5000);
        backendUrl = 'http://localhost:5000';
        backendType = 'go';
      }
    } else if (fs.existsSync(path.join(backendDir, 'app.rb'))) {
      if (!isBinaryInPath('ruby')) {
        console.error('\x1b[31m[rapidfire] Error: No Ruby runtime found in your system PATH.\x1b[0m');
        console.log(`\x1b[33m[rapidfire] Hint: Installation instructions for your system:\x1b[0m\n${getRubyInstallInstructions()}`);
        backendProc = { cmd: 'ruby', failed: true };
      } else {
        console.log('\x1b[32m[*] Launching Ruby (Sinatra) backend (Port 5000)...\x1b[0m');
        backendProc = safeSpawn('ruby', ['app.rb'], {
          cwd: backendDir,
          stdio: ['ignore', 'inherit', 'inherit'],
          detached: process.platform !== 'win32'
        }, 'Ruby', 5000);
        backendUrl = 'http://localhost:5000';
        backendType = 'ruby';
      }
    } else if (fs.existsSync(path.join(backendDir, 'router.php')) || fs.existsSync(path.join(backendDir, 'index.php'))) {
      if (!isBinaryInPath('php')) {
        console.error('\x1b[31m[rapidfire] Error: No PHP runtime found in your system PATH.\x1b[0m');
        console.log(`\x1b[33m[rapidfire] Hint: Installation instructions for your system:\x1b[0m\n${getPhpInstallInstructions()}`);
        backendProc = { cmd: 'php', failed: true };
      } else {
        console.log('\x1b[32m[*] Launching PHP backend (Port 5000)...\x1b[0m');
        backendProc = safeSpawn('php', ['-S', '0.0.0.0:5000', 'router.php'], {
          cwd: backendDir,
          stdio: ['ignore', 'inherit', 'inherit'],
          detached: process.platform !== 'win32'
        }, 'PHP', 5000);
        backendUrl = 'http://localhost:5000';
        backendType = 'php';
      }
    } else if (fs.existsSync(path.join(backendDir, 'Backend.csproj')) || fs.existsSync(path.join(backendDir, 'Program.cs'))) {
      if (!isBinaryInPath('dotnet')) {
        console.error('\x1b[31m[rapidfire] Error: No .NET SDK found in your system PATH.\x1b[0m');
        console.log(`\x1b[33m[rapidfire] Hint: Installation instructions for your system:\x1b[0m\n${getDotnetInstallInstructions()}`);
        backendProc = { cmd: 'dotnet', failed: true };
      } else {
        console.log('\x1b[32m[*] Launching .NET backend (Port 5000)...\x1b[0m');
        backendProc = safeSpawn('dotnet', ['run'], {
          cwd: backendDir,
          stdio: ['ignore', 'inherit', 'inherit'],
          detached: process.platform !== 'win32'
        }, '.NET', 5000);
        backendUrl = 'http://localhost:5000';
        backendType = 'dotnet';
      }
    } else if (fs.existsSync(path.join(backendDir, 'package.json'))) {
      console.log('\x1b[32m[*] Launching Node.js backend (Port 5000)...\x1b[0m');
      const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      backendProc = safeSpawn(npmCmd, ['start'], {
        cwd: backendDir,
        stdio: ['ignore', 'inherit', 'inherit'],
        detached: process.platform !== 'win32'
      }, 'Node.js', 5000);
      backendUrl = 'http://localhost:5000';
    }
  }

  let resolvePromise;
  let finished = false;
  let quickTimer = null;

  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });
  pendingResolve = resolvePromise;

  const finish = () => {
    if (finished) return;
    finished = true;
    if (pendingStartupTimer) {
      clearTimeout(pendingStartupTimer);
      pendingStartupTimer = null;
    }
    if (quickTimer) {
      clearTimeout(quickTimer);
      quickTimer = null;
    }
    pendingResolve = null;

    const backendFailed = Boolean(backendProc && backendProc.failed);
    const frontendFailed = Boolean(frontendProc && frontendProc.failed);

    const activeFrontendUrl = frontendFailed ? null : (detectedFrontendUrl || frontendUrl);
    const activeBackendUrl = backendFailed ? null : backendUrl;
    const finalPrimaryUrl = activeFrontendUrl || activeBackendUrl || 'http://localhost:3000';

    if (activeFrontendUrl && activeBackendUrl) {
      console.log(`\n\x1b[32m[OK] Application is live!\x1b[0m`);
      console.log(`  Frontend: \x1b[36m${activeFrontendUrl}\x1b[0m`);
      const docsHint = backendType === 'fastapi' ? ` (Docs: \x1b[33m${activeBackendUrl}/docs\x1b[0m)` : '';
      console.log(`  Backend:  \x1b[36m${activeBackendUrl}\x1b[0m${docsHint}`);
    } else if (activeFrontendUrl && !activeBackendUrl) {
      console.log(`\n\x1b[32m[OK] Application frontend is live!\x1b[0m`);
      console.log(`  Frontend: \x1b[36m${activeFrontendUrl}\x1b[0m`);
      if (backendProc && backendProc.failed) {
        console.log(`  Backend:  \x1b[31mOffline\x1b[0m \x1b[33m(${backendProc.cmd || 'backend runtime'} not found or failed to start)\x1b[0m`);
      }
    } else if (!activeFrontendUrl && activeBackendUrl) {
      console.log(`\n\x1b[32m[OK] Application backend is live!\x1b[0m`);
      const docsHint = backendType === 'fastapi' ? ` (Docs: \x1b[33m${activeBackendUrl}/docs\x1b[0m)` : '';
      console.log(`  Backend:  \x1b[36m${activeBackendUrl}\x1b[0m${docsHint}`);
      if (frontendProc && frontendProc.failed) {
        console.log(`  Frontend: \x1b[31mOffline\x1b[0m`);
      }
    } else {
      console.log(`\n\x1b[31m[rapidfire] Application services failed to start.\x1b[0m`);
    }

    if (activeFrontendUrl || activeBackendUrl) {
      console.log(`\nOpening in browser: \x1b[1m\x1b[36m${finalPrimaryUrl}\x1b[0m`);
      console.log(`\x1b[2mType 'stop' or press Ctrl+C to stop all servers.\x1b[0m\n`);
      openBrowser(finalPrimaryUrl);
    }

    currentRunningApp = {
      target,
      frontendUrl: activeFrontendUrl,
      backendUrl: activeBackendUrl,
      primaryUrl: finalPrimaryUrl
    };

    const result = {
      success: Boolean(activeFrontendUrl || activeBackendUrl),
      frontendUrl: activeFrontendUrl,
      backendUrl: activeBackendUrl,
      primaryUrl: finalPrimaryUrl
    };
    Object.assign(promise, result);
    resolvePromise(result);
  };

  pendingStartupTimer = setTimeout(finish, 1200);

  const initialProps = {
    success: true,
    frontendUrl: 'http://localhost:3000',
    backendUrl,
    primaryUrl: 'http://localhost:3000'
  };
  Object.assign(promise, initialProps);

  const urlPattern = /(https?:\/\/(?:localhost|127\.0\.0\.1):\d+)/i;

  const handleStreamData = (d) => {
    const str = d.toString();
    if (str.includes('DeprecationWarning') || str.includes('--trace-deprecation')) {
      return;
    }
    process.stdout.write(str);
    const match = str.match(urlPattern);
    if (match && !detectedFrontendUrl) {
      detectedFrontendUrl = match[1];
      const portMatch = detectedFrontendUrl.match(/:(\d+)/);
      if (portMatch) {
        const p = parseInt(portMatch[1], 10);
        for (const proc of activeProcesses) {
          if (proc.port === 3000 || !proc.port) {
            proc.port = p;
            break;
          }
        }
      }
      if (!quickTimer && !finished) {
        quickTimer = setTimeout(finish, 350);
      }
    }
  };

  if (hasFrontend) {
    const frontendDir = path.join(target, 'frontend');
    if (fs.existsSync(path.join(frontendDir, 'package.json'))) {
      console.log('\x1b[32m[*] Launching Vite Frontend dev server...\x1b[0m');
      const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      frontendProc = safeSpawn(npmCmd, ['run', 'dev'], {
        cwd: frontendDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32'
      }, 'Vite Frontend Dev Server', 3000);
      frontendUrl = 'http://localhost:3000';

      if (frontendProc && frontendProc.stdout) frontendProc.stdout.on('data', handleStreamData);
      if (frontendProc && frontendProc.stderr) frontendProc.stderr.on('data', handleStreamData);
    }
  } else if (hasRootPkg) {
    console.log('\x1b[32m[*] Launching standalone project dev server...\x1b[0m');
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    frontendProc = safeSpawn(npmCmd, ['run', 'dev'], {
      cwd: target,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32'
    }, 'Standalone Project Dev Server', 3000);
    frontendUrl = 'http://localhost:3000';

    if (frontendProc && frontendProc.stdout) frontendProc.stdout.on('data', handleStreamData);
    if (frontendProc && frontendProc.stderr) frontendProc.stderr.on('data', handleStreamData);
  } else if (hasMainPy) {
    console.log('\x1b[32m[*] Launching standalone Python FastAPI backend (Uvicorn on port 8000)...\x1b[0m');
    const pyCmd = resolvePythonCmd(target);
    backendProc = safeSpawn(pyCmd, ['-m', 'uvicorn', 'main:app', '--reload', '--port', '8000'], {
      cwd: target,
      stdio: ['ignore', 'inherit', 'inherit'],
      detached: process.platform !== 'win32'
    }, 'Python (FastAPI)', 8000);
    backendUrl = 'http://localhost:8000';
    backendType = 'fastapi';
  } else if (hasManagePy) {
    const pyCmd = resolvePythonCmd(target);
    if (!fs.existsSync(path.join(target, 'db.sqlite3')) || fs.statSync(path.join(target, 'db.sqlite3')).size === 0) {
      try {
        execSync(`"${pyCmd}" manage.py migrate`, { cwd: target, stdio: 'pipe' });
      } catch {}
    }
    console.log('\x1b[32m[*] Launching standalone Django backend (Port 8000)...\x1b[0m');
    backendProc = safeSpawn(pyCmd, ['manage.py', 'runserver', '8000'], {
      cwd: target,
      stdio: ['ignore', 'inherit', 'inherit'],
      detached: process.platform !== 'win32'
    }, 'Django', 8000);
    backendUrl = 'http://localhost:8000';
    backendType = 'django';
  } else if (hasAppPy) {
    console.log('\x1b[32m[*] Launching standalone Python Flask backend (Port 5000)...\x1b[0m');
    const pyCmd = resolvePythonCmd(target);
    backendProc = safeSpawn(pyCmd, ['app.py'], {
      cwd: target,
      stdio: ['ignore', 'inherit', 'inherit'],
      detached: process.platform !== 'win32'
    }, 'Python (Flask)', 5000);
    backendUrl = 'http://localhost:5000';
    backendType = 'flask';
  } else if (hasCargo) {
    if (!isBinaryInPath('cargo')) {
      console.error('\x1b[31m[rapidfire] Error: No Rust (cargo) found in your system PATH.\x1b[0m');
      console.log(`\x1b[33m[rapidfire] Hint: Installation instructions for your system:\x1b[0m\n${getRustInstallInstructions()}`);
      backendProc = { cmd: 'cargo', failed: true };
    } else {
      console.log('\x1b[32m[*] Launching Rust application server (Port 5000)...\x1b[0m');
      backendProc = safeSpawn('cargo', ['run'], {
        cwd: target,
        stdio: ['ignore', 'inherit', 'inherit'],
        detached: process.platform !== 'win32'
      }, 'Rust (Cargo)', 5000);
      backendUrl = 'http://localhost:5000';
      backendType = 'rust';
    }
  } else if (hasGo) {
    if (!isBinaryInPath('go')) {
      console.error('\x1b[31m[rapidfire] Error: No Go runtime found in your system PATH.\x1b[0m');
      console.log(`\x1b[33m[rapidfire] Hint: Installation instructions for your system:\x1b[0m\n${getGoInstallInstructions()}`);
      backendProc = { cmd: 'go', failed: true };
    } else {
      console.log('\x1b[32m[*] Launching Go application server (Port 5000)...\x1b[0m');
      backendProc = safeSpawn('go', ['run', '.'], {
        cwd: target,
        stdio: ['ignore', 'inherit', 'inherit'],
        detached: process.platform !== 'win32'
      }, 'Go', 5000);
      backendUrl = 'http://localhost:5000';
      backendType = 'go';
    }
  } else if (hasRuby) {
    if (!isBinaryInPath('ruby')) {
      console.error('\x1b[31m[rapidfire] Error: No Ruby runtime found in your system PATH.\x1b[0m');
      console.log(`\x1b[33m[rapidfire] Hint: Installation instructions for your system:\x1b[0m\n${getRubyInstallInstructions()}`);
      backendProc = { cmd: 'ruby', failed: true };
    } else {
      console.log('\x1b[32m[*] Launching Ruby application server (Port 5000)...\x1b[0m');
      backendProc = safeSpawn('ruby', ['app.rb'], {
        cwd: target,
        stdio: ['ignore', 'inherit', 'inherit'],
        detached: process.platform !== 'win32'
      }, 'Ruby', 5000);
      backendUrl = 'http://localhost:5000';
      backendType = 'ruby';
    }
  } else if (hasPhp) {
    if (!isBinaryInPath('php')) {
      console.error('\x1b[31m[rapidfire] Error: No PHP runtime found in your system PATH.\x1b[0m');
      console.log(`\x1b[33m[rapidfire] Hint: Installation instructions for your system:\x1b[0m\n${getPhpInstallInstructions()}`);
      backendProc = { cmd: 'php', failed: true };
    } else {
      console.log('\x1b[32m[*] Launching PHP application server (Port 5000)...\x1b[0m');
      backendProc = safeSpawn('php', ['-S', '0.0.0.0:5000', 'router.php'], {
        cwd: target,
        stdio: ['ignore', 'inherit', 'inherit'],
        detached: process.platform !== 'win32'
      }, 'PHP', 5000);
      backendUrl = 'http://localhost:5000';
      backendType = 'php';
    }
  } else if (hasDotnet) {
    if (!isBinaryInPath('dotnet')) {
      console.error('\x1b[31m[rapidfire] Error: No .NET SDK found in your system PATH.\x1b[0m');
      console.log(`\x1b[33m[rapidfire] Hint: Installation instructions for your system:\x1b[0m\n${getDotnetInstallInstructions()}`);
      backendProc = { cmd: 'dotnet', failed: true };
    } else {
      console.log('\x1b[32m[*] Launching .NET application server (Port 5000)...\x1b[0m');
      backendProc = safeSpawn('dotnet', ['run'], {
        cwd: target,
        stdio: ['ignore', 'inherit', 'inherit'],
        detached: process.platform !== 'win32'
      }, '.NET', 5000);
      backendUrl = 'http://localhost:5000';
      backendType = 'dotnet';
    }
  } else if (hasHtml) {
    console.log('\x1b[32m[*] Launching frameworkless static web server...\x1b[0m');
    const serverScript = path.join(__dirname, '../utils/staticServer.js');
    frontendProc = safeSpawn('node', ['--no-deprecation', serverScript, target, '3000'], {
      cwd: target,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32'
    }, 'Static Web Server', 3000);
    frontendUrl = 'http://localhost:3000';

    if (frontendProc && frontendProc.stdout) frontendProc.stdout.on('data', handleStreamData);
    if (frontendProc && frontendProc.stderr) frontendProc.stderr.on('data', handleStreamData);
  }

  return promise;
}

module.exports = {
  handleRun,
  stopProcesses,
  freeKnownPorts,
  activeProcesses,
  safeSpawn
};
