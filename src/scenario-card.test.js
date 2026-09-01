// Regression test for P7 — the Scenario C card must display the SAME CAPEX
// that the calculation actually used (configurable scenCCapexMult), not the
// hardcoded default multiplier (capex * 1.5).
//
// Before the fix the card passed capexAmt: capex * 1.5 into scenCard while the
// model computed scenC = scenCalc(..., capex * scenCCapexMult). At multiplier
// 3.0 the result was computed for capex*3 but the card showed capex*1.5.

const { describe, it } = require('node:test');
const assert = require('node:assert');

// ── Minimal DOM harness scoped to updateScenarios rendering ──
global.window = global;
const scenarioGrid = { innerHTML: '' };
global.document = {
    getElementById: (id) => {
        const els = {
            scenarioGrid: scenarioGrid,
            // updateScenarios reads these only when an arg is undefined; we
            // pass every arg explicitly, so these are a safety net only.
            scenCAutoLevel: { value: '80' },
            scenCCapexMult: { value: '30' }, // 3.0 (×10)
        };
        return els[id] || null;
    },
};

require('./config.js');
require('./i18n.js');
require('./utils.js');
require('./model.js');
require('./ui-renderers.js');

PDE.currentCurrency = 'USD';
// Avoid the deferred encodeState touching the DOM after the test body runs.
PDE.encodeStateDebounced = function () {};

describe('Scenario C card CAPEX display (P7)', () => {
    it('shows capex × scenCCapexMult, matching the computed value', () => {
        const capex = 50000;        // USD
        const mult = 3.0;           // configured 3.0, computed for capex*3 = $150K
        PDE.updateScenarios(
            120000,            // recoverable
            capex,             // p.capex
            0.8,               // autoLevel
            250000,            // totalImpact
            0.093,             // discountRate
            5,                 // horizonYears
            0.8,               // scenCAutoLevel
            mult               // scenCCapexMult
        );

        const html = scenarioGrid.innerHTML;
        // '≈$150.0K' is formatCompactCurrency(150000) — the model's CAPEX.
        assert.ok(html.includes('\u2248$150.0K'),
            `expected rendered card to show the used CAPEX $150K, html: ${html}`);
        // The hardcoded default would render capex*1.5 = $75K.
        assert.ok(!html.includes('\u2248$75.0K'),
            `card must NOT show the hardcoded capex*1.5 value, html: ${html}`);
    });

    it('still matches when the multiplier is the default 1.5', () => {
        const capex = 50000;
        const mult = 1.5;
        PDE.updateScenarios(
            120000, capex, 0.8, 250000, 0.093, 5, 0.8, mult
        );
        const html = scenarioGrid.innerHTML;
        assert.ok(html.includes('\u2248$75.0K'),
            `with default 1.5 the card should show $75K, html: ${html}`);
    });
});