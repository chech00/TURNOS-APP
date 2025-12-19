const { db } = require("../config/firebase");
const uptimeController = require("./uptimeController");
const { getDependentNodes } = require("../utils/dependencies");

// Secret token for security (should be in env vars in production)
const WEBHOOK_SECRET = process.env.DUDE_WEBHOOK_SECRET || "SUPER_SECRET_DUDE_TOKEN_2024";

// Allowed IPs (The Dude server)
const ALLOWED_IPS = ['192.168.1.32', '127.0.0.1', '::1'];

/**
 * Handle incoming webhook from The Dude
 * Payload example: { "device": "NUEVA BRAUNAU", "status": "down", "ip": "192.168.1.13", "message": "Service PING is down" }
 */
async function handleDudeWebhook(req, res) {
    try {
        const { device, status, ip, message } = req.body;
        const token = req.headers['x-webhook-token'];

        // 1. Security Checks
        if (token !== WEBHOOK_SECRET) {
            console.warn(`⛔ Webhook unauthorized attempt from ${req.ip}`);
            return res.status(403).json({ error: "Unauthorized" });
        }

        const requestIP = req.ip.replace('::ffff:', ''); // Normalize IPv4
        if (!ALLOWED_IPS.includes(requestIP) && !process.env.SKIP_IP_CHECK) {
            console.warn(`⛔ Webhook IP blocked: ${requestIP}`);
        }

        if (!device || !status) {
            return res.status(400).json({ error: "Missing device or status" });
        }

        const nodeName = device.toUpperCase().trim();
        const isDown = status.toLowerCase() === 'down';

        console.log(`📨 Webhook received: ${nodeName} is ${isDown ? 'DOWN' : 'UP'}`);

        // --- NEW: UPDATE MEMORY CACHE ---
        uptimeController.updateDeviceCache(nodeName, isDown ? 'down' : 'up', message || "Webhook Event");

        // --- TRANSLATION LAYER (Device Map) ---
        // MOVED UP to ensure UP events also map correctly (e.g. PONA-0 -> NODO ALERCE 3)
        const { deviceMap, findNodeByIp } = require("../utils/dependencies");

        // Normalize IP and perform mapping check
        const cleanIP = (ip || '').trim();
        let mapping = null;
        let mappedNodeName = null;
        let mappedFailureType = "Corte Detectado por The Dude";
        let mappedAffectedPons = ["SISTEMA"];
        let mappedIsPonFailure = false; // Renamed to avoid collision with inner scopes if any

        if (cleanIP) {
            const found = findNodeByIp(cleanIP);
            if (found) {
                mapping = found;
                console.log(`🗺️ Found Map by IP ${cleanIP}`);
            }
        }
        if (!mapping && deviceMap[nodeName]) {
            mapping = deviceMap[nodeName];
            console.log(`🗺️ Found Map by Name ${nodeName}`);
        }

        if (mapping) {
            mappedNodeName = mapping.node;
            if (mapping.pon) {
                const ponId = mapping.pon;
                mappedAffectedPons = [`PON ${ponId}`];
                mappedFailureType = `Corte de PON ${ponId} (Detectado por Dude)`;
                mappedIsPonFailure = true;
                console.log(`✅ Mapped EXPLICIT PON: ${nodeName} -> ${mappedNodeName} [PON ${ponId}]`);
            } else {
                const ponMatch = nodeName.match(/PON[-_ ]?([A-Z0-9]+)/i);
                if (ponMatch) {
                    const ponId = ponMatch[1].toUpperCase();
                    mappedAffectedPons = [`PON ${ponId}`];
                    mappedFailureType = `Corte de PON ${ponId} (Detectado por Dude)`;
                    mappedIsPonFailure = true;
                    console.log(`✅ Mapped IMPLIED PON: ${nodeName} -> ${mappedNodeName} [PON ${ponId}]`);
                } else {
                    mappedAffectedPons = ["NODO_COMPLETO"];
                    mappedFailureType = "Corte de NODO (Detectado por Dude)";
                    mappedIsPonFailure = false;
                    console.log(`✅ Mapped MAIN NODE: ${nodeName} -> ${mappedNodeName} (Cascade Enabled)`);
                }
            }
        } else if (nodeName.includes("_PON_")) {
            // Fallback
            const parts = nodeName.split("_PON_");
            mappedNodeName = parts[0].trim();
            const ponId = parts[1].trim();
            mappedAffectedPons = [`PON ${ponId}`];
            mappedFailureType = `Corte de PON ${ponId} (Detectado por Dude)`;
            mappedIsPonFailure = true;
            console.log(`🔎 PON Failure Detected (Convention): Node=${mappedNodeName}, PON=${ponId}`);
        }

        // 2. Check for existing open incident
        const possibleNames = [nodeName];
        if (!nodeName.startsWith("NODO ")) possibleNames.push("NODO " + nodeName);
        if (nodeName.startsWith("NODO ")) possibleNames.push(nodeName.replace("NODO ", ""));

        // Add Mapped Name to search criteria
        if (mappedNodeName && !possibleNames.includes(mappedNodeName)) {
            possibleNames.push(mappedNodeName);
            possibleNames.push(mappedNodeName.toUpperCase().trim());
        }

        // Fetch active incidents to check against
        const activeSnapshot = await db.collection("uptime_logs")
            .where("end_date", "==", null)
            .get();

        let activeIncident = null;
        activeSnapshot.forEach(doc => {
            const data = doc.data();
            const activeName = (data.node || "").toUpperCase().trim();
            if (possibleNames.includes(activeName)) {
                activeIncident = doc;
            }
        });

        if (isDown) {
            // --- HANDLE DOWN ---
            if (activeIncident) {
                console.log(`ℹ️ Incident already active for ${nodeName} (Found: ${activeIncident.data().node}), ignoring.`);
                return res.json({ message: "Incident already active" });
            }

            // Create new incident
            const ticketId = 'T' + Math.floor(100000 + Math.random() * 900000);
            const now = new Date();

            // Use Pre-calculated Mapping
            const finalNodeName = mappedNodeName || nodeName;
            const finalAffectedPons = mappedAffectedPons;
            const finalFailureType = mappedFailureType;
            const isPonFailure = mappedIsPonFailure;

            const newIncident = {
                ticket_id: ticketId,
                node: finalNodeName,
                node_id: "DUDE_" + nodeName.replace(/\s+/g, '_'),
                failure_type: finalFailureType,
                failure_reason: message || "Reportado vía Webhook",
                start_date: now,
                end_date: null,
                affected_customers: 0,
                affected_pons: finalAffectedPons,
                created_at: now,
                source: "webhook"
            };

            await db.collection("uptime_logs").add(newIncident);
            console.log(`✅ Incident created via Webhook: ${ticketId}`);

            // --- CASCADE DEPENDENCIES (ONLY IF FULL NODE DOWN) ---
            if (!isPonFailure) {
                // Add intentional delay to let DB write propagate
                // await new Promise(resolve => setTimeout(resolve, 500)); 

                const dependents = getDependentNodes(finalNodeName, true);
                if (dependents.length > 0) {
                    console.log(`🔗 Found ${dependents.length} dependent nodes for ${finalNodeName}:`, dependents);

                    for (const depName of dependents) {
                        // Check if dependent has active ticket
                        let depActive = false;
                        const depPossible = [depName, "NODO " + depName, depName.replace("NODO ", "")];

                        // Loop activeSnapshot (Memory check against START state)
                        // Ideally we should re-query, but for speed we rely on snapshot.
                        // Since multiple recursive calls might happen, robust checking is key.

                        activeSnapshot.forEach(doc => {
                            const d = doc.data();
                            const n = (d.node || "").toUpperCase().trim();
                            if (depPossible.includes(n)) depActive = true;
                        });

                        if (depActive) {
                            console.log(`⏩ Dependent ${depName} already has ticket, skipping.`);
                            continue;
                        }

                        // Create Dependent Ticket
                        const depId = 'T' + Math.floor(100000 + Math.random() * 900000);
                        const depIncident = {
                            ticket_id: depId,
                            node: depName,
                            node_id: "AUTO_DEP_" + depName.replace(/\s+/g, '_'),
                            failure_type: `Caída por Dependencia de ${finalNodeName}`,
                            failure_reason: `Nodo padre ${finalNodeName} caído (Webhook)`,
                            start_date: now,
                            end_date: null,
                            affected_customers: 0,
                            affected_pons: ["POR_DEPENDENCIA"],
                            created_at: now,
                            source: "webhook_cascade",
                            caused_by_node: finalNodeName
                        };

                        await db.collection("uptime_logs").add(depIncident);
                        console.log(`🔗 Created Cascade Incident for ${depName} (${depId})`);
                    }
                }
            } else {
                console.log(`ℹ️ Partial failure (PON), skipping dependency cascade for ${finalNodeName}`);
            }

            return res.json({ message: "Incident created", ticket_id: ticketId });

        } else {
            // --- HANDLE UP ---
            if (!activeIncident) {
                console.log(`ℹ️ No active incident for ${nodeName} to close.`);
                return res.json({ message: "No active incident to close" });
            }

            // Close existing incident
            const now = new Date();
            const iData = activeIncident.data();
            const iStart = iData.start_date.toDate ? iData.start_date.toDate() : new Date(iData.start_date);
            const restoreTime = Math.floor((now - iStart) / 60000);

            await activeIncident.ref.update({
                end_date: now,
                notes: ((iData.notes || "") + "\n[Auto] Cerrado por The Dude Webhook").trim(),
                needs_review: true,
                restore_time: restoreTime,
                pct_uptime_customer_failure: 1 // Default 100%
            });

            console.log(`✅ Incident closed via Webhook: ${activeIncident.id} (Duration: ${restoreTime}m)`);

            // --- CLOSE CASCADE DEPENDENCIES ---
            // Use Mapped Name if available, otherwise original
            const targetNodeName = mappedNodeName || nodeName;

            const cascadeSnapshot = await db.collection("uptime_logs")
                .where("end_date", "==", null)
                .where("caused_by_node", "==", targetNodeName) // NOW CORRECT: Checks against "NODO ALERCE 3"
                .get();

            if (!cascadeSnapshot.empty) {
                console.log(`🔗 Closing ${cascadeSnapshot.size} dependent incidents caused by ${targetNodeName}`);
                const batch = db.batch();
                cascadeSnapshot.forEach(doc => {
                    const cData = doc.data();
                    const cStart = cData.start_date.toDate ? cData.start_date.toDate() : new Date(cData.start_date);
                    const cDiff = Math.floor((now - cStart) / 60000);

                    batch.update(doc.ref, {
                        end_date: now,
                        notes: ((cData.notes || "") + `\n[Auto] Cerrado: Nodo padre ${targetNodeName} recuperado`).trim(),
                        needs_review: true,
                        restore_time: cDiff,
                        pct_uptime_customer_failure: 1
                    });
                });
                await batch.commit();
            }

            return res.json({ message: "Incident closed", id: activeIncident.id });
        }

    } catch (error) {
        console.error("❌ Webhook Error:", error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = { handleDudeWebhook };
