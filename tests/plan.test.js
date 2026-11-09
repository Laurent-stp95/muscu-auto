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
  const { cut: fit20, pairs } = P.expressPlan(EXOS, day, 20);
  assert.deepStrictEqual(P.express(EXOS, day, 20), fit20);
  assert.deepStrictEqual(day.slice(0, 2).map((it) => fit20[it.ex]), day.slice(0, 2).map((it) => it.sets));
  assert.ok(P.sessionMinutes(day.map((it) => ({ ...it, sets: fit20[it.ex] })), pairs) <= 20 || day.slice(2).every((it) => fit20[it.ex] === 0));
  const iso = day.slice(2).filter((it) => P.ISOLATION_ZONES.includes(byId.get(it.ex).zone));
  const other = day.slice(2).filter((it) => !P.ISOLATION_ZONES.includes(byId.get(it.ex).zone));
  if (iso.length && other.some((it) => fit20[it.ex] > 0)) assert.ok(iso.every((it) => fit20[it.ex] === 0));
  const roomy = P.expressPlan(EXOS, day, 999);
  assert.ok(day.every((it) => roomy.cut[it.ex] === it.sets));
  assert.deepStrictEqual(roomy.pairs, []); // la séance tient : ni retrait ni superset
});

// --- Supersets de la séance express ---
// Séance type : 2 mouvements principaux (4 × 8-10, repos 90 s) puis des accessoires (3 × 10-12, repos 60 s).
const acc = (ex, extra = {}) => ({ ex, sets: 3, reps: '10-12', rest: 60, ...extra });
const heavy = (ex) => ({ ex, sets: 4, reps: '8-10', rest: 90 });
const SQUAT = 1747, BENCH = 73, ROW = 81, LATERAL = 348, CURL = 92, TRICEPS = 1336, RDL = 1652, GOBLET = 203, PLANK = 458, PRESS = 75, SHRUG = 572, CALF = 622, SMITH_SHRUG = 571;
const names = (pairs) => pairs.map((p) => p.map((id) => byId.get(id).name).join(' + '));

test('Supersets : antagonistes d\'abord (poussée / tirage, biceps / triceps, quadriceps / ischios), jamais les 2 premiers ni un mouvement principal', () => {
  const day = [heavy(SQUAT), heavy(BENCH), acc(ROW), acc(LATERAL), acc(CURL), acc(TRICEPS)];
  assert.deepStrictEqual(P.supersets(EXOS, day), [[ROW, LATERAL], [CURL, TRICEPS]], names(P.supersets(EXOS, day)).join(' ; '));
  assert.deepStrictEqual(P.supersets(EXOS, [heavy(BENCH), heavy(83), acc(GOBLET), acc(RDL)]), [[GOBLET, RDL]]);
  // Les 2 premiers gardent leur repos entier, même s'ils ne sont pas des mouvements principaux ; un principal placé plus loin aussi.
  assert.deepStrictEqual(P.supersets(EXOS, [acc(ROW), acc(LATERAL), acc(CURL), acc(TRICEPS)]), [[CURL, TRICEPS]]);
  assert.deepStrictEqual(P.supersets(EXOS, [heavy(SQUAT), heavy(BENCH), acc(83), acc(LATERAL)]), []); // rowing à la Smith : principal
  // Le meilleur appariement, pas le premier venu : le curl va avec les triceps (antagonistes) plutôt qu'avec le rowing d'à côté.
  assert.deepStrictEqual(P.supersets(EXOS, [heavy(SQUAT), heavy(BENCH), acc(RDL), acc(CURL), acc(TRICEPS)]), [[CURL, TRICEPS]]);
  assert.deepStrictEqual(P.supersets(EXOS, [heavy(SQUAT), heavy(BENCH), acc(CURL), acc(RDL), acc(PLANK), acc(TRICEPS)]), [[CURL, TRICEPS], [RDL, PLANK]]);
});

test('Supersets : pas deux exercices qui se gênent (même zone, pectoraux puis triceps, dos puis biceps ou trapèzes), exercice retiré ignoré', () => {
  const score = (a, b) => P.supersetScore({ e: byId.get(a) }, { e: byId.get(b) });
  assert.strictEqual(score(PRESS, TRICEPS), 0); // le développé travaille déjà les triceps
  assert.strictEqual(score(ROW, CURL), 0);
  assert.strictEqual(score(PRESS, LATERAL), 0);
  assert.strictEqual(score(ROW, SHRUG), 0); // haussements d'épaules : trapèzes, ça tire comme le dos
  assert.strictEqual(score(CURL, 272), 0);
  assert.strictEqual(score(1651, RDL), 0); // la fente et le soulevé de terre partagent les fessiers
  assert.strictEqual(score(PRESS, ROW), 3);
  assert.strictEqual(score(CURL, TRICEPS), 3);
  assert.strictEqual(score(GOBLET, RDL), 3);
  assert.strictEqual(score(LATERAL, RDL), 2); // haut et bas du corps
  assert.strictEqual(score(CURL, PLANK), 1); // sans recouvrement
  assert.deepStrictEqual(P.supersets(EXOS, [heavy(SQUAT), heavy(BENCH), acc(CURL), acc(TRICEPS, { sets: 0 })]), []);
  assert.deepStrictEqual(P.supersets(EXOS, [heavy(SQUAT), heavy(BENCH), acc(PRESS), acc(TRICEPS), acc(LATERAL)]), []);
});

test('Supersets : même barre Smith seulement à charge égale (pas de changement de disques sans repos)', () => {
  const day = (a, b) => [heavy(SQUAT), heavy(BENCH), acc(SMITH_SHRUG, a), acc(CALF, b)];
  assert.deepStrictEqual(P.supersets(EXOS, day({ kg: 59 }, { kg: 59 })), [[SMITH_SHRUG, CALF]]);
  assert.deepStrictEqual(P.supersets(EXOS, day({ kg: 59 }, { kg: 79 })), []);
  assert.deepStrictEqual(P.supersets(EXOS, day({ kg: null }, { kg: null })), []); // charges pas encore choisies : on ne parie pas
  assert.deepStrictEqual(P.supersets(EXOS, day({}, {})), []);
  // Une seule des deux à la Smith : rien à changer sur la barre entre les deux.
  assert.deepStrictEqual(P.supersets(EXOS, [heavy(SQUAT), heavy(BENCH), acc(SMITH_SHRUG, { kg: 59 }), acc(1620, { kg: 10 })]), [[SMITH_SHRUG, 1620]]);
  // Rowing inversé sous la barre (poids du corps, barre à régler) avec un exercice chargé à la Smith : jamais.
  assert.strictEqual(P.supersetScore({ e: byId.get(1198), kg: null }, { e: byId.get(CALF), kg: 59 }), 0);
});

test('Supersets : durée (un seul repos par tour, réduit de moitié) et tour de rôle A1, B1, repos, A2, B2…', () => {
  const a = acc(CURL), b = acc(TRICEPS);
  assert.strictEqual(P.supersetRest(a, b), 30);
  assert.strictEqual(P.supersetRest(acc(CURL, { rest: 90 }), b), 45);
  assert.strictEqual(P.supersetRest(acc(CURL, { rest: 45 }), acc(TRICEPS, { rest: 45 })), 30);
  // Entre deux de ses séries, chaque exercice garde au moins son repos habituel : l'autre série (45 s) + le repos de la paire.
  for (const rest of [45, 60, 90]) assert.ok(45 + P.supersetRest({ rest }, { rest }) >= rest);
  assert.strictEqual(P.supersetSeconds(a, b), 3 * (45 + 10 + 45 + 30) + 240);
  assert.strictEqual(P.supersetSeconds(acc(CURL, { sets: 2 }), b), 2 * 130 + (45 + 60) + 240); // la 3e série de B se fait seule
  const alone = P.sessionMinutes([a, b]), paired = P.sessionMinutes([a, b], [[CURL, TRICEPS]]);
  assert.strictEqual(alone, 15);
  assert.strictEqual(paired, 11); // 10,5 min
  assert.strictEqual(P.sessionMinutes([a, { ...b, sets: 0 }], [[CURL, TRICEPS]]), P.sessionMinutes([a])); // partenaire retiré : plus de paire
  // Déroulé complet, série par série, d'après supersetTurn et supersetChain.
  const run = (setsA, setsB) => {
    const A = { done: 0, sets: setsA }, B = { done: 0, sets: setsB }, out = [];
    for (let role; (role = P.supersetTurn(A, B));) {
      const me = role === 'A' ? A : B;
      out.push(`${role}${++me.done}`);
      if (!P.supersetChain(role, A, B) && P.supersetTurn(A, B)) out.push('repos');
    }
    return out.join(' ');
  };
  assert.strictEqual(run(3, 3), 'A1 B1 repos A2 B2 repos A3 B3');
  assert.strictEqual(run(3, 2), 'A1 B1 repos A2 B2 repos A3');
  assert.strictEqual(run(2, 3), 'A1 B1 repos A2 B2 repos B3');
  assert.strictEqual(P.supersetTurn({ done: 2, sets: 2 }, { done: 2, sets: 2 }), null);
  // Série faite dans le désordre (mode liste : B d'abord) : A s'enchaîne, puis repos.
  assert.strictEqual(P.supersetChain('B', { done: 0, sets: 3 }, { done: 1, sets: 3 }), 'A');
  assert.strictEqual(P.supersetChain('A', { done: 1, sets: 3 }, { done: 1, sets: 3 }), null);
});

test('Séance express avec supersets : plus d\'exercices gardés dans le même temps, mouvements principaux entiers, durée tenue', () => {
  // Avant les supersets : même réduction, sans paires (une série de moins, puis retraits en partant de la fin).
  const before = (items, minutes) => {
    const keep = items.map((it) => ({ ...it })), over = () => P.sessionMinutes(keep) > minutes;
    for (const it of keep.slice(2)) if (over() && it.sets > 2) it.sets -= 1;
    const iso = (it) => P.ISOLATION_ZONES.includes(byId.get(it.ex).zone), tail = keep.slice(2).reverse();
    for (const it of [...tail.filter(iso), ...tail.filter((it) => !iso(it))]) if (over()) it.sets = 0;
    return keep.filter((it) => it.sets > 0).length;
  };
  const day = [heavy(SQUAT), heavy(BENCH), acc(ROW), acc(RDL), acc(LATERAL), acc(CURL)];
  assert.strictEqual(P.sessionMinutes(day), 51);
  const plan = P.expressPlan(EXOS, day, 30);
  const kept = day.map((it) => ({ ...it, sets: plan.cut[it.ex] }));
  assert.deepStrictEqual(plan.pairs, [[ROW, RDL]]);
  assert.deepStrictEqual(plan.cut, { [SQUAT]: 4, [BENCH]: 4, [ROW]: 2, [RDL]: 2, [LATERAL]: 0, [CURL]: 0 });
  assert.strictEqual(before(day, 30), 3); // sans superset : un seul accessoire tenait
  assert.ok(P.sessionMinutes(kept, plan.pairs) <= 30);
  assert.ok(P.sessionMinutes(kept) > 30); // sans le superset, ces 4 exercices ne tiendraient pas
  // Sur tous les programmes générés : jamais moins d'exercices ni de séries qu'avant, parfois plus ; toujours dans le temps
  // (sauf si les 2 mouvements principaux le dépassent à eux seuls) ; paires valides, un exercice par paire au plus.
  let more = 0, sessions = 0;
  for (const goal of Object.keys(P.GOALS)) for (const level of Object.keys(P.LEVELS)) for (const minutes of [45, 60, 90]) for (const days of [[0, 2, 4], [5, 0, 3, 1]]) {
    for (const s of generate(EXOS, { ...base, goal, level, minutes, days })) for (const m of [30, 20]) {
      const { cut, pairs: ps } = P.expressPlan(EXOS, s.items, m), left = s.items.map((it) => ({ ...it, sets: cut[it.ex] }));
      const n = left.filter((it) => it.sets > 0).length;
      sessions++;
      assert.ok(n >= before(s.items, m), `${goal} ${level} ${minutes} → ${m} : ${n} exercices contre ${before(s.items, m)}`);
      if (n > before(s.items, m)) more++;
      assert.deepStrictEqual(s.items.slice(0, 2).map((it) => cut[it.ex]), s.items.slice(0, 2).map((it) => it.sets));
      assert.ok(P.sessionMinutes(left, ps) <= m || n === 2);
      assert.strictEqual(new Set(ps.flat()).size, ps.length * 2);
      for (const [x, y] of ps) {
        assert.ok(cut[x] > 0 && cut[y] > 0 && !byId.get(x).main && !byId.get(y).main);
        assert.ok(s.items.findIndex((it) => it.ex === x) >= 2 && s.items.findIndex((it) => it.ex === x) < s.items.findIndex((it) => it.ex === y));
      }
    }
  }
  assert.ok(more > 0, `${more} séances sur ${sessions} gardent un exercice de plus`);
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

// --- Séance libre et exercice ajouté à la volée ---
test('Exercice ajouté : dose du programme (accessoire au-delà des 2 premiers, dose principale réservée aux mouvements principaux, gainage en secondes)', () => {
  const lateral = P.extraItem(EXOS, gym, 348, 5);
  assert.deepStrictEqual(lateral, { slot: 'shoulders', ex: 348, sets: 3, reps: '10-12', rest: 60, added: true });
  assert.deepStrictEqual(P.extraItem(EXOS, gym, 1747, 0), { slot: 'quad', ex: 1747, sets: 4, reps: '8-10', rest: 90, added: true }); // 1er d'une séance libre
  assert.strictEqual(P.extraItem(EXOS, gym, curl.id, 0).rest, 60); // un curl en premier reste un accessoire
  assert.strictEqual(P.extraItem(EXOS, gym, 348, 1).sets, 3);
  assert.strictEqual(P.extraItem(EXOS, gym, 1747, 2).sets, 3); // 3e de la séance : dose d'accessoire, comme au programme
  assert.strictEqual(P.extraItem(EXOS, { ...gym, level: 'debutant' }, 348, 5).sets, 2);
  assert.strictEqual(P.extraItem(EXOS, { ...gym, goal: 'force' }, 1747, 1).reps, '5');
  assert.strictEqual(P.extraItem(EXOS, gym, 458, 3).reps, P.HOLD);
  assert.strictEqual(P.extraItem(EXOS, gym, -1, 0), null);
  // Charge conseillée : l'historique compte, d'où qu'il vienne.
  const sess = sessions(), log = [...sess(squat, 59, [10, 10, 10, 10]), ...sess(squat, 59, [10, 10, 10, 10]), ...sess(squat, 59, [10, 10, 10, 10])];
  assert.strictEqual(P.suggest(squat, P.extraItem(EXOS, gym, squat.id, 0), exerciseHistory(log, squat.id), { loads: LOADS }).kg, 61.5);
});

test('Exercices proposés à l\'ajout : matériel, zones fragiles et exercices écartés respectés, groupés par zone, sans ceux de la séance', () => {
  const groups = P.addable(EXOS, { ...gym, zones: ['knees'], avoid: [348] }, [1747]);
  const all = groups.flatMap((g) => g.list);
  assert.deepStrictEqual(groups.map((g) => g.zone), ['quad', 'hinge', 'chest', 'back', 'shoulders', 'biceps', 'triceps', 'calves', 'abs']);
  assert.ok(groups.every((g) => g.label && g.list.every((e) => e.zone === g.zone)));
  assert.ok(!all.some((e) => e.id === 1747 || e.id === 348 || (e.risk || []).includes('knees')));
  assert.strictEqual(new Set(all.map((e) => e.id)).size, all.length);
  const bw = P.addable(EXOS, { ...gym, equipment: [] }).flatMap((g) => g.list);
  assert.ok(bw.length > 0 && bw.every((e) => e.eq.every((q) => q === 'pdc')));
  assert.ok(!P.addable(EXOS, { ...gym, equipment: [] }).some((g) => g.zone === 'hinge')); // zone sans exercice faisable : pas de groupe vide
});

test('Séance libre : ses séries comptent (historique, records, récupération, reprise), pas la semaine du programme', () => {
  const now = new Date(), t = (min) => new Date(now.getTime() - min * 60000).toISOString(), week = P.monday(now).toISOString();
  const old = [ // séance du programme d'avant : format inchangé (ni free, ni extra)
    { t: '2026-01-05T10:00:00.000Z', type: 'start', session: 'old', day: 0, name: 'Full body' },
    { t: '2026-01-05T10:05:00.000Z', type: 'set', session: 'old', ex: 1747, set: 1, kg: 50, reps: 8 },
    { t: '2026-01-05T10:30:00.000Z', type: 'end', session: 'old' }];
  const free = [
    { t: t(30), type: 'start', session: 'free', name: 'Séance libre', free: true },
    { t: t(29), type: 'set', session: 'free', ex: 1747, set: 1, kg: 55, reps: 8, pr: 'kg' },
    { t: t(28), type: 'set', session: 'free', ex: 1747, set: 2, kg: 55, reps: 8 },
    { t: t(20), type: 'end', session: 'free' }];
  const log = [...old, ...free];
  assert.deepStrictEqual([...P.freeSessions(log)], ['free']);
  assert.strictEqual(P.sessionsDone(log, week).size, 0); // la semaine du programme n'avance pas
  assert.deepStrictEqual(exerciseHistory(log, 1747).map((s) => [s.session, s.sets.length]), [['old', 1], ['free', 2]]);
  assert.strictEqual(P.recordKind(exerciseHistory(log, 1747), 'next', { kg: 55, reps: 9 }), 'reps'); // le record à battre est celui de la séance libre
  assert.strictEqual(P.daysOff(log, now.getTime()), 0);
  assert.ok(P.recovery(log, EXOS, now.getTime())[10] < 100); // quadriceps fatigués
  // La même séance, lancée depuis le programme (day), compte pour la semaine ; avec un exercice ajouté aussi.
  const program = free.map((x) => (x.type === 'start' ? { t: x.t, type: 'start', session: 'free', day: 2, name: 'Full body' } : x));
  const done = P.sessionsDone([...old, ...program, { t: t(27), type: 'set', session: 'free', ex: 348, set: 1, kg: 10, reps: 12 }], week);
  assert.deepStrictEqual([...done.keys()], [2]);
  assert.strictEqual(done.get(2).sets, 3);
  assert.strictEqual(P.sessionsDone(old, P.monday(new Date('2026-01-05T10:00:00.000Z')).toISOString()).get(0).sets, 1); // vieille entrée : toujours lue
});

test('Semaine du programme : séance abandonnée, vide, réinitialisée ou d\'une autre semaine non comptée ; faite en avance comptée pour la suivante', () => {
  const now = new Date(), t = (min) => new Date(now.getTime() - min * 60000).toISOString(), week = P.monday(now).toISOString();
  const next = P.monday(new Date(now.getTime() + 7 * 864e5)).toISOString();
  const one = (id, day, extra = {}) => [{ t: t(10), type: 'start', session: id, day, name: 'x', ...extra }, { t: t(9), type: 'set', session: id, ex: 92, set: 1, kg: 10, reps: 10 }, { t: t(8), type: 'end', session: id }];
  assert.deepStrictEqual([...P.sessionsDone(one('a', 1), week).keys()], [1]);
  assert.strictEqual(P.sessionsDone([...one('a', 1), { t: t(7), type: 'cancel', session: 'a' }], week).size, 0);
  assert.strictEqual(P.sessionsDone(one('a', 1).filter((x) => x.type !== 'set'), week).size, 0);
  assert.strictEqual(P.sessionsDone(one('a', 1).filter((x) => x.type !== 'end'), week).size, 0); // encore en cours
  assert.strictEqual(P.sessionsDone([...one('a', 1), { t: t(7), type: 'session-reset', target: 'a' }], week).size, 0);
  assert.strictEqual(P.sessionsDone([...one('a', 1), { t: t(7), type: 'session-reset', target: 'a' }, { t: t(6), type: 'session-restore', target: 'a' }], week).size, 1);
  assert.strictEqual(P.sessionsDone([...one('a', 1), { t: t(1), type: 'week-reset' }], week).size, 0);
  assert.strictEqual(P.sessionsDone(one('a', 1, { week: next }), week).size, 0);
  assert.strictEqual(P.sessionsDone(one('a', 1, { week: next }), next).size, 1);
});
