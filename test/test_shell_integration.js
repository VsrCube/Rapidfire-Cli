const assert = require('assert');
const { PersistentShell } = require('../src/shell');

console.log('--- TESTING PERSISTENT PTY SHELL INTEGRATION ---');

const shell = new PersistentShell();
let receivedOutput = '';

shell.onData((data) => {
  receivedOutput += data;
});

shell.write('echo "TEST_RAPIDFIRE_OK"');

setTimeout(() => {
  shell.kill();
  console.log('Received raw PTY output:\n' + receivedOutput);
  assert(
    receivedOutput.includes('TEST_RAPIDFIRE_OK'),
    'Expected PTY output to contain TEST_RAPIDFIRE_OK'
  );
  console.log('\n\x1b[32mPTY SHELL INTEGRATION VERIFIED SUCCESSFULLY!\x1b[0m\n');
  process.exit(0);
}, 1200);
