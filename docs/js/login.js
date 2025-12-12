
"use strict";

const auth = window.auth;
const db = window.db;

// Manejo del inicio de sesión
document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  // DEBUG logs removed for production security

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const errorMessageElement = document.getElementById("error-message");

  try {
    // 1) Autenticar con Firebase
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const user = userCredential.user;
    // User authenticated successfully

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
    // Role verified

    // --- Verificación de Suspensión ---
    if (userStatusDoc && userStatusDoc.exists) {
      const statusData = userStatusDoc.data();
      if (statusData.suspended === true) {
        // User suspended - blocking access
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
      // Saving login log

      const now = Date.now();
      await Promise.all([
        db.collection("loginLogs").add({
          email: user.email,
          rol: userRole,
          authProvider: "email",
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }),
        db.collection("userRoles").doc(user.uid).update({
          lastActivity: now,
          lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        })
      ]);

      // Login log saved
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

    // === SMART ERROR HANDLING FOR GOOGLE LINKED ACCOUNTS ===
    if (errorCode === "auth/wrong-password" || errorCode === "auth/invalid-login-credentials" || errorCode === "auth/user-not-found") {
      try {
        // Check what providers are linked to this email
        const methods = await auth.fetchSignInMethodsForEmail(email);
        // Check sign-in methods for this email

        const hasGoogle = methods.includes("google.com");
        const hasPassword = methods.includes("password");

        // Case 1: Account exists with Google but NO password (replaced by Google)
        // This is the common confusion point for the user
        if (hasGoogle && !hasPassword) {
          Swal.fire({
            icon: 'info',
            title: 'Cuenta verificada con Google',
            html: `
              <p>Tu cuenta está vinculada a Google.</p>
              <ul style="text-align: left; margin-top: 10px; font-size: 0.9em; color: #555;">
                <li>Para entrar ahora, usa el botón <strong>"Continuar con Google"</strong>.</li>
                <br>
                <li>Si prefieres usar una clave manual, haz clic en <strong>"¿Olvidaste tu contraseña?"</strong> para crear una nueva.</li>
              </ul>
            `,
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#7796CB'
          });
          return; // Stop here, don't show generic error
        }

        // Case 2: Account has Google AND Password, but password failed
        if (hasGoogle && hasPassword) {
          // Let it fall through to generic error, OR give a hint
          // Currently falling through to "Usuario o contraseña incorrectos" is standard security practice,
          // but we can be helpful if we want. Let's stick to standard for mismatched password.
        }

        // Case 3: Only Google (should be covered by Case 1 logically if !hasPassword)

      } catch (methodError) {
        console.error("Error verificando métodos de inicio:", methodError);
        // Fallback to standard error if this check fails
      }
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
// Google Sign-In
// --------------------------------------------------
const googleLoginBtn = document.getElementById("google-login-btn");
if (googleLoginBtn) {
  googleLoginBtn.addEventListener("click", async () => {
    // Starting Google Sign-In
    const provider = new firebase.auth.GoogleAuthProvider();

    // Request Gmail send permission to allow sending emails from user's account
    provider.addScope('https://www.googleapis.com/auth/gmail.send');

    try {
      const result = await auth.signInWithPopup(provider);

      // Get OAuth access token for Gmail API
      const credential = result.credential;
      const googleAccessToken = credential?.accessToken || null;
      // Gmail access token obtained
      const user = result.user;
      // Google user authenticated

      // Domain restriction - only @patagoniaip.cl allowed (with exceptions)
      const allowedDomain = "@patagoniaip.cl";
      const allowedEmails = [
        "sergio.cb87@gmail.com" // Superadmin de pruebas
      ];

      const emailLower = user.email.toLowerCase();
      const isDomainAllowed = emailLower.endsWith(allowedDomain);
      const isWhitelisted = allowedEmails.includes(emailLower);

      if (!isDomainAllowed && !isWhitelisted) {
        console.warn("Dominio no permitido:", user.email);
        await auth.signOut();
        Swal.fire({
          icon: 'error',
          title: 'Dominio no permitido',
          html: `Solo se permite el acceso con cuentas <strong>@patagoniaip.cl</strong>.<br><br>Tu cuenta: ${user.email}`,
          confirmButtonColor: '#7796CB'
        });
        return;
      }

      // First, check if user exists by UID (already linked to Google)
      let userDoc = await db.collection("userRoles").doc(user.uid).get();
      let existingDocId = null;
      let needsMigration = false;

      if (!userDoc.exists) {
        // User doesn't exist by UID, search by EMAIL (manual account)
        console.log("🔍 Buscando cuenta existente por email...");
        const querySnapshot = await db.collection("userRoles")
          .where("email", "==", user.email)
          .limit(1)
          .get();

        if (querySnapshot.empty) {
          // User not registered in the system - REJECT
          console.warn("Usuario no registrado en el sistema:", user.email);
          await auth.signOut();
          Swal.fire({
            icon: 'warning',
            title: 'Usuario no registrado',
            html: `El correo <strong>${user.email}</strong> no está registrado en el sistema.<br><br>Contacta al administrador para obtener acceso.`,
            confirmButtonColor: '#7796CB'
          });
          return;
        }

        // User found by email - need to migrate to Google UID
        existingDocId = querySnapshot.docs[0].id;
        userDoc = querySnapshot.docs[0];
        needsMigration = true;
        console.log("✅ Cuenta encontrada por email, documento antiguo:", existingDocId);
      }

      const userData = userDoc.data();
      const userRole = userData.rol;

      // === ACCOUNT LINKING: Migrate manual account to Google UID ===
      if (needsMigration && existingDocId && existingDocId !== user.uid) {
        console.log("🔗 Iniciando migración de cuenta a Google UID...");

        try {
          // Prepare migrated data
          const migratedData = {
            ...userData,
            googleLinked: true,
            googleLinkedAt: firebase.firestore.FieldValue.serverTimestamp(),
            previousUid: existingDocId // Keep reference for audit
          };

          // Use batch write for atomicity
          const batch = db.batch();

          // 1. Create new document with Google UID
          batch.set(db.collection("userRoles").doc(user.uid), migratedData);

          // 2. Delete old document
          batch.delete(db.collection("userRoles").doc(existingDocId));

          // 3. Migrate userStatus if exists
          const oldStatusDoc = await db.collection("userStatus").doc(existingDocId).get();
          if (oldStatusDoc.exists) {
            batch.set(db.collection("userStatus").doc(user.uid), oldStatusDoc.data());
            batch.delete(db.collection("userStatus").doc(existingDocId));
          }

          await batch.commit();
          console.log("✅ Cuenta migrada exitosamente al UID de Google:", user.uid);

          // === AUTOMÁTICAMENTE ENVIAR EMAIL PARA PRESERVAR AMBOS MÉTODOS ===
          // Cuando se vincula con Google, Firebase elimina el proveedor de contraseña.
          // Enviamos automáticamente un email de reset para que el usuario pueda
          // re-establecer su contraseña y usar AMBOS métodos.
          try {
            await auth.sendPasswordResetEmail(user.email);
            console.log("📧 Email de reset enviado para preservar método de contraseña");

            // Guardar flag para mostrar notificación después del redirect
            localStorage.setItem('showPasswordPreservationNotice', 'true');
            localStorage.setItem('passwordPreservationEmail', user.email);
          } catch (resetError) {
            console.warn("No se pudo enviar email de reset:", resetError);
          }

        } catch (migrationError) {
          console.error("⚠️ Error en migración (login continúa):", migrationError);
          // Don't block login if migration fails - user can still use the system
        }
      }

      // Check suspension
      const userStatusDoc = await db.collection("userStatus").doc(user.uid).get().catch(() => null);
      if (userStatusDoc && userStatusDoc.exists && userStatusDoc.data().suspended === true) {
        await auth.signOut();
        Swal.fire({
          icon: 'error',
          title: 'Cuenta Suspendida',
          text: userStatusDoc.data().suspendedReason || "Contacta al administrador.",
          confirmButtonColor: '#3b82f6'
        });
        return;
      }

      // Log login and save Gmail access token
      const now = Date.now();
      const updateData = {
        lastActivity: now,
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
      };

      // Save Gmail access token if available (for sending emails)
      if (googleAccessToken) {
        updateData.gmailAccessToken = googleAccessToken;
        updateData.gmailTokenUpdatedAt = firebase.firestore.FieldValue.serverTimestamp();
        console.log("💾 Gmail access token guardado en Firestore");
      }

      await Promise.all([
        db.collection("loginLogs").add({
          email: user.email,
          rol: userRole,
          authProvider: "google",
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }),
        db.collection("userRoles").doc(user.uid).update(updateData)
      ]);

      localStorage.setItem("userRole", userRole);
      window.location.href = "directorio.html";
    } catch (error) {
      console.error("Error en Google Sign-In:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        console.log("Usuario cerró el popup");
      } else if (error.code === 'auth/cancelled-popup-request') {
        console.log("Popup cancelado");
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error de autenticación',
          text: 'No se pudo iniciar sesión con Google. Intenta de nuevo.',
          confirmButtonColor: '#3b82f6'
        });
      }
    }
  });
}

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
