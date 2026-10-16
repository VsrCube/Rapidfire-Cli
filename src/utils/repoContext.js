const fs = require('fs');
const path = require('path');

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.venv',
  'venv',
  'dist',
  'build',
  '.cache',
  'coverage',
  '__pycache__',
  '.rapidfire',
  '.idea',
  '.vscode'
]);

const ASSET_DIRS = new Set([
  'documents',
  'docs',
  'pdf',
  'presentation',
  'assets',
  'images',
  'Text'
]);

function scanRepoStructure(dir, maxDepth = 2, currentDepth = 0) {
  if (currentDepth > maxDepth) return [];
  const entries = [];

  try {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    list.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const item of list) {
      if (IGNORED_DIRS.has(item.name)) continue;
      if (item.name.startsWith('.') && item.name !== '.gitignore' && item.name !== '.env') continue;

      const isDir = item.isDirectory();
      entries.push({
        name: item.name,
        isDir,
        depth: currentDepth,
        relativePath: path.relative(dir, path.join(dir, item.name))
      });

      if (isDir && currentDepth < maxDepth) {
        if (ASSET_DIRS.has(item.name) && currentDepth > 0) continue;
        const subPath = path.join(dir, item.name);
        const children = scanRepoStructure(subPath, maxDepth, currentDepth + 1);
        entries.push(...children);
      }
    }
  } catch {}

  return entries;
}

function formatTreeString(entries, maxItems = 120) {
  let treeStr = '';
  const slice = entries.slice(0, maxItems);
  for (const item of slice) {
    const indent = '  '.repeat(item.depth);
    const prefix = item.isDir ? '[DIR]  ' : '       ';
    treeStr += `${indent}${prefix}${item.name}\n`;
  }
  if (entries.length > maxItems) {
    treeStr += `  ... and ${entries.length - maxItems} more files\n`;
  }
  return treeStr;
}

function readRepoManifests(repoRoot) {
  const manifests = {};

  const pkgPath = path.join(repoRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      manifests.packageJson = {
        name: pkg.name || '',
        version: pkg.version || '',
        scripts: Object.keys(pkg.scripts || {}),
        dependencies: Object.keys(pkg.dependencies || {}),
        devDependencies: Object.keys(pkg.devDependencies || {})
      };
    } catch {}
  }

  const reqPath = path.join(repoRoot, 'requirements.txt');
  if (fs.existsSync(reqPath)) {
    try {
      const content = fs.readFileSync(reqPath, 'utf8');
      manifests.pythonRequirements = content
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'))
        .slice(0, 20);
    } catch {}
  }

  const rfJsonPath = path.join(repoRoot, '.rapidfire.json');
  if (fs.existsSync(rfJsonPath)) {
    try {
      manifests.rapidfireManifest = JSON.parse(fs.readFileSync(rfJsonPath, 'utf8'));
    } catch {}
  }

  return manifests;
}

function extractRelevantSnippets(repoRoot, query, maxFiles = 3) {
  const q = (query || '').toLowerCase();
  const snippets = [];
  const filesFound = new Set();

  function searchDir(dir, depth = 0) {
    if (depth > 3 || snippets.length >= maxFiles) return;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (snippets.length >= maxFiles) break;
        if (IGNORED_DIRS.has(entry.name)) continue;

        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(repoRoot, fullPath);

        if (entry.isDirectory()) {
          searchDir(fullPath, depth + 1);
        } else if (entry.isFile()) {
          const lowerName = entry.name.toLowerCase();
          const baseNoExt = path.basename(lowerName, path.extname(lowerName));

          const isMentioned = q.includes(lowerName) || (baseNoExt.length > 2 && q.includes(baseNoExt));
          if (isMentioned && !filesFound.has(relPath)) {
            filesFound.add(relPath);
            try {
              const content = fs.readFileSync(fullPath, 'utf8');
              const lines = content.split(/\r?\n/).slice(0, 100);
              snippets.push({
                file: relPath,
                lines: lines.length,
                content: lines.join('\n')
              });
            } catch {}
          }
        }
      }
    } catch {}
  }

  searchDir(repoRoot);
  return snippets;
}

function findMentionedDirectories(repoRoot, query) {
  const q = (query || '').toLowerCase();
  const words = q.split(/[^a-zA-Z0-9_-]+/).filter(Boolean);
  const mentioned = [];

  function checkDir(dir, depth = 0) {
    if (depth > 2) return;
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        if (!item.isDirectory() || IGNORED_DIRS.has(item.name)) continue;
        const lowerName = item.name.toLowerCase();
        const isMatched = words.includes(lowerName) ||
                          q.includes(`/${lowerName}`) ||
                          q.includes(`${lowerName}/`) ||
                          q.includes(`in ${lowerName}`) ||
                          q.includes(`of ${lowerName}`);

        if (isMatched) {
          const fullPath = path.join(dir, item.name);
          const relPath = path.relative(repoRoot, fullPath);
          try {
            const children = fs.readdirSync(fullPath, { withFileTypes: true });
            const files = children.filter(c => c.isFile()).map(c => c.name);
            const subdirs = children.filter(c => c.isDirectory()).map(c => c.name);
            mentioned.push({
              dir: relPath,
              fileCount: files.length,
              files,
              subdirs
            });
          } catch {}
        }
        checkDir(path.join(dir, item.name), depth + 1);
      }
    } catch {}
  }

  checkDir(repoRoot);
  return mentioned;
}

function buildRepoContext(repoRoot, query = '') {
  const repoName = path.basename(repoRoot);
  const entries = scanRepoStructure(repoRoot, 2);
  const treeStr = formatTreeString(entries);
  const manifests = readRepoManifests(repoRoot);
  const snippets = extractRelevantSnippets(repoRoot, query);
  const mentionedDirs = findMentionedDirectories(repoRoot, query);

  let summary = `Repository: ${repoName} (${repoRoot})\n`;
  if (manifests.packageJson) {
    summary += `Node Project: ${manifests.packageJson.name} (v${manifests.packageJson.version})\n`;
    if (manifests.packageJson.scripts.length > 0) {
      summary += `Scripts: ${manifests.packageJson.scripts.join(', ')}\n`;
    }
    if (manifests.packageJson.dependencies.length > 0) {
      summary += `Dependencies: ${manifests.packageJson.dependencies.join(', ')}\n`;
    }
  }
  if (manifests.pythonRequirements) {
    summary += `Python Packages: ${manifests.pythonRequirements.join(', ')}\n`;
  }
  if (manifests.rapidfireManifest) {
    summary += `RapidFire Recipe: ${manifests.rapidfireManifest.recipe || 'custom'}\n`;
  }

  summary += `\nDirectory Layout:\n${treeStr}\n`;

  if (mentionedDirs.length > 0) {
    summary += `Requested Directory Details:\n`;
    for (const d of mentionedDirs) {
      summary += `--- DIRECTORY: ${d.dir} (${d.fileCount} files) ---\n`;
      if (d.files.length > 0) {
        summary += `Files: ${d.files.join(', ')}\n`;
      }
      if (d.subdirs.length > 0) {
        summary += `Subdirectories: ${d.subdirs.join(', ')}\n`;
      }
      summary += `--- END DIRECTORY ---\n\n`;
    }
  }

  if (snippets.length > 0) {
    summary += `Relevant Referenced Files:\n`;
    for (const snip of snippets) {
      summary += `--- FILE: ${snip.file} (${snip.lines} lines preview) ---\n${snip.content}\n--- END FILE ---\n\n`;
    }
  }

  return {
    repoName,
    repoRoot,
    summary,
    snippets,
    manifests,
    treeStr,
    mentionedDirs
  };
}

module.exports = {
  scanRepoStructure,
  formatTreeString,
  readRepoManifests,
  extractRelevantSnippets,
  findMentionedDirectories,
  buildRepoContext
};
