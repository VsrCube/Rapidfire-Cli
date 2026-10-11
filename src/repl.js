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
    process.stdout.write('\x1b[?9001l\x1b[?1004l');
    this.printBanner();

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.getPrompt(),
      completer: createCompleter()
    });

    // Pre-populate readline history with previous host shell commands (PowerShell, Bash, Zsh)
    try {
      this.rl.history = loadHistory(100);
    } catch { }

    // Real-time syntax highlighting hook on readline output
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

    // Hook character insertion so every keystroke triggers instant syntax highlighting
    // (Default Node readline only redraws on backspace or cursor movement)
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

    // Pipe PTY output only when a pass-through command is running
    // This prevents bash startup prompt ([user@host cwd]$) from bleeding into initial screen
    this.shell.onData((data) => {
      let chunk = data;
      if (chunk) chunk = chunk.replace(/\x1b\[\?(9001|1004)[hl]/g, '');

      // Clean internal PowerShell / subshell prompt strings so they don't collide with rapidfire prompt
      if (chunk) {
        chunk = chunk.replace(/PS\s+[^\r\n>]+>\s*/g, '');
        chunk = chunk.replace(/\[[a-zA-Z0-9_\-\.]+@[a-zA-Z0-9_\-\.]+\s+[^\]]+\][\$#]\s*/g, '');
      }

      // Strip appended sentinel from echoed command lines so user never sees internal plumbing
      if (chunk) {
        chunk = chunk.replace(/;\s*echo\s+["']?__RAPIDFIRE_DONE__["']?/g, '');
      }

      // Check if chunk contains the completion sentinel
      let hasSentinel = false;
      if (chunk && chunk.includes(RAPIDFIRE_DONE_SENTINEL)) {
        hasSentinel = true;
        chunk = chunk.replace(new RegExp(RAPIDFIRE_DONE_SENTINEL + '(\\r?\\n|\\s)*', 'g'), '');
      }

      // Strip the terminal driver's echo of the command typed by the user
      if (this.expectedEcho && chunk) {
        const trimmedEcho = this.expectedEcho.trim();
        const escaped = trimmedEcho.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Only strip if the chunk starts with the exact command line and newline or terminal escape sequence
        // DO NOT strip if the chunk contains error text like "hi: The term 'hi' is not recognized"
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
        // Underlying command has completely finished
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

    // Initial prompt
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
    // Strip bracketed-paste escape sequences if pasted into terminal
    const line = rawLine.replace(/\x1b\[200~|\x1b\[201~/g, '').trim();

    if (!line) {
      this.isPassthroughRunning = false;
      this.expectedEcho = null;
      if (this.idleTimer) clearTimeout(this.idleTimer);
      this.prompt();
      return;
    }

    // Record command into session history for host synchronization
    this.sessionCommands.push(line);

    // Check if line is a rapidfire internal command
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

    // Keyword typo suggestion helper
    const firstWord = line.split(/\s+/)[0];
    const suggestion = getKeywordSuggestion(firstWord);
    if (suggestion) {
      console.log(`\x1b[33m[rapidfire] '${firstWord}' is not a recognized command. Did you mean '${suggestion}'?\x1b[0m`);
      console.log(`Type \x1b[36mhelp\x1b[0m to view all available commands.\n`);
    }

    // Handle cd synchronization between Node process.cwd() and shell PTY
    this.handleCdSync(line);

    // Pass-through to underlying persistent shell
    this.isPassthroughRunning = true;
    this.expectedEcho = line;
    if (this.idleTimer) clearTimeout(this.idleTimer);

    // Send command with completion sentinel so REPL detects exactly when it finishes
    this.shell.write(`${line}; echo "${RAPIDFIRE_DONE_SENTINEL}"`);
  }

  handleCdSync(line) {
    const parts = line.split(/\s+/);
    if (parts[0] === 'cd') {
      const target = parts[1];
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
          this.rl.setPrompt(this.getPrompt());
        } catch {
          // If chdir fails in Node, shell will report error
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
    process.stdout.write('\x1b[?9001l\x1b[?1004l');
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
