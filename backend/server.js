require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const rateLimit = require("express-rate-limit");

// Firebase Admin
const admin = require("firebase-admin");

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
  try {
    serviceAccount = require("./serviceAccountKey.json");
    console.log("✅ Credenciales de Firebase cargadas desde archivo local");
  } catch (fileError) {
    console.error("❌ No se encontraron credenciales de Firebase.");
    console.error("   Configura la variable de entorno FIREBASE_CREDENTIALS con el JSON de las credenciales.");
    process.exit(1);
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// Supabase
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

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
  'http://127.0.0.1:5000'
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
// SEGURIDAD: Rate Limiting para prevenir ataques de fuerza bruta
// =============================================================================
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por ventana
  message: { error: "Demasiadas solicitudes, intenta de nuevo más tarde" },
  standardHeaders: true,
  legacyHeaders: false
});

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

// Aplicar rate limiter general a todas las rutas
app.use(generalLimiter);

// =============================================================================
// SEGURIDAD: Validación de tipos de archivo permitidos
// =============================================================================
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg', '.gif', '.txt', '.csv'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function validateFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

// Configurar Multer con límites de seguridad
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: (req, file, cb) => {
    if (!validateFileType(file.originalname)) {
      return cb(new Error(`Tipo de archivo no permitido. Extensiones válidas: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
    }
    cb(null, true);
  }
});

// =============================================================================
// MIDDLEWARE: Verificación de autenticación
// =============================================================================
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

// =============================================================================
// FUNCIÓN: Notificar a Telegram
// =============================================================================
async function enviarMensajeTelegram(mensaje) {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!BOT_TOKEN) {
    console.error("❌ BOT_TOKEN no configurado");
    return;
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    const usersSnapshot = await db.collection("usuarios").where("telegram_id", "!=", null).get();

    if (usersSnapshot.empty) {
      console.log("❌ No hay usuarios con Telegram ID en Firebase.");
      return;
    }

    for (const docItem of usersSnapshot.docs) {
      const chat_id = docItem.data().telegram_id;
      console.log(`📩 Enviando mensaje a: ${chat_id}`);

      try {
        const response = await axios.post(url, {
          chat_id,
          text: mensaje,
        });
        console.log(`✅ Mensaje enviado a ${chat_id}:`, response.data);
      } catch (error) {
        console.error(
          `❌ Error enviando mensaje a ${chat_id}:`,
          error.response ? error.response.data : error.message
        );
      }
    }
  } catch (error) {
    console.error("❌ Error obteniendo usuarios de Firebase:", error.message);
  }
}

// =============================================================================
// ENDPOINTS DE TELEGRAM (Protegidos)
// =============================================================================
app.post("/send-message", telegramLimiter, checkAuth, async (req, res) => {
  try {
    const { chatId, message } = req.body;
    if (!chatId || !message) {
      return res.status(400).json({ error: "Faltan datos (chatId o mensaje)." });
    }

    // Sanitizar el mensaje (evitar inyección)
    const sanitizedMessage = String(message).substring(0, 4000);

    const BOT_TOKEN = process.env.BOT_TOKEN;
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

    const response = await axios.post(url, {
      chat_id: chatId,
      text: sanitizedMessage,
    });

    console.log(`✅ Mensaje enviado a ${chatId} por: ${req.user.email || req.user.uid}`);
    res.json({ success: true, response: response.data });
  } catch (error) {
    console.error(`❌ Error enviando mensaje a ${req.body.chatId}:`, error.message);
    res.status(500).json({ error: "Error al enviar el mensaje a Telegram." });
  }
});

app.get("/prueba-telegram", checkAuth, requireAdmin, async (req, res) => {
  try {
    await enviarMensajeTelegram("Mensaje de prueba desde el servidor");
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Error al enviar mensaje de prueba" });
  }
});

// =============================================================================
// ENDPOINTS DE ARCHIVOS (Protegidos)
// =============================================================================

// SUBIR ARCHIVO - Requiere autenticación y ser admin
app.post("/upload", uploadLimiter, checkAuth, requireAdmin, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se ha seleccionado ningún archivo." });
    }

    // El fileFilter de multer ya valida el tipo, pero doble verificación
    if (!validateFileType(req.file.originalname)) {
      return res.status(400).json({
        error: `Tipo de archivo no permitido. Extensiones válidas: ${ALLOWED_EXTENSIONS.join(', ')}`
      });
    }

    // Nombre único (sanitizar nombre original)
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${Date.now()}-${safeName}`;

    // Subir a Supabase
    const { error } = await supabase.storage
      .from("documentos-noc")
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
      });

    if (error) throw error;

    // Obtener URL pública
    const { publicURL } = supabase.storage
      .from("documentos-noc")
      .getPublicUrl(fileName);

    // Notificar a Telegram
    await enviarMensajeTelegram(`📁 Nuevo archivo subido: ${fileName} por ${req.user.email || 'Admin'}`);

    console.log(`✅ Archivo subido: ${fileName} por ${req.user.email || req.user.uid}`);
    res.json({ success: true, url: publicURL, fileName });
  } catch (error) {
    console.error("❌ Error al subir archivo:", error);
    res.status(500).json({ error: "Error al subir el archivo." });
  }
});

// LISTAR ARCHIVOS - Solo requiere autenticación
app.get("/files", checkAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.storage.from("documentos-noc").list();
    if (error) throw error;

    const files = data.map((file) => ({
      name: file.name,
      url: `${process.env.SUPABASE_URL}/storage/v1/object/public/documentos-noc/${file.name}`,
    }));

    res.json(files);
  } catch (error) {
    console.error("❌ Error al obtener archivos:", error);
    res.status(500).json({ error: "Error al obtener archivos." });
  }
});

// ELIMINAR ARCHIVO - Requiere autenticación y ser admin
app.delete("/delete/:fileName", checkAuth, requireAdmin, async (req, res) => {
  try {
    const fileName = req.params.fileName;

    // Validar que el nombre no contenga path traversal
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return res.status(400).json({ error: "Nombre de archivo inválido" });
    }

    const { error } = await supabase.storage.from("documentos-noc").remove([fileName]);
    if (error) throw error;

    await enviarMensajeTelegram(`🗑️ Archivo eliminado: ${fileName} por ${req.user.email || 'Admin'}`);

    console.log(`✅ Archivo eliminado: ${fileName} por ${req.user.email || req.user.uid}`);
    res.json({ success: true, message: "Archivo eliminado correctamente." });
  } catch (error) {
    console.error("❌ Error al eliminar archivo:", error);
    res.status(500).json({ error: "Error al eliminar archivo." });
  }
});

// =============================================================================
// RUTAS PÚBLICAS Y DE HEALTH CHECK
// =============================================================================
app.get("/public", (req, res) => {
  res.json({ message: "Ruta pública, sin token." });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Ruta protegida de ejemplo
app.get("/privado", checkAuth, (req, res) => {
  res.json({
    message: "¡Acceso concedido a ruta privada!",
    userData: { uid: req.user.uid, email: req.user.email, rol: req.user.rol }
  });
});

// =============================================================================
// MANEJO DE ERRORES GLOBAL
// =============================================================================
app.use((err, req, res, next) => {
  console.error("Error no manejado:", err.message);

  // Error de Multer (archivo muy grande o tipo no permitido)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: `Archivo demasiado grande. Máximo: ${MAX_FILE_SIZE / 1024 / 1024} MB` });
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
// ASIGNACIÓN AUTOMÁTICA DE TURNOS (CRON JOB)
// =============================================================================
const cron = require("node-cron");

/**
 * Función principal que asigna turnos automáticamente
 * @param {boolean} isManualTrigger - Si es true, no verifica día/hora
 */
async function asignarTurnosAutomaticos(isManualTrigger = false) {
  console.log("🔄 Iniciando asignación automática de turnos...");

  try {
    // 1. Cargar empleados desde Firestore
    const configDoc = await db.collection("Config").doc("empleados_noc").get();
    if (!configDoc.exists) {
      console.error("❌ No se encontró configuración de empleados en Firestore");
      return { success: false, error: "Configuración de empleados no encontrada" };
    }

    const empleadosData = configDoc.data();
    const empleados = empleadosData.lista || [];

    // 2. Separar empleados por categoría
    const tecnicosRed = empleados.filter(e => e.categoria === "TecnicoRed").map(e => e.nombre);
    const ingenieros = empleados.filter(e => e.categoria === "Ingeniero").map(e => e.nombre);
    const plantaExterna = empleados.filter(e => e.categoria === "PlantaExterna").map(e => e.nombre);

    console.log(`📊 Empleados cargados: ${tecnicosRed.length} técnicos, ${ingenieros.length} ingenieros, ${plantaExterna.length} planta`);

    if (tecnicosRed.length === 0 || ingenieros.length === 0 || plantaExterna.length === 0) {
      console.error("❌ Faltan empleados en alguna categoría");
      return { success: false, error: "Faltan empleados en alguna categoría" };
    }

    // 3. Calcular semana actual del mes
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = hoy.getMonth();
    const primerDiaDelMes = new Date(año, mes, 1);
    const diaSemanaPrimerDia = primerDiaDelMes.getDay() === 0 ? 7 : primerDiaDelMes.getDay();
    const diaDelMes = hoy.getDate();
    const semanaIndex = Math.floor((diaDelMes + diaSemanaPrimerDia - 2) / 7);

    console.log(`📅 Año: ${año}, Mes: ${mes}, Semana: ${semanaIndex + 1}`);

    // 4. Verificar si ya existe asignación para esta semana
    const docId = `${año}-${mes}-${semanaIndex + 1}`;
    const existingDoc = await db.collection("AsignacionesSemanales").doc(docId).get();

    if (existingDoc.exists && !isManualTrigger) {
      console.log(`⚠️ Ya existe asignación para semana ${semanaIndex + 1}. Saltando.`);
      return { success: false, error: "Ya existe asignación para esta semana" };
    }

    // 5. Calcular la rotación (usando semanaIndex como offset)
    const tecnico = tecnicosRed[semanaIndex % tecnicosRed.length];
    const ingeniero = ingenieros[semanaIndex % ingenieros.length];
    const planta = plantaExterna[semanaIndex % plantaExterna.length];

    console.log(`👥 Asignación: Técnico=${tecnico}, Ingeniero=${ingeniero}, Planta=${planta}`);

    // 6. Calcular fechas de la semana
    const inicioSemana = new Date(año, mes, diaDelMes - hoy.getDay() + 1); // Lunes
    const finSemana = new Date(inicioSemana);
    finSemana.setDate(finSemana.getDate() + 6); // Domingo

    const formatFecha = (d) => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // 7. Guardar en Firestore
    await db.collection("AsignacionesSemanales").doc(docId).set({
      tecnico,
      ingeniero,
      planta,
      semana: semanaIndex + 1,
      año,
      mes,
      fechaInicio: formatFecha(inicioSemana),
      fechaFin: formatFecha(finSemana),
      creadoAutomaticamente: true,
      fechaCreacion: new Date().toISOString()
    });

    console.log(`✅ Asignación guardada en Firestore: ${docId}`);

    // 8. Enviar notificaciones por Telegram
    const mensajeBase = `📅 *Asignación de Turno Semanal*\n\nSemana ${semanaIndex + 1} (${formatFecha(inicioSemana)} - ${formatFecha(finSemana)})\n\n👷 Técnico: ${tecnico}\n👨‍💼 Ingeniero: ${ingeniero}\n🏭 Planta: ${planta}`;

    // Cargar chat IDs de empleados
    const usuariosSnapshot = await db.collection("usuarios").get();
    const chatIds = {};
    usuariosSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.telegram_id && data.nombre) {
        chatIds[data.nombre] = data.telegram_id;
      }
    });

    // Enviar a los asignados
    const destinatarios = [tecnico, ingeniero, planta];
    for (const nombre of destinatarios) {
      if (chatIds[nombre]) {
        await enviarMensajeTelegramDirecto(chatIds[nombre], `Hola ${nombre}, ${mensajeBase}`);
      }
    }

    // Cargar y notificar a contactos adicionales
    const contactosSnapshot = await db.collection("ContactosAdicionales").get();
    for (const doc of contactosSnapshot.docs) {
      const chatId = doc.data().chatId;
      if (chatId) {
        await enviarMensajeTelegramDirecto(chatId, mensajeBase);
      }
    }

    console.log("✅ Notificaciones de Telegram enviadas");

    return {
      success: true,
      asignacion: { tecnico, ingeniero, planta, semana: semanaIndex + 1 }
    };

  } catch (error) {
    console.error("❌ Error en asignación automática:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Envía mensaje directo a un chat de Telegram
 */
async function enviarMensajeTelegramDirecto(chatId, mensaje) {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!BOT_TOKEN) return;

  try {
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: mensaje,
      parse_mode: "Markdown"
    });
  } catch (error) {
    console.error(`Error enviando Telegram a ${chatId}:`, error.message);
  }
}

// ⏰ CRON JOB: Martes a las 17:15 (MODO PRUEBA)
// Cambiar a '0 9 * * 1' para producción (Lunes 9:00 AM)
cron.schedule('15 17 * * 2', async () => {
  console.log("⏰ Cron job ejecutándose: Asignación automática de turnos");
  await asignarTurnosAutomaticos(false);
}, {
  timezone: "America/Santiago"
});

console.log("✅ Cron job de turnos configurado para MARTES 17:15 (Chile) - MODO PRUEBA");

// Endpoint para disparar manualmente (solo admin autenticado)
app.post("/trigger-assignment", checkAuth, requireAdmin, async (req, res) => {
  console.log(`🔧 Asignación manual disparada por: ${req.user.email || req.user.uid}`);
  const result = await asignarTurnosAutomaticos(true);
  res.json(result);
});

// Endpoint público para verificar estado del cron (health check)
app.get("/cron-status", (req, res) => {
  res.json({
    cronConfigured: true,
    schedule: "Martes 17:15 (PRUEBA)",
    productionSchedule: "Lunes 9:00 AM",
    timezone: "America/Santiago"
  });
});

// =============================================================================
// INICIAR SERVIDOR
// =============================================================================
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`🔒 CORS configurado para: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`📁 Tipos de archivo permitidos: ${ALLOWED_EXTENSIONS.join(', ')}`);
});
