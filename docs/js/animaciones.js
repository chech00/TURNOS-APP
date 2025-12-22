/**
 * Animaciones Manager - Controls all animation settings
 * Supports 12 different animation types with mutual exclusivity
 */
document.addEventListener('DOMContentLoaded', () => {
    const checkFirebase = setInterval(() => {
        if (window.firebase && firebase.firestore) {
            clearInterval(checkFirebase);
            initAnimsManager();
        }
    }, 100);

    // All animation types
    const ANIMATION_KEYS = [
        'christmas_total', 'christmas_snow', 'newyear_fireworks', 'newyear_gold', 'cyberpunk', 'warp_speed',
        'radar', 'synthwave', 'circuit', 'biotech',
        'halloween', 'valentine',
        'easter', 'independence', 'rain', 'autumn', 'bubbles', 'aurora',
        'matrix', 'particles', 'christmas_lights', 'golden_border'
    ];

    const ANIMATION_NAMES = {
        christmas_total: 'Modo Navidad Total',
        christmas_snow: 'Nieve navideña',
        newyear_fireworks: 'Fuegos artificiales',
        newyear_gold: 'Año Nuevo 2026 Gold',
        cyberpunk: 'Modo Cyberpunk',
        warp_speed: 'Velocidad Luz',
        radar: 'Radar NOC',
        synthwave: 'Retro 80s',
        circuit: 'Circuito Digital',
        biotech: 'Biotech ADN',
        halloween: 'Halloween',
        valentine: 'San Valentín',
        easter: 'Pascua',
        independence: 'Fiestas Patrias',
        rain: 'Lluvia',
        autumn: 'Hojas de otoño',
        bubbles: 'Burbujas',
        aurora: 'Aurora boreal',
        matrix: 'Matrix',
        particles: 'Partículas conectadas',
        christmas_lights: 'Lucecitas navideñas',
        golden_border: 'Borde dorado'
    };

    function initAnimsManager() {
        const db = firebase.firestore();
        const auth = firebase.auth();
        const docRef = db.collection('config').doc('animations');

        // Auth check and role verification
        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                window.location.href = "login.html";
                return;
            }

            // Init Slider Logic
            const opacitySlider = document.getElementById('sidebar-opacity');
            const opacityValue = document.getElementById('opacity-value');

            if (opacitySlider) {
                // Load saved value
                const saved = localStorage.getItem('sidebarOpacity');
                if (saved) {
                    opacitySlider.value = saved;
                    if (opacityValue) opacityValue.textContent = saved;
                    document.documentElement.style.setProperty('--sidebar-opacity', saved);
                }

                // Listen for changes
                opacitySlider.addEventListener('input', (e) => {
                    const val = e.target.value;
                    document.documentElement.style.setProperty('--sidebar-opacity', val);
                    if (opacityValue) opacityValue.textContent = val;
                    localStorage.setItem('sidebarOpacity', val);
                });
            }

            try {
                const userDoc = await db.collection("userRoles").doc(user.uid).get();
                if (userDoc.exists) {
                    const userRole = userDoc.data().rol;
                    if (userRole === "admin" || userRole === "superadmin") {
                        document.body.classList.add("is-admin");
                    }
                    if (userRole === "superadmin") {
                        document.querySelectorAll(".superadmin-only").forEach(el => {
                            el.style.display = "block";
                        });
                    }
                }
            } catch (error) {
                console.error("Error verificando rol:", error);
            }
        });

        // Load initial state for all toggles
        docRef.get().then((doc) => {
            const data = doc.exists ? doc.data() : {};

            ANIMATION_KEYS.forEach(key => {
                const toggle = document.getElementById(`toggle-${key}`);
                if (toggle) {
                    toggle.checked = data[key] || false;
                    updateCardState(key, data[key] || false);
                }
            });
        }).catch((error) => {
            console.error("Error loading animations config:", error);
        });

        // Set up event listeners for all toggles
        ANIMATION_KEYS.forEach(key => {
            const toggle = document.getElementById(`toggle-${key}`);
            if (toggle) {
                toggle.addEventListener('change', (e) => {
                    const isEnabled = e.target.checked;

                    // Build update object - DISABLE ALL OTHER ANIMATIONS when enabling one
                    const updateObj = {};

                    if (isEnabled) {
                        // Disable all animations first
                        ANIMATION_KEYS.forEach(k => {
                            updateObj[k] = false;
                        });
                        // Enable only the selected one
                        updateObj[key] = true;
                    } else {
                        // Just disable this one
                        updateObj[key] = false;
                    }

                    docRef.set(updateObj, { merge: true })
                        .then(() => {
                            // Update all card states and toggles
                            ANIMATION_KEYS.forEach(k => {
                                const otherToggle = document.getElementById(`toggle-${k}`);
                                if (otherToggle) {
                                    otherToggle.checked = updateObj[k];
                                }
                                updateCardState(k, updateObj[k]);
                            });

                            Swal.fire({
                                icon: 'success',
                                title: isEnabled ? '¡Activado!' : 'Desactivado',
                                text: `${ANIMATION_NAMES[key]} ${isEnabled ? 'activado' : 'desactivado'}`,
                                timer: 1200,
                                showConfirmButton: false,
                                background: 'var(--color-fondo-secundario)',
                                color: 'var(--color-texto-principal)'
                            });
                        })
                        .catch((error) => {
                            console.error("Error updating config:", error);
                            Swal.fire('Error', 'No se pudo actualizar', 'error');
                            e.target.checked = !isEnabled;
                        });
                });
            }
        });
    }

    /* =========================================
       UI SETTINGS HANDLERS (Performance & Sidebar)
       ========================================= */
    const performanceToggle = document.getElementById('toggle-performance');
    const sidebarRightToggle = document.getElementById('toggle-sidebar-right');

    // Load Saved UI Settings
    if (localStorage.getItem('performanceMode') === 'true') {
        document.body.classList.add('performance-mode');
        if (performanceToggle) performanceToggle.checked = true;
    }

    if (localStorage.getItem('sidebarRight') === 'true') {
        document.body.classList.add('sidebar-right');
        if (sidebarRightToggle) sidebarRightToggle.checked = true;
    }

    // Performance Toggle Event
    if (performanceToggle) {
        performanceToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.body.classList.add('performance-mode');
                localStorage.setItem('performanceMode', 'true');
                Swal.fire({
                    icon: 'success',
                    title: 'Modo Rendimiento Activado 🚀',
                    text: 'Se han desactivado efectos visuales pesados.',
                    timer: 1500,
                    showConfirmButton: false,
                    background: 'var(--color-fondo-secundario)',
                    color: 'var(--color-texto-principal)'
                });
            } else {
                document.body.classList.remove('performance-mode');
                localStorage.setItem('performanceMode', 'false');
            }
        });
    }

    // Sidebar Right Toggle Event
    if (sidebarRightToggle) {
        sidebarRightToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.body.classList.add('sidebar-right');
                localStorage.setItem('sidebarRight', 'true');
            } else {
                document.body.classList.remove('sidebar-right');
                localStorage.setItem('sidebarRight', 'false');
            }
        });
    }

    function updateCardState(key, isActive) {
        const card = document.querySelector(`[data-animation="${key}"]`);
        if (card) {
            if (isActive) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        }
    }
});
