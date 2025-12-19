const { db } = require("../config/firebase");

// Collection name for storing config
const CONFIG_COLLECTION = "system_config";
const DUDE_CONFIG_DOC = "dude_settings";

// Default configuration
const DEFAULT_CONFIG = {
    host: '192.168.1.32',
    port: 8728,
    user: 'admin',
    pass: '1234',
    mode: 'ping',  // 'ping' or 'dude'
    enabled: true
};

/**
 * Get current Dude configuration
 */
async function getDudeConfig(req, res) {
    try {
        const doc = await db.collection(CONFIG_COLLECTION).doc(DUDE_CONFIG_DOC).get();

        if (!doc.exists) {
            // Return defaults if no config exists
            return res.json(DEFAULT_CONFIG);
        }

        const config = doc.data();
        // Don't send password in clear text to frontend
        config.pass = config.pass ? '********' : '';

        res.json(config);
    } catch (error) {
        console.error("❌ Error getting dude config:", error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Update Dude configuration (superadmin only)
 */
async function updateDudeConfig(req, res) {
    try {
        const { host, port, user, pass, mode, enabled } = req.body;

        // Validate required fields
        if (!host || !port || !user) {
            return res.status(400).json({ error: "Host, puerto y usuario son requeridos" });
        }

        // Get current config to preserve password if not changed
        const currentDoc = await db.collection(CONFIG_COLLECTION).doc(DUDE_CONFIG_DOC).get();
        const currentConfig = currentDoc.exists ? currentDoc.data() : DEFAULT_CONFIG;

        const newConfig = {
            host: host.trim(),
            port: parseInt(port) || 8728,
            user: user.trim(),
            // Only update password if it's not masked
            pass: (pass && pass !== '********') ? pass : currentConfig.pass,
            mode: mode || 'ping',
            enabled: enabled !== undefined ? enabled : true,
            updated_at: new Date()
        };

        await db.collection(CONFIG_COLLECTION).doc(DUDE_CONFIG_DOC).set(newConfig, { merge: true });

        console.log(`✅ Dude config updated: mode=${newConfig.mode}, host=${newConfig.host}`);
        res.json({ success: true, message: "Configuración guardada" });
    } catch (error) {
        console.error("❌ Error updating dude config:", error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Test connection to The Dude (without saving)
 */
async function testDudeConnection(req, res) {
    try {
        const { host, port, user, pass } = req.body;

        if (!host || !port || !user || !pass) {
            return res.status(400).json({ error: "Todos los campos son requeridos" });
        }

        // For now, just test TCP connection
        const net = require('net');
        const socket = new net.Socket();

        const timeout = setTimeout(() => {
            socket.destroy();
            res.json({ success: false, message: `Timeout conectando a ${host}:${port}` });
        }, 5000);

        socket.connect(port, host, () => {
            clearTimeout(timeout);
            socket.destroy();
            res.json({ success: true, message: `Conexión exitosa a ${host}:${port}` });
        });

        socket.on('error', (err) => {
            clearTimeout(timeout);
            socket.destroy();
            res.json({ success: false, message: `Error: ${err.message}` });
        });
    } catch (error) {
        console.error("❌ Error testing dude connection:", error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Get config for internal use (with password)
 */
async function getInternalConfig() {
    try {
        const doc = await db.collection(CONFIG_COLLECTION).doc(DUDE_CONFIG_DOC).get();
        return doc.exists ? doc.data() : DEFAULT_CONFIG;
    } catch (error) {
        console.error("Error loading dude config:", error);
        return DEFAULT_CONFIG;
    }
}

module.exports = {
    getDudeConfig,
    updateDudeConfig,
    testDudeConnection,
    getInternalConfig,
    DEFAULT_CONFIG
};
