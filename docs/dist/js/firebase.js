// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyB3shQDdWq--FxY7Q6-of9xkEXg5XWjJWM",
    authDomain: "asignacionturnos-cc578.firebaseapp.com",
    projectId: "asignacionturnos-cc578",
    storageBucket: "asignacionturnos-cc578.firebasestorage.app",
    messagingSenderId: "267782898691",
    appId: "1:267782898691:web:751f881080a7debd67fa36"
};

// Inicializar Default App (si no existe)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// ============================================
// APP CHECK - Protección contra scripts externos
// Solo activar en producción, no en localhost
// ============================================
const RECAPTCHA_SITE_KEY = '6LdmGSksAAAAAEcTsJlQcdufbkvmBE43sojkfyiM';
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Solo activar App Check en producción (no en localhost)
if (!isLocalhost && typeof firebase.appCheck === 'function') {
    try {
        const appCheck = firebase.appCheck();
        appCheck.activate(RECAPTCHA_SITE_KEY, true);
    } catch (e) {
        // App Check no disponible o error - continuar sin él
    }
}

// Inicializar Secondary App (para crear usuarios sin cerrar sesión)
let secondaryApp;
try {
    secondaryApp = firebase.app("Secondary");
} catch (e) {
    secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
}

window.secondaryAuth = secondaryApp.auth();
window.auth = auth;
window.db = db;

// Export for ES6 modules (needed by script.js)
export { auth, db };

