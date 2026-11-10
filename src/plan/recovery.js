// Récupération musculaire d'après les séries récentes.

import { DAY } from './catalog.js';
import { cancelled, withoutUndone } from './journal.js';

// Récupération musculaire : chaque série fatigue ses muscles principaux (1) et secondaires (0,5), la fatigue s'efface avec le temps
// (τ = 30 h : 80 % récupéré après 48 h, 91 % après 72 h) ; 6 séries récentes = muscle à 0 %. Retourne { [muscle]: % récupéré }
// pour les muscles travaillés ces 5 derniers jours (les autres sont à 100 %).
const RECOVERY_TAU = 30 * 3600e3, FULL_FATIGUE = 6;
export function recovery(log, exos, now = Date.now()) {
  const byId = new Map(exos.map((e) => [e.id, e]));
  const skip = cancelled(log);
  const sets = new Map(); // la dernière saisie d'une série fait foi
  for (const x of withoutUndone(log)) if (x.type === 'set' && !skip.has(x.session)) sets.set(`${x.session}|${x.ex}|${x.set}`, x);
  const fatigue = {};
  for (const x of sets.values()) {
    const age = now - Date.parse(x.t), e = byId.get(x.ex);
    if (!e || age < 0 || age > 5 * DAY) continue;
    const decay = Math.exp(-age / RECOVERY_TAU);
    for (const m of e.mus) fatigue[m] = (fatigue[m] || 0) + decay;
    for (const m of e.mus2) fatigue[m] = (fatigue[m] || 0) + 0.5 * decay;
  }
  return Object.fromEntries(Object.entries(fatigue).map(([m, f]) => [m, Math.round(100 * (1 - Math.min(1, f / FULL_FATIGUE)))]));
}
