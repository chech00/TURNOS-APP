/**
 * Seasonal Themes - Complete Animation System
 * Supports: Snow, Fireworks, Halloween, Valentine, Easter, Independence Day,
 * Rain, Autumn Leaves, Bubbles, Aurora Borealis, Matrix, Connected Particles
 */
(function () {
    const ANIMATION_IDS = {
        snow: 'snow-container',
        fireworks: 'fireworks-container',
        halloween: 'halloween-container',
        valentine: 'valentine-container',
        easter: 'easter-container',
        independence: 'independence-container',
        rain: 'rain-container',
        autumn: 'autumn-container',
        bubbles: 'bubbles-container',
        aurora: 'aurora-container',
        matrix: 'matrix-container',
        particles: 'particles-container',
        christmas_lights: 'christmas-lights-container',
        golden_border: 'golden-border-container',
        christmas_total: 'christmas-total-container',
        newyear_gold: 'newyear-gold-container',
        cyberpunk: 'cyberpunk-container',
        warp_speed: 'warp-speed-container',
        radar: 'radar-container',
        synthwave: 'synthwave-container',
        circuit: 'circuit-container',
        biotech: 'biotech-container'
    };

    const STORAGE_KEY = 'seasonalAnimations';
    let attempts = 0;
    const maxAttempts = 50;
    let firestoreAvailable = false;

    // Load from localStorage immediately
    loadFromLocalStorage();

    // Listen for storage changes from other tabs/windows
    window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
            console.log("🎨 Animations: Storage changed in another tab");
            const data = e.newValue ? JSON.parse(e.newValue) : {};
            applyAnimations(data);
        }
    });

    // Wait for Firebase
    const checkFirebase = setInterval(() => {
        attempts++;
        if (window.firebase && firebase.firestore && firebase.apps && firebase.apps.length > 0) {
            clearInterval(checkFirebase);
            console.log("🎨 Animations: Firebase ready");
            initSeasonalThemes();
        } else if (attempts >= maxAttempts) {
            clearInterval(checkFirebase);
            console.log("🎨 Animations: Using cached settings");
            // For pages without Firebase, periodically check localStorage
            startLocalStoragePolling();
        }
    }, 200);

    function loadFromLocalStorage() {
        try {
            const cached = localStorage.getItem(STORAGE_KEY);
            if (cached) {
                const data = JSON.parse(cached);
                applyAnimations(data);
            } else {
                // No cache - disable all animations
                clearAllAnimations();
            }
        } catch (e) {
            clearAllAnimations();
        }
    }

    function saveToLocalStorage(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) { }
    }

    // For pages that can't access Firestore, poll localStorage every 3 seconds
    function startLocalStoragePolling() {
        setInterval(() => {
            loadFromLocalStorage();
        }, 3000);
    }

    function clearAllAnimations() {
        Object.keys(ANIMATION_IDS).forEach(type => {
            disableAnimation(type);
        });
    }

    function initSeasonalThemes() {
        firestoreAvailable = true;
        const db = firebase.firestore();
        const docRef = db.collection('config').doc('animations');

        // Try to read from Firestore (works even on unauthenticated pages with public read rule)
        docRef.get().then((doc) => {
            console.log("🎨 Animations: Loaded from Firestore");
            const data = doc.exists ? doc.data() : {};
            applyAnimations(data);
            saveToLocalStorage(data);

            // Listen for real-time updates
            docRef.onSnapshot((doc) => {
                const data = doc.exists ? doc.data() : {};
                applyAnimations(data);
                saveToLocalStorage(data);
            }, (error) => {
                console.log("🎨 Animations: Snapshot error, using cached data");
            });
        }).catch((error) => {
            console.log("🎨 Animations: Firestore read failed:", error.code);
            // Fallback to localStorage and start polling
            loadFromLocalStorage();
            startLocalStoragePolling();
        });
    }

    function applyAnimations(data) {
        // Snow
        data.christmas_snow ? enableSnow() : disableAnimation('snow');
        // Fireworks
        data.newyear_fireworks ? enableFireworks() : disableAnimation('fireworks');
        // Halloween
        data.halloween ? enableHalloween() : disableAnimation('halloween');
        // Valentine
        data.valentine ? enableValentine() : disableAnimation('valentine');
        // Easter
        data.easter ? enableEaster() : disableAnimation('easter');
        // Independence Day
        data.independence ? enableIndependence() : disableAnimation('independence');
        // Rain
        data.rain ? enableRain() : disableAnimation('rain');
        // Autumn Leaves
        data.autumn ? enableAutumn() : disableAnimation('autumn');
        // Bubbles
        data.bubbles ? enableBubbles() : disableAnimation('bubbles');
        // Aurora
        data.aurora ? enableAurora() : disableAnimation('aurora');
        // Matrix
        data.matrix ? enableMatrix() : disableAnimation('matrix');
        // Particles
        data.particles ? enableParticles() : disableAnimation('particles');
        // Christmas Lights
        data.christmas_lights ? enableChristmasLights() : disableAnimation('christmas_lights');
        // Golden Border
        // Golden Border
        data.golden_border ? enableGoldenBorder() : disableAnimation('golden_border');
        // Christmas Total
        data.christmas_total ? enableChristmasTotal(data) : disableAnimation('christmas_total');
        // New Year Gold
        data.newyear_gold ? enableNewYearGold() : disableAnimation('newyear_gold');
        // Cyberpunk
        data.cyberpunk ? enableCyberpunk() : disableAnimation('cyberpunk');
        // Warp Speed
        data.warp_speed ? enableWarpSpeed() : disableAnimation('warp_speed');
        // Radar
        data.radar ? enableRadar() : disableAnimation('radar');
        // Synthwave
        data.synthwave ? enableSynthwave() : disableAnimation('synthwave');
        // Circuit
        data.circuit ? enableCircuit() : disableAnimation('circuit');
        // Biotech
        data.biotech ? enableBiotech() : disableAnimation('biotech');
    }

    function disableAnimation(type) {
        const el = document.getElementById(ANIMATION_IDS[type]);
        if (el) {
            if (el.dataset.interval) clearInterval(parseInt(el.dataset.interval));
            if (el.dataset.animFrame) cancelAnimationFrame(parseInt(el.dataset.animFrame));
            el.remove();
        }
    }

    function createContainer(type) {
        if (document.getElementById(ANIMATION_IDS[type])) return null;
        const container = document.createElement('div');
        container.id = ANIMATION_IDS[type];
        container.className = 'animation-container';
        document.body.appendChild(container);
        return container;
    }

    // ==========================================
    // 1. SNOW ❄️
    // ==========================================
    // ==========================================
    // 1. SNOW ❄️ (Enhanced Realistic Version)
    // ==========================================
    function enableSnow() {
        // Performance: Respect user preference for reduced motion
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const container = createContainer('snow');
        if (!container) return;

        const symbols = ['❄', '❅', '❆', '•', '.'];
        // Performance: Reduced count for better performance (was 150)
        // Mobile: 25, Desktop: 50
        const isMobile = window.innerWidth < 768;
        const count = isMobile ? 25 : 50;

        // Use DocumentFragment for batch DOM insertion
        const fragment = document.createDocumentFragment();

        for (let i = 0; i < count; i++) {
            const flake = document.createElement('div');
            flake.className = 'snowflake';
            flake.textContent = symbols[Math.floor(Math.random() * symbols.length)];

            // Random horizontal position
            const leftPos = Math.random() * 100;
            flake.style.left = `${leftPos}vw`;

            // Varied duration for depth perception
            const duration = Math.random() * 5 + 5;
            flake.style.animationDuration = `${duration}s`;

            // Random delay so they don't all start at once
            flake.style.animationDelay = `${Math.random() * 5}s`;

            // Varied opacity
            flake.style.opacity = Math.random() * 0.7 + 0.3;

            // Varied size
            const size = Math.random() * 1.5 + 0.5;
            flake.style.fontSize = `${size}rem`;

            fragment.appendChild(flake);
        }

        container.appendChild(fragment);
    }

    // ==========================================
    // 2. FIREWORKS 🎆 (Realistic Version)
    // ==========================================
    // ==========================================
    // 2. FIREWORKS 🎆 (Realistic Version + Physics)
    // ==========================================
    function enableFireworks() {
        const container = createContainer('fireworks');
        if (!container) return;

        const colors = [
            ['#ff1744', '#ff5252'],     // Red
            ['#ffab00', '#ffd740'],     // Gold
            ['#00e676', '#69f0ae'],     // Green
            ['#2979ff', '#448aff'],     // Blue
            ['#d500f9', '#e040fb'],     // Purple
            ['#00e5ff', '#18ffff'],     // Cyan
        ];

        function launchFirework() {
            if (!document.getElementById('fireworks-container')) return;

            const startX = Math.random() * 80 + 10; // 10-90%
            const targetY = Math.random() * 40 + 15; // Explode at 15-55% from top
            const colorSet = colors[Math.floor(Math.random() * colors.length)];

            // Create rocket
            const rocket = document.createElement('div');
            rocket.className = 'firework-rocket';
            rocket.style.left = `${startX}%`;
            rocket.style.bottom = '0%';
            container.appendChild(rocket);

            // Rocket go up animation
            const riseTime = 1000 + Math.random() * 500;

            // We use Web Animations API for the rocket ascent
            const animation = rocket.animate([
                { bottom: '0%', opacity: 1, transform: 'scale(1)' },
                { bottom: `${100 - targetY}%`, opacity: 1, transform: 'scale(0.8)' }
            ], {
                duration: riseTime,
                easing: 'ease-out',
                fill: 'forwards'
            });

            animation.onfinish = () => {
                rocket.remove();
                createExplosion(startX, targetY, colorSet);
            };
        }

        function createExplosion(x, y, colorSet) {
            const mainColor = colorSet[0];

            // 1. Flash burst
            const flash = document.createElement('div');
            flash.className = 'firework-flash';
            flash.style.left = `${x}%`;
            flash.style.top = `${y}%`;
            flash.style.background = `radial-gradient(circle, ${mainColor} 0%, transparent 70%)`;
            container.appendChild(flash);
            setTimeout(() => flash.remove(), 200);

            // 2. Explosion Particles
            const particleCount = 40; // More particles
            for (let i = 0; i < particleCount; i++) {
                const angle = (360 / particleCount) * i + Math.random() * 10;
                const rad = angle * (Math.PI / 180);

                // Random distance for "spherical" look opacity
                const distance = 80 + Math.random() * 80; // Bigger explosion
                const xDist = Math.cos(rad) * distance;
                const yDist = Math.sin(rad) * distance;

                const particle = document.createElement('div');
                particle.className = 'firework-particle';
                particle.style.setProperty('--color', mainColor);
                particle.style.setProperty('--x', `${xDist}px`);
                particle.style.setProperty('--y', `${yDist}px`);
                particle.style.setProperty('--duration', `${1.5 + Math.random() * 1}s`);

                particle.style.left = `${x}%`;
                particle.style.top = `${y}%`;

                container.appendChild(particle);

                // Cleanup
                setTimeout(() => particle.remove(), 2500);
            }
        }

        // Launch loop
        function scheduleNext() {
            if (!document.getElementById('fireworks-container')) return;
            const delay = 500 + Math.random() * 1500;
            setTimeout(() => {
                launchFirework();
                scheduleNext();
            }, delay);
        }

        // Improved Start: Launch 3 immediately
        launchFirework();
        setTimeout(launchFirework, 300);
        setTimeout(launchFirework, 600);
        scheduleNext();
    }

    // ==========================================
    // 3. HALLOWEEN 🎃 (Realistic Immersive Version)
    // ==========================================
    function enableHalloween() {
        const container = createContainer('halloween');
        if (!container) return;

        // Fog layers
        for (let i = 0; i < 2; i++) {
            const fog = document.createElement('div');
            fog.className = 'halloween-fog';
            container.appendChild(fog);
        }

        // Blood Moon
        const moon = document.createElement('div');
        moon.className = 'halloween-moon';
        container.appendChild(moon);

        // CSS Bats with animated wings
        for (let i = 0; i < 6; i++) {
            const bat = document.createElement('div');
            bat.className = 'halloween-bat';
            bat.style.top = `${10 + Math.random() * 35}%`;
            bat.style.setProperty('--fly-duration', `${12 + Math.random() * 10}s`);
            bat.style.animationDelay = `${Math.random() * 8}s`;

            // Bat body element
            const body = document.createElement('div');
            body.className = 'bat-body';
            bat.appendChild(body);

            container.appendChild(bat);
        }

        // Pumpkins with glowing faces
        for (let i = 0; i < 4; i++) {
            const pumpkin = document.createElement('div');
            pumpkin.className = 'halloween-pumpkin';
            pumpkin.style.left = `${10 + i * 25}%`;
            pumpkin.style.bottom = `${5 + Math.random() * 15}%`;
            pumpkin.style.animationDelay = `${Math.random() * 2}s`;
            pumpkin.style.transform = `scale(${0.8 + Math.random() * 0.4})`;

            // Pumpkin body
            const body = document.createElement('div');
            body.className = 'pumpkin-body';
            pumpkin.appendChild(body);

            // Stem
            const stem = document.createElement('div');
            stem.className = 'pumpkin-stem';
            pumpkin.appendChild(stem);

            // Face container
            const face = document.createElement('div');
            face.className = 'pumpkin-face';

            // Eyes
            const leftEye = document.createElement('div');
            leftEye.className = 'pumpkin-eye left';
            face.appendChild(leftEye);

            const rightEye = document.createElement('div');
            rightEye.className = 'pumpkin-eye right';
            face.appendChild(rightEye);

            // Mouth
            const mouth = document.createElement('div');
            mouth.className = 'pumpkin-mouth';
            face.appendChild(mouth);

            pumpkin.appendChild(face);
            container.appendChild(pumpkin);
        }

        // Ghosts
        for (let i = 0; i < 3; i++) {
            const ghost = document.createElement('div');
            ghost.className = 'halloween-ghost';
            ghost.style.left = `${15 + i * 30}%`;
            ghost.style.top = `${20 + Math.random() * 30}%`;
            ghost.style.setProperty('--float-duration', `${6 + Math.random() * 4}s`);
            ghost.style.animationDelay = `${Math.random() * 5}s`;

            // Ghost body
            const body = document.createElement('div');
            body.className = 'ghost-body';

            // Eyes
            const leftEye = document.createElement('div');
            leftEye.className = 'ghost-eye left';
            body.appendChild(leftEye);

            const rightEye = document.createElement('div');
            rightEye.className = 'ghost-eye right';
            body.appendChild(rightEye);

            // Mouth
            const mouth = document.createElement('div');
            mouth.className = 'ghost-mouth';
            body.appendChild(mouth);

            ghost.appendChild(body);

            // Tail with waves
            const tail = document.createElement('div');
            tail.className = 'ghost-tail';
            for (let j = 0; j < 3; j++) {
                const wave = document.createElement('span');
                tail.appendChild(wave);
            }
            ghost.appendChild(tail);

            container.appendChild(ghost);
        }
    }

    // ==========================================
    // 4. VALENTINE 💕 (Romantic Realistic Version)
    // ==========================================
    function enableValentine() {
        const container = createContainer('valentine');
        if (!container) return;

        const heartColors = [
            '#ff3366', '#ff4477', '#ff5588', '#ff6699',
            '#ee2255', '#dd1144', '#cc0033', '#ff0044'
        ];

        // CSS Hearts rising
        for (let i = 0; i < 15; i++) {
            const heart = document.createElement('div');
            heart.className = 'valentine-heart';
            const size = 20 + Math.random() * 25;
            heart.style.setProperty('--size', `${size}px`);
            heart.style.setProperty('--color', heartColors[Math.floor(Math.random() * heartColors.length)]);
            heart.style.setProperty('--duration', `${8 + Math.random() * 6}s`);
            heart.style.setProperty('--sway', `${-40 + Math.random() * 80}px`);
            heart.style.left = `${Math.random() * 100}%`;
            heart.style.animationDelay = `${Math.random() * 10}s`;

            if (Math.random() > 0.7) heart.classList.add('pulse');
            container.appendChild(heart);
        }

        // Rose Petals
        for (let i = 0; i < 20; i++) {
            const petal = document.createElement('div');
            petal.className = 'valentine-petal';
            const size = 15 + Math.random() * 15;
            petal.style.setProperty('--size', `${size}px`);
            petal.style.setProperty('--duration', `${10 + Math.random() * 8}s`);
            petal.style.left = `${Math.random() * 100}%`;
            petal.style.animationDelay = `${Math.random() * 12}s`;
            container.appendChild(petal);
        }

        // Sparkles
        for (let i = 0; i < 25; i++) {
            const sparkle = document.createElement('div');
            sparkle.className = 'valentine-sparkle';
            sparkle.style.left = `${Math.random() * 100}%`;
            sparkle.style.top = `${Math.random() * 100}%`;
            sparkle.style.setProperty('--duration', `${1 + Math.random() * 2}s`);
            sparkle.style.animationDelay = `${Math.random() * 3}s`;
            container.appendChild(sparkle);
        }

        // Cupid Arrows (occasional)
        function launchArrow() {
            const arrow = document.createElement('div');
            arrow.className = 'valentine-arrow';
            arrow.style.top = `${20 + Math.random() * 50}%`;
            arrow.style.setProperty('--duration', `${4 + Math.random() * 4}s`);
            container.appendChild(arrow);

            setTimeout(() => arrow.remove(), 8000);
        }

        // Launch arrows periodically
        launchArrow();
        setInterval(() => {
            if (container.parentNode) launchArrow();
        }, 5000);
    }

    // ==========================================
    // 5. EASTER 🐰
    // ==========================================
    // ==========================================
    // 5. EASTER 🐰 (Enhanced version)
    // ==========================================
    function enableEaster() {
        const container = createContainer('easter');
        if (!container) return;

        const symbols = ['🥚', '🐣', '🐰', '🌸', '🌷', '🍫'];
        const count = 40; // Increased count

        for (let i = 0; i < count; i++) {
            const element = document.createElement('div');
            element.className = 'easter-element';

            // Inner wrapper for bounce effect
            const inner = document.createElement('span');
            inner.className = 'easter-inner';
            inner.innerHTML = symbols[Math.floor(Math.random() * symbols.length)];
            element.appendChild(inner);

            const leftPos = Math.random() * 100;
            element.style.left = `${leftPos}vw`;

            // Random sway distance
            const sway = (Math.random() - 0.5) * 200; // -100px to +100px
            element.style.setProperty('--sway', `${sway}px`);

            // Duration: 8s to 15s (Slow floating)
            const duration = Math.random() * 7 + 8;
            element.style.setProperty('--duration', `${duration}s`);

            element.style.animationDelay = `${Math.random() * 10}s`;

            // Random size
            const size = Math.random() * 1.5 + 1; // 1rem to 2.5rem
            element.style.fontSize = `${size}rem`;

            container.appendChild(element);
        }
    }

    // ==========================================
    // 6. FIESTAS PATRIAS CHILE 🇨🇱
    // ==========================================
    function enableIndependence() {
        const container = createContainer('independence');
        if (!container) return;

        // Chile flag colors: Red, White, Blue
        const colors = ['#D52B1E', '#FFFFFF', '#0039A6'];

        for (let i = 0; i < 20; i++) {
            const ribbon = document.createElement('div');
            ribbon.className = 'independence-ribbon';
            ribbon.style.left = `${Math.random() * 100}vw`;
            ribbon.style.animationDuration = `${Math.random() * 8 + 6}s`;
            ribbon.style.animationDelay = `${Math.random() * 5}s`;
            ribbon.style.background = colors[i % 3];
            container.appendChild(ribbon);
        }

        // Chilean star
        for (let i = 0; i < 5; i++) {
            const star = document.createElement('div');
            star.className = 'independence-star';
            star.innerHTML = '⭐';
            star.style.left = `${15 + i * 18}%`;
            star.style.animationDelay = `${i * 1.5}s`;
            container.appendChild(star);
        }
    }

    // ==========================================
    // 7. RAIN 🌧️ (Realistic Version)
    // ==========================================
    function enableRain() {
        // Performance: Respect user preference for reduced motion
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const container = createContainer('rain');
        if (!container) return;

        // Performance: Reduced count (was 120)
        const isMobile = window.innerWidth < 768;
        const dropCount = isMobile ? 30 : 50;
        const splashCount = isMobile ? 5 : 10;

        const fragment = document.createDocumentFragment();

        // Rain drops with varying sizes
        for (let i = 0; i < dropCount; i++) {
            const drop = document.createElement('div');
            drop.className = 'rain-drop';
            const height = 15 + Math.random() * 25;
            const width = 1 + Math.random() * 2;
            drop.style.setProperty('--height', `${height}px`);
            drop.style.setProperty('--width', `${width}px`);
            drop.style.setProperty('--duration', `${0.4 + Math.random() * 0.4}s`);
            drop.style.setProperty('--angle', `${5 + Math.random() * 8}deg`);
            drop.style.setProperty('--opacity', `${0.3 + Math.random() * 0.4}`);
            drop.style.left = `${Math.random() * 100}%`;
            drop.style.animationDelay = `${Math.random() * 2}s`;
            fragment.appendChild(drop);
        }

        // Splash effects at bottom
        for (let i = 0; i < splashCount; i++) {
            const splash = document.createElement('div');
            splash.className = 'rain-splash';
            splash.style.left = `${Math.random() * 100}%`;
            splash.style.animationDelay = `${Math.random() * 2}s`;
            splash.style.animationDuration = `${0.3 + Math.random() * 0.3}s`;
            fragment.appendChild(splash);
        }

        container.appendChild(fragment);
    }

    // ==========================================
    // 8. AUTUMN LEAVES 🍂
    // ==========================================
    function enableAutumn() {
        const container = createContainer('autumn');
        if (!container) return;

        const leaves = ['🍂', '🍁', '🍃', '🌾'];
        for (let i = 0; i < 30; i++) {
            const leaf = document.createElement('div');
            leaf.className = 'autumn-leaf';
            leaf.innerHTML = leaves[Math.floor(Math.random() * leaves.length)];
            leaf.style.left = `${Math.random() * 100}vw`;
            leaf.style.animationDuration = `${Math.random() * 8 + 6}s`;
            leaf.style.animationDelay = `${Math.random() * 5}s`;
            leaf.style.fontSize = `${Math.random() * 1.5 + 1}rem`;
            container.appendChild(leaf);
        }
    }

    // ==========================================
    // 9. BUBBLES 🫧 (Realistic Version)
    // ==========================================
    function enableBubbles() {
        const container = createContainer('bubbles');
        if (!container) return;

        for (let i = 0; i < 25; i++) {
            const bubble = document.createElement('div');
            bubble.className = 'bubble';
            const size = 15 + Math.random() * 45;
            bubble.style.width = `${size}px`;
            bubble.style.height = `${size}px`;
            bubble.style.setProperty('--duration', `${6 + Math.random() * 6}s`);
            bubble.style.setProperty('--wobble', `${2 + Math.random() * 2}s`);
            bubble.style.setProperty('--sway', `${-30 + Math.random() * 60}px`);
            bubble.style.left = `${Math.random() * 100}%`;
            bubble.style.animationDelay = `${Math.random() * 8}s`;
            container.appendChild(bubble);
        }
    }

    // ==========================================
    // 10. AURORA BOREALIS 🌌 (Realistic)
    // ==========================================
    function enableAurora() {
        const container = createContainer('aurora');
        if (!container) return;

        // 5 wave layers with different timings
        for (let i = 0; i < 5; i++) {
            const wave = document.createElement('div');
            wave.className = 'aurora-wave';
            wave.style.animationDelay = `${i * 3}s`;
            container.appendChild(wave);
        }

        // 8 vertical curtain streaks
        for (let i = 0; i < 8; i++) {
            const curtain = document.createElement('div');
            curtain.className = 'aurora-curtain';
            curtain.style.left = `${5 + i * 12}%`;
            curtain.style.animationDelay = `${i * 1.5}s`;
            curtain.style.width = `${60 + Math.random() * 80}px`;
            curtain.style.opacity = 0.3 + Math.random() * 0.4;
            container.appendChild(curtain);
        }
    }

    // ==========================================
    // 11. MATRIX 💻
    // ==========================================
    function enableMatrix() {
        const container = createContainer('matrix');
        if (!container) return;

        const chars = 'アイウエオカキクケコサシスセソタチツテト0123456789';
        const columns = Math.floor(window.innerWidth / 20);

        for (let i = 0; i < columns; i++) {
            const column = document.createElement('div');
            column.className = 'matrix-column';
            column.style.left = `${i * 20}px`;
            column.style.animationDuration = `${Math.random() * 3 + 2}s`;
            column.style.animationDelay = `${Math.random() * 3}s`;

            let text = '';
            for (let j = 0; j < 30; j++) {
                text += chars[Math.floor(Math.random() * chars.length)] + '<br>';
            }
            column.innerHTML = text;
            container.appendChild(column);
        }
    }

    // ==========================================
    // 12. CONNECTED PARTICLES 🔗 (Enhanced Version)
    // ==========================================
    function enableParticles() {
        const container = createContainer('particles');
        if (!container) return;

        const canvas = document.createElement('canvas');
        canvas.id = 'particles-canvas';
        canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        let particles = [];
        // Performance: Reduced count (was 80)
        const isMobile = window.innerWidth < 768;
        const particleCount = isMobile ? 25 : 40;
        const connectionDistance = 120;

        // Color palette
        const colors = [
            { r: 119, g: 150, b: 203 },  // Blue
            { r: 150, g: 119, b: 203 },  // Purple
            { r: 119, g: 203, b: 180 },  // Teal
            { r: 203, g: 150, b: 119 },  // Orange
        ];

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resize();
        window.addEventListener('resize', resize);

        class Particle {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.vx = (Math.random() - 0.5) * 0.8;
                this.vy = (Math.random() - 0.5) * 0.8;
                this.baseRadius = 2 + Math.random() * 3;
                this.radius = this.baseRadius;
                this.color = colors[Math.floor(Math.random() * colors.length)];
                this.pulseSpeed = 0.02 + Math.random() * 0.02;
                this.pulseOffset = Math.random() * Math.PI * 2;
            }

            update(time) {
                this.x += this.vx;
                this.y += this.vy;

                // Bounce off edges with slight damping
                if (this.x < 0 || this.x > canvas.width) this.vx *= -0.95;
                if (this.y < 0 || this.y > canvas.height) this.vy *= -0.95;

                // Keep in bounds
                this.x = Math.max(0, Math.min(canvas.width, this.x));
                this.y = Math.max(0, Math.min(canvas.height, this.y));

                // Pulse effect
                this.radius = this.baseRadius + Math.sin(time * this.pulseSpeed + this.pulseOffset) * 1;
            }

            draw() {
                const { r, g, b } = this.color;

                // Glow effect
                const gradient = ctx.createRadialGradient(
                    this.x, this.y, 0,
                    this.x, this.y, this.radius * 4
                );
                gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.8)`);
                gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.3)`);
                gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius * 4, 0, Math.PI * 2);
                ctx.fillStyle = gradient;
                ctx.fill();

                // Core
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 1)`;
                ctx.fill();

                // Bright center
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius * 0.4, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, 0.8)`;
                ctx.fill();
            }
        }

        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }

        let time = 0;
        function animate() {
            if (!document.getElementById(ANIMATION_IDS.particles)) return;

            time++;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Update and draw particles
            particles.forEach(p => {
                p.update(time);
            });

            // Draw connections first (behind particles)
            ctx.lineWidth = 1;
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < connectionDistance) {
                        const opacity = 0.4 * (1 - dist / connectionDistance);
                        const { r: r1, g: g1, b: b1 } = particles[i].color;
                        const { r: r2, g: g2, b: b2 } = particles[j].color;

                        // Gradient line between particles
                        const gradient = ctx.createLinearGradient(
                            particles[i].x, particles[i].y,
                            particles[j].x, particles[j].y
                        );
                        gradient.addColorStop(0, `rgba(${r1}, ${g1}, ${b1}, ${opacity})`);
                        gradient.addColorStop(1, `rgba(${r2}, ${g2}, ${b2}, ${opacity})`);

                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = gradient;
                        ctx.stroke();
                    }
                }
            }

            // Draw particles on top
            particles.forEach(p => p.draw());

            container.dataset.animFrame = requestAnimationFrame(animate);
        }
        animate();
    }

    // ==========================================
    // 13. CHRISTMAS LIGHTS 🎄 (Background Version)
    // ==========================================
    function enableChristmasLights() {
        const container = createContainer('christmas_lights');
        if (!container) return;

        container.className = 'christmas-lights-background';

        const colors = ['#ff3333', '#33ff33', '#3333ff', '#ffff33', '#ff33ff', '#33ffff', '#ff9933', '#ffffff'];
        const lightCount = 60; // Scattered lights across the screen

        for (let i = 0; i < lightCount; i++) {
            const light = document.createElement('div');
            light.className = 'bg-light';

            const color = colors[i % colors.length];
            light.style.setProperty('--light-color', color);

            // Random position across the entire screen
            light.style.left = `${Math.random() * 100}%`;
            light.style.top = `${Math.random() * 100}%`;

            // Random size (small to medium)
            const size = 4 + Math.random() * 8;
            light.style.width = `${size}px`;
            light.style.height = `${size}px`;

            // Random animation delay for staggered twinkling
            light.style.animationDelay = `${Math.random() * 3}s`;

            // Random animation duration for variety
            light.style.animationDuration = `${1.5 + Math.random() * 2}s`;

            container.appendChild(light);
        }
    }

    // ==========================================
    // 14. GOLDEN BORDER SHIMMER ✨
    // ==========================================
    function enableGoldenBorder() {
        const container = createContainer('golden_border');
        if (!container) return;

        container.className = 'golden-border-effect';

        // Create 4 border sides
        const sides = ['top', 'right', 'bottom', 'left'];
        sides.forEach((side, index) => {
            const border = document.createElement('div');
            border.className = `golden-border golden-border-${side}`;
            border.style.animationDelay = `${index * 0.5}s`;
            container.appendChild(border);
        });

        // Add corner sparkles
        const corners = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
        corners.forEach(corner => {
            const sparkle = document.createElement('div');
            sparkle.className = `golden-sparkle golden-sparkle-${corner}`;
            container.appendChild(sparkle);
        });
    }

    // ==========================================
    // 15. VICTORY CONFETTI 🎉 (Global Trigger)
    // ==========================================
    window.triggerVictoryConfetti = function () {
        // Create container if not exists, but this is a temporary effect
        // We'll use a fixed overlay for this
        let canvas = document.getElementById('victory-confetti');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'victory-confetti';
            canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
            document.body.appendChild(canvas);
        }

        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles = [];
        const particleCount = 150;
        const colors = ['#22c55e', '#10b981', '#34d399', '#fbbf24', '#f59e0b', '#ffffff'];

        // Explosion from center
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: canvas.width / 2,
                y: canvas.height / 2,
                vx: (Math.random() - 0.5) * 25, // Fast explosion
                vy: (Math.random() - 0.5) * 25,
                gravity: 0.5,
                drag: 0.96,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: Math.random() * 8 + 4,
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 10,
                opacity: 1
            });
        }

        let animationId;
        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let activeParticles = false;

            particles.forEach(p => {
                if (p.opacity <= 0) return;
                activeParticles = true;

                p.x += p.vx;
                p.y += p.vy;
                p.vy += p.gravity; // Gravity
                p.vx *= p.drag;    // Air resistance
                p.vy *= p.drag;
                p.rotation += p.rotationSpeed;
                p.opacity -= 0.015; // Fade out

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.globalAlpha = p.opacity;
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();
            });

            if (activeParticles) {
                animationId = requestAnimationFrame(animate);
            } else {
                // Cleanup
                cancelAnimationFrame(animationId);
                if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
            }
        }

        animate();
    };


    // ==========================================
    // 13. CHRISTMAS TOTAL 🎅 (Realistic & Cinematic)
    // ==========================================
    function enableChristmasTotal(data) {
        const container = createContainer('christmas_total');
        if (!container) return;

        // A. HYPER-REAL ATMOSPHERE (Background)
        // 1. Starfield (Static + Twinkling)
        const starContainer = document.createElement('div');
        starContainer.style.position = 'fixed';
        starContainer.style.top = '0';
        starContainer.style.left = '0';
        starContainer.style.width = '100%';
        starContainer.style.height = '100%';
        starContainer.style.zIndex = '0';

        // Generate stars using box-shadow for performance
        let starsSmall = '';
        let starsMedium = '';
        const w = window.innerWidth;
        const h = window.innerHeight;
        for (let i = 0; i < 200; i++) {
            starsSmall += `${Math.random() * w}px ${Math.random() * h}px 0 white, `;
            if (i < 50) starsMedium += `${Math.random() * w}px ${Math.random() * h}px 0 rgba(255,255,255,0.5), `;
        }
        const smallStars = document.createElement('div');
        smallStars.style.width = '1px';
        smallStars.style.height = '1px';
        smallStars.style.boxShadow = starsSmall.slice(0, -2);
        starContainer.appendChild(smallStars);

        container.appendChild(starContainer);

        // 2. Realistic Moon (CSS Craters) 🌕
        const moon = document.createElement('div');
        moon.style.position = 'fixed';
        moon.style.top = '5%';
        moon.style.right = '10%';
        moon.style.width = '120px';
        moon.style.height = '120px';
        moon.style.borderRadius = '50%';
        // Complex gradient for crater illusion
        moon.style.background = 'radial-gradient(circle at 30% 30%, #fffdf0, #e6e6d8)';
        moon.style.boxShadow = '0 0 60px rgba(255, 253, 224, 0.4), inset -20px -20px 50px rgba(0,0,0,0.1)';
        moon.style.zIndex = '1';

        // Craters
        const craters = document.createElement('div');
        craters.style.position = 'absolute';
        craters.style.top = '0';
        craters.style.left = '0';
        craters.style.width = '100%';
        craters.style.height = '100%';
        craters.style.borderRadius = '50%';
        craters.style.backgroundImage = `
            radial-gradient(circle at 70% 20%, rgba(200,200,200,0.3) 10%, transparent 11%),
            radial-gradient(circle at 30% 60%, rgba(200,200,200,0.3) 15%, transparent 16%),
            radial-gradient(circle at 80% 50%, rgba(200,200,200,0.2) 8%, transparent 9%)
        `;
        moon.appendChild(craters);
        container.appendChild(moon);

        // 3. Moving Clouds/Mist (CSS Parallax) ☁️
        for (let c = 0; c < 2; c++) {
            const cloud = document.createElement('div');
            cloud.style.position = 'fixed';
            cloud.style.top = `${10 + c * 20}%`;
            cloud.style.left = '0';
            cloud.style.width = '200%';
            cloud.style.height = '300px';
            cloud.style.background = 'radial-gradient(ellipse at center, rgba(255,255,255,0.05) 0%, transparent 70%)';
            cloud.style.opacity = '0.7';
            cloud.style.zIndex = '2'; // In front of stars/moon, behind Santa
            cloud.style.filter = 'blur(40px)';

            cloud.animate([
                { transform: 'translateX(-50%)' },
                { transform: 'translateX(0%)' }
            ], {
                duration: 60000 + c * 30000, // Very slow
                iterations: Infinity,
                direction: c % 2 === 0 ? 'normal' : 'reverse' // Alternate direction
            });
            container.appendChild(cloud);
        }

        // B. REALISTIC SNOW (Parallax Layers)
        const layers = 3;
        for (let l = 0; l < layers; l++) {
            const layer = document.createElement('div');
            layer.className = `snow-layer-${l}`;
            layer.style.position = 'fixed';
            layer.style.top = '0';
            layer.style.left = '0';
            layer.style.width = '100%';
            layer.style.height = '100%';
            layer.style.pointerEvents = 'none';
            layer.style.zIndex = '9990';
            container.appendChild(layer);

            const count = 50 + (l * 30);
            for (let i = 0; i < count; i++) {
                const flake = document.createElement('div');
                // Use rounded div instead of text for realism
                flake.className = 'real-snowflake';
                flake.style.position = 'absolute';
                flake.style.background = 'white';
                flake.style.borderRadius = '50%';

                // Depth effects
                const size = (l + 1) * 2 + Math.random() * 2;
                flake.style.width = `${size}px`;
                flake.style.height = `${size}px`;
                flake.style.opacity = 0.4 + (l * 0.2);
                flake.style.filter = `blur(${3 - l}px)`; // Farther snow is blurrier

                flake.style.left = `${Math.random() * 100}vw`;
                flake.style.top = `-${Math.random() * 20}vh`; // Start above

                // Physics
                const duration = 10 - (l * 2) + Math.random() * 5; // Closer layers fall faster
                flake.animate([
                    { transform: `translate(0, -10vh)` },
                    { transform: `translate(${Math.random() * 100 - 50}px, 110vh)` }
                ], {
                    duration: duration * 1000,
                    iterations: Infinity,
                    delay: Math.random() * -20000 // Start mid-air
                });

                layer.appendChild(flake);
            }
        }

        // C. REALISTIC CURVED LIGHTS 💡 (SVG Catenary)
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.style.position = "fixed";
        svg.style.top = "0";
        svg.style.left = "0";
        svg.style.width = "100%";
        svg.style.height = "150px";
        svg.style.zIndex = "9998";
        svg.style.pointerEvents = "none";

        // Draw the wire (Catenary curve approximation)
        const path = document.createElementNS(svgNS, "path");
        // A simple curve from -10% to 110% width
        path.setAttribute("d", "M -100,0 Q 50% 150, 20000,0"); // Overkill width to cover screens, simple quadratic
        // Better: Dynamic calculation? For now static quadratic is okay for top hang.
        // Actually, let's just do a nice curve based on 100vw
        const width = window.innerWidth;
        path.setAttribute("d", `M 0,0 Q ${width / 2},120 ${width},0`);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "#222");
        path.setAttribute("stroke-width", "2");
        svg.appendChild(path);

        // Add Bulbs along the curve
        const bulbCount = 40;
        const colors = ['#ff4444', '#44ff44', '#ffff44', '#4444ff', '#ff00ff'];

        for (let i = 1; i < bulbCount; i++) {
            const t = i / bulbCount;
            // Quadratic Bezier Point: B(t) = (1-t)^2*P0 + 2(1-t)t*P1 + t^2*P2
            // P0=(0,0), P1=(w/2, 120), P2=(w, 0)
            const x = (1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * (width / 2) + t * t * width;
            const y = (1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * 120 + t * t * 0;

            const bulb = document.createElementNS(svgNS, "circle");
            bulb.setAttribute("cx", x);
            bulb.setAttribute("cy", y + 5); // Hang slightly below wire
            bulb.setAttribute("r", "4");
            const color = colors[i % colors.length];
            bulb.setAttribute("fill", color);

            // Glow effect
            const animate = document.createElementNS(svgNS, "animate");
            animate.setAttribute("attributeName", "opacity");
            animate.setAttribute("values", "0.4; 1; 0.4");
            animate.setAttribute("dur", `${1 + Math.random()}s`);
            animate.setAttribute("repeatCount", "indefinite");
            bulb.appendChild(animate);

            svg.appendChild(bulb);
        }
        container.appendChild(svg);

        // Handle Resize for Wire
        window.addEventListener('resize', () => {
            const w = window.innerWidth;
            path.setAttribute("d", `M 0,0 Q ${w / 2},120 ${w},0`);
            // Re-calculating bulbs is hard without re-drawing. 
            // Ideally we'd remove and re-add. For this prototype, we'll leave it or reload.
        });

        // Add Galloping Keyframe
        const gallopStyle = document.createElement('style');
        gallopStyle.textContent = `
            @keyframes gallop {
                0%, 100% { transform: translateY(0) rotate(0deg) scaleX(-1); }
                25% { transform: translateY(-5px) rotate(-5deg) scaleX(-1); }
                50% { transform: translateY(0) rotate(0deg) scaleX(-1); }
                75% { transform: translateY(3px) rotate(5deg) scaleX(-1); }
            }
        `;
        container.appendChild(gallopStyle);


        // D. MAGIC SANTA (Silhouette + Particle Trail) - Less Cartoony
        // D. MAGIC SANTA (Real Silhouette using Noto Emoji)
        const santaGroup = document.createElement('div');
        santaGroup.style.position = 'fixed';
        santaGroup.style.zIndex = '9999';
        santaGroup.style.top = '15%';
        santaGroup.style.willChange = 'transform';
        santaGroup.style.display = 'flex';
        santaGroup.style.alignItems = 'flex-end';
        // Add Bloom to the whole group for magic feel
        santaGroup.style.filter = 'drop-shadow(0 20px 20px rgba(0,0,0,0.6))';

        // Base URL for stable emoji images
        const emBase = 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/128/';
        // Silhouette Filter: High contrast silhouette with slight "moonlight" tint (blueish)
        const silhouetteStyle = 'height: 60px; width: auto; filter: brightness(0) drop-shadow(0 0 1px rgba(255,255,255,0.2)); margin-right: -12px;';


        // 2. Sleigh + Santa Container
        const sleighCont = document.createElement('div');
        sleighCont.style.position = 'relative';
        sleighCont.style.marginLeft = '20px'; // Rope gap

        // Sleigh
        const sleigh = document.createElement('img');
        sleigh.src = `${emBase}emoji_u1f6f7.png`; // Sleigh
        sleigh.style.cssText = silhouetteStyle;
        sleigh.style.transform = 'scaleX(-1)';
        sleighCont.appendChild(sleigh);

        // Santa (Sitting in sleigh)
        const santaImg = document.createElement('img');
        santaImg.src = `${emBase}emoji_u1f385.png`; // Santa
        santaImg.style.cssText = silhouetteStyle;
        santaImg.style.position = 'absolute';
        santaImg.style.left = '10px';
        santaImg.style.bottom = '15px'; // Sit down
        santaImg.style.height = '40px';
        santaImg.style.transform = 'scaleX(-1) rotate(-10deg)';
        sleighCont.appendChild(santaImg);

        santaGroup.appendChild(sleighCont);

        // 1. Reindeers (3 pairs = 3 images)
        for (let r = 0; r < 3; r++) {
            const deer = document.createElement('img');
            deer.src = `${emBase}emoji_u1f98c.png`; // Deer
            deer.style.cssText = silhouetteStyle;
            deer.style.transformOrigin = 'bottom center';
            deer.style.animation = `gallop 0.4s infinite linear`;
            deer.style.animationDelay = `${r * -0.1}s`; // Offset legs
            // Wait, animation moves LEFT to RIGHT (translate 120vw).
            // MDI/Emoji usually face LEFT.
            // If flying Left->Right, we need to flip them to face Right: scaleX(-1).
            santaGroup.appendChild(deer);
        }

        // Magic Trail (Particles)
        const trail = document.createElement('div');
        trail.style.position = 'absolute';
        trail.style.top = '20px';
        trail.style.right = '0'; // Behind sleigh
        santaGroup.appendChild(trail);

        // Animate Trail
        setInterval(() => {
            const part = document.createElement('div');
            part.style.width = '4px';
            part.style.height = '4px';
            part.style.background = 'gold';
            part.style.borderRadius = '50%';
            part.style.position = 'absolute';
            part.style.top = `${Math.random() * 10}px`;
            part.style.right = `${Math.random() * 50}px`;
            part.style.boxShadow = '0 0 5px gold';
            part.style.pointerEvents = 'none';

            // Fade out
            part.animate([
                { opacity: 1, transform: 'scale(1) translate(0,0)' },
                { opacity: 0, transform: 'scale(0) translate(-50px, 10px)' }
            ], {
                duration: 1000,
                iterations: 1
            }).onfinish = () => part.remove();

            trail.appendChild(part);
        }, 50);

        container.appendChild(santaGroup);

        // PHYSICS FLIGHT LOOP ✈️
        let startTime = performance.now();
        const flightDuration = 20000; // Slower, more majestic

        // Turbulence Noise Generator (Simple pseudo-random)
        let noiseOffset = 0;

        function fly(timestamp) {
            if (!startTime) startTime = timestamp;
            const progress = (timestamp - startTime) % flightDuration;
            const percent = progress / flightDuration; // 0 to 1

            // X Position: Linear flight
            const x = (percent * 130) - 15; // Start earlier, end later

            // Y Position: Turbulence ! Sine Wave
            // We sum multiple sine waves to create "random" turbulence
            noiseOffset += 0.02;
            const wave1 = Math.sin(percent * Math.PI * 2) * 5; // Main arc
            const wave2 = Math.sin(noiseOffset) * 1.5; // High freq turbulence
            const wave3 = Math.cos(noiseOffset * 0.5) * 2; // Slow drift

            const y = 15 + wave1 + wave2 + wave3;

            // Rotation: Aerodynamic Tilt + Pitching
            const slope = (Math.cos(percent * Math.PI * 2) * 5) + (Math.cos(noiseOffset) * 1.5);
            // Smooth damping
            const tilt = slope * 2;

            santaGroup.style.left = `${x}vw`;
            santaGroup.style.top = `${y}vh`;
            santaGroup.style.transform = `rotate(${tilt}deg)`;

            // Update Snow Wind based on Santa's speed?
            // Let's just vary wind slowly
            const wind = Math.sin(timestamp * 0.0005) * 20;
            container.style.setProperty('--wind', `${wind}px`);

            if (document.body.contains(container)) {
                requestAnimationFrame(fly);
            }
        }
        requestAnimationFrame(fly);

        // E. CINEMATIC GREETING
        const greeting = document.createElement('div');
        greeting.innerHTML = '✨ Feliz Navidad ✨';
        greeting.style.position = 'fixed';
        greeting.style.bottom = '30px';
        greeting.style.left = '50%';
        greeting.style.transform = 'translateX(-50%)';
        greeting.style.fontSize = '2rem';
        greeting.style.color = 'transparent';
        greeting.style.background = 'linear-gradient(45deg, #ffd700, #fff, #ffd700)';
        greeting.style.backgroundClip = 'text';
        greeting.style.webkitBackgroundClip = 'text';
        greeting.style.fontFamily = "'Cinzel', serif"; // Attempt to use a serif font
        greeting.style.letterSpacing = '5px';
        greeting.style.textShadow = '0 0 30px rgba(255, 215, 0, 0.3)';
        greeting.style.opacity = '0';
        greeting.style.zIndex = '9999';

        greeting.animate([
            { opacity: 0, transform: 'translateX(-50%) translateY(20px)' },
            { opacity: 1, transform: 'translateX(-50%) translateY(0)' }
        ], {
            duration: 2000,
            delay: 1000,
            fill: 'forwards'
        });

        container.appendChild(greeting);
    }

    // ==========================================
    // F. NEW YEAR GOLD 2026 🥂 (Premium)
    // ==========================================
    function enableNewYearGold() {
        const container = createContainer('newyear_gold');
        if (!container) return;

        // 1. Gold Rain (Canvas for performance)
        const canvas = document.createElement('canvas');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.zIndex = '9998'; // Behind text
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const particles = [];
        const particleCount = 100;

        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                speed: Math.random() * 2 + 1,
                size: Math.random() * 3 + 1,
                alpha: Math.random()
            });
        }

        function renderGoldRain() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#FFD700';

            particles.forEach(p => {
                p.y += p.speed;
                if (p.y > canvas.height) p.y = 0;

                ctx.globalAlpha = p.alpha;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });

            if (document.body.contains(container)) requestAnimationFrame(renderGoldRain);
        }
        renderGoldRain();

        // 2. Cinematic 2026 Text
        const text = document.createElement('div');
        text.innerHTML = '2026';
        text.style.position = 'fixed';
        text.style.top = '50%';
        text.style.left = '50%';
        text.style.transform = 'translate(-50%, -50%)';
        text.style.fontSize = '15vw';
        text.style.fontFamily = "'Cinzel', serif";
        text.style.fontWeight = 'bold';
        text.style.color = 'transparent';
        text.style.webkitTextStroke = '2px #FFD700'; // Gold stroke
        text.style.zIndex = '9999';
        text.style.opacity = '0.3';
        // Elegant pulse
        text.animate([
            { opacity: 0.3, transform: 'translate(-50%, -50%) scale(1)' },
            { opacity: 0.6, transform: 'translate(-50%, -50%) scale(1.05)' }
        ], { duration: 3000, iterations: Infinity, direction: 'alternate' });

        container.appendChild(text);

        // 3. Realistic Gold Explosions
        setInterval(() => {
            const x = Math.random() * 100;
            const y = Math.random() * 50;
            createGoldExplosion(container, x, y);
        }, 1200);
    }

    function createGoldExplosion(container, x, y) {
        const explosion = document.createElement('div');
        explosion.style.position = 'fixed';
        explosion.style.left = `${x}%`;
        explosion.style.top = `${y}%`;
        explosion.style.pointerEvents = 'none';

        for (let i = 0; i < 30; i++) {
            const spark = document.createElement('div');
            spark.style.position = 'absolute';
            spark.style.width = '4px';
            spark.style.height = '4px';
            spark.style.background = `hsl(${45 + Math.random() * 15}, 100%, 50%)`; // Gold/Orange
            spark.style.borderRadius = '50%';

            // Random direction
            const angle = Math.random() * Math.PI * 2;
            const velocity = Math.random() * 100 + 50;
            const tx = Math.cos(angle) * velocity;
            const ty = Math.sin(angle) * velocity;

            spark.animate([
                { transform: 'translate(0,0) scale(1)', opacity: 1 },
                { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 }
            ], {
                duration: 1000 + Math.random() * 500,
                easing: 'cubic-bezier(0, .9, .57, 1)'
            });

            explosion.appendChild(spark);
        }

        container.appendChild(explosion);
        setTimeout(() => explosion.remove(), 2000);
    }

    // ==========================================
    // G. CYBERPUNK MODE 🦾 (Sci-Fi)
    // ==========================================
    function enableCyberpunk() {
        const container = createContainer('cyberpunk');
        if (!container) return;

        // 1. Overlay Scanlines
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0, 255, 255, 0.03) 3px)';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '9999';
        // Vignette
        overlay.style.boxShadow = 'inset 0 0 100px rgba(0,0,0,0.9)';
        container.appendChild(overlay);

        // 2. Neon Rain (Matrix style but Cyan/Pink)
        const canvas = document.createElement('canvas');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.zIndex = '9998';
        canvas.style.opacity = '0.4';
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const columns = Math.floor(canvas.width / 20);
        const drops = Array(columns).fill(0);

        function drawCyberRain() {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.font = '15px monospace';

            for (let i = 0; i < drops.length; i++) {
                const text = Math.random() > 0.5 ? '1' : '0';
                // Alternating colors
                ctx.fillStyle = i % 2 === 0 ? '#0ff' : '#f0f';
                ctx.fillText(text, i * 20, drops[i] * 20);

                if (drops[i] * 20 > canvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i]++;
            }
            if (document.body.contains(container)) requestAnimationFrame(drawCyberRain);
        }
        drawCyberRain();

        // 3. Glitch HUD Element
        const hud = document.createElement('div');
        hud.textContent = 'SYSTEM_ONLINE // NOC_SECURE';
        hud.style.position = 'fixed';
        hud.style.top = '20px';
        hud.style.right = '20px';
        hud.style.fontFamily = 'monospace';
        hud.style.color = '#0ff';
        hud.style.zIndex = '10000';
        hud.style.textShadow = '2px 0 #f0f';
        container.appendChild(hud);

        // Glitch Interval
        setInterval(() => {
            hud.style.transform = `translate(${Math.random() * 4 - 2}px, ${Math.random() * 4 - 2}px)`;
            hud.style.textShadow = Math.random() > 0.8 ? '-2px 0 red, 2px 0 blue' : '2px 0 #f0f';
        }, 100);
    }

    // ==========================================
    // H. WARP SPEED 🚀 (Interstellar)
    // ==========================================
    function enableWarpSpeed() {
        const container = createContainer('warp_speed');
        if (!container) return;

        const canvas = document.createElement('canvas');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.zIndex = '0'; // Background
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        const stars = [];
        const starCount = 300; // Dense field

        for (let i = 0; i < starCount; i++) {
            stars.push({
                x: Math.random() * canvas.width - cx,
                y: Math.random() * canvas.height - cy,
                z: Math.random() * canvas.width // Depth
            });
        }

        function drawWarp() {
            // Fill with semi-transparent black for trails
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = 'white';

            stars.forEach(star => {
                // Move star closer
                star.z -= 15; // Speed
                if (star.z <= 0) {
                    star.z = canvas.width;
                    star.x = Math.random() * canvas.width - cx;
                    star.y = Math.random() * canvas.height - cy;
                }

                const k = 128.0 / star.z;
                const px = star.x * k + cx;
                const py = star.y * k + cy;

                if (px >= 0 && px <= canvas.width && py >= 0 && py <= canvas.height) {
                    const size = (1 - star.z / canvas.width) * 4;
                    // Draw Streak
                    const oldPx = star.x * (128.0 / (star.z + 15)) + cx;
                    const oldPy = star.y * (128.0 / (star.z + 15)) + cy;

                    ctx.beginPath();
                    ctx.moveTo(oldPx, oldPy);
                    ctx.lineTo(px, py);
                    ctx.strokeStyle = `rgba(255, 255, 255, ${1 - star.z / canvas.width})`;
                    ctx.lineWidth = size * 0.5;
                    ctx.stroke();
                }
            });

            if (document.body.contains(container)) requestAnimationFrame(drawWarp);
        }
        drawWarp();
    }

    // ==========================================
    // I. RADAR NOC 📡 (Tactical)
    // ==========================================
    function enableRadar() {
        const container = createContainer('radar');
        if (!container) return;

        // Dark green tactical overlay
        const canvas = document.createElement('canvas');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.zIndex = '9998'; // Below text usually
        canvas.style.opacity = '0.4';
        canvas.style.pointerEvents = 'none';
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        // Radar radius covers the whole screen
        const maxRadius = Math.max(canvas.width, canvas.height);

        let angle = 0;
        // Simulated targets
        const targets = [];
        for (let i = 0; i < 10; i++) {
            targets.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                life: 0 // 0 to 1, 1 is bright
            });
        }

        function drawRadar() {
            // Fade out
            ctx.fillStyle = 'rgba(0, 20, 0, 0.05)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Grid
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.1)';
            ctx.lineWidth = 1;

            // Concentric circles
            ctx.beginPath();
            for (let r = 100; r < maxRadius; r += 150) {
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
            }
            ctx.stroke();

            // Crosshairs
            ctx.beginPath();
            ctx.moveTo(0, cy);
            ctx.lineTo(canvas.width, cy);
            ctx.moveTo(cx, 0);
            ctx.lineTo(cx, canvas.height);
            ctx.stroke();

            // Sweep Line
            angle += 0.02;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(angle) * maxRadius, cy + Math.sin(angle) * maxRadius);
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#0f0';
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Sweep Gradient (The "fan")
            const gradient = ctx.createConicGradient(angle - Math.PI / 2, cx, cy); // Corrected angle for conic
            // Actually conic gradient is supported in modern browsers
            // If not, we skip the fan or use simple line
            // Let's stick to line + targets for simplicity/compatibility

            // Check Targets
            const sweepX = Math.cos(angle);
            const sweepY = Math.sin(angle);

            targets.forEach(t => {
                // Determine angle of target
                const tx = t.x - cx;
                const ty = t.y - cy;
                const tAngle = Math.atan2(ty, tx);

                // Normalize angles
                let diff = angle - tAngle;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;

                // If sweep passes over
                if (Math.abs(diff) < 0.05) {
                    t.life = 1.0;
                }

                if (t.life > 0) {
                    ctx.fillStyle = `rgba(0, 255, 0, ${t.life})`;
                    ctx.beginPath();
                    ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
                    ctx.fill();
                    // ID text next to blip
                    ctx.fillStyle = `rgba(0, 255, 0, ${t.life})`;
                    ctx.font = '10px monospace';
                    ctx.fillText(`TRG-${Math.floor(t.x)}`, t.x + 8, t.y);

                    t.life -= 0.01;
                }
            });

            if (document.body.contains(container)) requestAnimationFrame(drawRadar);
        }
        drawRadar();
    }

    // ==========================================
    // J. SYNTHWAVE 80s 🕶️ (Retro)
    // ==========================================
    function enableSynthwave() {
        const container = createContainer('synthwave');
        if (!container) return;

        const mainDiv = document.createElement('div');
        mainDiv.style.position = 'fixed';
        mainDiv.style.top = '0';
        mainDiv.style.left = '0';
        mainDiv.style.width = '100vw';
        mainDiv.style.height = '100vh';
        mainDiv.style.background = 'linear-gradient(to bottom, #2b0f42 0%, #1a0b2e 50%, #000 100%)';
        mainDiv.style.zIndex = '-1';
        mainDiv.style.overflow = 'hidden';
        container.appendChild(mainDiv);

        // Sun
        const sun = document.createElement('div');
        Object.assign(sun.style, {
            position: 'absolute',
            bottom: '30%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '300px',
            height: '300px',
            background: 'linear-gradient(to top, #ff00cc, #ffff00)',
            borderRadius: '50%',
            boxShadow: '0 0 40px #ff00cc, 0 0 80px #ff00cc',
            // Stripes mask (Clip path is complex, using simple bars)
            webkitMaskImage: 'repeating-linear-gradient(rgba(0,0,0,1) 0px, rgba(0,0,0,1) 10px, rgba(0,0,0,0) 10px, rgba(0,0,0,0) 12px)'
        });
        // Mask fix to be only bottom to top
        sun.style.maskImage = 'repeating-linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 10px, rgba(0,0,0,0) 10px, rgba(0,0,0,0) 14px)';
        mainDiv.appendChild(sun);

        // Grid
        const grid = document.createElement('div');
        Object.assign(grid.style, {
            position: 'absolute',
            bottom: '-50%',
            left: '-50%',
            width: '200%',
            height: '100%',
            background: `
                linear-gradient(transparent 0%, #ff00cc 2%, transparent 3%),
                linear-gradient(90deg, transparent 0%, #ff00cc 2%, transparent 3%)
            `,
            backgroundSize: '100px 100px', // Smaller squares
            transform: 'perspective(500px) rotateX(60deg) translateY(0)',
            animation: 'synthGridMove 4s linear infinite',
            opacity: '0.6'
        });
        mainDiv.appendChild(grid);

        // Add dynamic CSS for keyframes
        const style = document.createElement('style');
        style.textContent = `
            @keyframes synthGridMove {
                0% { background-position: 0 0; }
                100% { background-position: 0 100px; }
            }
        `;
        container.appendChild(style);
    }

    // ==========================================
    // K. CIRCUIT DIGITAL 🔌 (Tech)
    // ==========================================
    function enableCircuit() {
        const container = createContainer('circuit');
        if (!container) return;

        const canvas = document.createElement('canvas');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.zIndex = '0';
        canvas.style.opacity = '0.3';
        // Dark background
        canvas.style.background = '#0a0a12';
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const paths = [];

        // Initialize paths
        for (let i = 0; i < 15; i++) {
            paths.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                history: [], // Trail
                dir: Math.floor(Math.random() * 4), // 0: up, 1: right, 2: down, 3: left
                speed: 3,
                color: Math.random() > 0.5 ? '#00ccff' : '#0066ff'
            });
        }

        function drawCircuit() {
            // Fade effect only for the trails, but here we want persistent circuit board look?
            // Let's do moving electrons on static paths? 
            // Better: Growing paths that fade out very slowly.

            ctx.fillStyle = 'rgba(10, 10, 18, 0.05)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            paths.forEach(p => {
                // Move
                if (p.dir === 0) p.y -= p.speed;
                if (p.dir === 1) p.x += p.speed;
                if (p.dir === 2) p.y += p.speed;
                if (p.dir === 3) p.x -= p.speed;

                // Random turn
                if (Math.random() < 0.02) {
                    p.dir = Math.floor(Math.random() * 4);
                }

                // Boundary check
                if (p.x < 0) p.x = canvas.width;
                if (p.x > canvas.width) p.x = 0;
                if (p.y < 0) p.y = canvas.height;
                if (p.y > canvas.height) p.y = 0;

                // Draw head
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x, p.y, 4, 4);

                // Draw trail (connect dots)?
                // Actually simply drawing small rects works for digital look
                ctx.shadowBlur = 5;
                ctx.shadowColor = p.color;
                ctx.fillRect(p.x, p.y, 2, 2);
                ctx.shadowBlur = 0;

                // Nodes
                if (Math.random() < 0.01) {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                    ctx.fillStyle = 'white';
                    ctx.fill();
                    ctx.stroke();
                }
            });

            if (document.body.contains(container)) requestAnimationFrame(drawCircuit);
        }
        drawCircuit();
    }

    // ==========================================
    // L. BIOTECH ADN 🧬 (Future)
    // ==========================================
    function enableBiotech() {
        const container = createContainer('biotech');
        if (!container) return;

        const canvas = document.createElement('canvas');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.zIndex = '0';
        canvas.style.background = 'radial-gradient(circle, #001 0%, #000 100%)';
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');

        let offset = 0;
        const strandCount = 2; // Double helix

        function drawDNA() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Particles in background
            ctx.fillStyle = 'rgba(0, 255, 136, 0.5)';
            for (let i = 0; i < 20; i++) {
                const px = (noise(i, offset * 0.01) * canvas.width + canvas.width) % canvas.width;
                const py = (noise(i + 100, offset * 0.01) * canvas.height + canvas.height) % canvas.height;
                ctx.beginPath();
                ctx.arc(px, py, 1, 0, Math.PI * 2);
                ctx.fill();
            }

            // Draw Helix
            // Center horizontal
            const cx = canvas.width / 2;
            const height = canvas.height;
            const points = 30; // Pairs shown

            for (let i = 0; i < points; i++) {
                const y = (i * 40 + offset) % (height + 200) - 100;
                const relY = i * 0.5 + offset * 0.05; // oscillation speed

                const width = 100; // Helix radius
                const x1 = cx + Math.sin(relY) * width;
                const x2 = cx + Math.sin(relY + Math.PI) * width;

                // Connector (Base pairs)
                ctx.strokeStyle = `rgba(0, 255, 136, ${0.1 + Math.abs(Math.cos(relY)) * 0.4})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x1, y);
                ctx.lineTo(x2, y);
                ctx.stroke();

                // Strand 1 Node
                ctx.fillStyle = '#00ff88';
                ctx.beginPath();
                ctx.arc(x1, y, 4, 0, Math.PI * 2);
                ctx.fill();

                // Strand 2 Node
                ctx.fillStyle = '#0088ff';
                ctx.beginPath();
                ctx.arc(x2, y, 4, 0, Math.PI * 2);
                ctx.fill();
            }

            offset += 1;
            if (document.body.contains(container)) requestAnimationFrame(drawDNA);
        }

        // Simple Pseudo-Noise
        function noise(x, y) {
            return Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 - Math.floor(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453);
        }

        drawDNA();
    }

})(); // End IIFE
