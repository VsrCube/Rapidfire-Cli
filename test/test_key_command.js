const assert = require('assert');
const { handleKey } = require('../src/commands/key');
const { getUserConfig, saveUserConfig } = require('../src/utils/configPath');

console.log('[test_key_command] Testing key command management...');

const origConfig = getUserConfig();
const origKey = origConfig.geminiApiKey;

try {
  const testKey = 'test_api_key_xyz_987654321';
  handleKey([testKey]);
  const afterSave = getUserConfig();
  assert.strictEqual(afterSave.geminiApiKey, testKey, 'geminiApiKey must match saved key');
  console.log('  ✔ Key saved successfully');

  assert.doesNotThrow(() => handleKey(['status']), 'key status should run without throwing');
  console.log('  ✔ Key status checked');

  handleKey(['clear']);
  const afterClear = getUserConfig();
  assert(!afterClear.geminiApiKey, 'geminiApiKey must be null or empty after clear');
  console.log('  ✔ Key cleared successfully');

  assert.doesNotThrow(() => handleKey(['status']), 'key status when empty should run cleanly');
  console.log('  ✔ Key status when empty checked');

} finally {
  if (origKey) {
    saveUserConfig({ geminiApiKey: origKey });
  } else {
    saveUserConfig({ geminiApiKey: null });
  }
}

console.log('[test_key_command] All key command tests passed 100%!');
