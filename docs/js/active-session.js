/**
 * Active Session Tracker
 * Registra y mantiene la sesión activa del usuario en Firestore
 * Incluir este script en TODAS las páginas que requieren autenticación
 */
(function () {
    'use strict';

    let heartbeatInterval = null;
    let currentUserUid = null;
    let isRegistered = false;
    let authInstance = null;
    let dbInstance = null;

    // Esperar a que Firebase esté disponible (CDN global o window.auth/db del módulo)
    function waitForFirebase(callback) {
        const maxAttempts = 100;
        let attempts = 0;

        const check = setInterval(() => {
            attempts++;

            // Option 1: Global firebase object (from CDN)
            if (window.firebase && window.firebase.auth && window.firebase.firestore) {
                clearInterval(check);
                authInstance = firebase.auth();
                dbInstance = firebase.firestore();
                console.log('[ActiveSession] Firebase detectado via CDN global');
                callback();
                return;
            }

            // Option 2: window.auth and window.db (set by firebase.js module)
            if (window.auth && window.db) {
                clearInterval(check);
                authInstance = window.auth;
                dbInstance = window.db;
                console.log('[ActiveSession] Firebase detectado via window.auth/db');
                callback();
                return;
            }

            if (attempts >= maxAttempts) {
                clearInterval(check);
                console.warn('[ActiveSession] Firebase no disponible después de', maxAttempts * 100, 'ms');
            }
        }, 100);
    }

    function init() {
        if (!authInstance || !dbInstance) {
            console.error('[ActiveSession] Auth o DB no disponible');
            return;
        }

        authInstance.onAuthStateChanged(async (user) => {
            if (user && !isRegistered) {
                currentUserUid = user.uid;
                console.log('[ActiveSession] Usuario detectado:', user.email);
                await registerSession(user);
                startHeartbeat();
                startSessionMonitor(); // Monitor for remote termination
                isRegistered = true;
            } else if (!user && isRegistered) {
                stopHeartbeat();
                stopSessionMonitor();
                isRegistered = false;
            }
        });

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            if (currentUserUid && dbInstance) {
                try {
                    dbInstance.collection("activeSessions").doc(currentUserUid).update({
                        lastActivity: getServerTimestamp(),
                        page: getCurrentPage()
                    });
                } catch (e) {
                    // Silently fail
                }
            }
        });

        // Actualizar cuando la pestaña vuelve a ser visible
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && currentUserUid && dbInstance) {
                dbInstance.collection("activeSessions").doc(currentUserUid).update({
                    lastActivity: getServerTimestamp(),
                    page: getCurrentPage()
                }).catch(() => { });
            }
        });
    }

    // Monitor session for remote termination
    let sessionUnsubscribe = null;

    function startSessionMonitor() {
        if (!currentUserUid || !dbInstance) return;

        // Listen to changes on MY session document
        sessionUnsubscribe = dbInstance.collection("activeSessions").doc(currentUserUid)
            .onSnapshot((doc) => {
                if (!doc.exists) {
                    // Session was deleted remotely - log out!
                    console.warn('[ActiveSession] Sesión terminada remotamente. Cerrando sesión...');
                    handleRemoteTermination();
                } else {
                    const data = doc.data();
                    if (data && data.terminated === true) {
                        // Session marked as terminated - log out!
                        console.warn('[ActiveSession] Sesión marcada como terminada. Cerrando sesión...');
                        handleRemoteTermination();
                    }
                }
            }, (error) => {
                console.warn('[ActiveSession] Error monitoreando sesión:', error.message);
            });
    }

    function stopSessionMonitor() {
        if (sessionUnsubscribe) {
            sessionUnsubscribe();
            sessionUnsubscribe = null;
        }
    }

    function handleRemoteTermination() {
        stopHeartbeat();
        stopSessionMonitor();

        // Show alert and redirect to login
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'warning',
                title: 'Sesión Terminada',
                text: 'Tu sesión ha sido cerrada por un administrador.',
                confirmButtonText: 'Aceptar',
                allowOutsideClick: false,
                allowEscapeKey: false
            }).then(() => {
                forceLogout();
            });
        } else {
            alert('Tu sesión ha sido cerrada por un administrador.');
            forceLogout();
        }
    }

    function forceLogout() {
        if (authInstance) {
            authInstance.signOut().then(() => {
                localStorage.removeItem('userRole');
                localStorage.removeItem('userProfileCache');
                window.location.href = 'login.html';
            }).catch(() => {
                window.location.href = 'login.html';
            });
        } else {
            window.location.href = 'login.html';
        }
    }

    function getServerTimestamp() {
        // Handle both module and CDN firebase
        if (window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue) {
            return firebase.firestore.FieldValue.serverTimestamp();
        }
        // Fallback for module - use current date
        return new Date();
    }

    async function registerSession(user) {
        try {
            // Obtener el rol del usuario
            let role = 'user';
            try {
                const roleDoc = await dbInstance.collection('userRoles').doc(user.uid).get();
                if (roleDoc.exists) {
                    role = roleDoc.data().rol || 'user';
                }
            } catch (e) {
                console.warn('[ActiveSession] No se pudo obtener rol:', e.message);
            }

            const sessionData = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || null,
                role: role,
                loginTime: getServerTimestamp(),
                lastActivity: getServerTimestamp(),
                page: getCurrentPage(),
                userAgent: navigator.userAgent.substring(0, 150)
            };

            await dbInstance.collection("activeSessions").doc(user.uid).set(sessionData, { merge: true });
            console.log('[ActiveSession] Sesión registrada:', user.email);

        } catch (error) {
            console.error('[ActiveSession] Error registrando sesión:', error.message);
        }
    }

    function startHeartbeat() {
        // Heartbeat cada 30 segundos
        heartbeatInterval = setInterval(async () => {
            if (currentUserUid && dbInstance) {
                try {
                    await dbInstance.collection("activeSessions").doc(currentUserUid).update({
                        lastActivity: getServerTimestamp(),
                        page: getCurrentPage()
                    });
                } catch (e) {
                    console.warn('[ActiveSession] Heartbeat falló:', e.message);
                }
            }
        }, 30000);
    }

    function stopHeartbeat() {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
    }

    function getCurrentPage() {
        const path = window.location.pathname;
        const filename = path.substring(path.lastIndexOf('/') + 1);
        return filename.replace('.html', '') || 'index';
    }

    // Función global para cerrar sesión y limpiar
    window.cleanupActiveSession = async function () {
        if (currentUserUid && dbInstance) {
            try {
                await dbInstance.collection("activeSessions").doc(currentUserUid).delete();
                console.log('[ActiveSession] Sesión eliminada');
            } catch (e) {
                console.warn('[ActiveSession] Error limpiando sesión:', e);
            }
        }
        stopHeartbeat();
    };

    // Iniciar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => waitForFirebase(init));
    } else {
        waitForFirebase(init);
    }

})();
