const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { planStack } = require('../src/scaffolding/planner');
const { writeManifest, readManifest } = require('../src/utils/manifest');

console.log('\x1b[36mRunning Scaffolding & Manifest Tests...\x1b[0m');

// 1. Planner tests: Predefined standalone stack
const reactPlan = planStack('react');
assert.strictEqual(reactPlan.tier, 'PREDEFINED');
assert.strictEqual(reactPlan.stack, 'react');
assert.strictEqual(reactPlan.isFullstack, false);
console.log('  \x1b[32m✔ Recipe planner: Standalone react mapped accurately\x1b[0m');

// 2. Planner tests: Predefined fullstack pairing
const dynPlan = planStack('react+fastapi');
assert.strictEqual(dynPlan.tier, 'PREDEFINED');
assert.strictEqual(dynPlan.stack, 'react+fastapi');
assert.strictEqual(dynPlan.isFullstack, true);
console.log('  \x1b[32m✔ Recipe planner: Fullstack react+fastapi mapped accurately\x1b[0m');

// 3. Manifest creation and reading
const tmpDir = path.join(__dirname, 'fixtures', 'manifest_test');
fs.mkdirSync(tmpDir, { recursive: true });

writeManifest(tmpDir, {
  folderName: 'manifest_test',
  frontend: 'react',
  backend: 'fastapi'
});

const readBack = readManifest(tmpDir);
assert.ok(readBack, 'Manifest must be readable');
assert.strictEqual(readBack.frontend, 'react');
assert.strictEqual(readBack.backend, 'fastapi');
console.log('  \x1b[32m✔ Manifest: writeManifest & readManifest verified\x1b[0m');

// 4. Invalid recipe & error card verification
const { handleSetup } = require('../src/commands/setup');
(async () => {
  // Test invalid pairing (react+vue)
  const resInvalidPair = await handleSetup(['react+vue', 'dummy_folder']);
  assert.strictEqual(resInvalidPair.success, false);
  assert.strictEqual(resInvalidPair.error, 'INVALID_PAIRING');
  console.log('  \x1b[32m✔ Error card & suggestions: Dual frontend pairing rejected\x1b[0m');

  // Test invalid dual backend (fastapi+django)
  const resDualBe = await handleSetup(['fastapi+django', 'dummy_folder']);
  assert.strictEqual(resDualBe.success, false);
  assert.strictEqual(resDualBe.error, 'INVALID_PAIRING');
  console.log('  \x1b[32m✔ Error card & suggestions: Dual backend pairing rejected\x1b[0m');

  // Test unknown recipe name
  const resUnknown = await handleSetup(['invalid_recipe_xyz', 'dummy_folder']);
  assert.strictEqual(resUnknown.success, false);
  assert.strictEqual(resUnknown.error, 'UNKNOWN_RECIPE');
  console.log('  \x1b[32m✔ Error card & suggestions: Unknown recipe intercepted with suggestions\x1b[0m');

  // Test missing recipe name
  const resMissing = await handleSetup([]);
  assert.strictEqual(resMissing.success, false);
  assert.strictEqual(resMissing.error, 'MISSING_RECIPE');
  console.log('  \x1b[32m✔ Error card & suggestions: Missing recipe argument handled\x1b[0m');

  // 5. Init wizard presets verification
  const { STACK_PRESETS } = require('../src/commands/wizard');
  assert.ok(STACK_PRESETS.length >= 10, 'Init wizard must provide at least 10 presets');
  assert.ok(STACK_PRESETS.some((p) => p.key === 'react+fastapi'), 'Init wizard must include react+fastapi');
  console.log('  \x1b[32m✔ Init Wizard: Presets loaded and validated\x1b[0m');

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('\x1b[32m[PASS] Scaffolding & Manifest Tests Passed!\x1b[0m\n');
})();
