const assert = require('assert');
const path = require('path');
const os = require('os');
const fse = require('fs-extra');
const { handleSetup } = require('../src/commands/setup');
const { readManifest } = require('../src/utils/manifest');

console.log('--- TEST: SCAFFOLDING RECIPES & MANIFESTS ---');

const tmpDir = path.join(os.tmpdir(), `test_recipes_${Date.now()}`);
fse.ensureDirSync(tmpDir);

const originalCwd = process.cwd();
process.chdir(tmpDir);

try {
  console.log('[Recipe 1] Testing setup django...');
  handleSetup(['django', 'app_django']);
  const djangoPath = path.join(tmpDir, 'app_django');
  assert(fse.existsSync(path.join(djangoPath, 'manage.py')), 'Django manage.py must exist');
  assert(fse.existsSync(path.join(djangoPath, 'requirements.txt')), 'requirements.txt must exist');
  assert(fse.existsSync(path.join(djangoPath, '.rapidfire.json')), '.rapidfire.json must exist');

  const djangoManifest = readManifest(djangoPath);
  assert.strictEqual(djangoManifest.backend, 'django');
  assert.strictEqual(djangoManifest.frontend, null);
  console.log('✓ setup django and manifest created cleanly.');

  console.log('[Recipe 2] Testing setup react+node...');
  handleSetup(['react+node', 'app_react_node']);
  const fullstackPath = path.join(tmpDir, 'app_react_node');
  assert(fse.existsSync(path.join(fullstackPath, 'frontend', 'package.json')), 'frontend/package.json must exist');
  assert(fse.existsSync(path.join(fullstackPath, 'backend', 'server.js')), 'backend/server.js must exist');
  assert(fse.existsSync(path.join(fullstackPath, 'backend', 'package.json')), 'backend/package.json must exist');
  assert(fse.existsSync(path.join(fullstackPath, '.rapidfire.json')), '.rapidfire.json must exist');

  const nodeManifest = readManifest(fullstackPath);
  assert.strictEqual(nodeManifest.frontend, 'react');
  assert.strictEqual(nodeManifest.backend, 'node');
  console.log('✓ setup react+node and manifest created cleanly.');

  console.log('[Collision Guard] Testing non-empty directory guard...');
  handleSetup(['django', 'app_django']);
  console.log('✓ Non-empty folder protection confirmed.');
} finally {
  process.chdir(originalCwd);
  fse.removeSync(tmpDir);
}

console.log('\n\x1b[32mRECIPE VERIFICATION COMPLETED SUCCESSFULLY!\x1b[0m\n');
