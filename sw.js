// Hors-ligne : tout est servi depuis le cache puis revérifié auprès du serveur en arrière-plan.
// Si l'appli a changé, la page est prévenue et propose de recharger.
importScripts('data.js');

const CACHE = 'muscu-auto';
const SHELL = ['./', 'index.html', 'app.js', 'plan.js', 'data.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png',
  'muscles/muscular_system_front.svg', 'muscles/muscular_system_back.svg'];
const CODE = /\/(index\.html|app\.js|plan\.js|data\.js)?$/; // fichiers dont un changement = nouvelle version
const files = () => [...new Set([...SHELL, ...EXOS.flatMap((e) => [...e.img,
  ...e.mus.map((m) => `muscles/main/muscle-${m}.svg`), ...e.mus2.map((m) => `muscles/secondary/muscle-${m}.svg`)])])];
const version = (res) => res.headers.get('etag') || res.headers.get('last-modified');
const notify = () => self.clients.matchAll().then((clients) => clients.forEach((c) => c.postMessage('update')));

// cache: 'reload' : sans ça, le cache HTTP du navigateur (10 min sur GitHub Pages) resservirait l'ancienne version.
self.addEventListener('install', (ev) => ev.waitUntil(caches.open(CACHE)
  .then((c) => c.addAll(files().map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', (ev) => ev.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (ev) => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== 'GET' || url.origin !== location.origin) return; // vidéos wger.de : réseau seulement
  ev.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(ev.request, { ignoreSearch: true });
    // Par l'URL : une requête de navigation ne peut pas être recopiée avec d'autres options.
    const fresh = fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' }).then(async (res) => {
      if (!res.ok) return res;
      await cache.put(ev.request, res.clone());
      if (hit && CODE.test(url.pathname) && version(hit) !== version(res)) await notify();
      return res;
    });
    if (!hit) return fresh;
    ev.waitUntil(fresh.catch(() => {}));
    return hit;
  }));
});
