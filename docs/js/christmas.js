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
        golden_border: 'golden-border-container'
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
        data.golden_border ? enableGoldenBorder() : disableAnimation('golden_border');
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

})();
