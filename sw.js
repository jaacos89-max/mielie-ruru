// Offline cache for Mielie & Ruru. Bump VERSION when files change.
// URLs are resolved from this worker's directory (GitHub Pages /mielie-ruru/), not the domain root.
const VERSION = 'mr-v9';
const BASE = new URL('./', self.location);
const FILES = [
  '', 'index.html', 'manifest.webmanifest', 'js/levels.js', 'js/gear.js', 'js/fx.js', 'js/game.js', 'js/forge.js', 'js/villains.js', 'js/power.js', 'js/minigames.js', 'js/worldmap.js',
  'assets/mielie_full.png', 'assets/ruru_full.png',
  'assets/mielie_head.png', 'assets/ruru_head.png',
  'assets/lillie_full.png', 'assets/lillie_head.png',
  'assets/queen_full.png', 'assets/queen_head.png',
  'assets/zombie_plain.png', 'assets/zombie_bucket.png', 'assets/zombie_pumpkin.png', 'assets/zombie_king.png', 'assets/zombie_king_nocrown.png',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'
].map(function (p) { return new URL(p, BASE).href; });
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(new URL('index.html', BASE).href)))
  );
});
