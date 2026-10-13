const assert = require('assert');
const path = require('path');
const os = require('os');
const fse = require('fs-extra');
const { handleSavePreset, handleLoadPreset } = require('../src/commands/preset');
const { writeManifest } = require('../src/utils/manifest');
const { getPresetPath } = require('../src/utils/configPath');

console.log('--- TEST: SMART PRESET DIRECTORY RESOLUTION ---');

const tmpRoot = path.join(os.tmpdir(), `test_smart_preset_${Date.now()}`);
const appFolder = path.join(tmpRoot, 'folderm1');
fse.ensureDirSync(appFolder);

writeManifest(appFolder, {
  frontend: 'react',
  backend: 'django',
  folderName: 'folderm1'
});
fse.writeFileSync(path.join(appFolder, 'test.txt'), 'hello', 'utf8');

const originalCwd = process.cwd();

try {
  process.chdir(appFolder);
  assert.strictEqual(path.basename(process.cwd()), 'folderm1');

  console.log('Testing: save preset while already inside folderm1...');
  const presetName = `smart_p_${Date.now()}`;
  handleSavePreset([presetName, 'folderm1']);

  const presetFile = getPresetPath(presetName);
  assert(fse.existsSync(presetFile), 'Preset file should be created successfully even when inside folderm1');

  const presetData = fse.readJsonSync(presetFile);
  assert.strictEqual(presetData.manifest.folderName, 'folderm1');
  assert(presetData.files.some(f => f.path === 'test.txt'));

  fse.removeSync(presetFile);
  console.log('✓ Smart preset directory resolution verified successfully.');
} finally {
  process.chdir(originalCwd);
  fse.removeSync(tmpRoot);
}
