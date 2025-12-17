import { auth, db } from './firebase.js';
import {
    parseTimestamp, formatTime, formatDate, formatDuration,
    showToast, TimerManager, showSkeleton, exportToCSV
} from './uptime-utils.js';
import {
    initCharts, renderUptimeLineChart, renderTopNodesChart, calculateKPIs
} from './uptime-charts.js';
import { getDependentNodes, topology, aliases } from './dependencies.js';


// Detectar si estamos en producción (localtunnel) o local
const isProduction = window.location.hostname.includes('loca.lt');
const API_URL = isProduction
    ? 'https://mighty-horse-96.loca.lt'
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

    const response = await fetch(urlWithCache, options);

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error en API");
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

const COLLECTION_NAME = 'uptime_logs';

// ==========================================
// 1. DATA LOADING & RENDERING
// ==========================================

export async function loadUptimeLogs() {
    console.log("📅 [Uptime] Cargando registros...");
    const activeTableBody = document.getElementById('active-incidents-body');
    const activeContainer = document.getElementById('active-incidents-container');
    const historyTableBody = document.getElementById('uptime-table-body');
    const loadingSpinner = document.getElementById('loading-spinner');

    // Clean up old timers to prevent memory leaks
    TimerManager.stopAll();

    if (loadingSpinner) loadingSpinner.style.display = 'flex';

    // Show skeleton loaders while loading
    if (historyTableBody) showSkeleton(historyTableBody, 5);
    if (activeTableBody) activeTableBody.innerHTML = '';

    try {
        // Obtener incidentes via API del backend
        const allIncidents = await callApi('/uptime/list', 'GET');

        if (loadingSpinner) loadingSpinner.style.display = 'none';

        // Cache data for filtering
        allIncidentsCache = allIncidents;
        filteredIncidents = [...allIncidents];

        // Update last update indicator
        updateLastUpdateIndicator();

        // Populate node filter dropdown
        populateNodeFilter(allIncidents);

        const activeIncidents = [];
        const historyIncidents = [];

        allIncidents.forEach(data => {
            if (!data.end_date) {
                activeIncidents.push(data);
            } else {
                historyIncidents.push(data);
            }
        });

        // RENDER ACTIVE
        if (activeIncidents.length > 0) {
            if (activeContainer) activeContainer.style.display = 'block';
            let activeHtml = '';
            activeIncidents.forEach(data => {
                // Format PONs display
                const ponsDisplay = data.affected_pons && data.affected_pons.length > 0
                    ? data.affected_pons.map(pon => `<span class="badge badge-info" style="margin:2px;">${pon}</span>`).join('')
                    : '<span style="color:#999;">-</span>';

                // Format dependent nodes if any
                const dependentsDisplay = data.dependent_nodes && data.dependent_nodes.length > 0
                    ? `<div style="margin-top: 4px;">
                             <strong style="color: #f59e0b; font-size: 0.75rem;">⚠️ Afecta a:</strong>
                             ${data.dependent_nodes.map(node => `<span class="badge badge-warning" style="margin:2px; font-size:0.7rem;">${node}</span>`).join('')}
                           </div>`
                    : '';

                // Show parent node if this incident is caused by dependency
                const causedByDisplay = data.caused_by_node
                    ? `<div style="margin-top: 4px;">
                             <strong style="color: #8b5cf6; font-size: 0.75rem;">🔗 Causado por:</strong>
                             <span class="badge" style="background:#8b5cf6; color:white; margin:2px; font-size:0.7rem;">${data.caused_by_node}</span>
                           </div>`
                    : '';

                activeHtml += `
                        <tr>
                            <td><span class="badge badge-primary">${data.ticket_id}</span></td>
                            <td>${formatTime(data.start_date)}</td>
                            <td class="font-bold" style="color: #3b82f6;">${data.node || 'N/A'}</td>
                            <td>${getFailureBadge(data.failure_type)}</td>
                            <td>${ponsDisplay}${dependentsDisplay}${causedByDisplay}</td>
                            <td>${data.affected_customers || 0}</td>
                            <td class="font-bold" style="color: #ef4444;" id="timer-${data.id}">Calculando...</td>
                            <td style="display: flex; gap: 4px;">
                                <button class="icon-btn" onclick="window.viewDetails('${data.id}')" title="Diagnosticar / Editar">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/><path d="m9 11 4 4"/><path d="m5 19-3 3"/><path d="m14 4 6 6"/></svg>
                                </button>
                                <button class="icon-btn" onclick="window.requestCloseIncident('${data.id}')" title="Restaurar Servicio">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                </button>
                            </td>
                        </tr>
                    `;
            });
            if (activeTableBody) activeTableBody.innerHTML = activeHtml;

            // Start timers AFTER HTML is in the DOM
            activeIncidents.forEach(data => {
                startLiveTimer(data.id, data.start_date);
            });

            // Re-init Lucide icons for action buttons
            if (window.lucide) window.lucide.createIcons();
        } else {
            if (activeContainer) activeContainer.style.display = 'none';
        }

        // RENDER HISTORY
        if (historyIncidents.length === 0) {
            historyTableBody.innerHTML = `<tr><td colspan="11" class="text-center" style="padding: 2rem;">No hay registros recientes.</td></tr>`;
        } else {
            let historyHtml = '';
            historyIncidents.forEach(data => {
                try {
                    // Skip if data is null or undefined
                    if (!data) return;

                    // Format PONs
                    const ponsDisplay = data.affected_pons && data.affected_pons.length > 0
                        ? data.affected_pons.map(pon => `<span class="badge badge-secondary" style="margin:2px; font-size:0.75rem;">${pon}</span>`).join('')
                        : '<span style="color:#999;">-</span>';

                    // Format % Uptime
                    const uptimePercent = data.pct_uptime_customer_failure
                        ? (data.pct_uptime_customer_failure * 100).toFixed(4) + '%'
                        : '-';

                    historyHtml += `
                        <tr class="fade-in-row">
                            <td class="font-mono text-sm">${data.ticket_id || '-'}</td>
                            <td>${data.node || 'N/A'}</td>
                            <td>${getFailureBadge(data.failure_type)}</td>
                            <td>${formatDate(data.start_date)}</td>
                            <td>${formatDate(data.end_date)}</td>
                            <td class="font-bold">${formatDuration(data.restore_time)}</td>
                            <td class="text-center">${data.affected_customers || 0}</td>
                            <td>${ponsDisplay}</td>
                            <td class="font-bold" style="color: #10b981;">${uptimePercent}</td>
                            <td class="text-sm truncate-cell" title="${data.notes || ''}">${data.failure_reason || '-'}</td>
                            <td>
                                 <button class="icon-btn" onclick="window.viewDetails('${data.id}')" title="Ver Detalles">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                                </button>
                            </td>
                        </tr>
                    `;
                } catch (rowError) {
                    console.error("Error rendering history row:", rowError, data);
                }
            });
            if (historyTableBody) historyTableBody.innerHTML = historyHtml;
        }

        // Update KPI Cards
        updateStats(activeIncidents, historyIncidents);

        // Mark data as loaded to allow auto-incident creation
        dataLoaded = true;

        // Render Analytics Charts
        initCharts();
        renderUptimeLineChart(historyIncidents);
        renderTopNodesChart([...activeIncidents, ...historyIncidents]);

        // Re-init icons
        if (window.lucide) window.lucide.createIcons();

    } catch (error) {
        console.error("❌ Error loading logs:", error);
        if (historyTableBody) historyTableBody.innerHTML = `<tr><td colspan="11">Error: ${error.message}</td></tr>`;
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
    const historyTableBody = document.getElementById('uptime-table-body');
    if (!historyTableBody) return;

    if (historyIncidents.length === 0) {
        historyTableBody.innerHTML = `<tr><td colspan="11" class="text-center" style="padding: 2rem;">No hay registros que coincidan con los filtros.</td></tr>`;
        return;
    }

    let historyHtml = '';
    historyIncidents.forEach(data => {
        try {
            if (!data) return;

            const ponsDisplay = data.affected_pons && data.affected_pons.length > 0
                ? data.affected_pons.map(pon => `<span class="badge badge-secondary" style="margin:2px; font-size:0.75rem;">${pon}</span>`).join('')
                : '<span style="color:#999;">-</span>';

            const uptimePercent = data.pct_uptime_customer_failure
                ? (data.pct_uptime_customer_failure * 100).toFixed(4) + '%'
                : '-';

            historyHtml += `
                <tr class="fade-in-row">
                    <td class="font-mono text-sm">${data.ticket_id || '-'}</td>
                    <td>${data.node || 'N/A'}</td>
                    <td>${getFailureBadge(data.failure_type)}</td>
                    <td>${formatDate(data.start_date)}</td>
                    <td>${formatDate(data.end_date)}</td>
                    <td class="font-bold">${formatDuration(data.restore_time)}</td>
                    <td class="text-center">${data.affected_customers || 0}</td>
                    <td>${ponsDisplay}</td>
                    <td class="font-bold" style="color: #10b981;">${uptimePercent}</td>
                    <td class="text-sm truncate-cell" title="${data.notes || ''}">${data.failure_reason || '-'}</td>
                    <td>
                         <button class="icon-btn" onclick="window.viewDetails('${data.id}')" title="Ver Detalles">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                    </td>
                </tr>
            `;
        } catch (rowError) {
            console.error("Error rendering history row:", rowError, data);
        }
    });
    historyTableBody.innerHTML = historyHtml;
    if (window.lucide) window.lucide.createIcons();
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
window.submitNewIncident = async () => {
    const nodeSelect = document.getElementById('new-incident-node');
    const nodeName = nodeSelect.options[nodeSelect.selectedIndex].text; // Guardamos NOMBRE, no ID
    const nodeId = nodeSelect.value;
    const type = document.getElementById('new-incident-type').value;

    if (!nodeId) {
        alert("Por favor seleccione un Nodo.");
        return;
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
    if (!id) return;

    const updates = {
        failure_type: document.getElementById('diagnose-type').value,
        failure_reason: document.getElementById('diagnose-reason').value,
        owner_area: document.getElementById('diagnose-area').value,
        affected_customers: parseInt(document.getElementById('diagnose-clients').value) || 0,
        has_affected_customers: document.getElementById('diagnose-clients-bool').checked,
        notes: document.getElementById('diagnose-obs').value
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
    }
};

// --- CLOSE INCIDENT ---
window.requestCloseIncident = (id) => {
    document.getElementById('close-ticket-id').value = id;
    window.openModal('modal-close-incident');
};

window.confirmCloseIncident = async () => {
    const id = document.getElementById('close-ticket-id').value;
    if (!id) return;

    try {
        // Llamar al backend que calcula todo server-side
        const result = await callApi(`/uptime/${id}/close`, 'POST');

        console.log(`✅ Incidente cerrado: ${result.duration} minutos`);

        window.closeModal('modal-close-incident');
        loadUptimeLogs();
    } catch (e) {
        console.error(e);
        alert("Error cerrando ticket: " + e.message);
    }
};

// ==========================================
// CHECK ACTIVE INCIDENTS IN FIREBASE
// ==========================================
async function checkActiveIncidentInFirebase(nodeName, deviceName, affectedPons) {
    // Use already-loaded incident cache instead of API call
    // API doesn't support filtering, so we filter locally
    const hasActive = allIncidentsCache.some(inc => {
        // Only check active incidents (no end_date)
        if (inc.end_date) return false;

        // Match by node name
        if (inc.node !== nodeName) return false;

        // Check if this specific device/PON is already covered
        if (inc.affected_pons) {
            return inc.affected_pons.includes(deviceName) ||
                inc.affected_pons.includes("NODO_COMPLETO") ||
                (Array.isArray(affectedPons) && affectedPons.some(pon => inc.affected_pons.includes(pon)));
        }

        return false;
    });

    console.log(`🔍 Cache check for ${nodeName}/${deviceName}: ${hasActive ? 'HAS ACTIVE' : 'NO ACTIVE'}`);
    return hasActive;
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
    if (!type) return '<span class="badge badge-secondary">?</span>';
    const lower = type.toLowerCase();
    if (lower.includes('corte')) return `<span class="badge badge-danger">${type}</span>`;
    if (lower.includes('bateria') || lower.includes('energia')) return `<span class="badge badge-warning">${type}</span>`;
    return `<span class="badge badge-info">${type}</span>`;
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

    // === Apply cached role immediately for sidebar visibility ===
    const cachedRole = localStorage.getItem('userRole');
    if (cachedRole) {
        applySidebarVisibility(cachedRole);
        // Redirect non-admin/superadmin immediately based on cache
        if (cachedRole !== 'superadmin' && cachedRole !== 'admin') {
            alert('⚠️ Acceso restringido: Esta vista solo está disponible para Admin y SuperAdmin.');
            window.location.href = 'directorio.html';
            return;
        }
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

            // Start Live Polling (Lab Integration)
            startLivePolling();
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
let livePollInterval = null;

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

                    showToast(`🚨 ALERTA: ${device.name} detectado CAÍDO (${nodeName})`, 'error');

                    // Show dependent nodes toast if any
                    if (dependentNodes.length > 0) {
                        showToast(`📡 Detectadas ${dependentNodes.length} dependencias afectadas`, 'warning');
                    }

                    // 1. Create PRIMARY incident for the failed node
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
    const btn = document.querySelector('#modal-battery .primary-btn');

    if (!nodeId) {
        showToast("Por favor seleccione un Nodo.", 'error');
        return;
    }

    // Disable button to prevent double-click
    if (btn) { btn.disabled = true; btn.textContent = "Registrando..."; }

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
        if (btn) { btn.disabled = false; btn.textContent = "⚡ Registrar en Batería"; }
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
