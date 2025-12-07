const auth = window.auth;
const db = window.db;

window.onerror = function (msg, url, line, col, error) {
  console.error("Global Error:", msg, "Line:", line, "Error:", error);
  alert("Error en script.js: " + msg + " Linea: " + line);
};

// console.log("Script.js start. DB:", db, "Auth:", auth);

let editingUserId = null; // Si es null, estamos en modo creación; si tiene un valor, en modo edición

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
function calcularPascua(year) {
  let a = year % 19;
  let b = Math.floor(year / 100);
  let c = year % 100;
  let d = Math.floor(b / 4);
  let e = b % 4;
  let f = Math.floor((b + 8) / 25);
  let g = Math.floor((b - f + 1) / 3);
  let h = (19 * a + b - d - g + 15) % 30;
  let i = Math.floor(c / 4);
  let k = c % 4;
  let l = (32 + 2 * e + 2 * i - h - k) % 7;
  let m = Math.floor((a + 11 * h + 22 * l) / 451);
  let month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  let day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function obtenerFeriadosMoviles(year) {
  const pascua = calcularPascua(year);
  const viernesSanto = new Date(pascua);
  viernesSanto.setDate(pascua.getDate() - 2);
  const sabadoSanto = new Date(pascua);
  sabadoSanto.setDate(pascua.getDate() - 1);
  return [
    { fecha: formatDate(viernesSanto), nombre: "Viernes Santo" },
    { fecha: formatDate(sabadoSanto), nombre: "Sábado Santo" }
  ];
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = (`0${date.getMonth() + 1}`).slice(-2);
  const day = (`0${date.getDate()}`).slice(-2);
  return `${year}-${month}-${day}`;
}

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

// Iniciar carga de feriados al cargar el script
document.addEventListener("DOMContentLoaded", cargarFeriadosScript);

function generarFeriados(year) {
  let feriadosFijos = [];

  if (feriadosCache) {
    feriadosFijos = feriadosCache;
  } else {
    // Fallback hardcoded si no ha cargado aún
    feriadosFijos = [
      { "fecha": "2025-01-01", "nombre": "Año Nuevo (irrenunciable)" },
      { "fecha": "2025-04-18", "nombre": "Viernes Santo" },
      { "fecha": "2025-04-19", "nombre": "Sábado Santo" },
      { "fecha": "2025-05-01", "nombre": "Día Nacional del Trabajo (irrenunciable)" },
      { "fecha": "2025-05-21", "nombre": "Día de las Glorias Navales" },
      { "fecha": "2025-06-20", "nombre": "Día Nacional de los Pueblos Indígenas" },
      { "fecha": "2025-06-29", "nombre": "San Pedro y San Pablo" },
      { "fecha": "2025-07-16", "nombre": "Día de la Virgen del Carmen" },
      { "fecha": "2025-08-15", "nombre": "Asunción de la Virgen" },
      { "fecha": "2025-09-18", "nombre": "Independencia Nacional (irrenunciable)" },
      { "fecha": "2025-09-19", "nombre": "Día de las Glorias del Ejército (irrenunciable)" },
      { "fecha": "2025-10-12", "nombre": "Encuentro de Dos Mundos" },
      { "fecha": "2025-10-31", "nombre": "Día de las Iglesias Evangélicas y Protestantes" },
      { "fecha": "2025-11-01", "nombre": "Día de Todos los Santos" },
      { "fecha": "2025-12-08", "nombre": "Inmaculada Concepción" },
      { "fecha": "2025-12-25", "nombre": "Navidad (irrenunciable)" },
      // 2026
      { "fecha": "2026-01-01", "nombre": "Año Nuevo (irrenunciable)" },
      { "fecha": "2026-04-03", "nombre": "Viernes Santo" },
      { "fecha": "2026-04-04", "nombre": "Sábado Santo" },
      { "fecha": "2026-05-01", "nombre": "Día Nacional del Trabajo (irrenunciable)" },
      { "fecha": "2026-05-21", "nombre": "Día de las Glorias Navales" },
      { "fecha": "2026-06-20", "nombre": "Día Nacional de los Pueblos Indígenas" },
      { "fecha": "2026-06-29", "nombre": "San Pedro y San Pablo" },
      { "fecha": "2026-07-16", "nombre": "Día de la Virgen del Carmen" },
      { "fecha": "2026-08-15", "nombre": "Asunción de la Virgen" },
      { "fecha": "2026-09-18", "nombre": "Independencia Nacional (irrenunciable)" },
      { "fecha": "2026-09-19", "nombre": "Día de las Glorias del Ejército (irrenunciable)" },
      { "fecha": "2026-10-12", "nombre": "Encuentro de Dos Mundos" },
      { "fecha": "2026-10-31", "nombre": "Día de las Iglesias Evangélicas y Protestantes" },
      { "fecha": "2026-11-01", "nombre": "Día de Todos los Santos" },
      { "fecha": "2026-12-08", "nombre": "Inmaculada Concepción" },
      { "fecha": "2026-12-25", "nombre": "Navidad (irrenunciable)" }
    ];
  }

  const feriadosMoviles = obtenerFeriadosMoviles(year);
  return [...feriadosFijos, ...feriadosMoviles];
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
      celda.innerHTML = `
        <div class="dia">${diaNum}</div>
        <div class="feriado-nombre">${feriado.nombre}</div>
        <div class="nombres">
          <div class="nombre"></div>
          <div class="nombre"></div>
          <div class="nombre"></div>
        </div>`;
    } else {
      celda.innerHTML = `
        <div class="dia">${diaNum}</div>
        <div class="nombres">
          <div class="nombre"></div>
          <div class="nombre"></div>
          <div class="nombre"></div>
        </div>`;
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

function cargarAsignacionesGuardadas(mes, año) {
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
}

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
    linearList.innerHTML = "<p>No hay turnos asignados para mostrar en la Vista Lineal.</p>";
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
    li.innerHTML = `
      <h3>Semana ${parseInt(semanaIndex) + 1}: ${fechaInicioStr} - ${fechaFinStr}</h3>
      <p><strong>Técnico:</strong> ${asignacion.tecnico}</p>
      <p><strong>Ingeniero:</strong> ${asignacion.ingeniero}</p>
      <p><strong>Planta Externa:</strong> ${asignacion.planta}</p>
    `;
    linearList.appendChild(li);
  });
}

// ----------------------
// 10) SEMANA ACTUAL / RESALTAR
// ----------------------
function obtenerSemanaActual() {
  const hoy = new Date();
  const mes = hoy.getMonth();
  const año = hoy.getFullYear();
  const primerDiaDelMes = new Date(año, mes, 1);
  const diaSemanaPrimerDia = primerDiaDelMes.getDay() === 0 ? 7 : primerDiaDelMes.getDay();
  const diaDelMes = hoy.getDate();
  return Math.floor((diaDelMes + diaSemanaPrimerDia - 2) / 7);
}

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
          resultDiv.innerHTML = `
            <h3>Semana ${data.semana} (${data.fechaInicio} - ${data.fechaFin})</h3>
            <p><strong>Técnico:</strong> ${data.tecnico}</p>
            <p><strong>Ingeniero:</strong> ${data.ingeniero}</p>
            <p><strong>Planta:</strong> ${data.planta}</p>
          `;
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

function eliminarContactoEnFirestore(nombre) {
  return db.collection("ContactosAdicionales").doc(nombre).delete();
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

function guardarEmpleadoEnFirestore(nombre, rol, telegramChatId) {
  return db.collection("Empleados").doc(nombre).set({ nombre, rol, telegramChatId });
}

function eliminarEmpleado(nombre) {
  return db.collection("Empleados").doc(nombre).delete();
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
  const addUserBtn = document.getElementById("add-user-btn");
  const createUserModal = document.getElementById("create-user-modal");
  if (addUserBtn && createUserModal) {
    addUserBtn.addEventListener("click", () => {
      createUserModal.style.display = "flex";
      cargarUsuarios();
    });
  }

  const closeCreateUserModal = document.getElementById("close-create-user-modal");
  if (closeCreateUserModal && createUserModal) {
    closeCreateUserModal.addEventListener("click", () => {
      createUserModal.style.display = "none";
    });
    window.addEventListener("click", event => {
      if (event.target === createUserModal) {
        createUserModal.style.display = "none";
      }
    });
  }

  // 15.7 CREAR USUARIO NUEVO (SecondaryAuth)
  const createUserBtn = document.getElementById("create-user-btn");
  if (createUserBtn) {
    createUserBtn.addEventListener("click", () => {
      const email = document.getElementById("new-user-email").value.trim();
      const password = document.getElementById("new-user-password").value.trim();
      const role = document.getElementById("new-user-role").value;

      if (!email) {
        Swal.fire("Error", "Por favor, ingresa un correo electrónico.", "error");
        return;
      }

      if (editingUserId) {
        // Actualizar usuario existente
        db.collection("userRoles").doc(editingUserId).update({
          email,
          rol: role
        })
          .then(() => {
            Swal.fire("Éxito", "Usuario actualizado correctamente.", "success");
            createUserBtn.textContent = "Crear Usuario";
            editingUserId = null;
            limpiarFormularioUsuario();
            cargarUsuarios();
          })
          .catch(error => {
            console.error("🚨 Error al actualizar usuario:", error);
            Swal.fire("Error", "No se pudo actualizar el usuario.", "error");
          });
      } else {
        // Crear un nuevo usuario
        if (!password) {
          Swal.fire("Error", "Por favor, ingresa una contraseña para el nuevo usuario.", "error");
          return;
        }

        window.secondaryAuth.createUserWithEmailAndPassword(email, password)
          .then(async userCredential => {
            const newUser = userCredential.user;
            await db.collection("userRoles").doc(newUser.uid).set({
              email,
              rol: role,
              mustChangePassword: true
            });
            Swal.fire("Éxito", "Usuario creado exitosamente.", "success");
            limpiarFormularioUsuario();
            cargarUsuarios();
          })
          .catch(err => {
            console.error("🚨 Error creando usuario:", err);
            Swal.fire("Error", "Error al crear usuario: " + err.message, "error");
          });
      }
    });
  }

  function limpiarFormularioUsuario() {
    document.getElementById("new-user-email").value = "";
    document.getElementById("new-user-password").value = "";
    document.getElementById("new-user-role").value = "user";
  }

  // 15.8 BOTÓN QUE ABRE EL MODAL DE GESTIONAR USUARIOS
  const openManageUserBtn = document.getElementById("open-manage-user-btn");
  const manageUserModal = document.getElementById("manage-user-modal");
  if (openManageUserBtn && manageUserModal) {
    openManageUserBtn.addEventListener("click", () => {
      cargarUsuarios();
      resetFormUserManagement();
      manageUserModal.style.display = "flex";
    });
  }

  const closeUserModal = document.getElementById("close-user-modal");
  if (closeUserModal && manageUserModal) {
    closeUserModal.addEventListener("click", () => {
      manageUserModal.style.display = "none";
    });
  }

  const userSelect = document.getElementById("user-select");
  const userEmailInput = document.getElementById("user-email");
  const userPasswordInput = document.getElementById("user-password");
  const userRoleSelect = document.getElementById("user-role");
  const editUserBtn = document.getElementById("edit-user-btn");
  const deleteUserBtn = document.getElementById("delete-user-btn");

  async function cargarUsuarios() {
    console.log("Ejecutando cargarUsuarios...");
    const userSelect = document.getElementById("user-select");
    if (!userSelect) {
      console.error("Elemento user-select no encontrado en el DOM.");
      return;
    }
    userSelect.innerHTML = `<option value="">-- Selecciona un usuario --</option>`;
    try {
      const snapshot = await db.collection("userRoles").get();
      if (snapshot.empty) {
        console.warn("No se encontraron usuarios en la colección userRoles.");
        const noUsersOption = document.createElement("option");
        noUsersOption.value = "";
        noUsersOption.textContent = "No hay usuarios registrados";
        userSelect.appendChild(noUsersOption);
        return;
      }
      console.log("Documentos recuperados:", snapshot.size);
      snapshot.forEach(doc => {
        const userData = doc.data();
        console.log("Documento obtenido:", doc.id, userData);
        if (userData.email && userData.rol) {
          const option = document.createElement("option");
          option.value = doc.id;
          option.textContent = `${userData.email} (${userData.rol})`;
          userSelect.appendChild(option);
        } else {
          console.warn(`El documento ${doc.id} no tiene los campos necesarios.`);
        }
      });
    } catch (error) {
      console.error("Error al cargar usuarios:", error);
      const errorOption = document.createElement("option");
      errorOption.value = "";
      errorOption.textContent = "Error al cargar usuarios";
      userSelect.appendChild(errorOption);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("add-user-btn").addEventListener("click", () => {
      const modal = document.getElementById("create-user-modal");
      if (modal) {
        modal.style.display = "flex";
        cargarUsuarios();
      }
    });
  });
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

  function resetFormUserManagement() {
    if (userEmailInput) userEmailInput.value = "";
    if (userPasswordInput) userPasswordInput.value = "";
    if (userRoleSelect) userRoleSelect.value = "user";
    if (userSelect) userSelect.value = "";
    if (editUserBtn) editUserBtn.disabled = true;
    if (deleteUserBtn) deleteUserBtn.disabled = true;
  }

  if (userSelect) {
    userSelect.addEventListener("change", () => {
      const selected = userSelect.value;
      editUserBtn.disabled = !selected;
      deleteUserBtn.disabled = !selected;
      if (selected) {
        const selectedData = userSelect.options[userSelect.selectedIndex].text;
        const [emailParte] = selectedData.split(" ");
        if (userEmailInput) userEmailInput.value = emailParte || "";
        if (userPasswordInput) userPasswordInput.value = "";
      } else {
        resetFormUserManagement();
      }
    });
  }

  if (editUserBtn) {
    editUserBtn.addEventListener("click", () => {
      const userId = userSelect.value;
      if (!userId) {
        Swal.fire("Atención", "Selecciona un usuario para editar.", "warning");
        return;
      }
      db.collection("userRoles").doc(userId).get()
        .then(doc => {
          if (doc.exists) {
            const userData = doc.data();
            console.log("✅ Datos obtenidos de Firestore:", userData);

            document.getElementById("new-user-email").value = userData.email || "";
            document.getElementById("new-user-password").value = "";
            document.getElementById("new-user-role").value = userData.rol || "user";

            const modalHeaderTitle = document.querySelector("#create-user-modal h3");
            if (modalHeaderTitle) {
              modalHeaderTitle.textContent = "Editar Usuario";
            }

            document.getElementById("create-user-modal").style.display = "flex";

            editingUserId = userId;
          } else {
            Swal.fire("Error", "El usuario no existe en la base de datos.", "error");
            console.warn("🚨 Documento no encontrado en Firestore.");
          }
        })
        .catch(error => {
          console.error("🚨 Error al obtener datos del usuario:", error);
          Swal.fire("Error", "Ocurrió un error al cargar los datos del usuario.", "error");
        });
    });
  }

  if (deleteUserBtn) {
    deleteUserBtn.addEventListener("click", async () => {
      const userId = userSelect.value;
      if (!userId) {
        Swal.fire("Atención", "Selecciona un usuario para eliminar.", "warning");
        return;
      }
      const result = await Swal.fire({
        title: "Confirmación",
        text: "¿Estás seguro de eliminar este usuario?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Sí, eliminar",
        cancelButtonText: "Cancelar"
      });

      if (!result.isConfirmed) return;
      try {
        await db.collection("userRoles").doc(userId).delete();
        Swal.fire("Éxito", "Usuario eliminado correctamente.", "success");
        resetFormUserManagement();
        cargarUsuarios();
      } catch (error) {
        console.error("Error al eliminar usuario:", error);
        Swal.fire("Error", "No se pudo eliminar el usuario.", "error");
      }
    });
  }

  if (editUserBtn) {
    editUserBtn.addEventListener("click", () => {
      const userId = userSelect.value;
      if (!userId) return;
      db.collection("userRoles")
        .doc(userId)
        .get()
        .then(doc => {
          if (doc.exists) {
            const userData = doc.data();
            document.getElementById("edit-user-name").value = userData.nombre || "";
            document.getElementById("edit-user-email").value = userData.email || "";
            document.getElementById("edit-user-role").value = userData.rol || "";
            document.getElementById("edit-user-modal").style.display = "flex";
          } else {
            Swal.fire("Error", "El usuario no existe.", "error");
          }
        })
        .catch(error => {
          console.error("Error al obtener datos del usuario:", error);
          Swal.fire("Error", "Ocurrió un error al cargar los datos del usuario.", "error");
        });
    });
  }

  const saveUserChanges = document.getElementById("save-user-changes");
  if (saveUserChanges) {
    saveUserChanges.addEventListener("click", () => {
      const userId = userSelect.value;
      const updatedName = document.getElementById("edit-user-name").value.trim();
      const updatedEmail = document.getElementById("edit-user-email").value.trim();
      const updatedRole = document.getElementById("edit-user-role").value;
      if (!updatedEmail || !updatedRole) {
        Swal.fire("Atención", "Por favor, completa todos los campos.", "warning");
        return;
      }
      db.collection("userRoles")
        .doc(userId)
        .update({ nombre: updatedName, email: updatedEmail, rol: updatedRole })
        .then(() => {
          Swal.fire("Éxito", "Usuario actualizado correctamente.", "success");
          cargarUsuarios();
          document.getElementById("edit-user-modal").style.display = "none";
        })
        .catch(error => {
          console.error("Error al actualizar usuario:", error);
          Swal.fire("Error", "Ocurrió un error al actualizar el usuario.", "error");
        });
    });
  }

  const closeEditUserModal = document.querySelector(".close-modal");
  const editUserModal = document.getElementById("edit-user-modal");
  if (closeEditUserModal && editUserModal) {
    closeEditUserModal.addEventListener("click", () => {
      editUserModal.style.display = "none";
    });
    window.addEventListener("click", event => {
      if (event.target === editUserModal) {
        editUserModal.style.display = "none";
      }
    });
  }

  // 15.2 EXTRA: RENDERIZAR CONTACTOS
  function renderizarContactosEnSelect() {
    const contactSelect = document.getElementById("contact-select");
    if (!contactSelect) return;
    contactSelect.innerHTML = `<option value="">-- Seleccione un contacto --</option>`;
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
    empleadosSelect.innerHTML = `<option value="">-- Seleccione un empleado --</option>`;
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
    if (liRegistros) {
      liRegistros.style.display = (role === "superadmin") ? "block" : "none";
    }

    // Mostrar elementos de admin (Gestionar Empleados)
    if (role === "admin" || role === "superadmin") {
      document.querySelectorAll(".admin-only").forEach(el => {
        el.style.display = "block"; // O "flex", según tu CSS. "block" es seguro para <li>
      });
    }

    // Redirección si no es admin y está en index.html
    if ((role !== "admin" && role !== "superadmin") && window.location.pathname.includes("index.html")) {
      const lastPage = localStorage.getItem("lastPage");
      window.location.href = lastPage || "user.html";
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
