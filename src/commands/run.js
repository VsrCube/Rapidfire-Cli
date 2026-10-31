const path = require('path');
const fs = require('fs');
const { detectProject } = require('../runner/detector');
const { auditPreflight, formatPreflightErrorCard, resolvePythonCmd } = require('../runner/preflight');
const {
  activeProcesses,
  safeSpawn,
  freeKnownPorts,
  killProcessTree,
  stopProcesses
} = require('../runner/processManager');
const {
  openBrowser,
  createStreamHandler,
  renderBanner
} = require('../runner/multiplexer');

let currentRunningApp = null;
let pendingStartupTimer = null;
let pendingResolve = null;

function ensureUserBinPaths() {
  const home = process.env.HOME || process.env.USERPROFILE || '';
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

  const projectPlan = detectProject(target);

  if (projectPlan.type === 'unstructured') {
    console.log('\n\x1b[33m[rapidfire] No runnable frontend, backend, or index.html detected in directory.\x1b[0m');
    console.log('Run setup to scaffold an application first: \x1b[36msetup react <folder>\x1b[0m\n');
    const res = { success: false, error: 'No runnable application found' };
    const p = Promise.resolve(res);
    Object.assign(p, res);
    return p;
  }

  const preflight = auditPreflight(projectPlan);
  if (!preflight.ok) {
    console.error(formatPreflightErrorCard(preflight.errors));
    const res = {
      success: false,
      error: 'MISSING_DEPENDENCIES',
      details: preflight.errors
    };
    const p = Promise.resolve(res);
    Object.assign(p, res);
    return p;
  }

  console.log('\n\x1b[36m╔══════════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[36m║               RAPIDFIRE APPLICATION RUNNER               ║\x1b[0m');
  console.log('\x1b[36m║         Autonomous Zero-Config Process Launcher          ║\x1b[0m');
  console.log('\x1b[36m╚══════════════════════════════════════════════════════════╝\x1b[0m\n');
  console.log(`\x1b[2mTarget Directory:\x1b[0m ${target}\n`);

  ensureUserBinPaths();
  freeKnownPorts([3000, 3001, 4200, 5000, 5173, 8000]);

  let frontendUrl = null;
  let backendUrl = null;
  let backendDocs = null;
  let frontendProc = null;
  let backendProc = null;
  let processStartupFailed = false;
  const onProcessExit = (code) => {
    if (code !== 0 && code !== null) {
      processStartupFailed = true;
    }
  };

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const serverScript = path.resolve(__dirname, '..', 'utils', 'staticServer.js');

  function spawnBackendService(svc) {
    const cwd = svc.dir;
    const port = svc.defaultPort || 5000;
    const beHandler = createStreamHandler(svc.tierName || 'backend', '\x1b[32m');

    if (svc.ecosystem === 'python') {
      const pyCmd = resolvePythonCmd(cwd);
      backendProc = safeSpawn(pyCmd, svc.runCommand, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32'
      }, `Python (${svc.flavor || 'API'})`, port);
      backendUrl = `http://localhost:${port}`;
      if (svc.flavor === 'fastapi') backendDocs = `${backendUrl}/docs`;
    } else if (svc.ecosystem === 'node') {
      if (svc.scriptName) {
        backendProc = safeSpawn(npmCmd, svc.commandArgs, {
          cwd,
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: process.platform !== 'win32'
        }, 'Node API', port);
      } else if (svc.entryFile) {
        backendProc = safeSpawn('node', [svc.entryFile], {
          cwd,
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: process.platform !== 'win32'
        }, 'Node API', port);
      }
      backendUrl = `http://localhost:${port}`;
    } else if (svc.ecosystem === 'rust') {
      backendProc = safeSpawn('cargo', svc.runCommand, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32'
      }, 'Rust (Cargo)', port);
      backendUrl = `http://localhost:${port}`;
    } else if (svc.ecosystem === 'go') {
      backendProc = safeSpawn('go', svc.runCommand, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32'
      }, 'Go', port);
      backendUrl = `http://localhost:${port}`;
    } else if (svc.ecosystem === 'ruby') {
      backendProc = safeSpawn('ruby', svc.runCommand, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32'
      }, 'Ruby', port);
      backendUrl = `http://localhost:${port}`;
    } else if (svc.ecosystem === 'php') {
      backendProc = safeSpawn('php', svc.runCommand, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32'
      }, 'PHP', port);
      backendUrl = `http://localhost:${port}`;
    } else if (svc.ecosystem === 'dotnet') {
      backendProc = safeSpawn('dotnet', svc.runCommand, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32'
      }, '.NET', port);
      backendUrl = `http://localhost:${port}`;
    }

    if (backendProc) {
      backendProc.on('exit', onProcessExit);
      if (backendProc.stdout) {
        backendProc.stdout.on('data', (d) => {
          const text = d.toString();
          const portMatch = text.match(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d+)/i);
          if (portMatch && portMatch[1]) {
            backendUrl = `http://localhost:${portMatch[1]}`;
          }
          beHandler(d);
        });
      }
      if (backendProc.stderr) {
        backendProc.stderr.on('data', (d) => {
          const text = d.toString();
          const portMatch = text.match(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d+)/i);
          if (portMatch && portMatch[1]) {
            backendUrl = `http://localhost:${portMatch[1]}`;
          }
          beHandler(d);
        });
      }
    }
  }

  function spawnFrontendService(svc) {
    const cwd = svc.dir;
    const port = svc.defaultPort || 3000;
    const feHandler = createStreamHandler(svc.tierName || 'frontend', '\x1b[36m');
    const activeApiUrl = backendUrl || 'http://localhost:5000';
    const feEnv = {
      ...process.env,
      VITE_API_URL: activeApiUrl,
      NEXT_PUBLIC_API_URL: activeApiUrl,
      PUBLIC_API_URL: activeApiUrl,
      REACT_APP_API_URL: activeApiUrl,
      API_URL: activeApiUrl
    };

    if (svc.ecosystem === 'node') {
      if (svc.scriptName) {
        frontendProc = safeSpawn(npmCmd, svc.commandArgs, {
          cwd,
          env: feEnv,
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: process.platform !== 'win32'
        }, 'Frontend Dev Server', port);
      } else if (svc.entryFile) {
        frontendProc = safeSpawn('node', [svc.entryFile], {
          cwd,
          env: feEnv,
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: process.platform !== 'win32'
        }, 'Frontend Web Server', port);
      }
      frontendUrl = `http://localhost:${port}`;
    } else if (svc.ecosystem === 'static') {
      frontendProc = safeSpawn('node', ['--no-deprecation', serverScript, cwd, String(port)], {
        cwd,
        env: feEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32'
      }, 'Static Web Server', port);
      frontendUrl = `http://localhost:${port}`;
    }

    if (frontendProc) {
      frontendProc.on('exit', onProcessExit);
      if (frontendProc.stdout) {
        frontendProc.stdout.on('data', (d) => {
          const text = d.toString();
          const portMatch = text.match(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d+)/i);
          if (portMatch && portMatch[1]) {
            frontendUrl = `http://localhost:${portMatch[1]}`;
          }
          feHandler(d);
        });
      }
      if (frontendProc.stderr) {
        frontendProc.stderr.on('data', feHandler);
      }
    }
  }

  if (projectPlan.type === 'fullstack') {
    if (projectPlan.backend) spawnBackendService(projectPlan.backend);
    if (projectPlan.frontend) spawnFrontendService(projectPlan.frontend);
  } else if (projectPlan.type === 'single' && projectPlan.service) {
    const svc = projectPlan.service;
    if (svc.isBackend || ['fastapi', 'flask', 'django', 'python', 'rust', 'go', 'ruby', 'php', 'dotnet'].includes(svc.flavor || svc.ecosystem)) {
      spawnBackendService(svc);
    } else {
      spawnFrontendService(svc);
    }
  }

  const primaryUrl = frontendUrl || backendUrl || 'http://localhost:3000';
  currentRunningApp = {
    target,
    frontendUrl,
    backendUrl,
    backendDocs,
    primaryUrl
  };

  const syncResult = {
    success: true,
    frontendUrl,
    backendUrl,
    primaryUrl
  };

  const promise = new Promise((resolve) => {
    pendingResolve = resolve;
    if (pendingStartupTimer) clearTimeout(pendingStartupTimer);
    pendingStartupTimer = setTimeout(() => {
      const activePrimaryUrl = frontendUrl || backendUrl || primaryUrl;
      if (currentRunningApp) {
        currentRunningApp.frontendUrl = frontendUrl;
        currentRunningApp.backendUrl = backendUrl;
        currentRunningApp.primaryUrl = activePrimaryUrl;
      }
      if (processStartupFailed) {
        console.log(`\n\x1b[31m\x1b[1m[rapidfire-run] Service process exited with an error. Review the error details above.\x1b[0m\n`);
        if (pendingResolve) {
          pendingResolve(Object.assign(syncResult, {
            success: false,
            error: 'PROCESS_CRASHED',
            frontendUrl,
            backendUrl,
            primaryUrl: activePrimaryUrl
          }));
          pendingResolve = null;
        }
        return;
      }

      renderBanner({
        frontendUrl,
        backendUrl,
        backendDocs,
        primaryUrl: activePrimaryUrl
      });
      openBrowser(activePrimaryUrl);
      if (pendingResolve) {
        pendingResolve(Object.assign(syncResult, {
          frontendUrl,
          backendUrl,
          primaryUrl: activePrimaryUrl
        }));
        pendingResolve = null;
      }
    }, 400);
  });

  Object.assign(promise, syncResult);
  return promise;
}

function handleCliRun(args = []) {
  const isDaemon = args.includes('-d') || args.includes('--daemon') || args.includes('--detach');
  const cleanArgs = args.filter(a => a !== '-d' && a !== '--daemon' && a !== '--detach');

  let isExiting = false;
  function shutdown() {
    if (isExiting) return;
    isExiting = true;
    if (process.stdin && process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
      try {
        process.stdin.setRawMode(false);
        process.stdin.pause();
      } catch {}
    }
    stopProcesses();
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  const runPromise = handleRun(cleanArgs);

  if (isDaemon) {
    if (runPromise && typeof runPromise.then === 'function') {
      runPromise.then((res) => {
        if (res && res.success === false) {
          process.exit(1);
        } else {
          console.log('\x1b[32m[rapidfire-run] Application running in background.\x1b[0m');
          console.log('\x1b[2mRun \'rapidfire stop\' at any time to terminate all background servers.\x1b[0m\n');
          process.exit(0);
        }
      });
    } else {
      process.exit(0);
    }
    return runPromise;
  }

  if (process.stdin) {
    try {
      process.stdin.resume();
    } catch {}
    if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
      try {
        process.stdin.setRawMode(true);
      } catch {}
      process.stdin.on('data', (chunk) => {
        if (chunk.includes(0x03) || chunk.includes(0x04) || String(chunk).includes('\u0003')) {
          shutdown();
        }
      });
    } else {
      process.stdin.on('data', (chunk) => {
        const str = String(chunk).trim().toLowerCase();
        if (chunk.includes(0x03) || chunk.includes(0x04) || str.includes('\u0003') || str.includes('stop') || str === 'q' || str === 'exit') {
          shutdown();
        }
      });
    }
  }

  if (runPromise && typeof runPromise.then === 'function') {
    runPromise.then((res) => {
      if (res && res.success === false) {
        shutdown();
      }
    });
  }

  const exitCheckInterval = setInterval(() => {
    if (activeProcesses.length === 0 && !isExiting) {
      clearInterval(exitCheckInterval);
      process.exit(0);
    }
  }, 1000);
  if (exitCheckInterval.unref) exitCheckInterval.unref();

  return runPromise;
}

module.exports = {
  handleRun,
  handleCliRun,
  stopProcesses,
  freeKnownPorts,
  activeProcesses,
  safeSpawn
};
