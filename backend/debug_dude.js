const net = require('net');
const crypto = require('crypto');

const CONFIG = {
    host: '192.168.1.25',
    port: 8728,
    user: 'admin',
    pass: '1234'
};

// ... Copiamos la clase ApiClient del v3 para no reinventar ...
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
    constructor() {
        this.socket = new net.Socket();
        this.buffer = Buffer.alloc(0);
        this.resolvers = [];
    }
    connect() {
        return new Promise((resolve, reject) => {
            this.socket.connect(CONFIG.port, CONFIG.host, resolve);
            this.socket.on('data', d => this.onData(d));
            this.socket.on('error', reject);
        });
    }
    onData(chunk) {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        while (true) { // Simple drain
            const str = this.buffer.toString();
            if (str.includes('!done') || str.includes('!trap') || str.includes('!fatal')) {
                if (this.resolvers.length) {
                    const r = this.resolvers.shift();
                    r({ full: str });
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
    console.log("🕵️‍♂️ Iniciando Detective de Parámetros...");
    const api = new ApiClient();
    await api.connect();

    // Login
    // Asumimos que login v3 funciona (copiado logica simple)
    // Para brevedad usamos el metodo moderno directo, si falla fallará todo.
    // (En un script real copiaria todo el auth, pero probemos suerte con plaintext primero o challenge si falla)
    // ... Espera, mejor copio el auth completo para asegurar.

    // Login "Hardcoded" para este debug (suponiendo que challenge fue necesario)
    // Vamos a intentar el comando print SIN login a ver si nos patea (no, necesita login).
    // Implemento login minimo:
    console.log("🔑 Login...");
    let res = await api.cmd(['/login', `=name=${CONFIG.user}`, `=password=${CONFIG.pass}`]);
    if (res.full.includes('!trap')) {
        // Challenge flow simplificado
        const retMatch = res.full.match(/=ret=(.*?)(?:\x00|$)/);
        if (retMatch) {
            const challenge = Buffer.from(retMatch[1], 'hex');
            const prefix = Buffer.from([0]);
            const pass = Buffer.from(CONFIG.pass);
            const md5 = crypto.createHash('md5').update(Buffer.concat([prefix, pass, challenge])).digest('hex');
            res = await api.cmd(['/login', `=name=${CONFIG.user}`, `=response=00${md5}`]);
        }
    }
    console.log("Login Result:", res.full.includes('!done') ? "✅" : "❌");

    // PRUEBAS

    // 1. Ver si existe el path
    console.log("\n1️⃣ Probando PRINT...");
    const p = await api.cmd(['/dude/device/print']);
    console.log(p.full);

    // 2. Probar ADD solo con NOMBRE (para ver qué falta)
    console.log("\n2️⃣ Probando ADD (Solo nombre)...");
    const a1 = await api.cmd(['/dude/device/add', '=name=Probe1']);
    console.log(a1.full);

    // 3. Probar ADD con 'ip' en vez de 'address'
    console.log("\n3️⃣ Probando ADD (ip=1.1.1.1)...");
    const a2 = await api.cmd(['/dude/device/add', '=name=Probe2', '=ip=1.1.1.1']);
    console.log(a2.full);

    // 4. Probar ADD con 'dns-name'
    console.log("\n4️⃣ Probando ADD (dns-name=google)...");
    const a3 = await api.cmd(['/dude/device/add', '=name=Probe3', '=dns-name=localhost']);
    console.log(a3.full);

    api.close();
}

main();
