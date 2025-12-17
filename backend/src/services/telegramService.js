const axios = require("axios");
const { db } = require("../config/firebase");

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

/**
 * Envía mensaje con botones de confirmación (Sí/No)
 */
async function enviarMensajeConBotones(chatId, mensaje, callbackData) {
    const BOT_TOKEN = process.env.BOT_TOKEN;
    if (!BOT_TOKEN) {
        console.error("❌ BOT_TOKEN no configurado");
        return false;
    }

    try {
        const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: mensaje,
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "✅ Sí, confirmo", callback_data: `confirmar_${callbackData}` },
                        { text: "❌ No puedo", callback_data: `rechazar_${callbackData}` }
                    ]
                ]
            }
        });
        console.log(`📱 Mensaje con botones enviado a chatId: ${chatId}`);
        return response.data.result.message_id;
    } catch (error) {
        console.error(`Error enviando mensaje con botones:`, error.message);
        return false;
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

module.exports = { enviarMensajeTelegram, enviarMensajeConBotones, enviarMensajeTelegramDirecto };
