// Lecture du journal (le suivi) : séries annulées, séances abandonnées, historique d'un exercice, apprentissage, jours sans séance.

import { DAY } from './catalog.js';

// Journal = entrées horodatées, jamais modifiées :
// { t, type: 'start'|'set'|'feel'|'tech'|'pause'|'resume'|'cancel'|'restore'|'reintegrate'|'end', session?, ex?, set?, kg?, reps?, mode?, feel?, ok? }.
// Une correction = nouvelle entrée ; la dernière saisie d'une série fait foi.

// Séries annulées (« Annuler » juste après la validation) : une entrée undo { target: t de la série } les retire de la lecture ;
// le journal lui-même ne change jamais.
export function withoutUndone(log) {
  const undone = new Set(log.filter((x) => x.type === 'undo').map((x) => x.target));
  return undone.size ? log.filter((x) => !(x.type === 'set' && undone.has(x.t))) : log;
}

// Séances abandonnées : marquées dans le journal (jamais effacées), la dernière entrée cancel/restore fait foi.
export function cancelled(log) {
  const last = new Map();
  for (const x of log) if (x.type === 'cancel' || x.type === 'restore') last.set(x.session, x.type);
  return new Set([...last].filter(([, type]) => type === 'cancel').map(([session]) => session));
}

// Séances passées d'un exercice, de la plus ancienne à la plus récente : [{ session, t, sets, feel, tech, mode }].
export function exerciseHistory(log, exId) {
  const skip = cancelled(log);
  const sessions = new Map();
  for (const entry of withoutUndone(log)) {
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
export function learned(log, exId, past) {
  const since = log.findLast((x) => x.type === 'reintegrate' && x.ex === exId)?.t || '';
  return past.filter((s) => s.t > since).length;
}

// Jours écoulés depuis la dernière série enregistrée (hors séance `current` et séances abandonnées), null si aucune.
export function daysOff(log, now = Date.now(), current = null) {
  const skip = cancelled(log);
  const last = withoutUndone(log).findLast((x) => x.type === 'set' && x.session && x.session !== current && !skip.has(x.session));
  return last ? Math.floor((now - Date.parse(last.t)) / DAY) : null;
}
