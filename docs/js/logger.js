// =============================================================================
// LOGGER - Solo muestra logs en desarrollo, no en producción
// =============================================================================

const IS_PRODUCTION = window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1';

const Logger = {
    log: (...args) => {
        if (!IS_PRODUCTION) console.log(...args);
    },
    warn: (...args) => {
        if (!IS_PRODUCTION) console.warn(...args);
    },
    error: (...args) => {
        // Errores siempre se muestran
        console.error(...args);
    },
    info: (...args) => {
        if (!IS_PRODUCTION) console.info(...args);
    },
    debug: (...args) => {
        if (!IS_PRODUCTION) console.debug(...args);
    }
};

// Hacer disponible globalmente
window.Logger = Logger;

// Opcional: Reemplazar console.log en producción
if (IS_PRODUCTION) {
    console.log = () => { };
    console.info = () => { };
    console.debug = () => { };
    // console.warn y console.error se mantienen para debugging de emergencia
}
