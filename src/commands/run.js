const path = require('path');
const fs = require('fs');
const { spawn, exec, execSync } = require('child_process');
const { readManifest } = require('../utils/manifest');

const activeProcesses = [];

function openBrowser(url) {
  const startCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${startCmd} ${url}`, () => {});
}

function handleRun(args = []) {
  const target = args[0] ? path.resolve(process.cwd(), args[0]) : process.cwd();

  if (!fs.existsSync(target)) {
    console.error(`\x1b[31m[rapidfire] Error: Directory '${args[0]}' not found.\x1b[0m`);
    return { success: false, error: 'Directory not found' };
  }

  const manifest = readManifest(target);
  const hasFrontend = fs.existsSync(path.join(target, 'frontend'));
  const hasBackend = fs.existsSync(path.join(target, 'backend'));
  const hasRootPkg = fs.existsSync(path.join(target, 'package.json'));

  console.log('\n\x1b[36m╔══════════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[36m║               RAPIDFIRE APPLICATION RUNNER               ║\x1b[0m');
  console.log('\x1b[36m║         Dual-Tier Microservice Process Launcher          ║\x1b[0m');
  console.log('\x1b[36m╚══════════════════════════════════════════════════════════╝\x1b[0m\n');
  console.log(`\x1b[2mTarget Directory:\x1b[0m ${target}\n`);

  let isFastApi = false;
  let backendUrl = null;
  let frontendUrl = null;

  if (hasBackend) {
    const backendDir = path.join(target, 'backend');
    let backendPort = 5000;
    const backendEnv = path.join(backendDir, '.env');
    if (fs.existsSync(backendEnv)) {
      try {
        const envContent = fs.readFileSync(backendEnv, 'utf8');
        const match = envContent.match(/^PORT\s*=\s*(\d+)/m);
        if (match) backendPort = parseInt(match[1], 10);
      } catch {}
    }

    if (fs.existsSync(path.join(backendDir, 'package.json')) && !fs.existsSync(path.join(backendDir, 'node_modules'))) {
      console.log('\x1b[33m[*] Installing missing backend dependencies (npm install)...\x1b[0m');
      try {
        const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        execSync(`${npmCmd} install`, { cwd: backendDir, stdio: 'inherit' });
      } catch (err) {
        console.warn('\x1b[33m[WARN] Backend npm install failed:\x1b[0m', err.message);
      }
    }

    if (fs.existsSync(path.join(backendDir, 'main.py'))) {
      isFastApi = true;
      const port = backendPort !== 5000 ? backendPort : 8000;
      console.log(`\x1b[32m[*] Launching Python FastAPI backend (Uvicorn on port ${port})...\x1b[0m`);
      const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
      const beProc = spawn(pyCmd, ['-m', 'uvicorn', 'main:app', '--reload', '--port', String(port)], {
        cwd: backendDir,
        stdio: 'inherit'
      });
      activeProcesses.push(beProc);
      backendUrl = `http://localhost:${port}`;
    } else if (fs.existsSync(path.join(backendDir, 'server.js'))) {
      console.log(`\x1b[32m[*] Launching Express Node.js backend (Port ${backendPort})...\x1b[0m`);
      const beProc = spawn('node', ['server.js'], {
        cwd: backendDir,
        stdio: 'inherit'
      });
      activeProcesses.push(beProc);
      backendUrl = `http://localhost:${backendPort}`;
    } else if (fs.existsSync(path.join(backendDir, 'manage.py'))) {
      const port = backendPort !== 5000 ? backendPort : 8000;
      console.log(`\x1b[32m[*] Launching Django backend (Port ${port})...\x1b[0m`);
      const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
      const beProc = spawn(pyCmd, ['manage.py', 'runserver', String(port)], {
        cwd: backendDir,
        stdio: 'inherit'
      });
      activeProcesses.push(beProc);
      backendUrl = `http://localhost:${port}`;
    } else if (fs.existsSync(path.join(backendDir, 'app.py'))) {
      console.log(`\x1b[32m[*] Launching Python backend (Port ${backendPort})...\x1b[0m`);
      const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
      const beProc = spawn(pyCmd, ['app.py'], {
        cwd: backendDir,
        stdio: 'inherit'
      });
      activeProcesses.push(beProc);
      backendUrl = `http://localhost:${backendPort}`;
    } else if (fs.existsSync(path.join(backendDir, 'index.js')) || fs.existsSync(path.join(backendDir, 'app.js'))) {
      const entry = fs.existsSync(path.join(backendDir, 'index.js')) ? 'index.js' : 'app.js';
      console.log(`\x1b[32m[*] Launching Node.js backend (${entry} on Port ${backendPort})...\x1b[0m`);
      const beProc = spawn('node', [entry], {
        cwd: backendDir,
        stdio: 'inherit'
      });
      activeProcesses.push(beProc);
      backendUrl = `http://localhost:${backendPort}`;
    } else if (fs.existsSync(path.join(backendDir, 'main.go'))) {
      console.log('\x1b[32m[*] Launching Go backend (Port 8080)...\x1b[0m');
      const beProc = spawn('go', ['run', 'main.go'], {
        cwd: backendDir,
        stdio: 'inherit'
      });
      activeProcesses.push(beProc);
      backendUrl = 'http://localhost:8080';
    } else if (fs.existsSync(path.join(backendDir, 'Cargo.toml'))) {
      console.log('\x1b[32m[*] Launching Rust backend (Port 8080)...\x1b[0m');
      const beProc = spawn('cargo', ['run'], {
        cwd: backendDir,
        stdio: 'inherit'
      });
      activeProcesses.push(beProc);
      backendUrl = 'http://localhost:8080';
    } else if (fs.existsSync(path.join(backendDir, 'package.json'))) {
      console.log('\x1b[32m[*] Launching Backend via npm script (Port 5000)...\x1b[0m');
      const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      const beProc = spawn(npmCmd, ['start'], {
        cwd: backendDir,
        stdio: 'inherit'
      });
      activeProcesses.push(beProc);
      backendUrl = 'http://localhost:5000';
    }
  }

  if (hasFrontend) {
    const frontendDir = path.join(target, 'frontend');
    if (fs.existsSync(path.join(frontendDir, 'package.json'))) {
      if (!fs.existsSync(path.join(frontendDir, 'node_modules'))) {
        console.log('\x1b[33m[*] Installing missing frontend dependencies (npm install)...\x1b[0m');
        try {
          const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
          execSync(`${npmCmd} install`, { cwd: frontendDir, stdio: 'inherit' });
        } catch (err) {
          console.warn('\x1b[33m[WARN] Frontend npm install failed:\x1b[0m', err.message);
        }
      }

      let feScript = 'dev';
      try {
        const fePkg = JSON.parse(fs.readFileSync(path.join(frontendDir, 'package.json'), 'utf8'));
        if (fePkg.scripts) {
          if (fePkg.scripts.dev) feScript = 'dev';
          else if (fePkg.scripts.start) feScript = 'start';
        }
      } catch {}

      console.log(`\x1b[32m[*] Launching Frontend dev server (${feScript} on Port 3000)...\x1b[0m`);
      const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      const feArgs = feScript === 'start' ? ['start'] : ['run', feScript];
      const feProc = spawn(npmCmd, feArgs, {
        cwd: frontendDir,
        stdio: 'inherit'
      });
      activeProcesses.push(feProc);
      frontendUrl = 'http://localhost:3000';
    }
  } else if (hasRootPkg) {
    if (!fs.existsSync(path.join(target, 'node_modules'))) {
      console.log('\x1b[33m[*] Installing missing dependencies (npm install)...\x1b[0m');
      try {
        const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        execSync(`${npmCmd} install`, { cwd: target, stdio: 'inherit' });
      } catch (err) {
        console.warn('\x1b[33m[WARN] Root npm install failed:\x1b[0m', err.message);
      }
    }

    let rootScript = 'dev';
    try {
      const rootPkg = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'));
      if (rootPkg.scripts) {
        if (rootPkg.scripts.dev) rootScript = 'dev';
        else if (rootPkg.scripts.start) rootScript = 'start';
      }
    } catch {}

    console.log(`\x1b[32m[*] Launching standalone project dev server (${rootScript})...\x1b[0m`);
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const rootArgs = rootScript === 'start' ? ['start'] : ['run', rootScript];
    const feProc = spawn(npmCmd, rootArgs, {
      cwd: target,
      stdio: 'inherit'
    });
    activeProcesses.push(feProc);
    frontendUrl = 'http://localhost:3000';
  }

  const primaryUrl = frontendUrl || backendUrl || 'http://localhost:3000';

  setTimeout(() => {
    console.log(`\n\x1b[32m[OK] Application is live!\x1b[0m`);
    if (frontendUrl) console.log(`  Frontend: \x1b[36m${frontendUrl}\x1b[0m`);
    if (backendUrl) {
      const docsMsg = isFastApi ? ` (Docs: \x1b[33m${backendUrl}/docs\x1b[0m)` : '';
      console.log(`  Backend:  \x1b[36m${backendUrl}\x1b[0m${docsMsg}`);
    }
    console.log(`\nOpening in browser: \x1b[1m\x1b[36m${primaryUrl}\x1b[0m`);
    console.log(`\x1b[2mPress Ctrl+C or type 'stop' to stop all servers.\x1b[0m\n`);
    openBrowser(primaryUrl);
  }, 1200);

  return {
    success: true,
    frontendUrl,
    backendUrl,
    primaryUrl
  };
}

function stopActiveProcesses() {
  while (activeProcesses.length > 0) {
    const proc = activeProcesses.pop();
    if (proc && proc.pid) {
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: 'ignore' });
        } else {
          try {
            execSync(`pkill -P ${proc.pid}`, { stdio: 'ignore' });
          } catch {}
          proc.kill('SIGTERM');
        }
      } catch {
        try {
          proc.kill('SIGTERM');
        } catch {}
      }
    }
  }
}

process.on('SIGINT', () => {
  stopActiveProcesses();
});

process.on('SIGTERM', () => {
  stopActiveProcesses();
});

process.on('exit', () => {
  stopActiveProcesses();
});

module.exports = {
  handleRun,
  stopActiveProcesses,
  activeProcesses
};
