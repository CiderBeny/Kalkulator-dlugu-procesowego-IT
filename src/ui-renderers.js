// ═══════════════════════════════════════════════════════════════
// UI renderers — calculate(), charts, recommendations, roadmap,
// scenarios, DORA benchmark. All write to DOM.
// ═══════════════════════════════════════════════════════════════
window.PDE = window.PDE || {};

PDE.calculate = function calculate() {
    const p = PDE.getParams();

    document.getElementById('autoLevelVal').textContent = Math.round(p.autoLevel);
    document.getElementById('erosionRateVal').textContent  = p.erosionRate.toFixed(2);
    document.getElementById('discountRateVal').textContent = Math.round(p.discountRate * 100);
    document.getElementById('timeHorizonVal').textContent  = p.horizonYears;
    document.getElementById('leverAutomationVal').textContent = Math.round(p.leverAuto * 100);
    document.getElementById('leverRiskVal').textContent    = Math.round(p.leverRisk * 100);
    document.getElementById('scenCAutoLevelVal').textContent = Math.round(p.scenCAutoLevel * 100);
    document.getElementById('scenCCapexMultVal').textContent = p.scenCCapexMult.toFixed(1);
    document.getElementById('annualHoursVal').textContent = p.annualHours;
    document.getElementById('leverInnovationVal').textContent = Math.round(p.leverInnovation * 100);
    document.getElementById('leverManagementVal').textContent = Math.round(p.leverManagement * 100);
    document.getElementById('leverTurnoverVal').textContent = Math.round(p.leverTurnover * 100);
    document.getElementById('contextPremiumVal').textContent = Math.round(p.contextPremium * 100);
    document.getElementById('taxRateVal').textContent = Math.round(p.taxRate);
    document.getElementById('correlationStrengthVal').textContent = p.correlationMultiplier.toFixed(2);
    document.getElementById('corrQ3Q1Val').textContent = p.corrQ3Q1;
    document.getElementById('corrQ1Q5Val').textContent = p.corrQ1Q5.toFixed(1);
    document.getElementById('corrQ1Q7Val').textContent = p.corrQ1Q7;
    document.getElementById('corrQ3Q7Val').textContent = p.corrQ3Q7;
    document.getElementById('riskSecurityWeightVal').textContent = p.riskSecurityWeight.toFixed(2);
    document.getElementById('riskRegulatoryWeightVal').textContent = p.riskRegulatoryWeight.toFixed(2);
    document.getElementById('mcIterationsVal').textContent = p.mcIterations;
    document.getElementById('mcConfidenceVal').textContent = Math.round(p.mcConfidence * 100);
    document.getElementById('mcUncertaintyPctVal').textContent = Math.round(p.mcUncertaintyPct * 100);
    document.getElementById('mcMttrUncertaintyPctVal').textContent = Math.round(p.mcMttrUnc * 100);

    const r = PDE.computeModel(p);
    PDE._lastResult = r;

    let mcResults = null;

    if (p.probabilisticEnabled) {
        // Terminate any previous worker
        if (PDE._mcWorker) PDE._mcWorker.terminate();

        // Show progress bar + warning
        const prEl = document.getElementById('mcProgress');
        if (prEl) prEl.style.display = 'block';
        const wrEl = document.getElementById('mcWarning');
        if (wrEl) wrEl.style.display = 'block';

        // Start worker
        PDE._mcWorker = new Worker('src/mc-worker.js');
        PDE._mcWorker.postMessage({
            baseParams: p,
            opts: {
                iterations: p.mcIterations,
                confidenceLevel: p.mcConfidence,
                uncertaintyPct: p.mcUncertaintyPct,
                mttrUncertaintyPct: p.mcMttrUnc,
            },
            seed: 42,
        });

        PDE._mcWorker.onmessage = function (e) {
            const d = e.data;
            if (d.type === 'progress') {
                const pct = Math.round(d.current / d.total * 100);
                const fill = document.getElementById('mcProgressFill');
                const txt = document.getElementById('mcProgressText');
                if (fill) fill.style.width = pct + '%';
                if (txt) txt.textContent = d.current + ' / ' + d.total + ' (' + pct + '%)';
            } else if (d.type === 'result') {
                mcResults = d.data;
                const keyMap = {
                    statWaste: 'cWaste', statRisk: 'cRisk', statOpp: 'cOppDirect',
                    totalImpact: 'totalImpact',
                    npvTotalDebt: 'npvTotalDebt', statNet: 'netDebt',
                };
                Object.keys(keyMap).forEach(function (id) {
                    const mk = keyMap[id];
                    const mc = mcResults[mk];
                    if (mc) {
                        document.getElementById(id).textContent =
                            PDE.formatCurrency(mc.median) + ' [' + PDE.formatCurrency(mc.p5) + ' \u2013 ' + PDE.formatCurrency(mc.p95) + ']';
                    }
                });
                const irrMc = mcResults.irr;
                if (irrMc && irrMc.median !== undefined) {
                    document.getElementById('statIrr').textContent =
                        (irrMc.median >= 0.999 ? '>99.9%' : (irrMc.median * 100).toFixed(1) + '%')
                        + ' [' + (irrMc.p5 * 100).toFixed(1) + '% \u2013 ' + (irrMc.p95 * 100).toFixed(1) + '%]';
                }
                const pbMc = mcResults.paybackMonths;
                if (pbMc && pbMc.median !== undefined) {
                    const medianPb = isFinite(pbMc.median) ? pbMc.median.toFixed(1) + ' mo' : '\u221E';
                    const p5Pb = isFinite(pbMc.p5) ? pbMc.p5.toFixed(1) + ' mo' : '\u221E';
                    const p95Pb = isFinite(pbMc.p95) ? pbMc.p95.toFixed(1) + ' mo' : '\u221E';
                    document.getElementById('statIrr').textContent += ' | PB: ' + medianPb + ' [' + p5Pb + ' \u2013 ' + p95Pb + ']';
                }
                const pr2 = document.getElementById('mcProgress');
                if (pr2) pr2.style.display = 'none';
            } else if (d.type === 'error') {
                const pr3 = document.getElementById('mcProgress');
                if (pr3) pr3.style.display = 'none';
            }
        };
    } else {
        // Terminate worker and hide UI
        if (PDE._mcWorker) { PDE._mcWorker.terminate(); PDE._mcWorker = null; }
        const pr4 = document.getElementById('mcProgress');
        if (pr4) pr4.style.display = 'none';
        const wr2 = document.getElementById('mcWarning');
        if (wr2) wr2.style.display = 'none';

        document.getElementById('statWaste').textContent   = PDE.formatCompactCurrency(r.cWaste);
        document.getElementById('statRisk').textContent    = PDE.formatCompactCurrency(r.cRisk);
        document.getElementById('statOpp').textContent     = PDE.formatCompactCurrency(r.cOppDirect);
        document.getElementById('totalImpact').textContent = PDE.formatCompactCurrency(r.totalImpact);
        document.getElementById('npvTotalDebt').textContent = PDE.formatCompactCurrency(r.npvTotalDebt);
        document.getElementById('statIrr').textContent     = r.irr !== null ? (r.irr >= 0.999 ? '>99.9%' : (r.irr * 100).toFixed(1) + '%') : '\u2014';
        document.getElementById('statNet').textContent     = PDE.formatCompactCurrency(r.netDebt);
    }

    document.getElementById('q9Val').textContent       = document.getElementById('q9').value;
    document.getElementById('q3Val').textContent       = document.getElementById('q3').value;

    PDE.updateSliderFills();

    PDE.updateCharts(r.totalAnnualHrs, r.manualAnnualHrs, r.chasingAnnualHrs, r.cWaste, p.capex, r.potentialSavings, p.riskLevel, p.manualPercent, p.autoLevel / 100);
    PDE.updateRecs(r.cWaste, r.cRisk, r.cOppDirect, r.paybackMonths, r.leverAuto, r.leverRisk);
    PDE.updateDoraBenchmark();
    PDE.updateScenarios(r.cWaste, r.cRisk, p.capex, p.autoLevel / 100, r.totalImpact, p.discountRate, p.horizonYears, r.scenCAutoLevel, r.scenCCapexMult);
    const sensResult = PDE.runSensitivity(p);
    PDE.renderTornado(sensResult);
    PDE.updateCalibration(r);
};

PDE.updateRecs = function updateRecs(cw, cr, co, pb, leverAuto, leverRisk) {
    const L = PDE.TRANSLATIONS[PDE.currentLang];
    if (leverAuto === undefined) leverAuto = PDE.readAdvanced('leverAutomation', PDE.COEFFICIENTS.LEVER_AUTOMATION_DEFAULT, 100);
    if (leverRisk === undefined) leverRisk = PDE.readAdvanced('leverRisk', PDE.COEFFICIENTS.LEVER_RISK_DEFAULT, 100);

    const engine = document.getElementById('recEngine');
    let html = `<ul class="list-disc ml-5 space-y-2">`;
    if (cw > PDE.COEFFICIENTS.REC_AUTO_MIN_WASTE)  html += `<li>${L.recAutomation(Math.round(cw * leverAuto))}</li>`;
    if (cr > PDE.COEFFICIENTS.REC_RISK_MIN_EXPOSURE) html += `<li>${L.recRisk()}</li>`;
    if (co > PDE.COEFFICIENTS.REC_INNOVATION_MIN) html += `<li>${L.recInnovation(Math.round(co * PDE.COEFFICIENTS.LEVER_INNOVATION))}</li>`;
    html += `<li class="mt-3 p-3 font-bold italic" style="background:var(--accent-dim);border-left:4px solid var(--accent);color:var(--accent);border-radius:0 6px 6px 0;">${PDE.esc(L.recVerdict(!isFinite(pb) || pb <= 0 ? L.scenInfinity : (pb < 1 ? '< 1' : pb.toFixed(1))))}</li>`;
    engine.innerHTML = html + `</ul>`;

    const ICONS = {
        automation: `<svg style="width:20px;height:20px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>`,
        risk:       `<svg style="width:20px;height:20px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
        innovation: `<svg style="width:20px;height:20px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`,
        mgmt:       `<svg style="width:20px;height:20px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"/></svg>`,
        turnover:   `<svg style="width:20px;height:20px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>`,
    };

    const turnover     = parseFloat(document.getElementById('q10').value) || 0;
    const manualPct    = parseFloat(document.getElementById('q1').value)  || 0;
    const teamSize     = parseFloat(document.getElementById('teamSize').value) || 1;
    const rate         = PDE.currencyToUsd(parseFloat(document.getElementById('q6').value) || 0);
    const turnoverCost = (turnover / 100) * teamSize * rate * PDE.COEFFICIENTS.TURNOVER_REF_HOURS;

    const effortMap = {
        [L.effortLow]:    'var(--green)',
        [L.effortMedium]: 'var(--amber)',
        [L.effortHigh]:   'var(--red)',
    };

    const levers = [
        { key:'automation', title: L.leverAutomationTitle, recovery: Math.round(cw * leverAuto),  effort: L.effortMedium, timeline: '2\u20134 ' + L.verdictPaybackUnit, color:'var(--red)',    icon: ICONS.automation, detail: L.leverAutomationDetail(Math.round(manualPct * PDE.COEFFICIENTS.AUTOMATABLE_SHARE)) },
        { key:'risk',       title: L.leverRiskTitle,       recovery: Math.round(cr * leverRisk),        effort: L.effortLow,    timeline: '1\u20132 ' + L.verdictPaybackUnit, color:'var(--orange)', icon: ICONS.risk,       detail: L.leverRiskDetail() },
        { key:'innovation', title: L.leverInnovationTitle, recovery: Math.round(co * PDE.COEFFICIENTS.LEVER_INNOVATION), effort: L.effortHigh, timeline: '3\u20136 ' + L.verdictPaybackUnit, color:'var(--purple)', icon: ICONS.innovation, detail: L.leverInnovationDetail() },
        { key:'mgmt',       title: L.leverMgmtTitle,       recovery: Math.round(cw * PDE.COEFFICIENTS.LEVER_MANAGEMENT), effort: L.effortLow,    timeline: '1 '   + L.verdictPaybackUnit,  color:'var(--cyan)',   icon: ICONS.mgmt,       detail: L.leverMgmtDetail() },
        { key:'turnover',   title: L.leverTurnoverTitle,   recovery: Math.round(turnoverCost * PDE.COEFFICIENTS.LEVER_TURNOVER), effort: L.effortMedium,timeline: '3\u20135 ' + L.verdictPaybackUnit, color:'var(--green)',  icon: ICONS.turnover,   detail: L.leverTurnoverDetail() },
    ];

    levers.sort((a, b) => b.recovery - a.recovery);
    const top3 = levers.slice(0, 3);
    const totalRecovery = top3.reduce((s, l) => s + l.recovery, 0);
    const rankLabels = L.rankLabels;

    PDE.updateRoadmap(top3);

    let cards = '';
    top3.forEach((l, i) => {
        const badgeColor = effortMap[l.effort] || 'var(--green)';
        cards += `
        <div style="background:var(--bg-elevated);border:1px solid var(--border);border-top:3px solid ${l.color};border-radius:10px;padding:1.1rem;display:flex;flex-direction:column;gap:0.6rem;">
            <div style="display:flex;align-items:center;gap:8px;">
                <span style="color:${l.color}">${l.icon}</span>
                <span style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:${l.color};">${PDE.esc(rankLabels[i])}</span>
            </div>
            <p style="font-family:'Space Grotesk',sans-serif;font-size:0.85rem;font-weight:700;color:var(--text-primary);margin:0;">${PDE.esc(l.title)}</p>
            <p style="font-size:1.6rem;font-weight:900;color:${l.color};margin:0;line-height:1;">${PDE.formatCompactCurrency(l.recovery)}</p>
            <p style="font-size:0.6rem;color:var(--text-muted);margin:0;">${PDE.esc(L.estRecovery)}</p>
            <p style="font-size:0.7rem;color:var(--text-secondary);line-height:1.4;margin:0;">${PDE.esc(l.detail)}</p>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:auto;padding-top:6px;">
                <span style="font-size:0.58rem;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--bg-input);color:${badgeColor};border:1px solid ${badgeColor};">${PDE.esc(L.effortLabel)}: ${PDE.esc(l.effort)}</span>
                <span style="font-size:0.58rem;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--bg-input);color:var(--text-secondary);border:1px solid var(--border);">\u23f1 ${PDE.esc(l.timeline)}</span>
            </div>
        </div>`;
    });
    document.getElementById('leverCards').innerHTML = cards;

    document.getElementById('verdictBar').innerHTML = `
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:1rem;">
            <div>
                <p style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--accent);margin:0 0 4px;">${PDE.esc(L.verdictRecoveryLabel)}</p>
                <p style="font-size:1.5rem;font-weight:900;color:var(--text-primary);margin:0;">${PDE.formatCompactCurrency(totalRecovery)}</p>
            </div>
            <div style="text-align:right;">
                <p style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--accent);margin:0 0 4px;">${PDE.esc(L.verdictPaybackLabel)}</p>
                <p style="font-size:1.5rem;font-weight:900;color:var(--text-primary);margin:0;">${!isFinite(pb) || pb <= 0 ? PDE.esc(L.scenInfinity) : (pb < 1 ? '< 1' : pb.toFixed(1))} ${PDE.esc(L.verdictPaybackUnit)}</p>
            </div>
            <div style="flex:1;min-width:200px;">
                <p style="font-size:0.7rem;color:var(--text-secondary);margin:0;font-style:italic;">${PDE.esc(L.verdictNote)}</p>
            </div>
        </div>`;
};

PDE.getRoadmapTasks = function getRoadmapTasks() {
    const L = PDE.TRANSLATIONS[PDE.currentLang];
    return {
        automation: { phase1: L.rmAutomation_p1, phase2: L.rmAutomation_p2, phase3: L.rmAutomation_p3 },
        risk:       { phase1: L.rmRisk_p1,       phase2: L.rmRisk_p2,       phase3: L.rmRisk_p3 },
        innovation: { phase1: L.rmInnovation_p1, phase2: L.rmInnovation_p2, phase3: L.rmInnovation_p3 },
        mgmt:       { phase1: L.rmMgmt_p1,       phase2: L.rmMgmt_p2,       phase3: L.rmMgmt_p3 },
        turnover:   { phase1: L.rmTurnover_p1,   phase2: L.rmTurnover_p2,   phase3: L.rmTurnover_p3 },
    };
};

PDE.updateRoadmap = function updateRoadmap(top3) {
    const L  = PDE.TRANSLATIONS[PDE.currentLang];
    const MAX_PER_PHASE = 4;
    const ROADMAP_TASKS = PDE.getRoadmapTasks();

    const phases = ['phase1', 'phase2', 'phase3'];
    const merged = { phase1: [], phase2: [], phase3: [] };

    top3.forEach(lever => {
        const tasks = ROADMAP_TASKS[lever.key];
        if (!tasks) return;
        phases.forEach(ph => {
            tasks[ph].forEach(task => {
                if (merged[ph].length < MAX_PER_PHASE) {
                    merged[ph].push({ task, color: lever.color });
                }
            });
        });
    });

    const phasesMeta = [
        { id: 'phase1', titleKey: 'roadmapPhase1', subKey: 'roadmapPhase1Sub', accent: 'var(--accent)'  },
        { id: 'phase2', titleKey: 'roadmapPhase2', subKey: 'roadmapPhase2Sub', accent: 'var(--purple)' },
        { id: 'phase3', titleKey: 'roadmapPhase3', subKey: 'roadmapPhase3Sub', accent: 'var(--green)'  },
    ];

    let html = '';
    phasesMeta.forEach(meta => {
        const tasks = merged[meta.id];
        const taskRows = tasks.map(({ task, color }) =>
            `<li style="display:flex;align-items:flex-start;gap:6px;margin-bottom:0.45rem;">
                <span style="color:${color};font-size:0.75rem;line-height:1.4;flex-shrink:0;">\u2610</span>
                <span style="font-size:0.72rem;color:var(--text-secondary);line-height:1.4;">${PDE.esc(task)}</span>
            </li>`
        ).join('');

        html += `
        <div style="background:var(--bg-elevated);border:1px solid var(--border);border-top:3px solid ${meta.accent};border-radius:var(--radius-md);padding:1rem;">
            <p style="font-family:'Space Grotesk',sans-serif;font-size:0.62rem;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:${meta.accent};margin:0 0 2px;">${PDE.esc(L[meta.titleKey])}</p>
            <p style="font-family:'Space Grotesk',sans-serif;font-size:0.8rem;font-weight:700;color:var(--text-primary);margin:0 0 0.75rem;">${PDE.esc(L[meta.subKey])}</p>
            <ul style="list-style:none;margin:0;padding:0;">${taskRows || '<li style="font-size:0.72rem;color:var(--text-muted);">No tasks for selected levers.</li>'}</ul>
        </div>`;
    });

    document.getElementById('roadmapGrid').innerHTML = html;
};

PDE.updateScenarios = function updateScenarios(cWaste, cRisk, capex, autoLevel, totalImpact, dr, ny, scenCAutoLevel, scenCCapexMult) {
    const L = PDE.TRANSLATIONS[PDE.currentLang];
    const fmt = (n) => PDE.formatCompactCurrency(Math.abs(n));
    if (dr === undefined) dr = PDE.readAdvanced('discountRate', PDE.COEFFICIENTS.DISCOUNT_RATE_DEFAULT, 100);
    if (ny === undefined) ny = PDE.readAdvanced('timeHorizon', PDE.COEFFICIENTS.TIME_HORIZON_YEARS_DEFAULT, 1);
    if (scenCAutoLevel === undefined) scenCAutoLevel = PDE.readAdvanced('scenCAutoLevel', PDE.COEFFICIENTS.SCEN_C_AUTO_LEVEL, 100);
    if (scenCCapexMult === undefined) scenCCapexMult = PDE.readAdvanced('scenCCapexMult', PDE.COEFFICIENTS.SCEN_C_CAPEX_MULTIPLIER, 10);

    const annualRecurring = cWaste + cRisk;

    const scenA = PDE.scenCalc(0,    0,                            annualRecurring, dr, ny);
    const scenB = PDE.scenCalc(autoLevel, capex,                   annualRecurring, dr, ny);
    const scenC = PDE.scenCalc(scenCAutoLevel,  capex * scenCCapexMult, annualRecurring, dr, ny);

    function netColor(val) { return val >= 0 ? 'var(--green)' : 'var(--red)'; }
    function netSign(val)  { return val >= 0 ? '+' : '-'; }
    function pbStr(pb) {
        if (!isFinite(pb) || pb <= 0) return L.scenInfinity;
        if (pb < 1) return '< 1 ' + L.scenMonths;
        return pb.toFixed(1) + ' ' + L.scenMonths;
    }
    function pbColor(pb) {
        if (!isFinite(pb) || pb <= 0) return 'var(--red)';
        if (pb < PDE.COEFFICIENTS.PAYBACK_GREEN) return 'var(--green)';
        if (pb < PDE.COEFFICIENTS.PAYBACK_YELLOW) return 'var(--yellow)';
        return 'var(--orange)';
    }

    function scenCard({ title, desc, accentColor, capexAmt, calcResult, showBadge, badgeText }) {
        const recColor = netColor(calcResult.net);
        const pb       = calcResult.pb;
        const recLabel = calcResult.net >= 0 ? `${netSign(calcResult.net)}${fmt(calcResult.net)}` : `-${fmt(calcResult.net)}`;
        const badgeHtml = showBadge
            ? `<span style="display:inline-block;font-size:0.55rem;font-weight:800;padding:2px 8px;border-radius:999px;border:1px solid ${accentColor};color:${accentColor};letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">${PDE.esc(badgeText)}</span>`
            : '';

        return `
        <div style="
            background:var(--bg-elevated);
            border:1px solid var(--border);
            border-top:3px solid ${accentColor};
            border-radius:var(--radius-lg);
            padding:1.2rem;
            display:flex;
            flex-direction:column;
            gap:0.7rem;
            position:relative;
            overflow:hidden;
            transition:box-shadow 0.2s;
        ">
            <div style="position:absolute;top:0;left:0;right:0;height:40px;background:linear-gradient(to bottom,${accentColor}10,transparent);pointer-events:none;border-radius:var(--radius-lg) var(--radius-lg) 0 0;"></div>
            <div>
                ${badgeHtml}
                <p style="font-family:'Space Grotesk',sans-serif;font-size:0.85rem;font-weight:800;color:var(--text-primary);margin:0;text-transform:uppercase;letter-spacing:-0.01em;">${PDE.esc(title)}</p>
                <p style="font-size:0.62rem;color:var(--text-muted);margin:3px 0 0;line-height:1.4;">${PDE.esc(desc)}</p>
            </div>
            <div style="border-top:1px solid var(--border-subtle);padding-top:0.7rem;display:flex;flex-direction:column;gap:0.55rem;">
                <div style="display:flex;justify-content:space-between;align-items:baseline;">
                    <span style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-muted);">${PDE.esc(L.scenLabelDebt)}</span>
                    <span style="font-size:1rem;font-weight:900;color:var(--red);font-family:'Space Grotesk',sans-serif;">${fmt(totalImpact)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:baseline;">
                    <span style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-muted);">${PDE.esc(L.scenLabelInvestment)}</span>
                    <span style="font-size:0.85rem;font-weight:700;color:var(--accent);">${capexAmt > 0 ? fmt(capexAmt) : PDE.esc(L.scenNoInvestment)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:baseline;">
                    <span style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-muted);">${PDE.esc(L.scenLabelNet)}</span>
                    <span style="font-size:1.05rem;font-weight:900;color:${recColor};font-family:'Space Grotesk',sans-serif;">${calcResult.savings <= 0 ? '\u2014' : recLabel}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:baseline;border-top:1px dashed var(--border-subtle);padding-top:0.5rem;margin-top:0.1rem;">
                    <span style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-muted);">${PDE.esc(L.scenLabelPayback)}</span>
                    <span style="font-size:1rem;font-weight:900;color:${pbColor(pb)};font-family:'Space Grotesk',sans-serif;">${PDE.esc(pbStr(pb))}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:baseline;">
                    <span style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-muted);">IRR</span>
                    <span style="font-size:0.9rem;font-weight:900;color:${calcResult.irr !== null && calcResult.irr > dr ? 'var(--green)' : 'var(--red)'};font-family:'Space Grotesk',sans-serif;">${calcResult.irr !== null ? (calcResult.irr * 100).toFixed(1) + '%' : '\u2014'}</span>
                </div>
            </div>
        </div>`;
    }

    const isRecommendedB = isFinite(scenB.pb) && scenB.pb < PDE.COEFFICIENTS.PAYBACK_GREEN && autoLevel > 0;
    const isRecommendedC = !isRecommendedB && isFinite(scenC.pb) && scenC.pb < PDE.COEFFICIENTS.PAYBACK_GREEN;

    document.getElementById('scenarioGrid').innerHTML =
        scenCard({ title: L.scenarioATitle, desc: L.scenarioADesc, accentColor: 'var(--red)', capexAmt: 0, calcResult: scenA, showBadge: false, badgeText: '' }) +
        scenCard({ title: L.scenarioBTitle, desc: L.scenarioBDesc, accentColor: 'var(--accent)', capexAmt: capex, calcResult: scenB, showBadge: isRecommendedB, badgeText: L.scenRecommended }) +
        scenCard({ title: L.scenarioCTitle, desc: L.scenarioCDesc, accentColor: 'var(--green)', capexAmt: capex * 1.5, calcResult: scenC, showBadge: isRecommendedC, badgeText: L.scenRecommended });

    PDE.encodeState();
};

PDE.updateCalibration = function updateCalibration(r) {
    if (!r) return;
    const L = PDE.TRANSLATIONS[PDE.currentLang];
    const cal = PDE.CALIBRATION;

    let saved;
    try { saved = JSON.parse(localStorage.getItem(cal.STORAGE_KEY)) || {}; } catch (e) { saved = {}; void e; }

    const grid = document.getElementById('calibrationGrid');
    if (!grid) return;
    let rows = '';
    let withinTol = 0;
    const total = cal.METRICS.length;

    cal.METRICS.forEach(function (m) {
        let annualVal = r[m.key];
        if (typeof annualVal !== 'number' || !isFinite(annualVal)) annualVal = 0;
        const predicted = annualVal / 4;

        const inputId = 'calibActual_' + m.key;
        let actualVal = saved[m.key];
        if (actualVal === undefined || actualVal === null) actualVal = '';
        const actualNum = parseFloat(actualVal);
        const isFilled = isFinite(actualNum);

        const variance = isFilled ? actualNum - predicted : 0;
        const varPct = (isFilled && predicted !== 0) ? (variance / predicted) : 0;
        const absVarPct = Math.abs(varPct);

        let statusClass, statusLabel;
        if (!isFilled) {
            statusClass = '';
            statusLabel = '\u2014';
        } else if (absVarPct <= cal.THRESHOLD_GREEN) {
            statusClass = 'calib-green';
            statusLabel = L.calibAccurate;
            withinTol++;
        } else if (absVarPct <= cal.THRESHOLD_YELLOW) {
            statusClass = 'calib-yellow';
            statusLabel = L.calibOff;
        } else {
            statusClass = 'calib-red';
            statusLabel = L.calibPoor;
        }

        let predictedStr, varianceStr, varPctStr;
        if (m.format === 'hours') {
            predictedStr = Math.round(predicted);
            varianceStr = isFilled ? (variance >= 0 ? '+' : '') + Math.round(variance) : '\u2014';
            varPctStr = isFilled ? (varPct >= 0 ? '+' : '') + (varPct * 100).toFixed(0) + '%' : '\u2014';
        } else {
            predictedStr = PDE.formatCurrency(predicted);
            varianceStr = isFilled ? (variance >= 0 ? '+' : '') + PDE.formatCurrency(Math.abs(variance)) : '\u2014';
            varPctStr = isFilled ? (varPct >= 0 ? '+' : '') + (varPct * 100).toFixed(0) + '%' : '\u2014';
        }

        let labelKey = '';
        if (m.key === 'cWaste') labelKey = 'calibWaste';
        else if (m.key === 'cRisk') labelKey = 'calibRisk';
        else if (m.key === 'cOppDirect') labelKey = 'calibOpp';
        else if (m.key === 'totalImpact') labelKey = 'calibTotal';
        else if (m.key === 'netDebt') labelKey = 'calibNet';
        else if (m.key === 'manualAnnualHrs') labelKey = 'calibManualHrs';
        const label = L[labelKey] || m.key;

        const badgeHtml = isFilled
            ? '<span class="calib-badge ' + statusClass + '">' + PDE.esc(statusLabel) + '</span>'
            : '';

        rows += '<div class="calib-row">' +
            '<span class="calib-label">' + PDE.esc(label) + '</span>' +
            '<span class="calib-predicted">' + predictedStr + '</span>' +
            '<input class="calib-input" id="' + inputId + '" type="text" inputmode="decimal" placeholder="\u2014" value="' + PDE.esc(String(actualVal)) + '">' +
            '<span class="calib-variance">' + varianceStr + '</span>' +
            '<span class="calib-varpct">' + varPctStr + '</span>' +
            '<span class="calib-status">' + badgeHtml + '</span>' +
            '</div>';
    });

    grid.innerHTML = rows;

    const scoreEl = document.getElementById('calibrationScore');
    if (scoreEl) {
        const scorePct = total > 0 ? Math.round(withinTol / total * 100) : 0;
        const scoreColor = scorePct >= 80 ? 'var(--green)' : (scorePct >= 50 ? 'var(--amber)' : 'var(--red)');
        scoreEl.innerHTML = '<span style="color:' + scoreColor + ';">' + scorePct + '%</span> ' +
            PDE.esc(L.calibScore) + ' \u2014 ' + withinTol + ' ' + PDE.esc(L.calibMetricsOn) + ' ' + total + ' ' + PDE.esc(L.calibWithinTol);
    }
};

PDE.saveCalibrationActuals = function saveCalibrationActuals() {
    const cal = PDE.CALIBRATION;
    const data = {};
    cal.METRICS.forEach(function (m) {
        const el = document.getElementById('calibActual_' + m.key);
        if (el) {
            const v = el.value.trim();
            if (v !== '') data[m.key] = v;
        }
    });
    try { localStorage.setItem(cal.STORAGE_KEY, JSON.stringify(data)); } catch (e) { void e; }
};

PDE.calibrationHandleBlur = function calibrationHandleBlur() {
    PDE.saveCalibrationActuals();
    const r = PDE._lastResult;
    if (r) PDE.updateCalibration(r);
};

PDE.resetCalibration = function resetCalibration() {
    const cal = PDE.CALIBRATION;
    try { localStorage.removeItem(cal.STORAGE_KEY); } catch (e) { void e; }
    cal.METRICS.forEach(function (m) {
        const el = document.getElementById('calibActual_' + m.key);
        if (el) el.value = '';
    });
    const r = PDE._lastResult;
    if (r) PDE.updateCalibration(r);
};

PDE.updateDoraBenchmark = function updateDoraBenchmark() {
    const L = PDE.TRANSLATIONS[PDE.currentLang];
    const q1 = PDE.clamp('q1');
    const q2 = PDE.clamp('q2');
    const q5 = PDE.clamp('q5');

    const rows = [
        { metric: L.doraMetricLeadTime, value: L.doraLeadTimeDesc(q2), bandDesc: L.doraLeadTimeBand, result: PDE.getDoraBand('leadTime', q2), adapted: true },
        { metric: L.doraMetricManual,   value: L.doraManualDesc(q1),   bandDesc: L.doraManualBand,   result: PDE.getDoraBand('manual', q1), adapted: true  },
        { metric: L.doraMetricErrors,   value: L.doraErrorsDesc(q5),   bandDesc: L.doraErrorsBand,   result: PDE.getDoraBand('errors', q5), adapted: true  },
    ];

    const tbody = document.getElementById('doraTableBody');
    tbody.innerHTML = rows.map((r, i) => `
        <tr style="border-bottom:1px solid var(--border-subtle);${i % 2 === 0 ? 'background:var(--bg-elevated);' : ''}">
            <td style="padding:0.65rem 0.75rem;font-size:0.75rem;font-weight:600;color:var(--text-primary);">
                ${PDE.esc(r.metric)}
                ${r.adapted ? '<span class="dora-adapted">' + PDE.esc(L.doraAdaptedLabel) + '</span>' : ''}
            </td>
            <td style="padding:0.65rem 0.75rem;font-size:0.75rem;font-family:'Space Grotesk',sans-serif;font-weight:700;color:var(--accent);">${PDE.esc(r.value)}</td>
            <td style="padding:0.65rem 0.75rem;font-size:0.6rem;color:var(--text-muted);line-height:1.5;">${PDE.esc(r.bandDesc)}</td>
            <td style="padding:0.65rem 0.75rem;">
                <span class="dora-badge" style="color:${r.result.color};border-color:${r.result.color};">${PDE.esc(r.result.band)}</span>
            </td>
        </tr>
    `).join('');
};
