const path = require('path');
const fse = require('fs-extra');
const { getActiveAiConfig } = require('../ai/gemini');
const { installPrePushHook } = require('../integrations/gitleaks');
const { isGhInstalled, isGhAuthenticated, createRepo } = require('../integrations/gh');
const {
  run,
  commandExists,
  getRustInstallInstructions,
  getGoInstallInstructions,
  getDotnetInstallInstructions,
  getPythonInstallInstructions
} = require('../utils/proc');
const { getParentGitRepo, setupGitAndGithub } = require('../utils/gitContext');
const { getFrontendAdapter, hasFrontendAdapter } = require('./adapters/frontend');
const { getBackendAdapter, hasBackendAdapter } = require('./adapters/backend');

function getFallbackBlueprint(stack, targetFolder) {
  const s = stack.toLowerCase();

  if (s.includes('astro')) {
    return {
      summary: `Astro static & server-first web framework starter in '${targetFolder}'`,
      ecosystem: 'node',
      files: [
        {
          filename: 'package.json',
          content: JSON.stringify({
            name: targetFolder,
            type: 'module',
            version: '0.0.1',
            scripts: { dev: 'astro dev', start: 'astro dev', build: 'astro build', preview: 'astro preview' },
            dependencies: { astro: '^4.16.0' }
          }, null, 2)
        },
        {
          filename: 'astro.config.mjs',
          content: `import { defineConfig } from 'astro/config';\nexport default defineConfig({});\n`
        },
        {
          filename: 'public/favicon.ico',
          content: ''
        },
        {
          filename: 'src/pages/index.astro',
          content: `---
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    <title>RapidFire - ${targetFolder}</title>
  </head>
  <body style="margin:0; background:#0f172a; color:#f8fafc; font-family:system-ui, sans-serif; display:flex; min-height:100vh; align-items:center; justify-content:center;">
    <div style="text-align:center;">
      <h1 style="color:#f43f5e;">RapidFire Astro App</h1>
      <p>Scaffolded dynamically with RapidFire CLI</p>
    </div>
  </body>
</html>
`
        },
        {
          filename: 'README.md',
          content: `# ${targetFolder} (Astro)\nDynamically scaffolded with RapidFire CLI.\n\n## Getting Started\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`
        },
        {
          filename: '.gitignore',
          content: `node_modules/\ndist/\n.astro/\n.env\n`
        }
      ]
    };
  }

  if (s.includes('angular')) {
    return {
      summary: `Angular standalone frontend starter (Vite) in '${targetFolder}'`,
      ecosystem: 'node',
      files: [
        {
          filename: 'package.json',
          content: JSON.stringify({
            name: targetFolder,
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
          }, null, 2)
        },
        {
          filename: 'tsconfig.json',
          content: JSON.stringify({
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
          }, null, 2)
        },
        {
          filename: 'tsconfig.app.json',
          content: JSON.stringify({
            extends: './tsconfig.json',
            compilerOptions: {
              outDir: './out-tsc/app',
              types: []
            },
            files: ['src/main.ts'],
            include: ['src/**/*.d.ts']
          }, null, 2)
        },
        {
          filename: 'vite.config.ts',
          content: `import { defineConfig } from 'vite';\nimport angular from '@analogjs/vite-plugin-angular';\nexport default defineConfig({ plugins: [angular()], server: { port: 3000 } });\n`
        },
        {
          filename: 'public/favicon.ico',
          content: ''
        },
        {
          filename: 'index.html',
          content: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><title>RapidFire Angular</title><meta name="viewport" content="width=device-width, initial-scale=1" /><link rel="icon" type="image/x-icon" href="/favicon.ico" /></head><body style="margin:0; background:#0f172a; color:#f8fafc; font-family:system-ui, sans-serif;"><app-root></app-root><script type="module" src="/src/main.ts"></script></body></html>\n`
        },
        {
          filename: 'src/styles.css',
          content: `html, body { height: 100%; margin: 0; background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; }\n`
        },
        {
          filename: 'src/app/app.routes.ts',
          content: `import { Routes } from '@angular/router';\nexport const routes: Routes = [];\n`
        },
        {
          filename: 'src/app/app.config.ts',
          content: `import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';\nimport { provideHttpClient } from '@angular/common/http';\nimport { provideRouter } from '@angular/router';\nimport { routes } from './app.routes';\nexport const appConfig: ApplicationConfig = {\n  providers: [\n    provideZoneChangeDetection({ eventCoalescing: true }),\n    provideHttpClient(),\n    provideRouter(routes)\n  ]\n};\n`
        },
        {
          filename: 'src/main.ts',
          content: `import 'zone.js';\nimport { bootstrapApplication } from '@angular/platform-browser';\nimport { appConfig } from './app/app.config';\nimport { AppComponent } from './app/app.component';\nimport './styles.css';\nbootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));\n`
        },
        {
          filename: 'src/app/app.component.ts',
          content: `import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  template: \`
    <div style="text-align: center; color: #f8fafc; font-family: system-ui; padding: 2rem;">
      <h1 style="color: #dd0031;">RapidFire Angular App</h1>
      <button style="padding: 0.6rem 1.2rem; border-radius: 6px; background: #dd0031; color: white; border: none; font-weight: bold; cursor: pointer;" (click)="increment()">
        Count: {{ count() }}
      </button>
    </div>
  \`
})
export class AppComponent {
  count = signal(0);
  increment() {
    this.count.update(c => c + 1);
  }
}
`
        },
        {
          filename: '.gitignore',
          content: `node_modules/\ndist/\n.env\n`
        },
        {
          filename: 'README.md',
          content: `# ${targetFolder} (Angular)\nDynamically scaffolded with RapidFire CLI.\n\n## Getting Started\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`
        }
      ]
    };
  }

  if (s.includes('rust') || s.includes('axum') || s.includes('actix')) {
    const pkgName = targetFolder.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    return {
      summary: `Rust Axum backend starter in '${targetFolder}'`,
      ecosystem: 'rust',
      files: [
        {
          filename: 'Cargo.toml',
          content: `[package]\nname = "${pkgName}"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\naxum = "0.7"\ntokio = { version = "1.0", features = ["full"] }\ntower-http = { version = "0.5", features = ["cors"] }\nserde = { version = "1.0", features = ["derive"] }\nserde_json = "1.0"\n`
        },
        {
          filename: 'src/main.rs',
          content: `use axum::{
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde::Serialize;
use tower_http::cors::{Any, CorsLayer};

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    message: &'static str,
    port: u16,
}

#[derive(Serialize)]
struct RootResponse {
    message: &'static str,
    docs: &'static str,
}

async fn health_check() -> impl IntoResponse {
    Json(HealthResponse {
        status: "ok",
        message: "Rust Axum backend is running",
        port: 5000,
    })
}

async fn root() -> impl IntoResponse {
    Json(RootResponse {
        message: "Welcome to Rust Axum backend API!",
        docs: "/api/health",
    })
}

#[tokio::main]
async fn main() {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/", get(root))
        .route("/api/health", get(health_check))
        .layer(cors);

    let addr = "0.0.0.0:5000";
    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => {
            println!("[rapidfire] Rust Axum backend listening on port 5000");
            l
        }
        Err(err) => {
            eprintln!("[rapidfire] Error: Port 5000 is already in use ({}).", err);
            eprintln!("[rapidfire] Hint: Run 'stop 5000' in Rapidfire or free port 5000 before running.");
            std::process::exit(1);
        }
    };
    if let Err(err) = axum::serve(listener, app).await {
        eprintln!("[rapidfire] Error serving Axum: {}", err);
    }
}
`
        },
        {
          filename: '.gitignore',
          content: `target/\n*.exe\n.env\n*.log\n`
        },
        {
          filename: 'README.md',
          content: `# ${targetFolder} (Rust Axum)\nDynamically scaffolded with RapidFire CLI.\n\n## Getting Started\n\`\`\`bash\ncargo run\n\`\`\`\n`
        }
      ]
    };
  }

  if (s.includes('solid')) {
    return {
      summary: `SolidJS reactive frontend starter (Vite) in '${targetFolder}'`,
      ecosystem: 'node',
      files: [
        {
          filename: 'package.json',
          content: JSON.stringify({
            name: targetFolder,
            version: '0.0.0',
            type: 'module',
            scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
            dependencies: { 'solid-js': '^1.9.0' },
            devDependencies: { vite: '^5.4.0', 'vite-plugin-solid': '^2.11.0' }
          }, null, 2)
        },
        {
          filename: 'vite.config.js',
          content: `import { defineConfig } from 'vite';\nimport solidPlugin from 'vite-plugin-solid';\nexport default defineConfig({ plugins: [solidPlugin()], server: { port: 3000 } });\n`
        },
        {
          filename: 'public/favicon.ico',
          content: ''
        },
        {
          filename: 'index.html',
          content: `<!DOCTYPE html><html lang="en"><head><title>RapidFire SolidJS</title><link rel="icon" type="image/x-icon" href="/favicon.ico" /></head><body><div id="root"></div><script type="module" src="/src/index.jsx"></script></body></html>\n`
        },
        {
          filename: 'src/App.jsx',
          content: `import { createSignal } from 'solid-js';
export default function App() {
  const [count, setCount] = createSignal(0);
  return (
    <div style="text-align: center; color: #f8fafc; font-family: system-ui; padding: 2rem;">
      <h1 style="color: #446b9e;">RapidFire SolidJS App</h1>
      <button style="padding: 0.6rem 1.2rem; border-radius: 6px; background: #446b9e; color: white; border: none; font-weight: bold;" onClick={() => setCount(c => c + 1)}>
        Count: {count()}
      </button>
    </div>
  );
}
`
        },
        {
          filename: 'src/index.jsx',
          content: `import { render } from 'solid-js/web';\nimport App from './App';\nrender(() => <App />, document.getElementById('root'));\n`
        },
        {
          filename: '.gitignore',
          content: `node_modules/\ndist/\n.env\n`
        },
        {
          filename: 'README.md',
          content: `# ${targetFolder} (SolidJS)\nDynamically scaffolded with RapidFire CLI.\n\n## Getting Started\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`
        }
      ]
    };
  }

  if (s.includes('next')) {
    return {
      summary: `Next.js full-stack application starter in '${targetFolder}'`,
      ecosystem: 'node',
      files: [
        {
          filename: 'package.json',
          content: JSON.stringify({
            name: targetFolder,
            version: '0.1.0',
            private: true,
            scripts: { dev: 'next dev', build: 'next build', start: 'next start' },
            dependencies: { next: '^14.2.0', react: '^18.3.0', 'react-dom': '^18.3.0' }
          }, null, 2)
        },
        {
          filename: 'public/favicon.ico',
          content: ''
        },
        {
          filename: 'app/layout.jsx',
          content: `export const metadata = { title: '${targetFolder}' };\nexport default function RootLayout({ children }) {\n  return (<html lang="en"><body>{children}</body></html>);\n}\n`
        },
        {
          filename: 'app/page.jsx',
          content: `export default function Home() {\n  return (\n    <main style={{ textAlign: 'center', padding: '4rem', fontFamily: 'system-ui' }}>\n      <h1>RapidFire Next.js App</h1>\n      <p>Scaffolded dynamically with RapidFire CLI</p>\n    </main>\n  );\n}\n`
        },
        {
          filename: '.gitignore',
          content: `node_modules/\n.next/\nout/\n.env*.local\n`
        },
        {
          filename: 'README.md',
          content: `# ${targetFolder} (Next.js)\nDynamically scaffolded with RapidFire CLI.\n\n## Getting Started\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`
        }
      ]
    };
  }

  if (s.includes('preact')) {
    return {
      summary: `Preact lightweight reactive frontend starter in '${targetFolder}'`,
      ecosystem: 'node',
      files: [
        {
          filename: 'package.json',
          content: JSON.stringify({
            name: targetFolder,
            version: '0.0.0',
            type: 'module',
            scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
            dependencies: { preact: '^10.24.3' },
            devDependencies: { '@preact/preset-vite': '^2.9.1', vite: '^5.4.11' }
          }, null, 2)
        },
        {
          filename: 'vite.config.js',
          content: `import { defineConfig } from 'vite';\nimport preact from '@preact/preset-vite';\nexport default defineConfig({ plugins: [preact()], server: { port: 3000 } });\n`
        },
        {
          filename: 'public/favicon.ico',
          content: ''
        },
        {
          filename: 'index.html',
          content: `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><link rel="icon" type="image/x-icon" href="/favicon.ico" /><title>Rapidfire Preact</title></head><body style="margin:0; background:#0f172a; color:#f8fafc; font-family:system-ui;"><div id="app"></div><script type="module" src="/src/main.jsx"></script></body></html>\n`
        },
        {
          filename: 'src/App.jsx',
          content: `import { useState } from 'preact/hooks';\nexport default function App() {\n  const [count, setCount] = useState(0);\n  return (<div style={{ textAlign: 'center', padding: '2rem' }}><h1>RapidFire Preact App</h1><button onClick={() => setCount(c => c + 1)}>Count: {count}</button></div>);\n}\n`
        },
        {
          filename: 'src/main.jsx',
          content: `import { render } from 'preact';\nimport App from './App';\nrender(<App />, document.getElementById('app'));\n`
        },
        { filename: '.gitignore', content: `node_modules/\ndist/\n.env\n` },
        { filename: 'README.md', content: `# ${targetFolder} (Preact)\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n` }
      ]
    };
  }

  if (s.includes('qwik')) {
    return {
      summary: `Qwik resumable frontend starter in '${targetFolder}'`,
      ecosystem: 'node',
      files: [
        {
          filename: 'package.json',
          content: JSON.stringify({
            name: targetFolder,
            version: '0.0.0',
            type: 'module',
            scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
            dependencies: { '@builder.io/qwik': '^1.10.0' },
            devDependencies: { '@builder.io/qwik/optimizer': '^1.10.0', vite: '^5.4.11' }
          }, null, 2)
        },
        {
          filename: 'vite.config.js',
          content: `import { defineConfig } from 'vite';\nimport { qwikVite } from '@builder.io/qwik/optimizer';\nexport default defineConfig({ plugins: [qwikVite()], server: { port: 3000 } });\n`
        },
        {
          filename: 'public/favicon.ico',
          content: ''
        },
        {
          filename: 'index.html',
          content: `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><title>Rapidfire Qwik</title></head><body style="margin:0; background:#0f172a; color:#f8fafc; font-family:system-ui;"><div id="app"></div><script type="module" src="/src/main.jsx"></script></body></html>\n`
        },
        {
          filename: 'src/root.jsx',
          content: `import { component$, useSignal } from '@builder.io/qwik';\nexport default component$(() => {\n  const count = useSignal(0);\n  return (<div style="text-align:center; padding:2rem;"><h1>RapidFire Qwik App</h1><button onClick$={() => count.value++}>Count: {count.value}</button></div>);\n});\n`
        },
        {
          filename: 'src/main.jsx',
          content: `import { render } from '@builder.io/qwik';\nimport Root from './root';\nrender(document.getElementById('app'), <Root />);\n`
        },
        { filename: '.gitignore', content: `node_modules/\ndist/\n.env\n` },
        { filename: 'README.md', content: `# ${targetFolder} (Qwik)\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n` }
      ]
    };
  }

  if (s.includes('lit')) {
    return {
      summary: `Lit web components starter in '${targetFolder}'`,
      ecosystem: 'node',
      files: [
        {
          filename: 'package.json',
          content: JSON.stringify({
            name: targetFolder,
            version: '0.0.0',
            type: 'module',
            scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
            dependencies: { lit: '^3.2.1' },
            devDependencies: { vite: '^5.4.11' }
          }, null, 2)
        },
        {
          filename: 'vite.config.js',
          content: `import { defineConfig } from 'vite';\nexport default defineConfig({ server: { port: 3000 } });\n`
        },
        {
          filename: 'public/favicon.ico',
          content: ''
        },
        {
          filename: 'index.html',
          content: `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><link rel="icon" type="image/x-icon" href="/favicon.ico" /><title>Rapidfire Lit</title></head><body style="margin:0; background:#0f172a; color:#f8fafc; font-family:system-ui;"><my-element></my-element><script type="module" src="/src/my-element.js"></script></body></html>\n`
        },
        {
          filename: 'src/my-element.js',
          content: `import { LitElement, html } from 'lit';\nexport class MyElement extends LitElement {\n  static properties = { count: { type: Number } };\n  constructor() { super(); this.count = 0; }\n  render() { return html\`<div style="text-align:center; padding:2rem; font-family:system-ui;"><h1>RapidFire Lit App</h1><button @click=\${() => this.count++}>Count: \${this.count}</button></div>\`; }\n}\ncustomElements.define('my-element', MyElement);\n`
        },
        { filename: '.gitignore', content: `node_modules/\ndist/\n.env\n` },
        { filename: 'README.md', content: `# ${targetFolder} (Lit)\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n` }
      ]
    };
  }

  if (s.includes('nuxt')) {
    return {
      summary: `Nuxt 3 full-stack Vue framework in '${targetFolder}'`,
      ecosystem: 'node',
      files: [
        {
          filename: 'package.json',
          content: JSON.stringify({
            name: targetFolder,
            private: true,
            type: 'module',
            scripts: { build: 'nuxt build', dev: 'nuxt dev', generate: 'nuxt generate', preview: 'nuxt preview' },
            devDependencies: { nuxt: '^3.14.1592', vue: '^3.5.13', 'vue-router': '^4.5.0' }
          }, null, 2)
        },
        {
          filename: 'nuxt.config.ts',
          content: `export default defineNuxtConfig({ compatibilityDate: '2024-11-01' });\n`
        },
        {
          filename: 'public/favicon.ico',
          content: ''
        },
        {
          filename: 'app.vue',
          content: `<template><div style="text-align:center; padding:2rem; font-family:system-ui; color:#f8fafc; background:#0f172a; min-height:100vh;"><h1>RapidFire Nuxt App</h1><button @click="count++">Count: {{ count }}</button></div></template><script setup>import { ref } from 'vue'; const count = ref(0);</script>\n`
        },
        { filename: '.gitignore', content: `node_modules/\n.nuxt/\n.output/\ndist/\n.env\n` },
        { filename: 'README.md', content: `# ${targetFolder} (Nuxt)\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n` }
      ]
    };
  }

  if (s.includes('sveltekit')) {
    return {
      summary: `SvelteKit full-stack application in '${targetFolder}'`,
      ecosystem: 'node',
      files: [
        {
          filename: 'package.json',
          content: JSON.stringify({
            name: targetFolder,
            version: '0.0.1',
            private: true,
            type: 'module',
            scripts: { dev: 'vite dev', build: 'vite build', preview: 'vite preview' },
            devDependencies: { '@sveltejs/adapter-auto': '^3.2.0', '@sveltejs/kit': '^2.8.0', '@sveltejs/vite-plugin-svelte': '^4.0.0', svelte: '^5.0.0', vite: '^5.4.11' }
          }, null, 2)
        },
        {
          filename: 'svelte.config.js',
          content: `import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';\nexport default { preprocess: vitePreprocess() };\n`
        },
        {
          filename: 'vite.config.js',
          content: `import { sveltekit } from '@sveltejs/kit/vite';\nimport { defineConfig } from 'vite';\nexport default defineConfig({ plugins: [sveltekit()] });\n`
        },
        {
          filename: 'public/favicon.ico',
          content: ''
        },
        {
          filename: 'src/app.html',
          content: `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />%sveltekit.head%</head><body data-sveltekit-preload-data="hover"><div style="display: contents">%sveltekit.body%</div></body></html>\n`
        },
        {
          filename: 'src/routes/+page.svelte',
          content: `<script>let count = $state(0);</script><div style="text-align:center; padding:2rem; font-family:system-ui;"><h1>RapidFire SvelteKit App</h1><button onclick={() => count++}>Count: {count}</button></div>\n`
        },
        { filename: '.gitignore', content: `node_modules/\n.svelte-kit/\nbuild/\n.env\n` },
        { filename: 'README.md', content: `# ${targetFolder} (SvelteKit)\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n` }
      ]
    };
  }

  if (s.includes('vanilla')) {
    return {
      summary: `Vanilla JS web application in '${targetFolder}'`,
      ecosystem: 'node',
      files: [
        {
          filename: 'package.json',
          content: JSON.stringify({
            name: targetFolder,
            version: '0.0.0',
            type: 'module',
            scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
            devDependencies: { vite: '^5.4.11' }
          }, null, 2)
        },
        {
          filename: 'vite.config.js',
          content: `import { defineConfig } from 'vite';\nexport default defineConfig({ server: { port: 3000 } });\n`
        },
        {
          filename: 'public/favicon.ico',
          content: ''
        },
        {
          filename: 'index.html',
          content: `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><link rel="icon" type="image/x-icon" href="/favicon.ico" /><title>Rapidfire Vanilla</title></head><body style="margin:0; background:#0f172a; color:#f8fafc; font-family:system-ui;"><div style="text-align:center; padding:2rem;"><h1>RapidFire Vanilla App</h1><button id="btn">Count: <span id="val">0</span></button></div><script type="module" src="/src/main.js"></script></body></html>\n`
        },
        {
          filename: 'src/main.js',
          content: `let count = 0; document.getElementById('btn')?.addEventListener('click', () => { count++; const v = document.getElementById('val'); if (v) v.innerText = String(count); });\n`
        },
        { filename: '.gitignore', content: `node_modules/\ndist/\n.env\n` },
        { filename: 'README.md', content: `# ${targetFolder} (Vanilla)\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n` }
      ]
    };
  }

  if (s.includes('fastify')) {
    return {
      summary: `Fastify high-performance backend starter in '${targetFolder}'`,
      ecosystem: 'node',
      files: [
        {
          filename: 'package.json',
          content: JSON.stringify({
            name: targetFolder,
            version: '1.0.0',
            private: true,
            main: 'server.js',
            scripts: { start: 'node server.js', dev: 'node --watch server.js' },
            dependencies: { fastify: '^5.1.0', '@fastify/cors': '^10.0.1' }
          }, null, 2)
        },
        {
          filename: 'server.js',
          content: `const Fastify = require('fastify');\nconst cors = require('@fastify/cors');\nconst app = Fastify({ logger: false });\napp.register(cors, { origin: '*' });\napp.get('/api/health', async () => ({ status: 'ok', message: 'Fastify backend is running', port: 5000 }));\napp.get('/', async () => ({ message: 'Welcome to Fastify backend API!', docs: '/api/health' }));\napp.listen({ port: 5000, host: '0.0.0.0' }, (err) => {\n  if (err) process.exit(1);\n  console.log('[rapidfire] Fastify backend listening on port 5000');\n});\n`
        },
        { filename: '.gitignore', content: `node_modules/\n.env\n*.log\n` },
        { filename: 'README.md', content: `# ${targetFolder} (Fastify)\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n` }
      ]
    };
  }

  if (s.includes('nest')) {
    return {
      summary: `NestJS enterprise backend starter in '${targetFolder}'`,
      ecosystem: 'node',
      files: [
        {
          filename: 'package.json',
          content: JSON.stringify({
            name: targetFolder,
            version: '1.0.0',
            private: true,
            scripts: { start: 'node dist/main.js', dev: 'ts-node src/main.ts', build: 'tsc' },
            dependencies: { '@nestjs/common': '^10.4.8', '@nestjs/core': '^10.4.8', '@nestjs/platform-express': '^10.4.8', 'reflect-metadata': '^0.2.2', rxjs: '^7.8.1' },
            devDependencies: { typescript: '^5.6.3', 'ts-node': '^10.9.2' }
          }, null, 2)
        },
        {
          filename: 'src/main.ts',
          content: `import { NestFactory } from '@nestjs/core';\nimport { AppModule } from './app.module';\nasync function bootstrap() {\n  const app = await NestFactory.create(AppModule);\n  app.enableCors();\n  await app.listen(5000);\n  console.log('[rapidfire] NestJS backend listening on port 5000');\n}\nbootstrap();\n`
        },
        {
          filename: 'src/app.module.ts',
          content: `import { Module } from '@nestjs/common';\nimport { AppController } from './app.controller';\n@Module({ controllers: [AppController] })\nexport class AppModule {}\n`
        },
        {
          filename: 'src/app.controller.ts',
          content: `import { Controller, Get } from '@nestjs/common';\n@Controller()\nexport class AppController {\n  @Get('/api/health')\n  getHealth() { return { status: 'ok', message: 'NestJS backend is running', port: 5000 }; }\n  @Get('/')\n  getRoot() { return { message: 'Welcome to NestJS backend API!', docs: '/api/health' }; }\n}\n`
        },
        { filename: '.gitignore', content: `node_modules/\ndist/\n.env\n*.log\n` },
        { filename: 'README.md', content: `# ${targetFolder} (NestJS)\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n` }
      ]
    };
  }

  if (s.includes('koa')) {
    return {
      summary: `Koa minimalist backend starter in '${targetFolder}'`,
      ecosystem: 'node',
      files: [
        {
          filename: 'package.json',
          content: JSON.stringify({
            name: targetFolder,
            version: '1.0.0',
            private: true,
            main: 'server.js',
            scripts: { start: 'node server.js', dev: 'node --watch server.js' },
            dependencies: { koa: '^2.15.3', '@koa/router': '^13.1.0', '@koa/cors': '^5.0.0' }
          }, null, 2)
        },
        {
          filename: 'server.js',
          content: `const Koa = require('koa');\nconst Router = require('@koa/router');\nconst cors = require('@koa/cors');\nconst app = new Koa();\nconst router = new Router();\napp.use(cors());\nrouter.get('/api/health', (ctx) => { ctx.body = { status: 'ok', message: 'Koa backend is running', port: 5000 }; });\nrouter.get('/', (ctx) => { ctx.body = { message: 'Welcome to Koa backend API!', docs: '/api/health' }; });\napp.use(router.routes()).use(router.allowedMethods());\napp.listen(5000, () => { console.log('[rapidfire] Koa backend listening on port 5000'); });\n`
        },
        { filename: '.gitignore', content: `node_modules/\n.env\n*.log\n` },
        { filename: 'README.md', content: `# ${targetFolder} (Koa)\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n` }
      ]
    };
  }

  if (s.includes('ruby') || s.includes('sinatra')) {
    return {
      summary: `Ruby Sinatra backend starter in '${targetFolder}'`,
      ecosystem: 'ruby',
      files: [
        {
          filename: 'Gemfile',
          content: `source 'https://rubygems.org'\ngem 'sinatra', '~> 4.0'\ngem 'rack-cors', '~> 2.0'\ngem 'puma', '~> 6.4'\n`
        },
        {
          filename: 'app.rb',
          content: `require 'sinatra'\nrequire 'rack/cors'\nrequire 'json'\nset :port, 5000\nset :bind, '0.0.0.0'\nuse Rack::Cors do\n  allow do\n    origins '*'\n    resource '*', headers: :any, methods: [:get, :post, :options]\n  end\nend\nget '/api/health' do\n  content_type :json\n  { status: 'ok', message: 'Ruby Sinatra backend is running', port: 5000 }.to_json\nend\nget '/' do\n  content_type :json\n  { message: 'Welcome to Ruby Sinatra backend API!', docs: '/api/health' }.to_json\nend\n`
        },
        { filename: '.gitignore', content: `.bundle/\nvendor/\n.env\n*.log\n` },
        { filename: 'README.md', content: `# ${targetFolder} (Ruby Sinatra)\n\`\`\`bash\nbundle install\nbundle exec ruby app.rb\n\`\`\`\n` }
      ]
    };
  }

  if (s.includes('php')) {
    return {
      summary: `PHP minimal backend starter in '${targetFolder}'`,
      ecosystem: 'php',
      files: [
        {
          filename: 'composer.json',
          content: JSON.stringify({ name: `rapidfire/${targetFolder.toLowerCase()}`, description: 'PHP backend', type: 'project', require: { php: '>=8.1' } }, null, 2)
        },
        {
          filename: 'router.php',
          content: `<?php\nheader('Access-Control-Allow-Origin: *');\nheader('Access-Control-Allow-Methods: GET, POST, OPTIONS');\nheader('Access-Control-Allow-Headers: Content-Type');\nif ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }\n$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);\nif ($path === '/api/health') {\n  header('Content-Type: application/json');\n  echo json_encode(['status' => 'ok', 'message' => 'PHP backend is running', 'port' => 5000]);\n  exit;\n}\nheader('Content-Type: application/json');\necho json_encode(['message' => 'Welcome to PHP backend API!', 'docs' => '/api/health']);\n`
        },
        {
          filename: 'index.php',
          content: `<?php require_once __DIR__ . '/router.php';\n`
        },
        { filename: '.gitignore', content: `vendor/\n.env\n*.log\n` },
        { filename: 'README.md', content: `# ${targetFolder} (PHP)\n\`\`\`bash\nphp -S 0.0.0.0:5000 router.php\n\`\`\`\n` }
      ]
    };
  }

  if (s.includes('dotnet') || s.includes('csharp') || s.includes('cs')) {
    const pkgName = targetFolder.replace(/[^a-zA-Z0-9_]/g, '') || 'BackendApp';
    return {
      summary: `.NET C# Minimal API backend starter in '${targetFolder}'`,
      ecosystem: 'dotnet',
      files: [
        {
          filename: `${pkgName}.csproj`,
          content: `<Project Sdk="Microsoft.NET.Sdk.Web">\n  <PropertyGroup>\n    <TargetFramework>net8.0</TargetFramework>\n    <Nullable>enable</Nullable>\n    <ImplicitUsings>enable</ImplicitUsings>\n  </PropertyGroup>\n</Project>\n`
        },
        {
          filename: 'Program.cs',
          content: `var builder = WebApplication.CreateBuilder(args);\nbuilder.Services.AddCors(options => {\n    options.AddDefaultPolicy(policy => policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());\n});\nvar app = builder.Build();\napp.UseCors();\napp.MapGet("/api/health", () => Results.Json(new { status = "ok", message = ".NET C# Minimal API backend is running", port = 5000 }));\napp.MapGet("/", () => Results.Json(new { message = "Welcome to .NET C# backend API!", docs = "/api/health" }));\napp.Run("http://0.0.0.0:5000");\n`
        },
        { filename: '.gitignore', content: `bin/\nobj/\n.env\n*.log\n` },
        { filename: 'README.md', content: `# ${targetFolder} (.NET Minimal API)\n\`\`\`bash\ndotnet run\n\`\`\`\n` }
      ]
    };
  }

  return {
    summary: `Modern project skeleton for unknown framework '${stack}' in '${targetFolder}'`,
    ecosystem: 'node',
    files: [
      {
        filename: 'package.json',
        content: JSON.stringify({
          name: targetFolder,
          version: '1.0.0',
          private: true,
          description: `Project scaffolded dynamically with RapidFire CLI for '${stack}'`,
          scripts: {
            start: 'node src/index.js',
            dev: 'node --watch src/index.js'
          }
        }, null, 2)
      },
      {
        filename: 'src/index.js',
        content: `console.log('[rapidfire] Starting ${targetFolder} (${stack})...');\n`
      },
      {
        filename: '.gitignore',
        content: `node_modules/\ndist/\n.env\n*.log\n`
      },
      {
        filename: 'README.md',
        content: `# ${targetFolder}

Dynamically scaffolded with RapidFire CLI for custom stack: \`${stack}\`.

## Usage
\`\`\`bash
npm run dev
\`\`\`
`
      }
    ]
  };
}

function isBuiltinDynamicStack(stack) {
  const s = (stack || '').toLowerCase();
  const builtins = [
    'astro', 'angular', 'solid', 'preact', 'lit', 'nuxt', 'next',
    'sveltekit', 'vanilla', 'qwik', 'nest', 'koa', 'hono', 'fastify',
    'rust', 'go', 'ruby', 'php', 'dotnet', 'csharp'
  ];
  return builtins.some((b) => s.includes(b));
}

async function generateBlueprint(stack, targetFolder) {
  if (isBuiltinDynamicStack(stack)) {
    return getFallbackBlueprint(stack, targetFolder);
  }

  const config = getActiveAiConfig();

  if (!config.apiKey) {
    return getFallbackBlueprint(stack, targetFolder);
  }

  try {
    const provider = require('../ai/provider');
    const prompt = `You are a software scaffolding engine for RapidFire CLI.
The user wants to scaffold a new project for framework/stack: "${stack}" in directory "${targetFolder}".
Generate a complete, minimal, working starter project.
You MUST respond ONLY with valid JSON in this exact schema, without markdown formatting or code blocks:
{
  "summary": "Brief 1-sentence description of the project blueprint",
  "ecosystem": "node" | "python" | "go" | "rust" | "other",
  "files": [
    {
      "filename": "relative/path/to/file.ext",
      "content": "Full source code content"
    }
  ]
}`;

    const res = await provider.askAI(prompt, { isChat: false });
    const raw = (res && res.text) ? res.text : (typeof res === 'string' ? res : '');
    const cleanJson = raw.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (parsed.files && Array.isArray(parsed.files) && parsed.files.length > 0) {
      return {
        summary: parsed.summary || `Dynamically generated blueprint for '${stack}'`,
        ecosystem: parsed.ecosystem || 'node',
        files: parsed.files.map((f) => ({
          filename: (f.filename || 'app.js').replace(/^[/\\]+/, ''),
          content: f.content || ''
        }))
      };
    }

    return getFallbackBlueprint(stack, targetFolder);
  } catch (err) {
    console.log(`\x1b[33m[rapidfire-dynamic] AI query fallback (${err.message}). Using built-in generator...\x1b[0m`);
    return getFallbackBlueprint(stack, targetFolder);
  }
}

async function promptConfirmation(context, questionText, defaultChoice = 'y') {
  if (process.env.RAPIDFIRE_AUTO_DYNAMIC === '1' && (questionText.includes('dynamically scaffold') || questionText.includes('scaffold this'))) {
    return true;
  }
  if (process.env.RAPIDFIRE_AUTO_GIT === '1' && questionText.includes('Git repository')) {
    return true;
  }
  if (process.env.RAPIDFIRE_AUTO_GIT === '0' && questionText.includes('Git repository')) {
    return false;
  }

  if (context && typeof context.ask === 'function') {
    const ans = await context.ask(questionText);
    return Boolean(ans && ans.trim().toLowerCase().startsWith('y'));
  }

  if (context && context.rl) {
    return new Promise((resolve) => {
      context.rl.question(questionText, (ans) => {
        resolve(Boolean(ans && ans.trim().toLowerCase().startsWith('y')));
      });
    });
  }

  return defaultChoice.toLowerCase().startsWith('y');
}

async function generateFullstackBlueprint(frontend, backend, targetFolder, backendPort = 5000) {
  const config = getActiveAiConfig();

  if (!config.apiKey) {
    return null;
  }

  try {
    const provider = require('../ai/provider');
    const prompt = `You are a software scaffolding engine for RapidFire CLI.
The user wants to scaffold a connected full-stack application: frontend="${frontend}", backend="${backend}" in directory "${targetFolder}".
The backend must run on port ${backendPort} and configure permissive CORS.
The frontend should connect to http://localhost:${backendPort}/api/health.
Generate authentic, working files for BOTH frontend and backend in their respective directories.
Do NOT generate fake Node.js files if the requested backend is another language (e.g. Rust, Go, Python).
You MUST respond ONLY with valid JSON in this exact schema, without markdown formatting or code blocks:
{
  "summary": "Brief 1-sentence description of the full-stack architecture",
  "frontendFiles": [
    { "filename": "relative/path/within/frontend", "content": "Full code" }
  ],
  "backendFiles": [
    { "filename": "relative/path/within/backend", "content": "Full code" }
  ]
}`;

    const res = await provider.askAI(prompt, { isChat: false });
    const raw = (res && res.text) ? res.text : (typeof res === 'string' ? res : '');
    const cleanJson = raw.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (parsed.frontendFiles && Array.isArray(parsed.frontendFiles) && parsed.frontendFiles.length > 0 &&
        parsed.backendFiles && Array.isArray(parsed.backendFiles) && parsed.backendFiles.length > 0) {
      return {
        summary: parsed.summary || `Dynamically generated full-stack blueprint for '${frontend}+${backend}'`,
        frontendFiles: parsed.frontendFiles.map(f => ({
          filename: (f.filename || 'main.js').replace(/^[/\\]+/, '').replace(/^frontend[/\\]/, ''),
          content: f.content || ''
        })),
        backendFiles: parsed.backendFiles.map(f => ({
          filename: (f.filename || 'server.js').replace(/^[/\\]+/, '').replace(/^backend[/\\]/, ''),
          content: f.content || ''
        }))
      };
    }
    return null;
  } catch (err) {
    console.log(`\x1b[33m[rapidfire-dynamic] AI fullstack query notice (${err.message}). Using built-in generator...\x1b[0m`);
    return null;
  }
}

function getDynamicFrontendFiles(feName, appName, backendPort = 5000) {
  const s = feName.toLowerCase();
  if (s.includes('angular')) {
    return [
      {
        filename: 'package.json',
        content: JSON.stringify({
          name: `${appName}-frontend`,
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
        }, null, 2)
      },
      {
        filename: 'tsconfig.json',
        content: JSON.stringify({
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
        }, null, 2)
      },
      {
        filename: 'tsconfig.app.json',
        content: JSON.stringify({
          extends: './tsconfig.json',
          compilerOptions: {
            outDir: './out-tsc/app',
            types: []
          },
          files: ['src/main.ts'],
          include: ['src/**/*.d.ts']
        }, null, 2)
      },
      {
        filename: 'vite.config.ts',
        content: `import { defineConfig } from 'vite';\nimport angular from '@analogjs/vite-plugin-angular';\nexport default defineConfig({ plugins: [angular()], server: { port: 3000 } });\n`
      },
      {
        filename: 'public/favicon.ico',
        content: ''
      },
      {
        filename: 'index.html',
        content: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><title>${appName} Frontend</title><meta name="viewport" content="width=device-width, initial-scale=1" /><link rel="icon" type="image/x-icon" href="/favicon.ico" /></head><body style="margin:0; background:#0f172a; color:#f8fafc; font-family:system-ui, sans-serif;"><app-root></app-root><script type="module" src="/src/main.ts"></script></body></html>\n`
      },
      {
        filename: '.env.example',
        content: `VITE_API_URL=http://localhost:${backendPort}\n`
      },
      {
        filename: 'src/styles.css',
        content: `html, body { height: 100%; margin: 0; background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; }\n`
      },
      {
        filename: 'src/app/app.routes.ts',
        content: `import { Routes } from '@angular/router';\nexport const routes: Routes = [];\n`
      },
      {
        filename: 'src/app/app.config.ts',
        content: `import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';\nimport { provideHttpClient } from '@angular/common/http';\nimport { provideRouter } from '@angular/router';\nimport { routes } from './app.routes';\nexport const appConfig: ApplicationConfig = {\n  providers: [\n    provideZoneChangeDetection({ eventCoalescing: true }),\n    provideHttpClient(),\n    provideRouter(routes)\n  ]\n};\n`
      },
      {
        filename: 'src/main.ts',
        content: `import 'zone.js';\nimport { bootstrapApplication } from '@angular/platform-browser';\nimport { appConfig } from './app/app.config';\nimport { AppComponent } from './app/app.component';\nimport './styles.css';\nbootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));\n`
      },
      {
        filename: 'src/app/app.component.ts',
        content: `import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

const API_URL = 'http://localhost:${backendPort}';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  template: \`
    <div style="max-width: 640px; margin: 4rem auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 2.5rem; text-align: center; color: #f8fafc; font-family: system-ui;">
      <div style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; background: rgba(6,182,212,0.15); color: #06b6d4; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem;">
        [ARCH] Dual-Tier Microservice Architecture
      </div>
      <h1 style="font-size: 1.8rem; margin-bottom: 0.5rem; color: #38bdf8;">RapidFire Angular Frontend</h1>
      <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem;">Connected to Backend API (${backendPort}) with CORS pre-configured.</p>
      <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 1.5rem;">
        <button style="padding: 0.75rem 1.5rem; border-radius: 8px; background: #2563eb; color: #fff; border: none; font-weight: 600; cursor: pointer;" (click)="increment()">
          State Counter: {{ count() }}
        </button>
        <button style="padding: 0.75rem 1.5rem; border-radius: 8px; background: #059669; color: #fff; border: none; font-weight: 600; cursor: pointer;" (click)="testBackendApi()" [disabled]="loading()">
          {{ loading() ? 'Pinging Backend...' : 'Test Backend API (/api/health)' }}
        </button>
      </div>
      <div *ngIf="apiResponse()" [style.marginTop]="'1.5rem'" [style.padding]="'1rem'" [style.borderRadius]="'8px'" [style.background]="apiResponse().status === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'" [style.border]="apiResponse().status === 'success' ? '1px solid #10b981' : '1px solid #ef4444'" style="text-align: left; font-family: monospace; font-size: 0.85rem;">
        <div [style.color]="apiResponse().status === 'success' ? '#34d399' : '#f87171'" style="font-weight: bold;">
          {{ apiResponse().status === 'success' ? '[200 OK] Backend Connected!' : '[OFFLINE] Backend Server Offline' }}
        </div>
        <pre style="margin: 0.5rem 0 0 0; color: #e2e8f0;">{{ apiResponse().data | json }}</pre>
      </div>
    </div>
  \`
})
export class AppComponent {
  count = signal(0);
  apiResponse = signal<any>(null);
  loading = signal(false);

  increment() {
    this.count.update((c) => c + 1);
  }

  async testBackendApi() {
    this.loading.set(true);
    try {
      const res = await fetch(API_URL + '/api/health');
      const data = await res.json();
      this.apiResponse.set({ status: 'success', data });
    } catch (err: any) {
      this.apiResponse.set({ status: 'offline', data: { error: err.message } });
    } finally {
      this.loading.set(false);
    }
  }
}
`
      },
      {
        filename: '.gitignore',
        content: `node_modules/\ndist/\n.env\n`
      },
      {
        filename: 'README.md',
        content: `# ${appName} Frontend (${feName})\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`
      }
    ];
  }

  if (s.includes('solid')) {
    return [
      {
        filename: 'package.json',
        content: JSON.stringify({
          name: `${appName}-frontend`,
          version: '0.0.0',
          type: 'module',
          scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
          dependencies: { 'solid-js': '^1.9.0' },
          devDependencies: { vite: '^5.4.0', 'vite-plugin-solid': '^2.11.0' }
        }, null, 2)
      },
      {
        filename: 'vite.config.js',
        content: `import { defineConfig } from 'vite';\nimport solidPlugin from 'vite-plugin-solid';\nexport default defineConfig({ plugins: [solidPlugin()], server: { port: 3000 } });\n`
      },
      {
        filename: 'public/favicon.ico',
        content: ''
      },
      {
        filename: 'index.html',
        content: `<!DOCTYPE html><html lang="en"><head><title>${appName} Frontend</title><link rel="icon" type="image/x-icon" href="/favicon.ico" /></head><body><div id="root"></div><script type="module" src="/src/index.jsx"></script></body></html>\n`
      },
      {
        filename: '.env.example',
        content: `VITE_API_URL=http://localhost:${backendPort}\n`
      },
      {
        filename: 'src/index.jsx',
        content: `import { render } from 'solid-js/web';\nimport App from './App';\nrender(() => <App />, document.getElementById('root'));\n`
      },
      {
        filename: 'src/App.jsx',
        content: `import { createSignal } from 'solid-js';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:${backendPort}';

export default function App() {
  const [count, setCount] = createSignal(0);
  const [apiResponse, setApiResponse] = createSignal(null);
  const [loading, setLoading] = createSignal(false);

  const testBackendApi = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_URL + '/api/health');
      const data = await res.json();
      setApiResponse({ status: 'success', data });
    } catch (err) {
      setApiResponse({ status: 'offline', error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '640px', margin: '4rem auto', background: '#131b2e', border: '1px solid #1e293b', borderRadius: '16px', padding: '2.5rem', textAlign: 'center', color: '#f8fafc', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', color: '#38bdf8' }}>RapidFire ${feName} Frontend</h1>
      <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2rem' }}>Connected to Backend API (${backendPort}) with CORS pre-configured.</p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
        <button style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }} onClick={() => setCount(c => c + 1)}>
          State Counter: {count()}
        </button>
        <button style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', background: '#059669', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }} onClick={testBackendApi} disabled={loading()}>
          {loading() ? 'Pinging Backend...' : 'Test Backend API (/api/health)'}
        </button>
      </div>
      {apiResponse() && (
        <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: '8px', background: apiResponse().status === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: '1px solid ' + (apiResponse().status === 'success' ? '#10b981' : '#ef4444'), textAlign: 'left', fontFamily: 'monospace', fontSize: '0.85rem' }}>
          <div style={{ fontWeight: 'bold', color: apiResponse().status === 'success' ? '#34d399' : '#f87171' }}>
            {apiResponse().status === 'success' ? '[200 OK] Backend Connected!' : '[OFFLINE] Backend Server Offline'}
          </div>
          <pre style={{ margin: '0.5rem 0 0 0', color: '#e2e8f0' }}>{JSON.stringify(apiResponse().data || { error: apiResponse().error }, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
`
      },
      {
        filename: '.gitignore',
        content: `node_modules/\ndist/\n.env\n`
      },
      {
        filename: 'README.md',
        content: `# ${appName} Frontend (${feName})\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`
      }
    ];
  }

  return [
    {
      filename: 'package.json',
      content: JSON.stringify({
        name: `${appName}-frontend`,
        version: '0.0.0',
        type: 'module',
        scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
        devDependencies: { vite: '^5.4.0' }
      }, null, 2)
    },
    {
      filename: 'vite.config.js',
      content: `import { defineConfig } from 'vite';\nexport default defineConfig({ server: { port: 3000 } });\n`
    },
    {
      filename: 'index.html',
      content: `<!DOCTYPE html><html lang="en"><head><title>${appName} Frontend</title></head><body><div id="app"></div><script type="module" src="/src/main.js"></script></body></html>\n`
    },
    {
      filename: '.env.example',
      content: `VITE_API_URL=http://localhost:${backendPort}\n`
    },
    {
      filename: 'src/main.js',
      content: `const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:${backendPort}';
const app = document.getElementById('app');
app.innerHTML = \`
  <div style="max-width:640px; margin:4rem auto; background:#131b2e; border:1px solid #1e293b; border-radius:16px; padding:2.5rem; text-align:center; color:#f8fafc; font-family:system-ui;">
    <h1 style="color:#38bdf8;">RapidFire ${feName} Frontend</h1>
    <p style="color:#94a3b8; font-size:0.9rem;">Connected to Backend API (${backendPort})</p>
    <button id="pingBtn" style="padding:0.75rem 1.5rem; border-radius:8px; background:#059669; color:#fff; border:none; font-weight:600; cursor:pointer;">Test Backend API</button>
    <div id="output" style="margin-top:1.5rem; text-align:left; font-family:monospace; font-size:0.85rem;"></div>
  </div>
\`;
document.getElementById('pingBtn').addEventListener('click', async () => {
  const out = document.getElementById('output');
  out.textContent = 'Pinging...';
  try {
    const res = await fetch(API_URL + '/api/health');
    const data = await res.json();
    out.style.color = '#34d399';
    out.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    out.style.color = '#f87171';
    out.textContent = 'Backend offline: ' + err.message;
  }
});
`
    },
    {
      filename: '.gitignore',
      content: `node_modules/\ndist/\n.env\n`
    },
    {
      filename: 'README.md',
      content: `# ${appName} Frontend (${feName})\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`
    }
  ];
}

function getDynamicBackendFiles(beName, appName, backendPort = 5000) {
  const s = beName.toLowerCase();
  if (s.includes('rust') || s.includes('axum') || s.includes('actix')) {
    const pkgName = `${appName.toLowerCase().replace(/[^a-z0-9_]/g, '_')}_backend`;
    return [
      {
        filename: 'Cargo.toml',
        content: `[package]\nname = "${pkgName}"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\naxum = "0.7"\ntokio = { version = "1.0", features = ["full"] }\ntower-http = { version = "0.5", features = ["cors"] }\nserde = { version = "1.0", features = ["derive"] }\nserde_json = "1.0"\n`
      },
      {
        filename: 'src/main.rs',
        content: `use axum::{
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde::Serialize;
use tower_http::cors::{Any, CorsLayer};

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    message: &'static str,
    port: u16,
}

#[derive(Serialize)]
struct RootResponse {
    message: &'static str,
    docs: &'static str,
}

async fn health_check() -> impl IntoResponse {
    Json(HealthResponse {
        status: "ok",
        message: "Rust Axum backend is running",
        port: ${backendPort},
    })
}

async fn root() -> impl IntoResponse {
    Json(RootResponse {
        message: "Welcome to Rust Axum backend API!",
        docs: "/api/health",
    })
}

#[tokio::main]
async fn main() {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/", get(root))
        .route("/api/health", get(health_check))
        .layer(cors);

    let addr = format!("0.0.0.0:{}", ${backendPort});
    let listener = match tokio::net::TcpListener::bind(&addr).await {
        Ok(l) => {
            println!("[rapidfire] Rust Axum backend listening on port {}", ${backendPort});
            l
        }
        Err(err) => {
            eprintln!("[rapidfire] Error: Port {} is already in use ({}).", ${backendPort}, err);
            eprintln!("[rapidfire] Hint: Run 'stop {}' in Rapidfire or free port {} before running.", ${backendPort}, ${backendPort});
            std::process::exit(1);
        }
    };
    if let Err(err) = axum::serve(listener, app).await {
        eprintln!("[rapidfire] Error serving Axum: {}", err);
    }
}
`
      },
      {
        filename: '.gitignore',
        content: `target/\n*.exe\n.env\n*.log\n`
      },
      {
        filename: 'README.md',
        content: `# ${appName} Backend (${beName})\n\`\`\`bash\ncargo run\n\`\`\`\n`
      }
    ];
  }

  if (s.includes('hono')) {
    return [
      {
        filename: 'package.json',
        content: JSON.stringify({
          name: `${appName}-backend`,
          version: '1.0.0',
          private: true,
          main: 'index.js',
          scripts: { start: 'node index.js', dev: 'node --watch index.js' },
          dependencies: {
            hono: '^4.6.0',
            '@hono/node-server': '^1.13.0'
          }
        }, null, 2)
      },
      {
        filename: 'index.js',
        content: `const { serve } = require('@hono/node-server');
const { Hono } = require('hono');
const { cors } = require('hono/cors');

const app = new Hono();
app.use('*', cors());

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', message: 'Hono backend is running', port: ${backendPort} });
});

app.get('/', (c) => {
  return c.json({ message: 'Welcome to Hono backend API!', docs: '/api/health' });
});

serve({ fetch: app.fetch, port: ${backendPort} }, (info) => {
  console.log(\`[rapidfire] Hono backend listening on http://localhost:\${info.port}\`);
});
`
      },
      {
        filename: '.gitignore',
        content: `node_modules/\n.env\n*.log\n`
      },
      {
        filename: 'README.md',
        content: `# ${appName} Backend (${beName})\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`
      }
    ];
  }

  if (s.includes('go')) {
    return [
      {
        filename: 'go.mod',
        content: `module ${appName}-backend\n\ngo 1.21\n`
      },
      {
        filename: 'main.go',
        content: `package main

import (
	"encoding/json"
	"fmt"
	"net/http"
)

type HealthResponse struct {
	Status  string \`json:"status"\`
	Message string \`json:"message"\`
	Port    int    \`json:"port"\`
}

func enableCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	resp := HealthResponse{Status: "ok", Message: "Go backend is running", Port: ${backendPort}}
	json.NewEncoder(w).Encode(resp)
}

func main() {
	http.HandleFunc("/api/health", enableCORS(healthHandler))
	fmt.Printf("[rapidfire] Go backend listening on port %d\\n", ${backendPort})
	http.ListenAndServe(fmt.Sprintf(":%d", ${backendPort}), nil)
}
`
      },
      {
        filename: '.gitignore',
        content: `target/\n*.exe\n.env\n`
      },
      {
        filename: 'README.md',
        content: `# ${appName} Backend (${beName})\n\`\`\`bash\ngo run .\n\`\`\`\n`
      }
    ];
  }

  if (s.includes('fastapi') || s.includes('python') || s.includes('py')) {
    return [
      {
        filename: 'requirements.txt',
        content: `fastapi>=0.115.0\nuvicorn>=0.32.0\n`
      },
      {
        filename: 'main.py',
        content: `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="${appName} Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {"status": "ok", "message": "FastAPI backend is running", "port": ${backendPort}}

@app.get("/")
def root():
    return {"message": "Welcome to FastAPI backend API!", "docs": "/docs"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=${backendPort}, reload=True)
`
      },
      {
        filename: '.gitignore',
        content: `__pycache__/\n*.pyc\nvenv/\n.venv/\n.env\n`
      },
      {
        filename: 'README.md',
        content: `# ${appName} Backend (FastAPI)\n\`\`\`bash\nuvicorn main:app --reload --port ${backendPort}\n\`\`\`\n`
      }
    ];
  }

  if (s.includes('flask')) {
    return [
      {
        filename: 'requirements.txt',
        content: `flask>=3.0.0\nflask-cors>=4.0.0\n`
      },
      {
        filename: 'app.py',
        content: `from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "message": "Flask backend is running", "port": ${backendPort}})

@app.route("/")
def root():
    return jsonify({"message": "Welcome to Flask backend API!", "docs": "/api/health"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=${backendPort}, debug=True)
`
      },
      {
        filename: '.gitignore',
        content: `__pycache__/\n*.pyc\nvenv/\n.venv/\n.env\n`
      },
      {
        filename: 'README.md',
        content: `# ${appName} Backend (Flask)\n\`\`\`bash\npython app.py\n\`\`\`\n`
      }
    ];
  }

  return [
    {
      filename: 'package.json',
      content: JSON.stringify({
        name: `${appName}-backend`,
        version: '1.0.0',
        private: true,
        main: 'server.js',
        scripts: { start: 'node server.js', dev: 'node --watch server.js' },
        dependencies: {
          express: '^4.21.2',
          cors: '^2.8.5'
        }
      }, null, 2)
    },
    {
      filename: 'server.js',
      content: `const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || ${backendPort};

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '${beName} backend is running', port: PORT });
});

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to ${beName} backend API!', docs: '/api/health' });
});

app.listen(PORT, () => {
  console.log(\`[rapidfire] Backend server running at http://localhost:\${PORT}\`);
});
`
    },
    {
      filename: '.gitignore',
      content: `node_modules/\n.env\n*.log\n`
    },
    {
      filename: 'README.md',
      content: `# ${appName} Backend (${beName})\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`
    }
  ];
}

async function scaffoldDynamicFullstack(projectPath, targetFolder, plan, context = {}) {
  const frontend = plan.frontend;
  const backend = plan.backend;
  const backendPort = ['fastapi', 'django'].includes(backend) ? 8000 : 5000;

  console.log(`\n\x1b[36m[rapidfire-dynamic] Scaffolding connected full-stack pairing: ${frontend} (frontend) + ${backend} (backend)...\x1b[0m`);

  fse.ensureDirSync(projectPath);
  const frontendDir = path.join(projectPath, 'frontend');
  const backendDir = path.join(projectPath, 'backend');
  fse.ensureDirSync(frontendDir);
  fse.ensureDirSync(backendDir);

  const confirmPrompt = `\n\x1b[1m\x1b[33mDo you want to scaffold this connected full-stack '${frontend}+${backend}' project now? (Y/N):\x1b[0m `;
  const approved = await promptConfirmation(context, confirmPrompt);

  if (!approved) {
    console.log(`\x1b[33m[rapidfire-dynamic] Scaffolding aborted by user. No files written.\x1b[0m`);
    try {
      if (fse.existsSync(projectPath) && fse.readdirSync(projectPath).length === 0) {
        fse.removeSync(projectPath);
      }
    } catch {}
    return { success: false, aborted: true };
  }

  console.log(`\n[rapidfire-dynamic] Writing connected full-stack files in ${targetFolder}...`);

  let aiBlueprint = null;
  if (!hasFrontendAdapter(frontend) || !hasBackendAdapter(backend)) {
    aiBlueprint = await generateFullstackBlueprint(frontend, backend, targetFolder, backendPort);
  }

  if (hasFrontendAdapter(frontend)) {
    const adapter = getFrontendAdapter(frontend);
    adapter(frontendDir, { port: 3000, apiPort: backendPort, isStandalone: false, appName: targetFolder });
  } else if (aiBlueprint && aiBlueprint.frontendFiles) {
    for (const file of aiBlueprint.frontendFiles) {
      const fullPath = path.join(frontendDir, file.filename);
      fse.ensureDirSync(path.dirname(fullPath));
      fse.writeFileSync(fullPath, file.content, 'utf8');
    }
  } else {
    const feFiles = getDynamicFrontendFiles(frontend, targetFolder, backendPort);
    for (const file of feFiles) {
      const fullPath = path.join(frontendDir, file.filename);
      fse.ensureDirSync(path.dirname(fullPath));
      fse.writeFileSync(fullPath, file.content, 'utf8');
    }
  }

  if (hasBackendAdapter(backend)) {
    const adapter = getBackendAdapter(backend);
    adapter(backendDir, targetFolder, { port: backendPort, isStandalone: false });
  } else if (aiBlueprint && aiBlueprint.backendFiles) {
    for (const file of aiBlueprint.backendFiles) {
      const fullPath = path.join(backendDir, file.filename);
      fse.ensureDirSync(path.dirname(fullPath));
      fse.writeFileSync(fullPath, file.content, 'utf8');
    }
  } else {
    const beFiles = getDynamicBackendFiles(backend, targetFolder, backendPort);
    for (const file of beFiles) {
      const fullPath = path.join(backendDir, file.filename);
      fse.ensureDirSync(path.dirname(fullPath));
      fse.writeFileSync(fullPath, file.content, 'utf8');
    }
  }

  if (['fastapi', 'django', 'flask'].includes(backend) || fse.existsSync(path.join(backendDir, 'requirements.txt'))) {
    const { maybePromptForVenv } = require('../commands/setup');
    await maybePromptForVenv(backendDir, context);
  }

  fse.writeFileSync(
    path.join(projectPath, '.gitignore'),
    `node_modules/\ndist/\n.env\n__pycache__/\n*.pyc\nvenv/\n.venv/\ntarget/\n*.log\n`,
    'utf8'
  );

  let backendStartInstruction = 'npm run dev';
  if (backend.includes('rust') || backend.includes('axum') || backend.includes('actix') || fse.existsSync(path.join(backendDir, 'Cargo.toml'))) {
    backendStartInstruction = 'cargo run';
    if (!commandExists('cargo')) {
      console.error('\x1b[31m[rapidfire] Error: No Rust (cargo) found in your system PATH.\x1b[0m');
      console.log(`\x1b[33m[rapidfire] Hint: Installation instructions for your system:\x1b[0m\n${getRustInstallInstructions()}`);
    }
  } else if (backend.includes('go') || fse.existsSync(path.join(backendDir, 'main.go'))) {
    backendStartInstruction = 'go run .';
    if (!commandExists('go')) {
      console.error('\x1b[31m[rapidfire] Error: No Go runtime found in your system PATH.\x1b[0m');
      console.log(`\x1b[33m[rapidfire] Hint: Installation instructions for your system:\x1b[0m\n${getGoInstallInstructions()}`);
    }
  } else if (backend.includes('dotnet') || fse.existsSync(path.join(backendDir, 'Backend.csproj')) || fse.existsSync(path.join(backendDir, 'Program.cs'))) {
    backendStartInstruction = 'dotnet run';
    if (!commandExists('dotnet')) {
      console.error('\x1b[31m[rapidfire] Error: No .NET SDK found in your system PATH.\x1b[0m');
      console.log(`\x1b[33m[rapidfire] Hint: Installation instructions for your system:\x1b[0m\n${getDotnetInstallInstructions()}`);
    }
  } else if (['fastapi', 'django', 'flask'].includes(backend) || fse.existsSync(path.join(backendDir, 'requirements.txt'))) {
    backendStartInstruction = backend === 'django' ? 'python manage.py runserver 8000' : 'uvicorn main:app --reload';
    if (!commandExists('python3') && !commandExists('python')) {
      console.error('\x1b[31m[rapidfire] Error: No Python 3 found in your system PATH.\x1b[0m');
      console.log(`\x1b[33m[rapidfire] Hint: Installation instructions for your system:\x1b[0m\n${getPythonInstallInstructions()}`);
    }
  }

  const readmeContent = `# ${targetFolder}

Scaffolded with RapidFire CLI (\`setup ${frontend}+${backend}\`).

## Architecture
Dual-tier microservice architecture with connected frontend and backend.

## Frontend (${frontend.toUpperCase()})
\`\`\`bash
cd frontend
npm run dev
\`\`\`

## Backend (${backend.toUpperCase()})
\`\`\`bash
cd backend
${backendStartInstruction}
\`\`\`

## Full-Stack Execution
To launch both frontend and backend concurrently in 1 command:
\`\`\`bash
run ${targetFolder}
\`\`\`
`;
  fse.writeFileSync(path.join(projectPath, 'README.md'), readmeContent, 'utf8');

  const manifestData = {
    schemaVersion: 2,
    name: targetFolder,
    recipe: `${frontend}+${backend}`,
    frontend,
    backend,
    isFullstack: true,
    generationMode: 'dynamic',
    createdAt: new Date().toISOString(),
    rapidfireVersion: require('../../package.json').version || '0.1.32'
  };
  fse.writeJsonSync(path.join(projectPath, '.rapidfire.json'), manifestData, { spaces: 2 });

  if (process.env.RAPIDFIRE_SKIP_INSTALL !== '1' && fse.existsSync(path.join(frontendDir, 'package.json')) && commandExists('npm')) {
    console.log(`[rapidfire] Installing ${frontend} frontend dependencies from LTS...`);
    try {
      run('npm install', { cwd: frontendDir, stdio: 'pipe' });
      console.log(`\x1b[32m[OK] ${frontend} frontend dependencies installed.\x1b[0m`);
    } catch (err) {
      try {
        run('npm install --legacy-peer-deps', { cwd: frontendDir, stdio: 'pipe' });
        console.log(`\x1b[32m[OK] ${frontend} frontend dependencies installed.\x1b[0m`);
      } catch (innerErr) {
        console.warn('\x1b[33m[rapidfire] npm install notice:\x1b[0m', innerErr.message);
      }
    }
  }

  if (process.env.RAPIDFIRE_SKIP_INSTALL !== '1' && fse.existsSync(path.join(backendDir, 'package.json')) && commandExists('npm')) {
    console.log(`[rapidfire] Installing ${backend} backend dependencies from LTS...`);
    try {
      run('npm install', { cwd: backendDir, stdio: 'pipe' });
      console.log(`\x1b[32m[OK] ${backend} backend dependencies installed.\x1b[0m`);
    } catch (err) {
      try {
        run('npm install --legacy-peer-deps', { cwd: backendDir, stdio: 'pipe' });
        console.log(`\x1b[32m[OK] ${backend} backend dependencies installed.\x1b[0m`);
      } catch (innerErr) {
        console.warn('\x1b[33m[rapidfire] npm install notice:\x1b[0m', innerErr.message);
      }
    }
  }

  if (fse.existsSync(path.join(backendDir, 'requirements.txt'))) {
    const { maybePromptForVenv } = require('../commands/setup');
    await maybePromptForVenv(backendDir, context);
  }

  await setupGitAndGithub(projectPath, targetFolder, context);

  console.log(`\n\x1b[32m╔════════════════════════════════════════════════════╗\x1b[0m`);
  console.log(`\x1b[32m║  Project '${targetFolder}' (${frontend}+${backend}) ready!  ║\x1b[0m`);
  console.log(`\x1b[32m╚════════════════════════════════════════════════════╝\x1b[0m\n`);
  console.log(`Next steps:`);
  console.log(`  \x1b[1m\x1b[32m• Run full-stack application now:\x1b[0m run ${targetFolder}`);
  console.log(`  \x1b[36m• Inspect code & architecture:\x1b[0m    explain ${targetFolder}`);
  console.log(`  \x1b[36m• Navigate into folder:\x1b[0m           cd ${targetFolder}`);
  console.log(`  \x1b[35m• Save as preset anytime:\x1b[0m         save preset <name> ${targetFolder}`);

  return { success: true, manifest: manifestData };
}

async function scaffoldDynamicFramework(projectPath, targetFolder, plan, context = {}) {
  if (plan && (plan.isFullstackPairing || (plan.frontend && plan.backend))) {
    return await scaffoldDynamicFullstack(projectPath, targetFolder, plan, context);
  }

  const stack = plan.stack;
  fse.ensureDirSync(projectPath);

  console.log(`\n\x1b[36m[rapidfire-dynamic] Generating blueprint for unknown framework '${stack}'...\x1b[0m`);
  const blueprint = await generateBlueprint(stack, targetFolder);

  console.log(`\n\x1b[32m[Blueprint]:\x1b[0m ${blueprint.summary}`);
  console.log(`\x1b[1mProposed files to generate in '${targetFolder}':\x1b[0m`);

  const sanitizedFiles = [];
  for (const file of blueprint.files) {
    let cleanName = path.normalize(file.filename).replace(/^(\.\.[\/\\])+/, '');
    if (cleanName.startsWith(targetFolder + path.sep) || cleanName.startsWith(targetFolder + '/')) {
      cleanName = cleanName.slice(targetFolder.length + 1);
    }
    const absPath = path.resolve(projectPath, cleanName);

    if (!absPath.startsWith(projectPath)) {
      console.warn(`  \x1b[33m[WARN] Skipped unsafe file path: ${file.filename}\x1b[0m`);
      continue;
    }

    const lineCount = (file.content.match(/\n/g) || []).length + 1;
    console.log(`  • \x1b[36m${cleanName}\x1b[0m (${lineCount} lines)`);
    sanitizedFiles.push({ cleanName, absPath, content: file.content });
  }

  const confirmPrompt = `\n\x1b[1m\x1b[33mDo you want to scaffold this '${stack}' project now? (Y/N):\x1b[0m `;
  const approved = await promptConfirmation(context, confirmPrompt);

  if (!approved) {
    console.log(`\x1b[33m[rapidfire-dynamic] Scaffolding aborted by user. No files written.\x1b[0m`);
    try {
      if (fse.existsSync(projectPath) && fse.readdirSync(projectPath).length === 0) {
        fse.removeSync(projectPath);
      }
    } catch {}
    return { success: false, aborted: true };
  }

  console.log(`\n[rapidfire-dynamic] Writing project files to ${targetFolder}...`);
  for (const f of sanitizedFiles) {
    fse.ensureDirSync(path.dirname(f.absPath));
    fse.writeFileSync(f.absPath, f.content, 'utf8');
  }

  const hasGitignore = sanitizedFiles.some(f => f.cleanName === '.gitignore');
  if (!hasGitignore) {
    const defaultIgnore = blueprint.ecosystem === 'python'
      ? '__pycache__/\n*.pyc\nvenv/\n.env\n'
      : 'node_modules/\ndist/\n.env\n*.log\n';
    fse.writeFileSync(path.join(projectPath, '.gitignore'), defaultIgnore, 'utf8');
  }

  const manifestData = {
    schemaVersion: 2,
    name: targetFolder,
    recipe: stack,
    generationMode: 'dynamic',
    ecosystem: blueprint.ecosystem || 'node',
    createdAt: new Date().toISOString(),
    rapidfireVersion: require('../../package.json').version || '0.1.32'
  };
  fse.writeJsonSync(path.join(projectPath, '.rapidfire.json'), manifestData, { spaces: 2 });

  await setupGitAndGithub(projectPath, targetFolder, context);

  if (process.env.RAPIDFIRE_SKIP_INSTALL !== '1' && blueprint.ecosystem === 'node' && fse.existsSync(path.join(projectPath, 'package.json')) && commandExists('npm')) {
    const installPrompt = `\nDo you want to run 'npm install' now? (Y/N): `;
    const shouldInstall = await promptConfirmation(context, installPrompt, 'y');
    if (shouldInstall) {
      console.log('[rapidfire] Installing dependencies with npm...');
      try {
        run('npm install', { cwd: projectPath, stdio: 'inherit' });
      } catch (err) {
        try {
          run('npm install --legacy-peer-deps', { cwd: projectPath, stdio: 'inherit' });
        } catch (innerErr) {
          console.warn('\x1b[33m[rapidfire] npm install notice:\x1b[0m', innerErr.message);
        }
      }
    }
  }

  if (blueprint.ecosystem === 'python' || fse.existsSync(path.join(projectPath, 'requirements.txt'))) {
    if (!commandExists('python3') && !commandExists('python')) {
      console.error('\x1b[31m[rapidfire] Error: No Python 3 found in your system PATH.\x1b[0m');
      console.log(`\x1b[33m[rapidfire] Hint: Installation instructions for your system:\x1b[0m\n${getPythonInstallInstructions()}`);
    }
    const { maybePromptForVenv } = require('../commands/setup');
    await maybePromptForVenv(projectPath, context);
  } else if (fse.existsSync(path.join(projectPath, 'Cargo.toml'))) {
    if (!commandExists('cargo')) {
      console.error('\x1b[31m[rapidfire] Error: No Rust (cargo) found in your system PATH.\x1b[0m');
      console.log(`\x1b[33m[rapidfire] Hint: Installation instructions for your system:\x1b[0m\n${getRustInstallInstructions()}`);
    }
  } else if (fse.existsSync(path.join(projectPath, 'main.go'))) {
    if (!commandExists('go')) {
      console.error('\x1b[31m[rapidfire] Error: No Go runtime found in your system PATH.\x1b[0m');
      console.log(`\x1b[33m[rapidfire] Hint: Installation instructions for your system:\x1b[0m\n${getGoInstallInstructions()}`);
    }
  } else if (fse.existsSync(path.join(projectPath, 'Backend.csproj')) || fse.existsSync(path.join(projectPath, 'Program.cs'))) {
    if (!commandExists('dotnet')) {
      console.error('\x1b[31m[rapidfire] Error: No .NET SDK found in your system PATH.\x1b[0m');
      console.log(`\x1b[33m[rapidfire] Hint: Installation instructions for your system:\x1b[0m\n${getDotnetInstallInstructions()}`);
    }
  }


  console.log(`\n\x1b[32m╔════════════════════════════════════════════════════╗\x1b[0m`);
  console.log(`\x1b[32m║  Project '${targetFolder}' (${stack}) ready!  ║\x1b[0m`);
  console.log(`\x1b[32m╚════════════════════════════════════════════════════╝\x1b[0m\n`);
  console.log(`Next steps:`);
  console.log(`  \x1b[36mcd ${targetFolder}\x1b[0m`);
  console.log(`  \x1b[35m• Save as preset anytime:\x1b[0m save preset <name> ${targetFolder}`);

  return { success: true, manifest: manifestData };
}

module.exports = {
  getFallbackBlueprint,
  generateBlueprint,
  generateFullstackBlueprint,
  getDynamicFrontendFiles,
  getDynamicBackendFiles,
  scaffoldDynamicFullstack,
  scaffoldDynamicFramework
};
