const path = require('path');
const fs = require('fs');

function findDualTierPair(targetDir) {
  const candidatePairs = [
    { frontend: 'frontend', backend: 'backend' },
    { frontend: 'client', backend: 'server' },
    { frontend: 'ui', backend: 'api' },
    { frontend: 'web', backend: 'api' }
  ];

  for (const pair of candidatePairs) {
    const fePath = path.join(targetDir, pair.frontend);
    const bePath = path.join(targetDir, pair.backend);
    if (fs.existsSync(fePath) && fs.statSync(fePath).isDirectory() &&
        fs.existsSync(bePath) && fs.statSync(bePath).isDirectory()) {
      return {
        frontendDir: fePath,
        backendDir: bePath,
        frontendName: pair.frontend,
        backendName: pair.backend
      };
    }
  }

  return null;
}

function extractNodeConfiguredPort(dir, scripts = {}) {
  const envFiles = ['.env', '.env.local', '.env.development'];
  for (const envFile of envFiles) {
    const envPath = path.join(dir, envFile);
    if (fs.existsSync(envPath)) {
      try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const envMatch = envContent.match(/^PORT\s*=\s*(\d+)/m);
        if (envMatch && envMatch[1]) {
          const parsed = parseInt(envMatch[1], 10);
          if (parsed > 0 && parsed < 65536) return parsed;
        }
      } catch {}
    }
  }

  const configFiles = [
    'vite.config.js',
    'vite.config.ts',
    'vite.config.mjs',
    'vite.config.cjs',
    'astro.config.mjs',
    'astro.config.ts',
    'astro.config.js',
    'nuxt.config.ts',
    'nuxt.config.js',
    'svelte.config.js'
  ];

  for (const cfg of configFiles) {
    const fullPath = path.join(dir, cfg);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const match = content.match(/port\s*:\s*(\d+)/i);
        if (match && match[1]) {
          const parsed = parseInt(match[1], 10);
          if (parsed > 0 && parsed < 65536) return parsed;
        }
      } catch {}
    }
  }

  for (const scriptKey of Object.keys(scripts)) {
    const cmd = String(scripts[scriptKey] || '');
    const portMatch = cmd.match(/(?:-p|--port)\s+['"]?(\d+)['"]?/i) || cmd.match(/PORT=(\d+)/i);
    if (portMatch && portMatch[1]) {
      const parsed = parseInt(portMatch[1], 10);
      if (parsed > 0 && parsed < 65536) return parsed;
    }
  }

  return null;
}

function detectNodeService(dir) {
  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;

  let pkg = {};
  let jsonSyntaxError = null;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch (err) {
    pkg = {};
    jsonSyntaxError = err.message;
  }

  if (jsonSyntaxError) {
    return {
      ecosystem: 'node',
      dir,
      pkg: {},
      scriptName: null,
      commandArgs: [],
      entryFile: null,
      defaultPort: 3000,
      jsonSyntaxError,
      hasNodeModules: fs.existsSync(path.join(dir, 'node_modules'))
    };
  }

  const scripts = pkg.scripts || {};
  let scriptName = null;
  let commandArgs = [];

  if (scripts.dev) {
    scriptName = 'dev';
    commandArgs = ['run', 'dev'];
  } else if (scripts.start) {
    scriptName = 'start';
    commandArgs = ['start'];
  } else if (scripts.serve) {
    scriptName = 'serve';
    commandArgs = ['run', 'serve'];
  }

  let defaultPort = 3000;
  let isBackend = false;
  const deps = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
  const configuredPort = extractNodeConfiguredPort(dir, scripts);

  if (configuredPort) {
    defaultPort = configuredPort;
    if (deps.express || deps.koa || deps.hono || deps.fastify || deps['@nestjs/core']) {
      isBackend = true;
    }
  } else if (deps.vite) {
    defaultPort = 3000;
  } else if (deps.next) {
    defaultPort = 3000;
  } else if (deps.nuxt || deps.nuxt3) {
    defaultPort = 3000;
  } else if (deps['@angular/core'] || deps['@angular/cli']) {
    defaultPort = 4200;
  } else if (deps['@sveltejs/kit']) {
    defaultPort = 3000;
  } else if (deps['@builder.io/qwik'] || deps['@builder.io/qwik-city']) {
    defaultPort = 3000;
  } else if (deps.astro) {
    defaultPort = 4321;
  } else if (deps.solid || deps['solid-js']) {
    defaultPort = 3000;
  } else if (deps.express || deps.koa || deps.hono || deps.fastify || deps['@nestjs/core']) {
    defaultPort = 5000;
    isBackend = true;
  }

  let entryFile = null;
  if (!scriptName) {
    const candidates = ['server.js', 'index.js', 'app.js', 'main.js'];
    for (const c of candidates) {
      if (fs.existsSync(path.join(dir, c))) {
        entryFile = c;
        break;
      }
    }
  }

  if (!scriptName && !entryFile) {
    return null;
  }

  return {
    ecosystem: 'node',
    dir,
    pkg,
    scriptName,
    commandArgs,
    entryFile,
    defaultPort,
    isBackend,
    hasNodeModules: fs.existsSync(path.join(dir, 'node_modules'))
  };
}

function detectPythonService(dir) {
  const hasManagePy = fs.existsSync(path.join(dir, 'manage.py'));
  const hasMainPy = fs.existsSync(path.join(dir, 'main.py'));
  const hasAppPy = fs.existsSync(path.join(dir, 'app.py'));
  const hasRequirements = fs.existsSync(path.join(dir, 'requirements.txt'));
  const hasPyproject = fs.existsSync(path.join(dir, 'pyproject.toml'));

  if (!hasManagePy && !hasMainPy && !hasAppPy && !hasRequirements && !hasPyproject) {
    return null;
  }

  let flavor = 'python';
  let defaultPort = 8000;
  let runCommand = [];

  if (hasManagePy) {
    flavor = 'django';
    defaultPort = 8000;
    runCommand = ['manage.py', 'runserver', '8000'];
  } else if (hasMainPy) {
    let mainContent = '';
    try {
      mainContent = fs.readFileSync(path.join(dir, 'main.py'), 'utf8');
    } catch {}

    if (mainContent.includes('FastAPI') || mainContent.includes('uvicorn') || mainContent.includes('app = FastAPI')) {
      flavor = 'fastapi';
      defaultPort = 8000;
      runCommand = ['-m', 'uvicorn', 'main:app', '--reload', '--port', '8000'];
    } else {
      flavor = 'python-script';
      defaultPort = 8000;
      runCommand = ['main.py'];
    }
  } else if (hasAppPy) {
    flavor = 'flask';
    defaultPort = 5000;
    runCommand = ['app.py'];
  }

  const hasVenv = fs.existsSync(path.join(dir, 'venv')) ||
                  fs.existsSync(path.join(dir, '.venv')) ||
                  fs.existsSync(path.join(dir, '..', 'venv')) ||
                  fs.existsSync(path.join(dir, '..', '.venv'));

  return {
    ecosystem: 'python',
    dir,
    flavor,
    defaultPort,
    runCommand,
    hasVenv,
    hasRequirements: hasRequirements || hasPyproject
  };
}

function detectRustService(dir) {
  if (fs.existsSync(path.join(dir, 'Cargo.toml'))) {
    let port = 5000;
    const mainRs = path.join(dir, 'src', 'main.rs');
    if (fs.existsSync(mainRs)) {
      try {
        const code = fs.readFileSync(mainRs, 'utf8');
        const match = code.match(/(?:0\.0\.0\.0|127\.0\.0\.1|localhost):(\d+)/i);
        if (match && match[1]) {
          const parsed = parseInt(match[1], 10);
          if (parsed > 0 && parsed < 65536) port = parsed;
        }
      } catch {}
    }
    return {
      ecosystem: 'rust',
      dir,
      defaultPort: port,
      runCommand: ['run']
    };
  }
  return null;
}

function detectGoService(dir) {
  if (fs.existsSync(path.join(dir, 'go.mod')) || fs.existsSync(path.join(dir, 'main.go'))) {
    return {
      ecosystem: 'go',
      dir,
      defaultPort: 5000,
      runCommand: ['run', '.']
    };
  }
  return null;
}

function detectRubyService(dir) {
  if (fs.existsSync(path.join(dir, 'Gemfile')) || fs.existsSync(path.join(dir, 'app.rb'))) {
    return {
      ecosystem: 'ruby',
      dir,
      defaultPort: 5000,
      runCommand: ['app.rb']
    };
  }
  return null;
}

function detectPhpService(dir) {
  if (fs.existsSync(path.join(dir, 'router.php')) || fs.existsSync(path.join(dir, 'index.php'))) {
    const entry = fs.existsSync(path.join(dir, 'router.php')) ? 'router.php' : 'index.php';
    return {
      ecosystem: 'php',
      dir,
      defaultPort: 5000,
      runCommand: ['-S', '0.0.0.0:5000', entry]
    };
  }
  return null;
}

function detectDotnetService(dir) {
  let files = [];
  try {
    files = fs.readdirSync(dir).filter(f => f.endsWith('.csproj'));
  } catch {}
  if (files.length > 0 || fs.existsSync(path.join(dir, 'Program.cs'))) {
    return {
      ecosystem: 'dotnet',
      dir,
      defaultPort: 5000,
      runCommand: ['run']
    };
  }
  return null;
}

function detectStaticService(dir) {
  const hasRootHtml = fs.existsSync(path.join(dir, 'index.html'));
  const hasPublicHtml = fs.existsSync(path.join(dir, 'public', 'index.html'));

  if (hasRootHtml || hasPublicHtml) {
    return {
      ecosystem: 'static',
      dir,
      defaultPort: 3000,
      htmlPath: hasRootHtml ? path.join(dir, 'index.html') : path.join(dir, 'public', 'index.html')
    };
  }
  return null;
}

function detectSingleDirectoryService(dir) {
  const nodeSvc = detectNodeService(dir);
  if (nodeSvc) return nodeSvc;

  const pySvc = detectPythonService(dir);
  if (pySvc) return pySvc;

  const rustSvc = detectRustService(dir);
  if (rustSvc) return rustSvc;

  const goSvc = detectGoService(dir);
  if (goSvc) return goSvc;

  const dotnetSvc = detectDotnetService(dir);
  if (dotnetSvc) return dotnetSvc;

  const rubySvc = detectRubyService(dir);
  if (rubySvc) return rubySvc;

  const phpSvc = detectPhpService(dir);
  if (phpSvc) return phpSvc;

  const staticSvc = detectStaticService(dir);
  if (staticSvc) return staticSvc;

  return null;
}

function detectProject(targetDir) {
  const dual = findDualTierPair(targetDir);
  if (dual) {
    const feService = detectSingleDirectoryService(dual.frontendDir) || detectStaticService(dual.frontendDir);
    const beService = detectSingleDirectoryService(dual.backendDir);

    if (feService || beService) {
      return {
        type: 'fullstack',
        targetDir,
        frontend: feService ? Object.assign(feService, { tierName: dual.frontendName }) : null,
        backend: beService ? Object.assign(beService, { tierName: dual.backendName }) : null
      };
    }
  }

  const singleSvc = detectSingleDirectoryService(targetDir);
  if (singleSvc) {
    return {
      type: 'single',
      targetDir,
      service: singleSvc
    };
  }

  let entries = [];
  try {
    entries = fs.readdirSync(targetDir).filter(f => !f.startsWith('.'));
  } catch {}

  return {
    type: 'unstructured',
    targetDir,
    files: entries
  };
}

module.exports = {
  detectProject,
  detectSingleDirectoryService,
  findDualTierPair
};
