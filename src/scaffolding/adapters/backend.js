const path = require('path');
const fse = require('fs-extra');
const {
  run,
  getDjangoAdminCmd,
  getRustInstallInstructions,
  getGoInstallInstructions,
  getDotnetInstallInstructions,
  getRubyInstallInstructions,
  getPhpInstallInstructions
} = require('../../utils/proc');
const { isBinaryInPath } = require('../../utils/fsHelpers');

function normalizeBackendName(name) {
  if (!name || typeof name !== 'string') return '';
  const s = name.toLowerCase().trim();
  if (s === 'node' || s === 'expressjs') return 'express';
  if (s === 'nestjs') return 'nest';
  if (s === 'axum' || s === 'actix' || s === 'cargo') return 'rust';
  if (s === 'golang' || s === 'gin') return 'go';
  if (s === 'sinatra') return 'ruby';
  if (s === 'csharp' || s === 'cs' || s === '.net') return 'dotnet';
  if (s === 'py' || s === 'python') return 'fastapi';
  return s;
}

function getBackendDefaultPort(name) {
  const normalized = normalizeBackendName(name);
  if (normalized === 'fastapi' || normalized === 'django') {
    return 8000;
  }
  return 5000;
}

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
    port: int

@app.get("/api/health", response_model=HealthResponse)
def health_check():
    return {"status": "ok", "message": "FastAPI backend is running", "port": ${port}}

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
app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'Express backend is running', port: PORT }));
app.get('/', (req, res) => res.json({ message: 'Welcome to Express backend API!', docs: '/api/health' }));
app.listen(PORT, () => console.log(\`Server running on http://localhost:\${PORT}\`));
`;
  fse.writeFileSync(path.join(backendDir, 'server.js'), serverJs, 'utf8');
  fse.writeFileSync(path.join(backendDir, '.env.example'), `PORT=${port}\n`, 'utf8');
  runBackendNpmInstall(backendDir, 'Express');
}

function runBackendNpmInstall(backendDir, name) {
  if (process.env.RAPIDFIRE_SKIP_INSTALL !== '1') {
    console.log(`[rapidfire] Installing ${name} backend dependencies from LTS...`);
    try {
      run('npm install', { cwd: backendDir, stdio: 'pipe' });
      console.log(`[rapidfire] ${name} backend ready.`);
    } catch (err) {
      try {
        run('npm install --legacy-peer-deps', { cwd: backendDir, stdio: 'pipe' });
        console.log(`[rapidfire] ${name} backend ready.`);
      } catch (innerErr) {
        console.warn('\x1b[33m[rapidfire] npm install notice:\x1b[0m', innerErr.message);
      }
    }
  } else {
    console.log(`[rapidfire] ${name} backend ready.`);
  }
}

function configureDjangoCorsAndHealth(backendDir) {
  let settingsPath = path.join(backendDir, 'backend', 'settings.py');
  if (!fse.existsSync(settingsPath)) {
    try {
      const items = fse.readdirSync(backendDir);
      for (const item of items) {
        const candidate = path.join(backendDir, item, 'settings.py');
        if (fse.existsSync(candidate)) {
          settingsPath = candidate;
          break;
        }
      }
    } catch { }
  }

  if (fse.existsSync(settingsPath)) {
    let settingsContent = fse.readFileSync(settingsPath, 'utf8');
    if (!settingsContent.includes("'corsheaders'")) {
      settingsContent = settingsContent.replace(/INSTALLED_APPS\s*=\s*\[/, "INSTALLED_APPS = [\n    'corsheaders',");
    }
    if (!settingsContent.includes("'corsheaders.middleware.CorsMiddleware'")) {
      settingsContent = settingsContent.replace(/MIDDLEWARE\s*=\s*\[/, "MIDDLEWARE = [\n    'corsheaders.middleware.CorsMiddleware',");
    }
    settingsContent = settingsContent.replace(/ALLOWED_HOSTS\s*=\s*\[\]/, "ALLOWED_HOSTS = ['*']");
    if (!settingsContent.includes('CORS_ALLOW_ALL_ORIGINS')) {
      settingsContent += `\nCORS_ALLOWED_ORIGINS = [\n    "http://localhost:3000",\n    "http://127.0.0.1:3000",\n    "http://localhost:3001",\n    "http://127.0.0.1:3001",\n    "http://localhost:5173",\n    "http://127.0.0.1:5173",\n]\nCORS_ALLOW_ALL_ORIGINS = True\n`;
    }
    fse.writeFileSync(settingsPath, settingsContent, 'utf8');
  }

  let urlsPath = path.join(backendDir, 'backend', 'urls.py');
  if (!fse.existsSync(urlsPath)) {
    try {
      const items = fse.readdirSync(backendDir);
      for (const item of items) {
        const candidate = path.join(backendDir, item, 'urls.py');
        if (fse.existsSync(candidate)) {
          urlsPath = candidate;
          break;
        }
      }
    } catch { }
  }

  if (fse.existsSync(urlsPath)) {
    const urlsPy = `from django.contrib import admin
from django.urls import path
from django.http import JsonResponse

def health_check(request):
    return JsonResponse({'status': 'ok', 'message': 'Django backend is running', 'port': 8000})

def root_view(request):
    return JsonResponse({'message': 'Welcome to Django backend API!', 'docs': '/api/health'})

urlpatterns = [
    path('', root_view),
    path('admin/', admin.site.urls),
    path('api/health', health_check),
    path('api/health/', health_check),
]
`;
    fse.writeFileSync(urlsPath, urlsPy, 'utf8');
  }
}

function writeDjangoBackend(backendDir, appName, options = {}) {
  fse.ensureDirSync(backendDir);
  console.log('[rapidfire] Scaffolding Django backend...');
  const djangoCmd = getDjangoAdminCmd();
  try {
    run(`${djangoCmd} startproject backend "${backendDir}"`);
  } catch {
    const innerDir = path.join(backendDir, 'backend');
    fse.ensureDirSync(innerDir);
    fse.writeFileSync(path.join(innerDir, '__init__.py'), '', 'utf8');
    fse.writeFileSync(path.join(innerDir, 'settings.py'), `SECRET_KEY = 'rapidfire-insecure-key'\nDEBUG = True\nALLOWED_HOSTS = ['*']\nINSTALLED_APPS = ['corsheaders']\nMIDDLEWARE = ['corsheaders.middleware.CorsMiddleware']\nROOT_URLCONF = 'backend.urls'\nWSGI_APPLICATION = 'backend.wsgi.application'\nDATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': 'db.sqlite3'}}\n`, 'utf8');
    fse.writeFileSync(path.join(backendDir, 'manage.py'), `#!/usr/bin/env python\nimport os, sys\ndef main():\n    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')\n    from django.core.management import execute_from_command_line\n    execute_from_command_line(sys.argv)\nif __name__ == '__main__':\n    main()\n`, 'utf8');
  }
  fse.writeFileSync(path.join(backendDir, 'requirements.txt'), `asgiref>=3.8.1\nDjango>=4.2,<6.0\ndjango-cors-headers>=4.3.1\nsqlparse>=0.5.0\n`, 'utf8');
  configureDjangoCorsAndHealth(backendDir);
}

function writeFlaskBackend(backendDir, appName, options = {}) {
  const port = options.port || 5000;
  fse.ensureDirSync(backendDir);
  console.log('[rapidfire] Scaffolding Flask backend...');
  const appPy = `from flask import Flask, jsonify
from flask_cors import CORS
app = Flask(__name__)
CORS(app)
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'Flask backend is running', 'port': ${port}})
@app.route('/', methods=['GET'])
def root():
    return jsonify({'message': 'Welcome to Flask backend API!', 'docs': '/api/health'})
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=${port}, debug=True)
`;
  fse.writeFileSync(path.join(backendDir, 'app.py'), appPy, 'utf8');
  fse.writeFileSync(path.join(backendDir, 'requirements.txt'), `flask>=3.1.0\nflask-cors>=5.0.0\n`, 'utf8');
}

function writeHonoBackend(backendDir, appName, options = {}) {
  const port = options.port || 5000;
  fse.ensureDirSync(backendDir);
  console.log('[rapidfire] Scaffolding Hono backend...');
  const pkg = {
    name: `${path.basename(appName)}-backend`,
    version: '1.0.0',
    private: true,
    main: 'server.js',
    scripts: { start: 'node server.js', dev: 'node --watch server.js' },
    dependencies: { '@hono/node-server': '^1.13.0', hono: '^4.6.0' }
  };
  fse.writeJsonSync(path.join(backendDir, 'package.json'), pkg, { spaces: 2 });
  const serverJs = `const { serve } = require('@hono/node-server');
const { Hono } = require('hono');
const { cors } = require('hono/cors');

const app = new Hono();
app.use('*', cors());

app.get('/api/health', (c) => c.json({ status: 'ok', message: 'Hono backend is running', port: ${port} }));
app.get('/', (c) => c.json({ message: 'Welcome to Hono backend API!', docs: '/api/health' }));

serve({ fetch: app.fetch, port: ${port} }, (info) => {
  console.log(\`[rapidfire] Hono backend listening on http://localhost:\${info.port}\`);
});
`;
  fse.writeFileSync(path.join(backendDir, 'server.js'), serverJs, 'utf8');
  fse.writeFileSync(path.join(backendDir, 'index.js'), serverJs, 'utf8');
  fse.writeFileSync(path.join(backendDir, '.gitignore'), `node_modules/\n.env\n`, 'utf8');
  fse.writeFileSync(path.join(backendDir, 'README.md'), `# ${appName} Backend (Hono)\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`, 'utf8');
  runBackendNpmInstall(backendDir, 'Hono');
}

function writeFastifyBackend(backendDir, appName, options = {}) {
  const port = options.port || 5000;
  fse.ensureDirSync(backendDir);
  console.log('[rapidfire] Scaffolding Fastify backend...');
  const pkg = {
    name: `${path.basename(appName)}-backend`,
    version: '1.0.0',
    private: true,
    main: 'server.js',
    scripts: { start: 'node server.js', dev: 'node --watch server.js' },
    dependencies: { fastify: '^4.28.1', '@fastify/cors': '^9.0.1' }
  };
  fse.writeJsonSync(path.join(backendDir, 'package.json'), pkg, { spaces: 2 });
  const serverJs = `const fastify = require('fastify')({ logger: false });

fastify.register(require('@fastify/cors'), { origin: '*' });

fastify.get('/api/health', async () => ({ status: 'ok', message: 'Fastify backend is running', port: ${port} }));
fastify.get('/', async () => ({ message: 'Welcome to Fastify backend API!', docs: '/api/health' }));

fastify.listen({ port: ${port}, host: '0.0.0.0' }, (err, addr) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(\`[rapidfire] Fastify backend listening on \${addr}\`);
});
`;
  fse.writeFileSync(path.join(backendDir, 'server.js'), serverJs, 'utf8');
  fse.writeFileSync(path.join(backendDir, '.gitignore'), `node_modules/\n.env\n`, 'utf8');
  fse.writeFileSync(path.join(backendDir, 'README.md'), `# ${appName} Backend (Fastify)\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`, 'utf8');
  runBackendNpmInstall(backendDir, 'Fastify');
}

function writeNestBackend(backendDir, appName, options = {}) {
  const port = options.port || 5000;
  fse.ensureDirSync(backendDir);
  console.log('[rapidfire] Scaffolding NestJS backend...');
  const pkg = {
    name: `${path.basename(appName)}-backend`,
    version: '1.0.0',
    private: true,
    main: 'server.js',
    scripts: { start: 'node server.js', dev: 'node --watch server.js' },
    dependencies: {
      '@nestjs/common': '^10.4.0',
      '@nestjs/core': '^10.4.0',
      '@nestjs/platform-express': '^10.4.0',
      cors: '^2.8.5',
      express: '^4.21.2',
      'reflect-metadata': '^0.2.0',
      rxjs: '^7.8.1'
    }
  };
  fse.writeJsonSync(path.join(backendDir, 'package.json'), pkg, { spaces: 2 });
  const serverJs = `const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || ${port};

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'NestJS backend is running', port: PORT }));
app.get('/', (req, res) => res.json({ message: 'Welcome to NestJS backend API!', docs: '/api/health' }));

app.listen(PORT, () => console.log(\`[rapidfire] NestJS backend listening on http://localhost:\${PORT}\`));
`;
  fse.writeFileSync(path.join(backendDir, 'server.js'), serverJs, 'utf8');
  const srcDir = path.join(backendDir, 'src');
  fse.ensureDirSync(srcDir);
  fse.writeFileSync(path.join(srcDir, 'app.controller.ts'), `import { Controller, Get } from '@nestjs/common';\n@Controller()\nexport class AppController {\n  @Get('api/health')\n  getHealth() { return { status: 'ok', message: 'NestJS backend is running', port: ${port} }; }\n}\n`, 'utf8');
  fse.writeFileSync(path.join(backendDir, '.gitignore'), `node_modules/\ndist/\n.env\n`, 'utf8');
  fse.writeFileSync(path.join(backendDir, 'README.md'), `# ${appName} Backend (NestJS)\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`, 'utf8');
  runBackendNpmInstall(backendDir, 'NestJS');
}

function writeKoaBackend(backendDir, appName, options = {}) {
  const port = options.port || 5000;
  fse.ensureDirSync(backendDir);
  console.log('[rapidfire] Scaffolding Koa backend...');
  const pkg = {
    name: `${path.basename(appName)}-backend`,
    version: '1.0.0',
    private: true,
    main: 'server.js',
    scripts: { start: 'node server.js', dev: 'node --watch server.js' },
    dependencies: { koa: '^2.15.3', '@koa/cors': '^5.0.0', '@koa/router': '^13.0.1' }
  };
  fse.writeJsonSync(path.join(backendDir, 'package.json'), pkg, { spaces: 2 });
  const serverJs = `const Koa = require('koa');
const Router = require('@koa/router');
const cors = require('@koa/cors');

const app = new Koa();
const router = new Router();
const PORT = process.env.PORT || ${port};

app.use(cors());

router.get('/api/health', (ctx) => {
  ctx.body = { status: 'ok', message: 'Koa backend is running', port: PORT };
});

router.get('/', (ctx) => {
  ctx.body = { message: 'Welcome to Koa backend API!', docs: '/api/health' };
});

app.use(router.routes()).use(router.allowedMethods());

app.listen(PORT, () => {
  console.log(\`[rapidfire] Koa backend listening on http://localhost:\${PORT}\`);
});
`;
  fse.writeFileSync(path.join(backendDir, 'server.js'), serverJs, 'utf8');
  fse.writeFileSync(path.join(backendDir, '.gitignore'), `node_modules/\n.env\n`, 'utf8');
  fse.writeFileSync(path.join(backendDir, 'README.md'), `# ${appName} Backend (Koa)\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`, 'utf8');
  runBackendNpmInstall(backendDir, 'Koa');
}

function writeRustBackend(backendDir, appName, options = {}) {
  const port = options.port || 5000;
  fse.ensureDirSync(backendDir);
  console.log('[rapidfire] Scaffolding Rust (Axum) backend...');
  if (!isBinaryInPath('cargo')) {
    console.error('\x1b[31m[rapidfire] Error: No Rust (cargo) found in your system PATH.\x1b[0m');
    console.log(`\x1b[33m[rapidfire] Hint: Installation instructions for your system:\x1b[0m\n${getRustInstallInstructions()}`);
  }
  const cargoToml = `[package]
name = "backend"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.7"
tokio = { version = "1.0", features = ["full"] }
tower-http = { version = "0.5", features = ["cors"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
`;
  fse.writeFileSync(path.join(backendDir, 'Cargo.toml'), cargoToml, 'utf8');
  const srcDir = path.join(backendDir, 'src');
  fse.ensureDirSync(srcDir);
  const mainRs = `use axum::{routing::get, Json, Router};
use serde::Serialize;
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    message: String,
    port: u16,
}

#[derive(Serialize)]
struct RootResponse {
    message: String,
    docs: String,
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        message: "Rust Axum backend is running".to_string(),
        port: ${port},
    })
}

async fn root() -> Json<RootResponse> {
    Json(RootResponse {
        message: "Welcome to Rust Axum backend API!".to_string(),
        docs: "/api/health".to_string(),
    })
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(root))
        .route("/api/health", get(health))
        .layer(CorsLayer::permissive());

    let addr = SocketAddr::from(([0, 0, 0, 0], ${port}));
    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => {
            println!("[rapidfire] Rust Axum backend listening on http://{}", addr);
            l
        }
        Err(err) => {
            eprintln!("[rapidfire] Error: Port ${port} is already in use ({}).", err);
            eprintln!("[rapidfire] Hint: Run 'stop ${port}' in Rapidfire or free port ${port} before running.");
            std::process::exit(1);
        }
    };
    if let Err(err) = axum::serve(listener, app).await {
        eprintln!("[rapidfire] Error serving Axum: {}", err);
    }
}
`;
  fse.writeFileSync(path.join(srcDir, 'main.rs'), mainRs, 'utf8');
  fse.writeFileSync(path.join(backendDir, '.gitignore'), `target/\nCargo.lock\n.env\n`, 'utf8');
  fse.writeFileSync(path.join(backendDir, 'README.md'), `# ${appName} Backend (Rust Axum)\n\`\`\`bash\ncargo run\n\`\`\`\n`, 'utf8');
}

function writeGoBackend(backendDir, appName, options = {}) {
  const port = options.port || 5000;
  fse.ensureDirSync(backendDir);
  console.log('[rapidfire] Scaffolding Go backend...');
  if (!isBinaryInPath('go')) {
    console.error('\x1b[31m[rapidfire] Error: No Go runtime found in your system PATH.\x1b[0m');
    console.log(`\x1b[33m[rapidfire] Hint: Installation instructions for your system:\x1b[0m\n${getGoInstallInstructions()}`);
  }
  const goMod = `module backend\n\ngo 1.21\n`;
  fse.writeFileSync(path.join(backendDir, 'go.mod'), goMod, 'utf8');
  const mainGo = `package main

import (
	"encoding/json"
	"fmt"
	"net/http"
)

type HealthResponse struct {
	Status  string \`json:"status"\`
	Message string \`json:"message"\`
	Port    int    \`json:"port"\`
}

type RootResponse struct {
	Message string \`json:"message"\`
	Docs    string \`json:"docs"\`
}

func enableCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	resp := HealthResponse{Status: "ok", Message: "Go backend is running", Port: ${port}}
	json.NewEncoder(w).Encode(resp)
}

func rootHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	resp := RootResponse{Message: "Welcome to Go backend API!", Docs: "/api/health"}
	json.NewEncoder(w).Encode(resp)
}

func main() {
	http.HandleFunc("/api/health", enableCORS(healthHandler))
	http.HandleFunc("/", enableCORS(rootHandler))
	fmt.Printf("[rapidfire] Go backend listening on port %d\\n", ${port})
	http.ListenAndServe(fmt.Sprintf(":%d", ${port}), nil)
}
`;
  fse.writeFileSync(path.join(backendDir, 'main.go'), mainGo, 'utf8');
  fse.writeFileSync(path.join(backendDir, '.gitignore'), `bin/\n*.exe\n.env\n`, 'utf8');
  fse.writeFileSync(path.join(backendDir, 'README.md'), `# ${appName} Backend (Go)\n\`\`\`bash\ngo run .\n\`\`\`\n`, 'utf8');
}

function writeRubyBackend(backendDir, appName, options = {}) {
  const port = options.port || 5000;
  fse.ensureDirSync(backendDir);
  console.log('[rapidfire] Scaffolding Ruby (Sinatra) backend...');
  if (!isBinaryInPath('ruby')) {
    console.error('\x1b[31m[rapidfire] Error: No Ruby runtime found in your system PATH.\x1b[0m');
    console.log(`\x1b[33m[rapidfire] Hint: Installation instructions for your system:\x1b[0m\n${getRubyInstallInstructions()}`);
  }
  const gemfile = `source 'https://rubygems.org'\ngem 'sinatra', '~> 4.0'\ngem 'sinatra-cross_origin', '~> 0.4.0'\ngem 'webrick', '~> 1.8'\ngem 'json', '~> 2.7'\n`;
  fse.writeFileSync(path.join(backendDir, 'Gemfile'), gemfile, 'utf8');
  const appRb = `require 'sinatra'
require 'sinatra/cross_origin'
require 'json'

configure do
  enable :cross_origin
  set :port, ${port}
  set :bind, '0.0.0.0'
end

before do
  response.headers['Access-Control-Allow-Origin'] = '*'
end

options "*" do
  response.headers["Allow"] = "GET, POST, OPTIONS"
  response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Accept"
  response.headers["Access-Control-Allow-Origin"] = "*"
  200
end

get '/api/health' do
  content_type :json
  { status: 'ok', message: 'Ruby Sinatra backend is running', port: ${port} }.to_json
end

get '/' do
  content_type :json
  { message: 'Welcome to Ruby Sinatra backend API!', docs: '/api/health' }.to_json
end
`;
  fse.writeFileSync(path.join(backendDir, 'app.rb'), appRb, 'utf8');
  fse.writeFileSync(path.join(backendDir, '.gitignore'), `vendor/\n.bundle/\n.env\n`, 'utf8');
  fse.writeFileSync(path.join(backendDir, 'README.md'), `# ${appName} Backend (Ruby Sinatra)\n\`\`\`bash\nruby app.rb\n\`\`\`\n`, 'utf8');
}

function writePhpBackend(backendDir, appName, options = {}) {
  const port = options.port || 5000;
  fse.ensureDirSync(backendDir);
  console.log('[rapidfire] Scaffolding PHP backend...');
  if (!isBinaryInPath('php')) {
    console.error('\x1b[31m[rapidfire] Error: No PHP runtime found in your system PATH.\x1b[0m');
    console.log(`\x1b[33m[rapidfire] Hint: Installation instructions for your system:\x1b[0m\n${getPhpInstallInstructions()}`);
  }
  const composerJson = {
    name: 'rapidfire/php-backend',
    description: 'PHP REST Backend scaffolded with Rapidfire CLI',
    require: { php: '>=8.0' }
  };
  fse.writeJsonSync(path.join(backendDir, 'composer.json'), composerJson, { spaces: 2 });
  const indexPhp = `<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if ($uri === '/api/health' || $uri === '/api/health/') {
    echo json_encode([
        "status" => "ok",
        "message" => "PHP backend is running",
        "port" => ${port}
    ]);
    exit();
}

echo json_encode([
    "message" => "Welcome to PHP backend API!",
    "docs" => "/api/health"
]);
`;
  fse.writeFileSync(path.join(backendDir, 'index.php'), indexPhp, 'utf8');
  const routerPhp = `<?php
$path = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);
if (file_exists(__DIR__ . $path) && !is_dir(__DIR__ . $path)) {
    return false;
}
require_once __DIR__ . '/index.php';
`;
  fse.writeFileSync(path.join(backendDir, 'router.php'), routerPhp, 'utf8');
  fse.writeFileSync(path.join(backendDir, '.gitignore'), `vendor/\n.env\n`, 'utf8');
  fse.writeFileSync(path.join(backendDir, 'README.md'), `# ${appName} Backend (PHP)\n\`\`\`bash\nphp -S 0.0.0.0:${port} router.php\n\`\`\`\n`, 'utf8');
}

function writeDotnetBackend(backendDir, appName, options = {}) {
  const port = options.port || 5000;
  fse.ensureDirSync(backendDir);
  console.log('[rapidfire] Scaffolding .NET (C#) Minimal API backend...');
  if (!isBinaryInPath('dotnet')) {
    console.error('\x1b[31m[rapidfire] Error: No .NET SDK found in your system PATH.\x1b[0m');
    console.log(`\x1b[33m[rapidfire] Hint: Installation instructions for your system:\x1b[0m\n${getDotnetInstallInstructions()}`);
  }
  const csproj = `<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
</Project>
`;
  fse.writeFileSync(path.join(backendDir, 'Backend.csproj'), csproj, 'utf8');
  const programCs = `var builder = WebApplication.CreateBuilder(args);
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
    });
});

var app = builder.Build();
app.UseCors();

app.MapGet("/api/health", () => Results.Json(new { status = "ok", message = ".NET backend is running", port = ${port} }));
app.MapGet("/", () => Results.Json(new { message = "Welcome to .NET backend API!", docs = "/api/health" }));

app.Run("http://0.0.0.0:${port}");
`;
  fse.writeFileSync(path.join(backendDir, 'Program.cs'), programCs, 'utf8');
  fse.writeFileSync(path.join(backendDir, '.gitignore'), `bin/\nobj/\n.env\n`, 'utf8');
  fse.writeFileSync(path.join(backendDir, 'README.md'), `# ${appName} Backend (.NET Minimal API)\n\`\`\`bash\ndotnet run\n\`\`\`\n`, 'utf8');
}

const BACKEND_ADAPTERS = {
  fastapi: writeFastAPIBackend,
  django: writeDjangoBackend,
  flask: writeFlaskBackend,
  express: writeExpressBackend,
  node: writeExpressBackend,
  hono: writeHonoBackend,
  fastify: writeFastifyBackend,
  nest: writeNestBackend,
  nestjs: writeNestBackend,
  koa: writeKoaBackend,
  rust: writeRustBackend,
  axum: writeRustBackend,
  actix: writeRustBackend,
  go: writeGoBackend,
  golang: writeGoBackend,
  gin: writeGoBackend,
  ruby: writeRubyBackend,
  sinatra: writeRubyBackend,
  php: writePhpBackend,
  dotnet: writeDotnetBackend,
  csharp: writeDotnetBackend
};

function hasBackendAdapter(name) {
  if (!name || typeof name !== 'string') return false;
  const normalized = normalizeBackendName(name);
  return Boolean(BACKEND_ADAPTERS[normalized]);
}

function getBackendAdapter(name) {
  if (!name || typeof name !== 'string') return null;
  const normalized = normalizeBackendName(name);
  return BACKEND_ADAPTERS[normalized] || null;
}

module.exports = {
  writeFastAPIBackend,
  writeExpressBackend,
  writeDjangoBackend,
  writeFlaskBackend,
  writeHonoBackend,
  writeFastifyBackend,
  writeNestBackend,
  writeKoaBackend,
  writeRustBackend,
  writeGoBackend,
  writeRubyBackend,
  writePhpBackend,
  writeDotnetBackend,
  configureDjangoCorsAndHealth,
  normalizeBackendName,
  getBackendDefaultPort,
  BACKEND_ADAPTERS,
  hasBackendAdapter,
  getBackendAdapter
};
