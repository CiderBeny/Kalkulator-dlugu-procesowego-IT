// ═══════════════════════════════════════════════════════════════
// URL hash state — encode, decode, copy share link
// ═══════════════════════════════════════════════════════════════
window.PDE = window.PDE || {};

// ── Quick estimate vs Full model mode ──
PDE.currentMode = 'quick';

PDE.readMode = function readMode() {
    if (window.__pdeMode === 'quick' || window.__pdeMode === 'full') return window.__pdeMode;
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
    } catch { /* hash/localStorage unavailable — default to quick */ }
    return mode;
};

PDE.setMode = function setMode(mode, silent) {
    const next = mode === 'full' ? 'full' : 'quick';
    PDE.currentMode = next;
    const isQuick = next === 'quick';
    document.documentElement.classList.toggle('mode-quick', isQuick);
    document.documentElement.classList.toggle('mode-full', !isQuick);
    document.body.classList.toggle('mode-quick', isQuick);
    document.body.classList.toggle('mode-full', !isQuick);
    document.querySelectorAll('.mode-btn').forEach(btn => {
        const active = btn.getAttribute('data-mode') === next;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-checked', String(active));
    });
    try { localStorage.setItem('pde_mode', next); } catch { /* ignore */ }

    if (silent) return;

    const parts = (location.hash || '').slice(1).split('&').filter(p => p && p.indexOf('mode=') !== 0);
    history.replaceState(null, '', '#' + (parts.length ? parts.join('&') + '&' : '') + 'mode=' + next);
    if (typeof PDE.calculate === 'function') PDE.calculate();
};

PDE.encodeState = function encodeState() {
    const ids = [...PDE.ALLOWED_HASH_KEYS];
    const vals = ids.map(id => document.getElementById(id).value);
    const hash = ids.map((id,i) => id+'='+encodeURIComponent(vals[i])).join('&');
    history.replaceState(null, '', '#' + hash + '&mode=' + (PDE.currentMode || 'quick'));
};

PDE._encodeStateTimeout = null;
PDE.encodeStateDebounced = function encodeStateDebounced() {
    clearTimeout(PDE._encodeStateTimeout);
    PDE._encodeStateTimeout = setTimeout(PDE.encodeState, 300);
};

PDE.decodeState = function decodeState() {
    if (!location.hash || location.hash.length < 3) return;
    const pairs = location.hash.slice(1).split('&');
    pairs.forEach(pair => {
        const eqIdx = pair.indexOf('=');
        if (eqIdx === -1) return;
        const key = pair.slice(0, eqIdx);
        const raw = pair.slice(eqIdx + 1);

        if (key === 'mode') {
            let decoded;
            try { decoded = decodeURIComponent(raw); } catch { return; }
            if (decoded === 'full' || decoded === 'quick') PDE.setMode(decoded, true);
            return;
        }

        if (!PDE.ALLOWED_HASH_KEYS.has(key)) return;

        let decoded;
        try { decoded = decodeURIComponent(raw); } catch { return; }

        const num = parseFloat(decoded);
        if (!isFinite(num)) return;

        const { min, max } = PDE.HASH_CONSTRAINTS[key];
        const safe = Math.min(max, Math.max(min, num));

        const el = document.getElementById(key);
        if (!el) return;
        const monetaryIds = ['q4', 'q6', 'q8', 'capex'];
        if (monetaryIds.includes(key)) {
            el.value = (safe * PDE.EXCHANGE_RATES[PDE.currentCurrency]).toFixed(2);
        } else {
            el.value = safe;
        }
    });
};

PDE.copyShareLink = function copyShareLink() {
    PDE.encodeState();
    const url = location.href;
    const btn = document.getElementById('copyLinkBtn');
    const orig = btn.textContent;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url)
            .then(() => PDE.flashBtn(btn, orig))
            .catch(() => PDE.fallbackCopy(btn, orig, url));
    } else {
        PDE.fallbackCopy(btn, orig, url);
    }
};

PDE.fallbackCopy = function fallbackCopy(btn, orig, url) {
    try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        PDE.flashBtn(btn, orig);
    } catch {
        prompt('Copy this link (Ctrl+C / \u2318+C):', url);
    }
};

// ── Advanced toggle visibility (show/hide slider sections) ──
PDE.TOGGLE_MAP = {
    correlationsToggle: ['correlationSliders'],
    probabilisticToggle: ['mcSliders'],
    advancedRiskToggle: ['riskWeightSliders'],
};

PDE.applyToggleVisibility = function (id) {
    const checked = document.getElementById(id) ? document.getElementById(id).checked : false;
    const targets = PDE.TOGGLE_MAP[id];
    if (targets) {
        targets.forEach(function (tid) {
            const el = document.getElementById(tid);
            if (el) el.style.display = checked ? 'block' : 'none';
        });
    }
};

// ── localStorage persistence for toggle states ──
PDE.TOGGLE_IDS = ['correlationsToggle','nonlinearToggle','probabilisticToggle','advancedRiskToggle'];

PDE.saveToggleStates = function () {
    const states = {};
    PDE.TOGGLE_IDS.forEach(function (id) {
        const el = document.getElementById(id);
        states[id] = el ? el.checked : false;
    });
    try {
        localStorage.setItem('PDE.toggleStates', JSON.stringify(states));
    } catch { /* localStorage unavailable */ }
};

PDE.loadToggleStates = function () {
    let raw;
    try {
        raw = localStorage.getItem('PDE.toggleStates');
    } catch { return; }
    if (!raw) return;
    let states;
    try { states = JSON.parse(raw); } catch { return; }
    if (!states || typeof states !== 'object') return;
    PDE.TOGGLE_IDS.forEach(function (id) {
        if (typeof states[id] === 'boolean') {
            const el = document.getElementById(id);
            if (el) {
                el.checked = states[id];
                PDE.applyToggleVisibility(id);
            }
        }
    });
};


