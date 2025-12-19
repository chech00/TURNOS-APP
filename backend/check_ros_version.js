
const MikroService = require('./src/services/mikroService');

const config = {
    host: '192.168.1.32',
    port: 8728,
    user: 'admin',
    pass: '1234'
};

async function checkVersion() {
    console.log(`🔌 Conectando a ${config.host}...`);
    const api = new MikroService(config);

    try {
        await api.connect();
        await api.login();
        console.log('✅ Login OK.');

        // Get System Resource
        const response = await api.cmd(['/system/resource/print']);

        // Parse raw response
        const raw = response.full || "";
        const versionMatch = raw.match(/=version=(.*?)(?:\x00|$|\n)/);
        const boardMatch = raw.match(/=board-name=(.*?)(?:\x00|$|\n)/);
        const platformMatch = raw.match(/=platform=(.*?)(?:\x00|$|\n)/);
        const uptimeMatch = raw.match(/=uptime=(.*?)(?:\x00|$|\n)/);

        console.log('\n📊 INFORMACIÓN DEL SISTEMA:');
        console.log('---------------------------');
        console.log('📦 Versión:    ', versionMatch ? versionMatch[1] : 'Desconocida');
        console.log('📟 Board:      ', boardMatch ? boardMatch[1] : 'Desconocida');
        console.log('🖥️ Plataforma: ', platformMatch ? platformMatch[1] : 'Desconocida');
        console.log('⏱️ Uptime:     ', uptimeMatch ? uptimeMatch[1] : 'Desconocido');

        api.close();
    } catch (e) {
        console.error('❌ Error checking version:', e.message);
        api.close();
    }
}

checkVersion();
