const assert = require('assert');
const { PersistentShell } = require('../src/shell');

console.log('--- TEST: PERSISTENT PTY PASSTHROUGH ---');

const shell = new PersistentShell();
let receivedOutput = '';

shell.onData((data) => {
  receivedOutput += data;
});

shell.write('echo "PASSTHROUGH_VERIFIED"');

const startTime = Date.now();
const interval = setInterval(() => {
  if (receivedOutput.includes('PASSTHROUGH_VERIFIED')) {
    clearInterval(interval);
    shell.kill();
    console.log('✓ Persistent PTY shell command execution and streaming verified.');
    process.exit(0);
  } else if (Date.now() - startTime > 15000) {
    clearInterval(interval);
    shell.kill();
    assert(
      receivedOutput.includes('PASSTHROUGH_VERIFIED'),
      'PTY output must include PASSTHROUGH_VERIFIED'
    );
  }
}, 50);
