const auth = window.auth;
const db = window.db;

document.addEventListener("DOMContentLoaded", () => {
  console.log("documentos_espectacular.js cargado.");

  // --- Funcionalidad del Sidebar ---
  const sidebar = document.getElementById("sidebar");
  const mainContent = document.getElementById("main-content");
  document.getElementById("menu-toggle").addEventListener("click", () => {
    sidebar.classList.toggle("active");
    mainContent.classList.toggle("shift");
  });

  // Cerrar sesión
  document.getElementById("logout-btn").addEventListener("click", () => {
    firebase.auth().signOut().then(() => {
      window.location.href = "login.html";
    }).catch(error => {
      console.error("Error al cerrar sesión:", error);
    });
  });

  lucide.createIcons();

  // URL base de la API (ajusta según tu entorno)
  const API_BASE_URL = "https://turnos-app-8viu.onrender.com";
  let currentUserRole = "";

  // Verificar autenticación y rol del usuario
  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    try {
      const userDoc = await firebase.firestore().collection("userRoles").doc(user.uid).get();
      if (userDoc.exists) {
        currentUserRole = userDoc.data().rol;
      }
      configureView();
    } catch (error) {
      console.error("Error al verificar el rol del usuario:", error);
    }
  });

  // Configurar vista según el rol
  function configureView() {
    const uploadSection = document.getElementById("upload-section");
    const container = document.querySelector(".documentos-container");
    if (currentUserRole === "admin" || currentUserRole === "superadmin") {
      uploadSection.style.display = "block";
      container.style.gridTemplateColumns = "320px 1fr";
    } else {
      uploadSection.style.display = "none";
      container.style.gridTemplateColumns = "1fr";
    }
    
    // Remover la clase oculta y cargar archivos
    container.classList.remove("hidden");
    loadFiles();
  }

  // --- Eventos para la subida de archivos ---
  const uploadDropzone = document.getElementById("upload-dropzone");
  const fileInput = document.getElementById("file-input");
  const uploadBtn = document.getElementById("upload-btn");

  uploadDropzone.addEventListener("click", () => {
    fileInput.click();
  });

  uploadBtn.addEventListener("click", uploadFile);

  async function uploadFile() {
    if (currentUserRole !== "admin") {
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
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: "POST",
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
    const filesGrid = document.getElementById("files-grid");
    
    // Mostrar skeleton loading (4 tarjetas)
    filesGrid.innerHTML = Array(4)
      .fill('<div class="file-card skeleton"></div>')
      .join('');

    try {
      const response = await fetch(`${API_BASE_URL}/files`);
      const files = await response.json();
      filesGrid.innerHTML = ""; // Limpiar skeleton

      files.forEach(file => {
        // Crear tarjeta para cada archivo
        const fileCard = document.createElement("div");
        fileCard.classList.add("file-card");

        // Miniatura
        const thumbnail = document.createElement("div");
        thumbnail.classList.add("file-thumbnail");
        if (/\.(png|jpg|jpeg|gif)$/i.test(file.url)) {
          thumbnail.innerHTML = `<img src="${file.url}" alt="Vista previa">`;
        } else if (/\.pdf$/i.test(file.url)) {
          thumbnail.innerHTML = `<iframe src="${file.url}"></iframe>`;
        } else {
          thumbnail.innerHTML = `<i data-lucide="file"></i>`;
          lucide.createIcons();
        }

        // Contenedor de detalles (nombre y acciones)
        const details = document.createElement("div");
        details.classList.add("file-details");

        const fileName = document.createElement("div");
        fileName.classList.add("file-name");
        fileName.textContent = file.name;

        const actions = document.createElement("div");
        actions.classList.add("file-actions");

        const viewBtn = document.createElement("button");
        viewBtn.textContent = "Ver";
        viewBtn.classList.add("view-btn");
        viewBtn.addEventListener("click", () => previewFile(file.url));
        actions.appendChild(viewBtn);

        const downloadLink = document.createElement("a");
        downloadLink.textContent = "Descargar";
        downloadLink.href = file.url;
        downloadLink.download = file.name;
        downloadLink.classList.add("download-btn");
        actions.appendChild(downloadLink);

        if (currentUserRole === "admin") {
          const deleteBtn = document.createElement("button");
          deleteBtn.textContent = "Eliminar";
          deleteBtn.classList.add("delete-btn");
          deleteBtn.addEventListener("click", () => deleteFile(file.name));
          actions.appendChild(deleteBtn);
        }

        details.appendChild(fileName);
        details.appendChild(actions);
        fileCard.appendChild(thumbnail);
        fileCard.appendChild(details);
        filesGrid.appendChild(fileCard);
      });
    } catch (error) {
      console.error("Error al cargar archivos:", error);
      filesGrid.innerHTML = "<p>Error al cargar archivos.</p>";
    }
  }

  // --- Eliminar archivo ---
  window.deleteFile = async function(fileName) {
    if (currentUserRole !== "admin") {
      Swal.fire({
        icon: "error",
        title: "Acceso Denegado",
        text: "No tienes permisos para eliminar archivos.",
        confirmButtonColor: "#e74c3c"
      });
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/delete/${fileName}`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Error al eliminar archivo.");
      Swal.fire({
        icon: "success",
        title: "Archivo Eliminado",
        text: "El archivo se ha eliminado correctamente.",
        confirmButtonColor: "#2ecc71"
      });
      loadFiles();
    } catch (error) {
      console.error("Error al eliminar archivo:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo eliminar el archivo.",
        confirmButtonColor: "#e74c3c"
      });
    }
  };

  // --- Previsualizar archivo ---
  window.previewFile = function(fileUrl) {
    const modal = document.getElementById("preview-modal");
    const modalContent = document.getElementById("modal-preview-content");
    if (/\.(png|jpg|jpeg|gif)$/i.test(fileUrl)) {
      modalContent.innerHTML = `<span id="modal-close" class="close-button">&times;</span><img src="${fileUrl}" alt="Vista previa">`;
    } else if (/\.pdf$/i.test(fileUrl)) {
      modalContent.innerHTML = `<span id="modal-close" class="close-button">&times;</span><iframe src="${fileUrl}"></iframe>`;
    } else {
      modalContent.innerHTML = `<span id="modal-close" class="close-button">&times;</span><p>No se puede previsualizar este archivo.</p>`;
    }
    modal.style.display = "block";
    // Reasignar el evento de cierre
    document.getElementById("modal-close").addEventListener("click", () => {
      modal.style.display = "none";
    });
  };

  // Cerrar modal al hacer clic fuera del contenido
  window.addEventListener("click", (event) => {
    const modal = document.getElementById("preview-modal");
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });
});
