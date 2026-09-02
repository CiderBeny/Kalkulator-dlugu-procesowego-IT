// Full share-link round-trip contract.
//
// A shared link must reproduce the ENTIRE sender state — all 38 hash fields,
// the display currency, the quick/full mode, the four advanced toggle bits and
// the Monte Carlo seed — in every currency the app supports. These tests encode
// a complete state, decode it back in the same currency, assert every field
// survives, and verify the re-encoded hash is byte-identical (idempotent
// round-trip). Cross-currency decode and legacy links are covered as well.

const { describe, it } = require('node:test');
const assert = require('node:assert');

global.window = global;

const HASH_FIELD_IDS = [
    'q1','q2','q3','q4','q5','q11','q6','q7','q8','q9','q10','autoLevel',
    'capex','teamSize','erosionRate','discountRate','timeHorizon',
    'leverAutomation','leverRisk','contextPremium','taxRate',
    'scenCAutoLevel','scenCCapexMult','annualHours',
    'leverInnovation','leverManagement','leverTurnover',
    'mcIterations','mcConfidence','mcUncertaintyPct','mcMttrUncertaintyPct',
    'correlationStrength','corrQ3Q1','corrQ1Q5','corrQ1Q7','corrQ3Q7',
    'riskSecurityWeight','riskRegulatoryWeight',
];

const MONETARY_IDS = ['q4', 'q6', 'q8', 'capex'];

const TOGGLE_IDS = [
    'correlationsToggle','nonlinearToggle','probabilisticToggle','advancedRiskToggle',
];

const elements = {};
const toggleElements = {};
let replacedHash = null;

function setHash(h)      { global.location.hash = h; }
function setValues(vals) {
    Object.keys(vals).forEach(id => { elements[id].value = String(vals[id]); });
}
function setToggles(values) {
    TOGGLE_IDS.forEach(id => { toggleElements[id].checked = !!(values[id]); });
}
function resetValues() {
    HASH_FIELD_IDS.forEach(id => { elements[id].value = ''; });
}
function resetToggles() {
    TOGGLE_IDS.forEach(id => { toggleElements[id].checked = false; });
}

HASH_FIELD_IDS.forEach(id => { elements[id] = { value: '' }; });
TOGGLE_IDS.forEach(id => { toggleElements[id] = { checked: false }; });

function makeClassList() {
    const set = new Set();
    return {
        toggle: (c) => { if (set.has(c)) set.delete(c); else set.add(c); },
        add:    (c) => set.add(c),
        remove: (c) => set.delete(c),
        contains: (c) => set.has(c),
    };
}

global.document = {
    getElementById: (id) => elements[id] || toggleElements[id] || null,
    documentElement: { classList: makeClassList() },
    body:            { classList: makeClassList() },
    querySelectorAll: () => [],
};
global.history = {
    replaceState: (state, title, url) => { replacedHash = url; },
};
global.location = { hash: '' };
global.localStorage = {
    getItem:   () => null,
    setItem:   () => {},
    removeItem: () => {},
};

require('./config.js');
require('./i18n.js');
require('./utils.js');
require('./state.js');

// ── Fixture: every hash field set to a valid, in-bounds value ──
// Monetary fields carry 2-decimal values to exercise the toFixed round-trip;
// non-monetary fields are integers so the re-encoded hash stays byte-identical.
const FULL_VALUES = {
    q1: '40',        q2: '120',     q3: '3',       q4: '18685.50',
    q5: '8',         q11: '4',      q6: '183.50',  q7: '40',
    q8: '85000.00',  q9: '4',       q10: '20',     autoLevel: '60',
    capex: '183500.50', teamSize: '10', erosionRate: '25', discountRate: '9',
    timeHorizon: '5', leverAutomation: '30', leverRisk: '60', contextPremium: '15',
    taxRate: '19',    scenCAutoLevel: '80', scenCCapexMult: '15', annualHours: '1800',
    leverInnovation: '50', leverManagement: '15', leverTurnover: '30',
    mcIterations: '1000', mcConfidence: '90', mcUncertaintyPct: '15',
    mcMttrUncertaintyPct: '25', correlationStrength: '30',
    corrQ3Q1: '15',   corrQ1Q5: '3', corrQ1Q7: '20', corrQ3Q7: '10',
    riskSecurityWeight: '40', riskRegulatoryWeight: '25',
};

const ALL_TOGGLES_ON = {
    correlationsToggle: true, nonlinearToggle: true,
    probabilisticToggle: true, advancedRiskToggle: true,
};

function encodeFullState(currency) {
    PDE.currentCurrency = currency;
    PDE.currentMode = 'full';
    PDE._mcSeed = 424242;
    resetValues();
    resetToggles();
    setHash('');
    setValues(FULL_VALUES);
    setToggles(ALL_TOGGLES_ON);
    PDE.encodeState();
    return replacedHash;
}

function decodeHash(hash) {
    resetValues();
    resetToggles();
    delete PDE._mcSeed;
    setHash(hash);
    PDE.decodeState();
}

function assertValuesRestored(values, monetaryTol) {
    Object.keys(values).forEach(id => {
        const expected = parseFloat(values[id]);
        const got = parseFloat(elements[id].value);
        const tol = MONETARY_IDS.includes(id) ? (monetaryTol || 0.005) : 1e-9;
        assert.ok(Math.abs(got - expected) <= tol,
            `${id}: expected ${expected}, got ${elements[id].value}`);
    });
}

describe('share-link round-trip — full state in every currency', () => {
    ['USD', 'PLN', 'EUR', 'GBP'].forEach(currency => {
        it(`${currency} → ${currency}: all 38 fields, toggles, seed and mode survive`, () => {
            const hash = encodeFullState(currency);

            assert.ok(hash.includes('&cur=' + currency), 'hash pins cur=' + currency);
            assert.ok(hash.includes('&mode=full'), 'hash pins mode=full');
            assert.ok(hash.includes('&togg=15'), 'all four toggles packed (mask 15)');
            assert.ok(hash.includes('&mcseed=424242'), 'Monte Carlo seed pinned');

            decodeHash(hash);

            assertValuesRestored(FULL_VALUES);
            assert.deepStrictEqual(
                TOGGLE_IDS.map(id => toggleElements[id].checked),
                [true, true, true, true],
                'all four toggle checkboxes restored'
            );
            assert.strictEqual(PDE._mcSeed, 424242, 'mcseed restored');
            assert.strictEqual(PDE.currentMode, 'full', 'mode restored');
        });

        it(`${currency}: re-encoding the decoded state yields a byte-identical hash`, () => {
            const hash = encodeFullState(currency);
            decodeHash(hash);

            setHash('');           // encodeState reads DOM, not the hash
            PDE.encodeState();
            assert.ok(replacedHash === hash,
                `expected identical re-encode in ${currency}\n  first: ${hash}\nsecond: ${replacedHash}`);
        });
    });
});

describe('share-link round-trip — cross-currency conversion', () => {
    it('PLN-encoded link decodes monetary fields into USD units', () => {
        const hash = encodeFullState('PLN');

        PDE.currentCurrency = 'USD';
        decodeHash(hash);

        ['q4', 'q6', 'q8', 'capex'].forEach(id => {
            const expectedUsd = parseFloat(FULL_VALUES[id]) / 3.67;
            const got = parseFloat(elements[id].value);
            assert.ok(Math.abs(got - expectedUsd) <= 0.01,
                `${id} ${FULL_VALUES[id]} PLN → ~$${expectedUsd.toFixed(2)}, got ${elements[id].value}`);
        });
        // Non-monetary fields are currency-agnostic and must pass through.
        assert.strictEqual(Number(elements.autoLevel.value), 60, 'autoLevel untouched by FX');
        assert.strictEqual(Number(elements.mcIterations.value), 1000, 'mcIterations untouched by FX');
    });

    it('USD-encoded link decodes into EUR and PLN-and-back stays within rounding', () => {
        const hash = encodeFullState('USD');

        PDE.currentCurrency = 'EUR';
        decodeHash(hash);
        const eurQ4 = parseFloat(elements.q4.value);
        assert.ok(Math.abs(eurQ4 - (18685.50 * 0.87)) <= 0.01,
            `q4 $18685.50 → €~${(18685.50*0.87).toFixed(2)}, got ${elements.q4.value}`);

        // EUR → PLN → USD round-trip hop must land back on the original value.
        decodeHash(hash);                       // same USD hash
        PDE.currentCurrency = 'PLN';
        setHash(hash);
        PDE.decodeState();
        const plnQ4 = parseFloat(elements.q4.value);
        setHash('');
        PDE.encodeState();                       // re-encode in PLN
        PDE.currentCurrency = 'USD';
        decodeHash(replacedHash);
        const usdBack = parseFloat(elements.q4.value);
        assert.ok(Math.abs(usdBack - 18685.50) <= 0.01,
            `PLN(${plnQ4}) → USD re-encode drifted to ${usdBack}`);
    });
});

describe('share-link round-trip — legacy links without cur', () => {
    it('legacy USD-based link decodes in every currency using fallback rates', () => {
        const legacyHash = '#q4=10000&q6=120&capex=50000&autoLevel=60';

        const expectations = { USD: 10000, PLN: 36700, EUR: 8700, GBP: 7500 };
        Object.keys(expectations).forEach(currency => {
            PDE.currentCurrency = currency;
            decodeHash(legacyHash);
            const got = parseFloat(elements.q4.value);
            assert.ok(Math.abs(got - expectations[currency]) <= 0.01,
                `${currency} viewer: legacy q4=10000 MUST scale to ${expectations[currency]}, got ${got}`);
            assert.strictEqual(Number(elements.autoLevel.value), 60,
                `${currency}: non-monetary field must not be FX-scaled`);
        });
    });
});

describe('share-link round-trip — zero values are valid inputs', () => {
    it('zero survives the round-trip as 0.00 for monetary and 0 for sliders', () => {
        ['USD', 'PLN', 'EUR'].forEach(currency => {
            PDE.currentCurrency = currency;
            PDE.currentMode = 'quick';
            delete PDE._mcSeed;
            resetValues();
            resetToggles();
            setHash('');
            setValues({ q4: '0', q6: '0', q8: '0', capex: '0', q2: '0', q1: '0' });
            PDE.encodeState();

            decodeHash(replacedHash);

            assert.strictEqual(elements.q4.value, '0.00', `${currency}: q4 zero as 0.00`);
            assert.strictEqual(elements.q6.value, '0.00', `${currency}: q6 zero as 0.00`);
            assert.strictEqual(elements.capex.value, '0.00', `${currency}: capex zero as 0.00`);
            assert.strictEqual(elements.q2.value, 0, `${currency}: q2 zero slider`);
            assert.strictEqual(elements.q1.value, 0, `${currency}: q1 zero slider`);
        });
    });

    it('zero capex is preserved even when re-encoded with a seed present', () => {
        PDE.currentCurrency = 'USD';
        PDE.currentMode = 'quick';
        PDE._mcSeed = 7;
        resetValues();
        resetToggles();
        setHash('');
        setValues({ capex: '0', q8: '0', autoLevel: '40' });
        PDE.encodeState();
        decodeHash(replacedHash);

        assert.strictEqual(elements.capex.value, '0.00', 'capex zero survives seed-encoding');
        assert.strictEqual(elements.q8.value, '0.00', 'q8 zero survives seed-encoding');
        assert.strictEqual(Number(elements.autoLevel.value), 40, 'autoLevel preserved');
    });
});