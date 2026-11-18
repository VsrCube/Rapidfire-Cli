const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { handleKey } = require('../src/commands/key');
const { buildRepoContext, extractRelevantSnippets } = require('../src/utils/repoContext');
const { formatMarkdownForTerminal, renderTerminalBox, stripAnsi } = require('../src/commands/ask');
const { loadRepoMemory, saveRepoMemory, clearRepoMemory } = require('../src/utils/repoMemory');
const { extractDependencies } = require('../src/utils/depInstaller');

console.log('\x1b[36mRunning AI & Configuration Tests...\x1b[0m');

// 1. Key status without crashing
assert.doesNotThrow(() => {
  handleKey(['status']);
}, 'key status should not throw');
console.log('  \x1b[32m✔ Key management status command verified\x1b[0m');

// 2. Repo context extraction
const ctx = buildRepoContext(process.cwd());
assert.ok(ctx, 'Repo context must return an object');
assert.ok(ctx.repoRoot, 'repoRoot must be defined');
assert.ok(ctx.manifests && typeof ctx.manifests === 'object', 'manifests must be an object');
console.log(`  \x1b[32m✔ Repo context inspection verified (root: ${ctx.repoName})\x1b[0m`);

// 3. Code-grounded snippet extraction
const secretSnippets = extractRelevantSnippets(process.cwd(), 'how does secret scanning work');
assert.ok(secretSnippets.some(s => s.file.includes('secretScanner.js')), 'Should extract secretScanner.js snippet');
const replSnippets = extractRelevantSnippets(process.cwd(), 'how does repl handle sentinels');
assert.ok(replSnippets.some(s => s.file.includes('repl.js')), 'Should extract repl.js snippet');
console.log('  \x1b[32m✔ Code-grounded snippet extraction verified (secretScanner, repl)\x1b[0m');

// 4. Markdown terminal box formatting
const sampleMd = '# Header\n* Bullet\n```js\nconst x = 1;\n```';
const formatted = formatMarkdownForTerminal(sampleMd);
const boxed = renderTerminalBox('Rapidfire AI', formatted);
assert.ok(stripAnsi(boxed).includes('HEADER'), 'Must format header');
assert.ok(stripAnsi(boxed).includes('• Bullet'), 'Must format bullet list');
assert.ok(stripAnsi(boxed).includes('┌── js'), 'Must format code frame');
console.log('  \x1b[32m✔ Markdown box rendering & terminal wrapping verified\x1b[0m');

// 5. Repo memory dual persistence
const mem = loadRepoMemory(process.cwd());
assert.ok(mem, 'Memory must load');
assert.ok(fs.existsSync(path.join(process.cwd(), '.rapidfire', 'memory.json')), 'memory.json must exist');
assert.ok(fs.existsSync(path.join(process.cwd(), '.rapidfire', 'repo_memory.json')), 'repo_memory.json must exist');
console.log('  \x1b[32m✔ Persistent repo memory dual storage verified (.rapidfire/repo_memory.json)\x1b[0m');

// 6. Actionable dependency extraction
const depRes = extractDependencies('Run ```bash\npip install fastapi uvicorn\n```');
assert.ok(depRes && depRes.packages.includes('fastapi'), 'Must extract python package');
console.log('  \x1b[32m✔ Actionable dependency extractor verified\x1b[0m');

console.log('\x1b[32m[PASS] AI & Configuration Tests Passed!\x1b[0m\n');
