
const axios = require('axios');

const URL = 'http://localhost:3000/webhook/dude';
const TOKEN = 'SUPER_SECRET_DUDE_TOKEN_2024';

async function runTest() {
    try {
        console.log("SENDING DOWN...");
        const startDown = Date.now();
        const resDown = await axios.post(URL, {
            device: "TEST-NODE-SPEED",
            status: "down",
            message: "Speed Test Down"
        }, {
            headers: { 'x-webhook-token': TOKEN }
        });
        console.log(`DOWN Response: ${resDown.status} in ${Date.now() - startDown}ms`);
        console.log(resDown.data);

        await new Promise(r => setTimeout(r, 2000));

        console.log("SENDING UP...");
        const startUp = Date.now();
        const resUp = await axios.post(URL, {
            device: "TEST-NODE-SPEED",
            status: "up",
            message: "Speed Test Up"
        }, {
            headers: { 'x-webhook-token': TOKEN }
        });
        console.log(`UP Response: ${resUp.status} in ${Date.now() - startUp}ms`);
        console.log(resUp.data);

    } catch (e) {
        console.error("Error:", e.response ? e.response.data : e.message);
    }
}

runTest();
