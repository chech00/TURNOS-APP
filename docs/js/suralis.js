
import { db } from "./firebase.js";
import { showToast } from "./modules/ui/toast.js";

document.addEventListener('DOMContentLoaded', () => {
    // === DOM Elements ===
    const categoriesContainer = document.getElementById('categoriesContainer');
    const selectedSummary = document.getElementById('selectedSummary');
    const emailContentDiv = document.querySelector('#emailContentDiv');
    const onlineContentDiv = document.querySelector('#onlineContentDiv');

    // Search Elements
    const searchInput = document.getElementById('serviceSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const searchContainer = document.querySelector('.search-container');

    // === State ===
    const selectedServices = new Set();
    let servicesByCategory = {}; // Will be populated from Firestore
    let currentSignature = '';
    let recipients = []; // Email recipients from Firestore
    let currentUserRole = null; // Will be populated on auth change
    let serviceStates = {}; // { "ServiceName": { status: 'down', by: 'User', at: timestamp } }

    // === Real-time State Listener ===
    const listenToServiceStates = () => {
        db.collection('suralis_states').doc('current_status')
            .onSnapshot((doc) => {
                if (doc.exists) {
                    serviceStates = doc.data() || {};
                    renderCategories(); // Re-render to show red/green status
                }
            }, (error) => {
                console.error("Error listening to service states:", error);
            });
    };

    // Initialize Listener
    listenToServiceStates();

    // === Authentication State ===
    // Esperar a que Firebase restaure la sesión antes de configurar firmas
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            console.log("👤 Usuario detectado en suralis.js:", user.email);
            setupSignatures();
        } else {
            console.warn("👤 No hay usuario activo en suralis.js");
        }
    });

    // === Search Functionality ===
    const setupSearch = () => {
        if (!searchInput) return;

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            filterServices(query);

            // Toggle clear button
            if (query.length > 0) {
                searchContainer?.classList.add('has-text');
            } else {
                searchContainer?.classList.remove('has-text');
            }
        });

        clearSearchBtn?.addEventListener('click', () => {
            searchInput.value = '';
            filterServices(''); // Show all
            searchInput.focus();
            searchContainer?.classList.remove('has-text');
        });
    };

    const filterServices = (query) => {
        const panels = document.querySelectorAll('.category-panel');
        let totalMatches = 0;

        panels.forEach(panel => {
            const items = panel.querySelectorAll('.service-item');
            let matchInPanel = false;
            let hiddenItems = 0;

            items.forEach(item => {
                const nameEl = item.querySelector('.service-name');
                const name = nameEl.textContent.toLowerCase();
                const originalText = nameEl.textContent;

                if (query === '' || name.includes(query)) {
                    item.style.display = 'flex';
                    matchInPanel = true;
                    totalMatches++;

                    // Highlight match if query exists
                    if (query !== '') {
                        const regex = new RegExp(`(${query})`, 'gi');
                        nameEl.innerHTML = originalText.replace(regex, '<span class="highlight-match">$1</span>');
                    } else {
                        nameEl.innerHTML = originalText; // Reset
                    }
                } else {
                    item.style.display = 'none';
                    hiddenItems++;
                }
            });

            // Handle panel visibility
            if (query === '') {
                // Reset to default state (collapsed)
                panel.style.display = 'block';
                panel.classList.remove('expanded');
            } else if (matchInPanel) {
                panel.style.display = 'block';
                // Auto expand if there are matches
                panel.classList.add('expanded');
            } else {
                panel.style.display = 'none';
            }
        });
    };

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



            // Use Toast for success instead of intrusive alert
            showToast('Servicios cargados correctamente', 'success');

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

            // Sort services: DOWN (Red) first, then keeping original order
            const sortedServices = [...categoryData.services].sort((a, b) => {
                const stateA = serviceStates[a];
                const stateB = serviceStates[b];
                const isDownA = stateA && stateA.status === 'down';
                const isDownB = stateB && stateB.status === 'down';

                if (isDownA && !isDownB) return -1;
                if (!isDownA && isDownB) return 1;
                return 0;
            });

            const servicesList = panel.querySelector('.services-list');
            sortedServices.forEach(serviceName => {
                const isSelected = selectedServices.has(serviceName);

                // Check Real-time State (Updated variable)
                const state = serviceStates[serviceName];
                const isDown = state && state.status === 'down';

                const item = document.createElement('div');
                item.className = `service-item ${isSelected ? 'selected' : ''} ${isDown ? 'is-down' : ''}`;

                if (isDown) {
                    const reporter = state.by ? state.by.split('@')[0] : 'Alguien';
                    let timeStr = '';
                    if (state.at && state.at.toDate) {
                        const date = state.at.toDate();
                        timeStr = ` a las ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
                    }
                    item.title = `🔴 Reportado caído por ${reporter}${timeStr}`;
                }

                item.innerHTML = `
                    <div class="custom-checkbox"><i class="fas fa-check"></i></div>
                    <span class="service-name">${serviceName}</span>
                    ${isDown ? '<i class="fas fa-exclamation-triangle" style="color:#ef4444;margin-left:auto;font-size:0.8rem;"></i>' : ''}
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
            emailContentDiv.innerHTML = `Estimados,<br><br>
Informamos que nuestro sistema de monitoreo ha detectado una <strong>interrupción de servicio</strong> afectando a los siguientes enlaces de Suralis:<br><br>
<strong>Enlaces afectados:</strong><br>
${servicesList || '<em>(Ninguno seleccionado)</em>'}<br><br>
Personal técnico ya ha tomado conocimiento y se encuentra gestionando la incidencia para su pronta solución.<br>
Se mantendrá informado ante novedades relevantes.<br><br>
Saludos cordiales,<br>
${currentSignature}`;
        }

        if (onlineContentDiv) {
            onlineContentDiv.innerHTML = `Estimados,<br><br>
Confirmamos el <strong>restablecimiento total</strong> de los servicios afectados. Los siguientes enlaces operan nuevamente dentro de sus parámetros normales:<br><br>
<strong>Enlaces restaurados:</strong><br>
${servicesList || '<em>(Ninguno seleccionado)</em>'}<br><br>
Hemos verificado la estabilidad de la conexión. Damos por cerrado este incidente.<br><br>
Saludos cordiales,<br>
${currentSignature}`;
        }
    };

    // === Signature Handling ===
    const setupSignatures = () => {
        const signaturesData = document.querySelectorAll('#signaturesData span');

        // Get current user's email
        // Get current user's email
        const user = firebase.auth().currentUser;
        if (!user) {
            console.warn("⚠️ setupSignatures: Usuario no autenticado todavía.");
            return;
        }
        const userEmail = user.email?.toLowerCase().trim() || '';


        console.log('📝 Buscando firma para:', userEmail);

        let matchedSignature = null;

        signaturesData.forEach(sig => {
            // Normalizamos el email del dataset
            const sigEmail = sig.dataset.email?.toLowerCase().trim() || '';

            // Check exact match OR alias match if we had logic for it
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
            : 'https://turnos-app-8viu.onrender.com';

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

            // === VERIFICACIÓN: ¿El usuario INICIÓ SESIÓN con Google? ===
            // Usamos localStorage porque providerData muestra todos los proveedores vinculados,
            // no el método que usó para iniciar sesión en esta sesión específica.
            const authProvider = localStorage.getItem('authProvider');
            const isGoogleLogin = authProvider === 'google';

            if (!isGoogleLogin) {
                Swal.fire({
                    icon: 'info',
                    title: 'Inicio de sesión con Google requerido',
                    html: `
                        <p style="margin-bottom: 1rem;">Para enviar correos de notificación, necesitas estar conectado con tu <strong>cuenta de Google</strong>.</p>
                        <p style="font-size: 0.9rem; color: #9CA3AF;">Esto permite que el correo se envíe desde tu Gmail personal.</p>
                        <hr style="border-color: rgba(255,255,255,0.1); margin: 1rem 0;">
                        <p style="font-size: 0.85rem; color: #A1A9B5;">
                            <strong>¿Cómo hacerlo?</strong><br>
                            1. Cierra tu sesión actual<br>
                            2. Inicia sesión con el botón "Google"
                        </p>
                    `,
                    confirmButtonText: 'Entendido',
                    confirmButtonColor: '#7796CB',
                    background: '#1f2937',
                    customClass: {
                        popup: 'swal-dark-popup',
                        title: 'swal-dark-title',
                        htmlContainer: 'swal-dark-content'
                    }
                });
                return;
            }

            // Get content from the preview
            const contentDiv = type === 'caida' ? emailContentDiv : onlineContentDiv;
            const htmlContent = contentDiv?.innerHTML || '';

            // Build subject
            const subject = type === 'caida'
                ? '⚠️ Caída de Enlaces - Suralis'
                : '✅ Enlaces Normalizados - Suralis';

            try {
                // === GUARDIAN LOGIC (Duplicate Check) ===
                if (type === 'caida') {
                    const alreadyDown = [];
                    selectedServices.forEach(s => {
                        const st = serviceStates[s];
                        if (st && st.status === 'down') {
                            alreadyDown.push(s);
                        }
                    });

                    if (alreadyDown.length > 0) {
                        const confirm = await Swal.fire({
                            icon: 'warning',
                            title: '⚠️ ¿Reportar nuevamente?',
                            html: `
                                <p>Los siguientes servicios ya están marcados como <strong>CAÍDOS</strong>:</p>
                                <ul style="text-align:left; font-size:0.9rem; color:#ef4444; margin:1rem 0;">
                                    ${alreadyDown.map(s => `<li>${s}</li>`).join('')}
                                </ul>
                                <p>¿Estás seguro de que quieres enviar otro reporte?</p>
                            `,
                            showCancelButton: true,
                            confirmButtonText: 'Sí, reportar igual',
                            cancelButtonText: 'Cancelar',
                            confirmButtonColor: '#ef4444',
                            cancelButtonColor: '#7796CB'
                        });

                        if (!confirm.isConfirmed) return;
                    }
                }

                Swal.fire({
                    title: 'Enviando correo...',
                    text: 'Contactando con el servidor de correo',
                    html: `
                        <div class="mail-animation-container">
                            <!-- Background Elements -->
                            <div class="wind-line wind-1"></div>
                            <div class="wind-line wind-2"></div>
                            <div class="wind-line wind-3"></div>
                            <div class="wind-line wind-4"></div>
                            <div class="wind-line wind-5"></div>
                            
                            <!-- Main Combine -->
                            <div class="plane-wrapper">
                                <i class="fas fa-paper-plane paper-plane"></i>
                                <div class="exhaust-trail"></div>
                                <div class="particle p1"></div>
                                <div class="particle p2"></div>
                                <div class="particle p3"></div>
                            </div>
                        </div>
                        <h3 style="color:#e5e7eb; font-weight:600; margin-top:15px; margin-bottom:5px;">Enviando Correo...</h3>
                        <p style="color:#9ca3af; font-size:0.9rem;">Conectando con SMTP seguro</p>
                    `,
                    allowOutsideClick: false,
                    showConfirmButton: false,
                    background: '#1f2937',
                    customClass: {
                        popup: 'swal-dark-popup',
                        title: 'swal-dark-title',
                        content: 'swal-dark-content'
                    },
                    didOpen: () => {
                        // Swal.showLoading() - Removed to show our custom animation
                    }
                });

                // Get auth token
                const token = await user.getIdToken();

                const response = await fetch(`${API_BASE}/send-email`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        to: [user.email], // Send to self
                        bcc: recipients,  // Others in BCC for speed & privacy
                        subject: subject,
                        html: htmlContent
                    })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    // === GUARDAR INCIDENTE EN FIRESTORE PARA ESTADÍSTICAS ===
                    try {
                        const batch = db.batch();

                        // 1. Log Incident
                        const incidentRef = db.collection('suralisIncidents').doc();
                        batch.set(incidentRef, {
                            type: type, // 'caida' o 'normalizacion'
                            services: Array.from(selectedServices),
                            servicesCount: selectedServices.size,
                            sentBy: user?.email || 'Sistema',
                            sentAt: firebase.firestore.FieldValue.serverTimestamp(),
                            recipientsCount: recipients.length
                        });

                        // 2. Update Real-time State
                        const stateRef = db.collection('suralis_states').doc('current_status');
                        const updates = {};
                        selectedServices.forEach(service => {
                            // If 'caida' -> status: 'down'
                            // If 'normalizacion' -> status: 'up' (or delete key to save space, but explicit 'up' is safer)
                            if (type === 'caida') {
                                updates[service] = {
                                    status: 'down',
                                    by: user?.email || 'Sistema',
                                    at: firebase.firestore.Timestamp.now()
                                };
                            } else {
                                // For normalizacion, we can either remove the entry or set to 'up'
                                updates[service] = firebase.firestore.FieldValue.delete();
                            }
                        });

                        // Use set with merge to update map
                        batch.set(stateRef, updates, { merge: true });

                        await batch.commit();

                        // FORCE LOCAL UPDATE FOR IMMEDIATE FEEDBACK
                        // (Optimizistic UI Update)
                        selectedServices.forEach(service => {
                            if (type === 'caida') {
                                serviceStates[service] = {
                                    status: 'down',
                                    by: user?.email || 'Sistema',
                                    at: firebase.firestore.Timestamp.now()
                                };
                            } else {
                                delete serviceStates[service];
                            }
                        });
                        renderCategories(); // Re-render immediately to sort elements

                        // CLEAR SELECTION AFTER SENDING
                        selectedServices.clear();
                        updateSummary();
                        updatePreviews();

                    } catch (incidentError) {
                        console.warn('No se pudo guardar el incidente o estado:', incidentError);
                        // No bloquear el flujo si falla el log
                    }

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

                // ERROR SPECIFIC HANDLING
                if (error.message && (error.message.includes("NO_GMAIL_TOKEN") || error.message.includes("GMAIL_TOKEN_EXPIRED"))) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Permisos de Gmail Requeridos',
                        html: `
                            <p>Para enviar correos, necesitamos renovar tu permiso de Gmail.</p>
                            <p style="font-size:0.9rem;margin-top:0.5rem;color:#A1A9B5;">Esto sucede cuando la sesión expira o no se concedieron permisos inicialmente.</p>
                        `,
                        showCancelButton: true,
                        confirmButtonText: 'Re-conectar Google',
                        cancelButtonText: 'Cancelar',
                        confirmButtonColor: '#E8C27E'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            reauthorizeGoogle();
                        }
                    });
                    return;
                }

                Swal.fire({
                    icon: 'error',
                    title: 'Error al enviar',
                    text: error.message || 'No se pudo enviar el correo. Verifica tu conexión.',
                    confirmButtonColor: '#7796CB'
                });
            }
        };

        // === Re-authorize Google ===
        const reauthorizeGoogle = async () => {
            try {
                const provider = new firebase.auth.GoogleAuthProvider();
                provider.addScope('https://www.googleapis.com/auth/gmail.send');

                // Force prompt to ensure we get a new refresh token if needed
                provider.setCustomParameters({
                    prompt: 'consent'
                });

                // Use linkWithPopup if we want to link, but signInWithPopup is safer for re-auth of same account
                // Warning: signInWithPopup might throw if different account.
                const result = await firebase.auth().signInWithPopup(provider);
                const user = result.user;
                const credential = result.credential;
                const accessToken = credential?.accessToken;

                if (accessToken) {
                    console.log("✅ Re-autorización exitosa. Nuevo token obtenido.");

                    // Update Firestore explicitly here ensures backend gets it immediately
                    await db.collection("userRoles").doc(user.uid).update({
                        gmailAccessToken: accessToken,
                        gmailTokenUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    Swal.fire({
                        icon: 'success',
                        title: 'Conectado',
                        text: 'Permisos de Gmail actualizados. Intenta enviar el reporte nuevamente.',
                        timer: 2000,
                        showConfirmButton: false
                    });
                }

            } catch (error) {
                console.error("Error re-authorizing:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'No se pudo re-conectar con Google.'
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
            showToast('Ingresa un nombre para el servicio', 'warning');
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
                showToast('Este servicio ya existe', 'warning');
                return;
            }

            await docRef.update({
                services: [...currentServices, serviceName]
            });

            closeModal();
            showToast(`Servicio "${serviceName}" agregado`, 'success');

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
    setupSearch(); // <--- Initialize Search
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

            // Check user role for superadmin-specific buttons (not sidebar)
            try {
                const userDoc = await db.collection('userRoles').doc(user.uid).get();
                if (userDoc.exists) {
                    currentUserRole = userDoc.data().rol;
                    console.log('🔑 Rol del usuario:', currentUserRole);

                    // Only handle the manage-recipients button (uses flex display)
                    // Sidebar visibility is now handled centrally by user-profile-header.js
                    const recipientsBtn = document.querySelector('.manage-recipients-btn');
                    if (recipientsBtn) {
                        recipientsBtn.style.display = currentUserRole === 'superadmin' ? 'flex' : 'none';
                    }
                }
            } catch (error) {
                console.error('Error checking user role:', error);
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
            showToast(`${trimmedEmail} agregado`, 'success');
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

    // =========================================
    // DASHBOARD DE ESTADÍSTICAS
    // =========================================

    const dashboardToggle = document.getElementById('dashboardToggle');
    const dashboardContent = document.getElementById('dashboardContent');
    const dashboardSection = document.getElementById('step-dashboard');
    let dashboardChart = null;
    let dashboardLoaded = false;

    // Toggle dashboard
    if (dashboardToggle && dashboardContent) {
        dashboardToggle.addEventListener('click', () => {
            const isExpanded = dashboardContent.style.display !== 'none';
            dashboardContent.style.display = isExpanded ? 'none' : 'block';
            dashboardToggle.classList.toggle('expanded', !isExpanded);

            // Cargar datos solo la primera vez que se expande
            if (!isExpanded && !dashboardLoaded) {
                loadDashboardStats();
                dashboardLoaded = true;
            }
        });
    }

    // Cargar estadísticas del dashboard
    async function loadDashboardStats() {
        try {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

            // Consultar incidentes
            const snapshot = await db.collection('suralisIncidents')
                .orderBy('sentAt', 'desc')
                .limit(200)
                .get();

            const incidents = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                incidents.push({
                    id: doc.id,
                    ...data,
                    sentAt: data.sentAt?.toDate() || new Date()
                });
            });

            // Calcular métricas
            const thisMonth = incidents.filter(i => i.sentAt >= startOfMonth);
            const caidasMes = thisMonth.filter(i => i.type === 'caida').length;
            const normalizacionesMes = thisMonth.filter(i => i.type !== 'caida').length;

            // Servicio más afectado
            const serviceCounts = {};
            incidents.filter(i => i.type === 'caida').forEach(i => {
                (i.services || []).forEach(s => {
                    const shortName = s.length > 20 ? s.substring(0, 20) + '...' : s;
                    serviceCounts[shortName] = (serviceCounts[shortName] || 0) + 1;
                });
            });
            const topService = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0];

            // Calcular duración de fallas (MTTR Logic)
            incidents.forEach((incident, index) => {
                if (incident.type !== 'caida') { // Es una normalización
                    // Buscar hacia atrás (en el arreglo ordenado DESC, índices mayores son más antiguos)
                    // la caída más reciente que coincida con alguno de los servicios.
                    for (let j = index + 1; j < incidents.length; j++) {
                        const pastIncident = incidents[j];

                        // Solo nos interesa si es una caída
                        if (pastIncident.type === 'caida') {
                            // Verificar intersección de servicios
                            const hasCommonService = incident.services.some(s => pastIncident.services.includes(s));

                            if (hasCommonService) {
                                // ¡Encontrado!
                                const diffMs = incident.sentAt - pastIncident.sentAt;
                                const diffMins = Math.floor(diffMs / 60000);
                                const hours = Math.floor(diffMins / 60);
                                const mins = diffMins % 60;

                                incident.durationFormatted = `${hours}h ${mins}m`;

                                // Opcional: Marcar incidente pasado como "resuelto" para no contearlo doble si hay múltiples normalizaciones (complejo).
                                // Por ahora, primer match gana (la caída más reciente).
                                break;
                            }
                        }
                    }
                }
            });

            // Actualizar UI
            document.getElementById('statCaidasMes').textContent = caidasMes;
            document.getElementById('statNormalizaciones').textContent = normalizacionesMes;
            document.getElementById('statTopServicio').textContent = topService ? topService[0] : 'N/A';
            document.getElementById('statTotalIncidentes').textContent = incidents.length;

            // Renderizar tabla de últimos incidentes
            renderIncidentsTable(incidents.slice(0, 10));

            // Renderizar gráfico
            renderIncidentsChart(incidents.filter(i => i.sentAt >= thirtyDaysAgo));

            // Renderizar Heatmap
            renderHeatmap(incidents);

        } catch (error) {
            console.error('Error loading dashboard stats:', error);
        }
    }

    function renderIncidentsTable(incidents) {
        const tbody = document.getElementById('incidentsTableBody');
        if (!tbody) return;

        if (incidents.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#A1A9B5;">No hay incidentes registrados</td></tr>';
            return;
        }

        // Logic to calculate durations for the displayed rows
        // Note: incidents are passed sorted descending (newest first)
        // We need access to the full history to find the start of an outage, but here we might only have a slice.
        // For the best accuracy, this calculation should ideally happen before slicing, but for now we'll try to find it in the provided list or suggest better logic later.
        // However, loadDashboardStats passes incidents.slice(0, 10). This means we might miss the 'start' if it's older than the 10th item.
        // Quick fix: The caller should ideally calculate duration on the full list BEFORE slicing. 
        // Let's implement a visual check here assuming 'incidents' might be the subset, so we can't guarantee finding the pair.
        // BUT, to do it right, I will grab the full list from 'loadDashboardStats' context if possible, or just look in this slice.
        // Actually, let's just modify the render mapping.

        tbody.innerHTML = incidents.map(i => {
            const date = i.sentAt.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
            const typeClass = i.type === 'caida' ? 'type-caida' : 'type-normalizacion';
            const typeLabel = i.type === 'caida' ? '⚠️ Caída' : '✅ Normal';
            const servicesText = (i.services || []).slice(0, 2).join(', ') + (i.servicesCount > 2 ? ` (+${i.servicesCount - 2})` : '');
            const sentBy = i.sentBy?.split('@')[0] || 'Sistema';

            // Calculate duration if it's a normalization
            let durationText = '-';
            if (i.type !== 'caida' && i.duration) {
                // Used if pre-calculated
                durationText = i.duration;
            } else if (i.type !== 'caida') {
                // Try to calculate on the fly if passed in incidents has the data? 
                // It's better to pre-calc. For now, placeholder or needs pre-calc.
                durationText = '--';
            }

            return `
                <tr>
                    <td>${date}</td>
                    <td><span class="incident-type ${typeClass}">${typeLabel}</span></td>
                    <td title="${(i.services || []).join(', ')}">${servicesText || 'N/A'}</td>
                    <td style="font-family:'Consolas',monospace;font-size:0.9em;color:#A1A9B5;">${i.durationFormatted || '-'}</td>
                    <td>${sentBy}</td>
                </tr>
            `;
        }).join('');
    }

    function renderIncidentsChart(incidents) {
        const ctx = document.getElementById('incidentsChart');
        if (!ctx) return;

        // Agrupar por día
        const dailyCounts = {};
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const key = date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
            dailyCounts[key] = { caidas: 0, normalizaciones: 0 };
        }

        incidents.forEach(i => {
            const key = i.sentAt.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
            if (dailyCounts[key]) {
                if (i.type === 'caida') {
                    dailyCounts[key].caidas++;
                } else {
                    dailyCounts[key].normalizaciones++;
                }
            }
        });

        const labels = Object.keys(dailyCounts);
        const caidasData = labels.map(l => dailyCounts[l].caidas);
        const normData = labels.map(l => dailyCounts[l].normalizaciones);

        // Destruir gráfico anterior si existe
        if (dashboardChart) {
            dashboardChart.destroy();
        }

        dashboardChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Caídas',
                        data: caidasData,
                        backgroundColor: 'rgba(239, 68, 68, 0.7)',
                        borderColor: 'rgba(239, 68, 68, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Normalizaciones',
                        data: normData,
                        backgroundColor: 'rgba(34, 197, 94, 0.7)',
                        borderColor: 'rgba(34, 197, 94, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#A1A9B5', stepSize: 1 },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    },
                    x: {
                        ticks: { color: '#A1A9B5', maxRotation: 45 },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#E0E4EA' }
                    }
                }
            }
        });
    }

    function renderHeatmap(incidents) {
        const heatmapContainer = document.getElementById('incidentsHeatmap');
        if (!heatmapContainer) return;

        // Initialize 7x24 grid (Sun-Sat, 0-23h)
        const gridData = Array(7).fill().map(() => Array(24).fill(0));

        incidents.forEach(incident => {
            if (incident.type === 'caida') {
                const date = incident.sentAt;
                const day = date.getDay(); // 0-6 (Sun-Sat)
                const hour = date.getHours(); // 0-23
                gridData[day][hour]++;
            }
        });

        const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        let html = '';

        // Header Row (Hours)
        html += '<div class="heatmap-header-cell"></div>'; // Corner
        for (let h = 0; h < 24; h++) {
            html += `<div class="heatmap-header-cell">${h}h</div>`;
        }

        // Data Rows
        for (let d = 0; d < 7; d++) {
            // Row Label
            html += `<div class="heatmap-row-label">${dayLabels[d]}</div>`;

            // Cells
            for (let h = 0; h < 24; h++) {
                const count = gridData[d][h];
                let intensity = 0;
                if (count > 0) intensity = 1;
                if (count > 2) intensity = 2;
                if (count > 5) intensity = 3;
                if (count > 10) intensity = 4;
                if (count > 20) intensity = 5;

                html += `<div class="heatmap-cell intensity-${intensity}" 
                              data-tooltip="${dayLabels[d]} ${h}:00 - ${count} caídas">
                         </div>`;
            }
        }

        heatmapContainer.innerHTML = html;
    }
});
