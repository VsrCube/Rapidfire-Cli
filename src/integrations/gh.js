const { commandExists, run, runCapture } = require('../utils/proc');

function isGhInstalled() {
  return commandExists('gh');
}

function isGhAuthenticated() {
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

  const visibilityFlag = isPrivate ? '--private' : '--public';
  const cmd = `gh repo create "${repoName}" ${visibilityFlag} --source=. --push`;

  try {
    console.log(`[rapidfire] Creating GitHub repository '${repoName}'...`);
    run(cmd, { cwd: projectPath });
    return {
      success: true,
      repoName
    };
  } catch (err) {
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
