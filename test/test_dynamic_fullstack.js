const assert = require('assert');
const path = require('path');
const os = require('os');
const fse = require('fs-extra');
const { planStack } = require('../src/scaffolding/planner');
const { getFallbackBlueprint } = require('../src/scaffolding/dynamicEngine');
const { handleSetup } = require('../src/commands/setup');
const { readManifest } = require('../src/utils/manifest');

console.log('--- TEST: DYNAMIC FULL-STACK SCAFFOLDING & CONNECTIVITY ---');

async function runTests() {
  console.log('[Test 1] Testing multi-part stack planning with database specs...');
  const planTwoPart = planStack('solid+fastapi');
  assert.strictEqual(planTwoPart.tier, 'DYNAMIC', 'Two-part unknown stack should be DYNAMIC');
  assert.strictEqual(planTwoPart.isFullstackPairing, true, 'isFullstackPairing should be true');
  assert.strictEqual(planTwoPart.frontend, 'solid');
  assert.strictEqual(planTwoPart.backend, 'fastapi');

  const planThreePart = planStack('react+express+sqlite');
  assert.strictEqual(planThreePart.tier, 'DYNAMIC', 'Three-part stack should be DYNAMIC');
  assert.strictEqual(planThreePart.isFullstackPairing, true, 'isFullstackPairing should be true');
  assert.strictEqual(planThreePart.frontend, 'react');
  assert.strictEqual(planThreePart.backend, 'express');
  assert.strictEqual(planThreePart.database, 'sqlite');

  const planPostgres = planStack('vue+hono+postgres');
  assert.strictEqual(planPostgres.tier, 'DYNAMIC');
  assert.strictEqual(planPostgres.database, 'postgres');
  console.log('[OK] Stack planning accurately handles multi-tier and database specifications.');

  console.log('[Test 2] Testing fallback full-stack blueprint generation...');
  const bpPython = getFallbackBlueprint('solid+fastapi+sqlite', 'demo_app');
  assert.ok(bpPython.summary.includes('Full-stack'), 'Blueprint summary should indicate full-stack');
  const filenames = bpPython.files.map(f => f.filename);
  assert.ok(filenames.includes('frontend/package.json'), 'Must contain frontend/package.json');
  assert.ok(filenames.includes('frontend/src/App.jsx'), 'Must contain frontend/src/App.jsx');
  assert.ok(filenames.includes('frontend/.env'), 'Must contain frontend/.env');
  assert.ok(filenames.includes('backend/main.py'), 'Must contain backend/main.py');
  assert.ok(filenames.includes('backend/.env'), 'Must contain backend/.env');

  const feApp = bpPython.files.find(f => f.filename === 'frontend/src/App.jsx');
  assert.ok(feApp.content.includes('/api/health'), 'Frontend must connect to backend health API');

  const beMain = bpPython.files.find(f => f.filename === 'backend/main.py');
  assert.ok(beMain.content.includes('CORSMiddleware'), 'Backend must configure CORS middleware');
  assert.ok(beMain.content.includes('http://localhost:3000'), 'Backend CORS must permit frontend origin');

  const bpNode = getFallbackBlueprint('svelte+express+postgres', 'demo_node_app');
  const nodeFilenames = bpNode.files.map(f => f.filename);
  assert.ok(nodeFilenames.includes('backend/server.js'), 'Must contain backend/server.js');
  const nodeServer = bpNode.files.find(f => f.filename === 'backend/server.js');
  assert.ok(nodeServer.content.includes('cors('), 'Express server must use cors');
  assert.ok(nodeServer.content.includes('/api/health'), 'Express server must expose /api/health');
  const bpNoDb = getFallbackBlueprint('solid+fastapi', 'no_db_app');
  assert.strictEqual(bpNoDb.summary.includes('database'), false, 'Should not mention database when no database is requested');
  const noDbEnv = bpNoDb.files.find(f => f.filename === 'backend/.env');
  assert.strictEqual(noDbEnv.content.includes('DATABASE_URL'), false, 'Should not set DATABASE_URL when no database is requested');
  console.log('[OK] Fallback full-stack blueprint provides pre-wired CORS, API client, and database configuration.');

  console.log('[Test 3] Testing live non-interactive scaffolding of dynamic full-stack stack...');
  const tempDir = path.join(os.tmpdir(), `rapidfire_test_fullstack_${Date.now()}`);
  fse.ensureDirSync(tempDir);
  const origCwd = process.cwd();
  process.chdir(tempDir);

  try {
    const folderName = 'dynamic_fullstack_app';
    process.env.RAPIDFIRE_AUTO_DYNAMIC = '1';
    process.env.RAPIDFIRE_SKIP_INSTALL = '1';
    process.env.RAPIDFIRE_AUTO_GIT = '0';

    await handleSetup(['solid+fastapi+sqlite', folderName, '--dynamic'], {
      ask: async () => 'n'
    });

    const projectDir = path.join(tempDir, folderName);
    assert.ok(fse.existsSync(projectDir), 'Project folder must exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'frontend')), 'frontend folder must exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'backend')), 'backend folder must exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'frontend', 'package.json')), 'frontend package.json must exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'frontend', '.env')), 'frontend .env must exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'backend', 'main.py')), 'backend main.py must exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'backend', '.env')), 'backend .env must exist');

    const manifest = readManifest(projectDir);
    assert.ok(manifest, 'Manifest must exist');
    assert.strictEqual(manifest.generationMode, 'dynamic');
    assert.strictEqual(manifest.recipe, 'solid+fastapi+sqlite');

    console.log('[OK] Live dynamic full-stack scaffolding completed with connected dual-tier structure.');
  } finally {
    delete process.env.RAPIDFIRE_AUTO_DYNAMIC;
    delete process.env.RAPIDFIRE_SKIP_INSTALL;
    delete process.env.RAPIDFIRE_AUTO_GIT;
    process.chdir(origCwd);
    fse.removeSync(tempDir);
  }

  console.log('\nALL DYNAMIC FULL-STACK CONNECTIVITY TESTS PASSED FLAWLESSLY!\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
