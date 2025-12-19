const { db } = require("../config/firebase");
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Lista todos los dispositivos configurados para ping
 */
async function getPingDevices(req, res) {
    try {
        const snapshot = await db.collection("ping_devices").orderBy('name').get();
        const devices = [];
        snapshot.forEach(doc => {
            devices.push({ id: doc.id, ...doc.data() });
        });
        res.json(devices);
    } catch (error) {
        console.error("❌ Error listando ping_devices:", error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Agrega un nuevo dispositivo para monitorear
 */
async function addPingDevice(req, res) {
    try {
        const { name, ip, type } = req.body;

        if (!name || !ip) {
            return res.status(400).json({ error: "Nombre e IP son requeridos" });
        }

        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipRegex.test(ip)) {
            return res.status(400).json({ error: "Formato de IP inválido" });
        }

        const data = {
            name: name.toUpperCase(),
            ip: ip,
            type: type || 'node',
            enabled: true,
            created_at: new Date()
        };

        const docRef = await db.collection("ping_devices").add(data);
        console.log(`✅ Dispositivo agregado: ${name} (${ip})`);
        res.json({ id: docRef.id, ...data });
    } catch (error) {
        console.error("❌ Error agregando dispositivo:", error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Actualiza un dispositivo existente
 */
async function updatePingDevice(req, res) {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (!id) return res.status(400).json({ error: "ID requerido" });

        if (updates.ip) {
            const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
            if (!ipRegex.test(updates.ip)) {
                return res.status(400).json({ error: "Formato de IP inválido" });
            }
        }

        if (updates.name) updates.name = updates.name.toUpperCase();
        updates.updated_at = new Date();

        await db.collection("ping_devices").doc(id).update(updates);
        console.log(`✅ Dispositivo actualizado: ${id}`);
        res.json({ success: true, id });
    } catch (error) {
        console.error("❌ Error actualizando dispositivo:", error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Elimina un dispositivo
 */
async function deletePingDevice(req, res) {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: "ID requerido" });

        await db.collection("ping_devices").doc(id).delete();
        console.log(`✅ Dispositivo eliminado: ${id}`);
        res.json({ success: true });
    } catch (error) {
        console.error("❌ Error eliminando dispositivo:", error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Hace ping de prueba a un dispositivo específico
 */
async function testPingDevice(req, res) {
    try {
        const { ip } = req.body;

        if (!ip) return res.status(400).json({ error: "IP requerida" });

        // Strict IP Validation before anything else
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipRegex.test(ip)) {
            return res.status(400).json({ error: "Formato de IP inválido" });
        }

        // Use spawn to avoid shell execution
        const { spawn } = require('child_process');

        // Windows 'ping' arguments: -n 1 (count), -w 2000 (timeout ms)
        // Linux 'ping' arguments: -c 1 (count), -W 2 (timeout s)
        // Adjust based on OS if needed. Assuming Windows based on context (desktop path).
        // For cross-platform safety, we could detect OS.
        const isWin = process.platform === "win32";
        const args = isWin
            ? ['-n', '1', '-w', '2000', ip]
            : ['-c', '1', '-W', '2', ip];

        const child = spawn('ping', args);

        child.on('error', (err) => {
            res.json({ success: true, status: 'down', ip, error: err.message });
        });

        child.on('close', (code) => {
            if (code === 0) {
                res.json({ success: true, status: 'up', ip });
            } else {
                res.json({ success: true, status: 'down', ip });
            }
        });

    } catch (error) {
        console.error("❌ Error ping test:", error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Obtiene el estado de todos los dispositivos (ping a cada uno)
 */
async function getAllDevicesStatus(req, res) {
    try {
        // Read devices from Firestore
        const snapshot = await db.collection("ping_devices")
            .where('enabled', '==', true)
            .get();

        if (snapshot.empty) {
            return res.json({
                timestamp: new Date(),
                source: 'Firestore + Ping',
                devices: [],
                message: 'No hay dispositivos configurados'
            });
        }

        const { spawn } = require('child_process');
        const isWin = process.platform === "win32";

        // Parallelize pings - Be careful with too many concurrent spawns
        const pingPromises = snapshot.docs.map(async doc => {
            const deviceData = doc.data();

            // Validate IP even from DB
            const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
            if (!ipRegex.test(deviceData.ip)) {
                return {
                    id: doc.id, ...deviceData, status: 'down', error: 'Invalid IP'
                };
            }

            return new Promise((resolve) => {
                const args = isWin
                    ? ['-n', '1', '-w', '1000', deviceData.ip]
                    : ['-c', '1', '-W', '1', deviceData.ip];

                const child = spawn('ping', args);
                let isUp = false;

                child.on('close', (code) => {
                    isUp = (code === 0);
                    resolve({
                        id: doc.id,
                        name: deviceData.name,
                        ip: deviceData.ip,
                        type: deviceData.type || 'node',
                        status: isUp ? 'up' : 'down'
                    });
                    // console.log(`📡 Ping ${deviceData.name}: ${isUp ? 'UP' : 'DOWN'}`); // verbose
                });

                child.on('error', () => {
                    resolve({
                        id: doc.id,
                        name: deviceData.name,
                        ip: deviceData.ip,
                        type: deviceData.type || 'node',
                        status: 'down'
                    });
                });
            });
        });

        // Resolve all pings
        const devices = await Promise.all(pingPromises);

        res.json({
            timestamp: new Date(),
            source: 'Firestore + Direct Ping (Secure Spawn)',
            devices: devices
        });
    } catch (error) {
        console.error("❌ Error getting all device status:", error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    getPingDevices,
    addPingDevice,
    updatePingDevice,
    deletePingDevice,
    testPingDevice,
    getAllDevicesStatus
};
