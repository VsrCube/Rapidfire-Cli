const path = require('path');
const fse = require('fs-extra');
const { readManifest } = require('./manifest');

const DEFAULT_IGNORES = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'venv',
  '.venv',
  'env',
  '.env',
  '__pycache__',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  '.idea',
  '.vscode',
  '.DS_Store'
]);

function isDirEmpty(dirPath) {
  if (!fse.existsSync(dirPath)) return true;
  const stat = fse.statSync(dirPath);
  if (!stat.isDirectory()) return false;
  const files = fse.readdirSync(dirPath);
  return files.length === 0;
}

function shouldIgnore(name) {
  return DEFAULT_IGNORES.has(name) || name.startsWith('.git');
}

function walkDirectory(dirPath, rootPath = dirPath) {
  const items = [];
  const entries = fse.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (shouldIgnore(entry.name)) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.relative(rootPath, fullPath);

    if (entry.isDirectory()) {
      items.push({
        type: 'dir',
        path: relPath
      });
      items.push(...walkDirectory(fullPath, rootPath));
    } else if (entry.isFile()) {
      let content;
      let encoding = 'utf8';
      try {
        content = fse.readFileSync(fullPath, 'utf8');
      } catch {
        content = fse.readFileSync(fullPath).toString('base64');
        encoding = 'base64';
      }

      items.push({
        type: 'file',
        path: relPath,
        encoding,
        content
      });
    }
  }

  return items;
}

function serializeDirectory(dirPath) {
  const files = walkDirectory(dirPath, dirPath);
  const manifest = readManifest(dirPath);

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    folderName: path.basename(dirPath),
    manifest: manifest || null,
    files
  };
}

function deserializeDirectory(presetData, targetDir) {
  fse.ensureDirSync(targetDir);

  for (const item of presetData.files) {
    const destPath = path.join(targetDir, item.path);

    if (item.type === 'dir') {
      fse.ensureDirSync(destPath);
    } else if (item.type === 'file') {
      const parentDir = path.dirname(destPath);
      fse.ensureDirSync(parentDir);

      if (item.encoding === 'base64') {
        fse.writeFileSync(destPath, Buffer.from(item.content, 'base64'));
      } else {
        fse.writeFileSync(destPath, item.content, 'utf8');
      }
    }
  }

  if (presetData.manifest && !fse.existsSync(path.join(targetDir, '.rapidfire.json'))) {
    fse.writeJsonSync(path.join(targetDir, '.rapidfire.json'), presetData.manifest, { spaces: 2 });
  }
}

module.exports = {
  DEFAULT_IGNORES,
  isDirEmpty,
  shouldIgnore,
  walkDirectory,
  serializeDirectory,
  deserializeDirectory
};
