/**
 * KML Service - Independent Module for Network Import
 * Features:
 * - KML and KMZ (Zip) support.
 * - Progress Bar.
 * - Split Box Detection (Report before import).
 * - Dark Theme UI.
 */

(function () {
    console.log("KML Service Loaded");

    const KMLService = {

        init: function () {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    // this.injectButton(); // Manual placement in senales.js
                    this.injectStyles();
                });
            } else {
                // this.injectButton();
                this.injectStyles();
            }
        },

        injectStyles: function () {
            const style = document.createElement('style');
            style.innerHTML = `
                .swal2-popup {
                    background-color: #1f2937 !important;
                    color: #f3f4f6 !important;
                    border: 1px solid #374151;
                }
                .swal2-title {
                    color: #f9fafb !important;
                }
                .swal2-html-container {
                    color: #d1d5db !important;
                }
                .swal2-select, .swal2-input, .swal2-textarea {
                    background-color: #374151 !important;
                    color: #fff !important;
                    border: 1px solid #4b5563 !important;
                }
                .swal2-select option {
                    background-color: #374151;
                    color: #fff;
                }
                .split-box-alert {
                    background: #374151; 
                    padding: 8px; 
                    border-left: 4px solid #f59e0b;
                    margin-top: 10px;
                    text-align: left;
                    font-size: 0.85rem;
                }
            `;
            document.head.appendChild(style);
        },

        injectButton: function () {
            const header = document.querySelector('header');
            if (!header) return;
            if (document.getElementById('kml-import-btn')) return;

            const btn = document.createElement('button');
            btn.id = 'kml-import-btn';
            btn.className = 'fiber-action-btn kml-btn'; // Use shared class + specific
            // btn.style.marginLeft = '20px'; // Move to CSS
            // btn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)'; // Move to CSS
            btn.innerHTML = '<i data-lucide="upload-cloud" style="width:18px; margin-right:8px;"></i> IMPORTAR KML/KMZ';
            btn.onclick = () => this.startWizard();

            header.appendChild(btn);
            if (window.lucide) lucide.createIcons();
        },

        startWizard: async function () {
            const db = window.db;
            if (!db) {
                Swal.fire("Error", "Base de datos no conectada.", "error");
                return;
            }

            try {
                const nodesSnap = await db.collection("Nodos").get();
                const nodes = {};
                nodesSnap.forEach(doc => nodes[doc.id] = doc.data().nombre || doc.id);

                if (Object.keys(nodes).length === 0) {
                    Swal.fire("Aviso", "No hay nodos creados en el sistema.", "warning");
                    return;
                }

                const { value: selectedNodeId } = await Swal.fire({
                    title: 'Seleccionar Nodo Objetivo',
                    text: '¿A qué nodo pertenece este archivo?',
                    input: 'select',
                    inputOptions: nodes,
                    inputPlaceholder: 'Selecciona un nodo',
                    showCancelButton: true,
                    confirmButtonText: 'Siguiente >',
                    inputValidator: (value) => value ? undefined : 'Debes seleccionar un nodo'
                });

                if (selectedNodeId) {
                    this.promptFileUpload(selectedNodeId);
                }

            } catch (err) {
                console.error(err);
                Swal.fire("Error", "Fallo al cargar nodos: " + err.message, "error");
            }
        },

        promptFileUpload: async function (nodoId) {
            const { value: file } = await Swal.fire({
                title: 'Subir Archivo de Red',
                text: 'Soporta archivos .KML y .KMZ (Google Earth)',
                input: 'file',
                inputAttributes: {
                    'accept': '.kml, .kmz',
                    'aria-label': 'Sube tu archivo KML/KMZ'
                },
                showCancelButton: true,
                confirmButtonText: 'Analizar e Importar'
            });

            if (file) {
                this.handleFile(file, nodoId);
            }
        },

        handleFile: async function (file, nodoId) {
            Swal.fire({
                title: 'Leyendo archivo...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            try {
                let kmlText = "";
                if (file.name.toLowerCase().endsWith('.kmz')) {
                    kmlText = await this.readKmz(file);
                } else {
                    kmlText = await this.readTextFile(file);
                }

                const data = this.parseKML(kmlText);

                if (data.results.length === 0) {
                    Swal.fire({ title: "Error", text: "No se encontraron datos.", icon: "error" });
                    return;
                }

                // ============================================
                // VALIDACIÓN DE DUPLICADOS (Deshabilitado temporalmente - Métodos no definidos)
                /*
                const extractedNodeName = this.extractNodeNameFromKML(data.firstRaw);
                
                if (extractedNodeName) {
                    const existingNode = await this.checkIfNodeExists(extractedNodeName);
                    
                    if (existingNode.exists) {
                        const result = await Swal.fire({
                            title: '⚠️ Nodo Duplicado',
                            html: `
                                <p>El nodo <strong>"${extractedNodeName}"</strong> ya existe en el sistema.</p>
                                <p style="color:#888; font-size:0.9rem; margin-top:10px;">
                                    Fue cargado el: ${existingNode.createdDate || 'Fecha desconocida'}
                                </p>
                                <p style="margin-top:15px;">¿Qué deseas hacer?</p>
                            `,
                            icon: 'warning',
                            showDenyButton: true,
                            showCancelButton: true,
                            confirmButtonText: 'Ver Existente',
                            denyButtonText: 'Sobrescribir',
                            cancelButtonText: 'Cancelar',
                            confirmButtonColor: '#3085d6',
                            denyButtonColor: '#d33',
                            cancelButtonColor: '#6c757d'
                        });

                        if (result.isConfirmed) {
                            // Navegar al nodo existente
                            Swal.fire({
                                title: 'Navegando...',
                                text: 'Cargando datos del nodo existente',
                                icon: 'info',
                                timer: 1500,
                                showConfirmButton: false
                            });
                            if (typeof mostrarVistaPonLetras === 'function') {
                                mostrarVistaPonLetras(existingNode.id, existingNode.name);
                            }
                            return;
                        } else if (result.isDenied) {
                            const confirmOverwrite = await Swal.fire({
                                title: '¿Estás seguro?',
                                text: 'Esto eliminará TODOS los datos del nodo existente.',
                                icon: 'warning',
                                showCancelButton: true,
                                confirmButtonText: 'Sí, sobrescribir',
                                cancelButtonText: 'Cancelar',
                                confirmButtonColor: '#d33'
                            });

                            if (!confirmOverwrite.isConfirmed) {
                                return;
                            }

                            await this.deleteNodeCompletely(existingNode.id);
                        } else {
                            return; // Usuario canceló
                        }
                    }
                }
                */


                // PRE-PROCESSING: Group by Box to find Max Capacity (True Total)
                // AND Detect "Containers" (e.g. F1-8) that act as summaries for Splits (F1-2, F3-6).
                const boxGroups = {};
                data.results.forEach(item => {
                    const key = `${item.slot}-${item.ponPort}-${item.boxNum}`;
                    if (!boxGroups[key]) boxGroups[key] = { maxEnd: 0, items: [] };
                    boxGroups[key].items.push(item);
                });

                // Filter out CONTAINERS (Supersets)
                const filteredResults = [];
                Object.keys(boxGroups).forEach(key => {
                    const group = boxGroups[key];
                    const realItems = [];

                    // Check for containment
                    group.items.forEach(candidate => {
                        let isContainer = false;
                        for (const other of group.items) {
                            if (candidate === other) continue;
                            // If Candidate strictly contains Other, Candidate is a Summary/Folder name -> Ignore
                            if (candidate.fStart <= other.fStart && candidate.fEnd >= other.fEnd) {
                                // Double check: equal range is duplicate, not container.
                                // Strict strict: if range is larger
                                if ((candidate.fEnd - candidate.fStart) > (other.fEnd - other.fStart)) {
                                    isContainer = true;
                                    break;
                                }
                            }
                        }
                        if (!isContainer) {
                            realItems.push(candidate);
                        }
                    });

                    // Update group maxEnd based on REAL items
                    let groupMax = 0;

                    // Deduplication Set
                    const seenRanges = new Set();

                    realItems.forEach(item => {
                        if (item.fEnd > groupMax) groupMax = item.fEnd;

                        // Deduplicate: If we already have this range for this box, skip.
                        const rangeKey = `${item.fStart}-${item.fEnd}`;
                        if (!seenRanges.has(rangeKey)) {
                            seenRanges.add(rangeKey);
                            // Assign shared capacity
                            // We set it later when pushing, but we need to push only unique ones.
                            // Let's create a temp array of unique items.
                            item.unique = true;
                        } else {
                            item.unique = false;
                        }
                    });

                    realItems.forEach(item => {
                        if (item.unique) {
                            item.sharedCapacity = groupMax;
                            filteredResults.push(item);
                        }
                    });
                });

                if (filteredResults.length === 0) {
                    Swal.fire({ title: "Error", text: "Datos filtrados vacíos. Verifique si el KML tiene placemarks válidos.", icon: "error" });
                    return;
                }

                this.confirmImport(nodoId, filteredResults);

            } catch (err) {
                Swal.fire("Error", "No se pudo leer el archivo: " + err.message, "error");
            }
        },

        readTextFile: function (file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(e);
                reader.readAsText(file);
            });
        },

        readKmz: function (file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const arrayBuffer = e.target.result;
                    if (!window.JSZip) {
                        reject(new Error("La librería JSZip no está cargada. Recarga la página."));
                        return;
                    }
                    JSZip.loadAsync(arrayBuffer).then(function (zip) {
                        const kmlFilename = Object.keys(zip.files).find(name => name.toLowerCase().endsWith('.kml') || name.toLowerCase().endsWith('.xml'));
                        if (kmlFilename) {
                            return zip.file(kmlFilename).async("string");
                        } else {
                            throw new Error("No se encontró ningún archivo .kml dentro del KMZ.");
                        }
                    }).then(resolve).catch(reject);
                };
                reader.readAsArrayBuffer(file);
            });
        },

        parseKML: function (xmlText) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");

            let placemarks = xmlDoc.getElementsByTagName("Placemark");
            if (placemarks.length === 0) placemarks = xmlDoc.getElementsByTagName("kml:Placemark");
            if (placemarks.length === 0) placemarks = xmlDoc.getElementsByTagName("placemark");

            const results = [];
            // Regex Improved V3: Stricter Delimiters to avoid False Positives
            // Accepts:
            // "PON A5 C2 F1-8"
            // "A-5-C2-F1-8"
            // "A 5 C 2 F 1 - 8"
            // "Caja A5 C2 F 1-8" (ignoring 'Caja' at start if present)
            // Rejects: "Acometida 5 Cliente 2..." (unless it mimics structure intentionally)

            // Structure:
            // 1. Optional Prefix "PON" or similar
            // 2. Slot (One Letter A-Z)
            // 3. Separator
            // 4. Port (Number)
            // 5. Separator + "C" or "CAJA" indicator + Separator
            // 6. Box Number
            // 7. Separator + "F" or "FIL" indicator + Separator
            // 8. Start Range - End Range

            const regex = /(?:PON\s*)?([A-Z])[\s-_]*(\d+)[\s-_]*(?:C|CAJA)[\s-_]*(\d+)[\s-_]*(?:F|FIL)[\s-_]*(\d+)\s*-\s*(\d+)/i;

            let firstRawName = "Ninguno (No se encontraron Placemarks)";
            let totalFound = placemarks.length;
            let fileSnippet = xmlText.substring(0, 100).replace(/</g, "&lt;");

            for (let i = 0; i < placemarks.length; i++) {
                const nameTag = placemarks[i].getElementsByTagName("name")[0];
                if (nameTag) {
                    const rawName = nameTag.textContent.trim();
                    if (i === 0) firstRawName = rawName;

                    const match = rawName.match(regex);
                    if (match) {
                        const startF = parseInt(match[4]);
                        const endF = parseInt(match[5]);
                        const capacity = (endF - startF) + 1;

                        results.push({
                            rawName: rawName,
                            slot: match[1].toUpperCase(),
                            ponPort: parseInt(match[2]),
                            boxNum: parseInt(match[3]),
                            capacity: capacity > 0 ? capacity : 8,
                            fStart: startF,
                            fEnd: endF
                        });
                    }
                }
            }
            return {
                results: results,
                firstRaw: firstRawName,
                total: totalFound,
                snippet: fileSnippet
            };
        },

        analyzeSplits: function (items) {
            const map = {};
            const splits = [];

            items.forEach(item => {
                // Key: A-12-C3
                const key = `${item.slot}-${item.ponPort}-C${item.boxNum}`;
                if (!map[key]) map[key] = [];
                map[key].push(item);
            });

            for (const [key, parts] of Object.entries(map)) {
                if (parts.length > 1) {
                    // It's a split box
                    let rangeDesc = parts.map(p => `F${p.fStart}-${p.fEnd}`).join(', ');
                    splits.push(`<b>${key}</b>: (${rangeDesc})`);
                }
            }
            return splits;
        },

        confirmImport: function (nodoId, items) {
            const splits = this.analyzeSplits(items);
            let splitHtml = '';

            if (splits.length > 0) {
                splitHtml = `
                    <div class="split-box-alert" style="border-left: 4px solid #10b981;">
                        <div style="font-weight:bold; color:#10b981; margin-bottom:5px;">ℹ️ Cajas Divididas detectadas:</div>
                        <ul style="margin:0; padding-left:20px; color:#d1d5db; max-height:100px; overflow-y:auto;">
                            ${splits.map(s => `<li>${s}</li>`).join('')}
                        </ul>
                        <div style="margin-top:5px; font-style:italic;">Se crearán como <b>Cajas Físicas Independientes</b>.</div>
                    </div>
                `;
            }

            Swal.fire({
                title: 'Confirmar Importación',
                html: `
                    <p>Se han encontrado <b>${items.length}</b> elementos.</p>
                    ${splitHtml}
                    <p style="margin-top:15px;">¿Proceder con la importación?</p>
                `,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: '¡Sí, Importar!',
                confirmButtonColor: '#3085d6',
                width: '600px'
            }).then((result) => {
                if (result.isConfirmed) {
                    this.executeImport(nodoId, items);
                }
            });
        },

        /**
         * INITIALIZE FLOATING WIDGET
         * Injects the HTML and CSS for the background process widget
         */
        ensureWidgetExists: function () {
            if (document.getElementById('kml-floating-widget')) return;

            // 1. CSS
            const style = document.createElement('style');
            style.innerHTML = `
                .kml-widget {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    width: 320px;
                    background: rgba(31, 41, 55, 0.98);
                    backdrop-filter: blur(12px);
                    border: 1px solid #4b5563;
                    border-radius: 12px;
                    padding: 16px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    z-index: 9999;
                    font-family: 'Segoe UI', sans-serif;
                    color: #fff;
                    transform: translateY(150%);
                    transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.27);
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .kml-widget.active {
                    transform: translateY(0);
                }
                .kml-widget-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-weight: 600;
                    font-size: 0.95rem;
                    color: #e5e7eb;
                }
                .kml-widget-body {
                    font-size: 0.85rem;
                    color: #9ca3af;
                }
                .kml-progress-track {
                    width: 100%;
                    height: 6px;
                    background: #374151;
                    border-radius: 3px;
                    overflow: hidden;
                    margin-top: 5px;
                }
                .kml-progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #10b981, #059669);
                    width: 0%;
                    transition: width 0.3s ease;
                }
                .kml-spinner {
                    border: 2px solid rgba(255,255,255,0.1);
                    border-left-color: #10b981;
                    border-radius: 50%;
                    width: 14px;
                    height: 14px;
                    animation: kml-spin 1s linear infinite;
                }
                @keyframes kml-spin { to { transform: rotate(360deg); } }
            `;
            document.head.appendChild(style);

            // 2. HTML
            const widget = document.createElement('div');
            widget.id = 'kml-floating-widget';
            widget.className = 'kml-widget';
            widget.innerHTML = `
                <div class="kml-widget-header">
                    <span style="display:flex; gap:8px; align-items:center;">
                        <div class="kml-spinner" id="kml-widget-spinner"></div>
                        Importando Red...
                    </span>
                    <span id="kml-widget-percent" style="font-size:0.8rem; font-weight:bold; color:#10b981;">0%</span>
                </div>
                <div class="kml-widget-body">
                    Procesando <strong id="kml-widget-count">0</strong> elementos
                </div>
                <div class="kml-progress-track">
                    <div id="kml-widget-bar" class="kml-progress-fill"></div>
                </div>
                <div style="font-size:0.7rem; color:#6b7280; margin-top:4px;">
                    ⚠️ No cierres esta pestaña
                </div>
            `;
            document.body.appendChild(widget);

            // Warn on unload
            window.addEventListener('beforeunload', (e) => {
                const w = document.getElementById('kml-floating-widget');
                if (w && w.classList.contains('active') && !w.classList.contains('finished')) {
                    e.preventDefault();
                    e.returnValue = '';
                }
            });
        },

        updateWidget: function (current, total) {
            const widget = document.getElementById('kml-floating-widget');
            if (!widget) return;

            const percent = Math.round((current / total) * 100);
            document.getElementById('kml-widget-bar').style.width = `${percent}%`;
            document.getElementById('kml-widget-percent').innerText = `${percent}%`;
            document.getElementById('kml-widget-count').innerText = `${current}/${total}`;
        },

        finishWidget: function (successCount) {
            const widget = document.getElementById('kml-floating-widget');
            if (!widget) return;

            widget.classList.add('finished'); // Flag to allow unload
            document.getElementById('kml-widget-spinner').style.display = 'none';
            document.getElementById('kml-widget-bar').style.background = '#10b981'; // Solid green

            widget.querySelector('.kml-widget-header span').innerHTML = '✅ Importación Completada';
            widget.querySelector('.kml-widget-body').innerHTML = `Se crearon <strong>${successCount}</strong> elementos.`;

            // Auto hide after 4 seconds
            setTimeout(() => {
                widget.classList.remove('active');
            }, 4000);
        },

        executeImport: async function (nodoId, items) {
            const db = window.db;
            let successCount = 0;
            let errorCount = 0;
            const total = items.length;

            // 1. Show Toast to confirm start
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
                didOpen: (toast) => {
                    toast.addEventListener('mouseenter', Swal.stopTimer)
                    toast.addEventListener('mouseleave', Swal.resumeTimer)
                }
            });
            Toast.fire({
                icon: 'success',
                title: 'Importación iniciada en segundo plano'
            });

            // 2. Initialize and Show Widget
            this.ensureWidgetExists();
            const widget = document.getElementById('kml-floating-widget');
            widget.classList.remove('finished');
            widget.classList.add('active');

            // 3. Process Async Loop (Non-blocking)
            for (let i = 0; i < total; i++) {
                const item = items[i];
                try {
                    await this.createHierarchy(db, nodoId, item);
                    successCount++;
                } catch (e) {
                    console.error("Import Error", e);
                    errorCount++;
                }

                // Update Widget
                this.updateWidget(i + 1, total);
            }

            // 4. Finish
            this.finishWidget(successCount);

            // Optional: Refresh current view if relevant
            if (typeof cargarNodos === 'function') {
                // cargarNodos(); // Optional: Refresh UI
            }
        },

        createHierarchy: async function (db, nodoId, item) {
            // 1. Slot
            const slotRef = db.collection("Nodos").doc(nodoId).collection("PONLetters").doc(item.slot);
            // Optimization: We could cache these reads, but for safety lets check.
            // Actually, `set({name}, {merge:true})` is safer.
            // But we need to know if it exists to allow creation.
            // Let's Assume "Merge" logic is fine.
            await slotRef.set({ name: item.slot }, { merge: true });

            // 2. PON
            const ponName = `PON ${item.slot}${item.ponPort}`;
            const ponsRef = slotRef.collection("PONs");
            // Check by name manually to get ID
            let ponId = null;
            const ponQuery = await ponsRef.where("name", "==", ponName).get();
            if (ponQuery.empty) {
                const newPon = await ponsRef.add({ name: ponName });
                ponId = newPon.id;
            } else {
                ponId = ponQuery.docs[0].id;
            }

            // 3. Box
            let boxName = `Caja ${item.boxNum}`;
            // REQUIREMENT: If it's a split extension (starts > 1), append "EXT"
            if (item.fStart > 1) {
                boxName += " EXT";
            }
            const boxesRef = ponsRef.doc(ponId).collection("Cajas");
            let boxId = null;

            // STRICT IDENTITY Check:
            // To allow "Split Boxes" (Caja 3 F1-4 and Caja 3 F5-8) to coexist as separate docs,
            // we must check if a box with this SPECIFIC KML Source (or range) exists.
            // Using 'kmlSource' (Raw Name) is the most accurate way to map KML Placemark -> DB Doc.

            const boxQuery = await boxesRef.where("kmlSource", "==", item.rawName).get();

            if (boxQuery.empty) {
                // Determine capacity based on range, for valid rendering
                // User requirement: Capacity must accommodate the highest filament index.
                // e.g. F3-6 needs Capacity 6 to show ports 3,4,5,6 (with 1,2 empty).
                const realCapacity = item.fEnd;

                const newBox = await boxesRef.add({
                    name: boxName,
                    capacity: realCapacity,
                    kmlSource: item.rawName,
                    splitRange: `${item.fStart}-${item.fEnd}` // Metadata useful for debug/UI
                });
                boxId = newBox.id;
            } else {
                boxId = boxQuery.docs[0].id;
            }

            // 4. Filaments
            // Now that we have the specific box for this range, we populate it.
            // Note: If the box is new (boxQuery.empty), we definitely add.
            // If it exists, we check filaments to avoid duplication (idempotency).

            const filsRef = boxesRef.doc(boxId).collection("Filamentos");

            for (let f = item.fStart; f <= item.fEnd; f++) {
                const filName = `Filamento ${f}`;
                // Check redundancy? Batch writes are cheaper/faster if we trust `kmlSource` is unique.
                // But let's be safe.
                const filQuery = await filsRef.where("name", "==", filName).get();

                if (filQuery.empty) {
                    await filsRef.add({
                        name: filName,
                        signal: "-20.00",
                        status: "DISPONIBLE"
                    });
                }
            }
        }
    };

    KMLService.init();
    window.KMLService = KMLService;

})();
