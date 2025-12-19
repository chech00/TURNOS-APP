const { db } = require("../config/firebase");

async function inspectTickets() {
    const ids = ["T714355", "T242646"];
    console.log(`🔍 Inspecting Tickets: ${ids.join(", ")}`);

    const snapshot = await db.collection("uptime_logs")
        .where("ticket_id", "in", ids)
        .get();

    if (snapshot.empty) {
        console.log("❌ No documents found.");
        return;
    }

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`\n🎫 Ticket: ${data.ticket_id}`);
        console.log(`   Source: ${data.source || 'Manual'}`);
        console.log(`   Node: '${data.node}'`);
        console.log(`   Node Hex: ${Buffer.from(data.node).toString('hex')}`);
        console.log(`   End Date: ${data.end_date}`);
        console.log(`   End Date Type: ${typeof data.end_date}`);
        console.log(`   Created: ${data.created_at.toDate().toISOString()}`);
    });
}

inspectTickets().catch(console.error);
