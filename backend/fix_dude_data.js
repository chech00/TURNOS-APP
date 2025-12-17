const MikroService = require('./src/services/mikroService');
const CONFIG = { host: '192.168.1.26', port: 8728, user: 'admin', pass: '1234' };

async function main() {
    console.log("🧹 REGENERANDO BASE DE DATOS DUDE...");
    const api = new MikroService(CONFIG);
    try {
        await api.connect();
        await api.login();

        // 1. DISABLE
        console.log("Stopping...");
        await api.cmd(['/dude/set', '=enabled=no']);

        // 2. CHANGE DIR (Force new DB)
        console.log("Changing Directory...");
        // Usually plain string works
        await api.cmd(['/dude/set', '=data-directory=dude-new']);

        // 3. ENABLE
        console.log("Starting...");
        await api.cmd(['/dude/set', '=enabled=yes']);

        // 4. CHECK STATUS
        await new Promise(r => setTimeout(r, 2000));
        const res = await api.cmd(['/dude/print']);
        console.log("Status:", res.full);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        api.close();
    }
}
main();
