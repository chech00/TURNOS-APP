/**
 * Configura IPs reales en The Dude para pruebas
 * Ejecutar: node configure_real_ips.js
 */

const MikroService = require('./src/services/mikroService');

const CONFIG = {
    host: '192.168.1.32',
    port: 8728,
    user: 'admin',
    pass: '1234'
};

// Mapeo de nodos a IPs reales
const NODE_IPS = {
    'NODO ALERCE 3': '192.168.1.10',       // Tu PC - UP
    'NODO CORRENTOSO': '192.168.1.32',     // Router - UP
    'NODO RIO SUR': '8.8.8.8',             // Google DNS - UP
    'NODO RIO SUR 2': '192.168.1.250',     // No existe - DOWN
    'NODO PUERTO MONTT': '192.168.1.251',  // No existe - DOWN
    'NODO LENCA': '1.1.1.1',               // Cloudflare - UP
};

async function main() {
    console.log('🔧 CONFIGURANDO IPs REALES EN THE DUDE...\n');
    const api = new MikroService(CONFIG);

    try {
        await api.connect();
        if (!await api.login()) {
            console.error('❌ Login falló');
            return;
        }
        console.log('✅ Conectado\n');

        // 1. Obtener lista de dispositivos e IDs
        const printRes = await api.cmd(['/dude/device/print']);
        const raw = printRes.full;

        // Parsear IDs y nombres
        const chunks = raw.split('!re');
        const devices = [];

        chunks.forEach(chunk => {
            const idMatch = chunk.match(/\.id=(\*[0-9A-Fa-f]+)/);
            const nameMatch = chunk.match(/=name=(.*?)(?:\x00|$|\n)/);
            if (idMatch && nameMatch) {
                devices.push({ id: idMatch[1], name: nameMatch[1] });
            }
        });

        console.log(`📋 Encontrados ${devices.length} dispositivos\n`);

        // 2. Actualizar IPs
        for (const [nodeName, newIp] of Object.entries(NODE_IPS)) {
            const device = devices.find(d => d.name === nodeName);
            if (device) {
                console.log(`🔄 ${nodeName} → ${newIp}`);

                // Intentar con 'address' (Dude v6+)
                const setRes = await api.cmd([
                    '/dude/device/set',
                    `=.id=${device.id}`,
                    `=address=${newIp}`
                ]);

                if (setRes.status === 'done') {
                    console.log(`   ✅ OK`);
                } else {
                    console.log(`   ⚠️ ${setRes.message || 'Error desconocido'}`);
                }
            } else {
                console.log(`⏩ ${nodeName}: No encontrado, saltando`);
            }
        }

        console.log('\n🎉 Configuración completada!');
        console.log('\n📌 Resultado esperado:');
        console.log('   🟢 NODO ALERCE 3 (tu PC) → UP');
        console.log('   🟢 NODO CORRENTOSO (router) → UP');
        console.log('   🟢 NODO RIO SUR (8.8.8.8) → UP');
        console.log('   🔴 NODO RIO SUR 2 (no existe) → DOWN');
        console.log('   🔴 NODO PUERTO MONTT (no existe) → DOWN');
        console.log('   🟢 NODO LENCA (1.1.1.1) → UP');

    } catch (e) {
        console.error('❌ Error:', e.message);
    } finally {
        api.close();
    }
}

main();
