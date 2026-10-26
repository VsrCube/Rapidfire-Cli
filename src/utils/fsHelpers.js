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

function isBinaryBuffer(buffer) {
  if (!buffer || buffer.length === 0) return false;
  const len = Math.min(buffer.length, 8000);
  for (let i = 0; i < len; i++) {
    if (buffer[i] === 0) {
      return true;
    }
  }
  return false;
}

function shouldIgnore(name) {
  return DEFAULT_IGNORES.has(name) || name === '.git';
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
      const rawBuffer = fse.readFileSync(fullPath);
      let content;
      let encoding;
      if (isBinaryBuffer(rawBuffer)) {
        encoding = 'base64';
        content = rawBuffer.toString('base64');
      } else {
        encoding = 'utf8';
        content = rawBuffer.toString('utf8');
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

function isBinaryInPath(bin) {
  if (!bin) return false;
  if (path.isAbsolute(bin)) return fse.existsSync(bin);
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const extraDirs = [];
  if (home) {
    extraDirs.push(path.join(home, '.cargo', 'bin'));
    extraDirs.push(path.join(home, '.local', 'bin'));
    extraDirs.push(path.join(home, 'go', 'bin'));
  }
  extraDirs.push('/usr/local/bin');
  const pathEnv = process.env.PATH || '';
  const allDirs = [...extraDirs, ...pathEnv.split(path.delimiter)];
  const exts = process.platform === 'win32' ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';') : [''];
  for (const dir of allDirs) {
    if (!dir) continue;
    for (const ext of exts) {
      const full = path.join(dir, process.platform === 'win32' && !bin.toLowerCase().endsWith(ext.toLowerCase()) ? `${bin}${ext}` : bin);
      try {
        if (fse.existsSync(full)) {
          return true;
        }
      } catch {}
    }
  }
  return false;
}

module.exports = {
  DEFAULT_IGNORES,
  isDirEmpty,
  isBinaryBuffer,
  shouldIgnore,
  walkDirectory,
  serializeDirectory,
  deserializeDirectory,
  isBinaryInPath
};
