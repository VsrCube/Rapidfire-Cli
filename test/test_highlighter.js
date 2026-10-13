const assert = require('assert');
const {
  highlightSyntax,
  createCompleter,
  RAPIDFIRE_COMMANDS,
  SHELL_COMMANDS,
  RECIPES
} = require('../src/utils/highlighter');
const { RapidfireRepl } = require('../src/repl');

function runTests() {
  console.log('--- TEST: REAL-TIME SYNTAX HIGHLIGHTER & TAB COMPLETER ---');

  console.log('[Test 1] Testing command highlighting (PowerShell yellow)...');
  const setupCol = highlightSyntax('setup react');
  assert(setupCol.includes('\x1b[93msetup\x1b[0m'), 'setup should be yellow');
  assert(setupCol.includes('\x1b[36mreact\x1b[0m'), 'react recipe should be cyan');

  const expCol = highlightSyntax('explain src/repl.js');
  assert(expCol.includes('\x1b[93mexplain\x1b[0m'), 'explain should be yellow');

  const initCol = highlightSyntax('init git');
  assert(initCol.includes('\x1b[93minit\x1b[0m'), 'init should be yellow');
  assert(initCol.includes('\x1b[36mgit\x1b[0m'), 'git subcommand should be cyan');
  console.log('✓ Command and subcommand highlighting verified.');

  console.log('[Test 2] Testing git subcommands (add, commit, status in cyan)...');
  const gitAdd = highlightSyntax('git add .');
  assert(gitAdd.includes('\x1b[93mgit\x1b[0m'), 'git should be yellow');
  assert(gitAdd.includes('\x1b[36madd\x1b[0m'), 'add should be cyan');

  const gitStatus = highlightSyntax('git status');
  assert(gitStatus.includes('\x1b[93mgit\x1b[0m'), 'git should be yellow');
  assert(gitStatus.includes('\x1b[36mstatus\x1b[0m'), 'status should be cyan');
  console.log('✓ Git subcommands highlighting verified.');

  console.log('[Test 3] Testing flags (gray) and strings (cyan)...');
  const flagCol = highlightSyntax('git commit -m "text Highlight version 0.1"');
  assert(flagCol.includes('\x1b[90m-m\x1b[0m'), '-m flag should be slate gray');
  assert(flagCol.includes('\x1b[36m"text Highlight version 0.1"\x1b[0m'), 'quoted string should be cyan');

  const inProgressCol = highlightSyntax('git commit -m "typing in progress');
  assert(inProgressCol.includes('\x1b[36m"typing in progress\x1b[0m'), 'unclosed string should be cyan');
  console.log('✓ Flags and real-time string highlighting verified.');

  console.log('[Test 4] Testing Tab autocompleter...');
  const completer = createCompleter();

  const [topHits] = completer('exp');
  assert(topHits.includes('explain'), 'Tab completion should find explain');

  const [initHits] = completer('in');
  assert(initHits.includes('init'), 'Tab completion should find init');

  const [recipeHits] = completer('setup re');
  assert(recipeHits.includes('setup react'), 'Tab completion should find setup react');
  assert(recipeHits.includes('setup react+fastapi'), 'Tab completion should find setup react+fastapi');

  const [gitHits] = completer('git com');
  assert(gitHits.includes('git commit'), 'Tab completion should find git commit');

  const [keyHits] = completer('key ');
  assert(keyHits.includes('key status'), 'Tab completion should find key status');
  console.log('✓ Tab autocompleter verified.');

  console.log('[Test 5] Testing RapidfireRepl keystroke real-time refresh hook...');
  const repl = new RapidfireRepl();
  repl.start();

  const symInsert = Object.getOwnPropertySymbols(Object.getPrototypeOf(repl.rl)).find((s) =>
    s.toString().includes('_insertString')
  );
  assert(symInsert, '_insertString symbol must exist on readline prototype');

  repl.rl[symInsert]('i');
  repl.rl[symInsert]('n');
  repl.rl[symInsert]('i');
  repl.rl[symInsert]('t');
  repl.rl[symInsert](' ');

  assert.strictEqual(repl.rl.line, 'init ', 'rl.line must maintain clean plain text');
  assert.strictEqual(repl.rl.cursor, 5, 'rl.cursor must track 5 characters');

  repl.shutdown();
  console.log('✓ RapidfireRepl keystroke real-time refresh hook verified.');

  console.log('\nALL SYNTAX HIGHLIGHTER & REAL-TIME KEYSTROKE TESTS PASSED CLEANLY!\n');
}

runTests();
