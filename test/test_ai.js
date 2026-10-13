const assert = require('assert');
const { askGemini, suggestStack, SUPPORTED_STACKS, hasApiKey, getApiKey } = require('../src/ai/gemini');

console.log('--- TEST: AI INTEGRATION & EXPANDED STACKS ---');

async function runAiTests() {
  assert(SUPPORTED_STACKS.includes('react+fastapi'));
  assert(SUPPORTED_STACKS.includes('react+django'));
  assert(SUPPORTED_STACKS.includes('react+node'));
  assert(SUPPORTED_STACKS.includes('vue+fastapi'));
  assert(SUPPORTED_STACKS.includes('vue+node'));
  assert(SUPPORTED_STACKS.includes('vue+django'));
  assert(SUPPORTED_STACKS.includes('react+flask'));
  assert(SUPPORTED_STACKS.includes('svelte+node'));
  assert(SUPPORTED_STACKS.includes('fastapi'));
  assert(SUPPORTED_STACKS.includes('react'));
  assert(SUPPORTED_STACKS.includes('vue'));
  assert(SUPPORTED_STACKS.includes('svelte'));
  assert.strictEqual(SUPPORTED_STACKS.length, 13, 'Must support 13 recipes including standalone frontends');
  console.log('✓ All 13 supported recipes verified in AI stack registry.');

  assert(hasApiKey(), 'Should detect persistent Gemini API key');
  const key = getApiKey();
  assert(key && key.length > 10, 'Should retrieve valid API key');
  console.log('✓ Persistent API key resolution verified.');

  console.log('Testing live Gemini ask query...');
  const liveAsk = await askGemini('Respond with only the word OK');
  assert(liveAsk.success, 'Live Gemini query should succeed with configured key');
  assert(liveAsk.text && liveAsk.text.length > 0, 'Should return text response');
  console.log(`✓ Live Gemini query succeeded: "${liveAsk.text.trim()}"`);

  console.log('Testing live Gemini stack suggestion...');
  const liveSuggest = await suggestStack('A high-performance async REST API with automatic Swagger docs');
  assert(liveSuggest.success, 'Live suggestion should succeed');
  assert(SUPPORTED_STACKS.includes(liveSuggest.stack), `Suggested stack ${liveSuggest.stack} must be one of the 7 supported stacks`);
  console.log(`✓ Live stack recommendation: ${liveSuggest.stack} (${liveSuggest.reason})`);

  console.log('\n\x1b[32mAI INTEGRATION VERIFIED WITH 100% SUCCESS!\x1b[0m\n');
}

runAiTests().catch(err => {
  console.error('AI Test failed:', err);
  process.exit(1);
});
