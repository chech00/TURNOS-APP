const MikroService = require('./src/services/mikroService');
const CONFIG = { host: '192.168.1.26', port: 8728, user: 'admin', pass: '1234' };

async function main() {
    console.log("🕵️‍♂️ INSPECCIÓN DE RED PROFUNDA...");
    const api = new MikroService(CONFIG);
    try {
        await api.connect();
        await api.login();

        const ips = await api.cmd(['/ip/address/print']);
        const svcs = await api.cmd(['/ip/service/print']);
        const fw = await api.cmd(['/ip/firewall/filter/print']);

        const fs = require('fs');
        let out = "";
        out += "--- IP ADDRESSES ---\n" + ips.full + "\n";
        out += "--- IP SERVICES ---\n" + svcs.full + "\n";
        out += "--- FIREWALL RULES ---\n" + fw.full + "\n";

        fs.writeFileSync('net_debug.txt', out);
        console.log("Output saved into net_debug.txt");

    } catch (e) {
        console.error("Error:", e);
    } finally {
        api.close();
    }
}
main();
