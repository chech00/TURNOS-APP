
"use strict";

const auth = window.auth;
const db = window.db;

// Manejo del inicio de sesión
document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();

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
      alert("No tienes un rol asignado. Contacta al administrador.");
      return;
    }

    const userData = userDoc.data();
    const userRole = userData.rol;
    console.log("Rol del usuario:", userRole);

    // 3) Guardar log de inicio de sesión en la colección "loginLogs"
    //    (Lo creas en Firestore con los campos: email, rol, timestamp)
    await db.collection("loginLogs").add({
      email: user.email,
      rol: userRole,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    console.log("Registro de login guardado en 'loginLogs'.");

    // 4) Redirigir según rol
    //    - superadmin => misma vista que admin (index.html), + menús extra
    //    - admin => index.html
    //    - user => user.html
    if (userRole === "admin" || userRole === "superadmin") {
      window.location.href = "index.html";
    } else {
      // Asumimos que el resto de roles => user.html
      window.location.href = "user.html";
      localStorage.setItem("lastPage", "user.html");
    }
  } catch (error) {
    console.error("Error en el inicio de sesión:", error.message);
    errorMessageElement.style.display = "block";
    switch (error.code) {
      case "auth/user-not-found":
        errorMessageElement.textContent = "El correo ingresado no está registrado.";
        break;
      case "auth/wrong-password":
        errorMessageElement.textContent = "La contraseña ingresada es incorrecta.";
        break;
      case "auth/invalid-email":
        errorMessageElement.textContent = "El formato del correo no es válido.";
        break;
      default:
        errorMessageElement.textContent =
          "Ocurrió un error inesperado. Por favor, intenta nuevamente.";
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
