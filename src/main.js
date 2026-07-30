// ═══════════════════════════════════════════════════════════════
// Main entry — DOMContentLoaded + window.onload
// ═══════════════════════════════════════════════════════════════
window.PDE = window.PDE || {};

document.addEventListener('DOMContentLoaded', () => {
    const gFont = document.getElementById('googleFontsSheet');
    if (gFont) gFont.media = 'all';

    document.querySelectorAll('.formula-tip').forEach(el => {
        el.addEventListener('click', e => {
            e.stopPropagation();
            const isOpen = el.classList.contains('tip-open');
            document.querySelectorAll('.formula-tip').forEach(t => t.classList.remove('tip-open'));
            if (!isOpen) el.classList.add('tip-open');
        });
        el.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const isOpen = el.classList.contains('tip-open');
                document.querySelectorAll('.formula-tip').forEach(t => t.classList.remove('tip-open'));
                if (!isOpen) el.classList.add('tip-open');
            }
            if (e.key === 'Escape') {
                el.classList.remove('tip-open');
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

    // ── Preset buttons ──
    const PRESETS = {
        low:    { q1:70, q2:168, q4:50000, q5:10, q6:150, q10:25, teamSize:15, autoLevel:20, capex:20000 },
        medium: { q1:40, q2:72,  q4:10000, q5:3,  q6:150, q10:15, teamSize:10, autoLevel:40, capex:50000 },
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
            Object.keys(r).forEach(function (id) {
                const el = document.getElementById(id);
                if (el) { el.value = r[id]; PDE.validateField(id); }
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
    const ctaBtn = document.getElementById('ctaBtn');
    if (ctaBtn) ctaBtn.addEventListener('click', function () { PDE.exportPDF('full'); });

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
            document.querySelectorAll('.formula-tip').forEach(t => t.classList.remove('tip-open'));
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
    document.getElementById('currencySelect').value = PDE.currentCurrency;
    PDE.applyTranslations();
    PDE.nbpFetching = true;
    document.getElementById('nbpFooter').textContent = PDE.TRANSLATIONS[PDE.currentLang].nbpFetching;
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
