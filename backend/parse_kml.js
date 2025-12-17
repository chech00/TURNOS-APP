const fs = require('fs');
const path = require('path');

try {
    const filePath = path.join(__dirname, '../docs/NODOS-10-07-2025.kml');
    const content = fs.readFileSync(filePath, 'utf8');

    const placemarks = content.match(/<Placemark>[\s\S]*?<\/Placemark>/g) || [];
    const dependencies = {}; // Parent -> [Children]

    placemarks.forEach(pm => {
        const nameMatch = pm.match(/<name>(.*?)<\/name>/);
        const descMatch = pm.match(/<description>([\s\S]*?)<\/description>/);

        if (nameMatch && descMatch) {
            const nodeName = nameMatch[1].trim(); // This is the CHILD
            const desc = descMatch[1];

            // Look for PRINCIPAL section
            if (desc.includes('PRINCIPAL')) {
                const parts = desc.split('PRINCIPAL');
                const principalPart = parts[1]; // Text after PRINCIPAL in description

                // Parse lines after PRINCIPAL
                const lines = principalPart.split('\n');
                lines.forEach(line => {
                    const cleanLine = line.trim();
                    if (cleanLine.startsWith('-') || cleanLine.startsWith('•')) {
                        let parent = cleanLine.replace(/[-•]/, '').trim();

                        // Normalize: "NODO X" -> "X" could be better, but let's keep full name first
                        // Clean up parent name (remove potential extra chars)
                        parent = parent.replace(/<.*?>/g, ''); // Remove regex html tags if any

                        if (parent.length > 2) { // Valid name
                            if (!dependencies[parent]) dependencies[parent] = [];
                            // Avoid duplicates
                            if (!dependencies[parent].includes(nodeName)) {
                                dependencies[parent].push(nodeName);
                            }
                        }
                    }
                });
            }
        }
    });

    console.log(JSON.stringify(dependencies, null, 2));

} catch (err) {
    console.error("Error parsing KML:", err);
}
