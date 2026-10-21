const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
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

  let backendUrl = null;
  let frontendUrl = null;

  // 1. Launch Backend if present
  if (hasBackend) {
    const backendDir = path.join(target, 'backend');
    if (fs.existsSync(path.join(backendDir, 'main.py'))) {
      console.log('\x1b[32m[*] Launching Python FastAPI backend (Uvicorn on port 8000)...\x1b[0m');
      const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
      const beProc = spawn(pyCmd, ['-m', 'uvicorn', 'main:app', '--reload', '--port', '8000'], {
        cwd: backendDir,
        stdio: 'inherit'
      });
      activeProcesses.push(beProc);
      backendUrl = 'http://localhost:8000';
    } else if (fs.existsSync(path.join(backendDir, 'app.py'))) {
      console.log('\x1b[32m[*] Launching Python Flask backend (Port 5000)...\x1b[0m');
      const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
      const beProc = spawn(pyCmd, ['app.py'], {
        cwd: backendDir,
        stdio: 'inherit'
      });
      activeProcesses.push(beProc);
      backendUrl = 'http://localhost:5000';
    } else if (fs.existsSync(path.join(backendDir, 'server.js'))) {
      console.log('\x1b[32m[*] Launching Node.js backend (Port 5000)...\x1b[0m');
      const beProc = spawn('node', ['server.js'], {
        cwd: backendDir,
        stdio: 'inherit'
      });
      activeProcesses.push(beProc);
      backendUrl = 'http://localhost:5000';
    } else if (fs.existsSync(path.join(backendDir, 'index.js'))) {
      console.log('\x1b[32m[*] Launching Node.js backend (Port 5000)...\x1b[0m');
      const beProc = spawn('node', ['index.js'], {
        cwd: backendDir,
        stdio: 'inherit'
      });
      activeProcesses.push(beProc);
      backendUrl = 'http://localhost:5000';
    } else if (fs.existsSync(path.join(backendDir, 'manage.py'))) {
      console.log('\x1b[32m[*] Launching Django backend (Port 8000)...\x1b[0m');
      const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
      const beProc = spawn(pyCmd, ['manage.py', 'runserver', '8000'], {
        cwd: backendDir,
        stdio: 'inherit'
      });
      activeProcesses.push(beProc);
      backendUrl = 'http://localhost:8000';
    } else if (fs.existsSync(path.join(backendDir, 'main.go'))) {
      console.log('\x1b[32m[*] Launching Go backend (Port 5000)...\x1b[0m');
      const beProc = spawn('go', ['run', '.'], {
        cwd: backendDir,
        stdio: 'inherit'
      });
      activeProcesses.push(beProc);
      backendUrl = 'http://localhost:5000';
    } else if (fs.existsSync(path.join(backendDir, 'package.json'))) {
      console.log('\x1b[32m[*] Launching Node.js backend (Port 5000)...\x1b[0m');
      const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      const beProc = spawn(npmCmd, ['start'], {
        cwd: backendDir,
        stdio: 'inherit'
      });
      activeProcesses.push(beProc);
      backendUrl = 'http://localhost:5000';
    }
  }

  // 2. Launch Frontend if present
  if (hasFrontend) {
    const frontendDir = path.join(target, 'frontend');
    if (fs.existsSync(path.join(frontendDir, 'package.json'))) {
      console.log('\x1b[32m[*] Launching Vite Frontend dev server (Port 3000)...\x1b[0m');
      const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      const feProc = spawn(npmCmd, ['run', 'dev'], {
        cwd: frontendDir,
        stdio: 'inherit'
      });
      activeProcesses.push(feProc);
      frontendUrl = 'http://localhost:3000';
    }
  } else if (hasRootPkg) {
    // Standalone frontend at root
    console.log('\x1b[32m[*] Launching standalone project dev server...\x1b[0m');
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const feProc = spawn(npmCmd, ['run', 'dev'], {
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
    if (backendUrl) console.log(`  Backend:  \x1b[36${backendUrl}\x1b[0m (Docs: \x1b[33m${backendUrl}/docs\x1b[0m)`);
    console.log(`\nOpening in browser: \x1b[1m\x1b[36m${primaryUrl}\x1b[0m`);
    console.log(`\x1b[2mPress Ctrl+C to stop all servers.\x1b[0m\n`);
    openBrowser(primaryUrl);
  }, 1200);

  return {
    success: true,
    frontendUrl,
    backendUrl,
    primaryUrl
  };
}

module.exports = {
  handleRun,
  activeProcesses
};
