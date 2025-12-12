"use strict";

const auth = window.auth;
const db = window.db;

// Elementos del DOM
const emailInput = document.getElementById("recover-email");
const errorMessage = document.getElementById("error-message");
const successMessage = document.getElementById("success-message");
const spinner = document.getElementById("loading-spinner");

// Validación en tiempo real del correo
emailInput.addEventListener("input", () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  emailInput.style.borderColor = emailRegex.test(emailInput.value)
    ? "#4caf50"   // Verde para correo válido
    : "#ff5252";  // Rojo para correo inválido
});
// Manejo del envío del formulario
document.getElementById("recover-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim().toLowerCase();
  errorMessage.textContent = "";
  successMessage.textContent = "";
  spinner.style.display = "block";

  if (!email) {
    errorMessage.textContent = "Por favor, ingresa un correo válido.";
    spinner.style.display = "none";
    return;
  }

  try {
    await auth.sendPasswordResetEmail(email);
    spinner.style.display = "none";
    // Mensaje genérico que no revela si el email existe o no
    successMessage.textContent = "Si el correo está registrado, recibirás un enlace de recuperación.";

    // Redirige al login después de 5 segundos
    setTimeout(() => {
      window.location.href = "login.html";
    }, 5000);
  } catch (error) {
    spinner.style.display = "none";

    // SEGURIDAD: No revelar si el usuario existe o no
    // Siempre mostrar mensaje genérico para prevenir enumeración de usuarios
    if (error.code === "auth/user-not-found" ||
      error.code === "auth/invalid-email" ||
      error.code === "auth/too-many-requests") {
      // Mostrar el mismo mensaje de éxito para no revelar información
      successMessage.textContent = "Si el correo está registrado, recibirás un enlace de recuperación.";
      setTimeout(() => {
        window.location.href = "login.html";
      }, 5000);
    } else {
      errorMessage.textContent = "Ocurrió un error al procesar tu solicitud. Intenta nuevamente.";
    }
  }
});
