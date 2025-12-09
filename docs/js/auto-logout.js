// =============================================================================
// AUTO-LOGOUT POR INACTIVIDAD
// =============================================================================

/**
 * Sistema de cierre de sesión automático por inactividad.
 * Se activa después de un período configurable sin interacción del usuario.
 */

(function () {
    'use strict';

    // Configuración
    const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 30 minutos en milisegundos
    const WARNING_TIME = 2 * 60 * 1000; // Advertencia 2 minutos antes

    let inactivityTimer = null;
    let warningTimer = null;
    let warningShown = false;

    /**
     * Resetea los timers de inactividad
     */
    function resetInactivityTimer() {
        // Limpiar timers existentes
        if (inactivityTimer) clearTimeout(inactivityTimer);
        if (warningTimer) clearTimeout(warningTimer);
        warningShown = false;

        // Timer de advertencia (se dispara antes del logout)
        warningTimer = setTimeout(() => {
            if (!warningShown) {
                warningShown = true;
                mostrarAdvertenciaInactividad();
            }
        }, INACTIVITY_TIMEOUT - WARNING_TIME);

        // Timer de logout automático
        inactivityTimer = setTimeout(() => {
            cerrarSesionPorInactividad();
        }, INACTIVITY_TIMEOUT);
    }

    /**
     * Muestra advertencia al usuario antes del cierre automático
     */
    function mostrarAdvertenciaInactividad() {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: '⚠️ Sesión por expirar',
                text: 'Tu sesión se cerrará en 2 minutos por inactividad. Mueve el mouse o presiona una tecla para continuar.',
                icon: 'warning',
                timer: 120000, // 2 minutos
                timerProgressBar: true,
                showConfirmButton: true,
                confirmButtonText: 'Continuar sesión',
                allowOutsideClick: false
            }).then((result) => {
                if (result.isConfirmed) {
                    resetInactivityTimer();
                }
            });
        }
    }

    /**
     * Cierra la sesión automáticamente
     */
    function cerrarSesionPorInactividad() {
        console.log('🚪 Cerrando sesión por inactividad...');

        // Limpiar datos de sesión
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        sessionStorage.clear();

        // Cerrar sesión en Firebase
        if (window.auth) {
            window.auth.signOut().then(() => {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        title: 'Sesión cerrada',
                        text: 'Tu sesión ha sido cerrada por inactividad.',
                        icon: 'info',
                        confirmButtonText: 'OK'
                    }).then(() => {
                        window.location.href = '/login.html';
                    });
                } else {
                    window.location.href = '/login.html';
                }
            }).catch((error) => {
                console.error('Error al cerrar sesión:', error);
                window.location.href = '/login.html';
            });
        } else {
            window.location.href = '/login.html';
        }
    }

    /**
     * Inicializa el sistema de auto-logout
     */
    function inicializarAutoLogout() {
        console.log('🔒 Sistema de auto-logout inicializado (timeout: ' + (INACTIVITY_TIMEOUT / 60000) + ' minutos)');

        // Eventos que indican actividad del usuario
        const activityEvents = [
            'mousedown',
            'mousemove',
            'keypress',
            'scroll',
            'touchstart',
            'click'
        ];

        // Agregar listeners para detectar actividad
        activityEvents.forEach(event => {
            document.addEventListener(event, resetInactivityTimer, true);
        });

        // Iniciar el primer timer
        resetInactivityTimer();
    }

    // Inicializar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializarAutoLogout);
    } else {
        inicializarAutoLogout();
    }

    // Exponer función para configuración manual si es necesario
    window.resetInactivityTimer = resetInactivityTimer;
})();
