// ═══════════════════════════════════════════════════════════════
// Charts — Chart.js waterfall, bridge, heatmap
// ═══════════════════════════════════════════════════════════════
window.PDE = window.PDE || {};

PDE.waterfallChart = null;
PDE.bridgeChart = null;
PDE.heatmapChart = null;
PDE.paybackChart = null;

PDE.updateCharts = function updateCharts(total, manual, chase, waste, capex, savings, risk, effort, auto) {
    const valDelivery = total - manual - chase;
    const L = PDE.TRANSLATIONS[PDE.currentLang];

    const sizeCanvas = (id) => {
        const c = document.getElementById(id);
        const p = c.parentElement;
        c.width = p.clientWidth || 300;
        c.height = p.clientHeight || 200;
    };
    sizeCanvas('waterfallChart');
    const ctx1 = document.getElementById('waterfallChart').getContext('2d');
    if (PDE.waterfallChart) PDE.waterfallChart.destroy();
    PDE.waterfallChart = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: L.chartWaterfallLabels,
            datasets: [{
                data: [total, -manual, -chase, valDelivery],
                backgroundColor: [PDE.DARK.navy, PDE.DARK.red, PDE.DARK.orange, PDE.DARK.green],
                borderRadius: 6, borderSkipped: false
            }]
        },
        options: { ...PDE.CHART_OPTS, indexAxis: 'y' }
    });

    sizeCanvas('bridgeChart');
    const ctx2 = document.getElementById('bridgeChart').getContext('2d');
    if (PDE.bridgeChart) PDE.bridgeChart.destroy();
    PDE.bridgeChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: L.chartBridgeLabels,
            datasets: [{
                data: [waste, -capex, savings - capex],
                backgroundColor: [PDE.DARK.red, PDE.DARK.cyan, PDE.DARK.green],
                borderRadius: 6, borderSkipped: false
            }]
        },
        options: { ...PDE.CHART_OPTS }
    });

    sizeCanvas('heatmapChart');
    const ctx3 = document.getElementById('heatmapChart').getContext('2d');
    if (PDE.heatmapChart) PDE.heatmapChart.destroy();
    PDE.heatmapChart = new Chart(ctx3, {
        type: 'scatter',
        data: {
            datasets: [
                { label: L.chartCurrentState, data: [{x: effort, y: risk}], backgroundColor: PDE.DARK.red, pointRadius: 14, pointHoverRadius: 18 },
                { label: L.chartTargetState,  data: [{x: effort*(1-auto), y: risk * (1 - auto * 0.6)}], backgroundColor: PDE.DARK.green, pointRadius: 14, pointHoverRadius: 18 }
            ]
        },
        options: {
            maintainAspectRatio: false,
            plugins: { legend: { display: true, labels: { color: PDE.DARK.text, usePointStyle: true, pointStyleWidth: 10 } } },
            scales: {
                x: { min: 0, max: 100, grid: { color: PDE.DARK.grid }, ticks: { color: PDE.DARK.text }, title: { display: true, text: L.chartEffortAxis, color: PDE.DARK.text } },
                y: { min: 0, max: 5,   grid: { color: PDE.DARK.grid }, ticks: { color: PDE.DARK.text }, title: { display: true, text: L.chartRiskAxis,  color: PDE.DARK.text } }
            }
        }
    });

    const wf = document.getElementById('waterfallChart');
    if (wf) wf.setAttribute('aria-label', L.chartWaterfallAria(Math.round(total), Math.round(manual), Math.round(chase), Math.round(valDelivery)));
    const br = document.getElementById('bridgeChart');
    if (br) br.setAttribute('aria-label', L.chartBridgeAria(waste, capex, savings - capex));
    const hm = document.getElementById('heatmapChart');
    if (hm) hm.setAttribute('aria-label', L.chartHeatmapAria(Math.round(effort), Math.round(risk * 10) / 10, Math.round(effort * (1 - auto)), Math.round(risk * (1 - auto * 0.6) * 10) / 10));
};

// Cumulative ROI / Payback chart — annual bars of the cumulative discounted
// net position derived from PDE.paybackSeries. Bars flip from red (below the
// dashed break-even line at 0) to green once the investment is recovered.
PDE.renderPaybackChart = function renderPaybackChart(result) {
    const canvas = document.getElementById('paybackChart');
    if (!canvas) return;
    const L = PDE.TRANSLATIONS[PDE.currentLang];

    const sizeCanvas = function (id) {
        const c = document.getElementById(id);
        const p = c.parentElement;
        c.width = p.clientWidth || 300;
        c.height = p.clientHeight || 200;
    };
    sizeCanvas('paybackChart');
    const ctx = canvas.getContext('2d');
    if (PDE.paybackChart) PDE.paybackChart.destroy();

    const pts = (result && result.points) || [];
    const labels = [];
    for (let i = 0; i < pts.length; i++) labels.push((L.chartYearUnit || 'Y') + ' ' + (i + 1));
    const colors = pts.map(function (v) { return v < 0 ? PDE.DARK.red : PDE.DARK.green; });

    const zeroLinePlugin = {
        id: 'paybackZeroLine',
        beforeDraw: function (chart) {
            const yScale = chart.scales.y;
            if (!yScale) return;
            const area = chart.chartArea;
            const zeroPixel = yScale.getPixelForValue(0);
            if (zeroPixel < area.top || zeroPixel > area.bottom) return;
            const c2 = chart.ctx;
            c2.save();
            c2.beginPath();
            c2.setLineDash([6, 6]);
            c2.strokeStyle = '#4A3F35';
            c2.lineWidth = 1.5;
            c2.moveTo(area.left, zeroPixel);
            c2.lineTo(area.right, zeroPixel);
            c2.stroke();
            c2.restore();
        }
    };

    const breakEven = result.breakEvenMonth;
    const hasBreakEven = !!breakEven && isFinite(breakEven);

    PDE.paybackChart = new Chart(ctx, {
        type: 'bar',
        plugins: [zeroLinePlugin],
        data: {
            labels: labels,
            datasets: [{
                data: pts,
                backgroundColor: colors,
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            maintainAspectRatio: false,
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const idx = context.dataIndex;
                            let txt = (L.chartPaybackNet || 'Net position') + ': ' + PDE.formatCompactCurrency(context.parsed.y);
                            if (hasBreakEven) {
                                const yearStart = idx * 12 + 1;
                                const yearEnd = (idx + 1) * 12;
                                if (breakEven >= yearStart && breakEven <= yearEnd) {
                                    txt += '\n' + (L.chartPaybackOnTrack || 'Break-even reached after') + ' ' + PDE.fmtMonths(breakEven);
                                }
                            }
                            return txt;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: PDE.DARK.grid },
                    ticks: { color: PDE.DARK.text },
                    title: { display: true, text: L.chartPaybackAxis, color: PDE.DARK.text }
                },
                y: {
                    grid: { color: PDE.DARK.grid },
                    ticks: { color: PDE.DARK.text, callback: function (value) { return PDE.formatCompactCurrency(value); } },
                    title: { display: true, text: L.chartPaybackNetUnit, color: PDE.DARK.text }
                }
            }
        }
    });

    const sub = document.getElementById('paybackSub');
    if (sub) sub.textContent = hasBreakEven ? L.chartPaybackBreakEven(PDE.fmtMonths(breakEven)) : L.chartPaybackNone;
    if (typeof L.chartPaybackAria === 'function') {
        canvas.setAttribute('aria-label', L.chartPaybackAria(pts, hasBreakEven ? breakEven : null));
    }
};
