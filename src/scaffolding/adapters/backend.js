const path = require('path');
const fse = require('fs-extra');
const { run, getDjangoAdminCmd } = require('../../utils/proc');

function writeFastAPIBackend(backendDir, appName, options = {}) {
  const port = options.port || 8000;
  fse.ensureDirSync(backendDir);
  console.log('[rapidfire] Scaffolding FastAPI backend...');
  const mainPy = `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="${appName} API",
    description="High-performance backend generated cleanly with Rapidfire CLI",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class HealthResponse(BaseModel):
    status: str
    message: str

@app.get("/api/health", response_model=HealthResponse)
def health_check():
    return {"status": "ok", "message": "FastAPI backend is running"}

@app.get("/")
def root():
    return {"message": "Welcome to FastAPI backend!", "docs_url": "/docs"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=${port}, reload=True)
`;
  fse.writeFileSync(path.join(backendDir, 'main.py'), mainPy, 'utf8');
  fse.writeFileSync(path.join(backendDir, 'requirements.txt'), `fastapi>=0.115.0\nuvicorn[standard]>=0.32.0\npydantic>=2.10.0\n`, 'utf8');
}

function writeExpressBackend(backendDir, appName, options = {}) {
  const port = options.port || 5000;
  fse.ensureDirSync(backendDir);
  console.log('[rapidfire] Scaffolding Express Node backend...');
  const pkg = {
    name: `${path.basename(appName)}-backend`,
    version: '1.0.0',
    private: true,
    main: 'server.js',
    scripts: { start: 'node server.js', dev: 'node --watch server.js' },
    dependencies: { cors: '^2.8.5', dotenv: '^16.4.7', express: '^4.21.2' }
  };
  fse.writeJsonSync(path.join(backendDir, 'package.json'), pkg, { spaces: 2 });
  const serverJs = `const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || ${port};
app.use(cors());
app.use(express.json());
app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'Express backend is running' }));
app.listen(PORT, () => console.log(\`Server running on http://localhost:\${PORT}\`));
`;
  fse.writeFileSync(path.join(backendDir, 'server.js'), serverJs, 'utf8');
  fse.writeFileSync(path.join(backendDir, '.env.example'), `PORT=${port}\n`, 'utf8');
  if (process.env.RAPIDFIRE_SKIP_INSTALL !== '1') {
    console.log('[rapidfire] Installing backend dependencies...');
    try {
      run('npm install', { cwd: backendDir, stdio: 'pipe' });
      console.log('[rapidfire] Express backend ready.');
    } catch (err) {
      console.warn('\x1b[33m[rapidfire] npm install notice:\x1b[0m', err.message);
    }
  } else {
    console.log('[rapidfire] Express backend ready.');
  }
}

function writeDjangoBackend(backendDir, options = {}) {
  fse.ensureDirSync(backendDir);
  console.log('[rapidfire] Scaffolding Django backend...');
  const djangoCmd = getDjangoAdminCmd();
  run(`${djangoCmd} startproject backend "${backendDir}"`);
  fse.writeFileSync(path.join(backendDir, 'requirements.txt'), `asgiref>=3.8.1\nDjango>=4.2,<6.0\ndjango-cors-headers>=4.3.1\nsqlparse>=0.5.0\n`, 'utf8');
}

function writeFlaskBackend(backendDir, options = {}) {
  const port = options.port || 5000;
  fse.ensureDirSync(backendDir);
  console.log('[rapidfire] Scaffolding Flask backend...');
  const appPy = `from flask import Flask, jsonify
from flask_cors import CORS
app = Flask(__name__)
CORS(app)
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'Flask backend is running'})
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=${port}, debug=True)
`;
  fse.writeFileSync(path.join(backendDir, 'app.py'), appPy, 'utf8');
  fse.writeFileSync(path.join(backendDir, 'requirements.txt'), `flask>=3.1.0\nflask-cors>=5.0.0\n`, 'utf8');
}

const BACKEND_ADAPTERS = {
  fastapi: writeFastAPIBackend,
  node: writeExpressBackend,
  express: writeExpressBackend,
  django: writeDjangoBackend,
  flask: writeFlaskBackend
};

function hasBackendAdapter(name) {
  return Boolean(name && BACKEND_ADAPTERS[name.toLowerCase()]);
}

function getBackendAdapter(name) {
  return BACKEND_ADAPTERS[name.toLowerCase()] || null;
}

module.exports = {
  writeFastAPIBackend,
  writeExpressBackend,
  writeDjangoBackend,
  writeFlaskBackend,
  BACKEND_ADAPTERS,
  hasBackendAdapter,
  getBackendAdapter
};
