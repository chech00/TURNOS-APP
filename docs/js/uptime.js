import { auth, db } from './firebase.js';
import {
    parseTimestamp, formatTime, formatDate, formatDuration,
    showToast, TimerManager, showSkeleton, exportToCSV, generateTicketId
} from './uptime-utils.js';

// Export helper for modules if needed
window.generateTicketId = generateTicketId;

import {
    initCharts, renderUptimeLineChart, renderTopNodesChart, calculateKPIs
} from './uptime-charts.js';
import { getDependentNodes, topology, aliases } from './dependencies.js';
import { callApi } from './modules/uptime-api.js';
import * as Modals from './modules/uptime-modals.js';
import { setIncidentsCache, updateLastTime } from './modules/uptime-state.js';
import {
    escapeHTML, getFailureBadge, renderActiveIncidents, renderHistoryTable,
    updateStats, updateLastUpdateIndicator, populateNodeFilter
} from './modules/uptime-ui.js';

// Expose Modal functions to Global Scope (for HTML onclick handlers)
window.submitNewIncident = Modals.submitNewIncident;
window.submitBatteryIncident = Modals.submitBatteryIncident;
window.saveDiagnosis = Modals.saveDiagnosis;
window.deleteIncident = Modals.deleteIncident;
window.viewDetails = Modals.viewDetails;
window.openModal = Modals.openModal;
window.closeModal = Modals.closeModal;


// (API Logic moved to modules/uptime-api.js)

// Global State
let selectedPons = [];
let isFullNodeDown = false; // Flag for "all node down" mode
const TOTAL_CLIENTS_BASE = 10700; // Constante 2023
let allNodesCache = []; // Cache for smart search
let allPonsCache = []; // Cache for smart search  
let lastIncidentCache = null; // For copy-last feature
let selectedNodePons = []; // PONs of currently selected node
let allIncidentsCache = []; // All incidents for filtering
let filteredIncidents = []; // Filtered incidents for display/export
let lastUpdateTime = null; // Track last data refresh
let dataLoaded = false; // Flag to prevent auto-incidents before data loads
const pendingAutoIncidents = new Set(); // Prevent duplicate auto-creations
let monitoringPaused = false; // Track monitoring toggle state (synced with backend)
let allNodesData = []; // Cache for nodes from API
let allPonsData = []; // Cache for PONs from API
let currentNodePonsData = []; // Cache for current node's PONs

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
            // Cache data
            allIncidentsCache = allIncidents;
            filteredIncidents = [...allIncidents];

            // Sync with Shared State Module
            setIncidentsCache(allIncidentsCache);

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

// (Rendering Logic moved to modules/uptime-ui.js)


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

// --- CONSTANT FOR METRICS ---
const TOTAL_CLIENTS = 10700;

// (updateLastUpdateIndicator moved)


// (populateNodeFilter moved)


// (renderHistoryTable, updateReviewCounter moved)


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

window.openBatteryModal = () => {
    const nodeSelect = document.getElementById('battery-node');
    if (nodeSelect) nodeSelect.value = "";
    window.openModal('modal-battery');
};

// --- NEW INCIDENT ---
// Helper GLOBAL para botones con carga
// --- NEW INCIDENT (Delegated to Module) ---
window.submitNewIncident = async () => {
    const success = await Modals.submitNewIncident();
    // No need to reload manually if the listener catches the change
};

// Wrappers
window.setBtnLoading = function (btnId, isLoading, originalText = null) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (isLoading) {
        if (!btn.dataset.originalText) btn.dataset.originalText = originalText || btn.innerHTML;
        btn.innerHTML = `<i data-lucide="loader-2" class="animate-spin" style="width:18px;height:18px;margin-right:8px;"></i> Procesando...`;
        btn.disabled = true;
        btn.classList.add('opacity-75', 'cursor-not-allowed');
    } else {
        btn.innerHTML = btn.dataset.originalText;
        btn.disabled = false;
        btn.classList.remove('opacity-75', 'cursor-not-allowed');
    }
};

// --- NEW INCIDENT ---
// (Legacy submitNewIncident removed to avoid duplicates)


// --- DIAGNOSE / EDIT ---
// --- DIAGNOSE / EDIT (Delegated) ---
window.viewDetails = (id) => Modals.viewDetails(id);
window.saveDiagnosis = () => Modals.saveDiagnosis();
window.deleteIncident = () => Modals.deleteIncident();
window.selectArea = (btn) => {
    document.querySelectorAll('.area-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('diagnose-area').value = btn.dataset.area;
};


// --- CLOSE INCIDENT ---
// --- CLOSE INCIDENT (Delegated) ---
window.requestCloseIncident = (id) => {
    const incident = allIncidentsCache.find(i => i.id === id);
    const nodeName = incident ? incident.node : 'Desconocido';
    document.getElementById('close-ticket-id').value = id;
    document.getElementById('close-modal-node').textContent = nodeName;
    document.getElementById('close-notes').value = '';
    const now = new Date();
    const localIso = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    document.getElementById('close-time-input').value = localIso;
    window.openModal('close-incident-modal');
};

window.confirmCloseIncident = () => Modals.confirmCloseIncident();

// Battery Incident Wrapper
window.submitBatteryIncident = () => Modals.submitBatteryIncident();

// PON Selection wrappers
window.togglePonSelection = (ponName) => Modals.togglePonSelection(ponName);
window.handleFullNodeDown = (checkbox) => Modals.setFullNodeDown(checkbox.checked);

// ==========================================
// CHECK ACTIVE INCIDENTS IN FIREBASE
// ==========================================
// (checkActiveIncidentInFirebase removed - logic moved to Modals)

// ==========================================
// CHECK LIVE FAILURES
// ==========================================

// Note: formatTime, formatDate, formatDuration are now imported from uptime-utils.js


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

// (getFailureBadge moved)


// (updateStats moved)


// Live Timer for Active Incidents - uses TimerManager to prevent memory leaks
function startLiveTimer(id, startDate) {
    const el = document.getElementById(`timer-${id}`);
    if (!el) return;

    // Use TimerManager from utils (imported)
    TimerManager.startTimer(id, startDate, el);
}

window.submitBatteryIncident = async () => Modals.submitBatteryIncident();
window.togglePonSelection = (ponName) => Modals.togglePonSelection(ponName);
window.setFullNodeDown = (val) => Modals.setFullNodeDown(val);

// Init
document.addEventListener('DOMContentLoaded', () => {
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


// Helper to check for existing active incidents to prevent duplicates
async function checkActiveIncidentInFirebase(nodeName, deviceName, affectedPons) {
    try {
        // Check for any open ticket for this node
        const snapshot = await db.collection(COLLECTION_NAME)
            .where('node', '==', nodeName)
            .where('end_date', '==', null)
            .get();

        return !snapshot.empty;
    } catch (error) {
        console.error("Error checking active incident:", error);
        return false; // Assume false on error to be safe, or true to suppress? False is safer for now.
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
                    // Insert after node selector (OUTSIDE the flex container)
                    nodeSelect.parentNode.insertAdjacentHTML('afterend', alertHtml);
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
        // REMOVED .orderBy('name') to prevent issues if field is missing. Default ID sort (A, B, C...) is fine.
        const lettersSnapshot = await db.collection('Nodos').doc(nodeId).collection('PONLetters').get();

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

        // Manually sort letters by ID just in case
        const sortedLetters = lettersSnapshot.docs.sort((a, b) => a.id.localeCompare(b.id));

        for (const letterDoc of sortedLetters) {
            const letterData = letterDoc.data();
            const letterId = letterDoc.id;
            const letterName = letterData.name || letterId; // Fallback to ID if name missing

            // Load PONs for this letter
            const ponsSnapshot = await db.collection('Nodos').doc(nodeId)
                .collection('PONLetters').doc(letterId)
                .collection('PONs').get();

            if (ponsSnapshot.empty) continue;

            const pons = [];
            ponsSnapshot.forEach(ponDoc => {
                const ponData = ponDoc.data();
                pons.push({ id: ponDoc.id, ...ponData });
                currentNodePonsData.push(ponData.name);
            });

            // SORT PONs ALPHANUMERICALLY (A1, A2, A10...)
            pons.sort((a, b) => {
                const nameA = a.name || a.id;
                const nameB = b.name || b.id;
                return nameA.localeCompare(nameB, undefined, { numeric: true });
            });

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
                                <div class="pon-chip ${selectedPons.includes(pon.name) ? 'selected' : ''}" 
                                     data-pon="${pon.name}" 
                                     data-card="${letterName}" 
                                     onclick="window.togglePonChip(this)">
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
    // Start Fresh from global state check
    const multiSelectWrapper = document.getElementById('pon-multi-select-container');

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
// (escapeHTML moved)


// [LEGACY CODE REMOVED] submitNewIncident moved to modules/uptime-modals.js

// Area Selection Logic
document.addEventListener('DOMContentLoaded', () => {
    const areaContainer = document.getElementById('area-selection-container');
    const hiddenInput = document.getElementById('new-incident-area');

    if (areaContainer && hiddenInput) {
        const buttons = areaContainer.querySelectorAll('.area-pill'); // Updated class name

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Update hidden input
                hiddenInput.value = btn.dataset.value;

                // Visual feedback
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }
});
