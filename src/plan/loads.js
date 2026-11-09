// Charges réalisables avec le matériel : barre Smith et disques par côté, poids listés, séries d'approche, matériel à sortir.

import { WEIGHT_LISTS, TAGS } from './catalog.js';

export const roundHalf = (kg) => Math.round(kg * 2) / 2;
export const topKg = (s) => Math.max(0, ...s.sets.map((x) => x.kg || 0));

// Charges réalisables avec le matériel. Smith : barre + paires de disques (un disque de chaque côté).
export function loadable(e, loads) {
  if (e.load === 'smith') {
    const pairs = Object.entries(loads.plates || {}).flatMap(([kg, n]) => Array(Math.floor(n / 2)).fill(Number(kg)));
    let sums = new Set([0]);
    for (const p of pairs) sums = new Set([...sums, ...[...sums].map((s) => s + 2 * p)]);
    return [...sums].map((s) => roundHalf(loads.bar + s)).sort((a, b) => a - b);
  }
  return [...new Set(loads[WEIGHT_LISTS[e.load]] || [])].sort((a, b) => a - b);
}
export const below = (list, kg) => list.findLast((x) => x <= kg) ?? list[0] ?? null;
const nearest = (list, kg) => list.reduce((a, b) => (Math.abs(b - kg) < Math.abs(a - kg) ? b : a), list[0]);

export const kgLabel = (e, kg) => `${e.load === 'elastique' ? 'élastique ' : ''}${kg.toLocaleString('fr-FR')}\u00a0kg`;

// Disques par côté de la barre Smith pour une charge, en gardant le plus possible ceux déjà montés (current, [] = barre nue).
// Retourne { side, remove, add } (disques par côté, du plus lourd au plus léger) ou null si la charge est impossible.
// ponytail: essai de toutes les combinaisons, 2^n avec n = disques par côté (6 ici) ; au-delà de 16, ne garde que le moins de disques.
export function plateChange(current, kg, loads) {
  const target = Math.round(((kg - loads.bar) / 2) * 100) / 100;
  if (target < 0) return null;
  const pairs = Object.entries(loads.plates || {}).flatMap(([w, n]) => Array(Math.floor(n / 2)).fill(Number(w))).sort((a, b) => b - a);
  const mine = pairs.length > 16 ? [] : current || [];
  let best = null;
  for (let mask = 0; mask < 2 ** Math.min(pairs.length, 16); mask++) {
    const side = pairs.filter((_, i) => mask & (1 << i));
    if (Math.abs(side.reduce((a, b) => a + b, 0) - target) > 1e-6) continue;
    const move = { side, remove: minus(mine, side), add: minus(side, mine) };
    const cost = (m) => [m.remove.length + m.add.length, m.side.length];
    const [c, n] = cost(move);
    if (!best || c < cost(best)[0] || (c === cost(best)[0] && n < cost(best)[1])) best = move;
  }
  return best;
}
// a privé de b, en multiensemble : minus([20, 5, 5], [5]) = [20, 5].
function minus(a, b) {
  const left = [...b];
  return a.filter((x) => { const i = left.indexOf(x); if (i < 0) return true; left.splice(i, 1); return false; });
}
// Disques à mettre de chaque côté pour une charge (le moins de disques possible), [] = barre seule, null = impossible.
export const plates = (kg, loads) => plateChange([], kg, loads)?.side ?? null;

// Séries d'approche avant un mouvement principal à la Smith : barre seule × 10, ~50 % × 5, ~70 % × 3. Non enregistrées.
export function warmup(e, kg, loads) {
  if (e.load !== 'smith' || !e.main || kg == null || kg <= loads.bar) return [];
  const list = loadable(e, loads);
  const sets = [];
  for (const [w, reps] of [[loads.bar, 10], [nearest(list, kg * 0.5), 5], [nearest(list, kg * 0.7), 3]]) {
    if (w < kg && (!sets.length || w > sets.at(-1)[0])) sets.push([w, reps]);
  }
  return sets;
}

// Matériel à sortir avant la séance. entries = [{ e, kg }] (kg conseillé, null = à choisir).
// Smith : disques de chaque côté pour la charge la plus lourde ; haltères, kettlebell, élastiques : poids utilisés.
export function gearList(entries, loads) {
  const used = (load) => [...new Set(entries.filter(({ e, kg }) => e.load === load && kg != null).map(({ kg }) => kg))].sort((a, b) => a - b);
  const kgs = (list) => list.length && ` ${list.map((x) => x.toLocaleString('fr-FR')).join(' et ')}\u00a0kg`;
  const tags = new Set(entries.flatMap(({ e }) => e.eq));
  return Object.entries(TAGS).filter(([q]) => tags.has(q)).map(([q, label]) => {
    if (q === 'smith') {
      const top = used('smith').at(-1);
      const side = top != null && plates(top, loads);
      return side?.length ? `${label} (jusqu'à ${side.map((w) => w.toLocaleString('fr-FR')).join(' + ')}\u00a0kg de chaque côté)` : label;
    }
    return `${label}${(WEIGHT_LISTS[q] && kgs(used(q))) || ''}`;
  });
}
