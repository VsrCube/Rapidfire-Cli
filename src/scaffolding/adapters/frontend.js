const path = require('path');
const fse = require('fs-extra');
const { run } = require('../../utils/proc');

function scaffoldViteReact(frontendDir, options = {}) {
  fse.ensureDirSync(frontendDir);
  console.log(`[rapidfire] Scaffolding React (Vite) frontend in ${frontendDir}...`);

  try {
    run(`npx --yes degit vitejs/vite/packages/create-vite/template-react "${frontendDir}"`, {
      stdio: 'pipe'
    });
  } catch {
    console.log('[rapidfire] Using built-in clean Vite React template...');
    scaffoldViteReactFallback(frontendDir, options);
  }

  console.log('[rapidfire] Installing React frontend dependencies...');
  run('npm install', { cwd: frontendDir, stdio: 'pipe' });
  console.log('[rapidfire] React frontend ready.');
}

function scaffoldViteReactFallback(frontendDir, options = {}) {
  const port = options.port || 3000;
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
  fse.writeFileSync(path.join(frontendDir, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><title>Rapidfire React</title></head>
<body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>
`, 'utf8');
  fse.writeFileSync(path.join(frontendDir, '.env.example'), 'VITE_API_URL=http://localhost:8000\n', 'utf8');
  const srcDir = path.join(frontendDir, 'src');
  fse.ensureDirSync(srcDir);
  fse.writeFileSync(path.join(srcDir, 'index.css'), `body { margin: 0; background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; display: flex; min-height: 100vh; align-items: center; justify-content: center; }`, 'utf8');
  fse.writeFileSync(path.join(srcDir, 'App.jsx'), `import React, { useState } from 'react';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function App() {
  const [count, setCount] = useState(0);
  return (
    <div style={{ textAlign: 'center' }}>
      <h1>Rapidfire React App</h1>
      <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>API Endpoint: {API_URL}</p>
      <button style={{ padding: '0.6rem 1.2rem', borderRadius: '6px', background: '#38bdf8', border: 'none', fontWeight: 'bold' }} onClick={() => setCount(c => c + 1)}>Count: {count}</button>
    </div>
  );
}
`, 'utf8');
  fse.writeFileSync(path.join(srcDir, 'main.jsx'), `import React from 'react'; import ReactDOM from 'react-dom/client'; import App from './App'; import './index.css';
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
`, 'utf8');
}

function scaffoldViteVue(frontendDir, options = {}) {
  fse.ensureDirSync(frontendDir);
  console.log(`[rapidfire] Scaffolding Vue 3 (Vite) frontend in ${frontendDir}...`);

  try {
    run(`npx --yes degit vitejs/vite/packages/create-vite/template-vue "${frontendDir}"`, {
      stdio: 'pipe'
    });
  } catch {
    console.log('[rapidfire] Using built-in clean Vite Vue template...');
    scaffoldViteVueFallback(frontendDir, options);
  }

  console.log('[rapidfire] Installing Vue frontend dependencies...');
  run('npm install', { cwd: frontendDir, stdio: 'pipe' });
  console.log('[rapidfire] Vue frontend ready.');
}

function scaffoldViteVueFallback(frontendDir, options = {}) {
  const port = options.port || 3000;
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
export default defineConfig({ plugins: [vue()], server: { port: ${port} } });
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

function scaffoldViteSvelte(frontendDir, options = {}) {
  fse.ensureDirSync(frontendDir);
  console.log(`[rapidfire] Scaffolding Svelte (Vite) frontend in ${frontendDir}...`);

  try {
    run(`npx --yes degit sveltejs/vite-plugin-svelte/packages/vite-plugin-svelte/templates/svelte "${frontendDir}"`, {
      stdio: 'pipe'
    });
  } catch {
    console.log('[rapidfire] Using built-in clean Vite Svelte template...');
    scaffoldViteSvelteFallback(frontendDir, options);
  }

  console.log('[rapidfire] Installing Svelte frontend dependencies...');
  run('npm install --legacy-peer-deps', { cwd: frontendDir, stdio: 'pipe' });
  console.log('[rapidfire] Svelte frontend ready.');
}

function scaffoldViteSvelteFallback(frontendDir, options = {}) {
  const port = options.port || 3000;
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
export default defineConfig({ plugins: [svelte()], server: { port: ${port} } });
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

const FRONTEND_ADAPTERS = {
  react: scaffoldViteReact,
  vue: scaffoldViteVue,
  svelte: scaffoldViteSvelte
};

function hasFrontendAdapter(name) {
  return Boolean(name && FRONTEND_ADAPTERS[name.toLowerCase()]);
}

function getFrontendAdapter(name) {
  return FRONTEND_ADAPTERS[name.toLowerCase()] || null;
}

module.exports = {
  scaffoldViteReact,
  scaffoldViteReactFallback,
  scaffoldViteVue,
  scaffoldViteVueFallback,
  scaffoldViteSvelte,
  scaffoldViteSvelteFallback,
  FRONTEND_ADAPTERS,
  hasFrontendAdapter,
  getFrontendAdapter
};
