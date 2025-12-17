const { enviarMensajeTelegram, enviarMensajeConBotones, enviarMensajeTelegramDirecto } = require("../services/telegramService");
const axios = require("axios");
const { db } = require("../config/firebase");
const { procesarConfirmacion, procesarRechazo } = require("./shiftController");

async function sendMessage(req, res) {
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
}

async function testMessage(req, res) {
    try {
        await enviarMensajeTelegram("Mensaje de prueba desde el servidor");
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Error al enviar mensaje de prueba" });
    }
}

async function handleWebhook(req, res) {
    try {
        const update = req.body;

        // Verificar si es un callback_query (respuesta de botón)
        if (update.callback_query) {
            const callbackQuery = update.callback_query;
            const data = callbackQuery.data;
            const chatId = callbackQuery.message.chat.id;
            const messageId = callbackQuery.message.message_id;

            console.log(`📩 Callback recibido: ${data} de chatId: ${chatId}`);

            let resultado;
            let respuestaMensaje;

            if (data.startsWith("confirmar_")) {
                const pendienteId = data.replace("confirmar_", "");
                resultado = await procesarConfirmacion(pendienteId, chatId);
                respuestaMensaje = resultado.success
                    ? `✅ *Turno Confirmado*\n\n¡Gracias ${resultado.empleado}! Tu turno como ${resultado.rol} ha sido registrado.`
                    : `⚠️ ${resultado.message}`;
            }
            else if (data.startsWith("rechazar_")) {
                const pendienteId = data.replace("rechazar_", "");
                resultado = await procesarRechazo(pendienteId, chatId);
                respuestaMensaje = resultado.success
                    ? (resultado.todosRechazaron
                        ? `📢 Entendido. Se ha notificado al administrador para asignación manual.`
                        : `👍 Entendido. Se ha contactado a ${resultado.siguienteEmpleado || 'otro compañero'}.`)
                    : `⚠️ ${resultado.message}`;
            }

            if (resultado) {
                // Editar mensaje original para quitar botones
                const BOT_TOKEN = process.env.BOT_TOKEN;
                try {
                    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
                        chat_id: chatId,
                        message_id: messageId,
                        text: respuestaMensaje || "Procesado",
                        parse_mode: "Markdown"
                    });

                    // Responder al callback
                    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
                        callback_query_id: callbackQuery.id,
                        text: resultado.success ? "✅ Registrado" : "⚠️ Error"
                    });
                } catch (apiError) {
                    console.error("Error calling Telegram API in webhook:", apiError.message);
                }
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error("Error en webhook de Telegram:", error);
        res.sendStatus(200); // Siempre responder 200 para evitar reintentos
    }
}

async function setupWebhook(req, res) {
    const BOT_TOKEN = process.env.BOT_TOKEN;
    // TODO: Make this URL configurable via env var
    const WEBHOOK_URL = `https://turnos-app-8viu.onrender.com/telegram-webhook`;

    try {
        const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
            url: WEBHOOK_URL
        });

        console.log("✅ Webhook de Telegram configurado:", response.data);
        res.json({ success: true, result: response.data });
    } catch (error) {
        console.error("❌ Error configurando webhook:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
}

async function webhookStatus(req, res) {
    const BOT_TOKEN = process.env.BOT_TOKEN;

    try {
        const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

module.exports = { sendMessage, testMessage, handleWebhook, setupWebhook, webhookStatus };
