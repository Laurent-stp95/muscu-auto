// Générateur de séances et règles de progression. Exercices = liste.json (via data.js), matériel = étiquettes ci-dessous.

const BODYWEIGHT = 'pdc';
const TAGS = { smith: 'Smith machine', halteres: 'Haltères', kettlebell: 'Kettlebell', banc: 'Banc plat', 'banc-incline': 'Banc inclinable',
  traction: 'Barre de traction', elastique: 'Élastiques', tapis: 'Tapis' };
const TOP = 6; // tirage au hasard parmi 6 candidats
const LEARNING = 2; // séances d'apprentissage sans augmentation, pour tout exercice nouveau ou réintégré
const CYCLE_WEEKS = 6; // 5 semaines de travail + 1 semaine allégée

// Un créneau = une ou plusieurs zones de liste.json.
const SLOTS = {
  quad: { label: 'Quadriceps', zones: ['quad'] },
  hinge: { label: 'Ischios et fessiers', zones: ['hinge'] },
  chest: { label: 'Pectoraux', zones: ['chest'] },
  back: { label: 'Dos', zones: ['back'] },
  shoulders: { label: 'Épaules', zones: ['shoulders'] },
  arms: { label: 'Bras', zones: ['biceps', 'triceps'] },
  biceps: { label: 'Biceps', zones: ['biceps'] },
  triceps: { label: 'Triceps', zones: ['triceps'] },
  calves: { label: 'Mollets', zones: ['calves'] },
  abs: { label: 'Abdos', zones: ['abs'] },
};

// Créneaux par ordre de priorité : une séance courte garde les premiers.
const SESSIONS = {
  full: { name: 'Full body', slots: ['quad', 'chest', 'back', 'hinge', 'shoulders', 'arms', 'abs'] },
  upper: { name: 'Haut du corps', slots: ['chest', 'back', 'shoulders', 'back', 'chest', 'biceps', 'triceps'] },
  lower: { name: 'Bas du corps', slots: ['quad', 'hinge', 'quad', 'hinge', 'calves', 'abs', 'abs'] },
  push: { name: 'Poussée', slots: ['chest', 'shoulders', 'chest', 'triceps', 'shoulders', 'triceps', 'abs'] },
  pull: { name: 'Tirage', slots: ['back', 'back', 'biceps', 'back', 'biceps', 'abs', 'abs'] },
};

// Répartition selon le nombre de jours (index). 7 jours exclu : un jour de repos minimum.
const SPLITS = [
  [],
  ['full'],
  ['full', 'full'],
  ['full', 'full', 'full'],
  ['upper', 'lower', 'upper', 'lower'],
  ['push', 'pull', 'lower', 'upper', 'lower'],
  ['push', 'pull', 'lower', 'push', 'pull', 'lower'],
];
// Jours consécutifs : jamais deux séances d'affilée sur les mêmes muscles (48 h de récupération).
const SPLITS_BACK_TO_BACK = { 2: ['upper', 'lower'], 3: ['push', 'pull', 'lower'] };
const MAX_DAYS = 6;

// [séries, répétitions, repos en s] pour les 2 premiers exercices (main) puis les suivants (acc).
const GOALS = {
  muscle: { label: 'Prise de muscle', hint: '8 à 12 répétitions, le plus polyvalent', main: [4, '8-10', 90], acc: [3, '10-12', 60] },
  force: { label: 'Force', hint: 'Charges lourdes, peu de répétitions', main: [5, '5', 180], acc: [3, '8', 90] },
  endurance: { label: 'Endurance', hint: 'Plus de répétitions, repos courts', main: [3, '15-20', 45], acc: [3, '15-20', 45] },
};
const HOLD = '30-45'; // gainage, en secondes

// rir = répétitions gardées en réserve, sets = séries en plus ou en moins, weekly = progression indicative par semaine.
const LEVELS = {
  debutant: { label: 'Débutant', hint: "Moins de 6 mois d'entraînement", rir: 3, sets: -1, weekly: 0.025 },
  intermediaire: { label: 'Intermédiaire', hint: '6 mois à 2 ans', rir: 2, sets: 0, weekly: 0.015 },
  confirme: { label: 'Confirmé', hint: 'Plus de 2 ans', rir: 1, sets: 0, weekly: 0.0075 },
};
// Zones fragiles : les exercices marqués `risk` dans liste.json sont écartés.
const ZONES = { shoulders: 'Épaules', elbows: 'Coudes', wrists: 'Poignets', back: 'Bas du dos', knees: 'Genoux' };
const ISOLATION_ZONES = ['biceps', 'triceps', 'calves', 'abs'];

// Consigne générale par zone, quand l'exercice n'a pas les siennes.
const CUES = {
  quad: "Genoux dans l'axe des pieds, dos neutre ; descends tant que le dos reste droit.",
  hinge: 'Dos neutre du début à la fin, le mouvement vient des hanches.',
  chest: 'Omoplates serrées, coudes à 45° du buste, descente contrôlée.',
  back: "Dos neutre, tire avec les coudes, pas d'élan ni d'à-coups.",
  shoulders: 'Charge légère, gainage serré ; arrête si ça pince en haut.',
  biceps: 'Coudes fixes, sans élan, amplitude complète.',
  triceps: 'Coudes fixes, sans élan, amplitude complète.',
  calves: 'Amplitude complète, pause en haut, sans rebond.',
  abs: 'Bas du dos plaqué, nuque relâchée, expire en contractant.',
};

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
function available(exos, { equipment, loads = {}, zones = [], avoid = [] }) {
  const own = new Set([...equipment, BODYWEIGHT]);
  return exos.filter((e) => e.eq.every((q) => own.has(q)) && !avoid.includes(e.id) && !(e.risk || []).some((z) => zones.includes(z))
    && (!['halteres', 'kettlebell', 'elastique'].includes(e.load) || loadable(e, loads).length > 0));
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

const backToBack = (days) => days.some((d) => days.includes((d + 1) % 7));
const exerciseCount = (minutes) => Math.min(7, Math.max(4, Math.round(minutes / 15) + 2));

// days = jours choisis (0 = lundi). Retourne [{ day, name, items: [{ slot, ex, sets, reps, rest }] }].
function generate(exos, config) {
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
function swap(exos, plan, config, dayIndex, itemIndex, rand = Math.random) {
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
function repair(exos, plan, config) {
  const ok = new Set(available(exos, config).map((e) => e.id));
  plan.forEach((s, d) => {
    for (let i = s.items.length - 1; i >= 0; i--) {
      if (!ok.has(s.items[i].ex) && !swap(exos, plan, config, d, i)) s.items.splice(i, 1);
    }
  });
  return plan;
}

// Fin de cycle : mêmes mouvements principaux (la progression continue), exercices secondaires renouvelés.
function renew(exos, plan, config, rand) {
  const byId = new Map(exos.map((e) => [e.id, e]));
  plan.forEach((s, d) => s.items.forEach((it, i) => { if (!byId.get(it.ex)?.main) swap(exos, plan, config, d, i, rand); }));
  return plan;
}

// --- Cycle ---
const DAY = 864e5;
function monday(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
// cycle = { start: lundi du début (ISO) }. week > CYCLE_WEEKS : cycle terminé.
function cycleWeek(cycle, now = new Date()) {
  const week = Math.floor((monday(now) - monday(cycle.start)) / (7 * DAY)) + 1;
  return { week, deload: week === CYCLE_WEEKS, ended: week > CYCLE_WEEKS };
}

// --- Suivi ---
// Journal = entrées horodatées, jamais modifiées :
// { t, type: 'start'|'set'|'feel'|'tech'|'pause'|'resume'|'cancel'|'restore'|'reintegrate'|'end', session?, ex?, set?, kg?, reps?, mode?, feel?, ok? }.
// Une correction = nouvelle entrée ; la dernière saisie d'une série fait foi.

// Séances abandonnées : marquées dans le journal (jamais effacées), la dernière entrée cancel/restore fait foi.
function cancelled(log) {
  const last = new Map();
  for (const x of log) if (x.type === 'cancel' || x.type === 'restore') last.set(x.session, x.type);
  return new Set([...last].filter(([, type]) => type === 'cancel').map(([session]) => session));
}

// Séances passées d'un exercice, de la plus ancienne à la plus récente : [{ session, t, sets, feel, tech, mode }].
function exerciseHistory(log, exId) {
  const skip = cancelled(log);
  const sessions = new Map();
  for (const entry of log) {
    if (entry.ex !== exId || !entry.session || skip.has(entry.session)) continue;
    const s = sessions.get(entry.session) || { session: entry.session, t: entry.t, sets: {}, feel: null, tech: null, mode: 'normal' };
    if (entry.type === 'set') {
      s.sets[entry.set] = { set: entry.set, kg: entry.kg, reps: entry.reps, t: entry.t };
      s.mode = entry.mode || 'normal';
    }
    if (entry.type === 'feel') s.feel = entry.feel;
    if (entry.type === 'tech') s.tech = entry.ok;
    sessions.set(entry.session, s);
  }
  return [...sessions.values()]
    .map((s) => ({ ...s, sets: Object.values(s.sets) }))
    .filter((s) => s.sets.length)
    .sort((a, b) => a.t.localeCompare(b.t));
}

// Séances faites depuis l'ajout ou la dernière réintégration : < LEARNING = en apprentissage.
function learned(log, exId, past) {
  const since = log.findLast((x) => x.type === 'reintegrate' && x.ex === exId)?.t || '';
  return past.filter((s) => s.t > since).length;
}

const range = (reps) => { const [lo, hi = lo] = String(reps).split('-').map(Number); return [lo, hi]; };
const roundHalf = (kg) => Math.round(kg * 2) / 2;
const topKg = (s) => Math.max(0, ...s.sets.map((x) => x.kg || 0));

// Charges réalisables avec le matériel. Smith : barre + paires de disques (un disque de chaque côté).
function loadable(e, loads) {
  if (e.load === 'smith') {
    const pairs = Object.entries(loads.plates || {}).flatMap(([kg, n]) => Array(Math.floor(n / 2)).fill(Number(kg)));
    let sums = new Set([0]);
    for (const p of pairs) sums = new Set([...sums, ...[...sums].map((s) => s + 2 * p)]);
    return [...sums].map((s) => roundHalf(loads.bar + s)).sort((a, b) => a - b);
  }
  return [...new Set(loads[{ halteres: 'halteres', kettlebell: 'kettlebell', elastique: 'elastiques' }[e.load]] || [])].sort((a, b) => a - b);
}
const below = (list, kg) => list.findLast((x) => x <= kg) ?? list[0] ?? null;
const nearest = (list, kg) => list.reduce((a, b) => (Math.abs(b - kg) < Math.abs(a - kg) ? b : a), list[0]);

// Répétitions gardées en réserve : jamais moins de 2 sur les mouvements qui font travailler plusieurs articulations.
const rir = (e, level) => (ISOLATION_ZONES.includes(e.zone) ? LEVELS[level].rir : Math.max(2, LEVELS[level].rir));

// Charge conseillée pour la prochaine séance. ctx = { loads, learned, deload }.
// Retourne { kg (null = à choisir), note, mode ('normal'|'tempo'|'pause', à enregistrer avec les séries), plafond, learning }.
function suggest(e, item, past, { loads, learned: done = past.length, deload = false }) {
  const [lo, hi] = range(item.reps);
  const list = loadable(e, loads);
  const unit = e.unit === 's' ? 's' : 'répétitions';
  const last = past.at(-1);
  const same = (kg, note, extra) => ({ kg, note, mode: 'normal', plafond: false, learning: null, ...extra });
  if (!last) {
    return same(e.load === 'smith' ? null : list[0] ?? null, e.load === 'smith'
      ? `Apprentissage 1/${LEARNING} : commence léger (barre seule si besoin) et garde au moins 3 répétitions en réserve.`
      : `Apprentissage 1/${LEARNING} : concentre-toi sur le geste, garde au moins 3 répétitions en réserve.`, { learning: 1 });
  }
  const kg = e.load === 'pdc' ? null : topKg(last) || null;
  const lighter = (ratio) => (kg == null ? null : e.load === 'smith' ? below(list, kg * ratio) : below(list, Math.min(kg * ratio, kg - 0.01)) ?? kg);
  if (last.feel === 'pain') return same(lighter(0.8), 'Douleur signalée : charge réduite. Si elle revient, arrête cet exercice.');
  if (deload) return same(lighter(0.9), 'Semaine allégée : moitié moins de séries, charge −10 %. Laisse ton corps récupérer.');
  if (done < LEARNING) return same(kg, `Apprentissage ${done + 1}/${LEARNING} : même charge, soigne la technique.`, { learning: done + 1 });
  if (last.tech === false) return same(kg, 'Technique à revoir : même charge. Filme-toi pour vérifier.');
  const missed = (s) => s.sets.some((x) => x.reps < lo);
  if (missed(last) && past.length > 1 && missed(past.at(-2))) return same(lighter(0.9), "Deux séances sous l'objectif : charge allégée.");
  if (missed(last) || last.feel === 'hard') return same(kg, `Même charge, vise ${item.reps} ${unit} propres.`);
  if (last.sets.length < item.sets) return same(kg, `Même charge : termine ${item.sets > 1 ? `les ${item.sets} séries` : 'ta série'} avant d'augmenter.`);

  const all = (n) => last.sets.every((x) => x.reps >= n);
  const next = kg == null ? null : list.find((x) => x > kg);
  if (next != null) {
    if (!all(hi)) return same(kg, `Même charge, ajoute une répétition par série (objectif ${hi}).`);
    // Saut de plus de 10 % : on gagne d'abord 2 répétitions de marge.
    if ((next - kg) / kg <= 0.1 || all(hi + 2)) return same(next, `Toutes les séries à ${hi} ${unit} : passe à ${kgLabel(e, next)}.`);
    return same(kg, `Le palier suivant (${kgLabel(e, next)}) dépasse 10 % : monte d'abord à ${hi + 2} répétitions par série.`);
  }
  // Plus de charge disponible (ou poids du corps) : répétitions, puis descente lente, puis pause, puis plafond.
  if (e.unit === 's') {
    return all(60) ? same(kg, 'Plafond : 60 s tenues. Passe à une variante plus dure (Remplacer).', { plafond: true })
      : same(kg, 'Ajoute 5 secondes par série.');
  }
  const ceiling = Math.max(hi, Math.min(20, hi + 6));
  if (last.mode === 'pause') {
    return all(hi) ? same(kg, 'Plafond avec ton matériel : passe à une variante plus dure (Remplacer) ou à la Smith.', { mode: 'pause', plafond: true })
      : same(kg, `Descente lente et pause de 2 s en bas, vise ${item.reps} répétitions.`, { mode: 'pause' });
  }
  if (last.mode === 'tempo') {
    return all(hi) ? same(kg, 'Garde la descente lente et ajoute une pause de 2 s en bas.', { mode: 'pause' })
      : same(kg, `Descente lente (3 s) à chaque répétition, vise ${item.reps}.`, { mode: 'tempo' });
  }
  return all(ceiling) ? same(kg, `${ceiling} répétitions atteintes : passe à une descente lente (3 s), vise ${item.reps}.`, { mode: 'tempo' })
    : same(kg, `Ajoute une répétition par série (jusqu'à ${ceiling}).`);
}

const kgLabel = (e, kg) => `${e.load === 'elastique' ? 'élastique ' : ''}${kg.toLocaleString('fr-FR')}\u00a0kg`;

// Séries d'approche avant un mouvement principal à la Smith : barre seule × 10, ~50 % × 5, ~70 % × 3. Non enregistrées.
function warmup(e, kg, loads) {
  if (e.load !== 'smith' || !e.main || kg == null || kg <= loads.bar) return [];
  const list = loadable(e, loads);
  const sets = [];
  for (const [w, reps] of [[loads.bar, 10], [nearest(list, kg * 0.5), 5], [nearest(list, kg * 0.7), 3]]) {
    if (w < kg && (!sets.length || w > sets.at(-1)[0])) sets.push([w, reps]);
  }
  return sets;
}

// Courbe indicative sur `weeks` semaines au rythme du niveau.
function project(kg, level, weeks = 8) {
  return Array.from({ length: weeks }, (_, w) => roundHalf(kg * (1 + LEVELS[level].weekly) ** (w + 1)));
}

if (typeof module !== 'undefined') {
  module.exports = { generate, exerciseCount, backToBack, swap, repair, renew, available, cancelled, exerciseHistory, learned, loadable, suggest, warmup, rir, cycleWeek, monday, project,
    kgLabel, range, SLOTS, SESSIONS, GOALS, LEVELS, ZONES, CUES, TAGS, BODYWEIGHT, MAX_DAYS, LEARNING, CYCLE_WEEKS };
}
