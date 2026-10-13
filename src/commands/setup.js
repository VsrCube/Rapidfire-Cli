const path = require('path');
const fse = require('fs-extra');
const { commandExists, run, getDjangoAdminCmd, createVirtualEnvironment, checkPrerequisites } = require('../utils/proc');
const { isDirEmpty } = require('../utils/fsHelpers');
const { writeManifest } = require('../utils/manifest');
const { installPrePushHook } = require('../integrations/gitleaks');
const { isGhInstalled, isGhAuthenticated, createRepo } = require('../integrations/gh');
const { isVercelInstalled } = require('../integrations/vercel');
const { planStack } = require('../scaffolding/planner');
const { scaffoldDynamicFramework } = require('../scaffolding/dynamicEngine');
const { getParentGitRepo, promptConfirmation } = require('../utils/gitContext');

function scaffoldViteReact(frontendDir) {
  fse.ensureDirSync(frontendDir);
  console.log(`[rapidfire] Scaffolding React (Vite) frontend in ${frontendDir}...`);

  try {
    run(`npx --yes degit vitejs/vite/packages/create-vite/template-react "${frontendDir}"`, {
      stdio: 'pipe'
    });
  } catch {
    console.log('[rapidfire] Using built-in clean Vite React template...');
    scaffoldViteReactFallback(frontendDir);
  }

  console.log('[rapidfire] Installing React frontend dependencies...');
  run('npm install', { cwd: frontendDir, stdio: 'pipe' });
  console.log('[rapidfire] React frontend ready.');
}

function scaffoldViteReactFallback(frontendDir) {
  const pkgJson = {
    name: 'frontend',
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
    dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
    devDependencies: { '@vitejs/plugin-react': '^4.3.4', vite: '^5.4.11' }
  };
  fse.writeJsonSync(path.join(frontendDir, 'package.json'), pkgJson, { spaces: 2 });
  fse.writeFileSync(path.join(frontendDir, 'vite.config.js'), `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], server: { port: 3000 } });
`, 'utf8');
  fse.writeFileSync(path.join(frontendDir, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><title>Rapidfire React</title></head>
<body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>
`, 'utf8');
  const srcDir = path.join(frontendDir, 'src');
  fse.ensureDirSync(srcDir);
  fse.writeFileSync(path.join(srcDir, 'index.css'), `body { margin: 0; background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; display: flex; min-height: 100vh; align-items: center; justify-content: center; }`, 'utf8');
  fse.writeFileSync(path.join(srcDir, 'App.jsx'), `import React, { useState } from 'react';
export default function App() {
  const [count, setCount] = useState(0);
  return (
    <div style={{ textAlign: 'center' }}>
      <h1>Rapidfire React App</h1>
      <button style={{ padding: '0.6rem 1.2rem', borderRadius: '6px', background: '#38bdf8', border: 'none', fontWeight: 'bold' }} onClick={() => setCount(c => c + 1)}>Count: {count}</button>
    </div>
  );
}
`, 'utf8');
  fse.writeFileSync(path.join(srcDir, 'main.jsx'), `import React from 'react'; import ReactDOM from 'react-dom/client'; import App from './App'; import './index.css';
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
`, 'utf8');
}

function scaffoldViteVue(frontendDir) {
  fse.ensureDirSync(frontendDir);
  console.log(`[rapidfire] Scaffolding Vue 3 (Vite) frontend in ${frontendDir}...`);

  try {
    run(`npx --yes degit vitejs/vite/packages/create-vite/template-vue "${frontendDir}"`, {
      stdio: 'pipe'
    });
  } catch {
    console.log('[rapidfire] Using built-in clean Vite Vue template...');
    scaffoldViteVueFallback(frontendDir);
  }

  console.log('[rapidfire] Installing Vue frontend dependencies...');
  run('npm install', { cwd: frontendDir, stdio: 'pipe' });
  console.log('[rapidfire] Vue frontend ready.');
}

function scaffoldViteVueFallback(frontendDir) {
  const pkgJson = {
    name: 'frontend',
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
    dependencies: { vue: '^3.5.0' },
    devDependencies: { '@vitejs/plugin-vue': '^5.2.0', vite: '^6.0.0' }
  };
  fse.writeJsonSync(path.join(frontendDir, 'package.json'), pkgJson, { spaces: 2 });
  fse.writeFileSync(path.join(frontendDir, 'vite.config.js'), `import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig({ plugins: [vue()], server: { port: 3000 } });
`, 'utf8');
  fse.writeFileSync(path.join(frontendDir, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><title>Rapidfire Vue</title></head>
<body><div id="app"></div><script type="module" src="/src/main.js"></script></body></html>
`, 'utf8');
  const srcDir = path.join(frontendDir, 'src');
  fse.ensureDirSync(srcDir);
  fse.writeFileSync(path.join(srcDir, 'App.vue'), `<script setup>
import { ref } from 'vue';
const count = ref(0);
</script>
<template>
  <div style="text-align: center; color: #f8fafc; font-family: system-ui;">
    <h1>Rapidfire Vue 3 App</h1>
    <button style="padding: 0.6rem 1.2rem; border-radius: 6px; background: #42b883; border: none; font-weight: bold;" @click="count++">Count: {{ count }}</button>
  </div>
</template>
`, 'utf8');
  fse.writeFileSync(path.join(srcDir, 'main.js'), `import { createApp } from 'vue'; import App from './App.vue'; createApp(App).mount('#app');`, 'utf8');
}

function scaffoldViteSvelte(frontendDir) {
  fse.ensureDirSync(frontendDir);
  console.log(`[rapidfire] Scaffolding Svelte (Vite) frontend in ${frontendDir}...`);

  try {
    run(`npx --yes degit sveltejs/vite-plugin-svelte/packages/vite-plugin-svelte/templates/svelte "${frontendDir}"`, {
      stdio: 'pipe'
    });
  } catch {
    console.log('[rapidfire] Using built-in clean Vite Svelte template...');
    scaffoldViteSvelteFallback(frontendDir);
  }

  console.log('[rapidfire] Installing Svelte frontend dependencies...');
  run('npm install --legacy-peer-deps', { cwd: frontendDir, stdio: 'pipe' });
  console.log('[rapidfire] Svelte frontend ready.');
}

function scaffoldViteSvelteFallback(frontendDir) {
  const pkgJson = {
    name: 'frontend',
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
    devDependencies: {
      '@sveltejs/vite-plugin-svelte': '^4.0.0',
      svelte: '^5.0.0',
      vite: '^5.4.0'
    }
  };
  fse.writeJsonSync(path.join(frontendDir, 'package.json'), pkgJson, { spaces: 2 });
  fse.writeFileSync(path.join(frontendDir, 'svelte.config.js'), `export default {};\n`, 'utf8');
  fse.writeFileSync(path.join(frontendDir, 'vite.config.js'), `import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
export default defineConfig({ plugins: [svelte()], server: { port: 3000 } });
`, 'utf8');
  fse.writeFileSync(path.join(frontendDir, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><title>Rapidfire Svelte</title></head>
<body style="margin:0; background:#0f172a; color:#f8fafc; font-family:system-ui; display:flex; min-height:100vh; align-items:center; justify-content:center;">
<div id="app"></div><script type="module" src="/src/main.js"></script></body></html>
`, 'utf8');
  const srcDir = path.join(frontendDir, 'src');
  fse.ensureDirSync(srcDir);
  fse.writeFileSync(path.join(srcDir, 'App.svelte'), `<script>
  let count = $state(0);
</script>
<div style="text-align: center;">
  <h1>Rapidfire Svelte App</h1>
  <button style="padding: 0.6rem 1.2rem; border-radius: 6px; background: #ff3e00; color: white; border: none; font-weight: bold; cursor: pointer;" onclick={() => count++}>Count: {count}</button>
</div>
`, 'utf8');
  fse.writeFileSync(path.join(srcDir, 'main.js'), `import { mount } from 'svelte';
import App from './App.svelte';
const app = mount(App, { target: document.getElementById('app') });
export default app;
`, 'utf8');
}

function writeFastAPIBackend(backendDir, appName) {
  fse.ensureDirSync(backendDir);
  console.log('[rapidfire] Scaffolding FastAPI backend...');
  const mainPy = `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="${appName} API",
    description="High-performance backend generated cleanly with Rapidfire CLI",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class HealthResponse(BaseModel):
    status: str
    message: str

@app.get("/api/health", response_model=HealthResponse)
def health_check():
    return {"status": "ok", "message": "FastAPI backend is running"}

@app.get("/")
def root():
    return {"message": "Welcome to FastAPI backend!", "docs_url": "/docs"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
`;
  fse.writeFileSync(path.join(backendDir, 'main.py'), mainPy, 'utf8');
  fse.writeFileSync(path.join(backendDir, 'requirements.txt'), `fastapi>=0.115.0\nuvicorn[standard]>=0.32.0\npydantic>=2.10.0\n`, 'utf8');
}

function writeExpressBackend(backendDir, appName) {
  fse.ensureDirSync(backendDir);
  console.log('[rapidfire] Scaffolding Express Node backend...');
  const pkg = {
    name: `${path.basename(appName)}-backend`,
    version: '1.0.0',
    private: true,
    main: 'server.js',
    scripts: { start: 'node server.js', dev: 'node --watch server.js' },
    dependencies: { cors: '^2.8.5', dotenv: '^16.4.7', express: '^4.21.2' }
  };
  fse.writeJsonSync(path.join(backendDir, 'package.json'), pkg, { spaces: 2 });
  const serverJs = `const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());
app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'Express backend is running' }));
app.listen(PORT, () => console.log(\`Server running on http://localhost:\${PORT}\`));
`;
  fse.writeFileSync(path.join(backendDir, 'server.js'), serverJs, 'utf8');
  fse.writeFileSync(path.join(backendDir, '.env.example'), 'PORT=5000\n', 'utf8');
  console.log('[rapidfire] Installing backend dependencies...');
  run('npm install', { cwd: backendDir, stdio: 'pipe' });
  console.log('[rapidfire] Express backend ready.');
}

function writeDjangoBackend(backendDir) {
  fse.ensureDirSync(backendDir);
  console.log('[rapidfire] Scaffolding Django backend...');
  const djangoCmd = getDjangoAdminCmd();
  run(`${djangoCmd} startproject backend "${backendDir}"`);
  fse.writeFileSync(path.join(backendDir, 'requirements.txt'), `asgiref>=3.8.1\nDjango>=4.2,<6.0\ndjango-cors-headers>=4.3.1\nsqlparse>=0.5.0\n`, 'utf8');
}

function writeFlaskBackend(backendDir) {
  fse.ensureDirSync(backendDir);
  console.log('[rapidfire] Scaffolding Flask backend...');
  const appPy = `from flask import Flask, jsonify
from flask_cors import CORS
app = Flask(__name__)
CORS(app)
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'Flask backend is running'})
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
`;
  fse.writeFileSync(path.join(backendDir, 'app.py'), appPy, 'utf8');
  fse.writeFileSync(path.join(backendDir, 'requirements.txt'), `flask>=3.1.0\nflask-cors>=5.0.0\n`, 'utf8');
}

async function initGitAndHooks(projectPath, targetFolder, context = {}) {
  try {
    const parentRepo = getParentGitRepo(projectPath);
    if (parentRepo) {
      console.log(`\x1b[33m[rapidfire] Detected parent Git repository at '${parentRepo}'. Skipping nested git init.\x1b[0m`);
      try {
        installPrePushHook(parentRepo);
      } catch {}
      return { initialized: false, isNested: true, parentRepo };
    }

    if (fse.existsSync(path.join(projectPath, '.git'))) {
      const hookResult = installPrePushHook(projectPath);
      if (hookResult.success) {
        console.log('\x1b[32m[rapidfire-security] Installed gitleaks pre-push hook in .git/hooks/pre-push\x1b[0m');
      }
      return { initialized: true, isNested: false };
    }

    const folderName = targetFolder || path.basename(projectPath);
    const gitPrompt = `\nDo you want to initialize a local Git repository for '${folderName}'? (Y/N): `;

    const isInteractive = Boolean(context && (typeof context.ask === 'function' || context.rl));
    const defaultChoice = isInteractive ? 'n' : (process.env.RAPIDFIRE_AUTO_GIT === '0' ? 'n' : 'y');
    const shouldInit = await promptConfirmation(context, gitPrompt, defaultChoice);

    if (shouldInit) {
      try {
        run('git init -b main', { cwd: projectPath, stdio: 'ignore' });
      } catch {
        run('git init', { cwd: projectPath, stdio: 'ignore' });
      }
      console.log('[rapidfire] Initialized local git repository.');
      const hookResult = installPrePushHook(projectPath);
      if (hookResult.success) {
        console.log('\x1b[32m[rapidfire-security] Installed gitleaks pre-push hook in .git/hooks/pre-push\x1b[0m');
      }
      return { initialized: true, isNested: false };
    } else {
      console.log('[rapidfire] Skipped local git initialization.');
      return { initialized: false, isNested: false };
    }
  } catch (err) {
    console.warn('[rapidfire] Git initialization notice:', err.message);
    return { initialized: false, error: err.message };
  }
}

async function maybePromptForVenv(pythonDir, context) {
  if (!pythonDir || !fse.existsSync(pythonDir)) return;

  const folderName = path.basename(pythonDir);
  const promptText = `\nDo you want to create a Python virtual environment (venv) in '${folderName}'? (Y/N): `;

  let answer = 'n';
  if (process.env.RAPIDFIRE_AUTO_VENV === '1') {
    answer = 'y';
  } else if (context && typeof context.ask === 'function') {
    answer = await context.ask(promptText);
  } else if (context && context.rl) {
    answer = await new Promise((resolve) => {
      context.rl.question(promptText, (ans) => resolve(ans));
    });
  } else {
    return;
  }

  if (answer && answer.trim().toLowerCase().startsWith('y')) {
    console.log(`[rapidfire] Creating Python virtual environment in ${pythonDir}...`);
    const res = createVirtualEnvironment(pythonDir);
    if (res.success) {
      console.log(`\x1b[32m✔ Virtual environment created at ${res.venvPath}\x1b[0m`);
      console.log(`  To activate: \x1b[36m${res.activateCmd}\x1b[0m`);
    } else {
      console.log(`\x1b[33m⚠ Could not create virtual environment: ${res.error}\x1b[0m`);
    }
  } else {
    console.log(`[rapidfire] Skipped venv creation.`);
  }
}

async function maybePromptForGithubRepo(projectPath, targetFolder, context) {
  if (!projectPath || !fse.existsSync(projectPath)) return;
  if (!fse.existsSync(path.join(projectPath, '.git'))) return;
  if (!isGhInstalled()) return;

  const promptText = `\nDo you want to create a remote GitHub repository for '${targetFolder}'? (Y/N): `;

  let answer = 'n';
  if (process.env.RAPIDFIRE_AUTO_GH === '1') {
    answer = 'y';
  } else if (context && typeof context.ask === 'function') {
    answer = await context.ask(promptText);
  } else if (context && context.rl) {
    answer = await new Promise((resolve) => {
      context.rl.question(promptText, (ans) => resolve(ans));
    });
  } else {
    return;
  }

  if (answer && answer.trim().toLowerCase().startsWith('y')) {
    if (!isGhAuthenticated()) {
      console.log(`\x1b[33m[rapidfire] GitHub CLI is not authenticated. Run "gh auth login" in your terminal first.\x1b[0m`);
      return;
    }
    console.log(`[rapidfire] Creating remote GitHub repository '${targetFolder}'...`);
    const res = createRepo(projectPath, targetFolder, false);
    if (res.success) {
      console.log(`\x1b[32m✔ Remote GitHub repository '${targetFolder}' created and linked to origin!\x1b[0m`);
    } else {
      console.log(`\x1b[33m⚠ Could not create GitHub repository: ${res.message || res.error}\x1b[0m`);
    }
  } else {
    console.log(`[rapidfire] Skipped remote GitHub repository creation.`);
  }
}

async function handleSetup(args, context = {}) {
  const stack = args[0]?.toLowerCase();
  const targetFolder = args[1];

  if (!stack || !targetFolder) {
    console.log('\x1b[33m[rapidfire] Usage: setup <stack> <folder-name>\x1b[0m');
    console.log('Supported multi-framework pairings (frontend + backend):');
    console.log('  • setup react+fastapi <folder>  (React + FastAPI)');
    console.log('  • setup react+django <folder>   (React + Django)');
    console.log('  • setup react+node <folder>     (React + Express)');
    console.log('  • setup vue+fastapi <folder>    (Vue 3 + FastAPI)');
    console.log('  • setup vue+node <folder>       (Vue 3 + Express)');
    console.log('  • setup vue+django <folder>     (Vue 3 + Django)');
    console.log('  • setup react+flask <folder>    (React + Flask)');
    console.log('  • setup svelte+node <folder>    (Svelte + Express)');
    console.log('Standalone frontends:');
    console.log('  • setup react <folder>          (Standalone React Vite)');
    console.log('  • setup vue <folder>            (Standalone Vue 3 Vite)');
    console.log('  • setup svelte <folder>         (Standalone Svelte Vite)');
    console.log('Standalone backends:');
    console.log('  • setup fastapi <folder>        (Standalone FastAPI)');
    console.log('  • setup django <folder>         (Standalone Django)');
    console.log('Dynamic & custom framework scaffolding:');
    console.log('  • setup <unknown> <folder>      (Dynamic AI scaffolding: e.g. astro, solid, nextjs, nestjs)');
    console.log('  • setup <fe>+<be> <folder>      (Composed arbitrary pairings: e.g. svelte+fastapi, vue+flask)');
    console.log('  • setup <stack> <folder> --dynamic (Non-interactive dynamic scaffolding)');
    return;
  }

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

  const projectPath = path.resolve(process.cwd(), targetFolder);

  if (fse.existsSync(projectPath) && !isDirEmpty(projectPath)) {
    console.error(`\x1b[31m[rapidfire] Error: Target directory '${targetFolder}' already exists and is not empty.\x1b[0m`);
    return;
  }

  if (plan.tier === 'COMPOSED') {
    console.log(`[rapidfire] Composing multi-framework stack: ${plan.frontend} (frontend) + ${plan.backend} (backend)...`);
    await setupFullstack(projectPath, targetFolder, plan.frontend, plan.backend, context);
    return;
  }

  if (plan.tier === 'DYNAMIC') {
    const hasDynamicFlag = args.some(
      (a) => a.toLowerCase() === '--dynamic' || a.toLowerCase() === '--resolve' || a.toLowerCase() === 'dynamic'
    );
    const autoDynamic = Boolean(process.env.RAPIDFIRE_AUTO_DYNAMIC === '1' || hasDynamicFlag);

    let proceed = false;
    if (autoDynamic) {
      proceed = true;
    } else {
      const promptText = `\n\x1b[33m[rapidfire] Recipe '${stack}' is not in the predefined catalogue.\x1b[0m\nWould you like to dynamically scaffold this project now? (Y/N): `;
      if (context && typeof context.ask === 'function') {
        const ans = await context.ask(promptText);
        proceed = Boolean(ans && ans.trim().toLowerCase().startsWith('y'));
      } else if (context && context.rl) {
        proceed = await new Promise((resolve) => {
          context.rl.question(promptText, (ans) => {
            resolve(Boolean(ans && ans.trim().toLowerCase().startsWith('y')));
          });
        });
      }
    }

    if (proceed) {
      return await scaffoldDynamicFramework(projectPath, targetFolder, plan, context);
    } else {
      console.error(`\x1b[31m[rapidfire] Unknown recipe '${stack}'.\x1b[0m`);
      console.log('Type "help" to see all supported framework recipes.');
      return;
    }
  }

  switch (stack) {
    case 'react':
      await setupStandaloneFrontend(projectPath, targetFolder, 'react', context);
      break;
    case 'vue':
      await setupStandaloneFrontend(projectPath, targetFolder, 'vue', context);
      break;
    case 'svelte':
      await setupStandaloneFrontend(projectPath, targetFolder, 'svelte', context);
      break;
    case 'react+fastapi':
      await setupFullstack(projectPath, targetFolder, 'react', 'fastapi', context);
      break;
    case 'react+django':
      await setupFullstack(projectPath, targetFolder, 'react', 'django', context);
      break;
    case 'react+node':
      await setupFullstack(projectPath, targetFolder, 'react', 'node', context);
      break;
    case 'vue+fastapi':
      await setupFullstack(projectPath, targetFolder, 'vue', 'fastapi', context);
      break;
    case 'vue+node':
      await setupFullstack(projectPath, targetFolder, 'vue', 'node', context);
      break;
    case 'vue+django':
      await setupFullstack(projectPath, targetFolder, 'vue', 'django', context);
      break;
    case 'react+flask':
      await setupFullstack(projectPath, targetFolder, 'react', 'flask', context);
      break;
    case 'svelte+node':
      await setupFullstack(projectPath, targetFolder, 'svelte', 'node', context);
      break;
    case 'fastapi':
      await setupStandaloneFastAPI(projectPath, targetFolder, context);
      break;
    case 'django':
      await setupStandaloneDjango(projectPath, targetFolder, context);
      break;
    default:
      console.error(`\x1b[31m[rapidfire] Unknown recipe '${stack}'.\x1b[0m`);
      console.log('Type "help" to see all supported framework recipes.');
  }
}

async function setupFullstack(projectPath, targetFolder, frontend, backend, context = {}) {
  if (!commandExists('npm')) {
    console.error('[rapidfire] Missing required tool: npm');
    return;
  }

  if (backend === 'django') {
    if (!commandExists('django-admin')) {
      console.error('[rapidfire] Missing required tool: django-admin (pip install django)');
      return;
    }
  }

  fse.ensureDirSync(projectPath);

  const frontendDir = path.join(projectPath, 'frontend');
  if (frontend === 'react') scaffoldViteReact(frontendDir);
  else if (frontend === 'vue') scaffoldViteVue(frontendDir);
  else if (frontend === 'svelte') scaffoldViteSvelte(frontendDir);

  const backendDir = path.join(projectPath, 'backend');
  if (backend === 'fastapi') writeFastAPIBackend(backendDir, targetFolder);
  else if (backend === 'node') writeExpressBackend(backendDir, targetFolder);
  else if (backend === 'django') writeDjangoBackend(backendDir);
  else if (backend === 'flask') writeFlaskBackend(backendDir);

  fse.writeFileSync(path.join(projectPath, '.gitignore'), `node_modules/\ndist/\n.env\n__pycache__/\n*.pyc\nvenv/\n.venv/\n`, 'utf8');

  fse.writeFileSync(path.join(projectPath, 'README.md'), `# ${targetFolder}
Scaffolded with RapidFire CLI (\`setup ${frontend}+${backend}\`).

## Frontend (${frontend.toUpperCase()})
\`\`\`bash
cd frontend
npm run dev
\`\`\`

## Backend (${backend.toUpperCase()})
\`\`\`bash
cd backend
\`\`\`
`, 'utf8');

  const isPredefined = ['react+fastapi', 'react+django', 'react+node', 'vue+fastapi', 'vue+node', 'vue+django', 'react+flask', 'svelte+node'].includes(`${frontend}+${backend}`);
  writeManifest(projectPath, {
    frontend,
    backend,
    folderName: targetFolder,
    generationMode: isPredefined ? 'predefined' : 'composed'
  });
  await initGitAndHooks(projectPath, targetFolder, context);

  if (['fastapi', 'django', 'flask'].includes(backend) && context && (context.ask || context.rl || process.env.RAPIDFIRE_AUTO_VENV)) {
    await maybePromptForVenv(backendDir, context);
  }

  if (context && (context.ask || context.rl || process.env.RAPIDFIRE_AUTO_GH)) {
    await maybePromptForGithubRepo(projectPath, targetFolder, context);
  }

  reportSuccess(targetFolder, `${frontend}+${backend}`);
}

async function setupStandaloneFastAPI(projectPath, targetFolder, context = {}) {
  fse.ensureDirSync(projectPath);
  console.log(`[rapidfire] Scaffolding standalone FastAPI project in ${targetFolder}...`);
  writeFastAPIBackend(projectPath, targetFolder);
  fse.writeFileSync(path.join(projectPath, '.gitignore'), `__pycache__/\n*.pyc\nvenv/\n.venv/\n.env\n`, 'utf8');
  writeManifest(projectPath, { frontend: null, backend: 'fastapi', folderName: targetFolder });
  await initGitAndHooks(projectPath, targetFolder, context);

  if (context && (context.ask || context.rl || process.env.RAPIDFIRE_AUTO_VENV)) {
    await maybePromptForVenv(projectPath, context);
  }

  if (context && (context.ask || context.rl || process.env.RAPIDFIRE_AUTO_GH)) {
    await maybePromptForGithubRepo(projectPath, targetFolder, context);
  }

  reportSuccess(targetFolder, 'fastapi');
}

async function setupStandaloneDjango(projectPath, targetFolder, context = {}) {
  if (!commandExists('django-admin')) {
    console.error('[rapidfire] Missing required tool: django-admin (pip install django)');
    return;
  }
  fse.ensureDirSync(projectPath);
  console.log(`[rapidfire] Scaffolding Django project in ${targetFolder}...`);
  const djangoCmd = getDjangoAdminCmd();
  run(`${djangoCmd} startproject "${path.basename(targetFolder)}" "${projectPath}"`);
  fse.writeFileSync(path.join(projectPath, 'requirements.txt'), `asgiref>=3.8.1\nDjango>=4.2,<6.0\nsqlparse>=0.5.0\n`, 'utf8');
  fse.writeFileSync(path.join(projectPath, '.gitignore'), `__pycache__/\n*.pyc\nvenv/\n.venv/\ndb.sqlite3\n.env\n`, 'utf8');
  writeManifest(projectPath, { frontend: null, backend: 'django', folderName: targetFolder });
  await initGitAndHooks(projectPath, targetFolder, context);

  if (context && (context.ask || context.rl || process.env.RAPIDFIRE_AUTO_VENV)) {
    await maybePromptForVenv(projectPath, context);
  }

  if (context && (context.ask || context.rl || process.env.RAPIDFIRE_AUTO_GH)) {
    await maybePromptForGithubRepo(projectPath, targetFolder, context);
  }

  reportSuccess(targetFolder, 'django');
}

async function setupStandaloneFrontend(projectPath, targetFolder, frontend, context = {}) {
  if (!commandExists('npm')) {
    console.error('[rapidfire] Missing required tool: npm');
    return;
  }
  fse.ensureDirSync(projectPath);
  console.log(`[rapidfire] Scaffolding standalone ${frontend.toUpperCase()} project in ${targetFolder}...`);

  if (frontend === 'react') scaffoldViteReact(projectPath);
  else if (frontend === 'vue') scaffoldViteVue(projectPath);
  else if (frontend === 'svelte') scaffoldViteSvelte(projectPath);

  writeManifest(projectPath, { frontend, backend: null, folderName: targetFolder });
  await initGitAndHooks(projectPath, targetFolder, context);

  if (context && (context.ask || context.rl || process.env.RAPIDFIRE_AUTO_GH)) {
    await maybePromptForGithubRepo(projectPath, targetFolder, context);
  }

  reportSuccess(targetFolder, frontend);
}

function reportSuccess(folderName, stack) {
  console.log(`\n\x1b[32m╔════════════════════════════════════════════════════╗\x1b[0m`);
  console.log(`\x1b[32m║  Project '${folderName}' (${stack}) ready!  ║\x1b[0m`);
  console.log(`\x1b[32m╚════════════════════════════════════════════════════╝\x1b[0m\n`);

  console.log(`Next steps:`);
  console.log(`  \x1b[36mcd ${folderName}\x1b[0m (if navigating in your outer shell)`);
  console.log(`  \x1b[35m• Save as preset anytime:\x1b[0m save preset <name> ${folderName}`);

  if (isGhInstalled()) {
    if (isGhAuthenticated()) {
      console.log(`  \x1b[32m• Push to GitHub in 1 command:\x1b[0m push -m "initial commit" (or git add . push -branch main -m "msg")`);
    } else {
      console.log(`  \x1b[33m• GitHub CLI present:\x1b[0m run "gh auth login" to enable automatic remote repo creation.`);
    }
  }

  const isFrontend = stack.includes('+') || ['react', 'vue', 'svelte'].includes(stack);
  if (isFrontend && isVercelInstalled()) {
    const deployFolder = stack.includes('+') ? `${folderName}/frontend` : folderName;
    console.log(`  \x1b[32m• Deploy to Vercel:\x1b[0m cd ${deployFolder} && vercel --prod (or run "deploy ${folderName}")`);
  }
}

module.exports = {
  handleSetup
};
