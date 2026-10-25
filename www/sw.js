// Track-Money Service Worker for 100% Offline Capability & Hybrid App PWA
const CACHE_NAME = 'track-money-v5';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './css/index.css',
  './css/components.css',
  './css/dashboard.css',
  './css/assistant.css',
  './css/accounts.css',
  './js/app.js',
  './js/db/schema.js',
  './js/db/storage.js',
  './js/models/account.js',
  './js/models/transaction.js',
  './js/ai/nlu.js',
  './js/ai/speech.js',
  './js/ai/queries.js',
  './js/ai/assistant.js',
  './js/views/dashboardView.js',
  './js/views/accountsView.js',
  './js/views/transactionsView.js',
  './js/views/categoriesView.js',
  './js/views/recurringView.js',
  './js/views/reportsView.js',
  './js/views/assistantView.js',
  './js/views/settingsView.js',
  './js/views/cameraScanner.js',
  './js/utils/permissions.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Robust asset-by-asset caching: Even if one resource has an issue, others are preserved
      await Promise.allSettled(
        ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn(`[SW] Pre-cache skipped for ${asset}:`, err.message || err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const isNavigate = event.request.mode === 'navigate' || event.request.destination === 'document';

  event.respondWith(
    (async () => {
      // 1. Check Cache first
      const cachedResponse = await caches.match(event.request, { ignoreSearch: true });
      if (cachedResponse) {
        // Fetch in background to update cache for next time
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      // 2. Fetch from Network
      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      } catch (err) {
        // 3. Fallback for navigation (Prevents ERR_FAILED on hybrid/PWA app install)
        if (isNavigate) {
          const fallbackDoc = await caches.match('./index.html') ||
                              await caches.match('./') ||
                              await caches.match('index.html');
          if (fallbackDoc) return fallbackDoc;

          // Ultimate offline HTML response
          return new Response(
            `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Track-Money</title></head><body style="background:#08080a;color:#fcfcfc;font-family:sans-serif;text-align:center;padding:2.5rem 1rem;"><h2>Track-Money App</h2><p>Application is loading. Please reload to sync.</p><button onclick="location.reload()" style="padding:10px 22px;border-radius:8px;background:#eab308;color:#08080a;border:none;cursor:pointer;font-weight:bold;margin-top:1rem;">Reload Track-Money</button></body></html>`,
            {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            }
          );
        }

        // Generic error response instead of undefined
        return new Response('Resource offline', { status: 503, statusText: 'Offline' });
      }
    })()
  );
});
