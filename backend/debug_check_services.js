const MikroService = require('./src/services/mikroService');
const CONFIG = { host: '192.168.1.25', port: 8728, user: 'admin', pass: '1234' };

async function main() {
    console.log("🕵️‍♂️ Checking RouterOS Services...");
    const api = new MikroService(CONFIG);
    try {
        await api.connect();
        await api.login();

        // Check Router Version
        console.log("\n--- SYSTEM RESOURCE ---");
        const res = await api.cmd(['/system/resource/print']);
        console.log(res.full);

        // Check IP Services (API, Winbox, etc)
        console.log("\n--- IP SERVICES ---");
        const servicesRes = await api.cmd(['/ip/service/print']);

        // Parse services roughly to see ports
        const lines = servicesRes.full.split('\n');
        lines.forEach(line => {
            if (line.includes('name=dude') || line.includes('port=')) {
                console.log(line);
            }
        });

    } catch (e) {
        console.error("Error:", e);
    } finally {
        api.close();
    }
}
main();
