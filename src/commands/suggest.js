const { suggestStack, SUPPORTED_STACKS, hasApiKey } = require('../ai/gemini');
const { handleSetup } = require('./setup');
const { ensureOrPromptApiKey } = require('./key');

function askQuestion(rl, query) {
  return new Promise((resolve) => {
    if (!rl || rl.closed) return resolve('');
    try {
      rl.question(query, (answer) => {
        resolve(answer ? answer.trim() : '');
      });
    } catch {
      resolve('');
    }
  });
}

async function promptUser(context, query) {
  if (context && typeof context.ask === 'function') {
    const ans = await context.ask(query);
    return ans ? ans.trim() : '';
  }
  if (context && context.rl) {
    return await askQuestion(context.rl, query);
  }
  return '';
}

async function handleSuggest(args, context = {}) {
  const query = (Array.isArray(args) ? args.join(' ') : String(args || '')).trim();
  if (!query) {
    console.log('\x1b[33m[rapidfire] Usage: suggest <project idea / description>\x1b[0m');
    console.log('Example: suggest a real-time dashboard for sports scores');
    return { success: false, reason: 'missing_query' };
  }

  if (!hasApiKey() && !context.rl && typeof context.ask !== 'function') {
    await ensureOrPromptApiKey(context);
  }

  console.log(`\x1b[36m[rapidfire-ai] Analyzing requirements for: "${query}"...\x1b[0m`);
  const res = await suggestStack(query);

  if (res.success) {
    console.log('\n\x1b[32m[rapidfire-ai] Recommended Stack:\x1b[0m ' + `\x1b[1m\x1b[36m${res.stack}\x1b[0m`);
    console.log(`\x1b[2mReason: ${res.reason}\x1b[0m`);

    let implemented = false;
    let targetFolder = null;

    if (context.rl || typeof context.ask === 'function') {
      try {
        const answer = await promptUser(
          context,
          `\n\x1b[1m\x1b[33mDo you want to implement this stack now? (Y/N):\x1b[0m `
        );

        if (answer.toLowerCase().startsWith('y')) {
          const folder = await promptUser(
            context,
            `\x1b[36mEnter folder name for this project:\x1b[0m `
          );

          if (folder) {
            console.log(`\n[rapidfire] Implementing ${res.stack} in ${folder}...\n`);
            targetFolder = folder;
            await handleSetup([res.stack, folder]);
            implemented = true;
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

    return {
      success: true,
      stack: res.stack,
      reason: res.reason,
      fallbackUsed: !!res.fallbackUsed,
      implemented,
      targetFolder
    };
  } else {
    console.log(`\x1b[33m[rapidfire-ai] ${res.message || 'Unable to suggest stack.'}\x1b[0m`);
    console.log('Available manual recipes:');
    SUPPORTED_STACKS.forEach(s => console.log(`  - ${s}`));
    return {
      success: false,
      message: res.message
    };
  }
}

module.exports = {
  handleSuggest
};
