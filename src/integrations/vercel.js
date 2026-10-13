const { commandExists, run } = require('../utils/proc');

function isVercelInstalled() {
  return commandExists('vercel');
}

function deployFrontend(frontendPath) {
  if (!isVercelInstalled()) {
    return {
      success: false,
      reason: 'not_installed',
      message: 'Vercel CLI is not installed. Run "npm install -g vercel" and "vercel login" to deploy.'
    };
  }

  try {
    console.log(`[rapidfire] Deploying frontend to Vercel (--prod) from ${frontendPath}...`);
    run('vercel --prod', { cwd: frontendPath });
    return {
      success: true
    };
  } catch (err) {
    return {
      success: false,
      reason: 'deploy_failed',
      error: err.message
    };
  }
}

module.exports = {
  isVercelInstalled,
  deployFrontend
};
