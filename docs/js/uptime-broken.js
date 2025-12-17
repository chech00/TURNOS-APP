import { auth, db } from './firebase.js';

const API_URL = 'http://localhost:3000';

async function callApi(endpoint, method, body) {
    const user = auth.currentUser;
    if (!user) throw new Error("Usuario no autenticado");

    const token = await user.getIdToken();

    const response = await fetch(`${API_URL}${endpoint}`, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error en API");
    }

    return await response.json();
}

// Global State
let selectedPons = [];
const TOTAL_CLIENTS_BASE = 10700; // Constante 2023
let allNodesData = []; // Cache for smart search
let allPonsData = []; // Cache for smart search  
let lastIncidentData = null; // For copy-last feature

const COLLECTION_NAME = 'uptime_logs';

// ==========================================
// 1. DATA LOADING & RENDERING
// ==========================================

export async function loadUptimeLogs() {
    console.log("üìÖ [Uptime] Cargando registros...");
    const activeTableBody = document.getElementById('active-incidents-body');
    const activeContainer = document.getElementById('active-incidents-container');
    const historyTableBody = document.getElementById('uptime-table-body');
    const loadingSpinner = document.getElementById('loading-spinner');

    if (loadingSpinner) loadingSpinner.style.display = 'flex';
    if (historyTableBody) historyTableBody.innerHTML = '';
    if (activeTableBody) activeTableBody.innerHTML = '';

    try {
        // En un escenario real, quiz√°s querr√≠as separar esto en dos consultas o filtrar en cliente
        // Por ahora traemos todo y separamos en cliente
        const snapshot = await db.collection(COLLECTION_NAME)
            .orderBy('start_date', 'desc')
            .limit(100)
            .get();

        if (loadingSpinner) loadingSpinner.style.display = 'none';

        const activeIncidents = [];
        const historyIncidents = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id; // Append ID
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

                activeHtml += `
                    <tr class="fade-in-row" style="background: rgba(239, 68, 68, 0.05); border-left: 3px solid #ef4444;">
                        <td class="font-mono text-sm">#${data.ticket_id || '???'}</td>
                        <td>${formatTime(data.start_date)}</td>
                        <td style="font-weight:bold;">${data.node || 'N/A'}</td>
                        <td>${getFailureBadge(data.failure_type)}</td>
                        <td>${ponsDisplay}</td>
                        <td>${data.affected_customers || 0}</td>
                        <td class="font-bold" style="color: #ef4444;" id="timer-${data.id}">Calculando...</td>
                        <td>
                            <button class="icon-btn" onclick="window.viewDetails('${data.id}')" title="Diagnosticar / Editar">
                                <i data-lucide="stethoscope"></i>
                            </button>
                            <button class="icon-btn" onclick="window.requestCloseIncident('${data.id}')" title="Restaurar Servicio" style="color: #22c55e;">
                                <i data-lucide="check-circle"></i>
                            </button>
                        </td>
                    </tr>
                `;
                // Start local timer for this row
                startLiveTimer(data.id, data.start_date);
            });
            if (activeTableBody) activeTableBody.innerHTML = activeHtml;
        } else {
            if (activeContainer) activeContainer.style.display = 'none';
        }

        // RENDER HISTORY
        if (historyIncidents.length === 0) {
            historyTableBody.innerHTML = `<tr><td colspan="11" class="text-center" style="padding: 2rem;">No hay registros recientes.</td></tr>`;
        } else {
            let historyHtml = '';
            historyIncidents.forEach(data => {
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
                                <i data-lucide="eye"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
            if (historyTableBody) historyTableBody.innerHTML = historyHtml;
        }

        // Update KPI Cards
        updateStats(activeIncidents, historyIncidents);

        // Re-init icons
        if (window.lucide) window.lucide.createIcons();

    } catch (error) {
        console.error("‚ùå Error loading logs:", error);
        if (historyTableBody) historyTableBody.innerHTML = `<tr><td colspan="9">Error: ${error.message}</td></tr>`;
    }
}

// ==========================================
// 2. MODAL & INTERACTION HANDLERS (Global)
// ==========================================

window.loadUptimeLogs = loadUptimeLogs;

window.openModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        // Auto focus first input if possible
        const input = modal.querySelector('input, select');
        if (input) input.focus();
    }
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

    const newTicketId = generateTicketId();
    const now = new Date();

    const docData = {
        ticket_id: newTicketId,
        node: nodeName,
        node_id: nodeId, // Guardamos tambi√©n el ID por si acaso
        failure_type: type,
        start_date: now,
        end_date: null,
        affected_customers: 0,
        affected_pons: selectedPons, // Array de PONs afectados
        created_at: now
    };

    try {
        // REPLACE DIRECT DB WRITE VIA API
        // await db.collection(COLLECTION_NAME).add(docData);
        await callApi('/uptime/create', 'POST', docData);

        window.closeModal('modal-new-incident');

        // Reset Inputs
        selectedPons = [];
        updateSelectedPonsUI();
        document.getElementById('new-incident-node').value = "";

        loadUptimeLogs();
    } catch (e) {
        console.error(e);
        alert("Error creando incidente: " + e.message);
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
        document.getElementById('diagnose-area').value = data.owner_area || 'NOC'; // Mapped from area
        document.getElementById('diagnose-clients').value = data.affected_customers || 0;
        document.getElementById('diagnose-clients-bool').checked = !!data.has_affected_customers;
        document.getElementById('diagnose-obs').value = data.notes || ''; // Mapped from observation

        // 3. Open Modal
        window.openModal('modal-diagnose');
    } catch (e) {
        console.error(e);
    }
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
        loadUptimeLogs();
    } catch (e) {
        console.error(e);
        alert("Error actualizando: " + e.message);
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

    const now = new Date();

    try {
        const doc = await db.collection(COLLECTION_NAME).doc(id).get();
        const data = doc.data();
        const start = data.start_date.toDate();

        // 1. Duraci√≥n (Excel: FechaFin - FechaInicio)
        const diffMinutes = Math.floor((now - start) / 60000); // Diferencia en minutos

        // 2. C√°lculo de m√©tricas basadas en Excel
        const affClients = data.affected_customers || 0;

        // % Clientes Afectados = (Afectados / Total)
        const percentAffected = (affClients / TOTAL_CLIENTS_BASE);

        // Tiempo falla x cliente (Minutos-Cliente) = Duraci√≥n * Afectados
        const clientMinutes = diffMinutes * affClients;

        // % Uptime cliente x falla = 1 - (Minutos perdidos / Total minutos posibles)
        // Total minutos posibles = d√≠as del mes * 1440 min/d√≠a * Total clientes
        const nowDate = new Date(now);
        const daysInMonth = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0).getDate();
        const totalPossibleMinutes = daysInMonth * 1440 * TOTAL_CLIENTS_BASE;
        const pctUptimeCustomerFailure = 1 - (clientMinutes / totalPossibleMinutes);

        const updates = {
            end_date: now,
            restore_time: diffMinutes,
            pct_customers_affected_total_network: percentAffected,
            customer_outage_time: clientMinutes,
            pct_uptime_customer_failure: pctUptimeCustomerFailure
        };

        // REPLACE DIRECT DB UPDATE VIA API
        // await db.collection(COLLECTION_NAME).doc(id).update(...)
        await callApi(`/uptime/${id}`, 'PUT', updates);

        window.closeModal('modal-close-incident');
        loadUptimeLogs();
    } catch (e) {
        console.error(e);
        alert("Error cerrando ticket: " + e.message);
    }
};

// ==========================================
// 3. UTILS & HELPERS
// ==========================================

function formatTime(timestamp) {
    if (!timestamp) return '';
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(timestamp) {
    if (!timestamp) return '';
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatDuration(mins) {
    if (!mins) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function generateTicketId() {
    // Simple ID: T + Timestamp suffix
    return 'T' + Date.now().toString().slice(-6);
}

function getFailureBadge(type) {
    if (!type) return '<span class="badge badge-secondary">?</span>';
    const lower = type.toLowerCase();
    if (lower.includes('corte')) return `<span class="badge badge-danger">${type}</span>`;
    if (lower.includes('bateria') || lower.includes('energia')) return `<span class="badge badge-warning">${type}</span>`;
    return `<span class="badge badge-info">${type}</span>`;
}

function updateStats(active, history) {
    document.getElementById('stat-active-events').textContent = active.length;
    document.getElementById('stat-total-events').textContent = (active.length + history.length);

    // Calc total affected active
    const totalActiveClients = active.reduce((sum, item) => sum + (item.affected_customers || 0), 0);
    document.getElementById('stat-affected-clients').textContent = totalActiveClients;
}

// Live Timer for Active Incidents
function startLiveTimer(id, startDate) {
    const el = document.getElementById(`timer-${id}`);
    if (!el) return;

    const start = startDate.toDate ? startDate.toDate() : new Date(startDate);

    const update = () => {
        const now = new Date();
        const diffMs = now - start;
        const diffMins = Math.floor(diffMs / 60000);
        const h = Math.floor(diffMins / 60);
        const m = diffMins % 60;
        el.textContent = `${h}h ${m}m`;
    };

    update(); // imm
    setInterval(update, 60000); // every min
}

// Init
// Init
document.addEventListener('DOMContentLoaded', () => {
    loadUptimeLogs();
    loadNodes(); // Load dynamic nodes for the modal
    setupPonSelectionLogic();
});

// ==========================================
// 4. DYNAMIC NODE/PON LOGIC
// ==========================================

async function loadNodes() {
    const nodeSelect = document.getElementById('new-incident-node');
    if (!nodeSelect) return;

    try {
        const snapshot = await db.collection('Nodos').orderBy('name').get();
        let html = '<option value="">-- Seleccione Nodo --</option>';
        snapshot.forEach(doc => {
            const data = doc.data();
            html += `<option value="${doc.id}">${data.name}</option>`;
        });
        nodeSelect.innerHTML = html;

        // Cascading Event
        nodeSelect.addEventListener('change', (e) => {
            const nodeId = e.target.value;
            const ponContainer = document.getElementById('pon-selection-container');
            const letterSelect = document.getElementById('pon-letter-select');

            // Reset cascading dropdowns
            letterSelect.innerHTML = '<option value="">1. Tarjeta...</option>';
            letterSelect.disabled = true;
            document.getElementById('pon-port-select').innerHTML = '<option value="">2. Puerto...</option>';
            document.getElementById('pon-port-select').disabled = true;
            document.getElementById('add-pon-btn').disabled = true;

            // Clear current selection
            selectedPons = [];
            updateSelectedPonsUI();

            // Show/Hide PON container
            if (nodeId) {
                ponContainer.style.display = 'block';
                loadPonLetters(nodeId);
            } else {
                ponContainer.style.display = 'none';
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
    const addBtn = document.getElementById('add-pon-btn');
    if (addBtn) {
        addBtn.onclick = (e) => {
            e.preventDefault();
            const portSelect = document.getElementById('pon-port-select');
            const ponName = portSelect.value;

            if (ponName && !selectedPons.includes(ponName)) {
                selectedPons.push(ponName);
                updateSelectedPonsUI();
            }
        };
    }
}

function updateSelectedPonsUI() {
    const container = document.getElementById('selected-pons-list');
    if (!container) return;

    container.innerHTML = selectedPons.map(pon => `
        <span class="badge badge-info" style="display: flex; align-items: center; gap: 4px; padding-right: 4px;">
            ${pon}
            <button onclick="window.removePon('${pon}')" style="background:none; border:none; color:inherit; cursor:pointer; padding:0; display:flex;">
                <i data-lucide="x" style="width:14px; height:14px;"></i>
            </button>
        </span>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
}

window.removePon = (pon) => {
    selectedPons = selectedPons.filter(p => p !== pon);
    updateSelectedPonsUI();
}
/ /   = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =  
 / /   5 .   S M A R T   S E A R C H   &   Q U I C K   A C T I O N S  
 / /   = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =  
  
 / * *  
   *   S e t u p   s m a r t   s e a r c h   a u t o c o m p l e t e  
   * /  
 f u n c t i o n   s e t u p S m a r t S e a r c h ( )   {  
         c o n s t   s e a r c h I n p u t   =   d o c u m e n t . g e t E l e m e n t B y I d ( ' q u i c k - s e a r c h - i n p u t ' ) ;  
         c o n s t   s u g g e s t i o n s D i v   =   d o c u m e n t . g e t E l e m e n t B y I d ( ' s e a r c h - s u g g e s t i o n s ' ) ;  
  
         i f   ( ! s e a r c h I n p u t )   r e t u r n ;  
  
         s e a r c h I n p u t . a d d E v e n t L i s t e n e r ( ' i n p u t ' ,   ( e )   = >   {  
                 c o n s t   q u e r y   =   e . t a r g e t . v a l u e . t r i m ( ) . t o L o w e r C a s e ( ) ;  
  
                 i f   ( q u e r y . l e n g t h   <   2 )   {  
                         s u g g e s t i o n s D i v . s t y l e . d i s p l a y   =   ' n o n e ' ;  
                         r e t u r n ;  
                 }  
  
                 / /   S e a r c h   i n   n o d e s  
                 c o n s t   m a t c h i n g N o d e s   =   a l l N o d e s D a t a . f i l t e r ( n o d e   = >  
                         n o d e . n a m e . t o L o w e r C a s e ( ) . i n c l u d e s ( q u e r y )  
                 ) ;  
  
                 / /   S e a r c h   i n   P O N s  
                 c o n s t   m a t c h i n g P o n s   =   a l l P o n s D a t a . f i l t e r ( p o n   = >  
                         p o n . p o n N a m e . t o L o w e r C a s e ( ) . i n c l u d e s ( q u e r y )   | |  
                         p o n . n o d e N a m e . t o L o w e r C a s e ( ) . i n c l u d e s ( q u e r y )  
                 ) ;  
  
                 i f   ( m a t c h i n g N o d e s . l e n g t h   = = =   0   & &   m a t c h i n g P o n s . l e n g t h   = = =   0 )   {  
                         s u g g e s t i o n s D i v . i n n e r H T M L   =   ' < d i v   s t y l e = " p a d d i n g : 0 . 5 r e m ;   c o l o r : # 9 9 9 ; " > N o   s e   e n c o n t r a r o n   r e s u l t a d o s < / d i v > ' ;  
                         s u g g e s t i o n s D i v . s t y l e . d i s p l a y   =   ' b l o c k ' ;  
                         r e t u r n ;  
                 }  
  
                 l e t   h t m l   =   ' ' ;  
  
                 / /   R e n d e r   n o d e   m a t c h e s  
                 i f   ( m a t c h i n g N o d e s . l e n g t h   >   0 )   {  
                         h t m l   + =   ' < d i v   s t y l e = " f o n t - w e i g h t : 6 0 0 ;   f o n t - s i z e : 0 . 7 5 r e m ;   c o l o r : # 9 c a 3 a f ;   m a r g i n - b o t t o m : 0 . 5 r e m ; " > N O D O S < / d i v > ' ;  
                         m a t c h i n g N o d e s . s l i c e ( 0 ,   3 ) . f o r E a c h ( n o d e   = >   {  
                                 h t m l   + =   `  
                                         < d i v   c l a s s = " s e a r c h - r e s u l t - i t e m "   d a t a - t y p e = " n o d e "   d a t a - n o d e - i d = " $ { n o d e . i d } "   d a t a - n o d e - n a m e = " $ { n o d e . n a m e } "  
                                                 s t y l e = " p a d d i n g :   0 . 5 r e m ;   c u r s o r :   p o i n t e r ;   b o r d e r - r a d i u s :   4 p x ;   m a r g i n - b o t t o m :   0 . 2 5 r e m ;   b a c k g r o u n d :   r g b a ( 2 5 5 , 2 5 5 , 2 5 5 , 0 . 0 5 ) ; " >  
                                                 < i   d a t a - l u c i d e = " s e r v e r "   s t y l e = " w i d t h : 1 4 p x ;   h e i g h t : 1 4 p x ; " > < / i >  
                                                 < s t r o n g > $ { n o d e . n a m e } < / s t r o n g >  
                                         < / d i v >  
                                 ` ;  
                         } ) ;  
                 }  
  
                 / /   R e n d e r   P O N   m a t c h e s  
                 i f   ( m a t c h i n g P o n s . l e n g t h   >   0 )   {  
                         h t m l   + =   ' < d i v   s t y l e = " f o n t - w e i g h t : 6 0 0 ;   f o n t - s i z e : 0 . 7 5 r e m ;   c o l o r : # 9 c a 3 a f ;   m a r g i n : 0 . 5 r e m   0 ; " > P O N s < / d i v > ' ;  
                         m a t c h i n g P o n s . s l i c e ( 0 ,   5 ) . f o r E a c h ( p o n   = >   {  
                                 h t m l   + =   `  
                                         < d i v   c l a s s = " s e a r c h - r e s u l t - i t e m "   d a t a - t y p e = " p o n "   d a t a - n o d e - i d = " $ { p o n . n o d e I d } "   d a t a - n o d e - n a m e = " $ { p o n . n o d e N a m e } "    
                                                 d a t a - p o n - n a m e = " $ { p o n . p o n N a m e } "  
                                                 s t y l e = " p a d d i n g :   0 . 5 r e m ;   c u r s o r :   p o i n t e r ;   b o r d e r - r a d i u s :   4 p x ;   m a r g i n - b o t t o m :   0 . 2 5 r e m ;   b a c k g r o u n d :   r g b a ( 2 5 5 , 2 5 5 , 2 5 5 , 0 . 0 5 ) ; " >  
                                                 < i   d a t a - l u c i d e = " n e t w o r k "   s t y l e = " w i d t h : 1 4 p x ;   h e i g h t : 1 4 p x ; " > < / i >  
                                                 $ { p o n . n o d e N a m e }   ‚      < s p a n   c l a s s = " b a d g e   b a d g e - i n f o "   s t y l e = " f o n t - s i z e : 0 . 7 5 r e m ; " > $ { p o n . p o n N a m e } < / s p a n >  
                                         < / d i v >  
                                 ` ;  
                         } ) ;  
                 }  
  
                 s u g g e s t i o n s D i v . i n n e r H T M L   =   h t m l ;  
                 s u g g e s t i o n s D i v . s t y l e . d i s p l a y   =   ' b l o c k ' ;  
  
                 / /   R e - i n i t   l u c i d e   i c o n s  
                 i f   ( w i n d o w . l u c i d e )   w i n d o w . l u c i d e . c r e a t e I c o n s ( ) ;  
  
                 / /   A d d   c l i c k   h a n d l e r s  
                 s u g g e s t i o n s D i v . q u e r y S e l e c t o r A l l ( ' . s e a r c h - r e s u l t - i t e m ' ) . f o r E a c h ( i t e m   = >   {  
                         i t e m . a d d E v e n t L i s t e n e r ( ' c l i c k ' ,   ( )   = >   h a n d l e S e a r c h S e l e c t i o n ( i t e m ) ) ;  
                 } ) ;  
         } ) ;  
  
         / /   C l o s e   s u g g e s t i o n s   w h e n   c l i c k i n g   o u t s i d e  
         d o c u m e n t . a d d E v e n t L i s t e n e r ( ' c l i c k ' ,   ( e )   = >   {  
                 i f   ( ! s e a r c h I n p u t . c o n t a i n s ( e . t a r g e t )   & &   ! s u g g e s t i o n s D i v . c o n t a i n s ( e . t a r g e t ) )   {  
                         s u g g e s t i o n s D i v . s t y l e . d i s p l a y   =   ' n o n e ' ;  
                 }  
         } ) ;  
 }  
  
 / * *  
   *   H a n d l e   s e l e c t i o n   f r o m   s e a r c h   r e s u l t s  
   * /  
 f u n c t i o n   h a n d l e S e a r c h S e l e c t i o n ( i t e m )   {  
         c o n s t   t y p e   =   i t e m . d a t a s e t . t y p e ;  
         c o n s t   n o d e I d   =   i t e m . d a t a s e t . n o d e I d ;  
         c o n s t   n o d e N a m e   =   i t e m . d a t a s e t . n o d e N a m e ;  
  
         / /   S e t   t h e   n o d e   d r o p d o w n  
         c o n s t   n o d e S e l e c t   =   d o c u m e n t . g e t E l e m e n t B y I d ( ' n e w - i n c i d e n t - n o d e ' ) ;  
         n o d e S e l e c t . v a l u e   =   n o d e I d ;  
  
         / /   T r i g g e r   c h a n g e   e v e n t   t o   l o a d   P O N s  
         n o d e S e l e c t . d i s p a t c h E v e n t ( n e w   E v e n t ( ' c h a n g e ' ) ) ;  
  
         i f   ( t y p e   = = =   ' p o n ' )   {  
                 c o n s t   p o n N a m e   =   i t e m . d a t a s e t . p o n N a m e ;  
  
                 / /   W a i t   f o r   c a s c a d e   t o   l o a d ,   t h e n   a u t o - s e l e c t   P O N  
                 s e t T i m e o u t ( ( )   = >   {  
                         / /   E x t r a c t   l e t t e r   a n d   p o r t   f r o m   P O N   n a m e   ( e . g . ,   " P O N   A 3 "   - >   l e t t e r   " A " ,   p o r t   " 3 " )  
                         c o n s t   m a t c h   =   p o n N a m e . m a t c h ( / P O N \ s * ( [ A - Z ] ) ( \ d + ) / i ) ;  
                         i f   ( m a t c h )   {  
                                 c o n s t   l e t t e r   =   m a t c h [ 1 ] . t o U p p e r C a s e ( ) ;  
                                 c o n s t   p o r t   =   m a t c h [ 2 ] ;  
  
                                 / /   S e l e c t   l e t t e r  
                                 c o n s t   l e t t e r S e l e c t   =   d o c u m e n t . g e t E l e m e n t B y I d ( ' p o n - l e t t e r - s e l e c t ' ) ;  
                                 c o n s t   l e t t e r O p t i o n   =   A r r a y . f r o m ( l e t t e r S e l e c t . o p t i o n s ) . f i n d ( o p t   = >  
                                         o p t . t e x t . i n c l u d e s ( l e t t e r )  
                                 ) ;  
                                 i f   ( l e t t e r O p t i o n )   {  
                                         l e t t e r S e l e c t . v a l u e   =   l e t t e r O p t i o n . v a l u e ;  
                                         l e t t e r S e l e c t . d i s p a t c h E v e n t ( n e w   E v e n t ( ' c h a n g e ' ) ) ;  
  
                                         / /   W a i t   f o r   p o r t s   t o   l o a d ,   t h e n   s e l e c t   p o r t  
                                         s e t T i m e o u t ( ( )   = >   {  
                                                 c o n s t   p o r t S e l e c t   =   d o c u m e n t . g e t E l e m e n t B y I d ( ' p o n - p o r t - s e l e c t ' ) ;  
                                                 p o r t S e l e c t . v a l u e   =   p o n N a m e ;  
                                                 p o r t S e l e c t . d i s p a t c h E v e n t ( n e w   E v e n t ( ' c h a n g e ' ) ) ;  
  
                                                 / /   A u t o - c l i c k   " A d d   P O N "   b u t t o n  
                                                 d o c u m e n t . g e t E l e m e n t B y I d ( ' a d d - p o n - b t n ' ) . c l i c k ( ) ;  
                                         } ,   3 0 0 ) ;  
                                 }  
                         }  
                 } ,   3 0 0 ) ;  
         }  
  
         / /   C l e a r   s e a r c h   a n d   h i d e   s u g g e s t i o n s  
         d o c u m e n t . g e t E l e m e n t B y I d ( ' q u i c k - s e a r c h - i n p u t ' ) . v a l u e   =   ' ' ;  
         d o c u m e n t . g e t E l e m e n t B y I d ( ' s e a r c h - s u g g e s t i o n s ' ) . s t y l e . d i s p l a y   =   ' n o n e ' ;  
 }  
  
 / * *  
   *   B u i l d   s e a r c h   c a c h e   f r o m   F i r e s t o r e  
   * /  
 a s y n c   f u n c t i o n   b u i l d S e a r c h C a c h e ( )   {  
         t r y   {  
                 / /   L o a d   a l l   n o d e s  
                 c o n s t   n o d e s S n a p s h o t   =   a w a i t   d b . c o l l e c t i o n ( ' N o d o s ' ) . g e t ( ) ;  
                 a l l N o d e s D a t a   =   [ ] ;  
  
                 f o r   ( c o n s t   n o d e D o c   o f   n o d e s S n a p s h o t . d o c s )   {  
                         c o n s t   n o d e D a t a   =   n o d e D o c . d a t a ( ) ;  
                         c o n s t   n o d e I d   =   n o d e D o c . i d ;  
                         a l l N o d e s D a t a . p u s h ( {   i d :   n o d e I d ,   n a m e :   n o d e D a t a . n a m e   } ) ;  
  
                         / /   L o a d   a l l   P O N s   f o r   t h i s   n o d e  
                         c o n s t   l e t t e r s S n a p s h o t   =   a w a i t   d b . c o l l e c t i o n ( ' N o d o s ' ) . d o c ( n o d e I d ) . c o l l e c t i o n ( ' P O N L e t t e r s ' ) . g e t ( ) ;  
  
                         f o r   ( c o n s t   l e t t e r D o c   o f   l e t t e r s S n a p s h o t . d o c s )   {  
                                 c o n s t   p o n s S n a p s h o t   =   a w a i t   d b . c o l l e c t i o n ( ' N o d o s ' ) . d o c ( n o d e I d )  
                                         . c o l l e c t i o n ( ' P O N L e t t e r s ' ) . d o c ( l e t t e r D o c . i d )  
                                         . c o l l e c t i o n ( ' P O N s ' ) . g e t ( ) ;  
  
                                 p o n s S n a p s h o t . f o r E a c h ( p o n D o c   = >   {  
                                         a l l P o n s D a t a . p u s h ( {  
                                                 n o d e I d :   n o d e I d ,  
                                                 n o d e N a m e :   n o d e D a t a . n a m e ,  
                                                 p o n N a m e :   p o n D o c . d a t a ( ) . n a m e ,  
                                                 p o n I d :   p o n D o c . i d  
                                         } ) ;  
                                 } ) ;  
                         }  
                 }  
  
                 c o n s o l e . l o g ( ` ‚ S&   S e a r c h   c a c h e   b u i l t :   $ { a l l N o d e s D a t a . l e n g t h }   n o d e s ,   $ { a l l P o n s D a t a . l e n g t h }   P O N s ` ) ;  
         }   c a t c h   ( e r r o r )   {  
                 c o n s o l e . e r r o r ( " E r r o r   b u i l d i n g   s e a r c h   c a c h e : " ,   e r r o r ) ;  
         }  
 }  
  
 / * *  
   *   S e t u p   c o p y - l a s t - i n c i d e n t   b u t t o n  
   * /  
 f u n c t i o n   s e t u p C o p y L a s t I n c i d e n t ( )   {  
         c o n s t   b t n   =   d o c u m e n t . g e t E l e m e n t B y I d ( ' c o p y - l a s t - i n c i d e n t - b t n ' ) ;  
         i f   ( ! b t n )   r e t u r n ;  
  
         b t n . a d d E v e n t L i s t e n e r ( ' c l i c k ' ,   a s y n c   ( )   = >   {  
                 t r y   {  
                         / /   F e t c h   t h e   m o s t   r e c e n t   i n c i d e n t  
                         c o n s t   s n a p s h o t   =   a w a i t   d b . c o l l e c t i o n ( C O L L E C T I O N _ N A M E )  
                                 . o r d e r B y ( ' c r e a t e d _ a t ' ,   ' d e s c ' )  
                                 . l i m i t ( 1 )  
                                 . g e t ( ) ;  
  
                         i f   ( s n a p s h o t . e m p t y )   {  
                                 a l e r t ( " N o   h a y   i n c i d e n t e s   p r e v i o s   p a r a   c o p i a r . " ) ;  
                                 r e t u r n ;  
                         }  
  
                         c o n s t   l a s t I n c i d e n t   =   s n a p s h o t . d o c s [ 0 ] . d a t a ( ) ;  
                         l a s t I n c i d e n t D a t a   =   l a s t I n c i d e n t ;  
  
                         / /   P r e - f i l l   t h e   f o r m  
                         i f   ( l a s t I n c i d e n t . n o d e _ i d )   {  
                                 c o n s t   n o d e S e l e c t   =   d o c u m e n t . g e t E l e m e n t B y I d ( ' n e w - i n c i d e n t - n o d e ' ) ;  
                                 n o d e S e l e c t . v a l u e   =   l a s t I n c i d e n t . n o d e _ i d ;  
                                 n o d e S e l e c t . d i s p a t c h E v e n t ( n e w   E v e n t ( ' c h a n g e ' ) ) ;  
                         }  
  
                         i f   ( l a s t I n c i d e n t . f a i l u r e _ t y p e )   {  
                                 d o c u m e n t . g e t E l e m e n t B y I d ( ' n e w - i n c i d e n t - t y p e ' ) . v a l u e   =   l a s t I n c i d e n t . f a i l u r e _ t y p e ;  
                         }  
  
                         i f   ( l a s t I n c i d e n t . a f f e c t e d _ p o n s   & &   l a s t I n c i d e n t . a f f e c t e d _ p o n s . l e n g t h   >   0 )   {  
                                 / /   A u t o - s e l e c t   P O N s   ( s i m p l i f i e d   -   j u s t   a d d   t h e m   t o   t h e   l i s t )  
                                 s e l e c t e d P o n s   =   [ . . . l a s t I n c i d e n t . a f f e c t e d _ p o n s ] ;  
                                 u p d a t e S e l e c t e d P o n s U I ( ) ;  
                         }  
  
                         / /   V i s u a l   f e e d b a c k  
                         b t n . i n n e r H T M L   =   ' < i   d a t a - l u c i d e = " c h e c k " > < / i >   ¬ ° C o p i a d o ! ' ;  
                         b t n . s t y l e . b a c k g r o u n d   =   ' # 1 0 b 9 8 1 ' ;  
                         i f   ( w i n d o w . l u c i d e )   w i n d o w . l u c i d e . c r e a t e I c o n s ( ) ;  
  
                         s e t T i m e o u t ( ( )   = >   {  
                                 b t n . i n n e r H T M L   =   ' < i   d a t a - l u c i d e = " c o p y " > < / i >   C o p i a r   d e l   √ al t i m o   I n c i d e n t e ' ;  
                                 b t n . s t y l e . b a c k g r o u n d   =   ' ' ;  
                                 i f   ( w i n d o w . l u c i d e )   w i n d o w . l u c i d e . c r e a t e I c o n s ( ) ;  
                         } ,   2 0 0 0 ) ;  
  
                 }   c a t c h   ( e r r o r )   {  
                         c o n s o l e . e r r o r ( " E r r o r   c o p y i n g   l a s t   i n c i d e n t : " ,   e r r o r ) ;  
                         a l e r t ( " E r r o r   a l   c o p i a r   e l   √ ∫ l t i m o   i n c i d e n t e . " ) ;  
                 }  
         } ) ;  
 }  
 