"use strict";

// ============================================================================
// GESTIÓN DE CUENTAS DE USUARIO DEL SISTEMA
// Para gestionar cuentas de Firebase Auth (login al sistema)
// DIFERENTE de gestión de empleados NOC (calendario de turnos)
// ============================================================================

// Auth y db se obtienen cuando están disponibles
function getAuth() { return window.auth; }
function getDb() { return window.db; }

// Estado global
let allUsers = [];
let auditLogs = [];

// ============================================================================
// FUNCIONES DE CARGA INICIAL
// ============================================================================

/**
 * Cargar todos los usuarios del sistema (cuentas Firebase Auth)
 */
async function loadAllUsers() {
    try {
        const db = getDb();
        if (!db) throw new Error("Firestore no inicializado");

        console.log("Cargando usuarios...");

        // Obtener todos los roles de usuario
        const rolesSnapshot = await db.collection("userRoles").get();
        console.log(`Roles encontrados: ${rolesSnapshot.size}`);

        // Obtener información de suspensión (Graceful degradation)
        let userStatus = {};
        try {
            const statusSnapshot = await db.collection("userStatus").get();
            statusSnapshot.forEach(doc => {
                userStatus[doc.id] = doc.data();
            });
        } catch (statusError) {
            console.warn("No se pudo cargar userStatus (posible error de permisos):", statusError);
            // Continuamos sin status
        }

        const allUsersData = [];

        rolesSnapshot.forEach(doc => {
            const userData = doc.data();
            const uid = doc.id;
            // Leer lastLogin del documento (puede ser Timestamp o null)
            const lastLogin = userData.lastLogin?.toDate?.() || null;

            allUsersData.push({
                uid: uid,
                email: userData.email || "Sin email",
                nombre: userData.nombre || userData.email?.split('@')[0] || "Usuario",
                rol: userData.rol || "user",
                suspended: userStatus[uid]?.suspended || false,
                lastLogin: lastLogin
            });
        });

        allUsers = allUsersData;

        // Verificación de integridad
        const auth = getAuth();
        if (auth.currentUser && allUsers.length === 0) {
            console.warn("¡ALERTA! El usuario actual está logueado pero la lista de roles está vacía. Verifique reglas de seguridad.");
        }

        return allUsersData;
    } catch (error) {
        console.error("Error al cargar usuarios:", error);
        throw error;
    }
}

/**
 * Renderizar tabla de usuarios
 */
async function renderUsersTable() {
    const tbody = document.getElementById("tbodyUsuarios");
    const loader = document.getElementById("table-loader");
    const table = document.getElementById("tablaUsuarios");

    if (!tbody) return;

    // Mostrar loader
    if (loader) loader.style.display = "flex";
    if (table) table.style.display = "none";

    try {
        const users = await loadAllUsers();

        // Ocultar loader y mostrar tabla
        if (loader) loader.style.display = "none";
        if (table) table.style.display = "table";

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">No hay cuentas de usuario registradas.</td></tr>';
            return;
        }

        tbody.innerHTML = users.map(user => {
            const roleBadge = getRoleBadge(user.rol);
            const statusBadge = getStatusBadge(user.suspended);
            const lastActivity = user.lastLogin
                ? user.lastLogin.toLocaleString("es-CL")
                : "No disponible";

            return `
                <tr data-uid="${user.uid}">
                    <td>
                        <div class="user-info">
                            <span class="user-name">${escapeHtml(user.nombre)}</span>
                            <span class="user-email">${escapeHtml(user.email)}</span>
                        </div>
                    </td>
                    <td>${roleBadge}</td>
                    <td>${statusBadge}</td>
                    <td>${lastActivity}</td>
                    <td>
                        <div class="actions-cell">
                            <button class="btn-action edit" onclick="editUser('${user.uid}')" title="Cambiar Rol">
                                <i data-lucide="edit"></i>
                            </button>
                            ${!user.suspended ? `
                                <button class="btn-action suspend" onclick="suspendUser('${user.uid}')" title="Suspender Cuenta">
                                    <i data-lucide="user-x"></i>
                                </button>
                           ` : `
                                <button class="btn-action activate" onclick="reactivateUser('${user.uid}')" title="Reactivar Cuenta">
                                    <i data-lucide="user-check"></i>
                                </button>
                            `}
                            <button class="btn-action reset" onclick="sendPasswordReset('${escapeHtml(user.email)}')" title="Resetear Contraseña">
                                <i data-lucide="key"></i>
                            </button>
                            <button class="btn-action delete" onclick="deleteUser('${user.uid}', '${escapeHtml(user.email)}')" title="Eliminar Cuenta">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        // Recrear iconos
        lucide.createIcons();

        // Actualizar estadísticas
        updateStats(users);

    } catch (error) {
        console.error("Error al renderizar tabla:", error);
        if (loader) loader.style.display = "none";
        if (table) table.style.display = "table"; // Mostrar tabla para ver el error

        let errorMsg = error.message;
        if (error.code === 'permission-denied') {
            errorMsg = "Permisos insuficientes para ver la lista de usuarios. Contacte al desarrollador para revisar las reglas de Firestore (userRoles).";
        }

        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: #f87171; padding: 2rem;">
            Error: ${errorMsg}
        </td></tr>`;
    }
}

/**
 * Actualizar estadísticas en cards
 */
function updateStats(users) {
    const totalUsers = users.length;
    const admins = users.filter(u => u.rol === "admin").length;
    const superadmins = users.filter(u => u.rol === "superadmin").length;
    const suspended = users.filter(u => u.suspended).length;

    document.getElementById("stat-total-users").textContent = totalUsers;
    document.getElementById("stat-admins").textContent = admins;
    document.getElementById("stat-superadmins").textContent = superadmins;
    document.getElementById("stat-suspended").textContent = suspended;
}

// ============================================================================
// FUNCIONES CRUD DE USUARIOS
// ============================================================================

/**
 * Crear nuevo usuario (cuenta de sistema)
 */
/**
 * Crear nuevo usuario (cuenta de sistema)
 */
async function createNewUser(email, password, role, name) {
    try {
        if (!email || !password || !name) {
            throw new Error("Email, nombre y contraseña son obligatorios");
        }

        // Verificar si secondaryAuth está disponible
        if (!window.secondaryAuth) {
            throw new Error("Sistema de autenticación secundario no disponible");
        }

        Swal.fire({
            title: 'Creando cuenta...',
            didOpen: () => Swal.showLoading()
        });

        // Crear usuario con secondaryAuth (igual que en script.js)
        const userCredential = await window.secondaryAuth.createUserWithEmailAndPassword(email, password);
        const newUser = userCredential.user;

        // Guardar rol en Firestore (estructura exacta de script.js)
        const db = getDb();
        await db.collection("userRoles").doc(newUser.uid).set({
            email: email,
            nombre: name,
            rol: role,
            mustChangePassword: true
        });

        // Log de auditoría
        await logAuditAction("user_created", newUser.uid, email, {
            role: role,
            name: name
        });

        Swal.fire({
            icon: "success",
            title: "Cuenta Creada",
            text: `Cuenta para ${name} (${email}) creada exitosamente.`,
            timer: 2000
        });

        // Recargar tabla
        await renderUsersTable();

    } catch (error) {
        console.error("Error al crear cuenta:", error);
        Swal.fire({
            icon: "error",
            title: "Error",
            text: "No se pudo crear la cuenta: " + error.message
        });
    }
}

/**
 * Editar rol de usuario
 */
async function editUser(uid) {
    const user = allUsers.find(u => u.uid === uid);
    if (!user) return;

    const { value: formValues } = await Swal.fire({
        title: 'Editar Usuario',
        html: `
            <div style="text-align: left; margin-bottom: 1rem;">
                <label style="display:block; font-size: 0.9em; margin-bottom: 0.3em; color: #cbd5e1;">Nombre</label>
                <input id="swal-input-name" class="swal2-input" style="margin: 0 0 1em 0; width: 100%;" placeholder="Nombre completo" value="${user.nombre || ''}">
                
                <label style="display:block; font-size: 0.9em; margin-bottom: 0.3em; color: #cbd5e1;">Rol</label>
                <select id="swal-input-role" class="swal2-select" style="margin: 0; width: 100%;">
                    <option value="user" ${user.rol === 'user' ? 'selected' : ''}>Usuario Regular</option>
                    <option value="admin" ${user.rol === 'admin' ? 'selected' : ''}>Administrador</option>
                    <option value="superadmin" ${user.rol === 'superadmin' ? 'selected' : ''}>SuperAdministrador</option>
                </select>
            </div>
            <p style="font-size: 0.8em; color: #64748b;">Email: ${user.email}</p>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar Cambios',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            return {
                name: document.getElementById('swal-input-name').value,
                role: document.getElementById('swal-input-role').value
            }
        }
    });

    if (formValues) {
        const newName = formValues.name.trim();
        const newRole = formValues.role;

        if (!newName) {
            Swal.fire("Error", "El nombre no puede estar vacío", "error");
            return;
        }

        try {
            Swal.fire({
                title: 'Actualizando...',
                didOpen: () => Swal.showLoading()
            });

            const db = getDb();

            // Actualizar nombre y rol
            await db.collection("userRoles").doc(uid).update({
                nombre: newName,
                rol: newRole
            });

            // Log de auditoría
            await logAuditAction("user_updated", uid, user.email, {
                oldRole: user.rol,
                newRole: newRole,
                oldName: user.nombre,
                newName: newName
            });

            Swal.fire({
                icon: "success",
                title: "Usuario Actualizado",
                text: `Los datos de ${newName} han sido actualizados.`,
                timer: 2000
            });

            await renderUsersTable();

        } catch (error) {
            console.error("Error al actualizar usuario:", error);
            Swal.fire({
                icon: "error",
                title: "Error",
                text: "No se pudo actualizar el usuario: " + error.message
            });
        }
    }
}

/**
 * Suspender cuenta de usuario
 */
async function suspendUser(uid) {
    const user = allUsers.find(u => u.uid === uid);
    if (!user) return;

    const { value: reason } = await Swal.fire({
        title: '¿Suspender Cuenta?',
        html: `<p>Usuario: <strong>${user.email}</strong></p>
               <p style="color: #fbbf24;">⚠️ El usuario no podrá iniciar sesión hasta que sea reactivado.</p>`,
        input: 'textarea',
        inputLabel: 'Razón de suspensión (opcional)',
        inputPlaceholder: 'Ingrese la razón de la suspensión...',
        showCancelButton: true,
        confirmButtonText: 'Sí, Suspender',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#f59e0b'
    });

    if (reason !== undefined) { // Usuario confirmó
        try {
            Swal.fire({
                title: 'Suspendiendo...',
                didOpen: () => Swal.showLoading()
            });

            const db = getDb();
            const auth = getAuth();
            const currentUser = auth.currentUser;

            await db.collection("userStatus").doc(uid).set({
                suspended: true,
                suspendedAt: firebase.firestore.FieldValue.serverTimestamp(),
                suspendedBy: currentUser.uid,
                suspendedReason: reason || "No especificada"
            });

            // Log de auditoría
            await logAuditAction("user_suspended", uid, user.email, {
                reason: reason || "No especificada"
            });

            Swal.fire({
                icon: "success",
                title: "Cuenta Suspendida",
                text: `${user.email} ha sido suspendido`,
                timer: 2000
            });

            await renderUsersTable();

        } catch (error) {
            console.error("Error al suspender cuenta:", error);
            Swal.fire({
                icon: "error",
                title: "Error",
                text: "No se pudo suspender la cuenta"
            });
        }
    }
}

/**
 * Reactivar cuenta de usuario
 */
async function reactivateUser(uid) {
    const user = allUsers.find(u => u.uid === uid);
    if (!user) return;

    const result = await Swal.fire({
        title: '¿Reactivar Cuenta?',
        html: `<p>Usuario: <strong>${user.email}</strong></p>
               <p style="color: #4ade80;">✓ El usuario podrá iniciar sesión nuevamente.</p>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, Reactivar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#22c55e'
    });

    if (result.isConfirmed) {
        try {
            Swal.fire({
                title: 'Reactivando...',
                didOpen: () => Swal.showLoading()
            });

            const db = getDb();
            await db.collection("userStatus").doc(uid).set({
                suspended: false,
                reactivatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Log de auditoría
            await logAuditAction("user_reactivated", uid, user.email, {});

            Swal.fire({
                icon: "success",
                title: "Cuenta Reactivada",
                text: `${user.email} ha sido reactivado`,
                timer: 2000
            });

            await renderUsersTable();

        } catch (error) {
            console.error("Error al reactivar cuenta:", error);
            Swal.fire({
                icon: "error",
                title: "Error",
                text: "No se pudo reactivar la cuenta"
            });
        }
    }
}

/**
 * Enviar email de reseteo de contraseña
 */
async function sendPasswordReset(email) {
    const result = await Swal.fire({
        title: 'Resetear Contraseña',
        html: `<p>Se enviará un email de recuperación a:</p>
               <p><strong>${email}</strong></p>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Enviar Email',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            Swal.fire({
                title: 'Enviando email...',
                didOpen: () => Swal.showLoading()
            });

            const auth = getAuth();
            await auth.sendPasswordResetEmail(email);

            // Log de auditoría
            const user = allUsers.find(u => u.email === email);
            if (user) {
                await logAuditAction("password_reset", user.uid, email, {});
            }

            Swal.fire({
                icon: "success",
                title: "Email Enviado",
                text: `Email de recuperación enviado a ${email}`,
                timer: 3000
            });

        } catch (error) {
            console.error("Error al enviar email:", error);
            Swal.fire({
                icon: "error",
                title: "Error",
                text: "No se pudo enviar el email de recuperación: " + error.message
            });
        }
    }
}

/**
 * Eliminar cuenta de usuario
 */
async function deleteUser(uid, email) {
    const result = await Swal.fire({
        title: '⚠️ ELIMINAR CUENTA',
        html: `<p>¿Estás seguro de eliminar la cuenta de:</p>
               <p><strong>${email}</strong></p>
               <div style="background-color: #fee2e2; color: #991b1b; padding: 10px; border-radius: 6px; margin-top: 10px;">
                   <strong>ADVERTENCIA:</strong> Esta acción NO se puede deshacer.<br>
                   Se eliminará el acceso al sistema para este usuario.
               </div>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, ELIMINAR',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#dc2626'
    });

    if (result.isConfirmed) {
        try {
            Swal.fire({
                title: 'Eliminando cuenta...',
                didOpen: () => Swal.showLoading()
            });

            const db = getDb();

            // Eliminar rol
            await db.collection("userRoles").doc(uid).delete();

            // Eliminar status si existe
            await db.collection("userStatus").doc(uid).delete();

            // Log de auditoría
            await logAuditAction("user_deleted", uid, email, {});

            Swal.fire({
                icon: "success",
                title: "Cuenta Eliminada",
                text: `${email} ha sido eliminado del sistema`,
                timer: 2000
            });

            await renderUsersTable();

        } catch (error) {
            console.error("Error al eliminar cuenta:", error);
            Swal.fire({
                icon: "error",
                title: "Error",
                text: "No se pudo eliminar la cuenta"
            });
        }
    }
}

// ============================================================================
// FUNCIONES DE AUDITORÍA
// ============================================================================

/**
 * Registrar acción en logs de auditoría
 */
async function logAuditAction(action, targetUserId, targetUserEmail, details) {
    try {
        const db = getDb();
        const auth = getAuth();
        const currentUser = auth.currentUser;

        if (!currentUser) return;

        await db.collection("auditLogs").add({
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            action: action,
            performedBy: currentUser.uid,
            performedByEmail: currentUser.email,
            targetUser: targetUserId,
            targetUserEmail: targetUserEmail,
            details: details || {}
        });

    } catch (error) {
        console.error("Error al registrar auditoría:", error);
    }
}

/**
 * Cargar logs de auditoría
 */
async function loadAuditLogs(filters = {}) {
    try {
        const db = getDb();
        let query = db.collection("auditLogs")
            .orderBy("timestamp", "desc")
            .limit(100);

        // Aplicar filtros si existen
        if (filters.action) {
            query = query.where("action", "==", filters.action);
        }
        if (filters.targetUser) {
            query = query.where("targetUser", "==", filters.targetUser);
        }

        const snapshot = await query.get();

        const logs = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            logs.push({
                id: doc.id,
                timestamp: data.timestamp ? data.timestamp.toDate() : null,
                action: data.action,
                performedByEmail: data.performedByEmail,
                targetUserEmail: data.targetUserEmail,
                details: data.details || {}
            });
        });

        auditLogs = logs;
        return logs;

    } catch (error) {
        console.error("Error al cargar logs de auditoría:", error);
        return [];
    }
}

/**
 * Renderizar tabla de auditoría
 */
async function renderAuditTable(filters = {}) {
    const tbody = document.getElementById("tbodyAudit");
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando logs...</td></tr>';

    try {
        const logs = await loadAuditLogs(filters);

        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay registros de auditoría.</td></tr>';
            return;
        }

        tbody.innerHTML = logs.map(log => {
            const actionBadge = getActionBadge(log.action);
            const dateTime = log.timestamp
                ? log.timestamp.toLocaleString("es-CL")
                : "Fecha desconocida";
            const detailsText = formatAuditDetails(log.action, log.details);

            return `
                <tr>
                    <td>${dateTime}</td>
                    <td>${actionBadge}</td>
                    <td>${escapeHtml(log.performedByEmail)}</td>
                    <td>${escapeHtml(log.targetUserEmail)}</td>
                    <td>${detailsText}</td>
                </tr>
            `;
        }).join("");

    } catch (error) {
        console.error("Error al renderizar logs:", error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #f87171;">Error al cargar logs</td></tr>';
    }
}

/**
 * Formatear detalles de auditoría según el tipo de acción
 */
function formatAuditDetails(action, details) {
    switch (action) {
        case "role_changed":
            return `${details.oldRole} → ${details.newRole}`;
        case "user_suspended":
            return details.reason || "Sin razón especificada";
        case "user_created":
            return `Rol: ${details.role}`;
        default:
            return "—";
    }
}

// ============================================================================
// FUNCIONES DE UTILIDAD
// ============================================================================

function escapeHtml(text) {
    if (!text) return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getRoleBadge(role) {
    const roleMap = {
        'user': { text: 'Usuario', icon: 'user' },
        'admin': { text: 'Admin', icon: 'shield-check' },
        'superadmin': { text: 'SuperAdmin', icon: 'crown' }
    };

    const roleInfo = roleMap[role] || roleMap['user'];
    return `
        <span class="role-badge ${role}">
            <i data-lucide="${roleInfo.icon}"></i>
            ${roleInfo.text}
        </span>
    `;
}

function getStatusBadge(suspended) {
    if (suspended) {
        return `
            <span class="status-badge suspended">
                <i data-lucide="user-x"></i>
                Suspendido
            </span>
        `;
    } else {
        return `
            <span class="status-badge active">
                <i data-lucide="user-check"></i>
                Activo
            </span>
        `;
    }
}

function getActionBadge(action) {
    const actionNames = {
        'user_created': 'Cuenta Creada',
        'role_changed': 'Cambio de Rol',
        'user_suspended': 'Cuenta Suspendida',
        'user_reactivated': 'Cuenta Reactivada',
        'password_reset': 'Reset de Contraseña',
        'user_deleted': 'Cuenta Eliminada'
    };

    return `<span class="action-badge ${action}">${actionNames[action] || action}</span>`;
}

// ============================================================================
// CONFIGURACIÓN DE PÁGINA
// ============================================================================

function configurarSidebar() {
    const sidebar = document.getElementById("sidebar");
    const mainContent = document.getElementById("main-content");
    const menuToggle = document.getElementById("menu-toggle");

    if (menuToggle && sidebar && mainContent) {
        menuToggle.addEventListener("click", () => {
            sidebar.classList.toggle("expanded");
            mainContent.classList.toggle("expanded");
        });
    }
}

function configurarLogout() {
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            getAuth().signOut()
                .then(() => {
                    localStorage.removeItem('userRole');
                    window.location.href = "login.html";
                })
                .catch((error) => { console.error("Error al cerrar sesión:", error); });
        });
    }
}

function verificarAccesoSuperAdmin() {
    getAuth().onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = "login.html";
            return;
        }

        try {
            const userDoc = await getDb().collection("userRoles").doc(user.uid).get();

            if (!userDoc.exists) {
                getAuth().signOut();
                localStorage.removeItem('userRole');
                window.location.href = "login.html";
                return;
            }

            const userData = userDoc.data();
            const userRole = userData.rol;

            // SOLO SUPERADMIN puede acceder
            if (userRole !== "superadmin") {
                Swal.fire({
                    icon: "error",
                    title: "Acceso Denegado",
                    text: "Solo SuperAdministradores pueden acceder a esta sección."
                }).then(() => {
                    window.location.href = "index.html";
                });
                return;
            }

            // Usuario es superadmin, inicializar vista
            document.body.classList.add("is-admin");

            // Mostrar link de registros
            const liRegistros = document.getElementById("li-registros");
            const liTurnos = document.getElementById("li-turnos");
            const liAnimaciones = document.getElementById("li-animaciones");
            if (liRegistros) liRegistros.style.display = "block";
            if (liTurnos) liTurnos.style.display = "block";
            if (liAnimaciones) liAnimaciones.style.display = "block";
            // Refrescar iconos después de mostrar elementos
            if (typeof refreshIcons === 'function') refreshIcons();
            else if (typeof lucide !== 'undefined') lucide.createIcons();

            // Cargar datos
            await renderUsersTable();
            await populateUserFilterSelect();

        } catch (error) {
            console.error("Error al verificar acceso:", error);
            window.location.href = "index.html";
        }
    });
}

/**
 * Poblar select de filtro de usuarios en auditoría
 */
async function populateUserFilterSelect() {
    const filterUserSelect = document.getElementById("filter-user");
    if (!filterUserSelect || allUsers.length === 0) return;

    filterUserSelect.innerHTML = '<option value="">Todos</option>';

    allUsers.forEach(user => {
        const option = document.createElement("option");
        option.value = user.uid;
        option.textContent = user.email;
        filterUserSelect.appendChild(option);
    });
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

// Esperar a que Firebase esté completamente inicializado
// Esperar a que Firebase esté completamente inicializado con timeout
function waitForFirebase() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 50; // 5 segundos

        const checkFirebase = () => {
            attempts++;
            if (window.auth && window.db && window.secondaryAuth) {
                console.log("Firebase Global Objects Ready");
                resolve();
            } else {
                if (attempts >= maxAttempts) {
                    console.error("Timeout esperando a Firebase.");
                    // Intentamos resolver de todas formas para no bloquear la UI completamente,
                    // pero funcionalidades fallarán.
                    Swal.fire({
                        icon: 'error',
                        title: 'Error de Conexión',
                        text: 'No se pudieron cargar los servicios de Firebase. Recarga la página.'
                    });
                    reject(new Error("Timeout waiting for Firebase"));
                } else {
                    setTimeout(checkFirebase, 100);
                }
            }
        };
        checkFirebase();
    });
}

async function initOne() {
    // Esperar a que Firebase esté listo
    await waitForFirebase();

    configurarSidebar();
    configurarLogout();
    verificarAccesoSuperAdmin();

    // Botón agregar usuario
    const btnAgregar = document.getElementById("btnAgregarUsuario");
    if (btnAgregar) {
        console.log("Botón agregar usuario encontrado y listener asociado.");
        btnAgregar.addEventListener("click", async () => {
            console.log("Click en agregar usuario");

            if (typeof Swal === 'undefined') {
                alert("Error: SweetAlert2 no está cargado.");
                return;
            }

            if (!window.secondaryAuth) {
                Swal.fire("Error", "El sistema de autenticación secundaria no está listo. Intente refrescar la página.", "error");
                return;
            }

            const { value: formValues } = await Swal.fire({
                title: 'Crear Nueva Cuenta de Sistema',
                html: `
                    <div style="text-align: left;">
                        <label style="display:block; font-size: 0.9em; margin-bottom: 0.3em; color: #cbd5e1;">Email</label>
                        <input id="swal-email" class="swal2-input" style="margin: 0 0 1em 0; width: 100%;" placeholder="ejemplo@email.com" type="email">

                        <label style="display:block; font-size: 0.9em; margin-bottom: 0.3em; color: #cbd5e1;">Nombre</label>
                        <input id="swal-name" class="swal2-input" style="margin: 0 0 1em 0; width: 100%;" placeholder="Nombre completo">

                        <label style="display:block; font-size: 0.9em; margin-bottom: 0.3em; color: #cbd5e1;">Contraseña</label>
                        <input id="swal-password" class="swal2-input" style="margin: 0 0 1em 0; width: 100%;" placeholder="Contraseña (min 6 chars)" type="password">
                        
                        <label style="display:block; font-size: 0.9em; margin-bottom: 0.3em; color: #cbd5e1;">Rol</label>
                        <select id="swal-role" class="swal2-select" style="margin: 0; width: 100%;">
                            <option value="user">Usuario Regular</option>
                            <option value="admin">Administrador</option>
                            <option value="superadmin">SuperAdministrador</option>
                        </select>
                    </div>`,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: 'Crear Cuenta',
                cancelButtonText: 'Cancelar',
                preConfirm: () => {
                    return {
                        email: document.getElementById('swal-email').value,
                        name: document.getElementById('swal-name').value,
                        password: document.getElementById('swal-password').value,
                        role: document.getElementById('swal-role').value
                    };
                }
            });

            if (formValues) {
                const { email, password, role, name } = formValues;
                if (!email || !password || !role || !name) {
                    Swal.fire("Error", "Todos los campos son obligatorios", "error");
                    return;
                }
                await createNewUser(email, password, role, name);
            }
        });
    }

    // Collapse de auditoría
    const auditHeader = document.getElementById("audit-header");
    const auditContent = document.getElementById("audit-content");
    const collapseBtn = auditHeader?.querySelector(".collapse-btn");

    if (auditHeader && auditContent && collapseBtn) {
        auditHeader.addEventListener("click", () => {
            const isVisible = auditContent.style.display !== "none";
            auditContent.style.display = isVisible ? "none" : "block";
            collapseBtn.classList.toggle("active");

            // Cargar logs al abrir por primera vez
            if (!isVisible && auditLogs.length === 0) {
                renderAuditTable();
            }
        });
    }

    // Filtros de auditoría
    const btnApplyFilters = document.getElementById("btnApplyFilters");
    if (btnApplyFilters) {
        btnApplyFilters.addEventListener("click", () => {
            const actionFilter = document.getElementById("filter-action").value;
            const userFilter = document.getElementById("filter-user").value;

            renderAuditTable({
                action: actionFilter || null,
                targetUser: userFilter || null
            });
        });
    }

    const btnClearFilters = document.getElementById("btnClearFilters");
    if (btnClearFilters) {
        btnClearFilters.addEventListener("click", () => {
            document.getElementById("filter-action").value = "";
            document.getElementById("filter-user").value = "";
            renderAuditTable();
        });
    }

    // Exponer funciones al scope global para los onclick del HTML
    window.createNewUser = createNewUser;
    window.editUser = editUser;
    window.suspendUser = suspendUser;
    window.reactivateUser = reactivateUser;
    window.sendPasswordReset = sendPasswordReset;
    window.deleteUser = deleteUser;
}

if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", initOne);
} else {
    initOne();
}
