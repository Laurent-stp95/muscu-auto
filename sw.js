// Hors-ligne : tout est servi depuis le cache puis revérifié auprès du serveur en arrière-plan.
// Si l'appli a changé, la page est prévenue et propose de recharger.
importScripts('common/files.js', 'data/data.js', 'common/push-config.js');

const CACHE = 'muscu-auto';
const SHELL = ['./', ...FILES.code, ...FILES.assets];
const CODE = new Set(['./', ...FILES.code].map((f) => new URL(f, location).pathname)); // fichiers dont un changement = nouvelle version
const files = () => [...new Set([...SHELL, ...EXOS.flatMap((e) => [...e.img,
  ...e.mus.map((m) => `muscles/main/muscle-${m}.svg`), ...e.mus2.map((m) => `muscles/secondary/muscle-${m}.svg`)])])];
const version = (res) => res.headers.get('etag') || res.headers.get('last-modified');
const notify = () => self.clients.matchAll().then((clients) => clients.forEach((c) => c.postMessage('update')));

// cache: 'reload' : sans ça, le cache HTTP du navigateur (10 min sur GitHub Pages) resservirait l'ancienne version.
self.addEventListener('install', (ev) => ev.waitUntil(caches.open(CACHE)
  .then((c) => c.addAll(files().map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting())));
// Ménage à chaque nouvelle version : ce qui n'est plus dans la liste sort du cache (anciens chemins d'avant le rangement en dossiers).
self.addEventListener('activate', (ev) => ev.waitUntil((async () => {
  const cache = await caches.open(CACHE), keep = new Set(files().map((f) => new URL(f, location).href));
  await Promise.all((await cache.keys()).filter((req) => !keep.has(req.url)).map((req) => cache.delete(req)));
  await self.clients.claim();
})()));
self.addEventListener('fetch', (ev) => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== 'GET' || url.origin !== location.origin) return; // vidéos wger.de : réseau seulement
  // Page TV (autre appareil, toujours en ligne) et fichiers qu'elle demande (../shared.js…) : réseau seulement,
  // pour ne jamais mélanger une ancienne et une nouvelle version.
  if (url.pathname.includes('/tv/') || ev.request.referrer.includes('/tv/')) return;
  ev.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(ev.request, { ignoreSearch: true });
    // Par l'URL : une requête de navigation ne peut pas être recopiée avec d'autres options.
    const fresh = fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' }).then(async (res) => {
      if (!res.ok) return res;
      await cache.put(ev.request, res.clone());
      if (hit && CODE.has(url.pathname) && version(hit) !== version(res)) await notify();
      return res;
    });
    if (!hit) return fresh;
    ev.waitUntil(fresh.catch(() => {}));
    return hit;
  }));
});

// Notification reçue (push sans contenu) : on demande le texte au serveur, sinon message générique.
self.addEventListener('push', (ev) => ev.waitUntil((async () => {
  let message = { title: 'Steady', body: "Ouvre l'appli." };
  try {
    const id = await (await (await caches.open('muscu-auto-push')).match('id'))?.text();
    if (id) message = await (await fetch(`${PUSH.url}/message?id=${id}`, { cache: 'no-store' })).json();
  } catch { /* hors ligne : message générique */ }
  await self.registration.showNotification(message.title, { body: message.body, tag: message.tag, icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', data: { url: message.url } });
})()));

// Toucher la notification : rouvre l'appli (ou la lance). Bilan de la semaine : directement sur Progrès.
self.addEventListener('notificationclick', (ev) => {
  ev.notification.close();
  const bilan = (ev.notification.data || {}).url === '#bilan';
  ev.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    if (!clients[0]) return self.clients.openWindow(bilan ? './#bilan' : './');
    if (bilan) clients[0].postMessage('bilan');
    return clients[0].focus();
  }));
});
