const fs = require('fs');
const path = require('path');
const os = require('os');
const { explainFile, explainDirectory } = require('../ai/gemini');
const { findRepoRoot, recordExplanationEntry } = require('../utils/repoMemory');
const { formatMarkdownForTerminal, renderTerminalBox } = require('./ask');

function renderExplainErrorCard(title, details, suggestions = []) {
  const bold = '\x1b[1m';
  const red = '\x1b[31m';
  const yellow = '\x1b[33m';
  const cyan = '\x1b[36m';
  const reset = '\x1b[0m';
  const dim = '\x1b[2m';

  const cardTitle = (title || 'ERROR: TARGET NOT FOUND').slice(0, 60);
  console.log(`\n${bold}${red}╔══════════════════════════════════════════════════════════════════╗${reset}`);
  console.log(`${bold}${red}║  ${cardTitle.padEnd(62)}  ║${reset}`);
  console.log(`${bold}${red}╚══════════════════════════════════════════════════════════════════╝${reset}\n`);

  if (details) {
    console.log(`  \x1b[31m${details}\x1b[0m\n`);
  }

  const list = (suggestions && suggestions.length > 0) ? suggestions : [
    'explain .                      (inspect current directory architecture)',
    'explain src/repl.js            (inspect specific source file)',
    'explain <path-to-target>       (inspect any relative or absolute path)'
  ];
  console.log(`${bold}${yellow}Usage & Examples:${reset}`);
  for (const s of list) {
    console.log(`  ${cyan}• ${s}${reset}`);
  }
  console.log();
}

async function handleExplain(args) {
  const magenta = '\x1b[35m';
  const red = '\x1b[31m';
  const reset = '\x1b[0m';
  const dim = '\x1b[2m';

  const rawTarget = args.length > 0 ? args.join(' ').replace(/^["']|["']$/g, '').trim() : '.';
  const targetPath = path.resolve(process.cwd(), rawTarget);

  if (!fs.existsSync(targetPath)) {
    renderExplainErrorCard(
      'ERROR: TARGET DOES NOT EXIST',
      `Target path not found: ${rawTarget}`,
      [
        'explain .                      (explain current directory architecture)',
        'explain src/repl.js            (explain a specific source file)',
        'explain <path-to-target>       (explain any relative or absolute path)'
      ]
    );
    return { success: false, error: 'NOT_FOUND', target: rawTarget };
  }

  const stat = fs.statSync(targetPath);
  const isDir = stat.isDirectory();
  const label = isDir ? 'directory architecture' : 'source file';
  const displayTarget = path.relative(process.cwd(), targetPath) || '.';

  console.log(`\n${magenta}[rapidfire-ai] Inspecting ${label}: "${displayTarget}"...${reset}\n`);

  let result;
  if (isDir) {
    result = await explainDirectory(targetPath);
  } else {
    result = await explainFile(targetPath);
  }

  if (!result || !result.success) {
    renderExplainErrorCard(
      'ERROR: EXPLANATION FAILED',
      `Failed to explain target: ${result ? result.message : 'Unknown error'}`
    );
    return result;
  }

  const isInsideCwd = targetPath.startsWith(process.cwd()) && process.cwd() !== os.homedir();
  const repoRoot = isInsideCwd ? findRepoRoot(process.cwd()) : findRepoRoot(targetPath);
  const mdDir = path.join(repoRoot, 'md');
  if (!fs.existsSync(mdDir)) {
    fs.mkdirSync(mdDir, { recursive: true });
  }

  const mdFile = path.join(mdDir, 'explanation.md');
  const mdAltFile = path.join(mdDir, 'explaination.md');

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const rawBase = (displayTarget === '.' || !displayTarget)
    ? path.basename(repoRoot)
    : path.basename(displayTarget).replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const targetMdFileName = `${rawBase || 'target'}_explain_${dateStr}.md`;
  const targetMdPath = path.join(mdDir, targetMdFileName);

  fs.writeFileSync(targetMdPath, result.text, 'utf8');
  fs.writeFileSync(mdFile, result.text, 'utf8');
  fs.writeFileSync(mdAltFile, result.text, 'utf8');

  recordExplanationEntry(repoRoot, displayTarget, result.text.slice(0, 300), `md/${targetMdFileName}`);

  console.log('\n' + renderTerminalBox('RapidFire Architecture', formatMarkdownForTerminal(result.text.trim())));

  const relSaved = path.relative(process.cwd(), targetMdPath) || path.basename(targetMdPath);
  console.log(`\n\x1b[32m[OK] Documentation generated and saved to: ${relSaved}\x1b[0m`);

  if (result.isFallback) {
    if (result.isEmpty) {
      console.log(`${dim}[rapidfire-ai] Empty target detected. Deterministic empty profile generated.${reset}\n`);
    } else {
      console.log(`${dim}[rapidfire-ai] Generated via deterministic static inspection.${reset}`);
      console.log(`${dim}Save your AI API key ("key <token>") for deep AI architectural reasoning.${reset}\n`);
    }
  } else {
    console.log(`${dim}[rapidfire-ai] Analyzed via ${result.model || 'AI'}.${reset}\n`);
  }

  return {
    ...result,
    mdPath: targetMdPath,
    mdFileName: targetMdFileName
  };
}

module.exports = {
  handleExplain,
  renderExplainErrorCard
};
