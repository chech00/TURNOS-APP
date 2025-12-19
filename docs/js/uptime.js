import { auth, db } from './firebase.js';
import {
    parseTimestamp, formatTime, formatDate, formatDuration,
    showToast, TimerManager, showSkeleton, exportToCSV
} from './uptime-utils.js';
import {
    initCharts, renderUptimeLineChart, renderTopNodesChart, calculateKPIs
} from './uptime-charts.js';
import { getDependentNodes, topology, aliases } from './dependencies.js';



// Detectar si estamos en producción (GitHub Pages) o local
const isProduction = window.location.hostname.includes('github.io');
const API_URL = isProduction
    ? 'https://turnos-app-8viu.onrender.com'
    : 'http://localhost:3000';



async function callApi(endpoint, method, body) {
    const user = auth.currentUser;
    if (!user) throw new Error("Usuario no autenticado");

    const token = await user.getIdToken();

    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };

    // Only include body for non-GET requests
    if (method !== 'GET' && body) {
        options.body = JSON.stringify(body);
    }

    // Add cache-busting for GET requests
    const urlWithCache = method === 'GET'
        ? `${API_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}_t=${Date.now()}`
        : `${API_URL}${endpoint}`;

    let response;
    try {
        response = await fetch(urlWithCache, options);
    } catch (networkError) {
        // Handle offline/network failure
        console.error("Network Error:", networkError);
        throw new Error("No hay conexión con el servidor. Verifica tu internet.");
    }

    if (!response.ok) {
        let errorMsg = "Error en API";
        try {
            const errorData = await response.json();
            errorMsg = errorData.error || errorData.message || errorMsg;
        } catch (jsonError) {
            // response was not JSON
            errorMsg = response.statusText || ("Error " + response.status);
        }
        throw new Error(errorMsg);
    }

    return await response.json();
}

// Global State
let selectedPons = [];
let isFullNodeDown = false; // Flag for "all node down" mode
const TOTAL_CLIENTS_BASE = 10700; // Constante 2023
let allNodesData = []; // Cache for smart search
let allPonsData = []; // Cache for smart search  
let lastIncidentData = null; // For copy-last feature
let currentNodePonsData = []; // PONs of currently selected node
let allIncidentsCache = []; // All incidents for filtering
let filteredIncidents = []; // Filtered incidents for display/export
let lastUpdateTime = null; // Track last data refresh
let dataLoaded = false; // Flag to prevent auto-incidents before data loads
const pendingAutoIncidents = new Set(); // Prevent duplicate auto-creations
let monitoringPaused = false; // Track monitoring toggle state (synced with backend)

const COLLECTION_NAME = 'uptime_logs';

// ==========================================
// 1. DATA LOADING & RENDERING
// ==========================================

// Global listener variable
let uptimeListener = null;
const notifiedIncidents = new Set(); // Track notified IDs to prevent repetitive alerts

export function loadUptimeLogs() {
    console.log("📅 [Uptime] Iniciando monitor en tiempo real...");
    const activeTableBody = document.getElementById('active-incidents-body');
    const activeContainer = document.getElementById('active-incidents-container');
    const historyTableBody = document.getElementById('uptime-table-body');
    const loadingSpinner = document.getElementById('loading-spinner');

    // Clean up old timers
    TimerManager.stopAll();

    if (loadingSpinner) loadingSpinner.style.display = 'flex';
    if (historyTableBody) showSkeleton(historyTableBody, 5);
    if (activeTableBody) activeTableBody.innerHTML = '';

    // Unsubscribe previous listener if exists
    if (uptimeListener) {
        uptimeListener();
        uptimeListener = null;
    }

    // LISTENER EN TIEMPO REAL (Socket)
    // Esto reemplaza al fetch() y permite actualización instantánea
    uptimeListener = db.collection(COLLECTION_NAME)
        .orderBy('start_date', 'desc')
        .onSnapshot(async (snapshot) => {
            console.log("⚡ [Realtime] Recibida actualización de Firestore");
            if (loadingSpinner) loadingSpinner.style.display = 'none';

            const allIncidents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // 1. Process timestamps
            allIncidents.forEach(data => {
                if (data.start_date && data.start_date.toDate) data.start_date = data.start_date.toDate();
                if (data.end_date && data.end_date.toDate) data.end_date = data.end_date.toDate();
                if (data.created_at && data.created_at.toDate) data.created_at = data.created_at.toDate();
            });

            // Cache data
            allIncidentsCache = allIncidents;
            filteredIncidents = [...allIncidents];

            // Update UI elements
            updateLastUpdateIndicator();
            populateNodeFilter(allIncidents);

            const activeIncidents = [];
            const historyIncidents = [];

            allIncidents.forEach(data => {
                if (!data.end_date) {
                    activeIncidents.push(data);

                    // --- SMART ALERT LOGIC ---
                    // Only alert if we haven't notified this ID before
                    // AND the incident is relatively new (created in last 5 mins) to avoid spam on page load
                    const isNew = !notifiedIncidents.has(data.ticket_id);
                    const isRecent = (new Date() - new Date(data.start_date)) < 5 * 60 * 1000;

                    if (isNew && isRecent) {
                        notifiedIncidents.add(data.ticket_id);

                        // Sonido de alerta (opcional)
                        // playAlertSound(); 

                        // Only show notifications if monitoring is ACTIVE (not paused)
                        if (!monitoringPaused) {
                            // Toast Notification
                            showToast(`🚨 NUEVO INCIDENTE: ${data.node}`, 'error');

                            // Push Notification
                            if (Notification.permission === "granted") {
                                new Notification(`🚨 Caida Detectada: ${data.node}`, {
                                    body: `Ticket: ${data.ticket_id} - ${data.failure_type}`,
                                    icon: "img/icon.png"
                                });
                            }
                        } else {
                            console.log(`⏸️ Monitoring paused - notification suppressed for ${data.node}`);
                        }
                    } else {
                        // Mark as notified so we don't alert on future updates (e.g. comments)
                        notifiedIncidents.add(data.ticket_id);
                    }

                } else {
                    historyIncidents.push(data);
                }
            });

            // RENDER ACTIVE
            renderActiveIncidents(activeIncidents, activeContainer, activeTableBody);

            // RENDER HISTORY
            renderHistoryTable(historyIncidents);

            // UPDATE KPI & CHARTS
            updateStats(activeIncidents, historyIncidents);

            // Mark loaded
            dataLoaded = true;

            // Render Analytics
            initCharts();
            renderUptimeLineChart(historyIncidents);
            renderTopNodesChart([...activeIncidents, ...historyIncidents]);

            // Re-init icons
            if (window.lucide) window.lucide.createIcons();

        }, (error) => {
            console.error("❌ Error en listener Realtime:", error);
            if (historyTableBody) historyTableBody.innerHTML = `<tr><td colspan="11">Error de conexión: ${error.message}</td></tr>`;
        });
}

function renderActiveIncidents(activeIncidents, container, tableBody) {
    if (activeIncidents.length > 0) {
        if (container) container.style.display = 'block';
        let activeHtml = '';
        activeIncidents.forEach(data => {
            // Logic for PONs display
            let ponsDisplay = '<span style="color: #4b5563;">-</span>';
            if (data.affected_pons && data.affected_pons.length > 0) {
                if (data.affected_pons.includes("NODO_COMPLETO")) {
                    ponsDisplay = `<span class="glass-badge danger">🚨 NODO COMPLETO</span>`;
                } else if (data.affected_pons.length > 3) {
                    ponsDisplay = `<span class="glass-badge secondary" title="${data.affected_pons.join(', ')}">${data.affected_pons.length} PONs</span>`;
                } else {
                    ponsDisplay = data.affected_pons.map(p => {
                        const pName = p.replace('PON ', ''); // Shorten
                        return `<span class="glass-badge secondary" style="font-size: 0.7rem;">${pName}</span>`;
                    }).join(' ');
                }
            }

            // Dependency Logic
            const dependentsDisplay = data.dependent_nodes && data.dependent_nodes.length > 0
                ? `<div style="margin-top: 4px; display: flex; align-items: center; gap: 4px;">
                         <span style="color: #f59e0b; font-size: 0.75rem;">⚠️ Afecta:</span>
                         <span class="glass-badge warning" title="${data.dependent_nodes.join(', ')}">${data.dependent_nodes.length} Nodos</span>
                       </div>`
                : '';

            const causedByDisplay = data.caused_by_node
                ? `<div style="margin-top: 4px;">
                         <span class="glass-badge info" style="font-size: 0.7rem;">🔗 Causa: ${data.caused_by_node}</span>
                       </div>`
                : '';

            // Safe strings
            const safeNode = escapeHTML(data.node || 'N/A');

            activeHtml += `
                    <tr class="modern-row" style="background: rgba(239, 68, 68, 0.05); border-left: 2px solid #ef4444;">
                        <td style="vertical-align: middle;">
                            <span class="ticket-pill" style="color: #ef4444; background: rgba(239, 68, 68, 0.1);">${data.ticket_id}</span>
                        </td>
                        <td style="color: #e5e7eb; font-size: 0.9rem;">${formatTime(data.start_date)}</td>
                        <td style="font-weight: 600; color: #fff; font-size: 0.95rem;">${safeNode}</td>
                        <td>${getFailureBadge(data.failure_type)}</td>
                        <td>
                            <div style="display: flex; flex-direction: column; gap: 2px;">
                                <div>${ponsDisplay}</div>
                                ${dependentsDisplay}
                                ${causedByDisplay}
                            </div>
                        </td>
                        <td class="text-center" style="font-weight: 500;">
                             ${data.affected_customers > 0 ? `<span style="color:#f87171;">${data.affected_customers}</span>` : '<span style="color:#4b5563;">0</span>'}
                        </td>
                        <td style="font-family: 'JetBrains Mono', monospace; font-weight: 700; color: #ef4444;" id="timer-${data.id}">00:00:00</td>
                        <td>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <button class="icon-btn" onclick="window.viewDetails('${data.id}')" 
                                        style="background: transparent; border: 1px solid rgba(255,255,255,0.1); padding: 6px; border-radius: 6px; color: #3b82f6;"
                                        title="Diagnosticar / Editar">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/><path d="m9 11 4 4"/><path d="m5 19-3 3"/><path d="m14 4 6 6"/></svg>
                                </button>
                                <button class="icon-btn" onclick="window.requestCloseIncident('${data.id}')" 
                                        style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.2); padding: 6px; border-radius: 6px; color: #22c55e;"
                                        title="Restaurar Servicio">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
        });
        if (tableBody) tableBody.innerHTML = activeHtml;

        activeIncidents.forEach(data => {
            startLiveTimer(data.id, data.start_date);
        });

        // Ensure icons render
        if (window.lucide) window.lucide.createIcons();

    } else {
        if (container) container.style.display = 'none';
        // Clear table body just in case
        if (tableBody) tableBody.innerHTML = '';
    }
}

// ==========================================
// 2. MODAL & INTERACTION HANDLERS (Global)
// ==========================================

window.loadUptimeLogs = loadUptimeLogs;

// ==========================================
// FILTER & EXPORT FUNCTIONALITY
// ==========================================

window.applyFilters = function () {
    const nodeFilter = document.getElementById('filter-node')?.value || '';
    const dateFrom = document.getElementById('filter-date-from')?.value || '';
    const dateTo = document.getElementById('filter-date-to')?.value || '';
    const typeFilter = document.getElementById('filter-type')?.value || '';

    console.log("🔍 Applying filters:", { nodeFilter, dateFrom, dateTo, typeFilter });
    console.log("📊 Total incidents in cache:", allIncidentsCache.length);

    filteredIncidents = allIncidentsCache.filter(inc => {
        // Filter by node
        if (nodeFilter && inc.node !== nodeFilter) return false;

        // Filter by date range
        if (dateFrom) {
            const incDate = parseTimestamp(inc.start_date);
            const fromDate = new Date(dateFrom);
            fromDate.setHours(0, 0, 0, 0); // Start of day
            if (incDate && incDate < fromDate) return false;
        }
        if (dateTo) {
            const incDate = parseTimestamp(inc.start_date);
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999); // End of day
            if (incDate && incDate > toDate) return false;
        }

        // Filter by failure type (flexible matching)
        if (typeFilter) {
            const incType = (inc.failure_type || '').toLowerCase();
            const filterType = typeFilter.toLowerCase();
            // Match if the incident type contains the filter value or vice versa
            if (!incType.includes(filterType) && !filterType.includes(incType)) {
                return false;
            }
        }

        return true;
    });

    console.log("✅ Filtered results:", filteredIncidents.length);

    // Re-render the history table with filtered data
    renderHistoryTable(filteredIncidents.filter(i => i.end_date));

    // --- NEW: Update Charts with filtered data ---
    if (typeof renderUptimeLineChart === 'function') {
        renderUptimeLineChart(filteredIncidents.filter(i => i.end_date));
    }
    if (typeof renderTopNodesChart === 'function') {
        renderTopNodesChart(filteredIncidents);
    }

    showToast(`Mostrando ${filteredIncidents.filter(i => i.end_date).length} incidentes`, 'info');
};

window.clearFilters = function () {
    document.getElementById('filter-node').value = '';
    document.getElementById('filter-date-from').value = '';
    document.getElementById('filter-date-to').value = '';
    document.getElementById('filter-type').value = '';

    filteredIncidents = [...allIncidentsCache];
    renderHistoryTable(filteredIncidents.filter(i => i.end_date));
    showToast('Filtros limpiados', 'info');
};

window.exportToCSV = function () {
    const dataToExport = filteredIncidents.filter(i => i.end_date).map(inc => ({
        'Ticket': inc.ticket_id || '-',
        'Nodo': inc.node || '-',
        'Tipo de Falla': inc.failure_type || '-',
        'Inicio': formatDate(inc.start_date),
        'Término': formatDate(inc.end_date),
        'Duración (min)': inc.restore_time || 0,
        'Clientes Afectados': inc.affected_customers || 0,
        'PONs': (inc.affected_pons || []).join('; '),
        '% Uptime': inc.pct_uptime_customer_failure
            ? (inc.pct_uptime_customer_failure * 100).toFixed(4) + '%'
            : '-',
        'Motivo': inc.failure_reason || '-'
    }));

    if (dataToExport.length === 0) {
        showToast('No hay datos para exportar', 'warning');
        return;
    }

    const filename = `uptime_report_${new Date().toISOString().split('T')[0]}.csv`;
    exportToCSV(dataToExport, filename);
};

function updateLastUpdateIndicator() {
    const indicator = document.getElementById('last-update-indicator');
    if (indicator) {
        lastUpdateTime = new Date();
        indicator.textContent = `Última actualización: ${formatTime(lastUpdateTime)}`;
    }
}

function populateNodeFilter(incidents) {
    const filterNode = document.getElementById('filter-node');
    if (!filterNode) return;

    const uniqueNodes = [...new Set(incidents.map(i => i.node).filter(Boolean))].sort();
    filterNode.innerHTML = '<option value="">Todos los nodos</option>';
    uniqueNodes.forEach(node => {
        filterNode.innerHTML += `<option value="${node}">${node}</option>`;
    });
}

function renderHistoryTable(historyIncidents) {
    // Inject modern styles if not present
    if (!document.getElementById('modern-table-styles')) {
        const styles = document.createElement('style');
        styles.id = 'modern-table-styles';
        styles.textContent = `
            .glass-badge {
                padding: 4px 10px;
                border-radius: 9999px; /* Pill shape */
                font-size: 0.7rem;
                font-weight: 600;
                display: inline-flex;
                align-items: center;
                gap: 4px;
                white-space: nowrap;
                backdrop-filter: blur(4px);
                border: 1px solid transparent;
            }
            .glass-badge.danger { background: rgba(239, 68, 68, 0.1); color: #f87171; border-color: rgba(239, 68, 68, 0.2); }
            .glass-badge.warning { background: rgba(245, 158, 11, 0.1); color: #fbbf24; border-color: rgba(245, 158, 11, 0.2); }
            .glass-badge.info { background: rgba(59, 130, 246, 0.1); color: #60a5fa; border-color: rgba(59, 130, 246, 0.2); }
            .glass-badge.secondary { background: rgba(107, 114, 128, 0.1); color: #9ca3af; border-color: rgba(107, 114, 128, 0.2); }
            
            .modern-row td {
                padding: 1rem 0.75rem;
                vertical-align: middle;
                border-bottom: 1px solid rgba(255,255,255,0.03);
                transition: background 0.2s;
            }
            .modern-row:hover td {
                background: rgba(255,255,255,0.02);
            }
            .ticket-pill {
                font-family: 'JetBrains Mono', monospace;
                background: rgba(0,0,0,0.3);
                padding: 2px 6px;
                border-radius: 4px;
                color: #9ca3af;
                font-size: 0.75rem;
            }

            /* Modal Diagnose Modernization */
            #modal-diagnose .modal-header .close-modal {
                background: transparent;
                color: #94a3b8;
                font-size: 2rem;
                line-height: 2rem;
                height: auto;
                width: auto;
                opacity: 0.7;
                transition: opacity 0.2s;
            }
            #modal-diagnose .modal-header .close-modal:hover { opacity: 1; color: white; }

            #modal-diagnose .modal-content {
                background: #1e293b;
                border: 1px solid rgba(255,255,255,0.1);
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                border-radius: 16px;
            }
            #modal-diagnose h2 {
                background: linear-gradient(to right, #a78bfa, #3b82f6);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            #modal-diagnose .form-group label {
                color: #94a3b8;
                font-weight: 500;
            }
            #modal-diagnose input[type="text"],
            #modal-diagnose input[type="number"],
            #modal-diagnose textarea,
            #modal-diagnose select {
                background: rgba(15, 23, 42, 0.6);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 8px;
                padding: 0.75rem;
                color: white;
                font-size: 0.95rem;
                width: 100%;
                transition: all 0.2s;
            }
            #modal-diagnose input:focus,
            #modal-diagnose select:focus,
            #modal-diagnose textarea:focus {
                outline: none;
                border-color: #8b5cf6;
                box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
            }
            
            /* Area Buttons */
            .area-btn {
                background: transparent;
                color: #94a3b8;
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 8px;
                padding: 6px 12px; /* Compressed padding */
                font-size: 0.85rem;
                transition: all 0.2s;
                white-space: nowrap; /* Prevent internal wrapping */
            }
            .area-btn:hover { background: rgba(255,255,255,0.05); }
            .area-btn.active {
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                color: white;
                border-color: transparent;
                box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);
            }

            /* Toggle Switch */
            .checkbox-container {
                display: flex;
                align-items: center;
                gap: 12px;
                cursor: pointer;
                user-select: none;
            }
            .checkbox-container input { display: none; }
            .checkmark {
                position: relative;
                display: block; /* Fix for 0-width span issue */
                height: 24px;
                width: 44px;
                background-color: #334155;
                border-radius: 9999px;
                transition: 0.3s;
                flex-shrink: 0; /* Vital for alignment */
            }
            .checkmark:after {
                content: "";
                position: absolute;
                left: 2px;
                top: 2px;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: white;
                transition: 0.3s;
            }
            .checkbox-container input:checked ~ .checkmark { background-color: #ef4444; }
            .checkbox-container input:checked ~ .checkmark:after { transform: translateX(20px); }

            #btn-save-diagnose {
                background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
                border: none;
                font-weight: 600;
                box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.4);
                padding: 1rem;
                border-radius: 8px;
            }
            #btn-save-diagnose:hover { filter: brightness(1.1); }
        `;
        document.head.appendChild(styles);
    }

    const historyTableBody = document.getElementById('uptime-table-body');
    if (!historyTableBody) return;

    if (historyIncidents.length === 0) {
        historyTableBody.innerHTML = `<tr><td colspan="11" class="text-center" style="padding: 3rem; color: #6b7280;">
            <i data-lucide="inbox" style="width: 32px; height: 32px; margin-bottom: 0.5rem; opacity: 0.5;"></i>
            <br>No hay registros que coincidan con los filtros.
        </td></tr>`;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    let historyHtml = '';
    let reviewCount = 0;

    historyIncidents.forEach(data => {
        try {
            if (!data) return;

            // Review Logic
            const needsReview = data.needs_review === true;
            if (needsReview) reviewCount++;

            // Format PONs nicely
            let ponsDisplay = '<span style="color: #4b5563;">-</span>';
            if (data.affected_pons && data.affected_pons.length > 0) {
                if (data.affected_pons.includes("NODO_COMPLETO")) {
                    ponsDisplay = `<span class="glass-badge danger">🚨 NODO COMPLETO</span>`;
                } else if (data.affected_pons.length > 2) {
                    ponsDisplay = `<span class="glass-badge secondary" title="${data.affected_pons.join(', ')}">${data.affected_pons.length} PONs Afectados</span>`;
                } else {
                    ponsDisplay = data.affected_pons.map(p => {
                        const isDep = p === 'POR_DEPENDENCIA';
                        const pName = p.replace('PON ', '');
                        return `<span class="glass-badge ${isDep ? 'warning' : 'secondary'}">${isDep ? '🔗 Dep' : pName}</span>`
                    }).join(' ');
                }
            }

            const uptimePercent = (data.pct_uptime_customer_failure !== undefined && data.pct_uptime_customer_failure !== null)
                ? (data.pct_uptime_customer_failure * 100).toFixed(4) + '%'
                : '-';

            const safeNode = escapeHTML(data.node || 'N/A');
            const safeReason = escapeHTML(data.failure_reason || '-');
            const safeNotes = escapeHTML(data.notes || '');

            // Row Styling
            const rowClass = needsReview ? "modern-row needs-review-row" : "modern-row";
            const rowStyle = needsReview ? "background: rgba(250, 204, 21, 0.03); border-left: 2px solid #facc15;" : "";

            // Icon logic for Ticket
            const statusIndicator = needsReview
                ? `<i data-lucide="alert-circle" style="width:14px; color:#facc15; margin-right:4px;"></i>`
                : ``;

            // Merge details into reason for cleaner look? No, keep separate for now.
            // Clean up Reason if it's "Caída por dependencia..." to just "🔗 Dependencia"
            let displayReason = safeReason;
            if (safeReason.includes("Caída por dependencia")) {
                displayReason = `<span style="color:#fbbf24; font-size:0.8rem;">🔗 Dependencia</span>`;
            } else if (safeReason.includes("Reportado automáticamente")) {
                displayReason = `<span style="color:#60a5fa; font-size:0.8rem;">🤖 Auto-Reporte</span>`;
            }

            historyHtml += `
                <tr class="${rowClass}" style="${rowStyle}">
                    <td>
                        <div style="display:flex; align-items:center;">
                            ${statusIndicator}
                            <span class="ticket-pill">${data.ticket_id || '?'}</span>
                        </div>
                    </td>
                    <td>
                        <div style="font-weight: 600; color: #e5e7eb; font-size: 0.9rem;">${safeNode}</div>
                        <div style="font-size: 0.7rem; color: #6b7280;">ID: ${data.node_id || '-'}</div>
                    </td>
                    <td>${getFailureBadge(data.failure_type)}</td>
                    <td style="color: #9ca3af; font-size: 0.85rem;">${formatDate(data.start_date)}</td>
                    <td style="color: #9ca3af; font-size: 0.85rem;">${formatDate(data.end_date)}</td>
                    <td style="font-family: monospace; font-weight: 600; color: #d1d5db;">${formatDuration(data.restore_time)}</td>
                    <td class="text-center" style="font-weight: 500;">
                        ${data.affected_customers > 0 ? `<span style="color:#f87171;">${data.affected_customers}</span>` : '<span style="color:#4b5563;">0</span>'}
                    </td>
                    <td>${ponsDisplay}</td>
                    <td style="font-family: monospace; color: #10b981;">${uptimePercent}</td>
                    <td style="max-width: 200px;">
                        <div class="truncate-cell" title="${safeReason}" style="font-size: 0.85rem;">${displayReason}</div>
                        ${safeNotes ? `<div style="font-size: 0.7rem; color: #6b7280; margin-top: 2px;" class="truncate-cell">${safeNotes}</div>` : ''}
                    </td>
                    <td>
                         <button class="icon-btn" onclick="window.viewDetails('${data.id}')" 
                                 style="background: transparent; border: 1px solid rgba(255,255,255,0.1); padding: 4px; border-radius: 6px; transition: all 0.2s;"
                                 onmouseover="this.style.borderColor='#3b82f6'; this.style.color='#3b82f6'"
                                 onmouseout="this.style.borderColor='rgba(255,255,255,0.1)'; this.style.color='inherit'"
                                 title="Ver Detalles">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                    </td>
                </tr>
            `;
        } catch (rowError) {
            console.error("Error rendering history row:", rowError, data);
        }
    });
    historyTableBody.innerHTML = historyHtml;

    updateReviewCounter(reviewCount);
    if (window.lucide) window.lucide.createIcons();
}

// NEW: Helper to update counter UI
function updateReviewCounter(count) {
    const counterEl = document.getElementById('review-pending-count');
    if (!counterEl) {
        // Inject counter if not exists (Lazy Injection)
        const header = document.querySelector('h2'); // "Historial de Incidentes"
        if (header) {
            const badge = document.createElement('span');
            badge.id = 'review-pending-count';
            badge.className = 'badge badge-warning';
            badge.style.display = 'none';
            badge.style.marginLeft = '10px';
            badge.style.fontSize = '0.9rem';
            header.appendChild(badge);
        }
    }

    // Update existing element
    const badge = document.getElementById('review-pending-count');
    if (badge) {
        if (count > 0) {
            badge.style.display = 'inline-block';
            badge.innerHTML = `⚠️ ${count} Pendientes de Revisión`;
            badge.style.backgroundColor = '#fef08a';
            badge.style.color = '#854d0e';
            badge.style.border = '1px solid #fde047';
        } else {
            badge.style.display = 'none';
        }
    }
}

window.openModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        // Auto focus first input if possible
        const input = modal.querySelector('input, select');
        if (input) input.focus();
    }
};

// Confirmation Modal (Professional)
let confirmCallback = null;

window.showConfirm = function (title, message, onConfirm, buttonText = 'Confirmar') {
    const overlay = document.getElementById('confirm-modal-overlay');
    const titleEl = document.getElementById('confirm-modal-title');
    const messageEl = document.getElementById('confirm-modal-message');
    const btn = document.getElementById('confirm-modal-btn');

    if (!overlay) return;

    titleEl.textContent = title;
    messageEl.textContent = message;
    btn.textContent = buttonText;
    confirmCallback = onConfirm;

    btn.onclick = () => {
        if (confirmCallback) confirmCallback();
        window.hideConfirm();
    };

    overlay.classList.add('active');
};

window.hideConfirm = function () {
    const overlay = document.getElementById('confirm-modal-overlay');
    if (overlay) overlay.classList.remove('active');
    confirmCallback = null;
};

window.closeModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
};

// --- NEW INCIDENT ---
// Helper GLOBAL para botones con carga
window.setBtnLoading = function (btnId, isLoading, originalText = null) {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    if (isLoading) {
        if (!btn.dataset.originalText) {
            btn.dataset.originalText = originalText || btn.innerHTML;
        }
        // Force width to prevent layout jump if possible, or just replace content
        const width = btn.offsetWidth;
        if (width > 0) btn.style.minWidth = width + 'px';

        btn.innerHTML = `<i data-lucide="loader-2" class="animate-spin" style="width:18px;height:18px;margin-right:8px;"></i> Procesando...`;
        btn.disabled = true;
        btn.classList.add('opacity-75', 'cursor-not-allowed');
    } else {
        btn.innerHTML = btn.dataset.originalText;
        btn.disabled = false;
        btn.classList.remove('opacity-75', 'cursor-not-allowed');
        btn.style.minWidth = '';
        if (window.lucide) window.lucide.createIcons();
    }
};

// --- NEW INCIDENT ---
window.submitNewIncident = async () => {
    const nodeSelect = document.getElementById('new-incident-node');
    const nodeName = nodeSelect.options[nodeSelect.selectedIndex].text; // Guardamos NOMBRE, no ID
    const nodeId = nodeSelect.value;
    const type = document.getElementById('new-incident-type').value;

    const btnId = 'btn-submit-incident'; // ID added in HTML previously or assumed to exist? 
    // Wait, I saw id="btn-submit-incident" in HTML line 2219 in Step 1775. Yes it exists.

    if (!nodeId) {
        alert("Por favor seleccione un Nodo.");
        return;
    }

    // --- DUPLICATE CHECK ---
    const isAlreadyActive = allIncidentsCache.some(inc =>
        !inc.end_date &&
        inc.node === nodeName
    );
    if (isAlreadyActive) {
        if (!confirm(`⚠️ El nodo "${nodeName}" ya tiene un incidente activo.\n\n¿Estás seguro de que quieres crear otro?`)) {
            return;
        }
    }

    // Get ticket from user input, or generate if empty
    const ticketInput = document.getElementById('new-incident-ticket');
    const userTicket = ticketInput?.value?.trim()?.toUpperCase();
    const newTicketId = userTicket || generateTicketId();

    // Validate ticket format if provided
    if (userTicket && userTicket.length < 3) {
        alert("El número de ticket debe tener al menos 3 caracteres.");
        ticketInput.focus();
        return;
    }

    // Set Loading State
    window.setBtnLoading(btnId, true);

    const now = new Date();

    const docData = {
        ticket_id: newTicketId,
        node: nodeName,
        node_id: nodeId, // Guardamos también el ID por si acaso
        failure_type: type,
        start_date: now,
        end_date: null,
        affected_customers: 0,
        affected_pons: selectedPons, // Array de PONs afectados
        created_at: now
    };

    try {
        const promises = [];

        // 1. Main Incident
        promises.push(callApi('/uptime/create', 'POST', docData));

        // 2. Cascade Incidents
        const cascadeCheckbox = document.getElementById('cascade-report-check');
        if (cascadeCheckbox && cascadeCheckbox.checked) {
            const dependents = getDependentNodes(nodeName);
            dependents.forEach((childNode, index) => {
                const childTicketId = newTicketId + '-' + (index + 1);
                const childDoc = {
                    ticket_id: childTicketId,
                    node: childNode,
                    node_id: "AUTO_" + childNode.replace(/\s+/g, '_'),
                    failure_type: "Sin conectividad por dependencia",
                    failure_reason: `Falla en Nodo Superior (${nodeName})`,
                    start_date: now,
                    end_date: null,
                    affected_customers: 0,
                    affected_pons: ["NODO_COMPLETO"],
                    created_at: now,
                    notes: "Reporte automático por cascada."
                };
                promises.push(callApi('/uptime/create', 'POST', childDoc));
            });
        }

        await Promise.all(promises);

        window.closeModal('modal-new-incident');

        // Reset Inputs
        selectedPons = [];
        isFullNodeDown = false;
        const fullNodeCheckbox = document.getElementById('full-node-down-checkbox');
        if (fullNodeCheckbox) fullNodeCheckbox.checked = false;
        updateSelectedPonsUI();
        document.getElementById('new-incident-node').value = "";
        document.getElementById('pon-selection-container').style.display = 'none';
        // Reset ticket input
        const ticketInputReset = document.getElementById('new-incident-ticket');
        if (ticketInputReset) ticketInputReset.value = "";

        // Show success toast
        if (window.showToast) {
            window.showToast(`✅ Incidente #${newTicketId} creado exitosamente`, 'success');
        }

        // Reload data immediately
        await loadUptimeLogs();

    } catch (e) {
        console.error(e);
        if (window.showToast) {
            window.showToast(`❌ Error: ${e.message}`, 'error');
        } else {
            alert("Error creando incidente: " + e.message);
        }
    } finally {
        // Reset Loading State
        window.setBtnLoading(btnId, false);
    }
};

// --- DIAGNOSE / EDIT ---
window.viewDetails = async (id) => {
    // 1. Fetch doc details
    try {
        const doc = await db.collection(COLLECTION_NAME).doc(id).get();
        if (!doc.exists) return;
        const data = doc.data();

        // 2. Populate Modal
        document.getElementById('diagnose-ticket-id').value = id;
        document.getElementById('diagnose-type').value = data.failure_type || 'Sin Clasificar';
        document.getElementById('diagnose-reason').value = data.failure_reason || '';
        document.getElementById('diagnose-clients').value = data.affected_customers || 0;
        document.getElementById('diagnose-clients-bool').checked = !!data.has_affected_customers;
        document.getElementById('diagnose-obs').value = data.notes || ''; // Mapped from observation

        // Set Area button group
        const areaValue = data.owner_area || 'NOC';
        document.getElementById('diagnose-area').value = areaValue;

        // Update button active state
        document.querySelectorAll('.area-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.area === areaValue) {
                btn.classList.add('active');
            }
        });

        // 3. Open Modal
        window.openModal('modal-diagnose');
    } catch (e) {
        console.error(e);
    }
};

// Area button selection handler
window.selectArea = function (btn) {
    // Remove active from all
    document.querySelectorAll('.area-btn').forEach(b => b.classList.remove('active'));
    // Add active to clicked
    btn.classList.add('active');
    // Update hidden input
    document.getElementById('diagnose-area').value = btn.dataset.area;
};

window.saveDiagnosis = async () => {
    const id = document.getElementById('diagnose-ticket-id').value;
    const btnId = 'btn-save-diagnose';
    if (!id) return;

    window.setBtnLoading(btnId, true);

    const updates = {
        failure_type: document.getElementById('diagnose-type').value,
        failure_reason: document.getElementById('diagnose-reason').value,
        owner_area: document.getElementById('diagnose-area').value,
        affected_customers: parseInt(document.getElementById('diagnose-clients').value) || 0,
        has_affected_customers: document.getElementById('diagnose-clients-bool').checked,
        notes: document.getElementById('diagnose-obs').value,
        needs_review: false // <--- NEW: Reviewed!
    };

    try {
        // REPLACE DIRECT DB UPDATE VIA API
        // await db.collection(COLLECTION_NAME).doc(id).update(updates);
        await callApi(`/uptime/${id}`, 'PUT', updates);

        window.closeModal('modal-diagnose');

        if (window.showToast) {
            window.showToast('✅ Diagnóstico guardado', 'success');
        }

        await loadUptimeLogs();
    } catch (e) {
        console.error(e);
        if (window.showToast) {
            window.showToast(`❌ Error: ${e.message}`, 'error');
        } else {
            alert("Error actualizando: " + e.message);
        }
    } finally {
        window.setBtnLoading(btnId, false);
    }
};

// --- CLOSE INCIDENT ---
window.requestCloseIncident = (id) => {
    const incident = allIncidentsCache.find(i => i.id === id);
    const nodeName = incident ? incident.node : 'Desconocido';

    // Set Modal Data
    document.getElementById('close-ticket-id').value = id;
    document.getElementById('close-modal-node').textContent = nodeName;
    document.getElementById('close-notes').value = '';

    // Set default time to NOW (Correct format for datetime-local: YYYY-MM-DDTHH:mm)
    const now = new Date();
    // Adjust to local timezone (simple way)
    const localIso = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    document.getElementById('close-time-input').value = localIso;

    window.openModal('close-incident-modal');
};

window.confirmCloseIncident = async () => {
    const id = document.getElementById('close-ticket-id').value;
    const notes = document.getElementById('close-notes').value;
    const timeInput = document.getElementById('close-time-input').value;
    const btnId = 'btn-confirm-close';

    if (!id) return;

    window.setBtnLoading(btnId, true);

    try {
        const payload = {
            notes: notes
        };

        // If user selected a custom time, send it
        if (timeInput) {
            payload.end_date = new Date(timeInput).toISOString();
        }

        // Llamar al backend
        const result = await callApi(`/uptime/${id}/close`, 'POST', payload);

        console.log(`✅ Incidente cerrado: ${result.duration} minutos`);

        if (window.showToast) window.showToast('✅ Servicio restaurado exitosamente', 'success');

        window.closeModal('close-incident-modal');
        loadUptimeLogs();
    } catch (e) {
        console.error(e);
        alert("Error cerrando ticket: " + e.message);
    } finally {
        window.setBtnLoading(btnId, false);
    }
};

// ==========================================
// CHECK ACTIVE INCIDENTS IN FIREBASE
// ==========================================
async function checkActiveIncidentInFirebase(nodeName, deviceName, affectedPons) {
    // Use already-loaded incident cache instead of API call
    // API doesn't support filtering, so we filter locally
    const now = new Date();
    const COOLDOWN_MINUTES = 5; // Time to wait before recreating an auto-incident

    // Check for ACTIVE incidents
    const hasActive = allIncidentsCache.some(inc => {
        if (inc.end_date) return false;
        if (inc.node !== nodeName) return false;

        // Check availability
        if (inc.affected_pons) {
            return inc.affected_pons.includes(deviceName) ||
                inc.affected_pons.includes("NODO_COMPLETO") ||
                (Array.isArray(affectedPons) && affectedPons.some(pon => inc.affected_pons.includes(pon)));
        }
        return false;
    });

    if (hasActive) {
        console.log(`🔍 Cache check: Active incident found for ${nodeName}/${deviceName}`);
        return true;
    }

    // Check for RECENTLY CLOSED incidents (Cooldown)
    const recentlyClosed = allIncidentsCache.some(inc => {
        if (!inc.end_date) return false; // Skip active ones (already checked)
        if (inc.node !== nodeName) return false;

        // Verify time elapsed since closure
        let endDate = inc.end_date;
        // Handle Firestore timestamp or string
        if (endDate.toDate) endDate = endDate.toDate();
        else if (typeof endDate === 'string') endDate = new Date(endDate);

        const minutesSinceClose = (now - endDate) / (1000 * 60);
        if (minutesSinceClose > COOLDOWN_MINUTES) return false; // Too old

        // Match device
        if (inc.affected_pons) {
            return inc.affected_pons.includes(deviceName) ||
                inc.affected_pons.includes("NODO_COMPLETO") ||
                (Array.isArray(affectedPons) && affectedPons.some(pon => inc.affected_pons.includes(pon)));
        }
        return false;
    });

    if (recentlyClosed) {
        console.log(`❄️ COOLDOWN: Recently closed incident for ${nodeName} (less than ${COOLDOWN_MINUTES}m ago). Skipping auto-creation.`);
        return true; // Return TRUE to prevent creation (act as if active)
    }

    console.log(`🔍 Cache check for ${nodeName}/${deviceName}: NO ACTIVE, NO COOLDOWN`);
    return false;
}

// ==========================================
// CHECK LIVE FAILURES
// ==========================================

// Note: formatTime, formatDate, formatDuration are now imported from uptime-utils.js

function generateTicketId() {
    // Simple ID: T + Timestamp suffix
    return 'T' + Date.now().toString().slice(-6);
}

// ==========================================
// FORM VALIDATION & KEYBOARD SHORTCUTS
// ==========================================

// Validate field and add visual feedback
function validateField(element, isValid) {
    if (!element) return;
    element.classList.remove('valid', 'invalid');
    if (isValid) {
        element.classList.add('valid');
    } else {
        element.classList.add('invalid');
    }
}

// Setup field validation listeners
function setupFieldValidation() {
    const nodeSelect = document.getElementById('new-incident-node');
    const failureSelect = document.getElementById('new-incident-initial-type');

    if (nodeSelect) {
        nodeSelect.addEventListener('change', () => {
            validateField(nodeSelect, nodeSelect.value !== '');
        });
    }

    if (failureSelect) {
        failureSelect.addEventListener('change', () => {
            validateField(failureSelect, failureSelect.value !== '');
        });
    }
}

// Setup Ctrl+Enter keyboard shortcut
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl+Enter to submit new incident
        if (e.ctrlKey && e.key === 'Enter') {
            const modal = document.getElementById('modal-new-incident');
            if (modal && modal.style.display === 'flex') {
                e.preventDefault();
                const btn = document.getElementById('btn-submit-incident');
                if (btn) {
                    btn.click();
                    // Visual feedback
                    btn.style.transform = 'scale(0.95)';
                    setTimeout(() => btn.style.transform = '', 150);
                }
            }
        }

        // Escape to close modals
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(m => {
                if (m.style.display === 'flex') {
                    m.style.display = 'none';
                }
            });
        }
    });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    setupFieldValidation();
    setupKeyboardShortcuts();
});

function getFailureBadge(type) {
    if (!type) return '<span class="glass-badge secondary">? Sin Clasificar</span>';
    const lower = type.toLowerCase();

    // Icon mapping
    let icon = '';
    let styleClass = 'info';

    if (lower.includes('corte')) {
        styleClass = 'danger';
        icon = '✂️';
    } else if (lower.includes('bateria') || lower.includes('energia')) {
        styleClass = 'warning';
        icon = '⚡';
    } else if (lower.includes('dependencia')) {
        styleClass = 'warning';
        icon = '🔗';
    } else if (lower.includes('mantenimiento')) {
        styleClass = 'info';
        icon = '🛠️';
    } else if (lower.includes('equipo')) {
        styleClass = 'danger';
        icon = '📟';
    } else {
        styleClass = 'secondary';
        icon = '📝';
    }

    return `<span class="glass-badge ${styleClass}">${icon} ${type}</span>`;
}

function updateStats(active, history) {
    const activeEl = document.getElementById('stat-active-events');
    const totalEl = document.getElementById('stat-total-events');
    const affectedEl = document.getElementById('stat-affected-clients');
    const mttrEl = document.getElementById('stat-mttr');

    if (activeEl) activeEl.textContent = active.length;
    if (totalEl) totalEl.textContent = (active.length + history.length);

    // Calc total affected active
    const totalActiveClients = active.reduce((sum, item) => sum + (item.affected_customers || 0), 0);
    if (affectedEl) affectedEl.textContent = totalActiveClients;

    // Calculate MTTR (Mean Time To Repair) from closed incidents
    if (mttrEl && history.length > 0) {
        // Filter incidents that have restore_time (closed ones)
        const closedWithTime = history.filter(i => i.restore_time && i.restore_time > 0);
        if (closedWithTime.length > 0) {
            const totalMinutes = closedWithTime.reduce((sum, i) => sum + i.restore_time, 0);
            const avgMinutes = Math.round(totalMinutes / closedWithTime.length);
            const hours = Math.floor(avgMinutes / 60);
            const minutes = avgMinutes % 60;
            mttrEl.textContent = `${hours}h ${minutes}m`;
        } else {
            mttrEl.textContent = '0h 0m';
        }
    } else if (mttrEl) {
        mttrEl.textContent = '0h 0m';
    }
}

// Live Timer for Active Incidents - uses TimerManager to prevent memory leaks
function startLiveTimer(id, startDate) {
    const el = document.getElementById(`timer-${id}`);
    if (!el) return;

    // Use TimerManager from utils (imported)
    TimerManager.startTimer(id, startDate, el);
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    // Setup UI components that don't need auth
    setupPonSelectionLogic();
    setupFullNodeDownLogic();
    setupSmartSearch();
    setupCopyLastIncident();

    // === Sidebar toggle ===
    document.getElementById("menu-toggle")?.addEventListener("click", () => {
        document.getElementById("sidebar").classList.toggle("expanded");
        document.getElementById("main-content").classList.toggle("expanded");
    });

    // === Logout button ===
    document.getElementById("logout-btn")?.addEventListener("click", () => {
        auth.signOut().then(() => {
            localStorage.removeItem('userRole');
            localStorage.removeItem('userProfileCache');
            window.location.href = "login.html";
        });
    });

    // === Apply cached role immediately for sidebar visibility (optimistic UI) ===
    const cachedRole = localStorage.getItem('userRole');
    if (cachedRole) {
        applySidebarVisibility(cachedRole);
        // NOTE: We DON'T redirect here based on cache - wait for Firebase to confirm
        // This prevents false "access denied" when cache is stale or missing
    }

    // Wait for Firebase auth before loading data
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log("✅ Usuario autenticado, cargando datos...");

            // Fetch fresh role from Firestore
            try {
                const userDoc = await db.collection('userRoles').doc(user.uid).get();
                if (userDoc.exists) {
                    const userRole = userDoc.data().rol || 'user';
                    localStorage.setItem('userRole', userRole);
                    applySidebarVisibility(userRole);

                    // === ADMIN/SUPERADMIN ACCESS CONTROL ===
                    if (userRole !== 'superadmin' && userRole !== 'admin') {
                        alert('⚠️ Acceso restringido: Esta vista solo está disponible para Admin y SuperAdmin.');
                        window.location.href = 'directorio.html';
                        return;
                    }
                }
            } catch (error) {
                console.warn('[Uptime] Error fetching role, using cached:', error);
            }

            loadUptimeLogs();
            loadNodes();
            buildSearchCache();

            // Initialize Auto-Monitoring Toggle
            initAutoMonitoringToggle();

            // Initialize Sync Dude Button
            initSyncDudeButton();

            // Initialize Purge Button (Test Mode)
            setupPurgeButton();

            // Start Live Polling (Lab Integration) - only if enabled
            if (autoMonitoringEnabled) {
                startLivePolling();
            }

        } else {
            console.log("⚠️ Usuario no autenticado, redirigiendo...");
            window.location.href = 'login.html';
        }
    });
});

/**
 * Apply sidebar visibility based on user role
 */
function applySidebarVisibility(role) {
    // Hide all admin-only and superadmin-only by default
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.superadmin-only').forEach(el => el.style.display = 'none');

    // Show elements based on role
    if (role === 'admin' || role === 'superadmin') {
        document.body.classList.add('is-admin');
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
    }

    if (role === 'superadmin') {
        document.querySelectorAll('.superadmin-only').forEach(el => el.style.display = 'block');
        const liRegistros = document.getElementById('li-registros');
        if (liRegistros) liRegistros.style.display = 'block';
    }

    console.log('[Sidebar] Applied visibility for role:', role);
}

// ==========================================
// 5. LIVE LAB MONITORING
// ==========================================
// AUTO-MONITORING TOGGLE CONTROL
// ==========================================
let autoMonitoringEnabled = true;
let livePollInterval = null;

// Initialize toggle state from localStorage
function initAutoMonitoringToggle() {
    const toggle = document.getElementById('auto-monitoring-toggle');
    const toggleContainer = toggle?.closest('div.flex');

    // Get user role from cache or localStorage
    const userRole = localStorage.getItem('userRole') || currentUserRole;

    // Only show toggle for super_admin
    if (userRole !== 'superadmin') { // Changed 'super_admin' to 'superadmin' to match existing code
        if (toggleContainer) {
            toggleContainer.style.display = 'none';
        }
        console.log('🔒 Toggle hidden - only visible for superadmin'); // Changed 'super_admin' to 'superadmin'
        return; // Exit early, don't initialize toggle
    }

    // Fetch state from backend (Firestore) first for consistency across environments
    if (toggle) {
        // Set initial state while loading
        toggle.disabled = true;

        callApi('/uptime/monitoring-status', 'GET').then(data => {
            autoMonitoringEnabled = data.monitoringEnabled;
            monitoringPaused = !autoMonitoringEnabled;
            toggle.checked = autoMonitoringEnabled;
            toggle.disabled = false;
            updateMonitoringUI();
            console.log(`📡 Monitoring state loaded from backend: ${autoMonitoringEnabled ? 'ACTIVE' : 'PAUSED'}`);

            // Start/stop polling based on state
            if (autoMonitoringEnabled) {
                startLivePolling();
            } else {
                stopLivePolling();
            }
        }).catch(err => {
            console.warn('⚠️ Could not fetch monitoring state from backend, using localStorage fallback');
            // Fallback to localStorage if backend unavailable
            const savedState = localStorage.getItem('autoMonitoringEnabled');
            autoMonitoringEnabled = savedState === null ? true : savedState === 'true';
            monitoringPaused = !autoMonitoringEnabled;
            toggle.checked = autoMonitoringEnabled;
            toggle.disabled = false;
            updateMonitoringUI();
        });

        // 🔄 REALTIME LISTENER - Auto-update toggle when changed from another browser
        db.collection('config').doc('monitoring').onSnapshot((doc) => {
            if (doc.exists) {
                const newState = doc.data().enabled ?? true;
                if (newState !== autoMonitoringEnabled) {
                    autoMonitoringEnabled = newState;
                    monitoringPaused = !autoMonitoringEnabled;
                    toggle.checked = autoMonitoringEnabled;
                    updateMonitoringUI();
                    console.log(`🔄 Toggle auto-updated: ${autoMonitoringEnabled ? 'ACTIVE' : 'PAUSED'}`);

                    // Start/stop polling based on new state
                    if (autoMonitoringEnabled) {
                        startLivePolling();
                    } else {
                        stopLivePolling();
                    }
                }
            }
        }, (error) => {
            console.warn('⚠️ Realtime listener error:', error);
        });

        // Add event listener for manual toggle changes
        toggle.addEventListener('change', async (e) => {
            autoMonitoringEnabled = e.target.checked;
            monitoringPaused = !autoMonitoringEnabled; // Sync with notification suppression variable
            localStorage.setItem('autoMonitoringEnabled', autoMonitoringEnabled);
            updateMonitoringUI();

            // Sync with backend (persists across server restarts)
            try {
                await callApi('/uptime/toggle-monitoring', 'POST', { enabled: autoMonitoringEnabled });
                console.log(`📡 Backend sync: monitoring ${autoMonitoringEnabled ? 'ENABLED' : 'DISABLED'}`);
            } catch (err) {
                console.error('⚠️ Failed to sync monitoring state with backend:', err);
            }

            if (autoMonitoringEnabled) {
                console.log('✅ Auto-monitoring ENABLED');
                startLivePolling();
            } else {
                console.log('⏸️ Auto-monitoring PAUSED');
                stopLivePolling();
            }
        });
    }
}

// Initialize Sync Dude button click handler
function initSyncDudeButton() {
    const syncBtn = document.getElementById('sync-dude-btn');
    if (!syncBtn) return;

    syncBtn.addEventListener('click', async () => {
        const originalContent = syncBtn.innerHTML;
        syncBtn.disabled = true;
        syncBtn.innerHTML = `<span class="animate-spin mr-1">↻</span> Sincronizando...`;

        try {
            const result = await callApi('/uptime/sync-dude', 'POST');

            if (result.success) {
                const added = result.added?.length || 0;
                const removed = result.removed?.length || 0;
                showToast(`✅ Sync completado: +${added} agregados, -${removed} eliminados (${result.total} total)`, 'success');

                // Refresh the live status to update count
                pollLiveStatus();
            } else {
                showToast(`⚠️ Error en sync: ${result.error || 'Unknown'}`, 'error');
            }
        } catch (err) {
            console.error('Sync error:', err);
            showToast(`❌ Error de sync: ${err.message}. Solo funciona desde local.`, 'error');
        } finally {
            syncBtn.disabled = false;
            syncBtn.innerHTML = originalContent;
            // Re-render lucide icons
            if (window.lucide) window.lucide.createIcons();
        }
    });
}// Update UI based on monitoring state
function updateMonitoringUI() {
    const statusText = document.getElementById('monitoring-status-text');
    if (statusText) {
        statusText.textContent = autoMonitoringEnabled ? 'ACTIVO' : 'PAUSADO';
        statusText.className = autoMonitoringEnabled ? 'text-green-400 font-semibold' : 'text-gray-500 font-semibold';
    }
}

// Stop live polling
function stopLivePolling() {
    if (livePollInterval) {
        clearInterval(livePollInterval);
        livePollInterval = null;
        console.log('⏹️ Live polling stopped');
    }
}


function startLivePolling() {
    if (livePollInterval) clearInterval(livePollInterval);
    pollLiveStatus(); // First run
    livePollInterval = setInterval(pollLiveStatus, 15000); // Poll every 15s
}

async function pollLiveStatus() {
    const statusEl = document.getElementById('live-monitor-status');
    const dotEl = document.getElementById('live-dot');
    const pingEl = document.getElementById('live-ping');
    const textEl = document.getElementById('live-text');

    if (!statusEl) return;

    try {
        const data = await callApi('/uptime/live', 'GET');

        // Update UI -> Connected
        dotEl.classList.remove('bg-gray-500', 'bg-red-500');
        dotEl.classList.add('bg-green-500');
        pingEl.classList.add('bg-green-400');
        textEl.textContent = `Lab Connected (${data.devices.length} nodes)`;
        textEl.className = 'text-green-400';

        // Check for Failures
        checkLiveFailures(data.devices);

    } catch (e) {
        console.warn("Live Poll Failed:", e);
        dotEl.classList.remove('bg-green-500', 'bg-gray-500');
        dotEl.classList.add('bg-red-500');
        pingEl.classList.remove('bg-green-400');
        textEl.textContent = "Lab Disconnected";
        textEl.className = 'text-gray-500';
    }
}

function checkLiveFailures(devices) {
    if (!devices || !Array.isArray(devices)) return;

    // Don't create auto-incidents until initial data is loaded
    if (!dataLoaded) {
        console.log("⏳ Skipping auto-incident check - data not loaded yet");
        return;
    }

    const downDevices = devices.filter(d => d.status === 'down');

    if (downDevices.length > 0) {
        console.log("🚨 DETECTED DOWN DEVICES:", downDevices);

        downDevices.forEach(device => {
            // Use device.type and device.parent from ping mode
            let nodeName = device.name;
            let affectedPons = ["NODO_COMPLETO"];
            let failureType = "Corte de Fibra (Sitio Completo)";
            let dependentNodes = [];

            console.log("📋 Device data:", device.name, "parent:", device.parent, "type:", device.type);

            // If device has parent field (it's a PON from ping mode)
            if (device.parent) {
                nodeName = device.parent; // The incident goes to the parent node
                affectedPons = [device.name]; // The PON name is the affected item
                failureType = `Corte de ${device.name}`;
                console.log("✅ PON mode: nodeName=", nodeName, "affectedPons=", affectedPons);
            }
            // Legacy support: if device name includes _PON_
            else if (device.name.includes('_PON_')) {
                const parts = device.name.split('_PON_');
                nodeName = parts[0];
                affectedPons = [parts[1]];
                failureType = "Corte de PON " + parts[1];
            }
            // If it's a node (not a PON), check for dependent nodes
            else {
                // Get dependent nodes from topology
                dependentNodes = getDependentNodes(nodeName, true);
                console.log(`🔗 Dependent nodes for ${nodeName}:`, dependentNodes);
            }

            // Check if already creating or has active ticket
            if (pendingAutoIncidents.has(device.name)) {
                console.log(`⏩ Already creating incident for ${device.name}, skipping`);
                return;
            }

            // ✅ NEW: Check Firebase directly for active incident instead of using cache
            // This prevents re-creating incidents that were manually deleted
            checkActiveIncidentInFirebase(nodeName, device.name, affectedPons).then(hasActiveTicket => {
                if (!hasActiveTicket) {
                    // Mark as pending to prevent duplicates
                    pendingAutoIncidents.add(device.name);

                    // --- TOASTS SILENCED (BACKEND MODE) ---
                    // showToast(`🚨 ALERTA: ${device.name} detectado CAÍDO (${nodeName})`, 'error');

                    // Show dependent nodes toast if any
                    // if (dependentNodes.length > 0) {
                    //    showToast(`📡 Detectadas ${dependentNodes.length} dependencias afectadas`, 'warning');
                    // }

                    // 1. Create PRIMARY incident for the failed node
                    // --- AUTO-CREATION DISABLED (SERVER-SIDE AUTHORITY) ---
                    // Since we moved to Webhook/Backend monitoring, the frontend should NOT create tickets.
                    console.log(`⚠️ Frontend detected DOWN for ${nodeName}, but skipping creation (Backend handles it).`);
                    pendingAutoIncidents.delete(device.name);

                    /* DISABLED:
                    createAutoIncident(nodeName, affectedPons, failureType, []).then(() => {
                        showToast(`✅ Incidente creado: ${nodeName}`, 'success');

                        // 2. Create SECONDARY incidents for each dependent node
                        if (dependentNodes.length > 0) {
                            dependentNodes.forEach(depNode => {
                                const depFailureType = `Caída por Dependencia de ${nodeName}`;
                                const depPons = ["POR_DEPENDENCIA"];

                                createAutoIncident(depNode, depPons, depFailureType, [], nodeName).then(() => {
                                    console.log(`✅ Dependent incident created for ${depNode}`);
                                });
                            });
                        }

                        loadUptimeLogs();
                    }).finally(() => {
                        pendingAutoIncidents.delete(device.name);
                    });
                    */
                } else {
                    console.log(`ℹ️ Active incident already exists for ${nodeName}, skipping auto-creation`);
                }
            }).catch(err => {
                console.error("Error checking Firebase for active incident:", err);
            });
        });
    }
}

async function createAutoIncident(nodeName, affectedPons, failureType, dependentNodes = [], causedByNode = null) {
    const newTicketId = generateTicketId();
    const now = new Date();

    // Build notes based on whether this is a primary or dependency incident
    let notes = "";
    if (causedByNode) {
        notes = `⚠️ Incidente por DEPENDENCIA. Nodo padre caído: ${causedByNode}. Este nodo no tiene conectividad debido a la caída del nodo upstream.`;
    } else if (dependentNodes.length > 0) {
        notes = `🔴 Incidente PRIMARIO. Genera ${dependentNodes.length} incidentes por dependencia en: ${dependentNodes.join(', ')}`;
    } else {
        notes = "Incidente generado automáticamente por detección de falla.";
    }

    const docData = {
        ticket_id: newTicketId,
        node: nodeName,
        node_id: "AUTO_" + nodeName.replace(/\s+/g, '_'),
        failure_type: failureType || "Corte Detectado por Sistema",
        failure_reason: causedByNode
            ? `Caída por dependencia de ${causedByNode}`
            : "Reportado automáticamente por Live Monitor",
        start_date: now,
        end_date: null,
        affected_customers: 0,
        affected_pons: affectedPons || ["SISTEMA"],
        dependent_nodes: dependentNodes, // Empty for dependency incidents
        caused_by_node: causedByNode, // Parent node if this is a dependency incident
        created_at: now,
        notes: notes
    };

    try {
        await callApi('/uptime/create', 'POST', docData);
        console.log("✅ Auto-incident created:", newTicketId, causedByNode ? `(caused by ${causedByNode})` : "");
    } catch (e) {
        console.error("❌ Failed to create auto-incident:", e);
        showToast("Error creando incidente automático", 'error');
    }
}

// ==========================================
// 4. DYNAMIC NODE/PON LOGIC
// ==========================================

async function loadNodes() {
    const nodeSelect = document.getElementById('new-incident-node');
    if (!nodeSelect) return;

    try {
        const nodes = await callApi('/uptime/nodes', 'GET');
        let html = '<option value="">-- Seleccione Nodo --</option>';
        nodes.forEach(node => {
            html += `<option value="${node.id}">${node.name}</option>`;
        });

        // Add Fibra Silica Options (Virtual Nodes)
        html += '<optgroup label="Tramos de Fibra Silica (Cortes)">';
        Object.keys(topology).forEach(key => {
            if (key.includes('FIBRA SILICA')) {
                html += `<option value="${key}">〰️ ${key}</option>`;
            }
        });
        html += '</optgroup>';

        nodeSelect.innerHTML = html;

        // Cascading Event
        nodeSelect.addEventListener('change', (e) => {
            const nodeId = e.target.value;
            const ponContainer = document.getElementById('pon-selection-container');

            // Clear current selection
            selectedPons = [];
            isFullNodeDown = false;
            const fullNodeCheckbox = document.getElementById('full-node-down-checkbox');
            if (fullNodeCheckbox) fullNodeCheckbox.checked = false;
            updateSelectedPonsUI();

            // Show/Hide PON container
            if (nodeId) {
                ponContainer.style.display = 'block';
                loadPonCheckboxes(nodeId);

                // Check for cascading dependencies (Topo Check)
                const nodeName = e.target.options[e.target.selectedIndex].text;
                const dependents = getDependentNodes(nodeName);

                const depAlert = document.getElementById('dependency-alert');
                if (depAlert) depAlert.remove(); // Clean previous

                if (dependents.length > 0) {
                    const alertHtml = `
                        <div id="dependency-alert" style="margin-top: 0.5rem; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); padding: 0.75rem; border-radius: 8px; color: #fbbf24; font-size: 0.85rem; display: flex; align-items: flex-start; gap: 0.5rem;">
                            <i data-lucide="network" style="width: 16px; height: 16px; margin-top: 2px; flex-shrink: 0;"></i>
                            <div>
                                <strong>Topología Detectada:</strong> Este nodo alimenta a otros nodos:
                                <div style="margin: 0.25rem 0; font-family: monospace; opacity: 0.9;">${dependents.join(', ')}</div>
                                <label style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; cursor: pointer;">
                                    <input type="checkbox" id="cascade-report-check" checked> 
                                    <span>Crear reportes para estos nodos también</span>
                                </label>
                            </div>
                        </div>
                    `;
                    // Insert after node selector
                    nodeSelect.parentNode.insertAdjacentHTML('beforeend', alertHtml);
                    if (window.lucide) window.lucide.createIcons();
                }

            } else {
                ponContainer.style.display = 'none';
                const depAlert = document.getElementById('dependency-alert');
                if (depAlert) depAlert.remove();
            }
        });

    } catch (e) {
        console.error("Error loading nodes:", e);
        nodeSelect.innerHTML = '<option value="">Error cargar nodos</option>';
    }
}

async function loadPonLetters(nodeId) {
    const letterSelect = document.getElementById('pon-letter-select');
    letterSelect.disabled = true;
    letterSelect.innerHTML = '<option value="">Cargando...</option>';

    try {
        const snapshot = await db.collection('Nodos').doc(nodeId).collection('PONLetters').orderBy('name').get();
        let html = '<option value="">1. Tarjeta...</option>';
        snapshot.forEach(doc => {
            const data = doc.data();
            html += `<option value="${doc.id}">Tarjeta ${data.name}</option>`;
        });
        letterSelect.innerHTML = html;
        letterSelect.disabled = false;

        letterSelect.onchange = (e) => {
            const letterId = e.target.value;
            if (letterId) {
                loadPons(nodeId, letterId);
            } else {
                document.getElementById('pon-port-select').disabled = true;
            }
        };
    } catch (e) {
        console.error("Error loading letters:", e);
    }
}

async function loadPons(nodeId, letterId) {
    const portSelect = document.getElementById('pon-port-select');
    portSelect.disabled = true;
    portSelect.innerHTML = '<option value="">Cargando...</option>';

    try {
        const snapshot = await db.collection('Nodos').doc(nodeId).collection('PONLetters').doc(letterId).collection('PONs').get();
        let html = '<option value="">2. Puerto...</option>';

        const pons = [];
        snapshot.forEach(doc => {
            pons.push({ id: doc.id, ...doc.data() });
        });

        // Sort alphanumerically
        pons.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

        pons.forEach(pon => {
            html += `<option value="${pon.name}">${pon.name}</option>`;
        });

        portSelect.innerHTML = html;
        portSelect.disabled = false;

        portSelect.onchange = (e) => {
            document.getElementById('add-pon-btn').disabled = !e.target.value;
        };

    } catch (e) {
        console.error("Error loading pons:", e);
    }
}

function setupPonSelectionLogic() {
    // Setup "Clear All" button
    const clearBtn = document.getElementById('clear-all-pons-btn');
    if (clearBtn) {
        clearBtn.onclick = (e) => {
            e.preventDefault();
            selectedPons = [];
            // Uncheck all checkboxes
            document.querySelectorAll('#pon-multi-select-container input[type="checkbox"]').forEach(cb => {
                cb.checked = false;
            });
            updateSelectedPonsUI();
        };
    }
}

// NEW: Load PONs as collapsible accordion grouped by card (tarjeta)
async function loadPonCheckboxes(nodeId) {
    const container = document.getElementById('pon-multi-select-container');
    if (!container) return;

    container.innerHTML = '<p style="color: #6b7280; font-size: 0.8rem; text-align: center; padding: 0.5rem;"><i data-lucide="loader-2" class="animate-spin" style="width:16px; height:16px;"></i> Cargando PONs...</p>';

    try {
        // Load all letters (cards) for this node
        const lettersSnapshot = await db.collection('Nodos').doc(nodeId).collection('PONLetters').orderBy('name').get();

        if (lettersSnapshot.empty) {
            // ===============================================
            // FALLBACK PARA NODOS SIN DATOS EN DB (Ej: Radales)
            // ===============================================
            const nodeSelect = document.getElementById('new-incident-node');
            const nodeName = nodeSelect.options[nodeSelect.selectedIndex].text.toUpperCase();

            // Radales KML Injection
            if (nodeName.includes('RADALES')) {
                const manualPons = [
                    { name: 'PON A0', id: 'pon_a0' },
                    { name: 'PON A1', id: 'pon_a1' },
                    { name: 'PON A2', id: 'pon_a2' },
                    { name: 'PON A3', id: 'pon_a3' },
                    { name: 'PON A4', id: 'pon_a4' },
                    { name: 'PON A5', id: 'pon_a5' },
                    { name: 'PON A6', id: 'pon_a6' },
                    { name: 'PON A7', id: 'pon_a7' }
                ];

                // Sort alphanumerically
                manualPons.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
                const letterName = "A"; // Hardcoded for Radales manual card

                let fallbackHtml = `
                <div class="pon-accordion open" data-card="${letterName}">
                    <div class="pon-accordion-header" onclick="window.togglePonAccordion(this.parentElement)">
                        <div class="pon-accordion-title">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
                            Tarjeta ${letterName} (Manual)
                            <span class="pon-accordion-badge" data-card-badge="${letterName}">0/${manualPons.length}</span>
                        </div>
                        <div class="pon-accordion-actions">
                            <button type="button" class="btn-select-all" onclick="event.stopPropagation(); window.toggleAllPonsInCard('${letterName}')">
                                Todos
                            </button>
                            <svg class="pon-accordion-toggle" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                        </div>
                    </div>
                    <div class="pon-accordion-content">
                        <div class="pon-accordion-grid">
                            ${manualPons.map(pon => `
                                <div class="pon-chip" data-pon="${pon.name}" data-card="${letterName}" onclick="window.togglePonChip(this)">
                                    ${pon.name.replace('PON ', '')}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                `;

                container.innerHTML = fallbackHtml;
                if (window.lucide) window.lucide.createIcons();
                return;
            }

            container.innerHTML = '<p style="color: #9ca3af; font-size: 0.8rem; text-align: center;">Este nodo no tiene PONs configurados</p>';
            return;
        }

        let html = '';
        currentNodePonsData = []; // Reset cache

        for (const letterDoc of lettersSnapshot.docs) {
            const letterData = letterDoc.data();
            const letterId = letterDoc.id;
            const letterName = letterData.name;

            // Load PONs for this letter
            const ponsSnapshot = await db.collection('Nodos').doc(nodeId)
                .collection('PONLetters').doc(letterId)
                .collection('PONs').get();

            if (ponsSnapshot.empty) continue;

            const pons = [];
            ponsSnapshot.forEach(ponDoc => {
                const ponData = ponDoc.data();
                pons.push({ id: ponDoc.id, name: ponData.name });
                currentNodePonsData.push(ponData.name);
            });

            // Sort alphanumerically
            pons.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

            // Generate accordion HTML for this card
            html += `
                <div class="pon-accordion" data-card="${letterName}">
                    <div class="pon-accordion-header" onclick="window.togglePonAccordion(this.parentElement)">
                        <div class="pon-accordion-title">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
                            Tarjeta ${letterName}
                            <span class="pon-accordion-badge" data-card-badge="${letterName}">0/${pons.length}</span>
                        </div>
                        <div class="pon-accordion-actions">
                            <button type="button" class="btn-select-all" onclick="event.stopPropagation(); window.toggleAllPonsInCard('${letterName}')">
                                Todos
                            </button>
                            <svg class="pon-accordion-toggle" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                        </div>
                    </div>
                    <div class="pon-accordion-content">
                        <div class="pon-accordion-grid">
                            ${pons.map(pon => `
                                <div class="pon-chip" data-pon="${pon.name}" data-card="${letterName}" onclick="window.togglePonChip(this)">
                                    ${pon.name.replace('PON ', '')}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;

        // Re-init icons
        if (window.lucide) window.lucide.createIcons();

    } catch (error) {
        console.error("Error loading PON checkboxes:", error);
        container.innerHTML = '<p style="color: #ef4444; font-size: 0.8rem; text-align: center;">Error cargando PONs</p>';
    }
}

// Toggle accordion open/close
window.togglePonAccordion = function (accordion) {
    accordion.classList.toggle('open');
};

// Toggle individual PON chip selection
window.togglePonChip = function (chip) {
    const ponName = chip.dataset.pon;
    const cardName = chip.dataset.card;

    chip.classList.toggle('selected');

    if (chip.classList.contains('selected')) {
        if (!selectedPons.includes(ponName)) {
            selectedPons.push(ponName);
        }
    } else {
        selectedPons = selectedPons.filter(p => p !== ponName);
    }

    updatePonBadge(cardName);
    updateSelectedPonsUI();
};

// Toggle all PONs in a card
window.toggleAllPonsInCard = function (cardName) {
    const accordion = document.querySelector(`.pon-accordion[data-card="${cardName}"]`);
    if (!accordion) return;

    const chips = accordion.querySelectorAll('.pon-chip');
    const allSelected = Array.from(chips).every(c => c.classList.contains('selected'));

    chips.forEach(chip => {
        const ponName = chip.dataset.pon;

        if (allSelected) {
            chip.classList.remove('selected');
            selectedPons = selectedPons.filter(p => p !== ponName);
        } else {
            chip.classList.add('selected');
            if (!selectedPons.includes(ponName)) {
                selectedPons.push(ponName);
            }
        }
    });

    updatePonBadge(cardName);
    updateSelectedPonsUI();
};

// Update badge counter for a card
function updatePonBadge(cardName) {
    const accordion = document.querySelector(`.pon-accordion[data-card="${cardName}"]`);
    if (!accordion) return;

    const chips = accordion.querySelectorAll('.pon-chip');
    const selectedCount = accordion.querySelectorAll('.pon-chip.selected').length;
    const badge = accordion.querySelector(`[data-card-badge="${cardName}"]`);

    if (badge) {
        badge.textContent = `${selectedCount}/${chips.length}`;
        badge.style.background = selectedCount > 0 ? '#22c55e' : '';
    }
}

// NEW: Setup "Full Node Down" checkbox logic
function setupFullNodeDownLogic() {
    const checkbox = document.getElementById('full-node-down-checkbox');
    const multiSelectWrapper = document.getElementById('pon-multi-select-wrapper');

    if (!checkbox) return;

    checkbox.addEventListener('change', () => {
        isFullNodeDown = checkbox.checked;

        if (isFullNodeDown) {
            // Hide PON selection, mark all PONs as affected
            if (multiSelectWrapper) multiSelectWrapper.style.display = 'none';
            selectedPons = ['NODO_COMPLETO']; // Special marker
        } else {
            // Show PON selection again
            if (multiSelectWrapper) multiSelectWrapper.style.display = 'block';
            selectedPons = [];
        }

        updateSelectedPonsUI();
    });
}

// Update UI with selected PONs
function updateSelectedPonsUI() {
    // 1. Update the textual counter (Fixed Logic)
    const countSpan = document.getElementById('selected-pons-count');
    if (countSpan) {
        if (isFullNodeDown) {
            countSpan.textContent = "Todo el nodo";
            countSpan.style.color = "#ef4444";
        } else {
            countSpan.textContent = `${selectedPons.length} seleccionados`;
            countSpan.style.color = selectedPons.length > 0 ? "#3b82f6" : "#9ca3af";
        }
    }

    // 2. Update visual list/badges
    const container = document.getElementById('selected-pons-list');
    const summary = document.getElementById('selected-pons-summary');

    if (!container) return;

    if (isFullNodeDown) {
        // Show "Full Node" indicator
        if (summary) {
            summary.style.display = 'block';
            summary.style.background = 'rgba(239, 68, 68, 0.2)';
            summary.style.borderLeft = '3px solid #ef4444';
        }
        container.innerHTML = '<span class="badge badge-danger" style="padding: 0.3rem 0.6rem;">🔴 TODO EL NODO</span>';
    } else if (selectedPons.length > 0) {
        // Show selected PONs
        if (summary) {
            summary.style.display = 'block';
            summary.style.background = 'rgba(59, 130, 246, 0.1)';
            summary.style.borderLeft = '3px solid #3b82f6';
        }
        container.innerHTML = selectedPons.map(pon => `
            <span class="badge badge-info" style="display: inline-flex; align-items: center; gap: 3px; padding: 0.2rem 0.4rem; font-size: 0.75rem;">
                ${pon.replace('PON ', '')}
                <button onclick="window.removePon('${pon}')" style="background:none; border:none; color:inherit; cursor:pointer; padding:0; display:flex; margin-left:2px;">
                    <i data-lucide="x" style="width:12px; height:12px;"></i>
                </button>
            </span>
        `).join('');
    } else {
        // Hide summary when nothing selected
        if (summary) summary.style.display = 'none';
        container.innerHTML = '';
    }

    if (window.lucide) window.lucide.createIcons();
}

// ... removePon logic stays same ...

function setupSmartSearch() {
    const searchInput = document.getElementById('quick-search-input');
    const suggestionsDiv = document.getElementById('search-suggestions');

    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();

        if (query.length < 2) {
            suggestionsDiv.style.display = 'none';
            return;
        }

        // Search in nodes ONLY (User Request: "solo el nodo")
        const matchingNodes = allNodesData.filter(node =>
            node.name.toLowerCase().includes(query)
        );

        if (matchingNodes.length === 0) {
            suggestionsDiv.innerHTML = '<div style="padding:0.5rem; color:#999;">No se encontraron resultados</div>';
            suggestionsDiv.style.display = 'block';
            return;
        }

        let html = '';

        // Render node matches
        if (matchingNodes.length > 0) {
            html += '<div style="font-weight:600; font-size:0.75rem; color:#9ca3af; margin-bottom:0.5rem;">NODOS</div>';
            matchingNodes.slice(0, 3).forEach(node => {
                html += `
                    <div class="search-result-item" data-type="node" data-node-id="${node.id}" data-node-name="${node.name}"
                        style="padding: 0.5rem; cursor: pointer; border-radius: 4px; margin-bottom: 0.25rem; background: rgba(255,255,255,0.05);">
                        <i data-lucide="server" style="width:14px; height:14px;"></i>
                        <strong>${node.name}</strong>
                    </div>
                `;
            });
        }

        suggestionsDiv.innerHTML = html;
        suggestionsDiv.style.display = 'block';

        // Re-init lucide icons
        if (window.lucide) window.lucide.createIcons();

        // Add click handlers
        suggestionsDiv.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => handleSearchSelection(item));
        });
    });

    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
            suggestionsDiv.style.display = 'none';
        }
    });
}

function handleSearchSelection(item) {
    const type = item.dataset.type;
    const nodeId = item.dataset.nodeId;
    const nodeName = item.dataset.nodeName;

    // Set the node dropdown
    const nodeSelect = document.getElementById('new-incident-node');
    nodeSelect.value = nodeId;

    // Trigger change event to load PONs
    nodeSelect.dispatchEvent(new Event('change'));

    if (type === 'pon') {
        const ponName = item.dataset.ponName;

        // Wait for cascade to load, then auto-select PON
        setTimeout(() => {
            // Extract letter and port from PON name (e.g., "PON A3" -> letter "A", port "3")
            const match = ponName.match(/PON\s*([A-Z])(\d+)/i);
            if (match) {
                const letter = match[1].toUpperCase();
                const port = match[2];

                // Select letter
                const letterSelect = document.getElementById('pon-letter-select');
                const letterOption = Array.from(letterSelect.options).find(opt =>
                    opt.text.includes(letter)
                );
                if (letterOption) {
                    letterSelect.value = letterOption.value;
                    letterSelect.dispatchEvent(new Event('change'));

                    // Wait for ports to load, then select port
                    setTimeout(() => {
                        const portSelect = document.getElementById('pon-port-select');
                        portSelect.value = ponName;
                        portSelect.dispatchEvent(new Event('change'));

                        // Auto-click "Add PON" button
                        document.getElementById('add-pon-btn').click();
                    }, 300);
                }
            }
        }, 300);
    }

    // Clear search and hide suggestions
    document.getElementById('quick-search-input').value = '';
    document.getElementById('search-suggestions').style.display = 'none';
}

async function buildSearchCache() {
    const CACHE_KEY = 'uptime_search_cache';
    const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas

    try {
        // 1. Check LocalStorage
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const { timestamp, data } = JSON.parse(cached);
            const age = Date.now() - timestamp;

            if (age < CACHE_DURATION) {
                console.log(`📦 Usando caché de búsqueda (Edad: ${(age / 60000).toFixed(1)} min)`);
                allNodesData = data.nodes || [];
                allPonsData = data.pons || [];
                return; // SKIP API CALL
            }
        }

        // 2. Fetch from API if no cache or expired
        console.log("🌐 Cache expirado o inexistente. Descargando datos de búsqueda...");
        const data = await callApi('/uptime/search-data', 'GET');

        allNodesData = data.nodes || [];
        allPonsData = data.pons || [];

        // 3. Save to LocalStorage
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            data: data
        }));

        console.log(`✅ Search cache built & saved: ${allNodesData.length} nodes, ${allPonsData.length} PONs`);
    } catch (error) {
        console.error("Error building search cache:", error);
    }
}

function setupCopyLastIncident() {
    const btn = document.getElementById('copy-last-incident-btn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        try {
            // Fetch the most recent incident via Backend API
            const lastIncident = await callApi('/uptime/last', 'GET');

            if (!lastIncident) {
                alert("No hay incidentes previos para copiar.");
                return;
            }

            lastIncidentData = lastIncident;

            // Pre-fill the form
            if (lastIncident.node_id) {
                const nodeSelect = document.getElementById('new-incident-node');
                nodeSelect.value = lastIncident.node_id;
                nodeSelect.dispatchEvent(new Event('change'));

                // Wait for PONs to load, then sync checkboxes
                if (lastIncident.affected_pons && lastIncident.affected_pons.length > 0) {
                    setTimeout(() => {
                        selectedPons = [...lastIncident.affected_pons];
                        updateSelectedPonsUI();
                        // Sync checkboxes with selected PONs
                        selectedPons.forEach(pon => {
                            const checkbox = document.querySelector(`.pon-checkbox[value="${pon}"]`);
                            if (checkbox) checkbox.checked = true;
                        });
                    }, 500);
                }
            }

            if (lastIncident.failure_type) {
                document.getElementById('new-incident-type').value = lastIncident.failure_type;
            }

            // Visual feedback
            btn.innerHTML = '<i data-lucide="check"></i> ¡Copiado!';
            btn.style.background = '#10b981';
            if (window.lucide) window.lucide.createIcons();

            setTimeout(() => {
                btn.innerHTML = '<i data-lucide="copy"></i> Copiar del Último Incidente';
                btn.style.background = '';
                if (window.lucide) window.lucide.createIcons();
            }, 2000);

        } catch (error) {
            console.error("Error copying last incident:", error);
            alert("Error al copiar el último incidente: " + error.message);
        }
    });
}

// ==========================================
// 6. BATTERY MODAL LOGIC (Moved from HTML)
// ==========================================

window.openBatteryModal = function () {
    // Copy nodes from main selector
    const mainSelector = document.getElementById('new-incident-node');
    const batterySelector = document.getElementById('battery-node');

    // Si la lista principal está vacía (no cargó), intentar cargarla o usar caché
    if (mainSelector && batterySelector) {
        if (mainSelector.options.length <= 1 && allNodesData.length > 0) {
            // Populate manually if main is empty but we have data
            batterySelector.innerHTML = '<option value="">-- Seleccione Nodo --</option>';
            allNodesData.forEach(node => {
                const opt = document.createElement('option');
                opt.value = node.id; // "AUTO_NOMBRE"
                opt.textContent = node.name;
                batterySelector.appendChild(opt);
            });
        } else {
            // Copy from main
            batterySelector.innerHTML = mainSelector.innerHTML;
        }
    }
    window.openModal('modal-battery');
};

window.submitBatteryIncident = async function () {
    const nodeSelect = document.getElementById('battery-node');
    const nodeName = nodeSelect.options[nodeSelect.selectedIndex]?.text;
    const nodeId = nodeSelect.value;
    const btnId = 'btn-submit-battery';

    if (!nodeId) {
        showToast("Por favor seleccione un Nodo.", 'error');
        return;
    }

    window.setBtnLoading(btnId, true);

    const ticketId = 'T' + Math.floor(100000 + Math.random() * 900000);
    const now = new Date();

    const docData = {
        ticket_id: ticketId,
        node: nodeName,
        node_id: nodeId,
        failure_type: "UPS en Bateria",
        failure_reason: "",
        owner_area: "Infraestructuras",
        start_date: now,
        end_date: null,
        affected_customers: 0,
        affected_pons: ["NODO_COMPLETO"],
        notes: "Registro rápido - Nodo en batería",
        created_at: now
    };

    try {
        // Use the internal callApi which HAS AUTH TOKEN
        console.log("⚡ Registrando en batería via API:", nodeName);
        await callApi('/uptime/create', 'POST', docData);

        window.closeModal('modal-battery');
        showToast(`⚡ Nodo ${nodeName} registrado en batería`, 'success');
        await loadUptimeLogs();

    } catch (e) {
        console.error("Battery Register Error:", e);
        showToast("Error: " + e.message, 'error');
    } finally {
        window.setBtnLoading(btnId, false);
    }
};

// ==========================================
// SMART SEARCH IMPLEMENTATION (Uptime Node Logic)
// ==========================================
function initSmartSearch() {
    const searchInput = document.getElementById('quick-search-input');
    const suggestionsDiv = document.getElementById('search-suggestions');
    const nodeSelect = document.getElementById('new-incident-node');

    if (!searchInput || !suggestionsDiv || !nodeSelect) return;

    // Combine topology keys and aliases for search
    const getSearchableItems = () => {
        const items = new Set();
        // Add all main nodes/fibers from topology
        Object.keys(topology).forEach(key => items.add(key));
        // Add all aliases keys
        if (aliases) {
            Object.keys(aliases).forEach(key => items.add(key));
        }
        return Array.from(items);
    };

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toUpperCase();
        if (query.length < 2) {
            suggestionsDiv.style.display = 'none';
            return;
        }

        const items = getSearchableItems();
        const matches = items.filter(item => item.includes(query));

        if (matches.length > 0) {
            suggestionsDiv.innerHTML = matches.map(match => {
                // If it's an alias, show what it maps to
                const realNode = aliases && aliases[match] ? aliases[match] : match;
                const display = aliases && aliases[match] ? `${match} → ${realNode}` : match;
                // Add icon based on type (Fiber vs Node)
                const icon = match.includes('FIBRA') || match.includes('SILICA') ? '〰️' : '📍';

                return `<div class="suggestion-item" style="padding: 4px 8px; cursor: pointer; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.1);" 
                             onclick="window.selectSmartSearch('${realNode}')">
                            ${icon} ${display}
                        </div>`;
            }).join('');
            suggestionsDiv.style.display = 'block';
        } else {
            suggestionsDiv.style.display = 'none';
        }
    });

    // Close suggestions on click outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
            suggestionsDiv.style.display = 'none';
        }
    });
}

// Global function for onclick handler in HTML string
window.selectSmartSearch = function (nodeName) {
    const searchInput = document.getElementById('quick-search-input');
    const suggestionsDiv = document.getElementById('search-suggestions');
    const nodeSelect = document.getElementById('new-incident-node');

    if (!nodeSelect) return;

    // 1. Check if option exists in select, if not add it (Virtual Nodes/Fibers)
    let optionExists = false;
    for (let i = 0; i < nodeSelect.options.length; i++) {
        if (nodeSelect.options[i].value === nodeName) {
            optionExists = true;
            break;
        }
    }

    if (!optionExists) {
        console.log("Adding new virtual node option:", nodeName);
        const newOption = new Option(nodeName, nodeName);
        nodeSelect.add(newOption);
    }

    // 2. Set Value
    nodeSelect.value = nodeName;

    // 3. Trigger Change event to run cascading logic
    const event = new Event('change');
    nodeSelect.dispatchEvent(event);

    // 4. UI Cleanup
    if (searchInput) searchInput.value = nodeName;
    if (suggestionsDiv) suggestionsDiv.style.display = 'none';
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSmartSearch);
} else {
    initSmartSearch();
}

// ==========================================
// 6. TEST MODE UTILITIES
// ==========================================
function setupPurgeButton() {
    const btn = document.getElementById('purge-incidents-btn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        if (confirm("⚠️ ¿ESTÁS SEGURO?\n\nEsto eliminará TODOS los incidentes (abiertos y cerrados) de la base de datos y limpiará la vista actual.\n\nEsta acción no se puede deshacer.")) {
            try {
                const originalContent = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin" style="width:14px; height:14px;"></i> ...';
                if (window.lucide) window.lucide.createIcons();

                const res = await callApi('/uptime/purge', 'DELETE');
                if (res.success) {
                    showToast("✅ Incidentes eliminados correctamente.", "success");
                    // Reload logs to clear table
                    loadUptimeLogs();
                } else {
                    showToast("❌ Error al eliminar incidentes: " + (res.message || "Error desconocido"), "error");
                }
            } catch (e) {
                console.error("Purge failed:", e);
                showToast("❌ Error de conexión al purgar.", "error");
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i data-lucide="trash-2" style="width:14px; height:14px;"></i> RESET';
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });
}
// SECURITY: Escape HTML to prevent XSS
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

window.submitNewIncident = async function () {
    const btnId = 'btn-submit-incident';
    const nodeSelect = document.getElementById('new-incident-node');
    const typeSelect = document.getElementById('new-incident-type');
    const ticketInput = document.getElementById('new-incident-ticket');

    // 1. Validation
    if (!nodeSelect || !nodeSelect.value) {
        showToast("Por favor seleccione un Nodo.", 'error');
        return;
    }

    // Get Text (Name) and Value (ID)
    const nodeName = nodeSelect.options[nodeSelect.selectedIndex].text;
    const nodeId = nodeSelect.value;
    // Handle "Tramo de Fibra" removal of emoji if present
    const cleanNodeName = nodeName.replace(/^〰️\s*/, '').replace(/^📍\s*/, '').trim();

    if (!typeSelect || !typeSelect.value) {
        showToast("Seleccione un Tipo de Falla.", 'error');
        return;
    }

    // 2. Determine Scope (PONs vs Full Node)
    let affectedPons = [];

    const fullNodeCheck = document.getElementById('full-node-down-checkbox');

    if (fullNodeCheck && fullNodeCheck.checked) {
        affectedPons = ["NODO_COMPLETO"];
    } else {
        // Collect selected PONs from global array (managed by UI)
        affectedPons = selectedPons || [];
        if (affectedPons.length === 0) {
            // Default to "SISTEMA" if nothing specific selected
            affectedPons = ["SISTEMA"];
        }
    }

    // 3. Prepare Payload
    const now = new Date();
    // Use manual ticket ID or generate one
    const ticketId = (ticketInput && ticketInput.value.trim())
        ? ticketInput.value.trim().toUpperCase()
        : 'T' + Math.floor(100000 + Math.random() * 900000);

    const docData = {
        ticket_id: ticketId,
        node: cleanNodeName, // Backend expects "node" (name)
        node_id: nodeId || "MANUAL_" + cleanNodeName.replace(/\s+/g, '_'),
        failure_type: typeSelect.value,
        failure_reason: "Reportado Manualmente",
        owner_area: "NOC", // Default area
        start_date: now,
        end_date: null, // Open incident
        affected_customers: 0, // Pending calculation
        has_affected_customers: false,
        affected_pons: affectedPons,
        notes: "Incidente creado manualmente desde panel.",
        created_at: now
    };

    // 4. Submit
    try {
        window.setBtnLoading(btnId, true);
        console.log("🚀 Submitting Incident:", docData);

        // Call Backend API
        await callApi('/uptime/create', 'POST', docData);

        // Success
        showToast(`✅ Incidente creado: ${ticketId}`, 'success');
        window.closeModal('modal-new-incident');

        // Refresh table
        await loadUptimeLogs();

        // Reset Form
        nodeSelect.value = "";
        typeSelect.selectedIndex = 0;
        if (ticketInput) ticketInput.value = "";
        if (fullNodeCheck) fullNodeCheck.checked = false;
        selectedPons = [];
        updateSelectedPonsUI();

    } catch (e) {
        console.error("Submit Failed:", e);
        showToast("Error creando incidente: " + e.message, 'error');
    } finally {
        window.setBtnLoading(btnId, false);
    }
};
