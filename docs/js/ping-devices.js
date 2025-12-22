/**
 * Ping Devices Management UI
 * - Loads from /ping-devices API
 * - CRUD operations for superadmin only
 */

import { auth } from './firebase.js';

const isProduction = window.location.hostname.includes('github.io');
const API_URL = isProduction
    ? 'https://turnos-app-8viu.onrender.com'
    : 'http://localhost:3001';

// State
let devices = [];
let isLoading = false;

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

// Load devices from API
async function loadPingDevices() {
    const container = document.getElementById('ping-devices-list');
    if (!container) return;

    isLoading = true;
    container.innerHTML = '<div style="padding: 1rem; text-align: center; color: #9ca3af;"><i data-lucide="loader-2" class="animate-spin" style="width:20px;height:20px;"></i> Cargando...</div>';

    try {
        devices = await callApi('/ping-devices', 'GET');
        renderDevicesList();
    } catch (error) {
        console.error('Error loading devices:', error);
        container.innerHTML = `<div style="padding: 1rem; color: #ef4444;">Error: ${error.message}</div>`;
    }
    isLoading = false;
}

function renderDevicesList() {
    const container = document.getElementById('ping-devices-list');
    if (!container) return;

    if (devices.length === 0) {
        container.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: #6b7280;">
                <i data-lucide="server-off" style="width:32px;height:32px;margin-bottom:0.5rem;"></i>
                <p>No hay dispositivos configurados</p>
                <p style="font-size:0.75rem;">Haz clic en "Agregar" para añadir uno</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    let html = '';
    devices.forEach(device => {
        const statusClass = device.lastStatus === 'up' ? 'bg-green-500' :
            device.lastStatus === 'down' ? 'bg-red-500' : 'bg-gray-500';
        const statusText = device.lastStatus === 'up' ? 'Online' :
            device.lastStatus === 'down' ? 'Offline' : 'Desconocido';

        html += `
            <div class="ping-device-item" data-id="${device.id}">
                <div class="device-status-dot ${statusClass}"></div>
                <div class="device-info">
                    <span class="device-name">${device.name}</span>
                    <span class="device-ip">${device.ip}</span>
                </div>
                <div class="device-actions">
                    <button class="device-action-btn test-btn" onclick="window.testPingDevice('${device.id}', '${device.ip}')" title="Probar ping">
                        <i data-lucide="activity" style="width:14px;height:14px;"></i>
                    </button>
                    <button class="device-action-btn edit-btn" onclick="window.editPingDevice('${device.id}')" title="Editar">
                        <i data-lucide="edit-2" style="width:14px;height:14px;"></i>
                    </button>
                    <button class="device-action-btn delete-btn" onclick="window.deletePingDevice('${device.id}')" title="Eliminar">
                        <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
}

// Test ping for a specific device
window.testPingDevice = async function (id, ip) {
    const item = document.querySelector(`.ping-device-item[data-id="${id}"]`);
    const dot = item?.querySelector('.device-status-dot');

    if (dot) {
        dot.className = 'device-status-dot bg-yellow-500 animate-pulse';
    }

    try {
        const result = await callApi('/ping-devices/test', 'POST', { ip });

        if (dot) {
            dot.className = `device-status-dot ${result.status === 'up' ? 'bg-green-500' : 'bg-red-500'}`;
        }

        // Update device in local state
        const device = devices.find(d => d.id === id);
        if (device) device.lastStatus = result.status;

        showToastPing(result.status === 'up' ? `${ip} está online ✓` : `${ip} no responde ✗`,
            result.status === 'up' ? 'success' : 'error');
    } catch (error) {
        if (dot) dot.className = 'device-status-dot bg-red-500';
        showToastPing(`Error: ${error.message}`, 'error');
    }
};

// Add new device
window.openAddDeviceModal = function () {
    document.getElementById('device-modal-title').textContent = 'Agregar Dispositivo';
    document.getElementById('device-id').value = '';
    document.getElementById('device-name').value = '';
    document.getElementById('device-ip').value = '';
    document.getElementById('device-type').value = 'node';
    document.getElementById('ping-device-modal').style.display = 'flex';
};

// Edit device
window.editPingDevice = function (id) {
    const device = devices.find(d => d.id === id);
    if (!device) return;

    document.getElementById('device-modal-title').textContent = 'Editar Dispositivo';
    document.getElementById('device-id').value = device.id;
    document.getElementById('device-name').value = device.name;
    document.getElementById('device-ip').value = device.ip;
    document.getElementById('device-type').value = device.type || 'node';
    document.getElementById('ping-device-modal').style.display = 'flex';
};

// Save device (create or update)
window.savePingDevice = async function () {
    const id = document.getElementById('device-id').value;
    const name = document.getElementById('device-name').value.trim();
    const ip = document.getElementById('device-ip').value.trim();
    const type = document.getElementById('device-type').value;

    if (!name || !ip) {
        showToastPing('Nombre e IP son requeridos', 'error');
        return;
    }

    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) {
        showToastPing('Formato de IP inválido', 'error');
        return;
    }

    try {
        if (id) {
            await callApi(`/ping-devices/${id}`, 'PUT', { name, ip, type });
            showToastPing('Dispositivo actualizado', 'success');
        } else {
            await callApi('/ping-devices', 'POST', { name, ip, type });
            showToastPing('Dispositivo agregado', 'success');
        }

        closePingDeviceModal();
        loadPingDevices();
    } catch (error) {
        showToastPing(`Error: ${error.message}`, 'error');
    }
};

// Delete device
window.deletePingDevice = async function (id) {
    if (!confirm('¿Eliminar este dispositivo del monitoreo?')) return;

    try {
        await callApi(`/ping-devices/${id}`, 'DELETE');
        showToastPing('Dispositivo eliminado', 'success');
        loadPingDevices();
    } catch (error) {
        showToastPing(`Error: ${error.message}`, 'error');
    }
};

window.closePingDeviceModal = function () {
    document.getElementById('ping-device-modal').style.display = 'none';
};

function closePingDeviceModal() {
    document.getElementById('ping-device-modal').style.display = 'none';
}

function showToastPing(message, type = 'info') {
    // Use existing toast if available, otherwise console
    if (window.showToast) {
        window.showToast(message, type);
    } else {
        console.log(`[${type}] ${message}`);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if container exists (means we're on uptime page and user is superadmin)
    setTimeout(() => {
        const container = document.getElementById('ping-devices-container');
        if (container && container.style.display !== 'none') {
            loadPingDevices();
        }
    }, 1500); // Wait for auth to complete
});

// Export for external use
export { loadPingDevices };
