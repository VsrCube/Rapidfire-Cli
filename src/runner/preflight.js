const path = require('path');
const fs = require('fs');
const {
  commandExists,
  getToolInstallHint,
  getRustInstallInstructions,
  getGoInstallInstructions,
  getDotnetInstallInstructions,
  getRubyInstallInstructions,
  getPhpInstallInstructions
} = require('../utils/proc');

function resolvePythonCmd(dir) {
  const candidateVenvs = [
    path.join(dir, 'venv'),
    path.join(dir, '.venv'),
    path.join(dir, '..', 'venv'),
    path.join(dir, '..', '.venv')
  ];

  for (const venvDir of candidateVenvs) {
    if (fs.existsSync(venvDir)) {
      const isWin = process.platform === 'win32';
      const venvPy = isWin
        ? path.join(venvDir, 'Scripts', 'python.exe')
        : path.join(venvDir, 'bin', 'python');
      if (fs.existsSync(venvPy)) {
        return venvPy;
      }
    }
  }

  return process.platform === 'win32' ? 'python' : 'python3';
}

function auditService(svc, rootDir) {
  if (!svc) return { ok: true };

  const relPath = path.relative(rootDir, svc.dir) || '.';
  const tierName = svc.tierName || (relPath === '.' ? (svc.pkg && svc.pkg.name ? `Project (${svc.pkg.name})` : (svc.flavor || svc.ecosystem ? `Project (${svc.flavor || svc.ecosystem})` : 'Project')) : relPath);
  const issues = [];

  if (svc.jsonSyntaxError) {
    issues.push({
      tier: tierName,
      missing: 'Valid package.json syntax',
      fix: `Correct the JSON syntax error in package.json (${svc.jsonSyntaxError})`
    });
  }

  if (svc.ecosystem === 'node') {
    if (!commandExists('node')) {
      issues.push({
        tier: tierName,
        missing: 'Node.js runtime',
        fix: 'Please install Node.js from https://nodejs.org'
      });
    } else if (!svc.hasNodeModules && (svc.scriptName || svc.entryFile)) {
      issues.push({
        tier: tierName,
        missing: 'node_modules',
        fix: relPath === '.' ? 'npm install' : `cd ${relPath} && npm install`
      });
    }
  } else if (svc.ecosystem === 'python') {
    if (!commandExists('python') && !commandExists('python3') && !commandExists('py')) {
      issues.push({
        tier: tierName,
        missing: 'Python interpreter',
        fix: 'Please install Python from https://www.python.org/downloads/'
      });
    } else if (svc.hasRequirements && !svc.hasVenv) {
      const venvCmd = process.platform === 'win32'
        ? 'python -m venv venv && .\\venv\\Scripts\\activate && pip install -r requirements.txt'
        : 'python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt';
      issues.push({
        tier: tierName,
        missing: 'Python virtual environment (venv)',
        fix: relPath === '.' ? venvCmd : `cd ${relPath} && ${venvCmd}`
      });
    }
  } else if (svc.ecosystem === 'rust') {
    if (!commandExists('cargo')) {
      issues.push({
        tier: tierName,
        missing: 'Rust toolchain (cargo)',
        fix: getRustInstallInstructions()
      });
    }
  } else if (svc.ecosystem === 'go') {
    if (!commandExists('go')) {
      issues.push({
        tier: tierName,
        missing: 'Go toolchain (go)',
        fix: getGoInstallInstructions()
      });
    }
  } else if (svc.ecosystem === 'dotnet') {
    if (!commandExists('dotnet')) {
      issues.push({
        tier: tierName,
        missing: '.NET SDK (dotnet)',
        fix: getDotnetInstallInstructions()
      });
    }
  } else if (svc.ecosystem === 'ruby') {
    if (!commandExists('ruby')) {
      issues.push({
        tier: tierName,
        missing: 'Ruby runtime (ruby)',
        fix: getRubyInstallInstructions()
      });
    }
  } else if (svc.ecosystem === 'php') {
    if (!commandExists('php')) {
      issues.push({
        tier: tierName,
        missing: 'PHP CLI runtime (php)',
        fix: getPhpInstallInstructions()
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues
  };
}

function auditPreflight(projectPlan) {
  if (!projectPlan || projectPlan.type === 'unstructured') {
    return { ok: true, errors: [] };
  }

  const allIssues = [];

  if (projectPlan.type === 'fullstack') {
    if (projectPlan.frontend) {
      const feAudit = auditService(projectPlan.frontend, projectPlan.targetDir);
      if (!feAudit.ok) allIssues.push(...feAudit.issues);
    }
    if (projectPlan.backend) {
      const beAudit = auditService(projectPlan.backend, projectPlan.targetDir);
      if (!beAudit.ok) allIssues.push(...beAudit.issues);
    }
  } else if (projectPlan.type === 'single' && projectPlan.service) {
    const singleAudit = auditService(projectPlan.service, projectPlan.targetDir);
    if (!singleAudit.ok) allIssues.push(...singleAudit.issues);
  }

  return {
    ok: allIssues.length === 0,
    errors: allIssues
  };
}

function formatPreflightErrorCard(errors) {
  const red = '\x1b[31m';
  const yellow = '\x1b[33m';
  const cyan = '\x1b[36m';
  const reset = '\x1b[0m';
  const bold = '\x1b[1m';

  let output = `\n${red}${bold}[rapidfire-run] Error: Cannot start application due to missing dependencies.${reset}\n\n`;

  for (const err of errors) {
    output += `  ${cyan}${bold}${err.tier}:${reset}\n`;
    output += `    ${yellow}Missing:${reset} ${err.missing}\n`;
    output += `    ${cyan}Fix:${reset}     ${err.fix}\n\n`;
  }

  output += `${yellow}Resolve the dependencies above and run 'run' again.${reset}\n`;
  return output;
}

module.exports = {
  auditPreflight,
  auditService,
  formatPreflightErrorCard,
  resolvePythonCmd
};
