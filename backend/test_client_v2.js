const { RouterOSClient } = require('routeros-client');

const api = new RouterOSClient({
    host: '192.168.1.25',
    user: 'admin',
    password: '1234',
    port: 8728
});

api.connect()
    .then((client) => {
        console.log('Connected!');
        // Now use 'client' which is the active connection
        return client.menu('/dude/device').get();
    })
    .then((data) => {
        console.log('Found devices:', data.length);
        console.log(data);
    })
    .catch((err) => {
        console.error('Error:', err);
    })
    .finally(() => {
        api.close();
    });
