const path = require('path');
const fse = require('fs-extra');
const { getActiveAiConfig } = require('../ai/gemini');
const { installPrePushHook } = require('../integrations/gitleaks');
const { isGhInstalled, isGhAuthenticated, createRepo } = require('../integrations/gh');
const { run, commandExists } = require('../utils/proc');
const { getParentGitRepo } = require('../utils/gitContext');

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

async function scaffoldDynamicFramework(projectPath, targetFolder, plan, context = {}) {
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
    rapidfireVersion: require('../../package.json').version || '0.1.23'
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

  if (blueprint.ecosystem === 'node' && fse.existsSync(path.join(projectPath, 'package.json')) && commandExists('npm')) {
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
  scaffoldDynamicFramework
};
