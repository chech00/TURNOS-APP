const net = require('net');
const crypto = require('crypto');

/**
 * Cliente básico para MikroTik API v1.
 * Implementación robusta usando sockets crudos para compatibilidad v6/v7
 * y soporte de login MD5 Challenge.
 */
class MikroService {
    constructor(config) {
        this.config = config;
        this.socket = new net.Socket();
        this.buffer = Buffer.alloc(0);
        this.resolvers = [];
        this.connected = false;

        // Timeout handling
        this.socket.setTimeout(5000);
        this.socket.on('timeout', () => {
            console.warn('⚠️ MikroTik Socket Timeout');
            this.socket.end();
        });
    }

    _encodeLength(l) {
        if (l < 0x80) return Buffer.from([l]);
        if (l < 0x4000) return Buffer.from([l >> 8 | 0x80, l & 0xFF]);
        throw new Error("Length too big for this client");
    }

    _encode(word) {
        const buf = Buffer.from(word);
        return Buffer.concat([this._encodeLength(buf.length), buf]);
    }

    _extractTag(str, tag) {
        const regex = new RegExp(`=${tag}=(.*?)(?:\\x00|$)`);
        const match = str.match(regex);
        return match ? match[1] : null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.socket.connect(this.config.port, this.config.host, () => {
                this.connected = true;
                resolve();
            });
            this.socket.on('data', d => this._onData(d));
            this.socket.on('error', reject);
            this.socket.on('close', () => { this.connected = false; });
        });
    }

    _onData(chunk) {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        while (true) {
            const str = this.buffer.toString();
            // Detección simple de fin de sentencia (!done, !trap, !fatal)
            if (str.includes('!done') || str.includes('!trap') || str.includes('!fatal')) {
                if (this.resolvers.length) {
                    const resolve = this.resolvers.shift();

                    // Extraer datos útiles del response
                    // Parsearemos los atributos =attr=value
                    const attributes = {};
                    const regex = /=([^=]+)=(.*?)(?:\x00|$|\n)/g;
                    let m;
                    while ((m = regex.exec(str)) !== null) {
                        attributes[m[1]] = m[2];
                    }

                    resolve({
                        full: str,
                        status: str.includes('!trap') ? 'trap' : (str.includes('!fatal') ? 'fatal' : 'done'),
                        ret: attributes.ret, // Retorno específico (ej: challenge)
                        message: attributes.message, // Mensaje error
                        attributes: attributes
                    });
                    this.buffer = Buffer.alloc(0);
                }
                break;
            }
            break;
        }
    }

    cmd(words) {
        return new Promise((resolve, reject) => {
            if (!this.connected) return reject(new Error("Not connected"));
            this.resolvers.push(resolve);
            this.buffer = Buffer.alloc(0);
            try {
                for (const w of words) this.socket.write(this._encode(w));
                this.socket.write(Buffer.from([0])); // Terminator
            } catch (e) {
                reject(e);
            }
        });
    }

    async login() {
        try {
            // 1. Plaintext (v6.43+)
            let res = await this.cmd(['/login', `=name=${this.config.user}`, `=password=${this.config.pass}`]);
            if (res.status === 'done' && !res.ret) return true;

            // 2. Challenge (Legacy/v7 default)
            if (res.ret) {
                const challenge = Buffer.from(res.ret, 'hex');
                const prefix = Buffer.from([0]);
                const pass = Buffer.from(this.config.pass);
                const md5 = crypto.createHash('md5').update(Buffer.concat([prefix, pass, challenge])).digest('hex');
                res = await this.cmd(['/login', `=name=${this.config.user}`, `=response=00${md5}`]);
                if (res.status === 'done') return true;
            }
            throw new Error(res.message || "Login Failed");
        } catch (e) {
            console.error("Login Error:", e.message);
            return false;
        }
    }

    close() {
        this.socket.end();
    }
}

module.exports = MikroService;
