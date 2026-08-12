// ═══════════════════════════════════════════════════════════════
// Sensitivity Views — worst/base/best case integrity tests
// Loads the REAL config/i18n/utils/model under a Node shim (same
// approach as model-audit.test.js) and audits PDE.scenSensitivity.
// ═══════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');

// ── Node shim: load real browser modules ──
global.window = global;
global.document = { getElementById: () => null };
require('./config.js');
require('./i18n.js');
require('./utils.js');
require('./model.js');
const P = global.window.PDE;

const VIEW_ORDER = ['conservative', 'base', 'aggressive'];

const mkParams = function (overrides) {
    return Object.assign({
        manualPercent: 10, downCost: 3000, failures: 1, mttr: 4, rate: 60,
        managerHrs: 20, opportunityVal: 100000, riskLevel: 3, autoLevel: 50,
        teamSize: 5, capex: 300000, erosionRate: 0.25, discountRate: 0.093,
        horizonYears: 5, contextPremium: 0.15, taxRate: 19,
        scenCAutoLevel: 0.8, scenCCapexMult: 1.5, leverAutomation: 0.3, leverRisk: 0.6,
    }, overrides || {});
};

describe('Sensitivity Views — configuration integrity', () => {
    it('PDE.SENSITIVITY_VIEWS exposes conservative/base/aggressive with base unperturbed', () => {
        assert.ok(P.SENSITIVITY_VIEWS, 'SENSITIVITY_VIEWS defined in config');
        VIEW_ORDER.forEach((key) => {
            assert.ok(P.SENSITIVITY_VIEWS[key], 'view "' + key + '" defined');
            assert.ok(typeof P.SENSITIVITY_VIEWS[key].mult === 'object', key + '.mult is an object');
        });
        assert.deepStrictEqual(P.SENSITIVITY_VIEWS.base.mult, {}, 'base view perturbs nothing');
    });

    it('every perturbed param has a documented clamp', () => {
        Object.keys(P.SENSITIVITY_VIEWS).forEach((viewKey) => {
            if (viewKey === 'base') return;
            Object.keys(P.SENSITIVITY_VIEWS[viewKey].mult).forEach((paramKey) => {
                assert.ok(P.SENSITIVITY_VIEW_CLAMPS[paramKey],
                    viewKey + ' perturbs "' + paramKey + '" but it has no clamp');
            });
        });
    });

    it('each multiplier key perturbs an existing model param', () => {
        const base = mkParams();
        Object.keys(P.SENSITIVITY_VIEWS.conservative.mult).forEach((k) => {
            assert.notStrictEqual(base[k], undefined, 'param "' + k + '" exists in getParams() shape');
        });
    });
});

describe('Sensitivity Views — guaranteed invariants', () => {
    it('views are returned once per view, in conservative → base → aggressive order', () => {
        const views = P.scenSensitivity(mkParams());
        assert.deepStrictEqual(views.map(function (v) { return v.key; }), VIEW_ORDER,
            'view order is conservative, base, aggressive');
        views.forEach((v) => {
            assert.ok(v.metrics.drag >= 0, v.key + ': drag is a non-negative number');
            assert.ok(v.metrics.scenB && v.metrics.scenC, v.key + ': both scenario B and C computed');
        });
    });

    it('Annual Operating Drag is monotonic — conservative ≥ base ≥ aggressive (guaranteed, many samples)', () => {
        const samples = [
            mkParams(),
            mkParams({ manualPercent: 40, downCost: 10000, failures: 3, mttr: 4, rate: 150, managerHrs: 30, opportunityVal: 100000, riskLevel: 3, autoLevel: 40, teamSize: 10, capex: 50000 }),
            mkParams({ manualPercent: 70, downCost: 50000, failures: 10, mttr: 8, rate: 150, managerHrs: 60, opportunityVal: 50000, riskLevel: 2, autoLevel: 20, teamSize: 15, capex: 200000 }),
            mkParams({ manualPercent: 85, downCost: 20000, failures: 8, mttr: 24, rate: 80, managerHrs: 90, opportunityVal: 20000, riskLevel: 5, autoLevel: 25, teamSize: 20, capex: 60000 }),
            mkParams({ manualPercent: 5, downCost: 5000, failures: 0, mttr: 0, rate: 200, managerHrs: 5, opportunityVal: 300000, riskLevel: 1, autoLevel: 80, teamSize: 3, capex: 100000 }),
        ];
        samples.forEach((s, i) => {
            const drag = P.scenSensitivity(s).map(function (v) { return v.metrics.drag; });
            assert.ok(drag[0] >= drag[1] && drag[1] >= drag[2] - 1e-9,
                'sample ' + i + ': conservative drag (' + drag[0].toFixed(0) + ') ≥ base (' + drag[1].toFixed(0) + ') ≥ aggressive (' + drag[2].toFixed(0) + ')');
        });
    });

    it('base view is unperturbed — matches an independent scenCalc', () => {
        const s = mkParams();
        const views = P.scenSensitivity(s);
        const base = views[1];
        const annualRecurring = P.computeModel(s).cWaste + P.computeModel(s).cRisk;
        const scB = P.scenCalc(s.autoLevel / 100, s.capex, annualRecurring, s.discountRate, s.horizonYears);
        assert.ok(Math.abs(base.metrics.drag - annualRecurring) < 0.01,
            'base view drag equals unperturbed annualRecurring');
        assert.ok(Math.abs(base.metrics.scenB.net - scB.net) < 0.01, 'base view scenario B net matches scenCalc');
    });
});

describe('Sensitivity Views — recovery-dominant behaviour (curated sample)', () => {
    const s = mkParams(); // low team, high capex → payback discriminates between views
    const views = P.scenSensitivity(s);
    const byKey = {};
    views.forEach((v) => { byKey[v.key] = v.metrics; });

    it('conservative shows the worst recovery economics for both B and C', () => {
        ['scenB', 'scenC'].forEach((scen) => {
            const net = [byKey.conservative[scen].net, byKey.base[scen].net, byKey.aggressive[scen].net];
            assert.ok(net[0] <= net[1] && net[1] <= net[2] + 1e-6,
                scen + ' net savings: conservative ≤ base ≤ aggressive (' + net.map(Math.round).join(' / ') + ')');
            const pb = [byKey.conservative[scen].pb, byKey.base[scen].pb, byKey.aggressive[scen].pb];
            assert.ok(pb[0] >= pb[1] && pb[1] >= pb[2] - 1e-9,
                scen + ' payback: conservative ≥ base ≥ aggressive (' + pb.map(function (x) { return String(Math.round(x)); }).join(' / ') + ')');
        });
    });

    it('results contain only finite numbers or defined nulls — no NaN contamination', () => {
        views.forEach((v) => {
            ['scenB', 'scenC'].forEach((scen) => {
                assert.ok(Number.isFinite(v.metrics[scen].net), v.key + '/' + scen + ': net finite');
                assert.ok(Number.isFinite(v.metrics.drag), v.key + ': drag finite');
                const irr = v.metrics[scen].irr;
                assert.ok(irr === null || Number.isFinite(irr), v.key + '/' + scen + ': irr is a finite number or null');
            });
        });
    });
});

describe('Sensitivity Views — purity, clamps, determinism, edges', () => {
    it('does not mutate the input params object', () => {
        const s = mkParams();
        const frozen = JSON.parse(JSON.stringify(s));
        P.scenSensitivity(s);
        assert.deepStrictEqual(s, frozen, 'input params untouched after computing views');
    });

    it('clamps perturbed params to documented bounds', () => {
        const s = mkParams({ mttr: 140, autoLevel: 99.7, erosionRate: 0.9, discountRate: 0.30, capex: 2e8 });
        const views = P.scenSensitivity(s);
        const cons = views[0].params, agg = views[2].params;
        assert.strictEqual(cons.mttr, 168, 'conservative mttr capped at 168 hours');
        assert.ok(cons.discountRate <= 0.40, 'conservative discountRate within clamp');
        assert.ok(agg.discountRate >= 0.02, 'aggressive discountRate within clamp');
        assert.ok(cons.erosionRate <= 1, 'conservative erosionRate ≤ 1');
        assert.ok(agg.erosionRate >= 0, 'aggressive erosionRate ≥ 0');
        assert.ok(cons.autoLevel >= 0 && cons.autoLevel <= 100, 'autoLevel within %');
        assert.ok(cons.capex >= 0, 'capex ≥ 0');
        const aggFailures = agg.failures, consFailures = cons.failures;
        assert.ok(aggFailures <= s.failures, 'aggressive failures ≤ base');
        assert.ok(consFailures >= s.failures, 'conservative failures ≥ base');
    });

    it('is deterministic — same input, identical output', () => {
        const a = P.scenSensitivity(mkParams());
        const b = P.scenSensitivity(mkParams());
        a.forEach((v, i) => {
            assert.strictEqual(v.metrics.drag, b[i].metrics.drag, v.key + ': drag identical');
            assert.strictEqual(v.metrics.scenB.net, b[i].metrics.scenB.net, v.key + ': scenB.net identical');
            assert.strictEqual(v.metrics.scenC.net, b[i].metrics.scenC.net, v.key + ': scenC.net identical');
        });
    });

    it('zero-waste boundary: drag 0, net = -CAPEX × view multiplier, payback Infinity, IRR null', () => {
        const s = mkParams({
            manualPercent: 0, downCost: 0, failures: 0, mttr: 0, rate: 0,
            managerHrs: 0, opportunityVal: 0, riskLevel: 2, taxRate: 0, capex: 100000,
        });
        const views = P.scenSensitivity(s);
        const multipliers = { conservative: 1.2, base: 1, aggressive: 0.9 };
        views.forEach((v) => {
            assert.strictEqual(v.metrics.drag, 0, v.key + ': no waste → drag 0');
            assert.strictEqual(v.metrics.scenB.net, -100000 * multipliers[v.key], v.key + ': net = -capex×view mult');
            assert.strictEqual(v.metrics.scenB.pb, Infinity, v.key + ': payback never reached');
            assert.strictEqual(v.metrics.scenB.irr, null, v.key + ': IRR undefined for no-savings');
        });
    });
});