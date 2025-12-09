"use strict";

// ============================================================================
// GESTIÓN DE EMPLEADOS - JavaScript (Firestore Integrated)
// ============================================================================

// Auth y db se obtienen cuando están disponibles
function getAuth() { return window.auth; }
function getDb() { return window.db; }

// Canal de difusión para sincronizar con otras pestañas
const empleadosChannel = new BroadcastChannel("empleados_sync");

// Optimistic Loading
document.addEventListener("DOMContentLoaded", () => {
    const cachedRole = localStorage.getItem("userRole");
    if (cachedRole === "superadmin") {
        const liRegistros = document.getElementById("li-registros");
        const liUsuarios = document.getElementById("li-usuarios");
        if (liRegistros) liRegistros.style.display = "block";
        if (liUsuarios) liUsuarios.style.display = "block";
        document.body.classList.add("is-admin");
    } else if (cachedRole === "admin") {
        document.body.classList.add("is-admin");
    }
});

// Lista de empleados por defecto (fallback)
const EMPLEADOS_DEFAULT = [
    { nombre: "Sergio Castillo" },
    { nombre: "Ignacio Aburto" },
    { nombre: "Claudio Bustamante" },
    { nombre: "Julio Oliva" },
    { nombre: "Gabriel Trujillo" }
];

// ============================================================================
// FUNCIONES DE ALMACENAMIENTO (FIRESTORE)
// ============================================================================

async function cargarEmpleados() {
    try {
        const db = getDb();
        if (!db) throw new Error("Firestore no inicializado");

        const doc = await db.collection("Config").doc("empleados_noc").get();
        if (doc.exists) {
            const data = doc.data();
            if (data.lista && Array.isArray(data.lista)) {
                return data.lista;
            }
        }
    } catch (error) {
        console.error("Error al cargar empleados de Firestore:", error);
        // Intentar fallback a localStorage si falla Firestore
        const stored = localStorage.getItem("noc_empleados_list");
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) { console.error("Error parsing localStorage:", e); }
        }
    }
    return EMPLEADOS_DEFAULT;
}

async function guardarEmpleados(lista) {
    try {
        const db = getDb();
        if (!db) throw new Error("Firestore no inicializado");

        // 1. Guardar en Firestore
        await db.collection("Config").doc("empleados_noc").set({ lista: lista });

        // 2. Actualizar localStorage como caché/backup
        localStorage.setItem("noc_empleados_list", JSON.stringify(lista));

        // 3. Notificar a otras pestañas
        empleadosChannel.postMessage({ type: "empleados_updated", data: lista });

        return true;
    } catch (error) {
        console.error("Error al guardar empleados en Firestore:", error);
        Swal.fire({
            icon: "error",
            title: "Error de conexión",
            text: "No se pudieron guardar los cambios en la base de datos. Verifique su conexión."
        });
        return false;
    }
}

// ============================================================================
// FUNCIONES DE RENDERIZADO
// ============================================================================

// Función para escapar HTML y prevenir XSS
function escapeHtml(text) {
    if (!text) return text;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function renderTablaEmpleados() {
    const tbody = document.getElementById("tbodyEmpleados");
    if (!tbody) return;

    // Mostrar estado de carga (opcional, o simplemente esperar)
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Cargando empleados...</td></tr>';

    const empleados = await cargarEmpleados();

    if (empleados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">No hay empleados registrados.</td></tr>';
        return;
    }

    tbody.innerHTML = empleados.map((emp, index) => {
        const posicion = index + 1;
        const tienePrivilegios = posicion <= 2;
        const nombreSeguro = escapeHtml(emp.nombre); // Sanitizar nombre

        return `
      <tr data-index="${index}">
        <td>
          <span class="posicion-numero ${tienePrivilegios ? 'privilegiado' : ''}">${posicion}</span>
        </td>
        <td>${nombreSeguro}</td>
        <td>
          <span class="privilegios-badge ${tienePrivilegios ? 'activo' : 'inactivo'}">
            ${tienePrivilegios ? '✓ DL + Feriados' : '— Sin privilegios'}
          </span>
        </td>
        <td>
          <div class="acciones-cell">
            ${index > 0 ? `<button class="btn-accion subir" onclick="moverEmpleado(${index}, -1)" title="Subir posición"><i data-lucide="arrow-up"></i></button>` : ''}
            ${index < empleados.length - 1 ? `<button class="btn-accion bajar" onclick="moverEmpleado(${index}, 1)" title="Bajar posición"><i data-lucide="arrow-down"></i></button>` : ''}
            <button class="btn-accion editar" onclick="editarEmpleado(${index})" title="Editar"><i data-lucide="pencil"></i></button>
            <button class="btn-accion eliminar" onclick="eliminarEmpleado(${index})" title="Eliminar"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>
    `;
    }).join("");

    // Recrear iconos de Lucide
    lucide.createIcons();
}

// ============================================================================
// FUNCIONES CRUD
// ============================================================================

function agregarEmpleado() {
    Swal.fire({
        title: "Agregar Empleado",
        input: "text",
        inputLabel: "Nombre del empleado",
        inputPlaceholder: "Ej: Juan Pérez",
        showCancelButton: true,
        confirmButtonText: "Agregar",
        cancelButtonText: "Cancelar",
        inputValidator: (value) => {
            if (!value || value.trim() === "") {
                return "Debes ingresar un nombre";
            }
        }
    }).then(async (result) => {
        if (result.isConfirmed && result.value) {
            Swal.fire({ title: 'Guardando...', didOpen: () => Swal.showLoading() });

            const empleados = await cargarEmpleados();
            empleados.push({ nombre: result.value.trim() });

            const success = await guardarEmpleados(empleados);
            if (success) {
                await renderTablaEmpleados();
                Swal.fire({
                    icon: "success",
                    title: "Empleado agregado",
                    text: `${result.value.trim()} ha sido agregado exitosamente.`,
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        }
    });
}

async function editarEmpleado(index) {
    const empleados = await cargarEmpleados();
    const empleado = empleados[index];

    if (!empleado) return;

    Swal.fire({
        title: "Editar Empleado",
        input: "text",
        inputLabel: "Nombre del empleado",
        inputValue: empleado.nombre,
        showCancelButton: true,
        confirmButtonText: "Guardar",
        cancelButtonText: "Cancelar",
        inputValidator: (value) => {
            if (!value || value.trim() === "") {
                return "Debes ingresar un nombre";
            }
        }
    }).then(async (result) => {
        if (result.isConfirmed && result.value) {
            Swal.fire({ title: 'Actualizando...', didOpen: () => Swal.showLoading() });

            empleados[index].nombre = result.value.trim();
            const success = await guardarEmpleados(empleados);

            if (success) {
                await renderTablaEmpleados();
                Swal.fire({
                    icon: "success",
                    title: "Empleado actualizado",
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        }
    });
}

async function eliminarEmpleado(index) {
    const empleados = await cargarEmpleados();
    const empleado = empleados[index];

    if (!empleado) return;

    Swal.fire({
        title: "¿Eliminar empleado?",
        html: `¿Estás seguro de eliminar a "<b>${empleado.nombre}</b>"?<br><br>
               <div style="background-color: #fee2e2; color: #991b1b; padding: 10px; border-radius: 6px; font-size: 0.9em;">
                   <strong>⚠️ ADVERTENCIA CRÍTICA:</strong><br>
                   Esta acción eliminará permanentemente todos los turnos asignados a este empleado en el calendario.<br>
                   <strong>No se puede deshacer.</strong>
               </div>`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, eliminar y borrar turnos",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#d33"
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'Eliminando...', didOpen: () => Swal.showLoading() });

            empleados.splice(index, 1);
            const success = await guardarEmpleados(empleados);

            if (success) {
                await renderTablaEmpleados();
                Swal.fire({
                    icon: "success",
                    title: "Empleado eliminado",
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        }
    });
}

async function moverEmpleado(index, direction) {
    Swal.fire({ title: 'Moviendo...', didOpen: () => Swal.showLoading(), showConfirmButton: false, allowOutsideClick: false });

    const empleados = await cargarEmpleados();
    const newIndex = index + direction;

    if (newIndex < 0 || newIndex >= empleados.length) {
        Swal.close();
        return;
    }

    // Intercambiar posiciones
    const temp = empleados[index];
    empleados[index] = empleados[newIndex];
    empleados[newIndex] = temp;

    const success = await guardarEmpleados(empleados);
    if (success) {
        await renderTablaEmpleados();
        Swal.close();
    }
}

// ============================================================================
// CONFIGURACIÓN DE PÁGINA
// ============================================================================

function configurarSidebar() {
    const sidebar = document.getElementById("sidebar");
    const mainContent = document.getElementById("main-content");
    const menuToggleBtns = document.querySelectorAll("#menu-toggle");

    if (!sidebar || !mainContent || menuToggleBtns.length === 0) {
        console.error("No se encontró el sidebar o main content.");
        return;
    }

    menuToggleBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            sidebar.classList.toggle("expanded");
            mainContent.classList.toggle("expanded");
        });
    });
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

function verificarAcceso() {
    getAuth().onAuthStateChanged((user) => {
        if (!user) {
            window.location.href = "login.html";
            return;
        }

        getDb().collection("userRoles").doc(user.uid).get()
            .then((doc) => {
                if (doc.exists) {
                    const data = doc.data();
                    const isAdmin = data.rol === "admin";
                    const isSuperAdmin = data.rol === "superadmin";

                    if (!isAdmin && !isSuperAdmin) {
                        Swal.fire({
                            icon: "error",
                            title: "Acceso denegado",
                            text: "No tienes permisos para acceder a esta página."
                        }).then(() => {
                            window.location.href = "index.html";
                        });
                        return;
                    }

                    document.body.classList.add("is-admin");

                    // Mostrar Registros y Usuarios para superadmin
                    if (isSuperAdmin) {
                        const liRegistros = document.getElementById("li-registros");
                        const liUsuarios = document.getElementById("li-usuarios");
                        const liAnimaciones = document.getElementById("li-animaciones");
                        if (liRegistros) liRegistros.style.display = "block";
                        if (liUsuarios) liUsuarios.style.display = "block";
                        if (liAnimaciones) liAnimaciones.style.display = "block";
                    }

                    // Renderizar tabla
                    renderTablaEmpleados();

                } else {
                    window.location.href = "index.html";
                }
            })
            .catch((error) => {
                console.error("Error al verificar rol:", error);
                window.location.href = "index.html";
            });
    });
}

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

document.addEventListener("DOMContentLoaded", function () {
    configurarSidebar();
    configurarLogout();
    verificarAcceso();

    // Botón agregar empleado
    const btnAgregar = document.getElementById("btnAgregarEmpleado");
    if (btnAgregar) {
        btnAgregar.addEventListener("click", agregarEmpleado);
    }

    // Exponer funciones al scope global para los onclick del HTML
    window.moverEmpleado = moverEmpleado;
    window.editarEmpleado = editarEmpleado;
    window.eliminarEmpleado = eliminarEmpleado;
});
