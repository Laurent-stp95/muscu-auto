// Supersets de la séance express : deux exercices enchaînés sans repos entre les deux, repos (court) après la paire. Le temps
// gagné permet de garder plus d'exercices dans le temps imparti. Choix des paires, tour de rôle, durée.

// Zones par groupe : deux exercices du même groupe se gênent (pectoraux puis triceps, dos puis biceps), sauf dans les jambes
// quand les muscles diffèrent (quadriceps puis ischios, mollets).
const GROUP = { chest: 'push', shoulders: 'push', triceps: 'push', back: 'pull', biceps: 'pull', quad: 'legs', hinge: 'legs', calves: 'legs', abs: 'core' };
// Muscles antagonistes : le meilleur superset, l'un récupère pendant que l'autre travaille.
const ANTAGONISTS = [['chest', 'back'], ['shoulders', 'back'], ['biceps', 'triceps'], ['quad', 'hinge']];
const TRANSITION = 10; // secondes pour passer d'un exercice à l'autre, sans repos
export const EFFORT = 45, SETUP = 120; // secondes : une série, la mise en place d'un exercice (charge, réglages)

// Aucun muscle principal de l'un n'est travaillé par l'autre, même en secondaire.
const overlap = (a, b) => a.mus.some((m) => b.mus.includes(m) || b.mus2.includes(m)) || b.mus.some((m) => a.mus2.includes(m));
// Même barre : les deux exercices à la Smith ne s'enchaînent que si la charge est la même (changer les disques, ou la hauteur
// de la barre pour un exercice au poids du corps dessous, prend le temps d'un repos). Charge inconnue : pas de paire.
const sameBar = (a, b) => a.e.eq.includes('smith') && b.e.eq.includes('smith')
  && !(a.e.load === 'smith' && b.e.load === 'smith' && a.kg != null && a.kg === b.kg);

// Zone d'effort : un exercice rangé aux épaules qui ne travaille pas les deltoïdes (haussements, oiseau : trapèzes) tire comme le dos.
const zoneOf = (e) => (e.zone === 'shoulders' && !e.mus.includes(2) ? 'back' : e.zone);

// Intérêt d'une paire : 3 = antagonistes, 2 = haut et bas du corps, 1 = sans recouvrement (abdos, mollets…), 0 = à ne pas apparier.
export function supersetScore(a, b) {
  const za = zoneOf(a.e), zb = zoneOf(b.e);
  if (za === zb || overlap(a.e, b.e) || sameBar(a, b)) return 0;
  const ga = GROUP[za], gb = GROUP[zb];
  if (ANTAGONISTS.some(([x, y]) => (za === x && zb === y) || (za === y && zb === x))) return 3;
  if (ga === gb) return ga === 'legs' ? 1 : 0;
  return (ga === 'legs') !== (gb === 'legs') && ga !== 'core' && gb !== 'core' ? 2 : 1;
}

// Paires d'une séance. items = [{ ex, sets, rest, kg? }] dans l'ordre de la séance (kg = charge du jour, pour la règle de la barre).
// Jamais les 2 premiers exercices ni un mouvement principal (lourds : ils gardent leur repos entier), ni un exercice retiré
// (sets à 0). Les antagonistes d'abord, puis haut / bas, puis le reste ; à intérêt égal, les plus proches dans la séance.
// Retourne [[exA, exB]], A avant B dans la séance.
export function supersets(exos, items) {
  const byId = new Map(exos.map((e) => [e.id, e]));
  const free = items.map((it, i) => ({ ...it, i, e: byId.get(it.ex) })).filter((x) => x.i >= 2 && x.e && !x.e.main && x.sets > 0);
  const pairs = [];
  for (const want of [3, 2, 1]) {
    for (;;) {
      let best = null;
      for (const a of free) for (const b of free) {
        if (a.i >= b.i || supersetScore(a, b) !== want) continue;
        if (!best || b.i - a.i < best[1].i - best[0].i) best = [a, b];
      }
      if (!best) break;
      pairs.push(best);
      best.forEach((x) => free.splice(free.indexOf(x), 1));
    }
  }
  return pairs.sort((p, q) => p[0].i - q[0].i).map(([a, b]) => [a.ex, b.ex]);
}

// Repos après la paire : la moitié du plus long des deux repos, 30 s au moins. Chaque muscle récupère pendant que l'autre
// travaille : entre deux de ses séries, un exercice garde au moins son repos habituel (45 s de l'autre série + le passage + ce repos).
export const supersetRest = (a, b) => Math.max(30, Math.round(Math.max(a.rest, b.rest) / 10) * 5);

// Durée d'un superset, en secondes : par tour, deux séries, le passage de l'un à l'autre et un seul repos ; les séries en plus
// de l'exercice qui en a le plus se font seules, avec son repos.
export function supersetSeconds(a, b) {
  const rounds = Math.min(a.sets, b.sets);
  return rounds * (2 * EFFORT + TRANSITION + supersetRest(a, b)) + (a.sets - rounds) * (EFFORT + a.rest) + (b.sets - rounds) * (EFFORT + b.rest) + 2 * SETUP;
}

// À qui le tour dans un superset : a et b = { done (séries faites), sets (prévues) }. A1, B1, repos, A2, B2… ; quand l'un a
// fini, l'autre termine seul. Retourne 'A', 'B' ou null (tout est fait).
export function supersetTurn(a, b) {
  const moreA = a.done < a.sets, moreB = b.done < b.sets;
  if (moreA && moreB) return a.done <= b.done ? 'A' : 'B';
  return moreA ? 'A' : moreB ? 'B' : null;
}
// Juste après une série de `role` ('A' ou 'B') : l'autre exercice s'enchaîne-t-il sans repos ? Oui s'il lui reste une série et
// qu'il est en retard d'un tour ; sinon c'est le repos (après la paire). Retourne 'A', 'B' ou null.
export function supersetChain(role, a, b) {
  const turn = supersetTurn(a, b);
  return turn && turn !== role && (role === 'A' ? b.done < a.done : a.done < b.done) ? turn : null;
}
