const path = require('path');
const { run, runCapture } = require('../utils/proc');
const { isGhInstalled, isGhAuthenticated, createRepo } = require('../integrations/gh');
const { installPrePushHook } = require('../integrations/gitleaks');
const { promptConfirmation } = require('../utils/gitContext');

function parseTokensWithQuotes(input) {
  const raw = Array.isArray(input) ? input.join(' ') : (input || '');
  const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
  const tokens = [];
  let match;
  while ((match = regex.exec(raw)) !== null) {
    tokens.push(match[1] !== undefined ? match[1] : (match[2] !== undefined ? match[2] : match[0]));
  }
  return tokens;
}

function parsePushArgs(input) {
  const tokens = parseTokensWithQuotes(input);
  let files = [];
  let branch = null;
  let message = null;

  let pushIdx = tokens.findIndex((t) => t.toLowerCase() === 'push');
  if (pushIdx === -1) {
    pushIdx = 0;
  }

  const prePush = tokens.slice(0, pushIdx);
  if (prePush.length > 0) {
    let fileCandidates = [];
    if (prePush[0].toLowerCase() === 'git' && prePush[1]?.toLowerCase() === 'add') {
      fileCandidates = prePush.slice(2);
    } else if (prePush[0].toLowerCase() === 'add') {
      fileCandidates = prePush.slice(1);
    }
    if (fileCandidates.length > 0) {
      files.push(...fileCandidates);
    }
  }

  const postPush = tokens.slice(pushIdx + 1);

  const hasExplicitCommitFlag = postPush.some((t) => {
    const l = t.toLowerCase();
    return (
      l === '-commit' ||
      l === '--commit' ||
      l === '-message' ||
      l === '--message' ||
      l.startsWith('-commit=') ||
      l.startsWith('--commit=') ||
      l.startsWith('-message=') ||
      l.startsWith('--message=')
    );
  });

  let i = 0;
  while (i < postPush.length) {
    const token = postPush[i];
    const lower = token.toLowerCase();

    if (
      lower === '-b' ||
      lower === '-branch' ||
      lower === '--branch' ||
      lower === '-brach' ||
      lower === '--brach' ||
      lower === '-branchname' ||
      lower === '--branchname'
    ) {
      if (i + 1 < postPush.length && !postPush[i + 1].startsWith('-')) {
        branch = postPush[i + 1];
        i += 2;
        continue;
      }
    } else if (
      lower.startsWith('-b=') ||
      lower.startsWith('-branch=') ||
      lower.startsWith('--branch=') ||
      lower.startsWith('-brach=') ||
      lower.startsWith('--brach=')
    ) {
      branch = token.split('=')[1];
      i++;
      continue;
    } else if (lower === '-main' || lower === '--main') {
      branch = 'main';
      i++;
      continue;
    } else if (lower === '-master' || lower === '--master') {
      branch = 'master';
      i++;
      continue;
    } else if (token.startsWith('-') && i + 1 < postPush.length && postPush[i + 1].toLowerCase() === 'branch') {
      branch = token.replace(/^-+/, '');
      i += 2;
      continue;
    } else if (/^-+(?:branch|brach)(\d+)$/i.test(token)) {
      const num = token.match(/^-+(?:branch|brach)(\d+)$/i)[1];
      branch = `branch${num}`;
      i++;
      continue;
    } else if (/^-+b(\d+)$/i.test(token)) {
      const num = token.match(/^-+b(\d+)$/i)[1];
      branch = `branch${num}`;
      i++;
      continue;
    } else if (/^-+(?:branch|brach)[-_](.+)$/i.test(token)) {
      branch = token.match(/^-+(?:branch|brach)[-_](.+)$/i)[1];
      i++;
      continue;
    } else if (lower === '-m') {
      if (hasExplicitCommitFlag) {
        branch = 'main';
        i++;
        continue;
      } else if (i + 1 < postPush.length && !postPush[i + 1].startsWith('-')) {
        message = postPush[i + 1];
        i += 2;
        continue;
      } else {
        branch = 'main';
        i++;
        continue;
      }
    }

    if (lower === '-commit' || lower === '--commit' || lower === '-message' || lower === '--message') {
      if (i + 1 < postPush.length && !postPush[i + 1].startsWith('-')) {
        message = postPush[i + 1];
        i += 2;
        continue;
      }
    } else if (
      lower.startsWith('-commit=') ||
      lower.startsWith('--commit=') ||
      lower.startsWith('-message=') ||
      lower.startsWith('--message=')
    ) {
      message = token.split('=')[1];
      i++;
      continue;
    } else if (lower.startsWith('-m=')) {
      const val = token.split('=')[1];
      if (hasExplicitCommitFlag || val.toLowerCase() === 'main') {
        branch = 'main';
      } else {
        message = val;
      }
      i++;
      continue;
    }

    if (!token.startsWith('-')) {
      files.push(token);
    }

    i++;
  }

  if (files.length === 0) {
    files = ['.'];
  }

  return {
    files,
    branch,
    message
  };
}

async function handlePush(rawArgs, context = {}) {
  const cyan = '\x1b[36m';
  const green = '\x1b[32m';
  const yellow = '\x1b[33m';
  const red = '\x1b[31m';
  const reset = '\x1b[0m';
  const bold = '\x1b[1m';
  const dim = '\x1b[2m';

  const cwd = context.cwd || process.cwd();
  const parsed = parsePushArgs(rawArgs);

  let inGit = false;
  try {
    const res = runCapture('git rev-parse --is-inside-work-tree', { cwd });
    inGit = res.trim() === 'true';
  } catch {}

  if (!inGit) {
    console.log(`\n${yellow}[rapidfire-git] No Git repository found in current directory.${reset}`);
    const initPrompt = `${bold}Would you like to initialize a new Git repository now? (Y/N):${reset} `;

    const isInteractive = Boolean(context && (typeof context.ask === 'function' || context.rl));
    const defaultChoice = isInteractive ? 'n' : (process.env.RAPIDFIRE_AUTO_GIT === '1' ? 'y' : 'n');
    const shouldInit = await promptConfirmation(context, initPrompt, defaultChoice);

    if (!shouldInit) {
      console.error(`${red}[rapidfire-git] Push aborted: working directory is not a Git repository.${reset}`);
      return { success: false, aborted: true, error: 'Not a git repository' };
    }

    console.log(`${cyan}[rapidfire-git] Initializing git repository (main branch)...${reset}`);
    try {
      run('git init -b main', { cwd, stdio: 'ignore' });
    } catch {
      run('git init', { cwd, stdio: 'ignore' });
    }
    installPrePushHook(cwd);
  }

  let currentBranch = 'main';
  try {
    currentBranch = runCapture('git branch --show-current', { cwd }).trim() || 'main';
  } catch {}

  const targetBranch = parsed.branch || currentBranch;
  if (parsed.branch && parsed.branch !== currentBranch) {
    let branchExists = false;
    try {
      runCapture(`git rev-parse --verify "${parsed.branch}"`, { cwd });
      branchExists = true;
    } catch {}

    try {
      if (branchExists) {
        try {
          run(`git checkout "${parsed.branch}"`, { cwd, stdio: 'ignore' });
        } catch {
          let stashed = false;
          try {
            const stashRes = runCapture('git stash create', { cwd }).trim();
            if (stashRes) {
              run('git stash push -u -m "rapidfire-switch"', { cwd, stdio: 'ignore' });
              stashed = true;
            }
            run(`git checkout "${parsed.branch}"`, { cwd, stdio: 'ignore' });
            if (stashed) {
              run('git stash pop', { cwd, stdio: 'ignore' });
            }
          } catch (stErr) {
            if (stashed) {
              try { run('git stash pop', { cwd, stdio: 'ignore' }); } catch {}
            }
            throw stErr;
          }
        }
      } else {
        run(`git checkout -b "${parsed.branch}"`, { cwd, stdio: 'ignore' });
      }
      console.log(`${cyan}[rapidfire-git] Switched to branch:${reset} ${targetBranch}`);
    } catch (checkoutErr) {
      console.error(`${red}[rapidfire-git] Failed to switch branch:${reset} ${checkoutErr.message}`);
    }
  }

  const addTarget = parsed.files.map((f) => `"${f}"`).join(' ');
  console.log(`\n${cyan}[rapidfire-git] Staging files:${reset} git add ${parsed.files.join(' ')}`);
  try {
    run(`git add ${addTarget}`, { cwd });
  } catch (addErr) {
    console.error(`${red}[rapidfire-git] Staging failed:${reset} ${addErr.message}`);
    return { success: false, error: addErr.message };
  }

  let commitMessage = parsed.message;
  if (!commitMessage) {
    if (context.ask && typeof context.ask === 'function') {
      try {
        const answer = await context.ask('Enter commit message: ');
        commitMessage = answer?.trim();
      } catch {}
    }
    if (!commitMessage) {
      commitMessage = 'Update project files via RapidFire CLI';
    }
  }

  let commitMade = false;
  let statusOutput = '';
  try {
    statusOutput = runCapture('git status --porcelain', { cwd }).trim();
  } catch {}

  if (statusOutput.length > 0) {
    console.log(`${cyan}[rapidfire-git] Committing:${reset} "${commitMessage}"`);
    try {
      const sanitizedMsg = commitMessage.replace(/"/g, '\\"');
      run(`git commit -m "${sanitizedMsg}"`, { cwd });
      commitMade = true;
    } catch (commitErr) {
      console.error(`${red}[rapidfire-git] Commit failed:${reset} ${commitErr.message}`);
      return { success: false, error: commitErr.message };
    }
  } else {
    console.log(`${dim}[rapidfire-git] Working tree clean; no uncommitted changes found to commit.${reset}`);
  }

  let hasRemote = false;
  try {
    const remotes = runCapture('git remote', { cwd }).trim();
    hasRemote = remotes.split(/\r?\n/).some((r) => r.trim() === 'origin');
  } catch {}

  if (!hasRemote) {
    console.log(`\n${yellow}[rapidfire-git] No remote repository 'origin' linked.${reset}`);
    if (isGhInstalled() && isGhAuthenticated()) {
      const folderName = path.basename(cwd);
      console.log(`${cyan}[rapidfire-git] Creating GitHub repository '${folderName}' via GitHub CLI...${reset}`);
      const repoRes = createRepo(cwd, folderName, false);
      if (repoRes.success) {
        hasRemote = true;
        console.log(`${green}[OK] GitHub repository created and linked to origin!${reset}`);
      } else {
        console.error(`${red}[rapidfire-git] Could not create GitHub repository: ${repoRes.message || repoRes.error}${reset}`);
        return { success: false, error: 'REPO_CREATION_FAILED' };
      }
    } else if (!isGhInstalled()) {
      console.log(`${dim}Tip: Install GitHub CLI (gh) to enable automatic remote repo creation, or link manually:${reset}`);
      console.log(`  git remote add origin <your-repo-url>`);
      return { success: false, error: 'NO_REMOTE' };
    } else {
      console.log(`${dim}Tip: Run "gh auth login" to authenticate GitHub CLI, or link manually:${reset}`);
      console.log(`  git remote add origin <your-repo-url>`);
      return { success: false, error: 'GH_UNAUTHENTICATED' };
    }
  }

  console.log(`${cyan}[rapidfire-git] Pushing to origin/${targetBranch}...${reset}`);

  let remoteBranchExists = false;
  try {
    runCapture(`git rev-parse --verify "origin/${targetBranch}"`, { cwd });
    remoteBranchExists = true;
  } catch {}

  let unpushedCommitsCount = 0;
  if (remoteBranchExists) {
    try {
      const count = runCapture(`git rev-list --count "origin/${targetBranch}..HEAD"`, { cwd }).trim();
      unpushedCommitsCount = parseInt(count, 10) || 0;
    } catch {}
  }

  try {
    run(`git push -u origin "${targetBranch}"`, { cwd });
    if (commitMade) {
      console.log(`\n${green}${bold}[OK] Successfully committed and pushed to origin/${targetBranch}!${reset}\n`);
    } else if (!remoteBranchExists) {
      console.log(`\n${green}${bold}[OK] Successfully pushed new branch to origin/${targetBranch}!${reset}\n`);
    } else if (unpushedCommitsCount > 0) {
      console.log(`\n${green}${bold}[OK] Successfully pushed unpushed commits to origin/${targetBranch}!${reset}\n`);
    } else {
      console.log(`\n${cyan}${bold}[OK] origin/${targetBranch} is already up to date (no new changes to push).${reset}\n`);
    }
    return {
      success: true,
      branch: targetBranch,
      commitMade,
      message: commitMessage
    };
  } catch (pushErr) {
    const errText = (pushErr.message || '') + (pushErr.stderr || '');
    if (errText.includes('non-fast-forward') || errText.includes('fetch first') || errText.includes('behind')) {
      console.log(`\n${yellow}[rapidfire-git] Remote origin/${targetBranch} has newer commits. Syncing via git pull --rebase...${reset}`);
      try {
        run(`git pull --rebase origin "${targetBranch}"`, { cwd });
        console.log(`${cyan}[rapidfire-git] Retrying push to origin/${targetBranch}...${reset}`);
        run(`git push -u origin "${targetBranch}"`, { cwd });
        console.log(`\n${green}${bold}[OK] Successfully synced and pushed to origin/${targetBranch}!${reset}\n`);
        return {
          success: true,
          branch: targetBranch,
          commitMade,
          message: commitMessage
        };
      } catch (syncErr) {
        console.error(`\n${red}[rapidfire-git] Automatic sync failed:${reset} ${syncErr.message}\n`);
      }
    }
    console.error(`\n${red}[rapidfire-git] Push error:${reset} ${pushErr.message}\n`);
    return {
      success: false,
      error: pushErr.message
    };
  }
}

module.exports = {
  parseTokensWithQuotes,
  parsePushArgs,
  handlePush
};
