const { db } = require("../config/firebase");

// --- SCALABLE MONITORING: MÁS DE 400 DISPOSITIVOS ---
// Arquitectura Pasiva: The Dude (Polling) -> Webhook -> Backend Cache (Memory) -> Frontend

// 1. CACHÉ EN MEMORIA DEL ESTADO DE LOS DISPOSITIVOS
// Estructura: { "NOMBRE_DISPOSITIVO": { status: "up/down", lastUpdate: Date, type: "dude_imported" } }
let DEVICE_CACHE = {};
let CACHE_INITIALIZED = false;

/**
 * Crea un nuevo incidente en uptime_logs
 * Bypasea las reglas de Firestore usando el Admin SDK
 */
async function createIncident(req, res) {
    try {
        const data = req.body;
        if (!data.failure_type) return res.status(400).json({ error: "Faltan campos requeridos (failure_type)" });

        if (typeof data.created_at === 'string') data.created_at = new Date(data.created_at);
        if (typeof data.start_date === 'string') data.start_date = new Date(data.start_date);

        // SECURITY: Strict Input Validation
        if (!data.node || typeof data.node !== 'string' || data.node.length > 50) {
            return res.status(400).json({ error: "Nombre de nodo inválido o muy largo" });
        }
        if (data.failure_reason && data.failure_reason.length > 200) {
            return res.status(400).json({ error: "Motivo de falla muy largo" });
        }

        // Sanitize strings
        data.node = data.node.trim().toUpperCase();
        if (data.failure_reason) data.failure_reason = data.failure_reason.trim();
        if (data.notes) data.notes = data.notes.substr(0, 500); // Limit notes length

        // --- PREVENT DUPLICATES (MANUAL VS WEBHOOK) ---
        // If user tries to create manually, check if active incident exists
        const nodeName = (data.node || "").toUpperCase().trim();
        const possibleNames = [nodeName];
        if (!nodeName.startsWith("NODO ")) possibleNames.push("NODO " + nodeName);
        if (nodeName.startsWith("NODO ")) possibleNames.push(nodeName.replace("NODO ", ""));

        const activeSnapshot = await db.collection("uptime_logs")
            .where("end_date", "==", null)
            .get();

        let activeIncident = null;
        activeSnapshot.forEach(doc => {
            const docData = doc.data();
            const activeName = (docData.node || "").toUpperCase().trim();
            if (possibleNames.includes(activeName)) {
                activeIncident = doc;
            }
        });

        if (activeIncident) {
            console.warn(`⚠️ Intento de duplicado manual bloqueado para: ${nodeName}`);
            // Return success with existing ID so frontend thinks it worked but backend kept it clean?
            // Or return error? Better to return success message pointing to existing one.
            return res.json({
                id: activeIncident.id,
                message: "Ya existe un incidente activo para este nodo. No se creó uno nuevo."
            });
        }

        const docRef = await db.collection("uptime_logs").add(data);
        console.log(`✅ Incidente creado vía API Backend: ${docRef.id}`);
        res.json({ id: docRef.id, message: "Incidente creado exitosamente" });
    } catch (error) {
        console.error("❌ Error creando incidente:", error);
        res.status(500).json({ error: error.message });
    }
}

async function updateIncident(req, res) {
    try {
        const { id } = req.params;
        const updates = req.body;
        if (!id) return res.status(400).json({ error: "Falta el ID del incidente" });
        if (typeof updates.end_date === 'string') updates.end_date = new Date(updates.end_date);
        await db.collection("uptime_logs").doc(id).update(updates);
        console.log(`✅ Incidente actualizado vía API Backend: ${id}`);
        res.json({ success: true, message: "Incidente actualizado exitosamente" });
    } catch (error) {
        console.error("❌ Error actualizando incidente:", error);
        res.status(500).json({ error: error.message });
    }
}

async function getNodes(req, res) {
    try {
        const snapshot = await db.collection("Nodos").orderBy('name').get();
        const nodes = [];
        snapshot.forEach(doc => nodes.push({ id: doc.id, ...doc.data() }));
        res.json(nodes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getNodesWithPons(req, res) {
    try {
        const nodesSnapshot = await db.collection("Nodos").orderBy('name').get();
        const result = { nodes: [], pons: [] };
        for (const nodeDoc of nodesSnapshot.docs) {
            const nodeData = nodeDoc.data();
            const nodeId = nodeDoc.id;
            result.nodes.push({ id: nodeId, name: nodeData.name });
            const lettersSnapshot = await db.collection("Nodos").doc(nodeId).collection("PONLetters").get();
            for (const letterDoc of lettersSnapshot.docs) {
                const ponsSnapshot = await db.collection("Nodos").doc(nodeId).collection("PONLetters").doc(letterDoc.id).collection("PONs").get();
                ponsSnapshot.forEach(ponDoc => {
                    result.pons.push({ nodeId: nodeId, nodeName: nodeData.name, ponName: ponDoc.data().name, ponId: ponDoc.id });
                });
            }
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getIncidents(req, res) {
    try {
        const snapshot = await db.collection("uptime_logs").orderBy('start_date', 'desc').limit(100).get();
        const incidents = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id;
            if (data.start_date?.toDate) data.start_date = data.start_date.toDate().toISOString();
            if (data.end_date?.toDate) data.end_date = data.end_date.toDate().toISOString();
            if (data.created_at?.toDate) data.created_at = data.created_at.toDate().toISOString();
            incidents.push(data);
        });
        res.json(incidents);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getLastIncident(req, res) {
    try {
        const snapshot = await db.collection("uptime_logs").orderBy('created_at', 'desc').limit(1).get();
        if (snapshot.empty) return res.status(404).json({ error: "No hay incidentes previos" });
        const lastIncident = snapshot.docs[0].data();
        lastIncident.id = snapshot.docs[0].id;
        res.json(lastIncident);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

const TOTAL_CLIENTS_BASE = 10700;
async function closeIncident(req, res) {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: "Falta el ID del incidente" });
        const doc = await db.collection("uptime_logs").doc(id).get();
        if (!doc.exists) return res.status(404).json({ error: "Incidente no encontrado" });
        const data = doc.data();
        const now = new Date();
        const startDate = data.start_date.toDate ? data.start_date.toDate() : new Date(data.start_date);
        const diffMinutes = Math.floor((now - startDate) / 60000);
        const affClients = data.affected_customers || 0;
        const percentAffected = (affClients / TOTAL_CLIENTS_BASE);
        const clientMinutes = diffMinutes * affClients;
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const totalPossibleMinutes = daysInMonth * 1440 * TOTAL_CLIENTS_BASE;
        const pctUptimeCustomerFailure = 1 - (clientMinutes / totalPossibleMinutes);
        const updates = { end_date: now, restore_time: diffMinutes, pct_customers_affected_total_network: percentAffected, customer_outage_time: clientMinutes, pct_uptime_customer_failure: pctUptimeCustomerFailure };
        await db.collection("uptime_logs").doc(id).update(updates);
        console.log(`✅ Incidente cerrado vía API: ${id} (${diffMinutes} min)`);
        res.json({ success: true, message: "Incidente cerrado exitosamente", duration: diffMinutes, metrics: updates });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getMonthlySummary(req, res) {
    // (Sin Cambios significativos - simplificado para brevedad, lógica igual)
    try {
        const { year, month } = req.query;
        const targetYear = parseInt(year) || new Date().getFullYear();
        const targetMonth = parseInt(month) || new Date().getMonth() + 1;
        const startDate = new Date(targetYear, targetMonth - 1, 1);
        const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);
        const snapshot = await db.collection("uptime_logs").where("start_date", ">=", startDate).where("start_date", "<=", endDate).get();
        const daysInMonth = endDate.getDate();
        const totalPossibleMinutes = daysInMonth * 1440 * TOTAL_CLIENTS_BASE;
        let totalIncidents = 0, closedIncidents = 0, totalClientMinutes = 0, totalDuration = 0;
        const nodeStats = {}, typeStats = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            totalIncidents++;
            if (data.end_date) {
                closedIncidents++;
                const duration = data.restore_time || 0;
                totalDuration += duration;
                totalClientMinutes += duration * (data.affected_customers || 0);
            }
            const node = data.node || 'Desconocido';
            nodeStats[node] = (nodeStats[node] || 0) + 1;
            const type = data.failure_type || 'Otro';
            typeStats[type] = (typeStats[type] || 0) + 1;
        });
        const uptimePercent = totalPossibleMinutes > 0 ? ((1 - (totalClientMinutes / totalPossibleMinutes)) * 100) : 100;
        const mttr = closedIncidents > 0 ? Math.round(totalDuration / closedIncidents) : 0;
        const topNodes = Object.entries(nodeStats).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([node, count]) => ({ node, count }));
        res.json({ period: `${targetYear}-${String(targetMonth).padStart(2, '0')}`, totalIncidents, closedIncidents, activeIncidents: totalIncidents - closedIncidents, uptimePercent: uptimePercent.toFixed(4), mttr, totalClientMinutes, topNodes, typeStats });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getListPaginated(req, res) {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const status = req.query.status;
        const query = db.collection("uptime_logs").orderBy("start_date", "desc");
        const countSnapshot = await db.collection("uptime_logs").get();
        const total = countSnapshot.size;
        const snapshot = await query.limit(limit + offset).get();
        const incidents = [];
        let skipped = 0;
        snapshot.forEach(doc => {
            if (skipped < offset) { skipped++; return; }
            if (incidents.length >= limit) return;
            const data = doc.data();
            if (status === 'active' && data.end_date) return;
            if (status === 'closed' && !data.end_date) return;
            incidents.push({ id: doc.id, ...data });
        });
        res.json({ data: incidents, pagination: { total, limit, offset, hasMore: offset + incidents.length < total } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// -------------------------------------------------------------
// LIVE MONITORING: PRODUCTION SCALABLE MODE (PASSIVE CACHE)
// -------------------------------------------------------------
const MikroService = require('../services/mikroService');

const DUDE_CONFIG = {
    host: process.env.DUDE_HOST || '192.168.1.32',
    port: process.env.DUDE_PORT || 8728,
    user: process.env.DUDE_USER || 'admin',
    pass: process.env.DUDE_PASS || '1234'
};

/**
 * Sync initial topology from The Dude (Runs on server start)
 * Fetches all 400+ devices to populate the cache.
 */
async function syncDudeDevices() {
    console.log("💾 Syncing topology from The Dude...");
    try {
        const api = new MikroService(DUDE_CONFIG);
        await api.connect();
        if (await api.login()) {
            // Get all devices (Name & Type)
            const response = await api.cmd(['/dude/device/print']);
            const raw = response.full || '';
            const chunks = raw.split('!re');

            let count = 0;
            chunks.forEach(chunk => {
                const nameMatch = chunk.match(/=name=(.*?)(?:\x00|$|\n)/);
                if (nameMatch) {
                    const name = nameMatch[1].toUpperCase();
                    // Initial State: Assume UP unless we know otherwise (Webhook will correct it)
                    // Or "Unknown" to show grey dot
                    DEVICE_CACHE[name] = {
                        status: 'up', // Assume Up to avoid 400 Down alerts
                        lastUpdate: new Date(),
                        source: 'dude_sync'
                    };
                    count++;
                }
            });
            console.log(`✅ Topology Synced: ${count} devices loaded into Cache.`);
            CACHE_INITIALIZED = true;
        }
        api.close();
    } catch (e) {
        console.error("⚠️ Failed to sync topology:", e.message);
        // Retry logic could go here
    }
}

/**
 * Initialize device cache from Firestore on server startup
 */
async function initializeDeviceCache() {
    if (CACHE_INITIALIZED) return;

    try {
        const snapshot = await db.collection('lab_devices').get();
        snapshot.forEach(doc => {
            const data = doc.data();
            DEVICE_CACHE[doc.id] = {
                status: data.status || 'up',
                lastUpdate: data.lastUpdate?.toDate() || new Date(),
                reason: data.reason || 'loaded_from_firestore'
            };
        });
        CACHE_INITIALIZED = true;
        console.log(`✅ Device cache initialized with ${snapshot.size} devices from Firestore`);
    } catch (error) {
        console.error('⚠️ Error initializing device cache from Firestore:', error.message);
    }
}

// Initialize cache on module load
initializeDeviceCache();

/**
 * Updates the cache based on Webhook events
 * Called by webhookController.js
 * Now persists to Firestore for multi-environment sync
 */
async function updateDeviceCache(name, status, reason = 'webhook') {
    const safeName = name.toUpperCase();
    console.log(`🧠 CACHE UPDATE: ${safeName} -> ${status} (${reason})`);

    // Update memory cache
    DEVICE_CACHE[safeName] = {
        status: status, // 'up' or 'down'
        lastUpdate: new Date(),
        reason: reason
    };

    // Persist to Firestore (non-blocking)
    try {
        await db.collection('lab_devices').doc(safeName).set({
            status: status,
            lastUpdate: new Date(),
            reason: reason,
            name: safeName
        }, { merge: true });
    } catch (error) {
        console.error('⚠️ Error persisting device to Firestore:', error.message);
    }
}

/**
 * Returns the Cache snapshot. O(1) complexity.
 * No pinging, no blocking.
 */
async function getLiveStatus(req, res) {
    // Check if monitoring is globally paused
    const monitoringControl = require('./monitoringControl');
    if (!monitoringControl.isMonitoringEnabled()) {
        return res.json({ timestamp: new Date(), source: 'Paused', devices: [] });
    }

    // Convert Cache to Array for Frontend
    const devicesList = Object.keys(DEVICE_CACHE).map(name => {
        const entry = DEVICE_CACHE[name];
        const isUp = entry.status === 'up';
        return {
            name: name,
            ip: '0.0.0.0', // Not needed for passive mode
            type: 'node',
            status: isUp ? 'up' : 'down',
            pingStatus: isUp ? 'up' : 'down', // Virtual status
            dudeStatus: isUp ? 'up' : 'down'
        };
    });

    res.json({
        timestamp: new Date(),
        source: 'Dude Cache (Passive Mode)',
        devices: devicesList
    });
}

/**
 * ELIMINAR TODOS LOS INCIDENTES (Modo Prueba)
 */
async function purgeIncidents(req, res) {
    try {
        console.log("⚠️ PURGING ALL INCIDENTS...");
        const snapshot = await db.collection("uptime_logs").get();
        if (snapshot.size === 0) return res.json({ success: true, message: "No había incidentes." });
        const batch = db.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();

        // ALSO CLEAR CACHE (Reset to UP)
        Object.keys(DEVICE_CACHE).forEach(k => {
            DEVICE_CACHE[k].status = 'up';
        });

        console.log(`✅ Incidents purged & Cache reset.`);
        res.json({ success: true, message: "Purga completada." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

/**
 * Add a device to the Lab
 */
async function addLabDevice(req, res) {
    try {
        const { name, ip } = req.body;
        if (!name) return res.status(400).json({ error: "Se requiere nombre del dispositivo" });

        const safeName = name.toUpperCase().trim();

        // Add to Firestore
        await db.collection('lab_devices').doc(safeName).set({
            name: safeName,
            ip: ip || '0.0.0.0',
            status: 'up',
            lastUpdate: new Date(),
            reason: 'manual_add'
        });

        // Update memory cache
        DEVICE_CACHE[safeName] = {
            status: 'up',
            lastUpdate: new Date(),
            reason: 'manual_add'
        };

        console.log(`✅ Lab device added: ${safeName}`);
        res.json({ success: true, device: safeName });
    } catch (error) {
        console.error('❌ Error adding lab device:', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Remove a device from the Lab
 */
async function removeLabDevice(req, res) {
    try {
        const { name } = req.params;
        if (!name) return res.status(400).json({ error: "Se requiere nombre del dispositivo" });

        const safeName = name.toUpperCase().trim();

        // Remove from Firestore
        await db.collection('lab_devices').doc(safeName).delete();

        // Remove from memory cache
        delete DEVICE_CACHE[safeName];

        console.log(`✅ Lab device removed: ${safeName}`);
        res.json({ success: true, removed: safeName });
    } catch (error) {
        console.error('❌ Error removing lab device:', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Refresh cache from Firestore
 */
async function refreshLabCache(req, res) {
    try {
        CACHE_INITIALIZED = false;
        DEVICE_CACHE = {};
        await initializeDeviceCache();
        res.json({ success: true, devices: Object.keys(DEVICE_CACHE).length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    createIncident,
    updateIncident,
    getNodes,
    getNodesWithPons,
    getIncidents,
    getLastIncident,
    closeIncident,
    getMonthlySummary,
    getListPaginated,
    getLiveStatus,
    purgeIncidents,
    syncDudeDevices,
    updateDeviceCache,
    addLabDevice,
    removeLabDevice,
    refreshLabCache,
    initializeDeviceCache
};
