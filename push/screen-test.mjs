// Relais de l'écran projeté (objet Screen de worker.js) : une TV et un iPhone simulés, sans navigateur.
// Worker en local (npx wrangler@4 dev --port 8799 depuis push/), puis : node push/screen-test.mjs http://localhost:8799
import assert from 'node:assert';

const http = process.argv[2] || 'http://localhost:8799';
const ws = http.replace(/^http/, 'ws');
setTimeout(() => { console.error('Délai dépassé'); process.exit(1); }, 20000).unref();

// Client : log garde tout, next() attend le prochain message du type demandé (2 s max).
function client(room, role) {
  const sock = new WebSocket(`${ws}/screen?room=${room}&role=${role}`);
  const log = [], inbox = [];
  sock.onmessage = (e) => { const m = e.data === 'pong' ? { type: 'pong' } : JSON.parse(e.data); log.push(m); inbox.push(m); };
  sock.log = log;
  sock.json = (m) => sock.send(JSON.stringify(m));
  sock.next = async (type, test = () => true) => {
    for (const end = Date.now() + 2000; Date.now() < end; await new Promise((r) => setTimeout(r, 20))) {
      const i = inbox.findIndex((m) => m.type === type && test(m));
      if (i >= 0) return inbox.splice(0, i + 1).pop();
    }
    throw new Error(`${role} ${room} : pas de message ${type}`);
  };
  return new Promise((ok, ko) => { sock.onopen = () => ok(sock); sock.onerror = () => ko(new Error(`${role} ${room} : connexion refusée`)); });
}
// Fermeture : le serveur doit répondre tout de suite, sinon l'iPhone attendrait pour se reconnecter.
const close = (sock) => new Promise((ok, ko) => { setTimeout(() => ko(new Error('fermeture sans réponse du serveur')), 2000); sock.onclose = ok; sock.close(); });
const presence = (tv, phone) => (m) => m.tv === tv && m.phone === phone;
const status = async (query, headers) => (await fetch(`${http}/screen?${query}`, { headers })).status;

// Requêtes refusées : salle ou rôle invalide, autre site, pas de WebSocket. Les routes des notifications ne bougent pas.
assert.strictEqual(await status('room=abc&role=tv'), 400);
assert.strictEqual(await status('room=pair-1234&role=admin'), 400);
assert.strictEqual(await status('room=pair-1234&role=tv', { Origin: 'https://exemple.com' }), 403);
assert.strictEqual(await status('room=pair-1234&role=tv', { Origin: 'http://localhost:8765' }), 426);
assert.strictEqual(await status('room=pair-1234&role=tv'), 426);
assert.strictEqual((await fetch(`${http}/status`)).status, 400);

// Appairage : l'écran attend dans pair-XXXX, l'iPhone lui donne la salle permanente.
const code = `pair-${String(Math.floor(Math.random() * 1e4)).padStart(4, '0')}`;
const room = crypto.randomUUID();
const tvPair = await client(code, 'tv');
await tvPair.next('presence', presence(1, 0));
const phonePair = await client(code, 'phone');
await phonePair.next('presence', presence(1, 1));
await tvPair.next('presence', presence(1, 1));
phonePair.json({ type: 'adopt', room });
assert.strictEqual((await tvPair.next('adopt')).room, room);
tvPair.json({ type: 'adopted' });
await phonePair.next('adopted');
await close(phonePair);
await tvPair.next('presence', presence(1, 0)); // départ de l'iPhone annoncé
await close(tvPair);

// Salle permanente neuve : rien à renvoyer, la présence arrive en premier.
const tv = await client(room, 'tv');
await tv.next('presence', presence(1, 0));
assert.strictEqual(tv.log[0].type, 'presence');
const phone = await client(room, 'phone');
await tv.next('presence', presence(1, 1));

// État relayé tel quel ; « ping » reçoit « pong ».
const s1 = { v: 1, at: Date.now(), phase: 'work', title: 'Mercredi · Bas du corps', set: { n: 1, of: 4, target: '10 rép.', load: '42,5 kg' } };
phone.json({ type: 'state', s: s1 });
assert.deepStrictEqual(await tv.next('state'), { type: 'state', s: s1 });
phone.send('ping');
await phone.next('pong');

// Un écran n'envoie pas d'état à l'iPhone (seulement « adopted »).
tv.json({ type: 'state', s: s1 });
tv.json({ type: 'adopted' });
await phone.next('adopted');
assert.ok(!phone.log.some((m) => m.type === 'state'));

// Écran qui arrive après : le dernier état tout de suite, avec son ancienneté.
const late = await client(room, 'tv');
const replay = await late.next('state');
assert.deepStrictEqual(replay.s, s1);
assert.ok(replay.age >= 0 && replay.age < 5000, `age ${replay.age}`);
await late.next('presence', presence(2, 1));

// Trop gros (> 32 Kio) ou pas du JSON : ignoré, l'écran reçoit le suivant.
phone.json({ type: 'state', s: { ...s1, title: 'x'.repeat(33000) } });
phone.send('{pas du json');
const s2 = { ...s1, at: Date.now(), phase: 'rest', rest: { end: Date.now() + 90000, total: 90000, say: 'Repos terminé.' } };
phone.json({ type: 'state', s: s2 });
assert.deepStrictEqual((await tv.next('state')).s, s2);
assert.deepStrictEqual((await late.next('state')).s, s2);

// Oubli : relayé aux écrans, le dernier état est effacé.
phone.json({ type: 'forget' });
await tv.next('forget');
await late.next('forget');
await close(late);
await tv.next('presence', presence(1, 1));
const again = await client(room, 'tv');
await again.next('presence', presence(2, 1));
assert.strictEqual(again.log[0].type, 'presence');

await Promise.all([tv, phone, again].map(close));
console.log('OK');
