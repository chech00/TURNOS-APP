const { db } = require("../config/firebase");

// Global flag to control monitoring
let monitoringEnabled = true;

/**
 * Toggle monitoring on/off
 */
async function toggleMonitoring(req, res) {
    try {
        const { enabled } = req.body;

        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ error: "El campo 'enabled' debe ser un booleano" });
        }

        monitoringEnabled = enabled;

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
