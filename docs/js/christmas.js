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
        particles: 'particles-container'
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

        docRef.get().then((doc) => {
            const data = doc.data() || {};
            applyAnimations(data);
            saveToLocalStorage(data);

            docRef.onSnapshot((doc) => {
                const data = doc.data() || {};
                applyAnimations(data);
                saveToLocalStorage(data);
            }, () => { });
        }).catch((error) => {
            console.log("🎨 Animations: Firestore access denied, using localStorage");
            // For pages without auth, poll localStorage for changes
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
    function enableSnow() {
        const container = createContainer('snow');
        if (!container) return;

        const symbols = ['❄', '❅', '❆', '•'];
        for (let i = 0; i < 50; i++) {
            const flake = document.createElement('div');
            flake.className = 'snowflake';
            flake.innerText = symbols[Math.floor(Math.random() * symbols.length)];
            flake.style.left = `${Math.random() * 100}vw`;
            flake.style.animationDuration = `${Math.random() * 5 + 5}s`;
            flake.style.animationDelay = `${Math.random() * 5}s`;
            flake.style.fontSize = `${Math.random() * 1 + 0.5}rem`;
            flake.style.opacity = Math.random() * 0.3 + 0.1;
            container.appendChild(flake);
        }
    }

    // ==========================================
    // 2. FIREWORKS 🎆
    // ==========================================
    function enableFireworks() {
        const container = createContainer('fireworks');
        if (!container) return;

        function createFirework() {
            const firework = document.createElement('div');
            firework.className = 'firework';
            firework.style.left = `${Math.random() * 80 + 10}%`;
            firework.style.bottom = `${Math.random() * 40 + 10}%`;

            const colors = ['#ff0040', '#ff4000', '#ffbf00', '#00ff40', '#00bfff', '#8000ff', '#ff00bf', '#ffd700'];
            const color = colors[Math.floor(Math.random() * colors.length)];

            for (let i = 0; i < 12; i++) {
                const particle = document.createElement('div');
                particle.className = 'firework-particle';
                particle.style.setProperty('--angle', `${(360 / 12) * i}deg`);
                particle.style.setProperty('--distance', `${50 + Math.random() * 50}px`);
                particle.style.backgroundColor = color;
                particle.style.boxShadow = `0 0 6px ${color}`;
                firework.appendChild(particle);
            }

            container.appendChild(firework);
            setTimeout(() => firework.remove(), 2000);
        }

        createFirework();
        container.dataset.interval = setInterval(createFirework, 800);
    }

    // ==========================================
    // 3. HALLOWEEN 🎃
    // ==========================================
    function enableHalloween() {
        const container = createContainer('halloween');
        if (!container) return;

        // Bats
        for (let i = 0; i < 8; i++) {
            const bat = document.createElement('div');
            bat.className = 'halloween-bat';
            bat.innerHTML = '🦇';
            bat.style.left = `${Math.random() * 100}vw`;
            bat.style.top = `${Math.random() * 50}vh`;
            bat.style.animationDuration = `${Math.random() * 10 + 10}s`;
            bat.style.animationDelay = `${Math.random() * 5}s`;
            container.appendChild(bat);
        }

        // Pumpkins
        for (let i = 0; i < 5; i++) {
            const pumpkin = document.createElement('div');
            pumpkin.className = 'halloween-pumpkin';
            pumpkin.innerHTML = '🎃';
            pumpkin.style.left = `${Math.random() * 90 + 5}%`;
            pumpkin.style.bottom = `${Math.random() * 20}%`;
            pumpkin.style.animationDelay = `${Math.random() * 3}s`;
            container.appendChild(pumpkin);
        }
    }

    // ==========================================
    // 4. VALENTINE 💕
    // ==========================================
    function enableValentine() {
        const container = createContainer('valentine');
        if (!container) return;

        const hearts = ['❤️', '💕', '💖', '💗', '💓', '💝'];
        for (let i = 0; i < 25; i++) {
            const heart = document.createElement('div');
            heart.className = 'valentine-heart';
            heart.innerHTML = hearts[Math.floor(Math.random() * hearts.length)];
            heart.style.left = `${Math.random() * 100}vw`;
            heart.style.animationDuration = `${Math.random() * 8 + 6}s`;
            heart.style.animationDelay = `${Math.random() * 5}s`;
            heart.style.fontSize = `${Math.random() * 1.5 + 0.8}rem`;
            container.appendChild(heart);
        }
    }

    // ==========================================
    // 5. EASTER 🐰
    // ==========================================
    function enableEaster() {
        const container = createContainer('easter');
        if (!container) return;

        const eggs = ['🥚', '🐣', '🐰', '🌸', '🌷'];
        for (let i = 0; i < 20; i++) {
            const egg = document.createElement('div');
            egg.className = 'easter-egg';
            egg.innerHTML = eggs[Math.floor(Math.random() * eggs.length)];
            egg.style.left = `${Math.random() * 100}vw`;
            egg.style.animationDuration = `${Math.random() * 6 + 4}s`;
            egg.style.animationDelay = `${Math.random() * 5}s`;
            egg.style.fontSize = `${Math.random() * 1.2 + 0.8}rem`;
            container.appendChild(egg);
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
    // 7. RAIN 🌧️
    // ==========================================
    function enableRain() {
        const container = createContainer('rain');
        if (!container) return;

        for (let i = 0; i < 100; i++) {
            const drop = document.createElement('div');
            drop.className = 'rain-drop';
            drop.style.left = `${Math.random() * 100}vw`;
            drop.style.animationDuration = `${Math.random() * 0.5 + 0.5}s`;
            drop.style.animationDelay = `${Math.random() * 2}s`;
            drop.style.opacity = Math.random() * 0.3 + 0.2;
            container.appendChild(drop);
        }
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
    // 9. BUBBLES 🫧
    // ==========================================
    function enableBubbles() {
        const container = createContainer('bubbles');
        if (!container) return;

        for (let i = 0; i < 20; i++) {
            const bubble = document.createElement('div');
            bubble.className = 'bubble';
            const size = Math.random() * 30 + 10;
            bubble.style.width = `${size}px`;
            bubble.style.height = `${size}px`;
            bubble.style.left = `${Math.random() * 100}vw`;
            bubble.style.animationDuration = `${Math.random() * 6 + 4}s`;
            bubble.style.animationDelay = `${Math.random() * 5}s`;
            container.appendChild(bubble);
        }
    }

    // ==========================================
    // 10. AURORA BOREALIS 🌌
    // ==========================================
    function enableAurora() {
        const container = createContainer('aurora');
        if (!container) return;
        container.className = 'aurora-container';

        for (let i = 0; i < 5; i++) {
            const wave = document.createElement('div');
            wave.className = 'aurora-wave';
            wave.style.animationDelay = `${i * 2}s`;
            wave.style.opacity = 0.3 - (i * 0.05);
            container.appendChild(wave);
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
    // 12. CONNECTED PARTICLES 🔗
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
        const particleCount = 50;

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
                this.vx = (Math.random() - 0.5) * 0.5;
                this.vy = (Math.random() - 0.5) * 0.5;
                this.radius = 2;
            }
            update() {
                this.x += this.vx;
                this.y += this.vy;
                if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
                if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
            }
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(119, 150, 203, 0.8)';
                ctx.fill();
            }
        }

        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }

        function animate() {
            if (!document.getElementById(ANIMATION_IDS.particles)) return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            particles.forEach(p => {
                p.update();
                p.draw();
            });

            // Draw connections
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 120) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(119, 150, 203, ${0.3 * (1 - dist / 120)})`;
                        ctx.stroke();
                    }
                }
            }

            container.dataset.animFrame = requestAnimationFrame(animate);
        }
        animate();
    }

})();
