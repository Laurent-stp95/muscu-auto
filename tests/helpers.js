// Jeux d'essai communs aux tests.
import { EXOS } from '../src/common.js';
import { exerciseHistory, learned, suggest } from '../src/plan.js';

export const byId = new Map(EXOS.map((e) => [e.id, e]));
export const ids = (plan) => plan.flatMap((s) => s.items.map((it) => it.ex));
export const LOADS = { bar: 19, plates: { 1.25: 2, 2.5: 2, 5: 2, 10: 2, 20: 4 }, halteres: [10], kettlebell: [16], elastiques: [30, 20, 10] };
export const GEAR = ['smith', 'halteres', 'kettlebell', 'banc', 'banc-incline', 'traction', 'elastique', 'tapis'];
export const base = { equipment: GEAR, loads: LOADS, days: [0, 2, 4], goal: 'muscle', level: 'intermediaire', minutes: 60, seed: 1, zones: [], avoid: [] };
// Matériel de Laurent, 4 jours, 45 min.
export const gym = { ...base, days: [5, 0, 3, 1], minutes: 45 };
export const squat = byId.get(1747), curl = byId.get(92);

// Fabrique de séances : chaque appel de sess() est une séance d'un jour de plus (s1 le 1er novembre 2026, s2 le 2…).
export function sessions() {
  let n = 0;
  return (ex, kg, reps, extra = {}) => {
    const session = `s${++n}`, t = `2026-11-${String(n).padStart(2, '0')}T10:00:00Z`;
    return [...reps.map((r, i) => ({ t, type: 'set', session, ex: ex.id, set: i + 1, kg, reps: r, ...(extra.mode && { mode: extra.mode }) })),
      ...(extra.feel ? [{ t, type: 'feel', session, ex: ex.id, feel: extra.feel }] : []),
      ...(extra.tech === false ? [{ t, type: 'tech', session, ex: ex.id, ok: false }] : [])];
  };
}
const item = { sets: 3, reps: '8-10' };
export const tip = (ex, log, extra) => suggest(ex, item, exerciseHistory(log, ex.id), { loads: LOADS, learned: learned(log, ex.id, exerciseHistory(log, ex.id)), ...extra });
