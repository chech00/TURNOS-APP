"use strict";

const auth = window.auth;
const db = window.db;

let allLogsCache = []; // Store fetched logs for client-side filtering
let chartLogins = null;
let chartMethods = null;
let unsubscribeSessions = null;
let currentUserUid = null;

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

    currentUserUid = user.uid;

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

    // Nota: La sesión activa se registra automáticamente via active-session.js

    // Cargar datos
    initFilters();
    cargarRegistrosDeLogins();
    initDashboard();
    initActiveSessions();
  });

  // 3. Logout setup
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      // La limpieza de sesión se maneja en active-session.js via cleanupActiveSession()
      if (typeof window.cleanupActiveSession === 'function') {
        await window.cleanupActiveSession();
      }
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
  const btnRefresh = document.getElementById("btnRefreshSessions");

  if (btnBackup) btnBackup.addEventListener("click", downloadSystemBackup);
  if (btnClean) btnClean.addEventListener("click", cleanOldLogs);
  if (btnRefresh) btnRefresh.addEventListener("click", () => {
    btnRefresh.classList.add("spinning");
    setTimeout(() => btnRefresh.classList.remove("spinning"), 1000);
  });
});

function showAdminElements() {
  const ids = ["li-registros", "li-turnos", "li-usuarios", "li-animaciones"];
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

// =============================================================================
// ACTIVE SESSIONS MANAGEMENT
// =============================================================================

async function registerActiveSession(user, role) {
  try {
    const sessionData = {
      uid: user.uid,
      email: user.email,
      role: role,
      loginTime: firebase.firestore.FieldValue.serverTimestamp(),
      lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
      userAgent: navigator.userAgent.substring(0, 100),
      page: 'registros'
    };

    await db.collection("activeSessions").doc(user.uid).set(sessionData);
    console.log("[Sessions] Sesión registrada");

    // Heartbeat cada 30 segundos para mantener la sesión activa
    setInterval(async () => {
      try {
        await db.collection("activeSessions").doc(user.uid).update({
          lastActivity: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (e) {
        console.warn("[Sessions] Heartbeat failed:", e);
      }
    }, 30000);

  } catch (error) {
    console.error("[Sessions] Error registering session:", error);
  }
}

function initActiveSessions() {
  const sessionsGrid = document.getElementById("sessions-grid");
  if (!sessionsGrid) return;

  // Real-time listener for active sessions
  unsubscribeSessions = db.collection("activeSessions")
    .orderBy("loginTime", "desc")
    .onSnapshot((snapshot) => {
      const sessions = [];
      const now = new Date();
      const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes timeout

      snapshot.forEach(doc => {
        const data = doc.data();
        data.id = doc.id;

        // Check if session is still active (activity within last 5 minutes)
        if (data.lastActivity) {
          const lastActivity = data.lastActivity.toDate();
          const isActive = (now - lastActivity) < TIMEOUT_MS;
          if (isActive) {
            sessions.push(data);
          } else {
            // Clean up stale session
            db.collection("activeSessions").doc(doc.id).delete().catch(() => { });
          }
        }
      });

      renderSessionCards(sessions);

      // Update stat card
      const statActiveNow = document.getElementById("stat-active-now");
      if (statActiveNow) {
        statActiveNow.textContent = sessions.length;
      }

      if (window.lucide) lucide.createIcons();
    }, (error) => {
      console.error("[Sessions] Listener error:", error);
    });
}

function renderSessionCards(sessions) {
  const sessionsGrid = document.getElementById("sessions-grid");
  if (!sessionsGrid) return;

  if (sessions.length === 0) {
    sessionsGrid.innerHTML = `
      <div class="no-sessions">
        <i data-lucide="users"></i>
        <p>No hay sesiones activas en este momento</p>
      </div>
    `;
    return;
  }

  let html = '';
  sessions.forEach(session => {
    const isCurrentUser = session.uid === currentUserUid;
    const initial = session.email ? session.email.charAt(0).toUpperCase() : '?';
    const loginTime = session.loginTime ? session.loginTime.toDate().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '--:--';

    html += `
      <div class="session-card ${isCurrentUser ? 'current-user' : ''}">
        <div class="session-header">
          <div class="session-avatar">${initial}</div>
          <div class="session-user-info">
            <div class="session-email">${session.email || 'Sin email'}</div>
            <div class="session-role">${session.role || 'user'}</div>
          </div>
          <div class="session-status">Activo</div>
        </div>
        <div class="session-meta">
          <div class="session-time">
            <i data-lucide="clock"></i>
            Desde ${loginTime}
          </div>
          ${!isCurrentUser ? `
            <button class="btn-terminate" onclick="terminateSession('${session.uid}', '${session.email}')" title="Cerrar sesión remota">
              <i data-lucide="power"></i> Terminar
            </button>
          ` : `
            <span style="font-size:0.75rem; color:var(--color-acento-primario);">Tu sesión</span>
          `}
        </div>
      </div>
    `;
  });

  sessionsGrid.innerHTML = html;
}

async function terminateSession(uid, email) {
  const result = await Swal.fire({
    title: '¿Cerrar esta sesión?',
    html: `Se cerrará la sesión de <strong>${email}</strong> de forma remota.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, cerrar sesión',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#ef4444'
  });

  if (!result.isConfirmed) return;

  try {
    // Mark session as terminated (will be picked up by their onSnapshot)
    await db.collection("activeSessions").doc(uid).update({
      terminated: true,
      terminatedBy: currentUserUid,
      terminatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Also delete it
    await db.collection("activeSessions").doc(uid).delete();

    Swal.fire({
      icon: 'success',
      title: 'Sesión cerrada',
      text: `La sesión de ${email} ha sido terminada.`,
      timer: 2000,
      showConfirmButton: false
    });

  } catch (error) {
    console.error("Error terminating session:", error);
    Swal.fire('Error', 'No se pudo cerrar la sesión remota.', 'error');
  }
}

// Make terminateSession globally accessible
window.terminateSession = terminateSession;

// =============================================================================
// DASHBOARD & STATISTICS
// =============================================================================

function initDashboard() {
  calculateStats();
}

function calculateStats() {
  if (allLogsCache.length === 0) {
    // Wait for logs to load
    setTimeout(calculateStats, 500);
    return;
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  // Filter logs from last 7 days
  const recentLogs = allLogsCache.filter(log => {
    if (!log.timestamp) return false;
    return log.timestamp.toDate() >= sevenDaysAgo;
  });

  // 1. Total Logins (7 days)
  document.getElementById("stat-total-logins").textContent = recentLogs.length;

  // 2. Unique Users
  const uniqueEmails = new Set(recentLogs.map(log => log.email).filter(Boolean));
  document.getElementById("stat-unique-users").textContent = uniqueEmails.size;

  // 3. Peak Hour
  const hourCounts = {};
  recentLogs.forEach(log => {
    if (log.timestamp) {
      const hour = log.timestamp.toDate().getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }
  });

  let peakHour = '--';
  let maxCount = 0;
  Object.entries(hourCounts).forEach(([hour, count]) => {
    if (count > maxCount) {
      maxCount = count;
      peakHour = `${hour}:00`;
    }
  });
  document.getElementById("stat-peak-hour").textContent = peakHour;

  // 4. Charts
  renderCharts(recentLogs);

  // 5. Top Users
  renderTopUsers(recentLogs);
}

function renderCharts(logs) {
  // Logins per Day Chart
  const dailyCounts = {};
  const labels = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().split('T')[0];
    const label = date.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' });
    labels.push(label);
    dailyCounts[key] = 0;
  }

  logs.forEach(log => {
    if (log.timestamp) {
      const key = log.timestamp.toDate().toISOString().split('T')[0];
      if (dailyCounts.hasOwnProperty(key)) {
        dailyCounts[key]++;
      }
    }
  });

  const ctx1 = document.getElementById('chartLoginsPerDay');
  if (ctx1) {
    if (chartLogins) chartLogins.destroy();
    chartLogins = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Logins',
          data: Object.values(dailyCounts),
          backgroundColor: 'rgba(119, 150, 203, 0.7)',
          borderColor: 'rgba(119, 150, 203, 1)',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: '#9ca3af' },
            grid: { color: 'rgba(255,255,255,0.05)' }
          },
          x: {
            ticks: { color: '#9ca3af' },
            grid: { display: false }
          }
        }
      }
    });
  }

  // Auth Methods Pie Chart
  const methodCounts = { email: 0, google: 0 };
  logs.forEach(log => {
    const method = log.authProvider || 'email';
    if (method === 'google') {
      methodCounts.google++;
    } else {
      methodCounts.email++;
    }
  });

  const ctx2 = document.getElementById('chartAuthMethods');
  if (ctx2) {
    if (chartMethods) chartMethods.destroy();
    chartMethods = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: ['Email/Contraseña', 'Google'],
        datasets: [{
          data: [methodCounts.email, methodCounts.google],
          backgroundColor: ['rgba(119, 150, 203, 0.8)', 'rgba(234, 67, 53, 0.8)'],
          borderColor: ['rgba(119, 150, 203, 1)', 'rgba(234, 67, 53, 1)'],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#9ca3af', padding: 15 }
          }
        }
      }
    });
  }
}

function renderTopUsers(logs) {
  const container = document.getElementById('top-users-list');
  if (!container) return;

  // Count logins per user
  const userCounts = {};
  logs.forEach(log => {
    if (log.email) {
      userCounts[log.email] = (userCounts[log.email] || 0) + 1;
    }
  });

  // Sort and take top 5
  const sorted = Object.entries(userCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (sorted.length === 0) {
    container.innerHTML = '<p style="color:var(--color-texto-secundario);">No hay datos suficientes</p>';
    return;
  }

  let html = '';
  sorted.forEach(([email, count], index) => {
    const rankClass = index === 0 ? 'gold' : (index === 1 ? 'silver' : (index === 2 ? 'bronze' : ''));
    html += `
      <div class="top-user-item">
        <span class="top-user-rank ${rankClass}">#${index + 1}</span>
        <div class="top-user-info">
          <span class="top-user-email" title="${email}">${email}</span>
          <span class="top-user-count">${count} logins</span>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}
