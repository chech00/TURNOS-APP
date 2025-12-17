const MikroService = require('./src/services/mikroService');
const CONFIG = { host: '192.168.1.25', port: 8728, user: 'admin', pass: '1234' };

async function main() {
    console.log("📦 CHECKING PACKAGES & REBOOTING...");
    const api = new MikroService(CONFIG);
    try {
        await api.connect();
        await api.login();

        // 1. CHECK PACKAGE
        console.log("\n--- PACKAGES ---");
        const pkgs = await api.cmd(['/system/package/print']);
        console.log(pkgs.full);

        // 2. CHECK SERVICE LIST AGAIN
        console.log("\n--- SERVICES ---");
        const svcs = await api.cmd(['/ip/service/print']);
        console.log(svcs.full);

        // 3. REBOOT
        console.log("\n⚠️ REBOOTING ROUTER NOW...");
        await api.cmd(['/system/reboot']);
        // Note: This will disconnect us immediately.

    } catch (e) {
        console.error("Error (Expected during reboot):", e.message);
    } finally {
        api.close();
    }
}
main();
