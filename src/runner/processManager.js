const { spawn, exec, execSync } = require('child_process');
const { getToolInstallHint } = require('../utils/proc');

const activeProcesses = [];

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
        }
        const idx = activeProcesses.indexOf(proc);
        if (idx !== -1) {
          activeProcesses.splice(idx, 1);
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

function freeKnownPorts(ports = [3000, 3001, 4200, 5000, 5173, 8000]) {
  if (!ports || !Array.isArray(ports) || ports.length === 0) return;
  try {
    if (process.platform === 'win32') {
      try {
        const output = execSync('netstat -ano -p tcp', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        const pidsToKill = new Set();
        const myPid = process.pid;
        const parentPid = process.ppid;
        for (const port of ports) {
          const regex = new RegExp(`^\\s*TCP\\s+[^:]+:(${port})\\s+.*LISTENING\\s+(\\d+)`, 'gmi');
          let match;
          while ((match = regex.exec(output)) !== null) {
            const pid = parseInt(match[2], 10);
            if (pid && pid > 4 && pid !== myPid && pid !== parentPid) {
              pidsToKill.add(pid);
            }
          }
        }
        for (const pid of pidsToKill) {
          try {
            execSync(`taskkill /f /pid ${pid}`, { stdio: 'ignore' });
          } catch {}
        }
      } catch {}
    } else {
      for (const port of ports) {
        try {
          execSync(`fuser -k ${port}/tcp 2>/dev/null || true`, { stdio: 'ignore' });
        } catch {}
        try {
          execSync(`lsof -ti :${port} -sTCP:LISTEN 2>/dev/null | xargs -r kill -9 2>/dev/null || true`, { stdio: 'ignore' });
        } catch {}
      }
    }
  } catch {}
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

function getOccupiedPorts(ports = [3000, 3001, 4200, 5000, 5173, 8000]) {
  if (!ports || !Array.isArray(ports) || ports.length === 0) return [];
  const targetPorts = ports.map(Number).filter(p => !isNaN(p) && p > 0);
  if (targetPorts.length === 0) return [];

  if (process.platform === 'win32') {
    try {
      const output = execSync('netstat -ano -p tcp', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const occupied = [];
      const myPid = process.pid;
      const parentPid = process.ppid;
      for (const port of targetPorts) {
        const regex = new RegExp(`^\\s*TCP\\s+[^:]+:(${port})\\s+.*LISTENING\\s+(\\d+)`, 'gmi');
        let match;
        while ((match = regex.exec(output)) !== null) {
          const pid = parseInt(match[2], 10);
          if (pid && pid > 4 && pid !== myPid && pid !== parentPid) {
            occupied.push(port);
            break;
          }
        }
      }
      return occupied;
    } catch {
      return [];
    }
  }

  try {
    const out = execSync('ss -tlnH 2>/dev/null', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return targetPorts.filter(p => new RegExp(`:${p}\\b`).test(out));
  } catch {}

  const occupied = [];
  for (const port of targetPorts) {
    try {
      const out = execSync(`lsof -ti :${port} -sTCP:LISTEN 2>/dev/null`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (out) occupied.push(port);
    } catch {}
  }
  return occupied;
}

function stopProcesses(portArgs = [], options = {}) {
  if (!Array.isArray(portArgs) && typeof portArgs === 'object' && portArgs !== null) {
    options = portArgs;
    portArgs = [];
  }

  const hasSpecificPorts = Array.isArray(portArgs) && portArgs.length > 0;
  const targetPorts = [];

  if (hasSpecificPorts) {
    for (const arg of portArgs) {
      const clean = String(arg).replace(/^:/, '').trim();
      const num = parseInt(clean, 10);
      if (!isNaN(num) && num > 0) {
        targetPorts.push(num);
      }
    }
  }

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

  let killedCount = 0;

  if (targetPorts.length > 0) {
    const occupiedBefore = getOccupiedPorts(targetPorts);
    const hasActiveForTarget = activeProcesses.some(proc => proc && targetPorts.includes(proc.port));

    if (!hasActiveForTarget && occupiedBefore.length === 0) {
      if (!options.silentIfEmpty) {
        console.log(`\x1b[33m[rapidfire] No active process found on port(s): ${targetPorts.join(', ')}.\x1b[0m\n`);
      }
      return { success: true, count: 0, ports: targetPorts };
    }

    console.log(`\n\x1b[33m[rapidfire] Terminating processes on port(s): ${targetPorts.join(', ')}...\x1b[0m`);
    freeKnownPorts(targetPorts);

    for (let i = activeProcesses.length - 1; i >= 0; i--) {
      const proc = activeProcesses[i];
      if (proc && targetPorts.includes(proc.port)) {
        killProcessTree(proc);
        activeProcesses.splice(i, 1);
        killedCount++;
      }
    }

    console.log(`\x1b[32m[OK] Port(s) ${targetPorts.join(', ')} released successfully.\x1b[0m\n`);
    return { success: true, count: killedCount, ports: targetPorts };
  }

  const defaultKnownPorts = [3000, 3001, 4200, 5000, 5173, 8000];
  const occupied = getOccupiedPorts(defaultKnownPorts);

  if (activeProcesses.length === 0 && occupied.length === 0) {
    if (!options.silentIfEmpty) {
      console.log(`\x1b[33m[rapidfire] No active servers or listening ports detected.\x1b[0m\n`);
    }
    return { success: true, count: 0 };
  }

  console.log(`\n\x1b[33m[rapidfire] Stopping all active servers...\x1b[0m`);
  while (activeProcesses.length > 0) {
    const proc = activeProcesses.pop();
    killProcessTree(proc);
    killedCount++;
  }

  if (occupied.length > 0) {
    freeKnownPorts(occupied);
  } else {
    freeKnownPorts(defaultKnownPorts);
  }

  console.log(`\x1b[32m[OK] All servers stopped and ports freed.\x1b[0m\n`);
  return { success: true, count: killedCount };
}

module.exports = {
  activeProcesses,
  safeSpawn,
  freeKnownPorts,
  killProcessTree,
  getOccupiedPorts,
  stopProcesses
};
