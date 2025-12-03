"use strict";

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://jmrzvajipfdqvzilqjvq.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imptcnp2YWppcGZkcXZ6aWxxanZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg3ODU3MTksImV4cCI6MjA1NDM2MTcxOX0.xQZX2i-6wynnRnEKBb_mwbt63S6vvrr10SilIyug5Mg";
const supabase = createClient(supabaseUrl, supabaseKey);

const auth = window.auth;
const db = window.db;

let usuarioEsAdmin = false;
let currentDate = new Date();
let selectedDays = [];
const vacationIcon = `<i data-lucide="tree-palm"></i>`;

// Lista de feriados y su información
const feriadosChile = [
  "2025-01-01", "2025-04-18", "2025-04-19", "2025-05-01",
  "2025-05-21", "2025-06-20", "2025-06-29", "2025-06-29", "2025-07-16", "2025-08-15",
  "2025-09-18", "2025-09-19", "2025-10-12", "2025-10-31",
  "2025-11-01", "2025-11-16", "2025-12-08", "2025-12-14", "2025-12-25",
  // 2026
  "2026-01-01", "2026-04-03", "2026-04-04", "2026-05-01",
  "2026-05-21", "2026-06-20", "2026-06-29", "2026-07-16", "2026-08-15",
  "2026-09-18", "2026-09-19", "2026-10-12", "2026-10-31",
  "2026-11-01", "2026-12-08", "2026-12-25"
];

const feriadosInfo = {
  "2025-01-01": "Año Nuevo",
  "2025-04-18": "Viernes Santo",
  "2025-04-19": "Sábado Santo",
  "2025-05-01": "Día del Trabajador",
  "2025-05-21": "Glorias Navales",
  "2025-06-20": "Dia Nacional de los Pueblos Indigenas",
  "2025-06-29": "San Pedro y San Pablo",
  "2025-07-16": "Virgen del Carmen",
  "2025-08-15": "Asunción de la Virgen",
  "2025-09-18": "Fiestas Patrias",
  "2025-09-19": "Glorias del Ejército",
  "2025-10-12": "Encuentro de Dos Mundos",
  "2025-10-31": "Día Iglesias Evangélicas",
  "2025-11-01": "Día de Todos los Santos",
  "2025-11-16": "Elecciones Presidenciales y Parlamentarias Irrenunciable",
  "2025-12-08": "Inmaculada Concepción",
  "2025-12-14": "Elecciones Presidenciales (Segunda Vuelta) Irrenunciable",
  "2025-12-25": "Navidad",
  // 2026
  "2026-01-01": "Año Nuevo",
  "2026-04-03": "Viernes Santo",
  "2026-04-04": "Sábado Santo",
  "2026-05-01": "Día del Trabajador",
  "2026-05-21": "Glorias Navales",
  "2026-06-20": "Día Nacional de los Pueblos Indígenas",
  "2026-06-29": "San Pedro y San Pablo",
  "2026-07-16": "Virgen del Carmen",
  "2026-08-15": "Asunción de la Virgen",
  "2026-09-18": "Fiestas Patrias",
  "2026-09-19": "Glorias del Ejército",
  "2026-10-12": "Encuentro de Dos Mundos",
  "2026-10-31": "Día Iglesias Evangélicas",
  "2026-11-01": "Día de Todos los Santos",
  "2026-12-08": "Inmaculada Concepción",
  "2026-12-25": "Navidad"
};

// Lista de empleados y su objeto de turnos (se actualizará en renderCalendar)
const empleados = [
  { nombre: "Sergio Castillo", turnos: [] },
  { nombre: "Ignacio Aburto", turnos: [] },
  { nombre: "Claudio Bustamante", turnos: [] },
  { nombre: "Julio Oliva", turnos: [] },
  { nombre: "Gabriel Trujillo", turnos: [] }
];

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
    feriadosHTML: feriadosTable ? feriadosTable.outerHTML : ""
  };
}

// Guarda en localStorage el estado actual del calendario
function guardarCalendarioEnLocalStorage() {
  const key = obtenerClaveMes(currentDate);
  const datos = obtenerDatosCalendario();
  localStorage.setItem(key, JSON.stringify(datos));
  console.log(`Calendario guardado en localStorage con la clave: ${key}`);
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
          const isAdmin = data.rol === "admin";
          const isSuperAdmin = data.rol === "superadmin";

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
        .then(() => { window.location.href = "login.html"; })
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

// Renderiza el calendario. Primero intenta cargar datos guardados en localStorage;
// si no existen o están incompletos, se construye desde cero.
function renderCalendar(date) {
  const key = obtenerClaveMes(date);
  const storedData = localStorage.getItem(key);

  if (storedData) {
    try {
      const data = JSON.parse(storedData);

      // Si no tiene el tercer calendario todavía, regeneramos desde cero
      if (!data.generalHTML || !data.nocturnoHTML || !data.feriadosHTML) {
        renderCalendarDesdeCero(date);
        return;
      }

      document.getElementById("current-month").textContent = data.mes;

      const general = document.getElementById("general-calendar");
      const nocturno = document.getElementById("nocturno-calendar");
      const feriados = document.getElementById("feriados-calendar");

      if (general && data.generalHTML) general.outerHTML = data.generalHTML;
      if (nocturno && data.nocturnoHTML) nocturno.outerHTML = data.nocturnoHTML;
      if (feriados && data.feriadosHTML) feriados.outerHTML = data.feriadosHTML;

      if (usuarioEsAdmin) { attachAdminCellListeners(); }
      lucide.createIcons();
      fixShiftTextColors();
      calcularHorasExtras(date);
      return;
    } catch (e) {
      console.error("Error leyendo localStorage, se renderiza desde cero:", e);
    }
  }

  renderCalendarDesdeCero(date);
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
    generalHTML += `<tr><td class="text-left p-2">${empleado.nombre}</td>`;
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
            data-empleado="${empleado.nombre}"
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
function calcularHorasExtras(date) {
  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth(); // 0-indexed

  // 1. Obtener datos del mes anterior (para contar del 26 al final)
  // Restamos 1 al mes. Si es Enero (0), pasará a Diciembre del año anterior automáticamente.
  const prevDate = new Date(currentYear, currentMonth - 1, 1);
  const prevKey = obtenerClaveMes(prevDate);
  const prevDataStr = localStorage.getItem(prevKey);

  let countSergioPrev = 0;
  let countIgnacioPrev = 0;

  if (prevDataStr) {
    try {
      const prevData = JSON.parse(prevDataStr);
      if (prevData.feriadosHTML) {
        // Parseamos el HTML guardado
        const parser = new DOMParser();
        const docPrev = parser.parseFromString(prevData.feriadosHTML, "text/html");
        // Buscamos los botones en la tabla de feriados
        const buttonsPrev = docPrev.querySelectorAll("button.calendar-day");

        buttonsPrev.forEach(btn => {
          const day = parseInt(btn.getAttribute("data-day"), 10);
          const turno = btn.textContent.trim();

          // Contamos solo del 26 en adelante
          if (day >= 26) {
            if (turno === "S") countSergioPrev++;
            if (turno === "I") countIgnacioPrev++;
          }
        });
      }
    } catch (e) {
      console.error("Error al leer datos del mes anterior para horas extras:", e);
    }
  }

  // 2. Obtener datos del mes actual (del 1 al 25) del DOM actual
  let countSergioCurr = 0;
  let countIgnacioCurr = 0;

  const buttonsCurr = document.querySelectorAll("#feriados-calendar button.calendar-day");
  buttonsCurr.forEach(btn => {
    const day = parseInt(btn.getAttribute("data-day"), 10);
    const turno = btn.textContent.trim();

    // Contamos solo hasta el 25
    if (day <= 25) {
      if (turno === "S") countSergioCurr++;
      if (turno === "I") countIgnacioCurr++;
    }
  });

  // 3. Totales
  const totalSergio = countSergioPrev + countSergioCurr;
  const totalIgnacio = countIgnacioPrev + countIgnacioCurr;

  // 4. Actualizar UI
  const elCountSergio = document.getElementById("count-sergio");
  const elHoursSergio = document.getElementById("hours-sergio");
  const elCountIgnacio = document.getElementById("count-ignacio");
  const elHoursIgnacio = document.getElementById("hours-ignacio");

  if (elCountSergio) elCountSergio.textContent = totalSergio;
  if (elHoursSergio) elHoursSergio.textContent = totalSergio * 5; // 5 horas por turno
  if (elCountIgnacio) elCountIgnacio.textContent = totalIgnacio;
  if (elHoursIgnacio) elHoursIgnacio.textContent = totalIgnacio * 5;
}

// -----------------------------------------------------------------------------
// 3) Eventos de Admin
// -----------------------------------------------------------------------------
let isSelecting = false;
let isDeselecting = false;

function adminMousedown(e) {
  // Botón Izquierdo (0): Seleccionar (acumulativo)
  if (e.button === 0) {
    isSelecting = true;
    if (!this.classList.contains("selected")) {
      this.classList.add("selected");
      selectedDays.push(this);
    }
  }
  // Botón Derecho (2): Borrar (Goma de borrar)
  else if (e.button === 2) {
    isDeselecting = true;

    // Borrar contenido y estilos
    this.textContent = "";
    this.innerHTML = "";
    this.removeAttribute("style");
    this.className = "calendar-day w-full h-full";
    this.removeAttribute("title");

    // Quitar de la selección si estaba
    if (this.classList.contains("selected")) {
      this.classList.remove("selected");
      selectedDays = selectedDays.filter((el) => el !== this);
    }

    scheduleFirestoreUpdate();
  }
}

function adminMouseover(e) {
  if (usuarioEsAdmin) {
    if (isSelecting) {
      if (!this.classList.contains("selected")) {
        this.classList.add("selected");
        selectedDays.push(this);
      }
    } else if (isDeselecting) {
      // Borrar al arrastrar (Goma de borrar)
      this.textContent = "";
      this.innerHTML = "";
      this.removeAttribute("style");
      this.className = "calendar-day w-full h-full";
      this.removeAttribute("title");

      if (this.classList.contains("selected")) {
        this.classList.remove("selected");
        selectedDays = selectedDays.filter((el) => el !== this);
      }

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

function attachAdminCellListeners() {
  document.querySelectorAll(".calendar-day").forEach((cell) => {
    cell.addEventListener("mousedown", adminMousedown);
    cell.addEventListener("mouseover", adminMouseover);
    cell.addEventListener("contextmenu", adminContextmenu);
  });
  document.addEventListener("mouseup", adminMouseup);
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

        // 1. Guardar identificadores de celdas seleccionadas
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

        lucide.createIcons();
        fixShiftTextColors();
        if (usuarioEsAdmin) {
          attachAdminCellListeners();
        }

        // 2. Restaurar selección
        selectedDays = [];
        if (savedSelection.length > 0) {
          savedSelection.forEach(item => {
            // Buscar el botón que coincida con los atributos
            // Nota: data-empleado puede tener espacios, así que usamos selectores de atributos con comillas
            const selector = `button[data-date="${item.date}"][data-day="${item.day}"]`;
            // Filtramos manualmente por empleado para evitar problemas con selectores complejos si hay caracteres especiales
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
  configurarSidebar();
  configurarLogout();

  verificarRolUsuario(function (isAdmin) {
    usuarioEsAdmin = isAdmin;

    // Mostrar elementos solo para admin
    if (usuarioEsAdmin) {
      document.querySelectorAll(".admin-only").forEach((el) => {
        el.classList.remove("admin-only");
      });
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
          console.log("Mes actual detectado:", currentMonth);

          const snapshot = await db.collection("calendarios").get();
          let historialTurnos = {};
          snapshot.forEach((doc) => {
            historialTurnos[doc.id] = doc.data();
          });
          console.log("Historial de turnos:", historialTurnos);

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

          console.log("Asignación inicial:", empleadosAsignados);

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
            // NO quitamos la selección para permitir cambios rápidos
            // dayBtn.classList.remove("selected");
          });

          lucide.createIcons();
          // selectedDays = []; // Mantenemos la selección
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

        guardarCalendarioEnLocalStorage();

        const key = obtenerClaveMes(currentDate);
        const datos = JSON.parse(localStorage.getItem(key));
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
        const mesSeleccionado = selectMeses.value;
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

