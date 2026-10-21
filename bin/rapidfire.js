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

if (args[0] === 'setup') {
  const { handleSetup } = require('../src/commands/setup');
  handleSetup(args.slice(1)).then(() => process.exit(0)).catch(() => process.exit(1));
  return;
}

if (args[0] === 'presets' || (args[0] === 'list' && args[1] === 'presets')) {
  const { handleListPresets } = require('../src/commands/preset');
  handleListPresets();
  process.exit(0);
}

if (args[0] === 'save' && args[1] === 'preset') {
  const { handleSavePreset } = require('../src/commands/preset');
  handleSavePreset(args.slice(2));
  process.exit(0);
}

if (args[0] === 'load' && args[1] === 'preset') {
  const { handleLoadPreset } = require('../src/commands/preset');
  handleLoadPreset(args.slice(2));
  process.exit(0);
}

if (args[0] === 'key') {
  const { handleKey } = require('../src/commands/key');
  handleKey(args.slice(1));
  process.exit(0);
}

if (args[0] === 'suggest') {
  const { handleSuggest } = require('../src/commands/suggest');
  handleSuggest(args.slice(1)).then(() => process.exit(0)).catch(() => process.exit(1));
  return;
}

if (args[0] === 'tell') {
  const { handleTell } = require('../src/commands/tell');
  handleTell(args.slice(1)).then(() => process.exit(0)).catch(() => process.exit(1));
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
