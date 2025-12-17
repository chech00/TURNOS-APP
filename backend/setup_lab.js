const net = require('net');
const crypto = require('crypto');

// CONFIGURACIÓN DE THE DUDE
const CONFIG = {
    host: '192.168.1.32', // The Dude Server
    port: 8728,
    user: 'admin',
    pass: '1234'
};

// NODOS A CREAR (Extraídos de dependencies.js)
const NODES = [
    "NODO ALERCE 3",
    "NODO CORRENTOSO",
    "NODO RIO SUR",
    "NODO RIO SUR 2",
    "NODO PUERTO MONTT",
    "NODO LENCA",
    "NODO LAS QUEMAS 2",
    "NODO LOS MUERMOS",
    "NODO PANITAO",
    "NODO NUEVA BRAUNAU",
    "NODO LLANQUIHUE",
    "NODO FRUTILLAR",
    "NODO DATA CENTER PM",
    "CASCADA",
    "CASMA"
];

// Test PONs for Alerce 3
const PONS = [
    "NODO ALERCE 3_PON_A0",
    "NODO ALERCE 3_PON_A1",
    "NODO ALERCE 3_PON_A2"
];/* -------------------------------------------------------------
   CLIENTE API ROUTEROS (MD5 + Challenge Support)
   ------------------------------------------------------------- */
function encodeLength(l) {
    if (l < 0x80) return Buffer.from([l]);
    if (l < 0x4000) return Buffer.from([l >> 8 | 0x80, l & 0xFF]);
    throw new Error("Length too big for this script");
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
        this.connected = false;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.socket.connect(CONFIG.port, CONFIG.host, () => {
                this.connected = true;
                resolve();
            });
            this.socket.on('data', d => this.onData(d));
            this.socket.on('error', reject);
            this.socket.on('close', () => { this.connected = false; });
        });
    }

    onData(chunk) {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        while (true) {
            const str = this.buffer.toString();
            // Simple detection of end of sentence
            // !done, !trap, !fatal
            if (str.includes('!done') || str.includes('!trap') || str.includes('!fatal')) {
                if (this.resolvers.length) {
                    // Esperamos un poco (hacky drain) para asegurar que llegó todo
                    // En un driver real leeríamos por palabras.
                    // Aquí asumimos que llega rápido.
                    const resolve = this.resolvers.shift();
                    resolve({
                        full: str,
                        status: str.includes('!trap') ? 'trap' : (str.includes('!fatal') ? 'fatal' : 'done'),
                        ret: this.extractTag(str, 'ret'),
                        trap: this.extractTag(str, 'message')
                    });
                    this.buffer = Buffer.alloc(0);
                }
                break;
            }
            break;
        }
    }

    extractTag(str, tag) {
        // Busca =tag=valor
        const regex = new RegExp(`=${tag}=(.*?)(?:\\x00|$)`);
        const match = str.match(regex);
        return match ? match[1] : null;
    }

    cmd(words) {
        return new Promise(resolve => {
            this.resolvers.push(resolve);
            this.buffer = Buffer.alloc(0);
            for (const w of words) this.socket.write(encode(w));
            this.socket.write(Buffer.from([0]));
        });
    }

    async login() {
        console.log("🔑 Iniciando sesión...");
        // 1. Plaintext (v6.43+)
        let res = await this.cmd(['/login', `=name=${CONFIG.user}`, `=password=${CONFIG.pass}`]);
        if (res.status === 'done' && !res.ret) return true;

        // 2. Challenge (Legacy/v7 default sometimes)
        if (res.ret) {
            const challenge = Buffer.from(res.ret, 'hex');
            const prefix = Buffer.from([0]);
            const pass = Buffer.from(CONFIG.pass);
            const md5 = crypto.createHash('md5').update(Buffer.concat([prefix, pass, challenge])).digest('hex');
            res = await this.cmd(['/login', `=name=${CONFIG.user}`, `=response=00${md5}`]);
            if (res.status === 'done') return true;
        }

        console.error("❌ Login Failed:", res.trap || res.full);
        return false;
    }

    close() { this.socket.end(); }
}

/* -------------------------------------------------------------
   LOGICA PRINCIPAL
   ------------------------------------------------------------- */
async function main() {
    const api = new ApiClient();
    try {
        await api.connect();
        if (!await api.login()) return;
        console.log("🔓 Login OK");

        // 1. Obtener lista actual (Idempotencia)
        console.log("📋 Consultando nodos existentes...");
        const existingRes = await api.cmd(['/dude/device/print']);
        const existingNames = [];

        // Parseo rústico de nombres
        // =name=NODO ALERCE 3
        const regexName = /=name=(.*?)(?:\x00|$|\n)/g;
        let m;
        while ((m = regexName.exec(existingRes.full)) !== null) {
            existingNames.push(m[1]);
        }
        console.log(`ℹ️ Encontrados ${existingNames.length} nodos.`);

        // 2. Crear Nodos
        let ipBase = 100;

        for (const node of NODES) {
            if (existingNames.includes(node)) {
                console.log(`⏩ ${node}: Ya existe. Saltando.`);
            } else {
                const fakeIp = `192.168.1.${ipBase}`;
                console.log(`✨ Creando ${node} (${fakeIp})...`);

                // Paso 1: Crear por nombre
                const addRes = await api.cmd(['/dude/device/add', `=name=${node}`]);

                if (addRes.status === 'done') {
                    // Paso 2: Extraer ID y asignar IP
                    const newId = addRes.ret; // Suele venir en ret de !done
                    if (newId) {
                        /* 
                           IMPORTANTE: Hemos descubierto que el parámetro es 'ip'
                           y no 'address'. Usamos 'set' para mayor seguridad.
                        */
                        const setRes = await api.cmd(['/dude/device/set', `=.id=${newId}`, `=ip=${fakeIp}`]);
                        if (setRes.status === 'done') {
                            console.log(`   ✅ OK`);
                        } else {
                            console.error(`   ⚠️ Creado, pero falló poner IP: ${setRes.trap}`);
                        }
                    } else {
                        console.warn("   ⚠️ Creado, pero no devolvió ID para poner IP.");
                    }
                } else {
                    console.error(`   ❌ Falló creación: ${addRes.trap}`);
                }
            }
            ipBase++;
        }

        // 3. Crear PONS (Test Devices)
        console.log("🔌 Configurando PONs de prueba...");
        for (const pon of PONS) {
            if (existingNames.includes(pon)) {
                console.log(`⏩ ${pon}: Ya existe. Saltando.`);
            } else {
                const fakeIp = `192.168.1.${ipBase}`;
                console.log(`✨ Creando PON ${pon} (${fakeIp})...`);

                const addRes = await api.cmd(['/dude/device/add', `=name=${pon}`]);

                if (addRes.status === 'done') {
                    const newId = addRes.ret;
                    if (newId) {
                        const setRes = await api.cmd(['/dude/device/set', `=.id=${newId}`, `=ip=${fakeIp}`]);
                        if (setRes.status === 'done') {
                            console.log(`   ✅ OK`);
                        } else {
                            console.error(`   ⚠️ Creado, pero falló poner IP: ${setRes.trap}`);
                        }
                    }
                } else {
                    console.error(`   ❌ Falló creación: ${addRes.trap}`);
                }
            }
            ipBase++;
        }

        console.log("\n🎉 CONFIGURACIÓN DE LABORATORIO COMPLETADA.");
        console.log("Los nodos ya deberían estar visibles en tu Router/Dude.");

    } catch (e) {
        console.error("Error General:", e);
    } finally {
        api.close();
    }
}

main();
