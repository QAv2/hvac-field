// Offline cache. tools/build.py stamps VERSION and ASSETS from the files in docs/, so every
// rebuild that changes anything ships a new cache and the phone picks it up on the next launch.
const VERSION = '1c84ddea70';
const ASSETS = ["./", "css/app.css", "data/charging.json", "data/glycol.json", "data/kb.json", "data/pt.json", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon.svg", "index.html", "js/calcs.js", "js/engine.js", "js/expr.js", "js/kb.js", "js/main.js", "js/measure.js", "js/search.js", "js/tools.js", "manifest.webmanifest"];
const CACHE = `fdx-${VERSION}`;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('fdx-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// cache first: the app must open with no connection at all
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
    if (res.ok && new URL(e.request.url).origin === self.location.origin) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
    }
    return res;
  }).catch(() => caches.match('./'))));
});
