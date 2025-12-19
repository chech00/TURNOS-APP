require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const cron = require("node-cron");
const path = require("path");

// Import Routes and Controllers
// Nota: Ajustamos el path relative porque server.js está en la raíz de backend/
const apiRoutes = require("./src/routes/api");
const { asignarTurnosAutomaticos } = require("./src/controllers/shiftController");
const uptimeController = require("./src/controllers/uptimeController"); // Importar para Sync inicial

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================================================
// SEGURIDAD: Configuración de CORS restrictiva
// =============================================================================
const ALLOWED_ORIGINS = [
  'https://asignacionturnos-cc578.web.app',
  'https://asignacionturnos-cc578.firebaseapp.com',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:5500', // Live Server Default
  'http://localhost:5500', // Live Server Alternative
  'http://127.0.0.1:8080', // http-server
  'http://localhost:8080', // http-server
  'https://chech00.github.io', // GitHub Pages Production
  'https://turnos-patagoniaip.loca.lt', // Localtunnel Frontend
  'https://turnos-backend.loca.lt', // Localtunnel Backend (planned)
  'https://mighty-horse-96.loca.lt' // Localtunnel Backend (actual)
];

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sin origin (como apps móviles o Postman en desarrollo)
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS bloqueado para origen: ${origin}`);
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(express.json());
app.use(cors(corsOptions));

// =============================================================================
// SEGURIDAD: Rate Limiting Global
// =============================================================================
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 500, // máximo 500 requests por ventana (aumentado para desarrollo)
  message: { error: "Demasiadas solicitudes, intenta de nuevo más tarde" },
  standardHeaders: true,
  legacyHeaders: false
});

// Aplicar rate limiter general a todas las rutas
app.use(generalLimiter);

// =============================================================================
// RUTAS
// =============================================================================
app.use("/", apiRoutes);

// =============================================================================
// MANEJO DE ERRORES GLOBAL
// =============================================================================
app.use((err, req, res, next) => {
  console.error("Error no manejado:", err.message);

  // Error de Multer (archivo muy grande o tipo no permitido)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: `Archivo demasiado grande.` });
  }

  if (err.message.includes('Tipo de archivo no permitido')) {
    return res.status(400).json({ error: err.message });
  }

  if (err.message === 'No permitido por CORS') {
    return res.status(403).json({ error: "Origen no permitido" });
  }

  res.status(500).json({ error: "Error interno del servidor" });
});

// =============================================================================
// CRON JOBS
// =============================================================================
// ⏰ Martes a las 17:15 (MODO PRUEBA)
// Cambiar a '0 9 * * 1' para producción (Lunes 9:00 AM)
cron.schedule('15 17 * * 2', async () => {
  console.log("⏰ Cron job ejecutándose: Asignación automática de turnos");
  await asignarTurnosAutomaticos(false);
}, {
  timezone: "America/Santiago"
});

console.log("✅ Cron job de turnos configurado para MARTES 17:15 (Chile) - MODO PRUEBA");

// =============================================================================
// INICIAR SERVIDOR
// =============================================================================
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`🔒 CORS configurado para: ${ALLOWED_ORIGINS.join(', ')}`);

  // Iniciar sincronización de topología (Cache Pasivo)
  uptimeController.syncDudeDevices().catch(err => console.error("Error en sync inicial:", err));
});
