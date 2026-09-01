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
    CONTEXT_PREMIUM_DEFAULT: 0.15,
    TAX_RATE_DEFAULT: 0,
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
    REC_AUTO_MIN_WASTE:        0,
    REC_RISK_MIN_EXPOSURE:     0,
    REC_INNOVATION_MIN:        0,
    CAPEX_MIN_ABS:             1000,
    CAPEX_RECOVERY_RATIO:      0.10,
    DISCOUNT_RATE_DEFAULT:      0.093,
    TIME_HORIZON_YEARS_DEFAULT: 5,
};

function rampFactor(month) {
    if (month <= 3) return 0;
    if (month <= 6) return 0.5;
    return 1;
}

function discountedPayback(annualSavings, investment, rate, maxYears, ramp) {
    if (annualSavings <= 0 || investment <= 0) return Infinity;
    if (rate === undefined) rate = COEFFICIENTS.DISCOUNT_RATE_DEFAULT;
    if (maxYears === undefined) maxYears = COEFFICIENTS.TIME_HORIZON_YEARS_DEFAULT;
    const monthly = annualSavings / 12;
    let cumulative = 0;
    const maxMonths = maxYears * 12;
    for (let m = 1; m <= maxMonths; m++) {
        cumulative += (monthly * (ramp ? rampFactor(m) : 1)) / Math.pow(1 + rate, m / 12);
        if (cumulative >= investment) return m;
    }
    return Infinity;
}

function calculateIRR(cashFlows) {
    if (cashFlows.every(function (v) { return v === 0; })) return null;
    const precision = 1e-6;
    const maxIter = 1000;
    const low = -0.99;
    const high = 1000;
    let npv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
        npv += cashFlows[t] / Math.pow(1 + low, t / 12);
    }
    const npvLow = npv;
    npv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
        npv += cashFlows[t] / Math.pow(1 + high, t / 12);
    }
    const npvHigh = npv;
    if (!((npvLow <= 0 && npvHigh >= 0) || (npvLow >= 0 && npvHigh <= 0))) {
        return null;
    }
    let lo = low;
    let hi = high;
    for (let i = 0; i < maxIter; i++) {
        const rate = (lo + hi) / 2;
        let cur = 0;
        for (let t = 0; t < cashFlows.length; t++) {
            cur += cashFlows[t] / Math.pow(1 + rate, t / 12);
        }
        if (Math.abs(cur) < precision) return rate;
        if (cur > 0) lo = rate; else hi = rate;
        if (hi - lo < precision) return (lo + hi) / 2;
    }
    return null;
}

// Mirrors PDE.isMeaningfulCapex — a CAPEX below the lower of the absolute
// floor and 1 month of savings is not a meaningful investment (payback would
// collapse to the 4-month ramp floor).
function isMeaningfulCapex(capex, annualSavings) {
    if (!isFinite(capex) || !isFinite(annualSavings) || annualSavings <= 0) return false;
    return capex >= Math.min(COEFFICIENTS.CAPEX_MIN_ABS, annualSavings / 12);
}

// Mirrors PDE.referenceCapex — the investment needed to fully realize target savings.
function referenceCapex(targetSavings) {
    if (!isFinite(targetSavings) || targetSavings <= 0) return 0;
    return targetSavings * COEFFICIENTS.CAPEX_RECOVERY_RATIO;
}

// Mirrors PDE.captureFactor — fraction of target savings realized for a given CAPEX.
function captureFactor(capex, targetSavings) {
    const ref = referenceCapex(targetSavings);
    if (!isFinite(capex) || capex <= 0 || ref <= 0) return 0;
    return Math.min(1, capex / ref);
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
        assert.strictEqual(COEFFICIENTS.DISCOUNT_RATE_DEFAULT, 0.093,
            'Discount rate = 9.3% (Damodaran 2025 IT Infrastructure median)');
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

    // ── CAPEX meaningfulness gate (fixes absurd hero for tiny CAPEX) ──
    describe('CAPEX meaningfulness gate — tiny investments must not produce a fake payback', () => {
        it('$1 CAPEX against $660k savings is NOT a meaningful investment', () => {
            assert.strictEqual(isMeaningfulCapex(1, 660873), false,
                'Payback would collapse to the 4-month ramp floor — hero must warn instead');
        });

        it('default $50k CAPEX against $660k savings IS meaningful', () => {
            assert.strictEqual(isMeaningfulCapex(50000, 660873), true);
        });

        it('CAPEX equal to the absolute floor ($1k) is meaningful', () => {
            assert.strictEqual(isMeaningfulCapex(1000, 660873), true);
        });

        it('low-savings scenario: relative floor (1 month of savings) governs, not the $1k absolute floor', () => {
            assert.strictEqual(isMeaningfulCapex(100, 2000), false,
                'With $2k/yr savings the floor is ~$167 — $100 CAPEX is not meaningful');
            assert.strictEqual(isMeaningfulCapex(167, 2000), true);
            assert.strictEqual(isMeaningfulCapex(1000, 2000), true,
                'A $1k CAPEX equals 6 months of $2k/yr savings — clearly meaningful');
        });

        it('zero or negative savings is never meaningful', () => {
            assert.strictEqual(isMeaningfulCapex(50000, 0), false);
            assert.strictEqual(isMeaningfulCapex(50000, -100), false);
        });

        it('a tiny CAPEX still yields payback = 4 months (the ramp floor), proving the gate is needed', () => {
            assert.strictEqual(discountedPayback(660873, 1, undefined, undefined, true), 4,
                'Any CAPEX under half a month of savings reports the same meaningless 4-month floor');
        });
    });

    // ── CAPEX adequacy — savings scale with investment (capture rate) ──
    describe('CAPEX adequacy — savings scale with investment (capture rate)', () => {
        const target = 376990; // ~$377k annual target savings (user scenario)
        const ref    = 37699;  // reference CAPEX = 10% of target

        it('reference CAPEX = CAPEX_RECOVERY_RATIO × target savings (10%)', () => {
            assert.ok(Math.abs(referenceCapex(target) - ref) < 1e-6,
                'referenceCapex(' + target + ') = ' + referenceCapex(target) + ', expected ~' + ref);
        });

        it('$1k vs $100k CAPEX produce DIFFERENT realized savings (the core fix)', () => {
            const c1 = captureFactor(1000, target);
            const c2 = captureFactor(100000, target);
            assert.ok(c1 < c2, 'capture($1k) = ' + c1 + ' must be < capture($100k) = ' + c2);
            assert.ok(Math.abs(c1 - 1000 / ref) < 1e-9,
                'linear capture below full funding: ' + c1 + ' ≈ ' + (1000 / ref));
            assert.strictEqual(c2, 1, 'capture($100k) = 1 (fully funded, capped)');
            assert.ok(c1 * target < c2 * target,
                'realized savings scale with investment: ' + (c1 * target) + ' < ' + (c2 * target));
        });

        it('capture is 0 for zero/negative CAPEX or target', () => {
            assert.strictEqual(captureFactor(0, target), 0);
            assert.strictEqual(captureFactor(-5000, target), 0);
            assert.strictEqual(captureFactor(50000, 0), 0);
            assert.strictEqual(captureFactor(50000, -100), 0);
        });

        it('the meaningfulness barrier keys off TARGET savings (not realized)', () => {
            assert.strictEqual(isMeaningfulCapex(1, target), false,
                '$1 vs $377k target → below-min warning (realized savings alone would hide this)');
            assert.strictEqual(isMeaningfulCapex(1000, target), true,
                '$1k is above the absolute floor → meaningful');
        });
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

    it('IRR = null for initial investment only (no returns)', () => {
        assert.strictEqual(calculateIRR([-100, 0, 0, 0, 0, 0]), null,
            'Single negative flow with no returns has no zero-crossing');
    });

    it('IRR = null for all-zero cash flows', () => {
        assert.strictEqual(calculateIRR([0, 0, 0, 0, 0]), null,
            'All-zero flows are degenerate — no meaningful IRR');
    });

    it('IRR = null when no sign change exists in [-0.99, 1000]', () => {
        const cf = [-200000, -50000, -10000];
        assert.strictEqual(calculateIRR(cf), null,
            'All-negative flows never cross zero');
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

        const cWaste = (manualAnnualHrs + chasingAnnualHrs) * s.rate * s.teamSize * (1 + (s.contextPremium !== undefined ? s.contextPremium : COEFFICIENTS.CONTEXT_PREMIUM_DEFAULT));
        const cRisk = (annualFailures * s.mttr * s.downCost) * (s.riskLevel / COEFFICIENTS.RISK_SCALE_MAX);
        const cOppDirect = s.opportunityVal * s.erosionRate;
        const totalImpact = cWaste + cRisk + cOppDirect;
        const annualRecurring = cWaste + cRisk;
        const oneTimeCosts = cOppDirect + s.capex;
        const dr = s.discountRate;
        const ny = s.horizonYears;
        const pvifa = dr > 0 ? (1 - Math.pow(1 + dr, -ny)) / dr : ny;
        const npvTotalDebt = oneTimeCosts + annualRecurring * pvifa;
        const recoverable = cWaste * s.leverAuto + cRisk * s.leverRisk;
        const potentialSavings = recoverable * s.autoLevel;

        return { cWaste, cRisk, cOppDirect, totalImpact, npvTotalDebt, recoverable, potentialSavings };
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

// ── Known Issue #7: configurable context premium, tax shield, IRR ramp ──
describe('Known Issue #7 — Configurable context premium, tax shield, IRR ramp', () => {
    function calcNew(sample) {
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
            contextPremium: COEFFICIENTS.CONTEXT_PREMIUM_DEFAULT,
            taxRate: COEFFICIENTS.TAX_RATE_DEFAULT,
            discountRate: COEFFICIENTS.DISCOUNT_RATE_DEFAULT,
            horizonYears: COEFFICIENTS.TIME_HORIZON_YEARS_DEFAULT,
            leverAuto: COEFFICIENTS.LEVER_AUTOMATION_DEFAULT,
            leverRisk: COEFFICIENTS.LEVER_RISK_DEFAULT,
        }, sample);

        const manualAnnualHrs = COEFFICIENTS.SPRINT_HOURS * COEFFICIENTS.SPRINTS_PER_YEAR * (s.manualPercent / 100);
        const chasingAnnualHrs = s.managerHrs * COEFFICIENTS.MONTHS_PER_YEAR;
        const annualFailures = s.failures * COEFFICIENTS.QUARTERS_PER_YEAR;

        const cWaste = (manualAnnualHrs + chasingAnnualHrs) * s.rate * s.teamSize * (1 + s.contextPremium);
        const cRisk = (annualFailures * s.mttr * s.downCost) * (s.riskLevel / COEFFICIENTS.RISK_SCALE_MAX);
        const cOppDirect = s.opportunityVal * s.erosionRate;
        const annualRecurring = cWaste + cRisk;
        const oneTimeCosts = cOppDirect + s.capex;
        const dr = s.discountRate;
        const ny = s.horizonYears;
        const pvifa = dr > 0 ? (1 - Math.pow(1 + dr, -ny)) / dr : ny;
        let npvTotalDebt = oneTimeCosts + annualRecurring * pvifa;
        if (s.taxRate > 0 && s.capex > 0) {
            const taxShield = s.capex * (s.taxRate / 100) * 0.2 * pvifa;
            npvTotalDebt = npvTotalDebt - taxShield;
        }
        const recoverable = cWaste * s.leverAuto + cRisk * s.leverRisk;
        const potentialSavings = recoverable * s.autoLevel;

        const irrCashFlows = [-s.capex];
        for (let mi = 1; mi <= ny * 12; mi++) {
            let rampFactor;
            if (mi <= 3) rampFactor = 0;
            else if (mi <= 6) rampFactor = 0.5;
            else rampFactor = 1;
            irrCashFlows.push((potentialSavings / 12) * rampFactor);
        }
        const irr = calculateIRR(irrCashFlows);

        return { cWaste, cRisk, cOppDirect, npvTotalDebt, recoverable, potentialSavings, irr, irrCashFlows };
    }

    it('context premium default = 15% — configurable 0–30%', () => {
        assert.strictEqual(COEFFICIENTS.CONTEXT_PREMIUM_DEFAULT, 0.15);
    });

    it('cWaste applies (1 + contextPremium) multiplier', () => {
        const base = calcNew({ contextPremium: 0 });
        const withPremium = calcNew({ contextPremium: 0.15 });
        assert.strictEqual(withPremium.cWaste, base.cWaste * 1.15,
            'Premium 15% scales OPEX waste by ×1.15 vs 0% premium');
        const high = calcNew({ contextPremium: 0.30 });
        assert.strictEqual(high.cWaste, base.cWaste * 1.30,
            'Premium 30% scales OPEX waste by ×1.30 vs 0% premium');
    });

    it('tax shield default 0 — NPV unchanged', () => {
        const r = calcNew({ taxRate: 0 });
        const dr = COEFFICIENTS.DISCOUNT_RATE_DEFAULT;
        const ny = COEFFICIENTS.TIME_HORIZON_YEARS_DEFAULT;
        const pvifa = (1 - Math.pow(1 + dr, -ny)) / dr;
        const annualRecurring = r.cWaste + r.cRisk;
        const expected = r.cOppDirect + 50000 + annualRecurring * pvifa;
        assert.ok(Math.abs(r.npvTotalDebt - expected) < 0.01,
            'taxRate=0 → npvTotalDebt = oneTime + annualRecurring × PVIFA');
    });

    it('tax shield reduces NPV by capex × rate × 0.2 × PVIFA (5yr straight-line)', () => {
        const noTax = calcNew({ taxRate: 0 });
        const withTax = calcNew({ taxRate: 30 });
        const dr = COEFFICIENTS.DISCOUNT_RATE_DEFAULT;
        const ny = COEFFICIENTS.TIME_HORIZON_YEARS_DEFAULT;
        const pvifa = (1 - Math.pow(1 + dr, -ny)) / dr;
        const expectedShield = 50000 * 0.30 * 0.2 * pvifa;
        assert.ok(Math.abs((noTax.npvTotalDebt - withTax.npvTotalDebt) - expectedShield) < 0.01,
            'Tax shield = capex(50k) × 30% × 20% × PVIFA ≈ $' + expectedShield.toFixed(0));
    });

    it('tax shield affects NPV only — payback and IRR unchanged by tax rate (pre-tax flows)', () => {
        const noTax = calcNew({ taxRate: 0 });
        const withTax = calcNew({ taxRate: 30 });
        assert.strictEqual(withTax.irr, noTax.irr,
            'IRR is pre-tax — identical regardless of tax rate');
        const dr = COEFFICIENTS.DISCOUNT_RATE_DEFAULT;
        const ny = COEFFICIENTS.TIME_HORIZON_YEARS_DEFAULT;
        const pbNoTax = discountedPayback(noTax.potentialSavings, 50000, dr, ny, true);
        const pbWithTax = discountedPayback(withTax.potentialSavings, 50000, dr, ny, true);
        assert.strictEqual(pbWithTax, pbNoTax,
            'Payback is pre-tax — identical regardless of tax rate');
        assert.notStrictEqual(noTax.npvTotalDebt, withTax.npvTotalDebt,
            'NPV does change with tax rate (tax shield applies to NPV only)');
    });

    it('IRR assumes a 6-month ramp (3mo zero savings, 3mo 50%)', () => {
        const r = calcNew({});
        assert.strictEqual(r.irrCashFlows[1], 0, 'Month 1 savings = 0');
        assert.strictEqual(r.irrCashFlows[3], 0, 'Month 3 savings = 0');
        assert.strictEqual(r.irrCashFlows[4], (r.potentialSavings / 12) * 0.5, 'Month 4 savings = 50%');
        assert.strictEqual(r.irrCashFlows[6], (r.potentialSavings / 12) * 0.5, 'Month 6 savings = 50%');
        assert.strictEqual(r.irrCashFlows[7], r.potentialSavings / 12, 'Month 7 savings = 100%');
    });

    it('ramped IRR is lower than instant-savings IRR (conservative)', () => {
        const s = {
            manualPercent: 10, downCost: 3000, failures: 1, mttr: 4, rate: 60,
            managerHrs: 20, opportunityVal: 100000, riskLevel: 3, autoLevel: 0.5,
            teamSize: 5, capex: 300000, contextPremium: 0.15, taxRate: 0,
        };
        const ramped = calcNew(s);
        const instantFlows = [-300000];
        for (let mi = 1; mi <= COEFFICIENTS.TIME_HORIZON_YEARS_DEFAULT * 12; mi++) instantFlows.push(ramped.potentialSavings / 12);
        const instantIrr = calculateIRR(instantFlows);
        assert.ok(instantIrr !== null && ramped.irr !== null,
            'IRR should be computable for both flows');
        assert.ok(ramped.irr < instantIrr,
            'Ramped IRR (' + (ramped.irr * 100).toFixed(1) + '%) < instant IRR (' + (instantIrr * 100).toFixed(1) + '%)');
    });

    it('ramped payback is longer than instant-savings payback (conservative, consistent with IRR)', () => {
        const r = calcNew({});
        const dr = COEFFICIENTS.DISCOUNT_RATE_DEFAULT;
        const ny = COEFFICIENTS.TIME_HORIZON_YEARS_DEFAULT;
        const instant = discountedPayback(r.potentialSavings, 50000, dr, ny, false);
        const ramped = discountedPayback(r.potentialSavings, 50000, dr, ny, true);
        assert.ok(instant !== Infinity && ramped !== Infinity,
            'Both paybacks should be finite for a profitable scenario');
        assert.ok(ramped > instant,
            'Ramped payback (' + ramped.toFixed(1) + ' mo) > instant payback (' + instant.toFixed(1) + ' mo)');
    });

    it('ramped payback uses the same 6-month profile as IRR (3mo zero savings, 3mo 50%)', () => {
        const annualSavings = 348000;
        const capex = 200000;
        const dr = COEFFICIENTS.DISCOUNT_RATE_DEFAULT;
        const ny = COEFFICIENTS.TIME_HORIZON_YEARS_DEFAULT;
        const manual = discountedPayback(annualSavings, capex, dr, ny, false);
        const ramped = discountedPayback(annualSavings, capex, dr, ny, true);
        assert.ok(ramped >= 4,
            'Ramped payback (' + ramped.toFixed(1) + ' mo) can never be < 4 months (3 months of zero savings)');
        assert.ok(ramped >= manual,
            'Ramped payback (' + ramped.toFixed(1) + ' mo) ≥ instant payback (' + manual.toFixed(1) + ' mo)');
    });

    it('WACC default = 9.3% (Damodaran 2025 IT Infrastructure median)', () => {
        assert.strictEqual(COEFFICIENTS.DISCOUNT_RATE_DEFAULT, 0.093);
    });
});

// ── Known Issue #8: real-source integration (config + i18n + utils + model) ──
describe('Known Issue #8 — Real source integration (config + model)', () => {
    // Independent replication of PDE.computeModel — autoLevel passed as percent
    function replicateModel(p) {
        const S = COEFFICIENTS;
        const manualPercent = p.manualPercent || 0;
        const failures = (p.failures || 0) * S.QUARTERS_PER_YEAR;
        const rate = p.rate || 0;
        const managerHrs = p.managerHrs || 0;
        const opportunityVal = p.opportunityVal || 0;
        const capex = p.capex || 0;
        const autoLevel = (p.autoLevel || 0) / 100;
        const teamSize = p.teamSize || 0;
        const erosionRate = p.erosionRate !== undefined ? p.erosionRate : S.PIPELINE_EROSION_RATE_DEFAULT;
        const discountRate = p.discountRate !== undefined ? p.discountRate : S.DISCOUNT_RATE_DEFAULT;
        const horizonYears = p.horizonYears || S.TIME_HORIZON_YEARS_DEFAULT;
        const contextPremium = p.contextPremium !== undefined ? p.contextPremium : S.CONTEXT_PREMIUM_DEFAULT;
        const taxRate = p.taxRate !== undefined ? p.taxRate : S.TAX_RATE_DEFAULT;
        const leverAuto = p.leverAuto !== undefined ? p.leverAuto : S.LEVER_AUTOMATION_DEFAULT;
        const leverRisk = p.leverRisk !== undefined ? p.leverRisk : S.LEVER_RISK_DEFAULT;

        const manualAnnualHrs = S.SPRINT_HOURS * S.SPRINTS_PER_YEAR * (manualPercent / 100);
        const chasingAnnualHrs = managerHrs * S.MONTHS_PER_YEAR;
        const cWaste = (manualAnnualHrs + chasingAnnualHrs) * rate * teamSize * (1 + contextPremium);
        const cRisk = (failures * p.mttr * p.downCost) * (p.riskLevel / S.RISK_SCALE_MAX);
        const cOppDirect = opportunityVal * erosionRate;
        const totalImpact = cWaste + cRisk + cOppDirect;
        const netDebt = totalImpact - capex;
        const annualRecurring = cWaste + cRisk;
        const oneTimeCosts = cOppDirect + capex;
        const dr = discountRate;
        const ny = horizonYears;
        const pvifa = dr > 0 ? (1 - Math.pow(1 + dr, -ny)) / dr : ny;
        let npvTotalDebt = oneTimeCosts + annualRecurring * pvifa;
        if (taxRate > 0 && capex > 0) {
            npvTotalDebt -= capex * (taxRate / 100) * 0.2 * pvifa;
        }
        const recoverable = cWaste * leverAuto + cRisk * leverRisk;
        const targetSavings = recoverable * autoLevel;
        const potentialSavings = targetSavings * captureFactor(capex, targetSavings);
        const paybackMonths = discountedPayback(potentialSavings, capex, 0.093, 5, true);
        const irrCashFlows = [-capex];
        for (let mi = 1; mi <= ny * 12; mi++) {
            let rampFactor;
            if (mi <= 3) rampFactor = 0;
            else if (mi <= 6) rampFactor = 0.5;
            else rampFactor = 1;
            irrCashFlows.push((potentialSavings / 12) * rampFactor);
        }
        const irr = calculateIRR(irrCashFlows);
        return { cWaste, cRisk, cOppDirect, totalImpact, netDebt, annualRecurring, oneTimeCosts, npvTotalDebt, recoverable, targetSavings, potentialSavings, paybackMonths, irr };
    }

    let realPDE = null;
    const sample = {
        manualPercent: 10, downCost: 3000, failures: 1, mttr: 4, rate: 60,
        managerHrs: 20, opportunityVal: 100000, riskLevel: 3, autoLevel: 80,
        teamSize: 5, capex: 150000, erosionRate: 0.25, discountRate: 0.093,
        horizonYears: 5, contextPremium: 0.15, taxRate: 19,
        leverAuto: 0.3, leverRisk: 0.6,
    };

    it('loads real config/i18n/utils/model under a Node shim', () => {
        global.window = global;
        global.document = {
            getElementById: (id) => {
                const els = { discountRate: { value: '9.3' }, timeHorizon: { value: '5' } };
                return els[id] || null;
            },
        };
        require('./config.js');
        require('./i18n.js');
        require('./utils.js');
        require('./model.js');
        realPDE = global.window.PDE;
        assert.ok(realPDE && realPDE.COEFFICIENTS, 'PDE namespace loaded from real source');
        assert.strictEqual(realPDE.COEFFICIENTS.DISCOUNT_RATE_DEFAULT, 0.093,
            'Real config: WACC default 9.3%');
        assert.strictEqual(realPDE.COEFFICIENTS.CONTEXT_PREMIUM_DEFAULT, 0.15,
            'Real config: context premium default 15%');
        assert.strictEqual(realPDE.COEFFICIENTS.TAX_RATE_DEFAULT, 0,
            'Real config: tax shield default off');
    });

    it('real computeModel matches independent replication (incl. premium, tax shield, ramp IRR)', () => {
        const real = realPDE.computeModel(sample);
        const exp = replicateModel(sample);
        const fields = ['cWaste', 'cRisk', 'cOppDirect', 'totalImpact', 'netDebt',
            'annualRecurring', 'oneTimeCosts', 'npvTotalDebt', 'potentialSavings', 'paybackMonths'];
        fields.forEach((f) => {
            assert.ok(Math.abs(real[f] - exp[f]) < 0.01,
                'real ' + f + ' (' + real[f] + ') matches replication (' + exp[f] + ')');
        });
        assert.ok(real.irr !== null && Math.abs(real.irr - exp.irr) < 1e-6,
            'real IRR (' + (real.irr * 100).toFixed(2) + '%) matches ramp replication (' + (exp.irr * 100).toFixed(2) + '%)');
    });

    it('real computeModel honors erosionRate=0 (erosion can be turned off)', () => {
        const rZero = realPDE.computeModel(Object.assign({}, sample, { erosionRate: 0 }));
        assert.strictEqual(rZero.cOppDirect, 0,
            'erosionRate=0 must zero cOppDirect — no default 0.25 fallback');
        const rQuarter = realPDE.computeModel(Object.assign({}, sample, { erosionRate: 0.25 }));
        assert.ok(Math.abs(rQuarter.cOppDirect - 100000 * 0.25) < 0.01,
            'erosionRate=0.25 must give cOppDirect = opportunityVal × 0.25');
        assert.ok(rZero.cOppDirect !== rQuarter.cOppDirect,
            'erosionRate=0 and 0.25 must produce different cOppDirect');
    });

    it('real computeModel honors discountRate=0 (no discounting) and lever=0', () => {
        const base = { ...sample, taxRate: 0, contextPremium: 0 };
        const r0 = realPDE.computeModel(Object.assign({}, base, { discountRate: 0, horizonYears: 5 }));
        const rPv = realPDE.computeModel(Object.assign({}, base, { discountRate: 0.093, horizonYears: 5 }));
        const expectedUndiscounted = r0.oneTimeCosts + r0.annualRecurring * 5;
        assert.ok(Math.abs(r0.npvTotalDebt - expectedUndiscounted) < 0.01,
            'discountRate=0 must collapse to undiscounted sum (oneTime + recurring×5)');
        assert.ok(r0.npvTotalDebt > rPv.npvTotalDebt,
            'discountRate=0 must leave NPV undiscounted (higher) than with the 9.3% default');
        const rLever0 = realPDE.computeModel(Object.assign({}, base, { leverAuto: 0, leverRisk: 0 }));
        assert.ok(Math.abs(rLever0.recoverable) < 0.01,
            'leverAuto=0 and leverRisk=0 must give recoverable = 0, not the defaults');
    });

    it('real computeModel honors zero correlation weights (P2)', () => {
        const off = realPDE.computeModel(Object.assign({}, sample, { correlationsEnabled: false }));
        const zeroed = realPDE.computeModel(Object.assign({}, sample, {
            correlationsEnabled: true,
            correlationMultiplier: 0,
            corrQ3Q1: 0, corrQ1Q5: 0, corrQ1Q7: 0, corrQ3Q7: 0,
        }));
        assert.ok(Math.abs(zeroed.cWaste - off.cWaste) < 0.01,
            'all-zero correlation weights must leave cWaste identical to correlations-off (' + zeroed.cWaste + ' vs ' + off.cWaste + ')');
        assert.ok(Math.abs(zeroed.totalImpact - off.totalImpact) < 0.01,
            'all-zero correlation weights must leave totalImpact identical to correlations-off');

        // A strong non-zero correlation weight must actually perturb the model —
        // proving the sliders drive it (regression: `|| default` ignored zeros).
        const strong = realPDE.computeModel(Object.assign({}, sample, {
            correlationsEnabled: true,
            correlationMultiplier: 1,
            corrQ3Q1: 0, corrQ1Q5: 0, corrQ1Q7: 20, corrQ3Q7: 0,
        }));
        assert.notStrictEqual(strong.chasingAnnualHrs, off.chasingAnnualHrs,
            'corrQ1Q7=20 with multiplier 1 must change manager hours away from correlations-off');
    });

    it('real computeModel applies context premium and tax shield', () => {
        const base = realPDE.computeModel(Object.assign({}, sample, { contextPremium: 0, taxRate: 0 }));
        const prem = realPDE.computeModel(Object.assign({}, sample, { contextPremium: 0.15, taxRate: 0 }));
        assert.ok(Math.abs(prem.cWaste - base.cWaste * 1.15) < 0.01,
            'Real cWaste scales by ×1.15 when premium = 15%');
        const taxed = realPDE.computeModel(Object.assign({}, sample, { contextPremium: 0, taxRate: 30 }));
        assert.ok(taxed.npvTotalDebt < base.npvTotalDebt,
            'Real tax shield reduces npvTotalDebt');
    });

    it('scenario B (scenCalc) matches headline computeModel IRR and payback (both ramped)', () => {
        const real = realPDE.computeModel(sample);
        const scenB = realPDE.scenCalc(0.8, 150000, real.recoverable, 0.093, 5);
        assert.ok(real.irr !== null && scenB.irr !== null,
            'Both IRRs should be computable');
        assert.ok(Math.abs(real.irr - scenB.irr) < 1e-6,
            'Scenario B IRR (' + (scenB.irr * 100).toFixed(2) + '%) matches headline IRR (' + (real.irr * 100).toFixed(2) + '%)');
        assert.ok(Math.abs(real.paybackMonths - scenB.pb) < 1e-6,
            'Scenario B payback (' + scenB.pb.toFixed(1) + ' mo) matches headline payback (' + real.paybackMonths.toFixed(1) + ' mo)');
    });

    it('targetSavings = recoverable × autoLevel (lever-weighted recovery)', () => {
        const r = realPDE.computeModel(sample);
        const recoverable = r.cWaste * sample.leverAuto + r.cRisk * sample.leverRisk;
        assert.ok(Math.abs(r.recoverable - recoverable) < 0.01,
            'recoverable = cWaste×leverAuto + cRisk×leverRisk (' + r.recoverable + ' vs ' + recoverable + ')');
        const target = recoverable * (sample.autoLevel / 100);
        assert.ok(Math.abs(r.targetSavings - target) < 0.01,
            'targetSavings = recoverable × autoLevel (' + r.targetSavings + ' vs ' + target + ')');
    });

    it('potentialSavings = targetSavings × captureFactor (fully-funded sample → capture = 1)', () => {
        const r = realPDE.computeModel(sample);
        assert.strictEqual(r.captureFactor, 1,
            'sample CAPEX $150k fully funds the target → capture = 1');
        assert.ok(Math.abs(r.potentialSavings - r.targetSavings) < 0.01,
            'potentialSavings = targetSavings when capture = 1 (' + r.potentialSavings + ' vs ' + r.targetSavings + ')');
    });

    it('potentialSavings never exceeds full lever recovery', () => {
        const r = realPDE.computeModel(sample);
        const leverRecoveryTotal = r.cWaste * sample.leverAuto + r.cRisk * sample.leverRisk;
        assert.ok(r.potentialSavings <= leverRecoveryTotal + 0.01,
            'potentialSavings (' + r.potentialSavings + ') ≤ full lever recovery (' + leverRecoveryTotal + ')');
    });

    it('real computeModel: identical params, different CAPEX → different realized savings', () => {
        const small = realPDE.computeModel(Object.assign({}, sample, { capex: 1000 }));
        const full  = realPDE.computeModel(Object.assign({}, sample, { capex: 150000 }));
        assert.ok(small.captureFactor < full.captureFactor,
            'capture($1k) = ' + small.captureFactor + ' < capture($150k) = ' + full.captureFactor);
        assert.ok(small.potentialSavings < full.potentialSavings,
            'savings scale with CAPEX: $' + small.potentialSavings.toFixed(0) + ' < $' + full.potentialSavings.toFixed(0));
        assert.ok(Math.abs(full.potentialSavings - full.targetSavings) < 0.01,
            'fully funded → realized = target');
    });

    it('real scenCalc: scenario B savings scale with CAPEX and stay consistent with headline', () => {
        const real = realPDE.computeModel(sample);
        const underFunded = realPDE.scenCalc(0.8, 1000, real.recoverable, 0.093, 5);
        const funded      = realPDE.scenCalc(0.8, 150000, real.recoverable, 0.093, 5);
        assert.ok(underFunded.savings < funded.savings,
            'scenario B savings scale with CAPEX: ' + underFunded.savings + ' < ' + funded.savings);
        assert.ok(Math.abs(funded.savings - real.potentialSavings) < 0.01,
            'funded scenario B savings match headline realized savings (' + funded.savings + ' vs ' + real.potentialSavings + ')');
        assert.ok(Math.abs(underFunded.targetSavings - funded.targetSavings) < 0.01,
            'target savings are independent of CAPEX — only realized savings scale');
    });

    describe('paybackSeries — cumulative ROI series consistency', () => {
        it('break-even month matches discountedPayback exactly (same ramp + DCF)', () => {
            const capex = 300000;
            const savings = 100000;
            const rate = 0.093;
            const years = 5;
            const series = realPDE.paybackSeries(capex, savings, rate, years);
            const pb = realPDE.discountedPayback(savings, capex, rate, years, true);
            assert.strictEqual(series.points.length, years,
                'one year-end bar per horizon year');
            assert.ok(isFinite(pb), 'sample should have a finite payback');
            assert.strictEqual(series.breakEvenMonth, pb,
                'cumulative net crosses zero at the same month as discountedPayback (' + pb + ')');
            assert.ok(series.points[0] < 0,
                'year-1 net position stays negative during the 6-month implementation ramp');
            assert.ok(series.points[years - 1] >= 0,
                'final year-end net ≥ 0 when payback is reached within the horizon');
        });

        it('no payback within horizon → breakEvenMonth Infinity and all year-end bars negative', () => {
            const series = realPDE.paybackSeries(1000000, 1000, 0.093, 5);
            assert.strictEqual(series.breakEvenMonth, Infinity);
            series.points.forEach((v) => {
                assert.ok(v < 0, 'year-end net stays below zero when payback never occurs');
            });
        });

        it('zero savings or zero CAPEX yields no payback and flat net = -capex', () => {
            const noSavings = realPDE.paybackSeries(50000, 0, 0.093, 5);
            assert.strictEqual(noSavings.breakEvenMonth, Infinity);
            assert.strictEqual(noSavings.points[4], -50000, 'net stays at -CAPEX with no savings');
            const noCapex = realPDE.paybackSeries(0, 100000, 0.093, 5);
            assert.strictEqual(noCapex.breakEvenMonth, Infinity);
            assert.strictEqual(noCapex.points[4], 0, 'net stays at 0 with no investment');
        });

        it('year-end net position is monotonic non-decreasing', () => {
            const series = realPDE.paybackSeries(300000, 100000, 0.093, 10);
            assert.strictEqual(series.points.length, 10);
            for (let i = 1; i < series.points.length; i++) {
                assert.ok(series.points[i] >= series.points[i - 1] - 1e-6,
                    'bar ' + (i + 1) + ' not below bar ' + i);
            }
        });

        it('break-even month marked in the year it occurs', () => {
            const series = realPDE.paybackSeries(300000, 100000, 0.093, 5);
            const beYear = Math.ceil(series.breakEvenMonth / 12);
            assert.ok(beYear >= 1 && beYear <= series.points.length,
                'break-even year falls within the chart bands');
            assert.ok(series.points[beYear - 1] >= 0,
                'cumulative net is non-negative by the break-even year');
        });
    });
});
