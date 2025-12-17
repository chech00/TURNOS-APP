const { RouterOSAPI } = require('node-routeros');

const client = new RouterOSAPI({
    host: '192.168.1.25',
    user: 'admin',
    password: '1234',
    port: 8728
});

async function main() {
    try {
        await client.connect();
        console.log("Connected. Sending /ip/address/print...");
        const result = await client.write(['/ip/address/print']);
        console.log("Result:", result);

        console.log("Sending /dude/device/print...");
        const dudeResult = await client.write(['/dude/device/print']);
        console.log("Dude Result:", dudeResult);

        client.close();
    } catch (e) {
        console.error("Error:", e);
        client.close();
    }
}

main();
