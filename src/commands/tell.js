const path = require('path');
const fse = require('fs-extra');
const { instructGemini, hasApiKey } = require('../ai/gemini');
const { ensureOrPromptApiKey } = require('./key');

async function handleTell(args, context = {}) {
  const instruction = args.join(' ').trim();

  if (!instruction) {
    console.log('\x1b[33m[rapidfire] Usage: tell <instruction>\x1b[0m');
    console.log('Tell Gemini AI to generate code files and boilerplates in your current directory.');
    console.log('Examples:');
    console.log('  • \x1b[36mtell create 2 cpp files named m1 m2\x1b[0m');
    console.log('  • \x1b[36mtell create python script to parse logs and a test file\x1b[0m');
    console.log('  • \x1b[36mtell create a modern html5 landing page with css styles\x1b[0m');
    return;
  }

  if (!hasApiKey()) {
    await ensureOrPromptApiKey(context);
  }

  console.log(`\n\x1b[36m[rapidfire-ai] Consulting Gemini Free Tier...\x1b[0m`);
  const result = await instructGemini(instruction);

  if (!result || !result.success || !Array.isArray(result.files) || result.files.length === 0) {
    console.error(`\x1b[31m[rapidfire-ai] Failed to generate code files for instruction.\x1b[0m`);
    return;
  }

  console.log(`\n\x1b[32m✔ Plan:\x1b[0m ${result.summary}`);
  console.log(`\x1b[1mProposed files to generate in ${process.cwd()}:\x1b[0m`);

  const sanitizedFiles = [];
  for (const file of result.files) {
    const relativeClean = path.normalize(file.filename).replace(/^(\.\.[\/\\])+/, '');
    const targetPath = path.resolve(process.cwd(), relativeClean);

    if (!targetPath.startsWith(process.cwd())) {
      console.warn(`\x1b[33m⚠ Skipped unsafe file path: ${file.filename}\x1b[0m`);
      continue;
    }

    const exists = fse.existsSync(targetPath);
    const lineCount = (file.content.match(/\n/g) || []).length + 1;
    console.log(`  • \x1b[36m${relativeClean}\x1b[0m (${lineCount} lines)${exists ? ' \x1b[33m[OVERWRITE]\x1b[0m' : ' \x1b[32m[NEW]\x1b[0m'}`);
    sanitizedFiles.push({ relativeClean, targetPath, content: file.content });
  }

  if (sanitizedFiles.length === 0) {
    console.log('\x1b[33m[rapidfire-ai] No valid files to generate.\x1b[0m');
    return;
  }

  let answer = 'n';
  const promptText = `\nConfirm file generation? (Y/N): `;

  if (process.env.RAPIDFIRE_AUTO_CONFIRM === '1') {
    answer = 'y';
  } else if (context && typeof context.ask === 'function') {
    answer = await context.ask(promptText);
  } else if (context && context.rl) {
    answer = await new Promise((resolve) => {
      context.rl.question(promptText, (ans) => resolve(ans));
    });
  } else {
    answer = 'n';
  }

  if (!answer || !answer.trim().toLowerCase().startsWith('y')) {
    console.log('\x1b[33m[rapidfire-ai] File generation cancelled.\x1b[0m');
    return { success: false, cancelled: true };
  }

  console.log(`\n\x1b[32m[rapidfire-ai] Writing files to disk...\x1b[0m`);
  for (const item of sanitizedFiles) {
    fse.ensureDirSync(path.dirname(item.targetPath));
    fse.writeFileSync(item.targetPath, item.content, 'utf8');
    console.log(`  \x1b[32m✔ Created:\x1b[0m ${item.relativeClean}`);
  }

  console.log(`\n\x1b[32m✨ Successfully created ${sanitizedFiles.length} file(s)!\x1b[0m\n`);
  return { success: true, count: sanitizedFiles.length, files: sanitizedFiles };
}

module.exports = {
  handleTell
};
