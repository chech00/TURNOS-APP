const net = require('net');
const crypto = require('crypto');

// COPIA AQUÍ TU CONTRASEÑA EXACTA
const CONFIG = {
    host: '192.168.1.25',
    port: 8728,
    user: 'admin',
    pass: '1234'
};

const NODES = [
    "NODO ALERCE 3", "NODO CORRENTOSO", "NODO RIO SUR", "NODO RIO SUR 2",
    "NODO PUERTO MONTT", "NODO LENCA", "NODO LAS QUEMAS 2", "NODO ALERCE SUR", "NODO DATA CENTER PM"
];

// Utilidades API RouterOS
function encodeLength(l) {
    if (l < 0x80) return Buffer.from([l]);
    if (l < 0x4000) return Buffer.from([l >> 8 | 0x80, l & 0xFF]);
    throw new Error("Length too big");
}

function encode(word) {
    const buf = Buffer.from(word);
    return Buffer.concat([encodeLength(buf.length), buf]);
}

function md5(str) {
    return crypto.createHash('md5').update(str).digest('hex');
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
        while (true) {
            const idx = this.findSentenceEnd(this.buffer);
            if (idx === -1) break;

            const sentence = this.parseSentence(this.buffer.slice(0, idx));
            this.buffer = this.buffer.slice(idx);

            if (this.resolvers.length > 0) {
                // Resolvemos la promesa actual con la respuesta
                const resolve = this.resolvers.shift();
                resolve(sentence);
            }
        }
    }

    // Encuentra el final de una sentencia (simple hack para labs: busca !done, !trap o !fatal)
    // En realidad deberíamos parsear lengths, pero esto suele bastar si leemos chunks completos.
    // IMPROVED: Vamos a asumir que si contiene !done/!trap al principio de un bloque de palabras...
    // Realmente, necesitamos ver el length de cada palabra.
    // Simplificación extrema v3: si en el buffer hay un !done|!trap|!fatal y luego ya no hay más bytes... asume fin.
    findSentenceEnd(buf) {
        // Esto es difícil de hacer perfecto sin maquina de estados.
        // Vamos a usar un timeout en la función 'cmd' para esperar un poco y leer lo que haya.
        return -1; // Usaremos lógica temporal en 'cmd'
    }

    parseSentence(buf) {
        return buf.toString();
    }

    // Enviar comando y esperar respuesta
    cmd(words) {
        return new Promise((resolve, reject) => {
            console.log(`> CMD: ${words[0]}`);

            this.buffer = Buffer.alloc(0); // Limpiar buffer antiguo

            for (const w of words) this.socket.write(encode(w));
            this.socket.write(Buffer.from([0])); // Terminator

            // Esperar respuesta (Timeout simple)
            setTimeout(() => {
                const raw = this.buffer.toString();
                // console.log("< RAW:", raw);

                const lines = raw.split(/[\x00-\x1F]+/); // Separar por bytes de control
                const response = {
                    status: null,
                    ret: null,
                    trap: null,
                    full: raw
                };

                if (raw.includes('!done')) response.status = 'done';
                if (raw.includes('!trap')) response.status = 'trap';
                if (raw.includes('!fatal')) response.status = 'fatal';

                // Buscar ret (challenge)
                const retMatch = raw.match(/=ret=(.*?)(?:\x00|$)/); // muy sucio pero funciona a veces
                // Mejor buscar en strings limpias
                raw.split('').forEach((c, i) => {
                    // Parsear a mano es complejo. Vamos a buscar el string literal.
                    const idx = raw.indexOf('=ret=');
                    if (idx !== -1) {
                        // leer hasta el siguiente byte < 32
                        let end = idx + 5;
                        while (end < raw.length && raw.charCodeAt(end) >= 32) end++;
                        response.ret = raw.substring(idx + 5, end);
                    }

                    const msgIdx = raw.indexOf('=message=');
                    if (msgIdx !== -1) {
                        let end = msgIdx + 9;
                        while (end < raw.length && raw.charCodeAt(end) >= 32) end++;
                        response.trap = raw.substring(msgIdx + 9, end);
                    }
                });

                resolve(response);
            }, 500); // 500ms deberían sobrar en red local
        });
    }

    async login() {
        // 1. Intentar método nuevo (Plaintext)
        console.log("🔑 Intentando login moderno...");
        let res = await this.cmd(['/login', `=name=${CONFIG.user}`, `=password=${CONFIG.pass}`]);

        if (res.status === 'done' && !res.ret) {
            console.log("🔓 Login Moderno OK.");
            return true;
        }

        // 2. Intentar método antiguo (Challenge)
        if (res.ret) {
            console.log("⚠️ Recibido Challenge, calculando MD5...");
            // MD5(0x00 + password + challenge_hex_binary)
            // El challenge viene en hex string (ej: "4a0c...") o crudo?
            // En API JS suele ser hex.

            // Buffer: \x00 + password + pack(challenge)
            const challengeBuf = Buffer.from(res.ret, 'hex');
            const prefix = Buffer.from([0]);
            const passBuf = Buffer.from(CONFIG.pass);

            const toHash = Buffer.concat([prefix, passBuf, challengeBuf]);
            const responseStr = "00" + crypto.createHash('md5').update(toHash).digest('hex');

            console.log("🔑 Enviando respuesta MD5...");
            res = await this.cmd(['/login', `=name=${CONFIG.user}`, `=response=${responseStr}`]);
            if (res.status === 'done') {
                console.log("🔓 Login Challenge OK.");
                return true;
            }
        }

        console.error("❌ LOGIN FALLIDO. Respuesta Router:", res.trap || res.full);
        console.log("🔍 ¿Es la contraseña '1234' correcta? Verifica setup_lab_v3.js");
        return false;
    }

    close() { this.socket.end(); }
}

async function main() {
    const api = new ApiClient();
    try {
        await api.connect();

        if (!await api.login()) return;

        // 1. Buscar TEST_PROBE
        console.log("🔍 Buscando TEST_PROBE...");
        const findRes = await api.cmd(['/dude/device/print', '?name=TEST_PROBE']);

        let id = null;
        if (findRes.full.includes('.id=')) {
            const match = findRes.full.match(/\.id=(\*\[0-9A-F]+|\*[0-9A-F]+)/i); // *1F or *1234
            if (match) id = match[1];
        }

        if (id) {
            console.log(`✅ Encontrado ID: ${id}`);
            console.log("🧪 Intentando SET ip=192.168.1.99 ...");

            // Intento con 'ip'
            const setRes = await api.cmd(['/dude/device/set', `=.id=${id}`, '=ip=192.168.1.99']);
            console.log("Resultado IP:", setRes.full.includes('!done') ? "✅ FUNCIONÓ" : `❌ ${setRes.trap || setRes.full}`);

            if (setRes.full.includes('!done')) {
                console.log("💡 ¡EUREKA! El parámetro es 'ip'");
            }
        } else {
            console.log("⚠️ No encontrado TEST_PROBE. Creando con IP directa a ver...");
            // Intento directo create con 'ip'
            const addRes = await api.cmd(['/dude/device/add', '=name=TEST_PROBE_2', '=ip=192.168.1.99']);
            console.log("Create con IP:", addRes.full.includes('!done') ? "✅ FUNCIONÓ" : `❌ ${addRes.trap || addRes.full}`);
        }

    } catch (e) {
        console.error("Crash:", e);
    } finally {
        api.close();
    }
}

main();
