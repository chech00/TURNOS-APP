import "./firebase.js";

const auth = window.auth;
const db = window.db;

// Referencias al DOM
const changePasswordForm = document.getElementById("change-password-form");
const currentPasswordInput = document.getElementById("current-password");
const newPasswordInput = document.getElementById("new-password");
const confirmPasswordInput = document.getElementById("confirm-password");
const errorMessageElement = document.getElementById("error-message");

// Validar que el usuario esté autenticado
auth.onAuthStateChanged((user) => {
  if (!user) {
    // Si no hay usuario, volver al login
    window.location.href = "login.html";
  }
});

changePasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const currentPassword = currentPasswordInput.value;
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  // Limpiar mensajes
  errorMessageElement.style.display = "none";
  errorMessageElement.textContent = "";

  // 1. Validar coincidencia
  if (newPassword !== confirmPassword) {
    showError("Las contraseñas nuevas no coinciden.");
    return;
  }

  // 2. Validar fortaleza de la contraseña (Granular)
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasLowerCase = /[a-z]/.test(newPassword);
  const hasNumbers = /\d/.test(newPassword);

  if (newPassword.length < minLength) {
    showError(`La contraseña debe tener al menos ${minLength} caracteres.`);
    return;
  }
  if (!hasUpperCase) {
    showError("La contraseña debe incluir al menos una letra mayúscula.");
    return;
  }
  if (!hasLowerCase) {
    showError("La contraseña debe incluir al menos una letra minúscula.");
    return;
  }
  if (!hasNumbers) {
    showError("La contraseña debe incluir al menos un número.");
    return;
  }

  // Validar que la nueva contraseña no sea igual a la actual
  if (newPassword === currentPassword) {
    showError("La nueva contraseña no puede ser igual a la actual.");
    return;
  }

  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No hay usuario autenticado.");

    // 3. Re-autenticar al usuario (Seguridad extra solicitada)
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
    await user.reauthenticateWithCredential(credential);
    console.log("Re-autenticación exitosa.");

    // 4. Actualizar contraseña en Firebase Auth
    await user.updatePassword(newPassword);
    console.log("Contraseña actualizada en Auth.");

    // 4. Actualizar flag en Firestore (mustChangePassword: false)
    await db.collection("userRoles").doc(user.uid).update({
      mustChangePassword: false
    });
    console.log("Flag mustChangePassword actualizado a false.");

    // 5. Redirigir según rol (reutilizamos lógica básica o leemos de nuevo)
    const userDoc = await db.collection("userRoles").doc(user.uid).get();
    const userData = userDoc.data();
    const userRole = userData.rol;

    // 5. Notificación Exitosa con SweetAlert2
    await Swal.fire({
      title: '¡Contraseña Actualizada!',
      text: 'Tu clave ha sido modificada correctamente. Por favor, inicia sesión con tu nueva contraseña.',
      icon: 'success',
      background: '#1f2937', // Color oscuro (gray-800)
      color: '#ffffff',
      confirmButtonColor: '#2563eb', // Azul primario
      confirmButtonText: 'Ir al Login',
      allowOutsideClick: false
    });

    // 6. Cerrar sesión y redirigir al login
    await auth.signOut();
    window.location.href = "login.html";

  } catch (error) {
    console.error("Error al actualizar contraseña:", error);

    // Manejo de errores específicos de Firebase y API
    let errorCode = error.code;
    let errorMessage = error.message;

    // A veces el error viene como un objeto JSON dentro del mensaje
    if (errorMessage && errorMessage.includes("INVALID_LOGIN_CREDENTIALS")) {
      errorCode = 'auth/wrong-password';
    }

    if (errorCode === 'auth/wrong-password' || errorCode === 'auth/invalid-login-credentials') {
      showError("La contraseña actual ingresada es incorrecta.");
    } else if (errorCode === 'auth/requires-recent-login') {
      showError("Por seguridad, debes volver a iniciar sesión antes de cambiar tu clave.");
    } else if (errorCode === 'auth/too-many-requests') {
      showError("Demasiados intentos fallidos. Intenta más tarde.");
    } else {
      // Intentar limpiar el mensaje si es un JSON feo
      try {
        const parsed = JSON.parse(errorMessage);
        if (parsed.error && parsed.error.message) {
          errorMessage = parsed.error.message;
        }
      } catch (e) {
        // No es JSON, usar el mensaje tal cual
      }
      showError("Error: " + errorMessage);
    }
  }
});

function showError(msg) {
  errorMessageElement.textContent = msg;
  errorMessageElement.style.display = "block";
}
