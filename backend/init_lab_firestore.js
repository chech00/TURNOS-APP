/**
 * Script para inicializar dispositivos del Lab en Firestore
 * Ejecutar una sola vez: node init_lab_firestore.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Dispositivos iniciales del Lab (de The Dude)
const initialDevices = [
    { name: 'NODO ALERCE 3', ip: '0.0.0.0', status: 'up' },
    { name: 'PONA-0', ip: '0.0.0.0', status: 'up' },
    { name: 'PONA-1', ip: '0.0.0.0', status: 'up' },
];

async function initializeLab() {
    console.log('🚀 Inicializando dispositivos del Lab en Firestore...\n');

    const batch = db.batch();

    for (const device of initialDevices) {
        const docRef = db.collection('lab_devices').doc(device.name);
        batch.set(docRef, {
            name: device.name,
            ip: device.ip,
            status: device.status,
            lastUpdate: new Date(),
            reason: 'initial_setup'
        });
        console.log(`  ✅ ${device.name}`);
    }

    await batch.commit();

    console.log(`\n🎉 ${initialDevices.length} dispositivos agregados exitosamente!`);
    console.log('Ahora aparecerán en GitHub/Render y en local.\n');

    process.exit(0);
}

initializeLab().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
