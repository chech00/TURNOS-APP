/**
 * Seasonal Themes - Snowfall & Fireworks Animations
 * Reads config from Firestore and applies/removes effects in real-time
 * Uses localStorage as fallback for unauthenticated pages
 */
(function () {
    const SNOW_ID = 'snow-container';
    const FIREWORKS_ID = 'fireworks-container';
    const STORAGE_KEY = 'seasonalAnimations';
    let attempts = 0;
    const maxAttempts = 50; // 10 seconds max wait

    // Try to load from localStorage immediately (for faster initial render)
    loadFromLocalStorage();

    // Wait for Firebase to be fully initialized
    const checkFirebase = setInterval(() => {
        attempts++;

        // Check if Firebase and Firestore are ready
        if (window.firebase && firebase.firestore && firebase.apps && firebase.apps.length > 0) {
            clearInterval(checkFirebase);
            console.log("🎄 Seasonal Themes: Firebase ready, initializing...");
            initSeasonalThemes();
        } else if (attempts >= maxAttempts) {
            clearInterval(checkFirebase);
            console.log("🎄 Seasonal Themes: Using cached settings (Firebase not available)");
        }
    }, 200);

    function loadFromLocalStorage() {
        try {
            const cached = localStorage.getItem(STORAGE_KEY);
            if (cached) {
                const data = JSON.parse(cached);
                console.log("🎄 Seasonal Themes: Loading from cache", data);
                applyAnimations(data);
            }
        } catch (e) {
            // localStorage not available or invalid data
        }
    }

    function saveToLocalStorage(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            // localStorage not available
        }
    }

    function initSeasonalThemes() {
        const db = firebase.firestore();
        const docRef = db.collection('config').doc('animations');

        // Try to get current value from Firestore
        docRef.get().then((doc) => {
            const data = doc.data() || {};
            applyAnimations(data);
            saveToLocalStorage(data); // Cache for offline/unauthenticated use
            console.log("🎄 Seasonal Themes: Loaded from Firestore", data);

            // Set up real-time listener
            docRef.onSnapshot((doc) => {
                const data = doc.data() || {};
                applyAnimations(data);
                saveToLocalStorage(data);
            }, (error) => {
                console.log("🎄 Seasonal Themes: Real-time sync unavailable");
            });
        }).catch((error) => {
            console.log("🎄 Seasonal Themes: Firestore access denied, using cache");
            // Already loaded from localStorage at startup
        });
    }

    function applyAnimations(data) {
        // Handle Snow
        if (data.christmas_snow) {
            enableSnow();
        } else {
            disableSnow();
        }

        // Handle Fireworks
        if (data.newyear_fireworks) {
            enableFireworks();
        } else {
            disableFireworks();
        }
    }

    // ==========================================
    // SNOW EFFECT
    // ==========================================
    function enableSnow() {
        if (document.getElementById(SNOW_ID)) return; // Already active

        const container = document.createElement('div');
        container.id = SNOW_ID;
        document.body.appendChild(container);

        // Make body transparent to show snow background
        document.body.style.backgroundColor = 'transparent';

        // Create snowflakes
        const symbols = ['❄', '❅', '❆', '•'];
        for (let i = 0; i < 50; i++) {
            const flake = document.createElement('div');
            flake.classList.add('snowflake');
            flake.innerText = symbols[Math.floor(Math.random() * symbols.length)];
            flake.style.left = `${Math.random() * 100}vw`;
            flake.style.animation = `snowfall ${Math.random() * 5 + 5}s linear infinite`;
            flake.style.animationDelay = `${Math.random() * 5}s`;
            flake.style.fontSize = `${Math.random() * 1 + 0.5}rem`;
            flake.style.opacity = Math.random() * 0.3 + 0.1;
            container.appendChild(flake);
        }
        console.log("❄️ Christmas Theme ENABLED");
    }

    function disableSnow() {
        const el = document.getElementById(SNOW_ID);
        if (el) {
            el.remove();
            // Only reset background if fireworks are also disabled
            if (!document.getElementById(FIREWORKS_ID)) {
                document.body.style.backgroundColor = '';
            }
            console.log("❄️ Christmas Theme DISABLED");
        }
    }

    // ==========================================
    // FIREWORKS EFFECT
    // ==========================================
    function enableFireworks() {
        if (document.getElementById(FIREWORKS_ID)) return; // Already active

        const container = document.createElement('div');
        container.id = FIREWORKS_ID;
        document.body.appendChild(container);

        // Make body transparent
        document.body.style.backgroundColor = 'transparent';

        // Create continuous fireworks
        createFirework(container);

        // Add interval to create new fireworks
        container.dataset.interval = setInterval(() => {
            if (document.getElementById(FIREWORKS_ID)) {
                createFirework(container);
            }
        }, 800);

        console.log("🎆 New Year Fireworks ENABLED");
    }

    function createFirework(container) {
        const firework = document.createElement('div');
        firework.classList.add('firework');

        // Random position
        const startX = Math.random() * 80 + 10; // 10-90%
        const startY = Math.random() * 30 + 50; // 50-80% (start from bottom half)

        firework.style.left = `${startX}%`;
        firework.style.bottom = `${100 - startY}%`;

        // Random color
        const colors = [
            '#ff0040', '#ff4000', '#ff8000', '#ffbf00', '#ffff00',
            '#00ff40', '#00ffbf', '#00bfff', '#0040ff', '#8000ff',
            '#ff00bf', '#ff0080', '#ffffff', '#ffd700'
        ];
        const color = colors[Math.floor(Math.random() * colors.length)];

        // Create particles
        const particleCount = 12 + Math.floor(Math.random() * 8);
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.classList.add('firework-particle');

            const angle = (360 / particleCount) * i;
            const distance = 50 + Math.random() * 50;
            const duration = 1 + Math.random() * 0.5;

            particle.style.setProperty('--angle', `${angle}deg`);
            particle.style.setProperty('--distance', `${distance}px`);
            particle.style.setProperty('--duration', `${duration}s`);
            particle.style.setProperty('--color', color);
            particle.style.backgroundColor = color;
            particle.style.boxShadow = `0 0 6px ${color}, 0 0 10px ${color}`;

            firework.appendChild(particle);
        }

        container.appendChild(firework);

        // Remove after animation
        setTimeout(() => {
            if (firework.parentNode) {
                firework.remove();
            }
        }, 2000);
    }

    function disableFireworks() {
        const el = document.getElementById(FIREWORKS_ID);
        if (el) {
            // Clear interval
            if (el.dataset.interval) {
                clearInterval(parseInt(el.dataset.interval));
            }
            el.remove();
            // Only reset background if snow is also disabled
            if (!document.getElementById(SNOW_ID)) {
                document.body.style.backgroundColor = '';
            }
            console.log("🎆 New Year Fireworks DISABLED");
        }
    }
})();
