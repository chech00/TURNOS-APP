const MikroService = require('./src/services/mikroService');
const CONFIG = { host: '192.168.1.25', port: 8728, user: 'admin', pass: '1234' };

const fs = require('fs');

async function main() {
    console.log("🕵️‍♂️ Inspeccionando NODO ALERCE 3...");
    const api = new MikroService(CONFIG);
    await api.connect();
    await api.login();

    // Print filtered
    const res = await api.cmd(['/dude/device/print', '?name=NODO ALERCE 3']);

    fs.writeFileSync('dump.txt', res.full);
    console.log("Dump saved to dump.txt");

    api.close();
}
main();
