// Programme et progression (src/plan.js). node --test tests/
import test from 'node:test';
import assert from 'node:assert';
import { EXOS } from '../src/common.js';
import * as P from '../src/plan.js';
import { byId, ids, LOADS, GEAR, base, gym, squat, curl, sessions, tip } from './helpers.js';
const { generate, swap, repair, renew, available, exerciseHistory, loadable, warmup, rir, cycleWeek } = P;

test('Liste : chaque exercice a nom, image, description, et un matériel connu', () => {
  for (const e of EXOS) {
    assert.ok(e.img.length && e.desc && e.mus.length, `${e.id} ${e.name} incomplet`);
    assert.ok(e.eq.every((q) => q in P.TAGS || q === P.BODYWEIGHT), `${e.id} matériel inconnu`);
  }
});

test('Poids du corps seul : aucun exercice ne demande de matériel', () => {
  const bw = generate(EXOS, { ...base, equipment: [] });
  for (const id of ids(bw)) assert.deepStrictEqual(byId.get(id).eq, ['pdc']);
});

test("Jours consécutifs : pas deux full body d'affilée", () => {
  assert.deepStrictEqual(generate(EXOS, { ...base, days: [0, 1, 2] }).map((s) => s.name), ['Poussée', 'Tirage', 'Bas du corps']);
  assert.deepStrictEqual(generate(EXOS, { ...base, days: [6, 0] }).map((s) => s.name), ['Haut du corps', 'Bas du corps']);
});

test('Matériel de Laurent, 4 jours, 45 min : haut/bas, 5 exercices distincts, les 2 premiers sont des mouvements principaux', () => {
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
});

test('Zones fragiles et exercices écartés', () => {
  const plan = generate(EXOS, gym);
  assert.ok(!available(EXOS, { ...gym, zones: ['knees'] }).some((e) => /fente/i.test(e.name)));
  assert.ok(!available(EXOS, { ...gym, zones: ['back'] }).some((e) => [507, 83, 960].includes(e.id)));
  assert.ok(!available(EXOS, { ...gym, avoid: [plan[0].items[0].ex] }).some((e) => e.id === plan[0].items[0].ex));
  // Haltères cochés sans aucun poids renseigné : aucun exercice aux haltères.
  assert.ok(!available(EXOS, { ...gym, loads: { ...LOADS, halteres: [] } }).some((e) => e.load === 'halteres'));
});

test('Remplacer : autre exercice du même créneau, matériel respecté', () => {
  const db = { ...base, equipment: ['halteres', 'banc'] };
  const p = generate(EXOS, db);
  const before = p[0].items[1].ex;
  assert.ok(swap(EXOS, p, db, 0, 1));
  assert.notStrictEqual(p[0].items[1].ex, before);
  for (const id of ids(p)) assert.ok(byId.get(id).eq.every((q) => ['halteres', 'banc', 'pdc'].includes(q)));
});

test('Matériel retiré : le plan est réparé sans Smith, les autres exercices restent', () => {
  const plan = generate(EXOS, gym);
  const fixed = repair(EXOS, structuredClone(plan), { ...gym, equipment: GEAR.filter((q) => q !== 'smith') });
  for (const id of ids(fixed)) assert.ok(!byId.get(id).eq.includes('smith'));
});

test('Fin de cycle : les principaux restent', () => {
  const plan = generate(EXOS, gym);
  const renewed = renew(EXOS, structuredClone(plan), gym, () => 0.5);
  plan.forEach((s, d) => s.items.forEach((it, i) => { if (byId.get(it.ex).main) assert.strictEqual(renewed[d].items[i].ex, it.ex); }));
});

test('Charges réalisables : Smith de 19 à 136,5 kg par 2,5 kg', () => {
  const grid = loadable(squat, LOADS);
  assert.strictEqual(grid[0], 19);
  assert.strictEqual(grid.at(-1), 136.5);
  assert.strictEqual(grid.length, 48);
  assert.ok(grid.every((kg, i) => i === 0 || kg - grid[i - 1] === 2.5));
  assert.deepStrictEqual(warmup(squat, 80, LOADS), [[19, 10], [39, 5], [56.5, 3]]);
  assert.deepStrictEqual(warmup(byId.get(92), 10, LOADS), []);
});

test('Réserve : au moins 2 répétitions sur les gros mouvements, même confirmé', () => {
  assert.strictEqual(rir(squat, 'confirme'), 2);
  assert.strictEqual(rir(byId.get(92), 'confirme'), 1);
});

test('Cycle : semaine 6 allégée, semaine 7 = cycle terminé', () => {
  const start = new Date(2026, 10, 2); // lundi 2 novembre 2026
  assert.deepStrictEqual(cycleWeek({ start }, new Date(2026, 10, 8)), { week: 1, deload: false, ended: false });
  assert.deepStrictEqual(cycleWeek({ start }, new Date(2026, 11, 9)), { week: 6, deload: true, ended: false });
  assert.strictEqual(cycleWeek({ start }, new Date(2026, 11, 14)).ended, true);
});

test('Smith : 1re fois à choisir, apprentissage 2 séances, puis +2,5 kg quand le saut reste sous 10 %', () => {
  const sess = sessions();
  assert.strictEqual(tip(squat, []).kg, null);
  let log = sess(squat, 40, [10, 10, 10]);
  assert.strictEqual(tip(squat, log).kg, 40); // apprentissage 2/2
  log = [...log, ...sess(squat, 40, [10, 10, 10])];
  assert.strictEqual(tip(squat, log).kg, 41.5);
  assert.strictEqual(tip(squat, log).note.includes('41,5'), true);
});

test("Charge légère : +2,5 kg sur 21,5 kg dépasse 10 %, il faut d'abord 12 répétitions", () => {
  const sess = sessions();
  const light = [...sess(squat, 21.5, [10, 10, 10]), ...sess(squat, 21.5, [10, 10, 10]), ...sess(squat, 21.5, [10, 10, 10])];
  assert.strictEqual(tip(squat, light).kg, 21.5);
  assert.strictEqual(tip(squat, [...light, ...sess(squat, 21.5, [12, 12, 12])]).kg, 24);
});

test('Technique non propre, douleur, deux échecs, semaine allégée', () => {
  const sess = sessions();
  const log = [...sess(squat, 40, [10, 10, 10]), ...sess(squat, 40, [10, 10, 10])];
  assert.strictEqual(tip(squat, [...log, ...sess(squat, 41.5, [10, 10, 10], { tech: false })]).kg, 41.5);
  assert.strictEqual(tip(squat, [...log, ...sess(squat, 41.5, [10, 10, 10], { feel: 'pain' })]).kg, 31.5);
  assert.strictEqual(tip(squat, [...log, ...sess(squat, 41.5, [7, 7, 6]), ...sess(squat, 41.5, [7, 6, 6])]).kg, 36.5);
  assert.strictEqual(tip(squat, log, { deload: true }).kg, 34); // 40 × 0,9 = 36, arrondi au palier inférieur
});

test("Réintégré après douleur : l'apprentissage repart", () => {
  const sess = sessions();
  const log = [...sess(squat, 40, [10, 10, 10]), ...sess(squat, 40, [10, 10, 10])];
  const back = [...log, { t: '2026-11-30T09:00:00Z', type: 'reintegrate', ex: squat.id }];
  assert.strictEqual(tip(squat, back).learning, 1);
});

test("Haltères fixes de 10 kg : répétitions jusqu'au plafond, descente lente, pause, puis plafond signalé", () => {
  const sess = sessions();
  let c = [...sess(curl, 10, [10, 10, 10]), ...sess(curl, 10, [10, 10, 10])];
  assert.strictEqual(tip(curl, []).kg, 10);
  assert.match(tip(curl, c).note, /jusqu'à 16/);
  c = [...c, ...sess(curl, 10, [16, 16, 16])];
  assert.strictEqual(tip(curl, c).mode, 'tempo');
  c = [...c, ...sess(curl, 10, [10, 10, 10], { mode: 'tempo' })];
  assert.strictEqual(tip(curl, c).mode, 'pause');
  c = [...c, ...sess(curl, 10, [10, 10, 10], { mode: 'pause' })];
  assert.strictEqual(tip(curl, c).plafond, true);
});

test('Élastiques : passer au suivant (10 -> 20 kg)', () => {
  const sess = sessions();
  const pull = byId.get(158);
  const band = [...sess(pull, 10, [10, 10, 10]), ...sess(pull, 10, [10, 10, 10]), ...sess(pull, 10, [12, 12, 12])];
  assert.strictEqual(tip(pull, band).kg, 20);
});

test('Disques par côté : le moins de disques possible, barre seule, charge impossible', () => {
  assert.deepStrictEqual(P.plates(41.5, LOADS), [10, 1.25]);
  assert.deepStrictEqual(P.plates(136.5, LOADS), [20, 20, 10, 5, 2.5, 1.25]);
  assert.deepStrictEqual(P.plates(19, LOADS), []);
  assert.strictEqual(P.plates(20, LOADS), null);
  assert.deepStrictEqual(P.plates(59, LOADS), [20]);
});

test('Répétitions prévues : 1re fois = bas de fourchette, puis +1 à charge égale, jamais au-delà du haut', () => {
  const it2 = { sets: 3, reps: '8-10' };
  assert.strictEqual(P.targetReps(it2, [], 40, 1), 8);
  assert.strictEqual(P.targetReps(it2, [{ sets: [{ set: 1, kg: 40, reps: 9 }] }], 40, 1), 10);
  assert.strictEqual(P.targetReps(it2, [{ sets: [{ set: 1, kg: 40, reps: 10 }] }], 40, 1), 10);
  assert.strictEqual(P.targetReps(it2, [{ sets: [{ set: 1, kg: 40, reps: 10 }] }], 41.5, 1), 8);
});

test("Forme moyenne : l'augmentation attendra", () => {
  const sess = sessions();
  const log = [...sess(squat, 40, [10, 10, 10]), ...sess(squat, 40, [10, 10, 10])];
  assert.strictEqual(tip(squat, log, { hold: true }).kg, 40);
});

test('Séance abandonnée : ignorée dans le suivi ; restaurée (Annuler) : comptée à nouveau', () => {
  const sess = sessions();
  const ab = sess(squat, 40, [10, 10, 10]);
  const sid = ab[0].session;
  assert.strictEqual(exerciseHistory([...ab, { t: '2026-12-01T10:00:00Z', type: 'cancel', session: sid }], squat.id).length, 0);
  assert.strictEqual(exerciseHistory([...ab, { t: '2026-12-01T10:00:00Z', type: 'cancel', session: sid }, { t: '2026-12-01T10:00:05Z', type: 'restore', session: sid }], squat.id).length, 1);
});

test("Correction d'une série : la dernière saisie fait foi", () => {
  const fix = [{ t: '2026-11-02T10:00:00Z', type: 'set', session: 'x', ex: 92, set: 1, kg: 10, reps: 6 },
    { t: '2026-11-02T10:01:00Z', type: 'set', session: 'x', ex: 92, set: 1, kg: 10, reps: 10 }];
  assert.deepStrictEqual(exerciseHistory(fix, 92)[0].sets.map((x) => x.reps), [10]);
});

test('Changement de disques : on garde ce qui est monté (10 + 1,25 → 12,5 de chaque côté : on retire 1,25 et on ajoute 2,5)', () => {
  assert.deepStrictEqual(P.plateChange([10, 1.25], 44, LOADS), { side: [10, 2.5], remove: [1.25], add: [2.5] });
  assert.deepStrictEqual(P.plateChange([20, 5], 69, LOADS), { side: [20, 5], remove: [], add: [] });
  assert.deepStrictEqual(P.plateChange([20, 10], 59, LOADS), { side: [20], remove: [10], add: [] });
  assert.strictEqual(P.plateChange([], 20, LOADS), null);
});

test('Records : charge jamais faite ou plus de répétitions à la meilleure charge, jamais à la première séance', () => {
  const sess = sessions();
  const rec = exerciseHistory([...sess(squat, 40, [10, 8]), ...sess(squat, 42.5, [6])], squat.id);
  assert.strictEqual(P.recordKind(rec, 'now', { kg: 45, reps: 3 }), 'kg');
  assert.strictEqual(P.recordKind(rec, 'now', { kg: 42.5, reps: 7 }), 'reps');
  assert.strictEqual(P.recordKind(rec, 'now', { kg: 42.5, reps: 6 }), null);
  assert.strictEqual(P.recordKind(rec, 'now', { kg: 40, reps: 12 }), null);
  const first = exerciseHistory(sess(squat, 40, [10]), squat.id);
  assert.strictEqual(P.recordKind(first, first[0].session, { kg: 45, reps: 10 }), null);
});

test('Reprise après une pause : 14 jours = −10 %, 28 jours = −20 %, séances abandonnées ignorées', () => {
  const sess = sessions();
  const log = [...sess(squat, 40, [10, 10, 10]), ...sess(squat, 40, [10, 10, 10])];
  const off = sess(squat, 40, [10, 10, 10]);
  assert.strictEqual(P.daysOff(off, Date.parse(off[0].t) + 15 * 864e5), 15);
  assert.strictEqual(P.daysOff([...off, { t: off[0].t, type: 'cancel', session: off[0].session }], Date.now()), null);
  assert.deepStrictEqual([P.comeback(13), P.comeback(14), P.comeback(30)], [null, 0.9, 0.8]);
  assert.strictEqual(tip(squat, log, { comeback: 0.9 }).kg, 34);
  assert.match(tip(squat, log, { comeback: 0.9 }).note, /Reprise/);
});

test('Matériel à préparer : Smith avec les disques de la charge la plus lourde, poids des haltères', () => {
  assert.deepStrictEqual(P.gearList([{ e: squat, kg: 41.5 }, { e: squat, kg: 59 }, { e: curl, kg: 10 }], LOADS),
    [`Smith machine (jusqu'à 20\u00a0kg de chaque côté)`, `Haltères 10\u00a0kg`]);
});

test("Séance express : les 2 premiers exercices restent entiers, l'isolation part d'abord, la durée tient", () => {
  const day = generate(EXOS, { ...base, minutes: 60 })[0].items;
  const fit20 = P.express(EXOS, day, 20);
  assert.deepStrictEqual(day.slice(0, 2).map((it) => fit20[it.ex]), day.slice(0, 2).map((it) => it.sets));
  assert.ok(P.sessionMinutes(day.map((it) => ({ ...it, sets: fit20[it.ex] }))) <= 20 || day.slice(2).every((it) => fit20[it.ex] === 0));
  const iso = day.slice(2).filter((it) => P.ISOLATION_ZONES.includes(byId.get(it.ex).zone));
  const other = day.slice(2).filter((it) => !P.ISOLATION_ZONES.includes(byId.get(it.ex).zone));
  if (iso.length && other.some((it) => fit20[it.ex] > 0)) assert.ok(iso.every((it) => fit20[it.ex] === 0));
  const roomy = P.express(EXOS, day, 999);
  assert.ok(day.every((it) => roomy[it.ex] === it.sets));
});

test("Série annulée : retirée de l'historique et de la reprise, le journal garde tout", () => {
  const sess = sessions();
  const ud = sess(squat, 40, [10, 8]);
  const ud2 = [{ ...ud[0], t: '2026-11-20T10:00:00Z' }, { ...ud[1], t: '2026-11-20T10:01:00Z' }];
  assert.deepStrictEqual(exerciseHistory([...ud2, { t: '2026-11-20T10:02:00Z', type: 'undo', target: ud2[1].t }], squat.id)[0].sets.map((x) => x.reps), [10]);
  assert.strictEqual(P.daysOff([ud2[0], { t: '2026-11-20T10:00:30Z', type: 'undo', target: ud2[0].t }], Date.now()), null);
});

test('Poussée / tirage : au renouvellement, un excès de poussée devient du dos', () => {
  const heavy = generate(EXOS, { ...base, days: [0, 1, 2, 3], minutes: 75 });
  const pp = P.pushPull(EXOS, heavy);
  P.balance(EXOS, heavy, { ...base, days: [0, 1, 2, 3], minutes: 75 }, () => 0);
  const after = P.pushPull(EXOS, heavy);
  assert.ok(after.push - after.pull < 2 || after.push - after.pull < pp.push - pp.pull);
});

test('Récupération : 6 séries de squat juste faites = quadriceps à 0 %, 80 % après 48 h, rien après 6 jours ; secondaires moins touchés', () => {
  const sq = byId.get(1747);
  const fresh6 = Array.from({ length: 6 }, (_, k) => ({ t: '2026-11-10T18:00:00Z', type: 'set', session: 'r', ex: sq.id, set: k + 1, kg: 40, reps: 10 }));
  const at = (h) => Date.parse('2026-11-10T18:00:00Z') + h * 3600e3;
  assert.strictEqual(P.recovery(fresh6, EXOS, at(0))[10], 0);
  assert.ok(Math.abs(P.recovery(fresh6, EXOS, at(48))[10] - 80) <= 1);
  assert.deepStrictEqual(P.recovery(fresh6, EXOS, at(6 * 24)), {});
  assert.strictEqual(P.recovery([...fresh6, { t: '2026-11-10T18:30:00Z', type: 'cancel', session: 'r' }], EXOS, at(1))[10], undefined);
});
