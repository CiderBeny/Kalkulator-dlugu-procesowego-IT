const h = require('http');
const fs = require('fs');
const p = require('path');

const mime = { '.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.webp':'image/webp','.ico':'image/x-icon' };

const BLOCKED_EXACT = new Set([
    'README.md', 'AGENTS.md', 'package.json', 'package-lock.json', 'src/input.css',
    'scripts/dev-server.js', 'src/security.test.js', 'src/model-audit.test.js',
    'src/sensitivity-views.test.js',
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

// Security headers — mirror of the meta CSP in index.html (frame-ancestors is
// only enforced via HTTP header, not <meta>). Kept in sync with index.html.
const SECURITY_HEADERS = {
    'Content-Security-Policy': "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.js https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js https://gc.zgo.at; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https://gc.zgo.at; connect-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com https://api.nbp.pl https://process-debt-engine.goatcounter.com; form-action 'none'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; worker-src 'self';",
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'geolocation=(), camera=(), microphone=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=(), midi=(), sync-xhr=(), interest-cohort=()',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
};

if (require.main === module) {
    h.createServer((r, s) => {
        const rel = serveAllowedPath(r.url === '/' ? '/' : r.url.slice(1));
        if (rel === null) { s.writeHead(404); s.end('not found'); return; }
        const ext = p.extname(rel);
        const full = p.join('.', rel);
        try {
            const c = fs.readFileSync(full);
            s.writeHead(200, Object.assign(
                { 'Content-Type': mime[ext] || 'text/plain',
                  'Access-Control-Allow-Origin': '*' },
                SECURITY_HEADERS
            ));
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
    module.exports = {
        serveAllowedPath: serveAllowedPath,
        BLOCKED_EXACT: BLOCKED_EXACT,
        SECURITY_HEADERS: SECURITY_HEADERS
    };
}