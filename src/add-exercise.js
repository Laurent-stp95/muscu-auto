// --- Exercice ajouté à la volée ---
// Pendant une séance du programme ou une séance libre : un exercice en plus, choisi parmi ceux que le matériel et les zones
// fragiles permettent. Il ne vaut que pour la séance en cours (state.active.extra), le programme ne change pas ; ses séries
// entrent dans le suivi comme les autres. Dose et charge : mêmes règles que le programme (extraItem, suggest).

import { EXOS } from './common.js';
import { addable, extraItem } from './plan.js';
import { plural } from './labels.js';
import { h, button, chip, icon, toast } from './ui.js';
import { state, save } from './store.js';
import { ui, render } from './router.js';
import { activeSession, activeItems, exercise, nextItem } from './session.js';
import { loadText } from './progress.js';

// Recherche sans accents ni majuscules : « developpe » trouve « Développé ».
const plain = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Feuille de choix : recherche, filtre par zone, exercices groupés par zone avec la dose et la charge du jour.
export function addExercise() {
  const s = activeSession();
  const groups = addable(EXOS, state.config, s.items.map((it) => it.ex));
  const index = s.items.length;
  const dialog = h('dialog', { className: 'sheet picker' });
  const close = () => { dialog.close(); dialog.remove(); };
  let zone = null;
  const search = h('input', { className: 'input', type: 'search', placeholder: 'Rechercher un exercice', ariaLabel: 'Rechercher un exercice', autocomplete: 'off', enterKeyHint: 'search', oninput: () => fill() });
  const results = h('div', { className: 'picker-list' });
  const zones = [[null, 'Tout'], ...groups.map((g) => [g.zone, g.label])];
  const chips = zones.map(([value, label]) => chip(label, value === null, () => {
    zone = value;
    chips.forEach((c, n) => { c.ariaPressed = String(zones[n][0] === value); });
    fill();
    results.scrollTop = 0;
  }));
  const row = (e) => {
    const x = exercise(extraItem(EXOS, state.config, e.id, index));
    return h('button', { type: 'button', className: 'line pick', onclick: () => { close(); add(e); } },
      h('span', { className: 'stack tight' }, h('span', {}, e.name),
        h('span', { className: 'meta' }, `${x.it.sets} × ${x.it.reps}${e.unit === 's' ? ' s' : ''} · ${loadText(e, x.tip.kg)}`)),
      icon('plus', 'chev'));
  };
  function fill() {
    const words = plain(search.value).split(/\s+/).filter(Boolean);
    const shown = groups.filter((g) => !zone || g.zone === zone)
      .map((g) => ({ ...g, list: g.list.filter((e) => words.every((w) => plain(`${e.name} ${g.label}`).includes(w))) })).filter((g) => g.list.length);
    results.replaceChildren(...(shown.length ? shown.map((g) => h('section', { className: 'stack tight' },
      h('h3', { className: 'label' }, `${g.label} · ${plural(g.list.length, 'exercice')}`), h('div', { className: 'list' }, g.list.map(row))))
      : [h('p', { className: 'meta center' }, 'Aucun exercice ne correspond. Seuls ceux que ton matériel et tes zones fragiles permettent sont proposés.')]));
  }
  fill();
  dialog.append(h('div', { className: 'sheet-body' },
    h('div', { className: 'stack' }, h('h2', { className: 'title' }, 'Ajouter un exercice'),
      h('p', { className: 'meta' }, s.free ? 'Choisis parmi les exercices que ton matériel permet.' : 'Pour cette séance seulement : ton programme ne change pas.')),
    search, h('div', { className: 'chips scroll' }, chips), results,
    button('Fermer', close, { variant: 'gray', size: 'large' })));
  dialog.addEventListener('cancel', (ev) => { ev.preventDefault(); close(); });
  document.body.append(dialog);
  dialog.showModal();
  // Pas de clavier d'office : showModal donne le focus au champ de recherche, on le rend au titre (la liste reste visible en entier).
  const title = dialog.querySelector('h2');
  title.tabIndex = -1;
  title.focus({ preventScroll: true });
}

// Ajouté en fin de séance. Tout le reste est fait (ou c'est le premier) : on passe directement dessus.
function add(e) {
  const item = extraItem(EXOS, state.config, e.id, activeSession().items.length);
  state.active.extra = [...(state.active.extra || []), item];
  const items = activeItems(), at = items.findIndex((x) => x.e.id === e.id);
  const next = nextItem(items) === at;
  if (next) ui.at = ui.pick = null;
  save();
  render();
  if (next) scrollTo(0, 0);
  toast(next ? `Ajouté : ${e.name}` : `Ajouté en fin de séance : ${e.name}`, 'success', () => remove(e.id));
}

// Retirer un exercice ajouté par erreur : possible tant qu'aucune série n'est validée (après, ses séries sont dans le suivi).
function remove(id) {
  if (!state.active?.extra?.some((it) => it.ex === id)) return;
  if (activeItems().some((x) => x.e.id === id && x.done.size)) return toast('Séries déjà validées : cet exercice reste dans la séance.', 'warning');
  state.active.extra = state.active.extra.filter((it) => it.ex !== id);
  ui.at = ui.pick = null;
  save();
  render();
}
export const removeButton = (x) => x.added && !x.done.size
  && h('div', { className: 'center' }, button('Retirer de la séance', () => remove(x.e.id), { variant: 'plain', size: 'compact', className: 'btn plain compact destructive' }));
