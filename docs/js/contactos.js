import { auth, db as firestore } from './firebase.js';
import { API_BASE_URL } from './modules/config.js';

// ==========================================
// CONTACTOS DE NODOS - JavaScript
// ==========================================

let allContacts = [];
let currentUserRole = 'user';
let selectedContactId = null;
let map = null;
let markers = [];

const PHOTO_FOLDER = 'node-photos';
let pendingPhotoFile = null; // File pending upload

// Initialize when Firebase is ready
function initContactsPage() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            document.getElementById('user-display-name').textContent = user.displayName || user.email;
            document.getElementById('user-display-email').textContent = user.email;

            try {
                const roleDoc = await firestore.collection('userRoles').doc(user.uid).get();
                if (roleDoc.exists) {
                    currentUserRole = roleDoc.data().rol || 'user';
                }
                document.getElementById('user-role-text').textContent = currentUserRole.toUpperCase();
                localStorage.setItem('userRole', currentUserRole);

                if (currentUserRole === 'admin' || currentUserRole === 'superadmin') {
                    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'flex');
                }
                if (currentUserRole === 'superadmin') {
                    document.querySelectorAll('.superadmin-only').forEach(el => el.style.display = 'flex');
                }
            } catch (error) {
                console.warn('Error fetching role:', error);
            }

            loadContacts();
        } else {
            window.location.href = 'login.html';
        }
    });

    setupEventListeners();
}

function setupEventListeners() {
    // Node selector change


    // Filters
    document.getElementById('search-input').addEventListener('input', renderContactGrid);
    document.getElementById('filter-tipo').addEventListener('change', renderContactGrid);

    // Add contact
    document.getElementById('btn-add-contact').addEventListener('click', () => openModal(false));

    // Modal
    document.getElementById('btn-close-modal').addEventListener('click', closeModal);
    document.getElementById('contact-modal').addEventListener('click', (e) => {
        if (e.target.id === 'contact-modal') closeModal();
    });
    document.getElementById('contact-form').addEventListener('submit', saveContact);

    // Map toggle
    document.getElementById('btn-toggle-map').addEventListener('click', toggleMap);

    // Sidebar toggle
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    if (menuToggle && sidebar && mainContent) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('expanded');
            mainContent.classList.toggle('expanded');
        });
    }

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            auth.signOut()
                .then(() => {
                    localStorage.removeItem('userRole');
                    window.location.href = 'login.html';
                })
                .catch((error) => {
                    console.error('Error al cerrar sesión:', error);
                });
        });
    }

    // Card action buttons


    // CSV Import
    document.getElementById('btn-import-csv').addEventListener('click', () => {
        document.getElementById('csv-file-input').click();
    });
    document.getElementById('csv-file-input').addEventListener('change', (e) => handleCSVImport(e));

    // Photo input change
    document.getElementById('photo-input').addEventListener('change', handlePhotoSelect);
}

document.addEventListener('DOMContentLoaded', initContactsPage);

// ==========================================
// LOAD CONTACTS
// ==========================================
async function loadContacts() {
    try {
        const snapshot = await firestore.collection('node_contacts').orderBy('node', 'asc').get();
        allContacts = [];
        snapshot.forEach(doc => allContacts.push({ id: doc.id, ...doc.data() }));
        console.log(`✅ Loaded ${allContacts.length} contacts`);
        updateStats();
        renderContactGrid();
    } catch (error) {
        console.error('Error loading contacts:', error);
        showToast('Error cargando contactos', 'error');
    }
}

// ==========================================
// POPULATE NODE SELECTOR
// ==========================================
// ==========================================
// RENDER CONTACT GRID
// ==========================================
function renderContactGrid() {
    const grid = document.getElementById('contacts-grid');
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const filterTipo = document.getElementById('filter-tipo').value;
    const emptyState = document.getElementById('empty-state');

    // Filter contacts
    let filtered = allContacts.filter(c => {
        const matchSearch = !searchTerm ||
            (c.node && c.node.toLowerCase().includes(searchTerm)) ||
            (c.nombre && c.nombre.toLowerCase().includes(searchTerm));
        const matchTipo = !filterTipo || c.tipo === filterTipo;
        return matchSearch && matchTipo;
    });

    // Clear grid
    grid.innerHTML = '';

    if (filtered.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    // Animation delay counter
    let delay = 0;

    filtered.forEach(contact => {
        const card = document.createElement('div');
        card.className = 'mini-card';
        card.style.animationDelay = `${delay}ms`;
        delay += 50; // Stagger effect

        // Determine icon based on type
        let iconName = 'radio';
        if (contact.tipo === 'Gabinete') iconName = 'box';
        if (contact.tipo === 'Torre') iconName = 'radio-tower';
        if (contact.tipo === 'Fibra') iconName = 'network';

        // Online status logic (mocked for now, can be linked to Uptime later)
        const isOnline = true;

        card.innerHTML = `
            <div class="mini-card-header">
                <div class="mini-card-icon">
                    <i data-lucide="${iconName}"></i>
                </div>
                ${isOnline ? '<div class="status-dot" title="Online"></div>' : ''}
            </div>
            <div>
                <h3 class="mini-card-title" title="${contact.node}">${contact.node}</h3>
                <div class="mini-card-subtitle">
                    <i data-lucide="tag" style="width:12px;height:12px;"></i>
                    ${contact.tipo || 'N/A'}
                </div>
            </div>
        `;

        card.addEventListener('click', () => showContactDetails(contact.id));
        grid.appendChild(card);
    });

    if (window.lucide) window.lucide.createIcons();
}

// ==========================================
// SHOW CONTACT DETAILS
// ==========================================
// ==========================================
// SHOW CONTACT DETAILS (MODAL)
// ==========================================
function showContactDetails(contactId) {
    if (!contactId) return;

    const contact = allContacts.find(c => c.id === contactId);
    if (!contact) return;

    selectedContactId = contactId;
    const modal = document.getElementById('details-modal');
    const contentWrapper = document.getElementById('details-content-wrapper');

    // Header updates
    document.getElementById('modal-node-name').textContent = contact.node || 'Sin nombre';
    document.getElementById('modal-tipo-badge').textContent = contact.tipo || 'N/A';

    // Construct the Card HTML dynamically (Same structure as before but injected)
    // We add "Click to Copy" functionality here

    let phoneHtml = '<span class="info-value">-</span>';
    if (contact.telefono) {
        const cleanPhone = contact.telefono.replace(/\s/g, '');
        const whatsappPhone = cleanPhone.startsWith('+') ? cleanPhone.substring(1) : cleanPhone;
        phoneHtml = `
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-texto-principal); margin-bottom: 0.75rem; letter-spacing: 0.5px;">${contact.telefono}</div>
            <div class="phone-actions">
                <a href="tel:${cleanPhone}" class="phone-btn">
                    <i data-lucide="phone" style="width:14px;height:14px;"></i> Llamar
                </a>
                <a href="https://wa.me/${whatsappPhone}" target="_blank" class="phone-btn whatsapp-btn">
                    <i data-lucide="message-circle" style="width:14px;height:14px;"></i> WhatsApp
                </a>
                <button class="phone-btn" style="background:#4b5563;" onclick="copyToClipboard('${cleanPhone}')" title="Copiar número">
                     <i data-lucide="copy" style="width:14px;height:14px;"></i>
                </button>
            </div>
        `;
    }

    // Autonomy Badge
    const autonomiaValue = contact.autonomia || '-';
    let badgeHtml = '';
    if (autonomiaValue !== '-') {
        const hours = parseFloat(autonomiaValue);
        let badgeClass = 'low';
        let badgeText = '● Baja';
        if (hours >= 12) { badgeClass = 'high'; badgeText = '● Alta'; }
        else if (hours >= 6) { badgeClass = 'medium'; badgeText = '● Media'; }

        badgeHtml = `<span class="autonomy-badge ${badgeClass}">${badgeText}</span>`;
    }

    // Buttons Visibility
    const showMap = contact.coordenadas ? 'flex' : 'none';
    const showEdit = canEdit() ? 'flex' : 'none';
    const showDelete = canDelete() ? 'flex' : 'none';

    contentWrapper.innerHTML = `
         <!-- Actions Bar inside Modal -->
         <div class="card-actions" style="margin-bottom: 1.5rem; justify-content: flex-end;">
            <button class="btn-icon btn-map" style="display:${showMap}" onclick="window.showOnMap('${contact.id}')">
                <i data-lucide="map-pin" style="width:16px;height:16px;"></i> Ver en Mapa
            </button>
            <button class="btn-icon btn-edit" style="display:${showEdit}" onclick="window.editContact('${contact.id}')">
                <i data-lucide="edit" style="width:16px;height:16px;"></i> Editar
            </button>
            <button class="btn-icon btn-delete" style="display:${showDelete}" onclick="window.deleteContact('${contact.id}')">
                <i data-lucide="trash-2" style="width:16px;height:16px;"></i> Eliminar
            </button>
        </div>

        <!-- Node Photo -->
        <div class="node-photo-section" style="border-radius:12px; margin-bottom:1.5rem;" onclick="openLightbox()">
            ${contact.photoUrl
            ? `<img id="node-photo" src="${contact.photoUrl}" alt="Foto del nodo" style="display:block;">`
            : `<div class="node-photo-placeholder" style="display:flex;"><i data-lucide="image" style="width:48px;height:48px;"></i><span>Sin foto del sitio</span></div>`
        }
             <span class="photo-expand-hint">Clic para ampliar</span>
        </div>

        <div class="contact-info-grid-enhanced">
            <!-- Row 1 -->
            <div class="info-card">
                <div class="info-card-header"><i data-lucide="user" class="info-icon"></i><span class="info-label">CONTACTO</span></div>
                <span class="info-value">${contact.nombre || '-'}</span>
            </div>
            <div class="info-card phone-card">
                <div class="info-card-header"><i data-lucide="phone" class="info-icon"></i><span class="info-label">TELÉFONO</span></div>
                ${phoneHtml}
            </div>

            <!-- Row 2 -->
            <div class="info-card">
                <div class="info-card-header"><i data-lucide="zap" class="info-icon energy-icon"></i><span class="info-label">ENERGÍA</span></div>
                <span class="info-value">${contact.energia || '-'}</span>
            </div>
            <div class="info-card autonomy-card">
                <div class="info-card-header"><i data-lucide="battery-charging" class="info-icon battery-icon"></i><span class="info-label">AUTONOMÍA</span></div>
                <div class="autonomy-display">
                    <span class="info-value">${autonomiaValue}${autonomiaValue !== '-' ? ' hrs' : ''}</span>
                    ${badgeHtml}
                </div>
            </div>

            <!-- Row 3 -->
            <div class="info-card full-width">
                <div class="info-card-header"><i data-lucide="map-pin" class="info-icon location-icon"></i><span class="info-label">DIRECCIÓN</span></div>
                <span class="info-value">${contact.direccion || '-'}</span>
            </div>

            <!-- Row 4 Notes -->
            ${contact.notas ? `
            <div class="info-card full-width notes-card">
                <div class="info-card-header"><i data-lucide="file-text" class="info-icon notes-icon"></i><span class="info-label">NOTAS</span></div>
                <span class="info-value notes-value">${contact.notas}</span>
            </div>` : ''}
        </div>
    `;

    // Show Modal
    modal.classList.add('active');

    // Check if map container is needed to show map?
    // Not strictly needed since "Ver en Mapa" button handles overlay map on page 
    // But if user clicks map, we might close modal or overlay it? 
    // Standard behavior: Close modal to show map (which is on main page).

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.closeDetailsModal = function () {
    document.getElementById('details-modal').classList.remove('active');
};

window.copyToClipboard = function (text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Número copiado al portapapeles', 'success');
    }).catch(err => {
        console.error('Error al copiar:', err);
        showToast('Error al copiar', 'error');
    });
};

// ==========================================
// PERMISSIONS
// ==========================================
function canEdit() {
    return currentUserRole === 'admin' || currentUserRole === 'superadmin';
}

function canDelete() {
    return currentUserRole === 'superadmin';
}

// ==========================================
// STATS
// ==========================================
function updateStats() {
    document.getElementById('total-contacts').textContent = allContacts.length;
    document.getElementById('total-nodes').textContent = new Set(allContacts.map(c => c.node)).size;
    document.getElementById('total-gabinetes').textContent = allContacts.filter(c => c.tipo === 'Gabinete').length;
    document.getElementById('total-torres').textContent = allContacts.filter(c => c.tipo === 'Torre').length;
}

// ==========================================
// MODAL
// ==========================================
function openModal(isEdit = false, contact = null) {
    const modal = document.getElementById('contact-modal');
    document.getElementById('modal-title').textContent = isEdit ? 'Editar Contacto' : 'Agregar Contacto';
    document.getElementById('btn-submit-text').textContent = isEdit ? 'Guardar Cambios' : 'Guardar Contacto';
    document.getElementById('contact-form').reset();
    document.getElementById('contact-id').value = '';

    if (isEdit && contact) {
        document.getElementById('contact-id').value = contact.id;
        document.getElementById('contact-node').value = contact.node || '';
        document.getElementById('contact-tipo').value = contact.tipo || 'Gabinete';
        document.getElementById('contact-nombre').value = contact.nombre || '';
        document.getElementById('contact-telefono').value = contact.telefono || '';
        document.getElementById('contact-energia').value = contact.energia || '';
        document.getElementById('contact-autonomia').value = contact.autonomia || '';
        document.getElementById('contact-direccion').value = contact.direccion || '';
        document.getElementById('contact-coordenadas').value = contact.coordenadas || '';
        document.getElementById('contact-notas').value = contact.notas || '';
    }

    modal.classList.add('active');

    // Reset photo state
    pendingPhotoFile = null;
    resetModalPhotoPreview();

    // If editing, show existing photo
    if (isEdit && contact && contact.photoUrl) {
        showModalPhotoPreview(contact.photoUrl);
        document.getElementById('contact-photo-url').value = contact.photoUrl;
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeModal() {
    document.getElementById('contact-modal').classList.remove('active');
}

// ==========================================
// CRUD
// ==========================================
async function saveContact(e) {
    e.preventDefault();

    const contactId = document.getElementById('contact-id').value;
    const isEdit = !!contactId;

    const data = {
        node: document.getElementById('contact-node').value.trim(),
        tipo: document.getElementById('contact-tipo').value,
        nombre: document.getElementById('contact-nombre').value.trim(),
        telefono: document.getElementById('contact-telefono').value.trim(),
        energia: document.getElementById('contact-energia').value.trim(),
        autonomia: document.getElementById('contact-autonomia').value.trim(),
        direccion: document.getElementById('contact-direccion').value.trim(),
        coordenadas: document.getElementById('contact-coordenadas').value.trim(),
        notas: document.getElementById('contact-notas').value.trim(),
        updated_at: new Date()
    };

    try {
        // Handle photo upload if there's a pending file
        if (pendingPhotoFile) {
            showToast('Subiendo foto...', 'info');
            const nodeSlug = data.node.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            const photoUrl = await uploadNodePhoto(pendingPhotoFile, nodeSlug);
            if (photoUrl) {
                data.photoUrl = photoUrl;
                console.log('Photo uploaded:', photoUrl);
            }
        } else {
            // Keep existing photo URL if editing
            const existingUrl = document.getElementById('contact-photo-url').value;
            if (existingUrl) {
                data.photoUrl = existingUrl;
            }
        }

        if (isEdit) {
            await firestore.collection('node_contacts').doc(contactId).update(data);
            showToast('Contacto actualizado', 'success');
        } else {
            data.created_at = new Date();
            await firestore.collection('node_contacts').add(data);
            showToast('Contacto creado', 'success');
        }
        closeModal();
        pendingPhotoFile = null;
        loadContacts();
    } catch (error) {
        console.error('Error saving contact:', error);
        showToast('Error guardando contacto', 'error');
    }
}

window.editContact = function (id) {
    const contact = allContacts.find(c => c.id === id);
    if (contact) openModal(true, contact);
};

window.deleteContact = async function (id) {
    if (!confirm('¿Estás seguro de eliminar este contacto?')) return;
    try {
        await firestore.collection('node_contacts').doc(id).delete();
        showToast('Contacto eliminado', 'success');
        loadContacts();
    } catch (error) {
        console.error('Error deleting contact:', error);
        showToast('Error eliminando contacto', 'error');
    }
};

// ==========================================
// MAP
// ==========================================
function initMap() {
    if (map) return;
    const mapContainer = document.getElementById('contacts-map');
    map = L.map(mapContainer).setView([-41.4717, -72.9370], 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);
}

function toggleMap() {
    const container = document.getElementById('map-container');
    const btn = document.getElementById('btn-toggle-map');

    if (container.classList.contains('visible')) {
        container.classList.remove('visible');
        btn.innerHTML = '<i data-lucide="map" style="width:18px;height:18px;"></i> Ver Mapa';
    } else {
        container.classList.add('visible');
        btn.innerHTML = '<i data-lucide="map-pin-off" style="width:18px;height:18px;"></i> Ocultar Mapa';
        if (!map) {
            initMap();
            setTimeout(() => { map.invalidateSize(); loadMapMarkers(); }, 100);
        }
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function loadMapMarkers() {
    if (!map) return;
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    allContacts.forEach(contact => {
        if (contact.coordenadas) {
            const coords = parseCoordinates(contact.coordenadas);
            if (coords) {
                const marker = L.marker([coords.lat, coords.lng])
                    .bindPopup(`<strong>${contact.node}</strong><br>${contact.tipo}`)
                    .addTo(map);
                markers.push(marker);
            }
        }
    });
}

function parseCoordinates(coordStr) {
    if (!coordStr) return null;
    const parts = coordStr.split(',').map(p => parseFloat(p.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return { lat: parts[0], lng: parts[1] };
    }
    return null;
}

window.showOnMap = function (id) {
    const contact = allContacts.find(c => c.id === id);
    if (!contact || !contact.coordenadas) return;
    const mapContainer = document.getElementById('map-container');
    if (!mapContainer.classList.contains('visible')) toggleMap();
    setTimeout(() => {
        const coords = parseCoordinates(contact.coordenadas);
        if (coords && map) map.setView([coords.lat, coords.lng], 14);
    }, 200);
};

// ==========================================
// UTILITIES
// ==========================================
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; padding: 1rem 1.5rem;
        background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : '#3b82f6'};
        color: white; border-radius: 8px; font-weight: 500; z-index: 9999;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ==========================================
// CSV IMPORT
// ==========================================
async function handleCSVImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Reset input for future imports
    event.target.value = '';

    try {
        const text = await file.text();
        const lines = text.split('\n').filter(l => l.trim() && l.trim() !== ','.repeat(l.split(',').length - 1));

        if (lines.length < 1) {
            showToast('El archivo CSV está vacío', 'error');
            return;
        }

        console.log('CSV Lines:', lines.length);

        // Fixed column order (your CSV format):
        // 0: Nodo, 1: Tipo, 2: Nombre, 3: Teléfono, 4: Energía, 5: Autonomía, 6: Notas, 7: Dirección, 8: Coordenadas
        const columnMap = ['node', 'tipo', 'nombre', 'telefono', 'energia', 'autonomia', 'notas', 'direccion', 'coordenadas'];

        // Parse data rows
        const contacts = [];
        for (let i = 0; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);

            // Skip empty rows
            if (values.length === 0 || !values[0] || !values[0].trim()) continue;

            const contact = { created_at: new Date(), updated_at: new Date() };

            columnMap.forEach((fieldName, idx) => {
                if (values[idx] && values[idx].trim()) {
                    contact[fieldName] = values[idx].trim();
                }
            });

            // Only add if has node name
            if (contact.node) {
                contacts.push(contact);
                console.log('Parsed contact:', contact.node);
            }
        }

        if (contacts.length === 0) {
            showToast('No se encontraron contactos válidos en el CSV', 'error');
            return;
        }

        // Confirm import
        if (!confirm(`¿Importar ${contacts.length} contactos desde el CSV?`)) {
            return;
        }

        // Upload to Firestore
        showToast(`Importando ${contacts.length} contactos...`, 'info');

        let imported = 0;
        for (const contact of contacts) {
            try {
                await firestore.collection('node_contacts').add(contact);
                imported++;
            } catch (err) {
                console.error('Error importing contact:', contact.node, err);
            }
        }

        showToast(`${imported} contactos importados correctamente`, 'success');
        loadContacts();

    } catch (error) {
        console.error('Error parsing CSV:', error);
        showToast('Error al procesar el archivo CSV', 'error');
    }
}

// Parse CSV line handling quotes
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if ((char === ',' || char === ';') && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);

    return result.map(s => s.replace(/^"|"$/g, '').trim());
}

// ==========================================
// SUPABASE PHOTO FUNCTIONS
// ==========================================

// Initializers that don't need Supabase anymore
document.addEventListener('DOMContentLoaded', () => {
    // Other init logic is handled in initContactsPage
});

// Upload photo via Backend API
async function uploadNodePhoto(file, nodeSlug) {
    if (!auth.currentUser) return null;

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('node', nodeSlug); // Optional metadata

        const token = await auth.currentUser.getIdToken();

        const response = await fetch(`${API_BASE_URL}/upload-node-photo`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Error subiendo imagen');
        }

        const data = await response.json();
        console.log('[Backend] Foto subida:', data.url);
        return data.url;

    } catch (error) {
        console.error('[Backend] Error subiendo foto:', error);
        showToast(`Error subiendo foto: ${error.message}`, 'error');
        return null;
    }
}

// Delete photo via Backend API (Pending Implementation on Backend)
async function deleteNodePhoto(photoUrl) {
    console.warn("Secure delete not implemented yet on backend.");
    // In a future update, call DELETE /api/delete-node-photo
}

// Handle photo file selection
function handlePhotoSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
        showToast('Solo se permiten archivos de imagen', 'error');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showToast('La imagen no puede superar 5MB', 'error');
        return;
    }

    pendingPhotoFile = file;

    // Show preview
    const reader = new FileReader();
    reader.onload = (evt) => {
        showModalPhotoPreview(evt.target.result);
    };
    reader.readAsDataURL(file);
}

// Show photo preview in modal
function showModalPhotoPreview(src) {
    const placeholder = document.getElementById('modal-photo-placeholder');
    const preview = document.getElementById('modal-photo-preview');
    const removeBtn = document.getElementById('btn-remove-photo');

    if (placeholder) placeholder.style.display = 'none';
    if (preview) {
        preview.src = src;
        preview.style.display = 'block';
    }
    if (removeBtn) removeBtn.style.display = 'flex';
}

// Reset photo preview in modal
function resetModalPhotoPreview() {
    const placeholder = document.getElementById('modal-photo-placeholder');
    const preview = document.getElementById('modal-photo-preview');
    const removeBtn = document.getElementById('btn-remove-photo');
    const photoInput = document.getElementById('photo-input');
    const photoUrlInput = document.getElementById('contact-photo-url');

    if (placeholder) placeholder.style.display = 'flex';
    if (preview) {
        preview.src = '';
        preview.style.display = 'none';
    }
    if (removeBtn) removeBtn.style.display = 'none';
    if (photoInput) photoInput.value = '';
    if (photoUrlInput) photoUrlInput.value = '';

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Remove photo (mark for deletion)
window.removePhoto = function () {
    pendingPhotoFile = null;
    document.getElementById('contact-photo-url').value = '';
    resetModalPhotoPreview();
    showToast('Foto eliminada', 'info');
};

// Update card photo display
function updateCardPhoto(photoUrl) {
    const photoEl = document.getElementById('node-photo');
    const placeholder = document.getElementById('photo-placeholder');

    if (photoUrl) {
        photoEl.src = photoUrl;
        photoEl.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
    } else {
        photoEl.style.display = 'none';
        photoEl.src = '';
        if (placeholder) placeholder.style.display = 'flex';
    }
}

// ==========================================
// LIGHTBOX FUNCTIONS
// ==========================================
window.openLightbox = function () {
    const nodePhoto = document.getElementById('node-photo');
    const lightbox = document.getElementById('lightbox-overlay');
    const lightboxImg = document.getElementById('lightbox-image');

    if (nodePhoto && nodePhoto.src && nodePhoto.style.display !== 'none') {
        lightboxImg.src = nodePhoto.src;
        lightbox.classList.add('active');
    }
};

window.closeLightbox = function () {
    const lightbox = document.getElementById('lightbox-overlay');
    lightbox.classList.remove('active');
};

// Close lightbox on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        window.closeLightbox();
    }
});

