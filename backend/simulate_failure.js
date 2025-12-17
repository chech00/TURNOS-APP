const MikroService = require('./src/services/mikroService');

// Configuración del Lab
const CONFIG = {
    host: '192.168.1.25',
    port: 8728,
    user: 'admin',
    pass: '1234'
};

const TARGET_NODE = "NODO ALERCE 3";
const BAD_IP = "10.99.99.99"; // IP muerta
const GOOD_IP = "192.168.1.101"; // IP original (o la que se asignó en setup)

async function main() {
    console.log(`🧨 INYECTANDO FALLA en ${TARGET_NODE}...`);
    const api = new MikroService(CONFIG);

    try {
        await api.connect();
        if (!await api.login()) return;

        // 1. Buscar ID del nodo
        console.log("🔍 Buscando nodo...");
        const printRes = await api.cmd(['/dude/device/print', `?name=${TARGET_NODE}`]);

        // Parsear ID (formato .id=*X)
        const idMatch = printRes.full.match(/\.id=(\*\[0-9A-F]+|\*[0-9A-F]+)/i);
        if (!idMatch) {
            console.error("❌ Nodo no encontrado. ¿Ejecutaste setup_lab.js?");
            return;
        }
        const id = idMatch[1];
        console.log(`✅ ID Encontrado: ${id}`);

        // 2. ESTRATEGIA NUCLEAR: Remover y Re-Añadir con mala IP
        // (Bypass para error "unknown parameter" en set)
        console.log(`♻️  Removiendo nodo (ID: ${id}) para recrearlo corrupto...`);
        await api.cmd(['/dude/device/remove', `=.id=${id}`]);

        console.log(`☠️  Recreando con IP ${BAD_IP} (Método 2 Pasos)...`);

        // PASO 1: Add solo nombre
        const addRes = await api.cmd(['/dude/device/add', `=name=${TARGET_NODE}`]);
        console.log("ADD Response:", addRes.full);

        if (addRes.status === 'done') {
            const newId = addRes.ret;
            if (newId) {
                console.log(`✅ Nodo recreado (ID: ${newId}).seteando IP...`);
                // PASO 2: Set IP
                const setRes = await api.cmd(['/dude/device/set', `=.id=${newId}`, `=ip=${BAD_IP}`]);
                console.log("SET Response:", setRes.full);

                if (setRes.status === 'done') {
                    console.log("✅ Falla Inyectada EXITOSAMENTE.");
                    console.log("⏳ Espera unos segundos y corre 'test_controller_live.js' para verificar.");
                } else {
                    console.error(`❌ Falló SET IP: ${setRes.message || setRes.full}`);
                }
            } else {
                console.error("❌ Add OK pero sin ID retornado.");
            }
        } else {
            console.error(`❌ Falló ADD: ${addRes.message || addRes.full}`);
        }

    } catch (e) {
        console.error("Crash:", e);
    } finally {
        api.close();
    }
}

main();
