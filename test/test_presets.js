const assert = require('assert');
const path = require('path');
const os = require('os');
const fse = require('fs-extra');
const { handleSavePreset, handleLoadPreset } = require('../src/commands/preset');
const { writeManifest, readManifest } = require('../src/utils/manifest');
const { getPresetPath } = require('../src/utils/configPath');

console.log('--- TEST: PRESETS WITH MANIFEST ---');

const tmpRoot = path.join(os.tmpdir(), `test_preset_root_${Date.now()}`);
const srcProject = path.join(tmpRoot, 'src_project');
const destProject = path.join(tmpRoot, 'dest_project');

fse.ensureDirSync(srcProject);

try {
  writeManifest(srcProject, {
    frontend: 'react',
    backend: 'node',
    folderName: 'src_project'
  });
  fse.writeFileSync(path.join(srcProject, 'index.js'), 'console.log("hello world");', 'utf8');
  fse.ensureDirSync(path.join(srcProject, 'config'));
  fse.writeFileSync(path.join(srcProject, 'config', 'app.json'), '{"port": 3000}', 'utf8');

  fse.ensureDirSync(path.join(srcProject, 'node_modules', 'fake'));
  fse.writeFileSync(path.join(srcProject, 'node_modules', 'fake', 'index.js'), 'dummy');

  const presetName = `test_p_${Date.now()}`;
  handleSavePreset([presetName, srcProject]);

  const presetFile = getPresetPath(presetName);
  assert(fse.existsSync(presetFile), 'Preset JSON file should exist');

  const presetData = fse.readJsonSync(presetFile);
  assert(presetData.manifest, 'Preset JSON must contain manifest data');
  assert.strictEqual(presetData.manifest.backend, 'node');
  assert(!presetData.files.some(f => f.path.includes('node_modules')), 'Must exclude node_modules');

  handleLoadPreset([presetName, destProject]);

  assert(fse.existsSync(path.join(destProject, 'index.js')), 'Restored index.js must exist');
  assert(fse.existsSync(path.join(destProject, 'config', 'app.json')), 'Restored config/app.json must exist');
  assert(fse.existsSync(path.join(destProject, '.rapidfire.json')), 'Restored .rapidfire.json must exist');

  const restoredManifest = readManifest(destProject);
  assert.strictEqual(restoredManifest.frontend, 'react');
  assert.strictEqual(restoredManifest.backend, 'node');

  fse.removeSync(presetFile);
  console.log('✓ Preset serialization, deserialization, and manifest preservation verified.');
} finally {
  fse.removeSync(tmpRoot);
}
