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

module.exports = {
  isInsideGitRepo,
  getParentGitRepo,
  promptConfirmation
};
