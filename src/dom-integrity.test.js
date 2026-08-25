// DOM integrity — every literal getElementById('X') target exists in index.html
//
// A renamed or removed element id currently degrades gracefully at runtime
// (PDE.setText/PDE.setHTML guards), but this static check catches the drift
// at test time instead of silently hiding one widget in production.
//
// Limitation (by design): only string-literal lookups are audited. Ids built
// at runtime through variables (e.g. the Monte Carlo keyMap in
// ui-renderers.js) are out of scope for this test.

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SRC_DIR = __dirname;
const ROOT = path.join(SRC_DIR, '..');

function collectReferencedIds() {
    // id -> [{ file, line }]
    const refs = new Map();
    const files = fs.readdirSync(SRC_DIR)
        .filter(f => f.endsWith('.js') && !f.endsWith('.test.js'));
    for (const f of files) {
        const text = fs.readFileSync(path.join(SRC_DIR, f), 'utf8');
        text.split(/\r?\n/).forEach((lineText, i) => {
            const re = /getElementById\(\s*'([^']+)'\s*\)/g;
            let m;
            while ((m = re.exec(lineText)) !== null) {
                if (!refs.has(m[1])) refs.set(m[1], []);
                refs.get(m[1]).push({ file: f, line: i + 1 });
            }
        });
    }
    return refs;
}

function collectDefinedIds() {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const ids = new Set();
    const re = /\bid="([^"]+)"/g;
    let m;
    while ((m = re.exec(html)) !== null) ids.add(m[1]);
    return ids;
}

describe('DOM integrity — getElementById targets exist in index.html', () => {
    const refs = collectReferencedIds();
    const defined = collectDefinedIds();

    it('collects a meaningful number of literal references (sanity)', () => {
        assert.ok(refs.size >= 30,
            `expected >= 30 referenced ids across src/*.js, got ${refs.size}`);
    });

    it('every referenced id is defined in index.html', () => {
        const missing = [...refs.entries()]
            .filter(([id]) => !defined.has(id))
            .map(([id, locs]) =>
                `- ${id}  (referenced at ${locs.map(l => `${l.file}:${l.line}`).join(', ')})`);
        assert.deepStrictEqual(missing, [],
            `ids referenced in JS but absent from index.html:\n${missing.join('\n')}`);
    });
});
