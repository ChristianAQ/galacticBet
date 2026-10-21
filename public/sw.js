// Network-only for private data. Only a neutral offline navigation response is cached.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') event.respondWith(fetch(event.request).catch(() => new Response('<h1>Sin conexión</h1><p>Conéctate para consultar tus quinielas de GalacticBet.</p>', {headers: {'Content-Type': 'text/html; charset=utf-8'}})));
});
