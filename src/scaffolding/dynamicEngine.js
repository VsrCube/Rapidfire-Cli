const path = require('path');
const fse = require('fs-extra');
const { getActiveAiConfig } = require('../ai/gemini');
const { installPrePushHook } = require('../integrations/gitleaks');
const { isGhInstalled, isGhAuthenticated, createRepo } = require('../integrations/gh');
const { run, commandExists } = require('../utils/proc');
const { getParentGitRepo } = require('../utils/gitContext');
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
          filename: 'src/pages/index.astro',
          content: `---
// RapidFire Dynamic Scaffolding for Astro
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
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
          filename: 'index.html',
          content: `<!DOCTYPE html><html lang="en"><head><title>RapidFire SolidJS</title></head><body><div id="root"></div><script type="module" src="/src/index.jsx"></script></body></html>\n`
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
        content: `// RapidFire Dynamic Scaffolding for: ${stack}
console.log('[rapidfire] Starting ${targetFolder} (${stack})...');
`
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

async function generateBlueprint(stack, targetFolder) {
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

function getDynamicFrontendFiles(feName, appName, backendPort = 5000) {
  const s = feName.toLowerCase();
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
        filename: 'index.html',
        content: `<!DOCTYPE html><html lang="en"><head><title>${appName} Frontend</title></head><body><div id="root"></div><script type="module" src="/src/index.jsx"></script></body></html>\n`
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

  if (plan.knownFrontend && hasFrontendAdapter(frontend)) {
    const adapter = getFrontendAdapter(frontend);
    adapter(frontendDir, { port: 3000, apiPort: backendPort });
  } else {
    const feFiles = getDynamicFrontendFiles(frontend, targetFolder, backendPort);
    for (const file of feFiles) {
      const fullPath = path.join(frontendDir, file.filename);
      fse.ensureDirSync(path.dirname(fullPath));
      fse.writeFileSync(fullPath, file.content, 'utf8');
    }
  }

  if (plan.knownBackend && hasBackendAdapter(backend)) {
    const adapter = getBackendAdapter(backend);
    adapter(backendDir, targetFolder, { port: backendPort });
  } else {
    const beFiles = getDynamicBackendFiles(backend, targetFolder, backendPort);
    for (const file of beFiles) {
      const fullPath = path.join(backendDir, file.filename);
      fse.ensureDirSync(path.dirname(fullPath));
      fse.writeFileSync(fullPath, file.content, 'utf8');
    }
  }

  fse.writeFileSync(
    path.join(projectPath, '.gitignore'),
    `node_modules/\ndist/\n.env\n__pycache__/\n*.pyc\nvenv/\n.venv/\ntarget/\n*.log\n`,
    'utf8'
  );

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

  try {
    const parentRepo = getParentGitRepo(projectPath);
    if (parentRepo) {
      console.log(`\x1b[33m[rapidfire] Detected parent Git repository at '${parentRepo}'. Skipping nested git init.\x1b[0m`);
      try { installPrePushHook(parentRepo); } catch {}
    } else {
      const gitPrompt = `\nDo you want to initialize a local Git repository for '${targetFolder}'? (Y/N): `;
      const isInteractive = Boolean(context && (typeof context.ask === 'function' || context.rl));
      const defaultChoice = isInteractive ? 'n' : (process.env.RAPIDFIRE_AUTO_GIT === '0' ? 'n' : 'y');
      const shouldInit = await promptConfirmation(context, gitPrompt, defaultChoice);

      if (shouldInit) {
        if (!fse.existsSync(path.join(projectPath, '.git'))) {
          try {
            run('git init -b main', { cwd: projectPath, stdio: 'ignore' });
          } catch {
            run('git init', { cwd: projectPath, stdio: 'ignore' });
          }
          console.log('[rapidfire] Initialized local git repository.');
        }
        const hookResult = installPrePushHook(projectPath);
        if (hookResult.success) {
          console.log('\x1b[32m[rapidfire-security] Installed gitleaks pre-push hook in .git/hooks/pre-push\x1b[0m');
        }
      } else {
        console.log('[rapidfire] Skipped local git initialization.');
      }
    }
  } catch (err) {
    console.warn('[rapidfire] Git initialization notice:', err.message);
  }

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

  try {
    const parentRepo = getParentGitRepo(projectPath);
    if (parentRepo) {
      console.log(`\x1b[33m[rapidfire] Detected parent Git repository at '${parentRepo}'. Skipping nested git init.\x1b[0m`);
      try { installPrePushHook(parentRepo); } catch {}
    } else {
      const gitPrompt = `\nDo you want to initialize a local Git repository for '${targetFolder}'? (Y/N): `;
      const isInteractive = Boolean(context && (typeof context.ask === 'function' || context.rl));
      const defaultChoice = isInteractive ? 'n' : (process.env.RAPIDFIRE_AUTO_GIT === '0' ? 'n' : 'y');
      const shouldInit = await promptConfirmation(context, gitPrompt, defaultChoice);

      if (shouldInit) {
        if (!fse.existsSync(path.join(projectPath, '.git'))) {
          try {
            run('git init -b main', { cwd: projectPath, stdio: 'ignore' });
          } catch {
            run('git init', { cwd: projectPath, stdio: 'ignore' });
          }
          console.log('[rapidfire] Initialized local git repository.');
        }
        const hookResult = installPrePushHook(projectPath);
        if (hookResult.success) {
          console.log('\x1b[32m[rapidfire-security] Installed gitleaks pre-push hook in .git/hooks/pre-push\x1b[0m');
        }
      } else {
        console.log('[rapidfire] Skipped local git initialization.');
      }
    }
  } catch (err) {
    console.warn('[rapidfire] Git initialization notice:', err.message);
  }

  if (process.env.RAPIDFIRE_SKIP_INSTALL !== '1' && blueprint.ecosystem === 'node' && fse.existsSync(path.join(projectPath, 'package.json')) && commandExists('npm')) {
    const installPrompt = `\nDo you want to run 'npm install' now? (Y/N): `;
    const shouldInstall = await promptConfirmation(context, installPrompt, 'y');
    if (shouldInstall) {
      console.log('[rapidfire] Installing dependencies with npm...');
      try {
        run('npm install', { cwd: projectPath, stdio: 'inherit' });
      } catch (err) {
        console.warn('\x1b[33m[rapidfire] npm install notice:\x1b[0m', err.message);
      }
    }
  }

  if (fse.existsSync(path.join(projectPath, '.git')) && isGhInstalled() && context && (context.ask || context.rl || process.env.RAPIDFIRE_AUTO_GH)) {
    const ghPrompt = `\nDo you want to create a remote GitHub repository for '${targetFolder}'? (Y/N): `;
    const shouldGh = await promptConfirmation(context, ghPrompt, 'n');
    if (shouldGh) {
      if (!isGhAuthenticated()) {
        console.log(`\x1b[33m[rapidfire] GitHub CLI is not authenticated. Run "gh auth login" in your terminal first.\x1b[0m`);
      } else {
        console.log(`[rapidfire] Creating remote GitHub repository '${targetFolder}'...`);
        const res = createRepo(projectPath, targetFolder, false);
        if (res.success) {
          console.log(`\x1b[32m[OK] Remote GitHub repository '${targetFolder}' created and linked to origin!\x1b[0m`);
        }
      }
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
  getDynamicFrontendFiles,
  getDynamicBackendFiles,
  scaffoldDynamicFullstack,
  scaffoldDynamicFramework
};
