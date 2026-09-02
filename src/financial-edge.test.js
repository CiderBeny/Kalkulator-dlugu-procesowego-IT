// Financial edge-case contract — the three boundary regimes that the main
// audit suite routes around:
//   1. Zero is a VALID input everywhere (every q-field, rate, capex, levers,
//      tax, discount rate) — it must never produce NaN, and must collapse the
//      affected metric to its documented degenerate value (0 / Infinity / null).
//   2. IRR with NO root — a pure sign-change search must return null exactly
//      when the flow stream cannot have a positive root.
//   3. NPV / IRR / payback consistency — the three metrics must never
//      contradict each other, and the scenario engine must agree with the
//      headline computeModel.
//
// Tests call the REAL modules via the same Node shim as model-audit.test.js.

const { describe, it } = require('node:test');
const assert = require('node:assert');

global.window = global;
global.document = { getElementById: () => null };
require('./config.js');
require('./i18n.js');
require('./utils.js');
require('./model.js');
const P = global.PDE;

const mkParams = function (overrides) {
    const p = {
        manualPercent: 10, downCost: 3000, failures: 1, mttr: 4, rate: 60,
        managerHrs: 20, opportunityVal: 100000, riskLevel: 3, autoLevel: 50,
        teamSize: 5, capex: 300000, erosionRate: 0.25, discountRate: 0.093,
        horizonYears: 5, contextPremium: 0.15, taxRate: 19, turnover: 12,
        scenCAutoLevel: 0.8, scenCCapexMult: 1.5, annualHours: 1800,
        leverAuto: 0.3, leverRisk: 0.6, leverInnovation: 0.5,
        leverManagement: 0.15, leverTurnover: 0.3,
        correlationsEnabled: false, advancedRiskEnabled: false,
        nonlinearEnabled: false, docStandard: 3,
    };
    return Object.assign({}, p, overrides || {});
};

// Every numeric output that is NON-null must be finite. Only `irr` may be
// null and only `paybackMonths` may be Infinity.
function assertFiniteModel(r, label) {
    assert.strictEqual(typeof r, 'object', label + ': computeModel returned nothing');
    Object.keys(r).forEach(k => {
        const v = r[k];
        if (k === 'irr') return;                 // null is legitimate
        if (k === 'paybackMonths') return;       // Infinity is legitimate
        if (typeof v !== 'number') return;       // advancedRiskEnabled is a boolean
        assert.ok(isFinite(v),
            label + ': "' + k + '" must be a finite number, got ' + v);
    });
}

describe('zero is a valid input — no NaN, correct degenerate outputs', () => {
    it('every q-field zeroed in turn keeps every output finite', () => {
        const zeroed = {
            manualPercent: 0,     // q1 — manual effort
            downCost: 0,          // q4 — downtime cost
            failures: 0,          // q5 — human errors
            mttr: 0,              // q11 — MTTR
            rate: 0,              // q6 — blended rate
            managerHrs: 0,        // q7 — management overhead
            opportunityVal: 0,    // q8 — opportunity margin
            erosionRate: 0,       // pipeline erosion
        };
        Object.keys(zeroed).forEach(field => {
            const params = mkParams({ [field]: zeroed[field] });
            const r = P.computeModel(params);
            assertFiniteModel(r, field + '=0');
        });
    });

    it('manualPercent=0 collapses cWaste to management only', () => {
        const r = P.computeModel(mkParams({ manualPercent: 0, managerHrs: 20 }));
        assert.strictEqual(r.manualAnnualHrs, 0, 'manual hours must be 0');
        assert.strictEqual(r.chasingAnnualHrs, 240, 'management hours unaffected (20h × 12m)');
        assert.ok(r.cWaste > 0 && isFinite(r.cWaste), 'cWaste still driven by management hours');
    });

    it('failures=0 zeroes cRisk while cWaste survives', () => {
        const r = P.computeModel(mkParams({ failures: 0 }));
        assert.strictEqual(r.cRisk, 0, 'risk exposure must be 0');
        assert.ok(r.cWaste > 0, 'operating waste is independent of failures');
        assert.ok(isFinite(r.totalImpact), 'totalImpact finite');
    });

    it('rate=0 (q6) zeroes cWaste and the whole recurring base', () => {
        const r = P.computeModel(mkParams({ rate: 0 }));
        assert.strictEqual(r.cWaste, 0, 'no blended rate → no waste cost');
        assert.strictEqual(r.manualAnnualHrs, 180, 'hours still counted (0 × rate = 0)');
        assert.ok(isFinite(r.totalImpact), 'totalImpact finite');
    });

    it('mttr=0 zeroes cRisk', () => {
        const r = P.computeModel(mkParams({ mttr: 0 }));
        assert.strictEqual(r.cRisk, 0, '0-hour MTTR → zero risk exposure');
        assert.ok(isFinite(r.npvTotalDebt), 'NPV finite');
    });

    it('downCost=0 zeroes cRisk', () => {
        const r = P.computeModel(mkParams({ downCost: 0 }));
        assert.strictEqual(r.cRisk, 0, '0 $/h downtime → zero risk exposure');
    });

    it('opportunityVal=0 zeroes cOppDirect', () => {
        const r = P.computeModel(mkParams({ opportunityVal: 0 }));
        assert.strictEqual(r.cOppDirect, 0, 'no opportunity margin → no erosion loss');
        assert.ok(isFinite(r.totalImpact), 'totalImpact finite');
    });

    it('erosionRate=0 zeroes cOppDirect despite opportunity margin', () => {
        const r = P.computeModel(mkParams({ erosionRate: 0 }));
        assert.strictEqual(r.cOppDirect, 0, 'no erosion → no opportunity leakage');
        assert.ok(isFinite(r.totalImpact), 'totalImpact finite');
    });

    it('autoLevel=0 is a valid "no automation" scenario, not an error', () => {
        const r = P.computeModel(mkParams({ autoLevel: 0, capex: 50000 }));
        assert.strictEqual(r.targetSavings, 0, 'no automation → no target savings');
        assert.strictEqual(r.potentialSavings, 0, 'no savings to capture');
        assert.strictEqual(r.paybackMonths, Infinity, 'never pays back');
        assert.strictEqual(r.irr, null, 'no positive IRR for an all-non-positive flow');
        assertFiniteModel(r, 'autoLevel=0');
    });

    it('capex=0 is a valid input — nothing captured, no IRR root', () => {
        const r = P.computeModel(mkParams({ capex: 0, autoLevel: 60 }));
        assert.ok(r.recoverable > 0, 'recoverable exposure still positive');
        assert.strictEqual(r.potentialSavings, 0, 'capture factor is 0 with no investment');
        assert.strictEqual(r.paybackMonths, Infinity, 'zero investment → Infinity by contract');
        assert.strictEqual(r.irr, null, 'no sign change (no initial outflow) → null');
        assertFiniteModel(r, 'capex=0');
    });

    it('discountRate=0 keeps NPV numeric and collapses to undiscounted years', () => {
        const r = P.computeModel(mkParams({ discountRate: 0, taxRate: 0 }));
        assert.ok(isFinite(r.npvTotalDebt), 'NPV finite at 0% discount');
        const pvifaExpected = 5; // ny=5, dr=0 → pvifa = ny
        assert.ok(Math.abs(r.npvRecurring - (r.cWaste + r.cRisk) * pvifaExpected) < 1e-6,
            '0% discount collapses PVIFA to plain years');
    });

    it('taxRate=0 disables the tax shield branch', () => {
        const r = P.computeModel(mkParams({ taxRate: 0 }));
        assert.ok(isFinite(r.npvTotalDebt), 'NPV finite');
    });

    it('zero levers and zero autoLevel together still yield a finite model', () => {
        const r = P.computeModel(mkParams({
            leverAuto: 0, leverRisk: 0, autoLevel: 0,
            leverInnovation: 0, leverManagement: 0, leverTurnover: 0,
        }));
        assertFiniteModel(r, 'all-zero levers');
        assert.strictEqual(r.recoverable, 0, 'nothing recoverable');
        assert.strictEqual(r.potentialSavings, 0, 'nothing to capture');
        assert.strictEqual(r.paybackMonths, Infinity, 'no recovery → Infinity');
        assert.strictEqual(r.irr, null, 'no recovery → null IRR');
    });

    it('all-zero base model returns the documented degenerate bundle', () => {
        const r = P.computeModel(mkParams({
            manualPercent: 0, downCost: 0, failures: 0, mttr: 0, rate: 0,
            managerHrs: 0, opportunityVal: 0, riskLevel: 0, autoLevel: 0,
            turnover: 0, leverAuto: 0, leverRisk: 0, capex: 0,
        }));
        assertFiniteModel(r, 'all-zero');
        assert.strictEqual(r.cWaste, 0, 'cWaste');
        assert.strictEqual(r.cRisk, 0, 'cRisk');
        assert.strictEqual(r.cOppDirect, 0, 'cOppDirect');
        assert.strictEqual(r.totalImpact, 0, 'totalImpact');
        assert.strictEqual(r.netDebt, 0, 'netDebt (0 − capex 0)');
        assert.strictEqual(r.potentialSavings, 0, 'potentialSavings');
        assert.strictEqual(r.paybackMonths, Infinity, 'paybackMonths');
        assert.strictEqual(r.irr, null, 'irr');
    });
});

describe('IRR without a root', () => {
    it('calculateIRR returns null for an all-positive flow (no cash outflow)', () => {
        assert.strictEqual(P.calculateIRR([100, 200, 300]), null);
    });

    it('calculateIRR returns null for an all-negative flow (no recovery)', () => {
        assert.strictEqual(P.calculateIRR([-100, -200, -300]), null);
    });

    it('calculateIRR returns null for an all-zero flow', () => {
        assert.strictEqual(P.calculateIRR([0, 0, 0, 0]), null);
    });

    it('calculateIRR returns null when NPV at both brackets is negative', () => {
        // A single huge outflow with tiny inflows: no rate in [-0.99, 1000]
        // makes the stream break even — the root does not exist.
        const flows = [-1e9, 1, 1, 1, 1, 1];
        assert.strictEqual(P.calculateIRR(flows), null);
    });

    it('single-element flow with a negative value has no root', () => {
        assert.strictEqual(P.calculateIRR([-1000]), null);
    });

    it('empty flow has no root', () => {
        assert.strictEqual(P.calculateIRR([]), null);
    });

    it('unprofitable ramp: payback is Infinity and IRR is null or deeply negative', () => {
        // CAPEX 1e9 vs tiny savings — discounted savings never cover it. The
        // sign-change bisection still converges to a strongly negative rate
        // (root exists because the -0.99 bracket inflates future flows), so
        // payback must be Infinity and IRR must be null (savings ≤ 0) or < 0.
        const r = P.computeModel(mkParams({ autoLevel: 5, capex: 1e9 }));
        assert.strictEqual(r.paybackMonths, Infinity, 'payback must be Infinity');
        assert.ok(r.irr === null || r.irr < 0,
            'IRR must be null (no sign change) or clearly negative, got ' + r.irr);
        assertFiniteModel(r, 'unprofitable ramp');
    });
});

describe('NPV / IRR / payback mutual consistency', () => {
    it('positive NPV ⟺ IRR above the discount rate ⟺ finite payback', () => {
        // Run both a profitable and an unprofitable board across a CAPEX sweep.
        const rates = [0.05, 0.093, 0.15, 0.20];
        const autoLevels = [20, 50, 100];
        const capexes = [100000, 300000, 600000, 1e6, 3e6];

        const checked = { netPos: 0, netNeg: 0 };
        rates.forEach(dr => {
            autoLevels.forEach(al => {
                capexes.forEach(cx => {
                    const base = mkParams({ autoLevel: al, capex: cx, discountRate: dr });
                    const m = P.computeModel(base);

                    if (m.irr !== null && m.irr > dr + 1e-4) {
                        // IRR above cost of capital → project earns money.
                        assert.ok(m.paybackMonths < Infinity,
                            `al=${al} cx=${cx} dr=${dr}: irr ${m.irr} > dr should pay back`);
                        assert.ok(m.paybackMonths >= 4,
                            'ramp floor: payback cannot be shorter than the 3-month ramp');
                        checked.netPos++;
                    } else if (m.irr !== null && m.irr < dr - 1e-4) {
                        // IRR below cost of capital → never covers discounting.
                        assert.strictEqual(m.paybackMonths, Infinity,
                            `al=${al} cx=${cx} dr=${dr}: irr ${m.irr} < dr must NOT pay back`);
                        checked.netNeg++;
                    }
                });
            });
        });

        assert.ok(checked.netPos > 5, 'sweep should contain profitable boards (' + checked.netPos + ')');
        assert.ok(checked.netNeg > 5, 'sweep should contain unprofitable boards (' + checked.netNeg + ')');
    });

    it('irr=null and payback=Infinity always co-occur through computeModel', () => {
        // Any parameter combination where one is degenerate, both are.
        const samples = [
            mkParams({ autoLevel: 0 }),
            mkParams({ capex: 0 }),
            mkParams({ autoLevel: 0, capex: 0 }),
            mkParams({ manualPercent: 0, managerHrs: 0, failures: 0, rate: 0, opportunityVal: 0 }),
            mkParams({ leverAuto: 0, leverRisk: 0, autoLevel: 10, capex: 1e6 }),
        ];
        samples.forEach((p, i) => {
            const r = P.computeModel(p);
            assert.strictEqual(
                r.irr === null, r.paybackMonths === Infinity,
                'sample #' + i + ': irr-null and payback-Infinity must agree'
            );
        });
    });

    it('scenCalc answers match the headline computeModel for the same inputs', () => {
        // scenCalc(al, cx, recoverable, dr, ny) must produce the SAME payback
        // and IRR as computeModel on the identical base — the scenario cards
        // are presented next to the headline verdict.
        const dr = 0.093;
        const ny = 5;
        [0.2, 0.5, 0.8, 1.0].forEach(al => {
            [50000, 150000, 400000].forEach(cx => {
                // autoLevel=0 deliberately excluded: computeModel returns irr=null
                // (all-non-positive flow) while scenCalc returns irr=0 by design.
                const m = P.computeModel(mkParams({
                    autoLevel: al * 100,
                    capex: cx,
                    discountRate: dr,
                    horizonYears: ny,
                    manualPercent: 50, failures: 5, mttr: 6, rate: 80,
                    managerHrs: 30, opportunityVal: 200000,
                }));
                const s = P.scenCalc(al, cx, m.recoverable, dr, ny);
                assert.ok(s.savings > 0, `al=${al} cx=${cx}: savings should be positive`);
                assert.strictEqual(s.pb, m.paybackMonths,
                    `al=${al} cx=${cx}: scenCalc payback ${s.pb} ≠ model ${m.paybackMonths}`);
                assert.strictEqual(s.irr, m.irr,
                    `al=${al} cx=${cx}: scenCalc irr ${s.irr} ≠ model ${m.irr}`);
            });
        });
    });
});