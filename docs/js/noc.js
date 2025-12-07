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

const auth = window.auth;
const db = window.db;

if (!auth || !db) {
  console.error("Firebase auth/db not initialized.");
  document.addEventListener("DOMContentLoaded", () => {
    Swal.fire({
      icon: "error",
      title: "Error de Carga",
      text: "No se pudo conectar con el sistema de autenticación. Por favor, deshabilita extensiones de privacidad/bloqueo de anuncios y recarga la página.",
      footer: "Detalle técnico: Firebase no inicializado."
    });
  });
}

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

async function cargarEmpleadosDeFirestore() {
  try {
    const doc = await db.collection("Config").doc("empleados_noc").get();
    if (doc.exists) {
      const data = doc.data();
      if (data.lista && Array.isArray(data.lista)) {
        // Mapear al formato que usa noc.js (nombre, turnos: [])
        // Nota: noc.js parece usar 'turnos' en memoria, pero si queremos persistencia de turnos
        // eso es otra historia. Aquí solo estamos cargando la LISTA de nombres base.
        // Si noc.js guarda turnos en otra colección, esto está bien.
        // Asumimos que 'empleados' en noc.js es la estructura base para renderizar.
        return data.lista.map(e => ({ nombre: e.nombre, turnos: [] }));
      }
    }
  } catch (error) {
    console.error("Error al cargar empleados de Firestore:", error);
  }

  // Valores por defecto si falla
  return [
    { nombre: "Sergio Castillo", turnos: [] },
    { nombre: "Ignacio Aburto", turnos: [] },
    { nombre: "Claudio Bustamante", turnos: [] },
    { nombre: "Julio Oliva", turnos: [] },
    { nombre: "Gabriel Trujillo", turnos: [] }
  ];
}

// Inicializar carga
// Inicializar carga
Promise.all([cargarEmpleadosDeFirestore(), cargarFeriados()]).then(([lista]) => {
  empleados = lista;
  // console.log("Datos iniciales cargados (Empleados y Feriados)");
  // Disparar evento personalizado
  document.dispatchEvent(new CustomEvent('datosCargados'));

  // Iniciar calendario si el DOM está listo, o esperar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (typeof renderCalendar === 'function') renderCalendar();
    });
  } else {
    if (typeof renderCalendar === 'function') renderCalendar();
  }
});

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
  // Se agrega prefijo v2 para invalidar caché anterior y forzar recarga con nuevos feriados
  return `calendar_v2_${date.getFullYear()}-${date.getMonth() + 1}`;
}

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

          // Mostrar link de Registros para superadmins
          if (isSuperAdmin) {
            const liRegistros = document.getElementById("li-registros");
            if (liRegistros) {
              liRegistros.style.display = "block";
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
  // Si tienen turnos asignados, LAS MANTENEMOS para no perder historia
  for (const [nombre, html] of Object.entries(existingRows)) {
    // Crear una tabla temporal para parsear correctamente el TR
    const tempTable = document.createElement('table');
    const tempTbody = document.createElement('tbody');
    tempTable.appendChild(tempTbody);
    tempTbody.innerHTML = html;

    const row = tempTbody.querySelector('tr');
    if (!row) continue;

    const buttons = row.querySelectorAll('button');
    let tieneTurnos = false;

    buttons.forEach(btn => {
      const texto = btn.textContent.trim();
      // Si tiene texto y no es solo "DL" automático (o vacío), consideramos que tiene datos
      if (texto && texto !== "" && texto !== "DL") {
        tieneTurnos = true;
      }
      // También si tiene icono de vacaciones (aunque el texto sea V)
      if (btn.querySelector('svg') || btn.querySelector('i')) {
        tieneTurnos = true;
      }
    });

    if (tieneTurnos) {
      // Marcar visualmente como eliminado
      const firstCell = row.querySelector('td');
      if (firstCell) {
        firstCell.style.color = '#ef4444'; // Rojo suave
        firstCell.style.fontStyle = 'italic';
        // Agregar etiqueta si no existe ya
        if (!firstCell.textContent.includes('(Ex)')) {
          firstCell.innerHTML += ' <span style="font-size:0.8em; opacity:0.8;" title="Empleado Eliminado">(Ex)</span>';
        }
      }
      newBodyHTML += row.outerHTML;
    }
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

// Renderiza el calendario. Primero intenta cargar datos guardados en localStorage;
// si no existen o están incompletos, se construye desde cero.
// Renderiza el calendario. Primero intenta cargar datos guardados en localStorage;
// si no existen o están incompletos, se construye desde cero.
function renderCalendar(date) {
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

      // 4. Restaurar empleados eliminados si tienen historia
      restaurarEmpleadosEliminados(data.assignments);

    } catch (e) {
      console.error("Error leyendo localStorage:", e);
    }
  }

  if (usuarioEsAdmin) { attachAdminCellListeners(); }
  lucide.createIcons();
  fixShiftTextColors();
  calcularHorasExtras(date);
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

  Object.entries(assignments).forEach(([name, shifts]) => {
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
  if (shift === "V") {
    btn.innerHTML = '<i data-lucide="tree-palm"></i>';
  }

  // Reset clases
  btn.className = "calendar-day w-full h-full";

  // Aplicar clases según turno
  if (shift === "DL") btn.classList.add("domingo-libre");
  else if (shift === "F") btn.classList.add("feriado");
  else if (shift === "N") btn.classList.add("nocturno");
  else if (shift === "L") btn.classList.add("dia-libre");
  else if (shift === "V") btn.classList.add("vacaciones"); // Asumiendo que existe o se maneja genérico
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

  // ---------- CALENDARIO NOCTURNO (CRISTIAN) ----------
  let nocturnoHTML = "";
  const cristianTurnos = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const fecha = new Date(year, month, day);
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`;
    const esFeriado = feriadosChile.includes(dateStr);
    const dayOfWeek = fecha.getDay();

    if (esFeriado) {
      cristianTurnos[day - 1] = "F";
    } else if (dayOfWeek === 0) {
      cristianTurnos[day - 1] = "DL";
    } else if (dayOfWeek === 6) {
      cristianTurnos[day - 1] = "L";
    } else {
      cristianTurnos[day - 1] = "N";
    }
  }

  nocturnoHTML += `<tr><td class="text-left p-2">Cristian Oyarzo</td>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const turno = cristianTurnos[day - 1];
    let turnoClass = "";

    if (turno === "DL") turnoClass = "domingo-libre";
    else if (turno === "L") turnoClass = "dia-libre";
    else if (turno === "N") turnoClass = "nocturno";

    const claseFeriado = turno === "F" ? "feriado" : "";

    nocturnoHTML += `
      <td>
        <button class="calendar-day w-full h-full ${turnoClass} ${claseFeriado}">
          ${turno}
        </button>
      </td>
    `;
  }
  nocturnoHTML += `</tr>`;

  const tbodyNocturno = tablaNocturno.querySelector("tbody");
  if (tbodyNocturno) {
    tbodyNocturno.innerHTML = nocturnoHTML;
  } else {
    console.error("No se encontró el tbody de la tabla nocturna");
  }

  // ---------- CALENDARIO FERIADOS / FINES DE SEMANA ----------
  // SOLO UNA FILA: "Turno Nocturno"
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

  // Guardar en localStorage una vez renderizado todo
  guardarCalendarioEnLocalStorage();
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
const SHIFT_MAP = {
  "S": "Sergio Castillo",
  "I": "Ignacio Aburto",
  "M": "Manuel (Demo)", // Ejemplo de escalabilidad
  "J": "Julio (Demo)"
};

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

  // Renderizar la nueva tabla
  renderOvertimeTable(reportData, date);

  return reportData; // Retornar para uso externo (exportación)
}

// Renderizar la Nueva Tabla de Reporte (Premium Dashboard)
function renderOvertimeTable(data, date) {
  const container = document.getElementById("overtime-report-container");
  if (!container) return;

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

  const validEntries = [];
  const empleadosPrincipales = ["Sergio Castillo", "Ignacio Aburto"];

  Object.entries(data).forEach(([name, stats]) => {
    if (stats.count > 0 || empleadosPrincipales.includes(name)) {
      validEntries.push({ name, ...stats });
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
  let html = `
    <div class="report-header">
      <div class="report-title-group">
        <h3>
          <i data-lucide="bar-chart-2" style="color: #7796cb;"></i>
          Control de Horas Extras
        </h3>
        <span class="report-period">
          <i data-lucide="calendar" style="width: 14px; display: inline-block; vertical-align: middle;"></i> 
          ${periodoStr}
        </span>
      </div>
      <button onclick="exportarReporteHorasExtras()" class="btn-premium-export">
        <i data-lucide="file-down"></i> Exportar PDF
      </button>
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

      <!-- Card 2: Top Contributor -->
      <div class="summary-card accent-blue">
        <div class="card-header">
          <div class="card-icon"><i data-lucide="award"></i></div>
          <span class="card-label">Mayor Colaborador</span>
        </div>
        <div class="card-value" style="font-size: 1.5rem;">${topContributorName.split(" ")[0]}</div>
        <div class="card-subtext">${topContributorHours > 0 ? topContributorHours + ' horas registradas' : 'Sin registros'}</div>
      </div>

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
  html += `
    <div class="premium-table-container">
      <table class="premium-table">
        <thead>
          <tr>
            <th style="width: 40%;">Empleado</th>
            <th style="width: 20%; text-align: center;">Turnos</th>
            <th style="width: 20%; text-align: center;">Horas</th>
            <th style="width: 20%; text-align: center;">Estado</th>
          </tr>
        </thead>
        <tbody>
  `;

  validEntries.forEach(entry => {
    const initials = entry.name.split(" ").map(n => n[0]).join("").substring(0, 2);

    // Determinar badge
    let badgeClass = "normal";
    let badgeText = "Normal";
    let icon = "check-circle"; // default

    if (entry.hours >= 20) {
      badgeClass = "critical";
      badgeText = "Crítico";
      icon = "alert-circle";
    } else if (entry.hours >= 10) {
      badgeClass = "high";
      badgeText = "Alto";
      icon = "alert-triangle";
    }

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

  container.innerHTML = html;

  // Refrescar iconos
  if (window.lucide) {
    lucide.createIcons();
  }
}

// Expose globally for onclick
window.exportarReporteHorasExtras = exportarReporteHorasExtras;

// -----------------------------------------------------------------------------
// EXPORTAR REPORTE PDF (HORAS EXTRAS)
// -----------------------------------------------------------------------------
async function exportarReporteHorasExtras() {
  if (!window.jspdf) {
    Swal.fire("Error", "Librería PDF no cargada.", "error");
    return;
  }

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

    // ---------------------------------------------------------
    // 1. ENCABEZADO CORPORATIVO
    // ---------------------------------------------------------
    const colorPrimary = [44, 62, 80];
    const colorBg = [245, 247, 250];

    // Fondo del header
    doc.setFillColor(...colorPrimary);
    doc.rect(0, 0, pageWidth, 40, 'F');

    // Título Principal
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("REPORTE DE HORAS EXTRAS", 14, 25);

    // Subtítulo / Departamento
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(200, 200, 200);
    doc.text("DEPARTAMENTO DE OPERACIONES NOC", 14, 32);

    // Logo
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text("NOC", pageWidth - 25, 25, { align: 'right' });

    // ---------------------------------------------------------
    // 2. RESUMEN EJECUTIVO
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
          stats.hours >= 20 ? "CRÍTICO" : (stats.hours >= 10 ? "ALTO" : "NORMAL")
        ]);
      }
    });

    // Dibujar cajitas de resumen
    const startY = 50;
    const boxWidth = (pageWidth - 28 - 10) / 3;
    const boxHeight = 25;

    const drawCard = (x, label, value) => {
      doc.setFillColor(...colorBg);
      doc.setDrawColor(200, 200, 200);
      doc.roundedRect(x, startY, boxWidth, boxHeight, 3, 3, 'FD');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(...colorPrimary);
      doc.text(value.toString(), x + 10, startY + 12);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(label.toUpperCase(), x + 10, startY + 20);
    };

    drawCard(14, "Total Horas", totalHoras + " hrs");
    drawCard(14 + boxWidth + 5, "Total Turnos", totalTurnos);
    drawCard(14 + (boxWidth + 5) * 2, "Mayor Colaborador", topEmp.split(" ")[0]);

    // Información del Periodo
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...colorPrimary);
    doc.text("DETALLE DEL PERIODO", 14, startY + boxHeight + 15);
    doc.setFont("helvetica", "normal");
    doc.text(`Rango: ${periodoStr}`, 14, startY + boxHeight + 22);
    doc.text(`Generado: ${fechaReporte}`, 14, startY + boxHeight + 27);

    // ---------------------------------------------------------
    // 3. TABLA DE DETALLE
    // ---------------------------------------------------------
    doc.autoTable({
      startY: startY + boxHeight + 35,
      head: [['EMPLEADO', 'TURNOS', 'HORAS TOTALES', 'ESTADO']],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 6, lineColor: [230, 230, 230], lineWidth: 0.1 },
      headStyles: { fillColor: colorPrimary, textColor: 255, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { textColor: 50 },
      columnStyles: {
        0: { cellWidth: 'auto', fontStyle: 'bold' },
        1: { halign: 'center', cellWidth: 30 },
        2: { halign: 'center', cellWidth: 40 },
        3: { halign: 'center', cellWidth: 40, fontStyle: 'bold' }
      },
      alternateRowStyles: { fillColor: [250, 252, 255] },
      didParseCell: function (data) {
        if (data.section === 'body' && data.column.index === 3) {
          const text = data.cell.raw;
          if (text === 'CRÍTICO') data.cell.styles.textColor = [231, 76, 60];
          else if (text === 'ALTO') data.cell.styles.textColor = [241, 196, 15];
          else data.cell.styles.textColor = [46, 204, 113];
        }
      }
    });

    // -----------------------------------------------------------------------------
    // 4. PIE DE PÁGINA (Sin firmas)
    // -----------------------------------------------------------------------------
    const finalY = doc.lastAutoTable.finalY || 150;

    // Línea de cierre
    doc.setDrawColor(...colorPrimary);
    doc.setLineWidth(0.5);
    doc.line(14, finalY + 10, pageWidth - 14, finalY + 10);

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Este documento es generado automáticamente por el sistema de gestión NOC.", 14, finalY + 18);
    doc.text("Confidencial - Uso Interno", pageWidth - 14, finalY + 18, { align: 'right' });

    // Guardar
    doc.save(`Reporte_NOC_${yearReport}_${monthReport + 1}.pdf`);

  } catch (error) {
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
// 7) GRÁFICOS CON CHART.JS
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

        // Sincronizar empleados después de cargar desde Firestore
        // sincronizarTablasConEmpleados(); // Function not defined, causing crash

        lucide.createIcons();
        // fixShiftTextColors(); // Removed: function not defined
        if (usuarioEsAdmin) {
          attachAdminCellListeners();
        }

        // Recalcular horas extras tras cargar el DOM
        calcularHorasExtras(currentDate);

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
          title: "Analizando turnos...",
          text: "Función en Beta, puede contener errores. Esto puede tardar unos segundos.",
          showConfirmButton: false,
          allowOutsideClick: false,
          willOpen: () => {
            Swal.showLoading();
          }
        });

        try {
          const turnoColorMapping = {
            // Turnos normales
            M0: "#648c9b",
            M0A: "#7b69a5",
            M1: "#557a5f",
            M1A: "#c49f87",
            M1B: "#ffaaa5",
            M2: "#ffcc99",
            M2A: "#d4a5a5",
            M2B: "#b5e7a0",
            M3: "#996a7f",
            V: "#88C0A6",
            L: "#8FBCBB",
            DL: "#D77A7A",
            N: "#cccccc",
            // Turnos especiales feriados/fines de semana
            S: "#4A90E2",
            I: "#2C3E50"
          };

          const turnosDisponibles = [
            "M0",
            "M0A",
            "M1",
            "M1A",
            "M1B",
            "M2",
            "M2A",
            "M2B",
            "M3",
            "V"
          ];

          const currentMonth = document
            .getElementById("current-month")
            .textContent.trim();
          // console.log("Mes actual detectado:", currentMonth);

          const snapshot = await db.collection("calendarios").get();
          let historialTurnos = {};
          snapshot.forEach((doc) => {
            historialTurnos[doc.id] = doc.data();
          });
          // console.log("Historial de turnos:", historialTurnos);

          const year = currentDate.getFullYear();
          const month = currentDate.getMonth();
          const lastDay = new Date(year, month + 1, 0);
          const daysInMonth = lastDay.getDate();

          const tabla = document
            .getElementById("general-calendar")
            .querySelector("tbody");
          const filas = tabla.querySelectorAll("tr");

          let empleadosAsignados = {};

          // Asignación inicial por empleado usando Markov
          for (let fila of filas) {
            const firstCell = fila.querySelector("td");
            if (!firstCell) continue;

            const empleado = firstCell.textContent.trim();
            if (empleado === "Encargado de Bitácora") continue;

            empleadosAsignados[empleado] = new Array(daysInMonth).fill("");

            let matriz = await obtenerMatrizTransiciones(empleado);

            for (let day = 1; day <= daysInMonth; day++) {
              const dateObj = new Date(year, month, day);

              // Domingo: DL para Sergio/Ignacio, L para el resto
              if (dateObj.getDay() === 0) {
                empleadosAsignados[empleado][day - 1] =
                  empleado === "Sergio Castillo" ||
                    empleado === "Ignacio Aburto"
                    ? "DL"
                    : "L";
              } else {
                if (day > 1) {
                  let turnoAnterior = empleadosAsignados[empleado][day - 2];
                  let turnoElegido = elegirSiguienteTurnoMarkov(
                    matriz,
                    turnoAnterior,
                    turnosDisponibles
                  );
                  empleadosAsignados[empleado][day - 1] = turnoElegido;
                } else {
                  empleadosAsignados[empleado][day - 1] =
                    turnosDisponibles[
                    Math.floor(Math.random() * turnosDisponibles.length)
                    ];
                }
              }
            }
          }

          // console.log("Asignación inicial:", empleadosAsignados);

          // Reglas adicionales para M1 / M1B: no más de 1 por semana
          for (let empleado in empleadosAsignados) {
            let asignacion = empleadosAsignados[empleado];
            let weekStart = 0;

            while (weekStart < asignacion.length) {
              let weekEnd = weekStart;
              while (weekEnd < asignacion.length) {
                let dia = weekEnd + 1;
                let fecha = new Date(year, month, dia);
                if (fecha.getDay() === 0) {
                  weekEnd++;
                  break;
                }
                weekEnd++;
              }

              let countM1 = 0,
                countM1B = 0;
              for (let i = weekStart; i < weekEnd; i++) {
                let turno = asignacion[i];
                if (turno === "M1") countM1++;
                if (turno === "M1B") countM1B++;
              }

              let total = countM1 + countM1B;
              if (total > 1) {
                let extra = total - 1;
                for (let i = weekStart; i < weekEnd && extra > 0; i++) {
                  if (asignacion[i] === "M1" || asignacion[i] === "M1B") {
                    let alternativas = turnosDisponibles.filter(
                      (t) => t !== "M1" && t !== "M1B"
                    );
                    asignacion[i] =
                      alternativas[
                      Math.floor(Math.random() * alternativas.length)
                      ];
                    extra--;
                  }
                }
              }

              weekStart = weekEnd;
            }
          }

          console.log(
            "Asignación final tras reglas adicionales:",
            empleadosAsignados
          );

          // Pintar en el calendario general
          filas.forEach((fila) => {
            const firstCell = fila.querySelector("td");
            if (!firstCell) return;
            const empleado = firstCell.textContent.trim();
            if (empleado === "Encargado de Bitácora") return;

            const botones = fila.querySelectorAll("td button.calendar-day");
            botones.forEach((boton, index) => {
              const turnoAsignado = empleadosAsignados[empleado][index];
              if (turnoAsignado && turnoAsignado !== "") {
                if (turnoAsignado === "V") {
                  boton.innerHTML = vacationIcon;
                  boton.setAttribute("title", "Vacaciones");
                } else {
                  boton.textContent = turnoAsignado;
                  boton.removeAttribute("title");
                }
                boton.style.backgroundColor =
                  turnoColorMapping[turnoAsignado] || "#7796cb";
                boton.style.color = "#000";
              }
            });
          });

          // Actualizar modelo de Markov con lo recién asignado
          for (let empleado in empleadosAsignados) {
            let asignacion = empleadosAsignados[empleado];
            for (let day = 2; day <= daysInMonth; day++) {
              let turnoAnterior = asignacion[day - 2];
              let turnoActual = asignacion[day - 1];
              if (
                turnoActual !== "DL" &&
                turnoActual !== "L" &&
                turnoActual !== "F"
              ) {
                await actualizarTransicion(
                  empleado,
                  turnoAnterior,
                  turnoActual
                );
              }
            }
          }

          Swal.fire(
            "Éxito",
            "Turnos asignados y el modelo actualizado.",
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
        if (!usuarioEsAdmin) return;

        const mesSeleccionado = selectMeses.value;
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
    if (usuarioEsAdmin) {
      const uploadButtons = document.querySelectorAll(".upload-photo-btn");
      uploadButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const employeeCard = button.closest(".employee-card");
          if (!employeeCard) {
            console.error("No se encontró la tarjeta del empleado.");
            return;
          }
          const photoInput = employeeCard.querySelector(".photo-input");
          if (!photoInput) {
            console.error("No se encontró el input file.");
            return;
          }
          photoInput.click();
        });
      });

      const photoInputs = document.querySelectorAll(".photo-input");
      photoInputs.forEach((input) => {
        input.addEventListener("change", async function () {
          if (this.files && this.files[0]) {
            const file = this.files[0];
            const employeeCard = this.closest(".employee-card");
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
              })
              .catch((error) => {
                console.error("Error guardando URL:", error);
              });
          } else {
            console.warn("No se seleccionó ningún archivo.");
          }
        });
      });
    }

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
  });
});

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
  const currentMonth = document.getElementById("current-month").textContent.trim();

  // Confirmación
  const action = isMonthLocked ? "ABRIR" : "CERRAR";
  const result = await Swal.fire({
    title: `¿${action} el mes de ${currentMonth}?`,
    text: isMonthLocked
      ? "Al abrirlo, los administradores podrán volver a editar los turnos."
      : "Al cerrarlo, nadie podrá editar turnos hasta que se vuelva a abrir.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: `Sí, ${action}`,
    cancelButtonText: "Cancelar"
  });

  if (!result.isConfirmed) return;

  // Actualizar en Firestore
  // Usamos merge para no borrar datos, solo actualizar el flag
  try {
    // IMPORTANTE: Al desbloquear, actualizamos directamante.
    // Al bloquear, igual. scheduleFirestoreUpdate NO debe ejecutarse si está bloqueado.
    await db.collection("calendarios").doc(currentMonth).set({
      locked: !isMonthLocked
    }, { merge: true });

    Swal.fire("Éxito", `El mes ha sido ${action === "CERRAR" ? "cerrado" : "abierto"}.`, "success");
    // La UI se actualizará sola gracias a onSnapshot (subscribeCalendar)

  } catch (error) {
    console.error("Error al cambiar estado de bloqueo:", error);
    Swal.fire("Error", "No se pudo actualizar el estado del mes.", "error");
  }
}

// Listener para el botón de bloqueo
document.addEventListener("DOMContentLoaded", () => {
  const btnToggleLock = document.getElementById("btnToggleLock");
  if (btnToggleLock) {
    btnToggleLock.addEventListener("click", toggleMonthLock);
  }
});

