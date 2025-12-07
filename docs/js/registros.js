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
      auth.signOut().then(() => {
        localStorage.removeItem('userRole');
        window.location.href = "login.html";
      });
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

    document.body.classList.add("is-admin");

    // 2. Cargar logs de inicios de sesión
    cargarRegistrosDeLogins();
  });

  // 3. Logout
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      auth.signOut().then(() => {
        localStorage.removeItem('userRole');
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

    const loader = document.getElementById("table-loader");
    const tabla = document.getElementById("tabla-registros");

    if (loader) loader.style.display = "flex";
    if (tabla) tabla.style.display = "none";

    // Consulta a Firestore: loginLogs, ordenado por timestamp descendente
    const snapshot = await db.collection("loginLogs")
      .orderBy("timestamp", "desc")
      .limit(50) // por ejemplo, últimos 50 registros
      .get();

    if (loader) loader.style.display = "none";
    if (tabla) tabla.style.display = "table";

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
      tdEmail.setAttribute("data-label", "Email");

      const tdRol = document.createElement("td");
      tdRol.textContent = data.rol || "N/A";
      tdRol.setAttribute("data-label", "Rol");

      const tdFecha = document.createElement("td");
      tdFecha.setAttribute("data-label", "Fecha/Hora");
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

// -----------------------------------------------------------------------------
// 6. FUNCIONES DE MANTENIMIENTO (BACKUP & CLEANUP)
// -----------------------------------------------------------------------------

async function downloadSystemBackup() {
  const result = await Swal.fire({
    title: "Selecciona Formato",
    text: "¿Cómo deseas descargar el backup?",
    icon: "question",
    showDenyButton: true,
    showCancelButton: true,
    confirmButtonText: "JSON (Restaurable)",
    denyButtonText: "PDF (Legible)",
    cancelButtonText: "Cancelar"
  });

  if (result.isDismissed) return;

  if (result.isConfirmed) {
    // JSON
    await generateJSONBackup();
  } else if (result.isDenied) {
    // PDF
    await generatePDFBackup();
  }
}

async function generateJSONBackup() {
  try {
    Swal.fire({
      title: "Generando JSON...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    const backupData = {
      timestamp: new Date().toISOString(),
      metadata: "Full System Backup (Turnos App)",
      collections: {}
    };

    // 1. Calendarios
    const calendariosSnap = await db.collection("calendarios").get();
    backupData.collections.calendarios = {};
    calendariosSnap.forEach(doc => {
      backupData.collections.calendarios[doc.id] = doc.data();
    });

    // 2. Empleados
    const empleadosSnap = await db.collection("empleados").get();
    backupData.collections.empleados = {};
    empleadosSnap.forEach(doc => {
      backupData.collections.empleados[doc.id] = doc.data();
    });

    // 3. Roles de Usuario
    const rolesSnap = await db.collection("userRoles").get();
    backupData.collections.userRoles = {};
    rolesSnap.forEach(doc => {
      backupData.collections.userRoles[doc.id] = doc.data();
    });

    // 4. Logs de Login
    const logsSnap = await db.collection("loginLogs").get();
    backupData.collections.loginLogs = {};
    logsSnap.forEach(doc => {
      backupData.collections.loginLogs[doc.id] = doc.data();
    });

    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `backup_turnos_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    Swal.fire("Éxito", "Backup JSON descargado.", "success");
  } catch (e) {
    console.error(e);
    Swal.fire("Error", "Falló la descarga JSON.", "error");
  }
}

async function generatePDFBackup() {
  if (!window.jspdf) {
    Swal.fire("Error", "Librería PDF no cargada.", "error");
    return;
  }

  try {
    Swal.fire({
      title: "Generando PDF...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const fecha = new Date().toLocaleString("es-CL");

    // Título
    doc.setFontSize(18);
    doc.text("Reporte de Sistema - Turnos App", 14, 20);
    doc.setFontSize(12);
    doc.text(`Fecha: ${fecha}`, 14, 30);

    // 1. Empleados
    doc.setFontSize(14);
    doc.text("1. Empleados", 14, 45);

    const empleadosSnap = await db.collection("empleados").get();
    const empleadosRows = [];
    empleadosSnap.forEach(snap => {
      const d = snap.data();
      empleadosRows.push([d.nombre || snap.id, d.rol || "-"]);
    });

    doc.autoTable({
      startY: 50,
      head: [['Nombre', 'Rol']],
      body: empleadosRows
    });

    // 2. Roles
    let finalY = doc.lastAutoTable.finalY + 15;
    doc.text("2. Roles de Usuario", 14, finalY);

    const rolesSnap = await db.collection("userRoles").get();
    const rolesRows = [];
    rolesSnap.forEach(snap => {
      const d = snap.data();
      rolesRows.push([snap.id, d.rol, d.email || "-"]);
    });

    doc.autoTable({
      startY: finalY + 5,
      head: [['UID', 'Rol', 'Email']],
      body: rolesRows
    });

    // 3. Logs (Últimos 100)
    finalY = doc.lastAutoTable.finalY + 15;
    // Nueva página si falta espacio
    if (finalY > 250) {
      doc.addPage();
      finalY = 20;
    }

    doc.text("3. Logs de Acceso (Últimos 100)", 14, finalY);

    const logsSnap = await db.collection("loginLogs").orderBy("timestamp", "desc").limit(100).get();
    const logsRows = [];
    logsSnap.forEach(snap => {
      const d = snap.data();
      const ts = d.timestamp && d.timestamp.toDate ? d.timestamp.toDate().toLocaleString("es-CL") : "-";
      logsRows.push([ts, d.email, d.rol]);
    });

    doc.autoTable({
      startY: finalY + 5,
      head: [['Fecha', 'Email', 'Rol']],
      body: logsRows
    });

    doc.save(`reporte_sistema_${new Date().toISOString().slice(0, 10)}.pdf`);
    Swal.fire("Éxito", "Reporte PDF generado.", "success");

  } catch (e) {
    console.error(e);
    Swal.fire("Error", "Falló la generación del PDF.", "error");
  }
}

async function cleanOldLogs() {
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const snapshot = await db.collection("loginLogs")
      .where("timestamp", "<", oneYearAgo)
      .get();

    const count = snapshot.size;

    if (count === 0) {
      Swal.fire("Limpieza", "No hay registros antiguos para borrar.", "info");
      return;
    }

    const result = await Swal.fire({
      title: "¿Limpiar Logs Antiguos?",
      text: `Se encontraron ${count} registros mayores a 1 año. Esta acción NO se puede deshacer.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar"
    });

    if (!result.isConfirmed) return;

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    Swal.fire("Limpieza Exitosa", `Se eliminaron ${count} registros antiguos.`, "success");

    // Recargar tabla después de limpiar
    if (typeof cargarRegistrosDeLogins === 'function') {
      cargarRegistrosDeLogins();
    }

  } catch (error) {
    console.error("Error al limpiar logs:", error);
    Swal.fire("Error", "Hubo un problema al intentar limpiar los logs.", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const btnBackup = document.getElementById("btnDownloadBackup");
  const btnClean = document.getElementById("btnCleanLogs");

  if (btnBackup) {
    btnBackup.addEventListener("click", downloadSystemBackup);
  }
  if (btnClean) {
    btnClean.addEventListener("click", cleanOldLogs);
  }
});
