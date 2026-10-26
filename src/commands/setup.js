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
const { getFrontendAdapter, hasFrontendAdapter, normalizeFrontendName } = require('../scaffolding/adapters/frontend');
const { getBackendAdapter, hasBackendAdapter, normalizeBackendName, getBackendDefaultPort } = require('../scaffolding/adapters/backend');

function scaffoldViteReact(frontendDir, isStandalone = false) {
  fse.ensureDirSync(frontendDir);
  console.log(`[rapidfire] Scaffolding React (Vite) frontend in ${frontendDir}...`);
  scaffoldViteReactFallback(frontendDir, isStandalone);

  if (process.env.RAPIDFIRE_SKIP_INSTALL !== '1') {
    console.log('[rapidfire] Installing React frontend dependencies...');
    try {
      run('npm install', { cwd: frontendDir, stdio: 'pipe' });
      console.log('[rapidfire] React frontend ready.');
    } catch (err) {
      console.warn('\x1b[33m[rapidfire] npm install notice:\x1b[0m', err.message);
    }
  } else {
    console.log('[rapidfire] React frontend ready.');
  }
}

function scaffoldViteReactFallback(frontendDir, isStandalone = false) {
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
  fse.writeFileSync(path.join(frontendDir, '.env.example'), 'VITE_API_URL=http://localhost:8000\n', 'utf8');
  const srcDir = path.join(frontendDir, 'src');
  fse.ensureDirSync(srcDir);
  fse.writeFileSync(path.join(srcDir, 'index.css'), `* { box-sizing: border-box; margin: 0; padding: 0; }
body { margin: 0; background: #0b0f19; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; display: flex; min-height: 100vh; align-items: center; justify-content: center; }`, 'utf8');

  const appContent = isStandalone ? `import React, { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ maxWidth: '640px', width: '90%', background: '#131b2e', border: '1px solid #1e293b', borderRadius: '16px', padding: '2.5rem', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', textAlign: 'center' }}>
      <div style={{ display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '999px', background: 'rgba(6,182,212,0.15)', color: '#06b6d4', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
        [STANDALONE] Single-Page Application
      </div>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem', background: 'linear-gradient(135deg, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        RapidFire React Application
      </h1>
      <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2rem' }}>
        High-performance React 18 single-page application scaffolded with Vite and GitLeaks security.
      </p>

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', transition: 'transform 0.1s' }} onClick={() => setCount(c => c + 1)}>
          State Counter: {count}
        </button>
      </div>

      <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: '8px', background: 'rgba(15,23,42,0.6)', border: '1px solid #1e293b', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.85rem' }}>
        <div style={{ fontWeight: 'bold', color: '#38bdf8', marginBottom: '0.35rem' }}>
          [READY] Standalone Frontend Active
        </div>
        <div style={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: '1.4' }}>
          • Edit src/App.jsx to build your user interface.<br />
          • Run "stop" to terminate the development server anytime.<br />
          • Run "push" to stage, scan for secrets, and commit.
        </div>
      </div>
    </div>
  );
}
` : `import React, { useState } from 'react';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function App() {
  const [count, setCount] = useState(0);
  const [apiResponse, setApiResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const testBackendApi = async () => {
    setLoading(true);
    try {
      let res;
      try {
        res = await fetch(API_URL + '/api/health');
      } catch {
        res = await fetch('http://localhost:5000/api/health');
      }
      const data = await res.json();
      setApiResponse({ status: 'success', data });
    } catch (err) {
      setApiResponse({ status: 'offline', error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '640px', width: '90%', background: '#131b2e', border: '1px solid #1e293b', borderRadius: '16px', padding: '2.5rem', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', textAlign: 'center' }}>
      <div style={{ display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '999px', background: 'rgba(6,182,212,0.15)', color: '#06b6d4', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
        [ARCH] Dual-Tier Microservice Architecture
      </div>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem', background: 'linear-gradient(135deg, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        RapidFire Full-Stack Application
      </h1>
      <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2rem' }}>
        Frontend (React 18 Vite) connected to Backend API with pre-configured CORS and GitLeaks security.
      </p>

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', transition: 'transform 0.1s' }} onClick={() => setCount(c => c + 1)}>
          State Counter: {count}
        </button>

        <button style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', background: '#059669', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }} onClick={testBackendApi} disabled={loading}>
          {loading ? 'Pinging Backend...' : 'Test Backend API (/api/health)'}
        </button>
      </div>

      {apiResponse && (
        <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: '8px', background: apiResponse.status === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: '1px solid ' + (apiResponse.status === 'success' ? '#10b981' : '#ef4444'), textAlign: 'left', fontFamily: 'monospace', fontSize: '0.85rem' }}>
          <div style={{ fontWeight: 'bold', color: apiResponse.status === 'success' ? '#34d399' : '#f87171', marginBottom: '0.35rem' }}>
            {apiResponse.status === 'success' ? '[200 OK] Backend Microservice Connected!' : '[OFFLINE] Backend Server Offline (Run uvicorn or node backend server)'}
          </div>
          <pre style={{ margin: 0, color: '#e2e8f0' }}>{JSON.stringify(apiResponse.data || { error: apiResponse.error }, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
`;

  fse.writeFileSync(path.join(srcDir, 'App.jsx'), appContent, 'utf8');
  fse.writeFileSync(path.join(srcDir, 'main.jsx'), `import React from 'react'; import ReactDOM from 'react-dom/client'; import App from './App'; import './index.css';
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
`, 'utf8');
}

function scaffoldViteVue(frontendDir, isStandalone = false) {
  fse.ensureDirSync(frontendDir);
  console.log(`[rapidfire] Scaffolding Vue 3 (Vite) frontend in ${frontendDir}...`);
  scaffoldViteVueFallback(frontendDir, isStandalone);

  if (process.env.RAPIDFIRE_SKIP_INSTALL !== '1') {
    console.log('[rapidfire] Installing Vue frontend dependencies...');
    try {
      run('npm install', { cwd: frontendDir, stdio: 'pipe' });
      console.log('[rapidfire] Vue frontend ready.');
    } catch (err) {
      console.warn('\x1b[33m[rapidfire] npm install notice:\x1b[0m', err.message);
    }
  } else {
    console.log('[rapidfire] Vue frontend ready.');
  }
}

function scaffoldViteVueFallback(frontendDir, isStandalone = false) {
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
  const appVueContent = isStandalone ? `<script setup>
import { ref } from 'vue';
const count = ref(0);
</script>
<template>
  <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; padding: 1rem;">
    <div style="max-width: 640px; width: 90%; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 2.5rem; box-shadow: 0 20px 50px rgba(0,0,0,0.5); text-align: center;">
      <div style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; background: rgba(6,182,212,0.15); color: #06b6d4; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem;">
        [STANDALONE] Single-Page Application
      </div>
      <h1 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 0.5rem; background: linear-gradient(135deg, #42b883, #38bdf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
        RapidFire Vue 3 Application
      </h1>
      <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem;">
        High-performance Vue 3 single-page application scaffolded with Vite and GitLeaks security.
      </p>
      <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 1.5rem; flex-wrap: wrap;">
        <button style="padding: 0.75rem 1.5rem; border-radius: 8px; background: #42b883; color: #fff; border: none; font-weight: 600; cursor: pointer;" @click="count++">
          State Counter: {{ count }}
        </button>
      </div>
      <div style="margin-top: 1.5rem; padding: 1rem; border-radius: 8px; background: rgba(15,23,42,0.6); border: 1px solid #1e293b; text-align: left; font-family: monospace; font-size: 0.85rem;">
        <div style="font-weight: bold; color: #42b883; margin-bottom: 0.35rem;">
          [READY] Standalone Frontend Active
        </div>
        <div style="color: #94a3b8; font-size: 0.8rem; line-height: 1.4;">
          • Edit src/App.vue to build your user interface.<br />
          • Run "stop" to terminate the development server anytime.<br />
          • Run "push" to stage, scan for secrets, and commit.
        </div>
      </div>
    </div>
  </div>
</template>
` : `<script setup>
import { ref } from 'vue';

const count = ref(0);
const apiResponse = ref(null);
const loading = ref(false);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function testBackendApi() {
  loading.value = true;
  try {
    let res;
    try {
      res = await fetch(API_URL + '/api/health');
    } catch {
      res = await fetch('http://localhost:5000/api/health');
    }
    const data = await res.json();
    apiResponse.value = { status: 'success', data };
  } catch (err) {
    apiResponse.value = { status: 'offline', error: err.message };
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; padding: 1rem;">
    <div style="max-width: 640px; width: 90%; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 2.5rem; box-shadow: 0 20px 50px rgba(0,0,0,0.5); text-align: center;">
      <div style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; background: rgba(6,182,212,0.15); color: #06b6d4; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem;">
        [ARCH] Dual-Tier Microservice Architecture
      </div>
      <h1 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 0.5rem; background: linear-gradient(135deg, #42b883, #38bdf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
        RapidFire Full-Stack Application
      </h1>
      <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem;">
        Frontend (Vue 3 Vite) connected to Backend API with pre-configured CORS and GitLeaks security.
      </p>

      <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 1.5rem; flex-wrap: wrap;">
        <button style="padding: 0.75rem 1.5rem; border-radius: 8px; background: #42b883; color: #fff; border: none; font-weight: 600; cursor: pointer;" @click="count++">
          State Counter: {{ count }}
        </button>
        <button style="padding: 0.75rem 1.5rem; border-radius: 8px; background: #059669; color: #fff; border: none; font-weight: 600; cursor: pointer;" @click="testBackendApi" :disabled="loading">
          {{ loading ? 'Pinging Backend...' : 'Test Backend API (/api/health)' }}
        </button>
      </div>

      <div v-if="apiResponse" :style="{ marginTop: '1.5rem', padding: '1rem', borderRadius: '8px', background: apiResponse.status === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: '1px solid ' + (apiResponse.status === 'success' ? '#10b981' : '#ef4444'), textAlign: 'left', fontFamily: 'monospace', fontSize: '0.85rem' }">
        <div :style="{ fontWeight: 'bold', color: apiResponse.status === 'success' ? '#34d399' : '#f87171', marginBottom: '0.35rem' }">
          {{ apiResponse.status === 'success' ? '[200 OK] Backend Microservice Connected!' : '[OFFLINE] Backend Server Offline (Run backend server)' }}
        </div>
        <pre style="margin: 0; color: #e2e8f0;">{{ JSON.stringify(apiResponse.data || { error: apiResponse.error }, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>
`;
  fse.writeFileSync(path.join(srcDir, 'App.vue'), appVueContent, 'utf8');
  fse.writeFileSync(path.join(srcDir, 'main.js'), `import { createApp } from 'vue'; import App from './App.vue'; createApp(App).mount('#app');`, 'utf8');
}

function scaffoldViteSvelte(frontendDir, isStandalone = false) {
  fse.ensureDirSync(frontendDir);
  console.log(`[rapidfire] Scaffolding Svelte (Vite) frontend in ${frontendDir}...`);
  scaffoldViteSvelteFallback(frontendDir, isStandalone);

  if (process.env.RAPIDFIRE_SKIP_INSTALL !== '1') {
    console.log('[rapidfire] Installing Svelte frontend dependencies...');
    try {
      run('npm install --legacy-peer-deps', { cwd: frontendDir, stdio: 'pipe' });
      console.log('[rapidfire] Svelte frontend ready.');
    } catch (err) {
      console.warn('\x1b[33m[rapidfire] npm install notice:\x1b[0m', err.message);
    }
  } else {
    console.log('[rapidfire] Svelte frontend ready.');
  }
}

function scaffoldViteSvelteFallback(frontendDir, isStandalone = false) {
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
  const appSvelteContent = isStandalone ? `<script>
  let count = $state(0);
</script>
<div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; padding: 1rem;">
  <div style="max-width: 640px; width: 90%; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 2.5rem; box-shadow: 0 20px 50px rgba(0,0,0,0.5); text-align: center;">
    <div style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; background: rgba(6,182,212,0.15); color: #06b6d4; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem;">
      [STANDALONE] Single-Page Application
    </div>
    <h1 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 0.5rem; background: linear-gradient(135deg, #ff3e00, #f59e0b); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
      RapidFire Svelte Application
    </h1>
    <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem;">
      High-performance Svelte single-page application scaffolded with Vite and GitLeaks security.
    </p>
    <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 1.5rem; flex-wrap: wrap;">
      <button style="padding: 0.75rem 1.5rem; border-radius: 8px; background: #ff3e00; color: white; border: none; font-weight: 600; cursor: pointer;" onclick={() => count++}>
        State Counter: {count}
      </button>
    </div>
    <div style="margin-top: 1.5rem; padding: 1rem; border-radius: 8px; background: rgba(15,23,42,0.6); border: 1px solid #1e293b; text-align: left; font-family: monospace; font-size: 0.85rem;">
      <div style="font-weight: bold; color: #ff3e00; margin-bottom: 0.35rem;">
        [READY] Standalone Frontend Active
      </div>
      <div style="color: #94a3b8; font-size: 0.8rem; line-height: 1.4;">
        • Edit src/App.svelte to build your user interface.<br />
        • Run "stop" to terminate the development server anytime.<br />
        • Run "push" to stage, scan for secrets, and commit.
      </div>
    </div>
  </div>
</div>
` : `<script>
  let count = $state(0);
  let apiResponse = $state(null);
  let loading = $state(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  async function testBackendApi() {
    loading = true;
    try {
      let res;
      try {
        res = await fetch(API_URL + '/api/health');
      } catch {
        res = await fetch('http://localhost:5000/api/health');
      }
      const data = await res.json();
      apiResponse = { status: 'success', data };
    } catch (err) {
      apiResponse = { status: 'offline', error: err.message };
    } finally {
      loading = false;
    }
  }
</script>

<div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; padding: 1rem;">
  <div style="max-width: 640px; width: 90%; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 2.5rem; box-shadow: 0 20px 50px rgba(0,0,0,0.5); text-align: center;">
    <div style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; background: rgba(6,182,212,0.15); color: #06b6d4; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem;">
      [ARCH] Dual-Tier Microservice Architecture
    </div>
    <h1 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 0.5rem; background: linear-gradient(135deg, #ff3e00, #f59e0b); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
      RapidFire Full-Stack Application
    </h1>
    <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem;">
      Frontend (Svelte Vite) connected to Backend API with pre-configured CORS and GitLeaks security.
    </p>

    <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 1.5rem; flex-wrap: wrap;">
      <button style="padding: 0.75rem 1.5rem; border-radius: 8px; background: #ff3e00; color: #fff; border: none; font-weight: 600; cursor: pointer;" onclick={() => count++}>
        State Counter: {count}
      </button>
      <button style="padding: 0.75rem 1.5rem; border-radius: 8px; background: #059669; color: #fff; border: none; font-weight: 600; cursor: pointer;" onclick={testBackendApi} disabled={loading}>
        {loading ? 'Pinging Backend...' : 'Test Backend API (/api/health)'}
      </button>
    </div>

    {#if apiResponse}
      <div style="margin-top: 1.5rem; padding: 1rem; border-radius: 8px; background: {apiResponse.status === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; border: 1px solid {apiResponse.status === 'success' ? '#10b981' : '#ef4444'}; text-align: left; font-family: monospace; font-size: 0.85rem;">
        <div style="font-weight: bold; color: {apiResponse.status === 'success' ? '#34d399' : '#f87171'}; margin-bottom: 0.35rem;">
          {apiResponse.status === 'success' ? '[200 OK] Backend Microservice Connected!' : '[OFFLINE] Backend Server Offline (Run backend server)'}
        </div>
        <pre style="margin: 0; color: #e2e8f0;">{JSON.stringify(apiResponse.data || { error: apiResponse.error }, null, 2)}</pre>
      </div>
    {/if}
  </div>
</div>
`;
  fse.writeFileSync(path.join(srcDir, 'App.svelte'), appSvelteContent, 'utf8');
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
  if (process.env.RAPIDFIRE_SKIP_INSTALL !== '1') {
    console.log('[rapidfire] Installing backend dependencies...');
    try {
      run('npm install', { cwd: backendDir, stdio: 'pipe' });
      console.log('[rapidfire] Express backend ready.');
    } catch (err) {
      console.warn('\x1b[33m[rapidfire] npm install notice:\x1b[0m', err.message);
    }
  } else {
    console.log('[rapidfire] Express backend ready.');
  }
}

function configureDjangoCorsAndHealth(backendDir) {
  let settingsPath = path.join(backendDir, 'backend', 'settings.py');
  if (!fse.existsSync(settingsPath)) {
    try {
      const items = fse.readdirSync(backendDir);
      for (const item of items) {
        const candidate = path.join(backendDir, item, 'settings.py');
        if (fse.existsSync(candidate)) {
          settingsPath = candidate;
          break;
        }
      }
    } catch { }
  }

  if (fse.existsSync(settingsPath)) {
    let settingsContent = fse.readFileSync(settingsPath, 'utf8');
    if (!settingsContent.includes("'corsheaders'")) {
      settingsContent = settingsContent.replace(/INSTALLED_APPS\s*=\s*\[/, "INSTALLED_APPS = [\n    'corsheaders',");
    }
    if (!settingsContent.includes("'corsheaders.middleware.CorsMiddleware'")) {
      settingsContent = settingsContent.replace(/MIDDLEWARE\s*=\s*\[/, "MIDDLEWARE = [\n    'corsheaders.middleware.CorsMiddleware',");
    }
    settingsContent = settingsContent.replace(/ALLOWED_HOSTS\s*=\s*\[\]/, "ALLOWED_HOSTS = ['*']");
    if (!settingsContent.includes('CORS_ALLOW_ALL_ORIGINS')) {
      settingsContent += `\nCORS_ALLOWED_ORIGINS = [\n    "http://localhost:3000",\n    "http://127.0.0.1:3000",\n    "http://localhost:3001",\n    "http://127.0.0.1:3001",\n    "http://localhost:5173",\n    "http://127.0.0.1:5173",\n]\nCORS_ALLOW_ALL_ORIGINS = True\n`;
    }
    fse.writeFileSync(settingsPath, settingsContent, 'utf8');
  }

  let urlsPath = path.join(backendDir, 'backend', 'urls.py');
  if (!fse.existsSync(urlsPath)) {
    try {
      const items = fse.readdirSync(backendDir);
      for (const item of items) {
        const candidate = path.join(backendDir, item, 'urls.py');
        if (fse.existsSync(candidate)) {
          urlsPath = candidate;
          break;
        }
      }
    } catch { }
  }

  if (fse.existsSync(urlsPath)) {
    const urlsPy = `from django.contrib import admin
from django.urls import path
from django.http import JsonResponse

def health_check(request):
    return JsonResponse({'status': 'ok', 'message': 'Django backend is running'})

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health', health_check),
    path('api/health/', health_check),
]
`;
    fse.writeFileSync(urlsPath, urlsPy, 'utf8');
  }
}

function writeDjangoBackend(backendDir) {
  fse.ensureDirSync(backendDir);
  console.log('[rapidfire] Scaffolding Django backend...');
  const djangoCmd = getDjangoAdminCmd();
  run(`${djangoCmd} startproject backend "${backendDir}"`);
  fse.writeFileSync(path.join(backendDir, 'requirements.txt'), `asgiref>=3.8.1\nDjango>=4.2,<6.0\ndjango-cors-headers>=4.3.1\nsqlparse>=0.5.0\n`, 'utf8');
  configureDjangoCorsAndHealth(backendDir);
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
      } catch { }
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
      console.log(`\x1b[32m[OK] Remote GitHub repository '${targetFolder}' created and linked to origin!\x1b[0m`);
    } else {
      console.log(`\x1b[33m[WARN] Could not create GitHub repository: ${res.message || res.error}\x1b[0m`);
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
    console.log('  • setup <stack> <folder>        (Auto-detects dynamic frameworks & fullstack pairings)');
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

  if (plan.tier === 'COMPOSED' || (plan.tier === 'PREDEFINED' && plan.isFullstack)) {
    const fe = plan.frontend || stack.split('+')[0];
    const be = plan.backend || stack.split('+')[1];
    console.log(`[rapidfire] Composing multi-framework stack: ${fe} (frontend) + ${be} (backend)...`);
    await setupFullstack(projectPath, targetFolder, fe, be, context);
    return;
  }

  if (plan.tier === 'DYNAMIC') {
    console.log(`\x1b[36m[rapidfire] Auto-detected dynamic stack '${stack}'. Scaffolding project...\x1b[0m`);
    return await scaffoldDynamicFramework(projectPath, targetFolder, plan, context);
  }

  if (plan.type === 'standalone_frontend' || hasFrontendAdapter(stack)) {
    await setupStandaloneFrontend(projectPath, targetFolder, plan.stack || stack, context);
    return;
  }

  if (plan.type === 'standalone_backend' || hasBackendAdapter(stack)) {
    await setupStandaloneBackend(projectPath, targetFolder, plan.stack || stack, context);
    return;
  }

  console.error(`\x1b[31m[rapidfire] Unknown recipe '${stack}'.\x1b[0m`);
  console.log('Type "help" to see all supported framework recipes.');
}

async function setupFullstack(projectPath, targetFolder, frontend, backend, context = {}) {
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

  if (normBe === 'django') {
    if (!commandExists('django-admin')) {
      console.error('[rapidfire] Missing required tool: django-admin (pip install django)');
      return;
    }
  }

  fse.ensureDirSync(projectPath);

  const backendPort = getBackendDefaultPort(normBe);
  const frontendDir = path.join(projectPath, 'frontend');
  feAdapter(frontendDir, { port: 3000, apiPort: backendPort, isStandalone: false, appName: targetFolder });

  const backendDir = path.join(projectPath, 'backend');
  beAdapter(backendDir, targetFolder, { port: backendPort, isStandalone: false });

  fse.writeFileSync(path.join(projectPath, '.gitignore'), `node_modules/\ndist/\n.env\n__pycache__/\n*.pyc\nvenv/\n.venv/\ntarget/\nbin/\nobj/\n`, 'utf8');

  fse.writeFileSync(path.join(projectPath, 'README.md'), `# ${targetFolder}
Scaffolded with RapidFire CLI (\`setup ${frontend}+${backend}\`).

## Frontend (${normFe.toUpperCase()})
\`\`\`bash
cd frontend
npm run dev
\`\`\`

## Backend (${normBe.toUpperCase()})
\`\`\`bash
cd backend
\`\`\`
`, 'utf8');

  const isPredefined = ['react+fastapi', 'react+django', 'react+node', 'vue+fastapi', 'vue+node', 'vue+django', 'react+flask', 'svelte+node'].includes(`${frontend}+${backend}`) || ['react+fastapi', 'react+django', 'react+node', 'vue+fastapi', 'vue+node', 'vue+django', 'react+flask', 'svelte+node'].includes(`${normFe}+${normBe}`);
  writeManifest(projectPath, {
    frontend: frontend === 'node' ? 'node' : (normFe || frontend),
    backend: backend === 'node' ? 'node' : (normBe || backend),
    folderName: targetFolder,
    generationMode: isPredefined ? 'predefined' : 'composed'
  });
  await initGitAndHooks(projectPath, targetFolder, context);

  if (['fastapi', 'django', 'flask'].includes(normBe) && context && (context.ask || context.rl || process.env.RAPIDFIRE_AUTO_VENV)) {
    await maybePromptForVenv(backendDir, context);
  }

  if (context && (context.ask || context.rl || process.env.RAPIDFIRE_AUTO_GH)) {
    await maybePromptForGithubRepo(projectPath, targetFolder, context);
  }

  reportSuccess(targetFolder, `${normFe}+${normBe}`);
}

async function setupStandaloneBackend(projectPath, targetFolder, backend, context = {}) {
  const normBe = normalizeBackendName(backend);
  const beAdapter = getBackendAdapter(normBe);
  if (!beAdapter) {
    console.error(`\x1b[31m[rapidfire] Unknown backend: '${backend}'.\x1b[0m`);
    return;
  }
  if (normBe === 'django' && !commandExists('django-admin')) {
    console.error('[rapidfire] Missing required tool: django-admin (pip install django)');
    return;
  }
  fse.ensureDirSync(projectPath);
  console.log(`[rapidfire] Scaffolding standalone ${normBe.toUpperCase()} project in ${targetFolder}...`);
  const backendPort = getBackendDefaultPort(normBe);
  beAdapter(projectPath, targetFolder, { port: backendPort, isStandalone: true });
  fse.writeFileSync(path.join(projectPath, '.gitignore'), `__pycache__/\n*.pyc\nvenv/\n.venv/\n.env\ntarget/\nnode_modules/\nbin/\nobj/\n`, 'utf8');
  writeManifest(projectPath, { frontend: null, backend: normBe, folderName: targetFolder });
  await initGitAndHooks(projectPath, targetFolder, context);

  if (['fastapi', 'django', 'flask'].includes(normBe) && context && (context.ask || context.rl || process.env.RAPIDFIRE_AUTO_VENV)) {
    await maybePromptForVenv(projectPath, context);
  }

  if (context && (context.ask || context.rl || process.env.RAPIDFIRE_AUTO_GH)) {
    await maybePromptForGithubRepo(projectPath, targetFolder, context);
  }

  reportSuccess(targetFolder, normBe);
}

async function setupStandaloneFastAPI(projectPath, targetFolder, context = {}) {
  return await setupStandaloneBackend(projectPath, targetFolder, 'fastapi', context);
}

async function setupStandaloneDjango(projectPath, targetFolder, context = {}) {
  return await setupStandaloneBackend(projectPath, targetFolder, 'django', context);
}

async function setupStandaloneFrontend(projectPath, targetFolder, frontend, context = {}) {
  const normFe = normalizeFrontendName(frontend);
  const feAdapter = getFrontendAdapter(normFe);
  if (!feAdapter) {
    console.error(`\x1b[31m[rapidfire] Unknown frontend: '${frontend}'.\x1b[0m`);
    return;
  }
  fse.ensureDirSync(projectPath);
  console.log(`[rapidfire] Scaffolding standalone ${normFe.toUpperCase()} project in ${targetFolder}...`);
  feAdapter(projectPath, { port: 3000, isStandalone: true, appName: targetFolder });
  fse.writeFileSync(path.join(projectPath, '.gitignore'), `node_modules/\ndist/\n.env\n`, 'utf8');
  writeManifest(projectPath, { frontend: normFe, backend: null, folderName: targetFolder });
  await initGitAndHooks(projectPath, targetFolder, context);

  if (context && (context.ask || context.rl || process.env.RAPIDFIRE_AUTO_GH)) {
    await maybePromptForGithubRepo(projectPath, targetFolder, context);
  }

  reportSuccess(targetFolder, normFe);
}


function reportSuccess(folderName, stack) {
  console.log(`\n\x1b[32m╔════════════════════════════════════════════════════╗\x1b[0m`);
  console.log(`\x1b[32m║  Project '${folderName}' (${stack}) ready!  ║\x1b[0m`);
  console.log(`\x1b[32m╚════════════════════════════════════════════════════╝\x1b[0m\n`);

  console.log(`Next steps:`);
  console.log(`  \x1b[1m\x1b[32m• Run full-stack application now:\x1b[0m run ${folderName}`);
  console.log(`  \x1b[36m• Inspect code & architecture:\x1b[0m    explain ${folderName}`);
  console.log(`  \x1b[36m• Navigate into folder:\x1b[0m           cd ${folderName}`);
  console.log(`  \x1b[35m• Save as preset anytime:\x1b[0m         save preset <name> ${folderName}`);
}

module.exports = {
  handleSetup,
  maybePromptForVenv
};
