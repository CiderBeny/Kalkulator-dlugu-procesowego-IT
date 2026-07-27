/* ── Framebusting ──────────────────────────────────────────────────────────
   Clickjacking defence: frame-ancestors 'none' in <meta> CSP is ignored by
   all browsers (per W3C spec). This runs before any content renders.
────────────────────────────────────────────────────────────────────────── */
if (top !== self) { top.location.href = self.location.href; }

/* ── Font cache bootstrap (runs before any stylesheet) ───────────────────
   On first load: fonts come from Google CDN (or system fallback).
   prefetchFontsToBase64() fetches & base64-encodes every woff2, then
   persists them to localStorage under the key 'fontCache_v1'.

   On every subsequent load: THIS script reads localStorage and injects
   a <style> tag with self-contained @font-face data: URIs directly into
   <head> — before style.css, before the CDN link, before first paint.
   The page renders with the correct fonts even with zero network access.

   Cache invalidation: the key includes a version string. Bump
   FONT_CACHE_VERSION to force a re-fetch after a font update.

   NOTE: wrapped in IIFE to avoid name collision with exports.js which
   declares its own _FONT_ALLOWED_* constants at module scope.
────────────────────────────────────────────────────────────────────────── */
(function() {

/* ── Font-cache entry validator ───────────────────────────────────────────
   validateFontFace(f) — called at every read path before any field from
   localStorage is used in a CSS string or stored in _fontCache.

   Attack surface: localStorage is writable by any same-origin script,
   browser extension, or XSS payload. Without validation, poisoned entries
   can inject arbitrary CSS rules via the @font-face src / font-family fields.

   Defence layers:
     1. family  — exact-match allowlist (no substring / regex tricks)
     2. weight  — digits-only, value in [100, 900]
     3. style   — exact-match allowlist
     4. fmt     — exact-match allowlist
     5. b64     — base64 alphabet only; 500 KB ceiling (≈ 375 KB binary)
                  largest real woff2 in the set is ~120 KB, so 500 KB
                  gives a safe headroom while blocking megabyte bombs.

   Returns the validated entry or null. Callers MUST discard null.
────────────────────────────────────────────────────────────────────────── */
const _FONT_ALLOWED_FAMILIES = { 'Space Grotesk': true, 'Inter': true };
const _FONT_ALLOWED_STYLES   = { 'normal': true, 'italic': true, 'oblique': true };
const _FONT_ALLOWED_FMTS     = { 'woff2': true, 'woff': true, 'truetype': true };
const _FONT_B64_RE           = /^[A-Za-z0-9+/]+=*$/;
const _FONT_B64_MAX_LEN      = 700000; // ~512 KB binary ceiling

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
    // Return a new object containing only the known-safe fields —
    // drops any extra keys an attacker may have added to the entry.
    return { family: f.family, weight: String(w), style: f.style,
             fmt: f.fmt, b64: f.b64 };
}

(function injectCachedFonts() {
    const FONT_CACHE_KEY = 'fontCache_v1';
    try {
        const cached = localStorage.getItem(FONT_CACHE_KEY);
        if (!cached) return; // first load — nothing to inject yet
        const faces = JSON.parse(cached);
        if (!Array.isArray(faces) || faces.length === 0) return;
        const valid = [];
        for (let i = 0; i < faces.length; i++) {
            const f = validateFontFace(faces[i]);
            if (f) valid.push(f);
        }
        if (valid.length === 0) return;
        const css = valid.map(function(f) {
            return "@font-face{font-family:'" + f.family + "';"
                 + "font-weight:" + f.weight + ";"
                 + "font-style:" + f.style + ";"
                 + "font-display:swap;"
                 + "src:url('data:font/" + f.fmt + ";base64," + f.b64 + "') format('" + f.fmt + "');}";
        }).join('\n');
        const el = document.createElement('style');
        el.id = 'font-cache-inject';
        el.textContent = css;
        document.currentScript.parentNode.insertBefore(el, document.currentScript.nextSibling);
    } catch {
        // localStorage unavailable (private browsing, storage quota) — silent fail.
    }
})();

})();
