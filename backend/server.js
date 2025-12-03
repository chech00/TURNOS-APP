require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const axios = require("axios");

// Firebase Admin
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// Supabase
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// Configurar Multer para subir archivos a memoria
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ─────────────────────────────────────────────────────────────────────────────
// 1) INACTIVIDAD (Firebase) - MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // Ej. 30 minutos

async function checkAuth(req, res, next) {
  try {
    // Leer token de la cabecera "Authorization: Bearer <token>"
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

    // Actualizar la última actividad para reiniciar el "cronómetro"
    await db.collection("userRoles").doc(uid).update({ lastActivity: now });

    // Guardar datos en req.user si necesitas
    req.user = { uid, ...userData };
    next();
  } catch (error) {
    console.error("Error in checkAuth middleware:", error.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) NOTIFICAR A TELEGRAM
// ─────────────────────────────────────────────────────────────────────────────
async function enviarMensajeTelegram(mensaje) {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    // Ajusta "usuarios" por la colección donde guardas telegram_id
    const usersSnapshot = await db.collection("usuarios").where("telegram_id", "!=", null).get();

    if (usersSnapshot.empty) {
      console.log("❌ No hay usuarios con Telegram ID en Firebase.");
      return;
    }

    // Enviar mensaje a cada usuario con telegram_id
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

// ─────────────────────────────────────────────────────────────────────────────
// 3) ENDPOINTS DE TELEGRAM
// ─────────────────────────────────────────────────────────────────────────────
app.post("/send-message", async (req, res) => {
  try {
    const { chatId, message } = req.body;
    if (!chatId || !message) {
      return res.status(400).json({ error: "Faltan datos (chatId o mensaje)." });
    }

    const BOT_TOKEN = process.env.BOT_TOKEN;
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

    const response = await axios.post(url, {
      chat_id: chatId,
      text: message,
    });

    console.log(`✅ Mensaje enviado a ${chatId}:`, response.data);
    res.json({ success: true, response: response.data });
  } catch (error) {
    console.error(`❌ Error enviando mensaje a ${req.body.chatId}:`, error.message);
    res.status(500).json({ error: "Error al enviar el mensaje a Telegram." });
  }
});

app.get("/prueba-telegram", async (req, res) => {
  try {
    await enviarMensajeTelegram("Mensaje de prueba desde el servidor");
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Error al enviar mensaje de prueba" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4) SUBIDA, LISTA Y ELIMINACIÓN DE ARCHIVOS (SUPABASE)
// ─────────────────────────────────────────────────────────────────────────────
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se ha seleccionado ningún archivo." });
    }

    // Nombre único
    const fileName = `${Date.now()}-${req.file.originalname}`;

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
    await enviarMensajeTelegram(`Nuevo archivo subido: ${fileName}`);

    res.json({ success: true, url: publicURL, fileName });
  } catch (error) {
    console.error("❌ Error al subir archivo:", error);
    res.status(500).json({ error: "Error al subir el archivo." });
  }
});

app.get("/files", async (req, res) => {
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

app.delete("/delete/:fileName", async (req, res) => {
  try {
    const fileName = req.params.fileName;
    const { error } = await supabase.storage.from("documentos-noc").remove([fileName]);
    if (error) throw error;

    await enviarMensajeTelegram(`Archivo eliminado: ${fileName}`);
    res.json({ success: true, message: "Archivo eliminado correctamente." });
  } catch (error) {
    console.error("❌ Error al eliminar archivo:", error);
    res.status(500).json({ error: "Error al eliminar archivo." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5) RUTAS DE EJEMPLO (PROTEGIDAS Y NO PROTEGIDAS)
// ─────────────────────────────────────────────────────────────────────────────
app.get("/public", (req, res) => {
  res.json({ message: "Ruta pública, sin token." });
});

// Ruta protegida: requiere que el token sea válido y no haya inactividad
app.get("/privado", checkAuth, (req, res) => {
  res.json({
    message: "¡Acceso concedido a ruta privada!",
    userData: req.user,
  });
});

// Simular login: (actualiza lastActivity)
app.post("/fake-login/:uid", async (req, res) => {
  const { uid } = req.params;
  const now = Date.now();

  // En tu frontend real, esto se hace tras Firebase Auth signIn.
  // Aquí es solo para que la "sesión" arranque con lastActivity.
  await db.collection("userRoles").doc(uid).set(
    { lastActivity: now },
    { merge: true }
  );

  res.json({ message: `Fake login para uid=${uid}`, time: now });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6) INICIAR SERVIDOR
// ─────────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});


