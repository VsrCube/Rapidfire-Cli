const path = require('path');
const fse = require('fs-extra');
const { instructGemini, hasApiKey } = require('../ai/gemini');
const { ensureOrPromptApiKey } = require('./key');
const { commandExists, run } = require('../utils/proc');

const PROTECTED_CONFIG_FILES = new Set([
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'readme.md',
  '.gitignore',
  'tsconfig.json'
]);

function isArchiveRequest(instruction) {
  const lower = (instruction || '').toLowerCase().trim();
  return /\b(?:(?:create|make|build)\s+(?:a\s+)?(?:zip|tar|archive)|zip\s+(?:this\s+)?(?:folder|directory|dir|repo|project)|compress\s+(?:this\s+)?(?:folder|directory|dir|repo|project))\b/i.test(lower);
}

async function handleArchiveCreation(instruction, context = {}) {
  const currentDir = process.cwd();
  const dirName = path.basename(currentDir) || 'project';
  const zipFileName = `${dirName}.zip`;
  const targetZipPath = path.resolve(currentDir, zipFileName);

  console.log(`\n\x1b[36m[rapidfire] Detected archive request for current directory:\x1b[0m ${currentDir}`);
  console.log(`  • Destination: \x1b[32m${zipFileName}\x1b[0m`);
  console.log(`  • Filter: Automatically excluding \x1b[2mnode_modules, .git, dist, .venv, __pycache__\x1b[0m`);

  let answer = 'n';
  const promptText = `\nConfirm creating ZIP archive? (Y/N): `;

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
    console.log('\x1b[33m[rapidfire] Archive creation cancelled.\x1b[0m');
    return { success: false, cancelled: true };
  }

  console.log(`\n\x1b[36m[rapidfire] Compressing directory into ${zipFileName}...\x1b[0m`);

  try {
    const isWindows = process.platform === 'win32';
    if (!isWindows && commandExists('zip')) {
      const zipCmd = `zip -r "${zipFileName}" . -x "node_modules/*" ".git/*" "dist/*" ".venv/*" "__pycache__/*" "*/node_modules/*" "*/.git/*"`;
      run(zipCmd, { cwd: currentDir, stdio: 'pipe' });
    } else if (isWindows) {
      const psCmd = `powershell -NoProfile -Command "Get-ChildItem -Path . -Exclude node_modules,.git,dist,.venv | Compress-Archive -DestinationPath '${zipFileName}' -Force"`;
      run(psCmd, { cwd: currentDir, stdio: 'pipe' });
    } else if (commandExists('tar')) {
      const tarName = `${dirName}.tar.gz`;
      const tarCmd = `tar --exclude='./node_modules' --exclude='./.git' --exclude='./dist' --exclude='./.venv' -czf "${tarName}" .`;
      run(tarCmd, { cwd: currentDir, stdio: 'pipe' });
      const stats = fse.statSync(path.join(currentDir, tarName));
      const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`\x1b[32m[OK] Successfully created archive:\x1b[0m \x1b[1m${tarName}\x1b[0m (${sizeMb} MB)`);
      return { success: true, archive: tarName };
    } else {
      console.error('\x1b[31m[rapidfire] No system archive tool (zip, powershell, tar) available.\x1b[0m');
      return { success: false, error: 'NO_ARCHIVER' };
    }

    if (fse.existsSync(targetZipPath)) {
      const stats = fse.statSync(targetZipPath);
      const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`\x1b[32m[OK] Successfully created archive:\x1b[0m \x1b[1m\x1b[36m${zipFileName}\x1b[0m (${sizeMb} MB)\n`);
      return { success: true, archive: zipFileName, sizeBytes: stats.size };
    } else {
      throw new Error('Archive file was not created.');
    }
  } catch (err) {
    console.error(`\x1b[31m[rapidfire] Failed to create archive:\x1b[0m ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function handleTell(args, context = {}) {
  const instruction = args.join(' ').trim();

  if (!instruction) {
    console.log('\x1b[33m[rapidfire] Usage: tell <instruction>\x1b[0m');
    console.log('Tell Gemini AI to generate code files or execute system operations in your current directory.');
    console.log('Examples:');
    console.log('  • \x1b[36mtell create a zip for this folder\x1b[0m');
    console.log('  • \x1b[36mtell create 2 cpp files named m1 m2\x1b[0m');
    console.log('  • \x1b[36mtell create python script to parse logs and a test file\x1b[0m');
    return;
  }

  // Handle direct operational action: archive / zip
  if (isArchiveRequest(instruction)) {
    return await handleArchiveCreation(instruction, context);
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

  console.log(`\n\x1b[32m[Plan]:\x1b[0m ${result.summary}`);
  console.log(`\x1b[1mProposed files to generate in ${process.cwd()}:\x1b[0m`);

  const sanitizedFiles = [];
  for (const file of result.files) {
    let relativeClean = path.normalize(file.filename).replace(/^(\.\.[\/\\])+/, '');
    const lowerBase = path.basename(relativeClean).toLowerCase();
    const isProtected = PROTECTED_CONFIG_FILES.has(lowerBase);
    const explicitlyRequested = instruction.toLowerCase().includes(lowerBase);

    let targetPath = path.resolve(process.cwd(), relativeClean);

    if (!targetPath.startsWith(process.cwd())) {
      console.warn(`\x1b[33m[WARN] Skipped unsafe file path: ${file.filename}\x1b[0m`);
      continue;
    }

    const exists = fse.existsSync(targetPath);

    if (exists && isProtected && !explicitlyRequested) {
      const ext = path.extname(relativeClean);
      const base = path.basename(relativeClean, ext);
      const dir = path.dirname(relativeClean);
      relativeClean = path.join(dir === '.' ? '' : dir, `${base}.generated${ext}`);
      targetPath = path.resolve(process.cwd(), relativeClean);
      console.log(`  \x1b[33m[PROTECTED] Existing root '${lowerBase}' guarded from overwrite. Renamed output to '${relativeClean}'.\x1b[0m`);
    }

    const stillExists = fse.existsSync(targetPath);
    const lineCount = (file.content.match(/\n/g) || []).length + 1;
    console.log(`  • \x1b[36m${relativeClean}\x1b[0m (${lineCount} lines)${stillExists ? ' \x1b[33m[OVERWRITE]\x1b[0m' : ' \x1b[32m[NEW]\x1b[0m'}`);
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
    console.log(`  \x1b[32m[+] Created:\x1b[0m ${item.relativeClean}`);
  }

  console.log(`\n\x1b[32m[OK] Successfully created ${sanitizedFiles.length} file(s)!\x1b[0m\n`);
  return { success: true, count: sanitizedFiles.length, files: sanitizedFiles };
}

module.exports = {
  handleTell,
  isArchiveRequest
};
