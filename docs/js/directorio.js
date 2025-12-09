// ===========================================================================
// DIRECTORIO DE EMPLEADOS - Funcionalidad principal
// ===========================================================================

const DEFAULT_EMPLOYEES = [
    { nombre: "Sergio Castillo", cargo: "Operador NOC", telefono: "", email: "", telegram: "" },
    { nombre: "Ignacio Aburto", cargo: "Operador NOC", telefono: "", email: "", telegram: "" },
    { nombre: "Claudio Bustamante", cargo: "Operador NOC", telefono: "", email: "", telegram: "" },
    { nombre: "Julio Oliva", cargo: "Operador NOC", telefono: "", email: "", telegram: "" },
    { nombre: "Gabriel Trujillo", cargo: "Operador NOC", telefono: "", email: "", telegram: "" },
    { nombre: "Cristian Oyarzo", cargo: "Operador NOC", telefono: "", email: "", telegram: "" }
];

let allEmployees = [];
let currentFilter = 'all';
let searchTerm = '';

// Wait for Firebase
function waitForFirebase(callback, maxAttempts = 50, interval = 100) {
    let attempts = 0;
    const check = () => {
        attempts++;
        if (window.db) {
            console.log("[DIRECTORIO] Firebase ready after", attempts, "attempts");
            callback();
        } else if (attempts < maxAttempts) {
            setTimeout(check, interval);
        } else {
            console.warn("[DIRECTORIO] Firebase not available, using fallback");
            callback();
        }
    };
    check();
}

// Load employees from Firestore
async function loadEmployees() {
    const grid = document.getElementById("employees-grid");
    if (!grid) return;

    try {
        let employeesList = [];

        // 1. Load Employee Data
        if (window.db) {
            try {
                const configDoc = await window.db.collection("Config").doc("empleados_noc").get();
                if (configDoc.exists && configDoc.data().lista) {
                    employeesList = configDoc.data().lista;
                }

                // FIX: Merge DEFAULT_EMPLOYEES to ensure no one is missing (e.g., Cristian Oyarzo)
                DEFAULT_EMPLOYEES.forEach(def => {
                    if (!employeesList.some(e => e.nombre === def.nombre)) {
                        console.log(`[DIRECTORIO] Agregando empleado faltante: ${def.nombre}`);
                        employeesList.push(def);
                    }
                });

                const empleadosSnapshot = await window.db.collection("empleados").get();
                const empleadosMap = {};
                empleadosSnapshot.forEach(doc => {
                    empleadosMap[doc.id] = doc.data();
                });

                employeesList = employeesList.map(emp => ({
                    ...emp,
                    ...empleadosMap[emp.nombre] || {}
                }));

            } catch (e) {
                console.warn("[DIRECTORIO] Error cargando desde Firestore:", e);
            }
        }

        if (employeesList.length === 0) {
            employeesList = DEFAULT_EMPLOYEES;
        }

        // 2. Load Calendar Data (Centralized)
        const calendarData = await getCalendarData();

        // 3. Determine status and Next Vacation for each employee
        employeesList = employeesList.map(emp => {
            const statusData = getEmployeeStatus(emp.nombre, calendarData);
            const vacacion = getNextVacation(emp.nombre, calendarData);
            return {
                ...emp,
                ...statusData, // Spread all status properties (status, shift, customLabel, customIcon)
                rawShift: statusData.shift,
                proximaVacacion: vacacion
            };
        });

        allEmployees = employeesList;
        renderEmployees(employeesList);
        updateStats(employeesList);

    } catch (error) {
        console.error("[DIRECTORIO] Error fatal:", error);
        grid.innerHTML = '<div class="no-results"><i data-lucide="alert-circle"></i><h3>Error al cargar</h3><p>No se pudo cargar el directorio de empleados</p></div>';
        if (window.lucide) lucide.createIcons();
    }
}

// Helper: Get Calendar Data (Cache -> Firestore Fallback)
async function getCalendarData() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    // 1. Try LocalStorage (Fastest)
    const nocKey = `calendar_v3_${year}-${month}`;
    const localData = localStorage.getItem(nocKey);

    if (localData) {
        console.log("[DIRECTORIO] Calendario cargado desde localStorage");
        const parsed = JSON.parse(localData);
        parsed._debugSource = 'Local';
        return parsed;
    }

    // 2. Try Firestore (Fallback)
    const monthName = today.toLocaleString("es-ES", { month: "long" });
    const docId = `${monthName} ${year}`;

    const docIdsToTry = [
        docId,
        docId.charAt(0).toUpperCase() + docId.slice(1),
        docId.toLowerCase()
    ];

    console.log("[DIRECTORIO] localStorage vacío. Buscando en Firestore:", docIdsToTry);

    if (window.db) {
        try {
            for (const id of docIdsToTry) {
                const doc = await window.db.collection("calendarios").doc(id).get();
                if (doc.exists) {
                    console.log(`[DIRECTORIO] Calendario encontrado en Firestore: ${id}`);
                    const data = doc.data();
                    localStorage.setItem(nocKey, JSON.stringify(data));
                    data._debugSource = `Fire:${id}`;
                    return data;
                }
            }
        } catch (e) {
            console.warn("[DIRECTORIO] Error buscando en Firestore:", e);
        }
    }

    return { _debugSource: 'None' };
}

// Render employee cards
function getEmployeeStatus(employeeName, calendarData) {
    try {
        const today = new Date();
        const dayString = today.getDate().toString();
        const dayPadded = dayString.padStart(2, '0'); // "08" instead of "8"

        if (!calendarData || !calendarData.assignments) {
            return {
                status: 'free',
                shift: `NoCalData (${calendarData?._debugSource || 'Null'})`
            };
        }

        let employeeShifts;

        // Special handling for Cristian Oyarzo (Nocturno Calendar)
        if (employeeName === "Cristian Oyarzo") {
            employeeShifts = calendarData.nocturno;
        } else {
            employeeShifts = calendarData.assignments[employeeName];
        }

        if (!employeeShifts) {
            return {
                status: 'free',
                shift: `NoEmp (${calendarData._debugSource})`
            };
        }

        // Shift Definitions (Based on "Ver Horarios" modal)
        const SHIFT_HOURS = {
            'M0': { start: '09:00', end: '19:00' },
            'M0A': { start: '09:00', end: '19:00' },
            'M1': { start: '08:30', end: '17:30', sat: { start: '08:30', end: '13:30' } },
            'M1A': { start: '08:30', end: '18:30' },
            'M1B': { start: '07:00', end: '17:00' },
            'M2': { start: '11:00', end: '20:00', sat: { start: '13:00', end: '18:00' } },
            'M2A': { start: '10:00', end: '20:00' },
            'M2B': { start: '10:00', end: '20:00' },
            'M3': { start: '11:00', end: '21:00' },
            'T': { start: '15:00', end: '23:00' }, // Estimated
            'S': { start: '09:00', end: '18:00' }, // Estimated
            'I': { start: '09:00', end: '18:00' }  // Estimated
        };

        // ... inside getEmployeeStatus ...

        // ... inside getEmployeeStatus ...

        // CHECK FERIADOS (Special Night Shifts: 21:00 - 02:00)
        if (calendarData.feriados) {
            const feriadoShift = calendarData.feriados[dayString] || calendarData.feriados[dayPadded];
            if (feriadoShift) {
                let isAssignedHoliday = false;

                // User request: S = Sergio, I = Ignacio
                if (feriadoShift === 'S' && employeeName === 'Sergio Castillo') isAssignedHoliday = true;
                if (feriadoShift === 'I' && employeeName === 'Ignacio Aburto') isAssignedHoliday = true;

                if (isAssignedHoliday) {
                    // Holiday night shift logic
                    const now = new Date();
                    const hour = now.getHours();

                    let label = 'Entra 21:00';
                    let icon = 'clock';
                    let statusClass = 'night'; // Use night style (or working)

                    // If now is late night (21+) or early morning (< 2)
                    // Note: < 2 covers the "next day" part if checking same-day (which is imperfect but works for visual "De Turno")
                    if (hour >= 21 || hour < 2) {
                        label = 'De Turno (Feriado)';
                        icon = 'moon'; // Moon for night
                        statusClass = 'working';
                    }

                    return {
                        status: statusClass,
                        shift: 'Feriado (21:00 - 02:00)',
                        customLabel: label,
                        customIcon: icon
                    };
                }
            }
        }

        // Try both formats (8 and 08)
        const todayShift = employeeShifts[dayString] || employeeShifts[dayPadded];

        if (todayShift) {
            if (['L', 'DL', 'F'].includes(todayShift)) {
                return { status: 'free', shift: todayShift };
            } else if (todayShift === 'V') {
                return { status: 'vacation', shift: todayShift };
            } else if (todayShift === 'N') {
                // Night Shift Handling (Complex because it spans two days)
                // For simplified view: Always show "Night Shift" if assigned today
                return { status: 'night', shift: `N (21:00 - 07:00)` };
            } else {
                // Check Real-Time Status
                let label = 'De Turno';
                let icon = 'briefcase';
                let statusClass = 'working';

                const shiftDef = SHIFT_HOURS[todayShift];
                if (shiftDef) {
                    const now = new Date();
                    const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat

                    let hours = shiftDef;
                    if (dayOfWeek === 6 && shiftDef.sat) hours = shiftDef.sat; // Saturday specific

                    const [startH, startM] = hours.start.split(':').map(Number);
                    const [endH, endM] = hours.end.split(':').map(Number);

                    const nowMinutes = now.getHours() * 60 + now.getMinutes();
                    const startMinutes = startH * 60 + startM;
                    const endMinutes = endH * 60 + endM;

                    if (nowMinutes > endMinutes) {
                        label = 'Turno Finalizado';
                        icon = 'check-circle'; // Or 'moon'
                        statusClass = 'free'; // Visually free? Or specific 'finished' style?
                        // Let's keep 'working' color but change text, or add 'finished' class
                        // User asked for "fuera de turno" in the free/working part
                    } else if (nowMinutes < startMinutes) {
                        label = `Entra ${hours.start}`;
                        icon = 'clock';
                    }
                }

                // If label changed to "Turno Finalizado", maybe map to 'free' or custom
                if (label === 'Turno Finalizado') {
                    return { status: 'free', shift: todayShift, customLabel: label, customIcon: icon };
                }

                return { status: statusClass, shift: todayShift, customLabel: label, customIcon: icon };
            }
        }

        // Implicit Fix: If Cristian Oyarzo is "Empty", he is Free (as per user request: Sat/Sun/Hol/Empty = Free)
        if (employeeName === "Cristian Oyarzo") {
            return { status: 'free', shift: 'Descanso' };
        }

        // Debug: Show keys if shift is empty to see what keys exist
        const keys = Object.keys(employeeShifts).slice(0, 5).join(',');
        return {
            status: 'free',
            shift: `Empty (Day:${dayString}/${dayPadded}, Keys:[${keys}]...)`
        };

    } catch (e) {
        return { status: 'free', shift: 'Error' };
    }
}

// Helper: Find next vacation in CURRENT month
function getNextVacation(employeeName, calendarData) {
    if (!calendarData) return null;

    let shifts;
    if (employeeName === "Cristian Oyarzo") {
        shifts = calendarData.nocturno;
    } else if (calendarData.assignments) {
        shifts = calendarData.assignments[employeeName];
    }

    if (!shifts) return null;

    const today = new Date();
    const currentDay = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    // Look ahead from tomorrow until end of month
    for (let day = currentDay + 1; day <= daysInMonth; day++) {
        const dayStr = day.toString();
        const dayPad = dayStr.padStart(2, '0');
        const shift = shifts[dayStr] || shifts[dayPad];

        if (shift === 'V') {
            return `${dayPad}/${(today.getMonth() + 1).toString().padStart(2, '0')}`;
        }
    }
    return null;
}

// Helper: Find next vacation in CURRENT month
function getNextVacation(employeeName, calendarData) {
    if (!calendarData) return null;

    let shifts;
    if (employeeName === "Cristian Oyarzo") {
        shifts = calendarData.nocturno;
    } else if (calendarData.assignments) {
        shifts = calendarData.assignments[employeeName];
    }

    if (!shifts) return null;

    const today = new Date();
    const currentDay = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    // Look ahead from tomorrow until end of month
    for (let day = currentDay + 1; day <= daysInMonth; day++) {
        const dayStr = day.toString();
        const dayPad = dayStr.padStart(2, '0');
        const shift = shifts[dayStr] || shifts[dayPad];

        if (shift === 'V') {
            return `${dayPad}/${(today.getMonth() + 1).toString().padStart(2, '0')}`;
        }
    }
    return null;
}

// Render employee cards
function renderEmployees(employees) {
    const grid = document.getElementById("employees-grid");
    if (!grid) return;

    let filtered = employees;

    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(emp =>
            emp.nombre?.toLowerCase().includes(term) ||
            emp.cargo?.toLowerCase().includes(term)
        );
    }

    if (currentFilter !== 'all') {
        filtered = filtered.filter(emp => emp.status === currentFilter);
    }

    if (filtered.length === 0) {
        grid.innerHTML = `
      <div class="no-results">
        <i data-lucide="search-x"></i>
        <h3>Sin resultados</h3>
        <p>No se encontraron empleados con los filtros aplicados</p>
      </div>
    `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    grid.innerHTML = '';

    filtered.forEach((emp, index) => {
        const card = createEmployeeCard(emp, index);
        grid.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();
}

// Create employee card element
function createEmployeeCard(emp, index) {
    const card = document.createElement('div');
    card.className = 'employee-card';
    card.style.animationDelay = `${index * 0.05}s`;

    const photoUrl = emp.photoURL || emp.fotoUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.nombre)}&background=7796cb&color=fff&size=120`;

    const role = emp.cargo || "Operador NOC";
    const status = emp.status || 'free';

    const statusConfig = {
        working: { label: 'De Turno', icon: 'briefcase' },
        free: { label: 'Libre', icon: 'coffee' },
        vacation: { label: 'Vacaciones', icon: 'palm-tree' },
        next: { label: 'Próximo Turno', icon: 'clock' },
        night: { label: 'Turno Noche', icon: 'moon' }
    };

    let statusInfo = statusConfig[status] || statusConfig.free;

    // Override with custom real-time status if available
    if (emp.customLabel) {
        statusInfo = {
            ...statusInfo,
            label: emp.customLabel,
            icon: emp.customIcon || statusInfo.icon
        };
    }

    // Check if user is admin BEFORE generating HTML
    const userRole = localStorage.getItem('userRole');
    const isAdmin = userRole === 'admin' || userRole === 'superadmin';

    // Edit button
    const editButton = isAdmin
        ? `<button class="action-btn edit" title="Editar" data-name="${emp.nombre}"><i data-lucide="edit-2"></i></button>`
        : '';

    // DEBUG: Show raw shift if free/error
    const debugText = `<span style="font-size:9px; color:#aaa; display:block; margin-top:4px;">${emp.rawShift || 'None'}</span>`;

    card.innerHTML = `
    <div class="employee-card-header">
      <div class="employee-photo-container">
        <img src="${photoUrl}" alt="${emp.nombre}" class="employee-photo" 
             onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(emp.nombre)}&background=7796cb&color=fff&size=120'" />
      </div>
    </div>
    <div class="employee-card-body">
      <h3 class="employee-name">${emp.nombre}</h3>
      <p class="employee-role">${role}</p>
      <div class="employee-status ${status}">
        <i data-lucide="${statusInfo.icon}"></i>
        ${statusInfo.label}
      </div>
      <div class="employee-meta">
          ${emp.fechaNacimiento ? `<div class="meta-item"><i data-lucide="cake"></i> <span>${emp.fechaNacimiento}</span></div>` : ''}
          ${emp.proximaVacacion ? `<div class="meta-item highlight"><i data-lucide="plane"></i> <span>Vacaciones: ${emp.proximaVacacion}</span></div>` : ''}
      </div>
      ${debugText} 
      <div class="employee-actions">
        ${emp.telegram ? `<button class="action-btn telegram" title="Telegram" data-telegram="${emp.telegram}"><i data-lucide="send"></i></button>` : ''}
        ${emp.telefono ? `<button class="action-btn phone" title="Llamar" data-phone="${emp.telefono}"><i data-lucide="phone"></i></button>` : ''}
        ${emp.email ? `<button class="action-btn email" title="Email" data-email="${emp.email}"><i data-lucide="mail"></i></button>` : ''}
        ${editButton}
      </div>
    </div>
  `;

    // Add action event listeners
    card.querySelector('.action-btn.telegram')?.addEventListener('click', (e) => {
        const telegram = e.currentTarget.dataset.telegram;
        if (telegram) window.open(`https://t.me/${telegram}`, '_blank');
    });

    card.querySelector('.action-btn.phone')?.addEventListener('click', (e) => {
        const phone = e.currentTarget.dataset.phone;
        if (phone) window.location.href = `tel:${phone}`;
    });

    card.querySelector('.action-btn.email')?.addEventListener('click', (e) => {
        const email = e.currentTarget.dataset.email;
        if (email) window.location.href = `mailto:${email}`;
    });

    card.querySelector('.action-btn.edit')?.addEventListener('click', (e) => {
        const name = e.currentTarget.dataset.name;
        editEmployee(name);
    });

    return card;
}

// Update stats
function updateStats(employees) {
    const total = employees.length;
    const working = employees.filter(e => e.status === 'working').length;
    const free = employees.filter(e => e.status === 'free').length;
    const vacation = employees.filter(e => e.status === 'vacation').length;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-working').textContent = working;
    document.getElementById('stat-free').textContent = free;
    document.getElementById('stat-vacation').textContent = vacation;
}

// Edit employee - opens a full modal with form
function editEmployee(name) {
    // Find the employee data
    const employee = allEmployees.find(e => e.nombre === name);
    if (!employee) {
        Swal.fire('Error', 'Empleado no encontrado', 'error');
        return;
    }

    const currentPhoto = employee.photoURL || employee.fotoUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=7796cb&color=fff&size=120`;

    Swal.fire({
        title: 'Editar Empleado',
        html: `
            <div class="edit-employee-form" style="display: grid; grid-template-columns: 120px 1fr; gap: 20px; align-items: start; text-align: left;">
                
                <!-- Left Column: Photo -->
                <div class="edit-photo-container" style="text-align:center;">
                    <label for="edit-photo-input" style="cursor:pointer; display:inline-block; position:relative; transition: transform 0.2s;" 
                           onmouseover="this.style.transform='scale(1.05)'" 
                           onmouseout="this.style.transform='scale(1)'">
                        
                        <img src="${currentPhoto}" alt="${name}" id="edit-photo-preview" 
                             style="width:120px; height:120px; border-radius:12px; object-fit:cover; border:2px solid #7796cb; background-color:#2a2d3e; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);" />
                        
                        <div style="position:absolute; bottom:-10px; right:-10px; background:#7796cb; color:white; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border:2px solid #1a1d2d; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">
                            <i data-lucide="camera" style="width:16px; height:16px;"></i>
                        </div>
                    </label>
                    <input type="file" id="edit-photo-input" accept="image/*" style="display:none" />
                </div>

                <!-- Right Column: Fields -->
                <div class="edit-fields-container" style="display: flex; flex-direction: column; gap: 15px;">
                    <div class="swal2-input-group" style="margin:0;">
                        <label style="display:block; text-align:left; margin-bottom:6px; font-weight:500; font-size: 0.9em; color: #a1a1aa;">Nombre Completo</label>
                        <input type="text" id="edit-nombre" class="swal2-input" value="${employee.nombre || ''}" placeholder="Nombre" style="margin:0; width:100%; font-size: 1rem; padding: 10px; background: #27272a; border: 1px solid #3f3f46; color: white;" />
                    </div>
                    
                    <div class="swal2-input-group" style="margin:0;">
                        <label style="display:block; text-align:left; margin-bottom:6px; font-weight:500; font-size: 0.9em; color: #a1a1aa;">Cargo / Rol</label>
                        <input type="text" id="edit-cargo" class="swal2-input" value="${employee.cargo || 'Operador NOC'}" placeholder="Cargo" style="margin:0; width:100%; font-size: 1rem; padding: 10px; background: #27272a; border: 1px solid #3f3f46; color: white;" />
                    </div>

                    <!-- New Fields for Birthday -->
                    <div class="swal2-input-group" style="margin:0;">
                        <label style="display:block; text-align:left; margin-bottom:6px; font-weight:500; font-size: 0.9em; color: #a1a1aa;">🎂 Cumpleaños (DD/MM)</label>
                        <input type="text" id="edit-cumple" class="swal2-input" value="${employee.fechaNacimiento || ''}" placeholder="Ej: 15/05" style="margin:0; width:100%; font-size: 0.95rem; padding: 10px; background: #27272a; border: 1px solid #3f3f46; color: white;" />
                    </div>
                </div>
            </div>
            
            <p style="font-size:0.8rem; color:#52525b; margin-top:1.5rem; text-align: center;">
                Solo se necesitan estos datos para la tarjeta del directorio.
            </p>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="lucide-save"></i> Guardar Cambios',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#7796cb',
        cancelButtonColor: '#3f3f46',
        width: '550px',
        padding: '2em',
        background: '#18181b',
        color: '#fff',
        didOpen: () => {
            // Initialize icons inside modal
            lucide.createIcons({ root: Swal.getPopup() });

            // Photo preview logic
            const photoInput = document.getElementById('edit-photo-input');
            const photoPreview = document.getElementById('edit-photo-preview');

            if (photoInput) {
                photoInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        if (file.size > 5 * 1024 * 1024) {
                            Swal.showValidationMessage('La imagen es muy grande (máx 5MB)');
                            return;
                        }
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                            photoPreview.src = ev.target.result;
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }
        },
        preConfirm: () => {
            return {
                nombre: document.getElementById('edit-nombre').value.trim(),
                cargo: document.getElementById('edit-cargo').value.trim(),
                fechaNacimiento: document.getElementById('edit-cumple').value.trim(),
                photoFile: document.getElementById('edit-photo-input').files[0] || null,
                photoPreviewSrc: document.getElementById('edit-photo-preview').src
            };
        }
    }).then(async (result) => {
        if (result.isConfirmed && result.value) {
            await saveEmployeeData(name, result.value);
        }
    });
}


// Save employee data to Firestore
async function saveEmployeeData(originalName, data) {
    try {
        Swal.fire({
            title: 'Guardando...',
            text: 'Subiendo datos y foto...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        // Ensure firebase global is available
        const fb = window.firebase || firebase;
        if (!fb) throw new Error("Firebase SDK no cargado.");

        let photoURL = data.photoPreviewSrc;

        // 1. Upload photo if changed (and if file provided)
        if (data.photoFile) {
            if (!fb.storage) {
                console.warn("[DIRECTORIO] storage no disponible");
            } else {
                try {
                    const storageRef = fb.storage().ref();
                    const safeName = data.nombre.replace(/[^a-zA-Z0-9]/g, '_');
                    const photoRef = storageRef.child(`empleados/${safeName}_${Date.now()}.jpg`);

                    await photoRef.put(data.photoFile);
                    photoURL = await photoRef.getDownloadURL();
                    console.log('[DIRECTORIO] Foto subida:', photoURL);
                } catch (uploadErr) {
                    console.error('[DIRECTORIO] Error subiendo foto:', uploadErr);
                    Swal.fire("Advertencia", "No se pudo subir la foto, pero se guardarán los datos.", "warning");
                }
            }
        }

        // 2. Prepare data object (Keep existing contact info if not in modal)
        // 2. Prepare data object (Keep existing contact info if not in modal)
        const updateData = {
            nombre: data.nombre,
            cargo: data.cargo,
            fechaNacimiento: data.fechaNacimiento,
            photoURL: photoURL,
            updatedAt: new Date()
        };

        // 3. Update 'empleados' collection (Extended profile)
        if (window.db) {
            const empleadoRef = window.db.collection('empleados').doc(data.nombre);
            await empleadoRef.set(updateData, { merge: true });
        }

        // 4. CRITICAL: Update 'Config/empleados_noc' list (Source for Directorio Grid)
        if (window.db) {
            const configRef = window.db.collection('Config').doc('empleados_noc');

            // Read current list
            const configDoc = await configRef.get();
            if (configDoc.exists) {
                let lista = configDoc.data().lista || [];

                // Map list to update entry
                lista = lista.map(emp => {
                    if (emp.nombre === originalName) {
                        return {
                            ...emp,
                            nombre: data.nombre,
                            cargo: data.cargo,
                            fechaNacimiento: data.fechaNacimiento,
                            photoURL: photoURL
                            // Updated fields
                        };
                    }
                    return emp;
                });

                await configRef.update({ lista });
                console.log("[DIRECTORIO] Lista Config actualizada");
            }
        }

        Swal.fire({
            icon: 'success',
            title: '¡Guardado!',
            text: 'Datos actualizados correctamente.',
            timer: 1500,
            showConfirmButton: false
        });

        // 5. Reload UI
        loadEmployees();

    } catch (error) {
        console.error('[DIRECTORIO] Error guardando:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo guardar: ' + error.message
        });
    }
}

// Setup search and filters
function setupSearchAndFilters() {
    const searchInput = document.getElementById('search-employee');
    const filterBtns = document.querySelectorAll('.filter-btn');

    // Search
    searchInput?.addEventListener('input', (e) => {
        searchTerm = e.target.value;
        renderEmployees(allEmployees);
    });

    // Filters
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderEmployees(allEmployees);
        });
    });
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    console.log("[DIRECTORIO] Iniciando...");
    setupSearchAndFilters();

    waitForFirebase(() => {
        console.log("[DIRECTORIO] Cargando empleados...");
        loadEmployees();
    });
});
