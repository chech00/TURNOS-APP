// ===========================================================================
// TEAM CARDS - Funcionalidad para tarjetas de empleados en NOC
// ===========================================================================

const DEFAULT_EMPLOYEES = [
    { nombre: "Sergio Castillo" },
    { nombre: "Ignacio Aburto" },
    { nombre: "Claudio Bustamante" },
    { nombre: "Julio Oliva" },
    { nombre: "Gabriel Trujillo" },
    { nombre: "Cristian Oyarzo" }
];

async function loadTeamCards() {
    const container = document.getElementById("employee-cards-container");
    if (!container) {
        console.warn("[TEAM] Contenedor de tarjetas no encontrado");
        return;
    }

    container.innerHTML = '<div class="spinner" style="margin: 2rem auto;"></div>';

    try {
        let employeesList = [];

        // Cargar desde Firestore
        try {
            if (window.db) {
                const doc = await window.db.collection("Config").doc("empleados_noc").get();
                if (doc.exists && doc.data().lista) {
                    employeesList = doc.data().lista;
                    console.log("[TEAM] Empleados cargados desde Firestore:", employeesList.length);
                }
            }
        } catch (e) {
            console.warn("[TEAM] No se pudo cargar desde Firestore:", e);
        }

        // Fallback
        if (employeesList.length === 0) {
            const stored = localStorage.getItem("noc_empleados_list");
            employeesList = stored ? JSON.parse(stored) : DEFAULT_EMPLOYEES;
            console.log("[TEAM] Usando empleados por defecto");
        }

        container.innerHTML = "";

        if (employeesList.length === 0) {
            container.innerHTML = '<p style="text-align:center; color: #999;">No hay empleados configurados</p>';
            return;
        }

        // Renderizar tarjetas
        employeesList.forEach((emp, index) => {
            const card = document.createElement("div");
            card.className = "employee-card fade-in";
            card.style.animationDelay = (index * 100) + "ms";

            const photoUrl = emp.fotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.nombre)}&background=random&size=120`;
            const role = emp.cargo || "Operador NOC";

            card.innerHTML = `
        <img src="${photoUrl}" alt="${emp.nombre}" class="employee-photo" id="emp-img-${index}" />
        <h3 class="employee-name">${emp.nombre}</h3>
        <p class="employee-role">${role}</p>
        <input type="file" accept="image/*" class="photo-input" id="emp-input-${index}" style="display:none" data-employee="${emp.nombre}" data-index="${index}">
        <button type="button" class="upload-photo-btn admin-only" style="display:none" data-input-id="emp-input-${index}">
          <i data-lucide="camera"></i> Cambiar foto
        </button>
      `;

            container.appendChild(card);
        });

        // Cargar fotos desde Firestore
        try {
            const photosSnapshot = await window.db.collection("empleados").get();
            const photosMap = {};

            photosSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.photoURL) {
                    photosMap[doc.id] = data.photoURL;
                }
            });

            container.querySelectorAll(".employee-card").forEach(card => {
                const nameEl = card.querySelector(".employee-name");
                const imgEl = card.querySelector(".employee-photo");
                if (nameEl && imgEl) {
                    const name = nameEl.textContent.trim();
                    if (photosMap[name]) {
                        imgEl.src = photosMap[name];
                        console.log("[TEAM] Foto cargada para:", name);
                    }
                }
            });
        } catch (err) {
            console.warn("[TEAM] Error cargando fotos:", err);
        }

        // Aplicar visibilidad admin
        const role = localStorage.getItem("userRole");
        if (role === "admin" || role === "superadmin") {
            container.querySelectorAll(".admin-only").forEach(el => {
                el.style.display = "flex";
            });
        }

        // Event listeners
        container.querySelectorAll(".upload-photo-btn").forEach(btn => {
            btn.addEventListener("click", function () {
                const inputId = this.getAttribute("data-input-id");
                const input = document.getElementById(inputId);
                if (input) input.click();
            });
        });

        // Refresh icons
        if (window.lucide) window.lucide.createIcons();

    } catch (error) {
        console.error("[TEAM] Error fatal:", error);
        container.innerHTML = "<p>Error al cargar equipo</p>";
    }
}

// Helper function to wait for Firebase to be ready
function waitForFirebase(callback, maxAttempts = 50, interval = 100) {
    let attempts = 0;
    const check = () => {
        attempts++;
        if (window.db) {
            console.log("[TEAM] Firebase ready after", attempts, "attempts");
            callback();
        } else if (attempts < maxAttempts) {
            setTimeout(check, interval);
        } else {
            console.warn("[TEAM] Firebase not available after", maxAttempts, "attempts, loading with fallback");
            callback(); // Load anyway with fallback data
        }
    };
    check();
}

// Auto-cargar al iniciar
document.addEventListener("DOMContentLoaded", () => {
    console.log("[TEAM] Esperando Firebase...");
    waitForFirebase(() => {
        console.log("[TEAM] Iniciando carga de tarjetas...");
        loadTeamCards();
    });

    // Escuchar cambios
    const channel = new BroadcastChannel("empleados_sync");
    channel.onmessage = (e) => {
        if (e.data && (e.data.type === "empleados_updated" || e.data.type === "refresh_store")) {
            console.log("[TEAM] Cambio detectado, recargando...");
            loadTeamCards();
        }
    };
});
