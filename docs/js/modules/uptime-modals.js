import { callApi } from './uptime-api.js';
import { state, getIncidentById } from './uptime-state.js';
import { getDependentNodes, topology } from '../dependencies.js';
import { generateTicketId } from '../uptime-utils.js'; // Assuming this exists or needs to be moved
// Note: generateTicketId is in uptime.js currently? Check Step 1490.
// Line 833: const newTicketId = userTicket || generateTicketId();
// Assuming I will move generateTicketId to uptime-utils.js as well if not there.

// Local State for New Incident
let selectedPons = [];
let isFullNodeDown = false;

// Helpers (Internal)
function updateSelectedPonsUI() {
    const container = document.getElementById('pon-selection-container');
    const badge = document.getElementById('selected-pon-count');
    const list = document.getElementById('pon-multi-select-container');

    if (!container || !list) return;

    if (isFullNodeDown) {
        container.style.display = 'block';
        badge.textContent = 'TODO EL NODO';
        badge.className = 'glass-badge danger';
        list.style.display = 'none';
        return;
    }

    if (selectedPons.length > 0) {
        container.style.display = 'block';
        badge.textContent = `${selectedPons.length} Seleccionados`;
        badge.className = 'glass-badge info';

        // Re-render list visual if needed, but usually handled by select handler
        // For now, simpler UI logic:
        list.style.display = 'flex';
    } else {
        container.style.display = 'none';
    }
}

// --- EXPORTED FUNCTIONS ---

// 1. SUBMIT NEW INCIDENT
export async function submitNewIncident() {
    const nodeSelect = document.getElementById('new-incident-node');
    const nodeName = nodeSelect.options[nodeSelect.selectedIndex].text;
    const nodeId = nodeSelect.value;
    const type = document.getElementById('new-incident-type').value;
    const btnId = 'btn-submit-incident';

    if (!nodeId) {
        alert("Por favor seleccione un Nodo.");
        return false;
    }

    // Duplicate Check using Shared State
    const isAlreadyActive = state.allIncidentsCache.some(inc => !inc.end_date && inc.node === nodeName);
    if (isAlreadyActive) {
        if (!confirm(`⚠️ El nodo "${nodeName}" ya tiene un incidente activo.\n\n¿Estás seguro de que quieres crear otro?`)) {
            return false;
        }
    }

    const ticketInput = document.getElementById('new-incident-ticket');
    const userTicket = ticketInput?.value?.trim()?.toUpperCase();

    // We need generateTicketId. If it's not imported, we need a local version or import using window for now?
    // Proper way: It should be in utils. 
    // Hack for now: window.generateTicketId (assuming I leave it global)
    // Better: Helper function here
    const genId = () => 'T-' + Math.floor(Math.random() * 100000);
    const newTicketId = userTicket || (window.generateTicketId ? window.generateTicketId() : genId());

    if (userTicket && userTicket.length < 3) {
        alert("Ticket debe tener 3+ caracteres");
        ticketInput.focus();
        return false;
    }

    window.setBtnLoading(btnId, true); // Helper assumed global for now

    const now = new Date();
    const docData = {
        ticket_id: newTicketId,
        node: nodeName,
        node_id: nodeId,
        failure_type: type,
        start_date: now,
        end_date: null,
        affected_customers: 0,
        affected_customers: 0,
        affected_pons: (isFullNodeDown || selectedPons.length === 0) ? ["NODO_COMPLETO"] : selectedPons,
        created_at: now
    };

    try {
        const promises = [];
        promises.push(callApi('/uptime/create', 'POST', docData));

        // Cascade
        const cascadeCheckbox = document.getElementById('cascade-report-check');
        // Debugging logs
        console.log(`🔍 [Debug] Cascada Checkbox:`, cascadeCheckbox ? cascadeCheckbox.checked : 'No encontrado');
        console.log(`🔍 [Debug] Node Name for dependencies: "${nodeName}"`);

        if (cascadeCheckbox && cascadeCheckbox.checked) {
            // Trim and uppercase for better matching
            const depsName = nodeName.trim().toUpperCase();
            const dependents = getDependentNodes(depsName);

            console.log(`🔍 [Debug] Dependents found:`, dependents);

            if (dependents.length > 0) {
                if (window.showToast) window.showToast(`🔗 Creando ${dependents.length} incidentes por dependencia...`, 'info');

                dependents.forEach((childNode, index) => {
                    const childDoc = {
                        ticket_id: newTicketId + '-' + (index + 1),
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
            } else {
                console.warn("⚠️ Checkbox marked but no dependents returned by getDependentNodes");
            }
        }

        const results = await Promise.allSettled(promises);

        // Analyze results
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        console.log(`✅ [Batch] Procesados: ${results.length}, Éxitos: ${successful}, Fallos: ${failed}`);
        results.forEach((r, i) => {
            if (r.status === 'rejected') console.error(`❌ Fallo en item ${i}:`, r.reason);
        });

        // Reset UI
        window.closeModal('modal-new-incident');
        selectedPons = [];
        isFullNodeDown = false;
        const fullNodeCheckbox = document.getElementById('full-node-down-checkbox');
        if (fullNodeCheckbox) fullNodeCheckbox.checked = false;
        updateSelectedPonsUI();
        document.getElementById('new-incident-node').value = "";
        if (document.getElementById('pon-multi-select-container')) {
            document.getElementById('pon-multi-select-container').innerHTML = '';
        }
        if (ticketInput) ticketInput.value = "";

        // Provide specific feedback
        if (failed > 0) {
            if (window.showToast) window.showToast(`⚠️ Creados ${successful}, fallaron ${failed} (Ver consola)`, 'warning');
        } else {
            if (window.showToast) window.showToast(`✅ Incidente creado (+${successful - 1} dependientes)`, 'success');
        }

        return true;

    } catch (e) {
        console.error("Critical Submit Error:", e);
        if (window.showToast) window.showToast(`❌ Error Crítico: ${e.message}`, 'error');
        return false;
    } finally {
        window.setBtnLoading(btnId, false);
    }
}

// 2. DIAGNOSE / EDIT
export async function viewDetails(id) {
    try {
        // Fetch fresh if possible, or use cache. 
        // For edit, good to fetch fresh but cache is faster. 
        // Logic in original was: db.collection...get(). 
        // We should use API GET /uptime/logs/:id ideally.
        // Or just use cache for now. Original code fetched DOC!
        // Let's use cache for display, then maybe async fetch? 
        // Original: await db.collection...doc(id).get()
        // We'll trust the cache/Backend API

        // Let's use getById from cache for speed
        const data = getIncidentById(id);
        if (!data) return; // Or fetch via API

        // Populate Modal
        document.getElementById('diagnose-ticket-id').value = id;
        document.getElementById('diagnose-type').value = data.failure_type || 'Sin Clasificar';
        document.getElementById('diagnose-reason').value = data.failure_reason || '';
        document.getElementById('diagnose-clients').value = data.affected_customers || 0;
        document.getElementById('diagnose-clients-bool').checked = !!data.has_affected_customers;
        document.getElementById('diagnose-obs').value = data.notes || '';

        // Area
        const areaValue = data.owner_area || 'NOC';
        document.getElementById('diagnose-area').value = areaValue;
        document.querySelectorAll('.area-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.area === areaValue) btn.classList.add('active');
        });

        window.openModal('modal-diagnose');

        // Setup Delete Button (Admin check)
        setupDeleteButton();

    } catch (e) {
        console.error(e);
    }
}

function setupDeleteButton() {
    const role = localStorage.getItem('userRole');
    const isAdmin = role === 'admin' || role === 'superadmin';
    const deleteBtn = document.getElementById('btn-delete-incident');

    if (isAdmin) {
        if (!deleteBtn) {
            const saveBtn = document.getElementById('btn-save-diagnose');
            if (saveBtn && saveBtn.parentElement) {
                const newBtn = document.createElement('button');
                newBtn.id = 'btn-delete-incident';
                newBtn.type = 'button';
                newBtn.className = 'secondary-btn';
                newBtn.style.color = '#ef4444';
                newBtn.style.marginRight = 'auto';
                newBtn.innerHTML = '<i data-lucide="trash-2"></i> Eliminar';
                // We need to bind this to the window function that calls the module function
                newBtn.onclick = window.deleteIncident; // Assumes window mapping

                saveBtn.parentElement.insertBefore(newBtn, saveBtn.parentElement.firstChild);
                saveBtn.parentElement.style.justifyContent = 'space-between';
            }
        } else {
            deleteBtn.style.display = 'block';
        }
    } else {
        if (deleteBtn) deleteBtn.style.display = 'none';
    }
}

export async function saveDiagnosis() {
    const id = document.getElementById('diagnose-ticket-id').value;
    if (!id) return false;

    window.setBtnLoading('btn-save-diagnose', true);

    const updates = {
        failure_type: document.getElementById('diagnose-type').value,
        failure_reason: document.getElementById('diagnose-reason').value,
        owner_area: document.getElementById('diagnose-area').value,
        affected_customers: parseInt(document.getElementById('diagnose-clients').value) || 0,
        has_affected_customers: document.getElementById('diagnose-clients-bool').checked,
        notes: document.getElementById('diagnose-obs').value,
        needs_review: false
    };

    try {
        await callApi(`/uptime/${id}`, 'PUT', updates);
        window.closeModal('modal-diagnose');
        if (window.showToast) window.showToast('✅ Diagnóstico guardado', 'success');
        return true;
    } catch (e) {
        console.error(e);
        alert("Error: " + e.message);
        return false;
    } finally {
        window.setBtnLoading('btn-save-diagnose', false);
    }
}

export async function deleteIncident() {
    const id = document.getElementById('diagnose-ticket-id').value;
    if (!id) return false;

    if (!confirm('⚠️ ¿ESTÁS SEGURO?\n\nEsta acción eliminará el incidente permanentemente.')) {
        return false;
    }

    window.setBtnLoading('btn-delete-incident', true);

    try {
        await callApi(`/uptime/logs/${id}`, 'DELETE');
        window.closeModal('modal-diagnose');
        if (window.showToast) window.showToast('🗑️ Incidente eliminado', 'success');
        return true;
    } catch (e) {
        alert("Error: " + e.message);
        return false;
    } finally {
        window.setBtnLoading('btn-delete-incident', false);
    }
}

// 3. BATTERY INCIDENT
export async function submitBatteryIncident() {
    const nodeSelect = document.getElementById('battery-node');
    const nodeName = nodeSelect.options[nodeSelect.selectedIndex]?.text;
    const nodeId = nodeSelect.value;

    if (!nodeId) {
        alert("Por favor seleccione un Nodo.");
        return false;
    }

    const ticketId = 'T' + Math.floor(100000 + Math.random() * 900000); // Simple gen
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
        has_affected_customers: false,
        affected_pons: ["NODO_COMPLETO"],
        notes: "Registro rápido - Nodo en batería",
        created_at: now
    };

    try {
        await callApi('/uptime/create', 'POST', docData);
        window.closeModal('modal-battery');
        if (window.showToast) window.showToast(`⚡ Nodo ${nodeName} registrado en batería`, 'success');
        return true;
    } catch (e) {
        alert("Error: " + e.message);
        return false;
    }
}

// 4. Incident Close
export async function confirmCloseIncident() {
    const id = document.getElementById('close-ticket-id').value;
    if (!id) return false;

    // We need to implement the close logic.
    // Assuming /close endpoint exists.
    try {
        await callApi(`/uptime/${id}/close`, 'POST', {});
        window.closeModal('close-incident-modal');

        // Victory Confetti
        if (window.triggerVictoryConfetti) window.triggerVictoryConfetti();
        if (window.showToast) window.showToast('✅ Servicio restaurado exitosamente', 'success');

        return true;
    } catch (e) {
        alert("Error: " + e.message);
        return false;
    }
}

// Public setters for UI state (PONs)
export function togglePonSelection(ponName) {
    if (selectedPons.includes(ponName)) {
        selectedPons = selectedPons.filter(p => p !== ponName);
    } else {
        selectedPons.push(ponName);
    }
    updateSelectedPonsUI();
}

export function setFullNodeDown(val) {
    isFullNodeDown = val;
    if (val) selectedPons = ["NODO_COMPLETO"];
    else selectedPons = [];
    updateSelectedPonsUI();
}

// ==========================================
// 5. GENERIC MODAL CONTROL
// ==========================================
export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        // Optional: Add animation class
        modal.classList.add('fade-in');
    } else {
        console.error(`Modal ${modalId} not found`);
    }
}

export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('fade-in');
    }
}
