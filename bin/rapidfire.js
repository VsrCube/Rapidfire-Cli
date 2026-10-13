#!/usr/bin/env node

const { startRepl } = require('../src/repl');

process.on('SIGINT', () => {
});

process.on('SIGTERM', () => {
  process.exit(0);
});

const args = process.argv.slice(2);
if (args.includes('-v') || args.includes('--version') || (args.length === 1 && args[0] === 'version')) {
  const pkg = require('../package.json');
  console.log(`RapidFire CLI v${pkg.version}`);
  process.exit(0);
}

if (args.includes('-h') || args.includes('--help') || (args.length === 1 && args[0] === 'help')) {
  const { showHelp } = require('../src/commands/help');
  showHelp();
  process.exit(0);
}

try {
  startRepl();
} catch (err) {
  console.error('[rapidfire] Fatal error during startup:', err);
  process.exit(1);
}
