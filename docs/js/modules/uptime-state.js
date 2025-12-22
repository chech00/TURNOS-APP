// Shared State Store
export const state = {
    allIncidentsCache: [],
    lastUpdateTime: null
};

export function setIncidentsCache(newCache) {
    state.allIncidentsCache = newCache;
}

export function updateLastTime() {
    state.lastUpdateTime = new Date();
    return state.lastUpdateTime;
}

export function getIncidentById(id) {
    return state.allIncidentsCache.find(i => i.id === id);
}
