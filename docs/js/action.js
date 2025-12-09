/**
 * action.js - Maneja las acciones de Firebase Authentication
 * (Reset Password, Email Verification, etc.)
 */

import { auth } from './firebase.js';

// DOM Elements
const resetPasswordSection = document.getElementById('reset-password-section');
const successSection = document.getElementById('success-section');
const errorSection = document.getElementById('error-section');
const resetPasswordForm = document.getElementById('reset-password-form');
const newPasswordInput = document.getElementById('new-password');
const confirmPasswordInput = document.getElementById('confirm-password');
const errorMessage = document.getElementById('error-message');
const loadingSpinner = document.getElementById('loading-spinner');
const resetButton = document.getElementById('reset-button');
const userEmailDisplay = document.getElementById('user-email-display');
const strengthBar = document.getElementById('strength-bar');
const strengthText = document.getElementById('strength-text');

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get('mode');
const oobCode = urlParams.get('oobCode');

/**
 * Initialize the page based on the action mode
 */
async function init() {
    // Re-initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Setup password toggle buttons
    setupPasswordToggles();

    // Setup password strength checker
    setupPasswordStrength();

    if (!mode || !oobCode) {
        showError();
        return;
    }

    switch (mode) {
        case 'resetPassword':
            await handleResetPassword();
            break;
        case 'verifyEmail':
            await handleVerifyEmail();
            break;
        case 'recoverEmail':
            await handleRecoverEmail();
            break;
        default:
            showError();
    }
}

/**
 * Setup password visibility toggle buttons
 */
function setupPasswordToggles() {
    const toggleButtons = document.querySelectorAll('.toggle-password');

    toggleButtons.forEach(button => {
        button.addEventListener('click', function () {
            const input = this.parentElement.querySelector('input');
            const icon = this.querySelector('i');

            if (input.type === 'password') {
                input.type = 'text';
                icon.setAttribute('data-lucide', 'eye-off');
            } else {
                input.type = 'password';
                icon.setAttribute('data-lucide', 'eye');
            }

            // Re-render the icon
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        });
    });
}

/**
 * Setup password strength indicator
 */
function setupPasswordStrength() {
    if (newPasswordInput) {
        newPasswordInput.addEventListener('input', function () {
            const password = this.value;
            const strength = checkPasswordStrength(password);

            strengthBar.className = 'strength-bar';

            if (password.length === 0) {
                strengthBar.className = 'strength-bar';
                strengthText.textContent = '';
            } else if (strength.score === 1) {
                strengthBar.classList.add('weak');
                strengthText.textContent = 'Débil - ' + strength.feedback;
            } else if (strength.score === 2) {
                strengthBar.classList.add('fair');
                strengthText.textContent = 'Regular - ' + strength.feedback;
            } else if (strength.score === 3) {
                strengthBar.classList.add('good');
                strengthText.textContent = 'Buena - ' + strength.feedback;
            } else {
                strengthBar.classList.add('strong');
                strengthText.textContent = 'Excelente';
            }
        });
    }
}

/**
 * Check password strength
 */
function checkPasswordStrength(password) {
    let score = 0;
    let feedback = '';

    if (password.length >= 6) score++;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) {
        feedback = 'Agrega más caracteres';
    } else if (score === 2) {
        feedback = 'Usa mayúsculas y números';
    } else if (score === 3) {
        feedback = 'Agrega símbolos (!@#$)';
    }

    return { score: Math.min(score, 4), feedback };
}

/**
 * Handle password reset action
 */
async function handleResetPassword() {
    try {
        // Verify the code is valid
        const email = await auth.verifyPasswordResetCode(oobCode);

        // Show the email
        if (userEmailDisplay) {
            userEmailDisplay.textContent = `Para: ${email}`;
        }

        showSection('reset');

        // Setup form submission
        resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await confirmPasswordReset();
        });

    } catch (error) {
        console.error('Error verifying reset code:', error);
        showError();
    }
}

/**
 * Confirm the password reset
 */
async function confirmPasswordReset() {
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Clear previous errors
    errorMessage.textContent = '';

    // Validate passwords match
    if (newPassword !== confirmPassword) {
        errorMessage.textContent = 'Las contraseñas no coinciden';
        return;
    }

    // Validate password length
    if (newPassword.length < 6) {
        errorMessage.textContent = 'La contraseña debe tener al menos 6 caracteres';
        return;
    }

    // Show loading state
    setLoading(true);

    try {
        // Confirm the password reset
        await auth.confirmPasswordReset(oobCode, newPassword);

        // Show success section
        showSection('success');

        // Show success alert
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: '¡Éxito!',
                text: 'Tu contraseña ha sido actualizada correctamente.',
                confirmButtonText: 'Ir al Login',
                confirmButtonColor: '#7796CB',
                background: '#23272E',
                color: '#E3E6EB'
            }).then((result) => {
                if (result.isConfirmed) {
                    window.location.href = 'login.html';
                }
            });
        }

    } catch (error) {
        console.error('Error resetting password:', error);

        let message = 'Error al restablecer la contraseña. ';

        switch (error.code) {
            case 'auth/expired-action-code':
                message += 'El enlace ha expirado.';
                break;
            case 'auth/invalid-action-code':
                message += 'El enlace es inválido.';
                break;
            case 'auth/weak-password':
                message += 'La contraseña es muy débil.';
                break;
            default:
                message += 'Por favor, intenta de nuevo.';
        }

        errorMessage.textContent = message;
        setLoading(false);
    }
}

/**
 * Handle email verification action
 */
async function handleVerifyEmail() {
    try {
        await auth.applyActionCode(oobCode);

        // Show success with email verification message
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: '¡Email Verificado!',
                text: 'Tu correo electrónico ha sido verificado correctamente.',
                confirmButtonText: 'Ir al Login',
                confirmButtonColor: '#7796CB',
                background: '#23272E',
                color: '#E3E6EB'
            }).then(() => {
                window.location.href = 'login.html';
            });
        } else {
            window.location.href = 'login.html';
        }

    } catch (error) {
        console.error('Error verifying email:', error);
        showError();
    }
}

/**
 * Handle email recovery action
 */
async function handleRecoverEmail() {
    try {
        const info = await auth.checkActionCode(oobCode);
        await auth.applyActionCode(oobCode);

        // Email recovered
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: '¡Email Recuperado!',
                text: `Tu email ${info.data.email} ha sido restaurado.`,
                confirmButtonText: 'Ir al Login',
                confirmButtonColor: '#7796CB',
                background: '#23272E',
                color: '#E3E6EB'
            }).then(() => {
                window.location.href = 'login.html';
            });
        } else {
            window.location.href = 'login.html';
        }

    } catch (error) {
        console.error('Error recovering email:', error);
        showError();
    }
}

/**
 * Show a specific section
 */
function showSection(section) {
    resetPasswordSection.classList.add('hidden');
    successSection.classList.add('hidden');
    errorSection.classList.add('hidden');

    switch (section) {
        case 'reset':
            resetPasswordSection.classList.remove('hidden');
            break;
        case 'success':
            successSection.classList.remove('hidden');
            break;
        case 'error':
            errorSection.classList.remove('hidden');
            break;
    }

    // Re-render icons after showing section
    setTimeout(() => {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }, 100);
}

/**
 * Show error section
 */
function showError() {
    showSection('error');
}

/**
 * Set loading state
 */
function setLoading(isLoading) {
    if (loadingSpinner) {
        loadingSpinner.style.display = isLoading ? 'block' : 'none';
    }
    if (resetButton) {
        resetButton.disabled = isLoading;
        resetButton.innerHTML = isLoading
            ? '<i data-lucide="loader-2" class="btn-icon spinning"></i> Guardando...'
            : '<i data-lucide="lock" class="btn-icon"></i> Guardar Contraseña';

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
