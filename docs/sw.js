// Offline cache. tools/build.py stamps VERSION and ASSETS from the files in docs/, so every
// rebuild that changes anything ships a new cache and the phone picks it up on the next launch.
const VERSION = '24c7d22039';
const ASSETS = ["./", "css/app.css", "data/charging.json", "data/glycol.json", "data/kb.json", "data/pt.json", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon.svg", "index.html", "js/calcs.js", "js/dialog.js", "js/engine.js", "js/expr.js", "js/kb.js", "js/main.js", "js/measure.js", "js/search.js", "js/spoken.js", "js/tools.js", "js/voice.js", "manifest.webmanifest"];
const CACHE = `fdx-${VERSION}`;

self.addEventListener('install', (e) => {
  // fresh copies, not the browser's HTTP cache: a stale file there would mix two versions in one cache
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('fdx-') && k !== CACHE && !k.startsWith('fdx-voice')).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// The voice pack lives outside the versioned cache, so an app update doesn't download it again. Its model archive
// isn't cached here at all: the recognizer unpacks it into the phone's own storage on first load.
const VOICE = 'fdx-voice-1';
const voiceFile = (url) => url.origin === self.location.origin && /\/voice\/[^/]+$/.test(url.pathname);

// cache first: the app must open with no connection at all
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (voiceFile(url)) {
    if (url.pathname.endsWith('.tar.gz')) return;
    e.respondWith(caches.open(VOICE).then((c) => c.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }))));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
    if (res.ok && new URL(e.request.url).origin === self.location.origin) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
    }
    return res;
  }).catch(() => caches.match('./'))));
});
