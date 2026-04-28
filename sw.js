const CACHE_NAME = 'tbos-v3-cache-v1';
const OFFLINE_URL = './offline.html';

const urlsToCache = [
    './',
    './index.html',
    './dashboard.html',
    './jobs.html',
    './staff.html',
    './inventory.html',
    './clients.html',
    './reports.html',
    './knowledge.html',
    './admin.html',
    './register.html',
    './admin-gate.html',
    './config.js',
    './app.js',
    './manifest.json',
    './offline.html',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// ✅ INSTALL - Cache all files
self.addEventListener('install', event => {
    console.log('🔧 Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('📦 Caching app files...');
            return cache.addAll(urlsToCache);
        }).then(() => {
            console.log('✅ All files cached!');
            return self.skipWaiting();
        }).catch(error => {
            console.error('❌ Cache failed:', error);
        })
    );
});

// ✅ ACTIVATE - Clean old caches
self.addEventListener('activate', event => {
    console.log('🔧 Service Worker activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(name => {
                    if (name !== CACHE_NAME) {
                        console.log('🗑️ Deleting old cache:', name);
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => {
            console.log('✅ Service Worker activated!');
            return self.clients.claim();
        })
    );
});

// ✅ FETCH - Network first, fallback to cache
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip external requests
    if (!event.request.url.startsWith(self.location.origin)) return;

    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                // Cache successful responses
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // Network failed, try cache
                return caches.match(event.request).then(cachedResponse => {
                    if (cachedResponse) {
                        console.log('📦 Serving from cache:', event.request.url);
                        return cachedResponse;
                    }
                    // Show offline page for navigation requests
                    if (event.request.mode === 'navigate') {
                        return caches.match(OFFLINE_URL);
                    }
                    return new Response('Offline', { status: 503 });
                });
            })
    );
});

// ✅ PUSH NOTIFICATIONS
self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'TBOS v3.0';
    const options = {
        body: data.body || 'New notification',
        icon: 'assets/logo-192.png',
        badge: 'assets/logo-192.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            { action: 'explore', title: 'View' },
            { action: 'close', title: 'Close' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// ✅ NOTIFICATION CLICK
self.addEventListener('notificationclick', event => {
    event.notification.close();

    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('./dashboard.html')
        );
    }
});

// ✅ BACKGROUND SYNC
self.addEventListener('sync', event => {
    if (event.tag === 'sync-data') {
        event.waitUntil(
            // Sync data when back online
            console.log('🔄 Background sync triggered')
        );
    }
});

console.log('✅ Service Worker loaded!');