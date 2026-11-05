// Serveur de Muscu auto : notifications (rappels de séance, fin du repos écran verrouillé, Web Push iOS 16.4+)
// et sauvegarde automatique du journal.
// Un Durable Object par iPhone (id aléatoire tiré par l'appli) : abonnement, réglages, prochaine échéance en alarme.
// Les push partent sans contenu : le service worker de l'appli demande ensuite le message (GET /message), pas de chiffrement à gérer.
import { nextReminder } from './schedule.js';

const ORIGIN = 'https://laurent-stp95.github.io';
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/screen') return screen(req, env, url);
    if (req.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));
    // Code collé à la main dans Safari : iOS ajoute parfois une espace ou des majuscules.
    const id = (new URL(req.url).searchParams.get('id') || '').trim().toLowerCase();
    if (!/^[0-9a-f-]{36}$/.test(id)) return cors(new Response('id invalide', { status: 400 }));
    const stub = env.SUBSCRIBERS.get(env.SUBSCRIBERS.idFromName(id));
    return cors(await stub.fetch(req));
  },
};

function cors(res) {
  const out = new Response(res.body, res);
  out.headers.set('Access-Control-Allow-Origin', ORIGIN);
  out.headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  out.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  out.headers.set('Access-Control-Expose-Headers', 'X-Backup-Time');
  return out;
}

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

// Écran projeté (page tv/) : l'iPhone y envoie un instantané de la séance par WebSocket.
// Une salle = un objet Screen : permanente (UUID tiré par l'iPhone) ou d'appairage (pair-1234, code affiché par l'écran).
// Pas de cors() : une réponse 101 ne se recopie pas, et les WebSocket n'ont pas de requête préalable.
function screen(req, env, url) {
  const origin = req.headers.get('Origin'); // absent : client Node (test), accepté
  if (origin && origin !== ORIGIN && !/^http:\/\/(localhost(:\d+)?|127\.0\.0\.1:\d+)$/.test(origin)) return new Response('origine refusée', { status: 403 });
  const room = url.searchParams.get('room') || '', role = url.searchParams.get('role');
  if (!(/^[0-9a-f-]{36}$/.test(room) || /^pair-\d{4}$/.test(room)) || !['tv', 'phone'].includes(role)) return new Response('salle ou rôle invalide', { status: 400 });
  if ((req.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') return new Response('WebSocket attendu', { status: 426 });
  return env.SCREENS.get(env.SCREENS.idFromName(room)).fetch(req);
}

const STALE = 6 * 3600e3; // dernier état plus vieux : séance d'un autre moment, pas renvoyé à l'écran

// Hibernation : l'objet dort entre deux messages, les connexions restent ouvertes et gardent leurs étiquettes (rôle, salle).
export class Screen {
  constructor(state) {
    this.state = state;
    // Maintien de connexion : « ping » reçoit « pong » sans réveiller l'objet.
    state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(req) {
    const params = new URL(req.url).searchParams;
    const role = params.get('role'), room = params.get('room');
    const [client, server] = Object.values(new WebSocketPair());
    this.state.acceptWebSocket(server, [role, room]);
    // Écran qui arrive ou revient : il affiche tout de suite le dernier état. age = son ancienneté, pour recaler le chrono du repos.
    if (role === 'tv' && !room.startsWith('pair-')) {
      const last = await this.state.storage.get('last');
      if (last && Date.now() - last.t < STALE) server.send(JSON.stringify({ type: 'state', s: last.s, age: Date.now() - last.t }));
    }
    this.presence();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, msg) {
    if (typeof msg !== 'string' || msg.length > 32768) return; // texte JSON de 32 Kio max, le reste est ignoré
    let m;
    try { m = JSON.parse(msg); } catch { return; }
    const [role, room] = this.state.getTags(ws);
    const keep = !room.startsWith('pair-'); // seule une salle permanente garde le dernier état
    if (role === 'phone' && ['state', 'adopt', 'forget'].includes(m?.type)) {
      this.send(msg, 'tv');
      if (keep && m.type === 'state') await this.state.storage.put('last', { s: m.s, t: Date.now() });
      if (keep && m.type === 'forget') await this.state.storage.delete('last');
    } else if (role === 'tv' && m?.type === 'adopted') this.send(msg, 'phone');
  }

  webSocketClose(ws) {
    try { ws.close(); } catch { /* déjà fermée */ } // termine la fermeture demandée par le client
    this.presence(ws);
  }

  webSocketError(ws) {
    this.presence(ws);
  }

  // Connexions ouvertes d'un rôle (toutes sans rôle), sauf celle qui se ferme.
  open(tag, closing) {
    return this.state.getWebSockets(tag).filter((s) => s !== closing && s.readyState === 1);
  }

  send(msg, tag, closing) {
    for (const s of this.open(tag, closing)) s.send(msg);
  }

  // Qui est là : l'iPhone sait si l'écran affiche, l'écran signale un iPhone déconnecté.
  presence(closing) {
    this.send(JSON.stringify({ type: 'presence', tv: this.open('tv', closing).length, phone: this.open('phone', closing).length }), undefined, closing);
  }
}

export class Subscriber {
  constructor(state, env) {
    this.storage = state.storage;
    this.env = env;
  }

  async fetch(req) {
    const { pathname } = new URL(req.url);
    const route = `${req.method} ${pathname}`;
    if (route === 'POST /subscribe') {
      // { subscription, tz, reminders: { on, days, time, before, sessions: { jour: nom } }, rest: bool }
      const body = await req.json();
      if (!body.subscription?.endpoint?.startsWith('https://')) return json({ error: 'abonnement invalide' }, 400);
      await this.storage.put({ sub: body.subscription, tz: body.tz || 'Europe/Paris', reminders: body.reminders || null });
      await this.schedule();
      return json({ ok: true });
    }
    if (route === 'POST /rest') {
      // { at: fin du repos, notice: heure de « Repos en cours » (facultatif), label: heure de fin lisible, ex. 18:42:30 }
      const { at, notice, label } = await req.json();
      if (!(at > Date.now() - 5000 && at < Date.now() + 15 * 60000)) return json({ error: 'heure invalide' }, 400);
      await this.storage.put({ rest: at, restLabel: String(label || '').slice(0, 8) });
      if (notice > Date.now() - 5000 && notice < at) await this.storage.put('restNotice', notice);
      else await this.storage.delete('restNotice');
      await this.schedule();
      return json({ ok: true });
    }
    if (route === 'DELETE /rest') {
      await this.storage.delete(['rest', 'restNotice']);
      await this.schedule();
      return json({ ok: true });
    }
    if (route === 'DELETE /rest/notice') {
      // L'appli est restée à l'écran : pas besoin d'annoncer l'heure de fin.
      await this.storage.delete('restNotice');
      await this.schedule();
      return json({ ok: true });
    }
    if (route === 'GET /status') {
      // Diagnostic : abonnement présent, prochain rappel, dernier push envoyé et réponse du service push d'Apple.
      const [sub, lastReminder, lastPush] = [await this.storage.get('sub'), await this.storage.get('lastReminder'), await this.storage.get('lastPush')];
      const next = await this.nextReminder();
      const timeZone = (await this.storage.get('tz')) || 'Europe/Paris';
      const time = (t) => t && new Date(t).toLocaleString('fr-FR', { timeZone });
      return json({ subscribed: !!sub, next: next && time(next.at), lastReminder: time(lastReminder), lastPush: lastPush && { ...lastPush, t: time(lastPush.t) } });
    }
    if (route === 'GET /message') return json((await this.storage.get('message')) || { title: 'Muscu auto', body: 'Ouvre l\'appli.' });
    if (route === 'POST /test') {
      await this.send({ title: 'Notifications activées', body: 'Tu recevras tes rappels de séance et la fin du repos.' });
      return json({ ok: true });
    }
    // Sauvegarde du journal : JSON découpé en morceaux de 50 000 caractères (une valeur de Durable Object est limitée à 128 Kio).
    if (route === 'POST /backup') {
      const data = await req.text();
      if (data.length > 5e6) return json({ error: 'sauvegarde trop lourde' }, 413);
      try { JSON.parse(data); } catch { return json({ error: 'JSON invalide' }, 400); }
      const parts = Math.ceil(data.length / 5e4) || 1;
      const old = (await this.storage.get('backup'))?.parts || 0;
      const chunks = Object.fromEntries(Array.from({ length: parts }, (_, i) => [`backup:${i}`, data.slice(i * 5e4, (i + 1) * 5e4)]));
      await this.storage.put({ ...chunks, backup: { parts, t: Date.now(), size: data.length } });
      if (old > parts) await this.storage.delete(Array.from({ length: old - parts }, (_, i) => `backup:${parts + i}`));
      return json({ ok: true, t: Date.now() });
    }
    if (route === 'GET /backup') {
      const meta = await this.storage.get('backup');
      if (!meta) return json({ error: 'aucune sauvegarde' }, 404);
      const chunks = await this.storage.get(Array.from({ length: meta.parts }, (_, i) => `backup:${i}`));
      const data = Array.from({ length: meta.parts }, (_, i) => chunks.get(`backup:${i}`)).join('');
      return new Response(data, { headers: { 'Content-Type': 'application/json', 'X-Backup-Time': String(meta.t) } });
    }
    if (route === 'DELETE /backup') {
      const meta = await this.storage.get('backup');
      if (meta) await this.storage.delete(['backup', ...Array.from({ length: meta.parts }, (_, i) => `backup:${i}`)]);
      return json({ ok: true });
    }
    if (route === 'DELETE /subscribe') {
      // Notifications coupées : on oublie l'abonnement et les horaires, la sauvegarde reste.
      await this.storage.delete(['sub', 'reminders', 'tz', 'rest', 'restNotice', 'restLabel', 'message', 'lastReminder']);
      await this.storage.deleteAlarm();
      return json({ ok: true });
    }
    return json({ error: 'introuvable' }, 404);
  }

  // Une seule alarme par Durable Object : la plus proche entre l'annonce du repos, sa fin et le prochain rappel.
  async schedule() {
    const [notice, rest, reminder] = [await this.storage.get('restNotice'), await this.storage.get('rest'), await this.nextReminder()];
    const at = Math.min(notice || Infinity, rest || Infinity, reminder?.at || Infinity);
    if (at === Infinity) await this.storage.deleteAlarm();
    else await this.storage.setAlarm(at);
  }

  async nextReminder(now = Date.now()) {
    const [reminders, tz] = [await this.storage.get('reminders'), await this.storage.get('tz')];
    return reminders?.on ? nextReminder(reminders, tz, now) : null;
  }

  async alarm() {
    const now = Date.now();
    const notice = await this.storage.get('restNotice');
    if (notice && notice <= now + 1000) {
      await this.storage.delete('restNotice');
      const label = await this.storage.get('restLabel');
      await this.send({ title: 'Repos en cours', body: label ? `Reprends à ${label}.` : 'Reprends à la fin du repos.', tag: 'rest' });
    }
    const rest = await this.storage.get('rest');
    if (rest && rest <= now + 1000) {
      await this.storage.delete('rest');
      await this.send({ title: 'Repos terminé', body: 'Série suivante : reprends ta séance.', tag: 'rest' });
    }
    // Rappel dû : le prochain calculé à partir d'un instant juste avant maintenant tombe déjà.
    const reminder = await this.nextReminder(now - 60000);
    if (reminder && reminder.at <= now + 1000 && (await this.storage.get('lastReminder')) !== reminder.at) {
      await this.storage.put('lastReminder', reminder.at);
      const reminders = await this.storage.get('reminders');
      const name = reminders.sessions?.[reminder.day];
      await this.send({ title: `Séance dans ${reminders.before} min`, body: `${DAYS[reminder.day]}${name ? ` · ${name}` : ''}. Pense à t'échauffer.`, tag: 'reminder' });
    }
    await this.schedule();
  }

  // Push sans contenu signé VAPID ; 404/410 = abonnement expiré, on l'oublie.
  async send(message) {
    const sub = await this.storage.get('sub');
    if (!sub) return;
    await this.storage.put('message', message);
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: { TTL: '600', Urgency: 'high', 'Content-Length': '0', Authorization: `vapid t=${await vapidJwt(new URL(sub.endpoint).origin, this.env)}, k=${this.env.VAPID_PUBLIC}` },
    });
    await this.storage.put('lastPush', { t: Date.now(), title: message.title, status: res.status });
    if (res.status === 404 || res.status === 410) await this.storage.delete(['sub', 'reminders', 'rest', 'restNotice']);
  }
}

const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const text = (s) => new TextEncoder().encode(s);

// Jeton VAPID (RFC 8292) : JWT ES256 signé avec la clé privée (secret VAPID_PRIVATE_JWK du Worker).
async function vapidJwt(aud, env) {
  const header = b64u(text(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(text(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: `${ORIGIN}/muscu-auto/` })));
  const key = await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE_JWK), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, text(`${header}.${claims}`));
  return `${header}.${claims}.${b64u(signature)}`;
}
