// Génération du programme de la semaine : tirage des exercices, remplacement, réparation, renouvellement de fin de cycle,
// équilibre poussée / tirage, durée et séance express.

import { BODYWEIGHT, WEIGHT_LISTS, TOP, GOALS, LEVELS, HOLD, SPLITS_BACK_TO_BACK, SPLITS, SESSIONS, SLOTS, ISOLATION_ZONES } from './catalog.js';
import { loadable } from './loads.js';
import { supersets, supersetSeconds, EFFORT, SETUP } from './supersets.js';

function rng(seed) {
  // mulberry32 : même graine = même programme
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const family = (e) => e.fam || e.id;

// Matériel coché sans poids renseigné (haltères sans aucun poids, par exemple) = pas faisable.
export function available(exos, { equipment, loads = {}, zones = [], avoid = [] }) {
  const own = new Set([...equipment, BODYWEIGHT]);
  return exos.filter((e) => e.eq.every((q) => own.has(q)) && !avoid.includes(e.id) && !(e.risk || []).some((z) => zones.includes(z))
    && (!WEIGHT_LISTS[e.load] || loadable(e, loads).length > 0));
}

// Les 2 premiers exercices (main) sont les plus chargés : exercices marqués principaux si possible.
function candidates(pool, slot, main) {
  const cands = pool.filter((e) => slot.zones.includes(e.zone));
  const heavy = main ? cands.filter((e) => e.main) : [];
  return heavy.length ? heavy : cands;
}

// Évite une même famille dans la séance, et si possible un même exercice dans la semaine.
function pick(cands, sessionFamilies, weekIds, rand) {
  const fresh = cands.filter((e) => !sessionFamilies.has(family(e)));
  const unseen = fresh.filter((e) => !weekIds.has(e.id));
  const best = (unseen.length ? unseen : fresh).slice(0, TOP);
  return best.length ? best[Math.floor(rand() * best.length)] : null;
}

function prescription(goal, level, index, e) {
  const [sets, reps, rest] = GOALS[goal][index < 2 ? 'main' : 'acc'];
  return { sets: Math.max(2, sets + LEVELS[level].sets), reps: e.unit === 's' ? HOLD : reps, rest };
}

// Exercice ajouté à la volée (séance du programme en cours, ou séance libre) : même dose qu'au programme. index = sa place dans
// la séance ; les 2 premiers ne prennent la dose des mouvements principaux que s'ils en sont (marqués main).
// Retourne { slot, ex, sets, reps, rest, added: true }, null si l'exercice n'existe pas.
export function extraItem(exos, config, exId, index) {
  const e = exos.find((x) => x.id === exId);
  if (!e) return null;
  const heavy = index < 2 && !!e.main;
  return { slot: e.zone, ex: e.id, ...prescription(config.goal, config.level, heavy ? 0 : 2, e), added: true };
}
// Exercices proposés à l'ajout : faisables (matériel, charges, zones fragiles, exercices écartés), hors ceux déjà dans la séance
// (present = identifiants), groupés par zone dans l'ordre des créneaux. Retourne [{ zone, label, list: [exercice] }].
export function addable(exos, config, present = []) {
  const pool = available(exos, config).filter((e) => !present.includes(e.id));
  return Object.entries(SLOTS).filter(([, slot]) => slot.zones.length === 1)
    .map(([zone, slot]) => ({ zone, label: slot.label, list: pool.filter((e) => e.zone === zone) })).filter((g) => g.list.length);
}

export const backToBack = (days) => days.some((d) => days.includes((d + 1) % 7));
export const exerciseCount = (minutes) => Math.min(7, Math.max(4, Math.round(minutes / 15) + 2));

// days = jours choisis (0 = lundi). Retourne [{ day, name, items: [{ slot, ex, sets, reps, rest }] }].
export function generate(exos, config) {
  const { days, goal, level, minutes, seed } = config;
  const rand = rng(seed);
  const pool = available(exos, config);
  const count = exerciseCount(minutes);
  const split = (backToBack(days) && SPLITS_BACK_TO_BACK[days.length]) || SPLITS[days.length];
  const weekIds = new Set();

  return [...days].sort().map((day, i) => {
    const session = SESSIONS[split[i]];
    const families = new Set();
    const items = [];
    for (const slot of session.slots) {
      if (items.length >= count) break;
      const ex = pick(candidates(pool, SLOTS[slot], items.length < 2), families, weekIds, rand);
      if (!ex) continue; // rien de faisable avec ce matériel : créneau suivant
      families.add(family(ex));
      weekIds.add(ex.id);
      items.push({ slot, ex: ex.id, ...prescription(goal, level, items.length, ex) });
    }
    return { day, name: session.name, items };
  });
}

// Remplace un exercice par un autre du même créneau. Modifie plan en place, retourne false si aucun autre choix.
export function swap(exos, plan, config, dayIndex, itemIndex, rand = Math.random) {
  const session = plan[dayIndex];
  const item = session.items[itemIndex];
  const byId = new Map(exos.map((e) => [e.id, e]));
  const families = new Set(session.items.filter((it) => it !== item).map((it) => family(byId.get(it.ex))));
  const weekIds = new Set(plan.flatMap((s) => s.items.map((it) => it.ex)));
  const ex = pick(candidates(available(exos, config), SLOTS[item.slot], itemIndex < 2).filter((e) => e.id !== item.ex), families, weekIds, rand);
  if (!ex) return false;
  Object.assign(item, { ex: ex.id, ...prescription(config.goal, config.level, itemIndex, ex) });
  return true;
}

// Matériel ou zones changés : remplace ce qui n'est plus faisable, garde le reste (le cycle continue).
export function repair(exos, plan, config) {
  const ok = new Set(available(exos, config).map((e) => e.id));
  plan.forEach((s, d) => {
    for (let i = s.items.length - 1; i >= 0; i--) {
      if (!ok.has(s.items[i].ex) && !swap(exos, plan, config, d, i)) s.items.splice(i, 1);
    }
  });
  return plan;
}

// Fin de cycle : mêmes mouvements principaux (la progression continue), exercices secondaires renouvelés, poussée / tirage rééquilibrés.
export function renew(exos, plan, config, rand) {
  const byId = new Map(exos.map((e) => [e.id, e]));
  plan.forEach((s, d) => s.items.forEach((it, i) => { if (!byId.get(it.ex)?.main) swap(exos, plan, config, d, i, rand); }));
  return balance(exos, plan, config, rand);
}

// Poussée (pectoraux, épaules, triceps) contre tirage (dos, biceps) : trop de poussée use les épaules.
export const PUSH_ZONES = ['chest', 'shoulders', 'triceps'], PULL_ZONES = ['back', 'biceps'];
export const pushPull = (exos, plan) => {
  const zone = new Map(exos.map((e) => [e.id, e.zone]));
  const items = plan.flatMap((s) => s.items);
  return { push: items.filter((it) => PUSH_ZONES.includes(zone.get(it.ex))).length, pull: items.filter((it) => PULL_ZONES.includes(zone.get(it.ex))).length };
};
// Tant que la semaine compte 2 exercices de poussée de plus que de tirage, le dernier exercice secondaire de poussée devient un exercice de dos.
export function balance(exos, plan, config, rand) {
  const zone = new Map(exos.map((e) => [e.id, e.zone]));
  for (let guard = 0; guard < 4; guard++) {
    const { push, pull } = pushPull(exos, plan);
    if (push - pull < 2) break;
    const spot = plan.flatMap((s, d) => s.items.map((it, i) => ({ it, d, i }))).filter(({ it, i }) => i >= 2 && PUSH_ZONES.includes(zone.get(it.ex))).at(-1);
    if (!spot) break;
    const slot = spot.it.slot;
    spot.it.slot = 'back';
    if (!swap(exos, plan, config, spot.d, spot.i, rand)) { spot.it.slot = slot; break; }
  }
  return plan;
}

// Durée estimée d'une séance, en minutes. Un exercice : séries × (45 s d'effort + repos) + 2 min de mise en place (charge,
// réglages) ; un exercice sans série (retiré) ne compte pas. pairs = supersets [[exA, exB]] : un seul repos par tour (supersetSeconds).
export function sessionMinutes(items, pairs = []) {
  const live = new Map(items.filter((it) => it.sets > 0).map((it) => [it.ex, it]));
  let seconds = 0;
  for (const [a, b] of pairs) {
    if (!live.has(a) || !live.has(b)) continue;
    seconds += supersetSeconds(live.get(a), live.get(b));
    live.delete(a);
    live.delete(b);
  }
  for (const it of live.values()) seconds += it.sets * (EFFORT + it.rest) + SETUP;
  return Math.round(seconds / 60);
}

// Séance express : tenir en `minutes`. Les 2 premiers exercices (les plus lourds) restent entiers. D'abord des supersets parmi
// les suivants (supersets.js : le repos gagné évite de retirer des exercices) ; si ça ne suffit pas, une série de moins aux
// suivants (2 minimum), puis on retire les exercices d'isolation en partant de la fin, puis les autres. Les paires sont
// refaites à chaque retrait : un exercice qui perd son partenaire en retrouve un si possible.
// items = [{ ex, sets, rest, kg? }] ; retourne { cut: { [ex]: séries gardées } (0 = exercice retiré aujourd'hui), pairs: [[exA, exB]] }.
export function expressPlan(exos, items, minutes) {
  const zone = new Map(exos.map((e) => [e.id, e.zone]));
  const keep = items.map((it) => ({ ...it }));
  const cut = () => Object.fromEntries(keep.map((it) => [it.ex, it.sets]));
  if (sessionMinutes(keep) <= minutes) return { cut: cut(), pairs: [] }; // la séance tient déjà : rien à changer
  const over = () => sessionMinutes(keep, supersets(exos, keep)) > minutes;
  for (const it of keep.slice(2)) if (over() && it.sets > 2) it.sets -= 1;
  const tail = keep.slice(2).reverse();
  for (const it of [...tail.filter((x) => ISOLATION_ZONES.includes(zone.get(x.ex))), ...tail.filter((x) => !ISOLATION_ZONES.includes(zone.get(x.ex)))]) if (over()) it.sets = 0;
  return { cut: cut(), pairs: supersets(exos, keep) };
}
export const express = (exos, items, minutes) => expressPlan(exos, items, minutes).cut;
