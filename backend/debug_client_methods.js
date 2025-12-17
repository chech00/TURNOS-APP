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
        console.log('Client keys:', Object.keys(client));
        console.log('Client prototype keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(client)));
        client.close();
    } catch (e) {
        console.error(e);
    }
}

main();
