
import { db } from "./firebase.js";

document.addEventListener('DOMContentLoaded', () => {
    // === DOM Elements ===
    const categoriesContainer = document.getElementById('categoriesContainer');
    const selectedSummary = document.getElementById('selectedSummary');
    const emailContentDiv = document.querySelector('#emailContentDiv');
    const onlineContentDiv = document.querySelector('#onlineContentDiv');

    // === State ===
    const selectedServices = new Set();
    let servicesByCategory = {}; // Will be populated from Firestore
    let currentSignature = '';
    let recipients = []; // Email recipients from Firestore
    let currentUserRole = null; // Will be populated on auth change

    // === Firestore: Load Services ===
    const loadServicesFromFirestore = async () => {
        try {
            // Show loading state
            categoriesContainer.innerHTML = '<div style="padding:1rem;color:var(--color-texto-secundario);text-align:center;"><i class="fas fa-spinner fa-spin"></i> Cargando servicios...</div>';

            const snapshot = await db.collection('suralis_services').orderBy('order').get();

            if (snapshot.empty) {
                // No data yet - use fallback data and offer to populate
                console.warn('No Suralis services found in Firestore. Using fallback data.');
                servicesByCategory = getFallbackData();
                renderCategories();
                showSetupHint();
                return;
            }

            // Parse Firestore documents
            servicesByCategory = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                servicesByCategory[data.name] = {
                    id: doc.id,
                    icon: data.icon || 'fa-server',
                    services: data.services || []
                };
            });

            renderCategories();
            updateSummary();
            updatePreviews();

        } catch (error) {
            console.error('Error loading services from Firestore:', error);
            // Fallback to mock data on error
            servicesByCategory = getFallbackData();
            renderCategories();
            Swal.fire({
                icon: 'warning',
                title: 'Error de conexión',
                text: 'No se pudieron cargar los servicios. Usando datos de respaldo.',
                confirmButtonColor: '#7796CB'
            });
        }
    };

    // === Fallback Data (used if Firestore is empty or fails) ===
    const getFallbackData = () => ({
        "Nodo Osorno": {
            icon: "fa-server",
            services: [
                "Nodo Osorno - Enlace 1",
                "Nodo Osorno - Enlace 2",
                "Nodo Rahue",
                "Nodo Centro",
                "Nodo Industrial"
            ]
        },
        "Enlaces Starlink": {
            icon: "fa-satellite-dish",
            services: [
                "Starlink - Sector Norte",
                "Starlink - Sector Sur",
                "Starlink - Respaldo"
            ]
        }
    });

    // === Show setup hint if no Firestore data ===
    const showSetupHint = () => {
        const hint = document.createElement('div');
        hint.className = 'setup-hint';
        hint.innerHTML = `
            <i class="fas fa-info-circle"></i>
            <span>Usando datos de ejemplo. <a href="#" id="populateFirestore">Poblar Firestore con datos iniciales</a></span>
        `;
        hint.style.cssText = 'background:rgba(232,194,126,0.15);border:1px solid rgba(232,194,126,0.3);color:var(--color-advertencia);padding:0.75rem 1rem;border-radius:8px;margin-bottom:1rem;display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;';
        categoriesContainer.parentElement.insertBefore(hint, categoriesContainer);

        document.getElementById('populateFirestore')?.addEventListener('click', async (e) => {
            e.preventDefault();
            await populateFirestoreWithInitialData();
            hint.remove();
        });
    };

    // === Populate Firestore with initial data ===
    const populateFirestoreWithInitialData = async () => {
        const initialData = [
            {
                name: "Nodo Osorno",
                icon: "fa-server",
                order: 1,
                services: [
                    "16765 Suralis Peas Las Quemas",
                    "16707 Suralis Peas Rahue Alto",
                    "24009 Suralis Peas Virgen Del Socorro",
                    "16775 Suralis Peas Hollstein",
                    "16576 Suralis Peas Murrimuno",
                    "24012 Suralis Peas Angulo Padilla",
                    "20008 Suralis Peas Hazaña Indigena",
                    "16731 Suralis Peas Max Kolbe",
                    "24003 Suralis Peas Reina Luisa",
                    "16737 Suralis Peas Los Clasicos",
                    "24005 Suralis Peas Antofagasta",
                    "24010 Suralis Peas Kansas",
                    "30214 Suralis Aliviadero San Pedro",
                    "28004 Suralis Presurizadora Francke",
                    "28002 Suralis Peas Kolbe Osorno"
                ]
            },
            {
                name: "Enlaces Starlink",
                icon: "fa-satellite-dish",
                order: 2,
                services: [
                    "16777 Suralis Oficina Quellon",
                    "23994 Suralis Pap/Peap Chaiten",
                    "23995 Suralis Oficinal Futaleufú",
                    "24039 Suralis Captacion Lajas Blancas",
                    "24039 Suralis Parque Castro",
                    "24035 Suralis Oficina Paillaco",
                    "24004 Suralis Oficina Los Lagos",
                    "24038 Suralis Peas O'Higgins- Mafil",
                    "24004 Suralis Oficina La Union -Letelier S/N",
                    "28000 Suralis Sondaje 2049 La Union",
                    "24015 Suralis Peas Los Copihues",
                    "24011 Suralis Estanque AP Purranque",
                    "24025 Suralis Sondaje 2111 Chonchi",
                    "27995 Suralis Sondaje 1940 La Union",
                    "24014-Suralis Peas Puerta Sur",
                    "26675 Suralis Parque Castro"
                ]
            }
        ];

        try {
            Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            for (const category of initialData) {
                await db.collection('suralis_services').add(category);
            }

            Swal.fire({ icon: 'success', title: 'Datos guardados', text: 'Los servicios se han guardado en Firestore.', timer: 2000, showConfirmButton: false });

            // Reload from Firestore
            await loadServicesFromFirestore();

        } catch (error) {
            console.error('Error populating Firestore:', error);
            Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron guardar los datos en Firestore.', confirmButtonColor: '#7796CB' });
        }
    };

    // === Render Categories ===
    const renderCategories = () => {
        // Save expanded panels before re-rendering
        const expandedPanels = new Set();
        document.querySelectorAll('.category-panel.expanded').forEach(panel => {
            const categoryName = panel.querySelector('.category-name')?.textContent;
            if (categoryName) expandedPanels.add(categoryName);
        });

        categoriesContainer.innerHTML = '';

        for (const [categoryName, categoryData] of Object.entries(servicesByCategory)) {
            const panel = document.createElement('div');
            // Restore expanded state if this panel was previously expanded
            panel.className = `category-panel ${expandedPanels.has(categoryName) ? 'expanded' : ''}`;

            // Count selected in this category
            const selectedInCategory = categoryData.services.filter(s => selectedServices.has(s)).length;
            const countClass = selectedInCategory > 0 ? 'has-selected' : '';
            const countText = selectedInCategory > 0
                ? `${selectedInCategory}/${categoryData.services.length}`
                : categoryData.services.length;

            panel.innerHTML = `
                <div class="category-header">
                    <div class="category-icon"><i class="fas ${categoryData.icon}"></i></div>
                    <span class="category-name">${categoryName}</span>
                    <button class="add-service-btn" data-category="${categoryName}" data-id="${categoryData.id || ''}" title="Agregar servicio"><i class="fas fa-plus"></i></button>
                    <span class="category-count ${countClass}">${countText}</span>
                    <i class="fas fa-chevron-down category-chevron"></i>
                </div>
                <div class="category-body">
                    <div class="category-actions">
                        <button class="bulk-btn select-all">Seleccionar Todo</button>
                        <button class="bulk-btn deselect-all">Deseleccionar</button>
                    </div>
                    <div class="services-list"></div>
                </div>
            `;

            // Set progress bar percentage
            const progressPercent = categoryData.services.length > 0
                ? (selectedInCategory / categoryData.services.length) * 100
                : 0;
            const headerEl = panel.querySelector('.category-header');
            headerEl.style.setProperty('--progress', `${progressPercent}%`);

            // Toggle expand/collapse (but not when clicking the add button)
            headerEl.addEventListener('click', (e) => {
                if (!e.target.closest('.add-service-btn')) {
                    panel.classList.toggle('expanded');
                }
            });

            // Add Service Button
            const addBtn = panel.querySelector('.add-service-btn');
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openAddServiceModal(categoryName, categoryData.id);
            });

            // Render services
            const servicesList = panel.querySelector('.services-list');
            categoryData.services.forEach(serviceName => {
                const isSelected = selectedServices.has(serviceName);
                const item = document.createElement('div');
                item.className = `service-item ${isSelected ? 'selected' : ''}`;
                item.innerHTML = `
                    <div class="custom-checkbox"><i class="fas fa-check"></i></div>
                    <span class="service-name">${serviceName}</span>
                `;
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleService(serviceName);
                });
                servicesList.appendChild(item);
            });

            // Bulk actions
            const selectAllBtn = panel.querySelector('.select-all');
            const deselectAllBtn = panel.querySelector('.deselect-all');

            selectAllBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                categoryData.services.forEach(s => selectedServices.add(s));
                renderCategories();
                updateSummary();
                updatePreviews();
            });

            deselectAllBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                categoryData.services.forEach(s => selectedServices.delete(s));
                renderCategories();
                updateSummary();
                updatePreviews();
            });

            categoriesContainer.appendChild(panel);
        }
    };

    // === Toggle Service Selection ===
    const toggleService = (serviceName) => {
        if (selectedServices.has(serviceName)) {
            selectedServices.delete(serviceName);
        } else {
            selectedServices.add(serviceName);
        }
        renderCategories();
        updateSummary();
        updatePreviews();
    };

    // === Update Summary ===
    const updateSummary = () => {
        if (selectedServices.size === 0) {
            selectedSummary.innerHTML = '<span class="summary-placeholder">Ningún servicio seleccionado</span>';
            return;
        }

        selectedSummary.innerHTML = `
            <span class="summary-count">
                <i class="fas fa-check-circle"></i>
                ${selectedServices.size} servicio${selectedServices.size > 1 ? 's' : ''} seleccionado${selectedServices.size > 1 ? 's' : ''}
            </span>
            <button class="clear-all-btn">Limpiar todo</button>
        `;

        selectedSummary.querySelector('.clear-all-btn').addEventListener('click', () => {
            selectedServices.clear();
            renderCategories();
            updateSummary();
            updatePreviews();
        });
    };

    // === Greeting ===
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Buenos días';
        if (hour < 18) return 'Buenas tardes';
        return 'Buenas noches';
    };

    // === Update Previews ===
    const updatePreviews = () => {
        const servicesList = Array.from(selectedServices).map(s => `• ${s}`).join('<br>');
        const greeting = getGreeting();

        if (emailContentDiv) {
            emailContentDiv.innerHTML = `${greeting},<br><br>
Junto con saludar, informo que actualmente se registra una <strong>caída</strong> en los siguientes enlaces asociados a Suralis:<br><br>
<strong>Enlaces afectados:</strong><br>
${servicesList || '<em>(Ninguno seleccionado)</em>'}<br><br>
La situación ha sido debidamente registrada y se encuentra en análisis.<br>
Se emite esta comunicación con fines informativos.<br><br>
Saludos cordiales,<br>
${currentSignature}`;
        }

        if (onlineContentDiv) {
            onlineContentDiv.innerHTML = `${greeting},<br><br>
Junto con saludar, informo que los siguientes enlaces pertenecientes a Suralis han sido <strong>restablecidos</strong> y operan con normalidad:<br><br>
<strong>Enlaces restaurados:</strong><br>
${servicesList || '<em>(Ninguno seleccionado)</em>'}<br><br>
Esta notificación se emite únicamente con fines informativos.<br><br>
Saludos cordiales,<br>
${currentSignature}`;
        }
    };

    // === Signature Handling ===
    const setupSignatures = () => {
        const signaturesData = document.querySelectorAll('#signaturesData span');

        // Get current user's email
        const user = firebase.auth().currentUser;
        const userEmail = user?.email?.toLowerCase() || '';

        console.log('📝 Buscando firma para:', userEmail);

        let matchedSignature = null;

        signaturesData.forEach(sig => {
            const sigEmail = sig.dataset.email?.toLowerCase() || '';
            if (sigEmail === userEmail) {
                matchedSignature = {
                    url: sig.dataset.url,
                    name: sig.dataset.name
                };
            }
        });

        if (matchedSignature) {
            // Set the signature for email content
            currentSignature = `<br><img src="${matchedSignature.url}" alt="Firma ${matchedSignature.name}" style="max-height:70px; margin-top:8px;">`;
            console.log('✅ Firma configurada:', matchedSignature.name);
        } else {
            // No matching signature - leave empty
            currentSignature = '';
            console.warn('⚠️ No se encontró firma para:', userEmail);
        }

        // Update email previews with the signature
        updatePreviews();
    };

    // === Send Buttons ===
    const setupSendButtons = () => {
        const sendReportBtn = document.getElementById('enviarReporteButton');

        // Backend API URL
        const hostname = window.location.hostname;
        const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
        const API_BASE = isLocal
            ? 'http://localhost:3000'
            : 'https://turnos-backend.onrender.com';

        const sendEmail = async (type) => {
            if (selectedServices.size === 0) {
                Swal.fire({ icon: 'warning', title: 'Atención', text: 'Debes seleccionar al menos un servicio.', confirmButtonColor: '#7796CB' });
                return;
            }

            if (recipients.length === 0) {
                Swal.fire({ icon: 'warning', title: 'Sin destinatarios', text: 'No hay destinatarios configurados.', confirmButtonColor: '#7796CB' });
                return;
            }

            // Get current user info
            const user = firebase.auth().currentUser;

            // Get content from the preview
            const contentDiv = type === 'caida' ? emailContentDiv : onlineContentDiv;
            const htmlContent = contentDiv?.innerHTML || '';

            // Build subject
            const subject = type === 'caida'
                ? '⚠️ Caída de Enlaces - Suralis'
                : '✅ Enlaces Normalizados - Suralis';

            try {
                Swal.fire({ title: 'Enviando correo...', text: 'Por favor espera', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

                // Get auth token
                const token = await user.getIdToken();

                const response = await fetch(`${API_BASE}/send-email`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        to: recipients,
                        subject: subject,
                        html: htmlContent
                    })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    Swal.fire({
                        icon: 'success',
                        title: '¡Correo enviado!',
                        html: `<p>Se envió correctamente a <strong>${recipients.length}</strong> destinatario(s).</p><p style="font-size:0.85rem;color:#A1A9B5;margin-top:0.5rem;">Desde: ${user?.email || 'Sistema'}</p>`,
                        confirmButtonColor: '#88C0A6'
                    });
                } else {
                    // Handle specific errors
                    if (result.error && result.error.includes('token')) {
                        Swal.fire({
                            icon: 'warning',
                            title: 'Sesión expirada',
                            html: `<p>Tu sesión de Google ha expirado.</p><p style="font-size:0.9rem;margin-top:0.5rem;">Por favor, <strong>cierra sesión</strong> y vuelve a iniciar sesión con Google para renovar los permisos de envío.</p>`,
                            confirmButtonText: 'Entendido',
                            confirmButtonColor: '#E8C27E'
                        });
                        return;
                    }
                    throw new Error(result.error || 'Error desconocido');
                }

            } catch (error) {
                console.error('Error sending email:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error al enviar',
                    text: error.message || 'No se pudo enviar el correo. Verifica tu conexión.',
                    confirmButtonColor: '#7796CB'
                });
            }
        };

        // Single button that reads the current mode
        if (sendReportBtn) {
            sendReportBtn.addEventListener('click', () => {
                const mode = window.currentReportMode || 'caida';
                sendEmail(mode);
            });
        }
    };

    // === Modal: Add New Service ===
    let currentModalCategory = null;
    let currentModalDocId = null;
    const modal = document.getElementById('addServiceModal');
    const modalCategoryName = document.getElementById('modalCategoryName');
    const newServiceInput = document.getElementById('newServiceName');
    const closeModalBtn = document.getElementById('closeAddServiceModal');
    const cancelBtn = document.getElementById('cancelAddService');
    const saveBtn = document.getElementById('saveNewService');

    const openAddServiceModal = (categoryName, docId) => {
        currentModalCategory = categoryName;
        currentModalDocId = docId;
        modalCategoryName.textContent = categoryName;
        newServiceInput.value = '';
        modal.classList.add('active');
        setTimeout(() => newServiceInput.focus(), 100);
    };

    const closeModal = () => {
        modal.classList.remove('active');
        currentModalCategory = null;
        currentModalDocId = null;
    };

    const saveNewService = async () => {
        const serviceName = newServiceInput.value.trim();
        if (!serviceName) {
            Swal.fire({ icon: 'warning', title: 'Nombre vacío', text: 'Ingresa un nombre para el servicio.', confirmButtonColor: '#7796CB' });
            return;
        }

        if (!currentModalDocId) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'No se encontró la categoría en Firestore.', confirmButtonColor: '#7796CB' });
            return;
        }

        try {
            Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            // Get current services and add new one
            const docRef = db.collection('suralis_services').doc(currentModalDocId);
            const doc = await docRef.get();
            const currentServices = doc.data().services || [];

            if (currentServices.includes(serviceName)) {
                Swal.fire({ icon: 'warning', title: 'Duplicado', text: 'Este servicio ya existe en la categoría.' });
                return;
            }

            await docRef.update({
                services: [...currentServices, serviceName]
            });

            closeModal();
            Swal.fire({ icon: 'success', title: 'Servicio agregado', timer: 1500, showConfirmButton: false });

            // Reload
            await loadServicesFromFirestore();

        } catch (error) {
            console.error('Error saving service:', error);
            Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo guardar el servicio.' });
        }
    };

    // Modal event listeners
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (saveBtn) saveBtn.addEventListener('click', saveNewService);
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    if (newServiceInput) newServiceInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveNewService(); });

    // Force populate button
    const forcePopulateBtn = document.getElementById('forcePopulateBtn');
    if (forcePopulateBtn) {
        forcePopulateBtn.addEventListener('click', async () => {
            const result = await Swal.fire({
                icon: 'question',
                title: '¿Reiniciar servicios?',
                text: 'Esto eliminará los servicios actuales en Firestore y los reemplazará con la lista predefinida.',
                showCancelButton: true,
                confirmButtonText: 'Sí, reiniciar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#7796CB'
            });
            if (result.isConfirmed) {
                // Delete existing documents first
                try {
                    const snapshot = await db.collection('suralis_services').get();
                    const deletePromises = snapshot.docs.map(doc => doc.ref.delete());
                    await Promise.all(deletePromises);
                } catch (e) {
                    console.log('No existing docs to delete or error:', e);
                }
                // Now populate
                await populateFirestoreWithInitialData();
            }
        });
    }

    // === Initialize ===
    loadServicesFromFirestore();
    loadRecipients();
    updateSummary();
    updatePreviews();
    setupSendButtons();
    setupRecipientsManagement();

    // Setup signatures after auth is ready
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            console.log('📝 Usuario autenticado, configurando firma para:', user.email);
            setupSignatures();

            // Check user role and hide superadmin elements if not superadmin
            try {
                const userDoc = await db.collection('userRoles').doc(user.uid).get();
                if (userDoc.exists) {
                    currentUserRole = userDoc.data().rol;
                    console.log('🔑 Rol del usuario:', currentUserRole);

                    // Hide superadmin-only elements if not superadmin
                    if (currentUserRole !== 'superadmin') {
                        document.querySelectorAll('.superadmin-only').forEach(el => {
                            el.style.display = 'none';
                        });
                    } else {
                        // Show superadmin elements
                        document.querySelectorAll('.superadmin-only').forEach(el => {
                            // Use flex for the recipients button, block for others
                            if (el.classList.contains('manage-recipients-btn')) {
                                el.style.display = 'flex';
                            } else {
                                el.style.display = 'block';
                            }
                        });
                    }
                }
            } catch (error) {
                console.error('Error checking user role:', error);
                // Hide superadmin elements on error
                document.querySelectorAll('.superadmin-only').forEach(el => {
                    el.style.display = 'none';
                });
            }
        }
    });

    // === Recipients Management ===
    async function loadRecipients() {
        try {
            const doc = await db.collection('suralis_config').doc('recipients').get();
            if (doc.exists && doc.data().emails) {
                recipients = doc.data().emails;
            } else {
                // Default recipients if none exist
                recipients = ['contactos.suralis@patagoniaip.cl'];
                // Save default
                await db.collection('suralis_config').doc('recipients').set({ emails: recipients });
            }
            displayRecipientsInPreview();
        } catch (error) {
            console.error('Error loading recipients:', error);
            recipients = ['contactos.suralis@patagoniaip.cl'];
            displayRecipientsInPreview();
        }
    }

    function displayRecipientsInPreview() {
        const displayCaida = document.getElementById('recipientsDisplayCaida');
        const displayOnline = document.getElementById('recipientsDisplayOnline');

        const displayHTML = recipients.length > 0
            ? recipients.map(email => `<span class="recipient-chip">${email}</span>`).join('')
            : '<span style="color: var(--color-texto-secundario);">Sin destinatarios</span>';

        if (displayCaida) displayCaida.innerHTML = displayHTML;
        if (displayOnline) displayOnline.innerHTML = displayHTML;
    }

    function renderRecipientsModal() {
        const list = document.getElementById('recipientsList');
        if (!list) return;

        list.innerHTML = recipients.map(email => `
            <div class="recipient-item" data-email="${email}">
                <i class="fas fa-envelope"></i>
                <span class="recipient-email">${email}</span>
                <button class="remove-recipient-btn" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
            </div>
        `).join('');

        // Add remove event listeners
        list.querySelectorAll('.remove-recipient-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const item = e.target.closest('.recipient-item');
                const email = item.dataset.email;
                await removeRecipient(email);
            });
        });
    }

    async function addRecipient(email) {
        const trimmedEmail = email.trim().toLowerCase();

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
            Swal.fire({ icon: 'error', title: 'Email inválido', text: 'Por favor ingresa un email válido.', confirmButtonColor: '#7796CB' });
            return false;
        }

        // Check if already exists
        if (recipients.includes(trimmedEmail)) {
            Swal.fire({ icon: 'warning', title: 'Duplicado', text: 'Este email ya está en la lista.', confirmButtonColor: '#7796CB' });
            return false;
        }

        try {
            recipients.push(trimmedEmail);
            await db.collection('suralis_config').doc('recipients').set({ emails: recipients });
            displayRecipientsInPreview();
            renderRecipientsModal();
            Swal.fire({ icon: 'success', title: '¡Agregado!', text: `${trimmedEmail} fue agregado.`, timer: 1500, showConfirmButton: false });
            return true;
        } catch (error) {
            console.error('Error adding recipient:', error);
            recipients.pop(); // Rollback
            Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo agregar el email.', confirmButtonColor: '#7796CB' });
            return false;
        }
    }

    async function removeRecipient(email) {
        try {
            recipients = recipients.filter(e => e !== email);
            await db.collection('suralis_config').doc('recipients').set({ emails: recipients });
            displayRecipientsInPreview();
            renderRecipientsModal();
        } catch (error) {
            console.error('Error removing recipient:', error);
            Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo eliminar el email.', confirmButtonColor: '#7796CB' });
        }
    }

    function setupRecipientsManagement() {
        const modal = document.getElementById('recipientsModal');
        const openBtn = document.getElementById('manageRecipientsBtn');
        const closeBtn = document.getElementById('closeRecipientsModal');
        const cancelBtn = document.getElementById('cancelRecipients');
        const addBtn = document.getElementById('addRecipientBtn');
        const emailInput = document.getElementById('newRecipientEmail');

        if (openBtn) {
            openBtn.addEventListener('click', () => {
                renderRecipientsModal();
                modal.classList.add('active');
            });
        }

        if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));
        if (cancelBtn) cancelBtn.addEventListener('click', () => modal.classList.remove('active'));
        if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

        if (addBtn && emailInput) {
            addBtn.addEventListener('click', async () => {
                const success = await addRecipient(emailInput.value);
                if (success) emailInput.value = '';
            });
            emailInput.addEventListener('keydown', async (e) => {
                if (e.key === 'Enter') {
                    const success = await addRecipient(emailInput.value);
                    if (success) emailInput.value = '';
                }
            });
        }

        // Check user role and show/hide manage button
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user && openBtn) {
                try {
                    const userDoc = await db.collection('usuarios').doc(user.uid).get();
                    if (userDoc.exists) {
                        currentUserRole = userDoc.data().rol;
                        if (currentUserRole === 'superadmin') {
                            openBtn.style.display = 'flex';
                        } else {
                            openBtn.style.display = 'none';
                        }
                    }
                } catch (error) {
                    console.error('Error checking user role:', error);
                    openBtn.style.display = 'none';
                }
            }
        });
    }
});
