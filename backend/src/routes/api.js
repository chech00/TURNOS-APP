const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const { checkAuth, requireAdmin } = require("../middleware/auth");
const { upload } = require("../middleware/upload");

const shiftController = require("../controllers/shiftController");
const fileController = require("../controllers/fileController");
const telegramController = require("../controllers/telegramController");
const emailController = require("../controllers/emailController");
const uptimeController = require("../controllers/uptimeController");

// Rate Limiters
const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 20, // máximo 20 uploads por hora
    message: { error: "Límite de subidas alcanzado, intenta más tarde" }
});

const telegramLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 10, // máximo 10 mensajes por minuto
    message: { error: "Límite de mensajes alcanzado" }
});

const emailLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 5, // máximo 5 correos por minuto
    message: { error: "Límite de correos alcanzado, espera un momento" }
});

// --- Email Routes ---
router.post("/send-email", emailLimiter, checkAuth, emailController.sendEmail);

// --- Telegram Routes ---
router.post("/send-message", telegramLimiter, checkAuth, telegramController.sendMessage);
router.get("/prueba-telegram", checkAuth, requireAdmin, telegramController.testMessage);
router.post("/telegram-webhook", telegramController.handleWebhook);
router.get("/setup-telegram-webhook", telegramController.setupWebhook);
router.get("/webhook-status", telegramController.webhookStatus);

// --- File Routes ---
router.post("/upload", uploadLimiter, checkAuth, requireAdmin, upload.single("file"), fileController.uploadFile);
router.get("/files", checkAuth, fileController.listFiles);
router.delete("/delete/:fileName", checkAuth, requireAdmin, fileController.deleteFile);

// --- Turn/Shift Routes ---
// Note: original was /trigger-assignment
router.post("/trigger-assignment", checkAuth, requireAdmin, shiftController.triggerAssignment);
router.get("/test-assignment", shiftController.testAssignment); // Check if this should be protected or removed (it was temporary)
router.get("/cron-status", (req, res) => {
    res.json({
        cronConfigured: true,
        schedule: "Martes 17:15 (PRUEBA)",
        productionSchedule: "Lunes 9:00 AM",
        timezone: "America/Santiago"
    });
});

// --- Uptime Routes (Bypass Firestore Rules) ---
router.post("/uptime/create", checkAuth, uptimeController.createIncident);
router.put("/uptime/:id", checkAuth, uptimeController.updateIncident);
router.get("/uptime/last", checkAuth, uptimeController.getLastIncident);
router.post("/uptime/:id/close", checkAuth, uptimeController.closeIncident);
router.get("/uptime/list", checkAuth, uptimeController.getIncidents);
router.get("/uptime/nodes", checkAuth, uptimeController.getNodes);
router.get("/uptime/search-data", checkAuth, uptimeController.getNodesWithPons);

// New optimized endpoints
router.get("/uptime/summary", checkAuth, uptimeController.getMonthlySummary);
router.get("/uptime/paginated", checkAuth, uptimeController.getListPaginated);
router.get("/uptime/live", checkAuth, uptimeController.getLiveStatus); // New Live Lab Endpoint

// --- Other Routes ---
// "public" route
router.get("/public", (req, res) => {
    res.json({ message: "Ruta pública, sin token." });
});

// "health" route - duplicated here or at root? Let's put it here too or let root handle it.
router.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// "privado" route
router.get("/privado", checkAuth, (req, res) => {
    res.json({
        message: "¡Acceso concedido a ruta privada!",
        userData: { uid: req.user.uid, email: req.user.email, rol: req.user.rol }
    });
});

module.exports = router;
