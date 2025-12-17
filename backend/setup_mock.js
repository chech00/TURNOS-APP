const fs = require('fs');
const path = require('path');

// LISTA DE NODOS (Copiada del proyecto)
const NODES = [
    "NODO ALERCE 3", "NODO CORRENTOSO", "NODO RIO SUR", "NODO RIO SUR 2",
    "NODO PUERTO MONTT", "NODO LENCA", "NODO LAS QUEMAS 2", "NODO LOS MUERMOS",
    "NODO PANITAO", "NODO NUEVA BRAUNAU", "NODO LLANQUIHUE", "NODO FRUTILLAR",
    "NODO DATA CENTER PM", "CASCADA", "CASMA"
];

const PONS_ALERCE3 = [
    "NODO ALERCE 3_PON_A0", "NODO ALERCE 3_PON_A1", "NODO ALERCE 3_PON_A2"
];

const DB_FILE = path.join(__dirname, 'lab_state.json');

function main() {
    console.log("🛠️ INITIALIZING MOCK LAB STATE...");

    const devices = [];
    let idCounter = 100;

    // Create Main Nodes
    NODES.forEach(name => {
        devices.push({
            name: name,
            status: 'up',
            ip: `192.168.1.${idCounter}`,
            services: { ping: 'up' }
        });
        idCounter++;
    });

    // Create PONs
    PONS_ALERCE3.forEach(name => {
        devices.push({
            name: name,
            status: 'up',
            ip: `192.168.1.${idCounter}`,
            services: { ping: 'up' }
        });
        idCounter++;
    });

    fs.writeFileSync(DB_FILE, JSON.stringify(devices, null, 2));
    console.log(`✅ Lab State saved to ${DB_FILE} with ${devices.length} devices.`);
}

main();
