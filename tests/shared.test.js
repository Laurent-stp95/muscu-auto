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

// --- Hanche et épaule ---
import { EXOS } from '../src/common.js';

test('Caméra : chaque exercice a sa décision (articulation suivie, ou pas de comptage avec la raison), genou et coude inchangés', () => {
  const counted = Object.values(S.CAM_EX).flat();
  assert.strictEqual(new Set(counted).size, counted.length); // une seule articulation par exercice
  for (const e of EXOS) {
    assert.ok(counted.includes(e.id) !== (e.id in S.CAM_OFF), `${e.id} ${e.name} : à décider (CAM_EX ou CAM_OFF, common/shared.js)`);
    if (e.unit === 's' || ['abs', 'calves'].includes(e.zone)) assert.strictEqual(S.camKind(e.id), null, e.name); // gainage, sol, amplitude infime
  }
  for (const id of [...counted, ...Object.keys(S.CAM_OFF).map(Number)]) assert.ok(EXOS.some((e) => e.id === id), `${id} n'existe pas`);
  // Avant la hanche et l'épaule : genou pour les quadriceps, coude pour les pectoraux et les épaules, sauf 6 exercices.
  const before = (e) => ([206, 238, 348, 828, 571, 572].includes(e.id) ? null : e.zone === 'quad' ? 'knee' : ['chest', 'shoulders'].includes(e.zone) ? 'elbow' : null);
  for (const e of EXOS) if (before(e)) assert.strictEqual(S.camKind(e.id), before(e), e.name);
  const name = (kind) => EXOS.filter((e) => S.camKind(e.id) === kind).map((e) => e.name);
  assert.deepStrictEqual(name('hip'), ['Soulevé de terre roumain à la Smith', 'Soulevé de terre roumain aux haltères', 'Soulevé de terre sumo à la kettlebell', 'Kettlebell swing']);
  assert.deepStrictEqual(name('shoulder'), ['Élévations latérales']);
  for (const id of [1642, 265, 1736, 206, 458]) assert.strictEqual(S.camKind(id), null); // hip thrust, pont fessier, sur une jambe, fentes marchées, planche
  assert.strictEqual(S.camKind(-1), null);
  for (const kind of Object.keys(S.CAM_EX)) {
    const c = S.COUNTER[kind], order = [c.top, c.start, c.count, c.deep];
    assert.ok(S.JOINTS[kind].length === 2 && S.JOINTS[kind].every((j) => j.length === 3) && S.CAM_TEXT[kind].fast, kind);
    assert.deepStrictEqual(order, order.slice().sort((a, b) => (c.dir === 'up' ? a - b : b - a)), `${kind} : seuils dans l'ordre du geste`);
  }
});

// Hanche (épaule-hanche-genou), soulevé de terre roumain de profil : debout 172°, buste presque à l'horizontale 100°.
const hinge = (bottom, down = 1500, up = 1000) => [...hold(172, 400), ...ramp(172, bottom, down), ...ramp(bottom, 172, up), ...hold(172, 300)];
const hipCounter = (id) => S.repCounter(S.counterFor('hip', id));

test('Hanche : soulevé de terre compté, descente mesurée ; amplitude courte comptée et signalée ; simple inclinaison ignorée', () => {
  const evs = run(hipCounter(1652), [...hinge(100), ...hinge(118), ...hinge(130), ...hinge(100, 400, 600)]);
  assert.deepStrictEqual(evs.map((e) => [e.rep, e.full]), [[1, true], [2, true], [3, false], [4, true]]);
  assert.ok(evs[0].depth >= 99 && evs[0].depth <= 103 && evs[0].down >= 1100 && evs[0].down <= 1600, JSON.stringify(evs[0]));
  assert.ok(evs[3].down < 600);
  assert.deepStrictEqual(run(hipCounter(1652), hinge(140)).map((e) => [e.partial, e.rep]), [[true, undefined]]); // à peine penché : signalé, pas compté
  assert.strictEqual(run(hipCounter(1652), hinge(150)).length, 0); // salut, regard vers les pieds : rien
  assert.strictEqual(run(hipCounter(1652), [...hold(172, 500), ...ramp(172, 110, 150), ...ramp(110, 172, 150), ...hold(172, 500)]).length, 0); // 0,3 s : bruit
  assert.strictEqual(run(hipCounter(1652), [...hold(172, 500), ...Array.from({ length: 150 }, (_, k) => 160 + ((k * 7) % 15))]).length, 0); // bruit du suivi debout
  assert.strictEqual(run(hipCounter(1652), [...hold(172, 500), 172, 60, 172, 172, 70, 172, ...hold(172, 500)]).length, 0); // points qui sautent
  // S'asseoir sur le banc et y rester (plus de 8 s penché) : rien, même en se relevant.
  assert.strictEqual(run(hipCounter(1652), [...hold(172, 500), ...ramp(172, 95, 800), ...hold(95, 9000), ...ramp(95, 172, 800), ...hold(172, 500)]).length, 0);
});

test('Hanche : kettlebell swing, répétitions vives comptées', () => {
  const swing = [...hold(172, 400), ...Array.from({ length: 5 }, () => [...ramp(172, 105, 500), ...ramp(105, 172, 450), ...hold(172, 250)]).flat()];
  assert.deepStrictEqual(run(hipCounter(960), swing).map((e) => e.rep), [1, 2, 3, 4, 5]);
  assert.strictEqual(S.counterFor('hip', 960).fast, 0); // geste lancé : pas de remarque sur le tempo
});

// Épaule (hanche-épaule-coude), élévation latérale de face : bras le long du corps 15°, à l'horizontale 90°. L'angle AUGMENTE.
const raise = (peak, up = 1000, down = 1500) => [...hold(15, 400), ...ramp(15, peak, up), ...ramp(peak, 15, down), ...hold(15, 300)];
const shoulder = () => S.repCounter(S.COUNTER.shoulder);

test("Épaule : l'élévation se compte à la montée (angle qui augmente), l'excentrique mesurée est la redescente des bras", () => {
  const evs = run(shoulder(), [...raise(90), ...raise(92, 800, 2000), ...raise(70), ...raise(90, 1000, 300)]);
  assert.deepStrictEqual(evs.map((e) => [e.rep, e.full]), [[1, true], [2, true], [3, false], [4, true]]);
  assert.ok(evs[0].depth >= 88 && evs[0].depth <= 90, `point haut ${evs[0].depth}°`); // depth = angle le plus ouvert
  assert.ok(evs[0].down >= 1000 && evs[0].down <= 1500, `redescente ${evs[0].down} ms`); // de 90° au retour sous 35° : environ 1,1 s
  assert.ok(evs[1].down > evs[0].down);
  assert.ok(evs[3].down < 400, `redescente lâchée ${evs[3].down} ms`); // montée lente mais bras lâchés : c'est bien la redescente qui est mesurée
  assert.strictEqual(evs[2].depth >= 68 && evs[2].depth <= 70, true);
});

test('Épaule : faux positifs (bras qui se balancent, geste esquissé, bruit, points qui sautent, geste éclair)', () => {
  assert.deepStrictEqual(run(shoulder(), raise(52)).map((e) => [e.partial, e.rep]), [[true, undefined]]); // à mi-hauteur : signalé, pas compté
  assert.strictEqual(run(shoulder(), raise(42)).length, 0); // bras à peine décollés
  const swing = Array.from({ length: 300 }, (_, k) => 20 + 22 * Math.sin((k * 33 * 2 * Math.PI) / 1000)); // marche : ±22° chaque seconde
  assert.strictEqual(run(shoulder(), [...hold(15, 400), ...swing]).filter((e) => e.rep).length, 0);
  assert.strictEqual(run(shoulder(), [...hold(15, 500), ...Array.from({ length: 150 }, (_, k) => 12 + ((k * 7) % 25))]).length, 0); // tremblement entre 12° et 36°
  assert.strictEqual(run(shoulder(), [...hold(15, 500), 15, 120, 15, 15, 130, 15, ...hold(15, 500)]).length, 0);
  assert.strictEqual(run(shoulder(), [...hold(15, 500), ...ramp(15, 95, 120), ...ramp(95, 15, 120), ...hold(15, 500)]).length, 0); // 0,24 s
  // Bras levés depuis le début (étirement, mains sur la tête) puis baissés : pas parti de la position de départ.
  assert.strictEqual(run(shoulder(), [...hold(150, 2000), ...ramp(150, 15, 800), ...hold(15, 500)]).length, 0);
  // Genou et coude : un angle qui s'ouvre ne compte toujours rien.
  assert.strictEqual(run(knee(), [...hold(100, 500), ...ramp(100, 175, 800), ...ramp(175, 100, 800), ...hold(100, 500)]).length, 0);
});

test('Tempo : rappel après deux répétitions trop rapides de suite, puis silence 3 répétitions ; jamais pour une seule', () => {
  const coach = (ms, downs) => { const c = S.tempoCoach(ms); return downs.map((down, k) => { const r = c.push({ rep: k + 1, down }); return r ? (r.first ? 'F' : 'f') : '.'; }).join(''); };
  assert.strictEqual(coach(1000, [1500, 600, 1400, 700, 1600, 1500]), '......'); // une rapide de temps en temps : rien
  assert.strictEqual(coach(1000, [1500, 600, 500, 1500]), '..F.');
  assert.strictEqual(coach(1000, [400, 400, 400, 400, 400, 400, 400, 400]), '.F...f..'); // pas à chaque répétition
  assert.strictEqual(coach(1000, [400, 400, 1500, 1500, 1500, 400, 400]), '.F....f');
  assert.strictEqual(coach(1000, [999, 1000, 999]), '...'); // au seuil : ce n'est pas trop rapide
  assert.strictEqual(coach(0, [100, 100, 100, 100]), '....'); // kettlebell swing : aucun rappel
  const c = S.tempoCoach(1000);
  assert.strictEqual(c.push({ partial: true, depth: 140 }), null); // un geste non compté ne dit rien
  assert.strictEqual(c.push(null), null);
  // De bout en bout : 4 élévations aux bras lâchés (redescente 0,3 s), seuil épaule 800 ms.
  const t = S.tempoCoach(S.COUNTER.shoulder.fast);
  const told = run(shoulder(), [...raise(90, 900, 300), ...raise(90, 900, 300), ...raise(90, 900, 300), ...raise(90, 900, 300)]).map((ev) => !!t.push(ev));
  assert.deepStrictEqual(told, [false, true, false, false]);
  const slow = S.tempoCoach(S.COUNTER.shoulder.fast);
  assert.ok(run(shoulder(), [...raise(90), ...raise(90), ...raise(90)]).every((ev) => !slow.push(ev))); // redescente contrôlée : rien
});

// Suivi, hanche : corps de profil, jambes fixes, le buste pivote autour de la hanche (angle épaule-hanche-genou voulu).
const sideBody = (deg, dx = 0) => {
  const p = Array.from({ length: 33 }, () => ({ x: 0.5 + dx, y: 0.5, visibility: 1 }));
  const hip = { x: 0.5 + dx, y: 0.55 }, r = (deg * Math.PI) / 180, sh = { x: hip.x + 0.25 * Math.sin(r), y: hip.y + 0.25 * Math.cos(r) };
  [[23, hip], [24, hip], [25, { x: hip.x, y: 0.75 }], [26, { x: hip.x, y: 0.75 }], [27, { x: hip.x, y: 0.93 }], [28, { x: hip.x, y: 0.93 }],
    [11, sh], [12, sh], [0, { x: hip.x + 0.32 * Math.sin(r), y: hip.y + 0.32 * Math.cos(r) }]].forEach(([k, q]) => Object.assign(p[k], q));
  return p;
};
const twoHinges = [...hinge(100), ...hinge(100)];
const states = (tracker, frames) => { const seen = new Set(); let n = 0; frames.forEach((p, k) => { const r = tracker.update(p ? [p] : [], k * 33, false, 1); seen.add(r.state); if (r.ev && r.ev.rep) n++; }); return { n, seen: [...seen] }; };

test('Suivi, hanche : deux soulevés de terre comptés de profil ; rien en marchant, genoux ou tête hors image, personne absente', () => {
  const tracker = S.poseTracker('hip', 1652), first = tracker.update([sideBody(172)], 0, false, 1);
  assert.deepStrictEqual(first.side, [11, 23, 25]); // les 3 points de l'angle suivi, pour le squelette
  assert.strictEqual(states(S.poseTracker('hip', 1652), twoHinges.map((a) => sideBody(a))).n, 2);
  assert.strictEqual(states(S.poseTracker('hip', 1652), twoHinges.map((a, k) => sideBody(a, (k % 60) * 0.006))).n, 0); // en marchant
  // Trop près : les genoux sortent en bas de l'image (les pieds, eux, peuvent être coupés).
  const cut = (p, dy) => p.map((q) => ({ ...q, y: q.y + dy }));
  assert.strictEqual(states(S.poseTracker('hip', 1652), twoHinges.map((a) => cut(sideBody(a), 0.05))).n, 2); // pieds coupés : compté
  const close = states(S.poseTracker('hip', 1652), twoHinges.map((a) => cut(sideBody(a), 0.26)));
  assert.deepStrictEqual([close.n, close.seen], [0, ['partial']]);
  const hidden = states(S.poseTracker('hip', 1652), twoHinges.map((a) => { const p = sideBody(a); [23, 24].forEach((k) => { p[k].visibility = 0.2; }); return p; })); // hanche cachée (disques, banc)
  assert.strictEqual(hidden.n, 0);
  assert.strictEqual(states(S.poseTracker('hip', 1652), twoHinges.map(() => null)).n, 0);
  // Repos en cours : rien n'est compté.
  let rested = 0; const paused = S.poseTracker('hip', 1652);
  twoHinges.forEach((a, k) => { const r = paused.update([sideBody(a)], k * 33, true, 1); if (r.ev && r.ev.rep) rested++; });
  assert.strictEqual(rested, 0);
});

// Suivi, épaule : corps de face, les bras s'écartent du buste de l'angle voulu (gauche, droite).
const frontBody = (left, right = left) => {
  const p = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
  const arm = (sh, deg, dir) => ({ x: sh.x + dir * 0.14 * Math.sin((deg * Math.PI) / 180), y: sh.y + 0.14 * Math.cos((deg * Math.PI) / 180) });
  const L = { x: 0.6, y: 0.3 }, R = { x: 0.4, y: 0.3 };
  [[11, L], [12, R], [23, { x: 0.6, y: 0.62 }], [24, { x: 0.4, y: 0.62 }], [13, arm(L, left, 1)], [14, arm(R, right, -1)],
    [0, { x: 0.5, y: 0.18 }], [27, { x: 0.57, y: 0.95 }], [28, { x: 0.43, y: 0.95 }]].forEach(([k, q]) => Object.assign(p[k], q));
  return p;
};
const twoRaises = [...raise(90), ...raise(90)];

test("Suivi, épaule : deux élévations comptées de face ; un seul bras levé, coudes hors image ou hanches coupées, rien", () => {
  assert.strictEqual(states(S.poseTracker('shoulder', 348), twoRaises.map((a) => frontBody(a))).n, 2);
  assert.strictEqual(states(S.poseTracker('shoulder', 348), twoRaises.map((a) => frontBody(a, 15))).n, 0); // se gratter la tête, attraper quelque chose
  assert.strictEqual(states(S.poseTracker('shoulder', 348), twoRaises.map((a) => frontBody(15, a))).n, 0);
  // Un bras caché (de trois quarts) : l'autre suffit.
  assert.strictEqual(states(S.poseTracker('shoulder', 348), twoRaises.map((a) => { const p = frontBody(a); [12, 14, 24].forEach((k) => { p[k].visibility = 0.2; }); p[12].visibility = 1; p[24].visibility = 1; return p; })).n, 2);
  // Trop près : les coudes sortent de l'image en montant → la répétition en cours est abandonnée.
  const wide = (p) => p.map((q) => ({ ...q, x: 0.5 + (q.x - 0.5) * 2.1 }));
  assert.strictEqual(states(S.poseTracker('shoulder', 348), twoRaises.map((a) => wide(frontBody(a)))).n, 0);
  const low = states(S.poseTracker('shoulder', 348), twoRaises.map((a) => frontBody(a).map((q) => ({ ...q, y: q.y + 0.4 })))); // hanches sous l'image
  assert.deepStrictEqual([low.n, low.seen], [0, ['partial']]);
  // Quelqu'un passe devant pendant la 1re : seule la 2e compte.
  const passing = S.poseTracker('shoulder', 348); let counted = 0;
  twoRaises.forEach((a, k) => { const r = passing.update(k > 30 && k < 60 ? [frontBody(40).map((q) => ({ ...q, x: q.x + 0.3 }))] : [frontBody(a)], k * 33, false, 1); if (r.ev && r.ev.rep) counted++; });
  assert.strictEqual(counted, 1);
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
