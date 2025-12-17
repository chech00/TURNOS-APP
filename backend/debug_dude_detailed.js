const MikroService = require('./src/services/mikroService');
const CONFIG = { host: '192.168.1.26', port: 8728, user: 'admin', pass: '1234' };

async function main() {
    console.log("🕵️‍♂️ DUDE STATUS INVESTIGATION...");
    const api = new MikroService(CONFIG);
    try {
        await api.connect();
        await api.login();

        // Check Dude status with ALL properties
        const res = await api.cmd(['/dude/print']);
        console.log("--- DUDE PRINT ---");
        console.log(res.full);

        // Check Package details again, maybe "disabled" state is weird
        const pkg = await api.cmd(['/system/package/print', '?name=dude']);
        console.log("--- PACKAGE STATUS ---");
        console.log(pkg.full);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        api.close();
    }
}
main();
