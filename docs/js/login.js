
"use strict";

const auth = window.auth;
const db = window.db;

// Manejo del inicio de sesión
document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  console.log("Iniciando proceso de login v2.1..."); // DEBUG

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const errorMessageElement = document.getElementById("error-message");

  try {
    // 1) Autenticar con Firebase
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const user = userCredential.user;
    console.log("Usuario autenticado:", user);

    // Ocultar mensajes de error
    errorMessageElement.style.display = "none";
    errorMessageElement.textContent = "";

    // 2) Obtener rol desde Firestore
    const userDoc = await db.collection("userRoles").doc(user.uid).get();
    if (!userDoc.exists) {
      // Si no hay documento de rol, cierra sesión y avisa
      await auth.signOut();
      Swal.fire("Error", "No tienes un rol asignado. Contacta al administrador.", "error");
      return;
    }

    const userData = userDoc.data();
    const userRole = userData.rol;
    console.log("Datos del usuario:", userData); // DEBUG
    console.log("Rol del usuario:", userRole);

    // --- NUEVO: Verificar si la cuenta está suspendida ---
    try {
      const userStatusDoc = await db.collection("userStatus").doc(user.uid).get();
      if (userStatusDoc.exists) {
        const statusData = userStatusDoc.data();
        if (statusData.suspended === true) {
          console.warn("Usuario suspendido intentando acceder:", user.email);
          await auth.signOut();

          let reason = statusData.suspendedReason || "Razón no especificada"; // Fallback text

          // Usar SweetAlert2 si está disponible (debería estarlo en login.html)
          if (typeof Swal !== 'undefined') {
            Swal.fire({
              icon: 'error',
              title: 'Cuenta Suspendida',
              html: `<div style="text-align: center;">
                                <p>Tu acceso al sistema ha sido restringido.</p>
                                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #f87171; padding: 10px; border-radius: 6px; margin: 15px 0;">
                                    <strong>Razón:</strong> ${reason}
                                </div>
                                <p style="font-size: 0.9em; opacity: 0.7;">Contacta a soporte para más detalles.</p>
                               </div>`,
              confirmButtonText: 'Cerrar',
              confirmButtonColor: '#3b82f6',
              background: '#1a1a2e', // Match theme roughly just in case css isn't loaded (but it is)
              color: '#ffffff'
            });
          } else {
            alert("CUENTA SUSPENDIDA\n\nRazón: " + reason);
          }
          return; // DETENER LOGIN
        }
      }
    } catch (statusError) {
      console.error("Warning: Error verificando estado de suspensión:", statusError);
      // Continuamos (fail-open por robustez, o podría ser fail-close)
    }

    // --- NUEVO: Verificar si debe cambiar contraseña ---
    // DEBUG: Alert removido.

    if (userData.mustChangePassword === true) {
      console.log("El usuario debe cambiar su contraseña (flag activo).");
      window.location.href = "change-password.html";
      return; // Detener ejecución aquí
    } else {
      console.log("El usuario NO necesita cambiar contraseña (flag:", userData.mustChangePassword, ")");
    }
    // --------------------------------------------------
    // --------------------------------------------------

    // 3) Guardar log de inicio de sesión en la colección "loginLogs"
    //    (Lo creas en Firestore con los campos: email, rol, timestamp)
    await db.collection("loginLogs").add({
      email: user.email,
      rol: userRole,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    console.log("Registro de login guardado en 'loginLogs'.");

    // 4) Redirigir según rol
    //    - Todos los usuarios van a directorio.html como página principal
    //    - superadmin y admin = directorio con menús admin
    //    - user = directorio con menús limitados
    if (userRole === "admin" || userRole === "superadmin") {
      localStorage.setItem("userRole", userRole);
      window.location.href = "directorio.html";
    } else {
      // Asumimos que el resto de roles => user
      localStorage.setItem("userRole", userRole);
      window.location.href = "directorio.html";
    }
  } catch (error) {
    console.error("Error en el inicio de sesión:", error);
    errorMessageElement.style.display = "block";

    let errorCode = error.code;
    let errorMessage = error.message;

    // Manejo de errores de API (INVALID_LOGIN_CREDENTIALS)
    if (errorMessage && errorMessage.includes("INVALID_LOGIN_CREDENTIALS")) {
      errorCode = 'auth/invalid-login-credentials';
    }

    switch (errorCode) {
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-login-credentials":
        errorMessageElement.textContent = "Usuario o contraseña incorrectos.";
        break;
      case "auth/invalid-email":
        errorMessageElement.textContent = "El formato del correo no es válido.";
        break;
      case "auth/too-many-requests":
        errorMessageElement.textContent = "Demasiados intentos fallidos. Intenta más tarde.";
        break;
      default:
        errorMessageElement.textContent = "Error al iniciar sesión. Verifica tus datos.";
    }
  }
});

// --------------------------------------------------
// Toggle para mostrar/ocultar contraseña
// --------------------------------------------------
const passwordInput = document.getElementById("password");
const formGroupPassword = passwordInput.parentElement;

// Contenedor para el input y el ícono
const passwordContainer = document.createElement("div");
passwordContainer.className = "password-container";
formGroupPassword.appendChild(passwordContainer);

// Mover el input al contenedor
passwordContainer.appendChild(passwordInput);

// Crear el ícono para toggle de visibilidad
const togglePasswordIcon = document.createElement("span");
togglePasswordIcon.className = "toggle-password";
togglePasswordIcon.innerHTML = "&#128065;"; // Icono de ojo cerrado
passwordContainer.appendChild(togglePasswordIcon);

// Evento para mostrar/ocultar contraseña
togglePasswordIcon.addEventListener("click", () => {
  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    togglePasswordIcon.innerHTML = "&#128064;"; // Icono de ojo abierto
    togglePasswordIcon.style.color = "#8e44ad";
  } else {
    passwordInput.type = "password";
    togglePasswordIcon.innerHTML = "&#128065;";
    togglePasswordIcon.style.color = "#ccc";
  }
});

// --------------------------------------------------
// Validaciones en tiempo real de los inputs
// --------------------------------------------------
const emailInput = document.getElementById("email");
emailInput.addEventListener("input", () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  emailInput.style.borderColor = emailRegex.test(emailInput.value) ? "#8e44ad" : "#ff4d4f";
});

passwordInput.addEventListener("input", () => {
  passwordInput.style.borderColor = passwordInput.value.length >= 6 ? "#8e44ad" : "#ff4d4f";
});

// Asegurar consistencia en el estilo de los inputs
document.querySelectorAll(".form-group input").forEach((input) => {
  input.style.width = "100%";
  input.style.boxSizing = "border-box";
});
