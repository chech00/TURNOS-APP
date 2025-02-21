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
  "2025-05-21", "2025-06-29","2025-06-29", "2025-07-16", "2025-08-15",
  "2025-09-18", "2025-09-19", "2025-10-12", "2025-10-31",
  "2025-11-01", "2025-11-16","2025-12-08","2025-12-14", "2025-12-25"
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
  "2025-12-25": "Navidad"
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

// =============================
// 1) FUNCIONES DE CONFIGURACIÓN
// =============================
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
          callback(data.rol === "admin");
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
      sidebar.classList.toggle("active");
      mainContent.classList.toggle("shift");
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

// =============================
// 2) LÓGICA DEL CALENDARIO
// =============================
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

function renderCalendar(date) {
  const currentMonthElement = document.getElementById("current-month");
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  currentMonthElement.textContent = `${firstDay.toLocaleString("default", { month: "long" })} ${year}`;

  const tablaGeneral = document.getElementById("general-calendar");
  const tablaNocturno = document.getElementById("nocturno-calendar");

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

  asignarDomingosLibres(year, month, daysInMonth);

  // Construir el HTML del calendario general
  let generalHTML = "";
  empleados.forEach((empleado) => {
    generalHTML += `<tr><td class="text-left p-2">${empleado.nombre}</td>`;
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const esFeriado = feriadosChile.includes(dateStr);
      const turno = empleado.turnos[day - 1] || "";
      let displayTurno = turno;
      if (esFeriado && turno === "" && (empleado.nombre === "Sergio Castillo" || empleado.nombre === "Ignacio Aburto")) {
        displayTurno = "F";
      }
      const extraClass = turno === "DL" ? "domingo-libre" : "";
      const claseFeriado = displayTurno === "F" ? "feriado" : "";
      const cellContent = turno === "V" ? vacationIcon : displayTurno;
      generalHTML += `
        <td>
          <button data-date="${dateStr}" data-empleado="${empleado.nombre}" data-day="${day}"
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
  
  // Fila de bitácora
  const totalCols = daysInMonth + 1;
  const bitacoraIndex = ((month - 1) + bitacoraEmployees.length) % bitacoraEmployees.length;
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
  if (tbodyGeneral) { tbodyGeneral.innerHTML = generalHTML; }
  else { console.error("No se encontró el tbody de la tabla general"); }

  // Construir el calendario nocturno (similar, no modificado en esta parte)
  let nocturnoHTML = "";
  const cristianTurnos = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const fecha = new Date(year, month, day);
    const esFeriado = feriadosChile.includes(`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    const dayOfWeek = fecha.getDay();
    if (esFeriado) { cristianTurnos[day - 1] = "F"; }
    else if (dayOfWeek === 0) { cristianTurnos[day - 1] = "DL"; }
    else if (dayOfWeek === 6) { cristianTurnos[day - 1] = "L"; }
    else { cristianTurnos[day - 1] = "N"; }
  }
  nocturnoHTML += `<tr><td class="text-left p-2">Cristian Oyarzun</td>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const turno = cristianTurnos[day - 1];
    let turnoClass = "";
    if (turno === "DL") { turnoClass = "domingo-libre"; }
    else if (turno === "L") { turnoClass = "dia-libre"; }
    else if (turno === "N") { turnoClass = "nocturno"; }
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
  if (tbodyNocturno) { tbodyNocturno.innerHTML = nocturnoHTML; }
  else { console.error("No se encontró el tbody de la tabla nocturna"); }

  // Agregar títulos a feriados
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
}

function todosLosDiasRellenos() {
  const dayButtons = document.querySelectorAll("#general-calendar .calendar-day, #nocturno-calendar .calendar-day");
  for (let btn of dayButtons) {
    if (btn.innerHTML.trim() === "") { return false; }
  }
  return true;
}

// =============================
// 3) Eventos de Admin
// =============================
let isSelecting = false;
function adminMousedown(e) {
  if (e.button === 0) {
    isSelecting = true;
    if (!this.classList.contains("selected")) {
      this.classList.add("selected");
      selectedDays.push(this);
    }
  }
}
function adminMouseover(e) {
  if (usuarioEsAdmin && isSelecting) {
    if (!this.classList.contains("selected")) {
      this.classList.add("selected");
      selectedDays.push(this);
    }
  }
}
function adminContextmenu(e) {
  e.preventDefault();
  this.textContent = "";
  this.removeAttribute("style");
  this.className = "calendar-day w-full h-full";
  selectedDays = selectedDays.filter(el => el !== this);
}
function adminMouseup(e) {
  if (usuarioEsAdmin) { isSelecting = false; }
}
function attachAdminCellListeners() {
  document.querySelectorAll(".calendar-day").forEach(cell => {
    cell.addEventListener("mousedown", adminMousedown);
    cell.addEventListener("mouseover", adminMouseover);
    cell.addEventListener("contextmenu", adminContextmenu);
  });
  document.addEventListener("mouseup", adminMouseup);
}

// =============================
// 4) MODALES, GUARDAR Y CARGAR CALENDARIO
// =============================
const btnGuardar   = document.getElementById("btnGuardar");
const btnCargar    = document.getElementById("btnCargar");
const btnEliminar  = document.getElementById("btnEliminar");
const selectMeses  = document.getElementById("mesesGuardados");
const modal        = document.getElementById("modalCalendario");
const modalContent = document.getElementById("contenidoModal");
const cerrarModal  = document.getElementById("cerrarModal");

const btnVerHorarios  = document.getElementById("btnVerHorarios");
const modalHorarios   = document.getElementById("modalHorarios");
const cerrarHorarios  = document.getElementById("cerrarHorarios");

const btnVerEstadisticas   = document.getElementById("btnVerEstadisticas");
const modalEstadisticas    = document.getElementById("modalEstadisticas");
const cerrarEstadisticas   = document.getElementById("cerrarEstadisticas");
const estadisticasContenido = document.getElementById("estadisticas-contenido");

function obtenerDatosCalendario() {
  const currentMonthElement = document.getElementById("current-month");
  const generalTable = document.getElementById("general-calendar");
  const nocturnoTable = document.getElementById("nocturno-calendar");
  return {
    mes: currentMonthElement.textContent,
    generalHTML: generalTable.outerHTML,
    nocturnoHTML: nocturnoTable.outerHTML
  };
}

function cargarListaCalendarios() {
  db.collection("calendarios").get()
    .then((querySnapshot) => {
      selectMeses.innerHTML = '<option value="">-- Seleccione un mes guardado --</option>';
      querySnapshot.forEach((doc) => {
        const option = document.createElement("option");
        option.value = doc.id;
        option.textContent = doc.id;
        selectMeses.appendChild(option);
      });
    })
    .catch((error) => { console.error("Error al cargar calendarios:", error); });
}

// =============================
// 5) CARGAR FOTOS DE EMPLEADOS DESDE FIRESTORE
// =============================
function cargarFotosEmpleados() {
  const employeeCards = document.querySelectorAll(".employee-card");
  employeeCards.forEach(card => {
    const nameSpan = card.querySelector("span");
    const imgElement = card.querySelector(".employee-photo");
    if (!nameSpan || !imgElement) return;
    const employeeName = nameSpan.textContent.trim();
    db.collection("empleados").doc(employeeName).get()
      .then(doc => {
        if (doc.exists) {
          const data = doc.data();
          if (data.photoURL) { imgElement.src = data.photoURL; }
        }
      })
      .catch(err => { console.error("Error al leer la foto de Firestore:", err); });
  });
}

// =============================
//  FUNCIÓN PARA CALCULAR ESTADÍSTICAS
// =============================
function calcularEstadisticas() {
  const celdas = document.querySelectorAll("#general-calendar .calendar-day");
  const conteoTurnos = {};
  celdas.forEach((celda) => {
    const turno = celda.textContent.trim();
    if (turno) { conteoTurnos[turno] = (conteoTurnos[turno] || 0) + 1; }
  });
  return conteoTurnos;
}

function calcularTurnosPorEmpleado() {
  const empleadosTurnos = {};
  document.querySelectorAll("#general-calendar tbody tr").forEach(row => {
    const empleado = row.querySelector("td")?.textContent.trim();
    if (!empleado) return;
    empleadosTurnos[empleado] = empleadosTurnos[empleado] || {};
    row.querySelectorAll("td button.calendar-day").forEach(btn => {
      const turno = btn.textContent.trim();
      if (turno) { empleadosTurnos[empleado][turno] = (empleadosTurnos[empleado][turno] || 0) + 1; }
    });
  });
  return Object.entries(empleadosTurnos).map(([empleado, turnos]) => {
    let turnoMasAsignado = "-";
    let turnoMenosAsignado = "-";
    let maxTurnos = 0;
    let minTurnos = Infinity;
    Object.entries(turnos).forEach(([turno, cantidad]) => {
      if (cantidad > maxTurnos) { maxTurnos = cantidad; turnoMasAsignado = turno; }
      if (cantidad < minTurnos) { minTurnos = cantidad; turnoMenosAsignado = turno; }
    });
    return { empleado, turnoMasAsignado, turnoMenosAsignado };
  });
}

function mostrarEstadisticas() {
  const conteoTurnos = calcularEstadisticas();
  const empleadosTurnos = calcularTurnosPorEmpleado();
  let turnoMasUsado = "-";
  let turnoMenosUsado = "-";
  let maxCount = 0, minCount = Infinity;
  Object.entries(conteoTurnos).forEach(([turno, cantidad]) => {
    if (cantidad > maxCount) { maxCount = cantidad; turnoMasUsado = turno; }
    if (cantidad < minCount) { minCount = cantidad; turnoMenosUsado = turno; }
  });
  document.getElementById("total-turnos").textContent = Object.values(conteoTurnos).reduce((a, b) => a + b, 0);
  document.getElementById("turno-mas-usado").textContent = turnoMasUsado;
  document.getElementById("turno-menos-usado").textContent = turnoMenosUsado;
  const tablaEmpleados = document.getElementById("tabla-turnos-empleados");
  tablaEmpleados.innerHTML = empleadosTurnos.map(({ empleado, turnoMasAsignado, turnoMenosAsignado }) => `
    <tr>
      <td>${empleado}</td>
      <td>${turnoMasAsignado}</td>
      <td>${turnoMenosAsignado}</td>
    </tr>
  `).join("");
  generarGraficoBarras(conteoTurnos);
  generarGraficoPastel(empleadosTurnos);
  generarGraficoLineas(conteoTurnos);
  document.getElementById("modalEstadisticas").style.display = "block";
}

// =============================
//  GRÁFICOS CON CHART.JS
// =============================
let chartBarras;
let chartPastel;
let chartLineas;
function generarGraficoBarras(datos) {
  const ctx = document.getElementById("graficoTurnos").getContext("2d");
  if (chartBarras) { chartBarras.destroy(); }
  chartBarras = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(datos),
      datasets: [{
        label: "Frecuencia de Turnos",
        data: Object.values(datos),
        backgroundColor: "#7796cb"
      }]
    },
    options: { responsive: true }
  });
}
function generarGraficoPastel(datos) {
  const ctx = document.getElementById("graficoEmpleados").getContext("2d");
  if (chartPastel) { chartPastel.destroy(); }
  chartPastel = new Chart(ctx, {
    type: "pie",
    data: {
      labels: Object.keys(datos),
      datasets: [{
        label: "Turnos por empleado",
        data: Object.values(datos),
        backgroundColor: ["#8FBCBB", "#88C0A6", "#D77A7A", "#7796cb"]
      }]
    },
    options: { responsive: true }
  });
}
function generarGraficoLineas(datos) {
  const ctx = document.getElementById("graficoTendencias").getContext("2d");
  if (chartLineas) { chartLineas.destroy(); }
  chartLineas = new Chart(ctx, {
    type: "line",
    data: {
      labels: Object.keys(datos),
      datasets: [{
        label: "Tendencia de Turnos",
        data: Object.values(datos),
        borderColor: "#7796cb",
        fill: false
      }]
    },
    options: { responsive: true }
  });
}

// =============================
// Funciones de aprendizaje (modelo de Markov)
// =============================

// Actualiza la transición en la colección "patronesTurnosMarkov"
async function actualizarTransicion(employee, turnoAnterior, turnoActual) {
  const docRef = db.collection("patronesTurnosMarkov").doc(employee);
  try {
    const doc = await docRef.get();
    let datos = {};
    if (doc.exists) { datos = doc.data(); }
    if (!datos[turnoAnterior]) { datos[turnoAnterior] = {}; }
    datos[turnoAnterior][turnoActual] = (datos[turnoAnterior][turnoActual] || 0) + 1;
    await docRef.set(datos, { merge: true });
  } catch (error) {
    console.error(`Error actualizando transición para ${employee}:`, error);
  }
}

async function obtenerMatrizTransiciones(employee) {
  try {
    const doc = await db.collection("patronesTurnosMarkov").doc(employee).get();
    if (doc.exists) { return doc.data(); }
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
    if (rand <= acumulado) { return turno; }
  }
  return turnosDisponibles[0];
}

// =============================
// 7) SUSCRIPCIÓN EN TIEMPO REAL AL CALENDARIO
// =============================
let unsubscribeCalendar = null;
function subscribeCalendar() {
  const monthId = document.getElementById("current-month").textContent.trim();
  if (unsubscribeCalendar) { unsubscribeCalendar(); }
  unsubscribeCalendar = db.collection("calendarios").doc(monthId)
    .onSnapshot((doc) => {
      if (doc.exists) {
        const data = doc.data();
        const generalContainer = document.getElementById("general-calendar");
        const nocturnoContainer = document.getElementById("nocturno-calendar");
        generalContainer.outerHTML = data.generalHTML;
        nocturnoContainer.outerHTML = data.nocturnoHTML;
        lucide.createIcons();
        if (usuarioEsAdmin) { attachAdminCellListeners(); }
      } else {
        renderCalendar(currentDate);
        if (usuarioEsAdmin) { attachAdminCellListeners(); }
      }
    });
}

// =============================
// 8) ACTUALIZACIÓN EN TIEMPO REAL (debounce)
// =============================
let updateTimeout;
function scheduleFirestoreUpdate() {
  clearTimeout(updateTimeout);
  updateTimeout = setTimeout(() => {
    const datos = obtenerDatosCalendario();
    db.collection("calendarios").doc(datos.mes).set(datos)
      .then(() => { console.log("Actualización en tiempo real guardada."); })
      .catch((error) => { console.error("Error al actualizar:", error); });
  }, 1000);
}

// =============================
// 9) EVENTO PRINCIPAL (DOMContentLoaded)
// =============================
document.addEventListener("DOMContentLoaded", function () {
  configurarSidebar();
  configurarLogout();
  verificarRolUsuario(function(isAdmin) {
    usuarioEsAdmin = isAdmin;
    if (usuarioEsAdmin) {
      document.querySelectorAll(".admin-only").forEach(el => { el.classList.remove("admin-only"); });
    }

    // Botón de Auto-Asignar Turnos con aprendizaje y reglas adicionales
    const btnAutoAsignar = document.getElementById("btnAutoAsignar");
    if (btnAutoAsignar) {
      btnAutoAsignar.addEventListener("click", async function () {
        if (!usuarioEsAdmin) return;
        Swal.fire({
          title: "Analizando turnos...",
          text: "Funcion en Beta, puede contener errores, Esto puede tardar unos segundos.",
          showConfirmButton: false,
          allowOutsideClick: false,
          willOpen: () => { Swal.showLoading(); }
        });
        try {
          // Mapeo de colores (según tus botones y horarios)
          const turnoColorMapping = {
            "M0": "#648c9b",
            "M0A": "#7b69a5",
            "M1": "#557a5f",
            "M1A": "#c49f87",
            "M1B": "#ffaaa5",
            "M2": "#ffcc99",
            "M2A": "#d4a5a5",
            "M2B": "#b5e7a0",
            "M3": "#996a7f",
            "V": "#88C0A6",
            "L": "#8FBCBB",
            "DL": "#D77A7A"
          };
          const turnosDisponibles = ["M0", "M0A", "M1", "M1A", "M1B", "M2", "M2A", "M2B", "M3", "V"];
          const currentMonth = document.getElementById("current-month").textContent.trim();
          console.log("Mes actual detectado:", currentMonth);

          // Recuperar historial (opcional, para información complementaria)
          const snapshot = await db.collection("calendarios").get();
          let historialTurnos = {};
          snapshot.forEach((doc) => { historialTurnos[doc.id] = doc.data(); });
          console.log("Historial de turnos:", historialTurnos);

          // Inicializar asignación para el mes actual
          const year = currentDate.getFullYear();
          const month = currentDate.getMonth();
          const lastDay = new Date(year, month + 1, 0);
          const daysInMonth = lastDay.getDate();
          const tabla = document.getElementById("general-calendar").querySelector("tbody");
          const filas = tabla.querySelectorAll("tr");
          let empleadosAsignados = {};

          // Para cada empleado, asignar turnos usando modelo Markov
          for (let fila of filas) {
            const empleado = fila.querySelector("td").textContent.trim();
            empleadosAsignados[empleado] = new Array(daysInMonth).fill("");
            // Obtener matriz de transición para este empleado
            let matriz = await obtenerMatrizTransiciones(empleado);
            for (let day = 1; day <= daysInMonth; day++) {
              const dateObj = new Date(year, month, day);
              if (dateObj.getDay() === 0) {
                // Domingo: para Sergio e Ignacio forzamos "DL"; para los demás, "L" (cumpliendo la regla de domingos libres)
                empleadosAsignados[empleado][day - 1] = (empleado === "Sergio Castillo" || empleado === "Ignacio Aburto") ? "DL" : "L";
              } else {
                if (day > 1) {
                  let turnoAnterior = empleadosAsignados[empleado][day - 2];
                  let turnoElegido = elegirSiguienteTurnoMarkov(matriz, turnoAnterior, turnosDisponibles);
                  empleadosAsignados[empleado][day - 1] = turnoElegido;
                } else {
                  // Para el primer día, asignar aleatoriamente
                  empleadosAsignados[empleado][day - 1] = turnosDisponibles[Math.floor(Math.random() * turnosDisponibles.length)];
                }
              }
            }
          }
          console.log("Asignación inicial:", empleadosAsignados);

          // Regla adicional 1: Solo un turno M1 o M1B por semana para cada empleado
          // Iteramos por cada empleado y segmentamos la semana (lunes a domingo)
          for (let empleado in empleadosAsignados) {
            let asignacion = empleadosAsignados[empleado];
            let weekStart = 0;
            while (weekStart < asignacion.length) {
              // Determinar fin de semana: recorremos hasta el domingo o fin del mes
              let weekEnd = weekStart;
              while (weekEnd < asignacion.length) {
                let dia = weekEnd + 1;
                let fecha = new Date(year, month, dia);
                if (fecha.getDay() === 0) { weekEnd++; break; }
                weekEnd++;
              }
              // Contar M1 y M1B en esta semana
              let countM1 = 0, countM1B = 0;
              for (let i = weekStart; i < weekEnd; i++) {
                let turno = asignacion[i];
                if (turno === "M1") countM1++;
                if (turno === "M1B") countM1B++;
              }
              // Si hay más de una ocurrencia en total, reajustamos (dejamos la primera y reasignamos el resto)
              let total = countM1 + countM1B;
              if (total > 1) {
                let extra = total - 1;
                for (let i = weekStart; i < weekEnd && extra > 0; i++) {
                  if (asignacion[i] === "M1" || asignacion[i] === "M1B") {
                    // Reasignar el turno: elegir aleatoriamente de turnosDisponibles sin M1 y M1B
                    let alternativas = turnosDisponibles.filter(t => t !== "M1" && t !== "M1B");
                    asignacion[i] = alternativas[Math.floor(Math.random() * alternativas.length)];
                    extra--;
                  }
                }
              }
              weekStart = weekEnd;
            }
          }

          // (La regla de tener al menos 2 domingos libres para empleados que no sean Sergio o Ignacio ya se fuerza asignando "L" en domingos)
          console.log("Asignación final tras reglas adicionales:", empleadosAsignados);

          // Aplicar asignación al calendario visual y asignar colores
          filas.forEach((fila) => {
            const empleado = fila.querySelector("td").textContent.trim();
            const botones = fila.querySelectorAll("td button.calendar-day");
            botones.forEach((boton, index) => {
              if (empleadosAsignados[empleado][index] !== "") {
                let turno = empleadosAsignados[empleado][index];
                if (turno === "V") { boton.innerHTML = vacationIcon; }
                else { boton.textContent = turno; }
                boton.style.backgroundColor = turnoColorMapping[turno] || "#7796cb";
              }
            });
          });

          // Actualizar el modelo de Markov: para cada empleado, por cada par de días consecutivos (a excepción de los forzados)
          for (let empleado in empleadosAsignados) {
            for (let day = 2; day <= daysInMonth; day++) {
              let turnoAnterior = empleadosAsignados[empleado][day - 2];
              let turnoActual = empleadosAsignados[empleado][day - 1];
              if (turnoActual !== "DL" && turnoActual !== "L" && turnoActual !== "F") {
                await actualizarTransicion(empleado, turnoAnterior, turnoActual);
              }
            }
          }
          Swal.fire("Éxito", "Turnos asignados y el modelo actualizado.", "success");
        } catch (error) {
          console.error("Error en autoasignación:", error);
          Swal.fire("Error", "No se pudieron asignar los turnos.", "error");
        }
      });
    }

    const prevMonthButton = document.getElementById("prev-month");
    const nextMonthButton = document.getElementById("next-month");
    const todayButton     = document.getElementById("today");
    prevMonthButton.addEventListener("click", function () {
      currentDate.setMonth(currentDate.getMonth() - 1);
      renderCalendar(currentDate);
      subscribeCalendar();
    });
    nextMonthButton.addEventListener("click", function () {
      currentDate.setMonth(currentDate.getMonth() + 1);
      renderCalendar(currentDate);
      subscribeCalendar();
    });
    todayButton.addEventListener("click", function () {
      currentDate = new Date();
      renderCalendar(currentDate);
      subscribeCalendar();
    });

    renderCalendar(currentDate);
    subscribeCalendar();
    cargarListaCalendarios();
    cargarFotosEmpleados();

    // ================================
    // Asignación manual de turnos (botones) – Actualización en tiempo real
    // ================================
    const turnosButtons = document.querySelectorAll(".turnos-buttons button");
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
              dayBtn.setAttribute("title", "Vacaciones");
            } else {
              dayBtn.textContent = turno;
              dayBtn.style.backgroundColor = color;
              dayBtn.removeAttribute("title");
            }
            dayBtn.classList.remove("selected");
          });
          lucide.createIcons();
          selectedDays = [];
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

    // ================================
    // Guardar Calendario (acción manual)
    // ================================
    if (btnGuardar) {
      btnGuardar.addEventListener("click", function () {
        if (!usuarioEsAdmin) return;
        if (!todosLosDiasRellenos()) {
          Swal.fire({
            icon: "error",
            title: "Datos incompletos",
            text: "Debes rellenar todos los días en ambos calendarios antes de guardar."
          });
          return;
        }
        const datos = obtenerDatosCalendario();
        const docRef = db.collection("calendarios").doc(datos.mes);
        docRef.get().then((doc) => {
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
                docRef.set(datos).then(() => {
                  Swal.fire("Sobrescrito", "Calendario sobrescrito exitosamente.", "success");
                  cargarListaCalendarios();
                }).catch((error) => { console.error("Error al sobrescribir:", error); });
              } else {
                Swal.fire("Cancelado", "No se sobrescribió el calendario.", "info");
              }
            });
          } else {
            docRef.set(datos).then(() => {
              Swal.fire({ icon: "success", title: "Calendario guardado", text: "Calendario guardado exitosamente." });
              cargarListaCalendarios();
            }).catch((error) => { console.error("Error al guardar:", error); });
          }
        }).catch((error) => { console.error("Error al validar existencia:", error); });
      });
    }

    // ================================
    // Cargar Calendario
    // ================================
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
        db.collection("calendarios").doc(mesSeleccionado).get()
          .then((doc) => {
            if (doc.exists) {
              const datos = doc.data();
              modalContent.innerHTML = `
                <h3>Calendario General</h3>${datos.generalHTML}
                <h3>Calendario Nocturno</h3>${datos.nocturnoHTML}
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
          .catch((error) => { console.error("Error al cargar el calendario:", error); });
      });
    }

    // ================================
    // Eliminar Calendario
    // ================================
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
            db.collection("calendarios").doc(mesSeleccionado).delete()
              .then(() => {
                Swal.fire("Eliminado", `El calendario de "${mesSeleccionado}" fue eliminado.`, "success");
                cargarListaCalendarios();
              })
              .catch((error) => { console.error("Error al eliminar calendario:", error); });
          } else {
            Swal.fire("Cancelado", "No se eliminó el calendario.", "info");
          }
        });
      });
    }

    // Cerrar modal de calendario
    if (cerrarModal) {
      cerrarModal.addEventListener("click", function () { modal.style.display = "none"; });
    }
    window.addEventListener("click", function (e) { if (e.target === modal) { modal.style.display = "none"; } });

    // ================================
    // Modal de Horarios
    // ================================
    if (btnVerHorarios) {
      btnVerHorarios.addEventListener("click", function () { modalHorarios.style.display = "block"; });
    }
    if (cerrarHorarios) {
      cerrarHorarios.addEventListener("click", function () { modalHorarios.style.display = "none"; });
    }
    window.addEventListener("click", function (e) { if (e.target === modalHorarios) { modalHorarios.style.display = "none"; } });

    // ================================
    // Modal de Estadísticas
    // ================================
    if (btnVerEstadisticas) {
      btnVerEstadisticas.addEventListener("click", function () { mostrarEstadisticas(); });
    }
    if (cerrarEstadisticas) {
      cerrarEstadisticas.addEventListener("click", function () { modalEstadisticas.style.display = "none"; });
    }
    window.addEventListener("click", function (e) { if (e.target === modalEstadisticas) { modalEstadisticas.style.display = "none"; } });

    // ================================
    // Subida de fotos (Admin)
    // ================================
    if (usuarioEsAdmin) {
      const uploadButtons = document.querySelectorAll(".upload-photo-btn");
      uploadButtons.forEach(button => {
        button.addEventListener("click", () => {
          const employeeCard = button.closest(".employee-card");
          if (!employeeCard) { console.error("No se encontró la tarjeta del empleado."); return; }
          const photoInput = employeeCard.querySelector(".photo-input");
          if (!photoInput) { console.error("No se encontró el input file."); return; }
          photoInput.click();
        });
      });
      const photoInputs = document.querySelectorAll(".photo-input");
      photoInputs.forEach(input => {
        input.addEventListener("change", async function() {
          if (this.files && this.files[0]) {
            const file = this.files[0];
            const employeeCard = this.closest(".employee-card");
            if (!employeeCard) { console.error("No se encontró la tarjeta del empleado."); return; }
            const employeeNameElement = employeeCard.querySelector("span");
            const employeeName = employeeNameElement ? employeeNameElement.textContent.trim() : "Empleado";
            const fileName = `${employeeName}_${Date.now()}_${file.name}`;
            const { data, error } = await supabase.storage.from("documentos-noc").upload(fileName, file, { upsert: true });
            if (error) { console.error("Error al subir foto:", error); return; }
            const pathUploaded = data.path || fileName;
            const { data: urlData, error: urlError } = supabase.storage.from("documentos-noc").getPublicUrl(pathUploaded);
            if (urlError) { console.error("Error al obtener URL:", urlError); return; }
            if (!urlData) { console.error("No se recibió URL pública."); return; }
            const finalURL = `${urlData.publicUrl}?ts=${Date.now()}`;
            const imgElement = employeeCard.querySelector(".employee-photo");
            if (imgElement) { imgElement.src = finalURL; }
            db.collection("empleados").doc(employeeName).set({ photoURL: finalURL }, { merge: true })
              .then(() => { console.log(`Foto actualizada para ${employeeName}`); })
              .catch((error) => { console.error("Error guardando URL:", error); });
          } else { console.warn("No se seleccionó ningún archivo."); }
        });
      });
    }
  });
});

document.getElementById("btnVerSugerencias").addEventListener("click", () => {
  const sugerencias = generarSugerencias();
  const lista = document.getElementById("listaSugerencias");
  lista.innerHTML = sugerencias.map(s => `<li>${s}</li>`).join("");
  document.getElementById("modalSugerencias").style.display = "block";
});
document.getElementById("cerrarSugerencias").addEventListener("click", () => {
  document.getElementById("modalSugerencias").style.display = "none";
});
document.querySelector('.theme-toggle').addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
});

function generarSugerencias() {
  const conteoTurnos = calcularEstadisticas();
  const totalTurnos = Object.values(conteoTurnos).reduce((a, b) => a + b, 0);
  const promedio = totalTurnos / Object.keys(conteoTurnos).length;
  const sugerencias = [];
  for (const [turno, cantidad] of Object.entries(conteoTurnos)) {
    if (cantidad > promedio * 1.5) {
      sugerencias.push(`El turno "${turno}" se asigna con mucha frecuencia (${cantidad} veces). Considera re-distribuirlo.`);
    } else if (cantidad < promedio * 0.5) {
      sugerencias.push(`El turno "${turno}" tiene pocas asignaciones (${cantidad} veces).`);
    }
  }
  return sugerencias;
}
