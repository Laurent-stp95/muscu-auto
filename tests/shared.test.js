// Code commun avec la page TV (common/shared.js) : caméra qui compte, voix. node --test tests/
import test from 'node:test';
import assert from 'node:assert';
import * as S from '../src/common.js';

test("Caméra : angle d'articulation", () => {
  assert.strictEqual(Math.round(S.jointAngle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })), 90);
  assert.strictEqual(Math.round(S.jointAngle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 })), 180);
});

// Compteur : 30 mesures par seconde (squat : genou de 175° à 85° en 2 s, puis remontée). Une vraie répétition compte ; une
// demi-descente, un tremblement, un point qui saute ou un geste trop vif ne comptent pas.
const run = (counter, path, t0 = 0) => { const out = []; path.forEach((a, k) => { const ev = counter.push(a, t0 + k * 33); if (ev) out.push(ev); }); return out; };
const ramp = (from, to, ms) => Array.from({ length: Math.round(ms / 33) }, (_, k) => from + ((to - from) * k) / Math.round(ms / 33));
const hold = (a, ms) => ramp(a, a, ms);
const squatPath = (bottom, down = 1500, up = 1000) => [...hold(175, 400), ...ramp(175, bottom, down), ...ramp(bottom, 175, up), ...hold(175, 300)];
const knee = () => S.repCounter(S.COUNTER.knee);

test('Compteur tolérant : une répétition imparfaite (vive, pas assez basse) compte, marquée full: false', () => {
  const evs = run(knee(), [...squatPath(90), ...squatPath(95), ...squatPath(110, 400, 400), ...squatPath(125)]);
  assert.deepStrictEqual(evs.map((e) => [e.rep, e.full]), [[1, true], [2, true], [3, false], [4, false]]);
  assert.ok(evs[0].down >= 1100); // descente mesurée depuis la sortie de la position haute
  assert.ok(evs[2].down < 1000); // la 3e, trop vive : comptée, signalée
});

test('Compteur : quart de squat signalé, pas compté', () => {
  const evs = run(knee(), squatPath(137)); // quart de squat : signalé, pas compté
  assert.deepStrictEqual(evs.map((e) => [e.partial, e.rep]), [[true, undefined]]);
});

test('Compteur : plongeon de 0,3 s = bruit', () => {
  const evs = run(knee(), [...hold(175, 500), ...ramp(175, 110, 150), ...ramp(110, 175, 150), ...hold(175, 500)]); // plongeon de 0,3 s : bruit
  assert.strictEqual(evs.length, 0);
});

test('Compteur : développé au sol, coudes arrêtés par le sol à 100°, complet', () => {
  const evs = run(S.repCounter(S.counterFor('elbow', 1084)), [...hold(170, 400), ...ramp(170, 100, 1200), ...ramp(100, 170, 800), ...hold(170, 300)]);
  assert.deepStrictEqual(evs.map((e) => [e.rep, e.full]), [[1, true]]); // développé au sol : coudes arrêtés par le sol à 100°, complet
});

test('Compteur : petits mouvements autour du haut', () => {
  const evs = run(knee(), [...hold(175, 500), ...Array.from({ length: 120 }, (_, k) => 160 + (k % 6) * 3)]); // petits mouvements autour du haut
  assert.strictEqual(evs.length, 0);
});

test('Compteur : points qui sautent', () => {
  const evs = run(knee(), [...hold(175, 500), 175, 80, 175, 175, 80, 175, ...hold(175, 500)]); // points qui sautent
  assert.strictEqual(evs.length, 0);
});

test("Compteur : la personne sort de l'image en bas", () => {
  const kc = knee(); run(kc, [...hold(175, 400), ...ramp(175, 90, 1500)]); kc.reset(); // la personne sort de l'image en bas
  assert.strictEqual(run(kc, [...ramp(90, 175, 800), ...hold(175, 300)], 5000).length, 0);
});

// Suivi : corps de profil dont le genou fait l'angle voulu ; pieds fixes. Quelqu'un qui passe ou qui marche ne fait rien compter.
const body = (deg, dx = 0) => {
  const p = Array.from({ length: 33 }, () => ({ x: 0.5 + dx, y: 0.5, visibility: 1 }));
  const kneeAt = { x: 0.5 + dx, y: 0.7 }, r = (deg * Math.PI) / 180;
  const hip = { x: kneeAt.x + 0.2 * Math.sin(r), y: kneeAt.y + 0.2 * Math.cos(r) };
  [[23, hip], [24, hip], [25, kneeAt], [26, kneeAt], [27, { x: 0.5 + dx, y: 0.9 }], [28, { x: 0.5 + dx, y: 0.9 }],
    [11, { x: hip.x, y: hip.y - 0.25 }], [12, { x: hip.x, y: hip.y - 0.25 }], [0, { x: hip.x, y: hip.y - 0.33 }]].forEach(([k, q]) => Object.assign(p[k], q));
  return p;
};
const scaled = (p, s, dy = 0) => p.map((q) => ({ ...q, y: 0.9 + (q.y - 0.9) * s + dy, x: 0.5 + (q.x - 0.5) * s }));
const handsUp = (p) => { [15, 16].forEach((k) => Object.assign(p[k], { x: p[11].x, y: p[11].y - 0.02 })); return p; };
const track = (angles, extra = () => []) => { const tracker = S.poseTracker('knee'); const out = []; angles.forEach((a, k) => { const r = tracker.update([body(a), ...extra(k)], k * 33, false, 1); if (r.ev && r.ev.rep) out.push(r.ev.rep); }); return { out }; };
const two = [...squatPath(90), ...squatPath(90)];
const count = (tracker, frames) => frames.filter((p, k) => { const r = tracker.update([p], k * 33, false, 1); return r.ev && r.ev.rep; }).length;

test('Suivi : deux répétitions, seul ou avec une autre personne immobile à côté', () => {
  assert.deepStrictEqual(track(two).out, [1, 2]);
  assert.deepStrictEqual(track(two, (k) => [body(175, 0.3)]).out, [1, 2]); // une autre personne immobile à côté : on te suit toi
});

test("Suivi : la 1re répétition, coupée par quelqu'un qui passe devant, n'est pas comptée", () => {
  const passing = S.poseTracker('knee'); let counted = 0;
  two.forEach((a, k) => { const others = k > 40 && k < 70; const r = passing.update(others ? [body(100, 0.35)] : [body(a)], k * 33, false, 1); if (r.ev && r.ev.rep) counted++; if (others && k === 41) assert.strictEqual(r.state, 'switch'); });
  assert.strictEqual(counted, 1); // la 1re répétition, coupée par quelqu'un qui passe devant, n'est pas comptée
});

test('Suivi : rien en marchant', () => {
  const walker = S.poseTracker('knee'); let walked = 0;
  two.forEach((a, k) => { const r = walker.update([body(a, (k % 60) * 0.006)], k * 33, false, 1); if (r.ev && r.ev.rep) walked++; });
  assert.strictEqual(walked, 0); // en marchant
});

test("Suivi : tout près (pieds hors de l'image) ou en s'approchant, rien n'est compté", () => {
  assert.strictEqual(count(S.poseTracker('knee'), two.map((a) => scaled(body(a), 1.5, 0.12))), 0); // tout près : pieds hors de l'image
  assert.strictEqual(count(S.poseTracker('knee'), two.map((a, k) => scaled(body(a), k > 20 && k < 50 ? 0.6 + (0.4 * (k - 20)) / 30 : k <= 20 ? 0.6 : 1))), 1); // s'approche pendant la 1re : seule la 2e compte
});

test('Suivi : bruit du suivi (chevilles qui tremblent de ±6 %, buste qui raccourcit de 40 % penché en avant), tout compte', () => {
  let seed = 1; const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.12;
  const shaky = (p) => { [27, 28].forEach((k) => { p[k].x += noise(); p[k].y += noise() / 3; }); return p; };
  const lean = (p, a) => { const f = 1 - (0.4 * (175 - a)) / 85; [11, 12, 0].forEach((k) => { p[k].y = p[23].y - (p[23].y - p[k].y) * f; }); p[11].x -= 0.1; p[12].x += 0.1; return p; }; // de face : épaules écartées
  assert.strictEqual(count(S.poseTracker('knee'), two.map((a) => shaky(body(a)))), 2);
  assert.strictEqual(count(S.poseTracker('knee'), two.map((a) => lean(body(a), a))), 2);
  const blip = two.map((a, k) => (k === 70 || k === 71 ? scaled(body(a), 1.5, 0.12) : body(a))); // 2 images ratées en pleine descente
  assert.strictEqual(count(S.poseTracker('knee'), blip), 2);
});

test('Suivi : squat Smith, mains en bas non compté, mains sur la barre compté', () => {
  assert.strictEqual(count(S.poseTracker('knee', 1747), two.map((a) => body(a))), 0); // squat Smith, mains en bas (accroupi vers l'iPhone)
  assert.strictEqual(count(S.poseTracker('knee', 1747), two.map((a) => handsUp(body(a)))), 2); // mains sur la barre : compté
});

// Voix : Premium avant Améliorée avant de base, France avant Canada, voix gadget en dernier ; voix choisie si présente.
const fakeSynth = (list) => ({ getVoices: () => list.map(([name, lang, uri]) => ({ name, lang, voiceURI: uri || name })) });
const synth = fakeSynth([['Jacques', 'fr-FR'], ['Amélie', 'fr-CA'], ['Thomas', 'fr-FR'], ['Samantha', 'en-US'],
  ['Amélie', 'fr-CA', 'com.apple.voice.premium.fr-CA.Amelie'], ['Thomas', 'fr-FR', 'com.apple.voice.enhanced.fr-FR.Thomas']]);

test('Voix : Premium avant Améliorée avant de base, France avant Canada, voix gadget en dernier', () => {
  assert.strictEqual(S.frenchVoice(synth).voiceURI, 'com.apple.voice.premium.fr-CA.Amelie');
  assert.strictEqual(S.frenchVoice(fakeSynth([['Jacques', 'fr-FR'], ['Amélie', 'fr-CA'], ['Thomas', 'fr-FR']])).name, 'Thomas');
  assert.strictEqual(S.frenchVoice(fakeSynth([['Grand-mère', 'fr-FR'], ['Google français', 'fr-FR'], ['Microsoft Denise Online (Natural) - French (France)', 'fr-FR']])).name.slice(0, 15), 'Microsoft Denis');
});

test('Voix choisie si présente, sinon la meilleure ; aucune voix française : null', () => {
  assert.strictEqual(S.frenchVoice(synth, 'Jacques').name, 'Jacques');
  assert.strictEqual(S.frenchVoice(synth, 'Absente').voiceURI, 'com.apple.voice.premium.fr-CA.Amelie');
  assert.strictEqual(S.frenchVoice(fakeSynth([['Samantha', 'en-US']])), null);
});
