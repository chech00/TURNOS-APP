const MikroService = require('./src/services/mikroService');
const CONFIG = { host: '192.168.1.26', port: 8728, user: 'admin', pass: '1234' };

async function main() {
    console.log("🔄 REINICIANDO DUDE SERVER & CHECK LOGS...");
    const api = new MikroService(CONFIG);
    try {
        await api.connect();
        await api.login();

        // 1. STOP
        console.log("Stopping...");
        await api.cmd(['/dude/set', '=enabled=no']);

        // 2. WAIT (Simulated)
        await new Promise(r => setTimeout(r, 1000));

        // 3. START
        console.log("Starting...");
        await api.cmd(['/dude/set', '=enabled=yes']);

        // 4. CHECK LOGS (Last 10)
        console.log("\n--- RECENT LOGS ---");
        // Topics: dude, system, error
        const logs = await api.cmd(['/log/print', '?topics=dude,system,error', '>.id']);
        // Note: Filter might be tricky via raw api if topics not exact.
        // Let's just get last 15 logs blindly.
        // In API v1, print doesn't support 'limit' natively easily without buffer handling in client.
        // We'll rely on our client wrapper which fetches all? 
        // Our 'cmd' returns .full which implies buffering. 
        // Let's try to get all and slice in JS? Or just print unsorted.
        // Better: /log/print return all is risky if huge.
        // Use a filter for time? Or just hope it's small on a fresh lab.
        // Safe bet: just print.

        const logRes = await api.cmd(['/log/print']);
        const logLines = logRes.full.split('\n').slice(-20); // Last 20 lines
        console.log(logLines.join('\n'));

    } catch (e) {
        console.error("Error:", e);
    } finally {
        api.close();
    }
}
main();
