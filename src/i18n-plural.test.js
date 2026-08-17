// ═══════════════════════════════════════════════════════════════
// i18n pluralisation — Polish month declension via Intl.PluralRules.
// Loads the REAL config/i18n/utils under a Node shim (same approach
// as sensitivity-views.test.js) and audits PDE.fmtMonths & ranges.
// ═══════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');

// ── Node shim: load real browser modules ──
global.window = global;
global.document = { getElementById: () => null };
require('./config.js');
require('./i18n.js');
require('./utils.js');
const P = global.window.PDE;

describe('PDE.fmtMonths — Polish month declension', () => {
    it('declines singular, few and many correctly', () => {
        P.currentLang = 'pl';
        assert.strictEqual(P.fmtMonths(1), '1 miesiąc');
        assert.strictEqual(P.fmtMonths(2), '2 miesiące');
        assert.strictEqual(P.fmtMonths(4), '4 miesiące');
        assert.strictEqual(P.fmtMonths(5), '5 miesięcy');
        assert.strictEqual(P.fmtMonths(12), '12 miesięcy');
        assert.strictEqual(P.fmtMonths(22), '22 miesiące');
        assert.strictEqual(P.fmtMonths(104), '104 miesiące');
    });

    it('uses genitive singular for fractional values with a decimal comma', () => {
        P.currentLang = 'pl';
        assert.strictEqual(P.fmtMonths(4.5), '4,5 miesiąca');
        assert.strictEqual(P.fmtMonths(1.5), '1,5 miesiąca');
        assert.strictEqual(P.fmtMonths(0.5), '< 1 miesiąca');
    });

    it('returns scenInfinity for non-finite or zero payback', () => {
        P.currentLang = 'pl';
        assert.strictEqual(P.fmtMonths(Infinity), P.TRANSLATIONS.pl.scenInfinity);
        assert.strictEqual(P.fmtMonths(0), P.TRANSLATIONS.pl.scenInfinity);
        P.currentLang = 'en';
        assert.strictEqual(P.fmtMonths(NaN), P.TRANSLATIONS.en.scenInfinity);
    });

    it('English keeps two forms and a dot decimal separator', () => {
        P.currentLang = 'en';
        assert.strictEqual(P.fmtMonths(1), '1 month');
        assert.strictEqual(P.fmtMonths(2), '2 months');
        assert.strictEqual(P.fmtMonths(4.5), '4.5 months');
    });
});

describe('PDE.fmtCount — Polish incident declension (DORA table)', () => {
    it('declines incydent/incydenty/incydentów by count', () => {
        P.currentLang = 'pl';
        assert.strictEqual(P.TRANSLATIONS.pl.doraErrorsDesc(0), '0 incydentów');
        assert.strictEqual(P.TRANSLATIONS.pl.doraErrorsDesc(1), '1 incydent');
        assert.strictEqual(P.TRANSLATIONS.pl.doraErrorsDesc(2), '2 incydenty');
        assert.strictEqual(P.TRANSLATIONS.pl.doraErrorsDesc(5), '5 incydentów');
        assert.strictEqual(P.TRANSLATIONS.pl.doraErrorsDesc(12), '12 incydentów');
        assert.strictEqual(P.TRANSLATIONS.pl.doraErrorsDesc(22), '22 incydenty');
    });

    it('English keeps two forms', () => {
        P.currentLang = 'en';
        assert.strictEqual(P.TRANSLATIONS.en.doraErrorsDesc(1), '1 incident');
        assert.strictEqual(P.TRANSLATIONS.en.doraErrorsDesc(2), '2 incidents');
    });
});

describe('PDE.fmtMonthsLocative — Polish locative case after "po"', () => {
    it('declines locative forms correctly', () => {
        P.currentLang = 'pl';
        assert.strictEqual(P.fmtMonthsLocative(1), '1 miesiącu');
        assert.strictEqual(P.fmtMonthsLocative(2), '2 miesiącach');
        assert.strictEqual(P.fmtMonthsLocative(5), '5 miesiącach');
        assert.strictEqual(P.fmtMonthsLocative(12), '12 miesiącach');
        assert.strictEqual(P.fmtMonthsLocative(22), '22 miesiącach');
        assert.strictEqual(P.fmtMonthsLocative(4.5), '4,5 miesiąca');
        assert.strictEqual(P.fmtMonthsLocative(0.5), '< 1 miesiąca');
    });

    it('verdictHero renders "zwrot nastąpi po X miesiącach"', () => {
        P.currentLang = 'pl';
        const hero = P.TRANSLATIONS.pl.verdictHero('185 685 zł', '2 452 443 zł', P.fmtMonthsLocative(5));
        assert.ok(hero.indexOf('po <strong>5 miesiącach</strong>') !== -1, hero);
    });

    it('English keeps the plain plural after "occurs after"', () => {
        P.currentLang = 'en';
        assert.strictEqual(P.fmtMonthsLocative(5), '5 months');
        assert.strictEqual(P.fmtMonthsLocative(1), '1 month');
    });
});

describe('PDE.fmtMonthsRange — ranges decline by upper bound', () => {
    it('Polish range forms follow the upper bound', () => {
        P.currentLang = 'pl';
        assert.strictEqual(P.fmtMonthsRange(1, 1), '1 miesiąc');
        assert.strictEqual(P.fmtMonthsRange(2, 4), '2–4 miesiące');
        assert.strictEqual(P.fmtMonthsRange(3, 6), '3–6 miesięcy');
        assert.strictEqual(P.fmtMonthsRange(3, 5), '3–5 miesięcy');
    });

    it('English ranges use the plural for any upper bound above 1', () => {
        P.currentLang = 'en';
        assert.strictEqual(P.fmtMonthsRange(1, 2), '1–2 months');
        assert.strictEqual(P.fmtMonthsRange(1, 1), '1 month');
    });
});
