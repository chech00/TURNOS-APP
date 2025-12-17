const MikroService = require('./src/services/mikroService');
const CONFIG = { host: '192.168.1.26', port: 8728, user: 'admin', pass: '1234' };

async function main() {
    console.log("📦 VERIFICANDO PAQUETES INSTALADOS...");
    const api = new MikroService(CONFIG);
    try {
        await api.connect();
        await api.login();

        const fs = require('fs');
        let out = "";

        out += "--- SYSTEM RESOURCE ---\n";
        const res = await api.cmd(['/system/resource/print']);
        out += res.full + "\n";

        out += "\n--- PACKAGES ---\n";
        const pkgs = await api.cmd(['/system/package/print']);
        out += pkgs.full + "\n";

        fs.writeFileSync('pkg_dump.txt', out);
        console.log("Output saved into pkg_dump.txt");

    } catch (e) {
        console.error("Error:", e);
    } finally {
        api.close();
    }
}
main();
