const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { fallbackRepoOverview } = require('../src/ai/provider');
const { handleOverview } = require('../src/commands/overview');

console.log('\x1b[36mRunning Repository Overview Tests...\x1b[0m');

// 1. Fallback overview on current repository root
const rootRes = fallbackRepoOverview(process.cwd(), { critic: false });
assert.ok(rootRes && rootRes.success, 'Root fallback overview must succeed');
assert.ok(rootRes.isFallback, 'Must indicate isFallback: true');
assert.ok(rootRes.text.includes('rapidfire-cli') || rootRes.text.includes('miniproject'), 'Must identify repository name');
assert.ok(rootRes.text.includes('Folder Architecture'), 'Must contain Folder Architecture section');
assert.ok(rootRes.text.includes('Technology Used'), 'Must contain Technology Used section');
console.log('  \x1b[32m✔ Offline deterministic repository overview verified\x1b[0m');

// 2. Fallback overview with critic mode
const criticRes = fallbackRepoOverview(process.cwd(), { critic: true });
assert.ok(criticRes && criticRes.success, 'Critic fallback overview must succeed');
assert.ok(criticRes.text.includes('Architectural Critique'), 'Critic title verified');
assert.ok(criticRes.text.includes('Pros'), 'Critic pros section verified');
assert.ok(criticRes.text.includes('Cons'), 'Critic cons section verified');
assert.ok(criticRes.text.includes('Flaws'), 'Critic flaws section verified');
console.log('  \x1b[32m✔ Deterministic architectural critique (--critic) verified\x1b[0m');

// 3. Empty project handling
const emptyPath = path.join(__dirname, '../demo/trial_overview/empty_project');
if (!fs.existsSync(emptyPath)) {
  fs.mkdirSync(emptyPath, { recursive: true });
}
const emptyRes = fallbackRepoOverview(emptyPath, { critic: false });
assert.ok(emptyRes.isEmpty === true, 'Empty directory must return isEmpty: true');
assert.ok(emptyRes.text.includes('(empty)'), 'Empty architecture tree verified');
console.log('  \x1b[32m✔ Empty directory inspection & profile verified\x1b[0m');

// 4. Nonexistent target robustness
(async () => {
  const badRes = await handleOverview(['nonexistent_path_test_xyz_123']);
  assert.strictEqual(badRes.success, false, 'Nonexistent path must return success: false');
  assert.strictEqual(badRes.error, 'NOT_FOUND', 'Nonexistent path error must be NOT_FOUND');
  console.log('  \x1b[32m✔ Nonexistent directory error card and return contract verified\x1b[0m');

  console.log('\x1b[32m[PASS] Repository Overview Tests Passed!\x1b[0m\n');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
