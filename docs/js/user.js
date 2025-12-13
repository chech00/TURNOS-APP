import './firebase.js';

// Solo verificamos el rol para redirigir a admins/superadmins a index.html
// El resto de la UI (sidebar, logout, bienvenida) lo maneja script.js

function initUserView() {
  verificarRolUsuario();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initUserView);
} else {
  initUserView();
}

function verificarRolUsuario() {
  const auth = window.auth || (window.firebase ? firebase.auth() : null);
  const db = window.db || (window.firebase ? firebase.firestore() : null);

  if (!auth || !db) {
    setTimeout(verificarRolUsuario, 100);
    return;
  }

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    try {
      const userDoc = await db.collection("userRoles").doc(user.uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        const userRole = userData.rol;

        // Si NO es admin/superadmin, redirigir a directorio
        // El usuario quiere que "Turnos" sea solo para admins
        if (userRole !== "admin" && userRole !== "superadmin") {
          console.warn("Acceso denegado a Turnos: Redirigiendo a directorio.");
          window.location.href = "directorio.html";
          return;
        } else {
          // Redirect admins to the main Turnos dashboard which has all functionality
          window.location.href = "index.html";
          return;
        }

        // Si es admin, mostrar la vista
        // (Antes redirigía a index, pero ahora user.html es la vista restringida también)
        // O tal vez index.html es la vista de turnos principal?
        // Si el usuario dijo "vista de turnos", y el link lleva a user.html o index.html...
        // Protegemos esta vista por si acaso.

        // Actualizar header de perfil aunque sea admin
        const nameElement = document.getElementById('user-display-name');
        const emailElement = document.getElementById('user-display-email');
        const roleBadge = document.getElementById('user-role-badge');
        const roleText = document.getElementById('user-role-text');

        if (nameElement && emailElement && roleBadge && roleText) {
          const displayName = user.displayName || user.email.split('@')[0];
          nameElement.textContent = displayName;
          emailElement.textContent = user.email;

          roleText.textContent = userRole.toUpperCase();
          roleBadge.className = 'user-role-badge ' + userRole; // Adds color

          const roleIcon = roleBadge.querySelector('i');
          if (roleIcon) {
            roleIcon.setAttribute('data-lucide', 'shield');
            if (window.lucide) window.lucide.createIcons();
          }
        }
      }
    } catch (error) {
      console.error("Error verificando rol:", error);
    }
  });
}