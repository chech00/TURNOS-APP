/**
 * Premium User Profile Header - Dynamic Data Population
 * Populates the user profile header with authenticated user information
 */

(function () {
    'use strict';

    /**
     * Updates the user profile header with current user data
     * @param {Object} user - Firebase user object
     * @param {string} role - User role (user/admin/superadmin)
     */
    function updateUserProfileHeader(user, role = 'user') {
        if (!user) return;

        // Get elements
        const nameElement = document.getElementById('user-display-name');
        const emailElement = document.getElementById('user-display-email');
        const roleBadge = document.getElementById('user-role-badge');
        const roleText = document.getElementById('user-role-text');

        if (!nameElement || !emailElement || !roleBadge || !roleText) return;

        // Update user name (display name or extract from email)
        const displayName = user.displayName || user.email.split('@')[0];
        nameElement.textContent = displayName;

        // Update email
        emailElement.textContent = user.email;

        // Update role badge
        const roleMap = {
            'user': { text: 'Usuario', icon: 'user', class: '' },
            'admin': { text: 'Admin', icon: 'shield-check', class: 'admin' },
            'superadmin': { text: 'Super Admin', icon: 'crown', class: 'superadmin' }
        };

        const roleInfo = roleMap[role.toLowerCase()] || roleMap['user'];
        roleText.textContent = roleInfo.text;

        // Update badge class
        roleBadge.className = `user-role-badge ${roleInfo.class}`;

        // Update icon (if Lucide is loaded)
        if (window.lucide) {
            const roleIcon = roleBadge.querySelector('i');
            if (roleIcon) {
                roleIcon.setAttribute('data-lucide', roleInfo.icon);
                window.lucide.createIcons();
            }
        }

        console.log('✅ User profile header updated:', displayName, '(' + role + ')');
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

                // If role not in cache, check Firestore
                if (window.db && !localStorage.getItem('userRole')) {
                    try {
                        const userDoc = await window.db.collection('usuarios').doc(user.uid).get();
                        if (userDoc.exists) {
                            userRole = userDoc.data().role || 'user';
                            localStorage.setItem('userRole', userRole);
                        }
                    } catch (error) {
                        console.error('Error fetching user role:', error);
                    }
                }

                updateUserProfileHeader(user, userRole);
            }
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeUserProfileHeader);
    } else {
        initializeUserProfileHeader();
    }

    // Export function globally for manual updates if needed
    window.updateUserProfileHeader = updateUserProfileHeader;
})();
