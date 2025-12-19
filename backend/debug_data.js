
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkTicket() {
    console.log("Reading tickets...");
    const snapshot = await db.collection('uptime_logs')
        .orderBy('created_at', 'desc')
        .limit(5)
        .get();

    snapshot.forEach(doc => {
        const d = doc.data();
        console.log(`\nTicket: ${d.ticket_id}`);
        console.log(`  End Date: ${d.end_date ? d.end_date.toDate() : 'null'}`);
        console.log(`  Restore Time (DB):`, d.restore_time); // Ensure comma to see type
        console.log(`  % Uptime (DB):`, d.pct_uptime_customer_failure);
        console.log(`  Type of restore_time:`, typeof d.restore_time);
    });
}

checkTicket();
