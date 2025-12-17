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
 * Muestra una notificación toast
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - 'success' | 'error' | 'warning' | 'info'
 * @param {number} duration - Duración en ms (default 4000)
 */
export function showToast(message, type = 'info', duration = 4000) {
    initToastContainer();

    const colors = {
        success: { bg: '#10b981', icon: '✓' },
        error: { bg: '#ef4444', icon: '✕' },
        warning: { bg: '#f59e0b', icon: '⚠' },
        info: { bg: '#3b82f6', icon: 'ℹ' }
    };

    const { bg, icon } = colors[type] || colors.info;

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.style.cssText = `
        background: ${bg};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
        cursor: pointer;
    `;

    toast.innerHTML = `
        <span style="font-size: 18px;">${icon}</span>
        <span>${message}</span>
    `;

    // Add animation styles if not present
    if (!document.getElementById('toast-styles')) {
        const styles = document.createElement('style');
        styles.id = 'toast-styles';
        styles.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(styles);
    }

    const container = document.getElementById(TOAST_CONTAINER_ID);
    container.appendChild(toast);

    // Auto-remove after duration
    const removeToast = () => {
        toast.style.animation = 'slideOut 0.3s ease-out forwards';
        setTimeout(() => toast.remove(), 300);
    };

    toast.addEventListener('click', removeToast);
    setTimeout(removeToast, duration);

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
