const CACHE = 'erp-hibrido-shell-v2';
self.addEventListener('install', (event) =>
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['/', '/index.html', '/manifest.webmanifest'])),
  ),
);
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin)
    return;
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ??
        fetch(event.request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        }),
    ),
  );
});
self.addEventListener('sync', (event) => {
  if (event.tag === 'pos-checkout-sync' || event.tag === 'sales-force-sync')
    event.waitUntil(
      self.clients
        .matchAll({ type: 'window' })
        .then((clients) =>
          clients.forEach((client) =>
            client.postMessage({
              type:
                event.tag === 'pos-checkout-sync' ? 'pos-sync-request' : 'sales-force-sync-request',
            }),
          ),
        ),
    );
});
