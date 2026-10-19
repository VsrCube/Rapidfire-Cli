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

if (args[0] === 'run' || args[0] === 'start' || args[0] === 'serve') {
  const { handleRun } = require('../src/commands/run');
  handleRun(args.slice(1));
  return;
}

if (args[0] === 'build') {
  const { handleBuild } = require('../src/commands/build');
  handleBuild(args.slice(1));
  return;
}

if (args[0] === 'explain') {
  const { handleExplain } = require('../src/commands/explain');
  handleExplain(args.slice(1)).then(() => process.exit(0)).catch(() => process.exit(1));
  return;
}

if (args[0] === 'overview') {
  const { handleOverview } = require('../src/commands/overview');
  handleOverview(args.slice(1)).then(() => process.exit(0)).catch(() => process.exit(1));
  return;
}

if (args[0] === 'ask') {
  const { handleAsk } = require('../src/commands/ask');
  handleAsk(args.slice(1)).then(() => process.exit(0)).catch(() => process.exit(1));
  return;
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
