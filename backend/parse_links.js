const fs = require('fs');
const path = require('path');

try {
    const filePath = path.join(__dirname, '../docs/NODOS-10-07-2025.kml');
    const content = fs.readFileSync(filePath, 'utf8');

    const placemarks = content.match(/<Placemark>[\s\S]*?<\/Placemark>/g) || [];
    const links = [];

    placemarks.forEach(pm => {
        let nameMatch = pm.match(/<name>(.*?)<\/name>/);
        if (nameMatch) {
            const name = nameMatch[1].trim();
            // Look for patterns like "X - Y" or "X-Y"
            // Ignore "Nodo X" names, look for short codes usually
            if (name.includes('-') && !name.toUpperCase().startsWith('NODO')) {
                links.push(name);
            }
        }
    });

    console.log("Links found:", links.length);
    console.log(JSON.stringify(links.sort(), null, 2));

} catch (err) {
    console.error(err);
}
