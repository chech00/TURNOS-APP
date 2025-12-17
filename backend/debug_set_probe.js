const MikroService = require('./src/services/mikroService');
const CONFIG = { host: '192.168.1.25', port: 8728, user: 'admin', pass: '1234' };
const TARGET_NODE = "NODO ALERCE 3";
const TEST_IP = "10.10.10.10";

async function main() {
    console.log("🔨 Brute-force Parameter Testing...");
    const api = new MikroService(CONFIG);
    await api.connect();
    await api.login();

    // Get ID
    const printRes = await api.cmd(['/dude/device/print', `?name=${TARGET_NODE}`]);
    const idMatch = printRes.full.match(/\.id=(\*\[0-9A-F]+|\*[0-9A-F]+)/i);
    if (!idMatch) { console.error("Node not found"); return; }
    const id = idMatch[1];

    // Params to try
    const params = ['ip', 'address', 'host', 'ipv4', 'dns-name'];

    for (const p of params) {
        console.log(`👉 Trying param: '${p}' ...`);
        const res = await api.cmd(['/dude/device/set', `=.id=${id}`, `=${p}=${TEST_IP}`]);

        if (res.status === 'done') {
            console.log(`✅ SUCCESS! Valid parameter is: '${p}'`);
            break;
        } else {
            console.log(`❌ Failed: ${res.message || res.full}`);
        }
    }
    api.close();
}
main();
