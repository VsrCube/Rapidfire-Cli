const { askGemini, clearAskHistory, hasApiKey } = require('../ai/gemini');
const { extractDependencies, promptAndInstallDependencies } = require('../utils/depInstaller');
const { ensureOrPromptApiKey } = require('./key');

function stripAnsi(text) {
  return (text || '').replace(/\x1b\[[0-9;]*m/g, '');
}

function wrapLine(text, maxWidth, indent = '') {
  if (!text) return '';
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if (!word) continue;
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (stripAnsi(testLine).length <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.map((l, idx) => (idx === 0 ? l : `${indent}${l}`)).join('\n');
}

function formatMarkdownForTerminal(markdown) {
  const termWidth = process.stdout.columns || 80;
  const maxWidth = Math.max(36, Math.min(termWidth - 6, 88));
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
        const lineLen = Math.max(6, maxWidth - codeBlockLang.length - 8);
        formatted.push(`  \x1b[2m┌── ${codeBlockLang} ${'─'.repeat(lineLen)}\x1b[0m`);
      } else {
        inCodeBlock = false;
        const lineLen = Math.max(6, maxWidth - 4);
        formatted.push(`  \x1b[2m└${'─'.repeat(lineLen)}\x1b[0m`);
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

    if (/^(\s*[-*_]\s*){3,}$/.test(line)) {
      formatted.push(`  \x1b[2m${'─'.repeat(Math.max(10, maxWidth - 4))}\x1b[0m`);
      continue;
    }

    if (/^\s*[*+-]\s+/.test(line)) {
      const bulletContent = line.replace(/^\s*[*+-]\s+/, '');
      const styledContent = styleInlineMarkdown(bulletContent);
      const wrapped = wrapLine(styledContent, maxWidth - 6, '    ');
      formatted.push(`  \x1b[32m•\x1b[0m ${wrapped}`);
      continue;
    }

    if (!line.trim()) {
      formatted.push('');
      continue;
    }

    const styledContent = styleInlineMarkdown(line);
    const wrapped = wrapLine(styledContent, maxWidth - 2, '  ');
    formatted.push(`  ${wrapped}`);
  }

  return formatted.join('\n');
}

function styleInlineMarkdown(text) {
  let result = text.replace(/\*\*(.*?)\*\*/g, '\x1b[1m$1\x1b[0m');
  result = result.replace(/`([^`]+)`/g, '\x1b[33m$1\x1b[0m');
  return result;
}

function renderTerminalBox(title, bodyText) {
  const termWidth = process.stdout.columns || 80;
  const boxWidth = Math.max(40, Math.min(termWidth - 2, 92));
  const innerWidth = boxWidth - 2;
  const titleText = ` ${title} `;
  const leftDash = 2;
  const rightDash = Math.max(0, innerWidth - leftDash - titleText.length);
  const top = `\x1b[36m╭${'─'.repeat(leftDash)}${titleText}${'─'.repeat(rightDash)}╮\x1b[0m`;
  const bottom = `\x1b[36m╰${'─'.repeat(innerWidth)}╯\x1b[0m`;
  return `${top}\n${bodyText}\n${bottom}`;
}

async function handleAsk(args, context = {}) {
  const rawQuestion = args.join(' ').trim();
  const question = rawQuestion.replace(/^["']|["']$/g, '').trim();
  if (!question) {
    console.log('\x1b[33m[rapidfire] Usage: ask <your question>\x1b[0m');
    console.log('Example: ask what is the best stack for ai-ml');
    console.log('         ask clear (to reset conversation context memory)');
    return;
  }

  if (question.toLowerCase() === 'clear' || question.toLowerCase() === 'reset') {
    clearAskHistory(context.repoRoot);
    console.log('\x1b[32m[rapidfire-ai] Conversation context memory cleared successfully.\x1b[0m\n');
    return;
  }

  const keyReady = await ensureOrPromptApiKey(context);
  if (!keyReady) {
    return;
  }

  process.stdout.write('\x1b[36m[rapidfire-ai] Thinking...\x1b[0m\r');
  const res = await askGemini(question, { repoRoot: context.repoRoot });

  process.stdout.write(' '.repeat(40) + '\r');

  if (!res.success) {
    console.log(`\x1b[31m[rapidfire-ai] ${res.message}\x1b[0m`);
    return;
  }

  console.log('\n' + renderTerminalBox('Rapidfire AI', formatMarkdownForTerminal(res.text.trim())) + '\n');

  const deps = extractDependencies(res.text);
  if (deps && deps.packages.length > 0 && context.rl) {
    await promptAndInstallDependencies(deps, context.rl);
  }
}

module.exports = {
  handleAsk,
  formatMarkdownForTerminal,
  renderTerminalBox,
  wrapLine,
  stripAnsi
};
