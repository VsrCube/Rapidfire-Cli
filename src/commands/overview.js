const fs = require('fs');
const path = require('path');
const { generateRepoOverview } = require('../ai/gemini');
const { findRepoRoot, recordOverviewEntry } = require('../utils/repoMemory');
const { formatMarkdownForTerminal, renderTerminalBox } = require('./ask');

async function handleOverview(args = []) {
  const magenta = '\x1b[35m';
  const red = '\x1b[31m';
  const green = '\x1b[32m';
  const reset = '\x1b[0m';
  const dim = '\x1b[2m';

  const tokens = Array.isArray(args) ? args : String(args || '').trim().split(/\s+/).filter(Boolean);

  let isCritic = false;
  const filteredTokens = [];

  for (const token of tokens) {
    const clean = token.toLowerCase().replace(/^-+/, '');
    if (clean === 'critic' || clean === 'cirtic') {
      isCritic = true;
    } else {
      filteredTokens.push(token);
    }
  }

  const rawTarget = filteredTokens.length > 0 ? filteredTokens.join(' ').replace(/^["']|["']$/g, '').trim() : '.';
  const targetPath = path.resolve(process.cwd(), rawTarget);

  if (!fs.existsSync(targetPath)) {
    console.log(`\n${red}[rapidfire] Error: Target repository not found:${reset} ${rawTarget}`);
    console.log(`${dim}Usage: overview [--critic] [folder] (e.g. "overview" or "overview --critic")\n${reset}`);
    return { success: false, error: 'NOT_FOUND' };
  }

  const repoRoot = findRepoRoot(targetPath);
  const displayTarget = path.relative(process.cwd(), targetPath) || '.';
  const modeLabel = isCritic ? 'architectural critique' : 'repository overview';

  console.log(`\n${magenta}[rapidfire-ai] Analyzing ${modeLabel} for: "${displayTarget}"...${reset}\n`);

  const result = await generateRepoOverview(targetPath, { critic: isCritic });

  if (!result || !result.success) {
    console.log(`${red}[rapidfire] Failed to generate overview:${reset} ${result ? result.message : 'Unknown error'}\n`);
    return result;
  }

  const targetDir = fs.statSync(targetPath).isDirectory() ? targetPath : path.dirname(targetPath);
  const mdDir = path.join(targetDir, 'md');
  if (!fs.existsSync(mdDir)) {
    fs.mkdirSync(mdDir, { recursive: true });
  }

  let overviewMdPath = null;
  let criticMdPath = null;

  if (isCritic) {
    criticMdPath = path.join(mdDir, 'overview_critic.md');
    fs.writeFileSync(criticMdPath, result.text, 'utf8');
    recordOverviewEntry(repoRoot, result.text.slice(0, 300), path.relative(repoRoot, criticMdPath) || 'md/overview_critic.md', true);
  } else {
    overviewMdPath = path.join(mdDir, 'overview.md');
    fs.writeFileSync(overviewMdPath, result.text, 'utf8');
    recordOverviewEntry(repoRoot, result.text.slice(0, 300), path.relative(repoRoot, overviewMdPath) || 'md/overview.md', false);
  }

  const boxTitle = isCritic ? 'RapidFire Architectural Critique' : 'RapidFire Repository Overview';
  const formatted = formatMarkdownForTerminal(result.text.trim());
  console.log('\n' + renderTerminalBox(boxTitle, formatted));

  const savedPath = isCritic ? criticMdPath : overviewMdPath;
  const relSaved = path.relative(process.cwd(), savedPath) || path.basename(savedPath);

  if (isCritic) {
    console.log(`\n${green}[OK] Critic report generated and saved to: ${relSaved}${reset}`);
  } else {
    console.log(`\n${green}[OK] Overview generated and saved to: ${relSaved}${reset}`);
  }

  if (result.isFallback) {
    if (result.isEmpty) {
      console.log(`${dim}[rapidfire-ai] Empty repository detected. Deterministic empty profile generated.${reset}\n`);
    } else {
      console.log(`${dim}[rapidfire-ai] Generated via deterministic static inspection.${reset}`);
      console.log(`${dim}Configure an AI API key ("key <token>") for deep semantic architectural reasoning.${reset}\n`);
    }
  } else {
    console.log(`${dim}[rapidfire-ai] Analyzed via ${result.model || 'AI'}.${reset}\n`);
  }

  return {
    ...result,
    isCritic,
    mdPath: savedPath,
    criticMdPath,
    savedPath
  };
}

module.exports = {
  handleOverview
};
