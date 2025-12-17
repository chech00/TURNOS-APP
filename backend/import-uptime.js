require('dotenv').config();
const { db } = require('./src/config/firebase');
const XLSX = require('xlsx');
const path = require('path');

const HTML_PATH = path.join(__dirname, '..', 'Uptime PatagoniaIP 2023', 'Uptime OKR.html');
const COLLECTION_NAME = 'uptime_logs';

function parseCustomDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    try {
        // Formatos esperados: "DD/MM/YYYY HH:mm:ss", "DD-MM-YYYY HH:mm"
        const parts = dateStr.trim().split(' ');
        const dateParts = parts[0].split(/\/|-/); // Separar por / o -

        if (dateParts.length !== 3) return null;

        let day = parseInt(dateParts[0], 10);
        let month = parseInt(dateParts[1], 10) - 1; // Meses en JS son 0-11
        let year = parseInt(dateParts[2], 10);

        // Corrección básica para años de 2 dígitos si es necesario (el ejemplo mostraba 2023, así que 4 dígitos)

        let hours = 0, minutes = 0, seconds = 0;
        if (parts.length > 1) {
            const timeParts = parts[1].split(':');
            hours = parseInt(timeParts[0] || 0, 10);
            minutes = parseInt(timeParts[1] || 0, 10);
            seconds = parseInt(timeParts[2] || 0, 10);
        }

        const date = new Date(year, month, day, hours, minutes, seconds);
        return isNaN(date.getTime()) ? null : date;
    } catch (e) {
        console.warn(`Error parseando fecha: ${dateStr}`);
        return null;
    }
}

async function cleanAndUpload() {
    console.log(`🚀 Iniciando importación desde: ${HTML_PATH}`);

    try {
        const workbook = XLSX.readFile(HTML_PATH);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        console.log(`📊 Total de filas crudas leídas: ${data.length}`);

        // 1. Encontrar encabezado
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(data.length, 20); i++) {
            const row = data[i];
            if (row && row.some(c => c && String(c).trim().toUpperCase() === 'ID_TICKET')) {
                headerRowIndex = i;
                break;
            }
        }

        if (headerRowIndex === -1) {
            throw new Error('No se encontró la columna ID_TICKET en las primeras 20 filas.');
        }

        const rawHeaders = data[headerRowIndex];
        const headers = [];
        // Ensure we handle sparse arrays by iterating with loop or filling
        const maxCol = rawHeaders.length;
        for (let k = 0; k < maxCol; k++) {
            headers[k] = String(rawHeaders[k] || '').trim();
        }
        const rows = data.slice(headerRowIndex + 1);

        console.log(`📝 Procesando ${rows.length} filas de datos...`);

        // Índices de columnas clave
        const idxId = headers.indexOf('ID_TICKET');
        const idxStart = headers.findIndex(h => h.includes('Fecha de Inicio'));
        const idxEnd = headers.findIndex(h => h.includes('Fecha de termino'));
        const idxNode = headers.findIndex(h => h.includes('DC/Nodo'));
        const idxFailure = headers.includes('Falla') ? headers.indexOf('Falla') : headers.findIndex(h => h.includes('Falla'));
        const idxClients = headers.findIndex(h => h.includes('Q clientes afectados'));
        const idxReason = headers.findIndex(h => h.includes('Motivo de falla'));
        const idxObs = headers.findIndex(h => h.includes('Observacion'));

        let batch = db.batch();
        let opsByType = { created: 0, updated: 0, errors: 0 };
        let batchCount = 0;
        const BATCH_SIZE = 400; // Firestore limit is 500

        for (const row of rows) {
            const ticketId = row[idxId];
            if (!ticketId) continue; // Saltar filas vacías (ej. filas de separador)

            const rawStart = row[idxStart];
            const rawEnd = row[idxEnd];

            // Construir objeto
            const docData = {
                ticket_id: String(ticketId),
                start_date: parseCustomDate(rawStart),
                end_date: parseCustomDate(rawEnd),
                raw_start_date: rawStart || null,
                raw_end_date: rawEnd || null,
                node: row[idxNode] || null,
                failure_type: row[idxFailure] || null,
                affected_clients: parseInt(row[idxClients] || 0, 10),
                failure_reason: row[idxReason] || null,
                observation: row[idxObs] || null,
                imported_at: new Date(),
                source: 'excel_html_import'
            };

            // Calcular duración si es posible
            if (docData.start_date && docData.end_date) {
                const diffMs = docData.end_date - docData.start_date;
                const diffMins = Math.floor(diffMs / 60000);
                docData.duration_minutes = diffMins > 0 ? diffMins : 0;
            }

            const docRef = db.collection(COLLECTION_NAME).doc(String(ticketId));
            batch.set(docRef, docData, { merge: true });
            opsByType.created++;
            batchCount++;

            if (batchCount >= BATCH_SIZE) {
                console.log(`💾 Guardando lote de ${batchCount} registros...`);
                await batch.commit();
                batch = db.batch(); // Nuevo batch
                batchCount = 0;
            }
        }

        if (batchCount > 0) {
            console.log(`💾 Guardando lote final de ${batchCount} registros...`);
            await batch.commit();
        }

        console.log('✅ Importación completada.');
        console.log(`📈 Registros procesados: ${opsByType.created}`);

    } catch (err) {
        console.error('❌ Error fatal:', err);
    }
}

cleanAndUpload();
