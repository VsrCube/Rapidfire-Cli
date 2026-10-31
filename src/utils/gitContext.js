const path = require('path');
const fse = require('fs-extra');
const { runCapture } = require('./proc');

function isInsideGitRepo(dir) {
  try {
    const target = fse.existsSync(dir) ? dir : path.dirname(dir);
    const res = runCapture('git rev-parse --is-inside-work-tree', { cwd: target }).trim();
    return res === 'true';
  } catch {
    return false;
  }
}

function getParentGitRepo(targetPath) {
  try {
    const absTarget = path.resolve(targetPath);
    const parentDir = path.dirname(absTarget);
    if (!fse.existsSync(parentDir)) return null;

    const toplevel = runCapture('git rev-parse --show-toplevel', { cwd: parentDir }).trim();
    if (toplevel && path.resolve(toplevel) !== absTarget) {
      if (path.resolve(toplevel) === path.resolve(require('os').homedir())) {
        return null;
      }
      return toplevel;
    }
  } catch {}
  return null;
}

async function promptConfirmation(context, question, defaultChoice = 'n') {
  if (process.env.RAPIDFIRE_AUTO_GIT === '1') return true;
  if (process.env.RAPIDFIRE_AUTO_GIT === '0') return false;

  let answer = defaultChoice;

  if (context && typeof context.ask === 'function') {
    answer = await context.ask(question);
  } else if (context && context.rl) {
    answer = await new Promise((resolve) => {
      context.rl.question(question, (ans) => resolve(ans));
    });
  } else {
    return defaultChoice.toLowerCase().startsWith('y');
  }

  return Boolean(answer && answer.trim().toLowerCase().startsWith('y'));
}

async function promptInput(context, question, defaultValue = '') {
  let answer = '';
  if (context && typeof context.ask === 'function') {
    answer = await context.ask(question);
  } else if (context && context.rl) {
    answer = await new Promise((resolve) => {
      context.rl.question(question, (ans) => resolve(ans));
    });
  } else {
    return defaultValue;
  }

  const trimmed = (answer !== undefined && answer !== null) ? String(answer).trim() : '';
  return trimmed || defaultValue;
}

async function setupGitAndGithub(projectPath, targetFolder, context = {}) {
  try {
    const parentRepo = getParentGitRepo(projectPath);
    if (parentRepo) {
      console.log(`\x1b[33m[rapidfire] Detected parent Git repository at '${parentRepo}'. Skipping nested git init.\x1b[0m`);
      try {
        const { installPrePushHook } = require('../integrations/gitleaks');
        installPrePushHook(parentRepo);
      } catch {}
      return { initialized: false, isNested: true, parentRepo };
    }

    const folderName = targetFolder || path.basename(projectPath);
    const gitPrompt = `\nDo you want to initialize a local Git repository and create a remote GitHub repository for '${folderName}'? [Y/n]: `;

    const isInteractive = Boolean(context && (typeof context.ask === 'function' || context.rl));

    let defaultChoice = 'y';
    if (process.env.RAPIDFIRE_AUTO_GIT === '0') {
      defaultChoice = 'n';
    } else if (process.env.RAPIDFIRE_AUTO_GIT === '1') {
      defaultChoice = 'y';
    }

    let choice = defaultChoice;
    if (process.env.RAPIDFIRE_AUTO_GIT === '0') {
      choice = 'n';
    } else if (process.env.RAPIDFIRE_AUTO_GIT === '1') {
      choice = 'y';
    } else if (isInteractive) {
      const rawAns = await promptInput(context, gitPrompt, defaultChoice);
      choice = rawAns.trim().toLowerCase();
    }

    if (choice.startsWith('n')) {
      console.log('[rapidfire] Skipped Git and GitHub repository creation.');
      return { initialized: false, isNested: false };
    }

    const isLocalOnly = choice === 'local' || choice === 'l' || !isInteractive;

    let repoName = folderName;
    let isPublic = true;

    const { isGhInstalled, isGhAuthenticated, createRepo } = require('../integrations/gh');
    const canDoGh = !isLocalOnly && (isGhInstalled() || isInteractive);

    if (canDoGh && isInteractive) {
      const namePrompt = `GitHub repository name (press Enter for '${folderName}'): `;
      const rawName = await promptInput(context, namePrompt, folderName);
      if (rawName && rawName.trim()) {
        repoName = rawName.trim();
      }

      const visibilityPrompt = `Make repository public? [Y/n]: `;
      const rawVis = await promptInput(context, visibilityPrompt, 'y');
      isPublic = !rawVis.trim().toLowerCase().startsWith('n');
    }

    const { run } = require('./proc');
    if (!fse.existsSync(path.join(projectPath, '.git'))) {
      try {
        run('git init -b main', { cwd: projectPath, stdio: 'ignore' });
      } catch {
        run('git init', { cwd: projectPath, stdio: 'ignore' });
      }
      console.log('[rapidfire] Initialized local git repository.');
    }

    const { installPrePushHook } = require('../integrations/gitleaks');
    const hookResult = installPrePushHook(projectPath);
    if (hookResult && hookResult.success) {
      console.log('\x1b[32m[rapidfire-security] Installed gitleaks pre-push hook in .git/hooks/pre-push\x1b[0m');
    }

    if (!isLocalOnly && process.env.RAPIDFIRE_SKIP_GH !== '1') {
      if (!isGhInstalled()) {
        console.log(`\x1b[33m[rapidfire] GitHub CLI (gh) is not installed. Run "sudo pacman -S github-cli" or install from https://cli.github.com to push to GitHub.\x1b[0m`);
      } else if (!isGhAuthenticated()) {
        console.log(`\x1b[33m[rapidfire] GitHub CLI is not authenticated. Run "gh auth login" in your terminal first.\x1b[0m`);
      } else {
        console.log(`[rapidfire] Creating remote GitHub repository '${repoName}'...`);
        const res = createRepo(projectPath, repoName, !isPublic);
        if (res && res.success) {
          console.log(`\x1b[32m[OK] Remote GitHub repository '${repoName}' created and linked to origin!\x1b[0m`);
        } else if (res) {
          console.log(`\x1b[33m[WARN] Could not create GitHub repository: ${res.message || res.error}\x1b[0m`);
        }
      }
    }

    return { initialized: true, isNested: false, repoName, isPublic };
  } catch (err) {
    console.warn('[rapidfire] Git initialization notice:', err.message);
    return { initialized: false, error: err.message };
  }
}

module.exports = {
  isInsideGitRepo,
  getParentGitRepo,
  promptConfirmation,
  promptInput,
  setupGitAndGithub
};
