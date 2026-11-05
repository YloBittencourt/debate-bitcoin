// Servidor local (mesmas regras da Vercel): node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { handle, HOST_KEY } = require('./lib/app');

const PORT = process.env.PORT || 3000;
const html = () => fs.readFileSync(path.join(__dirname, 'public', 'index.html'));

http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  if (req.method === 'GET' && (pathname === '/' || pathname === '/host')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html());
  }
  const m = pathname.match(/^\/api\/(state|join|vote|host)$/);
  if (!m) { res.statusCode = 404; return res.end('Não encontrado'); }
  let d = '';
  req.on('data', (c) => { d += c; if (d.length > 1e5) req.destroy(); });
  req.on('end', () => {
    try { req.body = d ? JSON.parse(d) : {}; } catch (_) { req.body = {}; }
    handle(m[1], req, res);
  });
}).listen(PORT, () => console.log('Alunos: http://localhost:' + PORT + '/  |  Painel: http://localhost:' + PORT + '/host  (chave: ' + HOST_KEY + ')'));
