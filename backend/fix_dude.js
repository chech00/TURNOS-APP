const MikroService = require('./src/services/mikroService');
const CONFIG = { host: '192.168.1.26', port: 8728, user: 'admin', pass: '1234' };

async function main() {
    console.log("🔧 Intentando ACTIVAR The Dude Server...");
    const api = new MikroService(CONFIG);
    try {
        await api.connect();
        await api.login();

        // ENABLE DUDE
        const res = await api.cmd(['/dude/set', '=enabled=yes']);
        console.log("Set Result:", res.full);

        // VERIFY
        const printRes = await api.cmd(['/dude/print']);
        console.log("New Status:", printRes.full);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        api.close();
    }
}
main();
