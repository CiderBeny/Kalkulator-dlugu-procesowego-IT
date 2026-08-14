// ═══════════════════════════════════════════════════════════════
// Charts — Chart.js waterfall, bridge, heatmap
// ═══════════════════════════════════════════════════════════════
window.PDE = window.PDE || {};

PDE.waterfallChart = null;
PDE.bridgeChart = null;
PDE.heatmapChart = null;

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
};
