// State ⇄ currency round-trip — shared scenarios must decode in the
// currency they were encoded in (P0 fix).
//
// Without the `cur` hash key, a PLN scenario (q4 = 18 685,50) decoded by a
// USD recipient as 18 685,50 USD — roughly 3.7× too high. The fix pins the
// encoding currency in the hash (`&cur=PLN`) and converts back to whatever
// currency the current viewer uses. Legacy links without `cur` keep the old
// USD-based behaviour.

const { describe, it } = require('node:test');
const assert = require('node:assert');

// ── Minimal DOM harness (same pattern as security.test.js) ──────────
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

const TOGGLE_IDS = [
    'correlationsToggle','nonlinearToggle','probabilisticToggle','advancedRiskToggle',
];

const elements = {};
const toggleElements = {};
let replacedHash = null;

function setHash(h) {
    global.location.hash = h;
}

function resetValues() {
    HASH_FIELD_IDS.forEach(id => { elements[id].value = ''; });
}

HASH_FIELD_IDS.forEach(id => { elements[id] = { value: '' }; });
TOGGLE_IDS.forEach(id => { toggleElements[id] = { checked: false }; });
global.document = {
    getElementById: (id) => elements[id] || toggleElements[id] || null,
};
global.history = {
    replaceState: (state, title, url) => { replacedHash = url; },
};
global.location = { hash: '' };

require('./config.js');
require('./i18n.js');
require('./utils.js');
require('./state.js');

describe('encodeState — pins the encoding currency in the hash', () => {
    it('stores &cur= with the active currency', () => {
        PDE.currentCurrency = 'PLN';
        resetValues();
        setHash('');
        elements.q4.value = '18685.50';
        PDE.encodeState();
        assert.ok(replacedHash.includes('&cur=PLN'),
            `expected &cur=PLN in hash, got: ${replacedHash}`);
        assert.strictEqual(PDE.currentCurrency, 'PLN');
    });

    it('keeps cur and mode together', () => {
PDE.currentCurrency = 'USD';
        resetValues();
        setHash('');
        PDE.currentMode = 'full';
        PDE.encodeState();
        assert.ok(replacedHash.includes('&cur=USD'), 'cur=USD missing');
        assert.ok(replacedHash.includes('&mode=full'), 'mode=full missing');
    });
});

describe('decodeState — cross-currency conversion (PLN → USD default)', () => {
    it('converts a PLN-encoded q4 to the USD equivalent', () => {
        PDE.currentCurrency = 'USD';
        resetValues();
        setHash('#q4=18685.50&cur=PLN');
        PDE.decodeState();
        assert.strictEqual(elements.q4.value, '5091.42',
            '18685.50 PLN at 3.67 PLN/USD must decode to ~5091.42 USD');
    });

    it('round-trips unchanged when the viewer uses the hash currency', () => {
        PDE.currentCurrency = 'PLN';
        resetValues();
        setHash('#q4=18685.50&cur=PLN');
        PDE.decodeState();
        const v = parseFloat(elements.q4.value);
        assert.ok(Math.abs(v - 18685.50) < 0.01,
            `expected ~18685.50 PLN, got ${elements.q4.value}`);
    });

    it('converts every monetary field (q4, q6, q8, capex)', () => {
        PDE.currentCurrency = 'USD';
        resetValues();
        setHash('#q4=18685.50&q6=183.50&q8=367000.00&capex=183500.50&cur=PLN');
        PDE.decodeState();
        assert.ok(Math.abs(parseFloat(elements.q6.value) - 50.00) < 0.01,
            `q6 183.50 PLN at 3.67 PLN/USD → ~50.00 USD, got ${elements.q6.value}`);
        assert.ok(Math.abs(parseFloat(elements.q8.value) - 100000.00) < 0.01,
            `q8 367000 PLN → ~100000 USD, got ${elements.q8.value}`);
        assert.ok(Math.abs(parseFloat(elements.capex.value) - 50000.14) < 0.01,
            `capex 183500.50 PLN → ~50000.14 USD, got ${elements.capex.value}`);
    });

    it('leaves non-monetary fields untouched', () => {
        PDE.currentCurrency = 'USD';
        resetValues();
        setHash('#q1=40&q5=3&cur=PLN');
        PDE.decodeState();
        assert.strictEqual(elements.q1.value, 40);
        assert.strictEqual(elements.q5.value, 3);
        assert.strictEqual(elements.q1.value, 40);
    });
});

describe('decodeState — legacy links without cur keep USD semantics', () => {
    it('USD viewer: value is used as-is', () => {
        PDE.currentCurrency = 'USD';
        resetValues();
        setHash('#q4=10000');
        PDE.decodeState();
        assert.strictEqual(elements.q4.value, '10000.00');
    });

    it('PLN viewer: value is scaled to the display currency (old behaviour)', () => {
        PDE.currentCurrency = 'PLN';
        resetValues();
        setHash('#q4=10000');
        PDE.decodeState();
        assert.ok(Math.abs(parseFloat(elements.q4.value) - 36700.00) < 0.01,
            `10000 USD × 3.67 must be ~36700 PLN, got ${elements.q4.value}`);
    });
});

describe('decodeState — invalid or unknown currency codes are rejected', () => {
    it('unknown cur code falls back to legacy USD behaviour', () => {
        PDE.currentCurrency = 'USD';
        resetValues();
        setHash('#q4=10000&cur=XYZ');
        PDE.decodeState();
        assert.strictEqual(elements.q4.value, '10000.00');
    });

    it('malformed percent-encoding in cur does not throw', () => {
        PDE.currentCurrency = 'USD';
        resetValues();
        setHash('#q4=10000&cur=%zz');
        assert.doesNotThrow(() => PDE.decodeState(), 'decodeState must not throw on malformed cur');
        assert.strictEqual(elements.q4.value, '10000.00');
    });

    it('reserved key cur is ignored while normal fields still decode', () => {
        PDE.currentCurrency = 'USD';
        resetValues();
        setHash('#q2=100&cur=PLN');
        PDE.decodeState();
        assert.strictEqual(elements.q2.value, 100, 'valid pair after cur pair still decoded');
    });
});

describe('encodeState — pins advanced toggles + MC seed (P6)', () => {
    it('packs toggle states into the togg bitmask', () => {
        PDE.currentCurrency = 'USD';
        resetValues();
        setHash('');
        TOGGLE_IDS.forEach(id => { toggleElements[id].checked = false; });
        toggleElements.correlationsToggle.checked = true;
        toggleElements.probabilisticToggle.checked = true;
        // order: correlations(bit0), nonlinear(bit1), probabilistic(bit2), advancedRisk(bit3)
        PDE.encodeState();
        assert.ok(replacedHash.includes('&togg=5'),
            `expected &togg=5 (bits 0+2), got: ${replacedHash}`);
    });

    it('includes mcseed when a session seed exists', () => {
        PDE.currentCurrency = 'USD';
        resetValues();
        setHash('');
        PDE._mcSeed = 123456;
        PDE.encodeState();
        assert.ok(replacedHash.includes('&mcseed=123456'),
            `expected &mcseed=123456, got: ${replacedHash}`);
    });

    it('omits mcseed when the session seed has not been drawn', () => {
        PDE.currentCurrency = 'USD';
        resetValues();
        setHash('');
        delete PDE._mcSeed;
        PDE.encodeState();
        assert.ok(!replacedHash.includes('mcseed'),
            `no mcseed expected without a seed, got: ${replacedHash}`);
    });
});

describe('decodeState — restores advanced params, toggles and MC seed (P6)', () => {
    it('restores checkbox toggles from the bitmask', () => {
        PDE.currentCurrency = 'USD';
        resetValues();
        TOGGLE_IDS.forEach(id => { toggleElements[id].checked = false; });
        setHash('#togg=5');
        PDE.decodeState();
        assert.strictEqual(toggleElements.correlationsToggle.checked, true, 'correlations bit');
        assert.strictEqual(toggleElements.nonlinearToggle.checked, false, 'nonlinear bit');
        assert.strictEqual(toggleElements.probabilisticToggle.checked, true, 'probabilistic bit');
        assert.strictEqual(toggleElements.advancedRiskToggle.checked, false, 'advanced risk bit');
    });

    it('restores the Monte Carlo seed', () => {
        PDE.currentCurrency = 'USD';
        resetValues();
        delete PDE._mcSeed;
        setHash('#mcseed=999');
        PDE.decodeState();
        assert.strictEqual(PDE._mcSeed, 999, 'expected _mcSeed restored to 999');
    });

    it('rejects invalid seeds (non-positive)', () => {
        PDE.currentCurrency = 'USD';
        resetValues();
        PDE._mcSeed = 7;
        setHash('#mcseed=0');
        PDE.decodeState();
        assert.strictEqual(PDE._mcSeed, 7, 'invalid seed must not overwrite the existing seed');
    });

    it('decodes the advanced slider fields into the DOM', () => {
        PDE.currentCurrency = 'USD';
        resetValues();
        setHash('#scenCAutoLevel=75&annualHours=1900&leverInnovation=60&correlationStrength=40&riskSecurityWeight=25');
        PDE.decodeState();
        assert.strictEqual(elements.scenCAutoLevel.value, 75);
        assert.strictEqual(elements.annualHours.value, 1900);
        assert.strictEqual(elements.leverInnovation.value, 60);
        assert.strictEqual(elements.correlationStrength.value, 40);
        assert.strictEqual(elements.riskSecurityWeight.value, 25);
    });

    it('clamps out-of-range advanced params to bounds', () => {
        PDE.currentCurrency = 'USD';
        resetValues();
        setHash('#scenCAutoLevel=200&annualHours=10&mcIterations=5');
        PDE.decodeState();
        assert.strictEqual(elements.scenCAutoLevel.value, 100, 'scenCAutoLevel clamped to max 100');
        assert.strictEqual(elements.annualHours.value, 1500, 'annualHours clamped to min 1500');
        assert.strictEqual(elements.mcIterations.value, 100, 'mcIterations clamped to min 100');
    });
});