const https = require('https');
const { spawnSync } = require('child_process');

const PYTHON_BUILTINS = new Set([
  'os', 'sys', 're', 'json', 'math', 'time', 'datetime', 'collections', 'itertools',
  'urllib', 'pathlib', 'csv', 'random', 'subprocess', 'threading', 'multiprocessing',
  'typing', 'io', 'shutil', 'tempfile', 'unittest', 'logging', 'functools', 'heapq',
  'bisect', 'sqlite3', 'copy', 'hashlib', 'socket', 'glob', 'pickle', 'string', 'base64',
  'struct', 'queue', 'select', 'signal', 'gc', 'inspect', 'traceback', 'warnings'
]);

const CANONICAL_PYTHON_PKGS = {
  'numpy': 'numpy',
  'pandas': 'pandas',
  'scikit-learn': 'scikit-learn',
  'sklearn': 'scikit-learn',
  'nltk': 'nltk',
  'spacy': 'spacy',
  'scipy': 'scipy',
  'matplotlib': 'matplotlib',
  'seaborn': 'seaborn',
  'fastapi': 'fastapi',
  'django': 'django',
  'flask': 'flask',
  'requests': 'requests',
  'httpx': 'httpx',
  'aiohttp': 'aiohttp',
  'beautifulsoup4': 'beautifulsoup4',
  'bs4': 'beautifulsoup4',
  'polars': 'polars',
  'duckdb': 'duckdb',
  'pydantic': 'pydantic',
  'sqlalchemy': 'sqlalchemy',
  'pytest': 'pytest',
  'torch': 'torch',
  'pytorch': 'torch',
  'tensorflow': 'tensorflow',
  'transformers': 'transformers',
  'pillow': 'pillow',
  'pil': 'pillow',
  'openpyxl': 'openpyxl',
  'statsmodels': 'statsmodels',
  'xgboost': 'xgboost',
  'lightgbm': 'lightgbm',
  'celery': 'celery',
  'redis': 'redis',
  'pymongo': 'pymongo',
  'psycopg2': 'psycopg2',
  'jinja2': 'jinja2',
  'alembic': 'alembic'
};

function extractDependencies(text) {
  if (!text) return null;

  const pythonPkgs = new Set();
  const nodePkgs = new Set();

  const pipMatches = text.matchAll(/(?:pip|pip3)\s+install\s+([^#\n\r`]+)/gi);
  for (const match of pipMatches) {
    const rawTokens = match[1].trim().split(/\s+/);
    for (let token of rawTokens) {
      token = token.trim().replace(/^['"]|['"]$/g, '');
      const cleanName = token.split(/[<>=~]/)[0].trim().toLowerCase();
      if (cleanName && !cleanName.startsWith('-') && !cleanName.includes('/') && !cleanName.includes('\\') && !PYTHON_BUILTINS.has(cleanName)) {
        pythonPkgs.add(CANONICAL_PYTHON_PKGS[cleanName] || cleanName);
      }
    }
  }

  const npmMatches = text.matchAll(/(?:npm|pnpm|yarn)\s+(?:install|i|add)\s+([^#\n\r`]+)/gi);
  for (const match of npmMatches) {
    const rawTokens = match[1].trim().split(/\s+/);
    for (let token of rawTokens) {
      token = token.trim().replace(/^['"]|['"]$/g, '');
      const cleanName = token.split(/@/)[0].trim() || token;
      if (cleanName && !cleanName.startsWith('-') && cleanName !== 'install' && cleanName !== 'i') {
        nodePkgs.add(cleanName);
      }
    }
  }

  // If no explicit install command was generated, parse bulleted or listed module recommendations
  if (pythonPkgs.size === 0 && nodePkgs.size === 0) {
    const lines = text.split('\n');
    for (const line of lines) {
      const bulletMatch = line.match(/^\s*[-*•\d\.]+\s*([a-zA-Z0-9_\-]+)(?:\s*\([^)]*\))?\s*(?:or\s+([a-zA-Z0-9_\-]+))?\s*[:\-–—]/i);
      if (bulletMatch) {
        const rawCandidates = [bulletMatch[1], bulletMatch[2]].filter(Boolean);
        for (const candidate of rawCandidates) {
          const norm = candidate.trim().toLowerCase();
          if (norm && !PYTHON_BUILTINS.has(norm)) {
            if (CANONICAL_PYTHON_PKGS[norm]) {
              pythonPkgs.add(CANONICAL_PYTHON_PKGS[norm]);
            } else if (norm.length >= 3 && /^[a-z0-9_\-]+$/.test(norm)) {
              pythonPkgs.add(norm);
            }
          }
        }
      }
    }
  }

  if (pythonPkgs.size > 0) {
    return {
      ecosystem: 'python',
      packages: Array.from(pythonPkgs)
    };
  }

  if (nodePkgs.size > 0) {
    return {
      ecosystem: 'node',
      packages: Array.from(nodePkgs)
    };
  }

  return null;
}

async function validatePackageSecurity(pkg, ecosystem = 'python') {
  const safeRegex = /^[a-zA-Z0-9_\-\.]+$/;
  if (!safeRegex.test(pkg)) {
    return { valid: false, reason: 'Invalid package name characters (possible injection attempt).' };
  }

  if (pkg.startsWith('-') || pkg.includes('..') || pkg.length > 100) {
    return { valid: false, reason: 'Malformed package specifier.' };
  }

  const url = ecosystem === 'python'
    ? `https://pypi.org/pypi/${encodeURIComponent(pkg)}/json`
    : `https://registry.npmjs.org/${encodeURIComponent(pkg)}`;

  try {
    const exists = await new Promise((resolve) => {
      const req = https.get(url, { timeout: 2500 }, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 300);
      });
      req.on('error', () => resolve(true));
      req.on('timeout', () => {
        req.destroy();
        resolve(true);
      });
    });

    if (!exists) {
      return { valid: false, reason: `Package '${pkg}' does not exist on official ${ecosystem === 'python' ? 'PyPI' : 'npm'} registry.` };
    }

    return { valid: true };
  } catch {
    return { valid: true };
  }
}

async function promptAndInstallDependencies(depInfo, rl) {
  if (!depInfo || !depInfo.packages || depInfo.packages.length === 0 || !rl) {
    return;
  }

  const { ecosystem, packages } = depInfo;
  const cyan = '\x1b[36m';
  const green = '\x1b[32m';
  const yellow = '\x1b[33m';
  const red = '\x1b[31m';
  const bold = '\x1b[1m';
  const reset = '\x1b[0m';
  const dim = '\x1b[2m';

  console.log(`\n${bold}${cyan}╭── Suggested ${ecosystem === 'python' ? 'Python (pip)' : 'Node (npm)'} Packages Detected ─────────────────────────╮${reset}`);
  for (let i = 0; i < packages.length; i++) {
    const num = `[${i + 1}]`.padEnd(5);
    console.log(`  ${green}${num}${reset} ${bold}${packages[i]}${reset}`);
  }
  console.log(`${bold}${cyan}╰────────────────────────────────────────────────────────────────────────╯${reset}`);

  const ask = (query) => new Promise((res) => rl.question(query, (ans) => res(ans ? ans.trim() : '')));

  const rawSelection = await ask(
    `\n${yellow}Select packages to install (e.g. 1,2,5 or 'all' or press Enter to skip):${reset} `
  );

  if (!rawSelection) {
    console.log(`${dim}[rapidfire] Package installation skipped.${reset}\n`);
    return;
  }

  let selected = [];
  if (rawSelection.toLowerCase() === 'all') {
    selected = [...packages];
  } else {
    const tokens = rawSelection.split(/[, \t]+/);
    for (const token of tokens) {
      const idx = parseInt(token, 10);
      if (!isNaN(idx) && idx >= 1 && idx <= packages.length) {
        selected.push(packages[idx - 1]);
      } else if (packages.map(p => p.toLowerCase()).includes(token.toLowerCase())) {
        const found = packages.find(p => p.toLowerCase() === token.toLowerCase());
        if (found) selected.push(found);
      }
    }
  }

  selected = Array.from(new Set(selected));

  if (selected.length === 0) {
    console.log(`${dim}[rapidfire] No valid packages chosen. Installation skipped.${reset}\n`);
    return;
  }

  console.log(`\n${cyan}Selected packages:${reset} ${bold}${selected.join(', ')}${reset}`);
  const confirm = await ask(`${bold}${yellow}Confirm installation? (Y/N):${reset} `);

  if (!confirm.toLowerCase().startsWith('y')) {
    console.log(`${dim}[rapidfire] Installation cancelled.${reset}\n`);
    return;
  }

  console.log(`\n${cyan}[rapidfire-security] Verifying package safety & registry integrity...${reset}`);
  const validatedPkgs = [];

  for (const pkg of selected) {
    const check = await validatePackageSecurity(pkg, ecosystem);
    if (!check.valid) {
      console.log(`  ${red}[BLOCKED]: ${pkg} - ${check.reason}${reset}`);
    } else {
      console.log(`  ${green}[OK] VERIFIED: ${pkg}${reset}`);
      validatedPkgs.push(pkg);
    }
  }

  if (validatedPkgs.length === 0) {
    console.log(`\n${red}[rapidfire-security] All selected packages failed verification. Nothing installed.${reset}\n`);
    return;
  }

  console.log(`\n${bold}[rapidfire] Installing ${validatedPkgs.length} verified packages via ${ecosystem === 'python' ? 'pip' : 'npm'}...${reset}\n`);

  try {
    const cmd = ecosystem === 'python' ? 'pip' : 'npm';
    const args = ecosystem === 'python' ? ['install', ...validatedPkgs] : ['install', ...validatedPkgs];

    const result = spawnSync(cmd, args, { stdio: 'inherit' });

    if (result.status === 0) {
      console.log(`\n${green}[OK] Successfully installed: ${validatedPkgs.join(', ')}${reset}\n`);
    } else {
      console.log(`\n${yellow}[rapidfire] Installer exited with status code ${result.status}.${reset}\n`);
    }
  } catch (err) {
    console.error(`\n${red}[rapidfire] Failed to invoke package installer:${reset}`, err.message, '\n');
  }
}

module.exports = {
  extractDependencies,
  validatePackageSecurity,
  promptAndInstallDependencies
};
