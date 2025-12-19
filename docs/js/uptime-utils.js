/**
 * Uptime Dashboard - Utility Module
 * Funciones de utilidad profesionales para el dashboard de uptime
 */

// ==========================================
// 1. TIMESTAMP UTILITIES
// ==========================================

/**
 * Parsea cualquier formato de timestamp a Date
 * Soporta: Firestore Timestamp, serializado, ISO string, Date object
 */
export function parseTimestamp(timestamp) {
    if (!timestamp) return null;

    try {
        if (timestamp instanceof Date) {
            return timestamp;
        }
        if (timestamp.toDate && typeof timestamp.toDate === 'function') {
            return timestamp.toDate(); // Firestore Timestamp
        }
        if (timestamp._seconds) {
            return new Date(timestamp._seconds * 1000); // Firestore serialized
        }
        if (timestamp.seconds) {
            return new Date(timestamp.seconds * 1000); // Firestore object
        }
        // Try parsing as string/number
        const parsed = new Date(timestamp);
        return isNaN(parsed.getTime()) ? null : parsed;
    } catch (e) {
        console.error("parseTimestamp error:", e, timestamp);
        return null;
    }
}

/**
 * Formatea timestamp a hora (HH:mm)
 */
export function formatTime(timestamp) {
    const d = parseTimestamp(timestamp);
    if (!d) return '-';
    return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Formatea timestamp a fecha corta (DD/MM HH:mm)
 */
export function formatDate(timestamp) {
    const d = parseTimestamp(timestamp);
    if (!d) return '-';
    return d.toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Formatea timestamp a fecha completa
 */
export function formatFullDate(timestamp) {
    const d = parseTimestamp(timestamp);
    if (!d) return '-';
    return d.toLocaleString('es-CL', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Formatea duración en minutos a formato legible
 */
export function formatDuration(minutes) {
    if (!minutes && minutes !== 0) return '-';
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Calcula tiempo transcurrido desde una fecha
 */
export function getElapsedTime(startTimestamp) {
    const start = parseTimestamp(startTimestamp);
    if (!start) return { hours: 0, minutes: 0, text: '-' };

    const now = new Date();
    const diffMs = now - start;
    const diffMins = Math.floor(diffMs / 60000);
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;

    return { hours: h, minutes: m, text: `${h}h ${m}m` };
}

// ==========================================
// 2. TOAST NOTIFICATION SYSTEM
// ==========================================

const TOAST_CONTAINER_ID = 'toast-container';

/**
 * Inicializa el contenedor de toasts si no existe
 */
function initToastContainer() {
    if (document.getElementById(TOAST_CONTAINER_ID)) return;

    const container = document.createElement('div');
    container.id = TOAST_CONTAINER_ID;
    container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: 400px;
    `;
    document.body.appendChild(container);
}

/**
 * Muestra una notificación toast elegante con glassmorphism
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - 'success' | 'error' | 'warning' | 'info'
 * @param {number} duration - Duración en ms (default 5000)
 */
export function showToast(message, type = 'info', duration = 5000) {
    initToastContainer();

    const themes = {
        success: {
            gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95))',
            borderColor: 'rgba(16, 185, 129, 0.5)',
            icon: `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`
        },
        error: {
            gradient: 'linear-gradient(135deg, rgba(220, 38, 38, 0.95), rgba(185, 28, 28, 0.95))',
            borderColor: 'rgba(239, 68, 68, 0.5)',
            icon: `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.07 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>`
        },
        warning: {
            gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.95), rgba(217, 119, 6, 0.95))',
            borderColor: 'rgba(245, 158, 11, 0.5)',
            icon: `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
        },
        info: {
            gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.95), rgba(37, 99, 235, 0.95))',
            borderColor: 'rgba(59, 130, 246, 0.5)',
            icon: `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
        }
    };

    const theme = themes[type] || themes.info;

    const toast = document.createElement('div');
    toast.className = 'toast-notification toast-elegant';
    toast.style.cssText = `
        background: ${theme.gradient};
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        color: white;
        padding: 14px 20px;
        border-radius: 12px;
        border: 1px solid ${theme.borderColor};
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255,255,255,0.1) inset;
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 14px;
        font-weight: 500;
        animation: toastSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        cursor: pointer;
        transform-origin: right center;
        max-width: 400px;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    `;

    toast.innerHTML = `
        <span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;background:rgba(255,255,255,0.2);border-radius:8px;flex-shrink:0;">${theme.icon}</span>
        <span style="flex:1;line-height:1.4;">${message}</span>
        <span class="toast-close" style="opacity:0.6;cursor:pointer;padding:4px;margin:-4px;display:flex;font-size:16px;transition:opacity 0.2s;">✕</span>
    `;

    // Add elegant animation styles
    if (!document.getElementById('toast-styles-elegant')) {
        const styles = document.createElement('style');
        styles.id = 'toast-styles-elegant';
        styles.textContent = `
            @keyframes toastSlideIn {
                from { transform: translateX(100%) scale(0.95); opacity: 0; }
                to { transform: translateX(0) scale(1); opacity: 1; }
            }
            @keyframes toastSlideOut {
                from { transform: translateX(0) scale(1); opacity: 1; }
                to { transform: translateX(100%) scale(0.95); opacity: 0; }
            }
            .toast-elegant:hover { transform: scale(1.02); box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.15) inset; }
            .toast-close:hover { opacity: 1 !important; }
        `;
        document.head.appendChild(styles);
    }

    const container = document.getElementById(TOAST_CONTAINER_ID);
    container.appendChild(toast);

    // Close button functionality
    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeToast();
        });
    }

    // Click to dismiss
    toast.addEventListener('click', removeToast);

    // Auto-remove after duration
    const timeoutId = setTimeout(removeToast, duration);

    function removeToast() {
        clearTimeout(timeoutId);
        toast.style.animation = 'toastSlideOut 0.3s ease-out forwards';
        setTimeout(() => toast.remove(), 300);
    }

    return toast;
}

// ==========================================
// 3. TIMER MANAGER (prevents memory leaks)
// ==========================================

class TimerManagerClass {
    constructor() {
        this.timers = new Map();
    }

    /**
     * Inicia un timer para un incidente
     * @param {string} id - ID del incidente
     * @param {any} startTimestamp - Timestamp de inicio
     * @param {HTMLElement} element - Elemento a actualizar
     */
    startTimer(id, startTimestamp, element) {
        // Limpiar timer existente si hay
        this.stopTimer(id);

        const update = () => {
            const elapsed = getElapsedTime(startTimestamp);
            if (element) {
                element.textContent = elapsed.text;
            }
        };

        update(); // Actualización inmediata
        const intervalId = setInterval(update, 60000); // Cada minuto

        this.timers.set(id, intervalId);
    }

    /**
     * Detiene un timer específico
     */
    stopTimer(id) {
        if (this.timers.has(id)) {
            clearInterval(this.timers.get(id));
            this.timers.delete(id);
        }
    }

    /**
     * Detiene todos los timers
     */
    stopAll() {
        this.timers.forEach((intervalId) => clearInterval(intervalId));
        this.timers.clear();
    }

    /**
     * Obtiene cantidad de timers activos
     */
    get count() {
        return this.timers.size;
    }
}

// Singleton instance
export const TimerManager = new TimerManagerClass();

// ==========================================
// 4. LOADING STATE HELPERS
// ==========================================

/**
 * Muestra skeleton loader en un elemento
 */
export function showSkeleton(element, rows = 3) {
    if (!element) return;

    let html = '';
    for (let i = 0; i < rows; i++) {
        html += `
            <tr class="skeleton-row">
                <td colspan="100%">
                    <div class="skeleton-loader" style="
                        height: 40px;
                        background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%);
                        background-size: 200% 100%;
                        animation: shimmer 1.5s infinite;
                        border-radius: 4px;
                    "></div>
                </td>
            </tr>
        `;
    }

    // Add shimmer animation if not present
    if (!document.getElementById('skeleton-styles')) {
        const styles = document.createElement('style');
        styles.id = 'skeleton-styles';
        styles.textContent = `
            @keyframes shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
            }
        `;
        document.head.appendChild(styles);
    }

    element.innerHTML = html;
}

/**
 * Muestra estado de carga en un botón
 */
export function setButtonLoading(button, loading = true, originalText = null) {
    if (!button) return;

    if (loading) {
        button.dataset.originalText = button.innerHTML;
        button.disabled = true;
        button.innerHTML = `
            <span class="spinner" style="
                display: inline-block;
                width: 16px;
                height: 16px;
                border: 2px solid rgba(255,255,255,0.3);
                border-top-color: white;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            "></span>
            Cargando...
        `;

        // Add spin animation if not present
        if (!document.getElementById('spinner-styles')) {
            const styles = document.createElement('style');
            styles.id = 'spinner-styles';
            styles.textContent = `
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(styles);
        }
    } else {
        button.disabled = false;
        button.innerHTML = originalText || button.dataset.originalText || 'Continuar';
    }
}

// ==========================================
// 5. DATA EXPORT UTILITIES
// ==========================================

/**
 * Exporta datos a CSV
 */
export function exportToCSV(data, filename = 'export.csv') {
    if (!data || data.length === 0) {
        showToast('No hay datos para exportar', 'warning');
        return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row =>
            headers.map(h => {
                let cell = row[h] ?? '';
                // Escape commas and quotes
                if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
                    cell = `"${cell.replace(/"/g, '""')}"`;
                }
                return cell;
            }).join(',')
        )
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();

    showToast(`Exportado: ${filename}`, 'success');
}

console.log('✅ Uptime Utils loaded');
