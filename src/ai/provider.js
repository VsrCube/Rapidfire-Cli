const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getUserConfig } = require('../utils/configPath');
const {
  findRepoRoot,
  getConversationTurns,
  recordConversationTurn,
  clearRepoMemory
} = require('../utils/repoMemory');
const { buildRepoContext } = require('../utils/repoContext');

const SUPPORTED_STACKS = [
  'react+fastapi',
  'react+django',
  'react+node',
  'vue+fastapi',
  'vue+node',
  'vue+django',
  'react+flask',
  'svelte+node',
  'react',
  'vue',
  'svelte',
  'fastapi',
  'django'
];

let askHistory = [];

function clearAskHistory(targetRoot) {
  askHistory = [];
  try {
    const root = targetRoot || findRepoRoot(process.cwd());
    if (root) clearRepoMemory(root);
  } catch {}
}

function getAskHistory(targetRoot) {
  try {
    const root = targetRoot || findRepoRoot(process.cwd());
    const persisted = getConversationTurns(root, 20);
    if (persisted && persisted.length > 0) {
      return persisted;
    }
  } catch {}
  return askHistory;
}

function detectProvider(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return { provider: 'gemini', model: 'gemini-2.5-flash', name: 'Gemini' };
  }

  const key = apiKey.trim();

  if (key.startsWith('gsk_')) {
    return {
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      endpoint: 'https://api.groq.com/openai/v1',
      name: 'Groq'
    };
  }

  if (key.startsWith('sk-')) {
    return {
      provider: 'openai',
      model: 'gpt-4o-mini',
      endpoint: 'https://api.openai.com/v1',
      name: 'OpenAI'
    };
  }

  return {
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    endpoint: 'https://generativelanguage.googleapis.com',
    name: 'Gemini'
  };
}

function readEnvFileKey() {
  const envPath = path.join(__dirname, '..', '..', '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/^(?:AI_API_KEY|OPENAI_API_KEY|GROQ_API_KEY|GEMINI_API_KEY|RAPIDFIRE_API_KEY)=["']?([^"'\r\n]+)["']?/m);
      if (match && match[1]) {
        return match[1].trim();
      }
    } catch {}
  }
  return null;
}

function getApiKey() {
  const userConfig = getUserConfig();
  if (userConfig) {
    if (userConfig.apiKey) return userConfig.apiKey;
    if (userConfig.geminiApiKey) return userConfig.geminiApiKey;
  }

  if (process.env.AI_API_KEY) return process.env.AI_API_KEY;
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY;
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (process.env.RAPIDFIRE_API_KEY) return process.env.RAPIDFIRE_API_KEY;

  const envKey = readEnvFileKey();
  if (envKey) return envKey;

  return null;
}

function hasApiKey() {
  return Boolean(getApiKey());
}

function getActiveAiConfig() {
  const key = getApiKey();
  const detected = detectProvider(key);

  const userConfig = getUserConfig() || {};
  const activeProvider = userConfig.provider || detected.provider;
  const activeModel = userConfig.model || detected.model;

  let source = 'Not configured';
  if (userConfig.apiKey || userConfig.geminiApiKey) {
    source = '~/.rapidfire/config.json';
  } else if (process.env.AI_API_KEY || process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.RAPIDFIRE_API_KEY) {
    source = 'Environment variable';
  } else if (readEnvFileKey()) {
    source = '.env file';
  }

  return {
    apiKey: key,
    provider: activeProvider,
    model: activeModel,
    name: detected.name || activeProvider,
    endpoint: detected.endpoint,
    source
  };
}

async function retryOperation(fn, retries = 2, delay = 800) {
  let lastError;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < retries) {
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

function sendOpenAiRequest({ endpoint, apiKey, model, messages, systemInstruction }) {
  return new Promise((resolve, reject) => {
    try {
      const fullUrl = new URL(`${endpoint.replace(/\/+$/, '')}/chat/completions`);
      const payloadMessages = [];
      if (systemInstruction) {
        payloadMessages.push({ role: 'system', content: systemInstruction });
      }
      payloadMessages.push(...messages);

      const body = JSON.stringify({
        model,
        messages: payloadMessages,
        temperature: 0.7
      });

      const options = {
        hostname: fullUrl.hostname,
        port: fullUrl.port || (fullUrl.protocol === 'https:' ? 443 : 80),
        path: fullUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: 25000
      };

      const client = fullUrl.protocol === 'https:' ? https : http;
      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(data);
              const text = parsed.choices?.[0]?.message?.content || '';
              resolve(text);
            } catch (jsonErr) {
              reject(new Error(`Failed to parse AI response: ${jsonErr.message}`));
            }
          } else {
            let errorMsg = `HTTP ${res.statusCode}`;
            try {
              const errParsed = JSON.parse(data);
              errorMsg = errParsed.error?.message || errorMsg;
            } catch {}
            reject(new Error(`AI Provider Error (${res.statusCode}): ${errorMsg}`));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('AI request timed out.'));
      });

      req.write(body);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function queryGemini({ apiKey, modelName, prompt, systemInstruction, history = [], isChat = false }) {
  const genAI = new GoogleGenerativeAI(apiKey);

  if (isChat) {
    const historyToUse = history.slice(-10);
    try {
      const model = genAI.getGenerativeModel({
        model: modelName || 'gemini-2.5-flash',
        systemInstruction
      });
      const chat = model.startChat({ history: historyToUse });
      const result = await chat.sendMessage(prompt);
      const response = await result.response;
      return response.text();
    } catch {
      const fallbackModel = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction
      });
      const chat = fallbackModel.startChat({ history: historyToUse });
      const result = await chat.sendMessage(prompt);
      const response = await result.response;
      return response.text();
    }
  }

  try {
    const model = genAI.getGenerativeModel({
      model: modelName || 'gemini-2.5-flash',
      systemInstruction
    });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch {
    const fallbackModel = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction
    });
    const result = await fallbackModel.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }
}

async function queryAi({ prompt, systemInstruction, history = [], isChat = false }) {
  const config = getActiveAiConfig();
  if (!config.apiKey) {
    throw new Error('NO_API_KEY');
  }

  if (config.provider === 'openai' || config.provider === 'groq' || config.provider === 'custom') {
    const messages = [];
    if (isChat && history.length > 0) {
      for (const h of history) {
        messages.push({
          role: h.role === 'model' ? 'assistant' : h.role,
          content: h.parts?.[0]?.text || h.content || ''
        });
      }
    }
    messages.push({ role: 'user', content: prompt });

    return retryOperation(() => sendOpenAiRequest({
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      model: config.model,
      messages,
      systemInstruction
    }));
  }

  return retryOperation(() => queryGemini({
    apiKey: config.apiKey,
    modelName: config.model,
    prompt,
    systemInstruction,
    history,
    isChat
  }));
}

function formatErrorMessage(err) {
  const msg = err.message || String(err);
  if (msg.includes('fetch failed') || msg.includes('ENOTFOUND') || msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED')) {
    return 'Network connection to AI API failed or timed out. Please verify your internet connection.';
  }
  if (msg.includes('API_KEY_INVALID') || msg.includes('invalid api key') || msg.includes('401')) {
    return 'AI API key is invalid or unauthorized. Please verify your credentials with "key status" or "key <new_key>".';
  }
  return `AI query failed: ${msg.split('\n')[0]}`;
}

async function askAI(question, options = {}) {
  const config = getActiveAiConfig();
  if (!config.apiKey) {
    return {
      success: false,
      error: 'NO_API_KEY',
      message: 'AI API key is not configured. Set your key with "key <api_key>" or set AI_API_KEY in environment.'
    };
  }

  const isChat = options.isChat !== false;
  const repoRoot = (options && options.repoRoot) ? options.repoRoot : findRepoRoot(process.cwd());
  const repoContext = buildRepoContext(repoRoot, question);
  const persistedHistory = isChat ? getConversationTurns(repoRoot, 10) : [];
  const activeHistory = isChat ? ((persistedHistory && persistedHistory.length > 0) ? persistedHistory : askHistory) : [];

  const systemInstruction = options.systemInstruction || `You are the in-terminal developer assistant for Rapidfire CLI with complete context of the local repository "${repoContext.repoName}".

[CURRENT REPOSITORY ARCHITECTURE & CONTEXT]
${repoContext.summary}

CRITICAL OPERATIONAL RULES:
1. REPO-SPECIFIC INQUIRIES: When asked about this repository, architecture, files, commands, setup, or workflow:
   - Provide direct, senior-engineer architectural insights.
   - Core Focus: What the product DOES, how data flows from user input to execution, and how modules are organized.
   - For overview questions ("how does this repo work" or "what does this repo do"), structure the response into 4 distinct, concise sections:
     1. Executive Summary: What problem this project solves in 1-2 punchy sentences.
     2. Architecture & Data Flow: How user input flows from entrypoint to router, handlers, and external tools/PTY.
     3. Key Components: Concrete roles of key directories and modules (e.g. commands, scaffolding, ai, integrations).
     4. Developer Quickstart: Exact commands to run locally, execute tests, and configure.
   - ZERO TEXTBOOK FILLER: Never explain generic programming mechanics (e.g. do not explain that Node uses process.argv, or what fs/fs-extra is). Treat the user as an experienced engineer who wants project-specific architecture.
   - Keep answers structured with short bullet points, code blocks where helpful, and concise line lengths.
2. GENERAL INQUIRIES: If the user asks a general question unrelated to this repository (e.g. general syntax, algorithms, or external tools), answer directly, concisely, and practically as an expert coding assistant without forcing repository context.
3. Clean Terminal Output: Provide concise, high-signal explanations with markdown code blocks where helpful. Never output emojis.`;

  try {
    const text = await queryAi({
      prompt: question,
      systemInstruction,
      history: activeHistory,
      isChat
    });

    if (isChat) {
      recordConversationTurn(repoRoot, question, text);
      askHistory.push({ role: 'user', parts: [{ text: question }] });
      askHistory.push({ role: 'model', parts: [{ text }] });
    }

    return {
      success: true,
      text,
      model: config.model,
      provider: config.name,
      repoName: repoContext.repoName
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      message: formatErrorMessage(err)
    };
  }
}

function fallbackStackSelector(description) {
  const desc = (description || '').toLowerCase();
  if (desc.includes('fastapi') || desc.includes('async') || desc.includes('swagger') || desc.includes('machine learning') || desc.includes('ai')) {
    return {
      stack: 'react+fastapi',
      reason: 'Optimal modern stack combining React with high-speed async FastAPI endpoints.'
    };
  }
  if (desc.includes('django') || desc.includes('orm') || desc.includes('admin panel')) {
    return {
      stack: 'react+django',
      reason: 'Django backend provides battle-tested ORM and admin management paired with React.'
    };
  }
  if (desc.includes('vue')) {
    return {
      stack: 'vue+node',
      reason: 'Vue 3 with Node Express is a lightweight, productive full-stack solution.'
    };
  }
  if (desc.includes('svelte')) {
    return {
      stack: 'svelte+node',
      reason: 'Svelte provides blazing fast reactivity paired with Express Node backend.'
    };
  }
  if (desc.includes('flask')) {
    return {
      stack: 'react+flask',
      reason: 'Flask microservices with React frontend for flexible API endpoints.'
    };
  }
  if (desc.includes('backend only') || desc.includes('standalone api')) {
    return {
      stack: 'fastapi',
      reason: 'FastAPI provides standalone async APIs with automatic interactive docs.'
    };
  }
  return {
    stack: 'react+node',
    reason: 'Full-stack JavaScript environment with Vite React and Express Node.js.'
  };
}

async function suggestStack(description) {
  const config = getActiveAiConfig();
  if (!config.apiKey) {
    const heuristic = fallbackStackSelector(description);
    return {
      success: true,
      stack: heuristic.stack,
      reason: heuristic.reason,
      fallbackUsed: true
    };
  }

  const prompt = `The user wants to build a project with this description: "${description}".
You are the Rapidfire CLI stack selector. You MUST choose exactly ONE of the following 13 supported recipes:
1. "react+fastapi" (Vite React frontend + Python FastAPI: high-performance async APIs, modern AI/ML apps, auto Swagger /docs)
2. "react+django" (Vite React frontend + Django REST backend: complex relational data, admin panels, Django ORM)
3. "react+node" (Vite React frontend + Express Node.js backend: full-stack JavaScript, real-time apps, REST APIs)
4. "vue+fastapi" (Vite Vue 3 frontend + Python FastAPI: lightweight Vue frontend with high-speed async FastAPI)
5. "vue+node" (Vite Vue 3 frontend + Express Node.js backend: Vue 3 composition API with Node backend)
6. "vue+django" (Vite Vue 3 frontend + Django REST backend: Vue 3 frontend paired with Django backend)
7. "react+flask" (Vite React frontend + Python Flask: lightweight Python web microservices)
8. "svelte+node" (Vite Svelte frontend + Express Node.js backend: high-performance reactive UI + Express API)
9. "react" (Standalone React 18 LTS frontend with Vite)
10. "vue" (Standalone Vue 3 LTS frontend with Vite)
11. "svelte" (Standalone Svelte frontend with Vite)
12. "fastapi" (Standalone Python FastAPI backend with Uvicorn and Swagger docs)
13. "django" (Standalone Django LTS REST framework backend)

Respond with ONLY a valid JSON object in this exact format, with no markdown code blocks:
{"stack": "recipe_name", "reason": "brief 1-sentence reason"}`;

  try {
    const raw = await queryAi({
      prompt,
      systemInstruction: 'You are the expert software architect assistant for RapidFire CLI. You must strictly output valid JSON only.'
    });

    const cleanJson = raw.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (parsed.stack && SUPPORTED_STACKS.includes(parsed.stack)) {
      return {
        success: true,
        stack: parsed.stack,
        reason: parsed.reason || 'Optimal architecture for your specified project requirements.'
      };
    }

    const heuristic = fallbackStackSelector(description);
    return {
      success: true,
      stack: heuristic.stack,
      reason: heuristic.reason
    };
  } catch {
    const heuristic = fallbackStackSelector(description);
    return {
      success: true,
      stack: heuristic.stack,
      reason: heuristic.reason
    };
  }
}

function fallbackInstructGenerator(instruction) {
  const text = (instruction || '').trim();
  const lower = text.toLowerCase();

  let ext = '.txt';
  let defaultLang = 'text';

  if (/\b(?:cpp|c\+\+|cplusplus)\b/.test(lower)) {
    ext = '.cpp';
    defaultLang = 'cpp';
  } else if (/\b(?:python|py)\b/.test(lower)) {
    ext = '.py';
    defaultLang = 'python';
  } else if (/\b(?:javascript|js)\b/.test(lower)) {
    ext = '.js';
    defaultLang = 'js';
  } else if (/\b(?:typescript|ts)\b/.test(lower)) {
    ext = '.ts';
    defaultLang = 'ts';
  } else if (/\b(?:html|webpage)\b/.test(lower)) {
    ext = '.html';
    defaultLang = 'html';
  } else if (/\b(?:css|styles)\b/.test(lower)) {
    ext = '.css';
    defaultLang = 'css';
  } else if (/\b(?:c)\b/.test(lower) && !/\b(?:cpp|c\+\+)\b/.test(lower)) {
    ext = '.c';
    defaultLang = 'c';
  }

  const namedMatch = text.match(/named\s+([^,.;\n]+)/i);
  let names = [];

  if (namedMatch) {
    const rawNames = namedMatch[1].trim();
    names = rawNames
      .split(/(?:\s+and\s+|\s*,\s*|\s+)/i)
      .map((n) => n.trim())
      .filter((n) => n && !['and', '&', 'a', 'the'].includes(n.toLowerCase()));
  }

  if (names.length === 0) {
    const numMatch = text.match(/\b(\d+)\b/);
    const count = numMatch ? Math.min(parseInt(numMatch[1], 10), 5) : 1;
    for (let i = 1; i <= count; i++) {
      names.push(`file${i}`);
    }
  }

  const files = names.map((rawName) => {
    const hasExt = path.extname(rawName).length > 0;
    const filename = hasExt ? rawName : `${rawName}${ext}`;
    const baseName = path.basename(filename, path.extname(filename));

    let content = '';
    if (defaultLang === 'cpp' || filename.endsWith('.cpp')) {
      content = `#include <iostream>\n\nint main() {\n    std::cout << "Running ${baseName}..." << std::endl;\n    return 0;\n}\n`;
    } else if (defaultLang === 'c' || filename.endsWith('.c')) {
      content = `#include <stdio.h>\n\nint main() {\n    printf("Running ${baseName}...\\n");\n    return 0;\n}\n`;
    } else if (defaultLang === 'python' || filename.endsWith('.py')) {
      content = `def main():\n    print("Running ${baseName}...")\n\nif __name__ == "__main__":\n    main()\n`;
    } else if (defaultLang === 'js' || filename.endsWith('.js')) {
      content = `console.log("Running ${baseName}...");\n`;
    } else if (defaultLang === 'ts' || filename.endsWith('.ts')) {
      content = `const moduleName: string = "${baseName}";\nconsole.log(\`Running \${moduleName}...\`);\n`;
    } else if (defaultLang === 'html' || filename.endsWith('.html')) {
      content = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>${baseName}</title>\n</head>\n<body>\n  <h1>${baseName}</h1>\n</body>\n</html>\n`;
    } else {
      content = `// ${baseName}\n`;
    }

    return { filename, content };
  });

  return {
    summary: `Created ${files.length} file(s) for instruction: "${text}"`,
    files
  };
}

async function instructAI(instruction) {
  const config = getActiveAiConfig();
  if (!config.apiKey) {
    const fallback = fallbackInstructGenerator(instruction);
    return {
      success: true,
      summary: fallback.summary,
      files: fallback.files,
      fallbackUsed: true
    };
  }

  const prompt = `You are an AI code and file generator assistant for Rapidfire CLI.
The user instructs you: "${instruction}".
Generate the complete, production-ready code files requested.
CRITICAL RULES:
1. Do NOT generate or overwrite 'package.json' or 'README.md' unless the user explicitly requested creating a project boilerplate or package.
2. If the user asks for a utility script or helper function, generate a single dedicated standalone script file (e.g. 'script.js', 'tool.py', 'helper.sh').
3. You MUST respond ONLY with valid JSON in this exact schema, without markdown formatting or code blocks:
{
  "summary": "Brief 1-sentence description of what files were created",
  "files": [
    {
      "filename": "relative/path/or/filename.ext",
      "content": "Full source code content of the file"
    }
  ]
}`;

  try {
    const raw = await queryAi({
      prompt,
      systemInstruction: 'You are an expert AI code generator. Output valid JSON only.'
    });

    const cleanJson = raw.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (parsed.files && Array.isArray(parsed.files) && parsed.files.length > 0) {
      return {
        success: true,
        summary: parsed.summary || `Generated ${parsed.files.length} file(s)`,
        files: parsed.files.map((f) => ({
          filename: (f.filename || 'generated.txt').replace(/^[/\\]+/, ''),
          content: f.content || ''
        }))
      };
    }

    const fallback = fallbackInstructGenerator(instruction);
    return {
      success: true,
      summary: fallback.summary,
      files: fallback.files,
      fallbackUsed: true
    };
  } catch {
    const fallback = fallbackInstructGenerator(instruction);
    return {
      success: true,
      summary: fallback.summary,
      files: fallback.files,
      fallbackUsed: true
    };
  }
}

function detectLanguage(ext) {
  const map = {
    '.js': 'JavaScript',
    '.mjs': 'JavaScript (ESM)',
    '.cjs': 'JavaScript (CommonJS)',
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript (React)',
    '.jsx': 'JavaScript (React)',
    '.vue': 'Vue Single File Component',
    '.svelte': 'Svelte Component',
    '.py': 'Python',
    '.json': 'JSON Configuration',
    '.md': 'Markdown Documentation',
    '.html': 'HTML Document',
    '.css': 'CSS Stylesheet',
    '.scss': 'SCSS Stylesheet',
    '.cpp': 'C++',
    '.cc': 'C++',
    '.cxx': 'C++',
    '.c': 'C',
    '.h': 'C/C++ Header',
    '.hpp': 'C++ Header',
    '.rs': 'Rust',
    '.go': 'Go',
    '.java': 'Java',
    '.sh': 'Shell Script',
    '.bash': 'Bash Script',
    '.zsh': 'Zsh Script',
    '.ps1': 'PowerShell Script',
    '.yaml': 'YAML Configuration',
    '.yml': 'YAML Configuration',
    '.toml': 'TOML Configuration',
    '.sql': 'SQL Script'
  };
  return map[ext.toLowerCase()] || 'Text / Source';
}

function fallbackExplainFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      success: false,
      error: 'FILE_NOT_FOUND',
      message: `File not found: ${filePath}`
    };
  }

  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    return fallbackExplainDirectory(filePath);
  }

  const ext = path.extname(filePath);
  const baseName = path.basename(filePath);
  const lang = detectLanguage(ext);

  let rawContent = '';
  try {
    rawContent = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return {
      success: false,
      error: 'READ_ERROR',
      message: `Failed to read file: ${err.message}`
    };
  }

  const lines = rawContent.split(/\r?\n/);
  const lineCount = lines.length;
  const sizeKb = (stat.size / 1024).toFixed(1);

  const imports = [];
  const reqMatches = rawContent.matchAll(/(?:require\(['"]([^'"]+)['"]\)|import\s+.*?from\s+['"]([^'"]+)['"])/g);
  for (const m of reqMatches) {
    const pkg = m[1] || m[2];
    if (pkg && !imports.includes(pkg)) imports.push(pkg);
  }
  const pyMatches = rawContent.matchAll(/(?:from\s+([a-zA-Z0-9_.]+)\s+import|import\s+([a-zA-Z0-9_.]+))/g);
  for (const m of pyMatches) {
    const pkg = m[1] || m[2];
    if (pkg && !imports.includes(pkg)) imports.push(pkg);
  }
  const cMatches = rawContent.matchAll(/#include\s*[<"]([^>"]+)[>"]/g);
  for (const m of cMatches) {
    if (m[1] && !imports.includes(m[1])) imports.push(m[1]);
  }

  const symbols = [];
  const classMatches = rawContent.matchAll(/class\s+([A-Za-z0-9_]+)/g);
  for (const m of classMatches) symbols.push(`class ${m[1]}`);
  const funcMatches = rawContent.matchAll(/(?:async\s+)?function\s+([A-Za-z0-9_]+)/g);
  for (const m of funcMatches) symbols.push(`function ${m[1]}()`);
  const constFuncMatches = rawContent.matchAll(/(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\(/g);
  for (const m of constFuncMatches) symbols.push(`function ${m[1]}()`);
  const pyFuncMatches = rawContent.matchAll(/def\s+([A-Za-z0-9_]+)\s*\(/g);
  for (const m of pyFuncMatches) symbols.push(`def ${m[1]}()`);

  let jsonSummary = '';
  if (ext.toLowerCase() === '.json') {
    try {
      const parsed = JSON.parse(rawContent);
      const keys = Object.keys(parsed);
      jsonSummary = `  • Top-level configuration keys: ${keys.slice(0, 10).join(', ')}${keys.length > 10 ? '...' : ''}\n`;
      if (parsed.name) jsonSummary += `  • Package name: ${parsed.name} (version: ${parsed.version || 'unversioned'})\n`;
      if (parsed.scripts) jsonSummary += `  • Defined npm scripts: ${Object.keys(parsed.scripts).join(', ')}\n`;
    } catch {}
  }

  let text = `======================================================================\n`;
  text += `FILE INSPECTION: ${baseName}\n`;
  text += `======================================================================\n\n`;
  text += `Type: ${lang} | Size: ${sizeKb} KB | Lines: ${lineCount}\n`;
  text += `Path: ${path.resolve(filePath)}\n\n`;

  text += `OVERVIEW & ROLE:\n`;
  if (baseName === 'package.json') {
    text += `  Project manifest defining metadata, dependencies, scripts, and runtime configuration.\n`;
  } else if (baseName === 'README.md') {
    text += `  Project documentation containing setup instructions, architecture guides, and reference manuals.\n`;
  } else if (baseName.includes('test') || filePath.includes('test/')) {
    text += `  Automated test suite verifying component behavior, API contracts, and edge cases.\n`;
  } else {
    text += `  Source module containing ${lang} logic for the application.\n`;
  }
  if (jsonSummary) text += `\n${jsonSummary}`;

  if (symbols.length > 0) {
    text += `\nDECLARED SYMBOLS & FUNCTIONS (${symbols.length}):\n`;
    const preview = symbols.slice(0, 12);
    preview.forEach((s) => (text += `  • ${s}\n`));
    if (symbols.length > 12) {
      text += `  • ... and ${symbols.length - 12} more symbols\n`;
    }
  }

  if (imports.length > 0) {
    text += `\nEXTERNAL DEPENDENCIES & IMPORTS (${imports.length}):\n`;
    const preview = imports.slice(0, 10);
    preview.forEach((imp) => (text += `  • ${imp}\n`));
    if (imports.length > 10) {
      text += `  • ... and ${imports.length - 10} more imports\n`;
    }
  }

  return {
    success: true,
    isFallback: true,
    text
  };
}

function scanDirectoryTree(dirPath, maxDepth = 2, currentDepth = 0, state = { count: 0, items: [] }) {
  if (currentDepth > maxDepth || state.count >= 60) return state.items;

  const ignores = ['.git', 'node_modules', 'venv', '.venv', 'dist', 'build', '.next', '__pycache__', '.turbo', '.rapidfire'];
  let entries = [];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return state.items;
  }

  for (const entry of entries) {
    if (ignores.includes(entry.name)) continue;
    if (state.count >= 60) break;

    const fullPath = path.join(dirPath, entry.name);
    const isDir = entry.isDirectory();
    state.count++;
    state.items.push({
      name: entry.name,
      path: fullPath,
      isDir,
      depth: currentDepth
    });

    if (isDir) {
      scanDirectoryTree(fullPath, maxDepth, currentDepth + 1, state);
    }
  }

  return state.items;
}

function fallbackExplainDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return {
      success: false,
      error: 'DIR_NOT_FOUND',
      message: `Directory not found: ${dirPath}`
    };
  }

  const stat = fs.statSync(dirPath);
  if (!stat.isDirectory()) {
    return fallbackExplainFile(dirPath);
  }

  const resolved = path.resolve(dirPath);
  const baseName = path.basename(resolved);
  const items = scanDirectoryTree(resolved, 2);

  const stacks = [];
  const pkgPath = path.join(resolved, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (allDeps.react) stacks.push('React');
      if (allDeps.vue) stacks.push('Vue');
      if (allDeps.svelte) stacks.push('Svelte');
      if (allDeps.express) stacks.push('Express');
      if (allDeps.vite) stacks.push('Vite');
      if (stacks.length === 0) stacks.push('Node.js');
    } catch {
      stacks.push('Node.js');
    }
  }

  const reqPath = path.join(resolved, 'requirements.txt');
  if (fs.existsSync(reqPath)) {
    try {
      const reqs = fs.readFileSync(reqPath, 'utf8').toLowerCase();
      if (reqs.includes('fastapi')) stacks.push('FastAPI');
      if (reqs.includes('django')) stacks.push('Django');
      if (reqs.includes('flask')) stacks.push('Flask');
      if (stacks.length === 0) stacks.push('Python');
    } catch {
      stacks.push('Python');
    }
  }

  if (fs.existsSync(path.join(resolved, 'Cargo.toml'))) stacks.push('Rust (Cargo)');
  if (fs.existsSync(path.join(resolved, 'go.mod'))) stacks.push('Go');
  if (stacks.length === 0) stacks.push('General Codebase');

  let treeStr = '';
  for (const item of items.slice(0, 35)) {
    const indent = '  '.repeat(item.depth);
    treeStr += `${indent}${item.isDir ? '[DIR]  ' : '       '}${item.name}\n`;
  }
  if (items.length > 35) {
    treeStr += `  ... and ${items.length - 35} more files\n`;
  }

  let text = `======================================================================\n`;
  text += `CODEBASE ARCHITECTURE: ${baseName}\n`;
  text += `======================================================================\n\n`;
  text += `Path: ${resolved}\n`;
  text += `Detected Stack: ${stacks.join(', ')}\n`;
  text += `Total Scanned Files/Directories: ${items.length}\n\n`;

  text += `PROJECT STRUCTURE:\n${treeStr}\n`;

  text += `KEY DIRECTORIES & ROLES:\n`;
  const subdirs = items.filter((i) => i.isDir && i.depth === 0).map((i) => i.name);
  if (subdirs.includes('src')) text += `  • src/          Core application source logic and internal modules\n`;
  if (subdirs.includes('bin')) text += `  • bin/          CLI executable entry points\n`;
  if (subdirs.includes('test') || subdirs.includes('tests')) text += `  • test/         Automated test suites and verification scripts\n`;
  if (subdirs.includes('api') || subdirs.includes('routes')) text += `  • api/          Server endpoints and route handlers\n`;
  if (subdirs.includes('components')) text += `  • components/   Reusable UI components\n`;
  if (subdirs.includes('utils')) text += `  • utils/        Shared utilities, helpers, and file wrappers\n`;
  if (subdirs.includes('frontend')) text += `  • frontend/     Client-side application\n`;
  if (subdirs.includes('backend')) text += `  • backend/      Server-side application\n`;

  text += `\nEXECUTION ENTRY POINTS:\n`;
  if (fs.existsSync(path.join(resolved, 'package.json'))) text += `  • npm start / npm test (configured in package.json)\n`;
  if (fs.existsSync(path.join(resolved, 'main.py'))) text += `  • python main.py\n`;
  if (fs.existsSync(path.join(resolved, 'app.py'))) text += `  • python app.py\n`;
  if (fs.existsSync(path.join(resolved, 'bin/rapidfire.js'))) text += `  • bin/rapidfire.js (CLI entry point)\n`;

  return {
    success: true,
    isFallback: true,
    text
  };
}

async function explainFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      success: false,
      error: 'FILE_NOT_FOUND',
      message: `File not found: ${filePath}`
    };
  }

  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    return explainDirectory(filePath);
  }

  const config = getActiveAiConfig();
  if (!config.apiKey) {
    return fallbackExplainFile(filePath);
  }

  let content = '';
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return fallbackExplainFile(filePath);
  }

  const lines = content.split(/\r?\n/);
  const snippet = lines.slice(0, 300).join('\n');
  const isTruncated = lines.length > 300;

  const baseName = path.basename(filePath);
  const ext = path.extname(filePath);
  const lang = detectLanguage(ext);

  const prompt = `You are RapidFire CLI's codebase architecture explainer. Explain this file clearly and concisely for a developer:

File: ${baseName}
Language: ${lang}
Total Lines: ${lines.length} ${isTruncated ? '(previewing first 300 lines)' : ''}
Path: ${path.resolve(filePath)}

Content:
\`\`\`${ext.replace('.', '') || 'text'}
${snippet}
\`\`\`

Provide a clean, structured response:
## 1. Overview & Primary Role
(1-2 clear sentences explaining the purpose of this file)

## 2. Key Components & Functions
(Bulleted list of main functions, classes, exports, and what they do)

## 3. Dependencies & Connections
(What it imports, what libraries it uses, and what relies on it)

## 4. Notable Architecture / Logic
(Key design patterns, error handling, state, or performance characteristics)`;

  try {
    const text = await queryAi({
      prompt,
      systemInstruction: 'You are the expert software architect assistant for RapidFire CLI. Provide clean, highly structured, technical code explanations.'
    });

    return {
      success: true,
      isFallback: false,
      text,
      model: config.model
    };
  } catch {
    return fallbackExplainFile(filePath);
  }
}

async function explainDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return {
      success: false,
      error: 'DIR_NOT_FOUND',
      message: `Directory not found: ${dirPath}`
    };
  }

  const stat = fs.statSync(dirPath);
  if (!stat.isDirectory()) {
    return explainFile(dirPath);
  }

  const config = getActiveAiConfig();
  if (!config.apiKey) {
    return fallbackExplainDirectory(dirPath);
  }

  const resolved = path.resolve(dirPath);
  const baseName = path.basename(resolved);
  const items = scanDirectoryTree(resolved, 2);

  let treeStr = '';
  for (const item of items.slice(0, 40)) {
    const indent = '  '.repeat(item.depth);
    treeStr += `${indent}${item.isDir ? '[DIR]  ' : '       '}${item.name}\n`;
  }

  let manifestSnippet = '';
  const pkgPath = path.join(resolved, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      manifestSnippet += `package.json: name="${pkg.name}", scripts=${JSON.stringify(Object.keys(pkg.scripts || {}))}, deps=${JSON.stringify(Object.keys(pkg.dependencies || {}))}\n`;
    } catch {}
  }
  const reqPath = path.join(resolved, 'requirements.txt');
  if (fs.existsSync(reqPath)) {
    try {
      manifestSnippet += `requirements.txt: ${fs.readFileSync(reqPath, 'utf8').slice(0, 300)}\n`;
    } catch {}
  }

  const prompt = `You are RapidFire CLI's codebase architecture explainer. Analyze and explain this directory architecture for a developer:

Directory: ${baseName} (${resolved})
Total Scanned Items: ${items.length}

Directory Structure:
${treeStr}

Key Manifest Highlights:
${manifestSnippet || 'None'}

Provide a clean, structured response:
## 1. Architecture Overview & Tech Stack
(Summary of frameworks, architecture patterns, and what kind of project this is)

## 2. Directory & Module Map
(Breakdown of primary folders and what their responsibilities are)

## 3. Entry Points & Workflow
(Where execution starts, how data flows, and main scripts)

## 4. Key Developer Takeaways
(Important files to know when working on or extending this project)`;

  try {
    const text = await queryAi({
      prompt,
      systemInstruction: 'You are the expert software architect assistant for RapidFire CLI. Provide clean, highly structured, technical codebase architecture breakdowns.'
    });

    return {
      success: true,
      isFallback: false,
      text,
      model: config.model
    };
  } catch {
    return fallbackExplainDirectory(dirPath);
  }
}

function fallbackRepoOverview(repoPath, options = {}) {
  const resolved = path.resolve(repoPath || process.cwd());
  if (!fs.existsSync(resolved)) {
    return {
      success: false,
      error: 'NOT_FOUND',
      message: `Repository path not found: ${resolved}`
    };
  }

  const isCritic = Boolean(options && (options.critic || options.cirtic));
  const repoName = path.basename(resolved);
  const items = scanDirectoryTree(resolved, 2);

  const subdirs = items.filter(i => i.isDir && i.depth === 0).map(i => i.name);
  const fileItems = items.filter(i => !i.isDir);

  const stacks = [];
  let pkgName = repoName;
  let pkgVersion = '1.0.0';
  let scripts = [];
  let deps = [];
  let devDeps = [];

  const pkgPath = path.join(resolved, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.name) pkgName = pkg.name;
      if (pkg.version) pkgVersion = pkg.version;
      scripts = Object.keys(pkg.scripts || {});
      deps = Object.keys(pkg.dependencies || {});
      devDeps = Object.keys(pkg.devDependencies || {});
      const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (all.react) stacks.push('React');
      if (all.vue) stacks.push('Vue');
      if (all.svelte) stacks.push('Svelte');
      if (all.express) stacks.push('Express');
      if (all.vite) stacks.push('Vite');
      if (all['@google/generative-ai']) stacks.push('Google Gemini AI');
      if (stacks.length === 0) stacks.push('Node.js');
    } catch {
      stacks.push('Node.js');
    }
  }

  const reqPath = path.join(resolved, 'requirements.txt');
  if (fs.existsSync(reqPath)) {
    try {
      const reqs = fs.readFileSync(reqPath, 'utf8').toLowerCase();
      if (reqs.includes('fastapi')) stacks.push('FastAPI');
      if (reqs.includes('django')) stacks.push('Django');
      if (reqs.includes('flask')) stacks.push('Flask');
      if (stacks.length === 0) stacks.push('Python');
    } catch {
      stacks.push('Python');
    }
  }

  if (fs.existsSync(path.join(resolved, 'Cargo.toml'))) stacks.push('Rust');
  if (fs.existsSync(path.join(resolved, 'go.mod'))) stacks.push('Go');
  if (stacks.length === 0) stacks.push('General Software Repository');

  let text = '';
  if (isCritic) {
    text = `# Architectural Critique: ${pkgName}\n\n`;
    text += `Target: ${resolved}\n`;
    text += `Evaluated Stack: ${stacks.join(', ')}\n\n`;

    text += `## 1. Architectural Verdict & Health\n`;
    text += `The repository exhibits a structured layout with modular components. `;
    if (subdirs.includes('test') || subdirs.includes('tests')) {
      text += `Automated verification suites are present, providing baseline regression safety. `;
    } else {
      text += `Automated testing coverage is missing or non-standard, creating elevated regression risk. `;
    }
    text += `Overall architectural rating: ${subdirs.includes('src') && (subdirs.includes('test') || subdirs.includes('tests')) ? 'B+ (Solid Foundation)' : 'B- (Needs Hardening)'}.\n\n`;

    text += `## 2. The Goods (Strengths & Clean Patterns)\n`;
    if (subdirs.includes('src')) {
      text += `• Clean Separation of Concerns: Core source logic is organized under src/, isolating business domain code from tooling.\n`;
    }
    if (subdirs.includes('test') || subdirs.includes('tests')) {
      text += `• Test Suite Presence: Dedicated verification suites exist to validate system behavior.\n`;
    }
    if (scripts.includes('test') || scripts.includes('start')) {
      text += `• Standardized NPM Workflows: Defined lifecycle scripts provide predictable local developer experience.\n`;
    }
    if (deps.length > 0) {
      text += `• Controlled Dependencies: Explicit manifest declarations bound in package.json.\n`;
    }

    text += `\n## 3. The Bads & Flaws (Anti-Patterns, Risks & Code Smells)\n`;
    if (deps.length > 20) {
      text += `• Heavy Dependency Footprint: ${deps.length} direct runtime dependencies increase attack surface and maintenance burden.\n`;
    }
    if (!subdirs.includes('test') && !subdirs.includes('tests')) {
      text += `• Zero Dedicated Test Directory: Critical testing gap increases probability of production regressions.\n`;
    }
    text += `• Configuration Coupled to Runtime: Ensure environment variables and credentials remain isolated from codebase files.\n`;
    text += `• Scalability Constraints: Evaluate whether single-process execution models handle larger concurrent workloads.\n\n`;

    text += `## 4. Pros & Cons Analysis\n`;
    text += `• Pros:\n`;
    text += `  - Streamlined developer setup with fast initial boot.\n`;
    text += `  - Modular directory layout allowing predictable file navigation.\n`;
    text += `  - Lean architecture minimizing unnecessary enterprise boilerplate.\n`;
    text += `• Cons:\n`;
    text += `  - Lack of strict static typing (unless TypeScript is configured) increases potential runtime type exceptions.\n`;
    text += `  - Potential coupling between command routing and core orchestration routines.\n\n`;

    text += `## 5. Actionable Roadmap & Priority Fixes\n`;
    text += `1. High Priority: Expand automated integration tests covering end-to-end execution paths.\n`;
    text += `2. Medium Priority: Implement strict schema validation on all inputs and configuration boundaries.\n`;
    text += `3. Low Priority: Add automated CI/CD pipeline checks for code formatting, linting, and security audits.\n`;
  } else {
    text = `# Repository Architecture Overview: ${pkgName} (v${pkgVersion})\n\n`;
    text += `Location: ${resolved}\n`;
    text += `Primary Stack: ${stacks.join(', ')}\n`;
    text += `Total Tracked Modules/Files: ${items.length}\n\n`;

    text += `## 1. Executive Summary & Purpose\n`;
    text += `${pkgName} is a software project structured around ${stacks.join(', ')}. `;
    text += `It provides modularized functionality separated into distinct directories for source code, command execution, and verification.\n\n`;

    text += `## 2. Tech Stack & Infrastructure\n`;
    text += `• Runtimes & Frameworks: ${stacks.join(', ')}\n`;
    if (deps.length > 0) {
      text += `• Key Dependencies: ${deps.slice(0, 10).join(', ')}${deps.length > 10 ? ` (+${deps.length - 10} more)` : ''}\n`;
    }
    if (devDeps.length > 0) {
      text += `• Dev Tools: ${devDeps.slice(0, 8).join(', ')}\n`;
    }
    if (scripts.length > 0) {
      text += `• Lifecycle Scripts: ${scripts.join(', ')}\n`;
    }

    text += `\n## 3. Architecture & Data Flow Map\n`;
    text += `┌────────────────┐      ┌─────────────────┐      ┌────────────────┐\n`;
    text += `│  CLI / Entry   │ ───> │  Command Router │ ───> │ Domain Logic   │\n`;
    text += `│  (bin/ or npm) │      │  (src/commands) │      │ (src/utils/ai) │\n`;
    text += `└────────────────┘      └─────────────────┘      └────────────────┘\n`;
    text += `                                                          │\n`;
    text += `                                                          ▼\n`;
    text += `                                                 ┌────────────────┐\n`;
    text += `                                                 │ Markdown / DB  │\n`;
    text += `                                                 │ (md/ & memory) │\n`;
    text += `                                                 └────────────────┘\n\n`;

    text += `## 4. Directory & Module Responsibilities\n`;
    for (const sub of subdirs) {
      if (sub === 'src') text += `• src/: Core application business logic, utilities, and execution engines.\n`;
      else if (sub === 'bin') text += `• bin/: Executable binary wrappers and CLI entrypoints.\n`;
      else if (sub === 'test' || sub === 'tests') text += `• test/: Automated verification suites and integration tests.\n`;
      else if (sub === 'md') text += `• md/: Generated documentation and architectural markdown exports.\n`;
      else text += `• ${sub}/: Domain module containing specialized project assets and submodules.\n`;
    }

    text += `\n## 5. Execution Entry Points & Developer Workflows\n`;
    if (scripts.includes('start')) text += `• npm start: Launches the standard project application process.\n`;
    if (scripts.includes('test')) text += `• npm test: Executes the test suite.\n`;
    if (fs.existsSync(path.join(resolved, 'bin/rapidfire.js'))) text += `• node bin/rapidfire.js: Launches the RapidFire CLI and REPL.\n`;
  }

  return {
    success: true,
    isFallback: true,
    text
  };
}

async function generateRepoOverview(repoPath, options = {}) {
  const resolved = path.resolve(repoPath || process.cwd());
  if (!fs.existsSync(resolved)) {
    return {
      success: false,
      error: 'NOT_FOUND',
      message: `Repository path not found: ${resolved}`
    };
  }

  const isCritic = Boolean(options && (options.critic || options.cirtic));
  const config = getActiveAiConfig();
  if (!config.apiKey) {
    return fallbackRepoOverview(resolved, options);
  }

  const repoContext = buildRepoContext(resolved);

  let prompt = '';
  let systemInstruction = '';

  if (isCritic) {
    systemInstruction = 'You are the senior staff software architect and principal code reviewer for RapidFire CLI. Provide a rigorous, constructive, and comprehensive critique of repository design and engineering practices.';
    prompt = `Conduct an in-depth, candid, and constructive architectural critique of this repository. Evaluate code hygiene, separation of concerns, test coverage, potential vulnerabilities, and scalability trade-offs.

Repository Context:
${repoContext.summary}

Provide your critique structured under these exact headers:
# Architectural Critique: ${repoContext.repoName}

## 1. Architectural Verdict & Health
(Overall technical evaluation, maturity assessment, and architecture design rating)

## 2. The Goods (Strengths & Clean Patterns)
(Specific well-designed abstractions, separation of concerns, strengths in project organization)

## 3. The Bads & Flaws (Anti-Patterns, Risks & Code Smells)
(Specific architectural flaws, monolithic components, tight coupling, testing gaps, fragile dependencies)

## 4. Pros & Cons Analysis
• Pros: (Key advantages of chosen technology stack and architectural approach)
• Cons: (Operational, scalability, or maintenance drawbacks)

## 5. Actionable Roadmap & Priority Fixes
(Ranked list of highest-impact refactorings and structural enhancements)`;
  } else {
    systemInstruction = 'You are the expert software architect assistant for RapidFire CLI. Provide clean, highly structured, technical codebase architecture overviews.';
    prompt = `Analyze and provide a comprehensive, developer-centric architectural overview of this repository.

Repository Context:
${repoContext.summary}

Provide your overview structured under these exact headers:
# Repository Architecture Overview: ${repoContext.repoName}

## 1. Executive Summary & Purpose
(Primary problem domain, core capabilities, and high-level role)

## 2. Tech Stack & Infrastructure
(Runtimes, frameworks, dependencies, and external integrations)

## 3. Architecture & Data Flow Map
(ASCII diagram depicting components, modules, data flow, and system boundaries)

## 4. Directory & Module Responsibilities
(Detailed breakdown of each major directory and component responsibility)

## 5. Execution Entry Points & Developer Workflows
(Main entry points, development scripts, testing commands, and deployment pathways)`;
  }

  try {
    const text = await queryAi({
      prompt,
      systemInstruction
    });

    return {
      success: true,
      isFallback: false,
      text,
      model: config.model
    };
  } catch {
    return fallbackRepoOverview(resolved, options);
  }
}

module.exports = {
  SUPPORTED_STACKS,
  hasApiKey,
  getApiKey,
  getActiveAiConfig,
  detectProvider,
  askAI,
  suggestStack,
  instructAI,
  fallbackInstructGenerator,
  explainFile,
  explainDirectory,
  fallbackExplainFile,
  fallbackExplainDirectory,
  generateRepoOverview,
  fallbackRepoOverview,
  clearAskHistory,
  getAskHistory
};
