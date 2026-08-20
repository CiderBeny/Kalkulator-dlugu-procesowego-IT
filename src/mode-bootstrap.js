// ═══════════════════════════════════════════════════════════════
// Mode bootstrap — applies the Quick/Full model mode before first
// paint so a Quick-mode visitor never sees a flash of the full
// layout. Loaded synchronously (no defer) right after
// font-bootstrap.js, so the <html> class is set before <body> is
// parsed. CSP-safe: it is an external 'self' script — the meta CSP
// has no 'unsafe-inline', so inline scripts cannot be used here.
//
// Priority: URL hash (#...&mode=quick|full) > localStorage
// (pde_mode) > default 'quick'. The resolved value is also exposed
// as window.__pdeMode for state.js/main.js to consume.
// ═══════════════════════════════════════════════════════════════
(function () {
    if (typeof document === 'undefined') return; // node/test environment
    let mode = 'quick';
    try {
        const h = (location.hash || '').slice(1);
        const m = (h.match(/(?:^|&)mode=(quick|full)(?:&|$)/) || [])[1];
        if (m) {
            mode = m;
        } else {
            const s = localStorage.getItem('pde_mode');
            if (s === 'full') mode = 'full';
        }
    } catch {
        // localStorage/hash unavailable (private browsing, storage quota) —
        // fall back to the default 'quick'.
    }
    document.documentElement.classList.add(mode === 'quick' ? 'mode-quick' : 'mode-full');
    window.__pdeMode = mode;
})();