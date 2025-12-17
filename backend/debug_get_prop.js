const MikroService = require('./src/services/mikroService');
const CONFIG = { host: '192.168.1.25', port: 8728, user: 'admin', pass: '1234' };

async function main() {
    console.log("🕵️‍♂️ Getting details for NODO ALERCE 3...");
    const api = new MikroService(CONFIG);
    await api.connect();
    await api.login();

    // 1. Get ID first
    const printRes = await api.cmd(['/dude/device/print', '?name=NODO ALERCE 3']);
    const idMatch = printRes.full.match(/\.id=(\*\[0-9A-F]+|\*[0-9A-F]+)/i);

    if (idMatch) {
        const id = idMatch[1];
        console.log(`ID: ${id}`);

        // 2. Try to GET properties
        const props = ['address', 'addresses', 'ip', 'dns-name'];
        for (const p of props) {
            console.log(`Trying to GET ${p}...`);
            const getRes = await api.cmd(['/dude/device/get', `=.id=${id}`, `=value-name=${p}`]);
            console.log(`Response for ${p}:`, getRes.full);
        }
    } else {
        console.log("Node not found");
    }

    api.close();
}
main();
