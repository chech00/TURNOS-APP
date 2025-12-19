const { db } = require("../config/firebase");

// Global flag to control monitoring (synced with Firestore in realtime)
let monitoringEnabled = true;
let initialized = false;

/**
 * Initialize monitoring state from Firestore and setup realtime listener
 */
async function initializeMonitoringState() {
    if (initialized) return;

    try {
        // Initial read
        const doc = await db.collection('config').doc('monitoring').get();
        if (doc.exists) {
            monitoringEnabled = doc.data().enabled ?? true;
            console.log(`📡 Estado de monitoreo cargado de Firestore: ${monitoringEnabled ? 'ACTIVO' : 'PAUSADO'}`);
        } else {
            // Create default config
            await db.collection('config').doc('monitoring').set({ enabled: true });
            console.log('📡 Configuración de monitoreo creada por defecto: ACTIVO');
        }

        // Setup realtime listener to keep in sync with other instances
        db.collection('config').doc('monitoring').onSnapshot((doc) => {
            if (doc.exists) {
                const newState = doc.data().enabled ?? true;
                if (newState !== monitoringEnabled) {
                    monitoringEnabled = newState;
                    console.log(`🔄 Monitoreo actualizado en tiempo real: ${monitoringEnabled ? 'ACTIVO' : 'PAUSADO'}`);
                }
            }
        }, (error) => {
            console.error('⚠️ Error en listener de monitoreo:', error.message);
        });

        initialized = true;
    } catch (error) {
        console.error('⚠️ Error cargando estado de monitoreo:', error.message);
    }
}

// Initialize on module load
initializeMonitoringState();

/**
 * Toggle monitoring on/off
 */
async function toggleMonitoring(req, res) {
    try {
        const { enabled } = req.body;

        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ error: "El campo 'enabled' debe ser un booleano" });
        }

        // Update memory immediately
        monitoringEnabled = enabled;

        // Persist to Firestore (will also trigger realtime listeners on other instances)
        await db.collection('config').doc('monitoring').set({
            enabled: enabled,
            updatedAt: new Date(),
            updatedBy: req.user?.uid || 'system'
        });

        console.log(`🔄 Monitoreo ${enabled ? 'ACTIVADO' : 'DESACTIVADO'} por usuario: ${req.user?.uid}`);

        res.json({
            success: true,
            monitoringEnabled,
            message: `Monitoreo ${enabled ? 'activado' : 'desactivado'} exitosamente`
        });
    } catch (error) {
        console.error("❌ Error cambiando estado de monitoreo:", error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Get current monitoring status
 */
async function getMonitoringStatus(req, res) {
    try {
        // Refresh from Firestore to ensure sync across instances
        const doc = await db.collection('config').doc('monitoring').get();
        if (doc.exists) {
            monitoringEnabled = doc.data().enabled ?? true;
        }
        res.json({ monitoringEnabled });
    } catch (error) {
        console.error("❌ Error obteniendo estado de monitoreo:", error);
        res.status(500).json({ error: error.message });
    }
}

// Export the flag so other controllers can check it
module.exports.isMonitoringEnabled = () => monitoringEnabled;
module.exports.toggleMonitoring = toggleMonitoring;
module.exports.getMonitoringStatus = getMonitoringStatus;
module.exports.initializeMonitoringState = initializeMonitoringState;
