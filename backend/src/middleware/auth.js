const { admin, db } = require("../config/firebase");

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutos

async function checkAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization || "";
        if (!authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ error: "No token provided" });
        }
        const idToken = authHeader.replace("Bearer ", "");

        // Verificar token con Firebase Admin
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // Revisar el campo "lastActivity" en tu colección Firestore
        const userDoc = await db.collection("userRoles").doc(uid).get();
        if (!userDoc.exists) {
            return res.status(401).json({ error: "User doc not found in Firestore" });
        }

        const userData = userDoc.data();
        const lastActivity = userData.lastActivity || 0;
        const now = Date.now();

        // Verificar si superó el tiempo inactivo
        if (now - lastActivity > INACTIVITY_LIMIT_MS) {
            return res.status(401).json({ error: "Session expired by inactivity" });
        }

        // Actualizar la última actividad
        await db.collection("userRoles").doc(uid).update({ lastActivity: now });

        // Guardar datos en req.user
        req.user = { uid, ...userData };
        next();
    } catch (error) {
        console.error("Error in checkAuth middleware:", error.message);
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}

// Middleware para verificar rol de admin
async function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
    }

    const role = req.user.rol;
    if (role !== 'admin' && role !== 'superadmin') {
        console.warn(`⚠️ Intento de acceso admin denegado para: ${req.user.uid}`);
        return res.status(403).json({ error: "Admin privileges required" });
    }

    next();
}

module.exports = { checkAuth, requireAdmin };
