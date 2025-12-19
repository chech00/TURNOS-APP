const { RouterOSClient } = require('routeros-client');
require("dotenv").config();

// Import shared config and service
const config = {
    host: '192.168.1.32',
    user: 'admin',
    password: process.env.DUDE_PASS || '1234',
    port: 8728
};
const MikroService = require('./src/services/mikroService');

async function testServices() {
    console.log("🔌 Connecting to The Dude via MikroService...", config.host);
    const api = new MikroService(config);

    try {
        await api.connect();
        const loginSuccess = await api.login();

        if (!loginSuccess) {
            console.error("❌ Login failed!");
            return;
        }

        console.log("✅ Connected! Querying services...");

        // Query SERVICES
        const response = await api.cmd(['/dude/device/service/print']);
        const raw = response.full || '';

        // Parse "re" chunks if MikroService returns raw string, or just use response if array
        // uptimeController uses raw.split('!re')

        console.log("📦 Response Type:", typeof raw);
        console.log("📦 Response Length:", raw.length);

        if (raw.length > 500) {
            console.log("📄 Response (First 500 chars):", raw.substring(0, 500));
        } else {
            console.log("📄 Response:", raw);
        }

        api.close();
    } catch (err) {
        console.error("❌ Error:", err);
        // api.close() might throw if not connected, try-catch it or check impl
    }
}

testServices();
