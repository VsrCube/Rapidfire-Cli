const path = require('path');
const fse = require('fs-extra');
const { getPresetPath, listPresets, getPresetsDir } = require('../utils/configPath');
const { serializeDirectory, deserializeDirectory, isDirEmpty } = require('../utils/fsHelpers');
const { readManifest } = require('../utils/manifest');

function handleSavePreset(args) {
  const name = args[0];
  const folderArg = args[1];

  if (!name) {
    console.log('\x1b[33m[rapidfire] Usage: save preset <name> [folder]\x1b[0m');
    console.log('Example: save preset my-template myapp');
    return;
  }

  let targetPath = process.cwd();

  if (folderArg) {
    const resolved = path.resolve(process.cwd(), folderArg);
    if (fse.existsSync(resolved)) {
      targetPath = resolved;
    } else if (
      path.basename(process.cwd()) === folderArg ||
      (fse.existsSync(path.join(process.cwd(), '.rapidfire.json')) &&
        readManifest(process.cwd())?.folderName === folderArg)
    ) {
      targetPath = process.cwd();
    } else {
      console.error(`\x1b[31m[rapidfire] Error: Target directory '${folderArg}' does not exist.\x1b[0m`);
      return;
    }
  }

  const presetPath = getPresetPath(name);
  console.log(`[rapidfire] Scanning directory (${targetPath})...`);

  const manifest = readManifest(targetPath);
  if (manifest) {
    console.log(`[rapidfire] Detected stack from manifest: frontend=${manifest.frontend || 'none'}, backend=${manifest.backend || 'none'}`);
  }

  const presetData = serializeDirectory(targetPath);
  fse.writeJsonSync(presetPath, presetData, { spaces: 2 });

  console.log(`\x1b[32m[rapidfire] Preset '${name}' saved successfully!\x1b[0m`);
  console.log(`  Location: ${presetPath}`);
  console.log(`  Items included: ${presetData.files.length}`);
  if (presetData.manifest) {
    console.log(`  Stack metadata preserved from .rapidfire.json.`);
  }
}

function handleLoadPreset(args) {
  const name = args[0];
  const targetFolder = args[1];

  if (!name || !targetFolder) {
    console.log('\x1b[33m[rapidfire] Usage: load preset <name> <folder>\x1b[0m');
    console.log('Example: load preset my-template restored-app');
    const available = listPresets();
    if (available.length > 0) {
      console.log('Available presets: ' + available.join(', '));
    }
    return;
  }

  const presetPath = getPresetPath(name);
  if (!fse.existsSync(presetPath)) {
    console.error(`\x1b[31m[rapidfire] Error: Preset '${name}' not found at ${presetPath}\x1b[0m`);
    const available = listPresets();
    if (available.length > 0) {
      console.log('Available presets: ' + available.join(', '));
    }
    return;
  }

  const targetDir = path.resolve(process.cwd(), targetFolder);

  if (fse.existsSync(targetDir) && !isDirEmpty(targetDir)) {
    console.error(`\x1b[31m[rapidfire] Error: Target directory '${targetFolder}' already exists and is not empty.\x1b[0m`);
    return;
  }

  console.log(`[rapidfire] Loading preset '${name}' into ${targetFolder}...`);
  try {
    const presetData = fse.readJsonSync(presetPath);
    deserializeDirectory(presetData, targetDir);

    console.log(`\x1b[32m[rapidfire] Successfully restored preset '${name}' (${presetData.files.length} items) into ${targetFolder}!\x1b[0m`);
    if (presetData.manifest) {
      console.log(`  Restored stack: frontend=${presetData.manifest.frontend || 'none'}, backend=${presetData.manifest.backend || 'none'}`);
    }
  } catch (err) {
    console.error(`\x1b[31m[rapidfire] Failed to load preset '${name}':\x1b[0m`, err.message);
  }
}

function handleListPresets() {
  const presets = listPresets();
  if (presets.length === 0) {
    console.log('[rapidfire] No presets saved yet.');
    console.log('Use `save preset <name> [folder]` to save your first preset.');
    return;
  }

  console.log('\n\x1b[1mSaved Presets:\x1b[0m');
  for (const presetName of presets) {
    const presetPath = getPresetPath(presetName);
    let stackInfo = '';
    try {
      const data = fse.readJsonSync(presetPath);
      if (data.manifest) {
        stackInfo = ` (${data.manifest.frontend ? data.manifest.frontend + '+' : ''}${data.manifest.backend || ''})`;
      }
    } catch {}
    console.log(`  - \x1b[33m${presetName}\x1b[0m\x1b[2m${stackInfo}\x1b[0m`);
  }
  console.log();
}

module.exports = {
  handleSavePreset,
  handleLoadPreset,
  handleListPresets
};
