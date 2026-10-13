const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

/**
 * Handles the 'deploy' command in Rapidfire.
 * Automatically locates frontend root, deploys via Vercel,
 * extracts the live production URL, and prints a formatted banner.
 *
 * @param {string[]} args Optional target folder
 */
async function handleDeploy(args = []) {
  const bold = '\x1b[1m';
  const green = '\x1b[32m';
  const cyan = '\x1b[36m';
  const yellow = '\x1b[33m';
  const red = '\x1b[31m';
  const reset = '\x1b[0m';

  let targetDir = process.cwd();

  if (args.length > 0) {
    targetDir = path.resolve(process.cwd(), args[0]);
  }

  const rootDir = targetDir;
  let hasBackend = false;
  const backendSub = path.join(rootDir, 'backend');
  if (fs.existsSync(backendSub)) {
    hasBackend = true;
  }

  // If target folder contains a 'frontend' subfolder with package.json, deploy that
  const frontendSub = path.join(rootDir, 'frontend');
  if (fs.existsSync(path.join(frontendSub, 'package.json'))) {
    targetDir = frontendSub;
  }

  if (!fs.existsSync(targetDir)) {
    console.error(`\n${red}[rapidfire-deploy] Target directory does not exist: ${targetDir}${reset}`);
    return;
  }

  const pkgJsonPath = path.join(targetDir, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) {
    console.log(`\n${yellow}[rapidfire-deploy] Warning: No package.json found in ${targetDir}.${reset}`);
    console.log(`Make sure you are deploying a frontend project folder (e.g. setup react+node).`);
  }

  console.log(`\n${cyan}[rapidfire-deploy] Deploying frontend from:${reset} ${targetDir}`);
  console.log(`${cyan}[rapidfire-deploy] Contacting Vercel deployment engine...${reset}`);

  try {
    // Run npx vercel in non-interactive production mode
    const output = execSync('npx --yes vercel --prod --yes', {
      cwd: targetDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120000
    });

    // Extract live deployment URL from output
    const match = output.match(/https:\/\/[a-zA-Z0-9.-]+\.vercel\.app/i) || output.match(/https:\/\/[a-zA-Z0-9.-]+/);
    const liveUrl = match ? match[0] : null;

    console.log(`\n${bold}${green}╔════════════════════════════════════════════════════════════════╗${reset}`);
    console.log(`${bold}${green}║                    DEPLOYMENT SUCCESSFUL                       ║${reset}`);
    if (liveUrl) {
      console.log(`${bold}${green}║  Live URL: ${cyan}${liveUrl.padEnd(51)}${green}║${reset}`);
    } else {
      console.log(`${bold}${green}║  Live URL: Check your Vercel Dashboard for live domain         ║${reset}`);
    }
    console.log(`${bold}${green}╚════════════════════════════════════════════════════════════════╝${reset}\n`);

    if (hasBackend) {
      console.log(`${yellow}ℹ [rapidfire-deploy] Notice: Backend directory detected at '${backendSub}'.${reset}`);
      console.log(`${yellow}  Rapidfire deploy deployed only the frontend to Vercel.${reset}`);
      console.log(`${yellow}  Your backend was NOT deployed. Deploy it separately to Render, Railway, or serverless.${reset}\n`);
    }

  } catch (err) {
    const combinedMsg = (err.stdout || '') + (err.stderr || '') + (err.message || '');

    // Check if error is due to not being logged in
    if (combinedMsg.includes('login') || combinedMsg.includes('authentication') || combinedMsg.includes('Not authenticated') || combinedMsg.includes('credential')) {
      console.log(`\n${yellow}╔════════════════════════════════════════════════════════════════╗${reset}`);
      console.log(`${yellow}║             VERCEL AUTHENTICATION REQUIRED                     ║${reset}`);
      console.log(`${yellow}╚════════════════════════════════════════════════════════════════╝${reset}`);
      console.log(`To enable one-click deployments without logging in during your demo:`);
      console.log(`  1. In your terminal, run: ${cyan}npx vercel login${reset}`);
      console.log(`  2. Authenticate once via your browser.`);
      console.log(`  3. After login, return here and run: ${green}deploy${reset}\n`);
    } else {
      console.error(`\n${red}[rapidfire-deploy] Deployment failed:${reset}`, err.message);
      if (err.stderr) console.error(err.stderr);
    }
  }
}

module.exports = {
  handleDeploy
};
