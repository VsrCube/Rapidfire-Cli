const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { getPresetPath, listPresets, ensureConfigDirs } = require('../src/utils/configPath');
const { ensurePath, commandExists, getDjangoAdminCmd } = require('../src/utils/proc');
const {
  isDirEmpty,
  serializeDirectory,
  deserializeDirectory,
  shouldIgnore
} = require('../src/utils/fsHelpers');
const { matchCommand } = require('../src/commands');

console.log('--- RUNNING RAPIDFIRE VERIFICATION SUITE ---');

console.log('[Test 1] Config paths & dirs...');
ensureConfigDirs();
const presetPath = getPresetPath('my-app');
assert(presetPath.endsWith('my-app.json'), 'Preset path should end with my-app.json');
assert(Array.isArray(listPresets()), 'listPresets should return an array');
console.log('✓ Config paths verified.');

console.log('[Test 2] Process & PATH resilience...');
ensurePath();
assert(commandExists('git'), 'git should be detected as present');
assert(commandExists('node'), 'node should be detected as present');
assert(commandExists('npm'), 'npm should be detected as present');
const djangoExists = commandExists('django-admin');
console.log(`  django-admin detected: ${djangoExists} (via ${getDjangoAdminCmd()})`);
assert(djangoExists, 'django-admin should be found via ~/.local/bin or python module');
console.log('✓ Process and PATH verified.');

console.log('[Test 3] fsHelpers serialization & ignore list...');
assert(shouldIgnore('node_modules'), 'node_modules should be ignored');
assert(shouldIgnore('.git'), '.git should be ignored');
assert(shouldIgnore('venv'), 'venv should be ignored');
assert(!shouldIgnore('src'), 'src should not be ignored');

const tmpTestDir = path.join(os.tmpdir(), `rapidfire_test_${Date.now()}`);
fs.mkdirSync(tmpTestDir, { recursive: true });
assert(isDirEmpty(tmpTestDir), 'New empty dir should be detected as empty');

fs.writeFileSync(path.join(tmpTestDir, 'index.js'), 'console.log("hello");', 'utf8');
const subDir = path.join(tmpTestDir, 'sub');
fs.mkdirSync(subDir, { recursive: true });
fs.writeFileSync(path.join(subDir, 'config.json'), '{"name":"test"}', 'utf8');
const nodeModules = path.join(tmpTestDir, 'node_modules');
fs.mkdirSync(nodeModules, { recursive: true });
fs.writeFileSync(path.join(nodeModules, 'pkg.js'), '// fake pkg', 'utf8');

const serialized = serializeDirectory(tmpTestDir);
assert.strictEqual(serialized.version, 1);
const paths = serialized.files.map(f => f.path);
assert(paths.includes('index.js'), 'Serialized tree must include index.js');
assert(paths.includes(path.join('sub', 'config.json')), 'Serialized tree must include sub/config.json');
assert(!paths.some(p => p.includes('node_modules')), 'node_modules must be excluded from serialization');

const restoreDir = path.join(os.tmpdir(), `rapidfire_restore_${Date.now()}`);
deserializeDirectory(serialized, restoreDir);
assert(fs.existsSync(path.join(restoreDir, 'index.js')), 'Restored index.js should exist');
assert(fs.existsSync(path.join(restoreDir, 'sub', 'config.json')), 'Restored sub/config.json should exist');
assert(!fs.existsSync(path.join(restoreDir, 'node_modules')), 'Restored folder should not contain node_modules');

fs.rmSync(tmpTestDir, { recursive: true, force: true });
fs.rmSync(restoreDir, { recursive: true, force: true });
console.log('✓ fsHelpers round-trip serialization verified.');

console.log('[Test 4] Command matcher routing...');
assert(matchCommand('help') !== null, 'help command should match');
assert(matchCommand('exit') !== null, 'exit command should match');
assert(matchCommand('quit') !== null, 'quit command should match');
assert(matchCommand('setup react+django myapp') !== null, 'setup command should match');
assert(matchCommand('save preset mypreset') !== null, 'save preset should match');
assert(matchCommand('load preset mypreset target') !== null, 'load preset should match');
assert(matchCommand('presets') !== null, 'presets should match');
assert(matchCommand('list presets') !== null, 'list presets should match');

assert.strictEqual(matchCommand('ls -la'), null, 'ls -la should pass through to shell');
assert.strictEqual(matchCommand('cd myfolder'), null, 'cd should pass through to shell');
assert.strictEqual(matchCommand('git status'), null, 'git status should pass through to shell');
assert.strictEqual(matchCommand('pwd'), null, 'pwd should pass through to shell');
console.log('✓ Command matcher routing verified.');

console.log('\n\x1b[32mALL TESTS PASSED SUCCESSFULLY!\x1b[0m\n');
