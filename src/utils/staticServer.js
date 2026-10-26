const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const initialPort = parseInt(process.argv[3], 10) || 3000;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8'
};

function startServer(portToTry) {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);
    if (pathname === '/') {
      pathname = '/index.html';
    }

    let filePath = path.join(rootDir, pathname);

    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      const indexInDir = path.join(filePath, 'index.html');
      if (fs.existsSync(indexInDir)) {
        filePath = indexInDir;
      }
    }

    if (!fs.existsSync(filePath)) {
      const fallbackHtml = path.join(rootDir, 'index.html');
      if (fs.existsSync(fallbackHtml) && !path.extname(pathname)) {
        filePath = fallbackHtml;
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && portToTry < initialPort + 20) {
      startServer(portToTry + 1);
    } else {
      console.error(`[rapidfire] Static server error: ${err.message}`);
      process.exit(1);
    }
  });

  server.listen(portToTry, () => {
    console.log(`\n  ➜  Local:   http://localhost:${portToTry}/`);
    console.log(`  ➜  Directory: ${rootDir}\n`);
  });
}

startServer(initialPort);
