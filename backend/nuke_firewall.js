const MikroService = require('./src/services/mikroService');
const CONFIG = { host: '192.168.1.26', port: 8728, user: 'admin', pass: '1234' };

async function main() {
    console.log("🔥 ELIMINANDO REGLAS DE FIREWALL (Nuclear Option)...");
    const api = new MikroService(CONFIG);
    try {
        await api.connect();
        await api.login();

        // 1. GET ALL RULE IDs
        // We use .proplist to retrieve just the IDs
        const res = await api.cmd(['/ip/firewall/filter/print', '=.proplist=.id']);

        // Output format is usually: !re =.id=*1 !re =.id=*2 ...
        // Regex to match *ID
        const ids = [];
        const regex = /\.id=(\*[0-9A-F]+)/g;
        let match;
        while ((match = regex.exec(res.full)) !== null) {
            ids.push(match[1]);
        }

        console.log(`Encontradas ${ids.length} reglas.`);

        if (ids.length > 0) {
            // 2. DELETE ONE BY ONE
            // (Batch delete support varies, loop is safer)
            for (const id of ids) {
                console.log(`🗑️ Eliminando regla ${id}...`);
                await api.cmd(['/ip/firewall/filter/remove', `=.id=${id}`]);
            }
            console.log("✅ Todas las reglas eliminadas.");
        } else {
            console.log("✨ No había reglas activas.");
        }

        // 3. CONFIRM (Should be empty)
        const finalCheck = await api.cmd(['/ip/firewall/filter/print']);
        console.log("Estado Final FW:", finalCheck.full.includes('!re') ? "⚠️ Aún quedan reglas" : "✅ Limpio");

    } catch (e) {
        console.error("Error:", e);
    } finally {
        api.close();
    }
}
main();
