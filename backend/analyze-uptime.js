const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Leer el archivo HTML exportado
const htmlPath = path.join(__dirname, '..', 'Uptime PatagoniaIP 2023', 'Uptime OKR.html');

console.log('='.repeat(80));
console.log(`LEYENDO ARCHIVO HTML: ${htmlPath}`);
console.log('='.repeat(80));

try {
    // XLSX puede parsear tablas HTML
    const workbook = XLSX.readFile(htmlPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convertir a JSON (array de arrays) para inspeccionar
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log(`\n✅ Archivo leído correctamente.`);
    console.log(`📊 Total de filas encontradas: ${data.length}`);

    // Buscar la fila de encabezados
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(data.length, 20); i++) {
        const row = data[i];
        // Buscamos columnas clave como 'ID_TICKET' o 'Fecha de Inicio'
        if (row && row.some(cell => cell && String(cell).includes('ID_TICKET'))) {
            headerRowIndex = i;
            break;
        }
    }

    if (headerRowIndex !== -1) {
        console.log(`\n🏷️  Encabezados encontrados en la fila ${headerRowIndex + 1}:`);
        console.log(data[headerRowIndex]);

        console.log('\n📝 Primeras 5 filas de datos:');
        const sampleRows = data.slice(headerRowIndex + 1, headerRowIndex + 6);
        sampleRows.forEach((row, idx) => {
            // Limpiar datos vacíos para visualización
            const cleanRow = row.map(cell => cell === undefined ? '[VACÍO]' : cell);
            console.log(`  Fila ${idx + 1}:`, cleanRow);
        });

        // Mapeo detallado de columnas
        const headers = data[headerRowIndex];
        const map = headers.reduce((acc, h, i) => {
            if (h) acc[i] = h;
            return acc;
        }, {});

        console.log('\n🗺️  Mapeo de Columnas Detectado:');
        console.log(map);

    } else {
        console.error('❌ No se encontró la fila de encabezados (ID_TICKET).');
        console.log('Primeras 3 filas crudas:', data.slice(0, 3));
    }

} catch (error) {
    console.error('\n❌ ERROR al leer el archivo:', error.message);
    if (error.code === 'ENOENT') {
        console.error('Verifique que la ruta al archivo sea correcta.');
    }
}
