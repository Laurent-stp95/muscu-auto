// --- Programme ---

import { FRONT, EXOS } from './common.js';
import {
  cycleWeek, monday, cancelled, sessionMinutes, isBodyweight, kgLabel, CYCLE_WEEKS, recovery, swap, generate, renew,
} from './plan.js';
import { MUSCLES, byId, DAYS, BACKUP_DAYS } from './constants.js';
import { h, icon, button, choose, ask, toast } from './ui.js';
import { state, log, record, save, setLog } from './store.js';
import { ui, today, render, show } from './router.js';
import { openSettings } from './settings.js';
import { lazy, exerciseInfo } from './exercise-info.js';
import { sessionSets, historyOf, activeMinutes, start, stopSession, journal, closeSession } from './session.js';
import { cancelWarm } from './warmup.js';
import { clock, setText, plural } from './focus.js';
import { stopRest } from './rest.js';
import { tipFor, listNote, preview } from './progress.js';
import { stopEar } from './voice.js';
import { projectSheet } from './screen.js';
import { lastCopy, backup } from './backup.js';

const restText = (s) => (s >= 120 ? `${s / 60} min` : `${s} s`);
export const unitText = (e) => (e.unit === 's' ? 's' : 'rép.');
export const cycle = () => cycleWeek(state.cycle);
// live = séance en cours : un point de forme « basse » l'allège comme une semaine allégée.
// Séance express : state.active.cut = { [ex]: séries gardées } (0 = exercice retiré aujourd'hui).
export const effective = (item, live = false) => {
  const sets = cycle().deload || (live && state.active?.readiness === 'light') ? Math.ceil(item.sets / 2) : item.sets;
  const cut = live ? state.active?.cut?.[item.ex] : undefined;
  return { ...item, sets: cut != null ? Math.min(sets, cut) : sets };
};
export const prescriptionText = (e, item) => `${item.sets} × ${item.reps}${e.unit === 's' ? ' s' : ''} · repos ${restText(item.rest)}`;
export const muscles = (e) => e.mus.map((m) => MUSCLES[m]).join(', ');
const daysAgo = (iso) => Math.floor((Date.now() - Date.parse(iso)) / 864e5);
const freshCycle = () => !log.some((x) => x.type === 'start' && x.t >= state.cycle.start);

export function banner(name, title, ...content) {
  return h('section', { className: 'card' }, h('div', { className: 'banner-head' }, icon(name), h('h2', {}, title)), ...content);
}

export const weekday = (date = new Date()) => (date.getDay() + 6) % 7; // 0 = lundi

// Séances faites cette semaine (ahead : la semaine suivante), par jour : { t, sets, session }. Une séance abandonnée, vide
// ou réinitialisée ne compte pas. Une séance compte pour la semaine de son début, ou pour celle notée au départ (week :
// séance faite en avance, quand plus rien n'était prévu d'ici dimanche).
const weekOf = (x) => x.week || monday(new Date(x.t)).toISOString();
export function doneThisWeek(ahead = false) {
  // « Réinitialiser la semaine » : les séances d'avant la réinitialisation ne comptent plus pour la semaine (le suivi les garde).
  const reset = log.findLast((x) => x.type === 'week-reset')?.t || '';
  const week = monday(new Date(Date.now() + (ahead ? 7 * 864e5 : 0))).toISOString();
  const skip = cancelled(log), undone = sessionResets();
  const ended = new Set(log.filter((x) => x.type === 'end').map((x) => x.session));
  const done = new Map();
  for (const x of log) {
    if (x.type !== 'start' || x.t < reset || weekOf(x) !== week || !ended.has(x.session) || skip.has(x.session) || undone.has(x.session)) continue;
    const sets = sessionSets(x.session).size;
    if (sets) done.set(x.day, { t: x.t, sets, session: x.session });
  }
  return done;
}
// Séances remises à faire une à une (journal en ajout seul : la dernière saisie pour une séance fait foi).
function sessionResets() {
  const out = new Set();
  for (const x of log) {
    if (x.type === 'session-reset') out.add(x.target);
    if (x.type === 'session-restore') out.delete(x.target);
  }
  return out;
}

// Séance mise en avant : celle en cours, sinon la première pas faite à partir d'aujourd'hui,
// sinon (plus rien cette semaine) la première de la semaine suivante.
function focusOf(plan, done) {
  if (state.active) return { index: state.active.day, nextWeek: false };
  const index = plan.findIndex((s) => s.day >= weekday() && !done.has(s.day));
  return index >= 0 ? { index, nextWeek: false } : { index: 0, nextWeek: true };
}
// Ce que montre Ma semaine : done = cette semaine (avancement), cards = statut des cartes. Plus rien de prévu d'ici dimanche :
// les cartes passent à la semaine suivante, et une séance faite en avance y compte (sinon elle restait à « Commencer »).
export function weekFrame() {
  const done = doneThisWeek(), focus = focusOf(state.plan, done);
  if (!focus.nextWeek) return { done, cards: done, focus };
  const cards = doneThisWeek(true), index = state.plan.findIndex((s) => !cards.has(s.day));
  return { done, cards, focus: { index: Math.max(0, index), nextWeek: true } };
}

// Carte de séance : type de séance, jour, durée et muscles (silhouette), aperçu des 3 premiers exercices avec la charge du jour,
// le reste et le matériel d'un geste. Faite : son bilan (séries, durée, volume, record). Une seule action principale.
function dayCard(s, d, focused, done, nextWeek, date) {
  const active = state.active?.day === d;
  const upcoming = focused && nextWeek; // séance de la semaine suivante : son statut de cette semaine ne compte plus
  const finished = !active && !upcoming && done.get(s.day);
  const entries = s.items.map((item, i) => ({ item, i, e: byId.get(item.ex), it: effective(item) }));
  const fresh = entries.filter(({ e }) => isFresh(e.id)).length;
  const groups = GROUPS.filter(([, ids]) => entries.some(({ e }) => e.mus.some((m) => ids.includes(m)))).map(([label]) => label);
  const meta = [`${DAYS[s.day]} ${date.getDate()}`, `${sessionMinutes(entries.map(({ item }) => effective(item)))} min`, fresh > 0 && `${fresh} nouveau${fresh > 1 ? 'x' : ''}`].filter(Boolean).join(' · ');
  // Silhouettes de face et de dos, muscles du jour en rouge (mêmes images que la carte Récupération).
  const mus = new Set(entries.flatMap(({ e }) => e.mus));
  const side = (front) => h('div', { className: 'body' }, h('img', { src: `muscles/muscular_system_${front ? 'front' : 'back'}.svg`, alt: '' }),
    [...mus].filter((m) => FRONT.has(m) === front).map((m) => h('img', { src: `muscles/main/muscle-${m}.svg`, alt: '' })));
  const row = ({ item, i, e, it }) => {
    const kg = isBodyweight(e) ? null : tipFor(e, historyOf(e.id))?.kg;
    return lazy('ex',
      // « Nouveau » sur la ligne de la dose : après le nom, il passait seul à la ligne sur les noms longs, décalé.
      h('summary', {}, h('span', { className: 'stack tight' }, h('span', {}, e.name),
        h('span', { className: 'dose' }, isFresh(e.id) && h('span', { className: 'badge' }, 'Nouveau'),
          h('span', { className: 'meta' }, `${it.sets} × ${it.reps}${e.unit === 's' ? ' s' : ''}${kg != null ? ` · ${kgLabel(e, kg)}` : ''}`))), icon('chevron', 'chev')),
      () => h('div', { className: 'ex-body' }, h('p', { className: 'meta' }, prescriptionText(e, it)), exerciseInfo(e), !state.active && h('div', {}, button('Remplacer', () => replace(d, i), { size: 'compact' }))));
  };
  const head = h('div', { className: 'session-head' },
    h('div', { className: 'stack tight' }, h('h2', { className: 'title' }, s.name), h('span', { className: 'meta' }, meta),
      !finished && groups.length > 0 && h('span', { className: 'caption' }, groups.slice(0, 3).join(', ').toLowerCase().replace(/^./, (c) => c.toUpperCase()))),
    finished ? h('span', { className: 'badge ok' }, icon('check'), `Faite ${DAYS[weekday(new Date(finished.t))].toLowerCase()} ${clock(finished.t)}`)
      : h('div', { className: 'bodies mini', role: 'img', ariaLabel: `Muscles travaillés : ${groups.join(', ').toLowerCase()}` }, side(true), side(false)));
  if (finished) {
    const sets = sessionSets(finished.session), volume = Math.round([...sets.values()].reduce((v, x) => v + (x.kg || 0) * x.reps, 0));
    const prs = [...sets.values()].filter((x) => x.pr && byId.has(x.ex)).map((x) => `${byId.get(x.ex).name} : ${setText(byId.get(x.ex), x.kg, x.reps)}`);
    const stat = (value, label) => h('div', { className: 'stat' }, h('strong', {}, value), h('span', { className: 'caption' }, label));
    return h('section', { className: 'card' }, head,
      h('div', { className: 'stats' }, stat(String(sets.size), plural(sets.size, 'série', 'séries').replace(/^\d+ /, '')), stat(String(activeMinutes(finished.session)), 'min'), stat(volume.toLocaleString('fr-FR'), 'kg soulevés')),
      prs.length > 0 && listNote('flag', prs.length > 1 ? 'Records' : 'Record', prs),
      h('div', { className: 'row' }, button('Refaire', () => start(d), { variant: 'plain', size: 'compact' }), button('Réinitialiser', () => resetSession(s, finished), { variant: 'plain', size: 'compact' })));
  }
  const rest = entries.slice(3);
  const gear = !active && h('p', { className: 'caption' }, `À préparer : ${preview(s, nextWeek).gear.join(', ')}`);
  const details = rest.length > 0 && h('details', { className: 'more', open: ui.open?.[s.day] ?? false },
    h('summary', {}, `+ ${plural(rest.length, 'exercice')}`, icon('chevron', 'chev')),
    h('div', { className: 'list' }, rest.map(row)), gear);
  details && details.addEventListener('toggle', () => { (ui.open ||= {})[s.day] = details.open; }); // garde le choix jusqu'au prochain lancement
  return h('section', { className: 'card' }, head,
    active && h('div', {}, h('span', { className: 'badge' }, state.active.paused ? 'En pause' : 'En cours')),
    h('div', { className: 'list' }, entries.slice(0, 3).map(row)),
    details || gear,
    active ? h('div', { className: 'stack' }, button('Reprendre la séance', () => start(d), { variant: 'primary', size: 'large', icon: 'play' }), button('Arrêter', stopSession, { variant: 'plain', className: 'btn plain destructive' }))
      : button('Commencer la séance', () => start(d), { variant: 'primary', size: 'large', icon: 'play' }));
}

// Date d'un jour (0 = lundi) dans la semaine affichée : la suivante quand plus rien n'est prévu d'ici dimanche.
const weekDate = (focus, day) => { const m = monday(new Date(Date.now() + (focus.nextWeek ? 7 * 864e5 : 0))); return new Date(m.getFullYear(), m.getMonth(), m.getDate() + day); };

// Bande calendrier (comme l'app Calendrier) : les 7 jours et leur date, repos grisés, séance faite cochée, jour affiché en orange.
// Elle montre la semaine des cartes : la suivante quand plus rien n'est prévu d'ici dimanche. Un jour d'entraînement se touche.
function weekStrip(plan, done, cards, focus, sel) {
  const start = monday(new Date(Date.now() + (focus.nextWeek ? 7 * 864e5 : 0)));
  const count = plan.filter((s) => cards.has(s.day)).length;
  const title = focus.nextWeek ? 'Semaine prochaine' : count === plan.length ? 'Semaine bouclée' : 'Cette semaine';
  const past = plan.filter((s) => done.has(s.day)).length; // semaine qui se termine, vue depuis la suivante
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const d = plan.findIndex((s) => s.day === i);
    const isToday = date.toDateString() === today(), letter = DAYS[i][0], num = String(date.getDate());
    if (d < 0) return h('span', { className: `day off${isToday ? ' today' : ''}`, ariaHidden: 'true' }, h('span', { className: 'caption' }, letter), h('span', { className: 'n' }, num));
    const s = plan[d], made = cards.has(s.day), active = state.active?.day === d;
    const name = `${DAYS[i]} ${date.getDate()} : ${s.name}, ${active ? 'en cours' : made ? 'faite' : 'à faire'}`;
    return h('button', { type: 'button', className: ['day', made ? 'done' : 'todo', d === sel && 'on', isToday && 'today'].filter(Boolean).join(' '),
      ariaPressed: String(d === sel), ariaLabel: name, onclick: () => { ui.weekPick = d; render(); } },
      h('span', { className: 'caption' }, letter), h('span', { className: 'n' }, made ? icon('check') : num));
  });
  return h('section', { className: 'card' },
    h('div', { className: 'line-head' }, h('h2', {}, title), h('span', { className: 'meta' }, `${count} sur ${plural(plan.length, 'séance')}`)),
    h('div', { className: 'days' }, days),
    focus.nextWeek && done.size > 0 && h('p', { className: 'caption' }, past === plan.length ? `Semaine bouclée : ${past} sur ${plan.length} séances.` : `Semaine passée : ${past} sur ${plural(plan.length, 'séance')}.`));
}

// Avancement de la semaine : un segment par séance, vert quand elle est faite, jour du jour en gras.
export function weekProgress(plan, done, focus, heading) {
  const count = plan.filter((s) => done.has(s.day)).length;
  // Rien de fait et plus rien de prévu d'ici dimanche (premier lancement un week-end, semaine sautée) : on regarde devant, pas « terminée » à 0.
  const title = !focus.nextWeek ? 'Cette semaine' : count === plan.length ? 'Semaine bouclée' : count ? 'Semaine terminée' : 'Semaine prochaine';
  return h('section', { className: 'card' },
    h('div', { className: 'line-head' }, h('h2', {}, heading || title), h('span', { className: 'meta' }, `${count} sur ${plural(plan.length, 'séance')}`)),
    h('div', { className: 'week-bar', style: `grid-template-columns: repeat(${plan.length}, minmax(0, 1fr))` },
      plan.map((s) => h('div', { className: ['week-day', done.has(s.day) && 'done', s.day === weekday() && 'today'].filter(Boolean).join(' ') },
        h('span', { className: 'week-seg' }), h('span', { className: 'caption' }, DAYS[s.day].slice(0, 3))))),
    focus.nextWeek && h('p', { className: 'caption' }, `Prochaine séance ${DAYS[plan[focus.index].day].toLowerCase()}`));
}

export function week() {
  const { plan } = state;
  const { week: n, deload, ended } = cycle();
  const { done, cards, focus } = weekFrame();
  // Séance affichée : choisie d'un geste dans la bande, sinon celle qui tombe selon la date (en cours, prochaine à faire…).
  const sel = ui.weekPick != null && ui.weekPick < plan.length ? ui.weekPick : focus.index;
  const copied = lastCopy();
  const backupDue = log.length > 0 && (!copied || daysAgo(copied) >= BACKUP_DAYS);
  return h('div', { className: 'screen' },
    h('header', { className: 'stack tight' },
      h('div', { className: 'top' }, h('h1', {}, 'Ma semaine'),
        h('div', { className: 'row' }, button(null, projectSheet, { variant: 'plain', icon: 'tv', ariaLabel: 'Projeter sur un écran', className: 'btn plain screen-btn' }), button('Réglages', openSettings, { variant: 'plain' }))),
      h('p', { className: 'meta' }, `Semaine ${Math.min(n, CYCLE_WEEKS)} sur ${CYCLE_WEEKS} du cycle`)),
    // La séance à faire d'abord : on ouvre l'appli pour s'entraîner. Avancement, récupération et le reste de la semaine ensuite.
    ended && banner('flag', 'Cycle terminé',
      h('p', {}, 'Le nouveau cycle garde tes mouvements principaux, pour continuer à progresser, et renouvelle les exercices secondaires.'),
      button('Lancer le nouveau cycle', newCycle, { variant: 'primary' })),
    deload && banner('leaf', 'Semaine allégée',
      h('p', {}, 'Moitié moins de séries et charges baissées de 10 %. Ce repos fait partie de la progression : il évite la fatigue qui mène aux blessures.')),
    weekStrip(plan, done, cards, focus, sel),
    dayCard(plan[sel], sel, true, cards, focus.nextWeek && sel === focus.index, weekDate(focus, plan[sel].day)),
    recoveryCard(plan, cards, focus),
    // Rappel compact, toute la ligne se touche (comme une ligne de Réglages iOS).
    backupDue && h('button', { type: 'button', className: 'card notice', onclick: backup },
      h('span', { className: 'notice-icon' }, icon('save')),
      h('span', { className: 'stack tight' }, h('strong', {}, 'Sauvegarde ton journal'),
        h('span', { className: 'caption' }, copied ? `Dernière copie il y a ${plural(daysAgo(copied), 'jour')}` : "Ton suivi n'existe que sur cet iPhone")),
      icon('chevron', 'chev')),
    (canResetWeek(done) || canReroll()) && h('div', { className: 'center' }, button('Options de la semaine', weekOptions, { variant: 'plain' })));
}

// Remise à zéro et autre variante : rares, rangées dans une feuille plutôt qu'en grands boutons sous les séances.
const canResetWeek = (done) => done.size > 0 || !!state.active;
const canReroll = () => !state.active && (freshCycle() || cycle().ended);
async function weekOptions() {
  const variant = canReroll();
  const choice = await choose({ title: 'Options de la semaine',
    text: variant ? null : "Exercices fixes jusqu'à la fin du cycle, pour apprendre les gestes et progresser. « Remplacer » reste possible sur chaque exercice.",
    actions: [canResetWeek(doneThisWeek()) && { label: 'Réinitialiser la semaine', value: 'reset' }, variant && { label: 'Générer une autre variante', value: 'reroll' }, { label: 'Fermer', value: null }].filter(Boolean) });
  if (choice === 'reset') resetWeek();
  if (choice === 'reroll') reroll();
}

// Carte de récupération : silhouettes où chaque muscle encore fatigué ressort en rouge (plus c'est pâle, plus il est récupéré),
// récupération par zone, et la séance de la semaine qui tombe le mieux aujourd'hui (muscles les plus récupérés).
const GROUPS = [['Jambes', [10, 11, 8, 7, 15]], ['Dos', [12, 9, 16]], ['Pectoraux', [4, 3]], ['Épaules', [2]], ['Bras', [1, 13, 5]], ['Abdos', [6, 14]]];
function recoveryCard(plan, done, focus) {
  const rec = recovery(journal(), EXOS);
  if (!Object.keys(rec).length) return null;
  const pct = (m) => rec[m] ?? 100;
  const tired = Object.entries(rec).filter(([, p]) => p < 95).map(([m, p]) => [Number(m), p]);
  const side = (front) => h('div', { className: 'body' }, h('img', { src: `muscles/muscular_system_${front ? 'front' : 'back'}.svg`, alt: '' }),
    tired.filter(([m]) => FRONT.has(m) === front).map(([m, p]) => h('img', { src: `muscles/main/muscle-${m}.svg`, alt: '', style: `opacity: ${Math.max(0.15, (100 - p) / 100).toFixed(2)}` })));
  const groups = GROUPS.map(([label, ids]) => [label, Math.min(...ids.map(pct))]).filter(([, p]) => p < 100);
  const score = (s) => { const ms = s.items.flatMap((it) => byId.get(it.ex).mus); return ms.reduce((t, m) => t + pct(m), 0) / (ms.length || 1); };
  const open = plan.map((s, d) => ({ s, d })).filter(({ s }) => !done.has(s.day));
  const best = !state.active && !focus.nextWeek && open.length > 1 ? open.reduce((a, b) => (score(b.s) > score(a.s) + 5 ? b : a)) : null; // +5 : pas de changement pour un écart minime
  const bodies = h('div', { className: 'bodies' }, side(true), side(false));
  bodies.setAttribute('role', 'img');
  bodies.setAttribute('aria-label', `Récupération : ${groups.map(([label, p]) => `${label} ${p} %`).join(', ') || 'tout est récupéré'}`);
  // Repliée sur une ligne : les deux zones les moins récupérées. Le détail (silhouettes, légende) se déplie.
  const low = groups.filter(([, p]) => p < 80).sort((a, b) => a[1] - b[1]);
  const details = h('details', { className: 'more recovery', open: ui.open?.recovery ?? false },
    h('summary', {}, h('span', { className: 'stack tight' }, h('h2', {}, 'Récupération'),
      h('span', { className: 'caption' }, low.length ? low.slice(0, 2).map(([label, p]) => `${label} ${p} %`).join(' · ') : 'Presque tout est récupéré')), icon('chevron', 'chev')),
    h('div', { className: 'stack' }, h('div', { className: 'anatomy' }, bodies,
      h('div', { className: 'legend' }, groups.length ? groups.map(([label, p]) => h('span', {},
        h('i', { className: 'dot', style: `background: ${p >= 80 ? 'var(--ok)' : p >= 50 ? 'var(--warn-ink)' : 'var(--danger)'}` }), `${label} : ${p} %`)) : h('span', {}, 'Tout est récupéré.'))),
      h('p', { className: 'caption' }, "Vert : récupéré, jaune : en cours, rouge : fatigué. Sur les schémas, plus le rouge est vif, plus le muscle est fatigué. D'après tes séries des 5 derniers jours.")));
  details.addEventListener('toggle', () => { (ui.open ||= {}).recovery = details.open; });
  return h('section', { className: 'card' }, details,
    best && best.d !== focus.index && h('div', { className: 'stack' },
      h('p', { className: 'note' }, icon('leaf'), `Aujourd'hui, ${DAYS[best.s.day].toLowerCase()} · ${best.s.name} tombe mieux : ses muscles sont les plus récupérés.`),
      h('div', {}, button(`Faire ${DAYS[best.s.day].toLowerCase()} · ${best.s.name}`, () => start(best.d), { size: 'compact', icon: 'play' }))));
}

// Réinitialiser une séance : elle redevient à faire (faite par erreur, à refaire) ; ses séries restent dans le suivi. Annulable 5 s.
async function resetSession(s, finished) {
  // Toujours confirmé : on dit ce qui change (la séance redevient à faire) et ce qui ne bouge pas (les séries du suivi).
  const when = `${DAYS[weekday(new Date(finished.t))].toLowerCase()} à ${clock(finished.t)}`;
  if (!await ask({ title: `Réinitialiser ${DAYS[s.day].toLowerCase()} · ${s.name} ?`,
    text: `Faite ${when}, ${plural(finished.sets, 'série')}. Elle redevient à faire cette semaine. Tes séries restent dans ton suivi : courbes, records et historique.`,
    confirm: 'Réinitialiser', danger: true })) return;
  record({ type: 'session-reset', target: finished.session });
  show('week');
  toast('Séance réinitialisée', 'success', () => { record({ type: 'session-restore', target: finished.session }); render(); });
}

// Toutes les séances de la semaine redeviennent à faire ; les séries déjà faites restent dans le suivi (courbes, records, historique).
async function resetWeek() {
  const text = `Toutes les séances de la semaine redeviennent à faire. Les séries déjà faites restent dans ton suivi.${state.active ? ' La séance en cours sera terminée et enregistrée.' : ''}`;
  if (!await ask({ title: 'Réinitialiser la semaine ?', text, confirm: 'Réinitialiser', danger: true })) return;
  if (state.active) closeSession();
  record({ type: 'week-reset' });
  ui.at = ui.pick = null;
  save();
  show('week');
  scrollTo(0, 0);
  toast('Semaine réinitialisée', 'success');
}

// Efface tout le suivi (séances, séries, ressentis, douleurs, technique) ; profil, matériel et programme restent, le cycle repart.
export async function resetLog() {
  const text = `Toutes tes séances et séries validées (${plural(log.length, 'saisie')}) seront effacées : records, courbes et historique repartent de zéro, et le cycle recommence cette semaine.${state.active ? ' La séance en cours sera abandonnée.' : ''} Ton profil, ton matériel et ton programme sont gardés.`;
  if (!await ask({ title: 'Es-tu sûr de vouloir réinitialiser tes séances ?', text, confirm: 'Réinitialiser', danger: true })) return;
  const before = { log, cycle: state.cycle, active: state.active };
  cancelWarm();
  stopEar(false);
  stopRest();
  setLog([]);
  state.active = null;
  state.ended = null;
  state.cycle = { start: monday(new Date()).toISOString() };
  ui.at = ui.pick = null;
  save();
  render();
  toast('Séances réinitialisées', 'success', () => { setLog(before.log); Object.assign(state, { cycle: before.cycle, active: before.active }); save(); render(); });
}

function replace(d, i) {
  const item = state.plan[d].items[i];
  const before = { ...item };
  if (!swap(EXOS, state.plan, state.config, d, i)) return toast('Aucun autre exercice possible avec ton matériel.', 'warning');
  save();
  render();
  toast(`Remplacé par ${byId.get(item.ex).name}`, 'success', () => { Object.assign(item, before); save(); render(); });
}

// Autre variante : aperçu des exercices qui changent (séance par séance), rien n'est appliqué avant « Appliquer ».
async function reroll() {
  const name = (id) => byId.get(id)?.name || 'Aucun';
  for (;;) {
    const seed = Math.floor(Math.random() * 2 ** 31);
    const plan = generate(EXOS, { ...state.config, seed });
    const changes = plan.map((s, d) => ({ s, rows: s.items.map((it, i) => [state.plan[d]?.items[i]?.ex, it.ex]).filter(([a, b]) => a !== b) })).filter((c) => c.rows.length);
    const n = changes.reduce((sum, c) => sum + c.rows.length, 0), total = plan.reduce((sum, s) => sum + s.items.length, 0);
    const extra = n > 0 && h('div', { className: 'stack diff' }, changes.map(({ s, rows }) => h('div', { className: 'stack tight' },
      h('strong', {}, `${DAYS[s.day]} · ${s.name}`),
      rows.map(([a, b]) => h('p', { className: 'meta' }, h('s', {}, name(a)), ' → ', h('span', { className: 'new' }, name(b)))))));
    const choice = await choose({
      title: 'Autre variante',
      text: n ? `${n} exercice${n > 1 ? 's changent' : ' change'} sur ${total}. Un nouveau cycle commence ; ton journal est gardé.` : 'Ce tirage garde les mêmes exercices : tire une autre variante.',
      extra,
      actions: [n > 0 && { label: 'Appliquer', value: 'apply', variant: 'primary' }, { label: 'Tirer une autre variante', value: 'again' }, { label: 'Annuler', value: null }].filter(Boolean),
    });
    if (choice === 'again') continue;
    if (choice !== 'apply') return;
    state.config.seed = seed;
    state.plan = plan;
    state.cycle = { start: monday(new Date()).toISOString() };
    state.fresh = { t: new Date().toISOString(), ids: changes.flatMap((c) => c.rows.map(([, b]) => b)) };
    save();
    render();
    return toast(`Nouveau programme : ${plural(n, 'exercice')} ${n > 1 ? 'changés' : 'changé'}`, 'success');
  }
}
// Exercice arrivé avec la dernière variante, pas encore fait depuis : badge « Nouveau » dans Ma semaine.
const isFresh = (id) => !!state.fresh?.ids.includes(id) && !log.some((x) => x.type === 'set' && x.ex === id && x.t > state.fresh.t);

async function newCycle() {
  if (!await ask({ title: 'Lancer le nouveau cycle ?', text: 'Tes mouvements principaux restent ; les exercices secondaires changent.', confirm: 'Lancer' })) return;
  renew(EXOS, state.plan, state.config, Math.random);
  state.cycle = { start: monday(new Date()).toISOString() };
  save();
  render();
  scrollTo(0, 0);
}
