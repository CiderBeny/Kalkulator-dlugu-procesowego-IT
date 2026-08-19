// ═══════════════════════════════════════════════════════════════
// Utility functions — XSS guard, i18n, currency, sliders, IO
// ═══════════════════════════════════════════════════════════════
window.PDE = window.PDE || {};
const PDE = window.PDE;

// seededRandom + randn migrated to src/mc-worker.js (Web Worker)

PDE.esc = function esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

PDE.t = function t(key) {
    let val = PDE.TRANSLATIONS[PDE.currentLang][key] ?? PDE.TRANSLATIONS.en[key] ?? key;
    if (typeof val === 'string') {
        val = val.replace('{C}', PDE.CURRENCY_SYMBOLS[PDE.currentCurrency])
                 .replace('{CC}', PDE.currentCurrency);
    }
    return val;
};

PDE._pluralRules = {};

PDE.pluralize = function pluralize(n, forms) {
    const lang = PDE.currentLang === 'pl' ? 'pl' : 'en';
    if (!PDE._pluralRules[lang]) PDE._pluralRules[lang] = new Intl.PluralRules(lang);
    const rule = PDE._pluralRules[lang].select(n);
    return forms[rule] !== undefined ? forms[rule] : forms.other;
};

PDE.monthsWord = function monthsWord(n) {
    return PDE.pluralize(n, PDE.TRANSLATIONS[PDE.currentLang].monthsPlural);
};

PDE.fmtCount = function fmtCount(n, forms) {
    const locale = PDE.currentLang === 'pl' ? 'pl-PL' : 'en-US';
    const num = new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(n);
    return num + ' ' + PDE.pluralize(n, forms);
};

PDE._fmtMonthsWith = function _fmtMonthsWith(pb, forms) {
    const L = PDE.TRANSLATIONS[PDE.currentLang];
    if (!isFinite(pb) || pb <= 0) return L.scenInfinity;
    if (pb < 1) return '< 1 ' + PDE.pluralize(pb, forms);
    return PDE.fmtCount(pb, forms);
};

PDE.fmtMonths = function fmtMonths(pb) {
    return PDE._fmtMonthsWith(pb, PDE.TRANSLATIONS[PDE.currentLang].monthsPlural);
};

PDE.fmtMonthsLocative = function fmtMonthsLocative(pb) {
    return PDE._fmtMonthsWith(pb, PDE.TRANSLATIONS[PDE.currentLang].monthsPluralLocative);
};

PDE.fmtMonthsRange = function fmtMonthsRange(a, b) {
    const locale = PDE.currentLang === 'pl' ? 'pl-PL' : 'en-US';
    const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    const range = a === b ? fmt.format(a) : fmt.format(a) + '\u2013' + fmt.format(b);
    return range + ' ' + PDE.monthsWord(b);
};

PDE.applyTranslations = function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const val = PDE.t(key);
        if (val && typeof val === 'string') el.textContent = val;
    });
    document.querySelectorAll('[data-i18n-formula]').forEach(el => {
        const key = el.getAttribute('data-i18n-formula');
        const val = PDE.t(key);
        if (val && typeof val === 'string') {
            el.setAttribute('data-formula', val);
            el.setAttribute('aria-label', 'Formula: ' + val);
        }
    });
    document.documentElement.lang = PDE.currentLang;
};

PDE.toggleLang = function toggleLang() {
    PDE.currentLang = PDE.currentLang === 'en' ? 'pl' : 'en';
    document.getElementById('langFlag').textContent = PDE.currentLang === 'en' ? '🇵🇱' : '🇬🇧';
    document.getElementById('langLabel').textContent = PDE.currentLang === 'en' ? 'PL' : 'EN';
    PDE.applyTranslations();
    PDE.updateSliderFills();
    PDE.calculate();
    const footerEl = document.getElementById('nbpFooter');
    if (footerEl) {
        const t = PDE.TRANSLATIONS[PDE.currentLang];
        if (PDE.nbpDate) {
            footerEl.textContent = t.nbpFooter(new Date(PDE.nbpDate).toLocaleDateString(PDE.currentLang === 'pl' ? 'pl-PL' : 'en-US'));
        } else if (PDE.nbpFetching) {
            footerEl.textContent = t.nbpFetching;
        } else {
            footerEl.textContent = t.nbpUnavailable;
        }
    }
};

PDE.formatCurrency = function formatCurrency(amountUSD) {
    const converted = amountUSD * PDE.EXCHANGE_RATES[PDE.currentCurrency];
    const locale = PDE.currentLang === 'pl' ? 'pl-PL' : 'en-US';
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: PDE.currentCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(converted);
};

PDE.formatCurrencyWhole = function formatCurrencyWhole(amountUSD) {
    const converted = amountUSD * PDE.EXCHANGE_RATES[PDE.currentCurrency];
    const locale = PDE.currentLang === 'pl' ? 'pl-PL' : 'en-US';
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: PDE.currentCurrency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(converted);
};

PDE.formatCompactCurrency = function formatCompactCurrency(amountUSD) {
    const sym = PDE.CURRENCY_SYMBOLS[PDE.currentCurrency] || '$';
    const converted = amountUSD * PDE.EXCHANGE_RATES[PDE.currentCurrency];
    const abs = Math.abs(converted);
    if (abs >= 1000000) {
        return '≈' + sym + (converted / 1000000).toFixed(1) + 'M';
    }
    if (abs >= 1000) {
        return '≈' + sym + (converted / 1000).toFixed(1) + 'K';
    }
    return sym + Math.round(converted);
};

PDE.usdToCurrency = function usdToCurrency(amountUSD) {
    return amountUSD * PDE.EXCHANGE_RATES[PDE.currentCurrency];
};

PDE.currencyToUsd = function currencyToUsd(amount) {
    return amount / PDE.EXCHANGE_RATES[PDE.currentCurrency];
};

PDE.toggleCurrency = function toggleCurrency(currency) {
    if (currency === PDE.currentCurrency) return;
    const prevCurrency = PDE.currentCurrency;
    const monetaryIds = ['q4', 'q6', 'q8', 'capex'];
    const prevRate = PDE.EXCHANGE_RATES[prevCurrency];
    const newRate = PDE.EXCHANGE_RATES[currency];
    monetaryIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const valInPrev = parseFloat(el.value) || 0;
            const valInUSD = valInPrev / prevRate;
            const valInNew = valInUSD * newRate;
            el.value = (Math.round(valInNew * 100) / 100).toFixed(2);
        }
    });
    PDE.currentCurrency = currency;
    document.getElementById('currencySelect').value = currency;
    PDE.syncInputMaxes();
    PDE.ALLOWED_HASH_KEYS.forEach(function (id) { PDE.validateField(id); });
    PDE.applyTranslations();
    PDE.calculate();
    const footerEl = document.getElementById('nbpFooter');
    if (footerEl) {
        const t = PDE.TRANSLATIONS[PDE.currentLang];
        if (PDE.nbpDate) {
            footerEl.textContent = t.nbpFooter(new Date(PDE.nbpDate).toLocaleDateString(PDE.currentLang === 'pl' ? 'pl-PL' : 'en-US'));
        } else if (PDE.nbpFetching) {
            footerEl.textContent = t.nbpFetching;
        } else {
            footerEl.textContent = t.nbpUnavailable;
        }
    }
};

PDE.updateSliderFills = function updateSliderFills() {
    function setSliderFill(inputId, fillId, min, max) {
        const input = document.getElementById(inputId);
        const fill  = document.getElementById(fillId);
        if (!input || !fill) return;
        const pct = ((input.value - min) / (max - min) * 100).toFixed(1) + '%';
        fill.style.width = pct;
    }
    setSliderFill('q3',            'q3Fill',            1, 5);
    setSliderFill('q9',            'q9Fill',            1, 5);
    setSliderFill('autoLevel',     'autoLevelFill',     0, 100);
    setSliderFill('erosionRate',   'erosionRateFill',   0, 100);
    setSliderFill('discountRate',  'discountRateFill',  5, 20);
    setSliderFill('timeHorizon',   'timeHorizonFill',   3, 10);
    setSliderFill('leverAutomation','leverAutomationFill',10, 60);
    setSliderFill('leverRisk',     'leverRiskFill',     20, 80);
    setSliderFill('contextPremium','contextPremiumFill', 0, 30);
    setSliderFill('taxRate',       'taxRateFill',       0, 50);
};

PDE.readAdvanced = function readAdvanced(id, defaultVal, divisor) {
    const el = document.getElementById(id);
    if (!el) return defaultVal;
    const raw = parseFloat(el.value);
    return isFinite(raw) ? raw / (divisor || 1) : defaultVal;
};

PDE.isMobileBrowser = function isMobileBrowser() {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPod|Android|webOS|BlackBerry|Windows Phone|IEMobile|Opera Mini/i.test(ua)
        || /iPad/i.test(ua)) return true;
    if (typeof screen !== 'undefined' && 'ontouchstart' in window) {
        if (screen.width <= 1024) return true;
    }
    return false;
};

PDE.formatIRR = function formatIRR(irr) {
    if (irr === null || irr === undefined || !isFinite(irr)) return '\u2014';
    if (irr >= 0.999) return '>100%';
    return (irr * 100).toFixed(1) + '%';
};

PDE.clamp = function clamp(id) {
    const c = PDE.HASH_CONSTRAINTS[id];
    const raw = parseFloat(document.getElementById(id)?.value);
    if (!c) return isFinite(raw) ? raw : 0;
    if (!isFinite(raw)) return c.min;
    const minInCurrency = c.min * PDE.EXCHANGE_RATES[PDE.currentCurrency];
    const maxInCurrency = c.max * PDE.EXCHANGE_RATES[PDE.currentCurrency];
    return Math.round(Math.min(maxInCurrency, Math.max(minInCurrency, raw)) * 100) / 100;
};

PDE._fmtBound = function fmtBound(value) {
    const locale = PDE.currentLang === 'pl' ? 'pl-PL' : 'en-US';
    const num = parseFloat(value);
    if (!isFinite(num)) return '0';
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(num);
};

PDE._setFieldError = function setFieldError(el, message) {
    let msg = el.nextElementSibling;
    if (msg && msg.classList.contains('field-error')) {
        msg.textContent = message;
        return;
    }
    msg = document.createElement('p');
    msg.className = 'field-error';
    msg.textContent = message;
    el.insertAdjacentElement('afterend', msg);
};

PDE._clearFieldError = function clearFieldError(el) {
    const msg = el.nextElementSibling;
    if (msg && msg.classList.contains('field-error')) msg.remove();
};

PDE.validateField = function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.classList.contains('slider')) {
        el.classList.remove('input-error');
        return;
    }
    const c = PDE.HASH_CONSTRAINTS[id];
    if (!c) {
        el.classList.remove('input-error');
        PDE._clearFieldError(el);
        return;
    }
    const raw = parseFloat(el.value);
    if (!isFinite(raw)) {
        el.classList.add('input-error');
        PDE._setFieldError(el, PDE.t('fieldError')(PDE._fmtBound(el.min), PDE._fmtBound(el.max)));
        return;
    }
    const monetaryIds = ['q4', 'q6', 'q8', 'capex'];
    const val = monetaryIds.indexOf(id) !== -1
        ? raw / PDE.EXCHANGE_RATES[PDE.currentCurrency]
        : raw;
    if (val < c.min || val > c.max) {
        el.classList.add('input-error');
        PDE._setFieldError(el, PDE.t('fieldError')(PDE._fmtBound(el.min), PDE._fmtBound(el.max)));
    } else {
        el.classList.remove('input-error');
        PDE._clearFieldError(el);
    }
};

PDE.syncInputMaxes = function syncInputMaxes() {
    const monetaryIds = ['q4', 'q6', 'q8', 'capex'];
    monetaryIds.forEach(function (id) {
        const el = document.getElementById(id);
        const c = PDE.HASH_CONSTRAINTS[id];
        if (el && c) {
            const maxInCurrency = c.max * PDE.EXCHANGE_RATES[PDE.currentCurrency];
            el.setAttribute('max', maxInCurrency);
        }
    });
};

PDE.flashBtn = function flashBtn(btn, orig) {
    btn.textContent = '✓ COPIED';
    setTimeout(() => btn.textContent = orig, 2000);
};

PDE.getParams = function getParams() {
    return {
        manualPercent:  PDE.clamp('q1'),
        downCost:       PDE.currencyToUsd(PDE.clamp('q4')),
        failures:       PDE.clamp('q5'),
        mttr:           PDE.clamp('q11'),
        rate:           PDE.currencyToUsd(PDE.clamp('q6')),
        managerHrs:     PDE.clamp('q7'),
        opportunityVal: PDE.currencyToUsd(PDE.clamp('q8')),
        riskLevel:      PDE.clamp('q9'),
        capex:          PDE.currencyToUsd(PDE.clamp('capex')),
        autoLevel:      PDE.clamp('autoLevel'),
        teamSize:       PDE.clamp('teamSize'),
        turnover:       PDE.clamp('q10'),
        docStandard:    PDE.clamp('q3'),
        erosionRate:    PDE.readAdvanced('erosionRate',   PDE.COEFFICIENTS.PIPELINE_EROSION_RATE_DEFAULT, 100),
        discountRate:   PDE.readAdvanced('discountRate',  PDE.COEFFICIENTS.DISCOUNT_RATE_DEFAULT, 100),
        horizonYears:   PDE.readAdvanced('timeHorizon',   PDE.COEFFICIENTS.TIME_HORIZON_YEARS_DEFAULT, 1),
        leverAuto:      PDE.readAdvanced('leverAutomation', PDE.COEFFICIENTS.LEVER_AUTOMATION_DEFAULT, 100),
        leverRisk:      PDE.readAdvanced('leverRisk',     PDE.COEFFICIENTS.LEVER_RISK_DEFAULT, 100),
        scenCAutoLevel:  PDE.readAdvanced('scenCAutoLevel',  PDE.COEFFICIENTS.SCEN_C_AUTO_LEVEL, 100),
        scenCCapexMult:  PDE.readAdvanced('scenCCapexMult',  PDE.COEFFICIENTS.SCEN_C_CAPEX_MULTIPLIER, 10),
        annualHours:     PDE.readAdvanced('annualHours',     PDE.COEFFICIENTS.ANNUAL_HOURS_PER_ENGINEER, 1),
        leverInnovation: PDE.readAdvanced('leverInnovation', PDE.COEFFICIENTS.LEVER_INNOVATION, 100),
        leverManagement: PDE.readAdvanced('leverManagement', PDE.COEFFICIENTS.LEVER_MANAGEMENT, 100),
        leverTurnover:   PDE.readAdvanced('leverTurnover',   PDE.COEFFICIENTS.LEVER_TURNOVER, 100),
        contextPremium:  PDE.readAdvanced('contextPremium',  PDE.COEFFICIENTS.CONTEXT_PREMIUM_DEFAULT, 100),
        taxRate:         PDE.readAdvanced('taxRate',         PDE.COEFFICIENTS.TAX_RATE_DEFAULT, 1),
        mcIterations:    PDE.readAdvanced('mcIterations',    PDE.MC_DEFAULTS.iterations, 1),
        mcConfidence:    PDE.readAdvanced('mcConfidence',    PDE.MC_DEFAULTS.confidenceLevel, 100),
        mcUncertaintyPct: PDE.readAdvanced('mcUncertaintyPct', PDE.MC_DEFAULTS.uncertaintyPct, 100),
        mcMttrUnc:       PDE.readAdvanced('mcMttrUncertaintyPct', PDE.MC_DEFAULTS.mttrUncertaintyPct, 100),
        riskSecurityWeight:   PDE.readAdvanced('riskSecurityWeight',   PDE.RISK_WEIGHT_DEFAULTS.securityWeight, 1),
        riskRegulatoryWeight: PDE.readAdvanced('riskRegulatoryWeight', PDE.RISK_WEIGHT_DEFAULTS.regulatoryWeight, 1),
        correlationsEnabled: document.getElementById('correlationsToggle') ? document.getElementById('correlationsToggle').checked : false,
        correlationMultiplier: PDE.readAdvanced('correlationStrength', PDE.CORRELATION_DEFAULTS.correlationMultiplier, 100),
        corrQ3Q1: PDE.readAdvanced('corrQ3Q1', PDE.CORRELATION_DEFAULTS.corrQ3Q1, 1),
        corrQ1Q5: PDE.readAdvanced('corrQ1Q5', PDE.CORRELATION_DEFAULTS.corrQ1Q5, 1),
        corrQ1Q7: PDE.readAdvanced('corrQ1Q7', PDE.CORRELATION_DEFAULTS.corrQ1Q7, 1),
        corrQ3Q7: PDE.readAdvanced('corrQ3Q7', PDE.CORRELATION_DEFAULTS.corrQ3Q7, 1),
        nonlinearEnabled: document.getElementById('nonlinearToggle') ? document.getElementById('nonlinearToggle').checked : false,
        probabilisticEnabled: document.getElementById('probabilisticToggle') ? document.getElementById('probabilisticToggle').checked : false,
        advancedRiskEnabled: document.getElementById('advancedRiskToggle') ? document.getElementById('advancedRiskToggle').checked : false,
    };
};

PDE.fetchNbpRates = async function fetchNbpRates() {
    try {
        const res = await fetch('https://api.nbp.pl/api/exchangerates/tables/A/last?format=json');
        const data = await res.json();
        const rates = data[0].rates;
        const getMid = (code) => rates.find(r => r.code === code).mid;

        const plnPerUsd = getMid('USD');
        const plnPerEur = getMid('EUR');
        const plnPerGbp = getMid('GBP');

        PDE.EXCHANGE_RATES['PLN'] = plnPerUsd;
        PDE.EXCHANGE_RATES['EUR'] = plnPerUsd / plnPerEur;
        PDE.EXCHANGE_RATES['GBP'] = plnPerUsd / plnPerGbp;
        PDE.EXCHANGE_RATES['USD'] = 1;

        PDE.nbpDate = data[0].effectiveDate;
        PDE.nbpFetching = false;
        const footerEl = document.getElementById('nbpFooter');
        if (footerEl) footerEl.textContent = PDE.TRANSLATIONS[PDE.currentLang].nbpFooter(new Date(PDE.nbpDate).toLocaleDateString(PDE.currentLang === 'pl' ? 'pl-PL' : 'en-US'));

        if (PDE.currentCurrency !== 'USD') PDE.calculate();
    } catch (e) {
        console.error('NBP API fetch failed:', e);
        PDE.nbpFetching = false;
        const footerEl = document.getElementById('nbpFooter');
        if (footerEl) footerEl.textContent = PDE.TRANSLATIONS[PDE.currentLang].nbpUnavailable;
    }
};
