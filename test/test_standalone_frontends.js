const assert = require('assert');
const path = require('path');
const os = require('os');
const fse = require('fs-extra');
const { handleSetup } = require('../src/commands/setup');
const { readManifest } = require('../src/utils/manifest');

console.log('--- TEST: STANDALONE FRONTEND SCAFFOLDING ---');

async function runTests() {
  const tmpDir = path.join(os.tmpdir(), `test_standalone_${Date.now()}`);
  fse.ensureDirSync(tmpDir);

  const originalCwd = process.cwd();
  process.chdir(tmpDir);

  try {
    console.log('[Standalone 1] Testing setup react...');
    await handleSetup(['react', 'app_standalone_react']);
    const reactDir = path.join(tmpDir, 'app_standalone_react');
    assert(fse.existsSync(path.join(reactDir, 'package.json')), 'React package.json must exist');
    assert(fse.existsSync(path.join(reactDir, 'src', 'App.jsx')), 'React App.jsx must exist');
    assert(fse.existsSync(path.join(reactDir, '.rapidfire.json')), '.rapidfire.json must exist');
    assert(fse.existsSync(path.join(reactDir, '.git', 'hooks', 'pre-push')), 'pre-push hook must exist');
    const reactManifest = readManifest(reactDir);
    assert.strictEqual(reactManifest.frontend, 'react');
    assert.strictEqual(reactManifest.backend, null);
    console.log('✓ setup react verified.');

    console.log('[Standalone 2] Testing setup vue...');
    await handleSetup(['vue', 'app_standalone_vue']);
    const vueDir = path.join(tmpDir, 'app_standalone_vue');
    assert(fse.existsSync(path.join(vueDir, 'package.json')), 'Vue package.json must exist');
    assert(fse.existsSync(path.join(vueDir, 'src', 'App.vue')), 'Vue App.vue must exist');
    assert(fse.existsSync(path.join(vueDir, '.rapidfire.json')), '.rapidfire.json must exist');
    const vueManifest = readManifest(vueDir);
    assert.strictEqual(vueManifest.frontend, 'vue');
    assert.strictEqual(vueManifest.backend, null);
    console.log('✓ setup vue verified.');

    console.log('[Standalone 3] Testing setup svelte...');
    await handleSetup(['svelte', 'app_standalone_svelte']);
    const svelteDir = path.join(tmpDir, 'app_standalone_svelte');
    assert(fse.existsSync(path.join(svelteDir, 'package.json')), 'Svelte package.json must exist');
    assert(fse.existsSync(path.join(svelteDir, 'src', 'App.svelte')), 'Svelte App.svelte must exist');
    assert(fse.existsSync(path.join(svelteDir, '.rapidfire.json')), '.rapidfire.json must exist');
    const svelteManifest = readManifest(svelteDir);
    assert.strictEqual(svelteManifest.frontend, 'svelte');
    assert.strictEqual(svelteManifest.backend, null);
    console.log('✓ setup svelte verified.');

    console.log('\nALL 3 STANDALONE FRONTEND RECIPES VERIFIED CLEANLY!');
  } finally {
    process.chdir(originalCwd);
    try {
      fse.removeSync(tmpDir);
    } catch {}
  }
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
