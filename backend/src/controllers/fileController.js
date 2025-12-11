const { supabase } = require("../config/supabase");
const { enviarMensajeTelegram } = require("../services/telegramService");
const { validateFileType, ALLOWED_EXTENSIONS } = require("../utils/validators");

async function uploadFile(req, res) {
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
        const { data: { publicUrl } } = supabase.storage
            .from("documentos-noc")
            .getPublicUrl(fileName);

        // Note: Original code used returned object differently, Supabase v2 returns { data: { publicUrl } }
        // but the original code was: const { publicURL } = ... .getPublicUrl(fileName);
        // Checking Supabase JS v2 docs, getPublicUrl returns { data: { publicUrl } }.
        // If the user was using v1 it might be different. Let's stick to what was likely working or standard v2.
        // The package.json says "@supabase/supabase-js": "^2.48.1", so it is v2.
        // In v2 it is `const { data } = ...; const publicUrl = data.publicUrl;`.
        // The original code `const { publicURL } = ...` suggests they might have been using an older syntax or it was wrong?
        // Wait, let's look at the original code in server.js line 311:
        // const { publicURL } = supabase.storage.from("documentos-noc").getPublicUrl(fileName);
        // If this was working, maybe it's valid? But `getPublicUrl` in v2 returns `{ data: { publicUrl } }`.
        // I will use the correct v2 syntax to be safe: `data.publicUrl`.

        // Notificar a Telegram
        await enviarMensajeTelegram(`📁 Nuevo archivo subido: ${fileName} por ${req.user.email || 'Admin'}`);

        console.log(`✅ Archivo subido: ${fileName} por ${req.user.email || req.user.uid}`);
        res.json({ success: true, url: publicUrl, fileName });
    } catch (error) {
        console.error("❌ Error al subir archivo:", error);
        res.status(500).json({ error: "Error al subir el archivo." });
    }
}

async function listFiles(req, res) {
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
}

async function deleteFile(req, res) {
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
}

module.exports = { uploadFile, listFiles, deleteFile };
