const path = require('path');
const fse = require('fs-extra');
const { run } = require('../../utils/proc');

function normalizeFrontendName(name) {
  if (!name || typeof name !== 'string') return '';
  const s = name.toLowerCase().trim();
  if (s === 'reactjs') return 'react';
  if (s === 'vuejs') return 'vue';
  if (s === 'solidjs') return 'solid';
  if (s === 'preactjs') return 'preact';
  if (s === 'nextjs') return 'next';
  if (s === 'nuxtjs') return 'nuxt';
  if (s === 'html' || s === 'static') return 'vanilla';
  return s;
}

function runNpmInstall(dir, name) {
  if (process.env.RAPIDFIRE_SKIP_INSTALL !== '1') {
    console.log(`[rapidfire] Installing ${name} frontend dependencies from LTS...`);
    try {
      run('npm install', { cwd: dir, stdio: 'pipe' });
      console.log(`[rapidfire] ${name} frontend ready.`);
    } catch (err) {
      try {
        run('npm install --legacy-peer-deps', { cwd: dir, stdio: 'pipe' });
        console.log(`[rapidfire] ${name} frontend ready.`);
      } catch (innerErr) {
        console.warn('\x1b[33m[rapidfire] npm install notice:\x1b[0m', innerErr.message);
      }
    }
  } else {
    console.log(`[rapidfire] ${name} frontend ready.`);
  }
}

function scaffoldViteReact(frontendDir, options = {}) {
  fse.ensureDirSync(frontendDir);
  console.log(`[rapidfire] Scaffolding React (Vite) frontend in ${frontendDir}...`);
  scaffoldViteReactFallback(frontendDir, options);
  runNpmInstall(frontendDir, 'React');
}

function scaffoldViteReactFallback(frontendDir, options = {}) {
  const port = options.port || 3000;
  const isStandalone = options.isStandalone || false;
  const apiPort = options.apiPort || 8000;
  const altPort = apiPort === 8000 ? 5000 : 8000;
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
export default defineConfig({ plugins: [react()], server: { port: ${port} } });
`, 'utf8');
  const publicDir = path.join(frontendDir, 'public');
  fse.ensureDirSync(publicDir);
  fse.writeFileSync(path.join(publicDir, 'favicon.ico'), '', 'utf8');
  fse.writeFileSync(path.join(frontendDir, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><title>Rapidfire React</title></head>
<body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>
`, 'utf8');
  fse.writeFileSync(path.join(frontendDir, '.env.example'), `VITE_API_URL=http://localhost:${apiPort}\n`, 'utf8');
  const srcDir = path.join(frontendDir, 'src');
  fse.ensureDirSync(srcDir);
  fse.writeFileSync(path.join(srcDir, 'index.css'), `body { margin: 0; background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; display: flex; min-height: 100vh; align-items: center; justify-content: center; }`, 'utf8');
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
      <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2rem' }}>High-performance React 18 single-page application scaffolded with Vite and GitLeaks security.</p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }} onClick={() => setCount(c => c + 1)}>State Counter: {count}</button>
      </div>
    </div>
  );
}
` : `import React, { useState } from 'react';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:${apiPort}';

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
        res = await fetch('http://localhost:${altPort}/api/health');
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
      <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2rem' }}>Frontend (React 18 Vite) connected to Backend API with pre-configured CORS and GitLeaks security.</p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }} onClick={() => setCount(c => c + 1)}>State Counter: {count}</button>
        <button style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', background: '#059669', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }} onClick={testBackendApi} disabled={loading}>{loading ? 'Pinging Backend...' : 'Test Backend API (/api/health)'}</button>
      </div>
      {apiResponse && (
        <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: '8px', background: apiResponse.status === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: '1px solid ' + (apiResponse.status === 'success' ? '#10b981' : '#ef4444'), textAlign: 'left', fontFamily: 'monospace', fontSize: '0.85rem' }}>
          <div style={{ fontWeight: 'bold', color: apiResponse.status === 'success' ? '#34d399' : '#f87171', marginBottom: '0.35rem' }}>
            {apiResponse.status === 'success' ? '[200 OK] Backend Microservice Connected!' : '[OFFLINE] Backend Server Offline (Run backend server)'}
          </div>
          <pre style={{ margin: 0, color: '#e2e8f0' }}>{JSON.stringify(apiResponse.data || { error: apiResponse.error }, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
`;
  fse.writeFileSync(path.join(srcDir, 'App.jsx'), appContent, 'utf8');
  fse.writeFileSync(path.join(srcDir, 'main.jsx'), `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nimport './index.css';\nReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);\n`, 'utf8');
}

function scaffoldViteVue(frontendDir, options = {}) {
  fse.ensureDirSync(frontendDir);
  console.log(`[rapidfire] Scaffolding Vue 3 (Vite) frontend in ${frontendDir}...`);
  scaffoldViteVueFallback(frontendDir, options);
  runNpmInstall(frontendDir, 'Vue');
}

function scaffoldViteVueFallback(frontendDir, options = {}) {
  const port = options.port || 3000;
  const isStandalone = options.isStandalone || false;
  const apiPort = options.apiPort || 8000;
  const altPort = apiPort === 8000 ? 5000 : 8000;
  const pkgJson = {
    name: 'frontend',
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
    dependencies: { vue: '^3.5.13' },
    devDependencies: { '@vitejs/plugin-vue': '^5.2.1', vite: '^5.4.11' }
  };
  fse.writeJsonSync(path.join(frontendDir, 'package.json'), pkgJson, { spaces: 2 });
  fse.writeFileSync(path.join(frontendDir, 'vite.config.js'), `import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig({ plugins: [vue()], server: { port: ${port} } });
`, 'utf8');
  const publicDir = path.join(frontendDir, 'public');
  fse.ensureDirSync(publicDir);
  fse.writeFileSync(path.join(publicDir, 'favicon.ico'), '', 'utf8');
  fse.writeFileSync(path.join(frontendDir, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><title>Rapidfire Vue</title></head>
<body><div id="app"></div><script type="module" src="/src/main.js"></script></body></html>
`, 'utf8');
  fse.writeFileSync(path.join(frontendDir, '.env.example'), `VITE_API_URL=http://localhost:${apiPort}\n`, 'utf8');
  const srcDir = path.join(frontendDir, 'src');
  fse.ensureDirSync(srcDir);
  const appVueContent = isStandalone ? `<script setup>
import { ref } from 'vue';
const count = ref(0);
</script>
<template>
  <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; padding: 1rem;">
    <div style="max-width: 640px; width: 90%; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 2.5rem; text-align: center;">
      <div style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; background: rgba(6,182,212,0.15); color: #06b6d4; font-size: 0.75rem; font-weight: bold; margin-bottom: 1rem;">[STANDALONE] Single-Page Application</div>
      <h1 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 0.5rem; color: #42b883;">RapidFire Vue Application</h1>
      <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem;">Vue 3 Single-Page Application scaffolded cleanly with Vite.</p>
      <button style="padding: 0.75rem 1.5rem; border-radius: 8px; background: #42b883; color: #0f172a; border: none; font-weight: 600; cursor: pointer;" @click="count++">State Counter: {{ count }}</button>
    </div>
  </div>
</template>
` : `<script setup>
import { ref } from 'vue';
const count = ref(0);
const apiResponse = ref(null);
const loading = ref(false);
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:${apiPort}';

async function testBackendApi() {
  loading.value = true;
  try {
    let res;
    try {
      res = await fetch(API_URL + '/api/health');
    } catch {
      res = await fetch('http://localhost:${altPort}/api/health');
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
    <div style="max-width: 640px; width: 90%; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 2.5rem; text-align: center;">
      <div style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; background: rgba(6,182,212,0.15); color: #06b6d4; font-size: 0.75rem; font-weight: bold; margin-bottom: 1rem;">[ARCH] Dual-Tier Microservice Architecture</div>
      <h1 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 0.5rem; color: #42b883;">RapidFire Full-Stack Application</h1>
      <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem;">Frontend (Vue 3 Vite) connected to Backend API with pre-configured CORS.</p>
      <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 1.5rem; flex-wrap: wrap;">
        <button style="padding: 0.75rem 1.5rem; border-radius: 8px; background: #42b883; color: #0f172a; border: none; font-weight: 600; cursor: pointer;" @click="count++">State Counter: {{ count }}</button>
        <button style="padding: 0.75rem 1.5rem; border-radius: 8px; background: #059669; color: #fff; border: none; font-weight: 600; cursor: pointer;" @click="testBackendApi" :disabled="loading">{{ loading ? 'Pinging Backend...' : 'Test Backend API (/api/health)' }}</button>
      </div>
      <div v-if="apiResponse" style="margin-top: 1.5rem; padding: 1rem; border-radius: 8px; text-align: left; font-family: monospace; font-size: 0.85rem;" :style="{ background: apiResponse.status === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: '1px solid ' + (apiResponse.status === 'success' ? '#10b981' : '#ef4444') }">
        <div :style="{ color: apiResponse.status === 'success' ? '#34d399' : '#f87171', fontWeight: 'bold' }">{{ apiResponse.status === 'success' ? '[200 OK] Backend Microservice Connected!' : '[OFFLINE] Backend Server Offline' }}</div>
        <pre style="margin: 0; color: #e2e8f0;">{{ JSON.stringify(apiResponse.data || { error: apiResponse.error }, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>
`;
  fse.writeFileSync(path.join(srcDir, 'App.vue'), appVueContent, 'utf8');
  fse.writeFileSync(path.join(srcDir, 'main.js'), `import { createApp } from 'vue';\nimport App from './App.vue';\ncreateApp(App).mount('#app');\n`, 'utf8');
}

function scaffoldViteSvelte(frontendDir, options = {}) {
  fse.ensureDirSync(frontendDir);
  console.log(`[rapidfire] Scaffolding Svelte (Vite) frontend in ${frontendDir}...`);
  scaffoldViteSvelteFallback(frontendDir, options);
  runNpmInstall(frontendDir, 'Svelte');
}

function scaffoldViteSvelteFallback(frontendDir, options = {}) {
  const port = options.port || 3000;
  const isStandalone = options.isStandalone || false;
  const apiPort = options.apiPort || 8000;
  const altPort = apiPort === 8000 ? 5000 : 8000;
  const pkgJson = {
    name: 'frontend',
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
    devDependencies: { '@sveltejs/vite-plugin-svelte': '^4.0.0', svelte: '^5.0.0', vite: '^5.4.11' }
  };
  fse.writeJsonSync(path.join(frontendDir, 'package.json'), pkgJson, { spaces: 2 });
  fse.writeFileSync(path.join(frontendDir, 'vite.config.js'), `import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
export default defineConfig({ plugins: [svelte()], server: { port: ${port} } });
`, 'utf8');
  const publicDir = path.join(frontendDir, 'public');
  fse.ensureDirSync(publicDir);
  fse.writeFileSync(path.join(publicDir, 'favicon.ico'), '', 'utf8');
  fse.writeFileSync(path.join(frontendDir, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><link rel="icon" type="image/x-icon" href="/favicon.ico" /><title>Rapidfire Svelte</title></head>
<body><div id="app"></div><script type="module" src="/src/main.js"></script></body></html>
`, 'utf8');
  fse.writeFileSync(path.join(frontendDir, '.env.example'), `VITE_API_URL=http://localhost:${apiPort}\n`, 'utf8');
  const srcDir = path.join(frontendDir, 'src');
  fse.ensureDirSync(srcDir);
  const appSvelteContent = isStandalone ? `<script>
  let count = $state(0);
</script>
<div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; padding: 1rem;">
  <div style="max-width: 640px; width: 90%; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 2.5rem; text-align: center;">
    <div style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; background: rgba(6,182,212,0.15); color: #06b6d4; font-size: 0.75rem; font-weight: bold; margin-bottom: 1rem;">[STANDALONE] Single-Page Application</div>
    <h1 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 0.5rem; color: #ff3e00;">RapidFire Svelte Application</h1>
    <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem;">Svelte 5 application scaffolded with Vite and Runes.</p>
    <button style="padding: 0.75rem 1.5rem; border-radius: 8px; background: #ff3e00; color: white; border: none; font-weight: 600; cursor: pointer;" onclick={() => count++}>State Counter: {count}</button>
  </div>
</div>
` : `<script>
  let count = $state(0);
  let apiResponse = $state(null);
  let loading = $state(false);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:${apiPort}';

  async function testBackendApi() {
    loading = true;
    try {
      let res;
      try {
        res = await fetch(API_URL + '/api/health');
      } catch {
        res = await fetch('http://localhost:${altPort}/api/health');
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
  <div style="max-width: 640px; width: 90%; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 2.5rem; text-align: center;">
    <div style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; background: rgba(6,182,212,0.15); color: #06b6d4; font-size: 0.75rem; font-weight: bold; margin-bottom: 1rem;">[ARCH] Dual-Tier Microservice Architecture</div>
    <h1 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 0.5rem; color: #ff3e00;">RapidFire Full-Stack Application</h1>
    <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem;">Frontend (Svelte 5 Vite) connected to Backend API with pre-configured CORS.</p>
    <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 1.5rem; flex-wrap: wrap;">
      <button style="padding: 0.75rem 1.5rem; border-radius: 8px; background: #ff3e00; color: #fff; border: none; font-weight: 600; cursor: pointer;" onclick={() => count++}>State Counter: {count}</button>
      <button style="padding: 0.75rem 1.5rem; border-radius: 8px; background: #059669; color: #fff; border: none; font-weight: 600; cursor: pointer;" onclick={testBackendApi} disabled={loading}>{loading ? 'Pinging Backend...' : 'Test Backend API (/api/health)'}</button>
    </div>
    {#if apiResponse}
      <div style="margin-top: 1.5rem; padding: 1rem; border-radius: 8px; text-align: left; font-family: monospace; font-size: 0.85rem; background: {apiResponse.status === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; border: 1px solid {apiResponse.status === 'success' ? '#10b981' : '#ef4444'};">
        <div style="font-weight: bold; color: {apiResponse.status === 'success' ? '#34d399' : '#f87171'}; margin-bottom: 0.35rem;">{apiResponse.status === 'success' ? '[200 OK] Backend Microservice Connected!' : '[OFFLINE] Backend Server Offline'}</div>
        <pre style="margin: 0; color: #e2e8f0;">{JSON.stringify(apiResponse.data || { error: apiResponse.error }, null, 2)}</pre>
      </div>
    {/if}
  </div>
</div>
`;
  fse.writeFileSync(path.join(srcDir, 'App.svelte'), appSvelteContent, 'utf8');
  fse.writeFileSync(path.join(srcDir, 'main.js'), `import { mount } from 'svelte';\nimport App from './App.svelte';\nconst app = mount(App, { target: document.getElementById('app') });\nexport default app;\n`, 'utf8');
}

function scaffoldViteAngular(frontendDir, options = {}) {
  fse.ensureDirSync(frontendDir);
  console.log(`[rapidfire] Scaffolding Angular (Vite) frontend in ${frontendDir}...`);
  scaffoldViteAngularFallback(frontendDir, options);
  runNpmInstall(frontendDir, 'Angular');
}

function scaffoldViteAngularFallback(frontendDir, options = {}) {
  const port = options.port || 3000;
  const isStandalone = options.isStandalone || false;
  const apiPort = options.apiPort || 8000;
  const altPort = apiPort === 8000 ? 5000 : 8000;
  const pkgJson = {
    name: 'frontend',
    version: '0.0.0',
    type: 'module',
    scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
    dependencies: {
      '@angular/common': '^18.2.0',
      '@angular/compiler': '^18.2.0',
      '@angular/core': '^18.2.0',
      '@angular/platform-browser': '^18.2.0',
      '@angular/router': '^18.2.0',
      rxjs: '^7.8.1',
      'zone.js': '^0.14.10'
    },
    devDependencies: {
      '@analogjs/vite-plugin-angular': '^1.10.0',
      '@angular/build': '^18.2.0',
      '@angular/compiler-cli': '^18.2.0',
      typescript: '^5.5.0',
      vite: '^6.0.0'
    }
  };
  fse.writeJsonSync(path.join(frontendDir, 'package.json'), pkgJson, { spaces: 2 });
  fse.writeFileSync(path.join(frontendDir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      useDefineForClassFields: false,
      module: 'ESNext',
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      moduleResolution: 'Node',
      strict: false,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      skipLibCheck: true
    },
    include: ['src/**/*.ts']
  }, null, 2), 'utf8');
  fse.writeFileSync(path.join(frontendDir, 'tsconfig.app.json'), JSON.stringify({
    extends: './tsconfig.json',
    compilerOptions: {
      outDir: './out-tsc/app',
      types: []
    },
    files: ['src/main.ts'],
    include: ['src/**/*.d.ts']
  }, null, 2), 'utf8');
  fse.writeFileSync(path.join(frontendDir, 'vite.config.ts'), `import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
export default defineConfig({ plugins: [angular()], server: { port: ${port} } });
`, 'utf8');
  const publicDir = path.join(frontendDir, 'public');
  fse.ensureDirSync(publicDir);
  fse.writeFileSync(path.join(publicDir, 'favicon.ico'), '', 'utf8');
  fse.writeFileSync(path.join(frontendDir, 'index.html'), `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><title>Rapidfire Angular</title><meta name="viewport" content="width=device-width, initial-scale=1" /><link rel="icon" type="image/x-icon" href="/favicon.ico" /></head><body style="margin:0; background:#0f172a; color:#f8fafc; font-family:system-ui, sans-serif;"><app-root></app-root><script type="module" src="/src/main.ts"></script></body></html>\n`, 'utf8');
  fse.writeFileSync(path.join(frontendDir, '.env.example'), `VITE_API_URL=http://localhost:${apiPort}\n`, 'utf8');
  const srcDir = path.join(frontendDir, 'src');
  const appDir = path.join(srcDir, 'app');
  fse.ensureDirSync(appDir);
  fse.writeFileSync(path.join(srcDir, 'styles.css'), `html, body { height: 100%; margin: 0; background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; }\n`, 'utf8');
  fse.writeFileSync(path.join(appDir, 'app.routes.ts'), `import { Routes } from '@angular/router';\nexport const routes: Routes = [];\n`, 'utf8');
  fse.writeFileSync(path.join(appDir, 'app.config.ts'), `import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';\nimport { provideHttpClient } from '@angular/common/http';\nimport { provideRouter } from '@angular/router';\nimport { routes } from './app.routes';\nexport const appConfig: ApplicationConfig = {\n  providers: [\n    provideZoneChangeDetection({ eventCoalescing: true }),\n    provideHttpClient(),\n    provideRouter(routes)\n  ]\n};\n`, 'utf8');
  fse.writeFileSync(path.join(srcDir, 'main.ts'), `import 'zone.js';\nimport { bootstrapApplication } from '@angular/platform-browser';\nimport { appConfig } from './app/app.config';\nimport { AppComponent } from './app/app.component';\nimport './styles.css';\nbootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));\n`, 'utf8');
  const appComponentTs = isStandalone ? `import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  template: \`
    <div style="max-width: 640px; margin: 4rem auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 2.5rem; text-align: center; color: #f8fafc; font-family: system-ui;">
      <div style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; background: rgba(6,182,212,0.15); color: #06b6d4; font-size: 0.75rem; font-weight: bold; margin-bottom: 1rem;">[STANDALONE] Single-Page Application</div>
      <h1 style="font-size: 1.8rem; margin-bottom: 0.5rem; color: #dd0031;">RapidFire Angular Application</h1>
      <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem;">Angular 18 standalone components scaffolded with Vite and Signals.</p>
      <button style="padding: 0.75rem 1.5rem; border-radius: 8px; background: #dd0031; color: #fff; border: none; font-weight: 600; cursor: pointer;" (click)="increment()">State Counter: {{ count() }}</button>
    </div>
  \`
})
export class AppComponent {
  count = signal(0);
  increment() { this.count.update(c => c + 1); }
}
` : `import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

const API_URL = 'http://localhost:${apiPort}';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  template: \`
    <div style="max-width: 640px; margin: 4rem auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 2.5rem; text-align: center; color: #f8fafc; font-family: system-ui;">
      <div style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; background: rgba(6,182,212,0.15); color: #06b6d4; font-size: 0.75rem; font-weight: bold; margin-bottom: 1rem;">[ARCH] Dual-Tier Microservice Architecture</div>
      <h1 style="font-size: 1.8rem; margin-bottom: 0.5rem; color: #dd0031;">RapidFire Full-Stack Application</h1>
      <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem;">Frontend (Angular 18 Vite) connected to Backend API with pre-configured CORS.</p>
      <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 1.5rem;">
        <button style="padding: 0.75rem 1.5rem; border-radius: 8px; background: #dd0031; color: #fff; border: none; font-weight: 600; cursor: pointer;" (click)="increment()">State Counter: {{ count() }}</button>
        <button style="padding: 0.75rem 1.5rem; border-radius: 8px; background: #059669; color: #fff; border: none; font-weight: 600; cursor: pointer;" (click)="testBackendApi()" [disabled]="loading()">{{ loading() ? 'Pinging Backend...' : 'Test Backend API (/api/health)' }}</button>
      </div>
      <div *ngIf="apiResponse()" style="margin-top: 1.5rem; padding: 1rem; border-radius: 8px; text-align: left; font-family: monospace; font-size: 0.85rem;" [style.background]="apiResponse().status === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'" [style.border]="apiResponse().status === 'success' ? '1px solid #10b981' : '1px solid #ef4444'">
        <div [style.color]="apiResponse().status === 'success' ? '#34d399' : '#f87171'" style="font-weight: bold;">{{ apiResponse().status === 'success' ? '[200 OK] Backend Microservice Connected!' : '[OFFLINE] Backend Server Offline' }}</div>
        <pre style="margin: 0.5rem 0 0 0; color: #e2e8f0;">{{ apiResponse().data | json }}</pre>
      </div>
    </div>
  \`
})
export class AppComponent {
  count = signal(0);
  apiResponse = signal<any>(null);
  loading = signal(false);

  increment() { this.count.update(c => c + 1); }

  async testBackendApi() {
    this.loading.set(true);
    try {
      let res;
      try {
        res = await fetch(API_URL + '/api/health');
      } catch {
        res = await fetch('http://localhost:${altPort}/api/health');
      }
      const data = await res.json();
      this.apiResponse.set({ status: 'success', data });
    } catch (err: any) {
      this.apiResponse.set({ status: 'offline', data: { error: err.message } });
    } finally {
      this.loading.set(false);
    }
  }
}
`;
  fse.writeFileSync(path.join(appDir, 'app.component.ts'), appComponentTs, 'utf8');
}

function scaffoldViteSolid(frontendDir, options = {}) {
  fse.ensureDirSync(frontendDir);
  console.log(`[rapidfire] Scaffolding SolidJS (Vite) frontend in ${frontendDir}...`);
  scaffoldViteSolidFallback(frontendDir, options);
  runNpmInstall(frontendDir, 'SolidJS');
}

function scaffoldViteSolidFallback(frontendDir, options = {}) {
  const port = options.port || 3000;
  const isStandalone = options.isStandalone || false;
  const apiPort = options.apiPort || 8000;
  const altPort = apiPort === 8000 ? 5000 : 8000;
  const pkgJson = {
    name: 'frontend',
    version: '0.0.0',
    type: 'module',
    scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
    dependencies: { 'solid-js': '^1.9.0' },
    devDependencies: { vite: '^5.4.0', 'vite-plugin-solid': '^2.11.0' }
  };
  fse.writeJsonSync(path.join(frontendDir, 'package.json'), pkgJson, { spaces: 2 });
  fse.writeFileSync(path.join(frontendDir, 'vite.config.js'), `import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
export default defineConfig({ plugins: [solidPlugin()], server: { port: ${port} } });
`, 'utf8');
  const publicDir = path.join(frontendDir, 'public');
  fse.ensureDirSync(publicDir);
  fse.writeFileSync(path.join(publicDir, 'favicon.ico'), '', 'utf8');
  fse.writeFileSync(path.join(frontendDir, 'index.html'), `<!DOCTYPE html><html lang="en"><head><title>Rapidfire Solid</title><link rel="icon" type="image/x-icon" href="/favicon.ico" /></head><body><div id="root"></div><script type="module" src="/src/index.jsx"></script></body></html>\n`, 'utf8');
  fse.writeFileSync(path.join(frontendDir, '.env.example'), `VITE_API_URL=http://localhost:${apiPort}\n`, 'utf8');
  const srcDir = path.join(frontendDir, 'src');
  fse.ensureDirSync(srcDir);
  fse.writeFileSync(path.join(srcDir, 'index.jsx'), `import { render } from 'solid-js/web';\nimport App from './App';\nrender(() => <App />, document.getElementById('root'));\n`, 'utf8');
  const appJsx = isStandalone ? `import { createSignal } from 'solid-js';

export default function App() {
  const [count, setCount] = createSignal(0);
  return (
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; color: #f8fafc; font-family: system-ui;">
      <div style="max-width: 640px; width: 90%; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 2.5rem; text-align: center;">
        <div style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; background: rgba(6,182,212,0.15); color: #06b6d4; font-size: 0.75rem; font-weight: bold; margin-bottom: 1rem;">[STANDALONE] Single-Page Application</div>
        <h1 style="font-size: 1.8rem; margin-bottom: 0.5rem; color: #446b9e;">RapidFire SolidJS Application</h1>
        <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem;">SolidJS application scaffolded with fine-grained reactivity and Vite.</p>
        <button style="padding: 0.75rem 1.5rem; border-radius: 8px; background: #446b9e; color: #fff; border: none; font-weight: 600; cursor: pointer;" onClick={() => setCount(c => c + 1)}>State Counter: {count()}</button>
      </div>
    </div>
  );
}
` : `import { createSignal, Show } from 'solid-js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:${apiPort}';

export default function App() {
  const [count, setCount] = createSignal(0);
  const [apiResponse, setApiResponse] = createSignal(null);
  const [loading, setLoading] = createSignal(false);

  const testBackendApi = async () => {
    setLoading(true);
    try {
      let res;
      try {
        res = await fetch(API_URL + '/api/health');
      } catch {
        res = await fetch('http://localhost:${altPort}/api/health');
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
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; color: #f8fafc; font-family: system-ui;">
      <div style="max-width: 640px; width: 90%; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 2.5rem; text-align: center;">
        <div style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; background: rgba(6,182,212,0.15); color: #06b6d4; font-size: 0.75rem; font-weight: bold; margin-bottom: 1rem;">[ARCH] Dual-Tier Microservice Architecture</div>
        <h1 style="font-size: 1.8rem; margin-bottom: 0.5rem; color: #446b9e;">RapidFire Full-Stack Application</h1>
        <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem;">Frontend (SolidJS Vite) connected to Backend API with pre-configured CORS.</p>
        <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 1.5rem; flex-wrap: wrap;">
          <button style="padding: 0.75rem 1.5rem; border-radius: 8px; background: #446b9e; color: #fff; border: none; font-weight: 600; cursor: pointer;" onClick={() => setCount(c => c + 1)}>State Counter: {count()}</button>
          <button style="padding: 0.75rem 1.5rem; border-radius: 8px; background: #059669; color: #fff; border: none; font-weight: 600; cursor: pointer;" onClick={testBackendApi} disabled={loading()}>{loading() ? 'Pinging Backend...' : 'Test Backend API (/api/health)'}</button>
        </div>
        <Show when={apiResponse()}>
          <div style="margin-top: 1.5rem; padding: 1rem; border-radius: 8px; text-align: left; font-family: monospace; font-size: 0.85rem;" style={{ background: apiResponse().status === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: '1px solid ' + (apiResponse().status === 'success' ? '#10b981' : '#ef4444') }}>
            <div style={{ color: apiResponse().status === 'success' ? '#34d399' : '#f87171', 'font-weight': 'bold' }}>{apiResponse().status === 'success' ? '[200 OK] Backend Microservice Connected!' : '[OFFLINE] Backend Server Offline'}</div>
            <pre style="margin: 0; color: #e2e8f0;">{JSON.stringify(apiResponse().data || { error: apiResponse().error }, null, 2)}</pre>
          </div>
        </Show>
      </div>
    </div>
  );
}
`;
  fse.writeFileSync(path.join(srcDir, 'App.jsx'), appJsx, 'utf8');
}

function scaffoldVitePreact(frontendDir, options = {}) {
  fse.ensureDirSync(frontendDir);
  console.log(`[rapidfire] Scaffolding Preact (Vite) frontend in ${frontendDir}...`);
  scaffoldVitePreactFallback(frontendDir, options);
  runNpmInstall(frontendDir, 'Preact');
}

function scaffoldVitePreactFallback(frontendDir, options = {}) {
  const port = options.port || 3000;
  const isStandalone = options.isStandalone || false;
  const apiPort = options.apiPort || 8000;
  const altPort = apiPort === 8000 ? 5000 : 8000;
  const pkgJson = {
    name: 'frontend',
    version: '0.0.0',
    type: 'module',
    scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
    dependencies: { preact: '^10.24.0' },
    devDependencies: { '@preact/preset-vite': '^2.9.0', vite: '^5.4.0' }
  };
  fse.writeJsonSync(path.join(frontendDir, 'package.json'), pkgJson, { spaces: 2 });
  fse.writeFileSync(path.join(frontendDir, 'vite.config.js'), `import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
export default defineConfig({ plugins: [preact()], server: { port: ${port} } });
`, 'utf8');
  const publicDir = path.join(frontendDir, 'public');
  fse.ensureDirSync(publicDir);
  fse.writeFileSync(path.join(publicDir, 'favicon.ico'), '', 'utf8');
  fse.writeFileSync(path.join(frontendDir, 'index.html'), `<!DOCTYPE html><html lang="en"><head><title>Rapidfire Preact</title><link rel="icon" type="image/x-icon" href="/favicon.ico" /></head><body><div id="app"></div><script type="module" src="/src/main.jsx"></script></body></html>\n`, 'utf8');
  fse.writeFileSync(path.join(frontendDir, '.env.example'), `VITE_API_URL=http://localhost:${apiPort}\n`, 'utf8');
  const srcDir = path.join(frontendDir, 'src');
  fse.ensureDirSync(srcDir);
  fse.writeFileSync(path.join(srcDir, 'main.jsx'), `import { render } from 'preact';\nimport { App } from './App';\nrender(<App />, document.getElementById('app'));\n`, 'utf8');
  const appJsx = isStandalone ? `import { useState } from 'preact/hooks';

export function App() {
  const [count, setCount] = useState(0);
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: '640px', width: '90%', background: '#131b2e', border: '1px solid #1e293b', borderRadius: '16px', padding: '2.5rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '999px', background: 'rgba(6,182,212,0.15)', color: '#06b6d4', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '1rem' }}>[STANDALONE] Single-Page Application</div>
        <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', color: '#673ab8' }}>RapidFire Preact Application</h1>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2rem' }}>Fast 3kB alternative to React with the same modern API.</p>
        <button style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', background: '#673ab8', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }} onClick={() => setCount(c => c + 1)}>State Counter: {count}</button>
      </div>
    </div>
  );
}
` : `import { useState } from 'preact/hooks';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:${apiPort}';

export function App() {
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
        res = await fetch('http://localhost:${altPort}/api/health');
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: '640px', width: '90%', background: '#131b2e', border: '1px solid #1e293b', borderRadius: '16px', padding: '2.5rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '999px', background: 'rgba(6,182,212,0.15)', color: '#06b6d4', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '1rem' }}>[ARCH] Dual-Tier Microservice Architecture</div>
        <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', color: '#673ab8' }}>RapidFire Full-Stack Application</h1>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2rem' }}>Frontend (Preact Vite) connected to Backend API with pre-configured CORS.</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <button style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', background: '#673ab8', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }} onClick={() => setCount(c => c + 1)}>State Counter: {count}</button>
          <button style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', background: '#059669', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }} onClick={testBackendApi} disabled={loading}>{loading ? 'Pinging Backend...' : 'Test Backend API (/api/health)'}</button>
        </div>
        {apiResponse && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: '8px', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.85rem', background: apiResponse.status === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: '1px solid ' + (apiResponse.status === 'success' ? '#10b981' : '#ef4444') }}>
            <div style={{ color: apiResponse.status === 'success' ? '#34d399' : '#f87171', fontWeight: 'bold' }}>{apiResponse.status === 'success' ? '[200 OK] Backend Microservice Connected!' : '[OFFLINE] Backend Server Offline'}</div>
            <pre style={{ margin: 0, color: '#e2e8f0' }}>{JSON.stringify(apiResponse.data || { error: apiResponse.error }, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
`;
  fse.writeFileSync(path.join(srcDir, 'App.jsx'), appJsx, 'utf8');
}

function scaffoldViteQwik(frontendDir, options = {}) {
  fse.ensureDirSync(frontendDir);
  console.log(`[rapidfire] Scaffolding Qwik (Vite) frontend in ${frontendDir}...`);
  scaffoldViteQwikFallback(frontendDir, options);
  runNpmInstall(frontendDir, 'Qwik');
}

function scaffoldViteQwikFallback(frontendDir, options = {}) {
  const port = options.port || 3000;
  const isStandalone = options.isStandalone || false;
  const apiPort = options.apiPort || 8000;
  const pkgJson = {
    name: 'frontend',
    version: '0.0.0',
    type: 'module',
    scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
    dependencies: { '@builder.io/qwik': '^1.10.0' },
    devDependencies: { '@builder.io/qwik/optimizer': '^1.10.0', vite: '^5.4.0' }
  };
  fse.writeJsonSync(path.join(frontendDir, 'package.json'), pkgJson, { spaces: 2 });
  fse.writeFileSync(path.join(frontendDir, 'vite.config.js'), `import { defineConfig } from 'vite';
import { qwikVite } from '@builder.io/qwik/optimizer';
export default defineConfig({ plugins: [qwikVite()], server: { port: ${port} } });
`, 'utf8');
  const publicDir = path.join(frontendDir, 'public');
  fse.ensureDirSync(publicDir);
  fse.writeFileSync(path.join(publicDir, 'favicon.ico'), '', 'utf8');
  fse.writeFileSync(path.join(frontendDir, 'index.html'), `<!DOCTYPE html><html lang="en"><head><title>Rapidfire Qwik</title><link rel="icon" type="image/x-icon" href="/favicon.ico" /></head><body><div id="qwik-root"></div><script type="module" src="/src/main.jsx"></script></body></html>\n`, 'utf8');
  fse.writeFileSync(path.join(frontendDir, '.env.example'), `VITE_API_URL=http://localhost:${apiPort}\n`, 'utf8');
  const srcDir = path.join(frontendDir, 'src');
  fse.ensureDirSync(srcDir);
  fse.writeFileSync(path.join(srcDir, 'main.jsx'), `import { render } from '@builder.io/qwik';\nimport App from './app';\nrender(document.getElementById('qwik-root'), <App />);\n`, 'utf8');
  fse.writeFileSync(path.join(srcDir, 'app.jsx'), `import { component$, useSignal } from '@builder.io/qwik';

export default component$(() => {
  const count = useSignal(0);
  return (
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; color: #f8fafc; font-family: system-ui;">
      <div style="max-width: 640px; width: 90%; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 2.5rem; text-align: center;">
        <h1 style="font-size: 1.8rem; margin-bottom: 0.5rem; color: #006ce9;">RapidFire Qwik Application</h1>
        <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem;">Resumable full-stack frontend scaffolded cleanly.</p>
        <button style="padding: 0.75rem 1.5rem; border-radius: 8px; background: #006ce9; color: #fff; border: none; font-weight: 600; cursor: pointer;" onClick$={() => count.value++}>State Counter: {count.value}</button>
      </div>
    </div>
  );
});
`, 'utf8');
}

function scaffoldViteLit(frontendDir, options = {}) {
  fse.ensureDirSync(frontendDir);
  console.log(`[rapidfire] Scaffolding Lit (Vite) frontend in ${frontendDir}...`);
  scaffoldViteLitFallback(frontendDir, options);
  runNpmInstall(frontendDir, 'Lit');
}

function scaffoldViteLitFallback(frontendDir, options = {}) {
  const port = options.port || 3000;
  const isStandalone = options.isStandalone || false;
  const apiPort = options.apiPort || 8000;
  const altPort = apiPort === 8000 ? 5000 : 8000;
  const pkgJson = {
    name: 'frontend',
    version: '0.0.0',
    type: 'module',
    scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
    dependencies: { lit: '^3.2.0' },
    devDependencies: { vite: '^5.4.0' }
  };
  fse.writeJsonSync(path.join(frontendDir, 'package.json'), pkgJson, { spaces: 2 });
  fse.writeFileSync(path.join(frontendDir, 'vite.config.js'), `import { defineConfig } from 'vite';
export default defineConfig({ server: { port: ${port} } });
`, 'utf8');
  const publicDir = path.join(frontendDir, 'public');
  fse.ensureDirSync(publicDir);
  fse.writeFileSync(path.join(publicDir, 'favicon.ico'), '', 'utf8');
  fse.writeFileSync(path.join(frontendDir, 'index.html'), `<!DOCTYPE html><html lang="en"><head><title>Rapidfire Lit</title><link rel="icon" type="image/x-icon" href="/favicon.ico" /></head><body style="margin:0; background:#0f172a;"><rapidfire-app></rapidfire-app><script type="module" src="/src/app.js"></script></body></html>\n`, 'utf8');
  fse.writeFileSync(path.join(frontendDir, '.env.example'), `VITE_API_URL=http://localhost:${apiPort}\n`, 'utf8');
  const srcDir = path.join(frontendDir, 'src');
  fse.ensureDirSync(srcDir);
  const appJs = isStandalone ? `import { LitElement, html, css } from 'lit';

export class RapidfireApp extends LitElement {
  static properties = { count: { type: Number } };
  static styles = css\`
    :host { display: flex; min-height: 100vh; align-items: center; justify-content: center; font-family: system-ui; color: #f8fafc; }
    .card { max-width: 640px; width: 90%; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 2.5rem; text-align: center; }
    button { padding: 0.75rem 1.5rem; border-radius: 8px; background: #00d8ff; color: #0f172a; border: none; font-weight: 600; cursor: pointer; }
  \`;
  constructor() { super(); this.count = 0; }
  render() {
    return html\`
      <div class="card">
        <h1 style="color: #00d8ff;">RapidFire Lit Application</h1>
        <p style="color: #94a3b8;">Lightweight Web Components with reactive state.</p>
        <button @click=\${() => this.count++}>State Counter: \${this.count}</button>
      </div>
    \`;
  }
}
customElements.define('rapidfire-app', RapidfireApp);
` : `import { LitElement, html, css } from 'lit';

const API_URL = 'http://localhost:${apiPort}';

export class RapidfireApp extends LitElement {
  static properties = {
    count: { type: Number },
    apiResponse: { type: Object },
    loading: { type: Boolean }
  };
  static styles = css\`
    :host { display: flex; min-height: 100vh; align-items: center; justify-content: center; font-family: system-ui; color: #f8fafc; }
    .card { max-width: 640px; width: 90%; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 2.5rem; text-align: center; }
    .btn { padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; }
    .btn-primary { background: #00d8ff; color: #0f172a; }
    .btn-success { background: #059669; color: #fff; }
    .box { margin-top: 1.5rem; padding: 1rem; border-radius: 8px; text-align: left; font-family: monospace; font-size: 0.85rem; }
  \`;
  constructor() {
    super();
    this.count = 0;
    this.apiResponse = null;
    this.loading = false;
  }
  async testBackendApi() {
    this.loading = true;
    try {
      let res;
      try {
        res = await fetch(API_URL + '/api/health');
      } catch {
        res = await fetch('http://localhost:${altPort}/api/health');
      }
      const data = await res.json();
      this.apiResponse = { status: 'success', data };
    } catch (err) {
      this.apiResponse = { status: 'offline', error: err.message };
    } finally {
      this.loading = false;
    }
  }
  render() {
    return html\`
      <div class="card">
        <h1 style="color: #00d8ff;">RapidFire Full-Stack Application</h1>
        <p style="color: #94a3b8;">Frontend (Lit Vite) connected to Backend API.</p>
        <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 1.5rem;">
          <button class="btn btn-primary" @click=\${() => this.count++}>State Counter: \${this.count}</button>
          <button class="btn btn-success" @click=\${() => this.testBackendApi()} ?disabled=\${this.loading}>\${this.loading ? 'Pinging Backend...' : 'Test Backend API (/api/health)'}</button>
        </div>
        \${this.apiResponse ? html\`
          <div class="box" style="background: \${this.apiResponse.status === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; border: 1px solid \${this.apiResponse.status === 'success' ? '#10b981' : '#ef4444'};">
            <div style="font-weight: bold; color: \${this.apiResponse.status === 'success' ? '#34d399' : '#f87171'};">\${this.apiResponse.status === 'success' ? '[200 OK] Backend Microservice Connected!' : '[OFFLINE] Backend Server Offline'}</div>
            <pre style="margin: 0; color: #e2e8f0;">\${JSON.stringify(this.apiResponse.data || { error: this.apiResponse.error }, null, 2)}</pre>
          </div>
        \` : ''}
      </div>
    \`;
  }
}
customElements.define('rapidfire-app', RapidfireApp);
`;
  fse.writeFileSync(path.join(srcDir, 'app.js'), appJs, 'utf8');
}

function scaffoldAstro(frontendDir, options = {}) {
  fse.ensureDirSync(frontendDir);
  console.log(`[rapidfire] Scaffolding Astro frontend in ${frontendDir}...`);
  scaffoldAstroFallback(frontendDir, options);
  runNpmInstall(frontendDir, 'Astro');
}

function scaffoldAstroFallback(frontendDir, options = {}) {
  const port = options.port || 3000;
  const isStandalone = options.isStandalone || false;
  const apiPort = options.apiPort || 8000;
  const altPort = apiPort === 8000 ? 5000 : 8000;
  const pkgJson = {
    name: 'frontend',
    type: 'module',
    version: '0.0.1',
    scripts: { dev: `astro dev --port ${port}`, start: `astro dev --port ${port}`, build: 'astro build', preview: 'astro preview' },
    dependencies: { astro: '^4.16.0' }
  };
  fse.writeJsonSync(path.join(frontendDir, 'package.json'), pkgJson, { spaces: 2 });
  fse.writeFileSync(path.join(frontendDir, 'astro.config.mjs'), `import { defineConfig } from 'astro/config';\nexport default defineConfig({ server: { port: ${port} } });\n`, 'utf8');
  const publicDir = path.join(frontendDir, 'public');
  fse.ensureDirSync(publicDir);
  fse.writeFileSync(path.join(publicDir, 'favicon.ico'), '', 'utf8');
  fse.writeFileSync(path.join(frontendDir, '.env.example'), `PUBLIC_API_URL=http://localhost:${apiPort}\n`, 'utf8');
  const pagesDir = path.join(frontendDir, 'src', 'pages');
  fse.ensureDirSync(pagesDir);
  const indexAstro = isStandalone ? `---
---
<html lang="en">
  <head><meta charset="utf-8" /><link rel="icon" type="image/x-icon" href="/favicon.ico" /><title>Rapidfire Astro</title></head>
  <body style="margin:0; background:#0f172a; color:#f8fafc; font-family:system-ui; display:flex; min-height:100vh; align-items:center; justify-content:center;">
    <div style="max-width:640px; width:90%; background:#131b2e; border:1px solid #1e293b; border-radius:16px; padding:2.5rem; text-align:center;">
      <h1 style="color:#f43f5e; font-size:1.8rem; margin-bottom:0.5rem;">RapidFire Astro Application</h1>
      <p style="color:#94a3b8; font-size:0.9rem; margin-bottom:2rem;">Content-focused web framework with islands architecture.</p>
      <button id="counter-btn" style="padding:0.75rem 1.5rem; border-radius:8px; background:#f43f5e; color:#fff; border:none; font-weight:600; cursor:pointer;">State Counter: <span id="count-val">0</span></button>
    </div>
    <script>
      let c = 0;
      document.getElementById('counter-btn')?.addEventListener('click', () => {
        c++;
        const el = document.getElementById('count-val');
        if (el) el.innerText = String(c);
      });
    </script>
  </body>
</html>
` : `---
---
<html lang="en">
  <head><meta charset="utf-8" /><link rel="icon" type="image/x-icon" href="/favicon.ico" /><title>Rapidfire Full-Stack Astro</title></head>
  <body style="margin:0; background:#0f172a; color:#f8fafc; font-family:system-ui; display:flex; min-height:100vh; align-items:center; justify-content:center;">
    <div style="max-width:640px; width:90%; background:#131b2e; border:1px solid #1e293b; border-radius:16px; padding:2.5rem; text-align:center;">
      <div style="display:inline-block; padding:0.25rem 0.75rem; border-radius:999px; background:rgba(6,182,212,0.15); color:#06b6d4; font-size:0.75rem; font-weight:bold; margin-bottom:1rem;">[ARCH] Dual-Tier Microservice Architecture</div>
      <h1 style="color:#f43f5e; font-size:1.8rem; margin-bottom:0.5rem;">RapidFire Full-Stack Application</h1>
      <p style="color:#94a3b8; font-size:0.9rem; margin-bottom:2rem;">Frontend (Astro) connected to Backend API with pre-configured CORS.</p>
      <div style="display:flex; gap:1rem; justify-content:center; margin-bottom:1.5rem; flex-wrap:wrap;">
        <button id="counter-btn" style="padding:0.75rem 1.5rem; border-radius:8px; background:#f43f5e; color:#fff; border:none; font-weight:600; cursor:pointer;">State Counter: <span id="count-val">0</span></button>
        <button id="test-btn" style="padding:0.75rem 1.5rem; border-radius:8px; background:#059669; color:#fff; border:none; font-weight:600; cursor:pointer;">Test Backend API (/api/health)</button>
      </div>
      <div id="result-box" style="display:none; margin-top:1.5rem; padding:1rem; border-radius:8px; text-align:left; font-family:monospace; font-size:0.85rem;">
        <div id="status-title" style="font-weight:bold; margin-bottom:0.35rem;"></div>
        <pre id="json-pre" style="margin:0; color:#e2e8f0;"></pre>
      </div>
    </div>
    <script>
      let c = 0;
      document.getElementById('counter-btn')?.addEventListener('click', () => {
        c++;
        const el = document.getElementById('count-val');
        if (el) el.innerText = String(c);
      });
      document.getElementById('test-btn')?.addEventListener('click', async () => {
        const box = document.getElementById('result-box');
        const title = document.getElementById('status-title');
        const pre = document.getElementById('json-pre');
        if (!box || !title || !pre) return;
        box.style.display = 'block';
        try {
          let res;
          try {
            res = await fetch('http://localhost:${apiPort}/api/health');
          } catch {
            res = await fetch('http://localhost:${altPort}/api/health');
          }
          const data = await res.json();
          box.style.background = 'rgba(16,185,129,0.1)';
          box.style.border = '1px solid #10b981';
          title.style.color = '#34d399';
          title.innerText = '[200 OK] Backend Microservice Connected!';
          pre.innerText = JSON.stringify(data, null, 2);
        } catch (err) {
          box.style.background = 'rgba(239,68,68,0.1)';
          box.style.border = '1px solid #ef4444';
          title.style.color = '#f87171';
          title.innerText = '[OFFLINE] Backend Server Offline';
          pre.innerText = JSON.stringify({ error: err.message }, null, 2);
        }
      });
    </script>
  </body>
</html>
`;
  fse.writeFileSync(path.join(pagesDir, 'index.astro'), indexAstro, 'utf8');
}

function scaffoldNext(frontendDir, options = {}) {
  fse.ensureDirSync(frontendDir);
  console.log(`[rapidfire] Scaffolding Next.js frontend in ${frontendDir}...`);
  scaffoldNextFallback(frontendDir, options);
  runNpmInstall(frontendDir, 'Next.js');
}

function scaffoldNextFallback(frontendDir, options = {}) {
  const port = options.port || 3000;
  const isStandalone = options.isStandalone || false;
  const apiPort = options.apiPort || 8000;
  const altPort = apiPort === 8000 ? 5000 : 8000;
  const pkgJson = {
    name: 'frontend',
    version: '0.1.0',
    private: true,
    scripts: { dev: `next dev -p ${port}`, build: 'next build', start: `next start -p ${port}` },
    dependencies: { next: '^14.2.15', react: '^18.3.1', 'react-dom': '^18.3.1' }
  };
  fse.writeJsonSync(path.join(frontendDir, 'package.json'), pkgJson, { spaces: 2 });
  fse.writeFileSync(path.join(frontendDir, 'next.config.js'), `module.exports = {};\n`, 'utf8');
  const publicDir = path.join(frontendDir, 'public');
  fse.ensureDirSync(publicDir);
  fse.writeFileSync(path.join(publicDir, 'favicon.ico'), '', 'utf8');
  fse.writeFileSync(path.join(frontendDir, '.env.example'), `NEXT_PUBLIC_API_URL=http://localhost:${apiPort}\n`, 'utf8');
  const appDir = path.join(frontendDir, 'app');
  fse.ensureDirSync(appDir);
  fse.writeFileSync(path.join(appDir, 'layout.jsx'), `export const metadata = { title: 'RapidFire Next' };
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui' }}>{children}</body>
    </html>
  );
}
`, 'utf8');
  const pageJsx = isStandalone ? `"use client";
import { useState } from 'react';

export default function Page() {
  const [count, setCount] = useState(0);
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '640px', width: '90%', background: '#131b2e', border: '1px solid #1e293b', borderRadius: '16px', padding: '2.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.8rem', color: '#38bdf8' }}>RapidFire Next.js Application</h1>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2rem' }}>React Server Components and App Router architecture.</p>
        <button style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }} onClick={() => setCount(c => c + 1)}>State Counter: {count}</button>
      </div>
    </div>
  );
}
` : `"use client";
import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:${apiPort}';

export default function Page() {
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
        res = await fetch('http://localhost:${altPort}/api/health');
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '640px', width: '90%', background: '#131b2e', border: '1px solid #1e293b', borderRadius: '16px', padding: '2.5rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '999px', background: 'rgba(6,182,212,0.15)', color: '#06b6d4', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '1rem' }}>[ARCH] Dual-Tier Microservice Architecture</div>
        <h1 style={{ fontSize: '1.8rem', color: '#38bdf8' }}>RapidFire Full-Stack Application</h1>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2rem' }}>Frontend (Next.js) connected to Backend API with pre-configured CORS.</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <button style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }} onClick={() => setCount(c => c + 1)}>State Counter: {count}</button>
          <button style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', background: '#059669', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }} onClick={testBackendApi} disabled={loading}>{loading ? 'Pinging Backend...' : 'Test Backend API (/api/health)'}</button>
        </div>
        {apiResponse && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: '8px', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.85rem', background: apiResponse.status === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: '1px solid ' + (apiResponse.status === 'success' ? '#10b981' : '#ef4444') }}>
            <div style={{ color: apiResponse.status === 'success' ? '#34d399' : '#f87171', fontWeight: 'bold' }}>{apiResponse.status === 'success' ? '[200 OK] Backend Microservice Connected!' : '[OFFLINE] Backend Server Offline'}</div>
            <pre style={{ margin: 0, color: '#e2e8f0' }}>{JSON.stringify(apiResponse.data || { error: apiResponse.error }, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
`;
  fse.writeFileSync(path.join(appDir, 'page.jsx'), pageJsx, 'utf8');
}

function scaffoldNuxt(frontendDir, options = {}) {
  fse.ensureDirSync(frontendDir);
  console.log(`[rapidfire] Scaffolding Nuxt frontend in ${frontendDir}...`);
  scaffoldNuxtFallback(frontendDir, options);
  runNpmInstall(frontendDir, 'Nuxt');
}

function scaffoldNuxtFallback(frontendDir, options = {}) {
  const port = options.port || 3000;
  const isStandalone = options.isStandalone || false;
  const apiPort = options.apiPort || 8000;
  const altPort = apiPort === 8000 ? 5000 : 8000;
  const pkgJson = {
    name: 'frontend',
    private: true,
    type: 'module',
    scripts: { dev: `nuxt dev --port ${port}`, build: 'nuxt build', preview: 'nuxt preview' },
    dependencies: { nuxt: '^3.13.0', vue: '^3.5.0' }
  };
  fse.writeJsonSync(path.join(frontendDir, 'package.json'), pkgJson, { spaces: 2 });
  fse.writeFileSync(path.join(frontendDir, 'nuxt.config.ts'), `export default defineNuxtConfig({ devServer: { port: ${port} }, compatibilityDate: '2024-11-01' });\n`, 'utf8');
  const publicDir = path.join(frontendDir, 'public');
  fse.ensureDirSync(publicDir);
  fse.writeFileSync(path.join(publicDir, 'favicon.ico'), '', 'utf8');
  fse.writeFileSync(path.join(frontendDir, '.env.example'), `VITE_API_URL=http://localhost:${apiPort}\n`, 'utf8');
  const appVue = isStandalone ? `<script setup>
import { ref } from 'vue';
const count = ref(0);
</script>
<template>
  <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; color: #f8fafc; font-family: system-ui;">
    <div style="max-width: 640px; width: 90%; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 2.5rem; text-align: center;">
      <h1 style="color: #00dc82; font-size: 1.8rem;">RapidFire Nuxt Application</h1>
      <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem;">Intuitive Vue framework with SSR and auto-imports.</p>
      <button style="padding: 0.75rem 1.5rem; border-radius: 8px; background: #00dc82; color: #0f172a; border: none; font-weight: 600; cursor: pointer;" @click="count++">State Counter: {{ count }}</button>
    </div>
  </div>
</template>
` : `<script setup>
import { ref } from 'vue';
const count = ref(0);
const apiResponse = ref(null);
const loading = ref(false);

async function testBackendApi() {
  loading.value = true;
  try {
    let res;
    try {
      res = await fetch('http://localhost:${apiPort}/api/health');
    } catch {
      res = await fetch('http://localhost:${altPort}/api/health');
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
  <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; color: #f8fafc; font-family: system-ui;">
    <div style="max-width: 640px; width: 90%; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 2.5rem; text-align: center;">
      <div style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; background: rgba(6,182,212,0.15); color: #06b6d4; font-size: 0.75rem; font-weight: bold; margin-bottom: 1rem;">[ARCH] Dual-Tier Microservice Architecture</div>
      <h1 style="color: #00dc82; font-size: 1.8rem;">RapidFire Full-Stack Application</h1>
      <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem;">Frontend (Nuxt) connected to Backend API with pre-configured CORS.</p>
      <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 1.5rem; flex-wrap: wrap;">
        <button style="padding: 0.75rem 1.5rem; border-radius: 8px; background: #00dc82; color: #0f172a; border: none; font-weight: 600; cursor: pointer;" @click="count++">State Counter: {{ count }}</button>
        <button style="padding: 0.75rem 1.5rem; border-radius: 8px; background: #059669; color: #fff; border: none; font-weight: 600; cursor: pointer;" @click="testBackendApi" :disabled="loading">{{ loading ? 'Pinging Backend...' : 'Test Backend API (/api/health)' }}</button>
      </div>
      <div v-if="apiResponse" style="margin-top: 1.5rem; padding: 1rem; border-radius: 8px; text-align: left; font-family: monospace; font-size: 0.85rem;" :style="{ background: apiResponse.status === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: '1px solid ' + (apiResponse.status === 'success' ? '#10b981' : '#ef4444') }">
        <div :style="{ color: apiResponse.status === 'success' ? '#34d399' : '#f87171', fontWeight: 'bold' }">{{ apiResponse.status === 'success' ? '[200 OK] Backend Microservice Connected!' : '[OFFLINE] Backend Server Offline' }}</div>
        <pre style="margin: 0; color: #e2e8f0;">{{ JSON.stringify(apiResponse.data || { error: apiResponse.error }, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>
`;
  fse.writeFileSync(path.join(frontendDir, 'app.vue'), appVue, 'utf8');
}

function scaffoldSvelteKit(frontendDir, options = {}) {
  fse.ensureDirSync(frontendDir);
  console.log(`[rapidfire] Scaffolding SvelteKit frontend in ${frontendDir}...`);
  scaffoldSvelteKitFallback(frontendDir, options);
  runNpmInstall(frontendDir, 'SvelteKit');
}

function scaffoldSvelteKitFallback(frontendDir, options = {}) {
  const port = options.port || 3000;
  const isStandalone = options.isStandalone || false;
  const apiPort = options.apiPort || 8000;
  const altPort = apiPort === 8000 ? 5000 : 8000;
  const pkgJson = {
    name: 'frontend',
    private: true,
    version: '0.0.1',
    type: 'module',
    scripts: { dev: 'vite dev', build: 'vite build', preview: 'vite preview' },
    devDependencies: { '@sveltejs/adapter-auto': '^3.2.0', '@sveltejs/kit': '^2.5.0', '@sveltejs/vite-plugin-svelte': '^4.0.0', svelte: '^5.0.0', vite: '^5.4.0' }
  };
  fse.writeJsonSync(path.join(frontendDir, 'package.json'), pkgJson, { spaces: 2 });
  fse.writeFileSync(path.join(frontendDir, 'svelte.config.js'), `import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';\nexport default {\n  preprocess: vitePreprocess()\n};\n`, 'utf8');
  fse.writeFileSync(path.join(frontendDir, 'vite.config.js'), `import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
export default defineConfig({ plugins: [sveltekit()], server: { port: ${port} } });
`, 'utf8');
  const publicDir = path.join(frontendDir, 'public');
  fse.ensureDirSync(publicDir);
  fse.writeFileSync(path.join(publicDir, 'favicon.ico'), '', 'utf8');
  fse.writeFileSync(path.join(frontendDir, '.env.example'), `VITE_API_URL=http://localhost:${apiPort}\n`, 'utf8');
  const srcDir = path.join(frontendDir, 'src');
  fse.ensureDirSync(srcDir);
  fse.writeFileSync(path.join(srcDir, 'app.html'), `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="/favicon.ico" />
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover" style="margin:0; background:#0f172a; color:#f8fafc; font-family:system-ui;">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
`, 'utf8');
  const routesDir = path.join(srcDir, 'routes');
  fse.ensureDirSync(routesDir);
  const pageSvelte = isStandalone ? `<script>
  let count = $state(0);
</script>
<div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; color: #f8fafc; font-family: system-ui;">
  <div style="max-width: 640px; width: 90%; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 2.5rem; text-align: center;">
    <h1 style="color: #ff3e00; font-size: 1.8rem;">RapidFire SvelteKit Application</h1>
    <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem;">Full-featured web framework built on Svelte.</p>
    <button style="padding: 0.75rem 1.5rem; border-radius: 8px; background: #ff3e00; color: #fff; border: none; font-weight: 600; cursor: pointer;" onclick={() => count++}>State Counter: {count}</button>
  </div>
</div>
` : `<script>
  let count = $state(0);
  let apiResponse = $state(null);
  let loading = $state(false);

  async function testBackendApi() {
    loading = true;
    try {
      let res;
      try {
        res = await fetch('http://localhost:${apiPort}/api/health');
      } catch {
        res = await fetch('http://localhost:${altPort}/api/health');
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
<div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; color: #f8fafc; font-family: system-ui;">
  <div style="max-width: 640px; width: 90%; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 2.5rem; text-align: center;">
    <div style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; background: rgba(6,182,212,0.15); color: #06b6d4; font-size: 0.75rem; font-weight: bold; margin-bottom: 1rem;">[ARCH] Dual-Tier Microservice Architecture</div>
    <h1 style="color: #ff3e00; font-size: 1.8rem;">RapidFire Full-Stack Application</h1>
    <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem;">Frontend (SvelteKit) connected to Backend API with pre-configured CORS.</p>
    <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 1.5rem; flex-wrap: wrap;">
      <button style="padding: 0.75rem 1.5rem; border-radius: 8px; background: #ff3e00; color: #fff; border: none; font-weight: 600; cursor: pointer;" onclick={() => count++}>State Counter: {count}</button>
      <button style="padding: 0.75rem 1.5rem; border-radius: 8px; background: #059669; color: #fff; border: none; font-weight: 600; cursor: pointer;" onclick={testBackendApi} disabled={loading}>{loading ? 'Pinging Backend...' : 'Test Backend API (/api/health)'}</button>
    </div>
    {#if apiResponse}
      <div style="margin-top: 1.5rem; padding: 1rem; border-radius: 8px; text-align: left; font-family: monospace; font-size: 0.85rem; background: {apiResponse.status === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; border: 1px solid {apiResponse.status === 'success' ? '#10b981' : '#ef4444'};">
        <div style="font-weight: bold; color: {apiResponse.status === 'success' ? '#34d399' : '#f87171'}; margin-bottom: 0.35rem;">{apiResponse.status === 'success' ? '[200 OK] Backend Microservice Connected!' : '[OFFLINE] Backend Server Offline'}</div>
        <pre style="margin: 0; color: #e2e8f0;">{JSON.stringify(apiResponse.data || { error: apiResponse.error }, null, 2)}</pre>
      </div>
    {/if}
  </div>
</div>
`;
  fse.writeFileSync(path.join(routesDir, '+page.svelte'), pageSvelte, 'utf8');
}

function scaffoldViteVanilla(frontendDir, options = {}) {
  fse.ensureDirSync(frontendDir);
  console.log(`[rapidfire] Scaffolding Vanilla JS (Vite) frontend in ${frontendDir}...`);
  scaffoldViteVanillaFallback(frontendDir, options);
  runNpmInstall(frontendDir, 'Vanilla JS');
}

function scaffoldViteVanillaFallback(frontendDir, options = {}) {
  const port = options.port || 3000;
  const isStandalone = options.isStandalone || false;
  const apiPort = options.apiPort || 8000;
  const altPort = apiPort === 8000 ? 5000 : 8000;
  const pkgJson = {
    name: 'frontend',
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
    devDependencies: { vite: '^5.4.11' }
  };
  fse.writeJsonSync(path.join(frontendDir, 'package.json'), pkgJson, { spaces: 2 });
  fse.writeFileSync(path.join(frontendDir, 'vite.config.js'), `import { defineConfig } from 'vite';
export default defineConfig({ server: { port: ${port} } });
`, 'utf8');
  const publicDir = path.join(frontendDir, 'public');
  fse.ensureDirSync(publicDir);
  fse.writeFileSync(path.join(publicDir, 'favicon.ico'), '', 'utf8');
  fse.writeFileSync(path.join(frontendDir, '.env.example'), `VITE_API_URL=http://localhost:${apiPort}\n`, 'utf8');
  const indexHtml = isStandalone ? `<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><link rel="icon" type="image/x-icon" href="/favicon.ico" /><title>Rapidfire Vanilla</title></head>
  <body style="margin:0; background:#0f172a; color:#f8fafc; font-family:system-ui; display:flex; min-height:100vh; align-items:center; justify-content:center;">
    <div style="max-width:640px; width:90%; background:#131b2e; border:1px solid #1e293b; border-radius:16px; padding:2.5rem; text-align:center;">
      <h1 style="color:#f59e0b; font-size:1.8rem;">RapidFire Vanilla Application</h1>
      <p style="color:#94a3b8; font-size:0.9rem; margin-bottom:2rem;">Pure HTML/JS web application scaffolded with Vite.</p>
      <button id="counter-btn" style="padding:0.75rem 1.5rem; border-radius:8px; background:#f59e0b; color:#0f172a; border:none; font-weight:600; cursor:pointer;">State Counter: <span id="count-val">0</span></button>
    </div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
` : `<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><link rel="icon" type="image/x-icon" href="/favicon.ico" /><title>Rapidfire Full-Stack Vanilla</title></head>
  <body style="margin:0; background:#0f172a; color:#f8fafc; font-family:system-ui; display:flex; min-height:100vh; align-items:center; justify-content:center;">
    <div style="max-width:640px; width:90%; background:#131b2e; border:1px solid #1e293b; border-radius:16px; padding:2.5rem; text-align:center;">
      <div style="display:inline-block; padding:0.25rem 0.75rem; border-radius:999px; background:rgba(6,182,212,0.15); color:#06b6d4; font-size:0.75rem; font-weight:bold; margin-bottom:1rem;">[ARCH] Dual-Tier Microservice Architecture</div>
      <h1 style="color:#f59e0b; font-size:1.8rem;">RapidFire Full-Stack Application</h1>
      <p style="color:#94a3b8; font-size:0.9rem; margin-bottom:2rem;">Frontend (Vanilla Vite) connected to Backend API with pre-configured CORS.</p>
      <div style="display:flex; gap:1rem; justify-content:center; margin-bottom:1.5rem; flex-wrap:wrap;">
        <button id="counter-btn" style="padding:0.75rem 1.5rem; border-radius:8px; background:#f59e0b; color:#0f172a; border:none; font-weight:600; cursor:pointer;">State Counter: <span id="count-val">0</span></button>
        <button id="test-btn" style="padding:0.75rem 1.5rem; border-radius:8px; background:#059669; color:#fff; border:none; font-weight:600; cursor:pointer;">Test Backend API (/api/health)</button>
      </div>
      <div id="result-box" style="display:none; margin-top:1.5rem; padding:1rem; border-radius:8px; text-align:left; font-family:monospace; font-size:0.85rem;">
        <div id="status-title" style="font-weight:bold; margin-bottom:0.35rem;"></div>
        <pre id="json-pre" style="margin:0; color:#e2e8f0;"></pre>
      </div>
    </div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
`;
  fse.writeFileSync(path.join(frontendDir, 'index.html'), indexHtml, 'utf8');
  const srcDir = path.join(frontendDir, 'src');
  fse.ensureDirSync(srcDir);
  const mainJs = isStandalone ? `let count = 0;
document.getElementById('counter-btn')?.addEventListener('click', () => {
  count++;
  const el = document.getElementById('count-val');
  if (el) el.innerText = String(count);
});
` : `let count = 0;
document.getElementById('counter-btn')?.addEventListener('click', () => {
  count++;
  const el = document.getElementById('count-val');
  if (el) el.innerText = String(count);
});

document.getElementById('test-btn')?.addEventListener('click', async () => {
  const box = document.getElementById('result-box');
  const title = document.getElementById('status-title');
  const pre = document.getElementById('json-pre');
  if (!box || !title || !pre) return;
  box.style.display = 'block';
  try {
    let res;
    try {
      res = await fetch('http://localhost:${apiPort}/api/health');
    } catch {
      res = await fetch('http://localhost:${altPort}/api/health');
    }
    const data = await res.json();
    box.style.background = 'rgba(16,185,129,0.1)';
    box.style.border = '1px solid #10b981';
    title.style.color = '#34d399';
    title.innerText = '[200 OK] Backend Microservice Connected!';
    pre.innerText = JSON.stringify(data, null, 2);
  } catch (err) {
    box.style.background = 'rgba(239,68,68,0.1)';
    box.style.border = '1px solid #ef4444';
    title.style.color = '#f87171';
    title.innerText = '[OFFLINE] Backend Server Offline';
    pre.innerText = JSON.stringify({ error: err.message }, null, 2);
  }
});
`;
  fse.writeFileSync(path.join(srcDir, 'main.js'), mainJs, 'utf8');
}

const FRONTEND_ADAPTERS = {
  react: scaffoldViteReact,
  vue: scaffoldViteVue,
  svelte: scaffoldViteSvelte,
  angular: scaffoldViteAngular,
  solid: scaffoldViteSolid,
  solidjs: scaffoldViteSolid,
  preact: scaffoldVitePreact,
  preactjs: scaffoldVitePreact,
  qwik: scaffoldViteQwik,
  lit: scaffoldViteLit,
  astro: scaffoldAstro,
  next: scaffoldNext,
  nextjs: scaffoldNext,
  nuxt: scaffoldNuxt,
  nuxtjs: scaffoldNuxt,
  sveltekit: scaffoldSvelteKit,
  vanilla: scaffoldViteVanilla
};

function hasFrontendAdapter(name) {
  if (!name || typeof name !== 'string') return false;
  const normalized = normalizeFrontendName(name);
  return Boolean(FRONTEND_ADAPTERS[normalized]);
}

function getFrontendAdapter(name) {
  if (!name || typeof name !== 'string') return null;
  const normalized = normalizeFrontendName(name);
  return FRONTEND_ADAPTERS[normalized] || null;
}

module.exports = {
  scaffoldViteReact,
  scaffoldViteReactFallback,
  scaffoldViteVue,
  scaffoldViteVueFallback,
  scaffoldViteSvelte,
  scaffoldViteSvelteFallback,
  scaffoldViteAngular,
  scaffoldViteAngularFallback,
  scaffoldViteSolid,
  scaffoldViteSolidFallback,
  scaffoldVitePreact,
  scaffoldVitePreactFallback,
  scaffoldViteQwik,
  scaffoldViteQwikFallback,
  scaffoldViteLit,
  scaffoldViteLitFallback,
  scaffoldAstro,
  scaffoldAstroFallback,
  scaffoldNext,
  scaffoldNextFallback,
  scaffoldNuxt,
  scaffoldNuxtFallback,
  scaffoldSvelteKit,
  scaffoldSvelteKitFallback,
  scaffoldViteVanilla,
  scaffoldViteVanillaFallback,
  normalizeFrontendName,
  FRONTEND_ADAPTERS,
  hasFrontendAdapter,
  getFrontendAdapter
};
