const { db } = require('../config/firebase');
const fs = require('fs');

/**
 * Procesa el archivo KML subido y actualiza la jerarquía en Firestore.
 * Estructura: Nodos -> {NodeName} -> PONLetters -> {Letter} -> PONs -> {PonName}
 */
async function uploadKml(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se subió ningún archivo KML.' });
        }

        // const filePath = req.file.path; // No existe con memoryStorage
        // console.log(`📂 Procesando KML: ${filePath}`);

        const content = req.file.buffer.toString('utf8');
        const targetNode = req.body.targetNode; // Nuevo parámetro opcional

        let hierarchy;
        if (targetNode) {
            console.log(`🎯 Forzando importación al nodo: ${targetNode}`);
            // Si hay targetNode, ignoramos la detección de padres y asignamos todo a este nodo
            const allPons = extractAllPlacemarksNames(content);
            hierarchy = { [targetNode]: allPons };
        } else {
            // Comportamiento original: Auto-detección
            hierarchy = parseKmlContent(content);
        }

        // 2. Subir a Firestore
        const result = await uploadHierarchyToFirestore(hierarchy);

        // 3. Limpiar archivo temporal (No necesario con memoryStorage)
        // fs.unlinkSync(filePath);

        res.json({
            message: 'Importación completada exitosamente',
            stats: result
        });

    } catch (error) {
        console.error('❌ Error procesando KML:', error);
        // Intentar borrar archivo si existe
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: `Error interno: ${error.message}` });
    }
}

/**
 * Parsea el contenido XML/KML y devuelve un objeto { "NODO X": ["PON1", "PON2"] }
 */
function parseKmlContent(content) {
    const dependencies = {};
    // Regex flexible para <Placemark> o <Placemark ...>
    const placemarks = content.match(/<Placemark[^>]*>[\s\S]*?<\/Placemark>/g) || [];

    const addDependency = (parent, child) => {
        // Normalizar nombres
        const p = parent.toUpperCase().trim().replace(/^NODO\s+/, 'NODO ');
        const c = child.toUpperCase().trim().replace(/^NODO\s+/, 'NODO ');

        if (p === c) return;
        if (p.length < 3 || c.length < 3) return;

        if (!dependencies[p]) dependencies[p] = new Set();
        dependencies[p].add(c);
    };

    placemarks.forEach(pm => {
        // Regex flexible para <name> y <description>
        const nameMatch = pm.match(/<name[^>]*>(.*?)<\/name>/);
        const descMatch = pm.match(/<description[^>]*>([\s\S]*?)<\/description>/);

        if (nameMatch && descMatch) {
            const placemarkName = nameMatch[1].trim(); // El hijo (generalmente)
            const desc = descMatch[1];

            // Estrategia 1: Buscar "PRINCIPAL"
            if (desc.includes('PRINCIPAL')) {
                const parts = desc.split('PRINCIPAL');
                if (parts[1]) {
                    const lines = parts[1].split('\n');
                    lines.forEach(line => {
                        let clean = line.trim().replace(/^-/, '').trim();
                        if (clean && clean.toUpperCase().includes('NODO')) {
                            // clean es PADRE, placemarkName es HIJO
                            addDependency(clean, placemarkName);
                        }
                    });
                }
            }

            // Estrategia 2: Buscar "DEPENDENCIA"
            if (desc.includes('DEPENDENCIA')) {
                let depBlock = desc.split('DEPENDENCIA')[1];
                depBlock = depBlock.split(/(PRINCIPAL|RESPALDO)/)[0]; // Cortar antes de otras secciones

                const lines = depBlock.split('\n')
                    .map(l => l.trim().replace(/^-/, '').trim())
                    .filter(l => l.length > 0);

                if (lines.length > 1) {
                    // Asumimos: Línea 0 es PADRE, Líneas 1..N son HIJOS
                    const parentNode = lines[0];
                    for (let i = 1; i < lines.length; i++) {
                        addDependency(parentNode, lines[i]);
                    }
                }
            }
        }
    });

    // Convertir Sets a Arrays
    const output = {};
    Object.keys(dependencies).forEach(key => {
        output[key] = Array.from(dependencies[key]);
    });

    return output;
}

/**
 * Extrae TODOS los nombres de Placemarks del KML (para asignación manual)
 */
function extractAllPlacemarksNames(content) {
    // Regex flexible para coincidir con <Placemark> o <Placemark ...>
    const placemarks = content.match(/<Placemark[^>]*>[\s\S]*?<\/Placemark>/g) || [];
    const names = new Set();

    placemarks.forEach(pm => {
        // Regex flexible para <name> o <name >
        const nameMatch = pm.match(/<name[^>]*>(.*?)<\/name>/);
        if (nameMatch) {
            const name = nameMatch[1].trim();
            // Filtrar nombres que parezcan carpetas o nodos padres si es necesario
            // Por ahora asumimos que todo placemark es un PON/Caja válido
            if (name.length > 2) {
                names.add(name);
            }
        }
    });

    return Array.from(names);
}

/**
 * Sube la jerarquía parseada a Firestore
 */
async function uploadHierarchyToFirestore(hierarchy) {
    const batchSize = 400;
    let batch = db.batch();
    let count = 0;
    let totalPons = 0;
    let nodesUpdated = 0;

    for (const [nodeName, ponList] of Object.entries(hierarchy)) {
        // 1. Nodo Principal
        const nodeRef = db.collection('Nodos').doc(nodeName);
        batch.set(nodeRef, {
            name: nodeName,
            updatedAt: new Date(),
            source: 'kml_import'
        }, { merge: true });
        nodesUpdated++;

        // 0. LIMPIEZA PREVIA (Opcional pero recomendada para evitar basura)
        // Para ser seguros, borramos las colecciones de letras existentes para este nodo
        // o al menos marcamos los PONs antiguos como 'deleted' si quisiéramos soft-delete.
        // Dado el requerimiento "aun está importando mal", asumimos que quieren CLEAN SLATE.

        // NOTA: Borrar colecciones enteras desde Cloud Functions/Admin SDK es fácil, 
        // pero desde aquí iteramos para borrar lo que encontremos.
        // Para simplificar y no hacer miles de lecturas, confiaremos en que el filtro ESTRICTO 
        // evitará agregar basura nueva, y el usuario verá solo lo nuevo limpio.
        // PERO para arreglar lo que ya está sucio, necesitamos borrar.

        console.log(`🧹 Iniciando limpieza de PONs antiguos para ${nodeName}...`);

        // Estrategia de limpieza robusta:
        // 1. Listar TODOS los documentos en PONLetters
        // 2. Para cada carta, borrar recursively su subcolección 'PONs'
        // 3. Borrar la carta

        const lettersCollectionRef = nodeRef.collection('PONLetters');
        const existingLetters = await lettersCollectionRef.listDocuments();

        if (existingLetters.length > 0) {
            console.log(`Find ${existingLetters.length} letters to clean.`);

            for (const letterDoc of existingLetters) {
                // Borrar subcoleccion PONs
                const ponsInLetter = await letterDoc.collection('PONs').listDocuments();

                if (ponsInLetter.length > 0) {
                    // Batch delete (max 400 per batch safe limit)
                    const deleteBatch = db.batch();
                    let deleteCount = 0;

                    for (const p of ponsInLetter) {
                        deleteBatch.delete(p);
                        deleteCount++;

                        if (deleteCount >= 400) {
                            await deleteBatch.commit();
                            deleteCount = 0;
                        }
                    }
                    if (deleteCount > 0) await deleteBatch.commit();
                }

                // Borrar el documento de la letra (e.g., 'A', 'B', 'OTHERS')
                // OJO: Si hay basura en "OTHERS" o letras raras, esto las borrará todas.
                await letterDoc.delete();
            }
        }
        console.log("✨ Limpieza completada exitosamente.");

        batch = db.batch(); // Re-initialize batch after deletion
        count = 0;
        totalPons = 0;

        // 2. PONs
        for (const ponName of ponList) {
            // =========================================================
            // NUEVA LÓGICA DE FILTRADO Y LIMPIEZA (STRICT MODE V2)
            // =========================================================

            // Regex ULTRA estricto solicitado por usuario: "PON+LETR+NUMERO"
            // Ejemplos: "QT_PONA8_C4..." -> Extraccion: "PONA8" -> "PON A8"
            // Debe ignorar "Cajas", "Postes", "1302", etc.

            // Buscamos patrones como "PONA6", "PON A6", "PON-A6"
            // ignorando mayus/minus
            const ponRegex = /PON\s*[\-_]?\s*([A-F][0-9]{1,3})/i;
            const match = ponName.match(ponRegex);

            if (!match) continue;

            const code = match[1].toUpperCase(); // "A8", "B1"
            const letter = code.charAt(0);       // "A", "B"

            // Validación extra: La letra debe ser A-F (o R)
            if (!['A', 'B', 'C', 'D', 'E', 'F', 'R'].includes(letter)) {
                continue;
            }

            const cleanName = `PON ${code}`;     // "PON A8"

            // =========================================================

            // 3. Guardar en Firestore

            // A. Colección PONLetters (La Tarjeta)
            const lettersRef = nodeRef.collection('PONLetters').doc(letter);
            batch.set(lettersRef, {
                id: letter,
                name: letter
            }, { merge: true });

            // B. Documento PON
            const ponRef = lettersRef.collection('PONs').doc(cleanName);

            // OJO: Usamos set SIN merge para sobrescribir cualquier basura previa si existiera con este ID
            batch.set(ponRef, {
                name: cleanName,        // "PON A8"
                status: 'ok',
                updatedAt: new Date()
            }); // removed matching originalName to keep DB clean as requested

            count += 2;
            totalPons++;

            if (count >= batchSize) {
                await batch.commit();
                batch = db.batch();
                count = 0;
            }
        }
    }

    if (count > 0) {
        await batch.commit();
    }

    return { nodes: nodesUpdated, pons: totalPons };
}

module.exports = {
    uploadKml
};
