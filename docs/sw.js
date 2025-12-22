// =============================================================================
// SERVICE WORKER - Turnos NOC
// Cache-first strategy para archivos estáticos, Network-first para API
// =============================================================================

const CACHE_NAME = 'turnos-noc-v6';
const STATIC_CACHE = 'static-v6';
const DYNAMIC_CACHE = 'dynamic-v6';

// Archivos a cachear inmediatamente
const STATIC_ASSETS = [
    './',
    './directorio.html',
    './login.html',
    './noc.html',
    './css/styles.css',
    './css/critical.css',
    './css/noc.css',
    './css/directorio.css',
    './css/login.css',
    './js/logger.js',
    './js/firebase.js',
    './img/favicon.svg',
    './manifest.json'
];

// Instalar - cachear archivos estáticos
self.addEventListener('install', event => {
    console.log('[SW] Instalando Service Worker...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('[SW] Cacheando archivos estáticos...');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
            .catch(err => console.log('[SW] Error en cache:', err))
    );
});

// Activar - limpiar caches antiguos
self.addEventListener('activate', event => {
    console.log('[SW] Activando Service Worker...');
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
                    .map(key => {
                        console.log('[SW] Eliminando cache antiguo:', key);
                        return caches.delete(key);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch - estrategia de cache
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    // Ignorar requests a Firebase Auth (problemas de CORS)
    if (url.hostname.includes('firebase') ||
        url.hostname.includes('googleapis') ||
        url.hostname.includes('gstatic')) {
        return;
    }

    // API calls: Network first, fallback to cache
    if (url.pathname.startsWith('/api/') ||
        url.pathname.startsWith('/uptime/') ||
        url.pathname.startsWith('/ping-devices') ||
        url.pathname.startsWith('/dude-config') ||
        url.hostname.includes('onrender.com')) {
        event.respondWith(networkFirst(request));
        return;
    }

    // Archivos estáticos: Cache first, fallback to network
    event.respondWith(cacheFirst(request));
});

// Estrategia: Cache primero
async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        // Actualizar cache en segundo plano
        fetchAndCache(request);
        return cachedResponse;
    }
    return fetchAndCache(request);
}

// Estrategia: Network primero
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        // Offline fallback para HTML
        if (request.headers.get('accept').includes('text/html')) {
            return caches.match('./directorio.html');
        }
        throw error;
    }
}

// Fetch y cachear
async function fetchAndCache(request) {
    try {
        const response = await fetch(request);
        if (response.ok && request.method === 'GET') {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        console.log('[SW] Fetch failed:', request.url);
        throw error;
    }
}

// Mensaje del SW
self.addEventListener('message', event => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
