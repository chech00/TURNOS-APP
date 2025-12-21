import { auth } from './firebase.js';

const isProduction = window.location.hostname.includes('github.io');
const API_BASE_URL = isProduction
    ? 'https://turnos-app-8viu.onrender.com'
    : 'http://localhost:3001';

export async function initKmlImport() {

    // 1. Verificar usuario
    const currentUser = auth.currentUser || window.auth?.currentUser;

    if (!currentUser) return;

    try {
        // Usar Cache Local para Rol (Robustez)
        const role = localStorage.getItem('userRole') || 'user';

        // Verificar Rol Superadmin
        if (role !== 'superadmin' && role !== 'admin') {
            return;
        }

        // 2. Obtener elementos
        const importBtns = document.querySelectorAll('.kml-import-trigger');
        const fileInput = document.getElementById('kml-upload-input');

        let activeBtn = null; // Track which button triggered the action

        // 3. Mostrar botón global (si existe)
        const globalBtn = document.getElementById('kml-import-btn');
        if (globalBtn) globalBtn.style.display = 'inline-flex';

        // 4. Refrescar iconos Lucide
        if (window.lucide) window.lucide.createIcons();

        // 5. Event Listeners
        importBtns.forEach(btn => {
            if (btn.dataset.initialized) return;
            btn.dataset.initialized = 'true';

            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                activeBtn = e.currentTarget;

                // 1. Verificar si hay un Nodo seleccionado en el Modal de Incidente
                const modalNodeSelect = document.getElementById('new-incident-node');
                const modal = document.getElementById('modal-new-incident');
                let preSelectedNode = null;

                // Chequear si el modal está visible (clase 'active' o display block) o simplemente si el select tiene valor
                // Asumimos que si el usuario clickea el botón DENTRO del modal, quiere usar ese valor.
                if (modalNodeSelect && modalNodeSelect.value) {
                    // Verificación adicional: ¿Es el botón detro del modal?
                    // O si el modal está abierto.
                    if (btn.closest('#modal-new-incident') || (modal && window.getComputedStyle(modal).display !== 'none')) {
                        preSelectedNode = modalNodeSelect.value;
                    }
                }

                if (preSelectedNode) {
                    // Camino Rápido: Usar nodo del modal
                    fileInput.dataset.targetNode = preSelectedNode;
                    fileInput.click();
                    return;
                }

                // Camino Lento: Preguntar Nodo (Comportamiento original)
                const nodeSelectSource = document.getElementById('new-incident-node') || document.getElementById('filter-node');
                let options = {};

                if (nodeSelectSource) {
                    Array.from(nodeSelectSource.options).forEach(opt => {
                        const val = opt.value;
                        const text = opt.text;
                        if (val && val.trim() !== '' && !text.toUpperCase().includes('SILICA')) {
                            options[val] = text;
                        }
                    });
                }

                const { value: selectedNode } = await Swal.fire({
                    title: 'Seleccionar Nodo Destino',
                    text: '¿A qué Nodo pertenecen los PONs de este archivo KML?',
                    input: 'select',
                    inputOptions: options,
                    inputPlaceholder: 'Selecciona un Nodo...',
                    showCancelButton: true,
                    confirmButtonText: 'Continuar',
                    cancelButtonText: 'Cancelar',
                    confirmButtonColor: '#8b5cf6',
                    background: '#1f2937',
                    color: '#fff',
                    customClass: {
                        input: 'swal2-dark-select'
                    },
                    footer: '<small style="color:#9ca3af">Nota: Esto asignará TODOS los elementos del KML a este Nodo.</small>',
                    inputValidator: (value) => {
                        if (!value) {
                            return 'Debes seleccionar un Nodo';
                        }
                    }
                });

                if (selectedNode) {
                    fileInput.dataset.targetNode = selectedNode;
                    fileInput.click();
                }
            });
        });

        // 6. File Input Listener (Single Instance)
        if (fileInput.dataset.kmlListenerAttached) return;
        fileInput.dataset.kmlListenerAttached = 'true';

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            const targetNode = fileInput.dataset.targetNode;

            if (!file) return;

            if (!targetNode) {
                Swal.fire('Error', 'No se seleccionó un nodo destino.', 'error');
                fileInput.value = '';
                return;
            }

            // Confirmación final
            const result = await Swal.fire({
                title: '¿Confirmar Importación?',
                html: `
                    <div style="text-align:left; font-size:0.9rem;">
                        <p><strong>Archivo:</strong> ${file.name}</p>
                        <p><strong>Nodo Destino:</strong> ${targetNode}</p>
                        <hr style="margin:10px 0; border:0; border-top:1px solid #ddd;">
                        <p style="color:#ef4444;">⚠️ Esto sobrescribirá o agregará PONs a este Nodo.</p>
                    </div>
                `,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#10b981',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Sí, Importar'
            });

            if (!result.isConfirmed) {
                fileInput.value = '';
                return;
            }

            // UI Feedback
            const targetBtn = activeBtn || globalBtn;
            let originalHtml = "";

            if (targetBtn) {
                originalHtml = targetBtn.innerHTML;
                targetBtn.innerHTML = `<span>⏳ Subiendo...</span>`;
                targetBtn.disabled = true;
            }

            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('targetNode', targetNode);

                const tokenStr = (await currentUser.getIdToken());

                const response = await fetch(`${API_BASE_URL}/upload-kml`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${tokenStr}`
                    },
                    body: formData
                });

                const data = await response.json();

                if (!response.ok) throw new Error(data.error || 'Error en subida');

                await Swal.fire({
                    title: '¡Importación Exitosa!',
                    html: `
                        <p>Se actualizaron <strong>${data.stats.pons}</strong> PONs en el nodo <strong>${targetNode}</strong>.</p>
                    `,
                    icon: 'success'
                });

                window.location.reload();

            } catch (err) {
                console.error(err);
                Swal.fire('Error', err.message, 'error');
                if (targetBtn) {
                    targetBtn.innerHTML = originalHtml;
                    targetBtn.disabled = false;
                }
                if (window.lucide) window.lucide.createIcons();
            } finally {
                fileInput.value = '';
                delete fileInput.dataset.targetNode;
                activeBtn = null; // Reset
            }
        });

    } catch (e) {
        console.error("Error inicializando KML import:", e);
    }
}
