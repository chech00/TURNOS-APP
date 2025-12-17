const MikroService = require('./src/services/mikroService');

// Configuración del Lab
const CONFIG = { host: '192.168.1.25', port: 8728, user: 'admin', pass: '1234' };
const TARGET_NODE = "NODO ALERCE 3";
const GOOD_IP = "192.168.1.101"; // Restaurar a IP original (dummy pero pingable si estuviera viva, o al menos 'up' si hacemos trampa)

async function main() {
    console.log(`🚑 RESTAURANDO SERVICIO en ${TARGET_NODE}...`);
    const api = new MikroService(CONFIG);
    try {
        await api.connect();
        await api.login();

        const printRes = await api.cmd(['/dude/device/print', `?name=${TARGET_NODE}`]);
        const idMatch = printRes.full.match(/\.id=(\*\[0-9A-F]+|\*[0-9A-F]+)/i);

        if (idMatch) {
            const id = idMatch[1];
            console.log(`✅ ID: ${id}. Restaurando IP a ${GOOD_IP}...`);
            await api.cmd(['/dude/device/set', `=.id=${id}`, `=ip=${GOOD_IP}`]);
            console.log("✅ Servicio Restaurado.");
        }
    } catch (e) { console.error(e); }
    finally { api.close(); }
}

main();
