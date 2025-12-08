console.log("[DEBUG] firebase.js - Script starting...");
// Importar Firebase desde la CDN (Cargado en HTML para globals)
// import "https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js";
// import "https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js";
// import "https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js";
// import "https://www.gstatic.com/firebasejs/8.10.1/firebase-storage.js";

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

console.log("Firebase initialized. Auth:", !!window.auth, "DB:", !!window.db, "Secondary:", !!window.secondaryAuth);

// Export for ES6 modules (needed by script.js)
export { auth, db };
