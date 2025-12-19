// Mapa de dependencias de nodos - TOPOLOGÍA OFICIAL
// Fuente: antigravity_kml_uptime_bundle/output/impacto_dependencias_kml.json

const topology = {
    // =============================================
    // NODOS CORE / ROOTS
    // =============================================

    "NODO DATA CENTER PM": {
        downstream: ["NODO LENCA"],
        backup: []
    },

    "NODO DATA CENTER PV": {
        downstream: [],
        backup: []
    },

    // =============================================
    // ZONA ALERCE / CORRENTOSO
    // =============================================

    "NODO ALERCE 3": {
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
        downstream: [],
        backup: ["NODO ALERCE 3"]
    },

    "NODO CORRENTOSO": {
        downstream: [],
        backup: []
    },

    // =============================================
    // CADENA PATAGONIA VERDE (hacia el Sur)
    // =============================================

    "NODO RIO SUR 2": {
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
        downstream: [],
        backup: []
    },

    "NODO COCHAMO": {
        downstream: [],
        backup: []
    },

    "NODO PUELO": {
        downstream: [],
        backup: []
    },

    "NODO CONTAO": {
        downstream: [],
        backup: ["ENLACE RF_CTO-PM"]
    },

    "NODO HORNOPIREN": {
        downstream: [],
        backup: []
    },

    // =============================================
    // ZONA FRUTILLAR / OSORNO
    // =============================================

    "NODO FRUTILLAR": {
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
        downstream: [],
        backup: ["NODO FRUTILLAR"]
    },

    "NODO CASMA": {
        downstream: [],
        backup: []
    },

    "NODO QUILANTO": {
        downstream: [
            "NODO NOCHACO",
            "NODO CASCADAS",
            "NODO RADALES",
            "NODO OSORNO"
        ],
        backup: []
    },

    "NODO NOCHACO": {
        downstream: [
            "NODO CASCADAS",
            "NODO RADALES",
            "NODO OSORNO"
        ],
        backup: []
    },

    "NODO CASCADAS": {
        downstream: [],
        backup: []
    },

    "NODO RADALES": {
        downstream: [],
        backup: []
    },

    "NODO OSORNO": {
        downstream: [],
        backup: []
    },

    // =============================================
    // ZONA LAS QUEMAS / FRESIA / LOS MUERMOS
    // =============================================

    "NODO LAS QUEMAS 2": {
        downstream: [
            "NODO PANITAO",
            "NODO LOS MUERMOS",
            "NODO QUENUIR 2"
        ],
        backup: []
    },

    "NODO PANITAO": {
        downstream: [],
        backup: []
    },

    "NODO NUEVA BRAUNAU": {
        downstream: ["NODO FRESIA OFICINA"],
        backup: []
    },

    "NODO FRESIA OFICINA": {
        downstream: [],
        backup: []
    },

    "NODO LOS MUERMOS": {
        downstream: ["NODO QUENUIR 2"],
        backup: []
    },

    "NODO QUENUIR 2": {
        downstream: [],
        backup: []
    },

    // =============================================
    // OTROS NODOS
    // =============================================

    "NODO LENCA": {
        downstream: [],
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
    // TRAMOS DE FIBRA ÓPTICA (SILICA)
    // =============================================

    "FIBRA SILICA: TRAMO ENSENADA - RALUN": {
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

const aliases = {
    "NODO QUENUIR": "NODO QUENUIR 2",
    "NODO RIO SUR": "NODO RIO SUR 2",
    "NODO FRESIA": "NODO FRESIA OFICINA",
    "NODO COCHAMÓ": "NODO COCHAMO",
    "NODO HORNOPIRÉN": "NODO HORNOPIREN",
    "NODO ENTRE LAGOS": "NODO ENTRE LAGOS",
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
function getDependentNodes(parentNode, recursive = true) {
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

const deviceMap = {
    // 1. REGLAS POR PREFIJO DE IP (SUBNETS / ZONAS) - LA OPCIÓN "INTELIGENTE" 🧠
    // Si la IP empieza con... -> Pertenece a este Nodo.

    "192.168.1.": { node: "NODO ALERCE 3" },      // Producción (Test Lab)
    "10.50.20.": { node: "NODO RIO SUR" },       // Ejemplo rango Rio Sur

    // 2. EXCEPCIONES ESPECÍFICAS (Si se requiere)
    // "192.168.1.99": { node: "OTRO NODO" }
};

/**
 * Encuentra el dueño de una IP buscando por prefijo
 */
function findNodeByIp(ip) {
    if (!ip) return null;

    // 1. Busqueda Exacta
    if (deviceMap[ip]) return deviceMap[ip];

    // 2. Busqueda por Prefijo (Subnet)
    // Buscamos las llaves que coincidan con el inicio de la IP
    const key = Object.keys(deviceMap).find(prefix => ip.startsWith(prefix));

    return key ? deviceMap[key] : null;
}

module.exports = {
    topology,
    aliases,
    deviceMap,
    findNodeByIp,
    getDependentNodes
};
