/**
 * Script para cambiar entre archivos originales y minificados
 * Uso: node scripts/use-minified.js [--dev|--prod]
 */

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '..', 'docs');
const mode = process.argv[2] || '--prod';

const htmlFiles = [
    'noc.html',
    'index.html',
    'directorio.html',
    'login.html',
    'senales.html',
    'suralis.html',
    'gestion_empleados.html',
    'gestion_usuarios.html',
    'registros.html',
    'documentos.html',
    'animaciones.html'
];

const jsReplacements = {
    './js/noc.js': './dist/js/noc.min.js',
    './js/script.js': './dist/js/script.min.js',
    './js/directorio.js': './dist/js/directorio.min.js',
    './js/login.js': './dist/js/login.min.js',
    './js/senales.js': './dist/js/senales.min.js',
    './js/suralis.js': './dist/js/suralis.min.js',
    './js/gestion_empleados.js': './dist/js/gestion_empleados.min.js',
    './js/gestion_usuarios.js': './dist/js/gestion_usuarios.min.js',
    './js/registros.js': './dist/js/registros.min.js',
    './js/documentos.js': './dist/js/documentos.min.js',
    './js/logger.js': './dist/js/logger.min.js'
};

const cssReplacements = {
    './css/styles.css': './dist/css/styles.min.css',
    './css/noc.css': './dist/css/noc.min.css',
    './css/directorio.css': './dist/css/directorio.min.css',
    './css/login.css': './dist/css/login.min.css'
};

console.log(`\n🔄 Cambiando a modo: ${mode === '--prod' ? 'PRODUCCIÓN (minificado)' : 'DESARROLLO (original)'}\n`);

let filesUpdated = 0;

htmlFiles.forEach(file => {
    const filePath = path.join(DOCS_DIR, file);

    if (!fs.existsSync(filePath)) {
        console.log(`  ⚠️ ${file} no encontrado`);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    if (mode === '--prod') {
        // Cambiar a minificados
        Object.entries(jsReplacements).forEach(([original, minified]) => {
            if (content.includes(original)) {
                content = content.replace(new RegExp(original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), minified);
                changed = true;
            }
        });
        Object.entries(cssReplacements).forEach(([original, minified]) => {
            if (content.includes(original)) {
                content = content.replace(new RegExp(original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), minified);
                changed = true;
            }
        });
    } else {
        // Cambiar a originales
        Object.entries(jsReplacements).forEach(([original, minified]) => {
            if (content.includes(minified)) {
                content = content.replace(new RegExp(minified.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), original);
                changed = true;
            }
        });
        Object.entries(cssReplacements).forEach(([original, minified]) => {
            if (content.includes(minified)) {
                content = content.replace(new RegExp(minified.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), original);
                changed = true;
            }
        });
    }

    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`  ✅ ${file} actualizado`);
        filesUpdated++;
    } else {
        console.log(`  ⏭️ ${file} sin cambios`);
    }
});

console.log(`\n✨ ${filesUpdated} archivos actualizados`);
console.log(`📦 Modo: ${mode === '--prod' ? 'PRODUCCIÓN' : 'DESARROLLO'}\n`);
