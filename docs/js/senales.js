//---------------------------------------------------------------
// senales.js
//---------------------------------------------------------------
const auth = window.auth;
const db = window.db;

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
          if (role === "superadmin" && liRegistros) {
            liRegistros.style.display = "block";
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
function cargarNodos() {
  const fiberContainer = document.getElementById("fiber-structure");
  fiberContainer.innerHTML = "<h2>Nodos</h2>";

  db.collection("Nodos")
    .orderBy("name") // Ordena alfabéticamente los nodos por nombre
    .get()
    .then((querySnapshot) => {
      const cardContainer = document.createElement("div");
      cardContainer.classList.add("card-container");

      querySnapshot.forEach((doc) => {
        const nodoData = doc.data();
        const nodoId = doc.id;
        const nodoName = nodoData.name;

        const card = document.createElement("div");
        card.classList.add("card");

        // Al hacer clic en el Nodo, abrimos la vista intermedia de letras
        card.onclick = function () {
          mostrarVistaPonLetras(nodoId, nodoName);
        };

        // Ícono de eliminar (solo admin)
        if (usuarioEsAdmin) {
          const deleteIcon = document.createElement("span");
          deleteIcon.classList.add("delete-icon");
          deleteIcon.innerHTML = "🗑";
          deleteIcon.onclick = async function (e) {
            e.stopPropagation();
            const result = await Swal.fire({
              title: "Confirmación",
              text: "¿Seguro que deseas eliminar este nodo?",
              icon: "warning",
              showCancelButton: true,
              confirmButtonColor: "#d33",
              cancelButtonColor: "#3085d6",
              confirmButtonText: "Sí, eliminar",
              cancelButtonText: "Cancelar"
            });

            if (result.isConfirmed) {
              eliminarNodo(nodoId);
            }
          };
          card.appendChild(deleteIcon);
        }

        // Título del card
        const header = document.createElement("div");
        header.classList.add("card-header");
        header.textContent = nodoName;
        card.appendChild(header);

        cardContainer.appendChild(card);
      });

      fiberContainer.appendChild(cardContainer);
    })
    .catch((error) => {
      console.error("Error al cargar nodos:", error);
    });
}
window.cargarNodos = cargarNodos;

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

  let html = `
    <button class="btn-back" onclick="cargarNodos()">← Volver</button>
    <h2>${nodoName} - Seleccionar Letra</h2>
  `;

  // Si es Admin, mostramos formulario para crear "PON con esa letra"
  if (usuarioEsAdmin) {
    html += `
      <div class="card">
        <div class="card-body">
          <div class="form-group">
            <label for="pon-letra-dropdown">Selecciona la letra:</label>
            <select id="pon-letra-dropdown">
              ${[...Array(26)].map((_, i) => {
      const letter = String.fromCharCode(65 + i);
      return `<option value="${letter}">${letter}</option>`;
    }).join("")}
            </select>
          </div>
          <button class="btn" onclick="crearPonLetra('${nodoId}')">Crear PON</button>
        </div>
      </div>
    `;
  }

  // Contenedor para listar las letras creadas
  html += `<div id="pon-letters-list" class="card-container"></div>`;
  fiberContainer.innerHTML = html;

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

function cargarPonLetters(nodoId) {
  const ponLettersList = document.getElementById("pon-letters-list");
  ponLettersList.innerHTML = "";

  db.collection("Nodos")
    .doc(nodoId)
    .collection("PONLetters")
    .orderBy("name") // Orden alfabético de la letra
    .get()
    .then((querySnapshot) => {
      querySnapshot.forEach((doc) => {
        const letterData = doc.data();
        const letter = letterData.name;

        // Creamos un card para la letra
        const card = document.createElement("div");
        card.classList.add("card");
        card.onclick = function () {
          mostrarVistaPONPorLetra(nodoId, letter);
        };

        // Eliminar letra (solo admin)
        if (usuarioEsAdmin) {
          const deleteIcon = document.createElement("span");
          deleteIcon.classList.add("delete-icon");
          deleteIcon.innerHTML = "🗑";
          deleteIcon.onclick = async function (e) {
            e.stopPropagation();
            const result = await Swal.fire({
              title: "Confirmación",
              text: `¿Eliminar la letra ${letter}?`,
              icon: "warning",
              showCancelButton: true,
              confirmButtonColor: "#d33",
              cancelButtonColor: "#3085d6",
              confirmButtonText: "Sí, eliminar",
              cancelButtonText: "Cancelar"
            });

            if (result.isConfirmed) {
              eliminarPonLetra(nodoId, letter);
            }
          };
          card.appendChild(deleteIcon);
        }

        const header = document.createElement("div");
        header.classList.add("card-header");
        header.textContent = `PON ${letter}`;
        card.appendChild(header);

        ponLettersList.appendChild(card);
      });
    })
    .catch((error) => {
      console.error("Error al cargar las letras:", error);
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
   3) Vista para mostrar/crear PONs filtrados,
   anidados en PONLetters/<letter>/PONs
   =========================================*/
function mostrarVistaPONPorLetra(nodoId, letter) {
  const fiberContainer = document.getElementById("fiber-structure");

  let html = `
    <button class="btn-back" onclick="mostrarVistaPonLetras('${nodoId}', '${currentNodoName}')">← Volver</button>
    <h2>PONs con letra ${letter}</h2>
  `;

  // Formulario para crear PON (A0, A1, etc.)
  if (usuarioEsAdmin) {
    html += `
      <div class="card">
        <div class="card-body">
          <div class="form-group">
            <label>Letra del PON:</label>
            <span>${letter}</span>
            <input type="hidden" id="pon-letra" value="${letter}" />
          </div>
          <div class="form-group">
            <label for="pon-numero">Número del PON:</label>
            <select id="pon-numero">
              ${[...Array(51)].map((_, i) => `<option value="${i}">${i}</option>`).join("")}
            </select>
          </div>
          <button class="btn" onclick="crearPON('${nodoId}')">Crear PON</button>
        </div>
      </div>
    `;
  }

  // Contenedor para la lista de PONs
  html += `<div id="pon-list" class="card-container"></div>`;
  fiberContainer.innerHTML = html;

  cargarPONs(nodoId, letter);
}
window.mostrarVistaPONPorLetra = mostrarVistaPONPorLetra;

/** 
 * Creamos un PON, p.ej. "PON A0"
 */
function crearPON(nodoId) {
  if (!usuarioEsAdmin) {
    Swal.fire("Acceso denegado", "No tienes permiso para crear PONs.", "error");
    return;
  }
  const letra = document.getElementById("pon-letra").value;
  const numero = document.getElementById("pon-numero").value;
  const ponName = `PON ${letra}${numero}`;

  const ponRef = db
    .collection("Nodos")
    .doc(nodoId)
    .collection("PONLetters")
    .doc(letra)
    .collection("PONs");

  ponRef
    .where("name", "==", ponName)
    .get()
    .then((querySnapshot) => {
      if (!querySnapshot.empty) {
        Swal.fire("Error", `El PON ${ponName} ya existe en esta letra.`, "error");
        return;
      }
      ponRef
        .add({ name: ponName })
        .then(() => {
          Swal.fire("Éxito", `PON ${ponName} creado correctamente`, "success");
          cargarPONs(nodoId, letra);
        })
        .catch((error) => {
          console.error("Error al crear PON:", error);
        });
    });
}
window.crearPON = crearPON;

/**
 * Cargar PONs (ahora los ordenamos localmente por el número 
 * que aparece en su name, ignorando letras).
 */
function cargarPONs(nodoId, letter) {
  const ponList = document.getElementById("pon-list");
  ponList.innerHTML = "";

  const ponRef = db
    .collection("Nodos")
    .doc(nodoId)
    .collection("PONLetters")
    .doc(letter)
    .collection("PONs");

  ponRef.get()
    .then((querySnapshot) => {
      // 1) Guardar en array y extraer número de "PON A0", "PON A10", etc.
      let ponArray = [];
      querySnapshot.forEach((doc) => {
        const ponData = doc.data();
        const ponId = doc.id;
        const ponName = ponData.name;  // ej: "PON A2", "PON A10"

        const numericValue = extraerNumeroDeNombre(ponName);

        ponArray.push({
          docId: ponId,
          name: ponName,
          numeric: numericValue
        });
      });

      // 2) Ordenar localmente por 'numeric' asc
      ponArray.sort((a, b) => a.numeric - b.numeric);

      // 3) Renderizar
      ponArray.forEach((item) => {
        const card = document.createElement("div");
        card.classList.add("card");
        card.onclick = function () {
          mostrarVistaPON(nodoId, letter, item.docId, item.name);
        };

        // Eliminar PON (solo admin)
        if (usuarioEsAdmin) {
          const deleteIcon = document.createElement("span");
          deleteIcon.classList.add("delete-icon");
          deleteIcon.innerHTML = "🗑";
          deleteIcon.onclick = async function (e) {
            e.stopPropagation();
            const result = await Swal.fire({
              title: "Confirmación",
              text: `¿Eliminar el ${item.name}?`,
              icon: "warning",
              showCancelButton: true,
              confirmButtonColor: "#d33",
              cancelButtonColor: "#3085d6",
              confirmButtonText: "Sí, eliminar",
              cancelButtonText: "Cancelar"
            });

            if (result.isConfirmed) {
              eliminarPON(nodoId, letter, item.docId);
            }
          };
          card.appendChild(deleteIcon);
        }

        const header = document.createElement("div");
        header.classList.add("card-header");
        header.textContent = item.name;
        card.appendChild(header);

        ponList.appendChild(card);
      });
    })
    .catch((error) => {
      console.error("Error al cargar PONs:", error);
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
function mostrarVistaPON(nodoId, letter, ponId, ponName) {
  const fiberContainer = document.getElementById("fiber-structure");

  let html = `
    <button class="btn-back" onclick="mostrarVistaPONPorLetra('${nodoId}', '${letter}')">
      ← Volver
    </button>
    <h2>${ponName} - Cajas</h2>
  `;

  // Form para crear caja
  if (usuarioEsAdmin) {
    html += `
      <div class="card">
        <div class="card-body">
          <div class="form-group">
            <label for="caja-numero">Número de la Caja:</label>
            <select id="caja-numero">
              ${[...Array(51)].map((_, i) => `<option value="${i}">${i}</option>`).join("")}
            </select>
          </div>
          <button class="btn" onclick="crearCaja('${nodoId}', '${letter}', '${ponId}')">Crear Caja</button>
        </div>
      </div>
    `;
  }

  html += `<div id="caja-list" class="card-container"></div>`;
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
        .add({ name: cajaName })
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
function cargarCajas(nodoId, letter, ponId) {
  const cajaList = document.getElementById("caja-list");
  cajaList.innerHTML = "";

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
        const cajaId = doc.id;
        const cajaName = cajaData.name; // Ej. "Caja 1", "Caja 10"

        const numericValue = extraerNumeroDeNombre(cajaName);

        cajasArray.push({
          docId: cajaId,
          name: cajaName,
          numeric: numericValue
        });
      });

      // Ordenar localmente
      cajasArray.sort((a, b) => a.numeric - b.numeric);

      // Renderizar
      cajasArray.forEach((item) => {
        const card = document.createElement("div");
        card.classList.add("card");
        card.onclick = function () {
          mostrarVistaCaja(nodoId, letter, ponId, item.docId, item.name);
        };

        if (usuarioEsAdmin) {
          const deleteIcon = document.createElement("span");
          deleteIcon.classList.add("delete-icon");
          deleteIcon.innerHTML = "🗑";
          deleteIcon.onclick = async function (e) {
            e.stopPropagation();
            const result = await Swal.fire({
              title: "Confirmación",
              text: "¿Seguro que deseas eliminar esta caja?",
              icon: "warning",
              showCancelButton: true,
              confirmButtonColor: "#d33",
              cancelButtonColor: "#3085d6",
              confirmButtonText: "Sí, eliminar",
              cancelButtonText: "Cancelar"
            });

            if (result.isConfirmed) {
              eliminarCaja(nodoId, letter, ponId, item.docId);
            }
          };
          card.appendChild(deleteIcon);
        }

        const header = document.createElement("div");
        header.classList.add("card-header");
        header.textContent = item.name;
        card.appendChild(header);

        cajaList.appendChild(card);
      });
    })
    .catch((error) => {
      console.error("Error al cargar Cajas:", error);
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

/* =========================================
   5) Vista de Filamentos (sin cambios)
   Nodos/<nodoId>/PONLetters/<letter>/PONs/<ponId>/Cajas/<cajaId>/Filamentos
   =========================================*/
function mostrarVistaCaja(nodoId, letter, ponId, cajaId, cajaName) {
  const fiberContainer = document.getElementById("fiber-structure");

  let html = `
    <button class="btn-back" onclick="mostrarVistaPON('${nodoId}', '${letter}', '${ponId}', '')">
      ← Volver
    </button>
    <h2>${cajaName} - Filamentos</h2>
  `;

  // Form para crear Filamento
  if (usuarioEsAdmin) {
    html += `
      <div class="card">
        <div class="card-body">
          <div class="form-group">
            <label for="filamento-numero">Número del Filamento:</label>
            <select id="filamento-numero">
              ${[...Array(50)].map((_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label for="filamento-senal">Señal (dBm):</label>
            <input type="text" id="filamento-senal" placeholder="-14dBm" />
          </div>
          <button class="btn" onclick="crearFilamento('${nodoId}', '${letter}', '${ponId}', '${cajaId}')">
            Agregar Filamento
          </button>
        </div>
      </div>
    `;
  }

  html += `<ul id="filamento-list" class="list-container"></ul>`;
  fiberContainer.innerHTML = html;

  cargarFilamentos(nodoId, letter, ponId, cajaId);
}
window.mostrarVistaCaja = mostrarVistaCaja;

function crearFilamento(nodoId, letter, ponId, cajaId) {
  if (!usuarioEsAdmin) {
    Swal.fire("Acceso denegado", "No tienes permiso para crear Filamentos.", "error");
    return;
  }
  const numero = document.getElementById("filamento-numero").value;
  const senal = document.getElementById("filamento-senal").value.trim();

  if (!senal.match(/^-?\d+dBm$/)) {
    Swal.fire("Error", "Formato de señal incorrecto. Ejemplo válido: -14dBm", "error");
    return;
  }

  const filamentoName = `Filamento ${numero}`;
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

  filamentosRef
    .where("name", "==", filamentoName)
    .get()
    .then((querySnapshot) => {
      if (!querySnapshot.empty) {
        Swal.fire("Error", `El ${filamentoName} ya existe en esta caja.`, "error");
        return;
      }
      filamentosRef
        .add({ name: filamentoName, signal: senal })
        .then(() => {
          Swal.fire("Éxito", `Filamento ${filamentoName} creado correctamente con señal ${senal}`, "success");
          cargarFilamentos(nodoId, letter, ponId, cajaId);
        })
        .catch((error) => {
          console.error("Error al crear Filamento:", error);
        });
    });
}
window.crearFilamento = crearFilamento;

function cargarFilamentos(nodoId, letter, ponId, cajaId) {
  const filamentoList = document.getElementById("filamento-list");
  filamentoList.innerHTML = "";

  db.collection("Nodos")
    .doc(nodoId)
    .collection("PONLetters")
    .doc(letter)
    .collection("PONs")
    .doc(ponId)
    .collection("Cajas")
    .doc(cajaId)
    .collection("Filamentos")
    .orderBy("name")
    .get()
    .then((querySnapshot) => {
      querySnapshot.forEach((doc) => {
        const filamentoData = doc.data();
        const filamentoId = doc.id;

        const listItem = document.createElement("li");
        listItem.classList.add("list-item");
        listItem.innerHTML = `
          ${filamentoData.name} - <strong>${filamentoData.signal}</strong>
        `;

        if (usuarioEsAdmin) {
          const deleteIcon = document.createElement("span");
          deleteIcon.classList.add("delete-icon");
          deleteIcon.innerHTML = "🗑";
          deleteIcon.onclick = async function (e) {
            e.stopPropagation();
            const result = await Swal.fire({
              title: "Confirmación",
              text: "¿Seguro que deseas eliminar este Filamento?",
              icon: "warning",
              showCancelButton: true,
              confirmButtonColor: "#d33",
              cancelButtonColor: "#3085d6",
              confirmButtonText: "Sí, eliminar",
              cancelButtonText: "Cancelar"
            });

            if (result.isConfirmed) {
              eliminarFilamento(nodoId, letter, ponId, cajaId, filamentoId);
            }
          };
          listItem.appendChild(deleteIcon);
        }

        filamentoList.appendChild(listItem);
      });
    })
    .catch((error) => {
      console.error("Error al cargar Filamentos:", error);
    });
}

function eliminarFilamento(nodoId, letter, ponId, cajaId, filamentoId) {
  if (!usuarioEsAdmin) {
    Swal.fire("Acceso denegado", "No tienes permiso para eliminar Filamentos.", "error");
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
    .collection("Filamentos")
    .doc(filamentoId)
    .delete()
    .then(() => {
      Swal.fire("Éxito", "Filamento eliminado", "success");
      cargarFilamentos(nodoId, letter, ponId, cajaId);
    })
    .catch((error) => {
      console.error("Error al eliminar Filamento:", error);
    });
}

/* =========================================
   Función extra: extraer número de nombre
   =========================================*/
/**
 * Dado un string como "PON A10", "Caja 1", "PON B2", etc.
 * Retorna el número que aparece al final del texto.
 * Si no encuentra, retorna 0.
 */
function extraerNumeroDeNombre(str) {
  const regex = /(\d+)$/; // Captura uno o más dígitos al final
  const match = str.match(regex);
  if (match) {
    return parseInt(match[1], 10);
  } else {
    return 0;
  }
}

/* =========================================
   Inicio de la App
   =========================================*/
document.addEventListener("DOMContentLoaded", function () {
  configurarSidebar();

  // Optimización: Carga optimista desde caché
  const cachedRole = localStorage.getItem("userRole");
  if (cachedRole) {
    console.log("Aplicando rol desde caché (Señales):", cachedRole);
    if (cachedRole === "admin" || cachedRole === "superadmin") {
      usuarioEsAdmin = true;
      document.body.classList.add("is-admin");
      if (cachedRole === "superadmin") {
        const liRegistros = document.getElementById("li-registros");
        if (liRegistros) liRegistros.style.display = "block";
      }
    }
  }

  verificarRolUsuario();
  configurarLogout();
});
