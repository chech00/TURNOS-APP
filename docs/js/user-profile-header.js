/**
 * Premium User Profile Header - Dynamic Data Population
 * Populates the user profile header with authenticated user information
 * Includes optimistic UI caching to eliminate "flash" of default values
 */

(function () {
    'use strict';

    const PROFILE_CACHE_KEY = 'userProfileCache';

    /**
     * Load cached profile data immediately on page load
     */
    function loadCachedProfile() {
        const cached = localStorage.getItem(PROFILE_CACHE_KEY);
        if (!cached) return;

        try {
            const data = JSON.parse(cached);
            applyProfileToUI(data.displayName, data.email, data.role);
            // Apply sidebar visibility immediately from cache
            if (data.role) {
                applySidebarRoleVisibilityFromCache(data.role);
            }
            console.log('[Profile] Optimistic load from cache:', data.displayName);
        } catch (e) {
            console.warn('[Profile] Failed to parse cache:', e);
        }
    }

    /**
     * Apply sidebar visibility immediately from cached role (before full auth)
     */
    function applySidebarRoleVisibilityFromCache(role) {
        const normalizedRole = role?.toLowerCase() || 'user';

        // Show admin-only elements for admin or superadmin
        if (normalizedRole === 'admin' || normalizedRole === 'superadmin') {
            document.body.classList.add('is-admin');
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
        }

        // Show superadmin-only elements for superadmin
        if (normalizedRole === 'superadmin') {
            document.querySelectorAll('.superadmin-only').forEach(el => el.style.display = 'block');
            const liRegistros = document.getElementById('li-registros');
            if (liRegistros) liRegistros.style.display = 'block';
        }
    }

    /**
     * Save profile data to cache
     */
    function cacheProfileData(displayName, email, role) {
        const data = { displayName, email, role, timestamp: Date.now() };
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data));
    }

    /**
     * Apply profile data to UI elements
     */
    function applyProfileToUI(displayName, email, role) {
        const nameElement = document.getElementById('user-display-name');
        const emailElement = document.getElementById('user-display-email');
        const roleBadge = document.getElementById('user-role-badge');
        const roleText = document.getElementById('user-role-text');

        // Only require name, roleBadge, and roleText (email is optional)
        if (!nameElement || !roleBadge || !roleText) return;

        // Update user name and email (email may be null on some pages)
        nameElement.textContent = displayName;
        if (emailElement) emailElement.textContent = email;

        // Update role badge
        const roleMap = {
            'user': { text: 'Usuario', icon: 'user', class: '' },
            'admin': { text: 'Admin', icon: 'shield-check', class: 'admin' },
            'superadmin': { text: 'Super Admin', icon: 'crown', class: 'superadmin' }
        };

        const roleInfo = roleMap[role?.toLowerCase()] || roleMap['user'];
        roleText.textContent = roleInfo.text;
        roleBadge.className = `user-role-badge ${roleInfo.class}`;

        // Update icon (if Lucide is loaded)
        if (window.lucide) {
            const roleIcon = roleBadge.querySelector('i');
            if (roleIcon) {
                roleIcon.setAttribute('data-lucide', roleInfo.icon);
                window.lucide.createIcons();
            }
        }
    }

    /**
     * Updates the user profile header with current user data
     * @param {Object} user - Firebase user object
     * @param {string} role - User role (user/admin/superadmin)
     */
    function updateUserProfileHeader(user, role = 'user') {
        if (!user) return;

        // Update user name (priority: custom prop > firebase profile > email)
        const displayName = user.customName || user.displayName || user.email.split('@')[0];
        const email = user.email;

        // Apply to UI
        applyProfileToUI(displayName, email, role);

        // Cache for next page load
        cacheProfileData(displayName, email, role);

        // === DETECTAR SI INICIÓ SESIÓN CON GOOGLE (esta sesión) ===
        // Usamos localStorage porque providerData muestra TODOS los proveedores vinculados,
        // no solo el que usó para iniciar sesión en esta sesión específica.
        const authProvider = localStorage.getItem('authProvider');
        const isGoogleLogin = authProvider === 'google';

        // Agregar o quitar el indicador de Google
        const userProfileHeader = document.querySelector('.user-profile-header');
        if (userProfileHeader) {
            // Remover indicador anterior si existe
            const existingGoogleBadge = userProfileHeader.querySelector('.google-auth-badge');
            if (existingGoogleBadge) existingGoogleBadge.remove();

            // Agregar badge de Google si corresponde
            if (isGoogleLogin) {
                const googleBadge = document.createElement('div');
                googleBadge.className = 'google-auth-badge';
                googleBadge.title = 'Conectado con Google';
                googleBadge.innerHTML = `
                    <svg viewBox="0 0 24 24" width="14" height="14">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                `;

                // Insertar después del role badge
                const roleBadge = userProfileHeader.querySelector('.user-role-badge');
                if (roleBadge) {
                    roleBadge.parentNode.insertBefore(googleBadge, roleBadge.nextSibling);
                } else {
                    userProfileHeader.appendChild(googleBadge);
                }
            }
        }

        // === APPLY ROLE-BASED SIDEBAR VISIBILITY ===
        applySidebarRoleVisibility(role);

        console.log('[Profile] Updated and cached:', displayName, '(' + role + ')', isGoogleLogin ? '[Google]' : '[Email/Password]');
    }

    /**
     * Apply sidebar visibility based on user role
     * Shows/hides elements with admin-only and superadmin-only classes
     */
    function applySidebarRoleVisibility(role) {
        const normalizedRole = role?.toLowerCase() || 'user';

        // Show admin-only elements for admin or superadmin
        if (normalizedRole === 'admin' || normalizedRole === 'superadmin') {
            document.body.classList.add('is-admin');
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
        } else {
            document.body.classList.remove('is-admin');
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
        }

        // Show superadmin-only elements for superadmin
        if (normalizedRole === 'superadmin') {
            document.querySelectorAll('.superadmin-only').forEach(el => el.style.display = 'block');
            const liRegistros = document.getElementById('li-registros');
            if (liRegistros) liRegistros.style.display = 'block';
        } else {
            document.querySelectorAll('.superadmin-only').forEach(el => el.style.display = 'none');
        }

        console.log('[Sidebar] Visibility applied for role:', normalizedRole);
    }

    /**
     * Initialize user profile header when auth state changes
     */
    function initializeUserProfileHeader() {
        const auth = window.auth;
        if (!auth) {
            console.warn('Firebase auth not available for user profile header');
            return;
        }

        auth.onAuthStateChanged(async (user) => {
            if (user) {
                // Get user role from localStorage or Firestore
                let userRole = localStorage.getItem('userRole') || 'user';
                let customName = null;

                // Check Firestore for Role and Name
                if (window.db) {
                    try {
                        const userDoc = await window.db.collection('userRoles').doc(user.uid).get();
                        if (userDoc.exists) {
                            const data = userDoc.data();
                            userRole = data.rol || 'user';
                            localStorage.setItem('userRole', userRole);

                            if (data.nombre) {
                                customName = data.nombre;
                            }
                        }
                    } catch (error) {
                        console.error('Error fetching user role:', error);
                    }
                }

                // Pass custom name via the user object (non-destructive)
                user.customName = customName;
                updateUserProfileHeader(user, userRole);
            } else {
                // User logged out - clear cache
                localStorage.removeItem(PROFILE_CACHE_KEY);
                localStorage.removeItem('authProvider');
            }
        });
    }

    // Load cached profile IMMEDIATELY (before Firebase loads)
    loadCachedProfile();

    // Initialize with retry logic to wait for firebase.js to export globals
    function init() {
        if (window.auth && window.db) {
            initializeUserProfileHeader();
        } else {
            let retries = 0;
            const maxRetries = 50; // 5 seconds max
            const interval = setInterval(() => {
                retries++;
                if (window.auth && window.db) {
                    clearInterval(interval);
                    initializeUserProfileHeader();
                } else if (retries >= maxRetries) {
                    clearInterval(interval);
                    console.error('Firebase Auth/DB timed out in user-profile-header');
                }
            }, 100);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Export function globally for manual updates if needed
    window.updateUserProfileHeader = updateUserProfileHeader;
})();

