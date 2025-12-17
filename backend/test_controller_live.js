// MOCK Firebase para evitar que el script falle por falta de credenciales
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (path) {
    if (path.includes('config/firebase')) {
        console.log("⚠️ Mocking Firebase...");
        return { db: {} };
    }
    return originalRequire.apply(this, arguments);
};

const uptimeController = require('./src/controllers/uptimeController');

// Mock Express req/res
const req = {};
const res = {
    json: (data) => {
        console.log("\n✅ API Response Received:");
        console.log("Timestamp:", data.timestamp);
        console.log("Source:", data.source);
        console.log("Devices Found:", data.devices.length);
        if (data.devices.length > 0) {
            console.log("Sample Device:", data.devices[0]);
        }
        console.log("\nFull List:");
        data.devices.forEach(d => console.log(` - ${d.name} [${d.status}] (${d.ip})`));
    },
    status: (code) => {
        console.log(`\n❌ Status Code: ${code}`);
        return {
            json: (err) => console.log("Error Body:", err)
        };
    }
};

console.log("🧪 Testing uptimeController.getLiveStatus()...");
uptimeController.getLiveStatus(req, res).catch(err => console.error("Crash:", err));
