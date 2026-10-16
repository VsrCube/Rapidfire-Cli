const readline = require('readline');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { PersistentShell } = require('./shell');
const { matchCommand, getKeywordSuggestion } = require('./commands');
const { highlightSyntax, createCompleter } = require('./utils/highlighter');
const { loadHistory, saveSessionHistory } = require('./utils/history');

const RAPIDFIRE_DONE_SENTINEL = '__RAPIDFIRE_DONE__';

class RapidfireRepl {
  constructor() {
    this.shell = new PersistentShell();
    this.rl = null;
    this.isPassthroughRunning = false;
    this.idleTimer = null;
    this.sessionCommands = [];
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

    const symInsert = Object.getOwnPropertySymbols(Object.getPrototypeOf(this.rl)).find((s) =>
      s.toString().includes('_insertString')
    );
    if (symInsert && typeof this.rl[symInsert] === 'function') {
      Object.defineProperty(this.rl, symInsert, {
        value: function (c) {
          if (this.cursor < this.line.length) {
            const beg = this.line.slice(0, this.cursor);
            const end = this.line.slice(this.cursor);
            this.line = beg + c + end;
          } else {
            this.line += c;
          }
          this.cursor += c.length;
          this._refreshLine();
        },
        configurable: true,
        writable: true
      });
    }

    this.expectedEcho = null;

    this.shell.onData((data) => {
      let chunk = data;
      if (chunk) chunk = chunk.replace(/\x1b\[\?(9001|1004)[hl]/g, '');

      if (chunk) {
        chunk = chunk.replace(/PS\s+[^\r\n>]+>\s*/g, '');
        chunk = chunk.replace(/\[[a-zA-Z0-9_\-\.]+@[a-zA-Z0-9_\-\.]+\s+[^\]]+\][\$#]\s*/g, '');
      }

      if (chunk) {
        chunk = chunk.replace(/;\s*echo\s+["']?__RAPIDFIRE_DONE__["']?/g, '');
      }

      let hasSentinel = false;
      if (chunk && chunk.includes(RAPIDFIRE_DONE_SENTINEL)) {
        hasSentinel = true;
        chunk = chunk.replace(new RegExp(RAPIDFIRE_DONE_SENTINEL + '(\\r?\\n|\\s)*', 'g'), '');
      }

      if (this.expectedEcho && chunk) {
        const trimmedEcho = this.expectedEcho.trim();
        const escaped = trimmedEcho.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const echoRegex = new RegExp('^\\s*' + escaped + '\\s*(\\r?\\n|\u001b\\[[0-9;]*[a-zA-Z]|$)', 'g');
        if (echoRegex.test(chunk)) {
          chunk = chunk.replace(echoRegex, '');
          this.expectedEcho = null;
        } else if (chunk.trim() === trimmedEcho) {
          chunk = '';
          this.expectedEcho = null;
        }
      }

      if (chunk) {
        process.stdout.write(chunk);
      }

      if (hasSentinel) {
        if (this.idleTimer) clearTimeout(this.idleTimer);
        this.isPassthroughRunning = false;
        this.expectedEcho = null;
        this.prompt();
      }
    });

    this.shell.onExit((code) => {
      console.log(`\n[rapidfire] Underlying shell exited with code ${code}.`);
      this.shutdown();
    });

    this.rl.on('line', async (rawLine) => {
      await this.handleLine(rawLine);
    });

    this.rl.on('SIGINT', () => {
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

  async handleLine(rawLine) {
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
      try {
        const result = await matched.run({ rl: this.rl, repl: this });
        if (result && result.exit) {
          this.shutdown();
          return;
        }
      } catch (err) {
        console.error(`[rapidfire] Error executing command '${matched.name}':`, err.message);
      }
      this.prompt();
      return;
    }

    const firstWord = line.split(/\s+/)[0];
    const suggestion = getKeywordSuggestion(firstWord);
    if (suggestion) {
      console.log(`\x1b[33m[rapidfire] '${firstWord}' is not a recognized command. Did you mean '${suggestion}'?\x1b[0m`);
      console.log(`Type \x1b[36mhelp\x1b[0m to view all available commands.\n`);
    }

    this.handleCdSync(line);

    this.isPassthroughRunning = true;
    this.expectedEcho = line;
    if (this.idleTimer) clearTimeout(this.idleTimer);

    this.shell.write(`${line}; echo "${RAPIDFIRE_DONE_SENTINEL}"`);
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
    try {
      saveSessionHistory(this.sessionCommands);
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
