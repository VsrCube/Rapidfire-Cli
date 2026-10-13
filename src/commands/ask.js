const { askGemini, clearAskHistory, hasApiKey } = require('../ai/gemini');
const { extractDependencies, promptAndInstallDependencies } = require('../utils/depInstaller');
const { ensureOrPromptApiKey } = require('./key');

function formatMarkdownForTerminal(markdown) {
  const lines = markdown.split('\n');
  const formatted = [];
  let inCodeBlock = false;
  let codeBlockLang = '';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = line.trim().slice(3) || 'code';
        formatted.push(`  \x1b[2m┌── ${codeBlockLang} ─────────────────────────────\x1b[0m`);
      } else {
        inCodeBlock = false;
        formatted.push(`  \x1b[2m└────────────────────────────────────────\x1b[0m`);
      }
      continue;
    }

    if (inCodeBlock) {
      formatted.push(`  \x1b[2m│\x1b[0m \x1b[36m${line}\x1b[0m`);
      continue;
    }

    if (line.startsWith('# ')) {
      formatted.push(`\n\x1b[1m\x1b[36m${line.slice(2).toUpperCase()}\x1b[0m`);
      continue;
    }
    if (line.startsWith('## ')) {
      formatted.push(`\n\x1b[1m\x1b[33m${line.slice(3)}\x1b[0m`);
      continue;
    }
    if (line.startsWith('### ')) {
      formatted.push(`\x1b[1m\x1b[32m${line.slice(4)}\x1b[0m`);
      continue;
    }

    if (/^\s*[*+-]\s+/.test(line)) {
      const bulletContent = line.replace(/^\s*[*+-]\s+/, '');
      const styledContent = styleInlineMarkdown(bulletContent);
      formatted.push(`  \x1b[32m•\x1b[0m ${styledContent}`);
      continue;
    }

    formatted.push(styleInlineMarkdown(line));
  }

  return formatted.join('\n');
}

function styleInlineMarkdown(text) {
  let result = text.replace(/\*\*(.*?)\*\*/g, '\x1b[1m$1\x1b[0m');
  result = result.replace(/`([^`]+)`/g, '\x1b[33m$1\x1b[0m');
  return result;
}

async function handleAsk(args, context = {}) {
  const question = args.join(' ').trim();
  if (!question) {
    console.log('\x1b[33m[rapidfire] Usage: ask <your question>\x1b[0m');
    console.log('Example: ask what is the best stack for ai-ml');
    console.log('         ask clear (to reset conversation context memory)');
    return;
  }

  if (question.toLowerCase() === 'clear' || question.toLowerCase() === 'reset') {
    clearAskHistory();
    console.log('\x1b[32m[rapidfire-ai] Conversation context memory cleared successfully.\x1b[0m\n');
    return;
  }

  const keyReady = await ensureOrPromptApiKey(context);
  if (!keyReady) {
    return;
  }

  process.stdout.write('\x1b[36m[rapidfire-ai] Thinking...\x1b[0m\r');
  const res = await askGemini(question);

  process.stdout.write(' '.repeat(40) + '\r');

  if (!res.success) {
    console.log(`\x1b[31m[rapidfire-ai] ${res.message}\x1b[0m`);
    return;
  }

  console.log('\n\x1b[36m╭───────────────────────── Rapidfire AI ─────────────────────────╮\x1b[0m');
  console.log(formatMarkdownForTerminal(res.text.trim()));
  console.log('\x1b[36m╰────────────────────────────────────────────────────────────────╯\x1b[0m\n');

  const deps = extractDependencies(res.text);
  if (deps && deps.packages.length > 0 && context.rl) {
    await promptAndInstallDependencies(deps, context.rl);
  }
}

module.exports = {
  handleAsk,
  formatMarkdownForTerminal
};
