const { execSync } = require('child_process');
const path = require('path');

process.env.RAPIDFIRE_SKIP_INSTALL = '1';
process.env.RAPIDFIRE_SKIP_GH = '1';
process.env.RAPIDFIRE_AUTO_VENV = '0';

const testScripts = [
  'test/test_helpers.js',
  'test/test_manifest.js',
  'test/test_integrations.js',
  'test/test_ai.js',
  'test/test_ai_context.js',
  'test/test_dep_security.js',
  'test/test_presets.js',
  'test/test_smart_preset.js',
  'test/test_deploy.js',
  'test/test_recipes.js',
  'test/test_new_recipes.js',
  'test/test_standalone_frontends.js',
  'test/test_interactive_suggest.js',
  'test/test_pty_passthrough.js',
  'test/test_cross_platform.js',
  'test/test_tell.js',
  'test/test_venv_prompt.js',
  'test/test_key_command.js',
  'test/test_prereqs_and_lts.js',
  'test/test_explain.js',
  'test/test_highlighter.js',
  'test/test_history.js',
  'test/test_push_command.js',
  'test/test_repl_prompt.js',
  'test/test_dynamic_scaffolding.js',
  'test/test_nested_git.js',
  'test/test_run_command.js',
  'test/test_repo_memory.js',
  'test/test_explain_markdown_export.js',
  'test/test_explain_subfolder_export.js',
  'test/test_overview.js',
  'test/test_init_wizard.js',
  'test/test_universal_frameworks.js',
  'test/test_setup_redesign.js'
];

console.log('\n======================================================');
console.log('       RAPIDFIRE CLI MASTER VERIFICATION SUITE       ');
console.log('======================================================\n');

let passed = 0;
let failed = 0;

for (const script of testScripts) {
  const fullPath = path.resolve(__dirname, '..', script);
  console.log(`\x1b[36m▶ Running: ${script}\x1b[0m`);
  try {
    execSync(`node "${fullPath}"`, { stdio: 'inherit' });
    console.log(`\x1b[32m✔ Passed: ${script}\x1b[0m\n`);
    passed++;
  } catch {
    console.error(`\x1b[31m✖ Failed: ${script}\x1b[0m\n`);
    failed++;
  }
}

console.log('======================================================');
console.log(`Summary: ${passed} passed, ${failed} failed (${testScripts.length} total)`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log(`\x1b[32mALL ${testScripts.length} TEST SUITES PASSED FLAWLESSLY!\x1b[0m\n`);
  process.exit(0);
}
