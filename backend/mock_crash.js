const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'lab_state.json');

function main() {
    const target = process.argv[2]; // Node name from command line
    if (!target) {
        console.log("Usage: node mock_crash.js \"NODO NAME\"");
        // List available
        const db = JSON.parse(fs.readFileSync(DB_FILE));
        console.log("Available Nodes:", db.map(d => d.name).join(', '));
        return;
    }

    const db = JSON.parse(fs.readFileSync(DB_FILE));
    const device = db.find(d => d.name.toLowerCase() === target.toLowerCase());

    if (device) {
        device.status = 'down';
        device.services.ping = 'down';
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
        console.log(`🔥 CRASH SIMULATED: ${device.name} is now DOWN.`);
    } else {
        console.error(`❌ Node "${target}" not found.`);
    }
}

main();
