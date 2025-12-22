//---------------------------------------------------------------
// senales.js
//---------------------------------------------------------------
const auth = window.auth;
const db = window.db;

import * as UI from './modules/senales-ui.js';
import { API_BASE_URL } from './modules/config.js';

// Optimistic Loading
document.addEventListener("DOMContentLoaded", () => {
  const cachedRole = localStorage.getItem("userRole");
  if (cachedRole === "superadmin") {
    const liRegistros = document.getElementById("li-registros");
    const liTurnos = document.getElementById("li-turnos");
    const liUsuarios = document.getElementById("li-usuarios");
    if (liRegistros) liRegistros.style.display = "block";
    if (liTurnos) liTurnos.style.display = "block";
    if (liUsuarios) liUsuarios.style.display = "block";
    document.body.classList.add("is-admin");
  } else if (cachedRole === "admin") {
    document.body.classList.add("is-admin");
  }
});

// Variable global para saber si el usuario es admin
let usuarioEsAdmin = false;

// Guardamos el nombre del nodo seleccionado (para usarlo en los títulos)
let currentNodoName = "";

/* =========================================
   Verificar rol de usuario y cargar nodos
   =========================================*/
function verificarRolUsuario() {
  auth.onAuthStateChanged((user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    db.collection("userRoles")
      .doc(user.uid)
      .get()
      .then((doc) => {
        if (doc.exists) {
          const userData = doc.data();
          const role = userData.rol;

          // Guardar en caché
          localStorage.setItem("userRole", role);

          usuarioEsAdmin = (role === "admin" || role === "superadmin");

          if (usuarioEsAdmin) {
            document.body.classList.add("is-admin");
          } else {
            document.body.classList.remove("is-admin");
          }

          const liRegistros = document.getElementById("li-registros");
          const liTurnos = document.getElementById("li-turnos");
          const liUsuarios = document.getElementById("li-usuarios");

          if (role === "superadmin") {
            if (liRegistros) liRegistros.style.display = "block";
            if (liTurnos) liTurnos.style.display = "block";
            if (liUsuarios) liUsuarios.style.display = "block";
            const liAnimaciones = document.getElementById("li-animaciones");
            if (liAnimaciones) liAnimaciones.style.display = "block";
            // Refrescar iconos después de mostrar elementos
            if (typeof refreshIcons === 'function') refreshIcons();
            else if (typeof lucide !== 'undefined') lucide.createIcons();
          }

        } else {
          usuarioEsAdmin = false;
          localStorage.removeItem("userRole");
          document.body.classList.remove("is-admin");
        }
        // Cargar la vista de nodos
        cargarNodos();
      })
      .catch((error) => {
        console.error("Error al obtener rol:", error);
        usuarioEsAdmin = false;
        cargarNodos();
      });
  });
}
window.verificarRolUsuario = verificarRolUsuario;

/* =========================================
   Configurar Sidebar
   =========================================*/
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

  // Render de íconos Lucide
  lucide.createIcons();
}
window.configurarSidebar = configurarSidebar;

/* =========================================
   Configurar Logout
   =========================================*/
function configurarLogout() {
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      auth.signOut()
        .then(() => {
          localStorage.removeItem('userRole'); // Limpiar caché de rol
          window.location.href = "login.html";
        })
        .catch((error) => {
          console.error("Error al cerrar sesión:", error);
        });
    });
  }
}
window.configurarLogout = configurarLogout;

/* =========================================
   1) Cargar Nodos (orden alfabético)
   =========================================*/
/* =========================================
   DIGITAL TWIN: Level 0 - SERVER ROOM (NODES)
   Replaces Card View with Rack Cabinets
   =========================================*/
function cargarNodos() {
  const fiberContainer = document.getElementById("fiber-structure");

  // Header with context
  // Header with context and actions
  UI.renderRoomHeader(fiberContainer, usuarioEsAdmin);

  // CLEANUP: Force remove old button if cached kml_service still injects it
  const oldBtn = document.getElementById('kml-import-btn');
  if (oldBtn) oldBtn.remove();

  db.collection("Nodos")
    .orderBy("name")
    .get()
    .then((querySnapshot) => {
      // Use the new aisle grid container
      const aisleGrid = document.createElement("div");
      aisleGrid.classList.add("rack-aisle-grid");

      // Process each node
      const nodePromises = [];
      querySnapshot.forEach((doc) => {
        const nodoData = doc.data();
        const nodoId = doc.id;
        const nodoName = nodoData.name;

        // Create promise to count PONs and Cajas for this node
        const nodePromise = contarDatosNodo(nodoId).then((stats) => {
          // Build Server Rack HTML
          const rack = UI.createRackElement(nodoId, nodoName, stats, usuarioEsAdmin);
          aisleGrid.appendChild(rack);
        });

        nodePromises.push(nodePromise);
      });

      // Wait for all node stats to be calculated
      Promise.all(nodePromises).then(() => {
        fiberContainer.appendChild(aisleGrid);
        lucide.createIcons();
      });
    })
    .catch((error) => {
      console.error("Error al cargar nodos:", error);
      fiberContainer.innerHTML += "<p>Error cargando la sala de servidores.</p>";
    });
}

/**
 * Cuenta PONs y Cajas totales para un nodo específico
 * @param {string} nodoId - ID del nodo
 * @returns {Promise<{totalPONs: number, totalCajas: number}>}
 */
async function contarDatosNodo(nodoId) {
  // 1. CACHE CHECK (5 Minutes)
  const CACHE_KEY = `node_stats_v2_${nodoId}`; // v2 to force invalidation of old cache if any
  const CACHE_DURATION = 5 * 60 * 1000;

  const cachedRaw = localStorage.getItem(CACHE_KEY);
  if (cachedRaw) {
    try {
      const { timestamp, data } = JSON.parse(cachedRaw);
      if (Date.now() - timestamp < CACHE_DURATION) {
        // Return cached data immediately
        return data;
      }
    } catch (e) {
      localStorage.removeItem(CACHE_KEY);
    }
  }

  let totalPONs = 0;
  let totalCajas = 0;

  try {
    // Obtener todas las PON Letters
    const lettersSnapshot = await db.collection("Nodos").doc(nodoId).collection("PONLetters").get();

    // PARALLEL PROCESSING: Process all letters simultaneously
    const letterPromises = lettersSnapshot.docs.map(async (letterDoc) => {
      const ponsRef = db.collection("Nodos").doc(nodoId).collection("PONLetters").doc(letterDoc.id).collection("PONs");
      const ponsSnapshot = await ponsRef.get();

      const localPonCount = ponsSnapshot.size;

      // Process all PONs simultaneously to count boxes
      const ponPromises = ponsSnapshot.docs.map(async (ponDoc) => {
        const cajasSnapshot = await ponsRef.doc(ponDoc.id).collection("Cajas").get();
        return cajasSnapshot.size;
      });

      const cajasCounts = await Promise.all(ponPromises);
      const localCajaCount = cajasCounts.reduce((a, b) => a + b, 0);

      return { p: localPonCount, c: localCajaCount };
    });

    const results = await Promise.all(letterPromises);

    // Aggregate results
    results.forEach(res => {
      totalPONs += res.p;
      totalCajas += res.c;
    });

    // 2. SAVE SUCCESS TO CACHE
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      data: { totalPONs, totalCajas }
    }));

  } catch (error) {
    console.error(`Error contando datos para nodo ${nodoId}:`, error);
  }

  return { totalPONs, totalCajas };
}
window.cargarNodos = cargarNodos;

// Helper `generarLucesRack` moved to senales-ui.js

function eliminarNodo(nodoId) {
  if (!usuarioEsAdmin) {
    Swal.fire("Acceso denegado", "No tienes permiso para eliminar nodos.", "error");
    return;
  }
  db.collection("Nodos")
    .doc(nodoId)
    .delete()
    .then(() => {
      Swal.fire("Éxito", "Nodo eliminado", "success");
      cargarNodos();
    })
    .catch((error) => {
      console.error("Error al eliminar nodo:", error);
    });
}

/* =========================================
   2) Vista intermedia: Lista/Crea Letra (PONLetters)
   =========================================*/
function mostrarVistaPonLetras(nodoId, nodoName) {
  currentNodoName = nodoName; // Guardamos nombre del nodo
  const fiberContainer = document.getElementById("fiber-structure");

  // New "Digital Twin" Professional Header
  UI.renderChassisView(fiberContainer, nodoName, usuarioEsAdmin, nodoId);

  cargarPonLetters(nodoId);
}
window.mostrarVistaPonLetras = mostrarVistaPonLetras;

function crearPonLetra(nodoId) {
  if (!usuarioEsAdmin) {
    Swal.fire("Acceso denegado", "No tienes permiso para crear PONs.", "error");
    return;
  }
  const letter = document.getElementById("pon-letra-dropdown").value;

  const lettersRef = db.collection("Nodos").doc(nodoId).collection("PONLetters");
  lettersRef
    .doc(letter) // Usamos la letra como ID del doc
    .get()
    .then((docSnap) => {
      if (docSnap.exists) {
        Swal.fire("Error", `La letra ${letter} ya existe en este nodo.`, "error");
        return;
      }
      // Si no existe, la creamos
      lettersRef
        .doc(letter)
        .set({ name: letter })
        .then(() => {
          Swal.fire("Éxito", `PON ${letter} creado correctamente`, "success");
          cargarPonLetters(nodoId);
        })
        .catch((err) => {
          console.error("Error al crear la letra:", err);
        });
    })
    .catch((err) => {
      console.error("Error al verificar la letra:", err);
    });
}
window.crearPonLetra = crearPonLetra;

/* =========================================
   DIGITAL TWIN: Level 1 - OLT CHASSIS VIEW
   Replaces old Rack/Card View
   =========================================*/
function cargarPonLetters(nodoId) {
  const container = document.getElementById("pon-letters-list");
  container.innerHTML = '<div class="spinner"></div>';

  db.collection("Nodos")
    .doc(nodoId)
    .collection("PONLetters")
    .orderBy("name")
    .get()
    .then((querySnapshot) => {
      const foundLetters = [];
      querySnapshot.forEach(doc => {
        foundLetters.push({ id: doc.id, ...doc.data() });
      });
      // Create Chassis
      const html = UI.renderChassisSlots(foundLetters, usuarioEsAdmin, nodoId);
      container.innerHTML = html;
    })
    .catch((error) => {
      console.error("Error al cargar OLT:", error);
      container.innerHTML = "<p>Error cargando visualización.</p>";
    });
}

function confirmarEliminarPonLetra(e, nodoId, letter) {
  e.stopPropagation();
  Swal.fire({
    title: "Desmontar Módulo",
    text: `¿Retirar la tarjeta PON ${letter} del rack?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    confirmButtonText: "Sí, retirar",
    cancelButtonText: "Cancelar"
  }).then((result) => {
    if (result.isConfirmed) {
      eliminarPonLetra(nodoId, letter);
    }
  });
}

function eliminarPonLetra(nodoId, letter) {
  if (!usuarioEsAdmin) {
    Swal.fire("Acceso denegado", "No tienes permiso para eliminar PONs.", "error");
    return;
  }
  db.collection("Nodos")
    .doc(nodoId)
    .collection("PONLetters")
    .doc(letter)
    .delete()
    .then(() => {
      Swal.fire("Éxito", `Letra ${letter} eliminada`, "success");
      cargarPonLetters(nodoId);
    })
    .catch((error) => {
      console.error("Error al eliminar la letra:", error);
    });
}

/* =========================================
   3) Vista detallada de TARJETA (PONs como puertos SFP)
   Replaces Card List with Line Card SFP Faceplate
   =========================================*/

function mostrarVistaPONPorLetra(nodoId, letter) {
  const fiberContainer = document.getElementById("fiber-structure");

  UI.renderFaceplateView(fiberContainer, nodoId, letter, currentNodoName, usuarioEsAdmin);

  cargarPONs(nodoId, letter);
}
window.mostrarVistaPONPorLetra = mostrarVistaPONPorLetra;

function crearPON(nodoId, letter) {
  if (!usuarioEsAdmin) {
    Swal.fire("Acceso denegado", "No tienes permiso para crear PONs.", "error");
    return;
  }
  // If letter not passed (legacy call), get from hidden input
  if (!letter) letter = document.getElementById("pon-letra").value;

  const numero = document.getElementById("pon-numero").value;
  const ponName = `PON ${letter}${numero}`;

  const ponRef = db
    .collection("Nodos")
    .doc(nodoId)
    .collection("PONLetters")
    .doc(letter)
    .collection("PONs");

  ponRef
    .where("name", "==", ponName)
    .get()
    .then((querySnapshot) => {
      if (!querySnapshot.empty) {
        // Custom realistic error
        Swal.fire({
          icon: 'error',
          title: 'Puerto Ocupado',
          text: `El puerto SFP ${numero} de la tarjeta ${letter} ya tiene un transceptor instalado.`,
          confirmButtonColor: '#333'
        });
        return;
      }
      ponRef
        .add({ name: ponName }) // We could store 'portIndex': numero to be safe
        .then(() => {
          const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000
          });
          Toast.fire({ icon: 'success', title: `SFP insertado en Puerto ${numero}` });
          cargarPONs(nodoId, letter);
        })
        .catch((error) => {
          console.error("Error al crear PON:", error);
        });
    });
}
window.crearPON = crearPON;

/**
 * Cargar PONs renderizandolos como un FACEPLATE de 16 Puertos
 */
function cargarPONs(nodoId, letter) {
  const container = document.getElementById("pon-list");
  container.innerHTML = '<div class="spinner"></div>';

  db.collection("Nodos")
    .doc(nodoId)
    .collection("PONLetters")
    .doc(letter)
    .collection("PONs")
    .get()
    .then((querySnapshot) => {
      const foundPons = {};
      querySnapshot.forEach((doc) => {
        const ponData = doc.data();
        // Extract number from name e.g. "PON A12" -> 12
        // We assume "PON <Letter><Number>" format.
        // Let's regex it to be safe.
        const match = ponData.name.match(/PON\s*[A-Z]+(\d+)/i);
        if (match) {
          const portNum = parseInt(match[1]);
          foundPons[portNum] = { id: doc.id, ...ponData };
        }
      });

      // Render Faceplate
      const html = UI.renderFaceplatePorts(foundPons, letter, nodoId, usuarioEsAdmin);
      container.innerHTML = html;
    })
    .catch((error) => {
      console.error("Error al cargar PONs:", error);
      container.innerHTML = "<p>Error cargando panel frontal.</p>";
    });
}
window.cargarPONs = cargarPONs;

function confirmarEliminarPON(e, nodoId, letter, ponId) {
  e.stopPropagation();
  Swal.fire({
    title: "Desconectar Fibra",
    text: "¿Retirar el módulo SFP y eliminar este PON?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    confirmButtonText: "Sí, desconectar",
    cancelButtonText: "Cancelar"
  }).then((result) => {
    if (result.isConfirmed) {
      eliminarPON(nodoId, letter, ponId);
    }
  });
}


function eliminarPON(nodoId, letter, ponId) {
  if (!usuarioEsAdmin) {
    Swal.fire("Acceso denegado", "No tienes permiso para eliminar PONs.", "error");
    return;
  }
  db.collection("Nodos")
    .doc(nodoId)
    .collection("PONLetters")
    .doc(letter)
    .collection("PONs")
    .doc(ponId)
    .delete()
    .then(() => {
      Swal.fire("Éxito", "PON eliminado", "success");
      cargarPONs(nodoId, letter);
    })
    .catch((error) => {
      console.error("Error al eliminar PON:", error);
    });
}

/* =========================================
   4) Vista de Cajas
   Nodos/<nodoId>/PONLetters/<letter>/PONs/<ponId>/Cajas
   =========================================*/
/* =========================================
   4) TOPOLOGY VIEW (PON) - Digital Twin Level 2
   Replaces old Grid View with Tree Topology
   =========================================*/

function mostrarVistaPON(nodoId, letter, ponId, ponName) {
  const fiberContainer = document.getElementById("fiber-structure");

  let html = `
    <div class="olt-management-panel">
        <div class="olt-header-left">
            <button class="olt-header-back-btn" onclick="mostrarVistaPONPorLetra('${nodoId}', '${letter}')">
                ← SFP FACEPLATE [BACK]
            </button>
            <div class="olt-info-group">
                <span class="olt-breadcrumb">NODE: ${currentNodoName || 'N/A'} > SLOT: ${letter} > PON: ${ponName}</span>
                <span class="olt-device-name">${ponName}</span>
            </div>
        </div>

        <div class="olt-lcd-display">
            <div class="olt-status-light"></div>
            <span>NETWORK STATUS: ACTIVE / LIVE</span>
        </div>
  `;

  // Form para crear caja
  if (usuarioEsAdmin) {
    html += `
        <div class="olt-admin-controls">
            <span class="olt-device-label" style="font-size:0.7rem;">SPLICE BOX MGMT</span>
            <select id="caja-numero" class="olt-select-dark">
               ${[...Array(51)].map((_, i) => `<option value="${i}">BOX ID ${i}</option>`).join("")}
            </select>
            <select id="caja-capacidad" class="olt-select-dark" style="margin-left:5px;">
              <option value="8">8 PORTS</option>
              <option value="12" selected>12 PORTS</option>
              <option value="16">16 PORTS</option>
              <option value="24">24 PORTS</option>
            </select>
            <button class="olt-btn-install" onclick="crearCaja('${nodoId}', '${letter}', '${ponId}')">
                DEPLOY SPLICE BOX
            </button>
        </div>
    `;
  } else {
    html += `<div></div>`;
  }

  html += `</div>`; // Close panel

  // Container renamed to topology-container
  html += `<div id="caja-list" class="topology-container"></div>`;
  fiberContainer.innerHTML = html;

  cargarCajas(nodoId, letter, ponId);
}
window.mostrarVistaPON = mostrarVistaPON;

function crearCaja(nodoId, letter, ponId) {
  if (!usuarioEsAdmin) {
    Swal.fire("Acceso denegado", "No tienes permiso para crear Cajas.", "error");
    return;
  }
  const numero = document.getElementById("caja-numero").value;
  const capacidad = parseInt(document.getElementById("caja-capacidad").value) || 12;
  const cajaName = `Caja ${numero}`;

  const cajasRef = db
    .collection("Nodos")
    .doc(nodoId)
    .collection("PONLetters")
    .doc(letter)
    .collection("PONs")
    .doc(ponId)
    .collection("Cajas");

  cajasRef
    .where("name", "==", cajaName)
    .get()
    .then((querySnapshot) => {
      if (!querySnapshot.empty) {
        Swal.fire("Error", `La ${cajaName} ya existe en este PON.`, "error");
        return;
      }
      cajasRef
        .add({ name: cajaName, capacity: capacidad })
        .then(() => {
          Swal.fire("Éxito", `Caja ${cajaName} creada correctamente`, "success");
          cargarCajas(nodoId, letter, ponId);
        })
        .catch((error) => {
          console.error("Error al crear Caja:", error);
        });
    });
}
window.crearCaja = crearCaja;

/**
 * Cargar las Cajas y ordenarlas localmente por el número que aparece al final del 'name'.
 */
/**
 * Renderiza la Topología de Árbol (Troncal + Cajas)
 */
function cargarCajas(nodoId, letter, ponId) {
  const container = document.getElementById("caja-list"); // It's .topology-container now
  container.innerHTML = '<div class="spinner"></div>';

  db.collection("Nodos")
    .doc(nodoId)
    .collection("PONLetters")
    .doc(letter)
    .collection("PONs")
    .doc(ponId)
    .collection("Cajas")
    .get()
    .then((querySnapshot) => {
      let cajasArray = [];
      querySnapshot.forEach((doc) => {
        const cajaData = doc.data();
        cajasArray.push({
          docId: doc.id,
          name: cajaData.name,
          capacity: cajaData.capacity || 12,
          numeric: extraerNumeroDeNombre(cajaData.name)
        });
      });

      cajasArray.sort((a, b) => {
        if (a.numeric !== b.numeric) return a.numeric - b.numeric;
        return a.name.localeCompare(b.name, undefined, { numeric: true });
      });

      // Render Topology Tree
      UI.renderTopologyTree(container, cajasArray, nodoId, letter, ponId, usuarioEsAdmin);
    })
    .catch((error) => {
      console.error("Error al cargar Topología:", error);
      container.innerHTML = "<p>Error cargando la red.</p>";
    });
}

function confirmarEliminarCaja(e, nodoId, letter, ponId, cajaId) {
  e.stopPropagation();
  Swal.fire({
    title: "Desinstalar Caja",
    text: "¿Cortar y retirar esta caja de empalme?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    confirmButtonText: "Sí, retirar",
    cancelButtonText: "Cancelar"
  }).then((result) => {
    if (result.isConfirmed) {
      eliminarCaja(nodoId, letter, ponId, cajaId);
    }
  });
}

function eliminarCaja(nodoId, letter, ponId, cajaId) {
  if (!usuarioEsAdmin) {
    Swal.fire("Acceso denegado", "No tienes permiso para eliminar Cajas.", "error");
    return;
  }
  db.collection("Nodos")
    .doc(nodoId)
    .collection("PONLetters")
    .doc(letter)
    .collection("PONs")
    .doc(ponId)
    .collection("Cajas")
    .doc(cajaId)
    .delete()
    .then(() => {
      Swal.fire("Éxito", "Caja eliminada", "success");
      cargarCajas(nodoId, letter, ponId);
    })
    .catch((error) => {
      console.error("Error al eliminar Caja:", error);
    });
}
window.confirmarEliminarCaja = confirmarEliminarCaja;
window.eliminarCaja = eliminarCaja;

/* =========================================
   5) Vista de Filamentos (sin cambios)
   Nodos/<nodoId>/PONLetters/<letter>/PONs/<ponId>/Cajas/<cajaId>/Filamentos
   =========================================*/
/* =========================================
   5) Vista de Filamentos (CAJA REAL / TRAY VIEW)
   Nodos/<nodoId>/PONLetters/<letter>/PONs/<ponId>/Cajas/<cajaId>/Filamentos
   =========================================*/

function mostrarVistaCaja(nodoId, letter, ponId, cajaId, cajaName, capacity = 12) {
  const fiberContainer = document.getElementById("fiber-structure");

  // New "Digital Twin" Professional Header for Splice Tray
  let html = `
    <div class="olt-management-panel">
        <div class="olt-header-left">
            <button class="olt-header-back-btn" onclick="mostrarVistaPON('${nodoId}', '${letter}', '${ponId}', '')">
                ← NETWORK [BACK]
            </button>
            <div class="olt-info-group">
                <span class="olt-breadcrumb">NODE: ${currentNodoName || 'N/A'} > ... > PON: ${ponId} > BOX: ${cajaName}</span>
                <span class="olt-device-name">${cajaName}</span>
            </div>
        </div>

        <div class="olt-lcd-display">
            <div class="olt-status-light"></div>
            <span>TRAY STATUS: ${capacity} PORTS AVAIL</span>
        </div>
        
        <div class="olt-admin-controls">
             <span class="olt-device-label" style="font-size:0.7rem;">ACTION</span>
             <button id="btn-u2000-sim" class="olt-btn-install" style="background:#444; border-color:#666;" onclick="toggleU2000Simulation()">
                ⏱️ LIVE MONITOR (SIM)
             </button>
        </div>
    </div>

    <!-- TRAY CONTAINER -->
    <div class="fiber-tray-container" style="border-top:none; margin-top:0;">
      <!-- GRID DE PUERTOS (Dinámico) -->
      <div id="fiber-grid" class="fiber-grid"></div>
    </div>
  `;

  fiberContainer.innerHTML = html;

  cargarFilamentosGrid(nodoId, letter, ponId, cajaId, capacity);
}
window.mostrarVistaCaja = mostrarVistaCaja;

/* 
 * Renderiza la grilla de filamentos (1 al N o dinámico)
 * Cada puerto usa el código de colores TIA-598C
 */
function cargarFilamentosGrid(nodoId, letter, ponId, cajaId, capacity) {
  const gridContainer = document.getElementById("fiber-grid");
  gridContainer.innerHTML = '<div class="spinner"></div>';

  const filamentosRef = db
    .collection("Nodos")
    .doc(nodoId)
    .collection("PONLetters")
    .doc(letter)
    .collection("PONs")
    .doc(ponId)
    .collection("Cajas")
    .doc(cajaId)
    .collection("Filamentos");

  filamentosRef.get().then((querySnapshot) => {
    gridContainer.innerHTML = "";

    // 1. Mapear filamentos existentes por número (ej: "Filamento 1" -> 1)
    const ocupados = {};
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const num = extraerNumeroDeNombre(data.name); // Función auxiliar existente
      if (num) {
        ocupados[num] = {
          id: doc.id,
          name: data.name,
          signal: data.signal
        };
      }
    });

    // 2. Generar Puertos según capacidad (default 12)
    const totalPuertos = parseInt(capacity) || 12;

    // Apply specific layout class for 16 ports (8x2 grid)
    if (totalPuertos === 16) {
      gridContainer.classList.add('layout-16');
    } else {
      gridContainer.classList.remove('layout-16');
    }

    for (let i = 1; i <= totalPuertos; i++) {
      const portDiv = document.createElement("div");
      const filamento = ocupados[i];

      // Clases base
      let classes = "fiber-port";
      let contenido = `<span class="port-number">${i}</span>`;

      // Determinar Color TIA-598C
      const colorClass = getTiaColorClass(i);

      if (filamento) {
        // PUERTO OCUPADO
        classes += ` occupied ${colorClass}`;
        contenido += `<span class="port-signal" id="sig-${filamento.id}">${filamento.signal || "N/A"}</span>`;
        // Save base signal for simulation
        portDiv.dataset.signalBase = filamento.signal || "-14.00"; // Default fallback
        portDiv.dataset.id = filamento.id;

        portDiv.onclick = () => {
          // Editar/Borrar
          editarFilamento(nodoId, letter, ponId, cajaId, filamento.id, filamento.name, filamento.signal, totalPuertos);
        };
      } else {
        // PUERTO VACÍO
        contenido += `<span style="font-size:0.7em; opacity:0.5;">Vacío</span>`;

        portDiv.onclick = () => {
          // Crear (Splice)
          crearFilamentoModal(nodoId, letter, ponId, cajaId, i);
        };
      }

      portDiv.className = classes;
      portDiv.innerHTML = contenido;
      gridContainer.appendChild(portDiv);
    }
  }).catch(err => {
    console.error("Error cargando grid:", err);
    gridContainer.innerHTML = "<p>Error cargando datos.</p>";
  });
}

// Helper: Retorna la clase CSS según TIA-598C Standard
function getTiaColorClass(num) {
  // TIA-598C repite colores cada 12 fibras 
  // (1-12, luego 13-24 repiten colores con marca, aquí simplificamos repetición)
  const n = (num - 1) % 12 + 1;

  switch (n) {
    case 1: return "tia-blue";
    case 2: return "tia-orange";
    case 3: return "tia-green";
    case 4: return "tia-brown";
    case 5: return "tia-slate";
    case 6: return "tia-white";
    case 7: return "tia-red";
    case 8: return "tia-black";
    case 9: return "tia-yellow";
    case 10: return "tia-violet";
    case 11: return "tia-rose";
    case 12: return "tia-aqua";
    default: return "";
  }
}

// Crear Filamento (Modal SweetAlert simplificado)
async function crearFilamentoModal(nodoId, letter, ponId, cajaId, numero) {
  if (!usuarioEsAdmin) return Swal.fire("Error", "No tienes permisos", "error");

  const { value: signal } = await Swal.fire({
    title: `Conectar Filamento ${numero}`,
    input: 'text',
    inputLabel: 'Señal Estimada (dBm)',
    inputValue: '-14dBm',
    showCancelButton: true,
    confirmButtonText: 'Empalmar',
    inputValidator: (value) => {
      if (!value) return 'Debes escribir la señal!';
    }
  });

  if (signal) {
    crearFilamentoDirecto(nodoId, letter, ponId, cajaId, numero, signal);
  }
}

function crearFilamentoDirecto(nodoId, letter, ponId, cajaId, numero, signal) {
  const name = `Filamento ${numero}`;
  db.collection("Nodos").doc(nodoId).collection("PONLetters").doc(letter)
    .collection("PONs").doc(ponId).collection("Cajas").doc(cajaId).collection("Filamentos")
    .add({ name, signal })
    .then(() => {
      Swal.fire({
        icon: 'success',
        title: 'Empalme Exitoso',
        text: `Filamento ${numero} color ${getNombreColor((numero - 1) % 12 + 1)} conectado.`,
        timer: 1500,
        showConfirmButton: false
      });
      cargarFilamentosGrid(nodoId, letter, ponId, cajaId);
    });
}

// Editar/Borrar Filamento
// Editar/Borrar Filamento
async function editarFilamento(nodoId, letter, ponId, cajaId, fId, fName, fSignal, capacity) {
  if (!usuarioEsAdmin) return;

  const result = await Swal.fire({
    title: fName,
    text: `Señal actual: ${fSignal || 'Sin señal'}`,
    showDenyButton: true,
    showCancelButton: true,
    confirmButtonText: 'Actualizar Señal',
    denyButtonText: 'Desconectar (Borrar)',
    confirmButtonColor: '#3085d6',
    denyButtonColor: '#d33'
  });

  if (result.isConfirmed) {
    // Update Signal logic
    const { value: newSignal } = await Swal.fire({
      input: 'text',
      inputLabel: 'Nueva Señal',
      inputValue: fSignal || ''
    });

    if (newSignal !== undefined && newSignal !== null) { // Allow empty string if user wants to clear it, though usually we want a value
      db.collection("Nodos").doc(nodoId).collection("PONLetters").doc(letter)
        .collection("PONs").doc(ponId).collection("Cajas").doc(cajaId).collection("Filamentos").doc(fId)
        .update({ signal: newSignal })
        .then(() => {
          Swal.fire("Actualizado", "Potencia actualizada correctamente", "success");
          cargarFilamentosGrid(nodoId, letter, ponId, cajaId, capacity);
        })
        .catch(error => {
          console.error("Error actualizando señal:", error);
          Swal.fire("Error", "No se pudo actualizar la señal.", "error");
        });
    }
  } else if (result.isDenied) {
    db.collection("Nodos").doc(nodoId).collection("PONLetters").doc(letter)
      .collection("PONs").doc(ponId).collection("Cajas").doc(cajaId).collection("Filamentos").doc(fId)
      .delete()
      .then(() => {
        Swal.fire("Desconectado", "Filamento eliminado.", "success");
        cargarFilamentosGrid(nodoId, letter, ponId, cajaId, capacity);
      })
      .catch(error => {
        console.error("Error eliminando filamento:", error);
        Swal.fire("Error", "No se pudo eliminar el filamento.", "error");
      });
  }
}

function getNombreColor(n) {
  const colores = ["Azul", "Naranja", "Verde", "Marrón", "Gris", "Blanco", "Rojo", "Negro", "Amarillo", "Violeta", "Rosa", "Aqua"];
  return colores[n - 1] || "Desconocido";
}

// Mantener compatibilidad con funciones viejas si se llaman desde otro lado, 
// o dejar vacías para evitar errores de referencia.
window.crearFilamento = null;
window.cargarFilamentos = null;

// =========================================
// U2000 SIMULATION LOGIC
// =========================================
let u2000Interval = null;

function toggleU2000Simulation() {
  const btn = document.getElementById('btn-u2000-sim');
  if (!btn) return;

  if (u2000Interval) {
    // STOP
    clearInterval(u2000Interval);
    u2000Interval = null;
    btn.style.background = '#444';
    btn.style.borderColor = '#666';
    btn.innerHTML = '⏱️ LIVE MONITOR (SIM)';

    // Restore base values
    const ports = document.querySelectorAll('.fiber-port.occupied');
    ports.forEach(port => {
      const base = port.dataset.signalBase;
      const span = port.querySelector('.port-signal');
      if (span && base) span.innerText = base;
    });

  } else {
    // START
    btn.style.background = '#10b981'; // Green
    btn.style.borderColor = '#059669';
    btn.innerHTML = '⚡ MONITORING...';

    u2000Interval = setInterval(() => {
      const ports = document.querySelectorAll('.fiber-port.occupied');

      ports.forEach(port => {
        const baseStr = port.dataset.signalBase;
        if (!baseStr) return;

        // Parse base (e.g. "-14.50dBm" or "-14.50")
        let baseVal = parseFloat(baseStr.replace(/[^\d.-]/g, ''));
        if (isNaN(baseVal)) baseVal = -14.5; // Fallback

        // Jitter: +/- 0.05 to 0.3 dB
        const jitter = (Math.random() - 0.5) * 0.4;
        const currentVal = (baseVal + jitter).toFixed(2);

        // Update Text
        const span = port.querySelector('.port-signal');
        if (span) span.innerText = `${currentVal} dBm`;

        // Visual Feedback (Red/Warning if dropping too low, though simulation keeps it close to base)
        if (currentVal < -25) port.style.borderColor = 'red';
        else if (currentVal < -20) port.style.borderColor = 'orange';
        else port.style.borderColor = 'rgba(255,255,255,0.1)';

      });
    }, 1500); // Update every 1.5s
  }
}
window.toggleU2000Simulation = toggleU2000Simulation;




// =========================================
//    Funciones CRUD de Nodos
// =========================================
async function crearNodo() {
  const { value: name } = await Swal.fire({
    title: 'Nuevo Gabinete (Seguro)',
    input: 'text',
    inputLabel: 'Nombre del Nodo / Ubicación',
    inputPlaceholder: 'Ej: Sala Servidores Piso 1',
    showCancelButton: true,
    confirmButtonText: 'Crear',
    confirmButtonColor: '#10b981',
    background: '#1f2937',
    color: '#fff',
    customClass: { input: 'swal-input-dark' }
  });

  if (!name) return;

  try {
    const user = auth.currentUser;
    const token = await user.getIdToken();

    const response = await fetch(`${API_BASE_URL}/uptime/nodes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Error creando nodo');
    }

    Swal.fire({
      title: 'Creado',
      text: 'Gabinete registrado correctamente (Backend)',
      icon: 'success',
      timer: 1500,
      showConfirmButton: false,
      background: '#1f2937',
      color: '#fff'
    });

    cargarNodos();

  } catch (err) {
    console.error(err);
    Swal.fire({
      title: 'Error',
      text: err.message,
      icon: 'error',
      background: '#1f2937',
      color: '#fff'
    });
  }
}
window.crearNodo = crearNodo;

async function editarNodo(nodoId, currentName) {
  const { value: newName } = await Swal.fire({
    title: 'Editar Nombre (Seguro)',
    input: 'text',
    inputValue: currentName,
    showCancelButton: true,
    confirmButtonText: 'Guardar',
    confirmButtonColor: '#fbbf24',
    background: '#1f2937',
    color: '#fff'
  });

  if (!newName || newName === currentName) return;

  try {
    const user = auth.currentUser;
    const token = await user.getIdToken();

    const response = await fetch(`${API_BASE_URL}/uptime/nodes/${nodoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name: newName })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Error actualizando nodo');
    }

    Swal.fire({
      title: 'Actualizado',
      icon: 'success',
      timer: 1000,
      showConfirmButton: false,
      background: '#1f2937',
      color: '#fff'
    });
    cargarNodos();

  } catch (err) {
    console.error(err);
    Swal.fire({
      title: 'Error',
      text: err.message,
      icon: 'error',
      background: '#1f2937',
      color: '#fff'
    });
  }
}
window.editarNodo = editarNodo;

function confirmarEliminarNodo(nodoId, nodoName) {
  Swal.fire({
    title: "Desmantelar Gabinete",
    text: `¿Estás seguro de eliminar el nodo ${nodoName}? Esta acción es irreversible.`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#374151",
    confirmButtonText: "Sí, desmantelar",
    background: '#1f2937',
    color: '#fff'
  }).then((result) => {
    if (result.isConfirmed) {
      eliminarNodo(nodoId);
    }
  });
}
window.confirmarEliminarNodo = confirmarEliminarNodo;


/* =========================================
   Función extra: extraer número de nombre
   =========================================*/
/**
 * Dado un string como "PON A10", "Caja 1", "PON B2", etc.
 * Retorna el número que aparece al final del texto.
 * Si no encuentra, retorna 0.
 */
function extraerNumeroDeNombre(str) {
  const regex = /(\d+)/; // Captura el primer bloque de digitos (mejor para "Caja 2 EXT")
  const match = str.match(regex);
  if (match) {
    return parseInt(match[1], 10);
  } else {
    return 0;
  }
}

document.addEventListener("DOMContentLoaded", function () {
  configurarSidebar();

  // KML Service Injection
  if (window.KMLService) {
    console.log("Injecting KML Button...");
    window.KMLService.injectButton();
  }

  // Optimización: Carga optimista desde caché
  const cachedRole = localStorage.getItem("userRole");
  if (cachedRole) {
    console.log("Aplicando rol desde caché (Señales):", cachedRole);
    if (cachedRole === "admin" || cachedRole === "superadmin") {
      usuarioEsAdmin = true;
      document.body.classList.add("is-admin");
      if (cachedRole === "superadmin") {
        const liRegistros = document.getElementById("li-registros");
        const liTurnos = document.getElementById("li-turnos");
        if (liRegistros) liRegistros.style.display = "block";
        if (liTurnos) liTurnos.style.display = "block";
      }
    }
  }

  verificarRolUsuario();
  configurarLogout();
});
