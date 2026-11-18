const path = require('path');
const fs = require('fs');
const {
  isVercelInstalled,
  deployFrontend,
  getVercelUser,
  isVercelAuthenticated,
  getVercelExecutable
} = require('../integrations/vercel');
const { runCapture } = require('../utils/proc');
const { promptConfirmation } = require('../utils/gitContext');

function renderDeployAuthCard(exe = 'vercel') {
  const bold = '\x1b[1m';
  const yellow = '\x1b[33m';
  const cyan = '\x1b[36m';
  const green = '\x1b[32m';
  const reset = '\x1b[0m';

  console.log(`\n${bold}${yellow}╔══════════════════════════════════════════════════════════════════╗${reset}`);
  console.log(`${bold}${yellow}║             VERCEL AUTHENTICATION REQUIRED                       ║${reset}`);
  console.log(`${bold}${yellow}╚══════════════════════════════════════════════════════════════════╝${reset}\n`);
  console.log(`  To enable one-click deployments without logging in during your demo:`);
  console.log(`    1. In your terminal, run: ${cyan}${exe} login${reset}`);
  console.log(`    2. Authenticate once via your browser (or export ${cyan}VERCEL_TOKEN=<token>${reset}).`);
  console.log(`    3. After login, return here and run: ${green}deploy${reset}\n`);
}

function renderDeployErrorCard(title, details, suggestions = []) {
  const bold = '\x1b[1m';
  const red = '\x1b[31m';
  const yellow = '\x1b[33m';
  const cyan = '\x1b[36m';
  const reset = '\x1b[0m';

  const cardTitle = (title || 'DEPLOYMENT ERROR').slice(0, 60);
  console.log(`\n${bold}${red}╔══════════════════════════════════════════════════════════════════╗${reset}`);
  console.log(`${bold}${red}║  ${cardTitle.padEnd(62)}  ║${reset}`);
  console.log(`${bold}${red}╚══════════════════════════════════════════════════════════════════╝${reset}\n`);

  if (details) {
    console.log(`  \x1b[31m${details}\x1b[0m\n`);
  }

  if (suggestions && suggestions.length > 0) {
    console.log(`${bold}${yellow}Remediation & Next Steps:${reset}`);
    for (const s of suggestions) {
      console.log(`  ${cyan}• ${s}${reset}`);
    }
    console.log();
  }
}

function parseDeployArgs(args = []) {
  let provider = 'vercel';
  let targetFolder = null;
  const remaining = [];

  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    const lower = token.toLowerCase();
    if (lower === 'vercel') {
      provider = 'vercel';
    } else if (!token.startsWith('-')) {
      remaining.push(token);
    }
  }

  if (remaining.length > 0) {
    targetFolder = remaining[0];
  }

  return {
    provider,
    targetFolder
  };
}

function detectDeployTarget(rootDir) {
  let detectedType = 'unknown';
  let hasBackend = false;
  let backendPath = null;
  let deployPath = rootDir;

  const candidateTiers = [
    { fe: 'frontend', be: 'backend' },
    { fe: 'client', be: 'server' },
    { fe: 'ui', be: 'api' },
    { fe: 'web', be: 'api' }
  ];

  for (const tier of candidateTiers) {
    const feDir = path.join(rootDir, tier.fe);
    const beDir = path.join(rootDir, tier.be);
    if (fs.existsSync(feDir) && fs.existsSync(beDir)) {
      hasBackend = true;
      backendPath = beDir;
      deployPath = feDir;
      detectedType = 'fullstack';
      break;
    }
  }

  if (!hasBackend) {
    const backendSub = path.join(rootDir, 'backend');
    const frontendSub = path.join(rootDir, 'frontend');
    if (fs.existsSync(backendSub)) {
      hasBackend = true;
      backendPath = backendSub;
      if (fs.existsSync(frontendSub)) {
        deployPath = frontendSub;
        detectedType = 'fullstack';
      }
    } else if (fs.existsSync(frontendSub)) {
      deployPath = frontendSub;
    }
  }

  const pkgJsonPath = path.join(deployPath, 'package.json');
  const indexHtmlPath = path.join(deployPath, 'index.html');
  const publicIndexHtmlPath = path.join(deployPath, 'public', 'index.html');
  const hasPkg = fs.existsSync(pkgJsonPath);
  const hasHtml = fs.existsSync(indexHtmlPath) || fs.existsSync(publicIndexHtmlPath);

  let pkg = null;
  if (hasPkg) {
    try {
      pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    } catch {}
  }

  if (detectedType !== 'fullstack') {
    if (hasPkg) {
      detectedType = 'frontend';
    } else if (hasHtml) {
      detectedType = 'static';
    } else {
      detectedType = 'unknown';
    }
  }

  return {
    detectedType,
    hasBackend,
    backendPath,
    deployPath,
    hasPkg,
    hasHtml,
    pkg
  };
}

async function handleDeploy(args = [], context = {}) {
  const bold = '\x1b[1m';
  const green = '\x1b[32m';
  const cyan = '\x1b[36m';
  const yellow = '\x1b[33m';
  const red = '\x1b[31m';
  const dim = '\x1b[2m';
  const reset = '\x1b[0m';

  const parsed = parseDeployArgs(args);

  let rawTarget = process.cwd();
  if (parsed.targetFolder) {
    rawTarget = path.resolve(process.cwd(), parsed.targetFolder);
  }

  if (!fs.existsSync(rawTarget)) {
    renderDeployErrorCard(
      'ERROR: TARGET DIRECTORY NOT FOUND',
      `Target directory does not exist: ${rawTarget}`,
      [
        'deploy vercel                        (deploy current directory)',
        'deploy vercel <folder>               (deploy specific directory)',
        'deploy ./frontend                    (deploy isolated frontend tier)'
      ]
    );
    return { success: false, error: 'Target directory does not exist' };
  }

  // 1. Target Detection
  const targetInfo = detectDeployTarget(rawTarget);
  const {
    detectedType,
    hasBackend,
    backendPath,
    deployPath,
    hasPkg,
    hasHtml,
    pkg
  } = targetInfo;

  console.log(`\n${bold}${cyan}[rapidfire-deploy] Project Target Detection:${reset}`);
  if (detectedType === 'fullstack') {
    console.log(`  ${green}✔ Type:${reset} Fullstack Application`);
    console.log(`  ${cyan}• Frontend tier (deployment target):${reset} ${path.relative(process.cwd(), deployPath) || '.'}`);
    console.log(`  ${yellow}• Backend tier (isolated):${reset}          ${path.relative(process.cwd(), backendPath)}`);
  } else if (detectedType === 'frontend') {
    console.log(`  ${green}✔ Type:${reset} Frontend Application (${pkg?.name || 'node-frontend'})`);
    console.log(`  ${cyan}• Directory:${reset} ${path.relative(process.cwd(), deployPath) || '.'}`);
  } else if (detectedType === 'static') {
    console.log(`  ${green}✔ Type:${reset} Static HTML / Web Site`);
    console.log(`  ${cyan}• Directory:${reset} ${path.relative(process.cwd(), deployPath) || '.'}`);
  } else {
    console.log(`  ${yellow}⚠ Type:${reset} Unstructured / Generic Directory`);
    console.log(`  ${yellow}Warning: No package.json or index.html found in ${deployPath}.${reset}`);
  }

  // 2. Preflight Checks
  console.log(`\n${bold}${cyan}[rapidfire-deploy] Preflight Checks:${reset}`);

  // Build Script Verification
  let buildScript = null;
  if (hasPkg && pkg && pkg.scripts && pkg.scripts.build) {
    buildScript = pkg.scripts.build;
    console.log(`  ${green}✔ Build script verified:${reset} npm run build ("${buildScript}")`);
  } else if (hasPkg) {
    console.log(`  ${yellow}⚠ Build script notice:${reset} No "build" script in package.json (Vercel zero-config static/serve mode)`);
  } else if (hasHtml) {
    console.log(`  ${green}✔ Build script verified:${reset} Static site (zero-configuration build)`);
  } else {
    console.log(`  ${yellow}⚠ Build script notice:${reset} No build configuration detected`);
  }

  // Git uncommitted changes check
  let gitStatus = '';
  try {
    gitStatus = runCapture('git status --porcelain', { cwd: deployPath }).trim();
  } catch {
    try {
      gitStatus = runCapture('git status --porcelain', { cwd: rawTarget }).trim();
    } catch {}
  }

  if (gitStatus.length > 0) {
    console.log(`  ${yellow}⚠ Git tree status:${reset} Working tree contains uncommitted changes or untracked files:`);
    const preview = gitStatus.split(/\r?\n/).slice(0, 5).map((l) => `    ${l}`).join('\n');
    console.log(preview);
    if (gitStatus.split(/\r?\n/).length > 5) {
      console.log(`    ... and more`);
    }
  } else {
    console.log(`  ${green}✔ Git tree status:${reset} Clean working tree`);
  }

  // Confirmation prompt (unless automated)
  if (process.env.RAPIDFIRE_AUTO_DEPLOY !== '1') {
    const confirmed = await promptConfirmation(context, `\n${bold}Confirm Vercel deployment? (Y/N): ${reset}`, 'y');
    if (!confirmed) {
      console.log(`\n${yellow}[rapidfire-deploy] Deployment aborted by developer.${reset}\n`);
      return { success: false, aborted: true };
    }
  }

  // 3. Vercel CLI Verification
  if (!isVercelInstalled()) {
    renderDeployErrorCard(
      'VERCEL CLI NOT FOUND',
      'Vercel CLI or npx executable is not installed or not in PATH.',
      [
        'npm install -g vercel                  (install Vercel CLI globally)',
        'Ensure Node.js and npx are installed in your PATH',
        'Type "help deploy" for deployment requirements'
      ]
    );
    return { success: false, error: 'Vercel CLI not found' };
  }

  // 4. Authentication Check
  if (!isVercelAuthenticated()) {
    renderDeployAuthCard(getVercelExecutable());
    return { success: false, reason: 'unauthenticated', error: 'Vercel authentication required' };
  }

  const vercelUser = getVercelUser();
  if (vercelUser) {
    console.log(`  ${green}✔ Authenticated as:${reset} ${cyan}${vercelUser}${reset}`);
  }

  // 5. Execution
  console.log(`\n${cyan}[rapidfire-deploy] Deploying frontend from:${reset} ${deployPath}`);
  console.log(`${cyan}[rapidfire-deploy] Contacting Vercel deployment engine...${reset}`);

  const result = deployFrontend(deployPath);

  if (result.success) {
    console.log(`\n${bold}${green}╔════════════════════════════════════════════════════════════════╗${reset}`);
    console.log(`${bold}${green}║                    DEPLOYMENT SUCCESSFUL                       ║${reset}`);
    if (result.url) {
      console.log(`${bold}${green}║  Live URL: ${cyan}${result.url.padEnd(51)}${green}║${reset}`);
    } else {
      console.log(`${bold}${green}║  Live URL: Check your Vercel Dashboard for live domain         ║${reset}`);
    }
    console.log(`${bold}${green}╚════════════════════════════════════════════════════════════════╝${reset}\n`);

    if (hasBackend) {
      console.log(`${yellow}[INFO] [rapidfire-deploy] Notice: Backend directory detected at '${path.relative(process.cwd(), backendPath)}'.${reset}`);
      console.log(`${yellow}  Rapidfire deploy deployed only the frontend tier to Vercel.${reset}`);
      console.log(`${yellow}  Your backend was NOT deployed. Deploy it separately to Render, Railway, or serverless.${reset}\n`);
    }
    return {
      success: true,
      url: result.url,
      type: detectedType,
      targetDir: deployPath,
      hasBackend,
      buildScriptVerified: Boolean(buildScript || hasHtml)
    };
  } else {
    if (result.reason === 'unauthenticated') {
      renderDeployAuthCard(getVercelExecutable());
    } else {
      console.error(`\n${red}[rapidfire-deploy] Deployment failed:${reset}`, result.error || result.message);
      if (result.stderr) console.error(result.stderr);
    }
    return { success: false, reason: result.reason, error: result.error || result.message };
  }
}

module.exports = {
  parseDeployArgs,
  detectDeployTarget,
  renderDeployAuthCard,
  renderDeployErrorCard,
  handleDeploy
};
