/**
 * Animaciones Manager - Controls global animation settings
 */
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Firebase to be ready
    const checkFirebase = setInterval(() => {
        if (window.firebase && firebase.firestore) {
            clearInterval(checkFirebase);
            initAnimsManager();
        }
    }, 100);

    function initAnimsManager() {
        const db = firebase.firestore();
        const auth = firebase.auth();
        const toggleSnow = document.getElementById('toggle-snow');
        const toggleFireworks = document.getElementById('toggle-fireworks');

        if (!toggleSnow && !toggleFireworks) return;

        // Verificar rol del usuario y mostrar elementos del sidebar
        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                window.location.href = "login.html";
                return;
            }

            try {
                const userDoc = await db.collection("userRoles").doc(user.uid).get();
                if (userDoc.exists) {
                    const userRole = userDoc.data().rol;

                    // Mostrar elementos para admin y superadmin
                    if (userRole === "admin" || userRole === "superadmin") {
                        // Agregar clase is-admin al body (necesario para CSS que usa !important)
                        document.body.classList.add("is-admin");
                    }

                    // Mostrar elementos solo para superadmin
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

        const docRef = db.collection('config').doc('animations');

        // Load initial state for both toggles
        docRef.get().then((doc) => {
            if (doc.exists) {
                const data = doc.data();
                if (toggleSnow) toggleSnow.checked = data.christmas_snow || false;
                if (toggleFireworks) toggleFireworks.checked = data.newyear_fireworks || false;
            } else {
                // Create default config
                docRef.set({ christmas_snow: false, newyear_fireworks: false });
                if (toggleSnow) toggleSnow.checked = false;
                if (toggleFireworks) toggleFireworks.checked = false;
            }
        }).catch((error) => {
            console.error("Error loading animations config:", error);
        });

        // Handle snow toggle changes
        if (toggleSnow) {
            toggleSnow.addEventListener('change', (e) => {
                const isEnabled = e.target.checked;
                docRef.set({ christmas_snow: isEnabled }, { merge: true })
                    .then(() => {
                        Swal.fire({
                            icon: 'success',
                            title: 'Configuración Actualizada',
                            text: `Animación de nieve ${isEnabled ? 'activada' : 'desactivada'}`,
                            timer: 1500,
                            showConfirmButton: false
                        });
                    })
                    .catch((error) => {
                        console.error("Error updating config:", error);
                        Swal.fire('Error', 'No se pudo actualizar la configuración', 'error');
                        e.target.checked = !isEnabled; // Revert
                    });
            });
        }

        // Handle fireworks toggle changes
        if (toggleFireworks) {
            toggleFireworks.addEventListener('change', (e) => {
                const isEnabled = e.target.checked;
                docRef.set({ newyear_fireworks: isEnabled }, { merge: true })
                    .then(() => {
                        Swal.fire({
                            icon: 'success',
                            title: 'Configuración Actualizada',
                            text: `Fuegos artificiales ${isEnabled ? 'activados' : 'desactivados'}`,
                            timer: 1500,
                            showConfirmButton: false
                        });
                    })
                    .catch((error) => {
                        console.error("Error updating config:", error);
                        Swal.fire('Error', 'No se pudo actualizar la configuración', 'error');
                        e.target.checked = !isEnabled; // Revert
                    });
            });
        }
    }
});
