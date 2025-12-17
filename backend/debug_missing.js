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
            this.buffer = Buffer.alloc(0);
            for (const w of words) this.socket.write(encode(w));
            this.socket.write(Buffer.from([0]));
        });
    }
    close() { this.socket.end(); }
}

async function main() {
    console.log("🕵️‍♂️ Provocando error de falta de parámetros...");
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

    // PROVOCAR ERROR
    // Intentamos añadir SIN NADA.
    console.log("\n🧨 Enviando ADD vacío...");
    const emptyRes = await api.cmd(['/dude/device/add']);
    console.log(emptyRes);

    api.close();
}

main();
