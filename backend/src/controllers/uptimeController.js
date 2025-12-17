const { db } = require("../config/firebase");

/**
 * Crea un nuevo incidente en uptime_logs
 * Bypasea las reglas de Firestore usando el Admin SDK
 */
async function createIncident(req, res) {
    try {
        const data = req.body;

        // Validaciones básicas
        if (!data.failure_type) {
            return res.status(400).json({ error: "Faltan campos requeridos (failure_type)" });
        }

        // Asegurarnos que las fechas sean objetos Date si vienen como strings ISO
        if (typeof data.created_at === 'string') data.created_at = new Date(data.created_at);
        if (typeof data.start_date === 'string') data.start_date = new Date(data.start_date);

        const docRef = await db.collection("uptime_logs").add(data);

        console.log(`✅ Incidente creado vía API Backend: ${docRef.id}`);
        res.json({ id: docRef.id, message: "Incidente creado exitosamente" });
    } catch (error) {
        console.error("❌ Error creando incidente:", error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Actualiza un incidente existente (para diagnóstico o cierre)
 */
async function updateIncident(req, res) {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (!id) return res.status(400).json({ error: "Falta el ID del incidente" });

        // Convertir fechas si existen en los updates
        if (typeof updates.end_date === 'string') updates.end_date = new Date(updates.end_date);

        await db.collection("uptime_logs").doc(id).update(updates);

        console.log(`✅ Incidente actualizado vía API Backend: ${id}`);
        res.json({ success: true, message: "Incidente actualizado exitosamente" });
    } catch (error) {
        console.error("❌ Error actualizando incidente:", error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = { createIncident, updateIncident, getLastIncident, closeIncident, getIncidents, getNodes, getNodesWithPons };

/**
 * Lista todos los nodos (para el selector del modal)
 */
async function getNodes(req, res) {
    try {
        const snapshot = await db.collection("Nodos").orderBy('name').get();
        const nodes = [];
        snapshot.forEach(doc => {
            nodes.push({ id: doc.id, ...doc.data() });
        });
        res.json(nodes);
    } catch (error) {
        console.error("❌ Error listando nodos:", error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Lista todos los nodos CON sus PONs (para búsqueda inteligente)
 */
async function getNodesWithPons(req, res) {
    try {
        const nodesSnapshot = await db.collection("Nodos").orderBy('name').get();
        const result = { nodes: [], pons: [] };

        for (const nodeDoc of nodesSnapshot.docs) {
            const nodeData = nodeDoc.data();
            const nodeId = nodeDoc.id;
            result.nodes.push({ id: nodeId, name: nodeData.name });

            // Load PON letters
            const lettersSnapshot = await db.collection("Nodos").doc(nodeId).collection("PONLetters").get();

            for (const letterDoc of lettersSnapshot.docs) {
                const ponsSnapshot = await db.collection("Nodos").doc(nodeId)
                    .collection("PONLetters").doc(letterDoc.id)
                    .collection("PONs").get();

                ponsSnapshot.forEach(ponDoc => {
                    result.pons.push({
                        nodeId: nodeId,
                        nodeName: nodeData.name,
                        ponName: ponDoc.data().name,
                        ponId: ponDoc.id
                    });
                });
            }
        }

        console.log(`✅ Search data: ${result.nodes.length} nodes, ${result.pons.length} PONs`);
        res.json(result);
    } catch (error) {
        console.error("❌ Error obteniendo nodos con PONs:", error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Lista todos los incidentes (reemplaza lectura directa de Firestore)
 */
async function getIncidents(req, res) {
    try {
        const snapshot = await db.collection("uptime_logs")
            .orderBy('start_date', 'desc')
            .limit(100)
            .get();

        const incidents = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id;

            // Convertir timestamps a formato serializable
            if (data.start_date && data.start_date.toDate) {
                data.start_date = data.start_date.toDate().toISOString();
            }
            if (data.end_date && data.end_date.toDate) {
                data.end_date = data.end_date.toDate().toISOString();
            }
            if (data.created_at && data.created_at.toDate) {
                data.created_at = data.created_at.toDate().toISOString();
            }

            incidents.push(data);
        });

        res.json(incidents);
    } catch (error) {
        console.error("❌ Error listando incidentes:", error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Obtiene el último incidente creado (para feature "Copiar del Último")
 */
async function getLastIncident(req, res) {
    try {
        const snapshot = await db.collection("uptime_logs")
            .orderBy('created_at', 'desc')
            .limit(1)
            .get();

        if (snapshot.empty) {
            return res.status(404).json({ error: "No hay incidentes previos" });
        }

        const lastIncident = snapshot.docs[0].data();
        lastIncident.id = snapshot.docs[0].id;

        console.log(`✅ Último incidente obtenido: ${lastIncident.id}`);
        res.json(lastIncident);
    } catch (error) {
        console.error("❌ Error obteniendo último incidente:", error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Cierra un incidente - calcula métricas y actualiza end_date
 */
const TOTAL_CLIENTS_BASE = 10700; // Constante 2023

async function closeIncident(req, res) {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: "Falta el ID del incidente" });

        // 1. Obtener el incidente actual
        const doc = await db.collection("uptime_logs").doc(id).get();
        if (!doc.exists) {
            return res.status(404).json({ error: "Incidente no encontrado" });
        }

        const data = doc.data();
        const now = new Date();

        // 2. Calcular duración
        const startDate = data.start_date.toDate ? data.start_date.toDate() : new Date(data.start_date);
        const diffMinutes = Math.floor((now - startDate) / 60000);

        // 3. Calcular métricas
        const affClients = data.affected_customers || 0;
        const percentAffected = (affClients / TOTAL_CLIENTS_BASE);
        const clientMinutes = diffMinutes * affClients;

        // % Uptime cliente x falla
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const totalPossibleMinutes = daysInMonth * 1440 * TOTAL_CLIENTS_BASE;
        const pctUptimeCustomerFailure = 1 - (clientMinutes / totalPossibleMinutes);

        // 4. Actualizar
        const updates = {
            end_date: now,
            restore_time: diffMinutes,
            pct_customers_affected_total_network: percentAffected,
            customer_outage_time: clientMinutes,
            pct_uptime_customer_failure: pctUptimeCustomerFailure
        };

        await db.collection("uptime_logs").doc(id).update(updates);

        console.log(`✅ Incidente cerrado vía API: ${id} (${diffMinutes} min)`);
        res.json({
            success: true,
            message: "Incidente cerrado exitosamente",
            duration: diffMinutes,
            metrics: updates
        });
    } catch (error) {
        console.error("❌ Error cerrando incidente:", error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Get monthly summary with pre-calculated aggregations
 */
async function getMonthlySummary(req, res) {
    try {
        const { year, month } = req.query;
        const targetYear = parseInt(year) || new Date().getFullYear();
        const targetMonth = parseInt(month) || new Date().getMonth() + 1;

        const startDate = new Date(targetYear, targetMonth - 1, 1);
        const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

        const snapshot = await db.collection("uptime_logs")
            .where("start_date", ">=", startDate)
            .where("start_date", "<=", endDate)
            .get();

        const TOTAL_CLIENTS = 10700;
        const daysInMonth = endDate.getDate();
        const totalPossibleMinutes = daysInMonth * 1440 * TOTAL_CLIENTS;

        let totalIncidents = 0;
        let closedIncidents = 0;
        let totalClientMinutes = 0;
        let totalDuration = 0;
        const nodeStats = {};
        const typeStats = {};

        snapshot.forEach(doc => {
            const data = doc.data();
            totalIncidents++;

            if (data.end_date) {
                closedIncidents++;
                const duration = data.restore_time || 0;
                const clients = data.affected_customers || 0;
                totalDuration += duration;
                totalClientMinutes += duration * clients;
            }

            // Aggregate by node
            const node = data.node || 'Desconocido';
            nodeStats[node] = (nodeStats[node] || 0) + 1;

            // Aggregate by type
            const type = data.failure_type || 'Otro';
            typeStats[type] = (typeStats[type] || 0) + 1;
        });

        const uptimePercent = totalPossibleMinutes > 0
            ? ((1 - (totalClientMinutes / totalPossibleMinutes)) * 100)
            : 100;

        const mttr = closedIncidents > 0 ? Math.round(totalDuration / closedIncidents) : 0;

        // Sort and get top nodes
        const topNodes = Object.entries(nodeStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([node, count]) => ({ node, count }));

        res.json({
            period: `${targetYear}-${String(targetMonth).padStart(2, '0')}`,
            totalIncidents,
            closedIncidents,
            activeIncidents: totalIncidents - closedIncidents,
            uptimePercent: uptimePercent.toFixed(4),
            mttr,
            totalClientMinutes,
            topNodes,
            typeStats
        });
    } catch (error) {
        console.error("❌ Error getting monthly summary:", error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Get incidents list with pagination
 */
async function getListPaginated(req, res) {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const status = req.query.status; // 'active', 'closed', or undefined for all

        let query = db.collection("uptime_logs").orderBy("start_date", "desc");

        // Get total count first
        const countSnapshot = await db.collection("uptime_logs").get();
        const total = countSnapshot.size;

        // Apply pagination
        const snapshot = await query.limit(limit + offset).get();

        const incidents = [];
        let skipped = 0;

        snapshot.forEach(doc => {
            if (skipped < offset) {
                skipped++;
                return;
            }
            if (incidents.length >= limit) return;

            const data = doc.data();

            // Filter by status if specified
            if (status === 'active' && data.end_date) return;
            if (status === 'closed' && !data.end_date) return;

            incidents.push({ id: doc.id, ...data });
        });

        res.json({
            data: incidents,
            pagination: {
                total,
                limit,
                offset,
                hasMore: offset + incidents.length < total
            }
        });
    } catch (error) {
        console.error("❌ Error getting paginated list:", error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * LIVE MONITORING: Obtiene el estado real desde The Dude (Lab/Prod)
 */
const MikroService = require('../services/mikroService');

// --- MOCK MODE CONFIG ---
// --- MOCK MODE CONFIG ---
const USE_MOCK_LAB = false;
const fs = require('fs');
const path = require('path');
const MOCK_DB_PATH = path.join(__dirname, '../../lab_state.json');

// Configuración de The Dude (Producción)
const DUDE_CONFIG = {
    host: process.env.DUDE_HOST || '192.168.1.32',
    port: process.env.DUDE_PORT || 8728,
    user: process.env.DUDE_USER || 'admin',
    pass: process.env.DUDE_PASS || '1234'
};

// --- PING MODE CONFIG ---
const USE_PING_MODE = true; // Activar modo ping directo
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Dispositivos a monitorear con ping directo
const PING_DEVICES = [
    { name: 'NUEVA BRAUNAU', ip: '192.168.1.13', type: 'node' }
];

// Función para hacer ping a un host
async function pingHost(ip) {
    try {
        // Windows: ping -n 1 -w 1000 (1 intento, 1 segundo timeout)
        await execPromise(`ping -n 1 -w 1000 ${ip}`, { timeout: 3000 });
        return true; // Ping exitoso
    } catch (e) {
        return false; // Ping falló
    }
}

async function getLiveStatus(req, res) {
    // 1. MOCK BYPASS
    if (USE_MOCK_LAB) {
        try {
            if (!fs.existsSync(MOCK_DB_PATH)) {
                return res.json({ timestamp: new Date(), source: 'Mock Lab', devices: [] });
            }
            const db = JSON.parse(fs.readFileSync(MOCK_DB_PATH));
            console.log(`✅ Live Status (MOCK): ${db.length} devices.`);
            return res.json({
                timestamp: new Date(),
                source: 'Mock Lab (Simulation)',
                devices: db
            });
        } catch (e) {
            console.error("Mock Error:", e);
            return res.status(500).json({ error: "Mock Simulation Failed" });
        }
    }

    // 2. PING MODE - Monitoreo directo via ping
    if (USE_PING_MODE) {
        try {
            const devices = [];

            for (const device of PING_DEVICES) {
                const isUp = await pingHost(device.ip);
                devices.push({
                    name: device.name,
                    status: isUp ? 'up' : 'down',
                    ip: device.ip,
                    type: device.type,
                    parent: device.parent || null
                });
                console.log(`📡 Ping ${device.name} (${device.ip}): ${isUp ? '🟢 UP' : '🔴 DOWN'}`);
            }

            console.log(`✅ Live Status (PING): ${devices.length} devices checked.`);
            return res.json({
                timestamp: new Date(),
                source: 'Direct Ping Monitor',
                devices: devices
            });
        } catch (e) {
            console.error("Ping Mode Error:", e);
            return res.status(500).json({ error: "Ping Monitor Failed" });
        }
    }

    // 3. DUDE MODE - Fallback a The Dude API
    const api = new MikroService(DUDE_CONFIG);
    try {
        await api.connect();

        if (!await api.login()) {
            api.close();
            return res.status(401).json({ error: "Fallo autenticación con RouterOS" });
        }

        const response = await api.cmd(['/dude/device/print']);
        const raw = response.full;
        const devices = [];

        const chunks = raw.split('!re');
        chunks.forEach(chunk => {
            const nameMatch = chunk.match(/=name=(.*?)(?:\x00|$|\n)/);
            const statusMatch = chunk.match(/=status=(.*?)(?:\x00|$|\n)/);
            const addressMatch = chunk.match(/=(?:addresses|address|ip)=(.*?)(?:\x00|$|\n)/);

            if (nameMatch) {
                devices.push({
                    name: nameMatch[1],
                    status: statusMatch ? statusMatch[1] : 'unknown',
                    ip: addressMatch ? addressMatch[1] : 'N/A'
                });
            }
        });

        api.close();
        console.log(`✅ Live Status: ${devices.length} devices scanned.`);
        res.json({
            timestamp: new Date(),
            source: 'The Dude Lab',
            devices: devices
        });

    } catch (e) {
        console.error("❌ Live Status Error:", e);
        if (api) api.close();
        res.status(500).json({ error: e.message });
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
    getLiveStatus // Exportamos la nueva función
};
