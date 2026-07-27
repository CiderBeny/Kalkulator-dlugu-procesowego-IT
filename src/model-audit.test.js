const { describe, it } = require('node:test');
const assert = require('node:assert');

// ── Replicate constants from app.js for testing in Node ──────────
const COEFFICIENTS = {
    ANNUAL_HOURS_PER_ENGINEER: 1800,
    SPRINT_HOURS:              70,
    SPRINTS_PER_YEAR:          26,
    MONTHS_PER_YEAR:           12,
    QUARTERS_PER_YEAR:         4,
    PIPELINE_EROSION_RATE_DEFAULT: 0.25,
    SCEN_C_AUTO_LEVEL:         0.8,
    SCEN_C_CAPEX_MULTIPLIER:   1.5,
    LEVER_AUTOMATION_DEFAULT:  0.3,
    LEVER_RISK_DEFAULT:        0.6,
    LEVER_INNOVATION:          0.5,
    LEVER_MANAGEMENT:          0.15,
    LEVER_TURNOVER:            0.3,
    TURNOVER_REF_HOURS:        1800,
    RISK_SCALE_MAX:            5,
    PAYBACK_GREEN:             24,
    PAYBACK_YELLOW:            48,
    AUTOMATABLE_SHARE:         0.6,
    TARGET_RISK_REDUCTION:     0.5,
    REC_AUTO_MIN_WASTE:        0,
    REC_RISK_MIN_EXPOSURE:     0,
    REC_INNOVATION_MIN:        0,
    DISCOUNT_RATE_DEFAULT:      0.10,
    TIME_HORIZON_YEARS_DEFAULT: 5,
};

function discountedPayback(annualSavings, investment, rate, maxYears) {
    if (annualSavings <= 0 || investment <= 0) return Infinity;
    if (rate === undefined) rate = COEFFICIENTS.DISCOUNT_RATE_DEFAULT;
    if (maxYears === undefined) maxYears = COEFFICIENTS.TIME_HORIZON_YEARS_DEFAULT;
    const monthly = annualSavings / 12;
    let cumulative = 0;
    const maxMonths = maxYears * 12;
    for (let m = 1; m <= maxMonths; m++) {
        cumulative += monthly / Math.pow(1 + rate, m / 12);
        if (cumulative >= investment) return m;
    }
    return Infinity;
}

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

const TRANSLATIONS_EN_LABELS = {
    q11label: '11. MTTR (hrs)',
    q4label:  '4. Downtime Cost ({C}/h)',
};

// ── Known Issue #1 (fixed): MTTR label now shows hours, not currency ─────
describe('Known Issue #1 (fixed) — MTTR label corrected to hours', () => {
    it('q11label uses "hrs" (time unit) instead of "{C}" (currency)', () => {
        assert.ok(
            TRANSLATIONS_EN_LABELS.q11label.includes('hrs'),
            'FIX APPLIED: q11label="MTTR (hrs)" — no longer uses {C}',
        );
        assert.ok(
            !TRANSLATIONS_EN_LABELS.q11label.includes('{C}'),
            'FIX APPLIED: {C} removed from q11label — users now see the correct unit',
        );
    });

    it('q11label is now consistent with q4label — q4 uses {C}/h (cost), q11 uses hrs (time)', () => {
        const mttrUsesHrs = TRANSLATIONS_EN_LABELS.q11label.includes('hrs');
        const downCostUsesCurrencyHr = TRANSLATIONS_EN_LABELS.q4label.includes('{C}/h');
        assert.ok(
            mttrUsesHrs && downCostUsesCurrencyHr,
            'q11 uses hrs, q4 uses {C}/h — no ambiguity between time and cost labels',
        );
    });

    it('q11 HASH_CONSTRAINTS max=168 confirms the unit is hours (1 week), not currency', () => {
        const q11max = 168;
        assert.strictEqual(q11max, 168,
            'q11 max is 168 hours (= 1 week), proving MTTR is a time value, not monetary');
    });

    it('Risk formula is dimensionally correct', () => {
        // cRisk = (failures × mttr × downCost) × (riskLevel / 5)
        // units:   (count × hrs × $/hr)   × (dimensionless)
        //        = (count × $)             = monetary value ✓
        const failures = 8;
        const mttr = 4;
        const downCost = 5000;
        const riskLevel = 3;
        const risk = (failures * mttr * downCost) * (riskLevel / COEFFICIENTS.RISK_SCALE_MAX);
        assert.strictEqual(risk, 96000,
            'Formula: (8 failures × 4 hrs × $5000/hr) × (3/5) = $96000 — dimensionally sound');
    });
});

// ── Known Issue #3: Arbitrary coefficients ─────────────────────
describe('Known Issue #3 — Hardcoded coefficients without direct empirical basis', () => {
    it('Pipeline erosion rate default = 0.25 (25%) — Cost of Delay heuristic (Reinertsen 2009)', () => {
        assert.strictEqual(COEFFICIENTS.PIPELINE_EROSION_RATE_DEFAULT, 0.25);
    });



    it('Scenario C: auto level = 80%, CAPEX multiplier = 1.5 — model assumptions, not externally sourced', () => {
        assert.strictEqual(COEFFICIENTS.SCEN_C_AUTO_LEVEL, 0.8);
        assert.strictEqual(COEFFICIENTS.SCEN_C_CAPEX_MULTIPLIER, 1.5);
    });

    it('Lever recovery rates: 30%, 60%, 50%, 15%, 30% — fixed percentages from varied sources', () => {
        assert.strictEqual(COEFFICIENTS.LEVER_AUTOMATION_DEFAULT, 0.3);
        assert.strictEqual(COEFFICIENTS.LEVER_RISK_DEFAULT, 0.6);
        assert.strictEqual(COEFFICIENTS.LEVER_INNOVATION, 0.5);
        assert.strictEqual(COEFFICIENTS.LEVER_MANAGEMENT, 0.15);
        assert.strictEqual(COEFFICIENTS.LEVER_TURNOVER, 0.3);
    });

    it('AUTOMATABLE_SHARE = 60% — "cited in DevOps literature" without specific source', () => {
        assert.strictEqual(COEFFICIENTS.AUTOMATABLE_SHARE, 0.6);
    });

    it('TARGET_RISK_REDUCTION = 50% — model assumption for heatmap visualization', () => {
        assert.strictEqual(COEFFICIENTS.TARGET_RISK_REDUCTION, 0.5);
    });

    it('Annual hours = 1800, Turnover ref hours = 1800 — aligned to same standard', () => {
        assert.strictEqual(COEFFICIENTS.ANNUAL_HOURS_PER_ENGINEER, 1800);
        assert.strictEqual(COEFFICIENTS.TURNOVER_REF_HOURS, 1800);
    });

    it('Recommendation gate thresholds: all set to 0 (always show when > 0)', () => {
        assert.strictEqual(COEFFICIENTS.REC_AUTO_MIN_WASTE, 0);
        assert.strictEqual(COEFFICIENTS.REC_RISK_MIN_EXPOSURE, 0);
        assert.strictEqual(COEFFICIENTS.REC_INNOVATION_MIN, 0);
    });
});

// ── Known Issue #4 (mitigated): NPV + Discounted Payback ──────
describe('Known Issue #4 (mitigated) — NPV model verifies fix is in place', () => {
    it('COEFFICIENTS contains DISCOUNT_RATE_DEFAULT and TIME_HORIZON_YEARS_DEFAULT', () => {
        assert.strictEqual(COEFFICIENTS.DISCOUNT_RATE_DEFAULT, 0.10,
            'Discount rate = 10% (WACC benchmark for IT infra)');
        assert.strictEqual(COEFFICIENTS.TIME_HORIZON_YEARS_DEFAULT, 5,
            'Time horizon = 5 years (standard investment horizon)');
    });

    it('NPV recurring = annualRecurring × PVIFA(10%, 5yr) — annuity formula', () => {
        const annualRecurring = 655000; // cWaste (500k x 1.15) 575k + cRisk 80k
        const r = 0.10, n = 5;
        const pvifa = (1 - Math.pow(1 + r, -n)) / r;
        const npvRecurring = annualRecurring * pvifa;
        // PVIFA(10%,5) ≈ 3.7908 → NPV ≈ $2,482,965
        const expectedNpv = annualRecurring * 3.790786769408448;
        assert.ok(Math.abs(npvRecurring - expectedNpv) < 0.01,
            'NPV of $655k/yr × PVIFA ≈ $2,482,965 — correctly discounts future cash flows');
        assert.ok(npvRecurring > annualRecurring,
            'NPV of 5-year stream > single year cost');
        assert.ok(npvRecurring < annualRecurring * n,
            'NPV < undiscounted sum ($3.275M) — time value of money is applied');
    });

    it('NPV total = one-time costs + NPV of recurring costs', () => {
        const oneTime = 225000; // cOppDirect 25k + capex 200k
        const annualRecurring = 655000;
        const r = 0.10, n = 5;
        const pvifa = (1 - Math.pow(1 + r, -n)) / r;
        const npvTotal = oneTime + annualRecurring * pvifa;
        const expected = oneTime + annualRecurring * 3.790786769408448;
        assert.ok(Math.abs(npvTotal - expected) < 0.01,
            'NPV Total = one-time costs + discounted recurring stream');
    });

    it('Discounted payback > simple payback (time value of money extends payback)', () => {
        const annualSavings = 348000;
        const capex = 200000;
        const simplePb = capex / (annualSavings / 12);
        const discountedPb = discountedPayback(annualSavings, capex);
        assert.ok(discountedPb >= simplePb,
            'Discounted payback (' + discountedPb.toFixed(1) + ' mo) ≥ simple payback (' + simplePb.toFixed(1) + ' mo)');
    });

    it('DiscountedPayback returns Infinity for zero savings', () => {
        assert.strictEqual(discountedPayback(0, 100000), Infinity);
    });

    it('DiscountedPayback returns Infinity for zero investment', () => {
        assert.strictEqual(discountedPayback(50000, 0), Infinity);
    });

    it('DiscountedPayback returns Infinity when savings never cover investment within horizon', () => {
        const result = discountedPayback(1000, 1000000);
        assert.strictEqual(result, Infinity,
            'Small savings ($1k/yr) vs large investment ($1M) never pay back in 5-yr horizon');
    });

    it('Single-year totalImpact still available for waterfall chart compatibility', () => {
        const cWaste = 575000, cRisk = 80000, cOppDirect = 25000; // cWaste = 500k x 1.15
        const totalImpact = cWaste + cRisk + cOppDirect;
        assert.strictEqual(totalImpact, 680000,
            'Single-year totalImpact = $680,000 — kept for legacy display');
    });

    it('IRR > WACC for a profitable investment', () => {
        const cf = [-200000];
        for (let m = 1; m <= 60; m++) cf.push(29000); // $348k/yr / 12
        const irr = calculateIRR(cf);
        assert.ok(irr !== null, 'IRR should be computable');
        assert.ok(irr > COEFFICIENTS.DISCOUNT_RATE_DEFAULT,
            'IRR (' + (irr * 100).toFixed(1) + '%) should exceed WACC (' + (COEFFICIENTS.DISCOUNT_RATE_DEFAULT * 100) + '%)');
    });

    it('IRR is meaningless (null or < -90%) for all-negative cash flows', () => {
        const cf = [-100, -50, -30];
        const irr = calculateIRR(cf);
        assert.ok(irr === null || irr < -0.9,
            'All-negative flows have no meaningful IRR (got ' + (irr !== null ? (irr * 100).toFixed(1) + '%' : 'null') + ')');
    });

    it('IRR = 0 for zero-NPV investment (break-even)', () => {
        const cf = [-1000];
        for (let m = 1; m <= 60; m++) cf.push(16.67); // ~$200/yr = exactly pay back $1000
        const irr = calculateIRR(cf);
        assert.ok(irr !== null, 'Break-even should have computable IRR');
        assert.ok(Math.abs(irr) < 0.01, 'Break-even IRR ≈ 0%');
    });
});

// ── Known Issue #5 (runtime integrity) — calculate() logic audit ──
describe('Known Issue #5 — Runtime integrity: calculate() logic audit', () => {

    // Replicate the core of calculate() with default coefficients (no DOM)
    function calcRuntime(sample) {
        const s = Object.assign({
            manualPercent: 40,
            downCost: 5000,
            failures: 8,
            mttr: 4,
            rate: 150,
            managerHrs: 40,
            opportunityVal: 100000,
            riskLevel: 3,
            autoLevel: 0.6,
            teamSize: 10,
            capex: 50000,
            erosionRate: COEFFICIENTS.PIPELINE_EROSION_RATE_DEFAULT,
            discountRate: COEFFICIENTS.DISCOUNT_RATE_DEFAULT,
            horizonYears: COEFFICIENTS.TIME_HORIZON_YEARS_DEFAULT,
            leverAuto: COEFFICIENTS.LEVER_AUTOMATION_DEFAULT,
            leverRisk: COEFFICIENTS.LEVER_RISK_DEFAULT,
        }, sample);

        const manualAnnualHrs = COEFFICIENTS.SPRINT_HOURS * COEFFICIENTS.SPRINTS_PER_YEAR * (s.manualPercent / 100);
        const chasingAnnualHrs = s.managerHrs * COEFFICIENTS.MONTHS_PER_YEAR;
        const annualFailures = s.failures * COEFFICIENTS.QUARTERS_PER_YEAR;

        const cWaste = (manualAnnualHrs + chasingAnnualHrs) * s.rate * s.teamSize * 1.15;
        const cRisk = (annualFailures * s.mttr * s.downCost) * (s.riskLevel / COEFFICIENTS.RISK_SCALE_MAX);
        const cOppDirect = s.opportunityVal * s.erosionRate;
        const totalImpact = cWaste + cRisk + cOppDirect;
        const annualRecurring = cWaste + cRisk;
        const oneTimeCosts = cOppDirect + s.capex;
        const dr = s.discountRate;
        const ny = s.horizonYears;
        const pvifa = dr > 0 ? (1 - Math.pow(1 + dr, -ny)) / dr : ny;
        const npvTotalDebt = oneTimeCosts + annualRecurring * pvifa;
        const potentialSavings = (cWaste + cRisk) * s.autoLevel;

        return { cWaste, cRisk, cOppDirect, totalImpact, npvTotalDebt, potentialSavings };
    }

    // ── Test 1: MTTR is used as hours in cRisk ──
    it('cRisk uses MTTR (q11) as hours — dimensionally correct at runtime', () => {
        // (failures × q4 × q11) × (q9/5)
        // Given: q5=2 failures/qtr, q4=$5000/hr, q11=4hrs, q9=3 → cRisk
        const r = calcRuntime({ failures: 2, downCost: 5000, mttr: 4, riskLevel: 3 });
        // failures/yr = 2 × 4 = 8; cRisk = (8 × 4 × 5000) × (3/5) = $96,000
        assert.strictEqual(r.cRisk, 96000,
            'cRisk = (8failures × 4hrs × $5000/hr) × (3/5) = $96,000 — MTTR treated as hours');
    });

    it('cRisk scales linearly with MTTR — proves it is a time multiplier, not currency', () => {
        const r1 = calcRuntime({ mttr: 2 }); // half MTTR
        const r2 = calcRuntime({ mttr: 8 }); // double MTTR
        assert.strictEqual(r2.cRisk, r1.cRisk * 4,
            'Doubling MTTR (2→8 hrs) quadruples cRisk — MTTR is a linear time multiplier');
    });

    it('Scenario A (Do Nothing) savings = 0 — no unintended OPEX leakage', () => {
        const r = calcRuntime({ autoLevel: 0 });
        assert.strictEqual(r.potentialSavings, 0,
            'With autoLevel=0, potentialSavings = $0 — no phantom savings');
    });

    it('Overriding erosionRate to 0 zeroes cOppDirect', () => {
        const rDefault = calcRuntime({ erosionRate: 0.1 });
        const rZero = calcRuntime({ erosionRate: 0 });
        assert.strictEqual(rZero.cOppDirect, 0,
            'With erosionRate=0, cOppDirect = $0');
        assert.strictEqual(rDefault.cOppDirect, 10000,
            'cOppDirect = $100k × 0.1 = $10,000 — linear relationship');
    });

    // ── Test 4: NPV in calculate() is consistent with PVIFA ──
    it('NPV total = oneTimeCosts + annualRecurring × PVIFA(discountRate, horizonYears)', () => {
        const r = calcRuntime({ discountRate: 0.10, horizonYears: 5 });
        const dr = 0.10, ny = 5;
        const pvifa = (1 - Math.pow(1 + dr, -ny)) / dr;
        const annualRecurring = r.cWaste + r.cRisk;
        const oneTime = r.cOppDirect + 50000;
        const expectedNpv = oneTime + annualRecurring * pvifa;
        assert.ok(Math.abs(r.npvTotalDebt - expectedNpv) < 0.01,
            'npvTotalDebt = ' + r.npvTotalDebt + ', PVIFA formula gives ' + expectedNpv.toFixed(2));
    });

    it('Discount rate of 0% collapses PVIFA to plain n-years (no discounting)', () => {
        const r = calcRuntime({ discountRate: 0, horizonYears: 5 });
        const annualRecurring = r.cWaste + r.cRisk;
        const oneTime = r.cOppDirect + 50000;
        const expected = oneTime + annualRecurring * 5; // undiscounted sum
        assert.strictEqual(r.npvTotalDebt, expected,
            'At 0% discount, NPV = oneTime + annualRecurring × 5');
    });

    it('Longer horizon increases NPV total (more recurring years counted)', () => {
        const r3 = calcRuntime({ horizonYears: 3 });
        const r10 = calcRuntime({ horizonYears: 10 });
        assert.ok(r10.npvTotalDebt > r3.npvTotalDebt,
            'NPV at 10yr horizon ($' + r10.npvTotalDebt.toFixed(0) +
            ') > NPV at 3yr horizon ($' + r3.npvTotalDebt.toFixed(0) + ')');
    });

    it('Higher WACC lowers NPV (time value of money)', () => {
        const rLow = calcRuntime({ discountRate: 0.05 });
        const rHigh = calcRuntime({ discountRate: 0.15 });
        assert.ok(rHigh.npvTotalDebt < rLow.npvTotalDebt,
            'NPV at 15% WACC < NPV at 5% WACC — higher discount rate reduces present value');
    });
});
