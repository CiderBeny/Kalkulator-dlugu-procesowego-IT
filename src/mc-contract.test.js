// ═══════════════════════════════════════════════════════════════
// Monte Carlo worker ⇄ main-thread model CONTRACT tests
//
// The Web Worker (src/mc-worker.js) is self-contained: it carries its own
// copy of computeModel, calculateIRR, discountedPayback, rampFactor and the
// C/CD/RD constant sets. Any drift between those copies silently changes the
// simulation distribution relative to the headline calculation. These tests
// execute the worker source inside a node:vm sandbox (no browser needed) and
// assert bit-level parity with the real PDE.* implementations on the same
// parameter sets — including the not-otherwise-covered boundary regimes.
// ═══════════════════════════════════════════════════════════════

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// ── Node shim: load the REAL browser modules ──
global.window = global;
global.document = { getElementById: () => null };
require('./config.js');
require('./i18n.js');
require('./utils.js');
require('./model.js');
const P = global.PDE;

// The worker's own computeModel/C constants are embedded in a .js file that
// references `self` — isolated in a vm sandbox so the test needs no worker.
const WORKER_SRC = fs.readFileSync(path.join(__dirname, 'mc-worker.js'), 'utf8');
const PURE_MARKER = '// ── Worker message handler ──';
const PURE_SRC = WORKER_SRC.slice(0, WORKER_SRC.indexOf(PURE_MARKER));

const pureSandbox = {};
vm.createContext(pureSandbox);
vm.runInContext(
    PURE_SRC + '\n;var __CONTRACT = { C: C, RD: RD, CD: CD, seededRandom: seededRandom, randn: randn, rampFactor: rampFactor, discountedPayback: discountedPayback, calculateIRR: calculateIRR, computeModel: computeModel, computeStats: computeStats };',
    pureSandbox
);
const W = pureSandbox.__CONTRACT;

// Keys the worker is contractually required to expose (subset of PDE.computeModel output).
const CONTRACT_KEYS = [
    'cWaste', 'cRisk', 'cOppDirect', 'totalImpact', 'netDebt',
    'annualRecurring', 'oneTimeCosts', 'npvRecurring', 'npvTotalDebt',
    'potentialSavings', 'paybackMonths', 'irr',
];

function near(a, b, eps) {
    if (a === null || b === null) return a === b;
    if (a === Infinity || b === Infinity) return a === b;
    if (a === -Infinity || b === -Infinity) return a === b;
    const scale = Math.max(1, Math.abs(a), Math.abs(b));
    return Math.abs(a - b) <= eps * scale;
}

const mkParams = function (overrides) {
    return Object.assign({
        manualPercent: 10, downCost: 3000, failures: 1, mttr: 4, rate: 60,
        managerHrs: 20, opportunityVal: 100000, riskLevel: 3, autoLevel: 50,
        teamSize: 5, capex: 300000, erosionRate: 0.25, discountRate: 0.093,
        horizonYears: 5, contextPremium: 0.15, taxRate: 19, docStandard: 3,
        correlationsEnabled: false, nonlinearEnabled: false, advancedRiskEnabled: false,
        correlationMultiplier: 0.3, corrQ3Q1: 15, corrQ1Q5: 3, corrQ1Q7: 20, corrQ3Q7: 10,
        riskSecurityWeight: 0.4, riskRegulatoryWeight: 0.25,
        leverAuto: 0.3, leverRisk: 0.6, annualHours: 1800,
    }, overrides || {});
};

function assertParity(params, label) {
    const pde = P.computeModel(params);
    const wrk = W.computeModel(params, W.C);
    assert.strictEqual(typeof pde, 'object', label + ': PDE.computeModel returned no object');
    assert.strictEqual(typeof wrk, 'object', label + ': worker computeModel returned no object');
    CONTRACT_KEYS.forEach((k) => {
        assert.ok(Object.prototype.hasOwnProperty.call(pde, k), label + ': PDE output lacks "' + k + '"');
        assert.ok(Object.prototype.hasOwnProperty.call(wrk, k), label + ': worker output lacks "' + k + '"');
        assert.ok(
            near(pde[k], wrk[k], 1e-9),
            label + ': "' + k + '" PDE=' + pde[k] + ' worker=' + wrk[k]
        );
    });
}

describe('MC worker — constant parity', () => {
    it('C coefficients are a verified subset of PDE.COEFFICIENTS', () => {
        Object.keys(W.C).forEach((k) => {
            assert.ok(Object.prototype.hasOwnProperty.call(P.COEFFICIENTS, k),
                'worker C carries "' + k + '" not present in PDE.COEFFICIENTS');
            assert.strictEqual(W.C[k], P.COEFFICIENTS[k], 'coefficient "' + k + '" drifted');
        });
    });

    it('PDE.COEFFICIENTS still covers every coefficient the worker math reads', () => {
        ['ANNUAL_HOURS_PER_ENGINEER', 'MONTHS_PER_YEAR', 'QUARTERS_PER_YEAR',
            'PIPELINE_EROSION_RATE_DEFAULT', 'CONTEXT_PREMIUM_DEFAULT', 'TAX_RATE_DEFAULT',
            'LEVER_AUTOMATION_DEFAULT', 'LEVER_RISK_DEFAULT', 'RISK_SCALE_MAX',
            'CAPEX_RECOVERY_RATIO', 'DISCOUNT_RATE_DEFAULT', 'TIME_HORIZON_YEARS_DEFAULT']
            .forEach((k) => {
                assert.ok(Object.prototype.hasOwnProperty.call(W.C, k),
                    'worker C is missing "' + k + '" that P.computeModel reads');
            });
    });

    it('RD risk weights match PDE.RISK_WEIGHT_DEFAULTS', () => {
        assert.strictEqual(W.RD.securityWeight, P.RISK_WEIGHT_DEFAULTS.securityWeight);
        assert.strictEqual(W.RD.regulatoryWeight, P.RISK_WEIGHT_DEFAULTS.regulatoryWeight);
    });

    it('CD correlation defaults match PDE.CORRELATION_DEFAULTS', () => {
        Object.keys(W.CD).forEach((k) => {
            assert.strictEqual(W.CD[k], P.CORRELATION_DEFAULTS[k],
                'correlation default "' + k + '" drifted');
        });
    });
});

describe('MC worker — helper function parity', () => {
    it('rampFactor matches PDE.rampFactor for every month 0..13', () => {
        for (let m = 0; m <= 13; m++) {
            assert.strictEqual(W.rampFactor(m), P.rampFactor(m), 'rampFactor(' + m + ')');
        }
    });

    it('calculateIRR returns the same root (or null) as PDE.calculateIRR', () => {
        const sets = [
            [100, 200, 300],                     // all-positive → null
            [-10, -20, -30],                     // all-negative → null
            [0, 0, 0, 0],                        // all-zero → null
            [],                                  // empty → null
            [-50000],                            // single outflow → null
            [-120000, 1000, 1000, 1000, 1000, 1000],
            [-120000, 0, 0, 2000, 2000, 4000, 4000, 6000, 6000],
            [-1000, 50, 80, 120, 200, 300, 400, 500, 600, 700],
        ];
        sets.forEach((cf, i) => {
            const pde = P.calculateIRR(cf);
            const wrk = W.calculateIRR(cf);
            assert.ok(near(pde, wrk, 1e-9),
                'IRR set #' + i + ': PDE=' + pde + ' worker=' + wrk);
        });
    });

    it('discountedPayback matches PDE.discountedPayback incl. Infinity edges', () => {
        const combos = [
            [60000, 100000, 0.093, 5, true],
            [60000, 100000, 0.093, 5, false],
            [120000, 50000, 0.093, 5, true],
            [0, 100000, 0.093, 5, true],        // zero savings → Infinity
            [60000, 0, 0.093, 5, true],         // zero investment → Infinity
            [-60000, 100000, 0.093, 5, true],   // negative savings → Infinity
            [30000, 3000000, 0.093, 5, true],   // never reaches CAPEX → Infinity
            [100000, 400000, 0.12, 4, true],
        ];
        combos.forEach((c, i) => {
            const pde = P.discountedPayback(c[0], c[1], c[2], c[3], c[4]);
            const wrk = W.discountedPayback(c[0], c[1], c[2], c[3], c[4]);
            assert.strictEqual(pde, wrk, 'payback combo #' + i + ': PDE=' + pde + ' worker=' + wrk);
        });
    });

    it('seededRandom is deterministic (same seed → same sequence)', () => {
        const a1 = W.seededRandom(12345);
        const b1 = W.seededRandom(12345);
        const a2 = W.seededRandom(999);
        for (let i = 0; i < 6; i++) {
            assert.strictEqual(a1(), b1(), 'draw #' + i + ' diverged for equal seeds');
        }
        assert.notStrictEqual(a1(), a2(), 'different seeds produced identical first draw');
    });
});

describe('MC worker — computeModel parity with PDE.computeModel', () => {
    it('default parameter set', () => {
        assertParity(mkParams(), 'default');
    });

    it('correlations disabled vs enabled', () => {
        assertParity(mkParams({ correlationsEnabled: false }), 'corr off');
        assertParity(mkParams({
            correlationsEnabled: true, manualPercent: 45, docStandard: 2,
            corrQ3Q1: 20, corrQ1Q5: 4, corrQ1Q7: 30, corrQ3Q7: 12,
        }), 'corr on');
    });

    it('nonlinear team-size + auto-level escalation', () => {
        assertParity(mkParams({ nonlinearEnabled: false }), 'nonlinear off');
        assertParity(mkParams({ nonlinearEnabled: true, teamSize: 25, autoLevel: 80 }), 'nonlinear on');
    });

    it('advanced risk weights', () => {
        assertParity(mkParams({
            advancedRiskEnabled: true, riskSecurityWeight: 0.6, riskRegulatoryWeight: 0.35,
            manualPercent: 60, docStandard: 1,
        }), 'advanced risk on');
    });

    it('all three extensions combined', () => {
        assertParity(mkParams({
            correlationsEnabled: true, nonlinearEnabled: true, advancedRiskEnabled: true,
            manualPercent: 55, docStandard: 4, teamSize: 18, autoLevel: 70,
            corrQ3Q1: 8, corrQ1Q5: 2, corrQ1Q7: 40, corrQ3Q7: 25,
        }), 'combined');
    });

    it('zero CAPEX — all-positive flows, IRR must be null in both', () => {
        assertParity(mkParams({ capex: 0 }), 'capex 0');
    });

    it('zero losses — every cost input at its zero boundary', () => {
        assertParity(mkParams({
            manualPercent: 0, rate: 0, managerHrs: 0,
            downCost: 0, failures: 0, mttr: 0, opportunityVal: 0, autoLevel: 0,
        }), 'all-zero losses');
    });

    it('all fields at their HASH_CONSTRAINTS maxima', () => {
        assertParity(mkParams({
            manualPercent: 100, failures: 9999, mttr: 168, rate: 5000,
            managerHrs: 744, opportunityVal: 1e9, riskLevel: 5, autoLevel: 100,
            teamSize: 10000, capex: 1e9, downCost: 1e7, erosionRate: 1,
            discountRate: 0.2, horizonYears: 10, contextPremium: 0.3, taxRate: 50,
        }), 'all maxima');
    });

    it('all fields at their minimum legal values', () => {
        assertParity(mkParams({
            manualPercent: 0, failures: 0, mttr: 0, rate: 0, managerHrs: 0,
            downCost: 0, opportunityVal: 0, riskLevel: 1, autoLevel: 0,
            teamSize: 1, capex: 0, erosionRate: 0, discountRate: 0.05,
            horizonYears: 3, contextPremium: 0, taxRate: 0, docStandard: 1,
        }), 'minima');
    });

    it('worker output keys are exactly the contracted subset', () => {
        const out = Object.keys(W.computeModel(mkParams(), W.C)).sort();
        assert.deepStrictEqual(out, [].concat(CONTRACT_KEYS).sort(),
            'worker exposed un-contracted keys or dropped required ones');
    });

    it('fuzzes random parameter sets across the valid domain', () => {
        const rng = W.seededRandom(424242);
        for (let i = 0; i < 12; i++) {
            const params = {
                manualPercent: Math.floor(rng() * 101),
                downCost: rng() * 1e7,
                failures: Math.floor(rng() * 10000),
                mttr: rng() * 168,
                rate: rng() * 5000,
                managerHrs: rng() * 745,
                opportunityVal: rng() * 1e9,
                riskLevel: 1 + Math.floor(rng() * 5),
                autoLevel: Math.floor(rng() * 101),
                teamSize: 1 + Math.floor(rng() * 10000),
                capex: rng() * 1e9,
                erosionRate: rng(),
                discountRate: 0.05 + rng() * 0.15,
                horizonYears: 3 + Math.floor(rng() * 8),
                contextPremium: rng() * 0.3,
                taxRate: rng() * 50,
                correlationsEnabled: rng() > 0.5,
                nonlinearEnabled: rng() > 0.5,
                advancedRiskEnabled: rng() > 0.5,
                riskSecurityWeight: rng(),
                riskRegulatoryWeight: rng(),
                corrQ3Q1: rng() * 50, corrQ1Q5: rng() * 10, corrQ1Q7: rng() * 50, corrQ3Q7: rng() * 30,
            };
            assertParity(params, 'fuzz #' + i);
        }
    });
});

describe('MC worker — message protocol', () => {
    it('runs the real onmessage handler and returns a valid stats payload', () => {
        const messages = [];
        const protoSandbox = {};
        protoSandbox.self = { onmessage: null, postMessage: (m) => messages.push(m) };
        vm.createContext(protoSandbox);
        vm.runInContext(WORKER_SRC, protoSandbox);
        assert.strictEqual(typeof protoSandbox.self.onmessage, 'function',
            'worker did not attach self.onmessage');

        protoSandbox.self.onmessage({
            data: {
                baseParams: mkParams(),
                opts: { iterations: 5, confidenceLevel: 0.9, uncertaintyPct: 0.15, mttrUncertaintyPct: 0.25 },
                seed: 12345,
            },
        });

        assert.ok(!messages.some((m) => m.type === 'error'),
            'worker reported an error: ' + JSON.stringify(messages.find((m) => m.type === 'error')));
        const result = messages.find((m) => m.type === 'result');
        assert.ok(result, 'worker never posted a result message');

        ['cWaste', 'cRisk', 'cOppDirect', 'totalImpact', 'netDebt',
            'npvTotalDebt', 'potentialSavings', 'paybackMonths', 'irr']
            .forEach((k) => {
                assert.ok(result.data[k], 'stats missing key "' + k + '"');
                ['mean', 'median', 'p5', 'p25', 'p75', 'p95', 'min', 'max'].forEach((m) => {
                    assert.ok(Object.prototype.hasOwnProperty.call(result.data[k], m),
                        'stats["' + k + '"] missing "' + m + '"');
                });
            });
        assert.strictEqual(result.data._allResults.length, 5,
            'expected 5 simulation rows for 5 iterations');
    });

    it('is reproducible — same seed produces byte-identical statistics', () => {
        const messages = [];
        const protoSandbox = {};
        protoSandbox.self = { onmessage: null, postMessage: (m) => messages.push(m) };
        vm.createContext(protoSandbox);
        vm.runInContext(WORKER_SRC, protoSandbox);
        const run = () => {
            messages.length = 0;
            protoSandbox.self.onmessage({
                data: {
                    baseParams: mkParams(),
                    opts: { iterations: 5, confidenceLevel: 0.9, uncertaintyPct: 0.15, mttrUncertaintyPct: 0.25 },
                    seed: 999,
                },
            });
            return messages.find((m) => m.type === 'result').data;
        };
        assert.deepStrictEqual(run(), run());
    });

    it('seed 0 falls back to a time-based seed without crashing', () => {
        const messages = [];
        const protoSandbox = {};
        protoSandbox.self = { onmessage: null, postMessage: (m) => messages.push(m) };
        vm.createContext(protoSandbox);
        vm.runInContext(WORKER_SRC, protoSandbox);
        assert.doesNotThrow(() => protoSandbox.self.onmessage({
            data: {
                baseParams: mkParams(),
                opts: { iterations: 2, confidenceLevel: 0.9, uncertaintyPct: 0.15, mttrUncertaintyPct: 0.25 },
                seed: 0,
            },
        }));
        assert.ok(messages.some((m) => m.type === 'result'), 'seed 0 run produced no result');
    });
});