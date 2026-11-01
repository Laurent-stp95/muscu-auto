// Hors-ligne : tout est servi depuis le cache puis mis à jour en arrière-plan ; une nouvelle version s'affiche au lancement suivant.
importScripts('data.js');

const CACHE = 'muscu-auto';
const SHELL = ['./', 'index.html', 'app.js', 'plan.js', 'data.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png',
  'muscles/muscular_system_front.svg', 'muscles/muscular_system_back.svg'];
const files = () => [...new Set([...SHELL, ...EXOS.flatMap((e) => [...e.img,
  ...e.mus.map((m) => `muscles/main/muscle-${m}.svg`), ...e.mus2.map((m) => `muscles/secondary/muscle-${m}.svg`)])])];

self.addEventListener('install', (ev) => ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(files())).then(() => self.skipWaiting())));
self.addEventListener('activate', (ev) => ev.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (ev) => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== 'GET' || url.origin !== location.origin) return; // vidéos wger.de : réseau seulement
  ev.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(ev.request, { ignoreSearch: true });
    const fresh = fetch(ev.request).then((res) => { if (res.ok) cache.put(ev.request, res.clone()); return res; });
    if (!hit) return fresh;
    ev.waitUntil(fresh.catch(() => {}));
    return hit;
  }));
});
