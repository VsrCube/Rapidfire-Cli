const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { scanDirectory } = require('../src/security/secretScanner');

console.log('\x1b[36mRunning Security Scanner Tests...\x1b[0m');

// Create temporary fixture directory
const tmpDir = path.join(__dirname, 'fixtures', 'security');
fs.mkdirSync(tmpDir, { recursive: true });

// 1. Clean file test
fs.writeFileSync(path.join(tmpDir, 'clean.js'), 'const a = 123;\nconsole.log(a);\n');
const cleanRes = scanDirectory(tmpDir);
assert.strictEqual(cleanRes.clean, true, 'Clean directory should report clean=true');
assert.strictEqual(cleanRes.findings.length, 0, 'Clean directory should have 0 findings');
console.log('  \x1b[32m✔ Clean directory scan verified\x1b[0m');

// 2. Secret detection tests
const dirtyDir = path.join(__dirname, 'fixtures', 'security_dirty');
fs.mkdirSync(dirtyDir, { recursive: true });

const testSecrets = [
  'sk-' + 'proj-abc123456789012345678901234567890',
  'AIza' + 'SyDTEST_KEY_FOR_GEMINI_API_01234567',
  'AKIA' + 'IOSFODNN7EXAMPLE',
  'ghp_' + '123456789012345678901234567890123456',
  'sk_' + 'live_12345678901234567890123456',
  'postgres://' + 'admin:superSecret123@localhost:5432/mydb'
];

fs.writeFileSync(
  path.join(dirtyDir, 'leaked.js'),
  testSecrets.map((s, idx) => `const key${idx} = "${s}";`).join('\n')
);

const dirtyRes = scanDirectory(dirtyDir);
assert.strictEqual(dirtyRes.clean, false, 'Contaminated directory should report clean=false');
assert.ok(dirtyRes.findings.length >= 6, `Expected at least 6 findings, found ${dirtyRes.findings.length}`);
console.log(`  \x1b[32m✔ Secret detection verified (${dirtyRes.findings.length} secrets intercepted)\x1b[0m`);

// 3. Ignored extensions test (.png, .lock)
fs.writeFileSync(path.join(dirtyDir, 'ignored.png'), 'sk-' + 'proj-abc123456789012345678901234567890');
const ignoreRes = scanDirectory(dirtyDir);
const foundInPng = ignoreRes.findings.some(f => f.file.endsWith('.png'));
assert.strictEqual(foundInPng, false, 'Ignored extensions (.png) must never be scanned');
console.log('  \x1b[32m✔ Ignored extensions (.png) correctly bypassed\x1b[0m');

// Cleanup
fs.rmSync(path.join(__dirname, 'fixtures'), { recursive: true, force: true });
console.log('\x1b[32m[PASS] Security Scanner Tests Passed!\x1b[0m\n');
