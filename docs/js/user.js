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

        // Si es admin, redirigir a index.html
        if (userRole === "admin" || userRole === "superadmin") {
          window.location.href = "index.html";
        } else {
          // Usuario normal - actualizar header de perfil
          const nameElement = document.getElementById('user-display-name');
          const emailElement = document.getElementById('user-display-email');
          const roleBadge = document.getElementById('user-role-badge');
          const roleText = document.getElementById('user-role-text');

          if (nameElement && emailElement && roleBadge && roleText) {
            const displayName = user.displayName || user.email.split('@')[0];
            nameElement.textContent = displayName;
            emailElement.textContent = user.email;

            roleText.textContent = 'Usuario';
            roleBadge.className = 'user-role-badge';

            const roleIcon = roleBadge.querySelector('i');
            if (roleIcon) {
              roleIcon.setAttribute('data-lucide', 'user');
              if (window.lucide) window.lucide.createIcons();
            }

            console.log('✅ User profile updated (user view):', displayName);
          }
        }
      }
    } catch (error) {
      console.error("Error verificando rol:", error);
    }
  });
}