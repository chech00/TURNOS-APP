const fs = require('fs');
const path = require('path');

try {
    const filePath = path.join(__dirname, '../docs/NODOS-10-07-2025.kml');
    const content = fs.readFileSync(filePath, 'utf8');

    const placemarks = content.match(/<Placemark>[\s\S]*?<\/Placemark>/g) || [];
    const rf_links = [];

    placemarks.forEach(pm => {
        let nameMatch = pm.match(/<name>(.*?)<\/name>/);
        if (nameMatch) {
            const name = nameMatch[1].trim();
            // Filter for RF, Enlace, or specific codes
            if (name.toUpperCase().includes('RF') || name.toUpperCase().includes('ENLACE')) {
                let desc = "No description";
                let descMatch = pm.match(/<description>([\s\S]*?)<\/description>/);
                if (descMatch) desc = descMatch[1].trim();

                rf_links.push({ name, desc });
            }
        }
    });

    console.log("RF/Links Found:", rf_links.length);
    rf_links.forEach(l => {
        console.log(`\nName: ${l.name}`);
        console.log(`Desc: ${l.desc.replace(/\n/g, ' | ')}`);
    });

} catch (err) {
    console.error(err);
}
