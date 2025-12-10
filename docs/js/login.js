
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

    // 2) Obtener rol y estado en PARALELO para mayor velocidad
    const [userDoc, userStatusDoc] = await Promise.all([
      db.collection("userRoles").doc(user.uid).get(),
      db.collection("userStatus").doc(user.uid).get().catch(err => {
        console.warn("Error verificando estado:", err);
        return null; // Fallback seguro
      })
    ]);

    if (!userDoc.exists) {
      await auth.signOut();
      Swal.fire("Error", "No tienes un rol asignado. Contacta al administrador.", "error");
      return;
    }

    const userData = userDoc.data();
    const userRole = userData.rol;
    console.log("Rol del usuario:", userRole);

    // --- Verificación de Suspensión ---
    if (userStatusDoc && userStatusDoc.exists) {
      const statusData = userStatusDoc.data();
      if (statusData.suspended === true) {
        console.warn("Usuario suspendido:", user.email);
        await auth.signOut();
        let reason = statusData.suspendedReason || "Razón no especificada";

        if (typeof Swal !== 'undefined') {
          Swal.fire({
            icon: 'error',
            title: 'Cuenta Suspendida',
            text: reason,
            confirmButtonColor: '#3b82f6'
          });
        } else {
          alert("CUENTA SUSPENDIDA: " + reason);
        }
        return;
      }
    }

    // --- Verificación de Cambio de Contraseña ---
    if (userData.mustChangePassword === true) {
      window.location.href = "change-password.html";
      return;
    }

    // 3) Guardar log de inicio de sesión y ACTUALIZAR lastActivity (Critical for Backend Session)
    try {
      console.log("📝 Guardando log de sesión y actualizando lastActivity...");

      const now = Date.now();
      await Promise.all([
        db.collection("loginLogs").add({
          email: user.email,
          rol: userRole,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }),
        db.collection("userRoles").doc(user.uid).update({
          lastActivity: now,
          lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        })
      ]);

      console.log("✅ Log guardado y Session Timer reseteado.");
    } catch (logError) {
      // No bloqueamos el login si falla, pero es crítico saberlo
      console.error("⚠️ Error guardando log o actualizando lastActivity:", logError);
    }

    // 4) Redirigir después de guardar el log
    localStorage.setItem("userRole", userRole);
    window.location.href = "directorio.html";
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
