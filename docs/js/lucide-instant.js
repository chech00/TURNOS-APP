/**
 * Lucide Icons Instant Loader
 * Ensures sidebar icons appear immediately without delay
 */
(function () {
    'use strict';

    function initIcons() {
        try {
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                lucide.createIcons();
            }
        } catch (e) {
            // Silently ignore errors
        }
    }

    // Try immediately
    initIcons();

    // On DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initIcons);
    } else {
        // DOM already loaded, run again
        setTimeout(initIcons, 0);
    }

    // Final fallback on load
    window.addEventListener('load', initIcons);

    // Expose global function
    window.refreshIcons = function (root) {
        try {
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                lucide.createIcons(root ? { root: root } : undefined);
            }
        } catch (e) {
            // Silently ignore
        }
    };
})();
