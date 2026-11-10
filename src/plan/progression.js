// Progression des charges : cycle de 6 semaines, charge conseillée, répétitions en réserve et prévues, records, reprise.

import { DAY, CYCLE_WEEKS, ISOLATION_ZONES, LEVELS, LEARNING, isBodyweight } from './catalog.js';
import { roundHalf, loadable, topKg, below, kgLabel } from './loads.js';

// --- Cycle ---
export function monday(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
// cycle = { start: lundi du début (ISO) }. week > CYCLE_WEEKS : cycle terminé.
export function cycleWeek(cycle, now = new Date()) {
  const week = Math.floor((monday(now) - monday(cycle.start)) / (7 * DAY)) + 1;
  return { week, deload: week === CYCLE_WEEKS, ended: week > CYCLE_WEEKS };
}

export const range = (reps) => { const [lo, hi = lo] = String(reps).split('-').map(Number); return [lo, hi]; };

// Répétitions gardées en réserve : jamais moins de 2 sur les mouvements qui font travailler plusieurs articulations.
export const rir = (e, level) => (ISOLATION_ZONES.includes(e.zone) ? LEVELS[level].rir : Math.max(2, LEVELS[level].rir));

// Charge conseillée pour la prochaine séance. ctx = { loads, learned, deload, hold, comeback (ratio de reprise ou null) }.
// Retourne { kg (null = à choisir), note, mode ('normal'|'tempo'|'pause', à enregistrer avec les séries), plafond, learning }.
// hold = forme moyenne au point de forme : la charge n'augmente pas aujourd'hui.
export function suggest(e, item, past, { loads, learned: done = past.length, deload = false, hold = false, comeback: back = null }) {
  const [lo, hi] = range(item.reps);
  const list = loadable(e, loads);
  const unit = e.unit === 's' ? 's' : 'répétitions';
  const last = past.at(-1);
  const same = (kg, note, extra) => ({ kg, note, mode: 'normal', plafond: false, learning: null, ...extra });
  if (!last) {
    return same(e.load === 'smith' ? null : list[0] ?? null, e.load === 'smith'
      ? `Séance 1 sur ${LEARNING} pour apprendre le geste : commence léger (barre seule si besoin), garde au moins 3 répétitions en réserve. La charge augmentera ensuite.`
      : `Séance 1 sur ${LEARNING} pour apprendre le geste : concentre-toi sur le mouvement, garde au moins 3 répétitions en réserve.`, { learning: 1 });
  }
  const kg = isBodyweight(e) ? null : topKg(last) || null;
  const lighter = (ratio) => (kg == null ? null : e.load === 'smith' ? below(list, kg * ratio) : below(list, Math.min(kg * ratio, kg - 0.01)) ?? kg);
  if (last.feel === 'pain') return same(lighter(0.8), 'Douleur signalée : charge réduite. Si elle revient, arrête cet exercice.');
  if (back) return same(lighter(back), `Reprise après une pause : charge −${Math.round((1 - back) * 100)} % aujourd'hui, la progression repart ensuite.`);
  if (deload) return same(lighter(0.9), 'Semaine allégée : moitié moins de séries, charge −10 %. Laisse ton corps récupérer.');
  if (done < LEARNING) return same(kg, `Séance ${done + 1} sur ${LEARNING} pour apprendre le geste : même charge que la dernière fois, soigne la technique. La charge augmentera ensuite.`, { learning: done + 1 });
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
    if (((next - kg) / kg <= 0.1 || all(hi + 2)) && hold) return same(kg, "Forme moyenne aujourd'hui : même charge, l'augmentation attendra la prochaine séance.");
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

// Répétitions prévues pour une série : une de plus que la même série la dernière fois à la même charge, dans la fourchette.
export function targetReps(item, past, kg, set, unit) {
  const [lo, hi] = range(item.reps);
  const prev = past.at(-1)?.sets.find((x) => x.set === set);
  if (!prev || (kg != null && prev.kg !== kg)) return lo;
  return Math.min(hi, Math.max(lo, prev.reps + (unit === 's' ? 5 : 1)));
}

// Record personnel : charge jamais atteinte, ou plus de répétitions (secondes) qu'avant à la meilleure charge.
// history = séances de l'exercice avant cette série (séance en cours comprise) ; jamais de record à la première séance.
export function recordKind(history, sid, set) {
  if (!history.some((s) => s.session !== sid)) return null;
  const sets = history.flatMap((s) => s.sets);
  const best = Math.max(0, ...sets.map((x) => x.kg || 0));
  const kg = set.kg || 0;
  if (kg > best) return 'kg';
  return kg === best && set.reps > Math.max(0, ...sets.filter((x) => (x.kg || 0) === best).map((x) => x.reps)) ? 'reps' : null;
}

// Reprise après une pause : charges réduites le temps d'une séance (2 semaines : −10 %, 4 semaines : −20 %).
export const comeback = (days) => (days >= 28 ? 0.8 : days >= 14 ? 0.9 : null);

// Courbe indicative sur `weeks` semaines au rythme du niveau.
export function project(kg, level, weeks = 8) {
  return Array.from({ length: weeks }, (_, w) => roundHalf(kg * (1 + LEVELS[level].weekly) ** (w + 1)));
}
