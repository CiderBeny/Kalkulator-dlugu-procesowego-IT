const h = require('http');
const fs = require('fs');
const p = require('path');

const mime = { '.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.webp':'image/webp','.ico':'image/x-icon' };

const BLOCKED_EXACT = new Set([
    'README.md', 'AGENTS.md', 'package.json', 'package-lock.json', 'src/input.css',
]);

// Decide whether a raw URL path may be served. Returns a safe relative path,
// 'index.html' for the root, or null when the request must be rejected.
function serveAllowedPath(rawUrlPath) {
    let decoded;
    try { decoded = decodeURIComponent(rawUrlPath); } catch { return null; }
    const slash = decoded.replace(/\\/g, '/');
    if (slash === '/' || slash === '') return 'index.html';

    const segs = slash.split('/');
    if (segs.some(function (s) { return s === '' || s === '.'; })) {
        // allow a single leading '' produced by a leading '/' but nothing else
        if (!(segs.length === 2 && segs[0] === '' && segs[1] !== '')) return null;
    }
    if (segs.some(function (s) { return s === '..'; })) return null; // traversal

    const rel = segs.join('/').replace(/^\/+/, '');
    if (rel === '') return null;

    // Block dotfiles/dot-dirs any depth (e.g. .git, .github, .nojekyll) and
    // any hidden file. PROJECT security: never expose tooling/metadata.
    if (rel.split('/').some(function (s) { return s.charAt(0) === '.'; })) return null;

    if (BLOCKED_EXACT.has(rel)) return null;

    const base = rel.split('/')[0];
    if (base === 'node_modules' || base.startsWith('_')) return null;

    return rel;
}

if (require.main === module) {
    h.createServer((r, s) => {
        const rel = serveAllowedPath(r.url === '/' ? '/' : r.url.slice(1));
        if (rel === null) { s.writeHead(404); s.end('not found'); return; }
        const ext = p.extname(rel);
        const full = p.join('.', rel);
        try {
            const c = fs.readFileSync(full);
            s.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain',
                               'Access-Control-Allow-Origin': '*',
                               'X-Content-Type-Options': 'nosniff',
                               'Cache-Control': 'no-store' });
            s.end(c);
        } catch {
            s.writeHead(404);
            s.end('not found');
        }
    }).listen(parseInt(process.argv[2] || '8080'), '127.0.0.1',
        () => console.log('OK http://127.0.0.1:' + (process.argv[2] || '8080')));
}

// Export for unit tests (security.test.js).
if (require.main !== module) {
    module.exports = { serveAllowedPath: serveAllowedPath, BLOCKED_EXACT: BLOCKED_EXACT };
}