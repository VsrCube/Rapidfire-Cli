const assert = require('assert');
const path = require('path');
const fse = require('fs-extra');
const { planStack, PREDEFINED_RECIPES } = require('../src/scaffolding/planner');
const { handleSetup } = require('../src/commands/setup');
const { readManifest } = require('../src/utils/manifest');

async function runTests() {
  console.log('=== TEST SUITE: DYNAMIC & UNKNOWN FRAMEWORK SCAFFOLDING ===\n');

  console.log('[Test 1] Testing StackPlanner classification across all 3 tiers...');

  const pReactFastapi = planStack('react+fastapi');
  assert.strictEqual(pReactFastapi.tier, 'PREDEFINED', 'react+fastapi should be PREDEFINED');

  const pDjango = planStack('django');
  assert.strictEqual(pDjango.tier, 'PREDEFINED', 'django should be PREDEFINED');

  const pSvelteFastapi = planStack('svelte+fastapi');
  assert.strictEqual(pSvelteFastapi.tier, 'COMPOSED', 'svelte+fastapi should be COMPOSED');
  assert.strictEqual(pSvelteFastapi.frontend, 'svelte');
  assert.strictEqual(pSvelteFastapi.backend, 'fastapi');

  const pVueFlask = planStack('vue+flask');
  assert.strictEqual(pVueFlask.tier, 'COMPOSED', 'vue+flask should be COMPOSED');
  assert.strictEqual(pVueFlask.frontend, 'vue');
  assert.strictEqual(pVueFlask.backend, 'flask');

  const pAstro = planStack('astro');
  assert.strictEqual(pAstro.tier, 'DYNAMIC', 'astro should be DYNAMIC');
  assert.strictEqual(pAstro.isFullstackPairing, false);

  const pSolid = planStack('solid');
  assert.strictEqual(pSolid.tier, 'DYNAMIC', 'solid should be DYNAMIC');

  const pNextFastapi = planStack('nextjs+fastapi');
  assert.strictEqual(pNextFastapi.tier, 'DYNAMIC', 'nextjs+fastapi should be DYNAMIC');
  assert.strictEqual(pNextFastapi.isFullstackPairing, true);

  console.log('✔ StackPlanner accurately categorizes Predefined, Composed, and Dynamic stacks.\n');

  console.log('[Test 2] Testing live scaffolding of composed stack (svelte+fastapi)...');
  const tempDir = path.join('/tmp', `rapidfire_test_dynamic_${Date.now()}`);
  fse.ensureDirSync(tempDir);
  const origCwd = process.cwd();
  process.chdir(tempDir);

  try {
    const composedFolder = 'my_svelte_fastapi_app';
    await handleSetup(['svelte+fastapi', composedFolder], {
      ask: async (q) => {
        if (q.includes('Git repository')) return 'y';
        return 'n';
      }
    });

    const projectDir = path.join(tempDir, composedFolder);
    assert.ok(fse.existsSync(projectDir), 'Project root should exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'frontend')), 'frontend folder should exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'frontend', 'src', 'App.svelte')), 'App.svelte should exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'backend')), 'backend folder should exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'backend', 'main.py')), 'backend/main.py should exist');

    const mainPy = fse.readFileSync(path.join(projectDir, 'backend', 'main.py'), 'utf8');
    assert.ok(mainPy.includes('CORSMiddleware'), 'FastAPI backend should have CORS configured');

    const manifest = readManifest(projectDir);
    assert.ok(manifest, 'Manifest should exist');
    assert.strictEqual(manifest.frontend, 'svelte');
    assert.strictEqual(manifest.backend, 'fastapi');
    assert.strictEqual(manifest.generationMode, 'composed', 'Manifest generationMode should be composed');

    assert.ok(fse.existsSync(path.join(projectDir, '.git')), 'Git repository should be initialized');
    assert.ok(fse.existsSync(path.join(projectDir, '.git', 'hooks', 'pre-push')), 'Gitleaks pre-push hook should be installed');

    console.log('✔ Composed stack (svelte+fastapi) generated cleanly with full CORS, manifest, and security hooks.\n');
  } finally {
    process.chdir(origCwd);
    fse.removeSync(tempDir);
  }

  console.log('[Test 3] Testing user rejection (N) on unknown framework scaffolding...');
  const tempDirReject = path.join('/tmp', `rapidfire_test_reject_${Date.now()}`);
  fse.ensureDirSync(tempDirReject);
  process.chdir(tempDirReject);

  try {
    const unknownFolder = 'my_rejected_app';
    await handleSetup(['unknownframework', unknownFolder], {
      ask: async (q) => {
        return 'n';
      }
    });

    const projectDir = path.join(tempDirReject, unknownFolder);
    assert.ok(!fse.existsSync(projectDir), 'Rejected project directory should not be created');
    console.log('✔ User rejection gracefully halts execution with zero filesystem changes.\n');
  } finally {
    process.chdir(origCwd);
    fse.removeSync(tempDirReject);
  }

  console.log('[Test 4] Testing dynamic scaffolding for unknown framework (astro)...');
  const tempDirDynamic = path.join('/tmp', `rapidfire_test_astro_${Date.now()}`);
  fse.ensureDirSync(tempDirDynamic);
  process.chdir(tempDirDynamic);

  try {
    const astroFolder = 'my_astro_app';
    await handleSetup(['astro', astroFolder], {
      ask: async (q) => {
        if (q.includes('dynamically scaffold') || q.includes('scaffold this') || q.includes('Git repository')) return 'y';
        return 'n';
      }
    });

    const projectDir = path.join(tempDirDynamic, astroFolder);
    assert.ok(fse.existsSync(projectDir), 'Astro project folder should exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'package.json')), 'package.json should exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'astro.config.mjs')), 'astro.config.mjs should exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'src', 'pages', 'index.astro')), 'index.astro should exist');

    const manifest = readManifest(projectDir);
    assert.ok(manifest, 'Manifest should exist');
    assert.strictEqual(manifest.recipe, 'astro');
    assert.strictEqual(manifest.generationMode, 'dynamic');
    assert.strictEqual(manifest.ecosystem, 'node');

    assert.ok(fse.existsSync(path.join(projectDir, '.git')), 'Git repository should be initialized');
    assert.ok(fse.existsSync(path.join(projectDir, '.git', 'hooks', 'pre-push')), 'Gitleaks pre-push hook should be installed');

    console.log('✔ Unknown framework (astro) dynamically scaffolded with full manifest and guardrails.\n');
  } finally {
    process.chdir(origCwd);
    fse.removeSync(tempDirDynamic);
  }

  console.log('[Test 5] Testing non-interactive --dynamic flag for unknown framework (solid)...');
  const tempDirFlag = path.join('/tmp', `rapidfire_test_flag_${Date.now()}`);
  fse.ensureDirSync(tempDirFlag);
  process.chdir(tempDirFlag);

  try {
    const solidFolder = 'my_solid_app';
    process.env.RAPIDFIRE_AUTO_DYNAMIC = '1';
    await handleSetup(['solid', solidFolder, '--dynamic'], {
      ask: async () => 'n'
    });

    const projectDir = path.join(tempDirFlag, solidFolder);
    assert.ok(fse.existsSync(projectDir), 'SolidJS project folder should exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'package.json')), 'package.json should exist');
    const hasSourceFile = fse.existsSync(path.join(projectDir, 'src', 'App.jsx')) ||
                          fse.existsSync(path.join(projectDir, 'src', 'index.jsx')) ||
                          fse.existsSync(path.join(projectDir, 'src', 'main.jsx'));
    assert.ok(hasSourceFile, 'Source entry file (App.jsx / index.jsx / main.jsx) should exist');

    const manifest = readManifest(projectDir);
    assert.ok(manifest, 'Manifest should exist');
    assert.strictEqual(manifest.recipe, 'solid');
    assert.strictEqual(manifest.generationMode, 'dynamic');

    console.log('✔ Non-interactive --dynamic flag successfully scaffolded unknown framework.\n');
  } finally {
    delete process.env.RAPIDFIRE_AUTO_DYNAMIC;
    process.chdir(origCwd);
    fse.removeSync(tempDirFlag);
  }

  console.log('======================================================');
  console.log('ALL DYNAMIC SCAFFOLDING TESTS PASSED FLAWLESSLY!');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('\x1b[31mTest failed:\x1b[0m', err);
  process.exit(1);
});
