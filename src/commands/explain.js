const fs = require('fs');
const path = require('path');
const { explainFile, explainDirectory } = require('../ai/gemini');

/**
 * Handles the 'explain [path]' command in RapidFire REPL
 * Explains a single source file or directory architecture.
 */
async function handleExplain(args) {
  const cyan = '\x1b[36m';
  const green = '\x1b[32m';
  const yellow = '\x1b[33m';
  const magenta = '\x1b[35m';
  const red = '\x1b[31m';
  const bold = '\x1b[1m';
  const reset = '\x1b[0m';
  const dim = '\x1b[2m';

  const rawTarget = args.length > 0 ? args.join(' ').replace(/^["']|["']$/g, '').trim() : '.';
  const targetPath = path.resolve(process.cwd(), rawTarget);

  if (!fs.existsSync(targetPath)) {
    console.log(`\n${red}[rapidfire] Error: Target does not exist:${reset} ${rawTarget}`);
    console.log(`${dim}Usage: explain [file|folder] (e.g. "explain src/repl.js" or "explain .")\n${reset}`);
    return { success: false, error: 'NOT_FOUND' };
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
    console.log(`${red}[rapidfire] Failed to explain target:${reset} ${result ? result.message : 'Unknown error'}\n`);
    return result;
  }

  // Print explanation
  console.log(result.text);

  if (result.isFallback) {
    console.log(`\n${dim}[rapidfire-ai] Generated via deterministic static inspection.${reset}`);
    console.log(`${dim}Save your AI API key ("key <token>") for deep AI architectural reasoning.${reset}\n`);
  } else {
    console.log(`\n${dim}[rapidfire-ai] Analyzed via ${result.model || 'AI'}.${reset}\n`);
  }

  return result;
}

module.exports = {
  handleExplain
};
