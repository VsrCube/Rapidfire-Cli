const assert = require('assert');
const { matchCommand, getKeywordSuggestion } = require('../src/commands');
const { RapidfireRepl } = require('../src/repl');

console.log('\x1b[36mRunning REPL Command & Sentinel Tests...\x1b[0m');

// 1. Command matcher tests
assert.strictEqual(matchCommand('run').name, 'run');
assert.strictEqual(matchCommand('start').name, 'run');
assert.strictEqual(matchCommand('stop').name, 'stop');
assert.strictEqual(matchCommand('kill').name, 'stop');
assert.strictEqual(matchCommand('setup mern testapp').name, 'setup');
assert.strictEqual(matchCommand('push -m "feat: init"').name, 'push');
assert.strictEqual(matchCommand('scan').name, 'scan');
assert.strictEqual(matchCommand('help').name, 'help');
assert.strictEqual(matchCommand('exit').name, 'exit');
console.log('  \x1b[32m✔ Command matching verified for core REPL commands\x1b[0m');

// 2. Keyword typo suggestions
assert.strictEqual(getKeywordSuggestion('stopp'), 'stop');
assert.strictEqual(getKeywordSuggestion('sotp'), 'stop');
assert.strictEqual(getKeywordSuggestion('setpu'), 'setup');
assert.strictEqual(getKeywordSuggestion('explian'), 'explain');
assert.strictEqual(getKeywordSuggestion('presest'), 'presets');
console.log('  \x1b[32m✔ Typo suggestion engine verified\x1b[0m');

// 3. Sentinel and Echo suppression verification
const repl = new RapidfireRepl();
let captured = '';
const origWrite = process.stdout.write;
process.stdout.write = (c) => { captured += c; return true; };

repl.start();
const dataCallback = repl.shell.dataListeners[0];

// Test command echo with internal sentinel token
repl.expectedEcho = 'cd Desktop';
dataCallback('cd Desktop; Write-Output ("__RAPIDFIRE" + "_DONE__")\r\n');
dataCallback('Set-Location : Cannot find path\r\nAt line:1 char:1\r\n+ cd Desktop\r\n');
dataCallback('__RAPIDFIRE_DONE__\r\n');

process.stdout.write = origWrite;

assert.strictEqual(captured.includes('__RAPIDFIRE'), false, 'Internal __RAPIDFIRE must never leak');
assert.strictEqual(captured.includes('Write-Output'), false, 'Write-Output sentinel must never leak');
assert.ok(captured.includes('Set-Location'), 'Legitimate shell error output must be preserved');
console.log('  \x1b[32m✔ Sentinel suppression & command echo filter verified (0 leaks)\x1b[0m');

repl.shutdown();
console.log('\x1b[32m[PASS] REPL Command & Sentinel Tests Passed!\x1b[0m\n');

