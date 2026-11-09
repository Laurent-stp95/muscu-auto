// node tests/test.js
const assert = require('assert');
const EXOS = require('../data/data.js');
const P = require('../src/plan.js');
const S = require('../common/shared.js');
const { generate, swap, repair, renew, available, exerciseHistory, learned, loadable, suggest, warmup, rir, cycleWeek } = P;

const byId = new Map(EXOS.map((e) => [e.id, e]));
const ids = (plan) => plan.flatMap((s) => s.items.map((it) => it.ex));
const LOADS = { bar: 19, plates: { 1.25: 2, 2.5: 2, 5: 2, 10: 2, 20: 4 }, halteres: [10], kettlebell: [16], elastiques: [30, 20, 10] };
const GEAR = ['smith', 'halteres', 'kettlebell', 'banc', 'banc-incline', 'traction', 'elastique', 'tapis'];
const base = { equipment: GEAR, loads: LOADS, days: [0, 2, 4], goal: 'muscle', level: 'intermediaire', minutes: 60, seed: 1, zones: [], avoid: [] };

// Liste : chaque exercice a nom, image, description, et un matériel connu.
for (const e of EXOS) {
  assert.ok(e.img.length && e.desc && e.mus.length, `${e.id} ${e.name} incomplet`);
  assert.ok(e.eq.every((q) => q in P.TAGS || q === P.BODYWEIGHT), `${e.id} matériel inconnu`);
}

// Poids du corps seul : aucun exercice ne demande de matériel.
const bw = generate(EXOS, { ...base, equipment: [] });
for (const id of ids(bw)) assert.deepStrictEqual(byId.get(id).eq, ['pdc']);

// Jours consécutifs : pas deux full body d'affilée.
assert.deepStrictEqual(generate(EXOS, { ...base, days: [0, 1, 2] }).map((s) => s.name), ['Poussée', 'Tirage', 'Bas du corps']);
assert.deepStrictEqual(generate(EXOS, { ...base, days: [6, 0] }).map((s) => s.name), ['Haut du corps', 'Bas du corps']);

// Matériel de Laurent, 4 jours, 45 min : haut/bas, 5 exercices distincts, les 2 premiers sont des mouvements principaux.
const gym = { ...base, days: [5, 0, 3, 1], minutes: 45 };
const plan = generate(EXOS, gym);
assert.deepStrictEqual(plan.map((s) => s.day), [0, 1, 3, 5]);
assert.deepStrictEqual(plan.map((s) => s.name), ['Haut du corps', 'Bas du corps', 'Haut du corps', 'Bas du corps']);
for (const s of plan) {
  assert.strictEqual(s.items.length, 5);
  assert.strictEqual(new Set(s.items.map((it) => it.ex)).size, 5);
  for (const it of s.items.slice(0, 2)) assert.ok(byId.get(it.ex).main, `${byId.get(it.ex).name} pas principal`);
}
assert.deepStrictEqual(plan[0].items[0], { ...plan[0].items[0], sets: 4, reps: '8-10', rest: 90 });
assert.strictEqual(generate(EXOS, { ...gym, level: 'debutant' })[0].items[0].sets, 3);
assert.deepStrictEqual(generate(EXOS, gym), plan); // même graine = même programme

// Zones fragiles et exercices écartés.
assert.ok(!available(EXOS, { ...gym, zones: ['knees'] }).some((e) => /fente/i.test(e.name)));
assert.ok(!available(EXOS, { ...gym, zones: ['back'] }).some((e) => [507, 83, 960].includes(e.id)));
assert.ok(!available(EXOS, { ...gym, avoid: [plan[0].items[0].ex] }).some((e) => e.id === plan[0].items[0].ex));
// Haltères cochés sans aucun poids renseigné : aucun exercice aux haltères.
assert.ok(!available(EXOS, { ...gym, loads: { ...LOADS, halteres: [] } }).some((e) => e.load === 'halteres'));

// Remplacer : autre exercice du même créneau, matériel respecté.
const db = { ...base, equipment: ['halteres', 'banc'] };
const p = generate(EXOS, db);
const before = p[0].items[1].ex;
assert.ok(swap(EXOS, p, db, 0, 1));
assert.notStrictEqual(p[0].items[1].ex, before);
for (const id of ids(p)) assert.ok(byId.get(id).eq.every((q) => ['halteres', 'banc', 'pdc'].includes(q)));

// Matériel retiré : le plan est réparé sans Smith, les autres exercices restent.
const fixed = repair(EXOS, structuredClone(plan), { ...gym, equipment: GEAR.filter((q) => q !== 'smith') });
for (const id of ids(fixed)) assert.ok(!byId.get(id).eq.includes('smith'));
// Fin de cycle : les principaux restent.
const renewed = renew(EXOS, structuredClone(plan), gym, () => 0.5);
plan.forEach((s, d) => s.items.forEach((it, i) => { if (byId.get(it.ex).main) assert.strictEqual(renewed[d].items[i].ex, it.ex); }));

// Charges réalisables : Smith de 19 à 136,5 kg par 2,5 kg.
const squat = byId.get(1747);
const grid = loadable(squat, LOADS);
assert.strictEqual(grid[0], 19);
assert.strictEqual(grid.at(-1), 136.5);
assert.strictEqual(grid.length, 48);
assert.ok(grid.every((kg, i) => i === 0 || kg - grid[i - 1] === 2.5));
assert.deepStrictEqual(warmup(squat, 80, LOADS), [[19, 10], [39, 5], [56.5, 3]]);
assert.deepStrictEqual(warmup(byId.get(92), 10, LOADS), []);

// Réserve : au moins 2 répétitions sur les gros mouvements, même confirmé.
assert.strictEqual(rir(squat, 'confirme'), 2);
assert.strictEqual(rir(byId.get(92), 'confirme'), 1);

// Cycle : semaine 6 allégée, semaine 7 = cycle terminé.
const start = new Date(2026, 10, 2); // lundi 2 novembre 2026
assert.deepStrictEqual(cycleWeek({ start }, new Date(2026, 10, 8)), { week: 1, deload: false, ended: false });
assert.deepStrictEqual(cycleWeek({ start }, new Date(2026, 11, 9)), { week: 6, deload: true, ended: false });
assert.strictEqual(cycleWeek({ start }, new Date(2026, 11, 14)).ended, true);

// Progression.
const item = { sets: 3, reps: '8-10' };
let n = 0;
const sess = (ex, kg, reps, extra = {}) => {
  const session = `s${++n}`, t = `2026-11-${String(n).padStart(2, '0')}T10:00:00Z`;
  return [...reps.map((r, i) => ({ t, type: 'set', session, ex: ex.id, set: i + 1, kg, reps: r, ...(extra.mode && { mode: extra.mode }) })),
    ...(extra.feel ? [{ t, type: 'feel', session, ex: ex.id, feel: extra.feel }] : []),
    ...(extra.tech === false ? [{ t, type: 'tech', session, ex: ex.id, ok: false }] : [])];
};
const tip = (ex, log, extra) => suggest(ex, item, exerciseHistory(log, ex.id), { loads: LOADS, learned: learned(log, ex.id, exerciseHistory(log, ex.id)), ...extra });

// Smith : 1re fois à choisir, apprentissage 2 séances, puis +2,5 kg quand le saut reste sous 10 %.
assert.strictEqual(tip(squat, []).kg, null);
let log = sess(squat, 40, [10, 10, 10]);
assert.strictEqual(tip(squat, log).kg, 40); // apprentissage 2/2
log = [...log, ...sess(squat, 40, [10, 10, 10])];
assert.strictEqual(tip(squat, log).kg, 41.5);
assert.strictEqual(tip(squat, log).note.includes('41,5'), true);
// Charge légère : +2,5 kg sur 21,5 kg dépasse 10 %, il faut d'abord 12 répétitions.
const light = [...sess(squat, 21.5, [10, 10, 10]), ...sess(squat, 21.5, [10, 10, 10]), ...sess(squat, 21.5, [10, 10, 10])];
assert.strictEqual(tip(squat, light).kg, 21.5);
assert.strictEqual(tip(squat, [...light, ...sess(squat, 21.5, [12, 12, 12])]).kg, 24);
// Technique non propre, douleur, deux échecs, semaine allégée.
assert.strictEqual(tip(squat, [...log, ...sess(squat, 41.5, [10, 10, 10], { tech: false })]).kg, 41.5);
assert.strictEqual(tip(squat, [...log, ...sess(squat, 41.5, [10, 10, 10], { feel: 'pain' })]).kg, 31.5);
assert.strictEqual(tip(squat, [...log, ...sess(squat, 41.5, [7, 7, 6]), ...sess(squat, 41.5, [7, 6, 6])]).kg, 36.5);
assert.strictEqual(tip(squat, log, { deload: true }).kg, 34); // 40 × 0,9 = 36, arrondi au palier inférieur
// Réintégré après douleur : l'apprentissage repart.
const back = [...log, { t: '2026-11-30T09:00:00Z', type: 'reintegrate', ex: squat.id }];
assert.strictEqual(tip(squat, back).learning, 1);

// Haltères fixes de 10 kg : répétitions jusqu'au plafond, descente lente, pause, puis plafond signalé.
const curl = byId.get(92);
let c = [...sess(curl, 10, [10, 10, 10]), ...sess(curl, 10, [10, 10, 10])];
assert.strictEqual(tip(curl, []).kg, 10);
assert.match(tip(curl, c).note, /jusqu'à 16/);
c = [...c, ...sess(curl, 10, [16, 16, 16])];
assert.strictEqual(tip(curl, c).mode, 'tempo');
c = [...c, ...sess(curl, 10, [10, 10, 10], { mode: 'tempo' })];
assert.strictEqual(tip(curl, c).mode, 'pause');
c = [...c, ...sess(curl, 10, [10, 10, 10], { mode: 'pause' })];
assert.strictEqual(tip(curl, c).plafond, true);

// Élastiques : passer au suivant (10 -> 20 kg).
const pull = byId.get(158);
const band = [...sess(pull, 10, [10, 10, 10]), ...sess(pull, 10, [10, 10, 10]), ...sess(pull, 10, [12, 12, 12])];
assert.strictEqual(tip(pull, band).kg, 20);

// Disques par côté : le moins de disques possible, barre seule, charge impossible.
assert.deepStrictEqual(P.plates(41.5, LOADS), [10, 1.25]);
assert.deepStrictEqual(P.plates(136.5, LOADS), [20, 20, 10, 5, 2.5, 1.25]);
assert.deepStrictEqual(P.plates(19, LOADS), []);
assert.strictEqual(P.plates(20, LOADS), null);
assert.deepStrictEqual(P.plates(59, LOADS), [20]);

// Répétitions prévues : 1re fois = bas de fourchette, puis +1 à charge égale, jamais au-delà du haut.
const it2 = { sets: 3, reps: '8-10' };
assert.strictEqual(P.targetReps(it2, [], 40, 1), 8);
assert.strictEqual(P.targetReps(it2, [{ sets: [{ set: 1, kg: 40, reps: 9 }] }], 40, 1), 10);
assert.strictEqual(P.targetReps(it2, [{ sets: [{ set: 1, kg: 40, reps: 10 }] }], 40, 1), 10);
assert.strictEqual(P.targetReps(it2, [{ sets: [{ set: 1, kg: 40, reps: 10 }] }], 41.5, 1), 8);

// Forme moyenne : l'augmentation attendra.
assert.strictEqual(tip(squat, log, { hold: true }).kg, 40);

// Séance abandonnée : ignorée dans le suivi ; restaurée (Annuler) : comptée à nouveau.
const ab = sess(squat, 40, [10, 10, 10]);
const sid = ab[0].session;
assert.strictEqual(exerciseHistory([...ab, { t: '2026-12-01T10:00:00Z', type: 'cancel', session: sid }], squat.id).length, 0);
assert.strictEqual(exerciseHistory([...ab, { t: '2026-12-01T10:00:00Z', type: 'cancel', session: sid }, { t: '2026-12-01T10:00:05Z', type: 'restore', session: sid }], squat.id).length, 1);

// Correction d'une série : la dernière saisie fait foi.
const fix = [{ t: '2026-11-02T10:00:00Z', type: 'set', session: 'x', ex: 92, set: 1, kg: 10, reps: 6 },
  { t: '2026-11-02T10:01:00Z', type: 'set', session: 'x', ex: 92, set: 1, kg: 10, reps: 10 }];
assert.deepStrictEqual(exerciseHistory(fix, 92)[0].sets.map((x) => x.reps), [10]);

// Changement de disques : on garde ce qui est monté (10 + 1,25 → 12,5 de chaque côté : on retire 1,25 et on ajoute 2,5).
assert.deepStrictEqual(P.plateChange([10, 1.25], 44, LOADS), { side: [10, 2.5], remove: [1.25], add: [2.5] });
assert.deepStrictEqual(P.plateChange([20, 5], 69, LOADS), { side: [20, 5], remove: [], add: [] });
assert.deepStrictEqual(P.plateChange([20, 10], 59, LOADS), { side: [20], remove: [10], add: [] });
assert.strictEqual(P.plateChange([], 20, LOADS), null);

// Records : charge jamais faite ou plus de répétitions à la meilleure charge, jamais à la première séance.
const rec = exerciseHistory([...sess(squat, 40, [10, 8]), ...sess(squat, 42.5, [6])], squat.id);
assert.strictEqual(P.recordKind(rec, 'now', { kg: 45, reps: 3 }), 'kg');
assert.strictEqual(P.recordKind(rec, 'now', { kg: 42.5, reps: 7 }), 'reps');
assert.strictEqual(P.recordKind(rec, 'now', { kg: 42.5, reps: 6 }), null);
assert.strictEqual(P.recordKind(rec, 'now', { kg: 40, reps: 12 }), null);
const first = exerciseHistory(sess(squat, 40, [10]), squat.id);
assert.strictEqual(P.recordKind(first, first[0].session, { kg: 45, reps: 10 }), null);

// Reprise après une pause : 14 jours = −10 %, 28 jours = −20 %, séances abandonnées ignorées.
const off = sess(squat, 40, [10, 10, 10]);
assert.strictEqual(P.daysOff(off, Date.parse(off[0].t) + 15 * 864e5), 15);
assert.strictEqual(P.daysOff([...off, { t: off[0].t, type: 'cancel', session: off[0].session }], Date.now()), null);
assert.deepStrictEqual([P.comeback(13), P.comeback(14), P.comeback(30)], [null, 0.9, 0.8]);
assert.strictEqual(tip(squat, log, { comeback: 0.9 }).kg, 34);
assert.match(tip(squat, log, { comeback: 0.9 }).note, /Reprise/);

// Matériel à préparer : Smith avec les disques de la charge la plus lourde, poids des haltères.
assert.deepStrictEqual(P.gearList([{ e: squat, kg: 41.5 }, { e: squat, kg: 59 }, { e: curl, kg: 10 }], LOADS),
  [`Smith machine (jusqu'à 20\u00a0kg de chaque côté)`, `Haltères 10\u00a0kg`]);

// Séance express : les 2 premiers exercices restent entiers, l'isolation part d'abord, la durée tient.
const day = generate(EXOS, { ...base, minutes: 60 })[0].items;
const fit20 = P.express(EXOS, day, 20);
assert.deepStrictEqual(day.slice(0, 2).map((it) => fit20[it.ex]), day.slice(0, 2).map((it) => it.sets));
assert.ok(P.sessionMinutes(day.map((it) => ({ ...it, sets: fit20[it.ex] }))) <= 20 || day.slice(2).every((it) => fit20[it.ex] === 0));
const iso = day.slice(2).filter((it) => P.ISOLATION_ZONES.includes(byId.get(it.ex).zone));
const other = day.slice(2).filter((it) => !P.ISOLATION_ZONES.includes(byId.get(it.ex).zone));
if (iso.length && other.some((it) => fit20[it.ex] > 0)) assert.ok(iso.every((it) => fit20[it.ex] === 0));
const roomy = P.express(EXOS, day, 999);
assert.ok(day.every((it) => roomy[it.ex] === it.sets));

// Série annulée : retirée de l'historique et de la reprise, le journal garde tout.
const ud = sess(squat, 40, [10, 8]);
const ud2 = [{ ...ud[0], t: '2026-11-20T10:00:00Z' }, { ...ud[1], t: '2026-11-20T10:01:00Z' }];
assert.deepStrictEqual(exerciseHistory([...ud2, { t: '2026-11-20T10:02:00Z', type: 'undo', target: ud2[1].t }], squat.id)[0].sets.map((x) => x.reps), [10]);
assert.strictEqual(P.daysOff([ud2[0], { t: '2026-11-20T10:00:30Z', type: 'undo', target: ud2[0].t }], Date.now()), null);

// Poussée / tirage : au renouvellement, un excès de poussée devient du dos.
const heavy = generate(EXOS, { ...base, days: [0, 1, 2, 3], minutes: 75 });
const pp = P.pushPull(EXOS, heavy);
P.balance(EXOS, heavy, { ...base, days: [0, 1, 2, 3], minutes: 75 }, () => 0);
const after = P.pushPull(EXOS, heavy);
assert.ok(after.push - after.pull < 2 || after.push - after.pull < pp.push - pp.pull);

// Caméra : angle d'articulation et compteur (squat : genou de 175° à 85° en 2 s, puis remontée ; une demi-répétition à 120°).
assert.strictEqual(Math.round(S.jointAngle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })), 90);
assert.strictEqual(Math.round(S.jointAngle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 })), 180);
// Compteur : 30 mesures par seconde. Une vraie répétition compte ; une demi-descente, un tremblement, un point qui saute
// ou un geste trop vif ne comptent pas.
const run = (counter, path, t0 = 0) => { const out = []; path.forEach((a, k) => { const ev = counter.push(a, t0 + k * 33); if (ev) out.push(ev); }); return out; };
const ramp = (from, to, ms) => Array.from({ length: Math.round(ms / 33) }, (_, k) => from + ((to - from) * k) / Math.round(ms / 33));
const hold = (a, ms) => ramp(a, a, ms);
const squatPath = (bottom, down = 1500, up = 1000) => [...hold(175, 400), ...ramp(175, bottom, down), ...ramp(bottom, 175, up), ...hold(175, 300)];
const knee = () => S.repCounter(S.COUNTER.knee);
// Tolérant : une répétition imparfaite (vive, pas assez basse) compte, marquée full: false ; un geste esquissé ne compte pas.
let evs = run(knee(), [...squatPath(90), ...squatPath(95), ...squatPath(110, 400, 400), ...squatPath(125)]);
assert.deepStrictEqual(evs.map((e) => [e.rep, e.full]), [[1, true], [2, true], [3, false], [4, false]]);
assert.ok(evs[0].down >= 1100); // descente mesurée depuis la sortie de la position haute
assert.ok(evs[2].down < 1000); // la 3e, trop vive : comptée, signalée
evs = run(knee(), squatPath(137)); // quart de squat : signalé, pas compté
assert.deepStrictEqual(evs.map((e) => [e.partial, e.rep]), [[true, undefined]]);
evs = run(knee(), [...hold(175, 500), ...ramp(175, 110, 150), ...ramp(110, 175, 150), ...hold(175, 500)]); // plongeon de 0,3 s : bruit
assert.strictEqual(evs.length, 0);
evs = run(S.repCounter(S.counterFor('elbow', 1084)), [...hold(170, 400), ...ramp(170, 100, 1200), ...ramp(100, 170, 800), ...hold(170, 300)]);
assert.deepStrictEqual(evs.map((e) => [e.rep, e.full]), [[1, true]]); // développé au sol : coudes arrêtés par le sol à 100°, complet
evs = run(knee(), [...hold(175, 500), ...Array.from({ length: 120 }, (_, k) => 160 + (k % 6) * 3)]); // petits mouvements autour du haut
assert.strictEqual(evs.length, 0);
evs = run(knee(), [...hold(175, 500), 175, 80, 175, 175, 80, 175, ...hold(175, 500)]); // points qui sautent
assert.strictEqual(evs.length, 0);
const kc = knee(); run(kc, [...hold(175, 400), ...ramp(175, 90, 1500)]); kc.reset(); // la personne sort de l'image en bas
assert.strictEqual(run(kc, [...ramp(90, 175, 800), ...hold(175, 300)], 5000).length, 0);

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
assert.deepStrictEqual(track(two).out, [1, 2]);
assert.deepStrictEqual(track(two, (k) => [body(175, 0.3)]).out, [1, 2]); // une autre personne immobile à côté : on te suit toi
const passing = S.poseTracker('knee'); let counted = 0;
two.forEach((a, k) => { const others = k > 40 && k < 70; const r = passing.update(others ? [body(100, 0.35)] : [body(a)], k * 33, false, 1); if (r.ev && r.ev.rep) counted++; if (others && k === 41) assert.strictEqual(r.state, 'switch'); });
assert.strictEqual(counted, 1); // la 1re répétition, coupée par quelqu'un qui passe devant, n'est pas comptée
const walker = S.poseTracker('knee'); let walked = 0;
two.forEach((a, k) => { const r = walker.update([body(a, (k % 60) * 0.006)], k * 33, false, 1); if (r.ev && r.ev.rep) walked++; });
assert.strictEqual(walked, 0); // en marchant
const count = (tracker, frames) => frames.filter((p, k) => { const r = tracker.update([p], k * 33, false, 1); return r.ev && r.ev.rep; }).length;
assert.strictEqual(count(S.poseTracker('knee'), two.map((a) => scaled(body(a), 1.5, 0.12))), 0); // tout près : pieds hors de l'image
assert.strictEqual(count(S.poseTracker('knee'), two.map((a, k) => scaled(body(a), k > 20 && k < 50 ? 0.6 + (0.4 * (k - 20)) / 30 : k <= 20 ? 0.6 : 1))), 1); // s'approche pendant la 1re : seule la 2e compte
// Bruit du suivi : chevilles qui tremblent de ±6 % et buste qui raccourcit de 40 % penché en avant (vu de face) : tout compte.
let seed = 1; const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.12;
const shaky = (p) => { [27, 28].forEach((k) => { p[k].x += noise(); p[k].y += noise() / 3; }); return p; };
const lean = (p, a) => { const f = 1 - (0.4 * (175 - a)) / 85; [11, 12, 0].forEach((k) => { p[k].y = p[23].y - (p[23].y - p[k].y) * f; }); p[11].x -= 0.1; p[12].x += 0.1; return p; }; // de face : épaules écartées
assert.strictEqual(count(S.poseTracker('knee'), two.map((a) => shaky(body(a)))), 2);
assert.strictEqual(count(S.poseTracker('knee'), two.map((a) => lean(body(a), a))), 2);
const blip = two.map((a, k) => (k === 70 || k === 71 ? scaled(body(a), 1.5, 0.12) : body(a))); // 2 images ratées en pleine descente
assert.strictEqual(count(S.poseTracker('knee'), blip), 2);
assert.strictEqual(count(S.poseTracker('knee', 1747), two.map((a) => body(a))), 0); // squat Smith, mains en bas (accroupi vers l'iPhone)
assert.strictEqual(count(S.poseTracker('knee', 1747), two.map((a) => handsUp(body(a)))), 2); // mains sur la barre : compté

// Récupération : 6 séries de squat juste faites = quadriceps à 0 %, 80 % après 48 h, rien après 6 jours ; secondaires moins touchés.
const sq = byId.get(1747);
const fresh6 = Array.from({ length: 6 }, (_, k) => ({ t: '2026-11-10T18:00:00Z', type: 'set', session: 'r', ex: sq.id, set: k + 1, kg: 40, reps: 10 }));
const at = (h) => Date.parse('2026-11-10T18:00:00Z') + h * 3600e3;
assert.strictEqual(P.recovery(fresh6, EXOS, at(0))[10], 0);
assert.ok(Math.abs(P.recovery(fresh6, EXOS, at(48))[10] - 80) <= 1);
assert.deepStrictEqual(P.recovery(fresh6, EXOS, at(6 * 24)), {});
assert.strictEqual(P.recovery([...fresh6, { t: '2026-11-10T18:30:00Z', type: 'cancel', session: 'r' }], EXOS, at(1))[10], undefined);

// Voix : Premium avant Améliorée avant de base, France avant Canada, voix gadget en dernier ; voix choisie si présente.
const fakeSynth = (list) => ({ getVoices: () => list.map(([name, lang, uri]) => ({ name, lang, voiceURI: uri || name })) });
const synth = fakeSynth([['Jacques', 'fr-FR'], ['Amélie', 'fr-CA'], ['Thomas', 'fr-FR'], ['Samantha', 'en-US'],
  ['Amélie', 'fr-CA', 'com.apple.voice.premium.fr-CA.Amelie'], ['Thomas', 'fr-FR', 'com.apple.voice.enhanced.fr-FR.Thomas']]);
assert.strictEqual(S.frenchVoice(synth).voiceURI, 'com.apple.voice.premium.fr-CA.Amelie');
assert.strictEqual(S.frenchVoice(fakeSynth([['Jacques', 'fr-FR'], ['Amélie', 'fr-CA'], ['Thomas', 'fr-FR']])).name, 'Thomas');
assert.strictEqual(S.frenchVoice(fakeSynth([['Grand-mère', 'fr-FR'], ['Google français', 'fr-FR'], ['Microsoft Denise Online (Natural) - French (France)', 'fr-FR']])).name.slice(0, 15), 'Microsoft Denis');
assert.strictEqual(S.frenchVoice(synth, 'Jacques').name, 'Jacques');
assert.strictEqual(S.frenchVoice(synth, 'Absente').voiceURI, 'com.apple.voice.premium.fr-CA.Amelie');
assert.strictEqual(S.frenchVoice(fakeSynth([['Samantha', 'en-US']])), null);

for (const x of plan) console.log(x.day, x.name, x.items.map((it) => byId.get(it.ex).name).join(' | '));
// Liste des fichiers (common/files.js) : c'est ce qu'index.html charge, dans le même ordre, tout existe, rien n'est oublié.
{
  const fs = require('fs'), path = require('path');
  const FILES = require('../common/files.js'), root = path.join(__dirname, '..');
  const scripts = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.deepStrictEqual(FILES.code, ['index.html', ...scripts]);
  for (const f of [...FILES.code, ...FILES.assets]) assert.ok(fs.existsSync(path.join(root, f)), `${f} listé mais absent`);
  const onDisk = ['src', 'common'].flatMap((dir) => fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith('.js')).map((f) => `${dir}/${f}`));
  assert.deepStrictEqual(onDisk.filter((f) => !FILES.code.includes(f)), []);
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  for (const f of sw.match(/importScripts\(([^)]*)\)/)[1].match(/[\w\/.-]+\.js/g)) assert.ok(FILES.code.includes(f), `${f} importé par sw.js mais pas listé`);
}

console.log('OK');
