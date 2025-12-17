// Mapa de dependencias de nodos - TOPOLOGÍA OFICIAL
// Fuente: antigravity_kml_uptime_bundle/output/impacto_dependencias_kml.json
// Generado mediante análisis BFS/DFS desde Data Center PM y PV (roots)
// Actualizado: Diciembre 2025
//
// IMPORTANTE: Este mapa muestra DOWNSTREAM (nodos que caen si este nodo cae)
// basado en análisis de alcanzabilidad desde los nodos core

export const topology = {
    // =============================================
    // NODOS CORE / ROOTS
    // =============================================

    "NODO DATA CENTER PM": {
        downstream: ["NODO LENCA"], // Solo Lenca depende directamente
        backup: []
    },

    "NODO DATA CENTER PV": {
        downstream: [], // No afecta otros nodos directamente
        backup: []
    },

    // =============================================
    // ZONA ALERCE / CORRENTOSO
    // =============================================

    "NODO ALERCE 3": {
        // Si cae A3 → caen: Correntoso + toda la cadena Patagonia Verde
        downstream: [
            "NODO CORRENTOSO",
            "NODO ENSENADA",
            "NODO RIO SUR 2",
            "NODO COCHAMÓ",
            "NODO RALUN",
            "NODO PUELO",
            "NODO CONTAO",
            "NODO HORNOPIRÉN"
        ],
        backup: ["NODO ALERCE SUR"]
    },

    "NODO ALERCE SUR": {
        downstream: [], // Nodo terminal
        backup: ["NODO ALERCE 3"]
    },

    "NODO CORRENTOSO": {
        downstream: [], // Nodo terminal
        backup: []
    },

    // =============================================
    // CADENA PATAGONIA VERDE (hacia el Sur)
    // Flujo: A3 → RIO SUR 2 → ENSENADA → (RALUN + COCHAMÓ → PUELO → CONTAO → HORNOPIRÉN)
    // =============================================

    "NODO RIO SUR 2": {
        // Si cae Rio Sur → cae toda la cadena PV
        downstream: [
            "NODO ENSENADA",
            "NODO COCHAMÓ",
            "NODO RALUN",
            "NODO PUELO",
            "NODO CONTAO",
            "NODO HORNOPIRÉN"
        ],
        backup: []
    },

    "NODO ENSENADA": {
        // Ensenada es punto de bifurcación → Ralun + cadena Cochamó
        downstream: [
            "NODO RALUN",
            "NODO COCHAMÓ",
            "NODO PUELO",
            "NODO CONTAO",
            "NODO HORNOPIRÉN"
        ],
        backup: []
    },

    "NODO RALUN": {
        downstream: [], // Nodo terminal
        backup: []
    },

    "NODO COCHAMO": {
        downstream: [], // Nodo terminal (las MUFAs no son nodos funcionales)
        backup: []
    },

    "NODO PUELO": {
        downstream: [], // Nodo terminal
        backup: []
    },

    "NODO CONTAO": {
        downstream: [], // Nodo terminal
        backup: ["ENLACE RF_CTO-PM"]
    },

    "NODO HORNOPIREN": {
        downstream: [], // Nodo terminal (más al sur)
        backup: []
    },

    // =============================================
    // ZONA FRUTILLAR / OSORNO
    // =============================================

    "NODO FRUTILLAR": {
        // Si cae Frutillar → caen Casma + cadena Quilanto-Osorno
        downstream: [
            "NODO CASMA",
            "NODO QUILANTO",
            "NODO NOCHACO",
            "NODO CASCADAS",
            "NODO RADALES",
            "NODO OSORNO"
        ],
        backup: ["NODO LLANQUIHUE"]
    },

    "NODO LLANQUIHUE": {
        downstream: [], // Nodo de respaldo, no alimenta a nadie
        backup: ["NODO FRUTILLAR"]
    },

    "NODO CASMA": {
        downstream: [], // Nodo terminal
        backup: []
    },

    "NODO QUILANTO": {
        // Quilanto alimenta toda la zona Osorno
        downstream: [
            "NODO NOCHACO",
            "NODO CASCADAS",
            "NODO RADALES",
            "NODO OSORNO"
        ],
        backup: []
    },

    "NODO NOCHACO": {
        // Nochaco distribuye a 3 nodos
        downstream: [
            "NODO CASCADAS",
            "NODO RADALES",
            "NODO OSORNO"
        ],
        backup: []
    },

    "NODO CASCADAS": {
        downstream: [], // Nodo terminal
        backup: []
    },

    "NODO RADALES": {
        downstream: [], // Nodo terminal
        backup: []
    },

    "NODO OSORNO": {
        downstream: [], // Nodo terminal
        backup: []
    },

    // =============================================
    // ZONA LAS QUEMAS / FRESIA / LOS MUERMOS
    // =============================================

    "NODO LAS QUEMAS 2": {
        // Las Quemas 2 alimenta a Panitao y Los Muermos
        downstream: [
            "NODO PANITAO",
            "NODO LOS MUERMOS",
            "NODO QUENUIR 2"
        ],
        backup: []
    },

    "NODO PANITAO": {
        downstream: [], // Según JSON, Panitao es terminal
        backup: []
    },

    "NODO NUEVA BRAUNAU": {
        downstream: ["NODO FRESIA OFICINA"],
        backup: []
    },

    "NODO FRESIA OFICINA": {
        downstream: [], // Nodo terminal
        backup: []
    },

    "NODO LOS MUERMOS": {
        downstream: ["NODO QUENUIR 2"],
        backup: []
    },

    "NODO QUENUIR 2": {
        downstream: [], // Nodo terminal
        backup: []
    },

    // =============================================
    // OTROS NODOS
    // =============================================

    "NODO LENCA": {
        downstream: [], // Nodo terminal
        backup: []
    },

    "NODO PUERTO MONTT": {
        downstream: [],
        backup: []
    },

    "ENLACE RF_CTO-PM": {
        downstream: [],
        affects_backup_of: ["NODO CONTAO", "NODO HORNOPIREN", "NODO PUELO", "NODO COCHAMO", "NODO ENSENADA", "NODO RALUN"]
    },

    // =============================================
    // TRAMOS DE FIBRA ÓPTICA (SILICA) - PATAGONIA VERDE
    // Estructura física: Ensenada -> Ralún -> Cochamó -> Puelo -> Contao -> Hornopirén
    // =============================================

    "FIBRA SILICA: TRAMO ENSENADA - RALUN": {
        // Cortar aquí bota: Ralún y todo lo que sigue hacia el Sur (Cochamó...)
        downstream: [
            "NODO RALUN",
            "NODO COCHAMO",
            "NODO PUELO",
            "NODO CONTAO",
            "NODO HORNOPIREN"
        ],
        backup: []
    },

    "FIBRA SILICA: TRAMO RALUN - COCHAMO": {
        // Cortar aquí bota: Cochamó y todo lo que sigue (Puelo...)
        // Ralún sigue arriba porque está antes del corte
        downstream: [
            "NODO COCHAMO",
            "NODO PUELO",
            "NODO CONTAO",
            "NODO HORNOPIREN"
        ],
        backup: []
    },

    "FIBRA SILICA: TRAMO COCHAMO - PUELO": {
        downstream: [
            "NODO PUELO",
            "NODO CONTAO",
            "NODO HORNOPIREN"
        ],
        backup: []
    },

    "FIBRA SILICA: TRAMO PUELO - CONTAO": {
        downstream: [
            "NODO CONTAO",
            "NODO HORNOPIREN"
        ],
        backup: ["ENLACE RF_CTO-PM"]
    },

    "FIBRA SILICA: TRAMO CONTAO - HORNOPIREN": {
        downstream: [
            "NODO HORNOPIREN"
        ],
        backup: []
    }
};

// Aliases para normalización de nombres
export const aliases = {
    "NODO QUENUIR": "NODO QUENUIR 2",
    "NODO RIO SUR": "NODO RIO SUR 2",
    "NODO FRESIA": "NODO FRESIA OFICINA",
    "NODO COCHAMÓ": "NODO COCHAMO",
    "NODO HORNOPIRÉN": "NODO HORNOPIREN",
    "NODO ENTRE LAGOS": "NODO ENTRE LAGOS",

    // Alias para búsqueda rápida de fibras
    "SILICA ENSENADA": "FIBRA SILICA: TRAMO ENSENADA - RALUN",
    "SILICA RALUN": "FIBRA SILICA: TRAMO RALUN - COCHAMO",
    "SILICA COCHAMO": "FIBRA SILICA: TRAMO COCHAMO - PUELO",
    "SILICA PUELO": "FIBRA SILICA: TRAMO PUELO - CONTAO",
    "SILICA CONTAO": "FIBRA SILICA: TRAMO CONTAO - HORNOPIREN"
};

/**
 * Obtiene nodos afectados (cascada).
 * Si un nodo padre cae, estos nodos también caerán.
 * @param {string} parentNode - Nombre del nodo padre
 * @param {boolean} recursive - Si buscar recursivamente
 * @returns {string[]} - Lista de nodos afectados
 */
export function getDependentNodes(parentNode, recursive = true) {
    if (!parentNode) return [];
    let key = parentNode.toUpperCase().trim();
    if (aliases[key]) key = aliases[key];

    let nodeData = topology[key];
    // Fallback búsqueda parcial
    if (!nodeData) {
        const foundKey = Object.keys(topology).find(k => k.includes(key) || key.includes(k));
        if (foundKey) nodeData = topology[foundKey];
    }

    if (!nodeData || !nodeData.downstream) return [];

    let dependents = [...nodeData.downstream];

    if (recursive) {
        nodeData.downstream.forEach(child => {
            const subDeps = getDependentNodes(child, true);
            dependents = [...dependents, ...subDeps];
        });
    }

    return [...new Set(dependents)].filter(n => n !== parentNode);
}

/**
 * Obtiene información completa del nodo (Respaldos, etc)
 */
export function getNodeInfo(nodeName) {
    let key = nodeName.toUpperCase().trim();
    if (aliases[key]) key = aliases[key];
    return topology[key] || null;
}

/**
 * Obtiene todos los nodos que serían afectados si cae el nodo dado
 * Incluye cascada completa
 */
export function getFullCascadeImpact(nodeName) {
    const affected = getDependentNodes(nodeName, true);
    return {
        directlyAffected: getDependentNodes(nodeName, false),
        totalAffected: affected,
        count: affected.length
    };
}
