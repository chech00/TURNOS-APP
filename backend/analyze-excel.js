 es la const XLSX = require('xlsx');
const path = require('path');

// Leer el archivo Excel
const filePath = path.join(__dirname, '..', 'docs', 'Uptime PatagoniaIP 2023.xlsx');
const workbook = XLSX.readFile(filePath, { cellFormula: true, cellStyles: true });

console.log('='.repeat(80));
console.log('ANÁLISIS DEL ARCHIVO EXCEL');
console.log('='.repeat(80));
console.log('\n📋 HOJAS ENCONTRADAS:');
console.log(workbook.SheetNames.join('\n'));
console.log('\n');

// Analizar cada hoja (solo las primeras 3 para no saturar)
const sheetsToAnalyze = workbook.SheetNames.slice(0, 5);

sheetsToAnalyze.forEach(sheetName => {
    console.log('='.repeat(80));
    console.log(`📊 HOJA: ${sheetName}`);
    console.log('='.repeat(80));

    const sheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

    console.log(`Rango: ${sheet['!ref']}`);
    console.log(`Filas: ${range.e.r + 1}, Columnas: ${range.e.c + 1}\n`);

    // Obtener encabezados (primera fila)
    console.log('🔤 ENCABEZADOS (Fila 1):');
    for (let col = 0; col <= Math.min(range.e.c, 15); col++) {
        const cellAddr = XLSX.utils.encode_cell({ r: 0, c: col });
        const cell = sheet[cellAddr];
        if (cell && cell.v) {
            console.log(`  ${XLSX.utils.encode_col(col)}: ${cell.v}`);
        }
    }

    // Buscar fórmulas en la hoja
    console.log('\n📐 FÓRMULAS ENCONTRADAS:');
    let formulaCount = 0;
    const formulas = {};

    for (let row = 0; row <= Math.min(range.e.r, 50); row++) {
        for (let col = 0; col <= range.e.c; col++) {
            const cellAddr = XLSX.utils.encode_cell({ r: row, c: col });
            const cell = sheet[cellAddr];
            if (cell && cell.f) {
                formulaCount++;
                const colLetter = XLSX.utils.encode_col(col);
                if (!formulas[colLetter]) {
                    formulas[colLetter] = cell.f;
                    console.log(`  ${cellAddr}: =${cell.f}`);
                }
            }
        }
    }

    if (formulaCount === 0) {
        console.log('  (No se encontraron fórmulas en las primeras 50 filas)');
    }

    // Mostrar primeras filas de datos
    console.log('\n📝 PRIMERAS 5 FILAS DE DATOS:');
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }).slice(0, 6);
    jsonData.forEach((row, idx) => {
        if (row.length > 0) {
            const rowData = row.slice(0, 10).map(v => String(v || '').substring(0, 20)).join(' | ');
            console.log(`  Fila ${idx + 1}: ${rowData}`);
        }
    });

    console.log('\n');
});
