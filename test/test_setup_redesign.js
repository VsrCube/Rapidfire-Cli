const assert = require('assert');
const path = require('path');
const os = require('os');
const fse = require('fs-extra');
const { handleSetup } = require('../src/commands/setup');
const { readManifest } = require('../src/utils/manifest');

async function runTests() {
  console.log('=== TEST SUITE: REDESIGNED SETUP & DEFAULT FOLDER LOGIC ===\n');

  const tmpRoot = path.join(os.tmpdir(), `test_setup_redesign_${Date.now()}`);
  fse.ensureDirSync(tmpRoot);
  const origCwd = process.cwd();

  const origSkip = process.env.RAPIDFIRE_SKIP_INSTALL;
  const origSkipGh = process.env.RAPIDFIRE_SKIP_GH;
  process.env.RAPIDFIRE_SKIP_INSTALL = '1';
  process.env.RAPIDFIRE_SKIP_GH = '1';

  try {
    console.log('[Test 1] Testing setup WITHOUT folder name (defaults to current directory .)...');
    const projectDir = path.join(tmpRoot, 'my_auto_dir');
    fse.ensureDirSync(projectDir);
    process.chdir(projectDir);

    const startTime = Date.now();
    await handleSetup(['react+fastapi'], {
      ask: async () => 'n'
    });
    const duration = Date.now() - startTime;

    assert.ok(fse.existsSync(path.join(projectDir, 'frontend')), 'frontend folder must exist directly in current directory');
    assert.ok(fse.existsSync(path.join(projectDir, 'backend')), 'backend folder must exist directly in current directory');
    assert.ok(fse.existsSync(path.join(projectDir, 'frontend', 'package.json')), 'frontend/package.json must exist');
    assert.ok(fse.existsSync(path.join(projectDir, 'backend', 'main.py')), 'backend/main.py must exist');
    assert.ok(fse.existsSync(path.join(projectDir, '.rapidfire.json')), '.rapidfire.json must exist in current directory');

    const manifest = readManifest(projectDir);
    assert.strictEqual(manifest.frontend, 'react');
    assert.strictEqual(manifest.backend, 'fastapi');
    assert.strictEqual(manifest.folderName, 'my_auto_dir');

    console.log(`  [OK] Default current directory setup passed in ${duration}ms!`);
    assert.ok(duration < 1000, `Setup must be faster than 1s, took ${duration}ms`);

    console.log('[Test 2] Testing proper frontend-backend connection...');
    const feApp = fse.readFileSync(path.join(projectDir, 'frontend', 'src', 'App.jsx'), 'utf8');
    assert.ok(feApp.includes('/api/health'), 'Frontend must query /api/health');
    assert.ok(feApp.includes('Backend Microservice Connected') || feApp.includes('testBackendApi'), 'Frontend must have connection test widget');

    const beMain = fse.readFileSync(path.join(projectDir, 'backend', 'main.py'), 'utf8');
    assert.ok(beMain.includes('CORSMiddleware'), 'Backend must configure CORS middleware');
    assert.ok(beMain.includes('/api/health'), 'Backend must expose /api/health route');
    console.log('  [OK] Frontend and backend properly connected with CORS and health endpoints.');

    console.log('[Test 3] Testing inverted stack handling (fastapi+react)...');
    const invertedDir = path.join(tmpRoot, 'my_inverted_app');
    fse.ensureDirSync(invertedDir);
    process.chdir(invertedDir);

    await handleSetup(['fastapi+react', 'app_inverted'], {
      ask: async () => 'n'
    });

    const targetInverted = path.join(invertedDir, 'app_inverted');
    assert.ok(fse.existsSync(path.join(targetInverted, 'frontend', 'package.json')), 'Frontend must be react');
    assert.ok(fse.existsSync(path.join(targetInverted, 'backend', 'main.py')), 'Backend must be fastapi');
    const invertedManifest = readManifest(targetInverted);
    assert.strictEqual(invertedManifest.frontend, 'react');
    assert.strictEqual(invertedManifest.backend, 'fastapi');
    console.log('  [OK] Inverted stack correctly normalized to frontend and backend.');

    console.log('[Test 4] Testing incompatible pairing guard (two frontends react+vue)...');
    const res = await handleSetup(['react+vue', 'invalid_pair']);
    assert.strictEqual(res && res.success, false, 'Should reject two frontends');
    assert.ok(!fse.existsSync(path.join(invertedDir, 'invalid_pair')), 'Invalid folder should not be created');
    console.log('  [OK] Incompatible frontend+frontend pairing cleanly rejected.');

    console.log('[Test 5] Testing active .env creation in frontend...');
    const feEnvPath = path.join(projectDir, 'frontend', '.env');
    assert.ok(fse.existsSync(feEnvPath), 'frontend/.env must exist');
    const feEnvContent = fse.readFileSync(feEnvPath, 'utf8');
    assert.ok(feEnvContent.includes('VITE_API_URL='), 'frontend/.env must define VITE_API_URL');
    console.log('  [OK] Active frontend .env file exists and contains API URL.');

    console.log('[Test 6] Testing collision overwrite rejection when user answers n...');
    const collDir = path.resolve(process.cwd(), 'collision_test_dir');
    fse.ensureDirSync(collDir);
    fse.writeFileSync(path.join(collDir, 'sentinel.txt'), 'do_not_touch', 'utf8');
    const rejRes = await handleSetup(['angular+axum', 'collision_test_dir'], {
      ask: async () => 'n'
    });
    assert.strictEqual(rejRes && rejRes.success, false, 'Collision with n must abort');
    assert.strictEqual(fse.readFileSync(path.join(collDir, 'sentinel.txt'), 'utf8'), 'do_not_touch', 'Sentinel file must not be modified');
    console.log('  [OK] Collision rejection preserved directory intact.');

    console.log('[Test 7] Testing collision overwrite acceptance when user answers y...');
    await handleSetup(['angular+axum', 'collision_test_dir'], {
      ask: async () => 'y'
    });
    assert.ok(!fse.existsSync(path.join(collDir, 'sentinel.txt')), 'Sentinel file should be cleared on overwrite');
    assert.ok(fse.existsSync(path.join(collDir, 'frontend', 'package.json')), 'Angular frontend must be scaffolded');
    assert.ok(fse.existsSync(path.join(collDir, 'backend', 'Cargo.toml')), 'Axum backend must be scaffolded');
    assert.ok(fse.existsSync(path.join(collDir, 'frontend', '.env')), 'Angular frontend .env must exist');
    console.log('  [OK] Collision overwrite cleanly re-scaffolded angular+axum.');

    console.log('[Test 8] Testing --force overwrite flag without prompt...');
    fse.writeFileSync(path.join(collDir, 'sentinel2.txt'), 'force_test', 'utf8');
    await handleSetup(['vue+express', 'collision_test_dir', '--force'], {});
    assert.ok(!fse.existsSync(path.join(collDir, 'sentinel2.txt')), 'Sentinel2 file cleared with --force');
    assert.ok(fse.existsSync(path.join(collDir, 'frontend', 'src', 'App.vue')), 'Vue frontend scaffolded with --force');
    assert.ok(fse.existsSync(path.join(collDir, 'backend', 'server.js')), 'Express backend scaffolded with --force');
    console.log('  [OK] --force flag successfully overwrote existing directory.');

    console.log('[Test 9] Testing frontend and backend port detection on scaffolded fullstack project...');
    const { detectProject } = require('../src/runner/detector');
    const detectedPlan = detectProject(collDir);
    assert.strictEqual(detectedPlan.type, 'fullstack', 'Should be detected as fullstack');
    assert.strictEqual(detectedPlan.frontend.defaultPort, 3000, 'Frontend port must be 3000');
    assert.strictEqual(detectedPlan.backend.defaultPort, 5000, 'Backend port must be 5000');
    console.log('  [OK] Synchronized frontend (3000) and backend (5000) port detection verified.');

    console.log('[Test 10] Testing unified Git and GitHub prompt with default Enter acceptance...');
    const { setupGitAndGithub } = require('../src/utils/gitContext');
    const test10Dir = path.join(tmpRoot, 'test_git_defaults');
    fse.ensureDirSync(test10Dir);
    const answers10 = ['y', '', ''];
    let idx10 = 0;
    const res10 = await setupGitAndGithub(test10Dir, 'test_git_defaults', {
      ask: async () => answers10[idx10++]
    });
    assert.strictEqual(res10.initialized, true, 'Git should be initialized');
    assert.strictEqual(res10.repoName, 'test_git_defaults', 'Repo name should default to folder name on Enter');
    assert.strictEqual(res10.isPublic, true, 'Visibility should default to public on Enter');
    assert.ok(fse.existsSync(path.join(test10Dir, '.git')), '.git directory must exist');
    assert.ok(fse.existsSync(path.join(test10Dir, '.git', 'hooks', 'pre-push')), 'Security hook must exist');
    console.log('  [OK] Default Enter on repo name and visibility verified.');

    console.log('[Test 11] Testing unified Git prompt with custom name and private visibility...');
    const test11Dir = path.join(tmpRoot, 'test_git_custom');
    fse.ensureDirSync(test11Dir);
    const answers11 = ['y', 'custom-repo-name', 'n'];
    let idx11 = 0;
    const res11 = await setupGitAndGithub(test11Dir, 'test_git_custom', {
      ask: async () => answers11[idx11++]
    });
    assert.strictEqual(res11.initialized, true, 'Git should be initialized');
    assert.strictEqual(res11.repoName, 'custom-repo-name', 'Repo name should be custom-repo-name');
    assert.strictEqual(res11.isPublic, false, 'Visibility should be private');
    console.log('  [OK] Custom repo name and private visibility verified.');

    console.log('[Test 12] Testing unified Git prompt with local only option...');
    const test12Dir = path.join(tmpRoot, 'test_git_local');
    fse.ensureDirSync(test12Dir);
    let askedSubsequent12 = false;
    const res12 = await setupGitAndGithub(test12Dir, 'test_git_local', {
      ask: async (q) => {
        if (q.includes('GitHub repository name') || q.includes('public')) {
          askedSubsequent12 = true;
        }
        return 'local';
      }
    });
    assert.strictEqual(res12.initialized, true, 'Git should be initialized for local');
    assert.strictEqual(askedSubsequent12, false, 'Should not prompt for GitHub when local is chosen');
    assert.ok(fse.existsSync(path.join(test12Dir, '.git')), '.git directory must exist for local');
    console.log('  [OK] Local only option verified.');

    console.log('[Test 13] Testing unified Git prompt rejection with n...');
    const test13Dir = path.join(tmpRoot, 'test_git_rejected');
    fse.ensureDirSync(test13Dir);
    const res13 = await setupGitAndGithub(test13Dir, 'test_git_rejected', {
      ask: async () => 'n'
    });
    assert.strictEqual(res13.initialized, false, 'Git should not be initialized when rejected');
    assert.ok(!fse.existsSync(path.join(test13Dir, '.git')), '.git directory must not exist when rejected');
    console.log('  [OK] Unified rejection verified.');

    console.log('\nALL REDESIGNED SETUP TESTS PASSED CLEANLY!\n');
  } finally {
    if (origSkip !== undefined) {
      process.env.RAPIDFIRE_SKIP_INSTALL = origSkip;
    } else {
      delete process.env.RAPIDFIRE_SKIP_INSTALL;
    }
    if (origSkipGh !== undefined) {
      process.env.RAPIDFIRE_SKIP_GH = origSkipGh;
    } else {
      delete process.env.RAPIDFIRE_SKIP_GH;
    }
    process.chdir(origCwd);
    fse.removeSync(tmpRoot);
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
