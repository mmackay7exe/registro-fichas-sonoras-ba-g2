/* Service worker: guarda la app completa para usarla sin conexión.
   Cambia VERSION cada vez que publiques cambios para que los teléfonos se actualicen. */
const VERSION = 'fichas-ba-v2';
const ARCHIVOS = [
  './', 'index.html', 'ficha-sonora.html', 'ficha-actividades.html', 'guia.html',
  'manifest.webmanifest', 'data/simulado-prototipo.json',
  'assets/css/style.css',
  'assets/js/core.js', 'assets/js/ficha-comun.js', 'assets/js/home.js',
  'assets/js/sonora.js', 'assets/js/actividades.js',
  'assets/img/logo.webp', 'assets/img/icon-192.png', 'assets/img/icon-512.png',
  'assets/img/icon-maskable-512.png', 'assets/img/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Primero la copia guardada (rápido y sin conexión); en paralelo se actualiza si hay red. */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    const red = fetch(req).then(res => {
      if (res && res.ok) cache.put(req.url.split('?')[0], res.clone());
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(red); return hit; }
    const res = await red;
    if (res) return res;
    if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
    return Response.error();
  })());
});
