/**
 * Dude Configuration Management UI
 * - Loads/saves config from /dude-config API
 * - Handles mode toggle between Ping and Dude
 */

import { auth } from './firebase.js';

const isProduction = window.location.hostname.includes('github.io');
const API_URL = isProduction
    ? 'https://turnos-app-8viu.onrender.com'
    : 'http://localhost:3000';

async function callApi(endpoint, method, body = null) {
    const user = auth.currentUser;
    if (!user) throw new Error("Usuario no autenticado");

    const token = await user.getIdToken();
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };

    if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_URL}${endpoint}`, options);
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error en API');
    }
    return response.json();
}

function showConfigStatus(message, type = 'loading') {
    const status = document.getElementById('dude-config-status');
    if (status) {
        status.textContent = message;
        status.className = `config-status ${type}`;
        status.style.display = 'block';

        if (type !== 'loading') {
            setTimeout(() => {
                status.style.display = 'none';
            }, 3000);
        }
    }
}

// Load current config from API
async function loadDudeConfig() {
    const container = document.getElementById('dude-config-container');
    if (!container || container.style.display === 'none') return;

    try {
        const config = await callApi('/dude-config', 'GET');

        // Populate fields
        document.getElementById('dude-host').value = config.host || '';
        document.getElementById('dude-port').value = config.port || 8728;
        document.getElementById('dude-user').value = config.user || '';
        document.getElementById('dude-pass').value = config.pass || '';

        // Set mode radio
        const modeRadios = document.querySelectorAll('input[name="monitor-mode"]');
        modeRadios.forEach(radio => {
            radio.checked = radio.value === config.mode;
        });

        console.log('✅ Dude config loaded:', config.mode);
    } catch (error) {
        console.error('Error loading dude config:', error);
    }
}

// Save config to API
// Helper to manage button state
function setButtonLoading(btnId, isLoading, originalText = '') {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    if (isLoading) {
        btn.dataset.originalText = btn.innerHTML; // Save original content
        btn.innerHTML = `<i data-lucide="loader-2" class="animate-spin" style="width:16px;height:16px;margin-right:8px;"></i> Procesando...`;
        btn.disabled = true;
        btn.style.opacity = '0.7';
    } else {
        btn.innerHTML = btn.dataset.originalText || originalText;
        btn.disabled = false;
        btn.style.opacity = '1';
        if (window.lucide) lucide.createIcons();
    }
}

// Save config to API
window.saveDudeConfig = async function () {
    // Button ID assumption: we need to find the save button.
    // Since it's inside a form, we might need to add an ID to the button in HTML if it doesn't have one.
    // For now assuming ID 'btn-save-dude-config' (I will check HTML next).
    // Let's rely on showConfigStatus for text feedback but use button spinner too.

    // Fallback if ID not found, just use showConfigStatus
    const btnId = 'btn-save-dude-config';

    showConfigStatus('Guardando...', 'loading');
    setButtonLoading(btnId, true);

    const host = document.getElementById('dude-host').value.trim();
    const port = document.getElementById('dude-port').value;
    const user = document.getElementById('dude-user').value.trim();
    const pass = document.getElementById('dude-pass').value;
    const mode = document.querySelector('input[name="monitor-mode"]:checked')?.value || 'ping';

    if (!host || !user) {
        showConfigStatus('Host y Usuario son requeridos', 'error');
        setButtonLoading(btnId, false);
        return;
    }

    try {
        await callApi('/dude-config', 'PUT', { host, port, user, pass, mode });
        showConfigStatus('Configuración guardada ✓', 'success');
    } catch (error) {
        showConfigStatus(`Error: ${error.message}`, 'error');
    } finally {
        setButtonLoading(btnId, false);
    }
};

// Test connection
window.testDudeConnection = async function () {
    const btnId = 'btn-test-dude-config'; // Assumption, will verify HTML
    showConfigStatus('Probando conexión...', 'loading');
    setButtonLoading(btnId, true);

    const host = document.getElementById('dude-host').value.trim();
    const port = document.getElementById('dude-port').value;
    const user = document.getElementById('dude-user').value.trim();
    const pass = document.getElementById('dude-pass').value;

    if (!host || !port) {
        showConfigStatus('Ingresa Host y Puerto', 'error');
        setButtonLoading(btnId, false);
        return;
    }

    try {
        const result = await callApi('/dude-config/test', 'POST', { host, port, user, pass });
        showConfigStatus(result.message, result.success ? 'success' : 'error');
    } catch (error) {
        showConfigStatus(`Error: ${error.message}`, 'error');
    } finally {
        setButtonLoading(btnId, false);
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const container = document.getElementById('dude-config-container');
        if (container && container.style.display !== 'none') {
            loadDudeConfig();
        }
    }, 1500);
});

export { loadDudeConfig };
