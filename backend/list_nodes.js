const fs = require('fs');
const path = require('path');

try {
    const filePath = path.join(__dirname, '../docs/NODOS-10-07-2025.kml');
    const content = fs.readFileSync(filePath, 'utf8');

    const names = [];
    const placemarks = content.match(/<Placemark>[\s\S]*?<\/Placemark>/g) || [];

    placemarks.forEach(pm => {
        let nameMatch = pm.match(/<name>(.*?)<\/name>/);
        if (nameMatch) {
            names.push(nameMatch[1].trim());
        }
    });

    console.log("Total Nodes Found:", names.length);
    console.log(JSON.stringify(names.sort(), null, 2));

} catch (err) {
    console.error(err);
}
