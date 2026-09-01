// ═══════════════════════════════════════════════════════════════
// Financial model engine — pure computation, no DOM access
// ═══════════════════════════════════════════════════════════════
window.PDE = window.PDE || {};

PDE.rampFactor = function rampFactor(month) {
    if (month <= 3) return 0;
    if (month <= 6) return 0.5;
    return 1;
};

PDE.discountedPayback = function discountedPayback(annualSavings, investment, rate, maxYears, ramp) {
    if (annualSavings <= 0 || investment <= 0) return Infinity;
    if (rate === undefined) rate = PDE.readAdvanced('discountRate', PDE.COEFFICIENTS.DISCOUNT_RATE_DEFAULT, 100);
    if (maxYears === undefined) maxYears = PDE.readAdvanced('timeHorizon', PDE.COEFFICIENTS.TIME_HORIZON_YEARS_DEFAULT, 1);
    const monthly = annualSavings / 12;
    let cumulative = 0;
    const maxMonths = maxYears * 12;
    for (let m = 1; m <= maxMonths; m++) {
        cumulative += (monthly * (ramp ? PDE.rampFactor(m) : 1)) / Math.pow(1 + rate, m / 12);
        if (cumulative >= investment) return m;
    }
    return Infinity;
};

// Cumulative discounted net cash-flow series for the payback chart.
// Mirrors discountedPayback exactly (same 6-month ramp + monthly DCF), so the
// cumulative net crosses zero at precisely the reported payback month —
// graphically consistent with the financial verdict on the results page.
// Returns { points: [net at end of year 1..N], breakEvenMonth, horizonYears }.
PDE.paybackSeries = function paybackSeries(capex, annualSavings, rate, horizonYears) {
    if (horizonYears === undefined) horizonYears = PDE.COEFFICIENTS.TIME_HORIZON_YEARS_DEFAULT;
    if (rate === undefined) rate = PDE.COEFFICIENTS.DISCOUNT_RATE_DEFAULT;
    const points = [];
    const maxMonths = horizonYears * 12;
    let breakEvenMonth = Infinity;

    if (!isFinite(annualSavings) || annualSavings <= 0 || !isFinite(capex) || capex <= 0) {
        const flatNet = capex <= 0 ? 0 : -capex;
        for (let y = 1; y <= maxMonths; y += 12) points.push(flatNet);
        return { points: points, breakEvenMonth: breakEvenMonth, horizonYears: horizonYears };
    }

    const monthly = annualSavings / 12;
    let cumulative = -capex;
    for (let m = 1; m <= maxMonths; m++) {
        cumulative += (monthly * PDE.rampFactor(m)) / Math.pow(1 + rate, m / 12);
        if (breakEvenMonth === Infinity && cumulative >= 0) breakEvenMonth = m;
        if (m % 12 === 0) points.push(cumulative);
    }
    return { points: points, breakEvenMonth: breakEvenMonth, horizonYears: horizonYears };
};

// A CAPEX only yields a meaningful payback when it is at least 1 month of
// potential savings (below that, payback collapses to the 4-month ramp floor
// and the headline becomes misleading). A fixed absolute floor (CAPEX_MIN_ABS)
// keeps the check sane in high-savings scenarios without flagging defaults.
PDE.isMeaningfulCapex = function isMeaningfulCapex(capex, annualSavings) {
    if (!isFinite(capex) || !isFinite(annualSavings) || annualSavings <= 0) return false;
    return capex >= Math.min(PDE.COEFFICIENTS.CAPEX_MIN_ABS, annualSavings / 12);
};

// CAPEX adequacy — the reference investment required to fully capture the
// target savings. Savings do not scale with CAPEX by themselves; the investment
// buys a share of the automation goal (see captureFactor below).
PDE.referenceCapex = function referenceCapex(targetSavings) {
    if (!isFinite(targetSavings) || targetSavings <= 0) return 0;
    return targetSavings * PDE.COEFFICIENTS.CAPEX_RECOVERY_RATIO;
};

// Fraction of the target automation savings actually realized for a given
// CAPEX. Linear up to full funding, then capped (more money buys no more
// savings once the goal is fully financed).
PDE.captureFactor = function captureFactor(capex, targetSavings) {
    const ref = PDE.referenceCapex(targetSavings);
    if (!isFinite(capex) || capex <= 0 || ref <= 0) return 0;
    return Math.min(1, capex / ref);
};

PDE.calculateIRR = function calculateIRR(cashFlows) {
    const precision = 1e-6;
    const maxIter = 1000;
    let low = -0.99;
    let high = 1;
    for (let i = 0; i < maxIter; i++) {
        const rate = (low + high) / 2;
        let npv = 0;
        for (let t = 0; t < cashFlows.length; t++) {
            npv += cashFlows[t] / Math.pow(1 + rate, t / 12);
        }
        if (Math.abs(npv) < precision) return rate;
        if (npv > 0) low = rate; else high = rate;
        if (high - low < precision) return (low + high) / 2;
    }
    return null;
};

PDE.computeModel = function computeModel(params) {
    let manualPercent  = params.manualPercent  || 0;
    const downCost       = params.downCost       || 0;
    let failures       = (params.failures      || 0) * PDE.COEFFICIENTS.QUARTERS_PER_YEAR;
    const mttr           = params.mttr           || 0;
    const rate           = params.rate           || 0;
    let managerHrs     = params.managerHrs     || 0;
    const opportunityVal = params.opportunityVal || 0;
    const riskLevel      = params.riskLevel      || 0;
    const capex          = params.capex          || 0;
    let autoLevel      = (params.autoLevel     || 0) / 100;
    const teamSize       = params.teamSize        || 0;
    const erosionRate    = params.erosionRate    !== undefined ? params.erosionRate : PDE.COEFFICIENTS.PIPELINE_EROSION_RATE_DEFAULT;
    const discountRate   = params.discountRate   !== undefined ? params.discountRate : PDE.COEFFICIENTS.DISCOUNT_RATE_DEFAULT;
    const horizonYears   = params.horizonYears   || PDE.COEFFICIENTS.TIME_HORIZON_YEARS_DEFAULT;
    const leverAuto      = params.leverAuto      !== undefined ? params.leverAuto : PDE.COEFFICIENTS.LEVER_AUTOMATION_DEFAULT;
    const leverRisk      = params.leverRisk      !== undefined ? params.leverRisk : PDE.COEFFICIENTS.LEVER_RISK_DEFAULT;
    const turnover        = params.turnover        || 0;
    const correlationsEnabled = params.correlationsEnabled || false;
    const docStandard     = params.docStandard     || 3;
    const scenCAutoLevel  = params.scenCAutoLevel  !== undefined ? params.scenCAutoLevel : PDE.COEFFICIENTS.SCEN_C_AUTO_LEVEL;
    const scenCCapexMult  = params.scenCCapexMult  !== undefined ? params.scenCCapexMult : PDE.COEFFICIENTS.SCEN_C_CAPEX_MULTIPLIER;
    const annualHours     = params.annualHours     || PDE.COEFFICIENTS.ANNUAL_HOURS_PER_ENGINEER;
    const leverInnovation = params.leverInnovation || PDE.COEFFICIENTS.LEVER_INNOVATION;
    const leverManagement = params.leverManagement || PDE.COEFFICIENTS.LEVER_MANAGEMENT;
    const leverTurnoverL  = params.leverTurnover   || PDE.COEFFICIENTS.LEVER_TURNOVER;
    const riskSecurityWeight = params.riskSecurityWeight !== undefined ? params.riskSecurityWeight : PDE.RISK_WEIGHT_DEFAULTS.securityWeight;
    const riskRegulatoryWeight = params.riskRegulatoryWeight !== undefined ? params.riskRegulatoryWeight : PDE.RISK_WEIGHT_DEFAULTS.regulatoryWeight;
    const contextPremium = params.contextPremium !== undefined ? params.contextPremium : PDE.COEFFICIENTS.CONTEXT_PREMIUM_DEFAULT;
    const taxRate = params.taxRate !== undefined ? params.taxRate : PDE.COEFFICIENTS.TAX_RATE_DEFAULT;

    if (correlationsEnabled) {
        const cMult = params.correlationMultiplier !== undefined ? params.correlationMultiplier : PDE.CORRELATION_DEFAULTS.correlationMultiplier;
        const corrQ3Q1 = params.corrQ3Q1 !== undefined ? params.corrQ3Q1 : PDE.CORRELATION_DEFAULTS.corrQ3Q1;
        const corrQ1Q5 = params.corrQ1Q5 !== undefined ? params.corrQ1Q5 : PDE.CORRELATION_DEFAULTS.corrQ1Q5;
        const corrQ1Q7 = params.corrQ1Q7 !== undefined ? params.corrQ1Q7 : PDE.CORRELATION_DEFAULTS.corrQ1Q7;
        const corrQ3Q7 = params.corrQ3Q7 !== undefined ? params.corrQ3Q7 : PDE.CORRELATION_DEFAULTS.corrQ3Q7;

        const q1Base = manualPercent / 100;
        const q5Base = failures;
        const q7Base = managerHrs;
        const q3Base = docStandard / 5;
        const q1FromQ3 = manualPercent + (0.5 - q3Base) * cMult * corrQ3Q1;
        manualPercent = Math.round(Math.min(100, Math.max(0, q1FromQ3)));

        const q5FromQ1 = q5Base + q1Base * cMult * corrQ1Q5;
        failures = Math.round(Math.min(9999, Math.max(0, q5FromQ1)));

        const q7FromQ1 = q7Base + q1Base * cMult * corrQ1Q7;
        managerHrs = Math.round(Math.min(744, Math.max(0, q7FromQ1)));

        const q7FromQ3 = managerHrs - (1 - q3Base) * cMult * corrQ3Q7;
        managerHrs = Math.round(Math.min(744, Math.max(0, q7FromQ3)));
    }

    const nonlinearEnabled = params.nonlinearEnabled || false;

    const totalAnnualHrs   = annualHours;
    const manualAnnualHrs  = PDE.COEFFICIENTS.SPRINT_HOURS * PDE.COEFFICIENTS.SPRINTS_PER_YEAR * (manualPercent / 100);
    const chasingAnnualHrs = managerHrs * PDE.COEFFICIENTS.MONTHS_PER_YEAR;

    let effectiveTeamSize = teamSize;
    if (nonlinearEnabled) {
        effectiveTeamSize = Math.pow(teamSize, 0.9);
    }

    const cWaste     = (manualAnnualHrs + chasingAnnualHrs) * rate * effectiveTeamSize * (1 + contextPremium);
    let cRisk      = (failures * mttr * downCost) * (riskLevel / PDE.COEFFICIENTS.RISK_SCALE_MAX);
    const cOppDirect = opportunityVal * erosionRate;

    const riskOperational = cRisk;
    let riskSecurity    = 0;
    let riskRegulatory  = 0;
    const advancedRiskEnabled = params.advancedRiskEnabled || false;

    if (advancedRiskEnabled) {
        const manualRatio = manualPercent / 100;
        const docRatio = docStandard / 5;
        riskSecurity = cRisk * manualRatio * riskSecurityWeight;
        riskRegulatory = cRisk * (1 - docRatio) * riskRegulatoryWeight;

        cRisk = riskOperational + riskSecurity + riskRegulatory;
    }

    if (nonlinearEnabled) {
        autoLevel = 1 - Math.pow(1 - autoLevel, 1.2);
    }

    const totalImpact = cWaste + cRisk + cOppDirect;
    const netDebt      = totalImpact - capex;

    const annualRecurring = cWaste + cRisk;
    const oneTimeCosts    = cOppDirect + capex;
    const dr = discountRate;
    const ny = horizonYears;
    const pvifa = dr > 0 ? (1 - Math.pow(1 + dr, -ny)) / dr : ny;
    const npvRecurring = annualRecurring * pvifa;
    let npvTotalDebt = oneTimeCosts + npvRecurring;
    if (taxRate > 0 && capex > 0) {
        const taxShield = capex * (taxRate / 100) * 0.2 * pvifa;
        npvTotalDebt = npvTotalDebt - taxShield;
    }

    const recoverable      = cWaste * leverAuto + cRisk * leverRisk;
    const targetSavings    = recoverable * autoLevel;
    const capture          = PDE.captureFactor(capex, targetSavings);
    const potentialSavings = targetSavings * capture;
    const paybackMonths    = PDE.discountedPayback(potentialSavings, capex, dr, ny, true);

    const irrCashFlows = [-capex];
    for (let mi = 1; mi <= ny * 12; mi++) {
        irrCashFlows.push((potentialSavings / 12) * PDE.rampFactor(mi));
    }
    const irr = PDE.calculateIRR(irrCashFlows);

    const turnoverCost = (turnover / 100) * teamSize * rate * PDE.COEFFICIENTS.TURNOVER_REF_HOURS;

    const leverRecoveryAuto = Math.round(cWaste * leverAuto);
    const leverRecoveryRisk = Math.round(cRisk * leverRisk);
    const leverRecoveryInnovation = Math.round(cOppDirect * leverInnovation);
    const leverRecoveryMgmt = Math.round(cWaste * leverManagement);
    const leverRecoveryTurnover = Math.round(turnoverCost * leverTurnoverL);

    return {
        cWaste:            cWaste,
        cRisk:             cRisk,
        cOppDirect:        cOppDirect,
        totalImpact:       totalImpact,
        netDebt:           netDebt,
        annualRecurring:   annualRecurring,
        oneTimeCosts:      oneTimeCosts,
        npvRecurring:      npvRecurring,
        npvTotalDebt:      npvTotalDebt,
        recoverable:       recoverable,
        targetSavings:     targetSavings,
        captureFactor:     capture,
        potentialSavings:  potentialSavings,
        paybackMonths:     paybackMonths,
        irr:               irr,
        manualAnnualHrs:   manualAnnualHrs,
        chasingAnnualHrs:  chasingAnnualHrs,
        totalAnnualHrs:    totalAnnualHrs,
        turnoverCost:      turnoverCost,
        leverAuto:         leverAuto,
        leverRisk:         leverRisk,
        riskOperational:   riskOperational,
        riskSecurity:      riskSecurity,
        riskRegulatory:    riskRegulatory,
        advancedRiskEnabled: advancedRiskEnabled,
        leverRecoveryAuto:        leverRecoveryAuto,
        leverRecoveryRisk:        leverRecoveryRisk,
        leverRecoveryInnovation:  leverRecoveryInnovation,
        leverRecoveryMgmt:        leverRecoveryMgmt,
        leverRecoveryTurnover:    leverRecoveryTurnover,
        scenCAutoLevel:   scenCAutoLevel,
        scenCCapexMult:   scenCCapexMult,
    };
};

PDE.scenCalc = function scenCalc(al, cx, recoverable, dr, ny) {
    const targetSavings = recoverable * al;
    const annualSavings = targetSavings * PDE.captureFactor(cx, targetSavings);
    const pvifa = dr > 0 ? (1 - Math.pow(1 + dr, -ny)) / dr : ny;
    const npvSavings = annualSavings * pvifa;
    const net = npvSavings - cx;
    const pb = PDE.discountedPayback(annualSavings, cx, dr, ny, true);
    let irrVal = null;
    if (annualSavings > 0 && cx > 0) {
        const cf = [-cx];
        for (let m = 1; m <= ny * 12; m++) cf.push((annualSavings / 12) * PDE.rampFactor(m));
        irrVal = PDE.calculateIRR(cf);
    } else if (al === 0) {
        irrVal = 0;
    }
    return { savings: annualSavings, targetSavings: targetSavings, npvSavings: npvSavings, net: net, pb: pb, irr: irrVal };
};

// runMonteCarlo migrated to src/mc-worker.js (Web Worker)

// ── Sensitivity views — worst/base/best case for scenarios B & C ──
// Pure computation: clones params per view, perturbs with PDE.SENSITIVITY_VIEWS
// multipliers, runs computeModel + scenCalc. No DOM access, deterministic.
PDE.scenSensitivity = function scenSensitivity(params) {
    if (!params) return [];
    const viewOrder = ['conservative', 'base', 'aggressive'];
    const views = [];

    function buildViewParams(base, mult) {
        const pv = Object.assign({}, base);
        Object.keys(mult).forEach(function (k) {
            if (pv[k] === undefined || pv[k] === null) return;
            const c = PDE.SENSITIVITY_VIEW_CLAMPS[k];
            if (!c) return;
            let v = pv[k] * mult[k];
            if (c[2] === 'round') v = Math.round(v);
            v = Math.min(c[1], Math.max(c[0], v));
            pv[k] = v;
        });
        return pv;
    }

    for (let i = 0; i < viewOrder.length; i++) {
        const key = viewOrder[i];
        const def = PDE.SENSITIVITY_VIEWS[key];
        const pv = buildViewParams(params, def.mult);
        const r = PDE.computeModel(pv);

        const annualRecurring = r.cWaste + r.cRisk;
        const scenB = PDE.scenCalc(pv.autoLevel / 100, pv.capex, r.recoverable, pv.discountRate, pv.horizonYears);
        const scenC = PDE.scenCalc(pv.scenCAutoLevel, pv.capex * pv.scenCCapexMult, r.recoverable, pv.discountRate, pv.horizonYears);

        views.push({
            key: key,
            labelKey: def.labelKey,
            accent: def.accent,
            params: pv,
            metrics: {
                drag:          annualRecurring,
                npv:           r.npvTotalDebt,
                paybackMonths: r.paybackMonths,
                irr:           r.irr,
                scenB:         scenB,
                scenC:         scenC,
            },
        });
    }
    return views;
};

PDE.getDoraBand = function getDoraBand(metric, value) {
    const L = PDE.TRANSLATIONS[PDE.currentLang];
    const bands = {
        leadTime: [
            { max: 1,        band: L.doraBandElite,  color: 'var(--green)'  },
            { max: 24,       band: L.doraBandHigh,   color: 'var(--yellow)' },
            { max: 168,      band: L.doraBandMedium, color: 'var(--orange)' },
            { max: Infinity, band: L.doraBandLow,    color: 'var(--red)'    },
        ],
        manual: [
            { max: 5,        band: L.doraBandElite,  color: 'var(--green)'  },
            { max: 15,       band: L.doraBandHigh,   color: 'var(--yellow)' },
            { max: 30,       band: L.doraBandMedium, color: 'var(--orange)' },
            { max: Infinity, band: L.doraBandLow,    color: 'var(--red)'    },
        ],
        errors: [
            { max: 0,        band: L.doraBandElite,  color: 'var(--green)'  },
            { max: 1,        band: L.doraBandHigh,   color: 'var(--yellow)' },
            { max: 3,        band: L.doraBandMedium, color: 'var(--orange)' },
            { max: Infinity, band: L.doraBandLow,    color: 'var(--red)'    },
        ],
    };
    const thresholds = bands[metric];
    for (const t of thresholds) {
        if (value <= t.max) return { band: t.band, color: t.color };
    }
    return { band: L.doraBandLow, color: 'var(--red)' };
};
