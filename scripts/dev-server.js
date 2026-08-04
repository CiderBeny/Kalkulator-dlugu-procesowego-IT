const h = require('http');
const fs = require('fs');
const p = require('path');
const mime = { '.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf' };
h.createServer((r, s) => {
  let f = r.url === '/' ? 'index.html' : r.url.slice(1);
  let ext = p.extname(f);
  try {
    let c = fs.readFileSync(p.join('.', f));
    s.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain', 'Access-Control-Allow-Origin': '*' });
    s.end(c);
  } catch {
    s.writeHead(404);
    s.end('not found');
  }
}).listen(parseInt(process.argv[2] || '8080'), () => console.log('OK ' + (process.argv[2] || '8080')));
