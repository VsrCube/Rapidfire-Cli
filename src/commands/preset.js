const path = require('path');
const fse = require('fs-extra');
const { getPresetPath, listPresets, getPresetsDir } = require('../utils/configPath');
const { serializeDirectory, deserializeDirectory, normalizePresetData, isDirEmpty } = require('../utils/fsHelpers');
const { readManifest } = require('../utils/manifest');

function renderPresetErrorCard(title, details, suggestions = []) {
  const bold = '\x1b[1m';
  const red = '\x1b[31m';
  const yellow = '\x1b[33m';
  const cyan = '\x1b[36m';
  const reset = '\x1b[0m';

  const cardTitle = (title || 'ERROR: PRESET OPERATION FAILED').slice(0, 60);
  console.log(`\n${bold}${red}╔══════════════════════════════════════════════════════════════════╗${reset}`);
  console.log(`${bold}${red}║  ${cardTitle.padEnd(62)}  ║${reset}`);
  console.log(`${bold}${red}╚══════════════════════════════════════════════════════════════════╝${reset}\n`);

  if (details) {
    console.log(`  \x1b[31m${details}\x1b[0m\n`);
  }

  const list = (suggestions && suggestions.length > 0) ? suggestions : [
    'save preset <name> [folder]     (serialize project tree into preset)',
    'load preset <name> <folder>     (restore preset into empty folder)',
    'presets / list presets          (view all saved presets)'
  ];
  console.log(`${bold}${yellow}Usage & Examples:${reset}`);
  for (const s of list) {
    console.log(`  ${cyan}• ${s}${reset}`);
  }
  console.log();
}

function isValidPresetName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 64) return false;
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) return false;
  return /^[a-zA-Z0-9][a-zA-Z0-9_\-\.]*$/.test(trimmed);
}

function handleSavePreset(args) {
  const name = args && args[0];
  const folderArg = args && args[1];

  if (!name) {
    renderPresetErrorCard(
      'ERROR: MISSING PRESET NAME',
      'Please specify a name for the preset.',
      [
        'save preset my-template [folder]   (save current or specified folder as preset)',
        'save preset my-base-api ./backend (save backend folder as my-base-api)'
      ]
    );
    return { success: false, error: 'MISSING_PRESET_NAME' };
  }

  if (!isValidPresetName(name)) {
    renderPresetErrorCard(
      'ERROR: INVALID PRESET NAME',
      `Preset name '${name}' is invalid. Names must start with an alphanumeric character and contain only letters, numbers, dashes, underscores, and dots (no path traversal).`,
      [
        'save preset my-template [folder]',
        'save preset fullstack_starter [folder]'
      ]
    );
    return { success: false, error: 'INVALID_PRESET_NAME' };
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
      renderPresetErrorCard(
        'ERROR: TARGET DIRECTORY NOT FOUND',
        `Target directory '${folderArg}' does not exist (resolved: ${resolved}).`,
        [
          'save preset <name> <existing-folder>',
          'save preset <name>               (saves current directory)'
        ]
      );
      return { success: false, error: 'TARGET_DIR_NOT_FOUND' };
    }
  }

  const presetPath = getPresetPath(name);
  console.log(`\x1b[36m[rapidfire]\x1b[0m Scanning directory (${targetPath})...`);

  const manifest = readManifest(targetPath);
  if (manifest) {
    console.log(`\x1b[36m[rapidfire]\x1b[0m Detected stack from manifest: frontend=\x1b[33m${manifest.frontend || 'none'}\x1b[0m, backend=\x1b[33m${manifest.backend || 'none'}\x1b[0m`);
  }

  const presetData = serializeDirectory(targetPath);
  fse.writeJsonSync(presetPath, presetData, { spaces: 2 });

  console.log(`\x1b[32m[rapidfire] Preset '${name}' saved successfully!\x1b[0m`);
  console.log(`  Location: \x1b[2m${presetPath}\x1b[0m`);
  console.log(`  Items included: \x1b[1m${presetData.files.length}\x1b[0m`);
  if (presetData.manifest) {
    console.log(`  Stack metadata preserved from .rapidfire.json.`);
  }
  return {
    success: true,
    name,
    presetPath,
    itemsCount: presetData.files.length,
    manifest: presetData.manifest
  };
}

function handleLoadPreset(args) {
  const name = args && args[0];
  const targetFolder = args && args[1];

  if (!name || !targetFolder) {
    const available = listPresets();
    const suggestions = [
      'load preset my-template restored-app',
      'presets / list presets              (view available presets)'
    ];
    if (available.length > 0) {
      suggestions.unshift(`Available presets: ${available.join(', ')}`);
    }
    renderPresetErrorCard(
      'ERROR: MISSING ARGUMENTS',
      'Both preset name and target destination folder are required.',
      suggestions
    );
    return { success: false, error: 'MISSING_ARGUMENTS' };
  }

  if (!isValidPresetName(name)) {
    renderPresetErrorCard(
      'ERROR: INVALID PRESET NAME',
      `Preset name '${name}' is invalid. Names must start with an alphanumeric character.`,
      ['presets / list presets (view available presets)']
    );
    return { success: false, error: 'INVALID_PRESET_NAME' };
  }

  const presetPath = getPresetPath(name);
  if (!fse.existsSync(presetPath)) {
    const available = listPresets();
    renderPresetErrorCard(
      'ERROR: PRESET NOT FOUND',
      `Preset '${name}' not found at: ${presetPath}`,
      available.length > 0
        ? [`Available presets: ${available.join(', ')}`, 'presets (list details of all presets)']
        : ['No presets saved yet. Run `save preset <name>` first.']
    );
    return { success: false, error: 'PRESET_NOT_FOUND' };
  }

  const targetDir = path.resolve(process.cwd(), targetFolder);

  if (fse.existsSync(targetDir) && !isDirEmpty(targetDir)) {
    renderPresetErrorCard(
      'ERROR: TARGET DIRECTORY NOT EMPTY',
      `Target directory '${targetFolder}' already exists and contains files. Presets can only be loaded into an empty or new directory.`,
      [
        `load preset ${name} ./new-folder`,
        'Choose a new destination directory or empty the existing directory.'
      ]
    );
    return { success: false, error: 'TARGET_NOT_EMPTY' };
  }

  console.log(`\x1b[36m[rapidfire]\x1b[0m Loading preset '\x1b[33m${name}\x1b[0m' into \x1b[32m${targetFolder}\x1b[0m...`);
  try {
    const rawContent = fse.readFileSync(presetPath, 'utf8');
    let rawJson;
    try {
      rawJson = JSON.parse(rawContent);
    } catch (parseErr) {
      renderPresetErrorCard(
        'ERROR: CORRUPTED PRESET JSON',
        `Preset '${name}' contains corrupted or invalid JSON data: ${parseErr.message}`,
        [
          `Check file contents at: ${presetPath}`,
          `Re-save the preset using 'save preset ${name} <source-folder>'`
        ]
      );
      return { success: false, error: 'CORRUPTED_PRESET_JSON', details: parseErr.message };
    }

    const presetData = normalizePresetData(rawJson);
    if (!presetData || !Array.isArray(presetData.files)) {
      renderPresetErrorCard(
        'ERROR: INVALID PRESET STRUCTURE',
        `Preset '${name}' is missing required 'files' array specification.`,
        [`Re-save the preset using 'save preset ${name} <source-folder>'`]
      );
      return { success: false, error: 'INVALID_PRESET_STRUCTURE' };
    }

    deserializeDirectory(presetData, targetDir);

    console.log(`\x1b[32m[rapidfire] Successfully restored preset '${name}' (${presetData.files.length} items) into ${targetFolder}!\x1b[0m`);
    if (presetData.manifest) {
      console.log(`  Restored stack: frontend=\x1b[33m${presetData.manifest.frontend || 'none'}\x1b[0m, backend=\x1b[33m${presetData.manifest.backend || 'none'}\x1b[0m`);
    }
    return {
      success: true,
      name,
      targetDir,
      itemsCount: presetData.files.length,
      manifest: presetData.manifest
    };
  } catch (err) {
    renderPresetErrorCard(
      'ERROR: FAILED TO RESTORE PRESET',
      `Failed to restore preset '${name}': ${err.message}`,
      ['Check directory permissions and disk space.']
    );
    return { success: false, error: 'RESTORE_FAILED', details: err.message };
  }
}

function handleListPresets() {
  const presets = listPresets();
  if (presets.length === 0) {
    console.log('\n\x1b[33m[rapidfire] No presets saved yet.\x1b[0m');
    console.log('Use `\x1b[36msave preset <name> [folder]\x1b[0m` to save your first project preset.\n');
    return [];
  }

  const bold = '\x1b[1m';
  const cyan = '\x1b[36m';
  const yellow = '\x1b[33m';
  const green = '\x1b[32m';
  const red = '\x1b[31m';
  const dim = '\x1b[2m';
  const reset = '\x1b[0m';

  console.log(`\n${bold}${cyan}╔══════════════════════════════════════════════════════════════════╗${reset}`);
  console.log(`${bold}${cyan}║                   RAPIDFIRE SAVED PRESETS                        ║${reset}`);
  console.log(`${bold}${cyan}╚══════════════════════════════════════════════════════════════════╝${reset}\n`);

  const results = [];

  for (const presetName of presets) {
    const presetPath = getPresetPath(presetName);
    let stackInfo = 'none';
    let itemsCount = 0;
    let createdAt = 'Unknown';
    let isCorrupted = false;
    let errorDetail = '';

    try {
      const rawContent = fse.readFileSync(presetPath, 'utf8');
      const parsed = JSON.parse(rawContent);
      const data = normalizePresetData(parsed);
      if (!data || !Array.isArray(data.files)) {
        isCorrupted = true;
        errorDetail = 'Missing or invalid files structure';
      } else {
        itemsCount = data.files.length;
        if (data.manifest) {
          const fe = data.manifest.frontend || '';
          const be = data.manifest.backend || '';
          stackInfo = fe && be ? `${fe}+${be}` : fe || be || 'custom';
        }
        if (data.createdAt) {
          createdAt = new Date(data.createdAt).toLocaleString();
        }
      }
    } catch (err) {
      isCorrupted = true;
      errorDetail = 'Corrupted JSON syntax';
    }

    if (isCorrupted) {
      console.log(`  • ${bold}${yellow}${presetName.padEnd(20)}${reset} ${red}[CORRUPTED: ${errorDetail}]${reset}`);
      console.log(`    ${dim}Path: ${presetPath}${reset}`);
    } else {
      console.log(`  • ${bold}${yellow}${presetName.padEnd(20)}${reset} ${dim}|${reset} Stack: ${green}${stackInfo.padEnd(16)}${reset} ${dim}|${reset} Items: ${cyan}${String(itemsCount).padEnd(4)}${reset} ${dim}|${reset} Saved: ${dim}${createdAt}${reset}`);
      console.log(`    ${dim}Path: ${presetPath}${reset}`);
    }
    results.push({ name: presetName, stackInfo, itemsCount, createdAt, isCorrupted, path: presetPath });
  }

  console.log(`\n  ${dim}Total presets: ${presets.length}  •  Use 'load preset <name> <target>' to restore${reset}\n`);
  return results;
}

module.exports = {
  renderPresetErrorCard,
  isValidPresetName,
  handleSavePreset,
  handleLoadPreset,
  handleListPresets
};
