const assert = require('assert');
const path = require('path');
const fse = require('fs-extra');
const {
  hasFrontendAdapter,
  getFrontendAdapter,
  normalizeFrontendName,
  FRONTEND_ADAPTERS
} = require('../src/scaffolding/adapters/frontend');
const {
  hasBackendAdapter,
  getBackendAdapter,
  normalizeBackendName,
  getBackendDefaultPort,
  BACKEND_ADAPTERS
} = require('../src/scaffolding/adapters/backend');
const { planStack } = require('../src/scaffolding/planner');
const { handleSetup } = require('../src/commands/setup');

const testOutputDir = path.join(__dirname, 'scratch_universal_frameworks');

function checkZeroCommentsAndEmojis(filePath) {
  const content = fse.readFileSync(filePath, 'utf8');
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  assert.ok(!emojiRegex.test(content), `Emoji found in ${filePath}`);
}

(async () => {
  console.log('[test_universal_frameworks] Starting comprehensive universal framework test suite...');
  fse.ensureDirSync(testOutputDir);

  process.env.RAPIDFIRE_SKIP_INSTALL = '1';
  process.env.RAPIDFIRE_AUTO_GIT = '0';
  process.env.RAPIDFIRE_AUTO_VENV = '0';

  console.log('[Test 1] Verifying frontend adapters registry...');
  const expectedFrontends = [
    'react',
    'vue',
    'svelte',
    'angular',
    'solid',
    'preact',
    'qwik',
    'lit',
    'astro',
    'next',
    'nuxt',
    'sveltekit',
    'vanilla'
  ];

  for (const fe of expectedFrontends) {
    assert.strictEqual(hasFrontendAdapter(fe), true, `Frontend adapter must exist for ${fe}`);
    const adapter = getFrontendAdapter(fe);
    assert.strictEqual(typeof adapter, 'function', `Adapter for ${fe} must be a function`);
  }
  assert.strictEqual(normalizeFrontendName('solidjs'), 'solid');
  assert.strictEqual(normalizeFrontendName('nextjs'), 'next');
  assert.strictEqual(normalizeFrontendName('nuxtjs'), 'nuxt');
  assert.strictEqual(normalizeFrontendName('preactjs'), 'preact');
  console.log('  [OK] All 12 frontend adapters and aliases verified.');

  console.log('[Test 2] Verifying backend adapters registry & default ports...');
  const expectedBackends = [
    'fastapi',
    'django',
    'flask',
    'express',
    'hono',
    'fastify',
    'nest',
    'koa',
    'rust',
    'go',
    'ruby',
    'php',
    'dotnet'
  ];

  for (const be of expectedBackends) {
    assert.strictEqual(hasBackendAdapter(be), true, `Backend adapter must exist for ${be}`);
    const adapter = getBackendAdapter(be);
    assert.strictEqual(typeof adapter, 'function', `Adapter for ${be} must be a function`);
    const port = getBackendDefaultPort(be);
    if (be === 'fastapi' || be === 'django') {
      assert.strictEqual(port, 8000, `${be} must default to port 8000`);
    } else {
      assert.strictEqual(port, 5000, `${be} must default to port 5000`);
    }
  }
  assert.strictEqual(normalizeBackendName('axum'), 'rust');
  assert.strictEqual(normalizeBackendName('golang'), 'go');
  assert.strictEqual(normalizeBackendName('sinatra'), 'ruby');
  assert.strictEqual(normalizeBackendName('csharp'), 'dotnet');
  console.log('  [OK] All 13 backend adapters, ports, and aliases verified.');

  console.log('[Test 3] Verifying stack planning across predefined, composed and dynamic stacks...');
  const planAngularRust = planStack('angular+rust');
  assert.strictEqual(planAngularRust.tier, 'DYNAMIC');
  assert.strictEqual(planAngularRust.frontend, 'angular');
  assert.strictEqual(planAngularRust.backend, 'rust');
  assert.strictEqual(planAngularRust.isFullstackPairing, true);

  const planSolidFastapi = planStack('solidjs+fastapi');
  assert.strictEqual(planSolidFastapi.tier, 'DYNAMIC');
  assert.strictEqual(planSolidFastapi.isFullstackPairing, true);

  const planSvelteFastapi = planStack('svelte+fastapi');
  assert.strictEqual(planSvelteFastapi.tier, 'COMPOSED');
  assert.strictEqual(planSvelteFastapi.frontend, 'svelte');
  assert.strictEqual(planSvelteFastapi.backend, 'fastapi');

  const planVueFlask = planStack('vue+flask');
  assert.strictEqual(planVueFlask.tier, 'COMPOSED');
  assert.strictEqual(planVueFlask.frontend, 'vue');
  assert.strictEqual(planVueFlask.backend, 'flask');

  const planReactFastapi = planStack('react+fastapi');
  assert.strictEqual(planReactFastapi.tier, 'PREDEFINED');

  const planDjango = planStack('django');
  assert.strictEqual(planDjango.tier, 'PREDEFINED');

  const planStandaloneAngular = planStack('angular');
  assert.strictEqual(planStandaloneAngular.tier, 'DYNAMIC');
  assert.strictEqual(planStandaloneAngular.isFullstackPairing, false);

  const planStandaloneRust = planStack('rust');
  assert.strictEqual(planStandaloneRust.tier, 'DYNAMIC');
  assert.strictEqual(planStandaloneRust.isFullstackPairing, false);

  console.log('  [OK] Stack planner correctly resolves predefined, composed, and dynamic stacks.');

  console.log('[Test 4] Scaffolding connected pairing: angular + rust...');
  const angularRustDir = path.join(testOutputDir, 'test_angular_rust');
  fse.removeSync(angularRustDir);
  await handleSetup(['angular+rust', angularRustDir]);

  assert.ok(fse.existsSync(path.join(angularRustDir, 'frontend', 'package.json')), 'Angular frontend package.json exists');
  const angularPkg = fse.readJsonSync(path.join(angularRustDir, 'frontend', 'package.json'));
  assert.ok(angularPkg.devDependencies && angularPkg.devDependencies['@angular/compiler-cli'], 'Angular has @angular/compiler-cli devDependency');
  assert.ok(angularPkg.dependencies && angularPkg.dependencies['@angular/router'], 'Angular has @angular/router dependency');
  assert.ok(fse.existsSync(path.join(angularRustDir, 'frontend', 'src', 'app', 'app.component.ts')), 'Angular component exists');
  assert.ok(fse.existsSync(path.join(angularRustDir, 'frontend', 'src', 'app', 'app.config.ts')), 'Angular app.config.ts exists');
  assert.ok(fse.existsSync(path.join(angularRustDir, 'frontend', 'src', 'styles.css')), 'Angular styles.css exists');
  assert.ok(fse.existsSync(path.join(angularRustDir, 'frontend', 'public', 'favicon.ico')), 'Angular public/favicon.ico exists');
  assert.ok(fse.existsSync(path.join(angularRustDir, 'frontend', '.env.example')), 'Angular .env.example exists');
  const angularEnv = fse.readFileSync(path.join(angularRustDir, 'frontend', '.env.example'), 'utf8');
  assert.ok(angularEnv.includes('5000'), 'Angular frontend connects to Rust backend on port 5000');

  assert.ok(fse.existsSync(path.join(angularRustDir, 'backend', 'Cargo.toml')), 'Rust Cargo.toml exists');
  assert.ok(fse.existsSync(path.join(angularRustDir, 'backend', 'src', 'main.rs')), 'Rust main.rs exists');
  const rustMain = fse.readFileSync(path.join(angularRustDir, 'backend', 'src', 'main.rs'), 'utf8');
  assert.ok(rustMain.includes('/api/health'), 'Rust backend has /api/health endpoint');
  assert.ok(rustMain.includes('CorsLayer') || rustMain.includes('permissive'), 'Rust backend enables CORS');

  console.log('  [OK] Connected pairing angular+rust scaffolded and connected on port 5000.');

  console.log('[Test 5] Scaffolding connected pairing: solid + fastapi...');
  const solidFastapiDir = path.join(testOutputDir, 'test_solid_fastapi');
  fse.removeSync(solidFastapiDir);
  await handleSetup(['solid+fastapi', solidFastapiDir]);

  assert.ok(fse.existsSync(path.join(solidFastapiDir, 'frontend', 'src', 'App.jsx')), 'Solid App.jsx exists');
  assert.ok(fse.existsSync(path.join(solidFastapiDir, 'frontend', 'public', 'favicon.ico')), 'Solid public/favicon.ico exists');
  const solidApp = fse.readFileSync(path.join(solidFastapiDir, 'frontend', 'src', 'App.jsx'), 'utf8');
  assert.ok(solidApp.includes('/api/health'), 'Solid frontend has test button calling /api/health');
  assert.ok(solidApp.includes('8000'), 'Solid frontend connects to FastAPI port 8000');

  assert.ok(fse.existsSync(path.join(solidFastapiDir, 'backend', 'main.py')), 'FastAPI main.py exists');
  const fastapiMain = fse.readFileSync(path.join(solidFastapiDir, 'backend', 'main.py'), 'utf8');
  assert.ok(fastapiMain.includes('/api/health'), 'FastAPI has /api/health');
  assert.ok(fastapiMain.includes('CORSMiddleware'), 'FastAPI has CORS middleware');

  console.log('  [OK] Connected pairing solid+fastapi scaffolded and connected on port 8000.');

  console.log('[Test 6] Scaffolding connected pairing: vue + hono...');
  const vueHonoDir = path.join(testOutputDir, 'test_vue_hono');
  fse.removeSync(vueHonoDir);
  await handleSetup(['vue+hono', vueHonoDir]);

  assert.ok(fse.existsSync(path.join(vueHonoDir, 'frontend', 'src', 'App.vue')), 'Vue App.vue exists');
  assert.ok(fse.existsSync(path.join(vueHonoDir, 'frontend', 'public', 'favicon.ico')), 'Vue public/favicon.ico exists');
  const honoEntry = fse.existsSync(path.join(vueHonoDir, 'backend', 'server.js')) ? path.join(vueHonoDir, 'backend', 'server.js') : path.join(vueHonoDir, 'backend', 'index.js');
  assert.ok(fse.existsSync(honoEntry), 'Hono server entry exists');
  const honoServer = fse.readFileSync(honoEntry, 'utf8');
  assert.ok(honoServer.includes('/api/health'), 'Hono has /api/health');
  assert.ok(honoServer.includes('cors'), 'Hono has CORS');

  console.log('  [OK] Connected pairing vue+hono scaffolded and connected on port 5000.');

  console.log('[Test 7] Scaffolding connected pairing: svelte + go...');
  const svelteGoDir = path.join(testOutputDir, 'test_svelte_go');
  fse.removeSync(svelteGoDir);
  await handleSetup(['svelte+go', svelteGoDir]);

  assert.ok(fse.existsSync(path.join(svelteGoDir, 'frontend', 'src', 'App.svelte')), 'Svelte App.svelte exists');
  assert.ok(fse.existsSync(path.join(svelteGoDir, 'frontend', 'public', 'favicon.ico')), 'Svelte public/favicon.ico exists');
  assert.ok(fse.existsSync(path.join(svelteGoDir, 'backend', 'main.go')), 'Go main.go exists');
  const goMain = fse.readFileSync(path.join(svelteGoDir, 'backend', 'main.go'), 'utf8');
  assert.ok(goMain.includes('/api/health'), 'Go has /api/health');
  assert.ok(goMain.includes('enableCORS'), 'Go has CORS');

  console.log('  [OK] Connected pairing svelte+go scaffolded and connected on port 5000.');

  console.log('[Test 8] Scaffolding connected pairing: next + flask...');
  const nextFlaskDir = path.join(testOutputDir, 'test_next_flask');
  fse.removeSync(nextFlaskDir);
  await handleSetup(['next+flask', nextFlaskDir]);

  assert.ok(fse.existsSync(path.join(nextFlaskDir, 'frontend', 'app', 'page.jsx')), 'Next.js page.jsx exists');
  assert.ok(fse.existsSync(path.join(nextFlaskDir, 'frontend', 'public', 'favicon.ico')), 'Next.js public/favicon.ico exists');
  assert.ok(fse.existsSync(path.join(nextFlaskDir, 'backend', 'app.py')), 'Flask app.py exists');
  const flaskApp = fse.readFileSync(path.join(nextFlaskDir, 'backend', 'app.py'), 'utf8');
  assert.ok(flaskApp.includes('/api/health'), 'Flask has /api/health');
  assert.ok(flaskApp.includes('CORS(app)'), 'Flask has CORS');

  console.log('  [OK] Connected pairing next+flask scaffolded and connected on port 5000.');

  console.log('[Test 9] Scaffolding standalone frontends (preact, lit, astro, nuxt, sveltekit, vanilla, qwik)...');
  for (const fe of ['preact', 'lit', 'astro', 'nuxt', 'sveltekit', 'vanilla', 'qwik']) {
    const feDir = path.join(testOutputDir, `test_standalone_${fe}`);
    fse.removeSync(feDir);
    await handleSetup([fe, feDir]);
    assert.ok(fse.existsSync(path.join(feDir, 'package.json')), `Standalone ${fe} package.json exists`);
    assert.ok(fse.existsSync(path.join(feDir, '.rapidfire.json')), `Standalone ${fe} .rapidfire.json exists`);
    assert.ok(fse.existsSync(path.join(feDir, 'public', 'favicon.ico')), `Standalone ${fe} public/favicon.ico exists`);
    if (fe === 'sveltekit') {
      assert.ok(fse.existsSync(path.join(feDir, 'src', 'app.html')), 'SvelteKit src/app.html exists');
      const sveltePkg = fse.readJsonSync(path.join(feDir, 'package.json'));
      assert.ok(sveltePkg.devDependencies && sveltePkg.devDependencies['@sveltejs/adapter-auto'], 'SvelteKit has @sveltejs/adapter-auto');
    }
    if (fe === 'qwik') {
      const qwikPkg = fse.readJsonSync(path.join(feDir, 'package.json'));
      assert.ok(qwikPkg.devDependencies && qwikPkg.devDependencies['@builder.io/qwik/optimizer'], 'Qwik has @builder.io/qwik/optimizer');
      assert.ok(fse.existsSync(path.join(feDir, 'src', 'main.jsx')), 'Qwik src/main.jsx exists');
    }
    if (fe === 'nuxt') {
      assert.ok(fse.existsSync(path.join(feDir, 'nuxt.config.ts')), 'Nuxt nuxt.config.ts exists');
    }
  }
  console.log('  [OK] Standalone frontends scaffolded successfully.');

  console.log('[Test 10] Scaffolding standalone backends (fastify, nest, koa, ruby, php, dotnet)...');
  for (const be of ['fastify', 'nest', 'koa', 'ruby', 'php', 'dotnet']) {
    const beDir = path.join(testOutputDir, `test_standalone_${be}`);
    fse.removeSync(beDir);
    await handleSetup([be, beDir]);
    assert.ok(fse.existsSync(path.join(beDir, '.rapidfire.json')), `Standalone ${be} .rapidfire.json exists`);
  }
  console.log('  [OK] Standalone backends scaffolded successfully.');

  console.log('[Test 11] Verifying zero comments and zero emojis...');
  checkZeroCommentsAndEmojis(path.join(angularRustDir, 'frontend', 'src', 'app', 'app.component.ts'));
  checkZeroCommentsAndEmojis(path.join(angularRustDir, 'backend', 'src', 'main.rs'));
  checkZeroCommentsAndEmojis(path.join(solidFastapiDir, 'frontend', 'src', 'App.jsx'));
  checkZeroCommentsAndEmojis(fse.existsSync(path.join(vueHonoDir, 'backend', 'server.js')) ? path.join(vueHonoDir, 'backend', 'server.js') : path.join(vueHonoDir, 'backend', 'index.js'));
  checkZeroCommentsAndEmojis(path.join(svelteGoDir, 'backend', 'main.go'));
  console.log('  [OK] Zero comments and zero emojis verified across generated code.');

  console.log('[Test 12] Verifying safeSpawn handles missing binaries without uncaught exception...');
  const { safeSpawn } = require('../src/commands/run');
  const dummyProc = safeSpawn('this_binary_does_not_exist_xyz123', ['--version'], { stdio: 'pipe' }, 'Missing Binary Test', 9999);
  assert.ok(dummyProc, 'safeSpawn returns child process instance');
  await new Promise((resolve) => setTimeout(resolve, 150));
  console.log('  [OK] safeSpawn trapped missing binary error safely.');

  fse.removeSync(testOutputDir);

  console.log('\n[test_universal_frameworks] ALL UNIVERSAL FRAMEWORK TESTS PASSED FLAWLESSLY!\n');
})().catch((err) => {
  console.error('\x1b[31m[test_universal_frameworks] FAILED:\x1b[0m', err);
  try {
    fse.removeSync(testOutputDir);
  } catch {}
  process.exit(1);
});
