/**
 * Security Helpers - Funciones centralizadas de seguridad
 * TURNOS-APP
 */

// =============================================================================
// SANITIZACIÓN XSS
// =============================================================================

/**
 * Sanitiza HTML para prevenir XSS
 * Usa DOMPurify si está disponible, sino hace escape básico
 */
function sanitizeHTML(html) {
    if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(html);
    }

    // Fallback: escape básico
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
}

/**
 * Helper seguro para innerHTML
 * USO: safeInnerHTML(element, '<div>contenido</div>')
 */
function safeInnerHTML(element, html) {
    element.innerHTML = sanitizeHTML(html);
}

/**
 * Crea elemento de forma segura sin innerHTML
 * USO: const div = createSafeElement('div', 'mi-clase', 'Texto seguro')
 */
function createSafeElement(tagName, className = '', textContent = '') {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (textContent) element.textContent = textContent;
    return element;
}

// =============================================================================
// VERIFICACIÓN DE PERMISOS (Siempre desde Firestore, nunca localStorage)
// =============================================================================

/**
 * Verifica el rol REAL del usuario desde Firestore
 * NO confiar nunca en localStorage
 */
async function getUserRoleFromFirestore() {
    const user = window.auth?.currentUser;
    if (!user) return null;

    try {
        const userDoc = await window.db.collection('userRoles').doc(user.uid).get();
        if (!userDoc.exists) return null;
        return userDoc.data().rol;
    } catch (error) {
        console.error('Error obteniendo rol:', error);
        return null;
    }
}

/**
 * Verifica si el usuario actual es admin o superadmin
 */
async function isUserAdmin() {
    const role = await getUserRoleFromFirestore();
    return role === 'admin' || role === 'superadmin';
}

/**
 * Verifica si el usuario actual es superadmin
 */
async function isUserSuperAdmin() {
    const role = await getUserRoleFromFirestore();
    return role === 'superadmin';
}

/**
 * Requiere que el usuario sea admin para continuar
 * Lanza error si no lo es
 */
async function requireAdmin(action = 'realizar esta acción') {
    if (!(await isUserAdmin())) {
        throw new Error(`No tienes permisos para ${action}`);
    }
}

/**
 * Requiere que el usuario sea superadmin para continuar
 */
async function requireSuperAdmin(action = 'realizar esta acción') {
    if (!(await isUserSuperAdmin())) {
        throw new Error(`Solo superadmins pueden ${action}`);
    }
}

// =============================================================================
// RE-AUTENTICACIÓN PARA OPERACIONES SENSIBLES
// =============================================================================

/**
 * Requiere que el usuario se haya autenticado recientemente
 * Si no, pide la contraseña de nuevo
 */
async function requireRecentAuth(maxAgeMinutes = 5) {
    const user = window.auth?.currentUser;
    if (!user) {
        throw new Error('No autenticado');
    }

    const metadata = user.metadata;
    const lastSignIn = new Date(metadata.lastSignInTime);
    const now = new Date();
    const ageMinutes = (now - lastSignIn) / (1000 * 60);

    if (ageMinutes > maxAgeMinutes) {
        // Pedir re-autenticación
        const result = await Swal.fire({
            title: '🔒 Confirma tu identidad',
            html: 'Por seguridad, confirma tu contraseña para continuar',
            input: 'password',
            inputLabel: 'Contraseña',
            inputPlaceholder: 'Ingresa tu contraseña',
            showCancelButton: true,
            confirmButtonText: 'Confirmar',
            cancelButtonText: 'Cancelar',
            inputValidator: (value) => {
                if (!value) {
                    return 'Debes ingresar tu contraseña';
                }
            }
        });

        if (!result.isConfirmed) {
            throw new Error('Re-autenticación cancelada');
        }

        const credential = firebase.auth.EmailAuthProvider.credential(
            user.email,
            result.value
        );

        try {
            await user.reauthenticateWithCredential(credential);
        } catch (error) {
            await Swal.fire('Error', 'Contraseña incorrecta', 'error');
            throw new Error('Re-autenticación fallida');
        }
    }
}

// =============================================================================
// AUDITORÍA Y LOGGING
// =============================================================================

/**
 * Registra una acción en los audit logs
 */
async function auditLog(action, details = {}) {
    const user = window.auth?.currentUser;
    if (!user) return;

    try {
        await window.db.collection('auditLogs').add({
            action: action,
            userId: user.uid,
            userEmail: user.email,
            details: details,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userAgent: navigator.userAgent,
            url: window.location.href
        });
    } catch (error) {
        console.error('Error creando audit log:', error);
    }
}

// =============================================================================
// VALIDACIÓN DE INPUTS
// =============================================================================

/**
 * Valida y sanitiza un email
 */
function validateEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const trimmed = email.trim().toLowerCase();

    if (!regex.test(trimmed)) {
        throw new Error('Email inválido');
    }

    return trimmed;
}

/**
 * Valida una contraseña con requisitos de seguridad
 * @param {string} password - Contraseña a validar
 * @param {object} options - Opciones de validación
 * @returns {string} - Contraseña validada
 * @throws {Error} - Si no cumple los requisitos
 */
function validatePassword(password, options = {}) {
    const {
        minLength = 8,
        requireUppercase = true,
        requireLowercase = true,
        requireNumber = true,
        requireSpecial = true
    } = options;

    const errors = [];

    if (password.length < minLength) {
        errors.push(`Mínimo ${minLength} caracteres`);
    }

    if (requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('Al menos una letra mayúscula');
    }

    if (requireLowercase && !/[a-z]/.test(password)) {
        errors.push('Al menos una letra minúscula');
    }

    if (requireNumber && !/[0-9]/.test(password)) {
        errors.push('Al menos un número');
    }

    if (requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Al menos un carácter especial (!@#$%^&*...)');
    }

    // Verificar contraseñas comunes
    const commonPasswords = ['password', '123456', '12345678', 'qwerty', 'abc123', 'password1'];
    if (commonPasswords.includes(password.toLowerCase())) {
        errors.push('Contraseña demasiado común');
    }

    if (errors.length > 0) {
        throw new Error(`Requisitos de contraseña: ${errors.join(', ')}`);
    }

    return password;
}

/**
 * Validación simple de contraseña (solo longitud mínima)
 * Para casos donde no se requiere validación estricta
 */
function validatePasswordSimple(password, minLength = 6) {
    if (password.length < minLength) {
        throw new Error(`La contraseña debe tener al menos ${minLength} caracteres`);
    }
    return password;
}

/**
 * Sanitiza texto genérico
 */
function sanitizeText(text, maxLength = 1000) {
    let sanitized = String(text).trim();
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength);
    }
    return sanitized;
}

// =============================================================================
// LOGGING CONDICIONAL (Solo en desarrollo)
// =============================================================================

const DEBUG_MODE = false; // Cambiar a false en producción

function debugLog(...args) {
    if (DEBUG_MODE) {
        console.log('[DEBUG]', ...args);
    }
}

function debugError(...args) {
    if (DEBUG_MODE) {
        console.error('[DEBUG ERROR]', ...args);
    }
}

// =============================================================================
// EXPORTAR SI ES MÓDULO
// =============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        sanitizeHTML,
        safeInnerHTML,
        createSafeElement,
        getUserRoleFromFirestore,
        isUserAdmin,
        isUserSuperAdmin,
        requireAdmin,
        requireSuperAdmin,
        requireRecentAuth,
        auditLog,
        validateEmail,
        validatePassword,
        validatePasswordSimple,
        sanitizeText,
        debugLog,
        debugError
    };
}
