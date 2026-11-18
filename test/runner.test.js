const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { detectProject } = require('../src/runner/detector');
const { stopProcesses } = require('../src/runner/processManager');

console.log('\x1b[36mRunning Runner & Process Manager Tests...\x1b[0m');

const fixturesDir = path.join(__dirname, 'fixtures', 'runner');
fs.mkdirSync(fixturesDir, { recursive: true });

// 1. Detector tests: Node project
const nodeDir = path.join(fixturesDir, 'node_app');
fs.mkdirSync(nodeDir, { recursive: true });
fs.writeFileSync(path.join(nodeDir, 'package.json'), JSON.stringify({
  scripts: { dev: 'node server.js' }
}));
const nodePlan = detectProject(nodeDir);
assert.strictEqual(nodePlan.type, 'single', 'Should detect package.json script as single runner');
assert.strictEqual(nodePlan.service.ecosystem, 'node', 'Service ecosystem should be node');
console.log('  \x1b[32m✔ Project detector: Node.js dev project recognized\x1b[0m');

// 2. Detector tests: Static HTML
const htmlDir = path.join(fixturesDir, 'static_app');
fs.mkdirSync(htmlDir, { recursive: true });
fs.writeFileSync(path.join(htmlDir, 'index.html'), '<h1>Hello RapidFire</h1>');
const htmlPlan = detectProject(htmlDir);
assert.strictEqual(htmlPlan.type, 'single', 'Should detect single runner');
assert.strictEqual(htmlPlan.service.ecosystem, 'static', 'Service ecosystem should be static');
console.log('  \x1b[32m✔ Project detector: Static HTML recognized\x1b[0m');

// 3. Process Manager tests: Safe stop on empty list
assert.doesNotThrow(() => {
  stopProcesses([], { silentIfEmpty: true });
}, 'stopProcesses on empty list should never throw');
console.log('  \x1b[32m✔ Process manager: stopProcesses silent handling verified\x1b[0m');

// Cleanup
fs.rmSync(fixturesDir, { recursive: true, force: true });
console.log('\x1b[32m[PASS] Runner & Process Manager Tests Passed!\x1b[0m\n');
