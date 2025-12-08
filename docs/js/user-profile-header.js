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
            console.log('[Profile] Optimistic load from cache:', data.displayName);
        } catch (e) {
            console.warn('[Profile] Failed to parse cache:', e);
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

        if (!nameElement || !emailElement || !roleBadge || !roleText) return;

        // Update user name and email
        nameElement.textContent = displayName;
        emailElement.textContent = email;

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

        console.log('[Profile] Updated and cached:', displayName, '(' + role + ')');
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
            }
        });
    }

    // Load cached profile IMMEDIATELY (before Firebase loads)
    loadCachedProfile();

    // Initialize Firebase listener when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeUserProfileHeader);
    } else {
        initializeUserProfileHeader();
    }

    // Export function globally for manual updates if needed
    window.updateUserProfileHeader = updateUserProfileHeader;
})();

