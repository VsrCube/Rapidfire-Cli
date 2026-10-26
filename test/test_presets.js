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

  fse.writeFileSync(path.join(srcProject, '.gitignore'), 'node_modules/\n.env\ndist/\n', 'utf8');
  const binaryPayload = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0xFF]);
  fse.writeFileSync(path.join(srcProject, 'logo.png'), binaryPayload);

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
  assert(presetData.files.some(f => f.path === '.gitignore'), 'Preset must preserve .gitignore');

  const binaryItem = presetData.files.find(f => f.path === 'logo.png');
  assert(binaryItem, 'Preset must include binary file logo.png');
  assert.strictEqual(binaryItem.encoding, 'base64', 'Binary file must be encoded as base64');

  handleLoadPreset([presetName, destProject]);

  assert(fse.existsSync(path.join(destProject, 'index.js')), 'Restored index.js must exist');
  assert(fse.existsSync(path.join(destProject, 'config', 'app.json')), 'Restored config/app.json must exist');
  assert(fse.existsSync(path.join(destProject, '.rapidfire.json')), 'Restored .rapidfire.json must exist');
  assert(fse.existsSync(path.join(destProject, '.gitignore')), 'Restored .gitignore must exist');
  assert.strictEqual(fse.readFileSync(path.join(destProject, '.gitignore'), 'utf8'), 'node_modules/\n.env\ndist/\n');

  assert(fse.existsSync(path.join(destProject, 'logo.png')), 'Restored logo.png must exist');
  const restoredBinary = fse.readFileSync(path.join(destProject, 'logo.png'));
  assert.strictEqual(Buffer.compare(restoredBinary, binaryPayload), 0, 'Binary file content must be bit-for-bit identical without corruption');

  const restoredManifest = readManifest(destProject);
  assert.strictEqual(restoredManifest.frontend, 'react');
  assert.strictEqual(restoredManifest.backend, 'node');

  fse.removeSync(presetFile);
  console.log('OK: Preset serialization, deserialization, .gitignore preservation, and binary preservation verified.');
} finally {
  fse.removeSync(tmpRoot);
}
