const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');
const { runCapture, commandExists } = require('../utils/proc');

const RULES = [
  {
    ruleId: 'openai-api-key',
    name: 'OpenAI API Key / Token',
    severity: 'CRITICAL',
    pattern: /\b(?:sk-(?:proj-|admin-)?[a-zA-Z0-9_\-]{20,})\b/
  },
  {
    ruleId: 'google-api-key',
    name: 'Google Cloud / Gemini API Key',
    severity: 'CRITICAL',
    pattern: /\b(?:AIza[0-9A-Za-z\-_]{35})\b/
  },
  {
    ruleId: 'aws-access-key-id',
    name: 'AWS Access Key ID',
    severity: 'CRITICAL',
    pattern: /\b(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}\b/
  },
  {
    ruleId: 'aws-secret-access-key',
    name: 'AWS Secret Access Key',
    severity: 'CRITICAL',
    pattern: /(?:aws(?:_|-)?secret(?:_|-)?(?:access)?(?:_|-)?key|aws(?:_|-)?key)\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})["']?/i
  },
  {
    ruleId: 'github-access-token',
    name: 'GitHub Personal / OAuth Access Token',
    severity: 'CRITICAL',
    pattern: /\b(?:ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|ghu_[a-zA-Z0-9]{36}|ghs_[a-zA-Z0-9]{36}|ghr_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59})\b/
  },
  {
    ruleId: 'gitlab-access-token',
    name: 'GitLab Personal Access Token',
    severity: 'CRITICAL',
    pattern: /\b(?:glpat-[a-zA-Z0-9\-_]{20,})\b/
  },
  {
    ruleId: 'slack-token',
    name: 'Slack Bot / User Token',
    severity: 'CRITICAL',
    pattern: /\b(?:xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9\-]*)\b/
  },
  {
    ruleId: 'stripe-secret-key',
    name: 'Stripe Live Secret Key',
    severity: 'CRITICAL',
    pattern: /\b(?:(?:sk|rk)_live_[0-9a-zA-Z]{24,})\b/
  },
  {
    ruleId: 'private-key',
    name: 'Private Encryption Key (RSA/EC/DSA/OPENSSH/PGP)',
    severity: 'CRITICAL',
    pattern: /-----BEGIN (?:(?:RSA|EC|DSA|OPENSSH|PGP|ENCRYPTED)\s+)?PRIVATE KEY(?: BLOCK)?-----/
  },
  {
    ruleId: 'db-connection-string',
    name: 'Database Connection String with Credentials',
    severity: 'CRITICAL',
    pattern: /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s:@]+:[^\s@]+@[^\s/]+\b/i
  },
  {
    ruleId: 'generic-api-key',
    name: 'Generic API Key / High-Entropy Secret Assignment',
    severity: 'HIGH',
    pattern: /(?:api[_-]?key|secret[_-]?key|client[_-]?secret|access[_-]?token|auth[_-]?token|private[_-]?key)\s*[:=]\s*["']([a-zA-Z0-9_\-]{20,})["']/i
  }
];

const IGNORED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp', '.tiff',
  '.mp4', '.mov', '.avi', '.mp3', '.wav', '.flac',
  '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.pyc', '.exe', '.dll', '.so', '.dylib', '.bin',
  '.sqlite', '.sqlite3', '.db'
]);

const IGNORED_FILENAMES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Cargo.lock',
  'poetry.lock',
  'composer.lock',
  'Gemfile.lock',
  'test_secret_shield.js',
  'test_integrations.js',
  'test_push_command.js'
]);

function redactSecret(secret) {
  if (!secret || typeof secret !== 'string') return '';
  const trimmed = secret.trim();
  if (trimmed.length <= 8) {
    return '***';
  }
  const prefix = trimmed.slice(0, Math.min(8, Math.floor(trimmed.length / 3)));
  const suffix = trimmed.slice(-Math.min(4, Math.floor(trimmed.length / 4)));
  return `${prefix}...${suffix}`;
}

function shouldSkipFile(filePath) {
  if (!filePath) return true;
  const basename = path.basename(filePath);
  if (IGNORED_FILENAMES.has(basename)) return true;

  const ext = path.extname(filePath).toLowerCase();
  if (IGNORED_EXTENSIONS.has(ext)) return true;

  const parts = filePath.split(/[/\\]/);
  const ignoredDirs = ['.git', 'node_modules', 'dist', 'build', '.next', 'venv', '.venv', '__pycache__', 'target', '.idea', '.vscode'];
  for (const dir of ignoredDirs) {
    if (parts.includes(dir)) return true;
  }

  return false;
}

function parseDiffForSecrets(diffText) {
  if (!diffText || typeof diffText !== 'string' || !diffText.trim()) {
    return [];
  }

  const findings = [];
  let currentFile = '';
  let currentLine = 0;

  const lines = diffText.split(/\r?\n/);
  for (const rawLine of lines) {
    if (rawLine.startsWith('diff --git a/')) {
      const parts = rawLine.split(' ');
      currentFile = parts[parts.length - 1].replace(/^b\//, '');
      currentLine = 0;
      continue;
    }

    if (rawLine.startsWith('@@ ')) {
      const match = rawLine.match(/\+([0-9]+)/);
      if (match) {
        currentLine = parseInt(match[1], 10) - 1;
      }
      continue;
    }

    if (rawLine.startsWith('+++ ') || rawLine.startsWith('--- ')) {
      continue;
    }

    if (rawLine.startsWith('-')) {
      continue;
    }

    if (rawLine.startsWith('+')) {
      currentLine++;
      if (shouldSkipFile(currentFile)) {
        continue;
      }

      const content = rawLine.slice(1);
      const fileFindings = checkLineForSecrets(content, currentFile, currentLine);
      findings.push(...fileFindings);
    } else {
      currentLine++;
    }
  }

  return findings;
}

function checkLineForSecrets(lineText, filePath, lineNumber) {
  const findings = [];
  if (!lineText || typeof lineText !== 'string') return findings;

  const trimmed = lineText.trim();
  const lower = trimmed.toLowerCase();
  if (lower.includes('rapidfire-ignore') || lower.includes('gitleaks:allow') || lower.includes('nosec')) {
    return findings;
  }
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#') && trimmed.length < 20) {
    if (!trimmed.includes('=') && !trimmed.includes(':')) {
      return findings;
    }
  }

  for (const rule of RULES) {
    const match = trimmed.match(rule.pattern);
    if (match) {
      const secretStr = match[1] || match[0];
      if (rule.ruleId === 'generic-api-key') {
        const lowerSecret = secretStr.toLowerCase();
        const isPlaceholder = [
          'insecure',
          'dummy',
          'placeholder',
          'example',
          'change_me',
          'change-me',
          'your_',
          'your-',
          'my_secret',
          'my-secret',
          'sample',
          'default'
        ].some((kw) => lowerSecret.includes(kw));
        if (isPlaceholder) {
          continue;
        }
      }
      findings.push({
        ruleId: rule.ruleId,
        ruleName: rule.name,
        severity: rule.severity,
        file: filePath || 'unknown',
        line: lineNumber || 1,
        snippet: trimmed,
        secret: secretStr,
        redacted: redactSecret(secretStr)
      });
    }
  }

  return findings;
}

function scanFileContent(content, filePath) {
  if (!content || typeof content !== 'string') return [];
  if (shouldSkipFile(filePath)) return [];

  const findings = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const lineFindings = checkLineForSecrets(lines[i], filePath, i + 1);
    findings.push(...lineFindings);
  }
  return findings;
}

function scanStagedChanges(cwd) {
  const projectDir = cwd || process.cwd();
  try {
    const diff = runCapture('git diff --cached --unified=0', { cwd: projectDir });
    const findings = parseDiffForSecrets(diff);
    return {
      clean: findings.length === 0,
      findings
    };
  } catch (err) {
    return {
      clean: true,
      findings: [],
      error: err.message
    };
  }
}

function scanUnpushedCommits(cwd, targetBranch) {
  const projectDir = cwd || process.cwd();
  try {
    let range = '';
    const branch = targetBranch || 'main';

    let remoteTrackingExists = false;
    try {
      runCapture(`git rev-parse --verify "@{u}"`, { cwd: projectDir });
      remoteTrackingExists = true;
    } catch {}

    if (!remoteTrackingExists) {
      try {
        runCapture(`git rev-parse --verify "origin/${branch}"`, { cwd: projectDir });
        remoteTrackingExists = true;
      } catch {}
    }

    if (remoteTrackingExists) {
      range = `origin/${branch}..HEAD`;
    } else {
      let remoteBranches = '';
      try {
        remoteBranches = runCapture('git branch -r', { cwd: projectDir }).trim();
      } catch {}

      if (remoteBranches.length > 0) {
        range = 'HEAD --not --remotes=origin';
      } else {
        range = '-n 25 HEAD';
      }
    }

    let diff = '';
    try {
      diff = runCapture(`git log -p ${range}`, { cwd: projectDir });
    } catch {
      try {
        diff = runCapture('git log -p -n 10 HEAD', { cwd: projectDir });
      } catch {
        diff = '';
      }
    }

    const findings = parseDiffForSecrets(diff);
    return {
      clean: findings.length === 0,
      findings
    };
  } catch (err) {
    return {
      clean: true,
      findings: [],
      error: err.message
    };
  }
}

function scanDirectory(dirPath, maxFiles = 500) {
  const findings = [];
  let fileCount = 0;

  function walk(currentDir) {
    if (fileCount >= maxFiles) return;
    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (fileCount >= maxFiles) return;
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(dirPath, fullPath);

      if (entry.isDirectory()) {
        if (!shouldSkipFile(relPath)) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        if (!shouldSkipFile(relPath)) {
          fileCount++;
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const fileFindings = scanFileContent(content, relPath);
            findings.push(...fileFindings);
          } catch {}
        }
      }
    }
  }

  walk(dirPath);
  return {
    scannedFiles: fileCount,
    clean: findings.length === 0,
    findings
  };
}

function renderSecurityBanner(findings, action = 'push') {
  const bold = '\x1b[1m';
  const red = '\x1b[31m';
  const yellow = '\x1b[33m';
  const cyan = '\x1b[36m';
  const reset = '\x1b[0m';
  const dim = '\x1b[2m';

  console.log(`\n${bold}${red}╔═════════════════════════════════════════════════════════════════════════════════╗${reset}`);
  console.log(`${bold}${red}║  🚨 [BLOCKED] [rapidfire-security] LEAKED SECRETS DETECTED!                    ║${reset}`);
  console.log(`${bold}${red}╚═════════════════════════════════════════════════════════════════════════════════╝${reset}`);
  console.log(`${bold}Action Blocked:${reset} git ${action.toUpperCase()}`);
  console.log(`${dim}RapidFire Secret Shield stopped this operation to protect your credentials from leaking.${reset}\n`);

  console.log(`${yellow}Detected ${findings.length} credential(s) in outgoing code:${reset}\n`);

  findings.forEach((f, idx) => {
    console.log(`  ${bold}${idx + 1}. [${f.severity || 'CRITICAL'}] ${f.ruleName}${reset}`);
    console.log(`     ${dim}File:${reset}   ${cyan}${f.file}:${f.line}${reset}`);
    console.log(`     ${dim}Secret:${reset} ${red}${f.redacted}${reset}`);
    if (f.snippet) {
      console.log(`     ${dim}Line:${reset}   ${dim}${f.snippet.slice(0, 100)}${reset}`);
    }
    console.log('');
  });

  console.log(`${bold}[ACTION REQUIRED]${reset}`);
  console.log(`  1. Remove or replace these credentials immediately before committing or pushing.`);
  console.log(`  2. Store sensitive API keys in ${cyan}.env${reset} or secret environment managers.`);
  console.log(`  3. If these keys were previously pushed to remote, ${bold}${red}REVOKE AND ROTATE THEM NOW${reset}.\n`);
}

function installSecurityHooks(projectPath) {
  const gitDir = path.join(projectPath, '.git');
  if (!fs.existsSync(gitDir)) {
    return {
      success: false,
      reason: 'no_git_dir',
      message: 'Not a git repository. Run "git init" first.'
    };
  }

  const hooksDir = path.join(gitDir, 'hooks');
  fse.ensureDirSync(hooksDir);

  const scannerModulePath = path.resolve(__dirname, 'secretScanner.js');

  const prePushScript = `#!/bin/sh
# rapidfire-security secret scanner / gitleaks fallback
export PATH="$HOME/.local/bin:$PATH"

z40="0000000000000000000000000000000000000000"
SCAN_RANGES=""

while read -r local_ref local_sha remote_ref remote_sha; do
  if [ "$local_sha" = "$z40" ] || [ -z "$local_sha" ]; then
    continue
  fi

  if [ "$remote_sha" = "$z40" ]; then
    if [ -n "$1" ]; then
      RANGE="$local_sha --not --remotes=$1"
    else
      RANGE="$local_sha"
    fi
  else
    RANGE="$remote_sha..$local_sha"
  fi

  if [ -z "$SCAN_RANGES" ]; then
    SCAN_RANGES="$RANGE"
  else
    SCAN_RANGES="$SCAN_RANGES $RANGE"
  fi
done

if [ -z "$SCAN_RANGES" ]; then
  if git rev-parse --verify --quiet "@{u}" >/dev/null 2>&1; then
    SCAN_RANGES="@{u}..HEAD"
  else
    SCAN_RANGES="-1"
  fi
fi

if command -v node >/dev/null 2>&1; then
  export SCAN_RANGES
  node -e "
    try {
      const { parseDiffForSecrets, renderSecurityBanner } = require('${scannerModulePath.replace(/\\/g, '\\\\')}');
      const { execSync } = require('child_process');
      const range = process.env.SCAN_RANGES || '@{u}..HEAD';
      let diff = '';
      try {
        diff = execSync('git log -p ' + range, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      } catch {
        try {
          diff = execSync('git log -p -1 HEAD', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        } catch {}
      }

      const findings = parseDiffForSecrets(diff);
      if (findings && findings.length > 0) {
        renderSecurityBanner(findings, 'push');
        process.exit(1);
      }
      console.log('[OK] [rapidfire-security] Native Secret Shield: No leaks detected. Push proceeding.');
      process.exit(0);
    } catch (err) {
      if (err.status === 1) process.exit(1);
    }
  "
  STATUS=$?
  if [ $STATUS -ne 0 ]; then
    exit 1
  fi
  exit 0
fi

if command -v gitleaks >/dev/null 2>&1; then
  gitleaks git --log-opts="$SCAN_RANGES" --verbose
  EXIT_CODE=$?
  if [ $EXIT_CODE -ne 0 ]; then
    echo ""
    echo "[BLOCKED] [rapidfire-security] Gitleaks detected sensitive credentials in your commits!"
    exit 1
  fi
  echo "[OK] [rapidfire-security] No leaks detected. Push proceeding."
  exit 0
fi

echo "[rapidfire-security] Warning: Neither Secret Shield nor gitleaks found to scan secrets. Push proceeding."
exit 0
`;

  const preCommitScript = `#!/bin/sh
export PATH="$HOME/.local/bin:$PATH"

if command -v node >/dev/null 2>&1; then
  node -e "
    try {
      const { parseDiffForSecrets, renderSecurityBanner } = require('${scannerModulePath.replace(/\\/g, '\\\\')}');
      const { execSync } = require('child_process');
      const diff = execSync('git diff --cached --unified=0', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const findings = parseDiffForSecrets(diff);
      if (findings && findings.length > 0) {
        renderSecurityBanner(findings, 'commit');
        process.exit(1);
      }
      process.exit(0);
    } catch (err) {
      if (err.status === 1) process.exit(1);
    }
  "
  STATUS=$?
  if [ $STATUS -ne 0 ]; then
    exit 1
  fi
  exit 0
fi

exit 0
`;

  const prePushPath = path.join(hooksDir, 'pre-push');
  const preCommitPath = path.join(hooksDir, 'pre-commit');

  fs.writeFileSync(prePushPath, prePushScript, { mode: 0o755 });
  fs.writeFileSync(preCommitPath, preCommitScript, { mode: 0o755 });

  return {
    success: true,
    prePushPath,
    preCommitPath
  };
}

function verifySecurityHooksInstalled(projectPath) {
  const prePushPath = path.join(projectPath, '.git', 'hooks', 'pre-push');
  return fs.existsSync(prePushPath);
}

module.exports = {
  RULES,
  redactSecret,
  shouldSkipFile,
  checkLineForSecrets,
  scanFileContent,
  parseDiffForSecrets,
  scanStagedChanges,
  scanUnpushedCommits,
  scanDirectory,
  renderSecurityBanner,
  installSecurityHooks,
  verifySecurityHooksInstalled
};
