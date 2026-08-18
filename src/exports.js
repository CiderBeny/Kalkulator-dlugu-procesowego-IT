// ═══════════════════════════════════════════════════════════════
// Export functions — Excel, PDF, font cache
// ═══════════════════════════════════════════════════════════════
window.PDE = window.PDE || {};

PDE.sanitizeCell = function sanitizeCell(v) {
    return typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
};

PDE.exportExcel = function exportExcel() {
    const btn = document.getElementById('exportExcelBtn');
    btn.disabled = true;
    btn.textContent = PDE.t('exportExcelGenerating');

    setTimeout(() => {
        try {
            const L  = PDE.TRANSLATIONS[PDE.currentLang];
            const wb = XLSX.utils.book_new();

            const sanitizeSheetData = data =>
                data.map(row => Array.isArray(row)
                    ? row.map(cell => PDE.sanitizeCell(cell))
                    : PDE.sanitizeCell(row));

            const p = PDE.getParams();
            const r = PDE.computeModel(p);

            const leversRaw = [
                { title: L.leverAutomationTitle, recovery: r.leverRecoveryAuto, effort: L.effortMedium, timeline: '2\u20134 mo' },
                { title: L.leverRiskTitle,        recovery: r.leverRecoveryRisk,        effort: L.effortLow,    timeline: '1\u20132 mo' },
                { title: L.leverInnovationTitle,  recovery: r.leverRecoveryInnovation,  effort: L.effortHigh, timeline: '3\u20136 mo' },
                { title: L.leverMgmtTitle,        recovery: r.leverRecoveryMgmt,        effort: L.effortLow,  timeline: '1 mo'   },
                { title: L.leverTurnoverTitle,    recovery: r.leverRecoveryTurnover,    effort: L.effortMedium, timeline: '3\u20135 mo' },
            ];
            leversRaw.sort((a, b) => b.recovery - a.recovery);
            const top3 = leversRaw.slice(0, 3);
            const totalRecovery = top3.reduce((s, l) => s + l.recovery, 0);

            const dr = p.discountRate;
            const ny = p.horizonYears;
            const scenA = PDE.scenCalc(0,    0,                            r.recoverable, dr, ny);
            const scenB = PDE.scenCalc(p.autoLevel / 100, p.capex,         r.recoverable, dr, ny);
            const scenC = PDE.scenCalc(r.scenCAutoLevel,  p.capex * r.scenCCapexMult, r.recoverable, dr, ny);

            const q1Raw = PDE.clamp('q1'), q2Raw = PDE.clamp('q2'), q3Raw = PDE.clamp('q3'),
                q4Raw = PDE.currencyToUsd(PDE.clamp('q4')), q5Raw = PDE.clamp('q5'), q11Raw = PDE.clamp('q11'),
                q6Raw = PDE.currencyToUsd(PDE.clamp('q6')), q7Raw = PDE.clamp('q7'), q8Raw = PDE.currencyToUsd(PDE.clamp('q8')),
                q9Raw = PDE.clamp('q9'), q10Raw = PDE.clamp('q10');
            const autoLvlRaw = PDE.clamp('autoLevel'), teamSizeRaw = PDE.clamp('teamSize'), capexRaw = PDE.currencyToUsd(PDE.clamp('capex'));

            const inputQValues = [q1Raw, q2Raw, q3Raw, q4Raw, q5Raw, q11Raw, q6Raw, q7Raw, q8Raw, q9Raw, q10Raw];
            const advancedRows = [
                [],
                [L.xlsAdvancedTitle],
                [L.erosionRateLabel,    p.erosionRate.toFixed(2), ''],
                [L.discountRateLabel,   (Math.round(p.discountRate * 1000) / 10) + '%', ''],
                [L.timeHorizonLabel,    p.horizonYears + ' yr', ''],
                [L.leverAutomationLabel, Math.round(p.leverAuto * 100) + '%', ''],
                [L.leverRiskLabel,      Math.round(p.leverRisk * 100) + '%', ''],
                [L.contextPremiumLabel, Math.round(p.contextPremium * 100) + '%', ''],
                [L.taxRateLabel,        Math.round(p.taxRate) + '%', ''],
                [L.scenCAutoLevelLabel, Math.round(p.scenCAutoLevel * 100) + '%', ''],
                [L.scenCCapexMultLabel, p.scenCCapexMult.toFixed(1), ''],
                [L.annualHoursLabel,    p.annualHours, ''],
                [L.leverInnovationLabel, Math.round(p.leverInnovation * 100) + '%', ''],
                [L.leverManagementLabel, Math.round(p.leverManagement * 100) + '%', ''],
                [L.leverTurnoverLabel,   Math.round(p.leverTurnover * 100) + '%', ''],
                [],
                [L.xlsToggleTitle],
                [L.toggleCorrelations,  p.correlationsEnabled ? 'ON' : 'OFF', ''],
                [L.toggleNonlinear,     p.nonlinearEnabled ? 'ON' : 'OFF', ''],
                ['Confidence Intervals (MC)', p.probabilisticEnabled ? 'ON' : 'OFF', ''],
                [L.toggleAdvancedRisk,  p.advancedRiskEnabled ? 'ON' : 'OFF', ''],
                [],
                [L.sectionCorrelations],
                [L.correlationStrengthLabel, p.correlationMultiplier.toFixed(2), ''],
                [L.corrQ3Q1Label, String(p.corrQ3Q1), ''],
                [L.corrQ1Q5Label, p.corrQ1Q5.toFixed(1), ''],
                [L.corrQ1Q7Label, String(p.corrQ1Q7), ''],
                [L.corrQ3Q7Label, String(p.corrQ3Q7), ''],
                [],
                [L.sectionRiskWeights],
                [L.riskSecurityWeightLabel,   p.riskSecurityWeight.toFixed(2), ''],
                [L.riskRegulatoryWeightLabel, p.riskRegulatoryWeight.toFixed(2), ''],
                [],
                [L.sectionMc],
                ['MC Iterations',    String(p.mcIterations), ''],
                ['Confidence Level', Math.round(p.mcConfidence * 100) + '%', ''],
                ['Input Uncertainty', Math.round(p.mcUncertaintyPct * 100) + '%', ''],
                ['MTTR Uncertainty', Math.round(p.mcMttrUnc * 100) + '%', ''],
            ];
            const inputsData = [
                [L.xlsInputsTitle],
                [L.xlsGenerated, new Date().toLocaleString()],
                [],
                L.xlsInputsHeaders,
                ...L.xlsInputsRows.map((row, i) => [row[0], row[1], inputQValues[i], row[3]]),
                [],
                [L.xlsSimParamsTitle],
                [L.xlsAutoLevel,  autoLvlRaw, '%'           ],
                [L.xlsTeamSize,   teamSizeRaw, L.xlsTeamSizeUnit],
                [L.xlsCapex,      capexRaw,   PDE.currentCurrency      ],
                ...advancedRows,
            ];
            const wsInputs = XLSX.utils.aoa_to_sheet(sanitizeSheetData(inputsData));
            wsInputs['!cols'] = [{wch:6},{wch:38},{wch:18},{wch:14}];
            XLSX.utils.book_append_sheet(wb, wsInputs, L.xlsSheetInputs);

            const resultValues = [
                Math.round(r.cWaste), Math.round(r.cRisk), Math.round(r.cOppDirect),
                Math.round(r.totalImpact), Math.round(p.capex), Math.round(r.netDebt),
                Math.round(r.potentialSavings), isFinite(r.paybackMonths) ? Math.round(r.paybackMonths * 10) / 10 : L.scenInfinity,
                r.irr !== null ? PDE.formatIRR(r.irr) : '\u2014',
            ];
            const resultsData = [
                [L.xlsResultsTitle],
                [],
                L.xlsResultsHeaders,
                ...L.xlsResultsRows.map((row, i) => [row[0], row[1], resultValues[i]]),
                ['', '', L.xlsResultsMonths],
            ];
            const wsResults = XLSX.utils.aoa_to_sheet(sanitizeSheetData(resultsData));
            wsResults['!cols'] = [{wch:32},{wch:50},{wch:18}];
            XLSX.utils.book_append_sheet(wb, wsResults, L.xlsSheetResults);

            const leversData = [
                [L.xlsLeversTitle],
                [],
                L.xlsLeversHeaders,
                ...top3.map((l, i) => [L.rankLabels[i], l.title, l.recovery, l.effort, l.timeline]),
                [],
                [L.xlsLeversTotalLabel, '', totalRecovery, '', ''],
                [L.xlsLeversPayback,    '', isFinite(r.paybackMonths) ? Math.round(r.paybackMonths * 10) / 10 : L.scenInfinity, '', L.xlsResultsMonths],
            ];
            const wsLevers = XLSX.utils.aoa_to_sheet(sanitizeSheetData(leversData));
            wsLevers['!cols'] = [{wch:22},{wch:32},{wch:28},{wch:12},{wch:14}];
            XLSX.utils.book_append_sheet(wb, wsLevers, L.xlsSheetLevers);

            const scenC_cap = p.capex * PDE.COEFFICIENTS.SCEN_C_CAPEX_MULTIPLIER;
            const scenValues = [
                [Math.round(scenA.net), Math.round(r.totalImpact), Math.round(r.totalImpact)],
                [0,                     Math.round(p.capex),       Math.round(scenC_cap)  ],
                [0,                     Math.round(scenB.net),     Math.round(scenC.net)  ],
                ['\u221e',
                 isFinite(scenB.pb) ? Math.round(scenB.pb * 10)/10 : '\u221e',
                 isFinite(scenC.pb) ? Math.round(scenC.pb * 10)/10 : '\u221e'],
                [scenA.irr !== null ? PDE.formatIRR(scenA.irr) : '\u2014',
                 scenB.irr !== null ? PDE.formatIRR(scenB.irr) : '\u2014',
                 scenC.irr !== null ? PDE.formatIRR(scenC.irr) : '\u2014'],
            ];
            const scenData = [
                [L.xlsScenariosTitle],
                [],
                L.xlsScenariosHeaders,
                ...L.xlsScenariosRows.map((row, i) => [row[0], scenValues[i][0], scenValues[i][1], scenValues[i][2]]),
            ];
            const wsScen = XLSX.utils.aoa_to_sheet(sanitizeSheetData(scenData));
            wsScen['!cols'] = [{wch:24},{wch:20},{wch:28},{wch:28}];
            XLSX.utils.book_append_sheet(wb, wsScen, L.xlsSheetScenarios);

            const sensViews = PDE.scenSensitivity(p);
            const senValue = (get) => sensViews.map(v => get(v.metrics));
            const sensRows = [
                [L.sensViewsDragLabel, ...senValue(m => Math.round(m.drag))],
                [L.scenarioBTitle],
                [L.scenLabelNet,    ...senValue(m => Math.round(m.scenB.net))],
                [L.scenLabelPayback,...senValue(m => isFinite(m.scenB.pb) ? Math.round(m.scenB.pb * 10) / 10 : L.scenInfinity)],
                ['IRR',             ...senValue(m => PDE.formatIRR(m.scenB.irr))],
                [L.scenarioCTitle],
                [L.scenLabelNet,    ...senValue(m => Math.round(m.scenC.net))],
                [L.scenLabelPayback,...senValue(m => isFinite(m.scenC.pb) ? Math.round(m.scenC.pb * 10) / 10 : L.scenInfinity)],
                ['IRR',             ...senValue(m => PDE.formatIRR(m.scenC.irr))],
            ];
            const sensData = [
                [L.xlsSensitivityTitle],
                [],
                L.xlsSensitivityHeaders,
                ...sensRows,
            ];
            const wsSens = XLSX.utils.aoa_to_sheet(sanitizeSheetData(sensData));
            wsSens['!cols'] = [{wch:26},{wch:18},{wch:14},{wch:18}];
            XLSX.utils.book_append_sheet(wb, wsSens, L.xlsSheetSensitivity);

            const doraValues = [q2Raw, p.manualPercent, p.failures];
            const doraData = [
                [L.xlsDoraTitle],
                [],
                L.xlsDoraHeaders,
                ...L.xlsDoraRows.map((row, i) => [row[0], doraValues[i], row[2], PDE.getDoraBand(['leadTime','manual','errors'][i], doraValues[i]).band]),
            ];
            const wsDora = XLSX.utils.aoa_to_sheet(sanitizeSheetData(doraData));
            wsDora['!cols'] = [{wch:28},{wch:14},{wch:52},{wch:20}];
            XLSX.utils.book_append_sheet(wb, wsDora, L.xlsSheetDora);

            XLSX.writeFile(wb, 'Process-Debt-Engine.xlsx');
        } catch(err) {
            console.error('Excel export error:', err);
            alert('Export failed: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = PDE.t('exportExcelBtn');
        }
    }, 80);
};

PDE.exportCsv = function exportCsv() {
    const btn = document.getElementById('exportCsvBtn');
    btn.disabled = true;
    btn.textContent = PDE.t('exportCsvGenerating');

    setTimeout(() => {
        try {
            const L = PDE.TRANSLATIONS[PDE.currentLang];
            const p = PDE.getParams();
            const r = PDE.computeModel(p);

            const leversRaw = [
                { title: L.leverAutomationTitle, recovery: r.leverRecoveryAuto,    effort: L.effortMedium, timeline: '2-4 mo' },
                { title: L.leverRiskTitle,        recovery: r.leverRecoveryRisk,    effort: L.effortLow,    timeline: '1-2 mo' },
                { title: L.leverInnovationTitle,  recovery: r.leverRecoveryInnovation, effort: L.effortHigh, timeline: '3-6 mo' },
                { title: L.leverMgmtTitle,        recovery: r.leverRecoveryMgmt,    effort: L.effortLow,    timeline: '1 mo'   },
                { title: L.leverTurnoverTitle,    recovery: r.leverRecoveryTurnover, effort: L.effortMedium, timeline: '3-5 mo' },
            ];
            leversRaw.sort((a, b) => b.recovery - a.recovery);
            const top3 = leversRaw.slice(0, 3);
            const totalRecovery = top3.reduce((s, l) => s + l.recovery, 0);

            const dr = p.discountRate;
            const ny = p.horizonYears;
            const scenA = PDE.scenCalc(0, 0, r.recoverable, dr, ny);
            const scenB = PDE.scenCalc(p.autoLevel / 100, p.capex, r.recoverable, dr, ny);
            const scenC = PDE.scenCalc(r.scenCAutoLevel, p.capex * r.scenCCapexMult, r.recoverable, dr, ny);

            const q1Raw = PDE.clamp('q1'), q2Raw = PDE.clamp('q2'), q3Raw = PDE.clamp('q3'),
                q4Raw = PDE.currencyToUsd(PDE.clamp('q4')), q5Raw = PDE.clamp('q5'), q11Raw = PDE.clamp('q11'),
                q6Raw = PDE.currencyToUsd(PDE.clamp('q6')), q7Raw = PDE.clamp('q7'), q8Raw = PDE.currencyToUsd(PDE.clamp('q8')),
                q9Raw = PDE.clamp('q9'), q10Raw = PDE.clamp('q10');
            const autoLvlRaw = PDE.clamp('autoLevel'), teamSizeRaw = PDE.clamp('teamSize'), capexRaw = PDE.currencyToUsd(PDE.clamp('capex'));

            const csvEscape = function (v) {
                let s = String(v ?? '');
                if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
                if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
                return s;
            };
            const rows = [];

            rows.push(L.xlsInputsTitle);
            rows.push(L.xlsGenerated + ',' + csvEscape(new Date().toLocaleString()));
            rows.push('');
            rows.push(L.xlsInputsHeaders.map(function (h) { return csvEscape(h); }).join(','));
            L.xlsInputsRows.forEach(function (row, i) {
                const vals = [csvEscape(row[0]), csvEscape(row[1]), csvEscape(row[2] ?? [q1Raw, q2Raw, q3Raw, q4Raw, q5Raw, q11Raw, q6Raw, q7Raw, q8Raw, q9Raw, q10Raw][i]), csvEscape(row[3])];
                rows.push(vals.join(','));
            });
            rows.push('');
            rows.push(L.xlsSimParamsTitle);
            rows.push('autoLevel,' + csvEscape(autoLvlRaw) + ',%');
            rows.push('teamSize,' + csvEscape(teamSizeRaw) + ',' + csvEscape(L.xlsTeamSizeUnit));
            rows.push('capex,' + csvEscape(capexRaw) + ',' + csvEscape(PDE.currentCurrency));

            const advancedPairs = [
                [L.erosionRateLabel, p.erosionRate.toFixed(2)],
                [L.discountRateLabel, (Math.round(p.discountRate * 1000) / 10) + '%'],
                [L.timeHorizonLabel, p.horizonYears + ' yr'],
                [L.leverAutomationLabel, Math.round(p.leverAuto * 100) + '%'],
                [L.leverRiskLabel, Math.round(p.leverRisk * 100) + '%'],
                [L.contextPremiumLabel, Math.round(p.contextPremium * 100) + '%'],
                [L.taxRateLabel, Math.round(p.taxRate) + '%'],
                [L.scenCAutoLevelLabel, Math.round(p.scenCAutoLevel * 100) + '%'],
                [L.scenCCapexMultLabel, p.scenCCapexMult.toFixed(1)],
                [L.annualHoursLabel, p.annualHours],
                [L.leverInnovationLabel, Math.round(p.leverInnovation * 100) + '%'],
                [L.leverManagementLabel, Math.round(p.leverManagement * 100) + '%'],
                [L.leverTurnoverLabel, Math.round(p.leverTurnover * 100) + '%'],
            ];
            advancedPairs.forEach(function (pair) {
                rows.push(csvEscape(pair[0]) + ',' + csvEscape(pair[1]));
            });
            rows.push('');

            rows.push(L.xlsResultsTitle);
            const resultLabels = ['cWaste','cRisk','cOppDirect','totalImpact','capex','netDebt','potentialSavings','paybackMonths','IRR'];
            const resultValues = [
                Math.round(r.cWaste), Math.round(r.cRisk), Math.round(r.cOppDirect),
                Math.round(r.totalImpact), Math.round(p.capex), Math.round(r.netDebt),
                Math.round(r.potentialSavings), isFinite(r.paybackMonths) ? Math.round(r.paybackMonths * 10) / 10 : L.scenInfinity,
                r.irr !== null ? PDE.formatIRR(r.irr) : '-',
            ];
            resultLabels.forEach(function (label, i) {
                rows.push(csvEscape(label) + ',' + csvEscape(resultValues[i]));
            });
            rows.push('');

            rows.push(L.xlsLeversTitle);
            rows.push(L.xlsLeversHeaders.map(function (h) { return csvEscape(h); }).join(','));
            top3.forEach(function (l, i) {
                rows.push(csvEscape(L.rankLabels[i]) + ',' + csvEscape(l.title) + ',' + csvEscape(Math.round(l.recovery)) + ',' + csvEscape(l.effort) + ',' + csvEscape(l.timeline));
            });
            rows.push('');
            rows.push(csvEscape(L.xlsLeversTotalLabel) + ',,' + csvEscape(Math.round(totalRecovery)));
            rows.push(csvEscape(L.xlsLeversPayback) + ',,' + csvEscape(isFinite(r.paybackMonths) ? Math.round(r.paybackMonths * 10) / 10 : L.scenInfinity) + ',,' + csvEscape(L.xlsResultsMonths));
            rows.push('');

            rows.push(L.xlsScenariosTitle);
            rows.push(L.xlsScenariosHeaders.map(function (h) { return csvEscape(h); }).join(','));
            const scenC_cap = p.capex * PDE.COEFFICIENTS.SCEN_C_CAPEX_MULTIPLIER;
            const scenValues = [
                [Math.round(scenA.net), Math.round(r.totalImpact), Math.round(r.totalImpact)],
                [0, Math.round(p.capex), Math.round(scenC_cap)],
                [0, Math.round(scenB.net), Math.round(scenC.net)],
                ['---', isFinite(scenB.pb) ? Math.round(scenB.pb * 10) / 10 : '---', isFinite(scenC.pb) ? Math.round(scenC.pb * 10) / 10 : '---'],
                [scenA.irr !== null ? PDE.formatIRR(scenA.irr) : '-', scenB.irr !== null ? PDE.formatIRR(scenB.irr) : '-', scenC.irr !== null ? PDE.formatIRR(scenC.irr) : '-'],
            ];
            L.xlsScenariosRows.forEach(function (row, i) {
                rows.push(csvEscape(row[0]) + ',' + csvEscape(scenValues[i][0]) + ',' + csvEscape(scenValues[i][1]) + ',' + csvEscape(scenValues[i][2]));
            });
            rows.push('');

            rows.push(L.xlsDoraTitle);
            rows.push(L.xlsDoraHeaders.map(function (h) { return csvEscape(h); }).join(','));
            const doraValues = [q2Raw, p.manualPercent, p.failures];
            const doraMetrics = ['leadTime', 'manual', 'errors'];
            L.xlsDoraRows.forEach(function (row, i) {
                const band = PDE.getDoraBand(doraMetrics[i], doraValues[i]).band;
                rows.push(csvEscape(row[0]) + ',' + csvEscape(doraValues[i]) + ',' + csvEscape(row[2]) + ',' + csvEscape(band));
            });

            const now = new Date();
            const pad = function (n) { return String(n).padStart(2, '0'); };
            const ts = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + '_' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
            const filename = 'Process-Debt-Engine_' + ts + '.csv';

            const csvContent = '\uFEFF' + rows.join('\r\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('CSV export error:', err);
            alert('CSV export failed: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = PDE.t('exportCsvBtn');
        }
    }, 80);
};

PDE.resolveCSSVarsOnElement = function resolveCSSVarsOnElement(el) {
    const cs = getComputedStyle(document.documentElement);
    const varMap = {
        '--bg-base':       cs.getPropertyValue('--bg-base').trim()       || '#F5F0E8',
        '--bg-surface':    cs.getPropertyValue('--bg-surface').trim()    || '#FDFAF5',
        '--bg-elevated':   cs.getPropertyValue('--bg-elevated').trim()   || '#FFFFFF',
        '--bg-hover':      cs.getPropertyValue('--bg-hover').trim()      || '#F0EAE0',
        '--bg-input':      cs.getPropertyValue('--bg-input').trim()      || '#FAF7F2',
        '--border':        cs.getPropertyValue('--border').trim()        || '#D6C9B8',
        '--border-focus':  cs.getPropertyValue('--border-focus').trim()  || '#B45309',
        '--text-primary':  cs.getPropertyValue('--text-primary').trim()  || '#1C1410',
        '--text-secondary':cs.getPropertyValue('--text-secondary').trim()|| '#4A3F35',
        '--text-muted':    cs.getPropertyValue('--text-muted').trim()    || '#8C7B6E',
        '--text-label':    cs.getPropertyValue('--text-label').trim()    || '#7C4F22',
        '--accent':        cs.getPropertyValue('--accent').trim()        || '#B45309',
        '--accent-bright': cs.getPropertyValue('--accent-bright').trim() || '#92400E',
        '--accent-glow':   cs.getPropertyValue('--accent-glow').trim()   || 'rgba(180,83,9,0.12)',
        '--accent-dim':    cs.getPropertyValue('--accent-dim').trim()    || 'rgba(180,83,9,0.07)',
        '--red':           cs.getPropertyValue('--red').trim()           || '#DC2626',
        '--orange':        cs.getPropertyValue('--orange').trim()        || '#EA580C',
        '--purple':        cs.getPropertyValue('--purple').trim()        || '#7C3AED',
        '--green':         cs.getPropertyValue('--green').trim()         || '#16A34A',
        '--yellow':        cs.getPropertyValue('--yellow').trim()        || '#CA8A04',
    };

    const PROPS_TO_INLINE = [
        'backgroundColor', 'color', 'borderColor',
        'borderLeftColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor',
        'boxShadow', 'outlineColor',
    ];

    el.querySelectorAll('*').forEach(node => {
        if (!(node instanceof HTMLElement)) return;
        const computed = getComputedStyle(node);
        PROPS_TO_INLINE.forEach(prop => {
            const val = computed[prop];
            if (val && val.includes('var(')) {
                let resolved = val;
                for (const [token, hex] of Object.entries(varMap)) {
                    resolved = resolved.replaceAll(`var(${token})`, hex);
                }
                node.style[prop] = resolved;
            } else if (val && val !== node.style[prop]) {
                node.style[prop] = val;
            }
        });
    });
};

PDE.exportPDF = async function exportPDF(mode) {
    const isMobile = PDE.isMobileBrowser();

    const btnId = mode === 'full' ? 'ctaBtn' : 'exportBtnSimple';
    const generatingKey = mode === 'full' ? 'exportGeneratingFull' : 'exportGeneratingSimple';
    const finishedKey = mode === 'full' ? 'ctaBtn' : 'exportBtnSimple';
    const filename = mode === 'full' ? 'Strategic_Detailed_Report.pdf' : 'Strategic_Summary_Report.pdf';

    const { jsPDF } = window.jspdf;

    // ── Pre-construction patch: override internal f2/f3 to never throw on NaN ──
    try {
        let proto = jsPDF.prototype;
        while (proto) {
            if (proto.__private__ && typeof proto.__private__.f3 === 'function') {
                ['f2','f3'].forEach(function (fn) {
                    const orig = proto.__private__[fn].bind(proto.__private__);
                    proto.__private__[fn] = function (num) {
                        if (typeof num !== 'number' || !Number.isFinite(num)) {
                            console.warn('[PDF ' + fn + '-safe] NaN intercepted:', num, '— using 0');
                            return orig(0);
                        }
                        return orig(num);
                    };
                });
                break;
            }
            proto = Object.getPrototypeOf(proto);
        }
    } catch { /* prototype patch not available */ }

    const btn = document.getElementById(btnId);
    if (btn) { btn.disabled = true; btn.textContent = PDE.t(generatingKey); }
    await new Promise(r => setTimeout(r, 120));

    try {
        const pdf    = new jsPDF('p', 'mm', 'a4');
        const PW     = 210, PH = 297;
        const ML     = 14, MR = 14, MT = 14;
        const UW     = PW - ML - MR;
        let   cy     = MT;
        const L      = PDE.TRANSLATIONS[PDE.currentLang];

        // ── Debug wrappers for NaN detection ──
        (function wrapPdfMethods() {
            function sanitizeArgs(args) {
                for (let i = 0; i < args.length; i++) {
                    const a = args[i];
                    if (a === null || a === undefined) {
                        console.warn('[PDF NaN] null/undefined arg[' + i + '] — replaced with 0');
                        args[i] = 0;
                    } else if (typeof a === 'number' && !Number.isFinite(a)) {
                        console.error('[PDF NaN] pdf.(' + i + '=' + a + ')', args);
                        args[i] = 0;
                    } else if (Array.isArray(a)) {
                        sanitizeArgs(a);
                    }
                }
                return args;
            }
            const METHODS = ['text','rect','setFontSize','setFillColor','setDrawColor','setTextColor','setLineWidth','addImage','setFont','addPage'];
            METHODS.forEach(function (m) {
                const orig = pdf[m].bind(pdf);
                pdf[m] = function () {
                    const args = sanitizeArgs(Array.prototype.slice.call(arguments));
                    return orig.apply(null, args);
                };
            });
        })();

        // register Inter font (Polish character support)
        let pdfFont = 'helvetica';
        const fontItalic = 'normal';
        try {
            const [regResp, bldResp] = await Promise.all([
                fetch('fonts/Inter-Regular.ttf', { cache: 'force-cache' }),
                fetch('fonts/Inter-Bold.ttf', { cache: 'force-cache' })
            ]);
            if (regResp.ok && bldResp.ok) {
                const [regBuf, bldBuf] = await Promise.all([
                    regResp.arrayBuffer(),
                    bldResp.arrayBuffer()
                ]);
                async function bufToB64(buf) {
                    const blob = new Blob([buf]);
                    return new Promise(function (resolve, reject) {
                        const reader = new FileReader();
                        reader.onload = function () { resolve(reader.result.split(',')[1]); };
                        reader.onerror = function () { reject(new Error('FileReader failed')); };
                        reader.readAsDataURL(blob);
                    });
                }
                pdf.addFileToVFS('Inter-Regular.ttf', await bufToB64(regBuf));
                pdf.addFont('Inter-Regular.ttf', 'Inter', 'normal');
                pdf.addFileToVFS('Inter-Bold.ttf', await bufToB64(bldBuf));
                pdf.addFont('Inter-Bold.ttf', 'Inter', 'bold');
                pdfFont = 'Inter';
            }
        } catch (e) {
            console.warn('Could not load Inter font for PDF:', e.message);
        }

        // helpers
        function newPage() { pdf.addPage(); cy = MT; }
        function needSpace(h) { if (cy + h > PH - 10) newPage(); }

        function drawRect(x, y, w, h, fill, stroke) {
            if (fill)   { pdf.setFillColor(...fill);   pdf.rect(x, y, w, h, 'F'); }
            if (stroke) { pdf.setDrawColor(...stroke); pdf.setLineWidth(0.3); pdf.rect(x, y, w, h, 'S'); }
        }

        function wrapText(text, x, maxW) {
            const words = String(text).split(' ');
            const lines = [];
            let cur = '';
            words.forEach(w => {
                const test = cur ? cur + ' ' + w : w;
                if (pdf.getTextWidth(test) <= maxW) { cur = test; }
                else { if (cur) lines.push(cur); cur = w; }
            });
            if (cur) lines.push(cur);
            return lines;
        }

        // PAGE 1: Phase 1 header + all questions
        drawRect(0, 0, PW, 12, [92, 64, 18]);
        pdf.setFontSize(9); pdf.setFont(pdfFont, 'bold');
        pdf.setTextColor(253, 245, 230);
        pdf.text('STRATEGIC BUSINESS CASE ENGINE', ML, 8);
        pdf.setTextColor(214, 201, 184); pdf.setFont(pdfFont, 'normal');
        pdf.text(L.navSubtitle.toUpperCase(), PW - MR, 8, { align: 'right' });

        cy = 20;
        drawRect(ML - 2, cy - 4, UW + 4, 10, [180, 83, 9]);
        pdf.setFontSize(11); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(255, 255, 255);
        pdf.text(L.phase1Title.toUpperCase(), ML + 2, cy + 3);
        cy += 14;

        const qKeys = [
            { label: PDE.t('q1label'),  desc: L.q1desc,  id: 'q1',  type: 'number' },
            { label: PDE.t('q2label'),  desc: L.q2desc,  id: 'q2',  type: 'number' },
            { label: PDE.t('q3label'),  desc: L.q3desc,  id: 'q3',  type: 'slider', valId: 'q3Val', min: L.q3min, max: L.q3max },
            { label: PDE.t('q4label'),  desc: L.q4desc,  id: 'q4',  type: 'number' },
            { label: PDE.t('q5label'),  desc: L.q5desc,  id: 'q5',  type: 'number' },
            { label: PDE.t('q11label'), desc: L.q11desc, id: 'q11', type: 'number' },
            { label: PDE.t('q6label'),  desc: L.q6desc,  id: 'q6',  type: 'number' },
            { label: PDE.t('q7label'),  desc: L.q7desc,  id: 'q7',  type: 'number' },
            { label: PDE.t('q8label'),  desc: L.q8desc,  id: 'q8',  type: 'number' },
            { label: PDE.t('q9label'),  desc: L.q9desc,  id: 'q9',  type: 'slider', valId: 'q9Val' },
            { label: PDE.t('q10label'), desc: L.q10desc, id: 'q10', type: 'number' },
        ];

        // 2-column card layout
        const colW  = UW / 2 - 3;
        const cols  = [ML, ML + UW / 2 + 3];
        const rowH  = 38;

        try {
            for (let i = 0; i < qKeys.length; i++) {
                const q   = qKeys[i];
                const col = i % 2;
                const x   = cols[col];

                if (col === 0 && i > 0) { cy += rowH + 3; }
                if (col === 0) { needSpace(rowH + 3); }

                const val = document.getElementById(q.id).value;
                const monetaryIds = ['q4', 'q6', 'q8'];
                const displayVal = q.type === 'slider'
                    ? document.getElementById(q.valId).textContent
                    : monetaryIds.includes(q.id)
                        ? new Intl.NumberFormat(PDE.currentLang === 'pl' ? 'pl-PL' : 'en-US', {
                            style: 'currency',
                            currency: PDE.currentCurrency,
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          }).format(parseFloat(val) || 0)
                        : val;

                drawRect(x, cy, colW, rowH, [255, 255, 255], [214, 201, 184]);
                drawRect(x, cy, 2, rowH, [180, 83, 9]);

                pdf.setFontSize(7); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(124, 79, 34);
                pdf.text(q.label.toUpperCase(), x + 5, cy + 6);

                pdf.setFontSize(6.2); pdf.setFont(pdfFont, 'normal'); pdf.setTextColor(140, 123, 110);
                const descLines = wrapText(q.desc, x + 5, colW - 10, 6.2 * 0.3528);
                const maxDescLines = 3;
                descLines.slice(0, maxDescLines).forEach((line, li) => {
                    pdf.text(line, x + 5, cy + 12 + li * 4);
                });

                const vBoxY = cy + rowH - 11;
                drawRect(x + 5, vBoxY, colW - 10, 8, [250, 247, 242], [214, 201, 184]);
                pdf.setFontSize(8); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(28, 20, 16);
                pdf.text(String(displayVal), x + 8, vBoxY + 5.5);

                if (q.type === 'slider' && q.min) {
                    pdf.setFontSize(5.5); pdf.setFont(pdfFont, 'normal'); pdf.setTextColor(140, 123, 110);
                    pdf.text(q.min, x + 5, vBoxY + 5.5);
                    pdf.text(q.max, x + colW - 5, vBoxY + 5.5, { align: 'right' });
                }
            }
        } catch (e) {
            console.error('[PDF] Phase 1 rendering error:', e);
        }

        cy += rowH + 8;

        // Phase 2: Investment & Simulation Parameters
        needSpace(20);
        drawRect(ML - 2, cy - 4, UW + 4, 10, [180, 83, 9]);
        pdf.setFontSize(11); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(255, 255, 255);
        pdf.text(PDE.t('phase2Title').toUpperCase(), ML + 2, cy + 3);
        cy += 14;

        // Disclaimer
        needSpace(14);
        pdf.setFontSize(6); pdf.setFont(pdfFont, fontItalic); pdf.setTextColor(180, 83, 9);
        const discLines = pdf.splitTextToSize(PDE.t('toolDisclaimerBody'), UW - 4);
        discLines.forEach(function (line) { pdf.text(line, ML, cy); cy += 3.5; });
        cy += 4;

        const paramKeys = [
            { label: PDE.t('autoLabel'),         desc: '',                        id: 'autoLevel',       unit: '%',      isSlider: true, valId: 'autoLevelVal',       min: '0',   max: '100' },
            { label: PDE.t('teamSizeLabel'),      desc: PDE.t('teamSizeHelper'),          id: 'teamSize',         unit: '',       isSlider: false },
            { label: PDE.t('capexLabel'),         desc: PDE.t('capexHelper'),            id: 'capex',            unit: 'money',  isSlider: false },
            { label: PDE.t('erosionRateLabel'),   desc: PDE.t('erosionRateHelper'),       id: 'erosionRate',     unit: '',       isSlider: true, valId: 'erosionRateVal' },
            { label: PDE.t('discountRateLabel'),  desc: PDE.t('discountRateHelper'),      id: 'discountRate',    unit: '%',      isSlider: true, valId: 'discountRateVal',   min: '5%',  max: '20%' },
            { label: PDE.t('timeHorizonLabel'),   desc: PDE.t('timeHorizonHelper'),       id: 'timeHorizon',     unit: 'yr',     isSlider: true, valId: 'timeHorizonVal' },
            { label: PDE.t('leverAutomationLabel'),desc: PDE.t('leverAutomationHelper'),  id: 'leverAutomation', unit: '%',      isSlider: true, valId: 'leverAutomationVal' },
            { label: PDE.t('leverRiskLabel'),     desc: PDE.t('leverRiskHelper'),         id: 'leverRisk',       unit: '%',      isSlider: true, valId: 'leverRiskVal' },
            { label: PDE.t('contextPremiumLabel'), desc: PDE.t('contextPremiumHelper'),   id: 'contextPremium',  unit: '%',      isSlider: true, valId: 'contextPremiumVal', min: '0%',  max: '30%' },
            { label: PDE.t('taxRateLabel'),        desc: PDE.t('taxRateHelper'),          id: 'taxRate',         unit: '%',      isSlider: true, valId: 'taxRateVal',        min: '0%',  max: '50%' },
            // Scenarios
            { label: PDE.t('scenCAutoLevelLabel'), desc: PDE.t('scenCAutoLevelHelper'),   id: 'scenCAutoLevel',  unit: '%',      isSlider: true, valId: 'scenCAutoLevelVal',  min: '50%', max: '100%' },
            { label: PDE.t('scenCCapexMultLabel'), desc: PDE.t('scenCCapexMultHelper'),   id: 'scenCCapexMult',  unit: '',       isSlider: true, valId: 'scenCCapexMultVal' },
            { label: PDE.t('annualHoursLabel'),    desc: PDE.t('annualHoursHelper'),      id: 'annualHours',     unit: '',       isSlider: true, valId: 'annualHoursVal' },
            // Levers
            { label: PDE.t('leverInnovationLabel'),desc: PDE.t('leverInnovationHelper'),  id: 'leverInnovation', unit: '%',      isSlider: true, valId: 'leverInnovationVal' },
            { label: PDE.t('leverManagementLabel'),desc: PDE.t('leverManagementHelper'),  id: 'leverManagement', unit: '%',      isSlider: true, valId: 'leverManagementVal' },
            { label: PDE.t('leverTurnoverLabel'),  desc: PDE.t('leverTurnoverHelper'),    id: 'leverTurnover',   unit: '%',      isSlider: true, valId: 'leverTurnoverVal' },
        ];
        // Conditional advanced params
        if (document.getElementById('probabilisticToggle') && document.getElementById('probabilisticToggle').checked) {
            paramKeys.push(
                { label: PDE.t('mcIterationsLabel'),     desc: PDE.t('mcIterationsHelper'),        id: 'mcIterations',          unit: '',  isSlider: true, valId: 'mcIterationsVal' },
                { label: PDE.t('mcConfidenceLabel'),      desc: PDE.t('mcConfidenceHelper'),       id: 'mcConfidence',          unit: '%', isSlider: true, valId: 'mcConfidenceVal',     min: '50%', max: '99%' },
                { label: PDE.t('mcUncertaintyPctLabel'),  desc: PDE.t('mcUncertaintyPctHelper'),   id: 'mcUncertaintyPct',      unit: '%', isSlider: true, valId: 'mcUncertaintyPctVal', min: '5%',  max: '30%' },
                { label: PDE.t('mcMttrUncertaintyPctLabel'), desc: PDE.t('mcMttrUncertaintyPctHelper'), id: 'mcMttrUncertaintyPct', unit: '%', isSlider: true, valId: 'mcMttrUncertaintyPctVal', min: '10%', max: '50%' },
            );
        }
        if (document.getElementById('correlationsToggle') && document.getElementById('correlationsToggle').checked) {
            paramKeys.push(
                { label: PDE.t('correlationStrengthLabel'), desc: PDE.t('correlationStrengthHelper'), id: 'correlationStrength', unit: '', isSlider: true, valId: 'correlationStrengthVal' },
            );
        }
        if (document.getElementById('advancedRiskToggle') && document.getElementById('advancedRiskToggle').checked) {
            paramKeys.push(
                { label: PDE.t('riskSecurityWeightLabel'),   desc: PDE.t('riskSecurityWeightHelper'),   id: 'riskSecurityWeight',   unit: '', isSlider: true, valId: 'riskSecurityWeightVal' },
                { label: PDE.t('riskRegulatoryWeightLabel'), desc: PDE.t('riskRegulatoryWeightHelper'), id: 'riskRegulatoryWeight', unit: '', isSlider: true, valId: 'riskRegulatoryWeightVal' },
            );
        }

        const pCols = 3;
        const pColW = UW / pCols - 3;
        const pRowH = 38;

        try {
            for (let i = 0; i < paramKeys.length; i++) {
                const q   = paramKeys[i];
                const col = i % pCols;
                const x   = ML + col * (pColW + 3);

                if (col === 0 && i > 0) { cy += pRowH + 3; }
                if (col === 0) { needSpace(pRowH + 3); }

                let val;
                if (q.isSlider) {
                    val = document.getElementById(q.valId).textContent;
                } else if (q.unit === 'money') {
                    val = new Intl.NumberFormat(PDE.currentLang === 'pl' ? 'pl-PL' : 'en-US', {
                        style: 'currency',
                        currency: PDE.currentCurrency,
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    }).format(parseFloat(document.getElementById(q.id).value) || 0);
                } else {
                    val = document.getElementById(q.id).value;
                }
                if (q.unit && q.unit !== 'money') val += q.unit;

                drawRect(x, cy, pColW, pRowH, [255, 255, 255], [214, 201, 184]);
                drawRect(x, cy, 2, pRowH, [180, 83, 9]);

                pdf.setFontSize(7); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(124, 79, 34);
                pdf.text(q.label.toUpperCase(), x + 5, cy + 6);

                if (q.desc) {
                    pdf.setFontSize(6); pdf.setFont(pdfFont, 'normal'); pdf.setTextColor(140, 123, 110);
                    const descLines = wrapText(q.desc, x + 5, pColW - 10, 6 * 0.3528);
                    descLines.slice(0, 2).forEach((line, li) => {
                        pdf.text(line, x + 5, cy + 12 + li * 4);
                    });
                }

                const vBoxY = cy + pRowH - 11;
                drawRect(x + 5, vBoxY, pColW - 10, 8, [250, 247, 242], [214, 201, 184]);
                pdf.setFontSize(8); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(28, 20, 16);
                pdf.text(String(val), x + 8, vBoxY + 5.5);

                if (q.isSlider && q.min) {
                    pdf.setFontSize(5.5); pdf.setFont(pdfFont, 'normal'); pdf.setTextColor(140, 123, 110);
                    pdf.text(q.min, x + 5, vBoxY + 5.5);
                    pdf.text(q.max, x + pColW - 5, vBoxY + 5.5, { align: 'right' });
                }
            }
        } catch (e) {
            console.error('[PDF] Phase 2 rendering error:', e);
        }
        cy += pRowH + 8;

        if (isMobile) {
            const p = PDE.getParams();
            const r = PDE.computeModel(p);
            console.debug('[PDF] Model params:', JSON.parse(JSON.stringify(p)));
            console.debug('[PDF] Model results:', JSON.parse(JSON.stringify(r)));
            console.debug('[PDF] cy start =', cy);

            const leversRaw = [
                { key: 'automation', label: L.leverAutomationTitle, recovery: r.leverRecoveryAuto,    effort: L.effortMedium, timeline: PDE.fmtMonthsRange(2, 4), color: [220,38,38] },
                { key: 'risk',       label: L.leverRiskTitle,        recovery: r.leverRecoveryRisk,    effort: L.effortLow,    timeline: PDE.fmtMonthsRange(1, 2), color: [234,88,12] },
                { key: 'innovation', label: L.leverInnovationTitle,  recovery: r.leverRecoveryInnovation, effort: L.effortHigh, timeline: PDE.fmtMonthsRange(3, 6), color: [124,58,237] },
                { key: 'mgmt',      label: L.leverMgmtTitle,        recovery: r.leverRecoveryMgmt,    effort: L.effortLow,    timeline: PDE.fmtMonthsRange(1, 1), color: [8,145,178] },
                { key: 'turnover',  label: L.leverTurnoverTitle,    recovery: r.leverRecoveryTurnover, effort: L.effortMedium,timeline: PDE.fmtMonthsRange(3, 5), color: [22,163,74] },
            ];

            function renderSimpleResults() {
                const cards = [
                    { label: L.statWasteLabel,  val: PDE.formatCurrency(r.cWaste),     color: [220,38,38] },
                    { label: L.statRiskLabel,   val: PDE.formatCurrency(r.cRisk),      color: [234,88,12] },
                    { label: L.statOppLabel,    val: PDE.formatCurrency(r.cOppDirect), color: [124,58,237] },
                    { label: L.statTotalLabel,  val: PDE.formatCurrency(r.totalImpact), color: [30,41,59] },
                    { label: L.statNpvLabel,    val: PDE.formatCurrency(r.npvTotalDebt), color: [8,145,178] },
                    { label: L.statIrrLabel,    val: r.irr !== null ? PDE.formatIRR(r.irr) : '\u2014', color: [124,58,237] },
                    { label: L.statNetLabel,    val: PDE.formatCurrency(r.netDebt),    color: [22,163,74] },
                ];
                const cols = 2, cw = (UW - 6) / cols, ch = 16;
                needSpace(8);
                drawRect(ML - 2, cy - 4, UW + 4, 10, [180,83,9]);
                pdf.setFontSize(10); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(255,255,255);
                pdf.text('FINANCIAL RESULTS', ML + 2, cy + 3);
                cy += 14;

                cards.forEach((c, i) => {
                    try {
                        const col = i % cols;
                        const x = ML + col * (cw + 6);
                        if (col === 0 && i > 0) cy += ch + 3;
                        needSpace(ch + 3);
                        drawRect(x, cy, cw, ch, [255,255,255], [214,201,184]);
                        drawRect(x, cy, 1.5, ch, c.color);
                        pdf.setFontSize(6); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(124,79,34);
                        pdf.text(String(c.label).toUpperCase(), x + 4, cy + 5);
                        pdf.setFontSize(8); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(28,20,16);
                        pdf.text(String(c.val), x + 4, cy + 13);
                    } catch (e) {
                        console.error('[PDF Card ' + i + ']', e, 'label:', c.label, 'val:', c.val, 'cy:', cy);
                    }
                });
                cy += ch + 10;
            }

            function renderSimpleScenarios() {
                const dr = p.discountRate;
                const ny = p.horizonYears;
                const scenA = PDE.scenCalc(0, 0, r.recoverable, dr, ny);
                const scenB = PDE.scenCalc(p.autoLevel / 100, p.capex, r.recoverable, dr, ny);
                const scenC = PDE.scenCalc(r.scenCAutoLevel, p.capex * r.scenCCapexMult, r.recoverable, dr, ny);
                const scens = [
                    { title: L.scenarioATitle, desc: L.scenarioADesc, accent: [220,38,38], data: scenA, cx: 0 },
                    { title: L.scenarioBTitle, desc: L.scenarioBDesc, accent: [180,83,9],  data: scenB, cx: p.capex },
                    { title: L.scenarioCTitle, desc: L.scenarioCDesc, accent: [22,163,74], data: scenC, cx: p.capex * r.scenCCapexMult },
                ];
                needSpace(8);
                drawRect(ML - 2, cy - 4, UW + 4, 10, [180,83,9]);
                pdf.setFontSize(10); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(255,255,255);
                pdf.text(L.scenarioTitle.toUpperCase(), ML + 2, cy + 3);
                pdf.setFontSize(6); pdf.setFont(pdfFont, 'normal'); pdf.setTextColor(250,247,242);
                pdf.text(L.scenarioSubtitle, ML + 2, cy + 9);
                cy += 16;

                const cw = (UW - 6) / 3;
                scens.forEach((s, i) => {
                    try {
                        const x = ML + i * (cw + 3);
                        needSpace(48);
                        const h = 52;
                        drawRect(x, cy, cw, h, [255,255,255], [214,201,184]);
                        drawRect(x, cy, cw, 2, s.accent);
                        pdf.setFontSize(7); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(...s.accent);
                        pdf.text(String(s.title).toUpperCase(), x + 4, cy + 8);
                        pdf.setFontSize(5.5); pdf.setFont(pdfFont, 'normal'); pdf.setTextColor(140,123,110);
                        const dLines = wrapText(s.desc, x + 4, cw - 8);
                        dLines.slice(0, 2).forEach((l, li) => pdf.text(l, x + 4, cy + 13 + li * 3.5));

                        const rows = [
                            [L.scenLabelDebt,       PDE.formatCurrency(r.totalImpact), [220,38,38]],
                            [L.scenLabelInvestment,  s.cx > 0 ? PDE.formatCurrency(s.cx) : L.scenNoInvestment, [180,83,9]],
                            [L.scenLabelNet,         s.data.net >= 0 ? '+' + PDE.formatCurrency(s.data.net) : '-' + PDE.formatCurrency(Math.abs(s.data.net)), s.data.net >= 0 ? [22,163,74] : [220,38,38]],
                            [L.scenLabelPayback,     PDE.fmtMonths(s.data.pb), [180,83,9]],
                            ['IRR',                  s.data.irr !== null ? PDE.formatIRR(s.data.irr) : '\u2014', [124,58,237]],
                        ];
                        rows.forEach((row, ri) => {
                            const ry = cy + 22 + ri * 6;
                            pdf.setFontSize(5.5); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(140,123,110);
                            pdf.text(String(row[0]), x + 4, ry);
                            pdf.setFontSize(6); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(...row[2]);
                            const rv = String(row[1]);
                            if (pdf.getTextWidth(rv) > cw - 8) {
                                pdf.setFontSize(5); pdf.text(rv, x + cw - 4, ry, { align: 'right' });
                            } else {
                                pdf.text(rv, x + cw - 4, ry, { align: 'right' });
                            }
                        });
                    } catch (e) {
                        console.error('[PDF Scenario ' + i + ']', e, 'title:', s.title, 'cy:', cy);
                    }
                });
                cy += 58;
            }

            function renderSimpleSensitivity() {
                const sens = PDE.scenSensitivity(p);
                needSpace(12);
                drawRect(ML - 2, cy - 4, UW + 4, 10, [124,58,237]);
                pdf.setFontSize(10); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(255,255,255);
                pdf.text(L.sensViewsTitle.toUpperCase(), ML + 2, cy + 3);
                pdf.setFontSize(6); pdf.setFont(pdfFont, 'normal'); pdf.setTextColor(250,247,242);
                pdf.text(L.sensViewsSubtitle, ML + 2, cy + 9);
                cy += 16;

                const accents = {
                    conservative: [220,38,38],
                    base:         [180,83,9],
                    aggressive:   [22,163,74],
                };
                const signNum = n => (n >= 0 ? '+' : '-') + PDE.formatCurrency(Math.abs(n));
                const formatPb = pb => PDE.fmtMonths(pb);
                const formatIrr = irr => irr !== null ? PDE.formatIRR(irr) : '\u2014';

                const cw = (UW - 6) / 3;
                sens.forEach((v, i) => {
                    try {
                        const x = ML + i * (cw + 3);
                        needSpace(122);
                        const h = 120;
                        const m = v.metrics;
                        drawRect(x, cy, cw, h, [255,255,255], [214,201,184]);
                        drawRect(x, cy, cw, 2, accents[v.key]);
                        pdf.setFontSize(7); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(...accents[v.key]);
                        pdf.text(String(L[v.labelKey] || v.labelKey).toUpperCase(), x + 4, cy + 8);

                        const rows = [
                            [L.sensViewsDragLabel, PDE.formatCurrency(m.drag), [220,38,38]],
                            ['', '', [0,0,0]],
                            [L.scenarioBTitle, '', [124,58,237]],
                            [L.scenLabelNet,      signNum(m.scenB.net), m.scenB.net >= 0 ? [22,163,74] : [220,38,38]],
                            [L.scenLabelPayback,  formatPb(m.scenB.pb), [180,83,9]],
                            ['IRR',               formatIrr(m.scenB.irr), [124,58,237]],
                            ['', '', [0,0,0]],
                            [L.scenarioCTitle, '', [124,58,237]],
                            [L.scenLabelNet,      signNum(m.scenC.net), m.scenC.net >= 0 ? [22,163,74] : [220,38,38]],
                            [L.scenLabelPayback,  formatPb(m.scenC.pb), [180,83,9]],
                            ['IRR',               formatIrr(m.scenC.irr), [124,58,237]],
                        ];
                        rows.forEach((rowArr, ri) => {
                            const ry = cy + 13 + ri * 8.5;
                            if (rowArr[0] === '') return;
                            pdf.setFontSize(5); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(140,123,110);
                            pdf.text(String(rowArr[0]), x + 4, ry);
                            if (rowArr[1] === '') return;
                            pdf.setFontSize(6); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(...rowArr[2]);
                            const rv = String(rowArr[1]);
                            if (pdf.getTextWidth(rv) > cw - 8) pdf.setFontSize(5);
                            pdf.text(rv, x + cw - 4, ry, { align: 'right' });
                        });
                    } catch (e) {
                        console.error('[PDF Sensitivity View ' + i + ']', e, 'key:', v.key, 'cy:', cy);
                    }
                });
                cy += 126;
            }

            function renderSimpleLevers() {
                const sorted = leversRaw.slice().sort((a, b) => b.recovery - a.recovery);
                const top3 = sorted.slice(0, 3);
                const totalRecovery = top3.reduce((s, l) => s + l.recovery, 0);

                needSpace(8);
                drawRect(ML - 2, cy - 4, UW + 4, 10, [180,83,9]);
                pdf.setFontSize(10); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(255,255,255);
                pdf.text(L.block6Title.toUpperCase(), ML + 2, cy + 3);
                cy += 14;

                const cw = (UW - 6) / 3;
                top3.forEach((l, i) => {
                    try {
                        const x = ML + i * (cw + 3);
                        needSpace(42);
                        const h = 44;
                        drawRect(x, cy, cw, h, [255,255,255], [214,201,184]);
                        drawRect(x, cy, cw, 2, l.color);
                        pdf.setFontSize(5.5); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(...l.color);
                        pdf.text((L.rankLabels[i] || '#' + (i+1)).toUpperCase(), x + 4, cy + 6);
                        pdf.setFontSize(7); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(28,20,16);
                        pdf.text(String(l.label), x + 4, cy + 11);
                        pdf.setFontSize(9); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(...l.color);
                        pdf.text(PDE.formatCurrency(l.recovery), x + 4, cy + 20);
                        pdf.setFontSize(5); pdf.setFont(pdfFont, 'normal'); pdf.setTextColor(140,123,110);
                        pdf.text(L.estRecovery, x + 4, cy + 25);
                        pdf.setFontSize(5.5); pdf.setFont(pdfFont, 'normal'); pdf.setTextColor(74,63,53);
                        const effStr = L.effortLabel + ': ' + l.effort;
                        const tmStr = '\u23f1 ' + l.timeline;
                        pdf.text(effStr, x + 4, cy + 31);
                        pdf.text(tmStr, x + 4, cy + 36);
                    } catch (e) {
                        console.error('[PDF Lever ' + i + ']', e, 'label:', l.label, 'cy:', cy);
                    }
                });
                cy += 50;

                // Verdict bar
                const pbStr = PDE.fmtMonthsLocative(r.paybackMonths);
                const heroCapex   = (p.capex || 0) > 0 ? PDE.formatCurrencyWhole(p.capex) : '';
                const heroSavings = (r.potentialSavings || 0) > 0 ? PDE.formatCurrencyWhole(r.potentialSavings) : '';
                const capexBelowMin = heroCapex && heroSavings && !PDE.isMeaningfulCapex(p.capex, r.potentialSavings);
                let heroStr = '';
                if (heroCapex && heroSavings && capexBelowMin) {
                    heroStr = L.verdictHeroBelowMin(heroCapex, heroSavings);
                } else if (heroCapex && heroSavings && isFinite(r.paybackMonths) && r.paybackMonths > 0) {
                    heroStr = L.verdictHero(heroCapex, heroSavings, pbStr);
                } else if (heroCapex && heroSavings) {
                    heroStr = L.verdictHeroNoReturn(heroCapex, heroSavings);
                } else if (!heroCapex && heroSavings) {
                    heroStr = L.verdictHeroNoInvest(heroSavings);
                }
                heroStr = heroStr.replace(/<[^>]+>/g, '');
                let heroRows = 0;
                if (heroStr) {
                    pdf.setFontSize(7); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(28,20,16);
                    const heroLines = wrapText(heroStr, ML + 6, UW - 12);
                    heroLines.slice(0, 2).forEach(function (ln, i) { pdf.text(ln, ML + 6, cy + 5 + i * 3.6); });
                    heroRows = Math.min(heroLines.length, 2);
                }
                const barH   = 15 + heroRows * 4;
                const statsY = cy + 5 + heroRows * 3.6;
                needSpace(barH + 2);
                drawRect(ML, cy, UW, barH, [255,255,255], [214,201,184]);
                pdf.setFontSize(6); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(180,83,9);
                pdf.text(L.verdictRecoveryLabel.toUpperCase(), ML + 6, statsY);
                pdf.setFontSize(10); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(28,20,16);
                pdf.text(PDE.formatCurrency(totalRecovery), ML + 6, statsY + 7);
                pdf.setFontSize(6); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(180,83,9);
                pdf.text(L.verdictPaybackLabel.toUpperCase(), ML + UW / 2, statsY);
                pdf.setFontSize(10); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(28,20,16);
                pdf.text(capexBelowMin ? '\u2014' : pbStr, ML + UW / 2, statsY + 7);
                pdf.setFontSize(5.5); pdf.setFont(pdfFont, fontItalic); pdf.setTextColor(140,123,110);
                const noteLines = wrapText(L.verdictNote, ML + 6, UW - 12);
                pdf.text(noteLines[0] || '', ML + 6, statsY + 13);
                cy += barH + 2;
            }

            function renderSimpleDora() {
                const doraMetrics = [
                    { metric: L.doraMetricLeadTime, value: L.doraLeadTimeDesc(PDE.clamp('q2')), bandDesc: L.doraLeadTimeBand, result: PDE.getDoraBand('leadTime', PDE.clamp('q2')) },
                    { metric: L.doraMetricManual,   value: L.doraManualDesc(PDE.clamp('q1')),   bandDesc: L.doraManualBand,   result: PDE.getDoraBand('manual', PDE.clamp('q1')) },
                    { metric: L.doraMetricErrors,   value: L.doraErrorsDesc(PDE.clamp('q5')),   bandDesc: L.doraErrorsBand,   result: PDE.getDoraBand('errors', PDE.clamp('q5')) },
                ];
                needSpace(8);
                drawRect(ML - 2, cy - 4, UW + 4, 10, [180,83,9]);
                pdf.setFontSize(10); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(255,255,255);
                pdf.text(L.doraTitle.toUpperCase(), ML + 2, cy + 3);
                cy += 14;

                const colW = UW / 4;
                drawRect(ML, cy, UW, 7, [74,63,53]);
                pdf.setFontSize(5.5); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(255,255,255);
                pdf.text('Metric', ML + 2, cy + 5);
                pdf.text('Your Value', ML + colW + 2, cy + 5);
                pdf.text(L.doraBandHeader, ML + colW * 2 + 2, cy + 5);
                pdf.text('Status', ML + colW * 3 + 2, cy + 5);
                cy += 10;

                doraMetrics.forEach((m, i) => {
                    needSpace(8);
                    drawRect(ML, cy, UW, 8, i % 2 === 0 ? [255,255,255] : [245,240,232]);
                    pdf.setFontSize(6); pdf.setFont(pdfFont, 'normal'); pdf.setTextColor(28,20,16);
                    pdf.text(String(m.metric), ML + 2, cy + 5.5);
                    pdf.text(String(m.value), ML + colW + 2, cy + 5.5);
                    pdf.setFontSize(5.5); pdf.setTextColor(140,123,110);
                    pdf.text(String(m.bandDesc), ML + colW * 2 + 2, cy + 5.5);
                    pdf.setFontSize(6); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor.apply(pdf, m.result.color === 'var(--green)' ? [22,163,74] : m.result.color === 'var(--yellow)' ? [202,138,4] : m.result.color === 'var(--orange)' ? [234,88,12] : m.result.color === 'var(--red)' ? [220,38,38] : [180,83,9]);
                    pdf.text(String(m.result.band), ML + colW * 3 + 2, cy + 5.5);
                    cy += 10;
                });
                cy += 4;
            }

            function renderSimpleRoadmap() {
                const sorted = leversRaw.slice().sort((a, b) => b.recovery - a.recovery).slice(0, 3);
                const ROADMAP_TASKS = PDE.getRoadmapTasks();
                const phases = ['phase1', 'phase2', 'phase3'];
                const merged = { phase1: [], phase2: [], phase3: [] };
                const MAX_PER_PHASE = 4;
                sorted.forEach(l => {
                    if (!l.key || !ROADMAP_TASKS[l.key]) return;
                    phases.forEach(ph => {
                        (ROADMAP_TASKS[l.key][ph] || []).forEach(t => {
                            if (merged[ph].length < MAX_PER_PHASE) merged[ph].push(t);
                        });
                    });
                });

                needSpace(8);
                drawRect(ML - 2, cy - 4, UW + 4, 10, [180,83,9]);
                pdf.setFontSize(10); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(255,255,255);
                pdf.text(L.roadmapTitle.toUpperCase(), ML + 2, cy + 3);
                cy += 14;

                const phaseMeta = [
                    { title: L.roadmapPhase1, sub: L.roadmapPhase1Sub },
                    { title: L.roadmapPhase2, sub: L.roadmapPhase2Sub },
                    { title: L.roadmapPhase3, sub: L.roadmapPhase3Sub },
                ];
                const cw = (UW - 6) / 3;
                let maxH = 0;
                phaseMeta.forEach((pm, i) => {
                    const x = ML + i * (cw + 3);
                    const tasks = merged[phases[i]] || [];
                    const h = 14 + tasks.length * 6;
                    if (h > maxH) maxH = h;
                    needSpace(h);
                    drawRect(x, cy, cw, h, [255,255,255], [214,201,184]);
                    drawRect(x, cy, cw, 2, [180,83,9]);
                    pdf.setFontSize(6); pdf.setFont(pdfFont, 'bold'); pdf.setTextColor(180,83,9);
                    pdf.text(String(pm.title).toUpperCase(), x + 4, cy + 6);
                    pdf.setFontSize(5.5); pdf.setFont(pdfFont, 'normal'); pdf.setTextColor(140,123,110);
                    pdf.text(String(pm.sub), x + 4, cy + 10);
                    tasks.forEach((t, ti) => {
                        pdf.setFontSize(5.5); pdf.setFont(pdfFont, 'normal'); pdf.setTextColor(74,63,53);
                        const tLines = wrapText('\u2610 ' + String(t), x + 4, cw - 8);
                        tLines.slice(0, 1).forEach((tl, tli) => pdf.text(tl, x + 4, cy + 16 + ti * 6 + tli * 5));
                    });
                });
                cy += maxH + 8;
            }

            // Render results
            console.debug('[PDF] Section: Results | cy =', cy);
            try { renderSimpleResults(); } catch (e) { console.error('[PDF Sec: Results]', e); }

            console.debug('[PDF] Section: Scenarios | cy =', cy);
            try { renderSimpleScenarios(); } catch (e) { console.error('[PDF Sec: Scenarios]', e); }

            console.debug('[PDF] Section: Sensitivity Views | cy =', cy);
            try { renderSimpleSensitivity(); } catch (e) { console.error('[PDF Sec: Sensitivity Views]', e); }

            console.debug('[PDF] Section: Levers | cy =', cy);
            try { renderSimpleLevers(); } catch (e) { console.error('[PDF Sec: Levers]', e); }

            if (mode === 'full') {
                console.debug('[PDF] Section: DORA | cy =', cy);
                try { renderSimpleDora(); } catch (e) { console.error('[PDF Sec: DORA]', e); }

                console.debug('[PDF] Section: Roadmap | cy =', cy);
                try { renderSimpleRoadmap(); } catch (e) { console.error('[PDF Sec: Roadmap]', e); }
            }

            // Methodology note
            needSpace(14);
            pdf.setFontSize(7); pdf.setFont(pdfFont, fontItalic); pdf.setTextColor(140,123,110);
            const methNote = L.methodologyDesktopNote;
            const methLines = wrapText(methNote, ML, UW);
            methLines.forEach((l, li) => pdf.text(l, ML, cy + li * 4));
            cy += methLines.length * 4 + 6;

            pdf.save(filename);
        } else {
            // Desktop path — html2canvas screenshots
            const mainIds = mode === 'simple'
                ? ['pdf-block-3','scenario-compare','sens-views']
                : ['pdf-block-3','scenario-compare','sens-views','pdf-block-sa','pdf-block-4','pdf-block-5','pdf-block-6'];

            async function captureBlock(id) {
                const el = document.getElementById(id);
                if (!el || !el.offsetHeight) return;

                const swaps = [];
                el.querySelectorAll('input').forEach(input => {
                    const proxy = document.createElement('div');
                    proxy.style.cssText = window.getComputedStyle(input).cssText;
                    proxy.style.display = 'flex';
                    proxy.style.alignItems = 'center';
                    proxy.style.boxSizing = 'border-box';
                    proxy.style.color = '#1C1410';
                    proxy.style.fontWeight = '700';
                    proxy.style.fontSize = '0.875rem';
                    proxy.style.background = '#FAF7F2';
                    proxy.style.border = '1px solid #D6C9B8';
                    proxy.style.borderRadius = '6px';
                    proxy.style.padding = '0.5rem 0.75rem';
                    proxy.style.width = input.offsetWidth + 'px';
                    proxy.style.height = input.offsetHeight + 'px';
                    proxy.style.minHeight = '36px';
                    proxy.textContent = input.value;
                    input.parentNode.insertBefore(proxy, input);
                    input.style.display = 'none';
                    swaps.push({ input, proxy });
                });

                const savedPb = el.style.paddingBottom;
                el.style.paddingBottom = '3px';

                const nodeList = Array.from(el.querySelectorAll('*'));
                const savedStyles = nodeList.map(n =>
                    n instanceof HTMLElement ? n.style.cssText : undefined
                );
                PDE.resolveCSSVarsOnElement(el);

                const canvas = await html2canvas(el, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#F5F0E8',
                    windowWidth: 1400,
                    windowHeight: document.documentElement.scrollHeight,
                    onclone: async (clonedDoc) => {
                        const cs = getComputedStyle(document.documentElement);
                        const vars = [
                            '--bg-base','--bg-surface','--bg-elevated','--bg-hover',
                            '--bg-input','--border','--border-focus','--border-subtle',
                            '--text-primary','--text-secondary','--text-muted','--text-label',
                            '--accent','--accent-bright','--accent-glow','--accent-dim',
                            '--red','--orange','--purple','--green','--yellow',
                        ];
                        const decls = vars
                            .map(v => `${v}:${cs.getPropertyValue(v).trim() || 'inherit'}`)
                            .join(';');

                        const fontFaceCSS = PDE.buildFontFaceCSS();

                        const style = clonedDoc.createElement('style');
                        style.textContent = `:root{${decls}}\n${fontFaceCSS}`;
                        clonedDoc.head.insertBefore(style, clonedDoc.head.firstChild);

                        for (const sheet of clonedDoc.styleSheets) {
                            try {
                                for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
                                    const rule = sheet.cssRules[i];
                                    if (rule.type === CSSRule.IMPORT_RULE &&
                                        rule.href?.includes('fonts.googleapis.com')) {
                                        sheet.deleteRule(i);
                                    }
                                }
                            } catch { /* empty */ }
                        }
                    }
                });

                nodeList.forEach((node, i) => {
                    if (node instanceof HTMLElement && savedStyles[i] !== undefined) {
                        node.style.cssText = savedStyles[i];
                    }
                });
                swaps.forEach(({ input, proxy }) => {
                    input.style.display = '';
                    proxy.remove();
                });
                el.style.paddingBottom = savedPb;

                const imgData = canvas.toDataURL('image/jpeg', 0.9);
                const bH = (canvas.height * UW) / canvas.width;

                if (bH > PH - MT - 10) {
                    if (cy > MT) newPage();
                    const sH = PH - MT - 10;
                    const sW = (canvas.width * sH) / canvas.height;
                    pdf.addImage(imgData, 'JPEG', ML + (UW - sW) / 2, cy, sW, sH);
                    newPage();
                    cy = MT;
                } else {
                    if (cy + bH > PH - 10) { newPage(); cy = MT; }
                    pdf.addImage(imgData, 'JPEG', ML, cy, UW, bH);
                    cy += bH + 5;
                }
            }

            for (const id of mainIds) await captureBlock(id);

            // Methodology page (full only)
            if (mode === 'full') {
                newPage();
                const methodologySection = document.getElementById('methodologySection');
                const wasOpen = methodologySection ? methodologySection.open : false;
                if (methodologySection) methodologySection.open = true;
                await new Promise(r => requestAnimationFrame(r));
                const methodologyIds = ['methodology-header','methodology-about','methodology-1','methodology-2','methodology-3','methodology-4','methodology-5','methodology-6','methodology-7','methodology-8','methodology-9','methodology-10','methodology-11','methodology-12','methodology-13','methodology-14','methodology-15','methodology-16','methodology-footer'];
                for (const id of methodologyIds) await captureBlock(id);
                if (methodologySection) methodologySection.open = wasOpen;
            }

            pdf.save(filename);
        }
    } catch (err) {
        console.error('PDF export error:', err);
        const msg = PDE.currentLang === 'pl'
            ? 'Eksport PDF nie powi\u00f3d\u0142 si\u0119: ' + err.message
            : 'PDF export failed: ' + err.message;
        alert(msg);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = PDE.t(finishedKey); }
    }
};

// ── Font cache ──
const FONT_CACHE_KEY = 'fontCache_v1';
const _fontCache = new Map();

const _FONT_ALLOWED_FAMILIES = { 'Space Grotesk': true, 'Inter': true };
const _FONT_ALLOWED_STYLES   = { 'normal': true, 'italic': true, 'oblique': true };
const _FONT_ALLOWED_FMTS     = { 'woff2': true, 'woff': true, 'truetype': true };
const _FONT_B64_RE           = /^[A-Za-z0-9+/]+=*$/;
const _FONT_B64_MAX_LEN      = 700000;

PDE.validateFontFace = function validateFontFace(f) {
    if (!f || typeof f !== 'object')                          return null;
    if (!_FONT_ALLOWED_FAMILIES[f.family])                    return null;
    if (!/^\d+$/.test(String(f.weight)))                      return null;
    const w = parseInt(f.weight, 10);
    if (w < 100 || w > 900 || w % 100 !== 0)                  return null;
    if (!_FONT_ALLOWED_STYLES[f.style])                       return null;
    if (!_FONT_ALLOWED_FMTS[f.fmt])                           return null;
    if (typeof f.b64 !== 'string')                            return null;
    if (f.b64.length === 0 || f.b64.length > _FONT_B64_MAX_LEN) return null;
    if (!_FONT_B64_RE.test(f.b64))                            return null;
    return { family: f.family, weight: String(w), style: f.style,
             fmt: f.fmt, b64: f.b64 };
};

(function seedFontCacheFromStorage() {
    try {
        const stored = localStorage.getItem(FONT_CACHE_KEY);
        if (!stored) return;
        const faces = JSON.parse(stored);
        if (!Array.isArray(faces)) return;
        faces.forEach(raw => {
            const f = PDE.validateFontFace(raw);
            if (!f) return;
            _fontCache.set(`${f.family}||${f.weight}||${f.style}`, f);
        });
    } catch { /* empty */ }
})();

PDE.prefetchFontsToBase64 = async function prefetchFontsToBase64() {
    await document.fonts.ready;

    const urlsByRule = [];
    for (const sheet of document.styleSheets) {
        let rules;
        try { rules = sheet.cssRules; } catch { /* empty */ continue; }
        for (const rule of rules) {
            if (rule.type !== CSSRule.FONT_FACE_RULE) continue;
            const family = rule.style.getPropertyValue('font-family')
                               .replace(/['"]/g, '').trim();
            if (!['Space Grotesk', 'Inter'].includes(family)) continue;
            const weight = rule.style.getPropertyValue('font-weight').trim();
            const style  = rule.style.getPropertyValue('font-style').trim() || 'normal';
            const key    = `${family}||${weight}||${style}`;
            if (_fontCache.has(key)) continue;
            const srcVal = rule.style.getPropertyValue('src');
            const woff2M = srcVal.match(/url\(["']?([^"')]+\.woff2)["']?\)/);
            const anyM   = srcVal.match(/url\(["']?([^"')]+)["']?\)/);
            const url    = (woff2M || anyM)?.[1];
            if (url) urlsByRule.push({ family, weight, style, url });
        }
    }

    if (urlsByRule.length === 0) return;

    await Promise.allSettled(urlsByRule.map(async ({ family, weight, style, url }) => {
        const key = `${family}||${weight}||${style}`;
        try {
            const resp = await fetch(url, { mode: 'cors', cache: 'force-cache' });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const buf = await resp.arrayBuffer();
            const bytes = new Uint8Array(buf);
            const CHUNK = 8192;
            let binary = '';
            for (let i = 0; i < bytes.length; i += CHUNK) {
                binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
            }
            const b64 = btoa(binary);
            const fmt = url.endsWith('.woff2') ? 'woff2'
                      : url.endsWith('.woff')  ? 'woff' : 'truetype';
            _fontCache.set(key, { b64, fmt, family, weight, style });
        } catch { /* empty */ }
    }));

    try {
        const faces = Array.from(_fontCache.values());
        localStorage.setItem(FONT_CACHE_KEY, JSON.stringify(faces));
    } catch { /* empty */ }
};

PDE.buildFontFaceCSS = function buildFontFaceCSS() {
    let css = '';
    for (const raw of _fontCache.values()) {
        const f = PDE.validateFontFace(raw);
        if (!f) continue;
        css += `@font-face{font-family:'${f.family}';font-weight:${f.weight};`
             + `font-style:${f.style};`
             + `src:url('data:font/${f.fmt};base64,${f.b64}') format('${f.fmt}');}\n`;
    }
    return css;
};
