const fs = require('fs');
const path = require('path');

try {
    const filePath = path.join(__dirname, '../docs/NODOS-10-07-2025.kml');
    const content = fs.readFileSync(filePath, 'utf8');

    const placemarks = content.match(/<Placemark>[\s\S]*?<\/Placemark>/g) || [];
    const masterData = {};

    placemarks.forEach(pm => {
        let nameMatch = pm.match(/<name>(.*?)<\/name>/);
        if (nameMatch) {
            const name = nameMatch[1].trim();
            const descMatch = pm.match(/<description>([\s\S]*?)<\/description>/);

            if (descMatch) {
                const desc = descMatch[1];
                const cleanDesc = desc.replace(/<.*?>/g, '\n'); // Strip HTML tags

                // Categorize info
                const depMatch = cleanDesc.match(/DEPENDENCIA[\s\S]*?(?=PRINCIPAL|RESPALDO|$)/i);
                const prinMatch = cleanDesc.match(/PRINCIPAL[\s\S]*?(?=DEPENDENCIA|RESPALDO|$)/i);
                const respMatch = cleanDesc.match(/RESPALDO[\s\S]*?(?=DEPENDENCIA|PRINCIPAL|$)/i);

                // Helper to parse lists
                const parseList = (text) => {
                    if (!text) return [];
                    return text.split('\n')
                        .map(l => l.trim().replace(/^[-•]/, '').trim())
                        .filter(l => l.toUpperCase().includes('NODO') || l.toUpperCase().includes('ENLACE'));
                };

                const dependencies = depMatch ? parseList(depMatch[0].replace(/DEPENDENCIA/i, '')) : [];
                const principals = prinMatch ? parseList(prinMatch[0].replace(/PRINCIPAL/i, '')) : [];
                const backups = respMatch ? parseList(respMatch[0].replace(/RESPALDO/i, '')) : [];

                if (dependencies.length || principals.length || backups.length) {
                    masterData[name] = {
                        dependencies,
                        principals,
                        backups
                    };
                }
            }
        }
    });

    console.log(JSON.stringify(masterData, null, 2));

} catch (err) {
    console.error(err);
}
