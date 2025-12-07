// Importar Firebase desde la CDN (Asegurar que está bien cargado)
import "https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js";
import "https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js";
import "https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyB3shQDdWq--FxY7Q6-of9xkEXg5XWjJWM",
    authDomain: "asignacionturnos-cc578.firebaseapp.com",
    projectId: "asignacionturnos-cc578",
    storageBucket: "asignacionturnos-cc578.firebasestorage.app",
    messagingSenderId: "267782898691",
    appId: "1:267782898691:web:751f881080a7debd67fa36"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
window.secondaryAuth = secondaryApp.auth();

window.auth = auth;
window.db = db;

export { auth, db };
