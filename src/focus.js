// --- Mode focus ---
// Une série à la fois : gros chiffres, gros boutons, sans clavier. C'est aussi la télécommande de l'écran projeté.

import { EXOS } from './common.js';
import {
  isBodyweight, loadable, warmup, CUES, plateChange, recordKind, kgLabel, plates, rir, swap, ZONES, cancelled, repair,
} from './plan.js';
import { byId, FEELS, LOAD_HEAD } from './constants.js';
import { h, icon, button, toast, chip, choose, ask } from './ui.js';
import { state, record, log, save } from './store.js';
import { ui, render } from './router.js';
import { unitText, prescriptionText } from './week.js';
import { lazy, exerciseInfo } from './exercise-info.js';
import { activeItems, nextItem, finishSession, nextSet, startKg, plannedReps, journal, historyOf, exercise } from './session.js';
import { warm } from './warmup.js';
import { startRest, initAudio, audio, tick, rest, restClock, stopRest, extendRest, fanfare } from './rest.js';
import { speak } from './coach.js';
import { micOpen } from './voice.js';
import { cameraKind, cameraCoach } from './camera.js';
import { broadcast, announce, projected } from './screen.js';

const LOAD_CAPTION = { smith: 'kg au total', halteres: 'kg par haltère', kettlebell: 'kg', elastique: "kg d'élastique" };

export function focusView(s, d) {
  const items = activeItems();
  const i = Math.min(ui.at ?? nextItem(items), items.length);
  const move = (to) => { ui.at = to; ui.pick = null; render(); scrollTo(0, 0); };
  if (i >= items.length) {
    return h('section', { className: 'card focus-card' },
      h('div', { className: 'stack tight center' }, icon('flag', 'big-icon'), h('h2', { className: 'title' }, 'Toutes les séries sont faites'),
        h('p', { className: 'meta' }, 'Enregistre la séance pour voir ton bilan.')),
      button('Enregistrer la séance', finishSession, { variant: 'primary', size: 'large', icon: 'check' }),
      button('Revenir au dernier exercice', () => move(items.length - 1), { variant: 'gray', size: 'large' }));
  }
  const x = items[i];
  const { e, it, tip } = x;
  const n = nextSet(x);
  return h('section', { className: 'card focus-card' },
    h('div', { className: 'focus-nav' },
      button(null, () => move(i - 1), { variant: 'gray', icon: 'back', ariaLabel: 'Exercice précédent', disabled: i === 0 }),
      h('span', { className: 'caption' }, `Exercice ${i + 1} sur ${items.length}`),
      button(null, () => move(i + 1), { variant: 'gray', icon: 'chevron', ariaLabel: 'Exercice suivant' })),
    h('div', { className: 'stack tight center' },
      h('h2', { className: 'title' }, e.name),
      h('p', { className: 'meta' }, n ? `Série ${n} sur ${it.sets} · ${it.reps}${e.unit === 's' ? ' s' : ' rép.'}` : plural(x.done.size, 'série faite', 'séries faites')),
      tip.learning && h('div', {}, h('span', { className: 'badge' }, 'Apprentissage du geste'))),
    restPanel(),
    n ? setPanel(x, n, i, items.length)
      : [h('p', { className: 'note' }, icon('checkCircle'), "Exercice terminé. Comment ça s'est passé ?"), ...feedback(e, d, x.k),
        button(i + 1 < items.length ? 'Exercice suivant' : 'Voir le bilan', () => move(i + 1), { variant: 'primary', size: 'large' })],
    lazy('more', h('summary', {}, "Voir l'exercice et les consignes", icon('chevron', 'chev')), () => exerciseInfo(e)));
}

// Série à faire : répétitions et charge en − / +, disques à monter, puis un seul geste pour valider.
function setPanel(x, n, i, count) {
  const { e, it, tip, past } = x;
  const loads = state.config.loads;
  const key = `${state.active.session}|${e.id}|${n}`;
  const list = isBodyweight(e) ? [] : loadable(e, loads);
  if (ui.pick?.key !== key) ui.pick = { key, kg: isBodyweight(e) ? 0 : startKg(x) ?? list[0] ?? null, reps: null, touched: false };
  const pick = ui.pick;
  if (!isBodyweight(e) && pick.kg != null && !list.includes(pick.kg)) list.push(pick.kg), list.sort((a, b) => a - b);
  const planned = () => plannedReps(x, isBodyweight(e) ? null : pick.kg, n);
  pick.reps ??= planned();
  const platesLine = h('p', { className: 'meta center' });
  const changeLine = h('p', { className: 'focus-change' });
  const showPlates = () => {
    const bar = barPlan(e, pick.kg);
    platesLine.textContent = bar.plates || '';
    platesLine.hidden = !bar.plates;
    changeLine.textContent = bar.change || '';
    changeLine.hidden = !bar.change;
  };
  showPlates();
  const reps = bigStepper(e.unit === 's' ? 'secondes' : 'répétitions', pick.reps, { min: 0, max: 300, step: e.unit === 's' ? 5 : 1 }, String,
    (v) => { pick.reps = v; pick.touched = true; broadcast(); });
  const load = !isBodyweight(e) && bigStepper(LOAD_CAPTION[e.load], pick.kg, list, (v) => (v == null ? '–' : v.toLocaleString('fr-FR')),
    (v) => { pick.kg = v; if (!pick.touched) { pick.reps = planned(); reps.set(pick.reps); } showPlates(); broadcast(); });
  const last = past.at(-1)?.sets.find((s) => s.set === n);
  const approach = n === 1 ? warmup(e, pick.kg, loads) : [];
  return [
    h('div', { className: 'focus-pick' }, reps.node, load && load.node),
    platesLine, changeLine,
    approach.length > 0 && h('p', { className: 'meta center' }, `Approche : ${approach.map(([kg, r]) => `${kgText(kg)}\u00a0×\u00a0${r}`).join(' · ')}`),
    last && h('p', { className: 'caption center' }, `La dernière fois : ${setText(e, last.kg, last.reps)}`),
    button('Série faite', () => validateSet({ x, n, i, count, pick }), { variant: 'primary', size: 'large', icon: 'check', className: 'btn primary large focus-go' }),
    h('div', { className: 'row focus-tools' },
      (tip.mode === 'tempo' || tip.mode === 'pause') && tempoControl(() => pick.reps, tip.mode),
      cameraKind(e) && button('Compter avec la caméra', () => cameraCoach(focusTarget()), { variant: 'gray', size: 'compact', icon: 'camera' }),
      filmButton()),
    h('p', { className: 'tip' }, tip.note),
    h('ul', { className: 'cue' }, (e.cues || [CUES[e.zone]]).slice(0, 2).map((c) => h('li', {}, c)))];
}

// Valide la série affichée par le mode focus : bouton, voix ou caméra.
export function validateSet({ x, n, i, count, pick }) {
  const { e, it, tip } = x;
  if (!isBodyweight(e) && pick.kg == null) return toast('Choisis la charge utilisée.', 'warning');
  stopTempo();
  logSet(e, n, pick.kg, pick.reps, tip.mode);
  // Série comptée par une caméra (iPhone ou miroir de l'écran) : profondeur et descente de chaque répétition, pour le suivi de la technique.
  if (pick.cam?.length) record({ type: 'cam', ex: e.id, set: n, kind: cameraKind(e), reps: pick.cam });
  // Dernière série de l'exercice : on reste dessus pour le ressenti, « Exercice suivant » fait avancer.
  if (x.done.size + 1 >= it.sets) ui.at = i;
  if (n < it.sets || i + 1 < count) startRest(it.rest);
  else announce('Dernière série faite, bien joué !');
  ui.pick = null;
  render();
}

// Série affichée par le mode focus, avec son réglage (ui.pick, créé avec les valeurs prévues) : { x, n, i, count, pick }, null si rien à faire.
export function focusTarget() {
  if (!state.active || state.active.paused || state.listMode || warm) return null;
  const items = activeItems();
  const i = Math.min(ui.at ?? nextItem(items), items.length);
  const x = items[i], n = x && nextSet(x);
  if (!n) return null;
  const key = `${state.active.session}|${x.e.id}|${n}`;
  if (ui.pick?.key !== key) {
    const kg = isBodyweight(x.e) ? 0 : startKg(x) ?? loadable(x.e, state.config.loads)[0] ?? null;
    ui.pick = { key, kg, reps: plannedReps(x, isBodyweight(x.e) ? null : kg, n), touched: false };
  }
  return { x, n, i, count: items.length, pick: ui.pick };
}

// Grand compteur − valeur + : values = liste des valeurs permises ou { min, max, step } ; set() change la valeur sans prévenir.
function bigStepper(label, value, values, format, onChange) {
  const out = h('output', { className: 'big-value', ariaLive: 'polite' });
  let v = value;
  const set = (next) => { v = next; out.textContent = format(v); };
  const step = (dir) => {
    let next;
    if (Array.isArray(values)) next = values[Math.min(values.length - 1, Math.max(0, values.indexOf(v) + dir))];
    else next = Math.min(values.max, Math.max(values.min, v + dir * values.step));
    if (next == null || next === v) return;
    set(next);
    onChange(next);
  };
  set(v);
  const node = h('div', { className: 'big-stepper' },
    button('−', () => step(-1), { variant: 'gray', ariaLabel: `Moins de ${label}` }),
    h('div', { className: 'stack tight center' }, out, h('span', { className: 'caption' }, label)),
    button('+', () => step(1), { variant: 'gray', ariaLabel: `Plus de ${label}` }));
  return { node, set };
}

// Métronome de tempo : chaque répétition est rythmée (descente 3 s en bips graves, pause 2 s si demandée, bip aigu pour pousser),
// la voix compte les répétitions. Sur l'iPhone, même quand la séance est projetée.
let tempo = null;
const TEMPO = { tempo: [3000, 0], pause: [3000, 2000] }; // descente, pause en bas (ms) ; remontée : 1,5 s
function tempoControl(reps, mode) {
  const status = h('span', { className: 'caption tempo-status' });
  const toggle = button('Rythme guidé', () => (tempo ? stopTempo() : startTempo(reps(), mode)), { variant: 'gray', size: 'compact', icon: 'timer', className: 'btn gray compact tempo-btn' });
  return h('div', { className: 'row' }, toggle, status);
}
function startTempo(reps, mode) {
  stopTempo();
  initAudio();
  audio.resume?.();
  const [down, hold] = TEMPO[mode];
  const rep = down + hold + 1500, lead = 3500, timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  tempo = { timers, rep: 0, reps };
  speak(hold ? 'Trois secondes pour descendre, deux secondes de pause, puis tu pousses.' : 'Trois secondes pour descendre, puis tu pousses.', true);
  for (let r = 0; r < reps; r++) {
    const t0 = lead + r * rep;
    // Les bips donnent le rythme ; la voix ne parle qu'à la fin. Micro ouvert : bips seuls.
    const say = r + 1 === reps ? 'Dernière.' : r + 2 === reps ? 'Encore deux.' : '';
    at(t0, () => { tempo.rep = r + 1; showTempo(); if (say && !micOpen()) speak(say, true); });
    for (let d = 0; d < down; d += 1000) at(t0 + d, () => tick(440));
    at(t0 + down + hold, () => tick(880));
  }
  at(lead + reps * rep, () => { stopTempo(); speak("C'est fini, tu peux valider.", true); });
  showTempo();
}
function stopTempo() {
  if (!tempo) return;
  tempo.timers.forEach(clearTimeout);
  tempo = null;
  showTempo();
}
function showTempo() {
  document.querySelectorAll('.tempo-status').forEach((el) => { el.textContent = tempo ? (tempo.rep ? `Répétition ${tempo.rep} sur ${tempo.reps}` : 'Mets-toi en place…') : ''; });
  document.querySelectorAll('.tempo-btn').forEach((b) => { b.lastChild.textContent = tempo ? 'Arrêter le rythme' : 'Rythme guidé'; });
}

// Se filmer : l'appareil photo de l'iPhone s'ouvre, la vidéo se revoit tout de suite, au ralenti si besoin. Rien n'est gardé.
function filmButton() {
  const input = h('input', { type: 'file', accept: 'video/*', capture: 'environment', hidden: true });
  input.onchange = () => { if (input.files[0]) replay(input.files[0]); input.value = ''; };
  return h('div', {}, button('Me filmer', () => input.click(), { variant: 'gray', size: 'compact', icon: 'video' }), input);
}
async function replay(file) {
  const url = URL.createObjectURL(file);
  const video = h('video', { src: url, controls: true, playsInline: true, autoplay: true, muted: true, loop: true, className: 'replay' });
  const speeds = [[1, 'Normal'], [0.5, 'Ralenti ×½'], [0.25, 'Ralenti ×¼']];
  const chips = speeds.map(([rate, label]) => chip(label, rate === 1, () => {
    video.playbackRate = rate;
    chips.forEach((c, k) => { c.ariaPressed = String(speeds[k][0] === rate); });
  }));
  await choose({ title: 'Ta série', text: 'Vérifie le dos, l\'amplitude et la trajectoire. La vidéo n\'est pas enregistrée.', extra: h('div', { className: 'stack' }, video, h('div', { className: 'chips' }, chips)),
    actions: [{ label: 'Fermer', value: null }] });
  URL.revokeObjectURL(url);
}

// Disques pour une charge à la Smith, et le changement depuis la dernière charge montée pendant la séance.
export function barPlan(e, kg) {
  if (e.load !== 'smith' || kg == null) return {};
  const loads = state.config.loads;
  let side = [];
  for (const x of journal()) if (x.session === state.active.session && x.type === 'set' && byId.get(x.ex)?.load === 'smith') side = plateChange(side, x.kg, loads)?.side ?? side;
  const move = plateChange(side, kg, loads);
  if (!move) return {};
  return { plates: move.side.length ? `De chaque côté : ${platesText(move.side)}` : 'Barre seule, sans disque',
    change: side.length && (move.remove.length || move.add.length) ? changeText(move) : null };
}
const platesText = (list) => `${list.map((w) => w.toLocaleString('fr-FR')).join(' + ')}\u00a0kg`;
const changeText = ({ remove, add }) => `${[remove.length && `retire ${platesText(remove)}`, add.length && `ajoute ${platesText(add)}`].filter(Boolean).join(' et ')} de chaque côté`.replace(/^./, (c) => c.toUpperCase());

// Repos en cours : grand compte à rebours (mis à jour par le minuteur), passer ou rallonger.
function restPanel() {
  if (!rest) return null;
  return h('div', { className: 'focus-rest', role: 'timer' },
    h('span', { className: 'caption' }, 'Repos'),
    h('strong', { className: 'rest-time' }, restClock()),
    h('div', { className: 'row' }, button('Passer', stopRest, { variant: 'gray', size: 'compact' }), button('+30 s', () => extendRest(30), { variant: 'gray', size: 'compact' })));
}

// Technique propre ? et ressenti, après les séries d'un exercice.
function feedback(e, d, i) {
  const sid = state.active.session;
  const mine = (type) => log.findLast((x) => x.session === sid && x.ex === e.id && x.type === type);
  const feelButtons = FEELS.map(([value, label]) => chip(label, mine('feel')?.feel === value, () => onFeel(e, value, d, i, feelButtons), { danger: value === 'pain' }));
  feelButtons.forEach((b, n) => { b.dataset.feel = FEELS[n][0]; });
  const techButtons = [[true, 'Oui'], [false, 'Non']].map(([ok, label]) => chip(label, mine('tech')?.ok === ok, () => {
    record({ type: 'tech', ex: e.id, ok });
    techButtons.forEach((b, n) => { b.ariaPressed = String(n === (ok ? 0 : 1)); });
    if (!ok) toast("Noté : la charge n'augmentera pas la prochaine fois.", 'info');
  }));
  return [h('div', { className: 'group' }, h('span', { className: 'label' }, 'Technique propre ?'), h('div', { className: 'chips' }, techButtons)),
    h('div', { className: 'group' }, h('span', { className: 'label' }, 'Ressenti'), h('div', { className: 'chips' }, feelButtons))];
}

// Enregistre une série ; un record personnel (un par exercice et par séance) est détecté avant l'ajout, annoncé et noté (pr).
function logSet(e, n, kg, reps, mode) {
  const value = isBodyweight(e) ? 0 : kg;
  const sid = state.active.session;
  const already = journal().some((x) => x.session === sid && x.ex === e.id && x.pr);
  const pr = !already && recordKind(historyOf(e.id), sid, { kg: value, reps });
  record({ type: 'set', ex: e.id, set: n, kg: value, reps, ...(mode !== 'normal' && { mode }), ...(pr && { pr }) });
  const entry = log.at(-1);
  // Erreur de doigt : « Annuler » pendant 5 s retire la série (entrée undo, le journal garde la trace).
  toast(pr ? `Nouveau record : ${setText(e, value, reps)}` : `Série ${n} enregistrée`, pr ? 'record' : 'success', () => undoSet(entry));
  if (pr && !projected()) fanfare(); // l'écran projeté a son propre bandeau
  if (pr) announce(micOpen() ? 'Nouveau record !' : `Nouveau record ! ${setSpeech(e, value, reps)}.`);
  return pr;
}
export function undoSet(entry) {
  record({ type: 'undo', target: entry.t, ex: entry.ex, set: entry.set });
  stopRest();
  ui.pick = null;
  render();
  toast(`Série ${entry.set} retirée`, 'info');
}
export const setText = (e, kg, reps) => (isBodyweight(e) ? `${reps}\u00a0${unitText(e)}` : `${kgLabel(e, kg)}\u00a0×\u00a0${reps}${e.unit === 's' ? '\u00a0s' : ''}`);
// Texte d'une série pour la voix : « 10 répétitions à 42,5 kilos ».
export function setSpeech(e, kg, reps) {
  const what = `${reps} ${e.unit === 's' ? 'secondes' : 'répétitions'}`;
  if (isBodyweight(e) || kg == null) return what;
  return `${what} à ${kg.toLocaleString('fr-FR')} kilos${{ halteres: ' par haltère', elastique: " d'élastique" }[e.load] || ''}`;
}

export function block(item, d, i) {
  const x = exercise(item);
  const { e, it, tip, done } = x;
  const side = e.load === 'smith' && tip.kg != null ? plates(tip.kg, state.config.loads) : null;
  const approach = warmup(e, tip.kg, state.config.loads);
  const hint = h('p', { className: 'caption' }, 'Répétitions en gris = prévues : touche ✓ si la série est faite comme prévu. Pour corriger, change la valeur et valide à nouveau.');
  return h('section', { className: 'card' },
    h('div', { className: 'card-head' }, h('h2', { className: 'title' }, e.name), tip.learning && h('span', { className: 'badge' }, 'Apprentissage du geste')),
    h('p', { className: 'meta' }, `${prescriptionText(e, it)} · garde ${rir(e, state.config.level)} rép. en réserve`),
    h('p', { className: 'tip' }, tip.kg != null && h('strong', {}, `${kgLabel(e, tip.kg)} · `), tip.note),
    side && h('p', { className: 'meta' }, side.length ? `De chaque côté : ${side.map((w) => w.toLocaleString('fr-FR')).join(' + ')}\u00a0kg` : 'Barre seule, sans disque'),
    approach.length > 0 && h('p', { className: 'meta' }, `Approche : ${approach.map(([kg, reps]) => `${kgText(kg)}\u00a0×\u00a0${reps}`).join(' · ')}`),
    e.main && h('p', { className: 'note' }, icon('video'), e.load === 'smith' ? 'Avant la première série lourde : règle les butées et filme-toi.' : 'Filme ta première série pour vérifier le geste.'),
    lazy('more', h('summary', {}, "Voir l'exercice et les consignes", icon('chevron', 'chev')), () => exerciseInfo(e)),
    h('div', { className: 'sets' },
      h('span', { className: 'caption head n' }, 'Série'), h('span', { className: 'caption head' }, LOAD_HEAD[e.load]), h('span', { className: 'caption head' }, e.unit === 's' ? 'Secondes' : 'Répét.'), h('span'),
      Array.from({ length: it.sets }, (_, n) => setRow(x, n + 1, done.get(n + 1), { ...tip, kg: [...done.values()].at(-1)?.kg ?? tip.kg }))),
    hint,
    ...feedback(e, d, i));
}

// « 0 série », « 1 série », « 2 séries » : en français, 0 et 1 restent au singulier.
export const plural = (n, one, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
export const kgText = (kg) => `${kg.toLocaleString('fr-FR')}\u00a0kg`; // espace insécable : « kg » ne part jamais seul à la ligne
export const clock = (iso) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

// Menus de charges : construits une fois par liste puis clonés (une séance en affiche une douzaine d'environ 50 choix).
const menus = new Map();
function loadMenu(e, list) {
  const key = `${e.load}|${list.join()}`;
  if (!menus.has(key)) menus.set(key, h('select', {}, h('option', { value: '' }, 'Choisir'), list.map((x) => h('option', { value: x }, kgLabel(e, x).replace('élastique ', '')))));
  return menus.get(key).cloneNode(true);
}

function setRow(x, n, done, tip) {
  const { e, it: item } = x;
  let kg;
  if (isBodyweight(e)) kg = h('span', { className: 'caption bw' }, 'Poids du corps');
  else {
    // Liste des charges réalisables : impossible de saisir une charge qu'on ne peut pas monter.
    const list = loadable(e, state.config.loads);
    const value = done?.kg ?? tip.kg;
    if (value != null && !list.includes(value)) list.push(value);
    kg = loadMenu(e, list.sort((a, b) => a - b));
    kg.ariaLabel = `Charge série ${n}`;
    if (value != null) kg.value = String(value);
  }
  const planned = () => plannedReps(x, isBodyweight(e) ? null : Number(kg.value) || tip.kg, n);
  const reps = h('input', { type: 'number', inputMode: 'numeric', min: 0, max: 300, step: 1, value: done?.reps ?? '', placeholder: String(planned()), ariaLabel: `${e.unit === 's' ? 'Secondes' : 'Répétitions'} série ${n}` });
  if (kg.tagName === 'SELECT') kg.onchange = () => { reps.placeholder = String(planned()); };
  const mark = (t) => { ok.className = 'btn done'; ok.replaceChildren(icon('check'), clock(t)); };
  const ok = button(null, () => {
    const kgValue = isBodyweight(e) ? 0 : Number(kg.value);
    if (!isBodyweight(e) && kg.value === '') return toast('Choisis la charge utilisée.', 'warning');
    const repsValue = reps.value === '' ? Number(reps.placeholder) : Number(reps.value); // champ vide = fait comme prévu
    if (!Number.isInteger(repsValue) || repsValue < 0 || repsValue > 300) return toast(`Indique les ${e.unit === 's' ? 'secondes tenues' : 'répétitions faites'}.`, 'warning');
    reps.value = repsValue;
    logSet(e, n, kgValue, repsValue, tip.mode);
    mark(log.at(-1).t);
    // Séries suivantes pas encore choisies : même charge par défaut.
    ok.parentElement.querySelectorAll('select').forEach((s) => { if (s.value === '') s.value = kg.value; });
    if (n < item.sets) startRest(item.rest);
  }, { variant: 'gray', icon: 'check', ariaLabel: `Valider la série ${n}` });
  if (done) mark(done.t);
  return [h('span', { className: 'n' }, String(n)), kg, reps, ok];
}

export async function onFeel(e, value, d, i, buttons) {
  if (value === 'pain' && !await painZone(e)) return; // feuille fermée ou Annuler : rien n'est noté
  record({ type: 'feel', ex: e.id, feel: value });
  buttons.forEach((b) => { b.ariaPressed = String(b.dataset.feel === value); });
  if (value !== 'pain') return;
  if (!await ask({ title: 'Douleur notée', text: "Bien de l'avoir signalé. Pour les prochaines séances : écarter cet exercice et le remplacer (tu pourras le réintégrer dans Réglages), ou le garder avec une charge réduite. Si la douleur persiste, consulte un professionnel de santé.",
    confirm: 'Écarter et remplacer', cancel: 'Garder, charge réduite' })) return;
  const item = state.plan[d].items[i];
  const before = { ...item };
  state.config.avoid = [...state.config.avoid, e.id];
  if (!swap(EXOS, state.plan, state.config, d, i)) toast("Aucun exercice de remplacement : saute-le aujourd'hui.", 'warning');
  else toast(`Exercice écarté : ${e.name}`, 'info', () => { state.config.avoid = state.config.avoid.filter((x) => x !== e.id); Object.assign(item, before); save(); render(); });
  save();
  render();
}

// Carte des douleurs : où ça fait mal. Deux fois la même zone en 8 semaines : proposition de l'ajouter aux zones fragiles
// (les exercices à risque pour elle sont alors écartés du programme).
async function painZone(e) {
  const zone = await choose({ title: 'Où as-tu mal ?', text: 'Noté dans ton suivi, pour repérer une zone qui revient.',
    actions: [...Object.entries(ZONES).map(([value, label]) => ({ label, value })), { label: 'Ailleurs', value: 'other' }, { label: 'Annuler', value: null, variant: 'plain' }] });
  if (!zone) return null;
  record({ type: 'pain', ex: e.id, zone });
  const since = new Date(Date.now() - 56 * 864e5).toISOString();
  const times = log.filter((x) => x.type === 'pain' && x.zone === zone && x.t >= since && !cancelled(log).has(x.session)).length;
  if (zone === 'other' || times < 2 || state.config.zones.includes(zone)) return zone;
  if (!await ask({ title: `${ZONES[zone]} : ${times}e douleur en 8 semaines`, text: `Ajouter « ${ZONES[zone]} » à tes zones fragiles ? Les exercices à risque pour cette zone seront écartés du programme. Si la douleur persiste, consulte un professionnel de santé.`,
    confirm: 'Ajouter aux zones fragiles', cancel: 'Pas maintenant' })) return zone;
  state.config.zones = [...state.config.zones, zone];
  repair(EXOS, state.plan, state.config);
  save();
  toast(`${ZONES[zone]} ajoutée aux zones fragiles`, 'success');
  return zone;
}
