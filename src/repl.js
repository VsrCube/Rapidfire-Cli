const readline = require('readline');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { PersistentShell } = require('./shell');
const { matchCommand, getKeywordSuggestion } = require('./commands');
const { highlightSyntax, createCompleter } = require('./utils/highlighter');
const { loadHistory, saveSessionHistory } = require('./utils/history');

const RAPIDFIRE_DONE_SENTINEL = '__RAPIDFIRE_DONE__';

function stripAnsi(str) {
  return typeof str === 'string' ? str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '') : '';
}

class RapidfireRepl {
  constructor() {
    this.shell = new PersistentShell();
    this.rl = null;
    this.isPassthroughRunning = false;
    this.isExecutingCommand = false;
    this.idleTimer = null;
    this.sessionCommands = [];
    this.dataBuffer = '';
    this.bufferFlushTimer = null;
  }

  getPrompt() {
    const cwd = process.cwd();
    const isPwsh = Boolean(process.platform === 'win32' || process.env.PSModulePath || process.env.POWERSHELL_DISTRIBUTION_CHANNEL || process.env.RAPIDFIRE_PWSH);
    const prefix = isPwsh ? 'PS ' : '';
    return `\x1b[32m${prefix}${cwd}\x1b[36m(rapidfire)>\x1b[0m `;
  }

  prompt() {
    if (this.rl) {
      this.rl.setPrompt(this.getPrompt());
      this.rl.prompt();
    }
  }

  start() {
    if (process.stdout.isTTY) {
      process.stdout.write('\x1b[?9001l\x1b[?1004l\x1b]133;D;0\x07');
    }
    this.printBanner();

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.getPrompt(),
      completer: createCompleter()
    });

    try {
      this.rl.history = loadHistory(100);
    } catch { }

    if (typeof this.rl._writeToOutput === 'function') {
      const origWrite = this.rl._writeToOutput.bind(this.rl);
      this.rl._writeToOutput = function (stringToWrite) {
        if (typeof stringToWrite === 'string' && this._prompt && stringToWrite.startsWith(this._prompt)) {
          const rawLine = stringToWrite.slice(this._prompt.length);
          const highlighted = highlightSyntax(rawLine);
          return origWrite(this._prompt + highlighted);
        }
        return origWrite(stringToWrite);
      };
    }

    if (typeof this.rl.cursor !== 'number' || isNaN(this.rl.cursor)) {
      this.rl.cursor = 0;
    }

    const symInsert = Object.getOwnPropertySymbols(Object.getPrototypeOf(this.rl)).find((s) =>
      s.toString().includes('_insertString')
    );
    if (symInsert && typeof this.rl[symInsert] === 'function') {
      Object.defineProperty(this.rl, symInsert, {
        value: function (c) {
          if (typeof this.cursor !== 'number' || isNaN(this.cursor)) {
            this.cursor = 0;
          }
          if (typeof this.line !== 'string') {
            this.line = '';
          }
          if (this.cursor < this.line.length) {
            const beg = this.line.slice(0, this.cursor);
            const end = this.line.slice(this.cursor);
            this.line = beg + c + end;
          } else {
            this.line += c;
          }
          this.cursor += c.length;
          if (typeof this._refreshLine === 'function') {
            this._refreshLine();
          }
        },
        configurable: true,
        writable: true
      });
    }

    this.expectedEcho = null;

    this.shell.onData((data) => {
      let chunk = data;
      if (!chunk) return;

      this.dataBuffer += chunk;

      // Handle raw prompt leak without newline (e.g. initial PS prompt or after command)
      const cleanBuf = stripAnsi(this.dataBuffer).trim();
      if (/^PS\s+[^\r\n>]+>\s*$/i.test(cleanBuf) || /^\[[a-zA-Z0-9_\-\.]+@[^\]]+\][\$#]\s*$/.test(cleanBuf)) {
        this.dataBuffer = '';
        return;
      }

      this.processIncomingData();
    });

    this.shell.onExit((code) => {
      console.log(`\n[rapidfire] Underlying shell exited with code ${code}.`);
      this.shutdown();
    });

    this.rl.on('line', async (rawLine) => {
      await this.handleLine(rawLine);
    });

    this.rl.on('SIGINT', () => {
      this.isExecutingCommand = false;
      try {
        const { activeProcesses, stopProcesses } = require('./commands/run');
        if (activeProcesses && activeProcesses.length > 0) {
          stopProcesses();
          this.prompt();
          return;
        }
      } catch {}
      if (this.isPassthroughRunning) {
        this.shell.write('\x03');
        this.isPassthroughRunning = false;
        this.expectedEcho = null;
        if (this.idleTimer) clearTimeout(this.idleTimer);
        this.prompt();
      } else {
        this.shutdown();
      }
    });

    this.rl.on('close', () => {
      this.shutdown();
    });

    this.prompt();
  }

  printBanner() {
    const bold = '\x1b[1m';
    const cyan = '\x1b[36m';
    const reset = '\x1b[0m';
    const dim = '\x1b[2m';

    console.log(`
${bold}${cyan}╔════════════════════════════════════════════════════╗
║               RAPIDFIRE CLI REPL                   ║
║   Persistent Shell Passthrough + Scaffolding REPL  ║
╚════════════════════════════════════════════════════╝${reset}
${dim}Type 'help' for built-in recipes, or run any standard shell command.${reset}
`);
  }

  processIncomingData(flushAll = false) {
    if (!this.dataBuffer) return;

    const cleanBuf = stripAnsi(this.dataBuffer);
    const hasSentinelToken = cleanBuf.includes(RAPIDFIRE_DONE_SENTINEL) || cleanBuf.includes('_DONE__');
    const hasNewline = this.dataBuffer.includes('\n');

    if (!flushAll && !hasNewline && !hasSentinelToken) {
      if (this.bufferFlushTimer) clearTimeout(this.bufferFlushTimer);
      this.bufferFlushTimer = setTimeout(() => {
        if (this.dataBuffer) {
          const clean = stripAnsi(this.dataBuffer).trim();
          if (!/^PS\s+[^\r\n>]+>\s*$/i.test(clean) && !clean.includes('__RAPIDFIRE') && !clean.includes('Write-Output')) {
            this.processIncomingData(true);
          }
        }
      }, 25);
      return;
    }

    if (this.bufferFlushTimer) {
      clearTimeout(this.bufferFlushTimer);
      this.bufferFlushTimer = null;
    }

    let toProcess = '';
    if (flushAll || hasSentinelToken || this.dataBuffer.endsWith('\n')) {
      toProcess = this.dataBuffer;
      this.dataBuffer = '';
    } else {
      const lastNl = this.dataBuffer.lastIndexOf('\n');
      toProcess = this.dataBuffer.slice(0, lastNl + 1);
      this.dataBuffer = this.dataBuffer.slice(lastNl + 1);
    }

    toProcess = toProcess.replace(/\x1b\[\?(9001|1004)[hl]/g, '');

    let hasSentinel = false;
    const cleanProcess = stripAnsi(toProcess);
    if (cleanProcess.includes(RAPIDFIRE_DONE_SENTINEL) || cleanProcess.includes('_DONE__')) {
      hasSentinel = true;
    }

    // 1. Remove inline sentinel command invocation
    toProcess = toProcess.replace(/;\s*(?:Write-Output\s*\([^)]*__RAPIDFIRE[^)]*\)|echo\s+["']?__RAPIDFIRE[^"'\r\n]*["']?)/gi, '');
    toProcess = toProcess.replace(new RegExp(RAPIDFIRE_DONE_SENTINEL + '(\\r?\\n|\\s)*', 'g'), '');

    // 2. Line-by-line filtering for echo, prompt leak, and sentinel remnants
    const lines = toProcess.split(/(\r?\n)/);
    const filtered = [];

    for (let i = 0; i < lines.length; i++) {
      const part = lines[i];
      if (part === '\n' || part === '\r\n') {
        filtered.push(part);
        continue;
      }

      const clean = stripAnsi(part).trim();
      if (!clean) {
        filtered.push(part);
        continue;
      }

      // Suppress any remaining sentinel or internal sync tokens
      if (
        clean.includes('__RAPIDFIRE') ||
        clean.includes(RAPIDFIRE_DONE_SENTINEL) ||
        clean.includes('Write-Output') ||
        clean.includes('_DONE__') ||
        clean.includes('("__RAPIDFIRE"')
      ) {
        if (clean.includes(RAPIDFIRE_DONE_SENTINEL) || clean.includes('_DONE__')) {
          hasSentinel = true;
        }
        this.expectedEcho = null;
        if (i + 1 < lines.length && (lines[i + 1] === '\n' || lines[i + 1] === '\r\n')) {
          i++;
        }
        continue;
      }

      // Suppress expected typed command echo
      if (this.expectedEcho) {
        const cleanEcho = stripAnsi(this.expectedEcho).trim();
        if (clean === cleanEcho || clean.startsWith(cleanEcho) || clean.endsWith(cleanEcho)) {
          this.expectedEcho = null;
          if (i + 1 < lines.length && (lines[i + 1] === '\n' || lines[i + 1] === '\r\n')) {
            i++;
          }
          continue;
        }
      }

      // Suppress underlying shell prompt leaks (e.g. "PS /path/to/dir>" or "[user@host dir]$")
      if (/^PS\s+[^\r\n>]+>$/i.test(clean) || /^\[[a-zA-Z0-9_\-\.]+@[^\]]+\][\$#]$/.test(clean)) {
        if (i + 1 < lines.length && (lines[i + 1] === '\n' || lines[i + 1] === '\r\n')) {
          i++;
        }
        continue;
      }

      filtered.push(part);
    }

    let chunk = filtered.join('');

    // Suppress chunk if only whitespace remains after stripping
    if (stripAnsi(chunk).trim().length === 0 && chunk.length > 0) {
      chunk = '';
    }

    if (chunk) {
      process.stdout.write(chunk);
    }

    if (hasSentinel) {
      if (this.idleTimer) clearTimeout(this.idleTimer);
      this.isPassthroughRunning = false;
      this.expectedEcho = null;
      this.dataBuffer = '';
      this.prompt();
    }
  }

  async handleLine(rawLine) {
    if (this.isExecutingCommand) {
      return;
    }

    const line = rawLine.replace(/\x1b\[200~|\x1b\[201~/g, '').trim();

    if (!line) {
      this.isPassthroughRunning = false;
      this.expectedEcho = null;
      if (this.idleTimer) clearTimeout(this.idleTimer);
      this.prompt();
      return;
    }

    this.sessionCommands.push(line);

    const matched = matchCommand(line);

    if (matched) {
      this.isExecutingCommand = true;
      try {
        const result = await matched.run({ rl: this.rl, repl: this });
        if (result && result.exit) {
          this.shutdown();
          return;
        }
      } catch (err) {
        console.error(`[rapidfire] Error executing command '${matched.name}':`, err.message);
      } finally {
        this.isExecutingCommand = false;
        this.prompt();
      }
      return;
    }

    const firstWord = line.split(/\s+/)[0];
    const suggestion = getKeywordSuggestion(firstWord);
    if (suggestion) {
      console.log(`\x1b[33m[rapidfire] '${firstWord}' is not a recognized command. Did you mean '${suggestion}'?\x1b[0m`);
      console.log(`Type \x1b[36mhelp\x1b[0m to view all available commands.\n`);
      this.prompt();
      return;
    }

    this.handleCdSync(line);

    this.isPassthroughRunning = true;
    this.expectedEcho = line;
    if (this.idleTimer) clearTimeout(this.idleTimer);

    const sentinelCmd = (this.shell && this.shell.isPowerShell)
      ? '; Write-Output ("__RAPIDFIRE" + "_DONE__")'
      : '; echo "__RAPIDFIRE""_DONE__"';
    this.shell.write(`${line}${sentinelCmd}`);
  }

  handleCdSync(line) {
    const trimmed = line.trim();
    if (trimmed === 'cd' || /^cd[\s'"]/.test(trimmed)) {
      let target = trimmed.slice(2).trim();
      if (
        (target.startsWith('"') && target.endsWith('"')) ||
        (target.startsWith("'") && target.endsWith("'"))
      ) {
        target = target.slice(1, -1);
      }
      let targetPath;
      if (!target || target === '~') {
        targetPath = os.homedir();
      } else if (target.startsWith('~/')) {
        targetPath = path.join(os.homedir(), target.slice(2));
      } else {
        targetPath = path.resolve(process.cwd(), target);
      }

      if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
        try {
          process.chdir(targetPath);
          if (this.rl) {
            this.rl.setPrompt(this.getPrompt());
          }
        } catch {
        }
      }
    }
  }

  shutdown() {
    console.log('\n\x1b[33m[rapidfire] Exiting....\x1b[0m');
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.bufferFlushTimer) clearTimeout(this.bufferFlushTimer);
    try {
      saveSessionHistory(this.sessionCommands);
    } catch { }
    try {
      const { stopProcesses } = require('./commands/run');
      stopProcesses([], { silentIfEmpty: true });
    } catch { }
    if (this.shell) {
      this.shell.kill();
    }
    if (process.stdout.isTTY) {
      process.stdout.write('\x1b[?9001l\x1b[?1004l');
    }
    process.exit(0);
  }
}

function startRepl() {
  const repl = new RapidfireRepl();
  repl.start();
  return repl;
}

module.exports = {
  RapidfireRepl,
  startRepl
};
