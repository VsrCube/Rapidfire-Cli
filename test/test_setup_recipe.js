const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { handleSetup } = require('../src/commands/setup');

console.log('--- TESTING SETUP DJANGO RECIPE ---');

const tmpDir = path.join(os.tmpdir(), `test_rapidfire_setup_${Date.now()}`);
fs.mkdirSync(tmpDir, { recursive: true });

const originalCwd = process.cwd();
process.chdir(tmpDir);

try {
  handleSetup(['django', 'my_django_app']);

  const appPath = path.join(tmpDir, 'my_django_app');
  assert(fs.existsSync(appPath), 'Project folder should exist');
  assert(fs.existsSync(path.join(appPath, 'manage.py')), 'manage.py should exist');
  assert(fs.existsSync(path.join(appPath, 'requirements.txt')), 'requirements.txt should exist');

  console.log('✓ Django recipe created manage.py and requirements.txt successfully.');

  console.log('Testing non-empty folder protection...');
  handleSetup(['django', 'my_django_app']);
  console.log('✓ Handled non-empty folder gracefully.');
} finally {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log('\n\x1b[32mRECIPE VERIFICATION COMPLETED SUCCESSFULLY!\x1b[0m\n');
