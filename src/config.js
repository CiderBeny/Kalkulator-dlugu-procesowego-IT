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

    // Minimum absolute CAPEX (USD) treated as a meaningful investment —
    // below this (and below 1 month of potential savings) payback is a
    // meaningless 4-month floor and the hero message switches to a warning
    CAPEX_MIN_ABS:             1000,

    // CAPEX adequacy — the reference investment needed to fully capture the
    // target automation savings is CAPEX_RECOVERY_RATIO × target savings.
    // Below it, realized savings scale linearly (capture factor = capex / reference).
    // Rationale: you must fund a fraction of the annual savings you claim.
    // confidence: medium · configurable
    CAPEX_RECOVERY_RATIO:      0.10,

    // Automation — share of manual work that is automatable
    AUTOMATABLE_SHARE:         0.6,    // 60% — cited in DevOps literature             · confidence: medium

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

// ── Sensitivity views (Worst / Base / Best case) ──
// Multipliers applied to the SAME strategy's base params to answer "how bad /
// how good could it get if the recovery assumptions move together?".
// Recovery-dominant by design: forecast uncertainty concentrates on how much of
// the debt is actually recovered (autoLevel + recovery levers), how events
// unfold (failures/MTTR), how opportunity leaks (erosion), plus funding terms
// (discount rate) and CAPEX overruns. The measured cost baseline (q1/q4/q6/q7/
// q8/riskLevel) stays authoritative — scaling it up would paradoxically inflate
// the savings the investment can claim. conservative is pessimistic, aggressive
// is its mirror image, base perturbs nothing.
PDE.SENSITIVITY_VIEWS = {
    conservative: {
        labelKey: 'sensViewConservative',
        accent:   'var(--red)',
        mult: {
            failures:        1.15,
            mttr:            1.25,
            erosionRate:     1.15,
            autoLevel:       0.75,
            leverAuto:       0.70,
            leverRisk:       0.70,
            discountRate:    1.30,
            capex:           1.20,
        },
    },
    base: {
        labelKey: 'sensViewBase',
        accent:   'var(--accent)',
        mult:     {},
    },
    aggressive: {
        labelKey: 'sensViewAggressive',
        accent:   'var(--green)',
        mult: {
            failures:        0.85,
            mttr:            0.80,
            erosionRate:     0.85,
            autoLevel:       1.15,
            leverAuto:       1.30,
            leverRisk:       1.30,
            discountRate:    0.80,
            capex:           0.90,
        },
    },
};

// ── Sensitivity view clamps & rounding per param ──
// [min, max, mode] where mode is 'round' (integer) or 'none' (keep float)
PDE.SENSITIVITY_VIEW_CLAMPS = {
    failures:        [0, 9999, 'none'],
    mttr:            [0, 168,  'none'],
    erosionRate:     [0, 1,    'none'],
    autoLevel:       [0, 100,  'none'],
    leverAuto:       [0, 1,    'none'],
    leverRisk:       [0, 1,    'none'],
    discountRate:    [0.02, 0.40, 'none'],
    capex:           [0, 1e9,  'none'],
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
// q4 = downtime cost ($/h) · q6 = blended rate ($/h) · q8 = opportunity margin ($) · q10 = employee turnover (%) · capex ($)
// q8 scales with the q6 blended rate so switching regions never leaves a stale
// Opportunity Margin from a previously selected region.
PDE.REGION_DEFAULTS = {
    US: { q4: 5000, q6: 120, q10: 12, q8: 150000, teamSize: 10, capex: 50000 },
    EU: { q4: 8000,  q6: 110, q10: 12, q8: 137500, teamSize: 10, capex: 40000 },
    PL: { q4: 3000,  q6: 50,  q10: 18, q8: 62500,  teamSize: 10, capex: 40000 },
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
// The allowlist covers the FULL model so a shared link reproduces every
// parameter, including the advanced Full-Mode inputs. Boolean toggles and the
// Monte Carlo seed are handled separately (reserved keys `togg`/`mcseed`).
PDE.ALLOWED_HASH_KEYS = new Set(
    ['q1','q2','q3','q4','q5','q11','q6','q7','q8','q9','q10','autoLevel','capex','teamSize',
     'erosionRate','discountRate','timeHorizon','leverAutomation','leverRisk',
     'contextPremium','taxRate',
     // Scenario C + Annual Hours
     'scenCAutoLevel','scenCCapexMult','annualHours',
     // Additional recovery levers
     'leverInnovation','leverManagement','leverTurnover',
     // Monte Carlo
     'mcIterations','mcConfidence','mcUncertaintyPct','mcMttrUncertaintyPct',
     // Correlations
     'correlationStrength','corrQ3Q1','corrQ1Q5','corrQ1Q7','corrQ3Q7',
     // Advanced risk model
     'riskSecurityWeight','riskRegulatoryWeight']
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

    // Scenario C + Annual Hours
    scenCAutoLevel:  { min: 50,  max: 100  },  // 50%–100%
    scenCCapexMult:  { min: 10,  max: 30   },  // 1.0–3.0 (×10)
    annualHours:     { min: 1500, max: 2500 }, // hrs/yr

    // Additional recovery levers
    leverInnovation: { min: 10,  max: 80   },  // 10%–80%
    leverManagement: { min: 5,   max: 40   },  // 5%–40%
    leverTurnover:   { min: 10,  max: 60   },  // 10%–60%

    // Monte Carlo
    mcIterations:       { min: 100, max: 10000 }, // count
    mcConfidence:       { min: 50,  max: 99   },  // 50%–99%
    mcUncertaintyPct:   { min: 5,   max: 30   },  // 5%–30%
    mcMttrUncertaintyPct: { min: 10, max: 50  },  // 10%–50%

    // Correlations
    correlationStrength: { min: 0, max: 100 },  // 0.0–1.0 (×100)
    corrQ3Q1:            { min: 0, max: 50  },  // h
    corrQ1Q5:            { min: 0, max: 10  },  // (×1, step 0.5)
    corrQ1Q7:            { min: 0, max: 50  },  // h
    corrQ3Q7:            { min: 0, max: 30  },  // h

    // Advanced risk model
    riskSecurityWeight:   { min: 0, max: 100 },  // ×100
    riskRegulatoryWeight: { min: 0, max: 100 },  // ×100
};
