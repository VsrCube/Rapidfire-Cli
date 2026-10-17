const fs = require('fs');
const path = require('path');
const os = require('os');
const { runCapture } = require('./proc');

const DEFAULT_MEMORY_SCHEMA = {
  schemaVersion: 1,
  repoName: '',
  repoPath: '',
  createdAt: '',
  lastUpdated: '',
  conversations: [],
  explanations: [],
  overviews: []
};

function findRepoRoot(startDir = process.cwd()) {
  const home = path.resolve(os.homedir());
  try {
    const gitRoot = runCapture('git rev-parse --show-toplevel', { cwd: startDir }).trim();
    if (gitRoot && fs.existsSync(gitRoot) && path.resolve(gitRoot) !== home) {
      return path.resolve(gitRoot);
    }
  } catch {}

  let current = path.resolve(startDir);
  const root = path.parse(current).root;

  while (current && current !== root && current !== home) {
    if (
      fs.existsSync(path.join(current, '.git')) ||
      fs.existsSync(path.join(current, 'package.json')) ||
      fs.existsSync(path.join(current, '.rapidfire.json')) ||
      fs.existsSync(path.join(current, 'pyproject.toml')) ||
      fs.existsSync(path.join(current, 'requirements.txt')) ||
      fs.existsSync(path.join(current, 'Cargo.toml'))
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return path.resolve(startDir);
}

function getMemoryDbPath(repoRoot) {
  return path.join(repoRoot, '.rapidfire', 'memory.json');
}

function ensureGitignoreProtected(repoRoot) {
  const gitDir = path.join(repoRoot, '.git');
  if (!fs.existsSync(gitDir)) return;

  const gitignorePath = path.join(repoRoot, '.gitignore');
  const ignoreEntry = '.rapidfire/';

  try {
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      if (!content.includes('.rapidfire')) {
        const separator = content.endsWith('\n') || content.length === 0 ? '' : '\n';
        fs.appendFileSync(gitignorePath, `${separator}${ignoreEntry}\n`, 'utf8');
      }
    } else {
      fs.writeFileSync(gitignorePath, `${ignoreEntry}\n`, 'utf8');
    }
  } catch {}
}

function getRepoName(repoRoot) {
  try {
    const pkgPath = path.join(repoRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.name) return pkg.name;
    }
  } catch {}
  return path.basename(repoRoot);
}

function initRepoDatabase(repoRoot = findRepoRoot()) {
  const rfDir = path.join(repoRoot, '.rapidfire');
  if (!fs.existsSync(rfDir)) {
    fs.mkdirSync(rfDir, { recursive: true });
  }

  ensureGitignoreProtected(repoRoot);

  const dbPath = getMemoryDbPath(repoRoot);
  if (!fs.existsSync(dbPath)) {
    const initialData = {
      ...DEFAULT_MEMORY_SCHEMA,
      repoName: getRepoName(repoRoot),
      repoPath: repoRoot,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2), 'utf8');
    return initialData;
  }

  return loadRepoMemory(repoRoot);
}

function loadRepoMemory(repoRoot = findRepoRoot()) {
  const dbPath = getMemoryDbPath(repoRoot);
  if (!fs.existsSync(dbPath)) {
    return initRepoDatabase(repoRoot);
  }

  try {
    const raw = fs.readFileSync(dbPath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_MEMORY_SCHEMA,
      ...parsed,
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
      explanations: Array.isArray(parsed.explanations) ? parsed.explanations : [],
      overviews: Array.isArray(parsed.overviews) ? parsed.overviews : []
    };
  } catch {
    return initRepoDatabase(repoRoot);
  }
}

function saveRepoMemory(repoRoot = findRepoRoot(), memoryData = {}) {
  const rfDir = path.join(repoRoot, '.rapidfire');
  if (!fs.existsSync(rfDir)) {
    fs.mkdirSync(rfDir, { recursive: true });
  }

  ensureGitignoreProtected(repoRoot);

  const dbPath = getMemoryDbPath(repoRoot);
  const dataToSave = {
    ...DEFAULT_MEMORY_SCHEMA,
    ...memoryData,
    repoName: memoryData.repoName || getRepoName(repoRoot),
    repoPath: repoRoot,
    lastUpdated: new Date().toISOString()
  };

  const tempPath = `${dbPath}.tmp.${Date.now()}`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(dataToSave, null, 2), 'utf8');
    fs.renameSync(tempPath, dbPath);
    return true;
  } catch (err) {
    try {
      fs.writeFileSync(dbPath, JSON.stringify(dataToSave, null, 2), 'utf8');
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      return true;
    } catch {
      return false;
    }
  }
}

function recordConversationTurn(repoRoot = findRepoRoot(), userQuery, aiResponse) {
  const memory = loadRepoMemory(repoRoot);
  const turnId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  memory.conversations.push({
    id: turnId,
    timestamp: now,
    user: userQuery,
    response: aiResponse,
    model: aiResponse
  });

  if (memory.conversations.length > 50) {
    memory.conversations = memory.conversations.slice(-50);
  }

  saveRepoMemory(repoRoot, memory);
  return memory;
}

function getConversationTurns(repoRoot = findRepoRoot(), limit = 10) {
  const memory = loadRepoMemory(repoRoot);
  const turns = memory.conversations.slice(-limit);
  const formatted = [];

  for (const t of turns) {
    if (t.user) {
      formatted.push({ role: 'user', parts: [{ text: t.user }] });
    }
    if (t.response) {
      formatted.push({ role: 'model', parts: [{ text: t.response }] });
    }
  }

  return formatted;
}

function recordExplanationEntry(repoRoot = findRepoRoot(), target, summary, docPath) {
  const memory = loadRepoMemory(repoRoot);
  const entry = {
    id: `exp_${Date.now()}`,
    timestamp: new Date().toISOString(),
    target,
    summary,
    docPath
  };

  memory.explanations.push(entry);
  if (memory.explanations.length > 25) {
    memory.explanations = memory.explanations.slice(-25);
  }

  saveRepoMemory(repoRoot, memory);
  return entry;
}

function recordOverviewEntry(repoRoot = findRepoRoot(), summary, docPath, isCritic = false) {
  const memory = loadRepoMemory(repoRoot);
  const entry = {
    id: `ovw_${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: isCritic ? 'critic' : 'overview',
    summary,
    docPath
  };

  if (!Array.isArray(memory.overviews)) {
    memory.overviews = [];
  }
  memory.overviews.push(entry);
  if (memory.overviews.length > 25) {
    memory.overviews = memory.overviews.slice(-25);
  }

  saveRepoMemory(repoRoot, memory);
  return entry;
}

function clearRepoMemory(repoRoot = findRepoRoot()) {
  const memory = loadRepoMemory(repoRoot);
  memory.conversations = [];
  saveRepoMemory(repoRoot, memory);
  return true;
}

module.exports = {
  findRepoRoot,
  getMemoryDbPath,
  initRepoDatabase,
  loadRepoMemory,
  saveRepoMemory,
  recordConversationTurn,
  getConversationTurns,
  recordExplanationEntry,
  recordOverviewEntry,
  clearRepoMemory
};
