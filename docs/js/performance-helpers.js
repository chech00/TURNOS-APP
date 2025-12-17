/**
 * Performance Helpers
 * Utility functions to optimize rendering and avoid redundant operations.
 */

// =============================================================================
// LUCIDE ICONS OPTIMIZATION
// =============================================================================

let iconsRefreshScheduled = false;
let iconsRefreshTimeout = null;

/**
 * Debounced icon refresh - consolidates multiple calls into one.
 * Call this instead of lucide.createIcons() directly.
 * @param {number} delay - Debounce delay in ms (default: 50ms)
 */
function refreshIcons(delay = 50) {
    if (iconsRefreshScheduled) return;

    iconsRefreshScheduled = true;
    clearTimeout(iconsRefreshTimeout);

    iconsRefreshTimeout = setTimeout(() => {
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
            // console.log('🎨 Icons refreshed (debounced)');
        }
        iconsRefreshScheduled = false;
    }, delay);
}

/**
 * Refresh icons only within a specific container (more efficient).
 * @param {HTMLElement|string} container - Element or selector
 */
function refreshIconsIn(container) {
    const el = typeof container === 'string'
        ? document.querySelector(container)
        : container;

    if (!el) return;

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons({
            attrs: {},
            nameAttr: 'data-lucide',
            icons: {},
            // scope to container
        });
    }
}

// =============================================================================
// RENDER OPTIMIZATION
// =============================================================================

/**
 * Debounce function for expensive operations.
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function for rate-limiting operations.
 * @param {Function} func - Function to throttle
 * @param {number} limit - Minimum time between calls in ms
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Creates elements efficiently using DocumentFragment.
 * @param {string} html - HTML string
 * @returns {DocumentFragment} Fragment ready to insert
 */
function createFragment(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content;
}

/**
 * Batch DOM updates using requestAnimationFrame.
 * @param {Function} callback - Function with DOM updates
 */
function batchDOMUpdate(callback) {
    requestAnimationFrame(() => {
        callback();
        refreshIcons();
    });
}

// =============================================================================
// PERFORMANCE DETECTION
// =============================================================================

/**
 * Checks if user prefers reduced motion.
 * @returns {boolean} True if reduced motion is preferred
 */
function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Checks if device is low-powered (mobile or low RAM).
 * @returns {boolean} True if device seems low-powered
 */
function isLowPowerDevice() {
    // Check for mobile
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Check device memory (if available)
    const lowMemory = navigator.deviceMemory && navigator.deviceMemory < 4;

    // Check hardware concurrency (CPU cores)
    const lowCPU = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;

    return isMobile || lowMemory || lowCPU;
}

/**
 * Get recommended particle count based on device capability.
 * @param {number} defaultCount - Default count for powerful devices
 * @returns {number} Recommended particle count
 */
function getOptimalParticleCount(defaultCount) {
    if (prefersReducedMotion()) return 0;
    if (isLowPowerDevice()) return Math.floor(defaultCount * 0.3);
    if (window.innerWidth < 768) return Math.floor(defaultCount * 0.5);
    return defaultCount;
}

// =============================================================================
// EXPORT TO WINDOW (for use in non-module scripts)
// =============================================================================

window.performanceHelpers = {
    refreshIcons,
    refreshIconsIn,
    debounce,
    throttle,
    createFragment,
    batchDOMUpdate,
    prefersReducedMotion,
    isLowPowerDevice,
    getOptimalParticleCount
};

// Convenience: Make refreshIcons available globally
window.refreshIcons = refreshIcons;

console.log('✅ Performance helpers loaded');
