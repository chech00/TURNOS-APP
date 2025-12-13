// =============================================================================
// SW REGISTER - Registra el Service Worker
// =============================================================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('[App] Service Worker registrado:', registration.scope);

                // Verificar actualizaciones
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('[App] Nueva versión del SW encontrada...');

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // Nueva versión disponible
                            console.log('[App] Nueva versión disponible. Recarga para actualizar.');
                        }
                    });
                });
            })
            .catch(error => {
                console.log('[App] Error registrando SW:', error);
            });
    });
}
