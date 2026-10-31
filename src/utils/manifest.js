const path = require('path');
const fse = require('fs-extra');

const MANIFEST_FILENAME = '.rapidfire.json';
let CURRENT_VERSION = '0.1.23';
try {
  CURRENT_VERSION = require('../../package.json').version;
} catch {}

function writeManifest(projectDir, props = {}) {
  const manifestPath = path.join(projectDir, MANIFEST_FILENAME);
  const data = {
    frontend: props.frontend || null,
    backend: props.backend || null,
    folderName: props.folderName || path.basename(projectDir),
    generationMode: props.generationMode || 'predefined',
    createdAt: new Date().toISOString(),
    rapidfireVersion: CURRENT_VERSION,
    ...props
  };

  fse.writeJsonSync(manifestPath, data, { spaces: 2 });
  return data;
}

function readManifest(projectDir) {
  const manifestPath = path.join(projectDir, MANIFEST_FILENAME);
  if (!fse.existsSync(manifestPath)) {
    return null;
  }

  try {
    return fse.readJsonSync(manifestPath);
  } catch {
    return null;
  }
}

function hasManifest(projectDir) {
  return fse.existsSync(path.join(projectDir, MANIFEST_FILENAME));
}

module.exports = {
  MANIFEST_FILENAME,
  CURRENT_VERSION,
  writeManifest,
  readManifest,
  hasManifest
};
