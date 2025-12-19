const { admin, db } = require("../config/firebase");

/**
 * POST /api/send-email
 * Sends email using Gmail API from the logged-in user's account
 * Body: { to: string[], subject: string, html: string }
 */
const sendEmail = async (req, res) => {
    try {
        const { to, bcc, subject, html } = req.body;
        const userUid = req.user?.uid;

        // Validate required fields
        if ((!to || to.length === 0) && (!bcc || bcc.length === 0)) {
            return res.status(400).json({ error: "Se requiere al menos un destinatario (To o Bcc)" });
        }
        if (!subject || !html) {
            return res.status(400).json({ error: "Se requiere asunto y contenido del correo" });
        }
        if (!userUid) {
            return res.status(401).json({ error: "Usuario no autenticado" });
        }

        // Get user's Gmail access token from Firestore
        const userDoc = await db.collection("userRoles").doc(userUid).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const userData = userDoc.data();
        const gmailAccessToken = userData.gmailAccessToken;
        const userEmail = userData.email;

        if (!gmailAccessToken) {
            console.error("❌ Usuario sin token de Gmail:", userEmail);
            return res.status(400).json({
                error: "No tienes permisos de Gmail. Por favor, cierra sesión y vuelve a iniciar con Google.",
                code: "NO_GMAIL_TOKEN"
            });
        }

        const allRecipients = [...(to || []), ...(bcc || [])];
        console.log(`📧 Enviando correo desde: ${userEmail} a: ${allRecipients.length} destinatarios`);

        // Build the email in RFC 2822 format
        const emailLines = [
            `From: ${userEmail}`,
            to && to.length > 0 ? `To: ${to.join(", ")}` : '',
            bcc && bcc.length > 0 ? `Bcc: ${bcc.join(", ")}` : '', // Add BCC Header
            `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            '',
            html
        ];
        const email = emailLines.filter(line => line !== '').join('\r\n');

        // Encode to base64url format for Gmail API
        const encodedEmail = Buffer.from(email)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        // Send via Gmail API
        const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${gmailAccessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                raw: encodedEmail
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("❌ Error Gmail API:", errorData);

            // Check if token expired
            if (response.status === 401) {
                // Mark token as invalid
                await db.collection("userRoles").doc(userUid).update({
                    gmailAccessToken: admin.firestore.FieldValue.delete()
                });

                return res.status(401).json({
                    error: "Tu sesión de Gmail ha expirado. Por favor, cierra sesión y vuelve a iniciar con Google.",
                    code: "GMAIL_TOKEN_EXPIRED"
                });
            }

            throw new Error(errorData.error?.message || "Error enviando correo");
        }

        const result = await response.json();
        console.log(`✅ Correo enviado desde ${userEmail}, messageId: ${result.id}`);

        res.json({
            success: true,
            messageId: result.id,
            from: userEmail,
            recipients: to
        });

    } catch (error) {
        console.error("❌ Error enviando correo:", error);
        res.status(500).json({
            error: "Error al enviar correo",
            details: error.message
        });
    }
};

module.exports = {
    sendEmail
};
