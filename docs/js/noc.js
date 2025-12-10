"use strict";

// import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://jmrzvajipfdqvzilqjvq.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imptcnp2YWppcGZkcXZ6aWxxanZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg3ODU3MTksImV4cCI6MjA1NDM2MTcxOX0.xQZX2i-6wynnRnEKBb_mwbt63S6vvrr10SilIyug5Mg";
let supabase = null;
/*
try {
  supabase = createClient(supabaseUrl, supabaseKey);
} catch (e) {
  console.error("Supabase initialization failed:", e);
}
*/

// Auth and DB - will be populated after Firebase loads
let auth = window.auth;
let db = window.db;

// Delayed Firebase check - wait up to 5 seconds before showing error
let firebaseCheckAttempts = 0;
const maxFirebaseAttempts = 50; // 50 * 100ms = 5 seconds

function checkFirebaseAvailability() {
  firebaseCheckAttempts++;
  auth = window.auth;
  db = window.db;

  if (auth && db) {
    console.log("[NOC] Firebase disponible después de", firebaseCheckAttempts, "intentos");
    return; // Firebase ready, no error needed
  }

  if (firebaseCheckAttempts < maxFirebaseAttempts) {
    setTimeout(checkFirebaseAvailability, 100);
  } else {
    // Only show error after all attempts exhausted
    console.error("Firebase auth/db not initialized after timeout.");
    Swal.fire({
      icon: "error",
      title: "Error de Carga",
      text: "No se pudo conectar con el sistema de autenticación. Por favor, deshabilita extensiones de privacidad/bloqueo de anuncios y recarga la página.",
      footer: "Detalle técnico: Firebase no inicializado."
    });
  }
}

// Start checking after DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  checkFirebaseAvailability();
});

let usuarioEsAdmin = false;
let currentDate = new Date();
let selectedDays = [];
let isMonthLocked = false; // Estado de bloqueo del mes
const vacationIcon = `<i data-lucide="tree-palm"></i>`;

// Lista de feriados y su información
// Lista de feriados y su información (Dinámica)
let feriadosChile = [];
let feriadosInfo = {};

// Feriados por defecto para inicialización (Backup)
const FERIADOS_DEFAULT = [
  { fecha: "2025-01-01", nombre: "Año Nuevo" },
  { fecha: "2025-04-18", nombre: "Viernes Santo" },
  { fecha: "2025-04-19", nombre: "Sábado Santo" },
  { fecha: "2025-05-01", nombre: "Día del Trabajador" },
  { fecha: "2025-05-21", nombre: "Glorias Navales" },
  { fecha: "2025-06-20", nombre: "Dia Nacional de los Pueblos Indigenas" },
  { fecha: "2025-06-29", nombre: "San Pedro y San Pablo" },
  { fecha: "2025-07-16", nombre: "Virgen del Carmen" },
  { fecha: "2025-08-15", nombre: "Asunción de la Virgen" },
  { fecha: "2025-09-18", nombre: "Fiestas Patrias" },
  { fecha: "2025-09-19", nombre: "Glorias del Ejército" },
  { fecha: "2025-10-12", nombre: "Encuentro de Dos Mundos" },
  { fecha: "2025-10-31", nombre: "Día Iglesias Evangélicas" },
  { fecha: "2025-11-01", nombre: "Día de Todos los Santos" },
  { fecha: "2025-11-16", nombre: "Elecciones Presidenciales y Parlamentarias Irrenunciable" },
  { fecha: "2025-12-08", nombre: "Inmaculada Concepción" },
  { fecha: "2025-12-14", nombre: "Elecciones Presidenciales (Segunda Vuelta) Irrenunciable" },
  { fecha: "2025-12-25", nombre: "Navidad" },
  // 2026
  { fecha: "2026-01-01", nombre: "Año Nuevo" },
  { fecha: "2026-04-03", nombre: "Viernes Santo" },
  { fecha: "2026-04-04", nombre: "Sábado Santo" },
  { fecha: "2026-05-01", nombre: "Día del Trabajador" },
  { fecha: "2026-05-21", nombre: "Glorias Navales" },
  { fecha: "2026-06-20", nombre: "Día Nacional de los Pueblos Indígenas" },
  { fecha: "2026-06-29", nombre: "San Pedro y San Pablo" },
  { fecha: "2026-07-16", nombre: "Virgen del Carmen" },
  { fecha: "2026-08-15", nombre: "Asunción de la Virgen" },
  { fecha: "2026-09-18", nombre: "Fiestas Patrias" },
  { fecha: "2026-09-19", nombre: "Glorias del Ejército" },
  { fecha: "2026-10-12", nombre: "Encuentro de Dos Mundos" },
  { fecha: "2026-10-31", nombre: "Día Iglesias Evangélicas" },
  { fecha: "2026-11-01", nombre: "Día de Todos los Santos" },
  { fecha: "2026-12-08", nombre: "Inmaculada Concepción" },
  { fecha: "2026-12-25", nombre: "Navidad" },
  // 2027
  { fecha: "2027-01-01", nombre: "Año Nuevo" },
  { fecha: "2027-03-26", nombre: "Viernes Santo" },
  { fecha: "2027-03-27", nombre: "Sábado Santo" },
  { fecha: "2027-05-01", nombre: "Día del Trabajador" },
  { fecha: "2027-05-21", nombre: "Glorias Navales" },
  { fecha: "2027-06-20", nombre: "Día Nacional de los Pueblos Indígenas" },
  { fecha: "2027-06-29", nombre: "San Pedro y San Pablo" },
  { fecha: "2027-07-16", nombre: "Virgen del Carmen" },
  { fecha: "2027-08-15", nombre: "Asunción de la Virgen" },
  { fecha: "2027-09-18", nombre: "Fiestas Patrias" },
  { fecha: "2027-09-19", nombre: "Glorias del Ejército" },
  { fecha: "2027-10-12", nombre: "Encuentro de Dos Mundos" },
  { fecha: "2027-10-31", nombre: "Día Iglesias Evangélicas" },
  { fecha: "2027-11-01", nombre: "Día de Todos los Santos" },
  { fecha: "2027-12-08", nombre: "Inmaculada Concepción" },
  { fecha: "2027-12-25", nombre: "Navidad" }
];

async function cargarFeriados() {
  try {
    const doc = await db.collection("Config").doc("feriados").get();
    if (doc.exists) {
      const data = doc.data();
      if (data.lista && Array.isArray(data.lista)) {
        let listaFirestore = data.lista;

        // Verificar si faltan feriados nuevos (ej. 2027) y agregarlos
        let huboCambios = false;
        const fechasExistentes = new Set(listaFirestore.map(f => f.fecha));

        FERIADOS_DEFAULT.forEach(def => {
          if (!fechasExistentes.has(def.fecha)) {
            listaFirestore.push(def);
            fechasExistentes.add(def.fecha);
            huboCambios = true;
          }
        });

        if (huboCambios) {
          console.log("Actualizando feriados en Firestore con nuevos años...");
          // Ordenar por fecha
          listaFirestore.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
          await db.collection("Config").doc("feriados").set({ lista: listaFirestore });
        }

        // Procesar lista final
        feriadosChile = listaFirestore.map(f => f.fecha);
        feriadosInfo = {};
        listaFirestore.forEach(f => {
          feriadosInfo[f.fecha] = f.nombre;
        });
        console.log("Feriados cargados (y actualizados) desde Firestore");
        return;
      }
    }

    // Si no existen, subirlos (Migración inicial)
    console.log("Inicializando feriados en Firestore...");
    await db.collection("Config").doc("feriados").set({ lista: FERIADOS_DEFAULT });

    // Usar defaults
    feriadosChile = FERIADOS_DEFAULT.map(f => f.fecha);
    feriadosInfo = {};
    FERIADOS_DEFAULT.forEach(f => {
      feriadosInfo[f.fecha] = f.nombre;
    });

  } catch (error) {
    console.error("Error cargando feriados:", error);
    // Fallback a defaults en memoria
    feriadosChile = FERIADOS_DEFAULT.map(f => f.fecha);
    feriadosInfo = {};
    FERIADOS_DEFAULT.forEach(f => {
      feriadosInfo[f.fecha] = f.nombre;
    });
  }
}

// Lista de empleados - se carga desde Firestore
let empleados = [];

// CONSTANTES DE EMPLEADOS (Para sync con directorio)
const DEFAULT_EMPLOYEES_NAMES = [
  "Sergio Castillo",
  "Ignacio Aburto",
  "Claudio Bustamante",
  "Julio Oliva",
  "Gabriel Trujillo",
  "Cristian Oyarzo" // Added missing employee
];

async function cargarEmpleadosDeFirestore() {
  // Critical Fix: Wait for DB if not ready
  if (!db) {
    if (window.db) db = window.db; // Try to grab from global
    else {
      console.warn("[NOC] DB no lista al cargar empleados. Se reintentará en el ciclo de sincronización.");
      return []; // Return empty, will be retired by main sync loop
    }
  }

  let loadedList = [];
  try {
    const doc = await db.collection("Config").doc("empleados_noc").get();
    if (doc.exists) {
      const data = doc.data();
      if (data.lista && Array.isArray(data.lista)) {
        loadedList = data.lista.map(e => ({
          nombre: e.nombre,
          tipoTurno: e.tipoTurno || "diurno", // Load tipoTurno field with fallback
          turnos: []
        }));
      }
    }
  } catch (error) {
    console.error("Error al cargar empleados de Firestore:", error);
  }

  // MERGE: Ensure all default employees exist
  DEFAULT_EMPLOYEES_NAMES.forEach(defName => {
    if (!loadedList.some(e => e.nombre === defName)) {
      console.log(`[NOC] Agregando empleado faltante al calendario: ${defName}`);
      loadedList.push({ nombre: defName, tipoTurno: "diurno", turnos: [] });
    }
  });

  return loadedList;
}

// Valores por defecto si falla (Used by catch block below, effectively unused now but kept for structure)
/*
  return [
    { nombre: "Sergio Castillo", turnos: [] },
    ...
  ];
*/

// -----------------------------------------------------------------------------
// CARGA OPTIMISTA (Mejora de Velocidad)
// -----------------------------------------------------------------------------
// 1. Inicializar con valores por defecto INMEDIATAMENTE
empleados = DEFAULT_EMPLOYEES_NAMES.map(name => ({ nombre: name, turnos: [] }));

if (!feriadosChile || feriadosChile.length === 0) {
  feriadosChile = FERIADOS_DEFAULT.map(f => f.fecha);
  feriadosInfo = {};
  FERIADOS_DEFAULT.forEach(f => { feriadosInfo[f.fecha] = f.nombre; });
}

// 2. Renderizar Calendario VISUALMENTE (usando caché de localStorage si existe)
// Esto hace que la tabla aparezca al instante, sin esperar a la red.
document.addEventListener('DOMContentLoaded', () => {
  // Solo si renderCalendar existe
  if (typeof renderCalendar === 'function') {
    console.log("[OPTIMIZACIÓN] Renderizado inicial optimista (sin esperar DB)");
    renderCalendar();
  }
});

// 3. Cargar datos reales en SEGUNDO PLANO (Background Sync)
console.log("[DEBUG] Iniciando sincronización en segundo plano...");
Promise.all([cargarEmpleadosDeFirestore(), cargarFeriados()]).then(([lista]) => {
  console.log("[DEBUG] Datos frescos cargados. Actualizando vista...");

  if (lista && lista.length > 0) {
    empleados = lista;
  }

  // Re-renderizar para aplicar feriados actualizados o nuevos empleados
  iniciarCalendario();

  // Disparar evento
  document.dispatchEvent(new CustomEvent('datosCargados'));

}).catch(err => {
  console.error("[DEBUG] Error en sincronización:", err);
  // No hacemos nada drástico, ya tenemos los defaults cargados
});

function iniciarCalendario() {
  console.log("[DEBUG] iniciarCalendario llamado");
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (typeof renderCalendar === 'function') renderCalendar();
    });
  } else {
    if (typeof renderCalendar === 'function') renderCalendar();
  }
}

// -----------------------------------------------------------------------------
// GLOBAL UI HELPER FUNCTIONS
// -----------------------------------------------------------------------------

// Fix text colors for shift buttons with background colors
function fixShiftTextColors() {
  const buttons = document.querySelectorAll("button.calendar-day");
  buttons.forEach(btn => {
    // Si tiene un color de fondo inline (asignado), poner texto negro
    if (btn.style.backgroundColor && btn.style.backgroundColor !== "") {
      btn.style.color = "#000";
    }
  });
}

// Update UI based on month lock state
function updateLockUI() {
  const lockIndicator = document.getElementById("lockedIndicator");
  const btnToggleLock = document.getElementById("btnToggleLock");

  // Mostrar botón de candado solo si es superadmin
  const cachedRole = localStorage.getItem("userRole");
  if (cachedRole === "superadmin") {
    if (btnToggleLock) {
      btnToggleLock.style.display = "inline-flex";
      btnToggleLock.innerHTML = isMonthLocked
        ? `<i data-lucide="unlock"></i> Abrir Mes`
        : `<i data-lucide="lock"></i> Cerrar Mes`;

      btnToggleLock.className = "btn-horarios superadmin-only";

      if (isMonthLocked) {
        btnToggleLock.style.backgroundColor = "#7796cb";
        btnToggleLock.style.color = "#fff";
      } else {
        btnToggleLock.style.backgroundColor = "#f39c12";
        btnToggleLock.style.color = "#fff";
      }
    }
  }

  if (isMonthLocked) {
    document.body.classList.add("locked-mode");
    if (lockIndicator) lockIndicator.style.display = "flex";
  } else {
    document.body.classList.remove("locked-mode");
    if (lockIndicator) lockIndicator.style.display = "none";
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Escuchar cambios de empleados desde otras pestañas
const empleadosChannel = new BroadcastChannel("empleados_sync");
empleadosChannel.onmessage = function (event) {
  if (event.data && event.data.type === "empleados_updated") {
    console.log("Empleados actualizados - recargando página");
    location.reload();
  }
};

const bitacoraEmployees = [
  "Sergio Castillo",
  "Ignacio Aburto",
  "Julio Oliva",
  "Carolina Gonzalez",
  "Gabriel Trujillo",
  "Claudio Bustamante"
];

// -----------------------------------------------------------------------------
// FUNCIONES PARA LOCALSTORAGE
// -----------------------------------------------------------------------------

// Obtiene una clave única para cada mes (ej: "calendar_2025-4")
function obtenerClaveMes(date) {
  // Se agrega prefijo v3 para invalidar caché anterior (fix ghost employees y estructura nocturno)
  return `calendar_v3_${date.getFullYear()}-${date.getMonth() + 1}`;
}

// Limpia claves antiguas de localStorage (v1 y v2) al cargar la página
function limpiarCacheAntiguo() {
  const keysToRemove = [];
  const keysToClean = [];

  // Iterar sobre todas las claves de localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    // Si la clave empieza con "calendar_v2_" o "calendar_" sin versión, la marcamos para borrar
    if (key && (key.startsWith("calendar_v2_") || (key.startsWith("calendar_") && !key.startsWith("calendar_v3_")))) {
      keysToRemove.push(key);
    }
    // Si es v3, validar y limpiar empleados eliminados
    else if (key && key.startsWith("calendar_v3_")) {
      keysToClean.push(key);
    }
  }

  // Eliminar las claves antiguas (v1/v2)
  keysToRemove.forEach(key => {
    console.log(`Limpiando cache antiguo: ${key}`);
    localStorage.removeItem(key);
  });

  if (keysToRemove.length > 0) {
    console.log(`Cache antiguo limpiado: ${keysToRemove.length} entradas removidas`);
  }

  // Limpiar empleados eliminados de las entradas v3
  const empleadosActuales = new Set(empleados.map(e => e.nombre));
  let empleadosEliminadosCount = 0;

  keysToClean.forEach(key => {
    try {
      const data = JSON.parse(localStorage.getItem(key));
      if (data && data.assignments) {
        let modified = false;

        // Filtrar empleados que ya no existen
        Object.keys(data.assignments).forEach(nombre => {
          if (!empleadosActuales.has(nombre)) {
            console.log(`Eliminando empleado del cache ${key}: ${nombre}`);
            delete data.assignments[nombre];
            modified = true;
            empleadosEliminadosCount++;
          }
        });

        // Guardar de vuelta solo si hubo cambios
        if (modified) {
          localStorage.setItem(key, JSON.stringify(data));
        }
      }
    } catch (e) {
      console.error(`Error limpiando cache v3 ${key}:`, e);
    }
  });

  if (empleadosEliminadosCount > 0) {
    console.log(`Empleados eliminados purgados del cache: ${empleadosEliminadosCount} entradas`);
  }
}

// Ejecutar limpieza al cargar el script
limpiarCacheAntiguo();

// Obtiene los datos actuales del calendario (HTML de las tablas)
function obtenerDatosCalendario() {
  const currentMonthElement = document.getElementById("current-month");
  const generalTable = document.getElementById("general-calendar");
  const nocturnoTable = document.getElementById("nocturno-calendar");
  const feriadosTable = document.getElementById("feriados-calendar");

  return {
    mes: currentMonthElement.textContent,
    generalHTML: generalTable ? generalTable.outerHTML : "",
    nocturnoHTML: nocturnoTable ? nocturnoTable.outerHTML : "",
    feriadosHTML: feriadosTable ? feriadosTable.outerHTML : "",
    locked: isMonthLocked // Preservar estado
  };
}

// Guarda en localStorage el estado actual del calendario (Solo datos, no HTML)
function guardarCalendarioEnLocalStorage() {
  const key = obtenerClaveMes(currentDate);
  const currentMonthElement = document.getElementById("current-month");

  const datos = {
    mes: currentMonthElement.textContent,
    assignments: {}, // { "Nombre Empleado": { "1": "M", "2": "N" } }
    nocturno: {},    // { "1": "N" }
    feriados: {}     // { "1": "F" }
  };

  // 1. General Calendar
  const generalTable = document.getElementById("general-calendar");
  if (generalTable) {
    generalTable.querySelectorAll("tbody tr").forEach(row => {
      const nameCell = row.querySelector("td:first-child");
      if (!nameCell) return;
      // Limpiar nombre (quitar "(Ex)" si existe)
      const name = nameCell.textContent.replace(/\s*\(Ex\)\s*$/, "").trim();
      if (name === "Encargado de Bitácora") return;

      const shifts = {};
      row.querySelectorAll("button.calendar-day").forEach(btn => {
        const day = btn.getAttribute("data-day");
        let shift = btn.textContent.trim();
        // Detectar vacaciones por el icono
        if (btn.querySelector('[data-lucide="tree-palm"]') || btn.querySelector('svg.lucide-tree-palm')) {
          shift = "V";
        }
        if (shift) shifts[day] = shift;
      });

      if (Object.keys(shifts).length > 0) {
        datos.assignments[name] = shifts;
      }
    });
  }

  // 2. Nocturno Calendar
  const nocturnoTable = document.getElementById("nocturno-calendar");
  if (nocturnoTable) {
    nocturnoTable.querySelectorAll("button.calendar-day").forEach(btn => {
      const day = btn.getAttribute("data-day");
      let shift = btn.textContent.trim();
      if (shift) datos.nocturno[day] = shift;
    });
  }

  // 3. Feriados Calendar
  const feriadosTable = document.getElementById("feriados-calendar");
  if (feriadosTable) {
    feriadosTable.querySelectorAll("button.calendar-day").forEach(btn => {
      const day = btn.getAttribute("data-day");
      let shift = btn.textContent.trim();
      if (shift) datos.feriados[day] = shift;
    });
  }

  // 4. Preservar estado de bloqueo
  datos.locked = isMonthLocked;

  localStorage.setItem(key, JSON.stringify(datos));
  console.log(`Calendario guardado en localStorage (formato JSON seguro) con la clave: ${key}`);
}

// -----------------------------------------------------------------------------
// 1) FUNCIONES DE CONFIGURACIÓN
// -----------------------------------------------------------------------------
function verificarRolUsuario(callback) {
  auth.onAuthStateChanged((user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    db.collection("userRoles").doc(user.uid).get()
      .then((doc) => {
        if (doc.exists) {
          const data = doc.data();
          const role = data.rol;

          // Guardar en caché para optimización
          localStorage.setItem("userRole", role);

          const isAdmin = role === "admin";
          const isSuperAdmin = role === "superadmin";

          // Mostrar link de Registros y Usuarios para superadmins
          if (isSuperAdmin) {
            const liRegistros = document.getElementById("li-registros");
            if (liRegistros) {
              liRegistros.style.display = "block";
            }
            const liUsuarios = document.getElementById("li-usuarios");
            if (liUsuarios) {
              liUsuarios.style.display = "block";
            }
            const liAnimaciones = document.getElementById("li-animaciones");
            if (liAnimaciones) {
              liAnimaciones.style.display = "block";
            }
          }

          if (isAdmin || isSuperAdmin) {
            document.body.classList.add("is-admin");
          }

          callback(isAdmin || isSuperAdmin);
        } else {
          callback(false);
        }
      })
      .catch((error) => {
        console.error("Error al obtener rol:", error);
        callback(false);
      });
  });
}

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
  lucide.createIcons();
}

function configurarLogout() {
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      auth.signOut()
        .then(() => {
          localStorage.removeItem('userRole');
          window.location.href = "login.html";
        })
        .catch((error) => { console.error("Error al cerrar sesión:", error); });
    });
  }
}

// -----------------------------------------------------------------------------
// 2) LÓGICA DEL CALENDARIO
// -----------------------------------------------------------------------------
function asignarDomingosLibres(year, month, daysInMonth) {
  empleados.forEach((empleado) => {
    empleado.turnos = Array(daysInMonth).fill("");
    if (empleado.nombre === "Sergio Castillo" || empleado.nombre === "Ignacio Aburto") {
      for (let day = 1; day <= daysInMonth; day++) {
        const fecha = new Date(year, month, day);
        if (fecha.getDay() === 0) {
          empleado.turnos[day - 1] = "DL";
        }
      }
    }
  });
}

// Sincroniza la tabla del calendario con la lista actual de empleados
function sincronizarTablasConEmpleados() {
  const tablaGeneral = document.getElementById("general-calendar");
  if (!tablaGeneral) return;

  const tbody = tablaGeneral.querySelector("tbody");
  if (!tbody) return;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // 1. Obtener filas existentes mapeadas por nombre
  const existingRows = {};
  let bitacoraRowHTML = "";

  tbody.querySelectorAll("tr").forEach(row => {
    const firstCell = row.querySelector("td");
    if (firstCell) {
      const name = firstCell.textContent.trim();
      if (name === "Encargado de Bitácora") {
        bitacoraRowHTML = row.outerHTML;
      } else {
        existingRows[name] = row.outerHTML;
      }
    }
  });

  // 2. Reconstruir el cuerpo de la tabla
  let newBodyHTML = "";

  empleados.forEach((empleado, index) => {
    // FILTRO: Solo empleados DIURNOS en el calendario general
    // Empleados nocturnos aparecen en el calendario nocturno
    const tipoTurno = empleado.tipoTurno || "diurno"; // Default diurno para migración
    if (tipoTurno === "nocturno") {
      console.log(`[SYNC] Saltando empleado nocturno: ${empleado.nombre}`);
      return; // Skip nocturno employees
    }

    if (existingRows[empleado.nombre]) {
      // Si ya existe, usamos la fila guardada (preserva los turnos)
      newBodyHTML += existingRows[empleado.nombre];
      delete existingRows[empleado.nombre]; // Lo marcamos como usado
    } else {
      // Si es nuevo, generamos una fila vacía
      let rowHTML = `<tr><td class="text-left p-2">${empleado.nombre}</td>`;
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const fecha = new Date(year, month, day);
        const esDomingo = fecha.getDay() === 0;
        const esFeriado = feriadosChile.includes(dateStr);

        let turno = "";
        // Asignar DL por defecto solo a empleados privilegiados específicos
        const esPrivilegiado = empleado.nombre === "Sergio Castillo" || empleado.nombre === "Ignacio Aburto";

        if (esPrivilegiado && esDomingo) {
          turno = "DL";
        }

        let extraClass = turno === "DL" ? "domingo-libre" : "";
        // Solo agregar clase feriado a empleados privilegiados
        if (esFeriado && esPrivilegiado) extraClass += " feriado";

        rowHTML += `
          <td>
            <button
              data-date="${dateStr}"
              data-empleado="${empleado.nombre}"
              data-day="${day}"
              class="calendar-day w-full h-full ${extraClass}"
            >
              ${turno}
            </button>
          </td>
        `;
      }
      rowHTML += "</tr>";
      newBodyHTML += rowHTML;
    }
  });

  // B) Luego revisamos las filas sobrantes (empleados eliminados)
  // LAS ELIMINAMOS completamente para que no aparezcan 'fantasmas'
  for (const [nombre, html] of Object.entries(existingRows)) {
    // No hacemos nada, simplemente no las agregamos a newBodyHTML.
    // Esto elimina visualmente al empleado de la tabla.
    console.log(`Eliminando fila de empleado inactivo/borrado: ${nombre}`);
  }

  // 3. Agregar fila de bitácora al final
  if (bitacoraRowHTML) {
    newBodyHTML += bitacoraRowHTML;
  } else {
    // Si no existía (caso raro), la regeneramos
    const totalCols = daysInMonth + 1;
    const bitacoraIndex = ((month - 1) + bitacoraEmployees.length) % bitacoraEmployees.length;
    const bitacoraEmpleado = bitacoraEmployees[bitacoraIndex];
    newBodyHTML += `
      <tr>
        <td class="bitacora-row" style="white-space:nowrap;">Encargado de Bitácora</td>
        <td class="bitacora-row" colspan="${totalCols - 1}" style="text-align:center;">
          ${bitacoraEmpleado}
        </td>
      </tr>
    `;
  }

  tbody.innerHTML = newBodyHTML;
}

// Sincroniza la tabla del calendario NOCTURNO con empleados nocturnos
function sincronizarCalendarioNocturno() {
  const tablaNocturno = document.getElementById("nocturno-calendar");
  if (!tablaNocturno) return;

  const tbody = tablaNocturno.querySelector("tbody");
  if (!tbody) return;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // 1. Obtener filas existentes
  const existingRows = {};
  tbody.querySelectorAll("tr").forEach(row => {
    const firstCell = row.querySelector("td");
    if (firstCell) {
      const name = firstCell.textContent.trim();
      existingRows[name] = row.outerHTML;
    }
  });

  // 2. Reconstruir tabla con empleados nocturnos
  let newBodyHTML = "";
  const empleadosNocturnos = empleados.filter(emp => (emp.tipoTurno || "diurno") === "nocturno");

  empleadosNocturnos.forEach((empleado) => {
    if (existingRows[empleado.nombre]) {
      newBodyHTML += existingRows[empleado.nombre];
      delete existingRows[empleado.nombre];
    } else {
      // Generar fila nueva con turnos por defecto
      let rowHTML = `<tr><td class="text-left p-2">${empleado.nombre}</td>`;
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const fecha = new Date(year, month, day);
        const esFeriado = feriadosChile.includes(dateStr);
        const dayOfWeek = fecha.getDay();

        let turno = "", turnoClass = "";
        if (esFeriado) { turno = "F"; turnoClass = "feriado"; }
        else if (dayOfWeek === 0) { turno = "DL"; turnoClass = "domingo-libre"; }
        else if (dayOfWeek === 6) { turno = "L"; turnoClass = "dia-libre"; }
        else { turno = "N"; turnoClass = "nocturno"; }

        rowHTML += `<td><button data-date="${dateStr}" data-empleado="${empleado.nombre}" data-day="${day}" class="calendar-day w-full h-full ${turnoClass}">${turno}</button></td>`;
      }
      rowHTML += "</tr>";
      newBodyHTML += rowHTML;
    }
  });

  tbody.innerHTML = newBodyHTML;
}


// Renderiza el calendario. Primero intenta cargar datos guardados en localStorage;
// si no existen o están incompletos, se construye desde cero.
// Renderiza el calendario. Primero intenta cargar datos guardados en localStorage;
// si no existen o están incompletos, se construye desde cero.
function renderCalendar(date = currentDate) {
  console.log("[DEBUG] renderCalendar llamado, date:", date);
  // Limpieza de basura visual
  const general = document.getElementById("general-calendar");
  if (general) {
    let prev = general.previousSibling;
    while (prev && (prev.nodeType === Node.TEXT_NODE || (prev.nodeType === Node.ELEMENT_NODE && prev.tagName === "BR"))) {
      const toRemove = prev;
      prev = prev.previousSibling;
      toRemove.remove();
    }
  }

  // IMPORTANTE: Resetear estado de bloqueo antes de cargar datos
  // Esto previene que el estado de un mes "se pegue" al navegar a otro mes
  isMonthLocked = false;

  // 1. Siempre renderizar base desde cero (asegura estructura limpia y actualizada)
  renderCalendarDesdeCero(date);

  const key = obtenerClaveMes(date);
  const storedData = localStorage.getItem(key);

  if (storedData) {
    try {
      const data = JSON.parse(storedData);

      // MIGRACIÓN: Si detectamos formato antiguo (HTML), migramos a JSON
      if (data.generalHTML) {
        console.log("Detectado formato antiguo. Migrando a JSON seguro...");
        migrarDatosAntiguos(key, data);
        return renderCalendar(date); // Re-renderizar con datos migrados
      }

      // 2. Aplicar asignaciones guardadas (JSON)
      if (data.assignments) {
        aplicarAsignaciones(data.assignments);
      }

      // 3. Aplicar nocturno y feriados
      if (data.nocturno) {
        aplicarAsignacionesSimples("nocturno-calendar", data.nocturno);
      }
      if (data.feriados) {
        aplicarAsignacionesSimples("feriados-calendar", data.feriados);
      }

      // 4. Restaurar estado de bloqueo
      if (data.hasOwnProperty('locked')) {
        isMonthLocked = !!data.locked;
        updateLockUI();
      }

    } catch (e) {
      console.error("Error leyendo localStorage:", e);
    }
  }

  // ELIMINADO: restaurarEmpleadosEliminados(data.assignments); ya no queremos recuperar empleados borrados.

  if (usuarioEsAdmin) { attachAdminCellListeners(); }
  lucide.createIcons();
  fixShiftTextColors();
  calcularHorasExtras(date);

  // 44-Hour Global Check on Load
  const generalRows = document.querySelectorAll("#general-calendar tbody tr");
  generalRows.forEach(row => checkWeeklyHours(row));

  // Actualizar UI de bloqueo al final (después de cargar estado desde localStorage)
  updateLockUI();
}

// Helper para migrar datos HTML a JSON
function migrarDatosAntiguos(key, oldData) {
  const parser = new DOMParser();
  const newData = {
    mes: oldData.mes,
    assignments: {},
    nocturno: {},
    feriados: {}
  };

  // Extraer General
  if (oldData.generalHTML) {
    const doc = parser.parseFromString(`<table>${oldData.generalHTML}</table>`, 'text/html');
    doc.querySelectorAll("tr").forEach(row => {
      const name = row.querySelector("td")?.textContent.trim();
      if (name && name !== "Encargado de Bitácora") {
        const shifts = {};
        row.querySelectorAll("button").forEach(btn => {
          const day = btn.getAttribute("data-day");
          let shift = btn.textContent.trim();
          if (btn.querySelector('svg') || btn.querySelector('i')) shift = "V";
          if (shift) shifts[day] = shift;
        });
        if (Object.keys(shifts).length > 0) newData.assignments[name] = shifts;
      }
    });
  }

  // Guardar nuevo formato
  localStorage.setItem(key, JSON.stringify(newData));
}

// Helper para aplicar asignaciones al DOM
function aplicarAsignaciones(assignments) {
  const table = document.getElementById("general-calendar");
  if (!table) return;

  // Crear lista de nombres de empleados actuales para validación
  const empleadosActuales = new Set(empleados.map(e => e.nombre));

  Object.entries(assignments).forEach(([name, shifts]) => {
    // VALIDACIÓN: Solo aplicar si el empleado existe actualmente
    if (!empleadosActuales.has(name)) {
      console.log(`Ignorando empleado eliminado del cache: ${name}`);
      return; // Skip este empleado
    }

    // Buscar fila del empleado
    const row = Array.from(table.querySelectorAll("tbody tr")).find(tr =>
      tr.querySelector("td")?.textContent.trim() === name
    );

    if (row) {
      Object.entries(shifts).forEach(([day, shift]) => {
        const btn = row.querySelector(`button[data-day="${day}"]`);
        if (btn) {
          actualizarBotonTurno(btn, shift);
        }
      });
    }
  });
}

// Helper para aplicar asignaciones simples (Nocturno/Feriados)
function aplicarAsignacionesSimples(tableId, shifts) {
  const table = document.getElementById(tableId);
  if (!table) return;

  Object.entries(shifts).forEach(([day, shift]) => {
    const btn = table.querySelector(`button[data-day="${day}"]`);
    if (btn) {
      actualizarBotonTurno(btn, shift);
    }
  });
}

// Helper para actualizar visualmente un botón
function actualizarBotonTurno(btn, shift) {
  btn.textContent = shift === "V" ? "" : shift;

  // Mapa de colores hardcoded (Fallback robusto)
  const DEFAULT_COLORS = {
    "M0": "#648c9b", "M0A": "#7b69a5", "M1": "#557a5f", "M1A": "#c49f87",
    "M1B": "#ffaaa5", "M2": "#ffcc99", "M2A": "#d4a5a5", "M2B": "#b5e7a0",
    "M3": "#996a7f", "V": "#88C0A6", "L": "#8FBCBB", "DL": "#D77A7A",
    "N": "#cccccc", "S": "#4A90E2", "I": "#2C3E50"
  };

  // Construir mapa de colores dinámicamente si no existe
  if (!window.SHIFT_COLORS) {
    window.SHIFT_COLORS = { ...DEFAULT_COLORS };
    document.querySelectorAll('.btn-turno').forEach(b => {
      const t = b.getAttribute('data-turno');
      const c = b.getAttribute('data-color');
      if (t && c) window.SHIFT_COLORS[t] = c;
    });
    console.log("[NOC] Color Map Built:", window.SHIFT_COLORS);
  }

  // Detect context: Is this the Night Shift Calendar?
  const isNocturno = btn.closest('#nocturno-calendar');

  if (shift === "V") {
    btn.innerHTML = '<i data-lucide="tree-palm"></i>';
    btn.style.backgroundColor = window.SHIFT_COLORS["V"];
    btn.style.color = "#000";
    btn.setAttribute("title", "Vacaciones");
  } else {
    // Reset basic style
    btn.removeAttribute("style");
    btn.removeAttribute("title");

    // Apply Color from Map ONLY if NOT Nocturno AND NOT DL/F (CSS handled)
    // Nocturno calendar relies on CSS classes for Dark Theme
    if (!isNocturno && shift !== "DL" && shift !== "F" && window.SHIFT_COLORS[shift]) {
      btn.style.backgroundColor = window.SHIFT_COLORS[shift];
      btn.style.color = "#000";
    }
  }

  // Reset clases
  btn.className = "calendar-day w-full h-full";

  // Aplicar clases según turno
  if (shift === "DL") {
    btn.classList.add("domingo-libre");
    // Let CSS handle the background/text color for DL (Dark Theme)
    btn.style.backgroundColor = "";
    btn.style.color = "";
  }
  else if (shift === "F") {
    btn.classList.add("feriado");
    btn.style.backgroundColor = ""; // Feriados gestionados por CSS
  }
  else if (shift === "N") btn.classList.add("nocturno");
  else if (shift === "L") {
    btn.classList.add("dia-libre");
    // Ensure L has color in General, but let CSS handle Nocturno
    if (!isNocturno) {
      btn.style.backgroundColor = window.SHIFT_COLORS["L"];
      btn.style.color = "#000";
    }
  }

  // Ensure text color logic runs for explicitly colored cells (M1, M2...)
  if (btn.style.backgroundColor) {
    btn.style.color = "#000";
  }

  // Real-time 44h Check
  const row = btn.closest("tr");
  if (row) {
    checkWeeklyHours(row);
  }
}

// -----------------------------------------------------------------------------
// 44-HOUR WEEK LOGIC
// -----------------------------------------------------------------------------
// EFFECTIVE work hours per shift (after subtracting 1h lunch break)
const SHIFT_HOURS = {
  "M0": 9, "M0A": 9,       // 10h - 1h = 9h
  "M1": 8, "M1A": 9, "M1B": 9,  // M1: 9h-1h=8h, others: 10h-1h=9h
  "M2": 8, "M2A": 9, "M2B": 9,  // M2: 9h-1h=8h, others: 10h-1h=9h
  "M3": 9,                 // 10h - 1h = 9h
  "N": 9,                  // Night Shift (10h - 1h)
  "S": 11, "I": 11,        // Weekend/Special (12h - 1h)
  "V": 0, "L": 0, "DL": 0, "F": 0  // No work
};

function checkWeeklyHours(row) {
  if (!row) return;
  const nameCell = row.querySelector("td:first-child");
  if (!nameCell) return;

  // Clear previous warnings
  const existingWarning = nameCell.querySelector(".warning-icon");
  if (existingWarning) existingWarning.remove();
  nameCell.classList.remove("text-warning");

  const buttons = row.querySelectorAll("button.calendar-day");
  if (buttons.length === 0) return;

  // Identify Employee for Logic Fork
  const employeeName = nameCell.textContent.trim();
  const isExcludedSunday = (employeeName === "Sergio Castillo" || employeeName === "Ignacio Aburto");

  // ROBUST: Read headers to determine day of week (LUN, MAR, etc)
  // This avoids desync between global currentDate and visible table
  const table = row.closest("table");
  const headers = table.querySelectorAll("thead th div:first-child"); // The name div (Lun, Mar...)
  // Headers index 0 is "Empleado". So day 1 is at index 1.

  let weeklySum = 0;
  let hasViolation = false;
  let violationWeeks = [];
  let currentWeekNumber = 1; // logical week counter

  buttons.forEach((btn, index) => {
    // Determine Day from Header text
    let dayName = "";
    // Header index starts at 0 for Day 1 because querySelectorAll skipped "Empleado" th
    if (headers[index]) {
      dayName = headers[index].textContent.trim().toLowerCase();
    }

    // Map Spanish short days to 0-6 (Sun-Sat)
    // headers are usually: 'lun.', 'mar.', 'mié.', 'jue.' ... or just 'lun', 'mar'
    let dayOfWeek = -1;
    if (dayName.includes("lun")) dayOfWeek = 1;
    else if (dayName.includes("mar")) dayOfWeek = 2;
    else if (dayName.includes("mié") || dayName.includes("mie")) dayOfWeek = 3;
    else if (dayName.includes("jue")) dayOfWeek = 4;
    else if (dayName.includes("vie")) dayOfWeek = 5;
    else if (dayName.includes("sáb") || dayName.includes("sab")) dayOfWeek = 6;
    else if (dayName.includes("dom")) dayOfWeek = 0;

    const shift = btn.textContent.trim();

    // Reset on Monday (Start of new week)
    if (dayOfWeek === 1) {
      if (weeklySum > 44) {
        hasViolation = true;
        violationWeeks.push(currentWeekNumber);
        console.log(`[44h Violation] ${employeeName} Week ${currentWeekNumber} Sum: ${weeklySum}`);
      }
      weeklySum = 0;
      currentWeekNumber++;
    }

    let hours = SHIFT_HOURS[shift] || 0;

    // RULE: Friday = -1 hour
    if (dayOfWeek === 5 && hours > 0) {
      hours -= 1;
    }

    // RULE: Saturday Specifics
    if (dayOfWeek === 6) {
      if (shift === "M1" || shift === "M2") {
        hours = 5; // Reduced Saturday hours
      }
    }

    // RULE: Employee Specific Sunday Exclusion
    if (dayOfWeek === 0 && isExcludedSunday) {
      hours = 0; // Sundays do not count
    }

    // Manual adjustments for specific known logic could go here
    weeklySum += hours;

    // Check Sunday (End of week) or Last Day of Month
    if (dayOfWeek === 0 || index === buttons.length - 1) {
      if (weeklySum > 44) {
        hasViolation = true;
        violationWeeks.push(currentWeekNumber); // Use currentWeekNumber
        console.log(`[44h Violation] ${employeeName} Week End Sum: ${weeklySum}`);
        weeklySum = 0;
      }
    }
  });

  if (hasViolation) {
    console.log(`[44h DEBUG] Adding warning icon for ${employeeName}. Weeks: ${violationWeeks.join(",")}`);
    const icon = document.createElement("span");
    icon.textContent = " ⚠️"; // Warning Icon
    icon.className = "warning-icon";
    icon.title = `Excede 44 hrs en semana(s): ${violationWeeks.join(", ")}`;
    icon.style.cssText = "cursor:help; margin-left:5px; color: #e74c3c; font-size: 1.2em;"; // Inline style backup
    nameCell.appendChild(icon);
    console.log(`[44h DEBUG] Icon appended. nameCell.innerHTML now:`, nameCell.innerHTML);
  }
}

// Helper para restaurar empleados eliminados (visualización histórica)
function restaurarEmpleadosEliminados(assignments) {
  if (!assignments) return;

  const table = document.getElementById("general-calendar");
  const tbody = table?.querySelector("tbody");
  if (!tbody) return;

  const currentNames = Array.from(tbody.querySelectorAll("tr td:first-child")).map(td => td.textContent.trim());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  Object.keys(assignments).forEach(name => {
    if (!currentNames.includes(name)) {
      // Empleado existe en historial pero no en lista actual -> Restaurar fila
      let rowHTML = `<tr><td class="text-left p-2" style="color:#ef4444; font-style:italic;">${name} <span style="font-size:0.8em; opacity:0.8;">(Ex)</span></td>`;

      for (let day = 1; day <= daysInMonth; day++) {
        const shift = assignments[name][day] || "";
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        let content = shift;
        if (shift === "V") content = '<i data-lucide="tree-palm"></i>';

        rowHTML += `
          <td>
            <button
              data-date="${dateStr}"
              data-empleado="${name}"
              data-day="${day}"
              class="calendar-day w-full h-full"
            >
              ${content}
            </button>
          </td>
        `;
      }
      rowHTML += "</tr>";

      // Insertar antes de la fila de bitácora
      const bitacoraRow = tbody.querySelector("tr:last-child");
      if (bitacoraRow) {
        bitacoraRow.insertAdjacentHTML('beforebegin', rowHTML);
      } else {
        tbody.insertAdjacentHTML('beforeend', rowHTML);
      }

      // Aplicar estilos a los botones recién creados
      const newRow = tbody.querySelector(`tr:nth-last-child(2)`); // La que acabamos de insertar
      if (newRow) {
        Object.entries(assignments[name]).forEach(([day, shift]) => {
          const btn = newRow.querySelector(`button[data-day="${day}"]`);
          if (btn) actualizarBotonTurno(btn, shift);
        });
      }
    }
  });
}

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

// Construye el calendario cuando no hay datos guardados
function renderCalendarDesdeCero(date) {
  const currentMonthElement = document.getElementById("current-month");

  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  currentMonthElement.textContent = `${firstDay.toLocaleString("default", {
    month: "long"
  })} ${year}`;

  const tablaGeneral = document.getElementById("general-calendar");
  const tablaNocturno = document.getElementById("nocturno-calendar");
  const tablaFeriados = document.getElementById("feriados-calendar");

  // ---------- CABECERAS (GENERAL, NOCTURNO Y FERIADOS) ----------
  function generarCabecera(tabla) {
    let headerHTML = '<tr><th class="text-left p-2">Empleado</th>';
    for (let day = 1; day <= daysInMonth; day++) {
      const fecha = new Date(year, month, day);
      const dayName = fecha.toLocaleString("default", { weekday: "short" });
      headerHTML += `<th><div>${dayName}</div><div>${day}</div></th>`;
    }
    headerHTML += "</tr>";

    if (tabla && tabla.querySelector("thead")) {
      tabla.querySelector("thead").innerHTML = headerHTML;
    } else {
      console.error("No se encontró la cabecera de la tabla");
    }
  }

  generarCabecera(tablaGeneral);
  generarCabecera(tablaNocturno);
  generarCabecera(tablaFeriados);

  // ---------- DOMINGOS LIBRES PARA GENERAL ----------
  asignarDomingosLibres(year, month, daysInMonth);

  // ---------- CUERPO CALENDARIO GENERAL ----------
  let generalHTML = "";
  empleados.forEach((empleado) => {
    // FILTRO: Solo empleados DIURNOS en calendario general
    const tipoTurno = empleado.tipoTurno || "diurno";
    if (tipoTurno === "nocturno") return;

    const nombreSeguro = escapeHtml(empleado.nombre);
    generalHTML += `<tr><td class="text-left p-2">${nombreSeguro}</td>`;
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;
      const esFeriado = feriadosChile.includes(dateStr);
      const turno = empleado.turnos[day - 1] || "";

      let displayTurno = turno;

      // Si es feriado y el turno está vacío, marcamos "F" solo para Sergio/Ignacio
      if (
        esFeriado &&
        turno === "" &&
        (empleado.nombre === "Sergio Castillo" ||
          empleado.nombre === "Ignacio Aburto")
      ) {
        displayTurno = "F";
      }

      const extraClass = turno === "DL" ? "domingo-libre" : "";
      const claseFeriado = displayTurno === "F" ? "feriado" : "";
      const cellContent = turno === "V" ? vacationIcon : displayTurno;

      generalHTML += `
        <td>
          <button
            data-date="${dateStr}"
            data-empleado="${nombreSeguro}"
            data-day="${day}"
            class="calendar-day w-full h-full ${extraClass} ${claseFeriado}"
            ${turno === "V" ? 'title="Vacaciones"' : ""}
          >
            ${cellContent}
          </button>
        </td>
      `;
    }
    generalHTML += `</tr>`;
  });

  // ---------- FILA BITÁCORA ----------
  const totalCols = daysInMonth + 1;
  const bitacoraIndex =
    ((month - 1) + bitacoraEmployees.length) % bitacoraEmployees.length;
  const bitacoraEmpleado = bitacoraEmployees[bitacoraIndex];

  generalHTML += `
    <tr>
      <td class="bitacora-row" style="white-space:nowrap;">Encargado de Bitácora</td>
      <td class="bitacora-row" colspan="${totalCols - 1}" style="text-align:center;">
        ${bitacoraEmpleado}
      </td>
    </tr>
  `;

  const tbodyGeneral = tablaGeneral.querySelector("tbody");
  if (tbodyGeneral) {
    tbodyGeneral.innerHTML = generalHTML;
  } else {
    console.error("No se encontró el tbody de la tabla general");
  }

  // ---------- CALENDARIO NOCTURNO (DINÁMICO - TODOS LOS EMPLEADOS NOCTURNOS) ----------
  let nocturnoHTML = "";

  // Filtrar solo empleados con tipoTurno === "nocturno"
  const empleadosNocturnos = empleados.filter(emp => {
    const tipo = emp.tipoTurno || "diurno";
    return tipo === "nocturno";
  });

  console.log(`[NOCTURNO] Empleados nocturnos encontrados: ${empleadosNocturnos.length}`, empleadosNocturnos.map(e => e.nombre));

  // Renderizar un TR por cada empleado nocturno
  empleadosNocturnos.forEach(empleado => {
    const turnos = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const fecha = new Date(year, month, day);
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const esFeriado = feriadosChile.includes(dateStr);
      const dayOfWeek = fecha.getDay();

      if (esFeriado) {
        turnos[day - 1] = "F";
      } else if (dayOfWeek === 0) {
        turnos[day - 1] = "DL";
      } else if (dayOfWeek === 6) {
        turnos[day - 1] = "L";
      } else {
        turnos[day - 1] = "N";
      }
    }

    nocturnoHTML += `<tr><td class="text-left p-2">${empleado.nombre}</td>`;
    for (let day = 1; day <= daysInMonth; day++) {
      const turno = turnos[day - 1];
      let turnoClass = "";

      if (turno === "DL") turnoClass = "domingo-libre";
      else if (turno === "L") turnoClass = "dia-libre";
      else if (turno === "N") turnoClass = "nocturno";

      const claseFeriado = turno === "F" ? "feriado" : "";
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      nocturnoHTML += `
        <td>
          <button 
            data-date="${dateStr}"
            data-empleado="${empleado.nombre}"
            data-day="${day}"
            class="calendar-day w-full h-full ${turnoClass} ${claseFeriado}">
            ${turno}
          </button>
        </td>
      `;
    }
    nocturnoHTML += `</tr>`;
  });

  const tbodyNocturno = tablaNocturno.querySelector("tbody");
  if (tbodyNocturno) {
    tbodyNocturno.innerHTML = nocturnoHTML;
  } else {
    console.error("No se encontró el tbody de la tabla nocturna");
  }

  // ---------- CALENDARIO FERIADOS / FINES DE SEMANA ----------
  // SOLO UNA FILA: "Turno Nocturno" para asignar S / I / N
  let feriadosHTML = `<tr><td class="text-left p-2">Turno Nocturno</td>`;

  for (let day = 1; day <= daysInMonth; day++) {
    const fecha = new Date(year, month, day);
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`;
    const dayOfWeek = fecha.getDay(); // 0=domingo, 6=sábado
    const esFeriado = feriadosChile.includes(dateStr);

    let clasesExtra = "";
    if (esFeriado) {
      clasesExtra += " feriado";
    } else if (dayOfWeek === 0) {
      clasesExtra += " domingo-libre";
    } else if (dayOfWeek === 6) {
      clasesExtra += " dia-libre";
    }

    // Celdas vacías al inicio; luego asignas S / I / N desde los botones
    feriadosHTML += `
      <td>
        <button
          data-date="${dateStr}"
          data-empleado="Turno Nocturno"
          data-day="${day}"
          class="calendar-day w-full h-full ${clasesExtra}">
        </button>
      </td>
    `;
  }

  feriadosHTML += `</tr>`;

  const tbodyFeriados = tablaFeriados.querySelector("tbody");
  if (tbodyFeriados) {
    tbodyFeriados.innerHTML = feriadosHTML;
  } else {
    console.error("No se encontró el tbody de la tabla de feriados");
  }

  // ---------- TÍTULOS A FERIADOS (SOLO SI LA CELDA TIENE "F") ----------
  document.querySelectorAll(".calendar-day").forEach((btn) => {
    if (btn.textContent.trim() === "F") {
      const dateStr = btn.getAttribute("data-date");
      if (feriadosChile.includes(dateStr)) {
        const nombreFeriado = feriadosInfo[dateStr] || "Feriado";
        btn.setAttribute("title", "Feriado: " + nombreFeriado);
      }
    }
  });

  if (usuarioEsAdmin) { attachAdminCellListeners(); }
  lucide.createIcons();

  // REMOVED: No auto-guardar al renderizar, solo cuando el usuario hace cambios
  // Esto previene sobrescribir estados de otros meses durante la navegación
  // guardarCalendarioEnLocalStorage();
}

function todosLosDiasRellenos() {
  // Solo validamos General y Nocturno (NO el calendario de feriados)
  const dayButtons = document.querySelectorAll(
    "#general-calendar .calendar-day, #nocturno-calendar .calendar-day"
  );

  for (let btn of dayButtons) {
    if (btn.innerHTML.trim() === "") {
      return false;
    }
  }
  return true;
}

// -----------------------------------------------------------------------------
// CALCULO DE HORAS EXTRAS
// -----------------------------------------------------------------------------
// Mapeo de Turnos a Empleados (Configurable)
// Mapeo de Turnos a Empleados (Configurable)
const SHIFT_MAP = {
  "S": "Sergio Castillo",
  "I": "Ignacio Aburto",
  "M": "Manuel (Demo)", // Ejemplo de escalabilidad
  "J": "Julio (Demo)"
};

// FACTOR LEGAL CHILENO (Jornada 45h)
const FACTOR_HORA_EXTRA = 0.0077777;

// Cache de salarios
let salariosCache = {};

// Cargar salarios desde Firestore (Solo Superadmin)
async function cargarSalarios() {
  try {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'superadmin') return {};

    const doc = await db.collection("Config").doc("salarios_noc").get();
    if (doc.exists) {
      salariosCache = doc.data();
      return salariosCache;
    }
  } catch (error) {
    console.warn("No se pudieron cargar los salarios (posible falta de permisos):", error);
  }
  return {};
}

// Guardar salario (Solo Superadmin)
async function actualizarSalario(nombre, nuevoSueldo) {
  try {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'superadmin') throw new Error("No autorizado");

    salariosCache[nombre] = parseInt(nuevoSueldo);

    // Guardar en Firestore con merge para no borrar otros
    await db.collection("Config").doc("salarios_noc").set({
      [nombre]: parseInt(nuevoSueldo)
    }, { merge: true });

    return true;
  } catch (error) {
    console.error("Error al guardar salario:", error);
    Swal.fire("Error", "No se pudo guardar el sueldo.", "error");
    return false;
  }
}

async function calcularHorasExtras(date) {
  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth(); // 0-indexed

  // Estructura de resultados dinámica
  const reportData = {};

  // Inicializar contadores para empleados conocidos
  Object.values(SHIFT_MAP).forEach(name => {
    reportData[name] = { count: 0, hours: 0 };
  });

  // Helper para sumar turno
  const sumarTurno = (turno) => {
    const empleado = SHIFT_MAP[turno];
    if (empleado && reportData[empleado]) {
      reportData[empleado].count++;
    }
  };

  // 1. Obtener datos del mes anterior (para contar del 26 al final)
  const prevDate = new Date(currentYear, currentMonth - 1, 1);
  const prevKey = obtenerClaveMes(prevDate);
  const prevDataStr = localStorage.getItem(prevKey);

  let prevData = null;

  // Intentamos leer de localStorage
  if (prevDataStr) {
    try {
      prevData = JSON.parse(prevDataStr);
    } catch (e) {
      console.error("Error parseando JSON local mes anterior:", e);
    }
  }

  // Si no hay datos locales, intentamos leer de Firestore (fallback)
  if (!prevData) {
    try {
      const doc = await db.collection("calendarios").doc(prevKey).get();
      if (doc.exists) {
        prevData = doc.data();
      }
    } catch (error) {
      console.error("Error obteniendo mes anterior de Firestore:", error);
    }
  }

  if (prevData) {
    // Helper para contar en un objeto de turnos { "1": "S", "2": "M" }
    const contarEnObjeto = (turnos) => {
      Object.entries(turnos).forEach(([dayStr, turno]) => {
        const day = parseInt(dayStr, 10);
        if (day >= 26) {
          sumarTurno(turno);
        }
      });
    };

    // A) JSON Nuevo (prioridad)
    if (prevData.assignments || prevData.feriados || prevData.nocturno) {
      if (prevData.feriados) {
        contarEnObjeto(prevData.feriados);
      }
    }
    // B) Fallback HTML Antiguo
    else if (prevData.feriadosHTML) {
      const parser = new DOMParser();
      const docPrev = parser.parseFromString(prevData.feriadosHTML, "text/html");
      const buttonsPrev = docPrev.querySelectorAll("button.calendar-day");
      buttonsPrev.forEach(btn => {
        const day = parseInt(btn.getAttribute("data-day"), 10);
        const turno = btn.textContent.trim();
        if (day >= 26) {
          sumarTurno(turno);
        }
      });
    }
  }

  // 2. Obtener datos del mes actual (del 1 al 25) del DOM actual
  const buttonsCurr = document.querySelectorAll("#feriados-calendar button.calendar-day");
  buttonsCurr.forEach(btn => {
    const day = parseInt(btn.getAttribute("data-day"), 10);
    const turno = btn.textContent.trim();

    // Contamos solo hasta el 25
    if (day <= 25) {
      sumarTurno(turno);
    }
  });

  // 3. Calcular totales y renderizar
  Object.keys(reportData).forEach(name => {
    reportData[name].hours = reportData[name].count * 5; // 5 horas por turno
  });

  // Pre-cargar salarios si es superadmin
  if (localStorage.getItem('userRole') === 'superadmin') {
    await cargarSalarios();
  }

  // Renderizar la nueva tabla
  renderOvertimeTable(reportData, date);

  return reportData; // Retornar para uso externo (exportación)
}

// Renderizar la Nueva Tabla de Reporte (Premium Dashboard)
async function renderOvertimeTable(data, date) {
  const container = document.getElementById("overtime-report-container");
  if (!container) return;

  const isSuperAdmin = localStorage.getItem('userRole') === 'superadmin';
  const currentSalaries = isSuperAdmin ? salariosCache : {};

  // Calcular periodo para el título
  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth();
  const prevDate = new Date(currentYear, currentMonth - 1, 26);
  const currEndDate = new Date(currentYear, currentMonth, 25);

  const options = { month: 'short', day: 'numeric' };
  const periodoStr = `${prevDate.toLocaleDateString('es-ES', options)} - ${currEndDate.toLocaleDateString('es-ES', options)}`;

  // -------------------------
  // CALCULO DE MÉTRICAS
  // -------------------------
  let totalHorasGlobal = 0;
  let totalTurnosGlobal = 0;
  let topContributorName = "N/A";
  let topContributorHours = -1;
  let totalDineroGlobal = 0; // $$$

  const validEntries = [];
  const empleadosPrincipales = ["Sergio Castillo", "Ignacio Aburto"];

  Object.entries(data).forEach(([name, stats]) => {
    if (stats.count > 0 || empleadosPrincipales.includes(name)) {
      // Calculo monetario (Si aplica)
      let dinero = 0;
      let sueldoBase = 0;

      if (isSuperAdmin) {
        sueldoBase = currentSalaries[name] || 0;
        // Formula: Base * Factor * Horas
        dinero = Math.round(sueldoBase * FACTOR_HORA_EXTRA * stats.hours);
        totalDineroGlobal += dinero;
      }

      validEntries.push({ name, ...stats, dinero, sueldoBase });

      totalHorasGlobal += stats.hours;
      totalTurnosGlobal += stats.count;

      if (stats.hours > topContributorHours) {
        topContributorHours = stats.hours;
        topContributorName = name;
      }
    }
  });

  // Si no hay horas, reset
  if (totalHorasGlobal === 0) topContributorName = "-";

  // -------------------------
  // CONSTRUCCIÓN DEL HTML
  // -------------------------

  // 1. Header
  const today = new Date();
  const currentDay = today.getDate();
  const isReminderPeriod = currentDay >= 23 && currentDay <= 25;

  let notificationHTML = '';
  if (isReminderPeriod) {
    notificationHTML = `<div class="reminder-tooltip"><i data-lucide="bell-ring"></i> Recordatorio: Descargar reporte antes del 25</div>`;
  }

  // Header Style Update for "Authorized View"
  const securityBadge = isSuperAdmin
    ? `<span style="font-size:0.7em; background:#2c3e50; color:#4cd137; padding:2px 8px; border-radius:12px; border:1px solid #4cd137; margin-left:10px;">
         <i data-lucide="shield-check" style="width:12px; vertical-align:middle"></i> VISTA FINANCIERA
       </span>`
    : '';

  let html = `
    <div class="report-header">
      <div class="report-title-group">
        <h3>
          <i data-lucide="bar-chart-2" style="color: #7796cb;"></i>
          Control de Horas Extras
          ${securityBadge}
        </h3>
        <span class="report-period">
          <i data-lucide="calendar" style="width: 14px; display: inline-block; vertical-align: middle;"></i> 
          ${periodoStr}
        </span>
      </div>
      <div style="display:flex; flex-direction:column; align-items:flex-end;">
        <button onclick="exportarReporteHorasExtras()" class="btn-premium-export ${isReminderPeriod ? 'pulse-reminder' : ''}">
          <i data-lucide="file-down"></i> Exportar PDF ${isSuperAdmin ? '(Seguro)' : ''}
        </button>
        ${notificationHTML}
      </div>
    </div>
  `;

  // 2. Summary Cards
  html += `
    <div class="summary-cards-grid">
      <!-- Card 1: Total Horas -->
      <div class="summary-card accent-purple">
        <div class="card-header">
          <div class="card-icon"><i data-lucide="clock"></i></div>
          <span class="card-label">Total Horas</span>
        </div>
        <div class="card-value">${totalHorasGlobal}</div>
        <div class="card-subtext">Horas acumuladas este periodo</div>
      </div>
  `;

  // Card 2: Contextual (Dinero para Superadmin, Top Contributor para Admin)
  if (isSuperAdmin) {
    const dineroFormat = '$ ' + totalDineroGlobal.toLocaleString('es-CL');
    html += `
      <!-- Card 2: Dinero (Superadmin Only) -->
      <div class="summary-card accent-blue">
        <div class="card-header">
          <div class="card-icon"><i data-lucide="dollar-sign"></i></div>
          <span class="card-label">Total a Pagar</span>
        </div>
        <div class="card-value" style="color: #4cd137;">${dineroFormat}</div>
        <div class="card-subtext">Estimado (Factor Legal)</div>
      </div>
    `;
  } else {
    html += `
      <!-- Card 2: Top Contributor (Admin) -->
      <div class="summary-card accent-blue">
        <div class="card-header">
          <div class="card-icon"><i data-lucide="award"></i></div>
          <span class="card-label">Mayor Colaborador</span>
        </div>
        <div class="card-value" style="font-size: 1.5rem;">${topContributorName.split(" ")[0]}</div>
        <div class="card-subtext">${topContributorHours > 0 ? topContributorHours + ' horas registradas' : 'Sin registros'}</div>
      </div>
    `;
  }

  // Card 3: Total Turnos
  html += `
      <!-- Card 3: Total Turnos -->
      <div class="summary-card accent-green">
        <div class="card-header">
          <div class="card-icon"><i data-lucide="layers"></i></div>
          <span class="card-label">Turnos Extra</span>
        </div>
        <div class="card-value">${totalTurnosGlobal}</div>
        <div class="card-subtext">Total turnos cubiertos</div>
      </div>
    </div>
  `;

  // 3. Premium Table
  // Columnas dinámicas
  const colWidth = isSuperAdmin ? '15%' : '20%';

  html += `
    <div class="premium-table-container">
      <table class="premium-table">
        <thead>
          <tr>
            <th style="width: ${isSuperAdmin ? '25%' : '40%'};">Empleado</th>
            <th style="width: ${colWidth}; text-align: center;">Turnos</th>
            <th style="width: ${colWidth}; text-align: center;">Horas</th>
            ${isSuperAdmin ? `<th style="width: 20%; text-align: center;">Sueldo Base</th>` : ''}
            ${isSuperAdmin ? `<th style="width: 20%; text-align: center; color: #4cd137;">A Pagar (50%)</th>` : ''}
            <th style="width: ${colWidth}; text-align: center;">Estado</th>
          </tr>
        </thead>
        <tbody>
  `;

  validEntries.forEach(entry => {
    const initials = entry.name.split(" ").map(n => n[0]).join("").substring(0, 2);

    // Determinar badge
    let badgeClass = "normal";
    let badgeText = "Normal";
    let icon = "check-circle";

    if (entry.hours >= 40) {
      badgeClass = "critical";
      badgeText = "Crítico";
      icon = "alert-circle";
    } else if (entry.hours >= 20) {
      badgeClass = "high";
      badgeText = "Alto";
      icon = "alert-triangle";
    }

    // Funcionalidad OnClick para editar sueldo (Solo Superadmin)
    const editOnClick = isSuperAdmin
      ? `onclick="editarSueldoBase('${entry.name}', ${entry.sueldoBase})"`
      : '';

    // Cursor pointer para indicar interactividad
    const sueldoStyle = isSuperAdmin
      ? `cursor: pointer; text-decoration: underline; text-decoration-style: dotted;`
      : '';

    html += `
      <tr>
        <td>
          <div class="employee-cell">
            <div class="avatar-ring">
              <div class="avatar-inner">${initials}</div>
            </div>
            <div class="employee-info-text">
              <span class="employee-name-small" style="font-size: 0.95rem; color: #fff;">${entry.name}</span>
              <span class="employee-role-small">NOC Operator</span>
            </div>
          </div>
        </td>
        <td style="text-align: center;">
          <span class="metric-value" style="color: #a5b1c2;">${entry.count}</span>
        </td>
        <td style="text-align: center;">
          <span class="metric-value" style="color: #fff;">${entry.hours}</span><span class="metric-unit"> hrs</span>
        </td>
        
        ${isSuperAdmin ? `
          <td style="text-align: center;" ${editOnClick} title="Clic para editar sueldo base">
            <span class="metric-value" style="color: #a5b1c2; ${sueldoStyle}">
              $ ${entry.sueldoBase.toLocaleString('es-CL')}
            </span>
            ${entry.sueldoBase === 0 ? '<i data-lucide="alert-circle" style="width:12px; color:orange;"></i>' : ''}
          </td>
          <td style="text-align: center;">
            <span class="metric-value" style="color: #4cd137; font-weight:bold;">
              $ ${entry.dinero.toLocaleString('es-CL')}
            </span>
          </td>
        ` : ''}

        <td style="text-align: center;">
          <span class="premium-badge ${badgeClass}">
            <i data-lucide="${icon}" style="width: 12px;"></i> ${badgeText}
          </span>
        </td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  if (isSuperAdmin) {
    html += `
      <div style="text-align: right; margin-top: 10px; font-size: 0.8rem; color: #666;">
        <i data-lucide="info" style="width:12px;"></i> Cálculo: Sueldo Base * 0.0077777 * Horas Extras
      </div>
    `;
  }

  container.innerHTML = html;

  // Refrescar iconos
  if (window.lucide) {
    lucide.createIcons();
  }
}

// Función auxiliar para editar sueldo (Global)
window.editarSueldoBase = async (nombre, salarioActual) => {
  const { value: nuevoSalario } = await Swal.fire({
    title: `Sueldo Base: ${nombre}`,
    input: 'number',
    inputLabel: 'Ingrese el sueldo base mensual (CLP)',
    inputValue: salarioActual,
    showCancelButton: true,
    confirmButtonText: 'Guardar',
    cancelButtonText: 'Cancelar',
    inputValidator: (value) => {
      if (!value) {
        return 'Debes ingresar un monto.';
      }
    }
  });

  if (nuevoSalario) {
    const success = await actualizarSalario(nombre, nuevoSalario);
    if (success) {
      Swal.fire({
        icon: 'success',
        title: 'Actualizado',
        text: `El nuevo sueldo base es $${parseInt(nuevoSalario).toLocaleString('es-CL')}`,
        timer: 1500,
        showConfirmButton: false
      });
      // Recalcular
      const date = new Date(document.getElementById('current-month').textContent); // Hacky re-read or use global currentDate if available
      // Mejor re-usar la fecha global si existe, o usar la actual
      calcularHorasExtras(window.currentDate || new Date());
    }
  }
};

// Expose globally for onclick
window.exportarReporteHorasExtras = exportarReporteHorasExtras;

// -----------------------------------------------------------------------------
// EXPORTAR REPORTE PDF (HORAS EXTRAS)
// -----------------------------------------------------------------------------
// Helper para verificar imágenes
const getBase64ImageFromURL = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.setAttribute('crossOrigin', 'anonymous');
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL("image/png");
      resolve(dataURL);
    };
    img.onerror = error => {
      console.warn("No se pudo cargar la imagen para el PDF (CORS o 404).", error);
      resolve(null); // Resolve null to continue without logo
    };
    img.src = url;
  });
};

async function exportarReporteHorasExtras() {
  if (!window.jspdf) {
    Swal.fire("Error", "Librería PDF no cargada.", "error");
    return;
  }

  // Notificar carga
  const swalLoading = Swal.fire({
    title: 'Generando Reporte...',
    text: 'Procesando datos y gráficos corporativos',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Calcular fechas del periodo (26 mes anterior - 25 mes actual)
    let yearReport = currentDate.getFullYear();
    let monthReport = currentDate.getMonth(); // 0 = Enero

    // Fecha Inicio: 26 del mes anterior
    let dateStart = new Date(yearReport, monthReport - 1, 26);
    // Fecha Fin: 25 del mes actual
    let dateEnd = new Date(yearReport, monthReport, 25);

    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    const strStart = dateStart.toLocaleDateString("es-ES", options);
    const strEnd = dateEnd.toLocaleDateString("es-ES", options);
    const periodoStr = `Del ${strStart} al ${strEnd}`;

    const fechaReporte = new Date().toLocaleString("es-CL");

    // Recalcular datos frescos (Premium)
    const data = await calcularHorasExtras(currentDate);

    // Cargar Logo
    const logoUrl = "https://i.ibb.co/HqrX2cr/LOGO-COLOR-2-SLOGAN-768x185.png";
    const logoBase64 = await getBase64ImageFromURL(logoUrl);

    // ---------------------------------------------------------
    // 1. ENCABEZADO CORPORATIVO (Elegante / Minimalista)
    // ---------------------------------------------------------
    const colorCorpBlue = [0, 51, 102]; // #003366 (Dark Blue)
    const colorCorpYellow = [244, 180, 0]; // #F4B400 (Accent)
    const colorTextMain = [60, 60, 60]; // Dark Grey for text
    const colorBg = [255, 255, 255];

    // Fondo blanco limpio (sin rectángulos pesados)

    // Logo (Más pequeño y sobre blanco)
    if (logoBase64) {
      const logoW = 35; // Reducido de 50 a 35
      const logoH = 8.5;
      doc.addImage(logoBase64, 'PNG', 14, 15, logoW, logoH);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(...colorCorpBlue);
      doc.text("PatagoniaIP", 14, 22);
    }

    // Título Principal (Alineado a la derecha, color corporativo)
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colorCorpBlue);
    doc.setFontSize(20);
    doc.text("REPORTE DE HORAS EXTRAS", pageWidth - 14, 20, { align: 'right' });

    // Línea de acento sutil (Debajo del título)
    doc.setDrawColor(...colorCorpYellow);
    doc.setLineWidth(0.5);
    doc.line(pageWidth - 14, 23, pageWidth - 120, 23);

    // Subtítulo / Departamento
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("DEPARTAMENTO DE OPERACIONES NOC", pageWidth - 14, 29, { align: 'right' });
    doc.text(periodoStr.toUpperCase(), pageWidth - 14, 34, { align: 'right' });

    // ---------------------------------------------------------
    // 2. RESUMEN EJECUTIVO (Tarjetas Minimalistas)
    // ---------------------------------------------------------
    let totalHoras = 0;
    let totalTurnos = 0;
    let topEmp = "-";
    let maxHoras = 0;
    const empleadosPrincipales = ["Sergio Castillo", "Ignacio Aburto"];
    const rows = [];

    // Procesar datos
    Object.entries(data).forEach(([name, stats]) => {
      if (stats.count > 0 || empleadosPrincipales.includes(name)) {
        totalHoras += stats.hours;
        totalTurnos += stats.count;
        if (stats.hours > maxHoras) {
          maxHoras = stats.hours;
          topEmp = name;
        }
        rows.push([
          name,
          stats.count,
          stats.hours + " hrs",
          stats.hours >= 40 ? "CRÍTICO" : (stats.hours >= 20 ? "ALTO" : "NORMAL")
        ]);
      }
    });

    // Dibujar cajitas de resumen (Estilo 'Outline' limpio)
    const startY = 50;
    const boxWidth = (pageWidth - 28 - 10) / 3;
    const boxHeight = 22;

    const drawCard = (x, label, value, accentColor) => {
      // Borde suave
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.1);
      doc.roundedRect(x, startY, boxWidth, boxHeight, 2, 2, 'S');

      // Indicador de color lateral (muy fino)
      doc.setFillColor(...accentColor);
      doc.rect(x, startY + 4, 1.5, boxHeight - 8, 'F');

      // Valor
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...colorCorpBlue);
      doc.text(value.toString(), x + 8, startY + 10);

      // Etiqueta
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(label.toUpperCase(), x + 8, startY + 17);
    };

    drawCard(14, "Total Horas", totalHoras + " hrs", colorCorpBlue);
    drawCard(14 + boxWidth + 5, "Total Turnos", totalTurnos, colorCorpYellow);
    drawCard(14 + (boxWidth + 5) * 2, "Mayor Colaborador", topEmp.split(" ")[0], colorCorpBlue);

    // Información del Periodo (Texto flotante sutil)
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.text(`Generado: ${fechaReporte}`, 14, startY + boxHeight + 6);

    // ---------------------------------------------------------
    // 3. TABLA DE DETALLE
    // ---------------------------------------------------------
    doc.autoTable({
      startY: startY + boxHeight + 15,
      head: [['EMPLEADO', 'TURNOS', 'HORAS TOTALES', 'ESTADO']],
      body: rows,
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 6,
        lineColor: [230, 230, 230],
        lineWidth: 0.1,
        font: "helvetica"
      },
      headStyles: {
        fillColor: colorCorpBlue,
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: { textColor: 50 },
      columnStyles: {
        0: { cellWidth: 'auto', fontStyle: 'bold' },
        1: { halign: 'center', cellWidth: 30 },
        2: { halign: 'center', cellWidth: 40 },
        3: { halign: 'center', cellWidth: 40, fontStyle: 'bold' }
      },
      alternateRowStyles: { fillColor: [245, 247, 250] }, // Alternado suave
      didParseCell: function (data) {
        if (data.section === 'body' && data.column.index === 3) {
          const text = data.cell.raw;
          // Colores de estado
          if (text === 'CRÍTICO') data.cell.styles.textColor = [231, 76, 60];
          else if (text === 'ALTO') data.cell.styles.textColor = [241, 196, 15]; // Yellow styled
          else data.cell.styles.textColor = [46, 204, 113];
        }
      }
    });

    // -----------------------------------------------------------------------------
    // 4. PIE DE PÁGINA
    // -----------------------------------------------------------------------------
    const finalY = doc.lastAutoTable.finalY + 10;

    // Logo pequeño o texto en footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("PatagoniaIP - Conexión que transforma realidades", pageWidth / 2, finalY + 10, { align: 'center' });

    swalLoading.close();
    doc.save(`Reporte_NOC_${yearReport}_${monthReport + 1}.pdf`);

  } catch (error) {
    swalLoading.close();
    console.error("Error al generar PDF:", error);
    Swal.fire("Error", "No se pudo generar el reporte PDF: " + error.message, "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const btnExportar = document.getElementById("btnExportarExtras");
  if (btnExportar) {
    btnExportar.addEventListener("click", exportarReporteHorasExtras);
  }
});

// -----------------------------------------------------------------------------
// 3) Eventos de Admin
// -----------------------------------------------------------------------------
let isSelecting = false;
let isDeselecting = false;

// Modificado para recibir un target explícito (Event Delegation)
function adminMousedown(e, targetElement) {
  const el = targetElement || this; // Fallback compatibilidad

  // Botón Izquierdo (0): Seleccionar (acumulativo)
  if (e.button === 0) {
    isSelecting = true;
    if (!el.classList.contains("selected")) {
      el.classList.add("selected");
      selectedDays.push(el);
    }
  }
  // Botón Derecho (2): Borrar (Goma de borrar)
  else if (e.button === 2) {
    isDeselecting = true;

    // 1. Quitar de la selección si estaba (ANTES de borrar clases)
    if (el.classList.contains("selected")) {
      el.classList.remove("selected");
      selectedDays = selectedDays.filter((item) => item !== el);
    }

    // 2. Borrar contenido y estilos
    el.textContent = "";
    el.innerHTML = "";
    el.removeAttribute("style");
    el.className = "calendar-day w-full h-full";
    el.removeAttribute("title");

    scheduleFirestoreUpdate();
  }
}

function adminMouseover(e, targetElement) {
  const el = targetElement || this;

  if (usuarioEsAdmin) {
    if (isSelecting) {
      if (!el.classList.contains("selected")) {
        el.classList.add("selected");
        selectedDays.push(el);
      }
    } else if (isDeselecting) {
      // 1. Quitar de la selección si estaba (ANTES de borrar clases)
      if (el.classList.contains("selected")) {
        el.classList.remove("selected");
        selectedDays = selectedDays.filter((item) => item !== el);
      }

      // 2. Borrar al arrastrar (Goma de borrar)
      el.textContent = "";
      el.innerHTML = "";
      el.removeAttribute("style");
      el.className = "calendar-day w-full h-full";
      el.removeAttribute("title");

      scheduleFirestoreUpdate();
    }
  }
}

function adminContextmenu(e) {
  e.preventDefault();
  // Ya no limpiamos todo aquí, solo prevenimos el menú para permitir el "borrado" con click derecho
  return false;
}

function adminMouseup(e) {
  if (usuarioEsAdmin) {
    isSelecting = false;
    isDeselecting = false;
  }
}

// -----------------------------------------------------------------------------
// REFACTOR: Event Delegation for Admin Actions (Robusto a re-renders)
// -----------------------------------------------------------------------------
function setupAdminEventDelegation() {
  console.log("🔧 setupAdminEventDelegation: Inicializando event delegation");
  const container = document.body; // Delegar en body para atrapar todo

  container.addEventListener("mousedown", (e) => {
    console.log("🖱️ Click detectado. usuarioEsAdmin =", usuarioEsAdmin);
    if (!usuarioEsAdmin) {
      console.warn("⛔ Click bloqueado: usuario no es admin");
      return;
    }
    const target = e.target.closest(".calendar-day");
    console.log("🎯 Target encontrado:", target);
    if (target) {
      console.log("✅ Ejecutando adminMousedown");
      adminMousedown(e, target);
    }
  });

  container.addEventListener("mouseover", (e) => {
    if (!usuarioEsAdmin) return;
    const target = e.target.closest(".calendar-day");
    if (target) {
      adminMouseover(e, target);
    }
  });

  container.addEventListener("contextmenu", (e) => {
    const target = e.target.closest(".calendar-day");
    if (target && usuarioEsAdmin) {
      e.preventDefault();
    }
  });

  document.addEventListener("mouseup", () => {
    if (usuarioEsAdmin) {
      isSelecting = false;
      isDeselecting = false;
    }
  });

  console.log("✅ Event delegation configurado correctamente");
}

// Deprecated: No longer needed individually
function attachAdminCellListeners() {
  // No-op: handled by delegation now
}

// -----------------------------------------------------------------------------
// 4) MODALES, GUARDAR Y CARGAR CALENDARIO
// -----------------------------------------------------------------------------
const btnGuardar = document.getElementById("btnGuardar");
const btnCargar = document.getElementById("btnCargar");
const btnEliminar = document.getElementById("btnEliminar");
const selectMeses = document.getElementById("mesesGuardados");
const modal = document.getElementById("modalCalendario");
const modalContent = document.getElementById("contenidoModal");
const cerrarModal = document.getElementById("cerrarModal");

const btnVerHorarios = document.getElementById("btnVerHorarios");
const modalHorarios = document.getElementById("modalHorarios");
const cerrarHorarios = document.getElementById("cerrarHorarios");

const btnVerEstadisticas = document.getElementById("btnVerEstadisticas");
const modalEstadisticas = document.getElementById("modalEstadisticas");
const cerrarEstadisticas = document.getElementById("cerrarEstadisticas");
const estadisticasContenido = document.getElementById("estadisticas-contenido");

function cargarListaCalendarios() {
  const selectMeses = document.getElementById("selectMeses");
  if (!selectMeses) return;

  db.collection("calendarios")
    .get()
    .then((querySnapshot) => {
      selectMeses.innerHTML =
        '<option value="">-- Seleccione un mes guardado --</option>';
      querySnapshot.forEach((doc) => {
        const option = document.createElement("option");
        option.value = doc.id;
        option.textContent = doc.id;
        selectMeses.appendChild(option);
      });
    })
    .catch((error) => {
      console.error("Error al cargar calendarios:", error);
    });
}

// -----------------------------------------------------------------------------
// 5) CARGAR FOTOS DE EMPLEADOS DESDE FIRESTORE
// -----------------------------------------------------------------------------
function cargarFotosEmpleados() {
  const employeeCards = document.querySelectorAll(".employee-card");
  employeeCards.forEach((card) => {
    const nameSpan = card.querySelector("span");
    const imgElement = card.querySelector(".employee-photo");
    if (!nameSpan || !imgElement) return;

    const employeeName = nameSpan.textContent.trim();
    db.collection("empleados")
      .doc(employeeName)
      .get()
      .then((doc) => {
        if (doc.exists) {
          const data = doc.data();
          if (data.photoURL) {
            imgElement.src = data.photoURL;
          }
        }
      })
      .catch((err) => {
        console.error("Error al leer la foto de Firestore:", err);
      });
  });
}

// -----------------------------------------------------------------------------
// 6) FUNCIÓN PARA CALCULAR ESTADÍSTICAS
// -----------------------------------------------------------------------------
function calcularEstadisticas() {
  // Solo tomamos el calendario general para las estadísticas
  const celdas = document.querySelectorAll("#general-calendar .calendar-day");
  const conteoTurnos = {};

  celdas.forEach((celda) => {
    const turno = celda.textContent.trim();
    if (turno) {
      conteoTurnos[turno] = (conteoTurnos[turno] || 0) + 1;
    }
  });

  return conteoTurnos;
}

function calcularTurnosPorEmpleado() {
  const empleadosTurnos = {};
  document
    .querySelectorAll("#general-calendar tbody tr")
    .forEach((row) => {
      const empleado = row.querySelector("td")?.textContent.trim();
      if (!empleado || empleado === "Encargado de Bitácora") return;

      empleadosTurnos[empleado] = empleadosTurnos[empleado] || {};

      row.querySelectorAll("td button.calendar-day").forEach((btn) => {
        const turno = btn.textContent.trim();
        if (turno) {
          empleadosTurnos[empleado][turno] =
            (empleadosTurnos[empleado][turno] || 0) + 1;
        }
      });
    });

  return Object.entries(empleadosTurnos).map(
    ([empleado, turnos]) => {
      let turnoMasAsignado = "-";
      let turnoMenosAsignado = "-";
      let maxTurnos = 0;
      let minTurnos = Infinity;

      Object.entries(turnos).forEach(([turno, cantidad]) => {
        if (cantidad > maxTurnos) {
          maxTurnos = cantidad;
          turnoMasAsignado = turno;
        }
        if (cantidad < minTurnos) {
          minTurnos = cantidad;
          turnoMenosAsignado = turno;
        }
      });

      return { empleado, turnoMasAsignado, turnoMenosAsignado };
    }
  );
}

function mostrarEstadisticas() {
  const conteoTurnos = calcularEstadisticas();
  const empleadosTurnos = calcularTurnosPorEmpleado();

  let turnoMasUsado = "-";
  let turnoMenosUsado = "-";
  let maxCount = 0,
    minCount = Infinity;

  Object.entries(conteoTurnos).forEach(([turno, cantidad]) => {
    if (cantidad > maxCount) {
      maxCount = cantidad;
      turnoMasUsado = turno;
    }
    if (cantidad < minCount) {
      minCount = cantidad;
      turnoMenosUsado = turno;
    }
  });

  document.getElementById("total-turnos").textContent = Object.values(
    conteoTurnos
  ).reduce((a, b) => a + b, 0);

  document.getElementById("turno-mas-usado").textContent = turnoMasUsado;
  document.getElementById("turno-menos-usado").textContent = turnoMenosUsado;

  const tablaEmpleados = document.getElementById("tabla-turnos-empleados");
  tablaEmpleados.innerHTML = empleadosTurnos
    .map(
      ({ empleado, turnoMasAsignado, turnoMenosAsignado }) => `
    <tr>
      <td>${empleado}</td>
      <td>${turnoMasAsignado}</td>
      <td>${turnoMenosAsignado}</td>
    </tr>
  `
    )
    .join("");

  generarGraficoBarras(conteoTurnos);
  generarGraficoPastel(empleadosTurnos);
  generarGraficoLineas(conteoTurnos);

  modalEstadisticas.style.display = "block";
}

// -----------------------------------------------------------------------------
// ANÁLISIS HISTÓRICO PARA AUTO-ASIGNACIÓN INTELIGENTE
// -----------------------------------------------------------------------------
async function analizarHistorialTurnos() {
  console.log("[ANÁLISIS] Iniciando análisis de historial...");

  const employeeProfiles = {};
  const dayNames = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];

  try {
    // 1. Obtener todos los calendarios de Firestore
    const snapshot = await db.collection("calendarios").get();
    console.log(`[ANÁLISIS] Encontrados ${snapshot.size} meses de datos`);

    snapshot.forEach(doc => {
      const data = doc.data();
      const monthId = doc.id; // ej: "enero 2025"

      // Intentar parsear el mes/año del ID
      let year, month;
      const parts = monthId.toLowerCase().split(" ");
      if (parts.length === 2) {
        const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
          "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
        month = monthNames.indexOf(parts[0]);
        year = parseInt(parts[1]);
      }

      if (isNaN(year) || month < 0) {
        console.warn(`[ANÁLISIS] No se pudo parsear mes: ${monthId}`);
        return;
      }

      // 2. Parsear datos (formato JSON nuevo o HTML antiguo)
      let assignments = {};

      if (data.assignments && typeof data.assignments === 'object') {
        // Formato JSON nuevo
        assignments = data.assignments;
      } else if (data.generalHTML) {
        // Formato HTML antiguo - parsear
        const parser = new DOMParser();
        const htmlDoc = parser.parseFromString(data.generalHTML, "text/html");
        htmlDoc.querySelectorAll("tbody tr").forEach(row => {
          const nameCell = row.querySelector("td:first-child");
          if (!nameCell) return;
          const name = nameCell.textContent.trim();
          if (name === "Encargado de Bitácora") return;

          assignments[name] = {};
          row.querySelectorAll("button.calendar-day").forEach(btn => {
            const day = btn.getAttribute("data-day");
            let shift = btn.textContent.trim();
            if (btn.innerHTML.includes("tree-palm") || btn.innerHTML.includes("lucide")) {
              shift = "V";
            }
            if (shift && day) {
              assignments[name][day] = shift;
            }
          });
        });
      }

      // 3. Procesar asignaciones y construir perfiles
      Object.entries(assignments).forEach(([employeeName, shifts]) => {
        if (!employeeProfiles[employeeName]) {
          employeeProfiles[employeeName] = {
            totalDays: 0,
            shiftCounts: {},  // { "M2": 45, "M1": 12, ... }
            dayPatterns: {},  // { "lun": { "M2": 30, "M1": 5 }, ... }
            weeklyPatterns: [] // Array of week objects
          };
        }

        const profile = employeeProfiles[employeeName];

        Object.entries(shifts).forEach(([dayStr, shiftData]) => {
          const dayNum = parseInt(dayStr);
          if (isNaN(dayNum)) return;

          // Manejar formato V1 (string) vs V2 (object)
          const shift = (typeof shiftData === 'object') ? shiftData.code : shiftData;
          if (!shift || shift === "" || shift === "V" || shift === "L" || shift === "DL" || shift === "F") return;

          // Calcular día de la semana
          const dateObj = new Date(year, month, dayNum);
          const dayOfWeek = dayNames[dateObj.getDay()];

          // Actualizar conteos
          profile.totalDays++;
          profile.shiftCounts[shift] = (profile.shiftCounts[shift] || 0) + 1;

          if (!profile.dayPatterns[dayOfWeek]) {
            profile.dayPatterns[dayOfWeek] = {};
          }
          profile.dayPatterns[dayOfWeek][shift] = (profile.dayPatterns[dayOfWeek][shift] || 0) + 1;
        });
      });
    });

    // 4. Calcular probabilidades y turnos preferidos
    Object.entries(employeeProfiles).forEach(([name, profile]) => {
      // Turnos más frecuentes (top 3)
      const sortedShifts = Object.entries(profile.shiftCounts)
        .sort((a, b) => b[1] - a[1]);
      profile.preferredShifts = sortedShifts.slice(0, 3).map(s => s[0]);

      // Convertir conteos a probabilidades por día
      profile.dayProbabilities = {};
      Object.entries(profile.dayPatterns).forEach(([day, shifts]) => {
        const total = Object.values(shifts).reduce((a, b) => a + b, 0);
        profile.dayProbabilities[day] = {};
        Object.entries(shifts).forEach(([shift, count]) => {
          profile.dayProbabilities[day][shift] = count / total;
        });
      });
    });

    console.log("[ANÁLISIS] Perfiles generados:", employeeProfiles);

    // Guardar en window para uso global
    window.EMPLOYEE_PROFILES = employeeProfiles;

    return employeeProfiles;

  } catch (error) {
    console.error("[ANÁLISIS] Error analizando historial:", error);
    return {};
  }
}

// Función para elegir turno basado en perfil histórico
function elegirTurnoPorPerfil(employeeName, dayOfWeek, turnosDisponibles) {
  const profiles = window.EMPLOYEE_PROFILES || {};
  const profile = profiles[employeeName];

  if (!profile || !profile.dayProbabilities || !profile.dayProbabilities[dayOfWeek]) {
    // Sin datos, elegir de los favoritos generales o aleatorio
    if (profile && profile.preferredShifts && profile.preferredShifts.length > 0) {
      const available = profile.preferredShifts.filter(s => turnosDisponibles.includes(s));
      if (available.length > 0) {
        return available[Math.floor(Math.random() * available.length)];
      }
    }
    return turnosDisponibles[Math.floor(Math.random() * turnosDisponibles.length)];
  }

  // Usar probabilidades del día específico
  const probs = profile.dayProbabilities[dayOfWeek];
  const rand = Math.random();
  let cumulative = 0;

  // Filtrar solo turnos disponibles
  const availableProbs = Object.entries(probs)
    .filter(([shift]) => turnosDisponibles.includes(shift));

  if (availableProbs.length === 0) {
    return turnosDisponibles[Math.floor(Math.random() * turnosDisponibles.length)];
  }

  // Normalizar probabilidades
  const totalProb = availableProbs.reduce((sum, [, p]) => sum + p, 0);

  for (const [shift, prob] of availableProbs) {
    cumulative += prob / totalProb;
    if (rand <= cumulative) {
      return shift;
    }
  }

  return availableProbs[0][0];
}
// -----------------------------------------------------------------------------
let chartBarras;
let chartPastel;
let chartLineas;

function generarGraficoBarras(datos) {
  const ctx = document.getElementById("graficoTurnos").getContext("2d");
  if (chartBarras) {
    chartBarras.destroy();
  }
  chartBarras = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(datos),
      datasets: [
        {
          label: "Frecuencia de Turnos",
          data: Object.values(datos),
          backgroundColor: "#7796cb"
        }
      ]
    },
    options: { responsive: true }
  });
}

function generarGraficoPastel(empleadosTurnos) {
  const ctx = document.getElementById("graficoEmpleados").getContext("2d");
  if (chartPastel) {
    chartPastel.destroy();
  }

  const labels = empleadosTurnos.map((e) => e.empleado);
  // Para simplificar, damos peso uniforme (si quisieras podrías sumar turnos por empleado)
  const data = empleadosTurnos.map(() => 1);

  chartPastel = new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          label: "Turnos por empleado",
          data,
          backgroundColor: ["#8FBCBB", "#88C0A6", "#D77A7A", "#7796cb", "#b5e7a0", "#ffcc99"]
        }
      ]
    },
    options: { responsive: true }
  });
}

function generarGraficoLineas(datos) {
  const ctx = document.getElementById("graficoTendencias").getContext("2d");
  if (chartLineas) {
    chartLineas.destroy();
  }
  chartLineas = new Chart(ctx, {
    type: "line",
    data: {
      labels: Object.keys(datos),
      datasets: [
        {
          label: "Tendencia de Turnos",
          data: Object.values(datos),
          borderColor: "#7796cb",
          fill: false
        }
      ]
    },
    options: { responsive: true }
  });
}

// -----------------------------------------------------------------------------
// 8) Funciones de aprendizaje (modelo de Markov)
// -----------------------------------------------------------------------------
async function actualizarTransicion(employee, turnoAnterior, turnoActual) {
  const docRef = db.collection("patronesTurnosMarkov").doc(employee);
  try {
    const doc = await docRef.get();
    let datos = {};
    if (doc.exists) {
      datos = doc.data();
    }
    if (!datos[turnoAnterior]) {
      datos[turnoAnterior] = {};
    }
    datos[turnoAnterior][turnoActual] =
      (datos[turnoAnterior][turnoActual] || 0) + 1;
    await docRef.set(datos, { merge: true });
  } catch (error) {
    console.error(`Error actualizando transición para ${employee}:`, error);
  }
}

async function obtenerMatrizTransiciones(employee) {
  try {
    const doc = await db
      .collection("patronesTurnosMarkov")
      .doc(employee)
      .get();
    if (doc.exists) {
      return doc.data();
    }
  } catch (error) {
    console.error(`Error obteniendo matriz para ${employee}:`, error);
  }
  return {};
}

function elegirSiguienteTurnoMarkov(matrix, turnoAnterior, turnosDisponibles) {
  if (!matrix[turnoAnterior] || Object.keys(matrix[turnoAnterior]).length === 0) {
    return turnosDisponibles[Math.floor(Math.random() * turnosDisponibles.length)];
  }
  const contadores = matrix[turnoAnterior];
  const total = Object.values(contadores).reduce((a, b) => a + b, 0);
  const rand = Math.random() * total;
  let acumulado = 0;
  for (let turno of turnosDisponibles) {
    acumulado += contadores[turno] || 0;
    if (rand <= acumulado) {
      return turno;
    }
  }
  return turnosDisponibles[0];
}

// -----------------------------------------------------------------------------
// 9) SUSCRIPCIÓN EN TIEMPO REAL AL CALENDARIO
// -----------------------------------------------------------------------------
let unsubscribeCalendar = null;

function subscribeCalendar() {
  const monthId = document.getElementById("current-month").textContent.trim();

  if (unsubscribeCalendar) {
    unsubscribeCalendar();
  }

  unsubscribeCalendar = db
    .collection("calendarios")
    .doc(monthId)
    .onSnapshot((doc) => {
      if (doc.exists) {
        const data = doc.data();
        const generalContainer = document.getElementById("general-calendar");
        const nocturnoContainer = document.getElementById("nocturno-calendar");
        const feriadosContainer = document.getElementById("feriados-calendar");

        // 1. Guardar identificadores de celdas seleccionadas ACTUALMENTE en memoria
        const savedSelection = selectedDays.map(el => ({
          date: el.getAttribute("data-date"),
          empleado: el.getAttribute("data-empleado"),
          day: el.getAttribute("data-day")
        }));

        if (generalContainer && data.generalHTML) {
          generalContainer.outerHTML = data.generalHTML;
        }
        if (nocturnoContainer && data.nocturnoHTML) {
          nocturnoContainer.outerHTML = data.nocturnoHTML;
        }
        if (feriadosContainer && data.feriadosHTML) {
          feriadosContainer.outerHTML = data.feriadosHTML;
        }

        // Manejo del estado "locked"
        isMonthLocked = !!data.locked;
        updateLockUI();

        // IMPORTANTE: Solo sincronizar empleados en meses ABIERTOS
        // Los meses cerrados mantienen su estado histórico intacto
        if (!isMonthLocked) {
          console.log("[SYNC] Mes abierto - sincronizando empleados nuevos");
          sincronizarTablasConEmpleados(); // Calendario general (diurnos)
          sincronizarCalendarioNocturno(); // Calendario nocturno (nocturnos)
        } else {
          console.log("[SYNC] Mes cerrado - manteniendo estado histórico (no se agregan empleados nuevos)");
        }

        lucide.createIcons();
        // fixShiftTextColors(); // Removed: function not defined
        if (usuarioEsAdmin) {
          attachAdminCellListeners();
        }

        // Recalcular horas extras tras cargar el DOM
        calcularHorasExtras(currentDate);

        // Re-run 44-Hour Check after Firestore sync
        const generalRows = document.querySelectorAll("#general-calendar tbody tr");
        generalRows.forEach(row => checkWeeklyHours(row));

        // 2. Restaurar selección (solo la que estaba activa en esta sesión)
        selectedDays = [];
        if (savedSelection.length > 0) {
          savedSelection.forEach(item => {
            const selector = `button[data-date="${item.date}"][data-day="${item.day}"]`;
            const candidates = document.querySelectorAll(selector);
            candidates.forEach(btn => {
              if (btn.getAttribute("data-empleado") === item.empleado) {
                btn.classList.add("selected");
                selectedDays.push(btn);
              }
            });
          });
        }
      } else {
        // Si no existe documento en Firestore, renderizamos desde local / cero
        renderCalendar(currentDate);
        if (usuarioEsAdmin) {
          attachAdminCellListeners();
        }
      }
    });
}

// -----------------------------------------------------------------------------
// 10) ACTUALIZACIÓN EN TIEMPO REAL (debounce)
// -----------------------------------------------------------------------------
let updateTimeout;

function scheduleFirestoreUpdate() {
  // Si el mes está bloqueado, NO guardar nada.
  if (isMonthLocked) {
    console.warn("El mes está cerrado. No se guardan cambios.");
    return;
  }

  clearTimeout(updateTimeout);
  updateTimeout = setTimeout(() => {
    const datos = obtenerDatosCalendario();
    db.collection("calendarios")
      .doc(datos.mes)
      .set(datos)
      .then(() => {
        console.log("Actualización en tiempo real guardada.");
      })
      .catch((error) => {
        console.error("Error al actualizar:", error);
      });

    // También se guarda en localStorage y se recalculan horas extras
    guardarCalendarioEnLocalStorage();
    calcularHorasExtras(currentDate);
  }, 1000);
}

// -----------------------------------------------------------------------------
// 11) EVENTO PRINCIPAL (DOMContentLoaded)
// -----------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", function () {
  setupAdminEventDelegation();
  configurarSidebar();
  configurarLogout();

  // Optimización: Carga optimista del rol desde caché
  const cachedRole = localStorage.getItem("userRole");
  if (cachedRole === "admin" || cachedRole === "superadmin") {
    console.log("Aplicando rol admin desde caché (NOC)");
    usuarioEsAdmin = true;
    document.querySelectorAll(".admin-only").forEach((el) => {
      el.classList.remove("admin-only");
    });
    lucide.createIcons();
    if (cachedRole === "superadmin") {
      const liRegistros = document.getElementById("li-registros");
      if (liRegistros) liRegistros.style.display = "block";
    }
  }

  verificarRolUsuario(function (isAdmin) {
    usuarioEsAdmin = isAdmin;
    console.log("🔐 Rol verificado. usuarioEsAdmin =", usuarioEsAdmin);

    // Actualizar UI de bloqueo tras confirmar rol
    updateLockUI();

    // Mostrar elementos solo para admin (Confirmación final)
    if (usuarioEsAdmin) {
      document.querySelectorAll(".admin-only").forEach((el) => {
        el.classList.remove("admin-only");
      });
      // Re-create icons for newly exposed elements
      lucide.createIcons();
      // Attach listeners for cell selection (fix for late auth)
      // attachAdminCellListeners(); // Removed
    }

    // Botón Auto-Asignar (solo admin)
    const btnAutoAsignar = document.getElementById("btnAutoAsignar");
    if (btnAutoAsignar) {
      btnAutoAsignar.addEventListener("click", async function () {
        if (!usuarioEsAdmin) return;

        Swal.fire({
          title: "Analizando patrones históricos...",
          text: "Esto puede tardar unos segundos. Analizando 14 meses de datos.",
          showConfirmButton: false,
          allowOutsideClick: false,
          willOpen: () => {
            Swal.showLoading();
          }
        });

        try {
          const turnoColorMapping = {
            M0: "#648c9b", M0A: "#7b69a5", M1: "#557a5f", M1A: "#c49f87",
            M1B: "#ffaaa5", M2: "#ffcc99", M2A: "#d4a5a5", M2B: "#b5e7a0",
            M3: "#996a7f", L: "#8FBCBB", DL: "#D77A7A", N: "#cccccc",
            S: "#4A90E2", I: "#2C3E50"
          };

          // NO incluir "V" (Vacaciones) - esas se asignan manualmente
          const turnosDisponibles = [
            "M0", "M0A", "M1", "M1A", "M1B", "M2", "M2A", "M2B", "M3"
          ];

          const dayNames = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];

          // 1. ANALIZAR HISTORIAL PRIMERO
          await analizarHistorialTurnos();
          console.log("[AUTO-ASIGNAR] Perfiles cargados:", window.EMPLOYEE_PROFILES);

          const year = currentDate.getFullYear();
          const month = currentDate.getMonth();
          const lastDay = new Date(year, month + 1, 0);
          const daysInMonth = lastDay.getDate();

          const tabla = document.getElementById("general-calendar").querySelector("tbody");
          const filas = tabla.querySelectorAll("tr");

          let empleadosAsignados = {};

          // 2. ASIGNACIÓN BASADA EN SEMANAS COMPLETAS
          // Reglas:
          // - Un turno por semana (Lun-Vie mismo turno)
          // - Sábado: M1 si turno semanal es M2, sino mismo turno
          // - Máximo 1 M1B por semana (global)

          // Identificar semanas del mes (Lun-Dom)
          const weeks = [];
          let currentWeek = { start: 1, days: [] };

          for (let day = 1; day <= daysInMonth; day++) {
            const dateObj = new Date(year, month, day);
            const dayOfWeek = dateObj.getDay();

            // Si es lunes y ya tenemos días, guardar semana anterior
            if (dayOfWeek === 1 && currentWeek.days.length > 0) {
              weeks.push(currentWeek);
              currentWeek = { start: day, days: [] };
            }

            currentWeek.days.push({ day, dayOfWeek, dayName: dayNames[dayOfWeek] });
          }
          // Agregar última semana
          if (currentWeek.days.length > 0) {
            weeks.push(currentWeek);
          }

          console.log("[AUTO-ASIGNAR] Semanas identificadas:", weeks);

          // Asignar por semana para cada empleado
          for (let fila of filas) {
            const firstCell = fila.querySelector("td");
            if (!firstCell) continue;
            const empleado = firstCell.textContent.replace(/⚠️/g, "").trim();
            if (empleado === "Encargado de Bitácora") continue;

            empleadosAsignados[empleado] = new Array(daysInMonth).fill("");

            // Obtener turno preferido del empleado (el más frecuente históricamente)
            const profile = window.EMPLOYEE_PROFILES?.[empleado];
            const preferredShift = profile?.preferredShifts?.[0] || "M2";

            for (let weekIdx = 0; weekIdx < weeks.length; weekIdx++) {
              const week = weeks[weekIdx];

              // Elegir turno semanal basado en perfil
              // Excluir M1B si ya hay uno esta semana
              let availableShifts = [...turnosDisponibles];

              // Verificar si M1B ya está asignada esta semana
              const m1bThisWeek = Object.entries(empleadosAsignados).some(([emp, shifts]) => {
                return week.days.some(d => shifts[d.day - 1] === "M1B");
              });
              if (m1bThisWeek) {
                availableShifts = availableShifts.filter(s => s !== "M1B");
              }

              // Elegir turno semanal ROTANDO entre preferencias
              // Semana 1: preferencia #1, Semana 2: preferencia #2, etc.
              let turnoSemanal;
              if (profile?.preferredShifts && profile.preferredShifts.length > 0) {
                // Rotar a través de los turnos preferidos (ciclo)
                const rotationIndex = weekIdx % profile.preferredShifts.length;
                const rotatedShift = profile.preferredShifts[rotationIndex];

                // Si el turno rotado está disponible, usarlo
                if (availableShifts.includes(rotatedShift)) {
                  turnoSemanal = rotatedShift;
                } else {
                  // Buscar el siguiente disponible
                  const available = profile.preferredShifts.filter(s => availableShifts.includes(s));
                  turnoSemanal = available[0] || availableShifts[Math.floor(Math.random() * availableShifts.length)];
                }
              } else {
                // Sin historial, rotar aleatoriamente pero diferente cada semana
                turnoSemanal = availableShifts[weekIdx % availableShifts.length];
              }

              console.log(`[AUTO] ${empleado} Semana ${weekIdx + 1}: ${turnoSemanal}`);

              // Asignar a cada día de la semana
              for (const dayInfo of week.days) {
                const { day, dayOfWeek, dayName } = dayInfo;
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const esFeriado = feriadosChile.includes(dateStr);

                // DOMINGO
                if (dayOfWeek === 0) {
                  empleadosAsignados[empleado][day - 1] =
                    (empleado === "Sergio Castillo" || empleado === "Ignacio Aburto")
                      ? "DL" : "L";
                }
                // FERIADO (Sergio/Ignacio)
                else if (esFeriado && (empleado === "Sergio Castillo" || empleado === "Ignacio Aburto")) {
                  empleadosAsignados[empleado][day - 1] = "F";
                }
                // SÁBADO - Turno reducido
                else if (dayOfWeek === 6) {
                  // Si turno semanal es M2, sábado es M1 (jornada corta mañana)
                  // Si turno semanal es M1, sábado sigue M1
                  if (turnoSemanal === "M2" || turnoSemanal === "M2A" || turnoSemanal === "M2B") {
                    empleadosAsignados[empleado][day - 1] = "M1";
                  } else {
                    empleadosAsignados[empleado][day - 1] = turnoSemanal;
                  }
                }
                // LUNES A VIERNES - Mismo turno toda la semana
                else {
                  empleadosAsignados[empleado][day - 1] = turnoSemanal;
                }
              }
            }
          }

          console.log("Asignación semanal:", empleadosAsignados);

          // 3. PINTAR EN EL CALENDARIO
          filas.forEach((fila) => {
            const firstCell = fila.querySelector("td");
            if (!firstCell) return;
            const empleado = firstCell.textContent.replace(/⚠️/g, "").trim();
            if (empleado === "Encargado de Bitácora") return;

            const botones = fila.querySelectorAll("td button.calendar-day");
            botones.forEach((boton, index) => {
              const turnoAsignado = empleadosAsignados[empleado][index];
              if (turnoAsignado && turnoAsignado !== "") {
                actualizarBotonTurno(boton, turnoAsignado);
                if (turnoColorMapping[turnoAsignado]) {
                  boton.style.backgroundColor = turnoColorMapping[turnoAsignado];
                  boton.style.color = "#000";
                }
              }
            });
          });

          Swal.fire(
            "Éxito",
            "Turnos asignados usando patrones históricos de cada empleado.",
            "success"
          );

          guardarCalendarioEnLocalStorage();
          scheduleFirestoreUpdate();
        } catch (error) {
          console.error("Error en autoasignación:", error);
          Swal.fire(
            "Error",
            "No se pudieron asignar los turnos.",
            "error"
          );
        }
      });
    }

    // Navegación de meses
    const prevMonthButton = document.getElementById("prev-month");
    const nextMonthButton = document.getElementById("next-month");
    const todayButton = document.getElementById("today");

    if (prevMonthButton) {
      prevMonthButton.addEventListener("click", function () {
        guardarCalendarioEnLocalStorage();
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar(currentDate);
        subscribeCalendar();
      });
    }

    if (nextMonthButton) {
      nextMonthButton.addEventListener("click", function () {
        guardarCalendarioEnLocalStorage();
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar(currentDate);
        subscribeCalendar();
      });
    }

    if (todayButton) {
      todayButton.addEventListener("click", function () {
        guardarCalendarioEnLocalStorage();
        currentDate = new Date();
        renderCalendar(currentDate);
        subscribeCalendar();
      });
    }

    // Render inicial + suscripción + datos auxiliares
    renderCalendar(currentDate);
    subscribeCalendar();
    cargarListaCalendarios();
    cargarFotosEmpleados();

    // -----------------------------------------------------------------
    // Botones de turnos (TODOS los botones .btn-turno)
    // -----------------------------------------------------------------
    const turnosButtons = document.querySelectorAll(".btn-turno");

    turnosButtons.forEach((button) => {
      button.addEventListener("click", function () {
        if (!usuarioEsAdmin) return;

        if (selectedDays.length > 0) {
          const turno = this.getAttribute("data-turno");
          const color = this.getAttribute("data-color");

          selectedDays.forEach((dayBtn) => {
            if (turno === "V") {
              dayBtn.innerHTML = vacationIcon;
              dayBtn.style.backgroundColor = color;
              dayBtn.style.color = "#000";
              dayBtn.setAttribute("title", "Vacaciones");
            } else {
              dayBtn.textContent = turno;
              dayBtn.innerHTML = dayBtn.textContent; // por si había icono antes
              dayBtn.style.backgroundColor = color;
              dayBtn.style.color = "#000";
              dayBtn.removeAttribute("title");
            }
            // Quitamos la selección tras asignar
            dayBtn.classList.remove("selected");
          });

          lucide.createIcons();
          selectedDays = []; // Limpiamos la selección
          scheduleFirestoreUpdate();
        } else {
          Swal.fire({
            icon: "warning",
            title: "Sin selección",
            text: "Por favor, selecciona al menos una celda antes de asignar un turno."
          });
        }
      });
    });

    // -----------------------------------------------------------------
    // Botón Guardar calendario en Firestore
    // -----------------------------------------------------------------
    if (btnGuardar) {
      btnGuardar.addEventListener("click", function () {
        if (!usuarioEsAdmin) return;

        if (!todosLosDiasRellenos()) {
          Swal.fire({
            icon: "error",
            title: "Datos incompletos",
            text: "Debes rellenar todos los días en los calendarios antes de guardar."
          });
          return;
        }

        // Guardamos en local primero
        guardarCalendarioEnLocalStorage();

        // Para Firestore, usamos la función que obtiene el HTML completo
        const datos = obtenerDatosCalendario();
        const docRef = db.collection("calendarios").doc(datos.mes);

        docRef
          .get()
          .then((doc) => {
            if (doc.exists) {
              Swal.fire({
                icon: "question",
                title: "Ya existe un calendario",
                text: `¿Sobrescribir el calendario de ${datos.mes}?`,
                showCancelButton: true,
                confirmButtonText: "Sí, sobrescribir",
                cancelButtonText: "No"
              }).then((result) => {
                if (result.isConfirmed) {
                  docRef
                    .set(datos)
                    .then(() => {
                      Swal.fire(
                        "Sobrescrito",
                        "Calendario sobrescrito exitosamente.",
                        "success"
                      );
                      cargarListaCalendarios();
                    })
                    .catch((error) => {
                      console.error("Error al sobrescribir:", error);
                    });
                } else {
                  Swal.fire(
                    "Cancelado",
                    "No se sobrescribió el calendario.",
                    "info"
                  );
                }
              });
            } else {
              docRef
                .set(datos)
                .then(() => {
                  Swal.fire({
                    icon: "success",
                    title: "Calendario guardado",
                    text: "Calendario guardado exitosamente."
                  });
                  cargarListaCalendarios();
                })
                .catch((error) => {
                  console.error("Error al guardar:", error);
                });
            }
          })
          .catch((error) => {
            console.error("Error al validar existencia:", error);
          });
      });
    }

    // -----------------------------------------------------------------
    // Botón Cargar (vista previa en modal)
    // -----------------------------------------------------------------
    if (btnCargar) {
      btnCargar.addEventListener("click", function () {
        const selectMeses = document.getElementById("selectMeses");
        const mesSeleccionado = selectMeses ? selectMeses.value : "";

        if (!mesSeleccionado) {
          Swal.fire({
            icon: "warning",
            title: "Seleccione un mes",
            text: "Por favor, seleccione un mes guardado."
          });
          return;
        }

        db.collection("calendarios")
          .doc(mesSeleccionado)
          .get()
          .then((doc) => {
            if (doc.exists) {
              const datos = doc.data();
              modalContent.innerHTML = `
                <h3>Calendario General</h3>${datos.generalHTML || ""}
                <h3>Calendario Nocturno</h3>${datos.nocturnoHTML || ""}
                <h3>Calendario Feriados/Fines de Semana</h3>${datos.feriadosHTML || ""}
              `;
              modal.style.display = "block";
            } else {
              Swal.fire({
                icon: "error",
                title: "No encontrado",
                text: `No se encontró el calendario para ${mesSeleccionado}.`
              });
            }
          })
          .catch((error) => {
            console.error("Error al cargar el calendario:", error);
          });
      });
    }

    // -----------------------------------------------------------------
    // Botón Eliminar calendario
    // -----------------------------------------------------------------
    if (btnEliminar) {
      btnEliminar.addEventListener("click", function () {
        console.log("Clic en btnEliminar. Admin:", usuarioEsAdmin);
        if (!usuarioEsAdmin) return;

        const selectMeses = document.getElementById("selectMeses");
        const mesSeleccionado = selectMeses ? selectMeses.value : "";
        if (!mesSeleccionado) {
          Swal.fire({
            icon: "warning",
            title: "Seleccione un mes",
            text: "Por favor, seleccione un mes guardado para eliminar."
          });
          return;
        }

        Swal.fire({
          icon: "warning",
          title: "¿Eliminar Calendario?",
          text: `¿Estás seguro de eliminar el calendario de "${mesSeleccionado}"?`,
          showCancelButton: true,
          confirmButtonText: "Sí, eliminar",
          cancelButtonText: "No"
        }).then((result) => {
          if (result.isConfirmed) {
            db.collection("calendarios")
              .doc(mesSeleccionado)
              .delete()
              .then(() => {
                Swal.fire(
                  "Eliminado",
                  `El calendario de "${mesSeleccionado}" fue eliminado.`,
                  "success"
                );
                cargarListaCalendarios();
              })
              .catch((error) => {
                console.error("Error al eliminar calendario:", error);
              });
          } else {
            Swal.fire(
              "Cancelado", "No se eliminó el calendario.", "info"
            );
          }
        });
      });
    }

    // Cierre de modal de vista previa
    if (cerrarModal) {
      cerrarModal.addEventListener("click", function () {
        modal.style.display = "none";
      });
    }
    window.addEventListener("click", function (e) {
      if (e.target === modal) {
        modal.style.display = "none";
      }
    });

    // Modal Horarios
    if (btnVerHorarios) {
      btnVerHorarios.addEventListener("click", function () {
        modalHorarios.style.display = "block";
      });
    }
    if (cerrarHorarios) {
      cerrarHorarios.addEventListener("click", function () {
        modalHorarios.style.display = "none";
      });
    }
    window.addEventListener("click", function (e) {
      if (e.target === modalHorarios) {
        modalHorarios.style.display = "none";
      }
    });

    // Modal Estadísticas
    if (btnVerEstadisticas) {
      btnVerEstadisticas.addEventListener("click", function () {
        mostrarEstadisticas();
      });
    }
    if (cerrarEstadisticas) {
      cerrarEstadisticas.addEventListener("click", function () {
        modalEstadisticas.style.display = "none";
      });
    }
    window.addEventListener("click", function (e) {
      if (e.target === modalEstadisticas) {
        modalEstadisticas.style.display = "none";
      }
    });

    // Subida de fotos (solo admin)
    // Definir la lógica de subida como función independiente
    window.handlePhotoUpload = async function (inputElement) {
      if (inputElement.files && inputElement.files[0]) {
        const file = inputElement.files[0];
        const employeeCard = inputElement.closest(".employee-card");
        if (!employeeCard) {
          console.error("No se encontró la tarjeta del empleado.");
          return;
        }
        const employeeNameElement = employeeCard.querySelector(".employee-name");
        const employeeName = employeeNameElement
          ? employeeNameElement.textContent.trim()
          : "Empleado";

        const fileName = `${employeeName}_${Date.now()}_${file.name}`;

        const { data, error } = await supabase.storage
          .from("documentos-noc")
          .upload(fileName, file, { upsert: true });

        if (error) {
          console.error("Error al subir foto:", error);
          return;
        }

        const pathUploaded = data.path || fileName;
        const { data: urlData, error: urlError } = supabase.storage
          .from("documentos-noc")
          .getPublicUrl(pathUploaded);

        if (urlError) {
          console.error("Error al obtener URL:", urlError);
          return;
        }
        if (!urlData) {
          console.error("No se recibió URL pública.");
          return;
        }

        const finalURL = `${urlData.publicUrl}?ts=${Date.now()}`;
        const imgElement = employeeCard.querySelector(".employee-photo");
        if (imgElement) {
          imgElement.src = finalURL;
        }

        db.collection("empleados")
          .doc(employeeName)
          .set({ photoURL: finalURL }, { merge: true })
          .then(() => {
            console.log(`Foto actualizada para ${employeeName}`);
            Swal.fire("Éxito", "Foto actualizada correctamente", "success");
          })
          .catch((error) => {
            console.error("Error guardando URL:", error);
          });
      } else {
        console.warn("No se seleccionó ningún archivo.");
      }
    };

    // Subida de fotos (solo admin)
    window.attachPhotoUploadListeners = function () {
      if (!usuarioEsAdmin) return;
      console.log("Adjuntando listeners de fotos (attachPhotoUploadListeners)...");

      const uploadButtons = document.querySelectorAll(".upload-photo-btn");
      uploadButtons.forEach((button) => {
        const newBtn = button.cloneNode(true);
        if (button.parentNode) {
          button.parentNode.replaceChild(newBtn, button);
        }
        newBtn.addEventListener("click", () => {
          const employeeCard = newBtn.closest(".employee-card");
          if (!employeeCard) return;
          const photoInput = employeeCard.querySelector(".photo-input");
          if (photoInput) photoInput.click();
        });
      });

      const photoInputs = document.querySelectorAll(".photo-input");
      photoInputs.forEach((input) => {
        const newInput = input.cloneNode(true);
        if (input.parentNode) {
          input.parentNode.replaceChild(newInput, input);
        }
        newInput.addEventListener("change", function () {
          window.handlePhotoUpload(this);
        });
      });
    };

    // Llamada inicial
    window.attachPhotoUploadListeners();


    // Botón de modo oscuro
    const themeToggle = document.querySelector(".theme-toggle");
    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");
      });
    }

    // Botón de sugerencias (solo admin)
    const btnVerSugerencias = document.getElementById("btnVerSugerencias");
    const modalSugerencias = document.getElementById("modalSugerencias");
    const cerrarSugerencias = document.getElementById("cerrarSugerencias");
    const listaSugerencias = document.getElementById("listaSugerencias");

    if (btnVerSugerencias && modalSugerencias && cerrarSugerencias && listaSugerencias) {
      btnVerSugerencias.addEventListener("click", () => {
        if (!usuarioEsAdmin) return;
        const sugerencias = generarSugerencias();
        listaSugerencias.innerHTML = sugerencias
          .map((s) => `<li>${s}</li>`)
          .join("");
        modalSugerencias.style.display = "block";
      });

      cerrarSugerencias.addEventListener("click", () => {
        modalSugerencias.style.display = "none";
      });

      window.addEventListener("click", (e) => {
        if (e.target === modalSugerencias) {
          modalSugerencias.style.display = "none";
        }
      });
    }



    // -----------------------------------------------------------------------------
    // 12) GENERAR SUGERENCIAS
    // -----------------------------------------------------------------------------
    function generarSugerencias() {
      const conteoTurnos = calcularEstadisticas();
      const totalTurnos = Object.values(conteoTurnos).reduce((a, b) => a + b, 0);
      const promedio =
        Object.keys(conteoTurnos).length > 0
          ? totalTurnos / Object.keys(conteoTurnos).length
          : 0;

      const sugerencias = [];

      for (const [turno, cantidad] of Object.entries(conteoTurnos)) {
        if (promedio === 0) break;

        if (cantidad > promedio * 1.5) {
          sugerencias.push(
            `El turno "${turno}" se asigna con mucha frecuencia (${cantidad} veces). Considera re-distribuirlo.`
          );
        } else if (cantidad < promedio * 0.5) {
          sugerencias.push(
            `El turno "${turno}" tiene pocas asignaciones (${cantidad} veces). Podrías equilibrarlo con otros turnos.`
          );
        }
      }

      if (sugerencias.length === 0) {
        sugerencias.push(
          "La distribución de turnos se ve bastante equilibrada en este mes."
        );
      }

      return sugerencias;
    }





    // -----------------------------------------------------------------------------
    // CARGAR FOTOS AL INICIO
    // -----------------------------------------------------------------------------
    async function loadEmployeePhotos() {
      const cards = document.querySelectorAll('.employee-card');

      try {
        const snapshot = await db.collection('empleados').get();
        const photosMap = {};
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.photoURL) {
            photosMap[doc.id] = data.photoURL;
          }
        });

        cards.forEach(card => {
          const nameElement = card.querySelector('.employee-name');
          if (nameElement) {
            const name = nameElement.textContent.trim();
            if (photosMap[name]) {
              const img = card.querySelector('.employee-photo');
              if (img) img.src = photosMap[name];
            }
          }
        });

        // Re-adjuntar listeners de fotos ya que las tarjetas existen
        if (typeof window.attachPhotoUploadListeners === 'function') {
          window.attachPhotoUploadListeners();
        }
      } catch (error) {
        console.error('Error cargando fotos:', error);
      }
    }

    document.addEventListener('DOMContentLoaded', loadEmployeePhotos);

    function fixShiftTextColors() {
      const buttons = document.querySelectorAll("button.calendar-day");
      buttons.forEach(btn => {
        // Si tiene un color de fondo inline (asignado), poner texto negro
        if (btn.style.backgroundColor && btn.style.backgroundColor !== "") {
          btn.style.color = "#000";
        }
      });
    }

    // -----------------------------------------------------------------------------
    // 12) FUNCIONES DE CIERRE DE MES (LOCK)
    // -----------------------------------------------------------------------------

    // Función para actualizar la UI según estado de bloqueo
    function updateLockUI() {
      const lockIndicator = document.getElementById("lockedIndicator");
      const btnToggleLock = document.getElementById("btnToggleLock");

      // Mostrar botón de candado solo si es superadmin (re-verificar)
      const cachedRole = localStorage.getItem("userRole");
      console.log("updateLockUI - Current Role:", cachedRole); // DEBUG: Verificar rol
      if (cachedRole === "superadmin") {
        if (btnToggleLock) {
          btnToggleLock.style.display = "inline-flex";
          btnToggleLock.innerHTML = isMonthLocked
            ? `<i data-lucide="unlock"></i> Abrir Mes`
            : `<i data-lucide="lock"></i> Cerrar Mes`;

          // Estilos dinámicos preservando la clase base 'btn-horarios'
          btnToggleLock.className = "btn-horarios superadmin-only";

          if (isMonthLocked) {
            // Mes Cerrado -> Botón azul para desbloquear
            btnToggleLock.style.backgroundColor = "#7796cb";
            btnToggleLock.style.color = "#fff";
          } else {
            // Mes Abierto -> Botón naranja/amarillo para cerrar
            btnToggleLock.style.backgroundColor = "#f39c12";
            btnToggleLock.style.color = "#fff";
          }
        }
      }

      if (isMonthLocked) {
        document.body.classList.add("locked-mode");
        if (lockIndicator) lockIndicator.style.display = "flex";
      } else {
        document.body.classList.remove("locked-mode");
        if (lockIndicator) lockIndicator.style.display = "none";
      }

      lucide.createIcons();
    }



    // Función Toggle Lock (Superadmin)
    async function toggleMonthLock() {
      const currentMonthDisplay = document.getElementById("current-month").textContent.trim();
      const calendarKey = obtenerClaveMes(currentDate); // Usar clave única: "calendar_v3_2026-1"

      // Confirmación
      const action = isMonthLocked ? "ABRIR" : "CERRAR";
      const result = await Swal.fire({
        title: `¿${action} el mes de ${currentMonthDisplay}?`,
        text: isMonthLocked
          ? "Al abrirlo, los administradores podrán volver a editar los turnos."
          : "Al cerrarlo, nadie podrá editar turnos hasta que se vuelva a abrir.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: `Sí, ${action}`,
        cancelButtonText: "Cancelar"
      });

      if (!result.isConfirmed) return;

      // Cambiar el estado local inmediatamente
      isMonthLocked = !isMonthLocked;
      updateLockUI();

      // Guardar en localStorage inmediatamente
      guardarCalendarioEnLocalStorage();

      // Actualizar en Firestore (COMPATIBILIDAD: Usar nombre de mes para que el listener lo detecte)
      try {
        await db.collection("calendarios").doc(currentMonthDisplay).set({
          locked: isMonthLocked
        }, { merge: true });

        Swal.fire("Éxito", `El mes ha sido ${action === "CERRAR" ? "cerrado" : "abierto"}.`, "success");

      } catch (error) {
        console.error("Error al cambiar estado de bloqueo:", error);
        Swal.fire("Error", "No se pudo actualizar el estado del mes.", "error");

        // Revertir cambio local si falló Firestore
        isMonthLocked = !isMonthLocked;
        updateLockUI();
      }
    }

    // Listener para el botón de bloqueo
    // Listener para el botón de bloqueo
    const btnToggleLock = document.getElementById("btnToggleLock");
    if (btnToggleLock) {
      btnToggleLock.addEventListener("click", toggleMonthLock);
    }

    // INITIALIZE FLOATING PALETTE (Optimized)
    function initFloatingPalette() {
      const btnToggle = document.getElementById('btnToggleFloating');
      const turnosSection = document.querySelector('.turnos-section');
      const header = turnosSection ? turnosSection.querySelector('.turnos-header') : null;

      if (!btnToggle || !turnosSection || !header) return;

      let isFloating = false;
      let currentX = 0;
      let currentY = 0;
      let initialX = 0;
      let initialY = 0;
      let xOffset = 0;
      let yOffset = 0;
      let isDragging = false;
      let animationFrameId = null;

      // Toggle Floating Mode
      btnToggle.addEventListener('click', () => {
        turnosSection.classList.toggle('floating');
        isFloating = turnosSection.classList.contains('floating');
        btnToggle.classList.toggle('active');

        if (isFloating) {
          // Reset offsets when enabling
          xOffset = 0;
          yOffset = 0;

          // Initial Position (Fixed via CSS usually, but here JS sets it)
          turnosSection.style.top = '120px';
          turnosSection.style.right = '20px';
          turnosSection.style.left = 'auto'; // Reset left
          turnosSection.style.transform = `translate3d(0px, 0px, 0)`;

          btnToggle.innerHTML = '<i data-lucide="minimize-2"></i>';
        } else {
          // Reset
          turnosSection.style.top = '';
          turnosSection.style.right = '';
          turnosSection.style.left = '';
          turnosSection.style.transform = 'none';

          btnToggle.innerHTML = '<i data-lucide="maximize-2"></i>';
        }
        if (window.lucide) lucide.createIcons();
      });

      // Drag Start
      header.addEventListener('mousedown', dragStart);

      // Drag End (Global)
      document.addEventListener('mouseup', dragEnd);
      document.addEventListener('mousemove', drag);

      function dragStart(e) {
        if (!isFloating) return;
        if (e.target.closest('button')) return;

        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;

        isDragging = true;
        turnosSection.classList.add('dragging'); // Trigger CSS optimization
        header.style.cursor = 'grabbing';
      }

      function dragEnd(e) {
        if (!isDragging) return;
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
        turnosSection.classList.remove('dragging'); // Re-enable effects
        header.style.cursor = 'move';

        cancelAnimationFrame(animationFrameId);
        animationFrameId = null; // FIX: Reset ID so next drag starts fresh
      }

      function drag(e) {
        if (isDragging) {
          e.preventDefault();

          currentX = e.clientX - initialX;
          currentY = e.clientY - initialY;

          xOffset = currentX;
          yOffset = currentY;

          // Use requestAnimationFrame for smooth rendering
          if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(setTranslate);
          }
        }
      }

      function setTranslate() {
        turnosSection.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
        animationFrameId = null;
      }
    }

    // Call it
    initFloatingPalette();

    // -----------------------------------------------------------------------------
    // 13) SISTEMA DE BACKUP JSON (GENERAL ONLY)
    // -----------------------------------------------------------------------------

    // Exportar - V2 (Color Aware)
    const btnExportarGeneral = document.getElementById("btnExportarGeneral");
    if (btnExportarGeneral) {
      btnExportarGeneral.addEventListener("click", () => {
        const currentMonthElement = document.getElementById("current-month");
        const generalTable = document.getElementById("general-calendar");
        const mesTexto = currentMonthElement.textContent.trim().replace(/\s+/g, "_");

        const backupData = {
          type: "backup_general_v2", // V2
          version: "2.0",
          mes: currentMonthElement.textContent,
          timestamp: new Date().toISOString(),
          assignments: {}
        };

        // Extraer solo del General Calendar
        if (generalTable) {
          generalTable.querySelectorAll("tbody tr").forEach(row => {
            const nameCell = row.querySelector("td:first-child");
            if (!nameCell) return;
            const name = nameCell.textContent.replace(/\s*\(Ex\)\s*$/, "").trim();
            if (name === "Encargado de Bitácora" || name === "Cristian Oyarzo") return;

            const shifts = {};
            row.querySelectorAll("button.calendar-day").forEach(btn => {
              const day = btn.getAttribute("data-day");
              let shift = btn.textContent.trim();
              let color = btn.style.backgroundColor;

              // Preservar vacaciones e íconos y color
              const isVacation = btn.querySelector('[data-lucide="tree-palm"]') || btn.querySelector('svg.lucide-tree-palm');
              if (isVacation) shift = "V";

              if (shift) {
                // Save as Object: { code: "M1", color: "rgb(0,0,0)" }
                shifts[day] = { code: shift, color: color };
              }
            });

            if (Object.keys(shifts).length > 0) {
              backupData.assignments[name] = shifts;
            }
          });
        }

        // Crear Blob y Descargar
        const dataStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Respaldo_General_${mesTexto}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Swal.fire({
          icon: 'success',
          title: 'Respaldo Generado (V2)',
          text: 'Se ha descargado el archivo con los colores exactos.',
          timer: 2000,
          showConfirmButton: false
        });
      });
    }

    // Importar
    const btnImportarGeneral = document.getElementById("btnImportarGeneral");
    const jsonInput = document.getElementById("jsonInput");

    if (btnImportarGeneral && jsonInput) {
      btnImportarGeneral.addEventListener("click", () => {
        jsonInput.click();
      });

      jsonInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const jsonData = JSON.parse(event.target.result);

            // Validaciones Básicas (+ V2)
            const isValid = (jsonData.type === "backup_general" || jsonData.type === "backup_general_v2");
            if (!isValid || !jsonData.assignments) {
              throw new Error("Formato de archivo inválido.");
            }

            // Advertencia de Sobreescritura
            Swal.fire({
              title: '¿Restaurar Turnos Generales?',
              text: `Se cargarán los turnos del archivo "${file.name}". Esto sobrescribirá lo que hay en pantalla (Solo Planilla General).`,
              icon: 'warning',
              showCancelButton: true,
              confirmButtonColor: '#3498db',
              cancelButtonColor: '#d33',
              confirmButtonText: 'Sí, Restaurar'
            }).then((result) => {
              if (result.isConfirmed) {
                // Usar V2 helper (Color Aware)
                aplicarAsignacionesV2(jsonData.assignments);

                // Recalcular
                calcularHorasExtras(currentDate);
                guardarCalendarioEnLocalStorage();
                scheduleFirestoreUpdate(); // Auto-Guardar en Base de Datos

                Swal.fire('Restaurado!', 'Los turnos se han cargado y guardado automáticamente.', 'success');
              }
              // Reset input
              jsonInput.value = '';
            });

          } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No se pudo leer el archivo: ' + error.message, 'error');
            jsonInput.value = '';
          }
        };
        reader.readAsText(file);
      });
    }

  });
}); // Close DOMContentLoaded

// Nueva función de aplicación con soporte de colores V2
function aplicarAsignacionesV2(assignments) {
  const table = document.getElementById("general-calendar");
  if (!table) return;

  // Re-fetch current employees list just in case
  const empleadosActuales = new Set((window.empleados || []).map(e => e.nombre));

  Object.entries(assignments).forEach(([name, shifts]) => {
    // Strict Scope: Only find row in General Calendar
    const row = Array.from(table.querySelectorAll("tbody tr")).find(tr =>
      tr.querySelector("td")?.textContent.trim() === name
    );

    if (row) {
      Object.entries(shifts).forEach(([day, shiftData]) => {
        const btn = row.querySelector(`button[data-day="${day}"]`);
        if (btn) {
          // Handle v1 (string) vs v2 (object)
          const code = (typeof shiftData === 'object') ? shiftData.code : shiftData;
          const color = (typeof shiftData === 'object') ? shiftData.color : null;

          // Apply standard logic first (text code)
          actualizarBotonTurno(btn, code);

          // Force Exact Color Override if captured
          if (color) {
            btn.style.backgroundColor = color;
            btn.style.color = "#000";
          }
        }
      });
    }
  });
}
