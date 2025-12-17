const net = require('net');
const crypto = require('crypto');

const CONFIG = { host: '192.168.1.25', port: 8728, user: 'admin', pass: '1234' };

function encodeLength(l) {
    if (l < 0x80) return Buffer.from([l]);
    if (l < 0x4000) return Buffer.from([l >> 8 | 0x80, l & 0xFF]);
    throw new Error("Length too big");
}
function encode(word) {
    const buf = Buffer.from(word);
    return Buffer.concat([encodeLength(buf.length), buf]);
}

class ApiClient {
    constructor() { this.socket = new net.Socket(); this.buffer = Buffer.alloc(0); this.resolvers = []; }
    connect() {
        return new Promise((resolve, reject) => {
            this.socket.connect(CONFIG.port, CONFIG.host, resolve);
            this.socket.on('data', d => this.onData(d));
            this.socket.on('error', reject);
        });
    }
    onData(chunk) {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        while (true) {
            const str = this.buffer.toString();
            // Esperamos respuesta completa
            if (str.includes('!done') || str.includes('!trap')) {
                if (this.resolvers.length) {
                    const r = this.resolvers.shift();
                    r(str);
                    this.buffer = Buffer.alloc(0);
                }
                break;
            }
            break;
        }
    }
    cmd(words) {
        return new Promise(resolve => {
            this.resolvers.push(resolve);
            this.buffer = Buffer.alloc(0); // clear
            for (const w of words) this.socket.write(encode(w));
            this.socket.write(Buffer.from([0]));
        });
    }
    close() { this.socket.end(); }
}

async function main() {
    console.log("🕵️‍♂️ Creando Dispositivo Minimalista...");
    const api = new ApiClient();
    await api.connect();

    // Login
    let res = await api.cmd(['/login', `=name=${CONFIG.user}`, `=password=${CONFIG.pass}`]);
    if (res.includes('!trap')) {
        const retMatch = res.match(/=ret=(.*?)(?:\x00|$)/);
        if (retMatch) {
            const challenge = Buffer.from(retMatch[1], 'hex');
            const prefix = Buffer.from([0]);
            const pass = Buffer.from(CONFIG.pass);
            const md5 = crypto.createHash('md5').update(Buffer.concat([prefix, pass, challenge])).digest('hex');
            await api.cmd(['/login', `=name=${CONFIG.user}`, `=response=00${md5}`]);
        }
    }

    // 1. Crear solo con NOMBRE
    console.log("\n1️⃣ ADD name=MysteryParams...");
    const addRes = await api.cmd(['/dude/device/add', '=name=MysteryParams']);
    console.log(addRes);

    // 2. Si funcionó, PRINT para ver qué campos tiene
    if (addRes.includes('!done')) {
        console.log("\n2️⃣ PRINT para ver sus tripas...");
        const printRes = await api.cmd(['/dude/device/print', '?name=MysteryParams']);
        console.log(printRes);
    }

    api.close();
}

main();
