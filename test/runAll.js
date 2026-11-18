const { execSync } = require('child_process');
const path = require('path');

const testFiles = [
  'security.test.js',
  'runner.test.js',
  'scaffolding.test.js',
  'repl.test.js',
  'push.test.js',
  'ai.test.js',
  'overview.test.js',
  'explain.test.js',
  'deploy.test.js',
  'preset.test.js'
];

console.log('\n\x1b[1m\x1b[35m═══════════════════════════════════════════════════════\x1b[0m');
console.log('\x1b[1m\x1b[35m       RAPIDFIRE CLI AUTOMATED TEST SUITE             \x1b[0m');
console.log('\x1b[1m\x1b[35m═══════════════════════════════════════════════════════\x1b[0m\n');

let passed = 0;
let failed = 0;

for (const file of testFiles) {
  const filePath = path.join(__dirname, file);
  try {
    execSync(`node "${filePath}"`, { stdio: 'inherit' });
    passed++;
  } catch (err) {
    console.error(`\x1b[31m[FAIL] Test file failed: ${file}\x1b[0m`);
    failed++;
  }
}

console.log('\x1b[1m\x1b[35m═══════════════════════════════════════════════════════\x1b[0m');
if (failed === 0) {
  console.log(`\x1b[32m✔ ALL ${passed} TEST SUITES PASSED! RAPIDFIRE IS 100% READY.\x1b[0m`);
} else {
  console.log(`\x1b[31m✖ ${failed} test suite(s) failed out of ${testFiles.length}.\x1b[0m`);
}
console.log('\x1b[1m\x1b[35m═══════════════════════════════════════════════════════\x1b[0m\n');

process.exit(failed === 0 ? 0 : 1);

