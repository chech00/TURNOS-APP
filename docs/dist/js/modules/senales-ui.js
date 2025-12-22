/**
 * senales-ui.js
 * Handles DOM manipulation and rendering for the Network Topology views.
 * (Server Room -> OLT Chassis -> SFP Faceplate -> Splice Boxes)
 */

// Helper to generate random blinking lights line
function generarLucesRack() {
    const patterns = [
        '<div class="rack-light break"></div><div class="rack-light"></div><div class="rack-light"></div>',
        '<div class="rack-light blue"></div><div class="rack-light blue"></div>',
        '<div class="rack-light orange"></div>',
        '<div class="rack-light red"></div><div class="rack-light"></div>',
        '<div class="rack-light"></div><div class="rack-light blue"></div><div class="rack-light"></div><div class="rack-light"></div>',
    ];
    const randomPattern = patterns[Math.floor(Math.random() * patterns.length)];
    return `<div class="rack-activity-lights" style="justify-content:${Math.random() > 0.5 ? 'flex-start' : 'flex-end'}">${randomPattern}</div>`;
}

// ==========================================
// 1. RACK VIEW (NODES)
// ==========================================

export function renderRoomHeader(container, isAdmin) {
    let buttonsHtml = "";
    if (isAdmin) {
        buttonsHtml += `
          <button onclick="window.KMLService.startWizard()" class="fiber-action-btn kml-btn">
              <i data-lucide="upload-cloud" style="width:14px;"></i> IMP. KML
          </button>
          <button onclick="crearNodo()" class="fiber-action-btn new-node-btn">
             <i data-lucide="plus-circle" style="width:14px;"></i> NUEVO GABINETE
          </button>
        `;
    }

    container.innerHTML = `
        <div class="section-header">
          <div class="section-title-wrapper">
            <h2>Sala de Servidores (Nodos)</h2>
            <p>Seleccione un Gabinete para acceder a los equipos OLT.</p>
          </div>
          <div class="header-actions">
              ${buttonsHtml}
          </div>
        </div>
      `;
}

export function createRackElement(nodoId, nodoName, stats, isAdmin) {
    const rack = document.createElement("div");
    rack.classList.add("server-rack");
    rack.onclick = () => window.mostrarVistaPonLetras(nodoId, nodoName);

    let badgeHTML = '';
    if (stats.totalPONs === 0) {
        badgeHTML = '<div class="node-status-badge empty">OFFLINE</div>';
    } else {
        badgeHTML = `<div class="node-status-badge populated">SYS: ONLINE<br>PON: ${stats.totalPONs} | BOX: ${stats.totalCajas}</div>`;
    }

    rack.innerHTML = `
        ${badgeHTML}
        <div class="rack-nameplate">${nodoName}</div>
        <div class="rack-interior">
            ${generarLucesRack()}
            ${generarLucesRack()}
            ${generarLucesRack()}
            <div style="height:20px;"></div>
            ${generarLucesRack()}
            ${generarLucesRack()}
        </div>
        <div class="rack-door"></div>
    `;

    if (isAdmin) {
        const actionsDiv = document.createElement("div");
        actionsDiv.classList.add("rack-actions");
        actionsDiv.innerHTML = `
            <button class="edit-rack-btn" title="Editar Nombre" style="background:none; border:none; color:#fbbf24; cursor:pointer; font-weight:bold; font-size:1.2rem; margin-right:5px;">✎</button>
            <button class="delete-rack-btn" title="Desmantelar Nodo" style="background:none; border:none; color:#ef4444; cursor:pointer; font-weight:bold; font-size:1.2rem;">×</button>
        `;

        actionsDiv.querySelector(".edit-rack-btn").onclick = (e) => {
            e.stopPropagation();
            window.editarNodo(nodoId, nodoName);
        };

        actionsDiv.querySelector(".delete-rack-btn").onclick = (e) => {
            e.stopPropagation();
            window.confirmarEliminarNodo(nodoId, nodoName);
        };
        rack.appendChild(actionsDiv);
    }

    return rack;
}

// ==========================================
// 2. CHASSIS VIEW (LETTERS/CARDS)
// ==========================================

export function renderChassisView(container, nodoName, isAdmin, nodoId) {
    let html = `
    <div class="olt-management-panel">
        <div class="olt-header-left">
            <button class="olt-header-back-btn" onclick="cargarNodos()">
                ← RACK ROOM
            </button>
            <div class="olt-info-group">
                <span class="olt-device-label">OPTICAL LINE TERMINAL</span>
                <span class="olt-device-name">${nodoName}</span>
            </div>
        </div>

        <div class="olt-lcd-display">
            <div class="olt-status-light"></div>
            <span>SYSTEM STATUS: ONLINE / MANAGED</span>
        </div>
    `;

    if (isAdmin) {
        html += `
        <div class="olt-admin-controls">
            <span class="olt-device-label" style="font-size:0.7rem;">EXPANSION SLOT</span>
            <select id="pon-letra-dropdown" class="olt-select-dark">
               ${[...Array(26)].map((_, i) => {
            const letter = String.fromCharCode(65 + i);
            return `<option value="${letter}">CARD SLOT ${letter}</option>`;
        }).join("")}
            </select>
            <button class="olt-btn-install" onclick="crearPonLetra('${nodoId}')">
                INITIALIZE CARD
            </button>
        </div>
        `;
    } else {
        html += `<div></div>`;
    }

    html += `</div>`; // Close panel
    html += `<div id="pon-letters-list" style="width: 100%; display: flex; justify-content: center;"></div>`;

    container.innerHTML = html;
}

export function renderChassisSlots(foundLetters, isAdmin, nodoId) {
    let html = `
        <div class="olt-chassis">
          <div class="olt-fan-tray">
            <div class="olt-fan-blade"></div>
            <div class="olt-fan-blade"></div>
            <div class="olt-fan-blade"></div>
            <div class="olt-fan-blade"></div>
          </div>
          <div class="olt-shelf">
      `;

    const maxSlots = 16;
    for (let i = 0; i < maxSlots; i++) {
        if (foundLetters[i]) {
            const letter = foundLetters[i].name;
            html += `
                <div class="olt-card" onclick="mostrarVistaPONPorLetra('${nodoId}', '${letter}')" title="PON Board ${letter}">
                  <div class="olt-handle"></div>
                  <div class="olt-faceplate">
                    <div class="olt-led-group">
                       <div class="olt-led run"></div>
                       <div class="olt-led"></div>
                    </div>
                    <div class="olt-port-grid">
                       ${[...Array(8)].map(() => `<div class="olt-port"></div>`).join('')}
                    </div>
                    <div class="olt-label">BOARD ${letter}</div>
                  </div>
                  <div class="olt-handle bottom"></div>
                  ${isAdmin ?
                    `<button style="position:absolute; bottom:30px; border:none; background:transparent; color:red; font-weight:bold; cursor:pointer;"
                      onclick="confirmarEliminarPonLetra(event, '${nodoId}', '${letter}')">×</button>`
                    : ''}
                </div>
              `;
        } else {
            html += `
            <div class="olt-slot-empty">
                <div style="position:absolute; top:5px; left:50%; transform:translateX(-50%); width:6px; height:6px; background:#111; border-radius:50%; box-shadow:inset 0 0 2px #fff;"></div>
                <div style="position:absolute; bottom:5px; left:50%; transform:translateX(-50%); width:6px; height:6px; background:#111; border-radius:50%; box-shadow:inset 0 0 2px #fff;"></div>
            </div>`;
        }
    }

    html += `</div></div>`;
    return html;
}

// ==========================================
// 3. FACEPLATE VIEW (PONS)
// ==========================================

export function renderFaceplateView(container, nodoId, letter, nodoName, isAdmin) {
    let html = `
    <div class="olt-management-panel">
        <div class="olt-header-left">
            <button class="olt-header-back-btn" onclick="mostrarVistaPonLetras('${nodoId}', '${nodoName}')">
                ← CARD ${letter} [BACK]
            </button>
            <div class="olt-info-group">
                <span class="olt-breadcrumb">NODE: ${nodoName} > SLOT: ${letter}</span>
                <span class="olt-device-name">SLOT ${letter}</span>
            </div>
        </div>

        <div class="olt-lcd-display">
            <div class="olt-status-light"></div>
            <span>MODULE STATUS: ACTIVE / SYNCED</span>
        </div>
    `;

    if (isAdmin) {
        html += `
        <div class="olt-admin-controls">
            <span class="olt-device-label" style="font-size:0.7rem;">SFP PORT MGMT</span>
            <select id="pon-numero" class="olt-select-dark">
              ${[...Array(16)].map((_, i) => `<option value="${i}">PORT ${i}</option>`).join("")}
            </select>
            <button class="olt-btn-install" onclick="crearPON('${nodoId}', '${letter}')">
               INSERT SFP MODULE
            </button>
            <input type="hidden" id="pon-letra" value="${letter}" />
        </div>
       `;
    } else {
        html += `<div></div>`;
    }

    html += `</div>`;
    html += `<div id="pon-list" class="olt-card-detail-container"></div>`;

    container.innerHTML = html;
}

export function renderFaceplatePorts(foundPons, letter, nodoId, isAdmin) {
    let html = `<div class="olt-faceplate-detail">`;

    for (let i = 0; i < 16; i++) {
        const pon = foundPons[i];
        if (pon) {
            html += `
                <div class="sfp-cage active" onclick="mostrarVistaPON('${nodoId}', '${letter}', '${pon.id}', '${pon.name}')" title="${pon.name} - Conectado">
                    <div class="sfp-cage-label">${letter}${i}</div>
                    ${isAdmin ? `<button class="sfp-delete-btn" onclick="confirmarEliminarPON(event, '${nodoId}', '${letter}', '${pon.id}')">×</button>` : ''}
                    <div class="sfp-module inserted">
                         <div style="font-size:5px; color:#333; position:absolute; top:2px; left:2px; font-family:sans-serif;">10G</div>
                         <div class="sfp-glow-laser" style="position:absolute; top:40%; right:-2px; width:4px; height:4px; background:#0f0; border-radius:50%; box-shadow:0 0 5px #0f0; opacity:0.8; animation:blink-random 0.1s infinite;"></div>
                    </div>
                    <div class="sfp-fiber"></div>
                </div>
            `;
        } else {
            html += `
                <div class="sfp-cage empty" title="Puerto ${i} Vacío">
                    <div class="sfp-cage-label">${letter}${i}</div>
                </div>
            `;
        }
    }

    html += `</div>`;
    html += `
        <div style="margin-top:20px; display:flex; gap:20px; color:#888; font-size:0.8rem;">
            <div style="display:flex; align-items:center; gap:5px;"><div style="width:10px; height:10px; background:#00a8ff; border-radius:2px;"></div> SFP Activo</div>
            <div style="display:flex; align-items:center; gap:5px;"><div style="width:10px; height:10px; background:#111; border:1px solid #666; border-radius:2px;"></div> Puerto Libre</div>
        </div>
      `;

    return html;
}

// ==========================================
// 4. TOPOLOGY VIEW (BOXES)
// ==========================================

export function renderTopologyHeader(container, nodoId, letter, ponId, ponName, nodoName, isAdmin) {
    let html = `
    <div class="olt-management-panel">
        <div class="olt-header-left">
            <button class="olt-header-back-btn" onclick="mostrarVistaPONPorLetra('${nodoId}', '${letter}')">
                ← SFP FACEPLATE [BACK]
            </button>
            <div class="olt-info-group">
                <span class="olt-breadcrumb">NODE: ${nodoName || 'N/A'} > SLOT: ${letter} > PON: ${ponName}</span>
                <span class="olt-device-name">${ponName}</span>
            </div>
        </div>

        <div class="olt-lcd-display">
            <div class="olt-status-light"></div>
            <span>NETWORK STATUS: ACTIVE / LIVE</span>
        </div>
    `;

    if (isAdmin) {
        html += `
        <div class="olt-admin-controls">
            <span class="olt-device-label" style="font-size:0.7rem;">SPLICE BOX MGMT</span>
            <select id="caja-numero" class="olt-select-dark">
               ${[...Array(51)].map((_, i) => `<option value="${i}">BOX ID ${i}</option>`).join("")}
            </select>
            <select id="caja-capacidad" class="olt-select-dark" style="margin-left:5px;">
              <option value="8">8 PORTS</option>
              <option value="12" selected>12 PORTS</option>
              <option value="16">16 PORTS</option>
              <option value="24">24 PORTS</option>
            </select>
            <button class="olt-btn-install" onclick="crearCaja('${nodoId}', '${letter}', '${ponId}')">
                DEPLOY SPLICE BOX
            </button>
        </div>
    `;
    } else {
        html += `<div></div>`;
    }

    html += `</div>`;
    html += `<div id="caja-list" class="topology-container"></div>`;
    container.innerHTML = html;
}

export function renderTopologyTree(container, boxes, nodoId, letter, ponId, isAdmin) {
    let html = `<div class="trunk-line"></div>`;

    if (boxes.length === 0) {
        html += `<div style="z-index:1; background:#222; padding:10px; border-radius:8px; color:#888;">No hay cajas en el troncal.</div>`;
    } else {
        boxes.forEach((item, index) => {
            const side = index % 2 === 0 ? "left" : "right";

            // Random realistic metrics (Simulated for Demo)
            const signalPower = (-15 + Math.random() * 8).toFixed(1);
            const transmissionRate = (950 + Math.random() * 50).toFixed(0);
            const temperature = (25 + Math.random() * 15).toFixed(1);
            const uptimeDays = Math.floor(Math.random() * 365);
            const healthStatus = signalPower > -10 ? 'optimal' : signalPower > -12 ? 'warning' : 'critical';
            const healthColor = signalPower > -10 ? '#00ff88' : signalPower > -12 ? '#ffaa00' : '#ff4444';

            html += `
            <div class="branch ${side}">
              <div class="branch-cable"></div>
              <div class="branch-content">
                <div class="splice-box health-${healthStatus}" 
                     onclick="mostrarVistaCaja('${nodoId}', '${letter}', '${ponId}', '${item.docId}', '${item.name}', ${item.capacity})"
                     data-signal="${signalPower}"
                     data-rate="${transmissionRate}"
                     data-temp="${temperature}"
                     data-uptime="${uptimeDays}"
                     title="📡 Señal: ${signalPower} dBm | ⚡ Tasa: ${transmissionRate} Mbps | 🌡️ Temp: ${temperature}°C | ⏱️ Uptime: ${uptimeDays} días"
                     style="--health-color: ${healthColor};">
                  <div class="splice-box-header">
                    <span>${item.name}</span>
                    <span style="font-size:0.7em; opacity:0.7;">${item.capacity} FO</span>
                  </div>
                  <div class="splice-box-info">
                    Manga de Empalme
                  </div>
                  <div class="capacity-bar">
                    <div class="capacity-fill" style="width: 0%"></div>
                  </div>
                  ${isAdmin ?
                    `<span class="delete-icon" onclick="confirmarEliminarCaja(event, '${nodoId}', '${letter}', '${ponId}', '${item.docId}')">🗑</span>`
                    : ''}
                </div>
              </div>
            </div>
          `;
        });
    }

    container.innerHTML = html;
}
