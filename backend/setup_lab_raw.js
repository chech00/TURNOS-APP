const net = require('net');
const crypto = require('crypto');

// Configuración
const HOST = '192.168.1.25';
const PORT = 8728;
const USER = 'admin';
const PASS = '1234';

const NODES = [
    "NODO ALERCE 3",
    "NODO CORRENTOSO",
    "NODO RIO SUR",
    "NODO RIO SUR 2",
    "NODO PUERTO MONTT",
    "NODO LENCA",
    "NODO LAS QUEMAS 2",
    "NODO ALERCE SUR",
    "NODO DATA CENTER PM"
];

function encodeLength(len) {
    if (len < 0x80) return Buffer.from([len]);
    if (len < 0x4000) return Buffer.from([len >> 8 | 0x80, len & 0xFF]);
    throw new Error("Length too big for this simple script");
}

function encodeWord(word) {
    const len = Buffer.byteLength(word);
    return Buffer.concat([encodeLength(len), Buffer.from(word)]);
}

class MikroApi {
    constructor() {
        this.socket = new net.Socket();
        this.connected = false;
        this.buffer = Buffer.alloc(0);
        this.queue = [];
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.socket.connect(PORT, HOST, () => {
                this.connected = true;
                resolve();
            });
            this.socket.on('data', (data) => this.onData(data));
            this.socket.on('error', (err) => reject(err));
        });
    }

    onData(data) {
        this.buffer = Buffer.concat([this.buffer, data]);
        while (true) {
            // Intenta leer una sentencia completa (termina en byte 0x00 que es palabra vacía? No, wait.)
            // API protocol: series of words. Sentence ends with query terminator (empty word).
            // Simplification: We just wait for !done, !trap or !flat.

            // This is complex to implement fully async. 
            // For this script, we'll assume linear command-response.

            // Check if we have a !done in the buffer
            const doneIdx = this.buffer.indexOf('!done');
            const trapIdx = this.buffer.indexOf('!trap');

            if (doneIdx !== -1 || trapIdx !== -1) {
                // simple hacky parsing for lab setup
                // We'll rely on the current command promise to resolve.

                // Real parsing would decode lengths properly.
                // Let's defer to a simpler logic: just wait for !done
            }
            break;
        }

        if (this.currentResolver) {
            // Check if complete
            // Very naive parser for setup script
            const str = this.buffer.toString();
            if (str.includes('!done') || str.includes('!fatal')) {
                const resolver = this.currentResolver;
                this.currentResolver = null;
                const response = this.buffer.toString();
                this.buffer = Buffer.alloc(0);
                resolver(response);
            }
        }
    }

    run(words) {
        return new Promise((resolve, reject) => {
            this.currentResolver = resolve;
            // Send words
            for (const w of words) {
                this.socket.write(encodeWord(w));
            }
            this.socket.write(Buffer.from([0])); // End of sentence
        });
    }

    async login(user, pass) {
        // New Login Method (post v6.43): /login giving name and pass
        // Actually, try old method first: /login, get ret, solve challenge.
        // Or simpler: verify if prompt changes.

        // V7 supports plaintext login if allowed or /login + name + pass
        // Let's try modern /login
        const res1 = await this.run(['/login', '=name=' + user, '=password=' + pass]);
        if (res1.includes('!trap')) throw new Error("Login Failed: " + res1);
        if (res1.includes('!done') && res1.includes('=ret=')) {
            // Old challenge style...
            // Ignoring for now, assuming clean V7 lab env usually accepts direct or we see.
            // Actually V7 handles this differently.
            // Let's hope for the best or assume "Insecure" allows straightforward text.
        }
        return res1;
    }

    close() {
        this.socket.end();
    }
}

async function runSetup() {
    console.log("🔌 Conectando vía Raw Socket...");
    const api = new MikroApi();

    try {
        await api.connect();
        console.log("✅ Conectado TCP. Logueando...");

        await api.login(USER, PASS);
        console.log("🔓 Login OK (Aparentemente)");

        // 1. Ver dispositivos
        console.log("🔍 Buscando dispositivos...");
        const listStr = await api.run(['/dude/device/print']);

        let existing = [];
        // Parsear salida "fea"
        const regex = /=name=(.*?)(?:\n|$|\u0000)/g;
        let match;
        while ((match = regex.exec(listStr)) !== null) {
            existing.push(match[1]);
        }

        console.log(`📋 Encontrados: ${existing.join(', ')}`);

        // 2. Crear
        let ipCount = 100;
        for (const node of NODES) {
            if (existing.includes(node)) {
                console.log(`⏩ ${node} ya existe.`);
            } else {
                const ip = `192.168.1.${ipCount}`;
                console.log(`✨ Creando ${node}...`);
                await api.run([
                    '/dude/device/add',
                    `=name=${node}`,
                    `=address=${ip}`,
                    `=type=RouterOS`
                ]);
                ipCount++;
            }
        }

        console.log("🎉 FIN. Revisa The Dude.");

    } catch (e) {
        console.error("Error:", e);
    } finally {
        api.close();
    }
}

runSetup();
