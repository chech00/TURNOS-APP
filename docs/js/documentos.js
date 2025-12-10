const auth = window.auth;
const db = window.db;

document.addEventListener("DOMContentLoaded", () => {
    console.log("documentos.js cargado (Full Width Layout) - v5.2");

    // --- Funcionalidad del Sidebar ---
    const sidebar = document.getElementById("sidebar");
    const mainContent = document.getElementById("main-content");
    const menuToggle = document.getElementById("menu-toggle");

    if (menuToggle) {
        menuToggle.addEventListener("click", () => {
            sidebar.classList.toggle("expanded");
            mainContent.classList.toggle("expanded");
        });
    }

    // Cerrar sesión
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            firebase.auth().signOut().then(() => {
                localStorage.removeItem('userRole');
                window.location.href = "login.html";
            }).catch(error => {
                console.error("Error al cerrar sesión:", error);
            });
        });
    }

    // Inicializar iconos si Lucide está disponible
    if (window.lucide) {
        lucide.createIcons();
    }

    // URL base de la API
    // URL base de la API
    const API_BASE_URL = "https://turnos-app-8viu.onrender.com";
    let currentUserRole = "";

    // Optimización: Carga optimista desde caché
    const cachedRole = localStorage.getItem("userRole");
    if (cachedRole) {
        console.log("Aplicando rol desde caché (Documentos):", cachedRole);
        currentUserRole = cachedRole;
        if (currentUserRole === "admin" || currentUserRole === "superadmin") {
            document.body.classList.add("is-admin");
        }
        // Llamamos a configureView inmediatamente con el rol caché
        // Nota: configureView usa 'currentUserRole' global
        // Necesitamos asegurarnos de que configureView esté definida antes de llamarla?
        // Está definida más abajo (hoisting funciona para function declarations).
        configureView();
    }

    // Verificar autenticación y rol del usuario
    firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = "login.html";
            return;
        }
        try {
            const userDoc = await firebase.firestore().collection("userRoles").doc(user.uid).get();
            if (userDoc.exists) {
                const newRole = userDoc.data().rol;

                // Actualizar caché si cambió
                if (newRole !== currentUserRole) {
                    console.log("Rol actualizado desde Firestore:", newRole);
                    currentUserRole = newRole;
                    localStorage.setItem("userRole", newRole);

                    if (currentUserRole === "admin" || currentUserRole === "superadmin") {
                        document.body.classList.add("is-admin");
                    } else {
                        document.body.classList.remove("is-admin");
                    }
                    configureView();
                }
            } else {
                // Si no tiene rol, limpiar caché
                localStorage.removeItem("userRole");
            }
        } catch (error) {
            console.error("Error al verificar el rol del usuario:", error);
        }
    });

    // --- Funcionalidad del Modal de Subida ---
    const openUploadModalBtn = document.getElementById("open-upload-modal-btn");
    const uploadModal = document.getElementById("upload-modal");
    const closeUploadModalBtn = document.getElementById("close-upload-modal");

    if (openUploadModalBtn) {
        openUploadModalBtn.addEventListener("click", () => {
            uploadModal.style.display = "flex";
        });
    }

    if (closeUploadModalBtn) {
        closeUploadModalBtn.addEventListener("click", () => {
            uploadModal.style.display = "none";
        });
    }

    // Cerrar modal al hacer clic fuera
    window.addEventListener("click", (event) => {
        if (event.target === uploadModal) {
            uploadModal.style.display = "none";
        }
        const previewModal = document.getElementById("preview-modal");
        if (event.target === previewModal) {
            previewModal.style.display = "none";
        }
    });

    // --- Configurar vista según el rol ---
    function configureView() {
        const container = document.querySelector(".documentos-container");
        const liRegistros = document.getElementById("li-registros");
        const openUploadModalBtn = document.getElementById("open-upload-modal-btn");

        // Mostrar botón de subida solo a admins
        if (currentUserRole === "admin" || currentUserRole === "superadmin") {
            if (openUploadModalBtn) openUploadModalBtn.style.display = "flex";
        } else {
            if (openUploadModalBtn) openUploadModalBtn.style.display = "none";
        }

        if (currentUserRole === "superadmin") {
            if (liRegistros) liRegistros.style.display = "block";
            const liUsuarios = document.getElementById("li-usuarios");
            if (liUsuarios) liUsuarios.style.display = "block";
            const liAnimaciones = document.getElementById("li-animaciones");
            if (liAnimaciones) liAnimaciones.style.display = "block";
        }

        // Remover la clase oculta y cargar archivos
        if (container) container.classList.remove("hidden");
        loadFiles();
    }

    // --- Eventos para la subida de archivos ---
    const uploadDropzone = document.getElementById("upload-dropzone");
    const fileInput = document.getElementById("file-input");
    const uploadBtn = document.getElementById("upload-btn");

    if (uploadDropzone) {
        uploadDropzone.addEventListener("click", () => {
            fileInput.click();
        });
    }

    if (uploadBtn) {
        uploadBtn.addEventListener("click", uploadFile);
    }

    async function uploadFile() {
        if (currentUserRole !== "admin" && currentUserRole !== "superadmin") {
            Swal.fire({
                icon: "error",
                title: "Acceso Denegado",
                text: "No tienes permisos para subir archivos.",
                confirmButtonColor: "#e74c3c"
            });
            return;
        }

        if (!fileInput.files.length) {
            Swal.fire({
                icon: "warning",
                title: "Selecciona un Archivo",
                text: "Por favor, selecciona un archivo.",
                confirmButtonColor: "#f39c12"
            });
            return;
        }

        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append("file", file);

        try {
            Swal.fire({
                title: "Subiendo Archivo...",
                text: "Por favor espera...",
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });
            const token = await firebase.auth().currentUser.getIdToken();
            const response = await fetch(`${API_BASE_URL}/upload`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                body: formData
            });
            const data = await response.json();
            if (!data.success) throw new Error(data.error || "Error al subir archivo.");

            Swal.fire({
                icon: "success",
                title: "Archivo Subido",
                text: "El archivo se ha subido correctamente.",
                confirmButtonColor: "#2ecc71"
            });

            fileInput.value = "";
            loadFiles();
            // Cerrar modal si está abierto
            if (uploadModal) uploadModal.style.display = "none";
        } catch (error) {
            console.error("Error al subir archivo:", error);
            Swal.fire({
                icon: "error",
                title: "Error",
                text: "Hubo un problema al subir el archivo.",
                confirmButtonColor: "#e74c3c"
            });
        }
    }

    // --- Cargar y mostrar archivos ---
    async function loadFiles() {
        console.log("Iniciando loadFiles...");
        const filesGrid = document.getElementById("files-grid");
        if (!filesGrid) {
            console.error("No se encontró el elemento #files-grid");
            return;
        }

        // Mostrar skeleton loading
        filesGrid.innerHTML = Array(4)
            .fill('<div class="file-card skeleton"></div>')
            .join('');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 segundos (Render Cold Start Safe)

        try {
            console.log("Realizando fetch a:", `${API_BASE_URL}/files`);
            const token = await firebase.auth().currentUser?.getIdToken();
            const headers = token ? { "Authorization": `Bearer ${token}` } : {};

            const response = await fetch(`${API_BASE_URL}/files?t=${Date.now()}`, {
                headers: headers,
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();

            let files = [];
            if (Array.isArray(data)) {
                files = data;
            } else if (data.files && Array.isArray(data.files)) {
                files = data.files;
            }

            filesGrid.innerHTML = ""; // Limpiar skeleton

            if (!files || files.length === 0) {
                filesGrid.innerHTML = `
                    <div class="empty-state">
                        <i data-lucide="folder-open"></i>
                        <h3>No hay documentos</h3>
                        <p>No se encontraron archivos en el sistema.</p>
                    </div>
                `;
                if (window.lucide) lucide.createIcons();
                return;
            }

            files.forEach(file => {
                const fileCard = document.createElement("div");
                fileCard.classList.add("file-card");

                // Miniatura
                const thumbnail = document.createElement("div");
                thumbnail.classList.add("file-thumbnail");

                if (/\.(png|jpg|jpeg|gif)$/i.test(file.url)) {
                    thumbnail.innerHTML = `<img src="${file.url}" alt="${file.name}" onerror="this.onerror=null; this.parentElement.innerHTML='<i data-lucide=\\'image-off\\'></i>'; lucide.createIcons();">`;
                } else if (/\.pdf$/i.test(file.url)) {
                    // Thumbnail de PDF usando iframe optimizado
                    thumbnail.innerHTML = `
                        <iframe 
                            src="${file.url}#view=FitH&toolbar=0&navpanes=0&scrollbar=0" 
                            loading="lazy" 
                            style="width: 100%; height: 100%; border: none; pointer-events: none; overflow: hidden;"
                            scrolling="no"
                        ></iframe>
                    `;
                } else if (/\.(doc|docx)$/i.test(file.url)) {
                    thumbnail.innerHTML = `<i data-lucide="file-type-2" style="color: #3b82f6;"></i>`;
                } else if (/\.(xls|xlsx)$/i.test(file.url)) {
                    thumbnail.innerHTML = `<i data-lucide="sheet" style="color: #10b981;"></i>`;
                } else {
                    thumbnail.innerHTML = `<i data-lucide="file"></i>`;
                }

                // Info
                const info = document.createElement("div");
                info.classList.add("file-details");

                const fileName = document.createElement("div");
                fileName.classList.add("file-name");
                fileName.textContent = file.name;
                fileName.title = file.name;

                const actions = document.createElement("div");
                actions.classList.add("file-actions");

                const viewBtn = document.createElement("button");
                viewBtn.innerHTML = `<i data-lucide="eye"></i>`;
                viewBtn.classList.add("action-btn", "view-btn");
                viewBtn.title = "Ver";
                viewBtn.addEventListener("click", () => previewFile(file.url));
                actions.appendChild(viewBtn);

                const downloadLink = document.createElement("a");
                downloadLink.innerHTML = `<i data-lucide="download"></i>`;
                downloadLink.href = file.url;
                downloadLink.download = file.name;
                downloadLink.classList.add("action-btn", "download-btn");
                downloadLink.title = "Descargar";
                actions.appendChild(downloadLink);

                if (currentUserRole === "admin" || currentUserRole === "superadmin") {
                    const deleteBtn = document.createElement("button");
                    deleteBtn.innerHTML = `<i data-lucide="trash-2"></i>`;
                    deleteBtn.classList.add("action-btn", "delete-btn");
                    deleteBtn.title = "Eliminar";
                    deleteBtn.addEventListener("click", () => deleteFile(file.name));
                    actions.appendChild(deleteBtn);
                }

                info.appendChild(fileName);
                info.appendChild(actions);

                fileCard.appendChild(thumbnail);
                fileCard.appendChild(info);
                filesGrid.appendChild(fileCard);
            });

            if (window.lucide) lucide.createIcons();

        } catch (error) {
            console.error("Error al cargar archivos:", error);

            let errorMsg = "Hubo un problema al conectar con el servidor.";
            let errorTitle = "Error al cargar archivos";

            // Handle Timeout specifically
            if (error.name === 'AbortError') {
                errorTitle = "Servidor Iniciando...";
                errorMsg = "El servidor está despertando (Cold Start). Por favor, espera unos segundos y reintenta.";
            } else if (error.message === 'Failed to fetch') {
                errorTitle = "Error de Conexión / CORS";
                errorMsg = "No se pudo conectar con el servidor.<br><br>" +
                    "<b>Si estás en Localhost:</b> Es probable que el servidor (Render) esté bloqueando la conexión por seguridad (CORS).<br>" +
                    "<b>Si estás en Producción:</b> Verifica tu conexión a internet o el estado del servidor.";
            } else if (error.message) {
                errorMsg = error.message;
            }

            filesGrid.innerHTML = `
                <div class="empty-state" style="color: var(--color-error);">
                    <i data-lucide="server-off"></i>
                    <h3>${errorTitle}</h3>
                    <p>${errorMsg}</p>
                    <button onclick="location.reload()" class="primary-btn" style="margin-top: 1rem;">Reintentar</button>
                    <small style="display:block; margin-top:10px; opacity:0.7;">(Render Free Tier puede tardar hasta 60s en despertar)</small>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
        }
    }

    // --- Eliminar archivo ---
    window.deleteFile = async function (fileName) {
        if (currentUserRole !== "admin" && currentUserRole !== "superadmin") {
            Swal.fire({ icon: "error", title: "Acceso Denegado", text: "No tienes permisos." });
            return;
        }

        const result = await Swal.fire({
            title: '¿Estás seguro?',
            text: "No podrás revertir esto",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (!result.isConfirmed) return;

        try {
            const token = await firebase.auth().currentUser.getIdToken();
            const response = await fetch(`${API_BASE_URL}/delete/${fileName}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (!data.success) throw new Error(data.error || "Error al eliminar.");

            Swal.fire('Eliminado!', 'El archivo ha sido eliminado.', 'success');
            loadFiles();
        } catch (error) {
            console.error("Error al eliminar:", error);
            Swal.fire('Error', 'No se pudo eliminar el archivo.', 'error');
        }
    };

    // --- Vista Previa ---
    window.previewFile = (url) => {
        const modal = document.getElementById("preview-modal");
        const content = document.getElementById("modal-preview-content");

        // Limpiar y agregar botón de cierre
        content.innerHTML = '<span class="close-button" id="modal-close-preview">&times;</span>';

        const closeBtn = document.getElementById("modal-close-preview");
        closeBtn.onclick = () => { modal.style.display = "none"; };
        closeBtn.style.cssText = "position: absolute; top: -40px; right: 0; color: #fff; font-size: 2rem; cursor: pointer; z-index: 2002;";

        if (/\.(png|jpg|jpeg|gif)$/i.test(url)) {
            const img = document.createElement("img");
            img.src = url;
            content.appendChild(img);
        } else if (/\.pdf$/i.test(url)) {
            const iframe = document.createElement("iframe");
            iframe.src = url;
            iframe.style.width = "100%";
            iframe.style.height = "100%";
            iframe.style.border = "none";
            content.appendChild(iframe);
        } else {
            // Fallback para otros archivos (intentar Google Docs Viewer)
            const iframe = document.createElement("iframe");
            iframe.src = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
            iframe.style.width = "100%";
            iframe.style.height = "100%";
            iframe.style.border = "none";
            content.appendChild(iframe);
        }

        modal.style.display = "flex";
    };
});
