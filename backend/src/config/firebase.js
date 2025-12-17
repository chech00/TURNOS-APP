const admin = require("firebase-admin");
const path = require("path");

// En producción, usar variables de entorno; en desarrollo, usar archivo JSON
let serviceAccount;

// Intentar cargar credenciales desde diferentes variables de entorno
const credentialsEnvVar = process.env.FIREBASE_CREDENTIALS ||
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env["serviceAccountKey.json"];

if (credentialsEnvVar) {
    try {
        // Producción: credenciales desde variable de entorno (JSON string)
        serviceAccount = JSON.parse(credentialsEnvVar);
        console.log("✅ Credenciales de Firebase cargadas desde variable de entorno");
    } catch (parseError) {
        console.error("❌ Error al parsear credenciales de Firebase:", parseError.message);
        console.error("   Asegúrate de que el valor sea un JSON válido");
        process.exit(1);
    }
} else {
    // Desarrollo local: intentar usar archivo JSON
    // Nota: Ajustamos el path porque ahora estamos en src/config/
    try {
        // Subir dos niveles para llegar a backend/
        serviceAccount = require("../../serviceAccountKey.json");
        console.log("✅ Credenciales de Firebase cargadas desde archivo local");
    } catch (fileError) {
        console.warn("⚠️ Advertencia: No se encontró serviceAccountKey.json en backend/.");
        console.warn("   Esto es normal si estás usando variables de entorno o si el archivo no existe en local.");
        // No salimos del proceso aquí para permitir que server.js maneje el error si es crítico, 
        // pero idealmente deberíamos manejarlo aquí o dejar que admin.credential falle.
        // Sin embargo, para mantener compatibilidad con la lógica original, intentaremos seguir.
        // O mejor, lanzamos el error o salimos si es crítico para la inicialización.
        // En el original: process.exit(1)
        console.error("❌ Error fatal: No se encontraron credenciales de Firebase.");
        console.error("   Configura la variable de entorno FIREBASE_CREDENTIALS o restaura serviceAccountKey.json");
        process.exit(1);
    }
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

module.exports = { admin, db };
