const fs = require('fs');
const path = require('path');

try {
    const filePath = path.join(__dirname, '../docs/NODOS-10-07-2025.kml');
    const content = fs.readFileSync(filePath, 'utf8');

    // Find the block for Nodo Correntoso
    // It is likely <Placemark> ... <name>Nodo Correntoso</name> ... </Placemark>
    const parts = content.split('<name>Nodo Correntoso</name>');

    if (parts.length > 1) {
        // Look AFTER the name for description
        const after = parts[1];
        const descMatch = after.match(/<description>([\s\S]*?)<\/description>/);
        if (descMatch) {
            console.log("Description for Nodo Correntoso:");
            console.log(descMatch[1]);
        } else {
            console.log("No description found after name.");
            // Look BEFORE? Sometimes name is inside placemark but description is elsewhere? 
            // Standard KML has order, but <name> usually first.
        }

        // Also check if there's a link A3-CR
        console.log("\nSearching for links like A3-CR...");
        const linkParts = content.split('<name>A3-CR</name>');
        if (linkParts.length > 1) {
            const linkDesc = linkParts[1].match(/<description>([\s\S]*?)<\/description>/);
            if (linkDesc) console.log("A3-CR Desc:", linkDesc[1]);
        }

    } else {
        console.log("Could not split by name. Encoding issue?");
    }

} catch (err) {
    console.err(err);
}
