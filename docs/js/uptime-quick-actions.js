// ==========================================
// 5. SMART SEARCH & QUICK ACTIONS
// ==========================================

/**
 * Setup smart search autocomplete
 */
function setupSmartSearch() {
    const searchInput = document.getElementById('quick-search-input');
    const suggestionsDiv = document.getElementById('search-suggestions');

    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();

        if (query.length < 2) {
            suggestionsDiv.style.display = 'none';
            return;
        }

        // Search in nodes
        const matchingNodes = allNodesData.filter(node =>
            node.name.toLowerCase().includes(query)
        );

        // Search in PONs
        const matchingPons = allPonsData.filter(pon =>
            pon.ponName.toLowerCase().includes(query) ||
            pon.nodeName.toLowerCase().includes(query)
        );

        if (matchingNodes.length === 0 && matchingPons.length === 0) {
            suggestionsDiv.innerHTML = '<div style="padding:0.5rem; color:#999;">No se encontraron resultados</div>';
            suggestionsDiv.style.display = 'block';
            return;
        }

        let html = '';

        // Render node matches
        if (matchingNodes.length > 0) {
            html += '<div style="font-weight:600; font-size:0.75rem; color:#9ca3af; margin-bottom:0.5rem;">NODOS</div>';
            matchingNodes.slice(0, 3).forEach(node => {
                html += `
                    <div class="search-result-item" data-type="node" data-node-id="${node.id}" data-node-name="${node.name}"
                        style="padding: 0.5rem; cursor: pointer; border-radius: 4px; margin-bottom: 0.25rem; background: rgba(255,255,255,0.05);">
                        <i data-lucide="server" style="width:14px; height:14px;"></i>
                        <strong>${node.name}</strong>
                    </div>
                `;
            });
        }

        // Render PON matches
        if (matchingPons.length > 0) {
            html += '<div style="font-weight:600; font-size:0.75rem; color:#9ca3af; margin:0.5rem 0;">PONs</div>';
            matchingPons.slice(0, 5).forEach(pon => {
                html += `
                    <div class="search-result-item" data-type="pon" data-node-id="${pon.nodeId}" data-node-name="${pon.nodeName}" 
                        data-pon-name="${pon.ponName}"
                        style="padding: 0.5rem; cursor: pointer; border-radius: 4px; margin-bottom: 0.25rem; background: rgba(255,255,255,0.05);">
                        <i data-lucide="network" style="width:14px; height:14px;"></i>
                        ${pon.nodeName} → <span class="badge badge-info" style="font-size:0.75rem;">${pon.ponName}</span>
                    </div>
                `;
            });
        }

        suggestionsDiv.innerHTML = html;
        suggestionsDiv.style.display = 'block';

        // Re-init lucide icons
        if (window.lucide) window.lucide.createIcons();

        // Add click handlers
        suggestionsDiv.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => handleSearchSelection(item));
        });
    });

    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
            suggestionsDiv.style.display = 'none';
        }
    });
}

/**
 * Handle selection from search results
 */
function handleSearchSelection(item) {
    const type = item.dataset.type;
    const nodeId = item.dataset.nodeId;
    const nodeName = item.dataset.nodeName;

    // Set the node dropdown
    const nodeSelect = document.getElementById('new-incident-node');
    nodeSelect.value = nodeId;

    // Trigger change event to load PONs
    nodeSelect.dispatchEvent(new Event('change'));

    if (type === 'pon') {
        const ponName = item.dataset.ponName;

        // Wait for cascade to load, then auto-select PON
        setTimeout(() => {
            // Extract letter and port from PON name (e.g., "PON A3" -> letter "A", port "3")
            const match = ponName.match(/PON\s*([A-Z])(\d+)/i);
            if (match) {
                const letter = match[1].toUpperCase();
                const port = match[2];

                // Select letter
                const letterSelect = document.getElementById('pon-letter-select');
                const letterOption = Array.from(letterSelect.options).find(opt =>
                    opt.text.includes(letter)
                );
                if (letterOption) {
                    letterSelect.value = letterOption.value;
                    letterSelect.dispatchEvent(new Event('change'));

                    // Wait for ports to load, then select port
                    setTimeout(() => {
                        const portSelect = document.getElementById('pon-port-select');
                        portSelect.value = ponName;
                        portSelect.dispatchEvent(new Event('change'));

                        // Auto-click "Add PON" button
                        document.getElementById('add-pon-btn').click();
                    }, 300);
                }
            }
        }, 300);
    }

    // Clear search and hide suggestions
    document.getElementById('quick-search-input').value = '';
    document.getElementById('search-suggestions').style.display = 'none';
}

/**
 * Build search cache from Firestore
 */
async function buildSearchCache() {
    try {
        // Load all nodes
        const nodesSnapshot = await db.collection('Nodos').get();
        allNodesData = [];

        for (const nodeDoc of nodesSnapshot.docs) {
            const nodeData = nodeDoc.data();
            const nodeId = nodeDoc.id;
            allNodesData.push({ id: nodeId, name: nodeData.name });

            // Load all PONs for this node
            const lettersSnapshot = await db.collection('Nodos').doc(nodeId).collection('PONLetters').get();

            for (const letterDoc of lettersSnapshot.docs) {
                const ponsSnapshot = await db.collection('Nodos').doc(nodeId)
                    .collection('PONLetters').doc(letterDoc.id)
                    .collection('PONs').get();

                ponsSnapshot.forEach(ponDoc => {
                    allPonsData.push({
                        nodeId: nodeId,
                        nodeName: nodeData.name,
                        ponName: ponDoc.data().name,
                        ponId: ponDoc.id
                    });
                });
            }
        }

        console.log(`✅ Search cache built: ${allNodesData.length} nodes, ${allPonsData.length} PONs`);
    } catch (error) {
        console.error("Error building search cache:", error);
    }
}

/**
 * Setup copy-last-incident button
 */
function setupCopyLastIncident() {
    const btn = document.getElementById('copy-last-incident-btn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        try {
            // Fetch the most recent incident
            const snapshot = await db.collection(COLLECTION_NAME)
                .orderBy('created_at', 'desc')
                .limit(1)
                .get();

            if (snapshot.empty) {
                alert("No hay incidentes previos para copiar.");
                return;
            }

            const lastIncident = snapshot.docs[0].data();
            lastIncidentData = lastIncident;

            // Pre-fill the form
            if (lastIncident.node_id) {
                const nodeSelect = document.getElementById('new-incident-node');
                nodeSelect.value = lastIncident.node_id;
                nodeSelect.dispatchEvent(new Event('change'));
            }

            if (lastIncident.failure_type) {
                document.getElementById('new-incident-type').value = lastIncident.failure_type;
            }

            if (lastIncident.affected_pons && lastIncident.affected_pons.length > 0) {
                // Auto-select PONs (simplified - just add them to the list)
                selectedPons = [...lastIncident.affected_pons];
                updateSelectedPonsUI();
            }

            // Visual feedback
            btn.innerHTML = '<i data-lucide="check"></i> ¡Copiado!';
            btn.style.background = '#10b981';
            if (window.lucide) window.lucide.createIcons();

            setTimeout(() => {
                btn.innerHTML = '<i data-lucide="copy"></i> Copiar del Último Incidente';
                btn.style.background = '';
                if (window.lucide) window.lucide.createIcons();
            }, 2000);

        } catch (error) {
            console.error("Error copying last incident:", error);
            alert("Error al copiar el último incidente.");
        }
    });
}
