// Notifications de Muscu auto : rappels de séance et fin du repos écran verrouillé (Web Push, iOS 16.4+).
// Un Durable Object par iPhone (id aléatoire tiré par l'appli) : abonnement, réglages, prochaine échéance en alarme.
// Les push partent sans contenu : le service worker de l'appli demande ensuite le message (GET /message), pas de chiffrement à gérer.
import { nextReminder } from './schedule.js';

const ORIGIN = 'https://laurent-stp95.github.io';
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));
    const id = new URL(req.url).searchParams.get('id') || '';
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
  return out;
}

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

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
    if (route === 'GET /message') return json((await this.storage.get('message')) || { title: 'Muscu auto', body: 'Ouvre l\'appli.' });
    if (route === 'POST /test') {
      await this.send({ title: 'Notifications activées', body: 'Tu recevras tes rappels de séance et la fin du repos.' });
      return json({ ok: true });
    }
    if (route === 'DELETE /subscribe') {
      await this.storage.deleteAll();
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
    if (res.status === 404 || res.status === 410) await this.storage.deleteAll();
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
