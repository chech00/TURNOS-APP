"use strict";

const auth = window.auth;
const db = window.db;

let allLogsCache = []; // Store fetched logs for client-side filtering

document.addEventListener("DOMContentLoaded", () => {

  // Optimistic Loading
  const cachedRole = localStorage.getItem("userRole");
  if (cachedRole === "superadmin") {
    showAdminElements();
    document.body.classList.add("is-admin");
  } else if (cachedRole === "admin") {
    document.body.classList.add("is-admin");
  }

  // 1. Verificar autenticación y rol
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    // Leer rol desde Firestore
    const userDoc = await db.collection("userRoles").doc(user.uid).get();
    if (!userDoc.exists) {
      auth.signOut().then(() => {
        localStorage.removeItem('userRole');
        window.location.href = "login.html";
      });
      return;
    }

    const userData = userDoc.data();
    const userRole = userData.rol;

    // Solo superadmin puede ver estos registros
    if (userRole !== "superadmin") {
      window.location.href = "index.html";
      return;
    }

    document.body.classList.add("is-admin");
    showAdminElements();

    // 2. Cargar logs de inicios de sesión
    initFilters();
    cargarRegistrosDeLogins(); // Load all initial
  });

  // 3. Logout setup
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      auth.signOut().then(() => {
        localStorage.removeItem('userRole');
        window.location.href = "login.html";
      });
    });
  }

  // 4. Sidebar toggle
  const sidebar = document.getElementById("sidebar");
  const mainContent = document.getElementById("main-content");
  const menuToggle = document.getElementById("menu-toggle");
  if (menuToggle && sidebar && mainContent) {
    menuToggle.addEventListener("click", () => {
      sidebar.classList.toggle("expanded");
      mainContent.classList.toggle("expanded");
    });
  }

  // 5. Buttons
  const btnBackup = document.getElementById("btnDownloadBackup");
  const btnClean = document.getElementById("btnCleanLogs");
  if (btnBackup) btnBackup.addEventListener("click", downloadSystemBackup);
  if (btnClean) btnClean.addEventListener("click", cleanOldLogs);

});

function showAdminElements() {
  const ids = ["li-registros", "li-usuarios", "li-animaciones"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "block";
  });
  // Refrescar iconos después de mostrar elementos
  if (typeof refreshIcons === 'function') refreshIcons();
  else if (typeof lucide !== 'undefined') lucide.createIcons();
}

// -------------------------------------------------------------
// FILTER LOGIC
// -------------------------------------------------------------
function initFilters() {
  document.getElementById('btn-apply-filters').addEventListener('click', applyFilters);
  document.getElementById('btn-reset-filters').addEventListener('click', () => {
    document.getElementById('filter-date-start').value = '';
    document.getElementById('filter-date-end').value = '';
    document.getElementById('filter-role').value = 'all';
    applyFilters();
  });
}

function applyFilters() {
  const startStr = document.getElementById('filter-date-start').value;
  const endStr = document.getElementById('filter-date-end').value;
  const role = document.getElementById('filter-role').value;

  let filtered = allLogsCache;

  // Date Filter
  if (startStr) {
    const startDate = new Date(startStr + "T00:00:00");
    filtered = filtered.filter(log => {
      if (!log.timestamp) return false;
      return log.timestamp.toDate() >= startDate;
    });
  }

  if (endStr) {
    const endDate = new Date(endStr + "T23:59:59");
    filtered = filtered.filter(log => {
      if (!log.timestamp) return false;
      return log.timestamp.toDate() <= endDate;
    });
  }

  // Role Filter
  if (role !== 'all') {
    filtered = filtered.filter(log => log.rol === role);
  }

  renderTable(filtered);
}


async function cargarRegistrosDeLogins() {
  try {
    const loader = document.getElementById("table-loader");
    const tabla = document.getElementById("tabla-registros");

    if (loader) loader.style.display = "flex";
    if (tabla) tabla.style.display = "none";

    // Fetch larger batch for client-side filtering
    // Firestore composite index limitations mean simple queries + client filtering is safer for now
    const snapshot = await db.collection("loginLogs")
      .orderBy("timestamp", "desc")
      .limit(200)
      .get();

    if (loader) loader.style.display = "none";
    if (tabla) tabla.style.display = "table";

    allLogsCache = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      data.id = doc.id; // Keep ID
      allLogsCache.push(data);
    });

    renderTable(allLogsCache);

  } catch (error) {
    console.error("Error al cargar registros de login:", error);
  }
}

function renderTable(logs) {
  const tablaBody = document.querySelector("#tabla-registros tbody");
  if (!tablaBody) return;

  tablaBody.innerHTML = "";

  if (logs.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.textContent = "No hay registros que coincidan con los filtros.";
    tr.appendChild(td);
    tablaBody.appendChild(tr);
    return;
  }

  logs.forEach(data => {
    const tr = document.createElement("tr");

    const tdEmail = document.createElement("td");
    tdEmail.innerHTML = `<i data-lucide="mail" style="width:14px; vertical-align:middle; margin-right:5px; opacity:0.7"></i> ${data.email || "Sin email"}`;

    const tdRol = document.createElement("td");
    // Badge style based on role
    const roleClass = data.rol === 'superadmin' ? 'superadmin' : (data.rol === 'admin' ? 'admin' : '');
    const badge = `<span class="user-role-badge ${roleClass}" style="position:static; margin:0; font-size:0.75rem;">${data.rol || "N/A"}</span>`;
    tdRol.innerHTML = badge;

    // Auth Provider column
    const tdMethod = document.createElement("td");
    const provider = data.authProvider || "email"; // Default to email for old records
    if (provider === "google") {
      tdMethod.innerHTML = `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;background:rgba(66,133,244,0.15);border:1px solid rgba(66,133,244,0.3);border-radius:4px;color:#4285f4;font-size:0.75rem;"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"><path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Google</span>`;
    } else {
      tdMethod.innerHTML = `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;background:rgba(119,150,203,0.15);border:1px solid rgba(119,150,203,0.3);border-radius:4px;color:#7796cb;font-size:0.75rem;"><i data-lucide="mail" style="width:12px;height:12px;"></i> Email</span>`;
    }

    const tdFecha = document.createElement("td");
    if (data.timestamp && data.timestamp.toDate) {
      const fechaJS = data.timestamp.toDate();
      tdFecha.textContent = fechaJS.toLocaleString("es-CL");
    } else {
      tdFecha.textContent = "Sin fecha";
    }

    tr.appendChild(tdEmail);
    tr.appendChild(tdRol);
    tr.appendChild(tdMethod);
    tr.appendChild(tdFecha);
    tablaBody.appendChild(tr);
  });

  if (window.lucide) window.lucide.createIcons();
}

// -----------------------------------------------------------------------------
// EXPORT & CLEANUP
// -----------------------------------------------------------------------------

async function downloadSystemBackup() {
  // Allows user to name the file? No, auto-name for easier UX
  await generatePDFBackup();
}

async function generatePDFBackup() {
  if (!window.jspdf) {
    Swal.fire("Error", "Librería PDF no cargada.", "error");
    return;
  }

  try {
    Swal.fire({
      title: "Generando Reporte...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const fecha = new Date().toLocaleString("es-CL");

    doc.setFontSize(18);
    doc.text("Reporte de Auditoría - Turnos App", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generado: ${fecha}`, 14, 28);

    doc.setFontSize(12);
    doc.text("Filtros Aplicados:", 14, 40);
    const startStr = document.getElementById('filter-date-start').value || "Inicio";
    const endStr = document.getElementById('filter-date-end').value || "Actualidad";
    const role = document.getElementById('filter-role').value;
    doc.setFontSize(10);
    doc.text(`Fecha: ${startStr} a ${endStr} | Rol: ${role}`, 14, 46);

    let startY = 55;

    const logsRows = [];
    // Use visible logs (filtered)
    // We need to re-apply filter or capture current state. 
    // Best to grab from DOM or re-run filter? Re-run filter on cache is safer.

    // We already have applyFilters logic but it updates DOM.
    // Let's grab DOM rows to ensure WYSIWYG
    const rows = document.querySelectorAll("#tabla-registros tbody tr");
    rows.forEach(tr => {
      if (tr.innerText.includes("No hay registros")) return;
      const tds = tr.querySelectorAll("td");
      if (tds.length >= 4) {
        logsRows.push([
          tds[0].innerText.trim(), // Email
          tds[1].innerText.trim(), // Rol
          tds[2].innerText.trim(), // Método
          tds[3].innerText.trim()  // Fecha
        ]);
      }
    });

    doc.autoTable({
      startY: startY,
      head: [['Email', 'Rol', 'Método', 'Fecha/Hora']],
      body: logsRows,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 66, 66] }
    });

    doc.save(`reporte_auditoria_${new Date().toISOString().slice(0, 10)}.pdf`);
    Swal.fire("Éxito", "Reporte PDF generado.", "success");

  } catch (e) {
    console.error(e);
    Swal.fire("Error", "Falló la generación del PDF.", "error");
  }
}

async function cleanOldLogs() {
  // Same as before
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const snapshot = await db.collection("loginLogs")
      .where("timestamp", "<", oneYearAgo)
      .get();

    const count = snapshot.size;

    if (count === 0) {
      Swal.fire("Limpieza", "No hay registros antiguos (>1 año) para borrar.", "info");
      return;
    }

    const result = await Swal.fire({
      title: "¿Limpiar Logs Antiguos?",
      text: `Se encontraron ${count} registros mayores a 1 año.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonColor: "#d33"
    });

    if (!result.isConfirmed) return;

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    Swal.fire("Limpieza Exitosa", `Se eliminaron ${count} registros antiguos.`, "success");
    cargarRegistrosDeLogins(); // Reload

  } catch (error) {
    console.error("Error al limpiar logs:", error);
    Swal.fire("Error", "Hubo un problema al intentar limpiar los logs.", "error");
  }
}
