// Track-Money Service Worker for 100% Offline Capability
const CACHE_NAME = 'track-money-v1';
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
  './js/views/settingsView.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => {
        console.warn('Pre-cache error (files will be cached on first load):', err);
      });
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
  // Offline-first strategy
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
          }
        }).catch(() => {/* Ignore network errors when offline */});
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      }).catch(() => {
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
