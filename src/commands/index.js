const { showHelp } = require('./help');
const { handleSetup } = require('./setup');
const { handleSavePreset, handleLoadPreset, handleListPresets } = require('./preset');
const { handleAsk } = require('./ask');
const { handleSuggest } = require('./suggest');
const { handleDeploy } = require('./deploy');
const { handleTell } = require('./tell');
const { handleKey } = require('./key');
const { handleExplain } = require('./explain');
const { handleOverview } = require('./overview');
const { handlePush } = require('./push');

function matchCommand(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const tokens = trimmed.split(/\s+/);
  const cmd = tokens[0].toLowerCase();

  const hasPushToken = tokens.some((t) => t.toLowerCase() === 'push');
  if (
    cmd === 'push' ||
    (cmd === 'git' && tokens[1]?.toLowerCase() === 'add' && hasPushToken) ||
    (cmd === 'add' && hasPushToken) ||
    (cmd === 'git' && tokens[1]?.toLowerCase() === 'push' && tokens.some((t) => t.startsWith('-m') || t.startsWith('-commit') || t.startsWith('-b') || t.startsWith('-branch')))
  ) {
    return {
      name: 'push',
      run: async (context) => handlePush(trimmed, context)
    };
  }

  if (cmd === 'run' || cmd === 'start' || cmd === 'serve') {
    return {
      name: 'run',
      run: async () => {
        const { handleRun } = require('./run');
        return handleRun(tokens.slice(1));
      }
    };
  }

  if (cmd === 'stop') {
    return {
      name: 'stop',
      run: async () => {
        const { stopActiveProcesses, activeProcesses } = require('./run');
        const count = activeProcesses.length;
        stopActiveProcesses();
        console.log(`\x1b[32m[rapidfire] Stopped active application processes.\x1b[0m\n`);
      }
    };
  }

  if (cmd === 'build') {
    return {
      name: 'build',
      run: async () => {
        const { handleBuild } = require('./build');
        return handleBuild(tokens.slice(1));
      }
    };
  }

  if (cmd === 'help') {
    return {
      name: 'help',
      run: async () => showHelp(tokens.slice(1))
    };
  }

  if (cmd === 'clear' || cmd === 'cls') {
    return {
      name: 'clear',
      run: async () => {
        console.clear();
      }
    };
  }

  if (cmd === 'version' || cmd === '-v' || cmd === '--version') {
    return {
      name: 'version',
      run: async () => {
        try {
          const pkg = require('../../package.json');
          console.log(`RapidFire CLI v${pkg.version}`);
        } catch {
          console.log(`RapidFire CLI`);
        }
      }
    };
  }

  if (cmd === 'rapidfire' || cmd === 'rapidfire-cli') {
    if (tokens.length === 1) {
      return {
        name: 'rapidfire',
        run: async (context) => {
          if (context && context.repl && typeof context.repl.printBanner === 'function') {
            context.repl.printBanner();
          } else {
            console.log(`\n\x1b[36m[rapidfire]\x1b[0m RapidFire REPL is active!`);
            console.log(`To scaffold a project, use: \x1b[33msetup <recipe> <folder>\x1b[0m`);
            console.log(`Type \x1b[36mhelp\x1b[0m to view all available commands or recipes.\n`);
          }
        }
      };
    }
    const restTokens = tokens.slice(1);
    const sub = restTokens[0].toLowerCase();
    if (sub === '-v' || sub === '--version' || sub === 'version') {
      return {
        name: 'version',
        run: async () => {
          try {
            const pkg = require('../../package.json');
            console.log(`RapidFire CLI v${pkg.version}`);
          } catch {
            console.log(`RapidFire CLI`);
          }
        }
      };
    }
    const remainingLine = trimmed.slice(tokens[0].length).trim();
    const subMatched = matchCommand(remainingLine);
    if (subMatched) {
      return subMatched;
    }
    return {
      name: 'rapidfire',
      run: async () => {
        console.log(`\n\x1b[33m[rapidfire] Unknown command: '${remainingLine}'.\x1b[0m`);
        console.log(`Type \x1b[36mhelp\x1b[0m to view all available commands.\n`);
      }
    };
  }

  if (cmd === 'exit' || cmd === 'quit') {
    return {
      name: 'exit',
      run: async () => ({ exit: true })
    };
  }

  if (cmd === 'init') {
    if (tokens.length > 1 && tokens[1].toLowerCase() !== 'rapidfire') {
      return {
        name: 'setup',
        run: async (context) => handleSetup(tokens.slice(1), context)
      };
    }
    return {
      name: 'init',
      run: async () => {
        console.log(`\n\x1b[36m[rapidfire]\x1b[0m RapidFire is active!`);
        console.log(`To scaffold a project, use: \x1b[33msetup <recipe> <folder>\x1b[0m`);
        console.log(`Type \x1b[36mhelp\x1b[0m to view all supported framework recipes.\n`);
      }
    };
  }

  if (cmd === 'setup') {
    return {
      name: 'setup',
      run: async (context) => handleSetup(tokens.slice(1), context)
    };
  }

  if (cmd === 'deploy') {
    return {
      name: 'deploy',
      run: async () => handleDeploy(tokens.slice(1))
    };
  }

  if (cmd === 'save' && tokens[1]?.toLowerCase() === 'preset') {
    return {
      name: 'save preset',
      run: async () => handleSavePreset(tokens.slice(2))
    };
  }

  if (cmd === 'load' && tokens[1]?.toLowerCase() === 'preset') {
    return {
      name: 'load preset',
      run: async () => handleLoadPreset(tokens.slice(2))
    };
  }

  if (
    (cmd === 'list' && tokens[1]?.toLowerCase() === 'presets') ||
    cmd === 'presets'
  ) {
    return {
      name: 'list presets',
      run: async () => handleListPresets()
    };
  }

  if (cmd === 'ask') {
    return {
      name: 'ask',
      run: async (context) => handleAsk(tokens.slice(1), context)
    };
  }

  if (cmd === 'suggest') {
    return {
      name: 'suggest',
      run: async (context) => handleSuggest(tokens.slice(1), context)
    };
  }

  if (cmd === 'tell') {
    return {
      name: 'tell',
      run: async (context) => handleTell(tokens.slice(1), context)
    };
  }

  if (cmd === 'key') {
    return {
      name: 'key',
      run: async () => handleKey(tokens.slice(1))
    };
  }

  if (cmd === 'explain') {
    return {
      name: 'explain',
      run: async () => handleExplain(tokens.slice(1))
    };
  }

  if (cmd === 'overview') {
    return {
      name: 'overview',
      run: async () => handleOverview(tokens.slice(1))
    };
  }

  return null;
}

const COMMON_SUGGESTIONS = {
  recipe: 'setup',
  recipes: 'setup',
  create: 'setup',
  scaffold: 'setup',
  helpp: 'help',
  hlp: 'help',
  staup: 'setup',
  setpu: 'setup',
  explian: 'explain',
  explane: 'explain',
  presest: 'presets',
  preset: 'presets',
  sugest: 'suggest',
  asl: 'ask',
  deply: 'deploy',
  psuh: 'push',
  puhs: 'push',
  phsu: 'push',
  overveiw: 'overview',
  overiew: 'overview',
  overivew: 'overview',
  ovreview: 'overview'
};

function getKeywordSuggestion(word) {
  if (!word || typeof word !== 'string') return null;
  const lower = word.toLowerCase();
  if (COMMON_SUGGESTIONS[lower]) {
    return COMMON_SUGGESTIONS[lower];
  }
  return null;
}

module.exports = {
  matchCommand,
  getKeywordSuggestion
};
