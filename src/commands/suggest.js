const { suggestStack, SUPPORTED_STACKS, hasApiKey } = require('../ai/gemini');
const { handleSetup } = require('./setup');
const { ensureOrPromptApiKey } = require('./key');

function askQuestion(rl, query) {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer ? answer.trim() : '');
    });
  });
}

async function handleSuggest(args, context = {}) {
  const query = args.join(' ').trim();
  if (!query) {
    console.log('\x1b[33m[rapidfire] Usage: suggest <project idea / description>\x1b[0m');
    console.log('Example: suggest a real-time dashboard for sports scores');
    return;
  }

  if (!hasApiKey() && !context.rl && typeof context.ask !== 'function') {
    await ensureOrPromptApiKey(context);
  }

  console.log(`\x1b[36m[rapidfire-ai] Analyzing requirements for: "${query}"...\x1b[0m`);
  const res = await suggestStack(query);

  if (res.success) {
    console.log('\n\x1b[32m[rapidfire-ai] Recommended Stack:\x1b[0m ' + `\x1b[1m\x1b[36m${res.stack}\x1b[0m`);
    console.log(`\x1b[2mReason: ${res.reason}\x1b[0m`);

    if (context.rl) {
      try {
        const answer = await askQuestion(
          context.rl,
          `\n\x1b[1m\x1b[33mDo you want to implement this stack now? (Y/N):\x1b[0m `
        );

        if (answer.toLowerCase().startsWith('y')) {
          const folder = await askQuestion(
            context.rl,
            `\x1b[36mEnter folder name for this project:\x1b[0m `
          );

          if (folder) {
            console.log(`\n[rapidfire] Implementing ${res.stack} in ${folder}...\n`);
            handleSetup([res.stack, folder]);
          } else {
            console.log('\x1b[33m[rapidfire] No folder name entered. Implementation cancelled.\x1b[0m');
          }
        } else {
          console.log('\x1b[2m[rapidfire] Skipped implementation. You can manually pick a stack anytime with: setup <stack> <folder>\x1b[0m');
        }
      } catch (err) {
        console.warn('[rapidfire] Interactive prompt error:', err.message);
      }
    } else {
      console.log(`\nTo scaffold this project, run: \x1b[32msetup ${res.stack} <folder-name>\x1b[0m\n`);
    }
  } else {
    console.log(`\x1b[33m[rapidfire-ai] ${res.message}\x1b[0m`);
    console.log('Available manual recipes:');
    SUPPORTED_STACKS.forEach(s => console.log(`  - ${s}`));
  }
}

module.exports = {
  handleSuggest
};
