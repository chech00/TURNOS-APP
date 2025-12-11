import { obtenerFeriadosMoviles } from "../utils/dateUtils.js";

export const FERIADOS_DEFAULT = [
    { fecha: "2025-01-01", nombre: "Año Nuevo (irrenunciable)" },
    { fecha: "2025-04-18", nombre: "Viernes Santo" },
    { fecha: "2025-04-19", nombre: "Sábado Santo" },
    { fecha: "2025-05-01", nombre: "Día Nacional del Trabajo (irrenunciable)" },
    { fecha: "2025-05-21", nombre: "Día de las Glorias Navales" },
    { fecha: "2025-06-20", nombre: "Día Nacional de los Pueblos Indígenas" },
    { fecha: "2025-06-29", nombre: "San Pedro y San Pablo" },
    { fecha: "2025-07-16", nombre: "Día de la Virgen del Carmen" },
    { fecha: "2025-08-15", nombre: "Asunción de la Virgen" },
    { fecha: "2025-09-18", nombre: "Independencia Nacional (irrenunciable)" },
    { fecha: "2025-09-19", nombre: "Día de las Glorias del Ejército (irrenunciable)" },
    { fecha: "2025-10-12", nombre: "Encuentro de Dos Mundos" },
    { fecha: "2025-10-31", nombre: "Día de las Iglesias Evangélicas y Protestantes" },
    { fecha: "2025-11-01", nombre: "Día de Todos los Santos" },
    { fecha: "2025-12-08", nombre: "Inmaculada Concepción" },
    { fecha: "2025-12-25", nombre: "Navidad (irrenunciable)" },
    // 2026
    { fecha: "2026-01-01", nombre: "Año Nuevo (irrenunciable)" },
    { fecha: "2026-05-01", nombre: "Día Nacional del Trabajo" },
    { fecha: "2026-05-21", nombre: "Glorias Navales" },
    { fecha: "2026-09-18", nombre: "Fiestas Patrias" },
    { fecha: "2026-09-19", nombre: "Glorias del Ejército" },
    { fecha: "2026-12-25", nombre: "Navidad" }
];

export function generarListaFeriados(year, feriadosCache = null) {
    let feriadosFijos = [];

    if (feriadosCache && Array.isArray(feriadosCache) && feriadosCache.length > 0) {
        feriadosFijos = feriadosCache;
    } else {
        feriadosFijos = FERIADOS_DEFAULT;
    }

    const feriadosMoviles = obtenerFeriadosMoviles(year);

    // Merge lists avoiding duplicates if necessary (though mobile holidays are calculated per year)
    // For simplicity return combined
    return [...feriadosFijos, ...feriadosMoviles];
}
