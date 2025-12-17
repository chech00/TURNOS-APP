const MikroService = require('./src/services/mikroService');
const CONFIG = { host: '192.168.1.26', port: 8728, user: 'admin', pass: '1234' };

async function main() {
    const action = process.argv[2]; // 'disable' or 'enable'
    const api = new MikroService(CONFIG);
    try {
        console.log(`📦 PACKAGE ACTION: ${action.toUpperCase()}...`);
        await api.connect();
        await api.login();

        // Find package ID for 'dude'
        const pkgRes = await api.cmd(['/system/package/print', '?name=dude', '=.proplist=.id']);
        const pkgId = pkgRes.full.match(/\.id=(\*[0-9A-F]+)/)[1];

        if (action === 'disable') {
            await api.cmd(['/system/package/disable', `=numbers=${pkgId}`]);
            console.log("✅ Package disabled. Scheduling reboot...");
            await api.cmd(['/system/reboot']);
        } else if (action === 'enable') {
            await api.cmd(['/system/package/enable', `=numbers=${pkgId}`]);
            console.log("✅ Package enabled. Scheduling reboot...");
            await api.cmd(['/system/reboot']);
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        api.close();
    }
}
main();
