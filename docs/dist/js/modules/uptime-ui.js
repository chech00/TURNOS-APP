import {
    formatTime, formatDate, formatDuration, TimerManager
} from '../uptime-utils.js';

// Helper: Escape HTML
export function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function getFailureBadge(type) {
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

export function renderActiveIncidents(activeIncidents, container, tableBody) {
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
            // Live Timer
            const el = document.getElementById(`timer-${data.id}`);
            if (el) TimerManager.startTimer(data.id, data.start_date, el);
        });

        // Ensure icons render
        if (window.lucide) window.lucide.createIcons();

    } else {
        if (container) container.style.display = 'none';
        // Clear table body just in case
        if (tableBody) tableBody.innerHTML = '';
    }
}

export function renderHistoryTable(historyIncidents) {
    // Inject modern styles if not present (Done in uptime.js usually, but we can verify)

    // Total Clients Constant (Internal)
    const TOTAL_CLIENTS = 10700;

    const historyTableBody = document.getElementById('uptime-table-body');
    if (!historyTableBody) return;

    if (historyIncidents.length === 0) {
        historyTableBody.innerHTML = `<tr><td colspan="14" class="text-center" style="padding: 3rem; color: #6b7280;">
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
                    
                    <!-- NEW METRICS -->
                     <td class="text-center" style="font-size: 0.8rem; color: #d1d5db;">
                        ${((data.affected_customers || 0) / TOTAL_CLIENTS * 100).toFixed(2)}%
                    </td>
                    <td class="text-center" style="font-family: monospace; font-size: 0.8rem;">
                        ${Math.round((typeof data.restore_time === 'number' ? data.restore_time : 0) * (data.affected_customers || 0)).toLocaleString()} min
                    </td>
                     <td class="text-center" style="font-size: 0.8rem; color: ${(Math.round((typeof data.restore_time === 'number' ? data.restore_time : 0) * (data.affected_customers || 0)) / (TOTAL_CLIENTS * 1440 * 30) * 100) > 0.001 ? '#f87171' : '#10b981'};">
                        -${(Math.round((typeof data.restore_time === 'number' ? data.restore_time : 0) * (data.affected_customers || 0)) / (TOTAL_CLIENTS * 1440 * 30) * 100).toFixed(4)}%
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

export function updateReviewCounter(count) {
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

export function updateStats(active, history) {
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

export function updateLastUpdateIndicator() {
    const indicator = document.getElementById('last-update-indicator');
    if (indicator) {
        const now = new Date();
        indicator.textContent = `Última actualización: ${formatTime(now)}`;
    }
}

export function populateNodeFilter(incidents) {
    const filterNode = document.getElementById('filter-node');
    if (!filterNode) return;

    const uniqueNodes = [...new Set(incidents.map(i => i.node).filter(Boolean))].sort();
    filterNode.innerHTML = '<option value="">Todos los nodos</option>';
    uniqueNodes.forEach(node => {
        filterNode.innerHTML += `<option value="${node}">${node}</option>`;
    });
}
