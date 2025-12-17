const fs = require('fs');
const path = require('path');

try {
    const filePath = path.join(__dirname, '../docs/NODOS-10-07-2025.kml');
    const content = fs.readFileSync(filePath, 'utf8');

    // Extract Placemarks
    const placemarks = content.match(/<Placemark>[\s\S]*?<\/Placemark>/g) || [];
    const dependencies = {}; // Parent -> Set(Children) to avoid dupes initially

    function addDependency(parent, child) {
        // Normalize names
        const p = parent.toUpperCase().trim().replace(/^NODO\s+/, 'NODO '); // Stanardize "NODO X"
        const c = child.toUpperCase().trim().replace(/^NODO\s+/, 'NODO ');

        if (p === c) return; // Ignore self-reference
        if (p.length < 3 || c.length < 3) return;

        if (!dependencies[p]) dependencies[p] = new Set();
        dependencies[p].add(c);
    }

    placemarks.forEach(pm => {
        let nameMatch = pm.match(/<name>(.*?)<\/name>/);
        let descMatch = pm.match(/<description>([\s\S]*?)<\/description>/);

        if (nameMatch) {
            const placemarkName = nameMatch[1].trim();
            // Only process nodes (ignore links/points if they don't look like nodes)
            // But user names are "Nodo X".

            if (descMatch) {
                let desc = descMatch[1];

                // Strategy 1: "PRINCIPAL" tag (Explicit Parent)
                // Desc: "... PRINCIPAL \n - NODO PARENT ..."
                // Here PlacemarkName is the CHILD.
                if (desc.includes('PRINCIPAL')) {
                    const parts = desc.split('PRINCIPAL');
                    const principalPart = parts[1];
                    const lines = principalPart.split('\n');
                    lines.forEach(line => {
                        let clean = line.trim().replace(/^-/, '').trim();
                        if (clean && clean.toUpperCase().includes('NODO')) {
                            // clean is PARENT, placemarkName is CHILD
                            addDependency(clean, placemarkName);
                        }
                    });
                }

                // Strategy 2: "DEPENDENCIA" list (Implicit Hierarchy)
                // Desc: "DEPENDENCIA \n - NODO SELF \n - NODO CHILD 1 \n - NODO CHILD 2"
                if (desc.includes('DEPENDENCIA')) {
                    // Extract the text between DEPENDENCIES and end or next section
                    let depBlock = desc.split('DEPENDENCIA')[1];
                    // Cut off at next keyword if any (like PRINCIPAL or RESPALDO)
                    depBlock = depBlock.split(/(PRINCIPAL|RESPALDO)/)[0];

                    const lines = depBlock.split('\n').map(l => l.trim().replace(/^-/, '').trim()).filter(l => l.length > 0);

                    if (lines.length > 1) {
                        // Assumption: First item is the Parent (often the node itself), subsequent are Children
                        // Verify if first item vaguely matches placemark name
                        const firstItem = lines[0];
                        // If lines[0] ~= placemarkName, then lines[1..n] are children of lines[0]

                        // Let's indiscriminately say Line 0 is parent of Line 1..N
                        // Because if Node A lists [A, B, C], A is parent of B and C.

                        const parentNode = lines[0];
                        for (let i = 1; i < lines.length; i++) {
                            addDependency(parentNode, lines[i]);
                        }
                    }
                }
            }
        }
    });

    // Convert Sets to Arrays for JSON
    const output = {};
    Object.keys(dependencies).sort().forEach(key => {
        output[key] = Array.from(dependencies[key]).sort();
    });

    console.log(JSON.stringify(output, null, 2));

} catch (err) {
    console.error("Error parsing:", err);
}
