// ═══════════════════════════════════════════════════════════════
// Monte Carlo simulation — Web Worker (migrated from model.js)
// Self-contained: no dependency on PDE namespace or DOM
// ═══════════════════════════════════════════════════════════════

// ── Constants (mirrors PDE.COEFFICIENTS) ──
const C = {
    ANNUAL_HOURS_PER_ENGINEER: 1800,
    SPRINT_HOURS: 70,
    SPRINTS_PER_YEAR: 26,
    MONTHS_PER_YEAR: 12,
    QUARTERS_PER_YEAR: 4,
    PIPELINE_EROSION_RATE_DEFAULT: 0.25,
    SCEN_C_AUTO_LEVEL: 0.8,
    SCEN_C_CAPEX_MULTIPLIER: 1.5,
    LEVER_AUTOMATION_DEFAULT: 0.3,
    LEVER_RISK_DEFAULT: 0.6,
    LEVER_INNOVATION: 0.5,
    LEVER_MANAGEMENT: 0.15,
    LEVER_TURNOVER: 0.3,
    TURNOVER_REF_HOURS: 1800,
    RISK_SCALE_MAX: 5,
    AUTOMATABLE_SHARE: 0.6,
    DISCOUNT_RATE_DEFAULT: 0.10,
    TIME_HORIZON_YEARS_DEFAULT: 5,
};

const RD = { securityWeight: 0.4, regulatoryWeight: 0.25 };
const CD = { correlationMultiplier: 0.3, corrQ3Q1: 15, corrQ1Q5: 3, corrQ1Q7: 20, corrQ3Q7: 10 };

// ── Seeded PRNG (LCG) ──
function seededRandom(seed) {
    let s = seed || Date.now();
    return function () {
        s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
        return (s >>> 0) / 0xFFFFFFFF;
    };
}

// ── Box-Muller transform → standard normal variate ──
function randn(rng) {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ── Discounted payback (mirrors PDE.discountedPayback) ──
function discountedPayback(annualSavings, investment, rate, maxYears) {
    if (annualSavings <= 0 || investment <= 0) return Infinity;
    if (rate === undefined) rate = C.DISCOUNT_RATE_DEFAULT;
    if (maxYears === undefined) maxYears = C.TIME_HORIZON_YEARS_DEFAULT;
    const monthly = annualSavings / 12;
    let cumulative = 0;
    const maxMonths = maxYears * 12;
    for (let m = 1; m <= maxMonths; m++) {
        cumulative += monthly / Math.pow(1 + rate, m / 12);
        if (cumulative >= investment) return m;
    }
    return Infinity;
}

// ── IRR (mirrors PDE.calculateIRR) ──
function calculateIRR(cashFlows) {
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
}

// ── Core model (mirrors PDE.computeModel) ──
function computeModel(params, coeffs) {
    let manualPercent  = params.manualPercent  || 0;
    const downCost       = params.downCost       || 0;
    let failures       = (params.failures      || 0) * coeffs.QUARTERS_PER_YEAR;
    const mttr           = params.mttr           || 0;
    const rate           = params.rate           || 0;
    let managerHrs     = params.managerHrs     || 0;
    const opportunityVal = params.opportunityVal || 0;
    const riskLevel      = params.riskLevel      || 0;
    const capex          = params.capex          || 0;
    let autoLevel      = (params.autoLevel     || 0) / 100;
    const teamSize       = params.teamSize       || 0;
    const erosionRate    = params.erosionRate    !== undefined ? params.erosionRate    : coeffs.PIPELINE_EROSION_RATE_DEFAULT;
    const discountRate   = params.discountRate   !== undefined ? params.discountRate   : coeffs.DISCOUNT_RATE_DEFAULT;
    const horizonYears   = params.horizonYears   || coeffs.TIME_HORIZON_YEARS_DEFAULT;
    const correlationsEnabled = params.correlationsEnabled || false;
    const docStandard    = params.docStandard    || 3;
    const riskSecurityWeight   = params.riskSecurityWeight   !== undefined ? params.riskSecurityWeight   : RD.securityWeight;
    const riskRegulatoryWeight = params.riskRegulatoryWeight !== undefined ? params.riskRegulatoryWeight : RD.regulatoryWeight;

    if (correlationsEnabled) {
        const cMult = params.correlationMultiplier !== undefined ? params.correlationMultiplier : CD.correlationMultiplier;
        const corrQ3Q1 = params.corrQ3Q1 || CD.corrQ3Q1;
        const corrQ1Q5 = params.corrQ1Q5 || CD.corrQ1Q5;
        const corrQ1Q7 = params.corrQ1Q7 || CD.corrQ1Q7;
        const corrQ3Q7 = params.corrQ3Q7 || CD.corrQ3Q7;

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

    const manualAnnualHrs  = coeffs.SPRINT_HOURS * coeffs.SPRINTS_PER_YEAR * (manualPercent / 100);
    const chasingAnnualHrs = managerHrs * coeffs.MONTHS_PER_YEAR;

    let effectiveTeamSize = teamSize;
    if (nonlinearEnabled) {
        effectiveTeamSize = Math.pow(teamSize, 0.9);
    }

    const cWaste     = (manualAnnualHrs + chasingAnnualHrs) * rate * effectiveTeamSize * 1.15;
    let cRisk      = (failures * mttr * downCost) * (riskLevel / coeffs.RISK_SCALE_MAX);
    const cOppDirect = opportunityVal * erosionRate;

    const riskOperational = cRisk;
    let riskSecurity;
    let riskRegulatory;
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
    const netDebt     = totalImpact - capex;

    const annualRecurring = cWaste + cRisk;
    const oneTimeCosts    = cOppDirect + capex;
    const dr = discountRate;
    const ny = horizonYears;
    const pvifa = dr > 0 ? (1 - Math.pow(1 + dr, -ny)) / dr : ny;
    const npvRecurring = annualRecurring * pvifa;
    const npvTotalDebt = oneTimeCosts + npvRecurring;

    const potentialSavings = (cWaste + cRisk) * autoLevel;
    const paybackMonths    = discountedPayback(potentialSavings, capex);

    const irrCashFlows = [-capex];
    for (let mi = 1; mi <= ny * 12; mi++) irrCashFlows.push(potentialSavings / 12);
    const irr = calculateIRR(irrCashFlows);

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
        potentialSavings:  potentialSavings,
        paybackMonths:     paybackMonths,
        irr:               irr,
    };
}

// ── Statistics computation ──
function computeStats(results, cl) {
    const keys = ['cWaste','cRisk','cOppDirect','totalImpact','netDebt',
                'npvTotalDebt','potentialSavings','paybackMonths','irr'];
    const lowPct = (1 - cl) / 2;
    const highPct = 1 - lowPct;
    const output = {};
    keys.forEach(function (key) {
        const sorted = results.map(function (r) { return r[key]; }).sort(function (a, b) { return a - b; });
        const mean = sorted.reduce(function (s, v) { return s + v; }, 0) / sorted.length;
        const median = sorted.length % 2 === 1
            ? sorted[Math.floor(sorted.length / 2)]
            : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
        output[key] = {
            mean:   mean,
            median: median,
            p5:     sorted[Math.max(0, Math.floor(lowPct * sorted.length))],
            p25:    sorted[Math.max(0, Math.floor(0.25 * sorted.length))],
            p75:    sorted[Math.min(sorted.length - 1, Math.floor(0.75 * sorted.length))],
            p95:    sorted[Math.min(sorted.length - 1, Math.floor(highPct * sorted.length))],
            min:    sorted[0],
            max:    sorted[sorted.length - 1],
        };
    });
    output._allResults = results;
    return output;
}

// ── Worker message handler ──
self.onmessage = function (e) {
    try {
        const baseParams = e.data.baseParams;
        const opts = e.data.opts || {};
        const seed = e.data.seed || 42;

        const iters = opts.iterations || 1000;
        const cl = opts.confidenceLevel || 0.9;
        const uncPct = opts.uncertaintyPct || 0.15;
        const mttrUnc = opts.mttrUncertaintyPct || 0.25;
        const rng = seededRandom(seed);

        const reportEvery = Math.max(1, Math.floor(iters / 20));
        const results = [];
        let i;

        for (i = 0; i < iters; i++) {
            const p = {};
            Object.keys(baseParams).forEach(function (k) { p[k] = baseParams[k]; });

            p.manualPercent  = Math.max(0, Math.min(100, p.manualPercent  * (1 + (rng() - 0.5) * 2 * uncPct)));
            p.downCost       = Math.max(0, p.downCost       * (1 + (rng() - 0.5) * 2 * uncPct));
            p.failures       = Math.max(0, Math.min(9999, Math.round(p.failures + (rng() - 0.5) * uncPct * 4)));
            p.mttr           = Math.max(0, Math.min(168, p.mttr * (1 + randn(rng) * mttrUnc)));
            p.rate           = Math.max(0, p.rate           * (1 + (rng() - 0.5) * 2 * uncPct));
            p.managerHrs     = Math.max(0, Math.min(744, Math.round(p.managerHrs + (rng() - 0.5) * uncPct * p.managerHrs)));
            p.opportunityVal = Math.max(0, p.opportunityVal * (1 + (rng() - 0.5) * 2 * uncPct));
            p.capex          = Math.max(0, p.capex          * (1 + (rng() - 0.5) * 2 * uncPct * 0.5));

            const r = computeModel(p, C);
            results.push({
                cWaste: r.cWaste, cRisk: r.cRisk, cOppDirect: r.cOppDirect,
                totalImpact: r.totalImpact,
                netDebt: r.netDebt, npvTotalDebt: r.npvTotalDebt,
                potentialSavings: r.potentialSavings, paybackMonths: r.paybackMonths,
                irr: r.irr,
            });

            if (i % reportEvery === 0 || i === iters - 1) {
                self.postMessage({ type: 'progress', current: i + 1, total: iters });
            }
        }

        const stats = computeStats(results, cl);
        self.postMessage({ type: 'result', data: stats });
    } catch (err) {
        self.postMessage({ type: 'error', message: err.message });
    }
};
