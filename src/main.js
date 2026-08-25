// ═══════════════════════════════════════════════════════════════
// Main entry — DOMContentLoaded + window.onload
// ═══════════════════════════════════════════════════════════════
window.PDE = window.PDE || {};

document.addEventListener('DOMContentLoaded', () => {
    const gFont = document.getElementById('googleFontsSheet');
    if (gFont) gFont.media = 'all';

    const setTipOpen = function (el, open) {
        el.classList.toggle('tip-open', open);
        el.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    document.querySelectorAll('.formula-tip').forEach(el => {
        el.setAttribute('aria-expanded', 'false');
        el.addEventListener('click', e => {
            e.stopPropagation();
            const isOpen = el.classList.contains('tip-open');
            document.querySelectorAll('.formula-tip').forEach(t => setTipOpen(t, false));
            if (!isOpen) setTipOpen(el, true);
        });
        el.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const isOpen = el.classList.contains('tip-open');
                document.querySelectorAll('.formula-tip').forEach(t => setTipOpen(t, false));
                if (!isOpen) setTipOpen(el, true);
            }
            if (e.key === 'Escape') {
                setTipOpen(el, false);
                el.blur();
            }
        });
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.tab-btn').forEach(b => {
                b.style.borderBottomColor = 'transparent';
                b.style.color = 'var(--text-muted)';
            });
            this.style.borderBottomColor = 'var(--accent)';
            this.style.color = 'var(--accent)';
            document.querySelectorAll('.tab-content').forEach(tc => tc.style.display = 'none');
            const tabId = 'tab-' + this.getAttribute('data-tab');
            const target = document.getElementById(tabId);
            if (target) target.style.display = '';
        });
    });

    // ── Sticky progress nav: phase tabs ──
    const PROGRESS_TABS = [
        { id: 'pdf-block-1a',   tab: document.querySelector('[data-progress-tab="pdf-block-1a"]') },
        { id: 'pdf-block-2',    tab: document.querySelector('[data-progress-tab="pdf-block-2"]') },
        { id: 'report-content', tab: document.querySelector('[data-progress-tab="report-content"]') }
    ];
    const setActiveProgress = function (id) {
        PROGRESS_TABS.forEach(function (entry) {
            if (entry.tab) entry.tab.classList.toggle('active', entry.id === id);
        });
    };
    PROGRESS_TABS.forEach(function (entry) {
        if (!entry.tab) return;
        entry.tab.addEventListener('click', function () {
            const el = document.getElementById(entry.id);
            if (el) {
                el.scrollIntoView();
                setActiveProgress(entry.id);
            }
        });
    });
    if (typeof IntersectionObserver !== 'undefined') {
        let progressObserver = null;
        let progressNavHeight = 0;
        const initProgressObserver = function () {
            const nav = document.querySelector('nav');
            progressNavHeight = nav ? nav.offsetHeight : 0;
            if (progressObserver) progressObserver.disconnect();
            progressObserver = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) setActiveProgress(entry.target.id);
                });
            }, { rootMargin: '-' + progressNavHeight + 'px 0px -55% 0px', threshold: 0 });
            PROGRESS_TABS.forEach(function (entry) {
                const el = document.getElementById(entry.id);
                if (el) progressObserver.observe(el);
            });
        };
        initProgressObserver();
        window.addEventListener('resize', function () {
            const nav = document.querySelector('nav');
            const h = nav ? nav.offsetHeight : 0;
            if (h !== progressNavHeight) initProgressObserver();
        });
    }

    // ── Reset scenario defaults ──
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        const RESET_DEFAULTS = {
            q1: 40, q2: 72, q3: 2, q4: 10000, q5: 3, q6: 150,
            q7: 30, q8: 200000, q9: 4, q10: 15, autoLevel: 40,
            capex: 50000, teamSize: 10
        };
        resetBtn.addEventListener('click', function () {
            Object.keys(RESET_DEFAULTS).forEach(function (id) {
                const el = document.getElementById(id);
                if (el) el.value = RESET_DEFAULTS[id];
            });
            history.replaceState(null, '', window.location.pathname + window.location.search + '#mode=' + (PDE.currentMode || 'quick'));
            PDE.ALLOWED_HASH_KEYS.forEach(function (id) { PDE.validateField(id); });
            PDE.calculate();
        });
    }

    // ── Advanced Questions toggle ──
    const toggleAdvQ = document.getElementById('toggleAdvancedQuestions');
    const advQContainer = document.getElementById('advancedQuestions');
    if (toggleAdvQ && advQContainer) {
        toggleAdvQ.addEventListener('click', function () {
            const isHidden = advQContainer.style.display === 'none' || advQContainer.style.display === '';
            advQContainer.style.display = isHidden ? 'block' : 'none';
            const span = toggleAdvQ.querySelector('[data-i18n]');
            if (span) {
                const key = isHidden ? 'hideAdvanced' : 'showAdvanced';
                span.textContent = PDE.TRANSLATIONS[PDE.currentLang][key] || key;
                span.setAttribute('data-i18n', key);
            }
        });
    }

    // ── Advanced Metrics toggle ──
    const toggleMetrics = document.getElementById('toggleAdvancedMetrics');
    const metricsGrid = document.getElementById('pdf-block-3');
    if (toggleMetrics && metricsGrid) {
        toggleMetrics.addEventListener('click', function () {
            const collapsed = metricsGrid.classList.toggle('metrics-collapsed');
            const span = toggleMetrics.querySelector('[data-i18n]');
            if (span) {
                const key = collapsed ? 'showAdvancedMetrics' : 'hideAdvancedMetrics';
                span.textContent = PDE.TRANSLATIONS[PDE.currentLang][key] || key;
                span.setAttribute('data-i18n', key);
            }
        });
    }

    // ── Quick/Full model mode toggle ──
    PDE.currentMode = PDE.readMode();
    PDE.setMode(PDE.currentMode, true);
    document.querySelectorAll('.mode-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            PDE.setMode(this.getAttribute('data-mode'));
        });
    });

    // ── Preset buttons ──
    const PRESETS = {
        low:    { q1:70, q2:168, q4:50000, q5:10, q6:150, q10:25, teamSize:15, autoLevel:20, capex:20000 },
        medium: { q1:25, q2:48, q3:3, q4:5000, q5:2, q6:120, q7:20, q8:150000, q9:3, q10:12, teamSize:10, autoLevel:40, capex:50000 },
        high:   { q1:15, q2:24,  q4:5000,  q5:1,  q6:150, q10:8,  teamSize:8,  autoLevel:65, capex:80000 },
    };
    document.querySelectorAll('.preset-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const preset = PRESETS[this.getAttribute('data-preset')];
            if (!preset) return;
            Object.keys(preset).forEach(function (id) {
                const el = document.getElementById(id);
                if (el) { el.value = preset[id]; PDE.validateField(id); }
            });
            PDE.calculate();
        });
    });

    // ── Region select ──
    const regionSelect = document.getElementById('regionSelect');
    if (regionSelect) {
        regionSelect.addEventListener('change', function () {
            const region = this.value;
            const r = PDE.REGION_DEFAULTS[region];
            if (!r) return;
            const rate = PDE.EXCHANGE_RATES[PDE.currentCurrency];
            const monetaryIds = ['q4', 'q6', 'capex'];
            Object.keys(r).forEach(function (id) {
                const el = document.getElementById(id);
                if (!el) return;
                const val = monetaryIds.indexOf(id) !== -1 ? (r[id] * rate).toFixed(2) : r[id];
                el.value = val;
                PDE.validateField(id);
            });
            PDE.calculate();
        });
    }

    const calcIds = ['q1','q2','q3','q4','q5','q11','q6','q7','q8','q9','q10','autoLevel','teamSize','capex','erosionRate','discountRate','timeHorizon','leverAutomation','leverRisk','contextPremium','taxRate'];
    calcIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', function () { PDE.validateField(id); PDE.calculate(); });
    });

    const copyBtn = document.getElementById('copyLinkBtn');
    if (copyBtn) copyBtn.addEventListener('click', PDE.copyShareLink);

    const langButton = document.getElementById('langBtn');
    if (langButton) langButton.addEventListener('click', PDE.toggleLang);

    const currencySelect = document.getElementById('currencySelect');
    if (currencySelect) currencySelect.addEventListener('change', e => PDE.toggleCurrency(e.target.value));

    const excelBtn = document.getElementById('exportExcelBtn');
    if (excelBtn) excelBtn.addEventListener('click', PDE.exportExcel);

    const csvBtn = document.getElementById('exportCsvBtn');
    if (csvBtn) csvBtn.addEventListener('click', PDE.exportCsv);

    const pdfBtnSimple = document.getElementById('exportBtnSimple');
    if (pdfBtnSimple) pdfBtnSimple.addEventListener('click', function () { PDE.exportPDF('simple'); });
    const pdfBtnFull = document.getElementById('exportBtnFull');
    if (pdfBtnFull) pdfBtnFull.addEventListener('click', function () { PDE.exportPDF('full'); });

    const exportMenu = document.getElementById('exportMenu');
    const exportMenuBtn = document.getElementById('exportMenuBtn');
    if (exportMenu && exportMenuBtn) {
        exportMenuBtn.addEventListener('click', function (e) {
            e.preventDefault();
            const open = exportMenu.classList.toggle('open');
            exportMenuBtn.setAttribute('aria-expanded', String(open));
        });
        document.addEventListener('click', function (e) {
            if (!exportMenu.contains(e.target)) {
                exportMenu.classList.remove('open');
                exportMenuBtn.setAttribute('aria-expanded', 'false');
            }
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                exportMenu.classList.remove('open');
                exportMenuBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    const sliderIds = [
        'scenCAutoLevel','scenCCapexMult','annualHours',
        'leverInnovation','leverManagement','leverTurnover',
        'contextPremium','taxRate',
        'correlationStrength','corrQ3Q1','corrQ1Q5','corrQ1Q7','corrQ3Q7',
        'riskSecurityWeight','riskRegulatoryWeight',
        'mcIterations','mcConfidence','mcUncertaintyPct','mcMttrUncertaintyPct',
    ];
    sliderIds.forEach(function (id) {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', PDE.calculate);
        }
    });

    ['correlationsToggle','nonlinearToggle','probabilisticToggle','advancedRiskToggle'].forEach(function (id) {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', function () { PDE.applyToggleVisibility(id); PDE.saveToggleStates(); PDE.calculate(); });
        }
        PDE.applyToggleVisibility(id);
    });
    PDE.loadToggleStates();

    // ── Calibration panel: delegate events on dynamically created fields ──
    const calGrid = document.getElementById('calibrationGrid');
    if (calGrid) {
        calGrid.addEventListener('input', function (e) {
            if (e.target && e.target.classList.contains('calib-input')) {
                PDE.saveCalibrationActuals();
            }
        });
        calGrid.addEventListener('focusout', function (e) {
            if (e.target && e.target.classList.contains('calib-input')) {
                PDE.calibrationHandleBlur();
            }
        });
    }
    const calibResetBtn = document.getElementById('calibResetBtn');
    if (calibResetBtn) calibResetBtn.addEventListener('click', PDE.resetCalibration);

    // ── Calibration panel: toggle body visibility on header click ──
    const calHeader = document.getElementById('calibrationHeader');
    const calBody = document.getElementById('calibrationBody');
    const calToggleIcon = document.getElementById('calibToggleIcon');
    if (calHeader && calBody) {
        calHeader.addEventListener('click', function () {
            const isHidden = calBody.style.display === 'none' || calBody.style.display === '';
            calBody.style.display = isHidden ? 'block' : 'none';
            if (calToggleIcon) {
                calToggleIcon.textContent = isHidden ? '\u25BC' : '\u25B6';
            }
        });
    }

    document.addEventListener('click', e => {
        if (!e.target.classList.contains('formula-tip')) {
            document.querySelectorAll('.formula-tip').forEach(t => setTipOpen(t, false));
        }
    });
});

window.onload = () => {
    if (typeof Chart !== 'undefined') {
        const cs = getComputedStyle(document.documentElement);
        Chart.defaults.color           = cs.getPropertyValue('--text-secondary').trim() || PDE.DARK.text;
        Chart.defaults.borderColor     = cs.getPropertyValue('--border').trim() || PDE.DARK.grid;
        Chart.defaults.backgroundColor = cs.getPropertyValue('--border').trim() || PDE.DARK.navy;
    }
    const currencyEl = document.getElementById('currencySelect');
    if (currencyEl) currencyEl.value = PDE.currentCurrency;
    PDE.applyTranslations();
    PDE.nbpFetching = true;
    const footerEl = document.getElementById('nbpFooter');
    if (footerEl) footerEl.textContent = PDE.TRANSLATIONS[PDE.currentLang].nbpFetching;
    PDE.decodeState();
    PDE.syncInputMaxes();
    PDE.ALLOWED_HASH_KEYS.forEach(function (id) { PDE.validateField(id); });
    PDE.calculate();
    requestAnimationFrame(() => { PDE.calculate(); });
    PDE.fetchNbpRates();

    PDE.prefetchFontsToBase64();

    window.addEventListener('beforeunload', function () {
        if (PDE._mcWorker) PDE._mcWorker.terminate();
    });
};
