const path = require('path');
const fse = require('fs-extra');
const { commandExists, run, checkPrerequisites, createVirtualEnvironment } = require('../utils/proc');
const { isDirEmpty } = require('../utils/fsHelpers');
const { writeManifest } = require('../utils/manifest');
const { installPrePushHook } = require('../integrations/gitleaks');
const { isGhInstalled, isGhAuthenticated, createRepo } = require('../integrations/gh');
const { planStack } = require('../scaffolding/planner');
const { scaffoldDynamicFramework } = require('../scaffolding/dynamicEngine');
const { getParentGitRepo, promptConfirmation, promptInput, setupGitAndGithub } = require('../utils/gitContext');
const { getFrontendAdapter, hasFrontendAdapter, normalizeFrontendName } = require('../scaffolding/adapters/frontend');
const { getBackendAdapter, hasBackendAdapter, normalizeBackendName, getBackendDefaultPort } = require('../scaffolding/adapters/backend');

const LTS_VERSIONS = {
  react: '^18.3.1',
  django: 'Django>=4.2,<6.0',
  express: '^4.21.2'
};

async function initGitAndHooks(projectPath, targetFolder, context = {}) {
  return await setupGitAndGithub(projectPath, targetFolder, context);
}

function terminateExistingServers() {
  try {
    const { freeKnownPorts, stopProcesses } = require('../runner/processManager');
    stopProcesses();
    freeKnownPorts([3000, 3001, 4200, 5000, 5173, 8000]);
  } catch {}
}

async function ensureTargetDirectoryReady(projectPath, targetFolder, isCurrentDir, isFullstack, args = [], context = {}) {
  const forceFlag = args.includes('--force') || args.includes('-f') || process.env.RAPIDFIRE_FORCE_OVERWRITE === '1';

  if (!isCurrentDir) {
    if (fse.existsSync(projectPath) && !isDirEmpty(projectPath)) {
      if (forceFlag) {
        console.log(`[rapidfire] Target directory '${targetFolder}' is not empty. Overwriting (--force)...`);
        terminateExistingServers();
        fse.emptyDirSync(projectPath);
        return true;
      }

      const promptText = `Target directory '${targetFolder}' already exists and is not empty. Overwrite and re-scaffold? [y/N]: `;
      let answer = 'n';
      if (context && typeof context.ask === 'function') {
        answer = await context.ask(promptText);
      } else if (context && context.rl) {
        answer = await new Promise((resolve) => {
          context.rl.question(promptText, (ans) => resolve(ans));
        });
      } else if (process.stdin.isTTY && process.env.RAPIDFIRE_SKIP_INSTALL !== '1') {
        const readline = require('readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        answer = await new Promise((resolve) => {
          rl.question(promptText, (ans) => {
            rl.close();
            resolve(ans);
          });
        });
      }

      if (answer && answer.trim().toLowerCase().startsWith('y')) {
        console.log(`[rapidfire] Overwriting '${targetFolder}'...`);
        terminateExistingServers();
        fse.emptyDirSync(projectPath);
        return true;
      }

      console.error(`\x1b[31m[rapidfire] Error: Target directory '${targetFolder}' already exists and is not empty. Use --force to overwrite.\x1b[0m`);
      return false;
    }
    return true;
  }

  if (isFullstack) {
    const feDir = path.join(projectPath, 'frontend');
    const beDir = path.join(projectPath, 'backend');
    const hasSubdirs = (fse.existsSync(feDir) && !isDirEmpty(feDir)) || (fse.existsSync(beDir) && !isDirEmpty(beDir));
    if (hasSubdirs) {
      if (forceFlag) {
        console.log(`[rapidfire] 'frontend' or 'backend' directory already exists. Overwriting (--force)...`);
        terminateExistingServers();
        if (fse.existsSync(feDir)) fse.emptyDirSync(feDir);
        if (fse.existsSync(beDir)) fse.emptyDirSync(beDir);
        return true;
      }

      const promptText = `'frontend' or 'backend' directory already exists in the current folder. Overwrite? [y/N]: `;
      let answer = 'n';
      if (context && typeof context.ask === 'function') {
        answer = await context.ask(promptText);
      } else if (context && context.rl) {
        answer = await new Promise((resolve) => {
          context.rl.question(promptText, (ans) => resolve(ans));
        });
      } else if (process.stdin.isTTY && process.env.RAPIDFIRE_SKIP_INSTALL !== '1') {
        const readline = require('readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        answer = await new Promise((resolve) => {
          rl.question(promptText, (ans) => {
            rl.close();
            resolve(ans);
          });
        });
      }

      if (answer && answer.trim().toLowerCase().startsWith('y')) {
        console.log(`[rapidfire] Overwriting 'frontend' and 'backend'...`);
        terminateExistingServers();
        if (fse.existsSync(feDir)) fse.emptyDirSync(feDir);
        if (fse.existsSync(beDir)) fse.emptyDirSync(beDir);
        return true;
      }

      console.error(`\x1b[31m[rapidfire] Error: 'frontend' or 'backend' directory already exists in the current folder. Use --force to overwrite.\x1b[0m`);
      return false;
    }
  }

  return true;
}

async function maybePromptForVenv(pythonDir, context) {
  if (!pythonDir || !fse.existsSync(pythonDir)) return;

  const promptText = `Would you like to set up a virtual environment (venv)? [Y/n]: `;

  let answer = 'y';
  if (process.env.RAPIDFIRE_AUTO_VENV === '1') {
    answer = 'y';
  } else if (process.env.RAPIDFIRE_AUTO_VENV === '0') {
    answer = 'n';
  } else if (context && typeof context.ask === 'function') {
    answer = await context.ask(promptText);
  } else if (context && context.rl) {
    answer = await new Promise((resolve) => {
      context.rl.question(promptText, (ans) => resolve(ans));
    });
  } else if (process.stdin.isTTY && process.env.RAPIDFIRE_SKIP_INSTALL !== '1') {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    answer = await new Promise((resolve) => {
      rl.question(promptText, (ans) => {
        rl.close();
        resolve(ans);
      });
    });
  } else {
    answer = 'n';
  }

  const shouldCreate = !answer || answer.trim() === '' || answer.trim().toLowerCase().startsWith('y');

  if (shouldCreate) {
    console.log(`[rapidfire] Creating Python virtual environment in ${pythonDir}...`);
    const res = createVirtualEnvironment(pythonDir);
    if (res.success) {
      console.log(`\x1b[32m[OK] Virtual environment created at ${res.venvPath}\x1b[0m`);
      console.log(`  To activate: \x1b[36m${res.activateCmd}\x1b[0m`);
      const reqPath = path.join(pythonDir, 'requirements.txt');
      if (fse.existsSync(reqPath) && process.env.RAPIDFIRE_SKIP_INSTALL !== '1') {
        console.log(`[rapidfire] Installing Python dependencies into virtual environment...`);
        const isWindows = process.platform === 'win32';
        const pipCmd = isWindows ? path.join(res.venvPath, 'Scripts', 'pip.exe') : path.join(res.venvPath, 'bin', 'pip');
        const pyCmd = isWindows ? path.join(res.venvPath, 'Scripts', 'python.exe') : path.join(res.venvPath, 'bin', 'python');
        try {
          run(`"${pipCmd}" install -r "${reqPath}"`, { cwd: pythonDir, stdio: 'pipe' });
          console.log(`\x1b[32m[OK] Python dependencies installed successfully.\x1b[0m`);
          if (fse.existsSync(path.join(pythonDir, 'manage.py'))) {
            try {
              run(`"${pyCmd}" manage.py migrate`, { cwd: pythonDir, stdio: 'pipe' });
            } catch {}
          }
        } catch (err) {
          console.warn('\x1b[33m[rapidfire] pip install notice:\x1b[0m', err.message);
        }
      }
    } else {
      console.log(`\x1b[33m[WARN] Could not create virtual environment: ${res.error}\x1b[0m`);
    }
  } else {
    console.log(`[rapidfire] Skipped venv creation.`);
  }
}

async function maybePromptForGithubRepo() {
  return;
}

function checkRuntimePrerequisites(stack) {
  const norm = stack.toLowerCase();
  const tokens = norm.split('+');
  if (tokens.includes('django') && !commandExists('django-admin')) {
    console.error('[rapidfire] Missing required tool: django-admin (pip install django)');
    return false;
  }
  const isPython = tokens.some(t => ['fastapi', 'django', 'flask', 'python', 'py'].includes(t));
  if (isPython && !commandExists('python3') && !commandExists('python')) {
    console.warn('\x1b[33m[rapidfire] Warning: Python 3 was not detected in PATH.\x1b[0m');
  }
  const isRust = tokens.some(t => ['rust', 'axum', 'actix', 'cargo'].includes(t));
  if (isRust && !commandExists('cargo')) {
    console.warn('\x1b[33m[rapidfire] Warning: Rust (\'cargo\') was not found in PATH.\x1b[0m');
  }
  const isGo = tokens.some(t => ['go', 'gin', 'fiber', 'golang'].includes(t));
  if (isGo && !commandExists('go')) {
    console.warn('\x1b[33m[rapidfire] Warning: Go was not found in PATH.\x1b[0m');
  }
  const isDotnet = tokens.some(t => ['dotnet', 'csharp', 'cs', '.net'].includes(t));
  if (isDotnet && !commandExists('dotnet')) {
    console.warn('\x1b[33m[rapidfire] Warning: .NET SDK (\'dotnet\') was not found in PATH.\x1b[0m');
  }
  return true;
}

async function handleSetup(args = [], context = {}) {
  const stack = args[0]?.toLowerCase();
  let targetFolder = args[1];

  if (!stack) {
    console.log('\x1b[33m[rapidfire] Usage: setup <stack> [folder-name]\x1b[0m');
    console.log('Examples:');
    console.log('  • setup react+fastapi my-app');
    console.log('  • setup react+fastapi          (scaffold directly into current folder)');
    console.log('  • setup vue+express');
    console.log('  • setup angular+rust');
    console.log('  • setup react');
    console.log('  • setup fastapi');
    return;
  }

  const isCurrentDir = !targetFolder || targetFolder === '.' || targetFolder === './';
  const projectPath = isCurrentDir ? process.cwd() : path.resolve(process.cwd(), targetFolder);
  const displayFolderName = isCurrentDir ? path.basename(projectPath) : targetFolder;

  const plan = planStack(stack);

  if (plan.tier === 'PREDEFINED' || plan.tier === 'COMPOSED') {
    const requiresNode = stack.includes('react') || stack.includes('vue') || stack.includes('svelte') || stack.includes('node');
    const requiresPython = stack.includes('fastapi') || stack.includes('django') || stack.includes('flask');
    const requiresDjango = stack.includes('django');

    const prereqCheck = checkPrerequisites({ requiresNode, requiresPython, requiresDjango });
    if (!prereqCheck.ok) {
      console.error(`\n\x1b[31m[rapidfire] Missing required prerequisites to scaffold '${stack}':\x1b[0m ${prereqCheck.missing.join(', ')}`);
      console.log(`\n\x1b[1mInstallation instructions for your system:\x1b[0m\n${prereqCheck.instructions}\n`);
      return { success: false, missing: prereqCheck.missing };
    }
  }

  if (stack.includes('+')) {
    let [rawFe, rawBe] = stack.split('+');
    let normFe = normalizeFrontendName(rawFe);
    let normBe = normalizeBackendName(rawBe);

    if (hasFrontendAdapter(normFe) && hasFrontendAdapter(normBe)) {
      console.error(`\x1b[31m[rapidfire] Error: Cannot pair two frontends together ('${stack}'). Please specify a frontend + backend pairing.\x1b[0m`);
      return { success: false, error: 'INVALID_PAIRING' };
    }
    if (hasBackendAdapter(normFe) && hasBackendAdapter(normBe)) {
      console.error(`\x1b[31m[rapidfire] Error: Cannot pair two backends together ('${stack}'). Please specify a frontend + backend pairing.\x1b[0m`);
      return { success: false, error: 'INVALID_PAIRING' };
    }

    if (hasBackendAdapter(normFe) && hasFrontendAdapter(normBe)) {
      const tmpNorm = normFe;
      normFe = normBe;
      normBe = tmpNorm;
      const tmpRaw = rawFe;
      rawFe = rawBe;
      rawBe = tmpRaw;
    }

    const ready = await ensureTargetDirectoryReady(projectPath, targetFolder, isCurrentDir, true, args, context);
    if (!ready) {
      return { success: false, error: 'TARGET_EXISTS' };
    }

    if (hasFrontendAdapter(normFe) && hasBackendAdapter(normBe)) {
      if (!checkRuntimePrerequisites(normBe)) return;
      await setupFullstack(projectPath, displayFolderName, rawFe, rawBe, context, isCurrentDir, targetFolder);
      return;
    }
  }

  const ready = await ensureTargetDirectoryReady(projectPath, targetFolder, isCurrentDir, false, args, context);
  if (!ready) {
    return { success: false, error: 'TARGET_EXISTS' };
  }

  if (plan.tier === 'DYNAMIC') {
    console.log(`\x1b[36m[rapidfire] Auto-detected dynamic stack '${stack}'. Scaffolding project...\x1b[0m`);
    return await scaffoldDynamicFramework(projectPath, displayFolderName, plan, context);
  }

  if (plan.type === 'standalone_frontend' || hasFrontendAdapter(stack)) {
    await setupStandaloneFrontend(projectPath, displayFolderName, plan.stack || stack, context);
    return;
  }

  if (plan.type === 'standalone_backend' || hasBackendAdapter(stack)) {
    if (!checkRuntimePrerequisites(stack)) return;
    await setupStandaloneBackend(projectPath, displayFolderName, plan.stack || stack, context);
    return;
  }

  console.error(`\x1b[31m[rapidfire] Unknown recipe '${stack}'.\x1b[0m`);
  console.log('Type "help" to see all supported framework recipes.');
}

function getBackendRunInstruction(normBe, port) {
  switch (normBe) {
    case 'rust':
      return 'cargo run';
    case 'go':
      return 'go run .';
    case 'fastapi':
      return `uvicorn main:app --reload --port ${port}`;
    case 'django':
      return `python manage.py runserver ${port}`;
    case 'flask':
      return 'python app.py';
    case 'ruby':
      return 'ruby app.rb';
    case 'php':
      return `php -S localhost:${port} router.php`;
    case 'dotnet':
      return 'dotnet run';
    default:
      return 'npm start';
  }
}

async function setupFullstack(projectPath, displayFolderName, frontend, backend, context = {}, isCurrentDir = false, targetFolder = null) {
  const normFe = normalizeFrontendName(frontend);
  const normBe = normalizeBackendName(backend);
  const feAdapter = getFrontendAdapter(normFe);
  const beAdapter = getBackendAdapter(normBe);

  if (!feAdapter) {
    console.error(`\x1b[31m[rapidfire] Unknown frontend: '${frontend}'.\x1b[0m`);
    return;
  }
  if (!beAdapter) {
    console.error(`\x1b[31m[rapidfire] Unknown backend: '${backend}'.\x1b[0m`);
    return;
  }

  fse.ensureDirSync(projectPath);

  const fePathDisplay = isCurrentDir ? 'frontend' : path.join(targetFolder || displayFolderName, 'frontend');
  const bePathDisplay = isCurrentDir ? 'backend' : path.join(targetFolder || displayFolderName, 'backend');

  console.log(`\n\x1b[36m[rapidfire] Setting up ${normFe}+${normBe} in ${displayFolderName}...\x1b[0m`);
  console.log(`  • Frontend (${normFe}): ${fePathDisplay}`);
  console.log(`  • Backend (${normBe}):  ${bePathDisplay}\n`);

  const backendPort = getBackendDefaultPort(normBe);
  const frontendDir = path.join(projectPath, 'frontend');
  feAdapter(frontendDir, { port: 3000, apiPort: backendPort, isStandalone: false, appName: displayFolderName });

  const backendDir = path.join(projectPath, 'backend');
  beAdapter(backendDir, displayFolderName, { port: backendPort, isStandalone: false });

  fse.writeFileSync(path.join(projectPath, '.gitignore'), `node_modules/\ndist/\n.env\n__pycache__/\n*.pyc\nvenv/\n.venv/\ntarget/\nbin/\nobj/\n`, 'utf8');

  fse.writeFileSync(path.join(projectPath, 'README.md'), `# ${displayFolderName}
Scaffolded with RapidFire CLI (\`setup ${frontend}+${backend}\`).

## Frontend (${normFe.toUpperCase()})
\`\`\`bash
cd frontend
npm run dev
\`\`\`

## Backend (${normBe.toUpperCase()})
\`\`\`bash
cd backend
${getBackendRunInstruction(normBe, backendPort)}
\`\`\`
`, 'utf8');

  const stackPlan = planStack(`${frontend}+${backend}`);
  let generationMode = 'composed';
  if (stackPlan.tier === 'PREDEFINED') {
    generationMode = 'predefined';
  } else if (stackPlan.tier === 'DYNAMIC') {
    generationMode = 'dynamic';
  }

  writeManifest(projectPath, {
    frontend: frontend === 'node' ? 'node' : (normFe || frontend),
    backend: backend === 'node' ? 'node' : (normBe || backend),
    folderName: displayFolderName,
    isFullstack: true,
    generationMode
  });

  await setupGitAndGithub(projectPath, displayFolderName, context);

  if (['fastapi', 'django', 'flask'].includes(normBe)) {
    await maybePromptForVenv(backendDir, context);
  }

  reportSuccess(displayFolderName, `${normFe}+${normBe}`);
}

async function setupStandaloneBackend(projectPath, displayFolderName, backend, context = {}) {
  const normBe = normalizeBackendName(backend);
  const beAdapter = getBackendAdapter(normBe);
  if (!beAdapter) {
    console.error(`\x1b[31m[rapidfire] Unknown backend: '${backend}'.\x1b[0m`);
    return;
  }

  fse.ensureDirSync(projectPath);
  console.log(`\n\x1b[36m[rapidfire] Setting up standalone ${normBe} in ${displayFolderName}...\x1b[0m\n`);
  const backendPort = getBackendDefaultPort(normBe);
  beAdapter(projectPath, displayFolderName, { port: backendPort, isStandalone: true });
  fse.writeFileSync(path.join(projectPath, '.gitignore'), `__pycache__/\n*.pyc\nvenv/\n.venv/\n.env\ntarget/\nnode_modules/\nbin/\nobj/\n`, 'utf8');
  writeManifest(projectPath, { frontend: null, backend: normBe, folderName: displayFolderName });
  await setupGitAndGithub(projectPath, displayFolderName, context);

  if (['fastapi', 'django', 'flask'].includes(normBe)) {
    await maybePromptForVenv(projectPath, context);
  }

  reportSuccess(displayFolderName, normBe);
}

async function setupStandaloneFrontend(projectPath, displayFolderName, frontend, context = {}) {
  const normFe = normalizeFrontendName(frontend);
  const feAdapter = getFrontendAdapter(normFe);
  if (!feAdapter) {
    console.error(`\x1b[31m[rapidfire] Unknown frontend: '${frontend}'.\x1b[0m`);
    return;
  }
  fse.ensureDirSync(projectPath);
  console.log(`\n\x1b[36m[rapidfire] Setting up standalone ${normFe} in ${displayFolderName}...\x1b[0m\n`);
  feAdapter(projectPath, { port: 3000, isStandalone: true, appName: displayFolderName });
  fse.writeFileSync(path.join(projectPath, '.gitignore'), `node_modules/\ndist/\n.env\n`, 'utf8');
  writeManifest(projectPath, { frontend: normFe, backend: null, folderName: displayFolderName });
  await setupGitAndGithub(projectPath, displayFolderName, context);

  reportSuccess(displayFolderName, normFe);
}

function reportSuccess(folderName, stack) {
  console.log(`\n\x1b[32m╔════════════════════════════════════════════════════╗\x1b[0m`);
  console.log(`\x1b[32m║  Project '${folderName}' (${stack}) ready!  ║\x1b[0m`);
  console.log(`\x1b[32m╚════════════════════════════════════════════════════╝\x1b[0m\n`);
}

module.exports = {
  handleSetup,
  initGitAndHooks,
  setupGitAndGithub,
  maybePromptForVenv,
  maybePromptForGithubRepo
};
