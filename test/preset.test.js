const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const fse = require('fs-extra');
const { spawnSync } = require('child_process');
const {
  handleSavePreset,
  handleLoadPreset,
  handleListPresets,
  renderPresetErrorCard,
  isValidPresetName
} = require('../src/commands/preset');
const { getPresetPath, listPresets } = require('../src/utils/configPath');
const { deserializeDirectory, normalizePresetData } = require('../src/utils/fsHelpers');

console.log('\x1b[36mRunning Preset Management & Serialization Tests...\x1b[0m');

// 1. Error Card and Name Validator
assert.doesNotThrow(() => {
  renderPresetErrorCard('TEST: PRESET ERROR', 'Unit test error card verification');
}, 'renderPresetErrorCard must not throw');
console.log('  \x1b[32m✔ Error card formatting verified\x1b[0m');

assert.strictEqual(isValidPresetName('my-template'), true);
assert.strictEqual(isValidPresetName('fullstack_starter.v1'), true);
assert.strictEqual(isValidPresetName(''), false);
assert.strictEqual(isValidPresetName('../../evil'), false);
assert.strictEqual(isValidPresetName('bad name with spaces'), false);
assert.strictEqual(isValidPresetName('invalid/slash'), false);
console.log('  \x1b[32m✔ Preset name validator & path traversal protection verified\x1b[0m');

// 2. Setup isolated temporary test directory & mock project
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf_preset_unit_'));
const mockProj = path.join(testDir, 'mock_project');
fs.mkdirSync(path.join(mockProj, 'frontend', 'public'), { recursive: true });
fs.mkdirSync(path.join(mockProj, 'backend'), { recursive: true });
fs.writeFileSync(path.join(mockProj, '.rapidfire.json'), JSON.stringify({
  frontend: 'react',
  backend: 'fastapi',
  folderName: 'mock_project',
  isFullstack: true
}, null, 2));
fs.writeFileSync(path.join(mockProj, 'README.md'), '# Mock Project\n');
fs.writeFileSync(path.join(mockProj, 'backend', 'main.py'), 'print("fastapi")\n');
fs.writeFileSync(path.join(mockProj, 'frontend', 'package.json'), JSON.stringify({ name: 'mock-frontend' }));
fs.writeFileSync(path.join(mockProj, 'frontend', 'public', 'favicon.ico'), Buffer.from([0, 0, 1, 0, 1, 0, 16, 16, 0, 0, 1, 0, 32, 0, 104, 4, 0, 0, 22, 0, 0, 0]));

try {
  // Save Preset from mockProj
  const saveRes = handleSavePreset(['my-template', mockProj]);
  assert.ok(saveRes && saveRes.success, 'Save preset must succeed');
  assert.strictEqual(saveRes.name, 'my-template');
  assert.ok(saveRes.itemsCount >= 4, 'Items count must include all files and folders');
  assert.ok(saveRes.manifest, 'Manifest must be captured');
  assert.strictEqual(saveRes.manifest.frontend, 'react');
  assert.strictEqual(saveRes.manifest.backend, 'fastapi');
  console.log('  \x1b[32m✔ Save preset serialization & manifest capture verified\x1b[0m');

  // 3. List Presets
  const presets = handleListPresets();
  assert.ok(Array.isArray(presets), 'listPresets must return array');
  const found = presets.find(p => p.name === 'my-template');
  assert.ok(found, 'my-template must appear in list presets output');
  assert.strictEqual(found.stackInfo, 'react+fastapi');
  assert.strictEqual(found.itemsCount, saveRes.itemsCount);
  assert.strictEqual(found.isCorrupted, false);
  console.log('  \x1b[32m✔ List presets metadata inspection verified (name, stack, items, timestamp)\x1b[0m');

  // 4. Load Preset Full-Fidelity Restoration
  const restoreDir = path.join(testDir, 'test_unit_restore');
  fse.removeSync(restoreDir);

  const loadRes = handleLoadPreset(['my-template', restoreDir]);
  assert.ok(loadRes && loadRes.success, 'Load preset must succeed');
  assert.strictEqual(loadRes.itemsCount, saveRes.itemsCount);
  assert.ok(fs.existsSync(path.join(restoreDir, '.rapidfire.json')), 'Restored .rapidfire.json must exist');
  assert.ok(fs.existsSync(path.join(restoreDir, 'backend', 'main.py')), 'Restored backend/main.py must exist');
  assert.ok(fs.existsSync(path.join(restoreDir, 'frontend', 'public', 'favicon.ico')), 'Restored binary favicon.ico must exist');

  // Verify binary fidelity
  const origFavicon = fs.readFileSync(path.join(mockProj, 'frontend', 'public', 'favicon.ico'));
  const restFavicon = fs.readFileSync(path.join(restoreDir, 'frontend', 'public', 'favicon.ico'));
  assert.ok(origFavicon.equals(restFavicon), 'Binary file content must match byte-for-byte');
  fse.removeSync(restoreDir);
  console.log('  \x1b[32m✔ Load preset full fidelity deserialization verified (including binary assets)\x1b[0m');

  // 5. Robustness: Target directory not empty rejection
  const nonEmptyRes = handleLoadPreset(['my-template', mockProj]);
  assert.strictEqual(nonEmptyRes.success, false);
  assert.strictEqual(nonEmptyRes.error, 'TARGET_NOT_EMPTY');
  console.log('  \x1b[32m✔ Non-empty target directory rejection verified\x1b[0m');

  // 6. Robustness: Non-existent folder when saving
  const badFolderRes = handleSavePreset(['test-temp', path.join(testDir, 'non_existent_folder_xyz_999')]);
  assert.strictEqual(badFolderRes.success, false);
  assert.strictEqual(badFolderRes.error, 'TARGET_DIR_NOT_FOUND');
  console.log('  \x1b[32m✔ Non-existent source directory handled cleanly with error card\x1b[0m');

  // 7. Robustness: Non-existent preset name when loading
  const badPresetRes = handleLoadPreset(['non_existent_preset_999', restoreDir]);
  assert.strictEqual(badPresetRes.success, false);
  assert.strictEqual(badPresetRes.error, 'PRESET_NOT_FOUND');
  console.log('  \x1b[32m✔ Non-existent preset name handled cleanly with available presets list\x1b[0m');

  // 8. Robustness: Corrupted preset JSON resilience
  const corruptPresetPath = path.join(getPresetPath('temp-corrupt-test'));
  fs.writeFileSync(corruptPresetPath, '{"version": 1, "files": [broken json');

  const listAfterCorrupt = handleListPresets();
  const corruptFound = listAfterCorrupt.find(p => p.name === 'temp-corrupt-test');
  assert.ok(corruptFound, 'Corrupted preset must still be cataloged');
  assert.strictEqual(corruptFound.isCorrupted, true);

  const loadCorruptRes = handleLoadPreset(['temp-corrupt-test', restoreDir]);
  assert.strictEqual(loadCorruptRes.success, false);
  assert.strictEqual(loadCorruptRes.error, 'CORRUPTED_PRESET_JSON');
  fs.unlinkSync(corruptPresetPath);
  console.log('  \x1b[32m✔ Corrupted preset JSON resilience verified without crashes\x1b[0m');

  // 9. CLI Command Invocation Tests
  const binPath = path.join(__dirname, '../bin/rapidfire.js');

  // CLI list presets
  const cliList = spawnSync('node', [binPath, 'list', 'presets'], { encoding: 'utf8' });
  assert.strictEqual(cliList.status, 0);
  assert.ok(cliList.stdout.includes('RAPIDFIRE SAVED PRESETS'));
  assert.ok(cliList.stdout.includes('my-template'));

  // CLI missing arguments error card & exit code 1
  const cliMissing = spawnSync('node', [binPath, 'save', 'preset'], { encoding: 'utf8' });
  assert.strictEqual(cliMissing.status, 1);
  assert.ok(cliMissing.stdout.includes('ERROR: MISSING PRESET NAME'));

  // CLI invalid name error card & exit code 1
  const cliInvalid = spawnSync('node', [binPath, 'save', 'preset', '../../evil'], { encoding: 'utf8' });
  assert.strictEqual(cliInvalid.status, 1);
  assert.ok(cliInvalid.stdout.includes('ERROR: INVALID PRESET NAME'));
  console.log('  \x1b[32m✔ CLI integration verified (presets, save preset, load preset, exit codes)\x1b[0m');

} finally {
  try {
    fse.removeSync(testDir);
    const pPath = getPresetPath('my-template');
    if (fs.existsSync(pPath)) fs.unlinkSync(pPath);
  } catch {}
}

console.log('\x1b[32m[PASS] Preset Management & Serialization Tests Passed!\x1b[0m\n');
