const MikroService = require('./src/services/mikroService');
const CONFIG = { host: '192.168.1.25', port: 8728, user: 'admin', pass: '1234' };

async function main() {
    console.log("🚑 DIAGNÓSTICO PROFUNDO + FORCE ACCESS...");
    const api = new MikroService(CONFIG);
    try {
        await api.connect();
        const fs = require('fs');
        let fileOutput = "";

        // 1. GET ROUTER VERSION
        fileOutput += "--- SYSTEM RESOURCE ---\n";
        const resource = await api.cmd(['/system/resource/print']);
        fileOutput += resource.full + "\n";

        // 3. DUDE STATUS
        fileOutput += "\n--- DUDE STATUS ---\n";
        const dude = await api.cmd(['/dude/print']);
        fileOutput += dude.full + "\n";

        fs.writeFileSync('force_output.txt', fileOutput);
        console.log("Output saved to force_output.txt");

    } catch (e) {
        console.error("Error:", e);
    } finally {
        api.close();
    }
}
main();
