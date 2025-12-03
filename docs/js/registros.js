// registros.js
"use strict";

const auth = window.auth;
const db = window.db;

document.addEventListener("DOMContentLoaded", () => {

  // 1. Verificar autenticación y rol
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      // No hay usuario => al login
      window.location.href = "login.html";
      return;
    }

    // Leer rol desde Firestore
    const userDoc = await db.collection("userRoles").doc(user.uid).get();
    if (!userDoc.exists) {
      // Sin documento => rol no asignado
      auth.signOut();
      window.location.href = "login.html";
      return;
    }

    const userData = userDoc.data();
    const userRole = userData.rol;
    console.log("Rol actual:", userRole);

    // Solo superadmin puede ver estos registros
    if (userRole !== "superadmin") {
      // Si no es superadmin => Redirigir
      window.location.href = "index.html";
      return;
    }

    // 2. Cargar logs de inicios de sesión
    cargarRegistrosDeLogins();
  });

  // 3. Logout
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      auth.signOut().then(() => {
        window.location.href = "login.html";
      }).catch(err => console.error("Error al cerrar sesión:", err));
    });
  }

  // 4. Botón toggle del menú
  const sidebar = document.getElementById("sidebar");
  const mainContent = document.getElementById("main-content");
  const menuToggle = document.getElementById("menu-toggle");
  if (menuToggle && sidebar && mainContent) {
    menuToggle.addEventListener("click", () => {
      sidebar.classList.toggle("expanded");
      mainContent.classList.toggle("expanded");
    });
  }
});

// 5. Función para traer y mostrar registros (colección "loginLogs")
async function cargarRegistrosDeLogins() {
  try {
    const tablaBody = document.querySelector("#tabla-registros tbody");
    if (!tablaBody) return;

    // Consulta a Firestore: loginLogs, ordenado por timestamp descendente
    const snapshot = await db.collection("loginLogs")
      .orderBy("timestamp", "desc")
      .limit(50) // por ejemplo, últimos 50 registros
      .get();

    tablaBody.innerHTML = ""; // Limpiar contenido previo

    if (snapshot.empty) {
      // No hay registros
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 3;
      td.textContent = "No hay registros de inicio de sesión.";
      tr.appendChild(td);
      tablaBody.appendChild(tr);
      return;
    }

    snapshot.forEach(doc => {
      const data = doc.data();
      const tr = document.createElement("tr");

      const tdEmail = document.createElement("td");
      tdEmail.textContent = data.email || "Sin email";

      const tdRol = document.createElement("td");
      tdRol.textContent = data.rol || "N/A";

      const tdFecha = document.createElement("td");
      if (data.timestamp && data.timestamp.toDate) {
        // data.timestamp es un Firestore Timestamp
        const fechaJS = data.timestamp.toDate();
        tdFecha.textContent = fechaJS.toLocaleString("es-CL");
      } else {
        tdFecha.textContent = "Sin fecha";
      }

      tr.appendChild(tdEmail);
      tr.appendChild(tdRol);
      tr.appendChild(tdFecha);
      tablaBody.appendChild(tr);
    });

  } catch (error) {
    console.error("Error al cargar registros de login:", error);
  }
}
