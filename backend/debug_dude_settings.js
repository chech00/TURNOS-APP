const MikroService = require('./src/services/mikroService');
const CONFIG = { host: '192.168.1.25', port: 8728, user: 'admin', pass: '1234' };

async function main() {
    console.log("🎲 INTENTO FINAL: CAMBIAR PUERTO DUDE...");
    const api = new MikroService(CONFIG);
    try {
        await api.connect();
        await api.login();

        // CHANGE PORT TO 2212 (standard is 2210)
        // Note: The setting for port is not always directly in /dude/set. 
        // In v6 it wasn't changeable easily, in v7 it might be.
        // Let's print settings first.
        const settings = await api.cmd(['/dude/print']);
        console.log(settings.full);

        // If not changeable, we might just toggle enabled again.
        // Actually, try: /dude/set port=2212 ? Usually not exposed.
        // It's usually hardcoded or in /ip/service (but it wasn't there).

        // ALTERNATIVE: maybe we just reinstall via API?
        // /system/package/uninstall numbers=... (Risk: we lose it and can't upload via API easily without ftp).

        // Let's just output "NO FIX" if we can't change port.

    } catch (e) {
        console.error("Error:", e);
    } finally {
        api.close();
    }
}
main();
