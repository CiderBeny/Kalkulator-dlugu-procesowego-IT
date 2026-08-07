const { describe, it } = require('node:test');
const assert = require('node:assert');

// ── Security functions (replicated from index.html) ──────────────

function esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sanitizeCell(v) {
    return typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
}

const _FONT_ALLOWED_FAMILIES = { 'Space Grotesk': true, 'Inter': true };
const _FONT_ALLOWED_STYLES   = { 'normal': true, 'italic': true, 'oblique': true };
const _FONT_ALLOWED_FMTS     = { 'woff2': true, 'woff': true, 'truetype': true };
const _FONT_B64_RE           = /^[A-Za-z0-9+/]+=*$/;
const _FONT_B64_MAX_LEN      = 700000;

function validateFontFace(f) {
    if (!f || typeof f !== 'object')                          return null;
    if (!_FONT_ALLOWED_FAMILIES[f.family])                    return null;
    if (!/^\d+$/.test(String(f.weight)))                      return null;
    const w = parseInt(f.weight, 10);
    if (w < 100 || w > 900 || w % 100 !== 0)                 return null;
    if (!_FONT_ALLOWED_STYLES[f.style])                       return null;
    if (!_FONT_ALLOWED_FMTS[f.fmt])                           return null;
    if (typeof f.b64 !== 'string')                            return null;
    if (f.b64.length === 0 || f.b64.length > _FONT_B64_MAX_LEN) return null;
    if (!_FONT_B64_RE.test(f.b64))                            return null;
    return { family: f.family, weight: String(w), style: f.style,
             fmt: f.fmt, b64: f.b64 };
}

const HASH_CONSTRAINTS = {
    q1:        { min: 0,   max: 100   },
    q2:        { min: 0,   max: 8760  },
    q3:        { min: 1,   max: 5     },
    q4:        { min: 0,   max: 1e7   },
    q5:        { min: 0,   max: 9999  },
    q11:       { min: 0,   max: 168   },
    q6:        { min: 0,   max: 5000  },
    q7:        { min: 0,   max: 744   },
    q8:        { min: 0,   max: 1e9   },
    q9:        { min: 1,   max: 5     },
    q10:       { min: 0,   max: 100   },
    autoLevel: { min: 0,   max: 100   },
    capex:     { min: 0,   max: 1e9   },
    teamSize:  { min: 1,   max: 10000 },
};

// ── Tests ────────────────────────────────────────────────────────

describe('esc() — XSS guard', () => {
    it('escapes & to &amp;', () => {
        assert.strictEqual(esc('&'), '&amp;');
    });
    it('escapes < to &lt;', () => {
        assert.strictEqual(esc('<script>'), '&lt;script&gt;');
    });
    it('escapes > to &gt;', () => {
        assert.strictEqual(esc('>'), '&gt;');
    });
    it('escapes " to &quot;', () => {
        assert.strictEqual(esc('"'), '&quot;');
    });
    it("escapes ' to &#39;", () => {
        assert.strictEqual(esc("'"), '&#39;');
    });
    it('handles mixed XSS payload', () => {
        const payload = "<img src=x onerror=alert(1)>";
        const result = esc(payload);
        assert.strictEqual(result.includes('&lt;'), true);
        assert.strictEqual(result.includes('&gt;'), true);
        assert.strictEqual(result.includes('onerror'), true);
    });
    it('safe strings pass through unchanged', () => {
        assert.strictEqual(esc('hello world'), 'hello world');
    });
    it('numbers are coerced to strings', () => {
        assert.strictEqual(esc(42), '42');
    });
});

describe('sanitizeCell() — Excel formula injection guard', () => {
    it("prefixes = with '", () => {
        assert.strictEqual(sanitizeCell('=SUM(A1:A2)'), "'=SUM(A1:A2)");
    });
    it("prefixes + with '", () => {
        assert.strictEqual(sanitizeCell('+123'), "'+123");
    });
    it("prefixes - with '", () => {
        assert.strictEqual(sanitizeCell('-1+2'), "'-1+2");
    });
    it("prefixes @ with '", () => {
        assert.strictEqual(sanitizeCell('@SUM'), "'@SUM");
    });
    it('allows normal strings', () => {
        assert.strictEqual(sanitizeCell('Normal text'), 'Normal text');
    });
    it('allows numbers', () => {
        assert.strictEqual(sanitizeCell(42), 42);
    });
    it('allows null', () => {
        assert.strictEqual(sanitizeCell(null), null);
    });
});

describe('validateFontFace() — localStorage font cache validation', () => {
    const validFace = {
        family: 'Inter',
        weight: '400',
        style: 'normal',
        fmt: 'woff2',
        b64: 'dGVzdC1mb250LWRhdGE='
    };

    it('accepts valid font face', () => {
        const result = validateFontFace(validFace);
        assert.notStrictEqual(result, null);
        assert.strictEqual(result.family, 'Inter');
        assert.strictEqual(result.weight, '400');
    });

    it('rejects null', () => {
        assert.strictEqual(validateFontFace(null), null);
    });

    it('rejects non-object', () => {
        assert.strictEqual(validateFontFace('string'), null);
    });

    it('rejects disallowed family', () => {
        assert.strictEqual(validateFontFace({ ...validFace, family: 'Comic Sans' }), null);
    });

    it('rejects non-numeric weight', () => {
        assert.strictEqual(validateFontFace({ ...validFace, weight: 'bold' }), null);
    });

    it('rejects weight < 100', () => {
        assert.strictEqual(validateFontFace({ ...validFace, weight: '50' }), null);
    });

    it('rejects weight > 900', () => {
        assert.strictEqual(validateFontFace({ ...validFace, weight: '1000' }), null);
    });

    it('rejects weight not multiple of 100', () => {
        assert.strictEqual(validateFontFace({ ...validFace, weight: '450' }), null);
    });

    it('rejects disallowed style', () => {
        assert.strictEqual(validateFontFace({ ...validFace, style: 'wavy' }), null);
    });

    it('rejects disallowed format', () => {
        assert.strictEqual(validateFontFace({ ...validFace, fmt: 'eot' }), null);
    });

    it('rejects empty b64', () => {
        assert.strictEqual(validateFontFace({ ...validFace, b64: '' }), null);
    });

    it('rejects b64 with invalid characters', () => {
        assert.strictEqual(validateFontFace({ ...validFace, b64: '!!!invalid!!!' }), null);
    });

    it('rejects oversized b64', () => {
        assert.strictEqual(validateFontFace({ ...validFace, b64: 'A'.repeat(700001) }), null);
    });

    it('strips extra keys from returned object', () => {
        const result = validateFontFace({ ...validFace, malicious: 'payload' });
        assert.notStrictEqual(result, null);
        assert.strictEqual(result.malicious, undefined);
    });

    it('accepts weight 900', () => {
        const result = validateFontFace({ ...validFace, weight: '900' });
        assert.notStrictEqual(result, null);
    });

    it('accepts Space Grotesk family', () => {
        const result = validateFontFace({ ...validFace, family: 'Space Grotesk' });
        assert.notStrictEqual(result, null);
    });
});

describe('HASH_CONSTRAINTS — input bounds validation', () => {
    it('q1 manual effort: 0–100', () => {
        assert.strictEqual(HASH_CONSTRAINTS.q1.min, 0);
        assert.strictEqual(HASH_CONSTRAINTS.q1.max, 100);
    });
    it('q3 documentation: 1–5', () => {
        assert.strictEqual(HASH_CONSTRAINTS.q3.min, 1);
        assert.strictEqual(HASH_CONSTRAINTS.q3.max, 5);
    });
    it('teamSize min is 1 (cannot be zero or negative)', () => {
        assert.strictEqual(HASH_CONSTRAINTS.teamSize.min, 1);
    });
    it('capex max is 1e9', () => {
        assert.strictEqual(HASH_CONSTRAINTS.capex.max, 1e9);
    });
    it('all 14 fields have defined constraints', () => {
        const keys = ['q1','q2','q3','q4','q5','q11','q6','q7','q8','q9','q10','autoLevel','capex','teamSize'];
        keys.forEach(k => {
            assert.ok(HASH_CONSTRAINTS[k], `Missing constraint for ${k}`);
            assert.strictEqual(typeof HASH_CONSTRAINTS[k].min, 'number');
            assert.strictEqual(typeof HASH_CONSTRAINTS[k].max, 'number');
        });
    });
});

describe('decodeState — malformed hash do not break initialization', () => {
    it('tolerates malformed percent-encoding (e.g. %zz) without throwing', () => {
        global.window = global;
        const els = { q2: { value: '' } };
        global.document = {
            getElementById: (id) => els[id] || null,
        };
        global.location = { hash: '#q1=%zz&q2=100&unknown=1' };
        global.history = { replaceState: () => {} };

        require('./config.js');
        require('./i18n.js');
        require('./utils.js');
        require('./state.js');

        assert.doesNotThrow(() => PDE.decodeState(), 'decodeState must not throw on malformed hash');

        const q2 = els.q2 ? els.q2.value : null;
        assert.strictEqual(q2, 100, 'valid pair after malformed pair still decoded');
        assert.strictEqual(els.q1, undefined, 'malformed q1 element untouched');
    });
});

describe('dev-server serveAllowedPath — never expose repository internals', () => {
    const { serveAllowedPath } = require('../scripts/dev-server.js');

    it('serves root and normal app resources', () => {
        assert.strictEqual(serveAllowedPath('/'), 'index.html');
        assert.strictEqual(serveAllowedPath('index.html'), 'index.html');
        assert.strictEqual(serveAllowedPath('output.css'), 'output.css');
        assert.strictEqual(serveAllowedPath('src/model.js'), 'src/model.js');
        assert.strictEqual(serveAllowedPath('fonts/Inter-Regular.ttf'), 'fonts/Inter-Regular.ttf');
    });

    it('blocks dotfiles and dot-directories at any depth', () => {
        assert.strictEqual(serveAllowedPath('.git/config'), null);
        assert.strictEqual(serveAllowedPath('.git/HEAD'), null);
        assert.strictEqual(serveAllowedPath('.hidden'), null);
        assert.strictEqual(serveAllowedPath('src/.hidden.js'), null);
        assert.strictEqual(serveAllowedPath('.nojekyll'), null);
        assert.strictEqual(serveAllowedPath('src'), 'src');
    });

    it('blocks traversal attempts', () => {
        assert.strictEqual(serveAllowedPath('../etc/passwd'), null);
        assert.strictEqual(serveAllowedPath('src/../../../file'), null);
        assert.strictEqual(serveAllowedPath('..%2f..%2fetc%2fpasswd'), null);
    });

    it('rejects malformed percent-encoding', () => {
        assert.strictEqual(serveAllowedPath('%zz'), null);
    });

    it('rejects tooling manifests and node_modules', () => {
        assert.strictEqual(serveAllowedPath('package.json'), null);
        assert.strictEqual(serveAllowedPath('package-lock.json'), null);
        assert.strictEqual(serveAllowedPath('README.md'), null);
        assert.strictEqual(serveAllowedPath('AGENTS.md'), null);
        assert.strictEqual(serveAllowedPath('node_modules/x/y.js'), null);
        assert.strictEqual(serveAllowedPath('_headers'), null);
    });

    it('still serves the Tailwind source input only via blocked path', () => {
        assert.strictEqual(serveAllowedPath('src/input.css'), null);
    });
});
