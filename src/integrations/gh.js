const { commandExists, run, runCapture } = require('../utils/proc');

function isGhInstalled() {
  return commandExists('gh');
}

function isGhAuthenticated() {
  if (process.env.RAPIDFIRE_SKIP_GH === '1') return false;
  if (!isGhInstalled()) return false;
  try {
    runCapture('gh auth status');
    return true;
  } catch {
    return false;
  }
}

function createRepo(projectPath, repoName, isPrivate = false) {
  if (!isGhInstalled()) {
    return {
      success: false,
      reason: 'not_installed',
      message: 'GitHub CLI (gh) is not installed. Run: sudo pacman -S github-cli (or install from https://cli.github.com)'
    };
  }

  if (!isGhAuthenticated()) {
    return {
      success: false,
      reason: 'unauthenticated',
      message: 'GitHub CLI is not authenticated. Please run "gh auth login" in your terminal first.'
    };
  }

  let hasCommits = false;
  try {
    runCapture('git rev-parse --verify HEAD', { cwd: projectPath });
    hasCommits = true;
  } catch {
    hasCommits = false;
  }

  if (!hasCommits) {
    try {
      run('git add -A', { cwd: projectPath, stdio: 'pipe' });
      let hasAuthor = false;
      try {
        const authorName = runCapture('git config user.name', { cwd: projectPath }).trim();
        const authorEmail = runCapture('git config user.email', { cwd: projectPath }).trim();
        hasAuthor = Boolean(authorName && authorEmail);
      } catch {}
      const commitCmd = hasAuthor
        ? 'git commit -m "Initial commit via RapidFire CLI"'
        : 'git -c user.name="Rapidfire" -c user.email="rapidfire@local" commit -m "Initial commit via RapidFire CLI"';
      run(commitCmd, { cwd: projectPath, stdio: 'pipe' });
      hasCommits = true;
    } catch (commitErr) {
      console.warn('\x1b[33m[rapidfire] Initial commit notice:\x1b[0m', commitErr.message);
    }
  }

  const visibilityFlag = isPrivate ? '--private' : '--public';
  const pushFlag = hasCommits ? '--push' : '--remote=origin';
  const cmd = `gh repo create "${repoName}" ${visibilityFlag} --source=. ${pushFlag}`;

  try {
    console.log(`[rapidfire] Creating GitHub repository '${repoName}'...`);
    run(cmd, { cwd: projectPath });
    return {
      success: true,
      repoName
    };
  } catch (err) {
    const errMsg = err.message || '';
    if (errMsg.includes('already exists')) {
      try {
        const repoView = runCapture(`gh repo view "${repoName}" --json sshUrl,url`, { cwd: projectPath });
        const parsed = JSON.parse(repoView);
        const remoteUrl = parsed.sshUrl || parsed.url;
        if (remoteUrl) {
          try {
            run(`git remote add origin "${remoteUrl}"`, { cwd: projectPath, stdio: 'ignore' });
          } catch {
            run(`git remote set-url origin "${remoteUrl}"`, { cwd: projectPath, stdio: 'ignore' });
          }
          if (hasCommits) {
            try {
              run('git push -u origin main', { cwd: projectPath, stdio: 'pipe' });
            } catch {}
          }
          return {
            success: true,
            repoName,
            message: `Linked to existing remote repository '${repoName}'`
          };
        }
      } catch {}
    }

    if (hasCommits && pushFlag === '--push') {
      try {
        run(`gh repo create "${repoName}" ${visibilityFlag} --source=. --remote=origin`, { cwd: projectPath });
        try {
          run('git push -u origin main', { cwd: projectPath, stdio: 'pipe' });
        } catch {}
        return {
          success: true,
          repoName
        };
      } catch {}
    }

    return {
      success: false,
      reason: 'creation_failed',
      error: err.message
    };
  }
}

module.exports = {
  isGhInstalled,
  isGhAuthenticated,
  createRepo
};
