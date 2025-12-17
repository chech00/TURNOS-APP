/**
 * Script de prueba para conexión a The Dude
 * Ejecutar: node test_dude_connection.js
 */

const MikroService = require('./src/services/mikroService');

const config = {
    host: '192.168.1.32',
    port: 8728,
    user: 'admin',
    pass: '1234'
};

console.log('🔌 Conectando a The Dude...');
console.log(`   Host: ${config.host}:${config.port}`);
console.log(`   User: ${config.user}`);

async function testConnection() {
    const api = new MikroService(config);

    try {
        // 1. Conectar
        console.log('\n📡 Paso 1: Estableciendo conexión TCP...');
        await api.connect();
        console.log('   ✅ Conexión TCP establecida');

        // 2. Login
        console.log('\n🔐 Paso 2: Autenticando...');
        const loginOk = await api.login();
        if (!loginOk) {
            throw new Error('Autenticación fallida');
        }
        console.log('   ✅ Login exitoso!');

        // 3. Obtener dispositivos del Dude
        console.log('\n📋 Paso 3: Obteniendo dispositivos de The Dude...');
        const response = await api.cmd(['/dude/device/print']);

        // Parsear respuesta
        const raw = response.full;
        const chunks = raw.split('!re');
        const devices = [];

        chunks.forEach(chunk => {
            const nameMatch = chunk.match(/=name=(.*?)(?:\x00|$|\n)/);
            const statusMatch = chunk.match(/=status=(.*?)(?:\x00|$|\n)/);
            const addressMatch = chunk.match(/=(?:addresses|address|ip)=(.*?)(?:\x00|$|\n)/);

            if (nameMatch) {
                devices.push({
                    name: nameMatch[1],
                    status: statusMatch ? statusMatch[1] : 'unknown',
                    ip: addressMatch ? addressMatch[1] : 'N/A'
                });
            }
        });

        console.log(`   ✅ Encontrados ${devices.length} dispositivos\n`);

        // Mostrar tabla de dispositivos
        if (devices.length > 0) {
            console.log('┌──────────────────────────────┬────────────┬─────────────────┐');
            console.log('│ Nombre                       │ Estado     │ IP              │');
            console.log('├──────────────────────────────┼────────────┼─────────────────┤');
            devices.forEach(d => {
                const name = d.name.substring(0, 28).padEnd(28);
                const status = d.status.substring(0, 10).padEnd(10);
                const ip = (d.ip || 'N/A').substring(0, 15).padEnd(15);
                const statusIcon = d.status === 'up' ? '🟢' : (d.status === 'down' ? '🔴' : '⚪');
                console.log(`│ ${name} │ ${statusIcon} ${status} │ ${ip} │`);
            });
            console.log('└──────────────────────────────┴────────────┴─────────────────┘');
        }

        // Cerrar conexión
        api.close();
        console.log('\n✅ Prueba completada exitosamente!');
        console.log('   La conexión a The Dude está funcionando correctamente.');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        api.close();
        process.exit(1);
    }
}

testConnection();
