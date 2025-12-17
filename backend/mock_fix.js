const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'lab_state.json');

function main() {
    const target = process.argv[2];
    if (!target) {
        console.log("Usage: node mock_fix.js \"NODO NAME\"");
        return;
    }

    const db = JSON.parse(fs.readFileSync(DB_FILE));
    const device = db.find(d => d.name.toLowerCase() === target.toLowerCase());

    if (device) {
        device.status = 'up';
        device.services.ping = 'up';
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
        console.log(`✅ FIX SIMULATED: ${device.name} is now UP.`);
    } else {
        console.error(`❌ Node "${target}" not found.`);
    }
}

main();
