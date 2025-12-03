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
        }
      }
    } catch (error) {
      console.error("Error verificando rol:", error);
    }
  });
}