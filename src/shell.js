const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { ensurePath } = require('./utils/proc');

let pty = null;
try {
  pty = require('node-pty');
} catch {
  pty = null;
}

class ChildProcessPtyAdapter {
  constructor(proc) {
    this.proc = proc;
    if (this.proc) {
      this.proc.on('error', () => { });
    }
  }
  write(data) {
    if (this.proc && this.proc.stdin && !this.proc.stdin.destroyed) {
      this.proc.stdin.write(data);
    }
  }
  onData(cb) {
    if (this.proc && this.proc.stdout) {
      this.proc.stdout.on('data', (d) => cb(d.toString()));
    }
    if (this.proc && this.proc.stderr) {
      this.proc.stderr.on('data', (d) => cb(d.toString()));
    }
  }
  onExit(cb) {
    if (this.proc) {
      this.proc.on('close', (code) => cb({ exitCode: code }));
    }
  }
  resize() { }
  kill() {
    if (this.proc) this.proc.kill();
  }
}

function resolveShell() {
  if (process.env.RAPIDFIRE_SHELL) {
    const rawShell = process.env.RAPIDFIRE_SHELL.trim().toLowerCase();
    const baseShell = path.basename(rawShell);
    if (baseShell === 'cmd.exe' || baseShell === 'cmd') {
      throw new Error(
        "[rapidfire] 'cmd.exe' is not supported as a persistent REPL shell. " +
        "Please use PowerShell ('powershell.exe' or 'pwsh.exe') or Bash."
      );
    }
    return {
      shell: process.env.RAPIDFIRE_SHELL,
      args: []
    };
  }

  const isWindows = process.platform === 'win32';
  if (isWindows) {
    return {
      shell: 'powershell.exe',
      args: ['-NoLogo', '-NoProfile', '-Command', '-']
    };
  }

  if (process.platform === 'darwin') {
    const macShell = process.env.SHELL || '/bin/zsh';
    return {
      shell: macShell,
      args: ['-l']
    };
  }

  const userShell = process.env.SHELL || '/bin/bash';
  if (userShell.includes('pwsh') || userShell.includes('powershell')) {
    return {
      shell: userShell,
      args: ['-NoLogo', '-NoProfile', '-Command', '-']
    };
  }
  return {
    shell: userShell,
    args: ['--login']
  };
}

class PersistentShell {
  constructor() {
    this.ptyProcess = null;
    this.shellName = null;
    this.dataListeners = [];
    this.exitListeners = [];
    this.init();
  }

  resolveShell() {

    return resolveShell();
  }

  init() {
    ensurePath();
    const { shell, args } = this.resolveShell();
    this.shellName = path.basename(shell);

    const cols = process.stdout.columns || 80;
    const rows = process.stdout.rows || 24;

    const isPowerShell = this.shellName.includes('pwsh') || this.shellName.includes('powershell');
    this.isPowerShell = isPowerShell;

    if (pty && !isPowerShell) {
      try {
        this.ptyProcess = pty.spawn(shell, args, {
          name: 'xterm-256color',
          cols,
          rows,
          cwd: process.cwd(),
          env: {
            ...process.env,
            TERM: 'xterm-256color'
          }
        });
      } catch {
        this.ptyProcess = null;
      }
    }

    if (!this.ptyProcess) {
      const finalArgs = isPowerShell ? ['-NoLogo', '-NoProfile', '-Command', '-'] : args;
      const cpProc = spawn(shell, finalArgs, {
        cwd: process.cwd(),
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      this.ptyProcess = new ChildProcessPtyAdapter(cpProc);
    }

    this.ptyProcess.onData((data) => {
      for (const listener of this.dataListeners) {
        listener(data);
      }
    });

    this.ptyProcess.onExit((code) => {
      for (const listener of this.exitListeners) {
        listener(code);
      }
    });

    process.stdout.on('resize', () => {
      this.resize(process.stdout.columns || 80, process.stdout.rows || 24);
    });
  }

  onData(listener) {
    this.dataListeners.push(listener);
  }

  onExit(listener) {
    this.exitListeners.push(listener);
  }

  write(input) {
    if (this.ptyProcess) {
      const eol = this.isPowerShell ? '\r\n' : '\n';
      this.ptyProcess.write(input + eol);
    }
  }

  resize(cols, rows) {
    if (this.ptyProcess && cols > 0 && rows > 0) {
      try {
        this.ptyProcess.resize(cols, rows);
      } catch {
      }
    }
  }

  kill() {
    if (this.ptyProcess) {
      try {
        this.ptyProcess.kill();
      } catch {
      }
      this.ptyProcess = null;
    }
  }
}

module.exports = {
  PersistentShell,
  resolveShell
};
