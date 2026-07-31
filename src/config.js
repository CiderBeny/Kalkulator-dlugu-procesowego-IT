// ═══════════════════════════════════════════════════════════════
// Centralised configuration & constants
// All hardcoded multipliers, rates, and thresholds live in one
// place so they are auditable, documented, and not duplicated.
// ═══════════════════════════════════════════════════════════════
window.PDE = window.PDE || {};

// ── Exchange rates & currency ──
PDE.EXCHANGE_RATES = { USD: 1, EUR: 0.87, PLN: 3.67, GBP: 0.75 };
PDE.CURRENCY_SYMBOLS = { USD: '$', EUR: '€', PLN: 'zł', GBP: '£' };

// ── Financial coefficients ──
PDE.COEFFICIENTS = {
    // ── Annualised conversions ──
    // Annualised conversions
    ANNUAL_HOURS_PER_ENGINEER: 1800,   // BLS ATUS 2024 / OECD (~1,811 rounded)  · confidence: high
    SPRINT_HOURS:              70,    // 2-week sprint capacity after ceremonies (planning, daily, retro, review, refinement) · confidence: high
    SPRINTS_PER_YEAR:          26,    // Math.round(1800 / 70) — sprints aligning with annual hours
    MONTHS_PER_YEAR:           12,
    QUARTERS_PER_YEAR:         4,

    // Context-switching premium (default 15%, configurable 0–30%)
    CONTEXT_PREMIUM_DEFAULT: 0.15,

    // Opportunity & Cascade
    PIPELINE_EROSION_RATE_DEFAULT: 0.25,  // Reinertsen 2009 (Product Development Flow) — Cost of Delay ~2%/mo ≈ 25%/yr · configurable


    // Scenario C thresholds
    SCEN_C_AUTO_LEVEL:         0.8,    // 80 % full automation                        · confidence: medium
    SCEN_C_CAPEX_MULTIPLIER:   1.5,    // +50 % CAPEX for full automation — conservatively assumes additional tooling, migration, and change management costs · confidence: medium

    // Lever recovery rates
    LEVER_AUTOMATION_DEFAULT:  0.3,    // overridden by #leverAutomation              · configurable
    LEVER_RISK_DEFAULT:        0.6,    // overridden by #leverRisk                    · configurable
    LEVER_INNOVATION:          0.5,    // DORA 2024 midpoint                          · confidence: medium
    LEVER_MANAGEMENT:          0.15,   // Context-switch studies (PanDev 2026)         · confidence: low
    LEVER_TURNOVER:            0.3,    // SHRM Foundation 2025                         · confidence: medium

    // Turnover default annual hours
    TURNOVER_REF_HOURS:        1800,   // hrs/yr — aligned with ANNUAL_HOURS_PER_ENGINEER · confidence: high

    // Risk normalisation
    RISK_SCALE_MAX:            5,      // q9 is 1–5 scale

    // Payback colour thresholds (months)
    PAYBACK_GREEN:             24,
    PAYBACK_YELLOW:            48,

    // Automation — share of manual work that is automatable
    AUTOMATABLE_SHARE:         0.6,    // 60% — cited in DevOps literature             · confidence: medium

    // Risk heatmap — target-state risk reduction (deprecated)
    TARGET_RISK_REDUCTION:     0.5,    // kept for backward compat                     · confidence: deprecated

    // Recommendation gate thresholds (disabled — always show when > 0)
    REC_AUTO_MIN_WASTE:        0,      // $                                           · confidence: removed
    REC_RISK_MIN_EXPOSURE:     0,      // $                                           · confidence: removed
    REC_INNOVATION_MIN:        0,      // $                                           · confidence: removed

    // Tax shield (simplified straight-line 5yr depreciation)
    TAX_RATE_DEFAULT:           0,      // 0 = disabled · configurable

    // Economic model (NPV / DCF)
    DISCOUNT_RATE_DEFAULT:      0.093,  // IT Infrastructure median (Damodaran 2025) · overridden by #discountRate · configurable
    TIME_HORIZON_YEARS_DEFAULT: 5,      // overridden by #timeHorizon                 · configurable
};

// ── Monte Carlo defaults ──
PDE.MC_DEFAULTS = {
    iterations:       1000,
    confidenceLevel:  0.9,
    uncertaintyPct:   0.15,
    mttrUncertaintyPct: 0.25,
};

// ── Correlation defaults ──
PDE.CORRELATION_DEFAULTS = {
    correlationMultiplier: 0.3,
    corrQ3Q1: 15,
    corrQ1Q5: 3,
    corrQ1Q7: 20,
    corrQ3Q7: 10,
};

// ── Risk weight defaults ──
PDE.RISK_WEIGHT_DEFAULTS = {
    securityWeight: 0.4,
    regulatoryWeight: 0.25,
};

// ── Region-specific default inputs (USD base — converted to active currency on apply) ──
// q4 = downtime cost ($/h) · q6 = blended rate ($/h) · q10 = employee turnover (%) · capex ($)
PDE.REGION_DEFAULTS = {
    US: { q4: 10000, q6: 150, q10: 15, teamSize: 10, capex: 50000 },
    EU: { q4: 8000,  q6: 110, q10: 12, teamSize: 10, capex: 40000 },
    PL: { q4: 3000,  q6: 50,  q10: 18, teamSize: 10, capex: 40000 },
};

// ── Calibration panel defaults ──
PDE.CALIBRATION = {
    STORAGE_KEY: 'PDE.calibrationActuals',
    THRESHOLD_GREEN: 0.15,
    THRESHOLD_YELLOW: 0.30,
    METRICS: [
        { key: 'cWaste',         format: 'currency' },
        { key: 'cRisk',          format: 'currency' },
        { key: 'cOppDirect',     format: 'currency' },
        { key: 'totalImpact',    format: 'currency' },
        { key: 'netDebt',        format: 'currency' },
        { key: 'manualAnnualHrs',format: 'hours'    },
    ],
};

// ── Chart colour palette (warm theme) ──
PDE.DARK = {
    text:   '#4A3F35',
    grid:   'rgba(214,201,184,0.4)',
    red:    '#DC2626',
    orange: '#EA580C',
    amber:  '#D97706',
    green:  '#16A34A',
    cyan:   '#0891B2',
    blue:   '#2563EB',
    purple: '#7C3AED',
    navy:   '#D6C9B8',
};

// ── Chart base options ──
PDE.CHART_OPTS = {
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
        x: { grid: { color: PDE.DARK.grid }, ticks: { color: PDE.DARK.text } },
        y: { grid: { color: PDE.DARK.grid }, ticks: { color: PDE.DARK.text } }
    }
};

// ── URL hash security constraints ──
PDE.ALLOWED_HASH_KEYS = new Set(
    ['q1','q2','q3','q4','q5','q11','q6','q7','q8','q9','q10','autoLevel','capex','teamSize',
     'erosionRate','discountRate','timeHorizon','leverAutomation','leverRisk',
     'contextPremium','taxRate']
);

PDE.HASH_CONSTRAINTS = {
    q1:        { min: 0,   max: 100   },  // manual effort %
    q2:        { min: 0,   max: 8760  },  // lead time hours (≤ 1 year)
    q3:        { min: 1,   max: 5     },  // documentation scale
    q4:        { min: 0,   max: 1e7   },  // downtime cost $/h
    q5:        { min: 0,   max: 9999  },  // human errors / quarter
    q11:       { min: 0,   max: 168   },  // MTTR hours (≤ 1 week)
    q6:        { min: 0,   max: 5000  },  // blended rate $/h
    q7:        { min: 0,   max: 744   },  // management overhead h/m (≤ 1 month)
    q8:        { min: 0,   max: 1e9   },  // opportunity margin $
    q9:        { min: 1,   max: 5     },  // scalability bottleneck scale
    q10:       { min: 0,   max: 100   },  // turnover %
    autoLevel: { min: 0,   max: 100   },  // automation level %
    capex:     { min: 0,   max: 1e9   },  // CAPEX investment $
    teamSize:  { min: 1,   max: 10000 },  // F9 fix: was missing, allowing unbounded values
    erosionRate:     { min: 0,   max: 100  },  // 0.0–1.0 (×100)
    discountRate:    { min: 5,   max: 20   },  // 5%–20%
    timeHorizon:     { min: 3,   max: 10   },  // years
    leverAutomation: { min: 10,  max: 60   },  // 10%–60%
    leverRisk:       { min: 20,  max: 80   },  // 20%–80%
    contextPremium:  { min: 0,   max: 30   },  // 0%–30% (×100)
    taxRate:         { min: 0,   max: 50   },  // 0%–50%
};
