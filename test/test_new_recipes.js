const assert = require('assert');
const path = require('path');
const os = require('os');
const fse = require('fs-extra');
const { handleSetup } = require('../src/commands/setup');
const { readManifest } = require('../src/utils/manifest');

console.log('--- TEST: EXPANDED FRAMEWORK RECIPES ---');

const tmpDir = path.join(os.tmpdir(), `test_new_recipes_${Date.now()}`);
fse.ensureDirSync(tmpDir);

const originalCwd = process.cwd();
process.chdir(tmpDir);

try {
  console.log('[Recipe 1] Testing setup fastapi...');
  handleSetup(['fastapi', 'my_fastapi_app']);
  const faDir = path.join(tmpDir, 'my_fastapi_app');
  assert(fse.existsSync(path.join(faDir, 'main.py')), 'FastAPI main.py must exist');
  assert(fse.existsSync(path.join(faDir, 'requirements.txt')), 'FastAPI requirements.txt must exist');
  assert(fse.existsSync(path.join(faDir, '.rapidfire.json')), '.rapidfire.json must exist');
  const faManifest = readManifest(faDir);
  assert.strictEqual(faManifest.backend, 'fastapi');
  assert.strictEqual(faManifest.frontend, null);
  console.log('✓ setup fastapi verified.');

  console.log('[Recipe 2] Testing setup react+fastapi...');
  handleSetup(['react+fastapi', 'my_react_fastapi']);
  const rfDir = path.join(tmpDir, 'my_react_fastapi');
  assert(fse.existsSync(path.join(rfDir, 'frontend', 'package.json')), 'React frontend/package.json must exist');
  assert(fse.existsSync(path.join(rfDir, 'backend', 'main.py')), 'FastAPI backend/main.py must exist');
  assert(fse.existsSync(path.join(rfDir, 'backend', 'requirements.txt')), 'FastAPI requirements.txt must exist');
  const rfManifest = readManifest(rfDir);
  assert.strictEqual(rfManifest.frontend, 'react');
  assert.strictEqual(rfManifest.backend, 'fastapi');
  console.log('✓ setup react+fastapi verified.');

  console.log('[Recipe 3] Testing setup vue+node...');
  handleSetup(['vue+node', 'my_vue_node']);
  const vnDir = path.join(tmpDir, 'my_vue_node');
  assert(fse.existsSync(path.join(vnDir, 'frontend', 'package.json')), 'Vue frontend/package.json must exist');
  assert(fse.existsSync(path.join(vnDir, 'frontend', 'src', 'App.vue')), 'Vue App.vue must exist');
  assert(fse.existsSync(path.join(vnDir, 'backend', 'server.js')), 'Express backend/server.js must exist');
  const vnManifest = readManifest(vnDir);
  assert.strictEqual(vnManifest.frontend, 'vue');
  assert.strictEqual(vnManifest.backend, 'node');
  console.log('✓ setup vue+node verified.');

  console.log('[Recipe 4] Testing setup react+flask...');
  handleSetup(['react+flask', 'my_react_flask']);
  const rkDir = path.join(tmpDir, 'my_react_flask');
  assert(fse.existsSync(path.join(rkDir, 'frontend', 'package.json')), 'React frontend/package.json must exist');
  assert(fse.existsSync(path.join(rkDir, 'backend', 'app.py')), 'Flask backend/app.py must exist');
  assert(fse.existsSync(path.join(rkDir, 'backend', 'requirements.txt')), 'Flask backend/requirements.txt must exist');
  const rkManifest = readManifest(rkDir);
  assert.strictEqual(rkManifest.frontend, 'react');
  assert.strictEqual(rkManifest.backend, 'flask');
  console.log('✓ setup react+flask verified.');

} finally {
  process.chdir(originalCwd);
  fse.removeSync(tmpDir);
}

console.log('\n\x1b[32mALL 4 EXPANDED FRAMEWORK RECIPES VERIFIED CLEANLY!\x1b[0m\n');
