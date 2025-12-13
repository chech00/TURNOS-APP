/**
 * Script de Minificación para Producción
 * Ejecutar: node scripts/minify.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '..', 'docs');
const JS_DIR = path.join(DOCS_DIR, 'js');
const CSS_DIR = path.join(DOCS_DIR, 'css');
const DIST_DIR = path.join(DOCS_DIR, 'dist');

// Crear directorio dist si no existe
if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
}
if (!fs.existsSync(path.join(DIST_DIR, 'js'))) {
    fs.mkdirSync(path.join(DIST_DIR, 'js'), { recursive: true });
}
if (!fs.existsSync(path.join(DIST_DIR, 'css'))) {
    fs.mkdirSync(path.join(DIST_DIR, 'css'), { recursive: true });
}

console.log('🚀 Iniciando minificación...\n');

// Minificar archivos JS principales
const jsFiles = [
    'noc.js',
    'script.js',
    'directorio.js',
    'login.js',
    'senales.js',
    'suralis.js',
    'gestion_empleados.js',
    'gestion_usuarios.js',
    'registros.js',
    'documentos.js',
    'logger.js'
];

console.log('📦 Minificando JavaScript...');
let jsMinified = 0;
jsFiles.forEach(file => {
    const inputPath = path.join(JS_DIR, file);
    const outputPath = path.join(DIST_DIR, 'js', file.replace('.js', '.min.js'));

    if (fs.existsSync(inputPath)) {
        try {
            execSync(`npx terser "${inputPath}" -o "${outputPath}" --compress --mangle`, { stdio: 'pipe' });

            const originalSize = fs.statSync(inputPath).size;
            const minifiedSize = fs.statSync(outputPath).size;
            const reduction = ((1 - minifiedSize / originalSize) * 100).toFixed(1);

            console.log(`  ✅ ${file} → ${file.replace('.js', '.min.js')} (-${reduction}%)`);
            jsMinified++;
        } catch (e) {
            console.log(`  ❌ Error en ${file}: ${e.message}`);
        }
    }
});

// Minificar archivos CSS principales
const cssFiles = [
    'styles.css',
    'noc.css',
    'directorio.css',
    'login.css'
];

console.log('\n📦 Minificando CSS...');
let cssMinified = 0;
cssFiles.forEach(file => {
    const inputPath = path.join(CSS_DIR, file);
    const outputPath = path.join(DIST_DIR, 'css', file.replace('.css', '.min.css'));

    if (fs.existsSync(inputPath)) {
        try {
            execSync(`npx cleancss -o "${outputPath}" "${inputPath}"`, { stdio: 'pipe' });

            const originalSize = fs.statSync(inputPath).size;
            const minifiedSize = fs.statSync(outputPath).size;
            const reduction = ((1 - minifiedSize / originalSize) * 100).toFixed(1);

            console.log(`  ✅ ${file} → ${file.replace('.css', '.min.css')} (-${reduction}%)`);
            cssMinified++;
        } catch (e) {
            console.log(`  ❌ Error en ${file}: ${e.message}`);
        }
    }
});

console.log(`\n✨ Minificación completada!`);
console.log(`   JS: ${jsMinified} archivos`);
console.log(`   CSS: ${cssMinified} archivos`);
console.log(`   Archivos en: docs/dist/`);
