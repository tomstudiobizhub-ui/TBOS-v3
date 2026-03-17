const CACHE_NAME = 'tomstudio-biz-hub-v3';
const urlsToCache = [
    './index.html',
    './admin2.html',
    './manifest.json',
    './logo-192.png',
    './logo-512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(names => Promise.all(
            names.map(name => name !== CACHE_NAME ? caches.delete(name) : null)
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    
    event.respondWith(
        caches.match(event.request).then(response => 
            response || fetch(event.request).then(networkResponse => {
                if (networkResponse.status === 200) {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return networkResponse;
            })
        )
    );
});