import { auth, db } from "./firebase.js";
import { formatDate, calcularPascua, obtenerFeriadosMoviles, obtenerSemanaActual } from "./modules/utils/dateUtils.js";
import { generarListaFeriados } from "./modules/logic/holidayLogic.js";

// Global vars are still needed if other scripts rely on them, but we use imported auth/db primarily
// window.auth/db are set by firebase.js


window.onerror = function (msg, url, line, col, error) {
  console.error("Global Error:", msg, "Line:", line, "Error:", error);
  // Don't show alert for generic "Script error" (cross-origin errors with no details)
  if (msg === "Script error." && line === 0) {
    return; // Ignore unhelpful cross-origin errors
  }
  // Don't show alert for undefined db/auth at startup
  if (msg.includes("Cannot read properties of undefined")) {
    console.warn("Firebase may not be initialized yet");
    return;
  }
  alert("Error en script.js: " + msg + " Linea: " + line);
};

// Wait for Firebase to be ready
// WaitForFirebase function removed as we import them directly and they should be ready or promises
// If we strictly need to wait for auth state, we use onAuthStateChanged.



// ----------------------
// 2) VARIABLES GLOBALES
// ----------------------
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let tecnicosRed = [];
let ingenieros = [];
let plantaExterna = [];
let additionalTelegram = {};
const employeeColors = {
  "Fabian H.": "#2e5e7e",
  "Marco V.": "#2e5e7e",
  "Guillermo.": "#2e5e7e",
  "Gonzalo S.": "#1b448b",
  "Patricio G.": "#1b448b",
  "Cristian V.": "#176fe1"
};
const employeesTelegram = {};
let semanaActual = 0;
let asignacionesManual = {};

// ----------------------
// 3) FUNCIONES DE FERIADOS
// ----------------------
// Date functions imported from dateUtils.js


let feriadosCache = null;

async function cargarFeriadosScript() {
  try {
    const doc = await db.collection("Config").doc("feriados").get();
    if (doc.exists) {
      const data = doc.data();
      if (data.lista && Array.isArray(data.lista)) {
        feriadosCache = data.lista;
        // console.log("Feriados cargados en script.js desde Firestore");
        // Si ya se generó el calendario, regenerarlo?
        // Podríamos llamar a generarCalendario(currentMonth, currentYear) si quisiéramos refrescar.
      }
    }
  } catch (error) {
    console.error("Error cargando feriados en script.js:", error);
  }
}

// Iniciar carga de feriados y Optimistic UI al cargar el script
document.addEventListener("DOMContentLoaded", () => {
  cargarFeriadosScript();

  // Load Sidebar Opacity preference
  const savedOpacity = localStorage.getItem('sidebarOpacity');
  if (savedOpacity) {
    document.documentElement.style.setProperty('--sidebar-opacity', savedOpacity);
  }

  // Optimistic Loading: Sidebar
  const cachedRole = localStorage.getItem("userRole");

  // PROTECCIÓN DE RUTA: Si estamos en index.html y NO es admin/super, redirigir
  if (window.location.pathname.endsWith("index.html") || window.location.pathname === "/") {
    if (cachedRole && cachedRole !== "admin" && cachedRole !== "superadmin") {
      window.location.href = "directorio.html";
    }
  }

  if (cachedRole === "superadmin") {
    const liRegistros = document.getElementById("li-registros");
    const liUsuarios = document.getElementById("li-usuarios");
    const liAnimaciones = document.getElementById("li-animaciones");
    const liTurnos = document.getElementById("li-turnos");

    if (liRegistros) liRegistros.style.display = "block";
    if (liUsuarios) liUsuarios.style.display = "block";
    if (liAnimaciones) liAnimaciones.style.display = "block";
    if (liTurnos) liTurnos.style.display = "block";

    document.body.classList.add("is-admin");
  } else if (cachedRole === "admin") {
    const liTurnos = document.getElementById("li-turnos");
    if (liTurnos) liTurnos.style.display = "block";
    document.body.classList.add("is-admin");
  }
});

// Use modular function
function generarFeriados(year) {
  return generarListaFeriados(year, feriadosCache);
}

// ----------------------
// 4) CALENDARIO
// ----------------------
window.generarCalendario = function (mes, año) {
  const calendarBody = document.querySelector("#calendar tbody");
  const calendarTitle = document.getElementById("calendar-title");
  const linearContainer = document.getElementById("linear-view");
  const linearViewBtn = document.getElementById("linear-view-btn");
  const openEditBtn = document.getElementById("open-edit-modal");
  const calendarViewBtn = document.getElementById("calendar-view-btn");

  if (!calendarBody || !calendarTitle) {
    console.error("Elementos de calendario no encontrados en el DOM.");
    return;
  }

  // console.log(`Generando calendario para mes: ${mes}, año: ${año}`);
  calendarBody.innerHTML = "";
  const feriados = generarFeriados(año);
  const primerDiaDelMes = new Date(año, mes, 1).getDay();
  const diasEnMes = new Date(año, mes + 1, 0).getDate();
  const diasMesAnterior = new Date(año, mes, 0).getDate();
  const primerDiaSemana = primerDiaDelMes === 0 ? 7 : primerDiaDelMes;
  const inicioPrimerSemana = 1 - (primerDiaSemana - 1);
  const totalCeldas = Math.ceil((diasEnMes + primerDiaSemana - 1) / 7) * 7;
  let diaActual = inicioPrimerSemana;

  for (let i = 0; i < totalCeldas; i++) {
    if (i % 7 === 0) {
      const fila = document.createElement("tr");
      calendarBody.appendChild(fila);
    }
    const fila = calendarBody.lastChild;
    const celda = document.createElement("td");
    celda.classList.add("calendario-celda");

    let fecha;
    if (diaActual < 1) {
      const mesAnterior = mes === 0 ? 11 : mes - 1;
      const añoAnterior = mes === 0 ? año - 1 : año;
      fecha = new Date(añoAnterior, mesAnterior, diasMesAnterior + diaActual);
      celda.classList.add("fuera-de-mes");
    } else if (diaActual > diasEnMes) {
      const mesSiguiente = mes === 11 ? 0 : mes + 1;
      const añoSiguiente = mes === 11 ? año + 1 : año;
      fecha = new Date(añoSiguiente, mesSiguiente, diaActual - diasEnMes);
      celda.classList.add("fuera-de-mes");
    } else {
      fecha = new Date(año, mes, diaActual);
    }

    const fechaStr = formatDate(fecha);
    celda.setAttribute('data-fecha', fechaStr);

    // Verificar si es feriado
    const feriado = feriados.find(f => f.fecha === fechaStr);
    const diaNum = fecha.getDate();

    if (feriado) {
      celda.classList.add("feriado");
      // SAFE: diaNum is a number, feriado.nombre comes from hardcoded list
      safeInnerHTML(celda, `
        <div class="dia">${diaNum}</div>
        <div class="feriado-nombre">${feriado.nombre}</div>
        <div class="nombres">
          <div class="nombre"></div>
          <div class="nombre"></div>
          <div class="nombre"></div>
        </div>`);
    } else {
      // SAFE: diaNum is a number
      safeInnerHTML(celda, `
        <div class="dia">${diaNum}</div>
        <div class="nombres">
          <div class="nombre"></div>
          <div class="nombre"></div>
          <div class="nombre"></div>
        </div>`);
    }

    fila.appendChild(celda);
    diaActual++;
  }

  calendarTitle.textContent =
    `${new Intl.DateTimeFormat("es-ES", { month: "long" }).format(new Date(año, mes))} ${año}`;

  // Resetear variables para el calendario
  semanaActual = 0;
  asignacionesManual = {};
  if (calendarViewBtn) calendarViewBtn.disabled = true;
  if (linearViewBtn) linearViewBtn.disabled = false;

  if (linearContainer && linearContainer.style.display === "block") {
    generarVistaLineal();
  }
  resaltarSemanaActual();
}

// ----------------------
// 5) ASIGNAR TURNOS
// ----------------------
function asignarTurnos() {
  const filas = document.querySelectorAll("#calendar tbody tr");
  if (semanaActual >= filas.length) {
    return;
  }

  // Limpiar semana previa
  filas.forEach((fila, index) => {
    if (index !== semanaActual) {
      const nombresDivs = fila.querySelectorAll(".nombre");
      nombresDivs.forEach(div => {
        div.textContent = "";
        div.style.backgroundColor = "";
      });
      fila.classList.remove("assigned-week");
    }
  });

  // Asignar turnos
  const tecnico = tecnicosRed[semanaActual % tecnicosRed.length];
  const ingeniero = ingenieros[semanaActual % ingenieros.length];
  const planta = plantaExterna[semanaActual % plantaExterna.length];

  const fila = filas[semanaActual];
  const dias = fila.querySelectorAll("td");
  dias.forEach(dia => {
    const nombresDiv = dia.querySelectorAll(".nombre");
    if (nombresDiv.length === 3) {
      nombresDiv[0].textContent = tecnico;
      nombresDiv[0].style.backgroundColor = employeeColors[tecnico] || "#FFFFFF";
      nombresDiv[1].textContent = ingeniero;
      nombresDiv[1].style.backgroundColor = employeeColors[ingeniero] || "#FFFFFF";
      nombresDiv[2].textContent = planta;
      nombresDiv[2].style.backgroundColor = employeeColors[planta] || "#FFFFFF";
    }
  });
  fila.classList.add("assigned-week");

  asignacionesManual[semanaActual] = { tecnico, ingeniero, planta };

  // Guardar en Firestore
  const fechasSemana = [];
  dias.forEach(td => {
    const fechaStr = td.getAttribute("data-fecha");
    fechasSemana.push(fechaStr);
  });
  guardarAsignacionEnFirestore({ tecnico, ingeniero, planta }, semanaActual, currentYear, currentMonth, fechasSemana);

  // Notificar
  sendEmailNotification({ tecnico, ingeniero, planta });

  semanaActual++;
  resaltarSemanaActual();

  if (document.querySelector(".linear-container")?.style.display === "block") {
    generarVistaLineal();
  }

  // Habilitar edición: se fuerza que el botón "Editar Semanas" se habilite
  const openEditBtn = document.getElementById("open-edit-modal");
  // console.log("Estado del botón 'Editar Semanas' antes:", openEditBtn ? openEditBtn.disabled : "No encontrado");
  if (openEditBtn) openEditBtn.disabled = false;
  // console.log("Estado del botón 'Editar Semanas' después:", openEditBtn ? openEditBtn.disabled : "No encontrado");
}

// ----------------------
// 6) GUARDAR Y CARGAR ASIGNACIONES
// ----------------------
function guardarAsignacionEnFirestore(asignacion, semanaIndex, año, mes, fechasSemana) {
  if (!fechasSemana || !fechasSemana.length) return;
  const fechaInicio = fechasSemana[0];
  const fechaFin = fechasSemana[fechasSemana.length - 1];

  db.collection("AsignacionesSemanales").doc(`${año}-${mes}-${semanaIndex + 1}`)
    .set({
      tecnico: asignacion.tecnico,
      ingeniero: asignacion.ingeniero,
      planta: asignacion.planta,
      semana: semanaIndex + 1,
      año,
      mes,
      fechaInicio,
      fechaFin
    })
    .then(() => {
      // console.log("Asignación guardada en Firestore.");
    })
    .catch(error => console.error("Error al guardar asignación:", error));
}

window.cargarAsignacionesGuardadas = function (mes, año) {
  return db.collection('AsignacionesSemanales')
    .where('mes', '==', mes)
    .where('año', '==', año)
    .get()
    .then(querySnapshot => {
      let ultimaSemanaAsignada = -1;
      querySnapshot.forEach(doc => {
        const data = doc.data();
        const semanaIndex = data.semana - 1;

        asignacionesManual[semanaIndex] = {
          tecnico: data.tecnico,
          ingeniero: data.ingeniero,
          planta: data.planta
        };

        const filas = document.querySelectorAll("#calendar tbody tr");
        if (filas[semanaIndex]) {
          const fila = filas[semanaIndex];
          const dias = fila.querySelectorAll("td");
          dias.forEach(dia => {
            const nombresDiv = dia.querySelectorAll(".nombre");
            if (nombresDiv.length === 3) {
              nombresDiv[0].textContent = data.tecnico;
              nombresDiv[0].style.backgroundColor = employeeColors[data.tecnico] || "#FFFFFF";
              nombresDiv[1].textContent = data.ingeniero;
              nombresDiv[1].style.backgroundColor = employeeColors[data.ingeniero] || "#FFFFFF";
              nombresDiv[2].textContent = data.planta;
              nombresDiv[2].style.backgroundColor = employeeColors[data.planta] || "#FFFFFF";
            }
          });
          fila.classList.add("assigned-week");
        }
        if (semanaIndex > ultimaSemanaAsignada) {
          ultimaSemanaAsignada = semanaIndex;
        }
      });

      semanaActual = ultimaSemanaAsignada + 1;
      // Habilitar el botón "Editar Semanas" si hay asignaciones guardadas
      const openEditBtn = document.getElementById("open-edit-modal");
      if (openEditBtn && Object.keys(asignacionesManual).length > 0) {
        openEditBtn.disabled = false;
        // console.log("✅ Botón 'Editar Semanas' habilitado después de cargar asignaciones guardadas.");
      }
    })
    .catch(error => console.error("Error al cargar asignaciones guardadas:", error));
};

// ----------------------
// 7) NOTIFICACIONES TELEGRAM
// ----------------------
function sendEmailNotification(turnosSemana) {
  // console.log("🚀 Enviando notificaciones de Telegram para la asignación automática...");
  // console.log("📊 Datos de turnos:", turnosSemana);
  cargarContactosDesdeFirestore()
    .then(contactos => {
      additionalTelegram = contactos;
      const messageTecnico = `Hola ${turnosSemana.tecnico},
Se te ha asignado el turno de esta semana.
Ingeniero: ${turnosSemana.ingeniero}
Planta: ${turnosSemana.planta}`;

      sendTelegramNotification(turnosSemana.tecnico, messageTecnico);
      sendTelegramNotification(turnosSemana.ingeniero, `Hola ${turnosSemana.ingeniero}, Se te ha asignado el turno de esta semana.`);
      sendTelegramNotification(turnosSemana.planta, `Hola ${turnosSemana.planta}, Se te ha asignado el turno de esta semana.`);

      Object.keys(additionalTelegram).forEach(nombre => {
        const chatId = additionalTelegram[nombre];
        const mensajeAdicional = `${nombre}: Los encargados del turno de la semana actual son:
Técnico: ${turnosSemana.tecnico}
Ingeniero: ${turnosSemana.ingeniero}
Planta: ${turnosSemana.planta}`;
        sendTelegramNotificationConChatId(chatId, mensajeAdicional);
      });
    })
    .catch(error => console.error("Error cargando contactos:", error));
}

function sendTelegramNotification(employeeName, message) {
  const chatId = employeesTelegram[employeeName];

  console.log("📢 Intentando enviar mensaje a:", employeeName);
  console.log("📨 Mensaje:", message);
  console.log("📬 chatId:", chatId);

  if (!chatId) {
    console.error("🚨 ERROR: No se encontró chat ID para", employeeName);
    return;
  }

  fetch("https://turnos-app-8viu.onrender.com/send-message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, message })
  })
    .then(response => response.json())
    .then(data => console.log("✅ Respuesta de Telegram:", data))
    .catch(error => console.error("🚨 Error enviando mensaje:", error));
}

function sendTelegramNotificationConChatId(chatId, message) {
  console.log(`📢 Intentando enviar mensaje con chatId: ${chatId}`);
  console.log(`📨 Mensaje: ${message}`);

  if (!chatId) {
    console.error("🚨 ERROR: El chatId es requerido para enviar el mensaje.");
    return;
  }

  fetch("https://turnos-app-8viu.onrender.com/send-message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, message })
  })
    .then(response => response.json())
    .then(data => console.log(`✅ Mensaje enviado al chat ${chatId}:`, data))
    .catch(error => console.error(`🚨 Error enviando mensaje al chat ${chatId}:`, error));
}

// ----------------------
// 8) EDITAR SEMANA
// ----------------------
function actualizarUltimaSemana() {
  console.log("actualizarUltimaSemana invocado");
  const assignedWeeks = Object.keys(asignacionesManual);
  console.log("Asignaciones manuales:", asignacionesManual, "assignedWeeks:", assignedWeeks);
  if (!assignedWeeks.length) {
    showCustomAlert("No hay semanas asignadas.");
    return;
  }
  const lastWeekIndexString = assignedWeeks[assignedWeeks.length - 1];
  const lastWeekIndex = parseInt(lastWeekIndexString, 10);

  // Obtener valores de los selects del modal
  const nuevoTecnico = document.getElementById("edit-tecnico")?.value;
  const nuevoIngeniero = document.getElementById("edit-ingeniero")?.value;
  const nuevaPlanta = document.getElementById("edit-planta")?.value;

  console.log("Valores ingresados:", { nuevoTecnico, nuevoIngeniero, nuevaPlanta });

  const filas = document.querySelectorAll("#calendar tbody tr");
  if (lastWeekIndex < 0 || lastWeekIndex >= filas.length) {
    showCustomAlert("Semana inválida.");
    return;
  }

  const asignacionAnterior = asignacionesManual[lastWeekIndex] || {};
  const { tecnico: anteriorTecnico, ingeniero: anteriorIngeniero, planta: anteriorPlanta } = asignacionAnterior;

  const fila = filas[lastWeekIndex];
  const dias = fila.querySelectorAll("td");
  dias.forEach(dia => {
    const nombresDiv = dia.querySelectorAll(".nombre");
    if (nombresDiv.length === 3) {
      nombresDiv[0].textContent = nuevoTecnico;
      nombresDiv[0].style.backgroundColor = employeeColors[nuevoTecnico] || "#FFFFFF";
      nombresDiv[1].textContent = nuevoIngeniero;
      nombresDiv[1].style.backgroundColor = employeeColors[nuevoIngeniero] || "#FFFFFF";
      nombresDiv[2].textContent = nuevaPlanta;
      nombresDiv[2].style.backgroundColor = employeeColors[nuevaPlanta] || "#FFFFFF";
    }
  });

  asignacionesManual[lastWeekIndex] = {
    tecnico: nuevoTecnico,
    ingeniero: nuevoIngeniero,
    planta: nuevaPlanta
  };
  fila.classList.add("assigned-week");

  // Guardar la asignación actualizada en Firestore
  const fechasSemana = [];
  dias.forEach(td => {
    const fechaStr = td.getAttribute("data-fecha");
    fechasSemana.push(fechaStr);
  });
  guardarAsignacionEnFirestore({ tecnico: nuevoTecnico, ingeniero: nuevoIngeniero, planta: nuevaPlanta },
    lastWeekIndex, currentYear, currentMonth, fechasSemana);

  // Cerrar modal de edición
  const editModal = document.getElementById("edit-modal");
  if (editModal) {
    editModal.style.display = "none";
  } else {
    console.error("No se encontró el elemento 'edit-modal'. Asegúrate de haberlo agregado en tu HTML.");
  }

  showCustomAlert(`La Semana #${lastWeekIndex + 1} se ha actualizado correctamente.`);

  resaltarSemanaActual();
  if (document.querySelector(".linear-container")?.style.display === "block") {
    generarVistaLineal();
  }

  let mensajeCambio = `Se ha actualizado la Semana #${lastWeekIndex + 1}.\n`;
  if (nuevoTecnico !== anteriorTecnico) {
    mensajeCambio += `Nuevo Técnico: ${nuevoTecnico}\n`;
  } else {
    mensajeCambio += `Técnico sin cambios (${nuevoTecnico})\n`;
  }
  if (nuevoIngeniero !== anteriorIngeniero) {
    mensajeCambio += `Nuevo Ingeniero: ${nuevoIngeniero}\n`;
  } else {
    mensajeCambio += `Ingeniero sin cambios (${nuevoIngeniero})\n`;
  }
  if (nuevaPlanta !== anteriorPlanta) {
    mensajeCambio += `Nueva Planta: ${nuevaPlanta}\n`;
  } else {
    mensajeCambio += `Planta sin cambios (${nuevaPlanta})\n`;
  }

  // Notificar cambios vía Telegram
  sendTelegramNotification(nuevoTecnico, mensajeCambio);
  sendTelegramNotification(nuevoIngeniero, mensajeCambio);
  sendTelegramNotification(nuevaPlanta, mensajeCambio);
  Object.keys(additionalTelegram).forEach(nombre => {
    const chatId = additionalTelegram[nombre];
    sendTelegramNotificationConChatId(chatId, mensajeCambio);
  });
}

// ----------------------
// 9) VISTA LINEAL
// ----------------------
function generarVistaLineal() {
  const linearList = document.getElementById("linear-list");
  if (!linearList) return;

  linearList.innerHTML = "";
  const keys = Object.keys(asignacionesManual);
  if (!keys.length) {
    const p = document.createElement('p');
    p.textContent = 'No hay turnos asignados para mostrar en la Vista Lineal.';
    linearList.appendChild(p);
    return;
  }

  keys.forEach(semanaIndex => {
    const asignacion = asignacionesManual[semanaIndex];
    const fila = document.querySelector(`#calendar tbody tr:nth-child(${parseInt(semanaIndex) + 1})`);
    if (!fila) return;

    const fechasSemana = [];
    fila.querySelectorAll("td").forEach(td => {
      const fechaStr = td.getAttribute("data-fecha");
      fechasSemana.push(fechaStr);
    });

    const fechaInicio = new Date(fechasSemana[0]);
    const fechaFin = new Date(fechasSemana[fechasSemana.length - 1]);
    const opcionesFecha = { year: 'numeric', month: 'short', day: 'numeric' };
    const fechaInicioStr = fechaInicio.toLocaleDateString("es-ES", opcionesFecha);
    const fechaFinStr = fechaFin.toLocaleDateString("es-ES", opcionesFecha);

    const li = document.createElement("li");
    li.classList.add("linear-item");
    // SAFE: All data is from internal assignments (tecnico, ingeniero, planta names)
    safeInnerHTML(li, `
      <h3>Semana ${parseInt(semanaIndex) + 1}: ${fechaInicioStr} - ${fechaFinStr}</h3>
      <p><strong>Técnico:</strong> ${asignacion.tecnico}</p>
      <p><strong>Ingeniero:</strong> ${asignacion.ingeniero}</p>
      <p><strong>Planta Externa:</strong> ${asignacion.planta}</p>
    `);
    linearList.appendChild(li);
  });
}

// ----------------------
// 10) SEMANA ACTUAL / RESALTAR
// ----------------------
// obtenerSemanaActual imported from dateUtils


function resaltarSemanaActual() {
  const externalArrow = document.getElementById("external-arrow");
  if (!externalArrow) return;

  const semanaActualIndex = obtenerSemanaActual();
  const filas = document.querySelectorAll("#calendar tbody tr");
  filas.forEach((fila, index) => {
    if (index === semanaActualIndex) {
      const filaRect = fila.getBoundingClientRect();
      const containerRect = document.querySelector(".calendar-container")?.getBoundingClientRect() || { top: 0 };
      const topPosition = filaRect.top - containerRect.top + (filaRect.height / 2) - 10;
      externalArrow.style.top = `${topPosition}px`;
      externalArrow.style.display = "block";
    }
  });
}

// ----------------------
// 11) AUTOMATIZACIÓN
// ----------------------
const HORA_ASIGNACION = 9; // Cambia esto a la hora deseada (Formato 24h)
const MINUTO_ASIGNACION = 0; // Cambia esto a los minutos deseados

function asignacionAutomaticaTurnos() {
  const hoy = new Date();
  const dia = hoy.getDay(); // Lunes=1
  const hora = hoy.getHours();
  const minutos = hoy.getMinutes();

  if (dia === 1 && hora === HORA_ASIGNACION && minutos === MINUTO_ASIGNACION) {
    const semanaIndex = obtenerSemanaActual();
    if (!asignacionesManual.hasOwnProperty(semanaIndex)) {
      semanaActual = semanaIndex;
      asignarTurnos();
      console.log(`✅ Asignación automática de turnos ejecutada a las ${HORA_ASIGNACION}:${MINUTO_ASIGNACION}`);
    } else {
      const openEditBtn = document.getElementById("open-edit-modal");
      if (openEditBtn) {
        openEditBtn.disabled = false;
        console.log("✅ Botón 'Editar Semanas' habilitado (auto) porque ya existe asignación.");
      }
    }
  }
}

function inicializarAutomatizacion() {
  resaltarSemanaActual();
  setInterval(asignacionAutomaticaTurnos, 60000); // Verifica cada 1 minuto

  const hoy = new Date();
  const dia = hoy.getDay();
  const hora = hoy.getHours();
  const minutos = hoy.getMinutes();

  if (dia === 1 && (hora > HORA_ASIGNACION || (hora === HORA_ASIGNACION && minutos >= MINUTO_ASIGNACION))) {
    const semanaIndex = obtenerSemanaActual();
    if (!asignacionesManual.hasOwnProperty(semanaIndex)) {
      semanaActual = semanaIndex;
      asignarTurnos();
      console.log(`✅ Asignación automática de turnos al cargar la página (${HORA_ASIGNACION}:${MINUTO_ASIGNACION})`);
    }
  }

  const calendarBody = document.querySelector("#calendar tbody");
  if (calendarBody) {
    const observer = new MutationObserver(resaltarSemanaActual);
    observer.observe(calendarBody, { childList: true, subtree: true });
  }
}

// ----------------------
// 12) BÚSQUEDA POR FECHA
// ----------------------
function buscarAsignacionPorFecha() {
  const dateInput = document.getElementById("search-date");
  const resultDiv = document.getElementById("search-result");
  if (!dateInput || !resultDiv) return;

  const valor = dateInput.value;
  resultDiv.innerHTML = "";

  if (!valor) {
    resultDiv.textContent = "Por favor, ingrese una fecha válida.";
    return;
  }

  const fechaBuscada = new Date(valor);
  db.collection('AsignacionesSemanales').get()
    .then(querySnapshot => {
      let encontrado = false;
      querySnapshot.forEach(doc => {
        const data = doc.data();
        const inicio = new Date(data.fechaInicio);
        const fin = new Date(data.fechaFin);
        if (fechaBuscada >= inicio && fechaBuscada <= fin) {
          encontrado = true;
          // SAFE: Data comes from Firestore (internal asignaciones semanales)
          safeInnerHTML(resultDiv, `
            <h3>Semana ${data.semana} (${data.fechaInicio} - ${data.fechaFin})</h3>
            <p><strong>Técnico:</strong> ${data.tecnico}</p>
            <p><strong>Ingeniero:</strong> ${data.ingeniero}</p>
            <p><strong>Planta:</strong> ${data.planta}</p>
          `);
        }
      });
      if (!encontrado) {
        resultDiv.textContent = "No se encontró ninguna asignación para la fecha ingresada.";
      }
    })
    .catch(error => {
      console.error("Error al buscar asignación:", error);
      resultDiv.textContent = "Ocurrió un error al buscar la asignación.";
    });
}

// ----------------------
// 13) OTRAS FUNCIONES (CONTACTOS, EMPLEADOS)
// ----------------------
function cargarContactosDesdeFirestore() {
  return db.collection("ContactosAdicionales").get()
    .then(snapshot => {
      const obj = {};
      snapshot.forEach(doc => {
        obj[doc.id] = doc.data().chatId;
      });
      return obj;
    });
}

function guardarContactoEnFirestore(nombre, chatId) {
  return db.collection("ContactosAdicionales").doc(nombre).set({ chatId });
}

async function eliminarContactoEnFirestore(nombre) {
  // ============================================================
  // SECURITY: Verificar permisos de admin
  // ============================================================
  await requireAdmin('eliminar contactos');
  // ============================================================

  await db.collection("ContactosAdicionales").doc(nombre).delete();
  await auditLog('CONTACT_DELETED', { contactName: nombre });
  return;
}

function leerEmpleados() {
  return db.collection("Empleados").get()
    .then(snapshot => {
      const lista = [];
      snapshot.forEach(doc => {
        lista.push(doc.data()); // { nombre, rol, telegramChatId, color? }
      });
      return lista;
    });
}

async function guardarEmpleadoEnFirestore(nombre, rol, telegramChatId) {
  // ============================================================
  // SECURITY: Verificar permisos de admin
  // ============================================================
  await requireAdmin('crear/modificar empleados');
  // ============================================================

  await db.collection("Empleados").doc(nombre).set({ nombre, rol, telegramChatId });
  await auditLog('EMPLOYEE_SAVED', { employeeName: nombre, role: rol });
  return;
}

async function eliminarEmpleado(nombre) {
  // ============================================================
  // SECURITY: Verificar permisos de admin y requiere re-autenticación
  // ============================================================
  await requireAdmin('eliminar empleados');
  await requireRecentAuth(5); // Requiere autenticación reciente (5 min)
  // ============================================================

  await db.collection("Empleados").doc(nombre).delete();
  await auditLog('EMPLOYEE_DELETED', { employeeName: nombre });
  return;
}

// ----------------------
// 14) ALERTAS PERSONALIZADAS
// ----------------------
function showCustomAlert(message) {
  const alertModal = document.getElementById("custom-alert");
  const alertMessage = document.getElementById("alert-message");
  const closeAlert = document.getElementById("close-alert");

  if (!alertModal || !alertMessage || !closeAlert) {
    alert(message);
    return;
  }

  alertMessage.textContent = message;
  alertModal.style.display = "flex";

  closeAlert.onclick = () => {
    alertModal.style.display = "none";
  };

  window.onclick = event => {
    if (event.target === alertModal) {
      alertModal.style.display = "none";
    }
  };
}

// Función dummy callback
function callback() {
  console.log("callback() llamado (dummy)");
}

// ----------------------
// 15) EVENTOS DE LA PÁGINA
// ----------------------
document.addEventListener("DOMContentLoaded", () => {
  // Asignar event listener al botón "Actualizar Semana"
  const updateWeekBtn = document.getElementById("update-week");
  if (updateWeekBtn) {
    updateWeekBtn.addEventListener("click", actualizarUltimaSemana);
  }

  // 15.1 Botones generales
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      auth.signOut()
        .then(() => {
          console.log("Sesión cerrada.");
          localStorage.removeItem("userRole"); // Limpiar rol en caché
          window.location.href = "login.html";
        })
        .catch(error => console.error("Error al cerrar sesión:", error));
    });
  }
  db.collection("userRoles").get().then(snapshot => {
    snapshot.forEach(doc => {
      console.log(`📄 Documento ID: ${doc.id}`, doc.data());
    });
  });

  const elemento = document.getElementById("elemento-id");
  if (elemento) {
    elemento.addEventListener("click", callback);
  }

  // Prev / Next Month
  const prevMonthBtn = document.getElementById("prev-month");
  const nextMonthBtn = document.getElementById("next-month");
  if (prevMonthBtn) {
    prevMonthBtn.addEventListener("click", () => {
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }
      generarCalendario(currentMonth, currentYear);
      cargarAsignacionesGuardadas(currentMonth, currentYear);
    });
  }
  if (nextMonthBtn) {
    nextMonthBtn.addEventListener("click", () => {
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      generarCalendario(currentMonth, currentYear);
      cargarAsignacionesGuardadas(currentMonth, currentYear);
    });
  }

  // Botón Asignar Turnos
  const assignTurnsBtn = document.getElementById("assign-turns");
  if (assignTurnsBtn) {
    assignTurnsBtn.addEventListener("click", asignarTurnos);
  }

  // Botón buscar por fecha
  const searchButton = document.getElementById("search-button");
  if (searchButton) {
    searchButton.addEventListener("click", buscarAsignacionPorFecha);
  }

  // Botones vista calendario / lineal
  const calendarViewBtn = document.getElementById("calendar-view-btn");
  const linearViewBtn = document.getElementById("linear-view-btn");
  if (calendarViewBtn) {
    calendarViewBtn.addEventListener("click", () => {
      document.querySelector(".calendar-container").style.display = "block";
      document.querySelector(".linear-container").style.display = "none";
      calendarViewBtn.disabled = true;
      linearViewBtn.disabled = false;
    });
  }
  if (linearViewBtn) {
    linearViewBtn.addEventListener("click", () => {
      document.querySelector(".calendar-container").style.display = "none";
      document.querySelector(".linear-container").style.display = "block";
      calendarViewBtn.disabled = false;
      linearViewBtn.disabled = true;
      generarVistaLineal();
    });
  }

  // Botón Editar Semana (abrir modal de edición)
  const openEditBtn = document.getElementById("open-edit-modal");
  if (openEditBtn) {
    openEditBtn.addEventListener("click", () => {
      cargarYOrganizarEmpleados().then(() => {
        cargarEmpleadosEnSelect("edit-tecnico", tecnicosRed);
        cargarEmpleadosEnSelect("edit-ingeniero", ingenieros);
        cargarEmpleadosEnSelect("edit-planta", plantaExterna);
        const editModal = document.getElementById("edit-modal");
        if (editModal) {
          editModal.style.display = "flex";
        } else {
          console.error("No se encontró el elemento con id 'edit-modal'. Agrega el modal correspondiente en tu HTML.");
        }
      }).catch(err => console.error("Error al cargar empleados:", err));
    });
  }

  // Cerrar modal de edición (usando el botón específico "close-edit-modal")
  const closeEditModalBtn = document.getElementById("close-edit-modal");
  const editModal = document.getElementById("edit-modal");
  if (closeEditModalBtn && editModal) {
    closeEditModalBtn.addEventListener("click", () => {
      editModal.style.display = "none";
    });
    window.addEventListener("click", event => {
      if (event.target === editModal) {
        editModal.style.display = "none";
      }
    });
  } else {
    console.error("No se encontró el botón o el modal de edición (close-edit-modal / edit-modal).");
  }

  // 15.2 Automatización
  inicializarAutomatizacion();

  // 15.3 Cargar Contactos y Empleados
  cargarContactosDesdeFirestore()
    .then(contactos => {
      additionalTelegram = contactos;
      renderizarContactosEnSelect();
    })
    .catch(err => console.error("Error al cargar contactos:", err));

  cargarYOrganizarEmpleados()
    .then(() => {
      generarCalendario(currentMonth, currentYear);
      return cargarAsignacionesGuardadas(currentMonth, currentYear);
    })
    .catch(err => console.error("Error al inicializar calendario:", err));

  // 15.4 Manejo del modal de contactos adicionales
  const manageAdditionalBtn = document.getElementById("manage-additional-btn");
  const manageAdditionalModal = document.getElementById("manage-additional-modal");
  const closeAdditionalModal = document.getElementById("close-additional-modal");
  if (manageAdditionalBtn && manageAdditionalModal) {
    manageAdditionalBtn.addEventListener("click", () => {
      cargarContactosDesdeFirestore()
        .then(ctos => {
          additionalTelegram = ctos;
          renderizarContactosEnSelect();
          manageAdditionalModal.style.display = "flex";
        })
        .catch(e => console.error("Error al cargar contactos:", e));
    });
    if (closeAdditionalModal) {
      closeAdditionalModal.addEventListener("click", () => {
        manageAdditionalModal.style.display = "none";
      });
    }
    window.addEventListener("click", event => {
      if (event.target === manageAdditionalModal) {
        manageAdditionalModal.style.display = "none";
      }
    });
  }

  // Eliminar / Editar contacto
  const contactSelect = document.getElementById("contact-select");
  const editContactBtn = document.getElementById("edit-contact-btn");
  const deleteContactBtn = document.getElementById("delete-contact-btn");
  const contactNameInput = document.getElementById("contact-name");
  const contactIdInput = document.getElementById("contact-id");
  if (contactSelect && editContactBtn && deleteContactBtn) {
    contactSelect.addEventListener("change", () => {
      if (contactSelect.value) {
        editContactBtn.disabled = false;
        deleteContactBtn.disabled = false;
      } else {
        editContactBtn.disabled = true;
        deleteContactBtn.disabled = true;
      }
    });

    if (deleteContactBtn) {
      deleteContactBtn.addEventListener("click", () => {
        const selected = contactSelect.value;
        if (!selected) return;

        eliminarContactoEnFirestore(selected)
          .then(() => {
            showCustomAlert("Contacto eliminado correctamente.");
            return cargarContactosDesdeFirestore();
          })
          .then(ctos => {
            additionalTelegram = ctos;
            renderizarContactosEnSelect();
            contactSelect.value = "";
            editContactBtn.disabled = true;
            deleteContactBtn.disabled = true;
          })
          .catch(e => console.error("Error al eliminar contacto:", e));
      });
    }

    if (editContactBtn) {
      editContactBtn.addEventListener("click", () => {
        const selected = contactSelect.value;
        if (!selected) return;
        contactNameInput.value = selected;
        contactIdInput.value = additionalTelegram[selected] || "";
      });
    }
  }
  const saveContactBtn = document.getElementById("save-contact");
  if (saveContactBtn) {
    saveContactBtn.addEventListener("click", () => {
      const contactNameInput = document.getElementById("contact-name");
      const contactIdInput = document.getElementById("contact-id");
      const contactSelect = document.getElementById("contact-select");
      const editContactBtn = document.getElementById("edit-contact-btn");
      const deleteContactBtn = document.getElementById("delete-contact-btn");

      const nombre = contactNameInput.value.trim();
      const chatId = contactIdInput.value.trim();
      if (!nombre || !chatId) {
        alert("Por favor, ingrese nombre y chat ID.");
        return;
      }

      guardarContactoEnFirestore(nombre, chatId)
        .then(() => {
          showCustomAlert("Contacto guardado correctamente.");
          return cargarContactosDesdeFirestore();
        })
        .then(ctos => {
          additionalTelegram = ctos;
          renderizarContactosEnSelect();
          contactNameInput.value = "";
          contactIdInput.value = "";
          contactSelect.value = "";
          if (editContactBtn) editContactBtn.disabled = true;
          if (deleteContactBtn) deleteContactBtn.disabled = true;
        })
        .catch(e => console.error("Error al guardar contacto:", e));
    });
  }

  // 15.5 Manejo de Empleados
  const manageEmpleadosBtn = document.getElementById("manage-empleados-btn");
  const manageEmpleadosModal = document.getElementById("manage-empleados-modal");
  const closeEmpleadosModal = document.getElementById("close-empleados-modal");
  if (manageEmpleadosBtn && manageEmpleadosModal) {
    manageEmpleadosBtn.addEventListener("click", () => {
      cargarEmpleadosEnSelectGeneral();
      cargarEmpleadosEnLista();
      manageEmpleadosModal.style.display = "flex";
    });
    if (closeEmpleadosModal) {
      closeEmpleadosModal.addEventListener("click", () => {
        manageEmpleadosModal.style.display = "none";
      });
    }
  }
  const empleadosSelect = document.getElementById("empleados-select");
  const editEmployeeBtn = document.getElementById("edit-employee-btn");
  const deleteEmployeeBtn = document.getElementById("delete-employee-btn");
  if (empleadosSelect && editEmployeeBtn && deleteEmployeeBtn) {
    empleadosSelect.addEventListener("change", () => {
      const v = empleadosSelect.value;
      editEmployeeBtn.disabled = !v;
      deleteEmployeeBtn.disabled = !v;
    });
    editEmployeeBtn.addEventListener("click", () => {
      const seleccionado = empleadosSelect.value;
      if (!seleccionado) return;
      leerEmpleados().then(empleados => {
        const emp = empleados.find(e => e.nombre === seleccionado);
        if (emp) {
          document.getElementById("empleado-name").value = emp.nombre;
          document.getElementById("empleado-rol").value = emp.rol;
          document.getElementById("empleado-chatid").value = emp.telegramChatId;
        }
      }).catch(err => console.error(err));
    });

    deleteEmployeeBtn.addEventListener("click", () => {
      const seleccionado = empleadosSelect.value;
      if (!seleccionado) return;

      eliminarEmpleado(seleccionado)
        .then(() => {
          showCustomAlert("Empleado eliminado correctamente.");
          return cargarYOrganizarEmpleados();
        })
        .then(() => {
          cargarEmpleadosEnSelectGeneral();
          cargarEmpleadosEnLista();
          if (document.getElementById("edit-modal")?.style.display === "flex") {
            cargarEmpleadosEnSelect("edit-tecnico", tecnicosRed);
            cargarEmpleadosEnSelect("edit-ingeniero", ingenieros);
            cargarEmpleadosEnSelect("edit-planta", plantaExterna);
          }
        })
        .catch(err => console.error("Error al eliminar empleado:", err));
    });
  }

  const saveEmpleadoBtn = document.getElementById("save-empleado");
  if (saveEmpleadoBtn) {
    saveEmpleadoBtn.addEventListener("click", () => {
      const nombre = document.getElementById("empleado-name").value.trim();
      const rol = document.getElementById("empleado-rol").value;
      const telegramChatId = document.getElementById("empleado-chatid").value.trim();
      if (!nombre || !telegramChatId) {
        showCustomAlert("Por favor, ingrese nombre y chat ID.");
        return;
      }
      guardarEmpleadoEnFirestore(nombre, rol, telegramChatId)
        .then(() => {
          showCustomAlert("Empleado guardado correctamente.");
          document.getElementById("empleado-name").value = "";
          document.getElementById("empleado-chatid").value = "";
          manageEmpleadosModal.style.display = "none";
          return cargarYOrganizarEmpleados();
        })
        .then(() => {
          cargarEmpleadosEnSelectGeneral();
          cargarEmpleadosEnLista();
          if (document.getElementById("edit-modal")?.style.display === "flex") {
            cargarEmpleadosEnSelect("edit-tecnico", tecnicosRed);
            cargarEmpleadosEnSelect("edit-ingeniero", ingenieros);
            cargarEmpleadosEnSelect("edit-planta", plantaExterna);
          }
        })
        .catch(err => console.error("Error al guardar empleado:", err));
    });
  }

  // 15.6 BOTÓN QUE ABRE EL MODAL DE CREAR USUARIO



  document.addEventListener("DOMContentLoaded", () => {
    const lastPage = localStorage.getItem("lastPage");

    auth.onAuthStateChanged(user => {
      if (user) {
        db.collection("userRoles").doc(user.uid).get().then(doc => {
          if (doc.exists) {
            const role = doc.data().rol;
            if (
              (role !== "admin" && role !== "superadmin") &&
              window.location.pathname.includes("index.html")
            ) {
              window.location.href = lastPage || "user.html";
            }
            if (role === "superadmin") {
              const liRegistros = document.getElementById("li-registros");
              if (liRegistros) {
                liRegistros.style.display = "block";
              }
            }
          }
        });
      }
    });
  });



  // 15.2 EXTRA: RENDERIZAR CONTACTOS
  function renderizarContactosEnSelect() {
    const contactSelect = document.getElementById("contact-select");
    if (!contactSelect) return;
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Seleccione un contacto --';
    contactSelect.innerHTML = ''; // Clear first
    contactSelect.appendChild(defaultOption);
    Object.keys(additionalTelegram).forEach(nombre => {
      const option = document.createElement("option");
      option.value = nombre;
      option.textContent = nombre;
      contactSelect.appendChild(option);
    });
    const editContactBtn = document.getElementById("edit-contact-btn");
    const deleteContactBtn = document.getElementById("delete-contact-btn");
    if (editContactBtn) editContactBtn.disabled = true;
    if (deleteContactBtn) deleteContactBtn.disabled = true;
  }

  // ----------------------
  // 17) CARGAR/ORGANIZAR EMPLEADOS
  // ----------------------
  function cargarYOrganizarEmpleados() {
    return leerEmpleados().then(empleados => {
      tecnicosRed = [];
      ingenieros = [];
      plantaExterna = [];
      empleados.forEach(emp => {
        switch (emp.rol) {
          case "Técnico de Red":
            tecnicosRed.push(emp.nombre);
            break;
          case "Ingeniero":
            ingenieros.push(emp.nombre);
            break;
          case "Planta Externa":
            plantaExterna.push(emp.nombre);
            break;
        }
        employeesTelegram[emp.nombre] = emp.telegramChatId;
        if (emp.color) {
          employeeColors[emp.nombre] = emp.color;
        }
      });
    });
  }

  function cargarEmpleadosEnSelect(selectId, empleados) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = "";
    empleados.forEach(nombre => {
      const opt = document.createElement("option");
      opt.value = nombre;
      opt.textContent = nombre;
      sel.appendChild(opt);
    });
  }

  function cargarEmpleadosEnLista() {
    // Implementa la renderización en lista si es necesario
  }

  function cargarEmpleadosEnSelectGeneral() {
    const empleadosSelect = document.getElementById("empleados-select");
    if (!empleadosSelect) return;
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Seleccione un empleado --';
    empleadosSelect.innerHTML = ''; // Clear first
    empleadosSelect.appendChild(defaultOption);
    leerEmpleados().then(empleados => {
      empleados.forEach(emp => {
        const option = document.createElement("option");
        option.value = emp.nombre;
        option.textContent = `${emp.nombre} - ${emp.rol}`;
        empleadosSelect.appendChild(option);
      });
    }).catch(error => console.error("Error al cargar empleados en select:", error));
  }

  auth.onAuthStateChanged(user => {
    if (user) {
      const welcomeMessage = document.getElementById("welcome-message");
      if (welcomeMessage) {
        welcomeMessage.textContent = user.email;
      }
    } else {
      console.warn("Usuario no autenticado. Redirigiendo al login.");
      window.location.href = "login.html";
    }
  });

  function customConfirm(message, title = "Confirmación") {
    return new Promise(resolve => {
      const modal = document.getElementById("custom-confirm");
      const confirmMessage = document.getElementById("confirm-message");
      const confirmTitle = document.getElementById("confirm-title");
      const yesBtn = document.getElementById("confirm-yes");
      const noBtn = document.getElementById("confirm-no");
      const closeBtn = document.getElementById("close-confirm");

      confirmTitle.textContent = title;
      confirmMessage.textContent = message;
      modal.style.display = "flex";

      function cleanUp() {
        modal.style.display = "none";
        yesBtn.removeEventListener("click", onYes);
        noBtn.removeEventListener("click", onNo);
        closeBtn.removeEventListener("click", onNo);
      }

      function onYes() {
        cleanUp();
        resolve(true);
      }
      function onNo() {
        cleanUp();
        resolve(false);
      }

      yesBtn.addEventListener("click", onYes);
      noBtn.addEventListener("click", onNo);
      closeBtn.addEventListener("click", onNo);
    });
  }

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelector('.active').classList.remove('active', 'fade');
      document.querySelector(`#${btn.dataset.target}`).classList.add('active', 'fade');
    });
  });

  // -----------------------------------------------------------------------------
  // OPTIMIZACIÓN DE CARGA Y GESTIÓN DE ROLES
  // -----------------------------------------------------------------------------

  function applyUserRole(role) {
    // Mostrar elementos de superadmin
    // Mostrar/Ocultar elementos de superadmin
    const liRegistros = document.getElementById("li-registros");
    const liUsuarios = document.getElementById("li-usuarios");
    const liAnimaciones = document.getElementById("li-animaciones");
    if (liRegistros) {
      liRegistros.style.display = (role === "superadmin") ? "block" : "none";
    }
    if (liUsuarios) {
      liUsuarios.style.display = (role === "superadmin") ? "block" : "none";
    }
    if (liAnimaciones) {
      liAnimaciones.style.display = (role === "superadmin") ? "block" : "none";
    }

    // Mostrar elementos de admin (Gestionar Empleados)
    if (role === "admin" || role === "superadmin") {
      document.querySelectorAll(".admin-only").forEach(el => {
        el.style.display = "block"; // O "flex", según tu CSS. "block" es seguro para <li>
      });
    }

    // Redirección si no es admin y está en index.html
    if ((role !== "admin" && role !== "superadmin") && window.location.pathname.includes("index.html")) {
      // Priorizar Directorio como "Home"
      window.location.href = "directorio.html";
    }
  }

  const initApp = () => {
    // 1. Inicializar UI básica
    const sidebar = document.getElementById("sidebar");
    const mainContent = document.getElementById("main-content");
    const menuToggleBtns = document.querySelectorAll("#menu-toggle");

    menuToggleBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        sidebar.classList.toggle("expanded");
        if (mainContent) mainContent.classList.toggle("expanded");
      });
    });

    lucide.createIcons();

    // 2. Carga Optimista del Rol (Cache)
    const cachedRole = localStorage.getItem("userRole");
    if (cachedRole) {
      console.log("Aplicando rol desde caché:", cachedRole);
      applyUserRole(cachedRole);
    }

    // 3. Verificación de Autenticación y Rol (Segundo plano)
    auth.onAuthStateChanged(user => {
      if (user) {
        const welcomeMessage = document.getElementById("welcome-message");
        if (welcomeMessage) welcomeMessage.textContent = user.email;

        db.collection("userRoles").doc(user.uid).get().then(doc => {
          if (doc.exists) {
            const role = doc.data().rol;

            // Actualizar caché si cambió
            if (role !== cachedRole) {
              console.log("Rol actualizado desde Firestore:", role);
              localStorage.setItem("userRole", role);
              applyUserRole(role);
            }
          }
        }).catch(err => console.error("Error verificando rol:", err));

      } else {
        console.warn("Usuario no autenticado. Redirigiendo al login.");
        window.location.href = "login.html";
      }
    });

    // 4. Timer de Inactividad
    let inactivityTimer = null;
    const ONE_MINUTE = 3000 * 1000; // 50 minutos (según código original 3000*1000 = 3,000,000ms = 50min)

    function resetInactivityTimer() {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        console.log("Cerrando sesión por inactividad en el frontend");
        firebase.auth().signOut().then(() => {
          localStorage.removeItem('userRole');
          window.location.href = "login.html";
        });
      }, ONE_MINUTE);
    }

    window.addEventListener("mousemove", resetInactivityTimer);
    window.addEventListener("keydown", resetInactivityTimer);
    window.addEventListener("scroll", resetInactivityTimer);
    resetInactivityTimer();

    // 5. Inicialización de la Vista Turnos (Restaurado)
    if (document.getElementById("calendar")) {
      console.log("Inicializando calendario...");

      // 1. Renderizar estructura básica inmediatamente
      generarCalendario(currentMonth, currentYear);

      // 2. Cargar empleados y luego asignaciones
      cargarYOrganizarEmpleados().then(() => {
        console.log("Empleados cargados. Cargando asignaciones...");
        cargarAsignacionesGuardadas(currentMonth, currentYear);
        inicializarAutomatizacion();
      }).catch(err => {
        console.error("Error cargando empleados:", err);
        // Intentar cargar asignaciones de todos modos
        cargarAsignacionesGuardadas(currentMonth, currentYear);
      });

      // Cargar empleados en selects si existen
      if (document.getElementById("empleados-select")) {
        cargarEmpleadosEnSelectGeneral();
      }
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }


});
