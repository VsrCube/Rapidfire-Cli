const assert = require('assert');
const path = require('path');
const fse = require('fs-extra');
const { planStack, PREDEFINED_RECIPES } = require('../src/scaffolding/planner');
const { handleSetup } = require('../src/commands/setup');
const { readManifest } = require('../src/utils/manifest');

async function runTests() {
  process.env.RAPIDFIRE_SKIP_INSTALL = '1';
  process.env.RAPIDFIRE_SKIP_GH = '1';
  process.env.RAPIDFIRE_AUTO_VENV = '0';
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

  console.log('[Test 5] Testing auto-detection of dynamic framework (solid)...');
  const tempDirFlag = path.join('/tmp', `rapidfire_test_flag_${Date.now()}`);
  fse.ensureDirSync(tempDirFlag);
  process.chdir(tempDirFlag);

  try {
    const solidFolder = 'my_solid_app';
    await handleSetup(['solid', solidFolder]);

    const projectDir = path.join(tempDirFlag, solidFolder);
    assert.ok(fse.existsSync(projectDir), 'SolidJS project folder should exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'package.json')), 'package.json should exist');
    const hasSourceFile = fse.existsSync(path.join(projectDir, 'src', 'App.jsx')) ||
                          fse.existsSync(path.join(projectDir, 'src', 'index.jsx')) ||
                          fse.existsSync(path.join(projectDir, 'src', 'main.jsx')) ||
                          fse.existsSync(path.join(projectDir, 'src', 'App.tsx')) ||
                          fse.existsSync(path.join(projectDir, 'src', 'index.tsx')) ||
                          fse.existsSync(path.join(projectDir, 'src', 'main.tsx')) ||
                          fse.existsSync(path.join(projectDir, 'src', 'App.js')) ||
                          fse.existsSync(path.join(projectDir, 'src', 'index.js'));
    assert.ok(hasSourceFile, 'Source entry file (App / index / main in .jsx/.tsx/.js) should exist');

    const manifest = readManifest(projectDir);
    assert.ok(manifest, 'Manifest should exist');
    assert.strictEqual(manifest.recipe, 'solid');
    assert.strictEqual(manifest.generationMode, 'dynamic');

    console.log('✔ Auto-detection of dynamic framework successfully scaffolded project without --dynamic flag.\n');
  } finally {
    process.chdir(origCwd);
    fse.removeSync(tempDirFlag);
  }

  console.log('[Test 6] Testing auto-detection of dynamic full-stack hybrid pairing (solid+fastapi)...');
  const tempDirHybrid = path.join('/tmp', `rapidfire_test_hybrid_${Date.now()}`);
  fse.ensureDirSync(tempDirHybrid);
  process.chdir(tempDirHybrid);

  try {
    const hybridFolder = 'my_solid_fastapi_app';
    await handleSetup(['solid+fastapi', hybridFolder]);

    const projectDir = path.join(tempDirHybrid, hybridFolder);
    assert.ok(fse.existsSync(projectDir), 'Project root should exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'frontend')), 'frontend directory should exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'frontend', 'package.json')), 'frontend/package.json should exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'frontend', 'src', 'App.jsx')), 'frontend/src/App.jsx should exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'backend')), 'backend directory should exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'backend', 'main.py')), 'backend/main.py should exist');

    const mainPy = fse.readFileSync(path.join(projectDir, 'backend', 'main.py'), 'utf8');
    assert.ok(mainPy.includes('CORSMiddleware'), 'FastAPI backend should configure CORS');

    const manifest = readManifest(projectDir);
    assert.ok(manifest, 'Manifest should exist');
    assert.strictEqual(manifest.frontend, 'solid');
    assert.strictEqual(manifest.backend, 'fastapi');
    assert.strictEqual(manifest.isFullstack, true);
    assert.strictEqual(manifest.generationMode, 'dynamic');

    console.log('✔ Auto-detection of hybrid dynamic fullstack pairing (solid+fastapi) scaffolded successfully without --dynamic flag.\n');
  } finally {
    process.chdir(origCwd);
    fse.removeSync(tempDirHybrid);
  }

  console.log('[Test 7] Testing auto-detection of dynamic full-stack dual-dynamic pairing (solid+hono)...');
  const tempDirDual = path.join('/tmp', `rapidfire_test_dual_${Date.now()}`);
  fse.ensureDirSync(tempDirDual);
  process.chdir(tempDirDual);

  try {
    const dualFolder = 'my_solid_hono_app';
    await handleSetup(['solid+hono', dualFolder]);

    const projectDir = path.join(tempDirDual, dualFolder);
    assert.ok(fse.existsSync(projectDir), 'Project root should exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'frontend')), 'frontend directory should exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'frontend', 'package.json')), 'frontend/package.json should exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'backend')), 'backend directory should exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'backend', 'index.js')), 'backend/index.js should exist');

    const indexJs = fse.readFileSync(path.join(projectDir, 'backend', 'index.js'), 'utf8');
    assert.ok(indexJs.includes('/api/health'), 'Hono backend should provide /api/health endpoint');

    const manifest = readManifest(projectDir);
    assert.ok(manifest, 'Manifest should exist');
    assert.strictEqual(manifest.frontend, 'solid');
    assert.strictEqual(manifest.backend, 'hono');
    assert.strictEqual(manifest.isFullstack, true);
    assert.strictEqual(manifest.generationMode, 'dynamic');

    console.log('✔ Auto-detection of dual-dynamic fullstack pairing (solid+hono) scaffolded successfully without --dynamic flag.\n');
  } finally {
    process.chdir(origCwd);
    fse.removeSync(tempDirDual);
  }

  console.log('[Test 8] Testing auto-detection of dynamic full-stack pairing (angular+rust)...');
  const tempDirAngularRust = path.join('/tmp', `rapidfire_test_angrust_${Date.now()}`);
  fse.ensureDirSync(tempDirAngularRust);
  process.chdir(tempDirAngularRust);

  try {
    const angrustFolder = 'my_angular_rust_app';
    await handleSetup(['angular+rust', angrustFolder]);

    const projectDir = path.join(tempDirAngularRust, angrustFolder);
    assert.ok(fse.existsSync(projectDir), 'Project root should exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'frontend')), 'frontend directory should exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'frontend', 'package.json')), 'frontend/package.json should exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'frontend', 'tsconfig.json')), 'frontend/tsconfig.json should exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'frontend', 'src', 'main.ts')), 'frontend/src/main.ts should exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'frontend', 'src', 'app', 'app.component.ts')), 'frontend/src/app/app.component.ts should exist');

    const fePkg = fse.readJsonSync(path.join(projectDir, 'frontend', 'package.json'));
    assert.ok(fePkg.dependencies && fePkg.dependencies['@angular/core'], 'Angular frontend must depend on @angular/core');

    assert.ok(fse.existsSync(path.join(projectDir, 'backend')), 'backend directory should exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'backend', 'Cargo.toml')), 'backend/Cargo.toml should exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'backend', 'src', 'main.rs')), 'backend/src/main.rs should exist');

    const cargoToml = fse.readFileSync(path.join(projectDir, 'backend', 'Cargo.toml'), 'utf8');
    assert.ok(cargoToml.includes('axum'), 'Rust backend must depend on axum');
    assert.ok(cargoToml.includes('tokio'), 'Rust backend must depend on tokio');

    const mainRs = fse.readFileSync(path.join(projectDir, 'backend', 'src', 'main.rs'), 'utf8');
    assert.ok(mainRs.includes('/api/health'), 'Rust backend should have /api/health route');
    assert.ok(mainRs.includes('CorsLayer'), 'Rust backend should configure CORS');

    const readme = fse.readFileSync(path.join(projectDir, 'README.md'), 'utf8');
    assert.ok(readme.includes('cargo run'), 'README must instruct user to run cargo run');

    const manifest = readManifest(projectDir);
    assert.ok(manifest, 'Manifest should exist');
    assert.strictEqual(manifest.frontend, 'angular');
    assert.strictEqual(manifest.backend, 'rust');
    assert.strictEqual(manifest.isFullstack, true);
    assert.strictEqual(manifest.generationMode, 'dynamic');

    console.log('✔ Auto-detection of dynamic fullstack pairing (angular+rust) scaffolded authentic Angular and Rust files.\n');
  } finally {
    process.chdir(origCwd);
    fse.removeSync(tempDirAngularRust);
  }

  console.log('======================================================');
  console.log('ALL DYNAMIC SCAFFOLDING TESTS PASSED FLAWLESSLY!');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('\x1b[31mTest failed:\x1b[0m', err);
  process.exit(1);
});
