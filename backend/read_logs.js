const MikroService = require('./src/services/mikroService');
const CONFIG = { host: '192.168.1.26', port: 8728, user: 'admin', pass: '1234' };

async function main() {
    console.log("📜 LEYENDO LOGS DEL ROUTER...");
    const api = new MikroService(CONFIG);
    try {
        await api.connect();
        await api.login();

        // Get logs
        // We fetch ALL logs and slice in JS because API filtering is tricky
        const logRes = await api.cmd(['/log/print']);

        const allLogs = logRes.full.split('\n');
        // Filter for relevant stuff
        const relevant = allLogs.filter(l =>
            l.includes('dude') || l.includes('error') || l.includes('system') || l.includes('account')
        ).slice(-30); // Last 30

        const fs = require('fs');
        fs.writeFileSync('router_logs.txt', relevant.join('\n'));
        console.log("Logs saved to router_logs.txt");

    } catch (e) {
        console.error("Error:", e);
    } finally {
        api.close();
    }
}
main();
