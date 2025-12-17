/**
 * Uptime Dashboard - Charts Module
 * Gráficos profesionales con Chart.js
 */

import { parseTimestamp, formatDate } from './uptime-utils.js';

// Chart instances for cleanup
let uptimeLineChart = null;
let topNodesBarChart = null;

// Chart.js default configuration
const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            display: true,
            labels: { color: '#ccc', font: { size: 12 } }
        },
        tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            cornerRadius: 8,
            padding: 12
        }
    }
};

/**
 * Inicializa los gráficos del dashboard
 */
export function initCharts() {
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.error('Chart.js not loaded');
        return;
    }

    // Set global chart defaults
    Chart.defaults.color = '#9ca3af';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.1)';
}

/**
 * Renderiza el gráfico de línea de Uptime diario
 * @param {Array} incidents - Lista de incidentes cerrados
 */
export function renderUptimeLineChart(incidents) {
    const canvas = document.getElementById('uptime-line-chart');
    if (!canvas) return;

    // Destroy previous instance
    if (uptimeLineChart) {
        uptimeLineChart.destroy();
    }

    // Process data - last 30 days
    const dailyData = processUptimeByDay(incidents, 30);

    const ctx = canvas.getContext('2d');
    uptimeLineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dailyData.labels,
            datasets: [{
                label: '% Uptime',
                data: dailyData.values,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointHoverRadius: 6,
                pointBackgroundColor: '#10b981'
            }]
        },
        options: {
            ...chartDefaults,
            scales: {
                y: {
                    min: 95,
                    max: 100,
                    ticks: {
                        callback: (value) => value + '%',
                        color: '#9ca3af'
                    },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                x: {
                    ticks: { color: '#9ca3af', maxTicksLimit: 10 },
                    grid: { display: false }
                }
            },
            plugins: {
                ...chartDefaults.plugins,
                title: {
                    display: true,
                    text: 'Uptime Diario - Últimos 30 Días',
                    color: '#fff',
                    font: { size: 14, weight: '600' }
                }
            }
        }
    });
}

/**
 * Renderiza el gráfico de barras de Top Nodos con más incidentes
 * @param {Array} incidents - Lista de incidentes
 */
export function renderTopNodesChart(incidents) {
    const canvas = document.getElementById('top-nodes-chart');
    if (!canvas) return;

    // Destroy previous instance
    if (topNodesBarChart) {
        topNodesBarChart.destroy();
    }

    // Process data - top 5 nodes
    const topNodes = processTopNodes(incidents, 5);

    const ctx = canvas.getContext('2d');
    topNodesBarChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topNodes.labels,
            datasets: [{
                label: 'Incidentes',
                data: topNodes.values,
                backgroundColor: [
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(139, 92, 246, 0.8)',
                    'rgba(34, 197, 94, 0.8)'
                ],
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            ...chartDefaults,
            indexAxis: 'y',
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        color: '#9ca3af',
                        precision: 0
                    },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                y: {
                    ticks: { color: '#ccc' },
                    grid: { display: false }
                }
            },
            plugins: {
                ...chartDefaults.plugins,
                legend: { display: false },
                title: {
                    display: true,
                    text: 'Top 5 Nodos con Más Incidentes',
                    color: '#fff',
                    font: { size: 14, weight: '600' }
                }
            }
        }
    });
}

/**
 * Procesa datos de uptime por día
 */
function processUptimeByDay(incidents, days) {
    const TOTAL_CLIENTS = 10700;
    const today = new Date();
    const labels = [];
    const values = [];

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const dateStr = date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
        labels.push(dateStr);

        // Find incidents for this day
        const dayIncidents = incidents.filter(inc => {
            const startDate = parseTimestamp(inc.start_date);
            if (!startDate) return false;
            return startDate.toDateString() === date.toDateString();
        });

        // Calculate uptime for this day
        let totalDowntimeMinutes = 0;
        let totalClientMinutes = 0;

        dayIncidents.forEach(inc => {
            const duration = inc.restore_time || 0;
            const clients = inc.affected_customers || 0;
            totalDowntimeMinutes += duration;
            totalClientMinutes += duration * clients;
        });

        // Total possible minutes = 1440 min/day * total clients
        const totalPossibleMinutes = 1440 * TOTAL_CLIENTS;
        const uptimePercent = totalPossibleMinutes > 0
            ? ((1 - (totalClientMinutes / totalPossibleMinutes)) * 100)
            : 100;

        values.push(Math.max(0, Math.min(100, uptimePercent)).toFixed(4));
    }

    return { labels, values };
}

/**
 * Procesa top nodos con más incidentes
 */
function processTopNodes(incidents, limit) {
    const nodeCounts = {};

    incidents.forEach(inc => {
        const node = inc.node || 'Desconocido';
        nodeCounts[node] = (nodeCounts[node] || 0) + 1;
    });

    // Sort and get top N
    const sorted = Object.entries(nodeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

    return {
        labels: sorted.map(([node]) => node),
        values: sorted.map(([, count]) => count)
    };
}

/**
 * Calcula KPIs mejorados con tendencias
 */
export function calculateKPIs(activeIncidents, historyIncidents) {
    const now = new Date();
    const thisMonth = now.getMonth();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;

    // Filter incidents by month
    const thisMonthIncidents = historyIncidents.filter(inc => {
        const date = parseTimestamp(inc.start_date);
        return date && date.getMonth() === thisMonth;
    });

    const lastMonthIncidents = historyIncidents.filter(inc => {
        const date = parseTimestamp(inc.start_date);
        return date && date.getMonth() === lastMonth;
    });

    // Calculate metrics
    const thisMonthUptime = calculateMonthlyUptime(thisMonthIncidents);
    const lastMonthUptime = calculateMonthlyUptime(lastMonthIncidents);

    const uptimeTrend = thisMonthUptime - lastMonthUptime;

    // Calculate MTTR (Mean Time To Resolve)
    const mttrThisMonth = calculateMTTR(thisMonthIncidents);
    const mttrLastMonth = calculateMTTR(lastMonthIncidents);
    const mttrTrend = mttrLastMonth - mttrThisMonth; // Negative is better

    return {
        activeCount: activeIncidents.length,
        monthlyUptime: thisMonthUptime,
        uptimeTrend,
        affectedClients: activeIncidents.reduce((sum, i) => sum + (i.affected_customers || 0), 0),
        mttr: mttrThisMonth,
        mttrTrend,
        totalIncidents: thisMonthIncidents.length
    };
}

function calculateMonthlyUptime(incidents) {
    const TOTAL_CLIENTS = 10700;
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const totalPossibleMinutes = daysInMonth * 1440 * TOTAL_CLIENTS;

    let totalClientMinutes = 0;
    incidents.forEach(inc => {
        totalClientMinutes += (inc.restore_time || 0) * (inc.affected_customers || 0);
    });

    return ((1 - (totalClientMinutes / totalPossibleMinutes)) * 100);
}

function calculateMTTR(incidents) {
    if (incidents.length === 0) return 0;
    const totalTime = incidents.reduce((sum, i) => sum + (i.restore_time || 0), 0);
    return Math.round(totalTime / incidents.length);
}

console.log('✅ Uptime Charts loaded');
