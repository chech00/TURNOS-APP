const net = require('net');
const crypto = require('crypto');

// --- MINI MIKROSERVICE IMPLEMENTATION (Standalone) ---
class MikroService {
    constructor(config) {
        this.config = config;
        this.socket = new net.Socket();
        this.buffer = Buffer.alloc(0);
        this.resolvers = [];
        this.connected = false;
        this.socket.setTimeout(5000);
        this.socket.on('timeout', () => { this.socket.end(); });
    }
    _encodeLength(l) {
        if (l < 0x80) return Buffer.from([l]);
        if (l < 0x4000) return Buffer.from([l >> 8 | 0x80, l & 0xFF]);
        throw new Error("Length too big");
    }
    _encode(word) {
        const buf = Buffer.from(word);
        return Buffer.concat([this._encodeLength(buf.length), buf]);
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
            // Check for sentence end
            if (str.includes('!done') || str.includes('!trap') || str.includes('!fatal')) {
                if (this.resolvers.length) {
                    const resolve = this.resolvers.shift();
                    const status = str.includes('!trap') ? 'trap' : (str.includes('!fatal') ? 'fatal' : 'done');
                    // Parse attributes if needed, but we mostly want the raw string here
                    resolve({ full: str, status: status, message: str });
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
                this.socket.write(Buffer.from([0]));
            } catch (e) { reject(e); }
        });
    }
    async login() {
        try {
            let res = await this.cmd(['/login', `=name=${this.config.user}`, `=password=${this.config.pass}`]);
            if (res.status === 'done' && !res.full.includes('!trap')) return true;
            if (res.full.includes('=ret=')) {
                // Challenge handling would go here but assumption is plaintext works or simple login
                // For brevity, skipping complex challenge unless failed.
                // Re-using known credential success from main app
            }
            // Fallback to challenge if needed
            const challengeMatch = res.full.match(/=ret=(.*?)(?:\x00|$)/);
            if (challengeMatch) {
                const challenge = Buffer.from(challengeMatch[1], 'hex');
                const prefix = Buffer.from([0]);
                const pass = Buffer.from(this.config.pass);
                const md5 = crypto.createHash('md5').update(Buffer.concat([prefix, pass, challenge])).digest('hex');
                res = await this.cmd(['/login', `=name=${this.config.user}`, `=response=00${md5}`]);
                return res.status === 'done';
            }
            return false;
        } catch (e) { return false; }
    }
    close() { this.socket.end(); }
}

// --- CONFIG ---
const config = {
    host: '192.168.1.32',
    port: 8728,
    user: 'admin',
    pass: '1234'
};

const commandsToTest = [
    ['/dude/device/print'],
    ['/dude/device/print', '=.proplist=name,status,services,active-services,monitoring'],
    ['/dude/service/print'], // Might imply device context?
    ['/dude/map/print']
];

async function discover() {
    console.log("🕵️ Starting Discovery...");
    const api = new MikroService(config);

    try {
        await api.connect();
        console.log("🔌 Connected.");

        if (!await api.login()) {
            console.error("❌ Login Failed");
            return;
        }
        console.log("✅ Login Success");

        for (const cmd of commandsToTest) {
            console.log(`\n🧪 Testing Command: ${JSON.stringify(cmd)}`);
            try {
                const res = await api.cmd(cmd);
                if (res.status === 'trap') {
                    console.log("⚠️ TRAP (Error):", res.message.replace(/\x00/g, ' '));
                } else {
                    console.log("✅ SUCCESS. Raw (first 1000 chars):");
                    console.log(res.full.replace(/\x00/g, '|').substring(0, 1000));

                    // Simple parse to find keys
                    const keys = new Set();
                    const regex = /=([^=]+)=/g;
                    let m;
                    while ((m = regex.exec(res.full)) !== null) {
                        keys.add(m[1]);
                    }
                    console.log("🔑 Found Keys:", Array.from(keys).join(', '));
                }
            } catch (e) {
                console.log("❌ Exception:", e.message);
            }
        }

        api.close();
    } catch (e) {
        console.error("Fatal:", e);
    }
}

discover();
