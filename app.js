// Interface : onboarding, programme de la semaine, séance en cours, progrès. Logique métier dans plan.js.
// Domaines à part : voice.js (micro), camera.js (caméra qui compte), screen.js (écran projeté), push.js (notifications),
// backup.js (sauvegarde, export) ; démarrage dans main.js.

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const MUSCLES = { 1: 'biceps', 2: 'épaules', 3: 'dentelé', 4: 'pectoraux', 5: 'triceps', 6: 'abdos', 7: 'mollets', 8: 'fessiers', 9: 'trapèzes', 10: 'quadriceps', 11: 'ischios', 12: 'grand dorsal', 13: 'brachial', 14: 'obliques', 15: 'soléaire', 16: 'lombaires' };
const FEELS = [['easy', 'Facile'], ['ok', 'Bien'], ['hard', 'Dur'], ['pain', 'Douleur']];
const PLATES = [1.25, 2.5, 5, 10, 15, 20, 25];
const LOAD_HEAD = { smith: 'kg (total)', halteres: 'kg / haltère', kettlebell: 'kg', elastique: 'Élastique', pdc: 'Charge' };
// Matériel de Laurent (2026-11-01) : modifiable dans Réglages.
const DEFAULTS = {
  level: 'debutant', goal: 'muscle', days: [0, 2, 4], minutes: 45, zones: [], avoid: [], seed: 1,
  equipment: ['smith', 'halteres', 'kettlebell', 'banc', 'banc-incline', 'traction', 'elastique', 'tapis'],
  loads: { bar: 19, plates: { 1.25: 2, 2.5: 2, 5: 2, 10: 2, 20: 4 }, halteres: [10], kettlebell: [16], elastiques: [30, 20, 10] },
};
const VERSION = 2; // v1 = matériel et exercices wger bruts : on refait l'onboarding, le journal est gardé
const BACKUP_DAYS = 14;
const KEY = 'muscu-auto';
const LOG_KEY = 'muscu-auto-log';

const byId = new Map(EXOS.map((e) => [e.id, e]));
const app = document.getElementById('app');

function h(tag, props = {}, ...kids) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...kids.flat(Infinity).filter((k) => k != null && k !== false && k !== ''));
  return node;
}

// --- Composants communs : toute l'appli passe par eux, les états et tailles sont définis une fois (index.html) ---

// Icônes au trait (style SF Symbols), dessinées sur une grille de 24.
const ICONS = {
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M9.5 2.5h5"/>',
  chart: '<path d="M5 20v-6M12 20V8M19 20V4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  warning: '<path d="M12 3.5L2.5 20h19L12 3.5z"/><path d="M12 10v4.5M12 17.5v.01"/>',
  video: '<rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5L21 7.5v9l-5.5-3"/>',
  flame: '<path d="M12 21c-3.9 0-7-2.7-7-6.5 0-3.4 2.6-5.6 4-8.5.5 2 1.6 3.3 3 4 0-3 1.5-5.5 3-7 .3 3.5 4 5.8 4 11.5 0 3.8-3.1 6.5-7 6.5z"/>',
  leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19c3-4 6-6.5 10-8.5"/>',
  flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
  save: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  offline: '<path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M12 19h.01M3 3l18 18"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8 5.2-5.8"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8v.01"/>',
  xCircle: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  tv: '<rect x="2.5" y="4.5" width="19" height="13" rx="2.5"/><path d="M8 21h8M12 17.5V21"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  camera: '<path d="M3.5 8.5h3.5l2-2.5h6l2 2.5h3.5v10.5h-17z"/><circle cx="12" cy="13.5" r="3.5"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M8 10.5H6.5a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-6.5a2 2 0 0 0-2-2H16"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>',
};
function icon(name, className = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', `icon ${className}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[name]; // tracés fixes ci-dessus
  return svg;
}

// variant : 'tinted' (défaut) | 'primary' | 'gray' | 'plain' | 'danger' ; size : 'large' | 'compact'.
function button(label, onclick, { variant, size, icon: name, ...props } = {}) {
  return h('button', { type: 'button', className: ['btn', variant, size].filter(Boolean).join(' '), onclick, ...props }, name && icon(name), label);
}

function chip(label, pressed, onclick, { danger, iconName, variant, ...props } = {}) {
  return h('button', { type: 'button', className: ['chip', variant, danger && 'danger'].filter(Boolean).join(' '), ariaPressed: String(!!pressed), onclick, ...props }, iconName && icon(iconName), label);
}

const load = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
let state = load(KEY) || {};
if (state.v !== VERSION) state = { v: VERSION, lastExport: state.lastExport };
let log = load(LOG_KEY) || [];
let ui = { view: state.config ? 'week' : 'onboarding', step: 0, draft: null };

let revision = 0; // change à chaque enregistrement : un écran gardé en mémoire d'une révision antérieure est périmé
function save() {
  revision++;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
    broadcast();
  } catch {
    toast("Enregistrement impossible : sauvegarde ton journal depuis l'onglet Progrès.", 'error');
  }
}

// Toute saisie passe ici : horodatage automatique, journal en ajout seul.
function record(entry) {
  log.push({ t: new Date().toISOString(), ...(state.active && { session: state.active.session }), ...entry });
  save();
}

// Message en haut d'écran, icône selon sa nature ; avec `undo`, un bouton Annuler pendant 5 s.
const TOAST_ICONS = { record: 'flag', success: 'checkCircle', info: 'info', warning: 'warning', error: 'xCircle', timer: 'timer', offline: 'offline' };
function toast(text, kind = 'info', undo) {
  document.querySelector('.toast')?.remove();
  const node = h('div', { className: `toast ${kind}`, role: ['warning', 'error', 'offline'].includes(kind) ? 'alert' : 'status' }, icon(TOAST_ICONS[kind]), h('span', {}, text),
    undo && button('Annuler', () => { node.remove(); undo(); }, { variant: 'plain', size: 'compact' }));
  document.body.append(node);
  setTimeout(() => node.remove(), undo ? 5000 : 3000);
}

// Feuille de choix en bas d'écran (façon iOS). actions = [{ label, value, variant }] ; résout la valeur choisie, null si fermée.
function choose({ title, text, extra, actions }) {
  return new Promise((resolve) => {
    const dialog = h('dialog', { className: 'sheet' });
    if (!dialog.showModal) return resolve(confirm(`${title}\n${text || ''}`) ? actions[0].value : null);
    const close = (value) => { dialog.close(); dialog.remove(); resolve(value); };
    dialog.append(h('div', { className: 'sheet-body' },
      h('div', { className: 'stack' }, h('h2', { className: 'title' }, title), text && h('p', { className: 'meta' }, text)),
      extra,
      h('div', { className: 'stack' }, actions.map((a) => button(a.label, () => close(a.value), { variant: a.variant || 'gray', size: 'large' })))));
    dialog.addEventListener('cancel', (ev) => { ev.preventDefault(); close(null); });
    document.body.append(dialog);
    dialog.showModal();
  });
}

// Confirmation simple : résout true si confirmé.
async function ask({ confirm: ok, cancel = 'Annuler', danger, ...sheet }) {
  return (await choose({ ...sheet, actions: [{ label: ok, value: true, variant: danger ? 'gray destructive' : 'primary' }, { label: cancel, value: false }] })) === true;
}

// Onglets gardés en mémoire : y revenir est instantané et retrouve la position de défilement, comme sur iOS.
// Reconstruits seulement si quelque chose a été enregistré depuis, ou si la date a changé (« Aujourd'hui »).
const screens = new Map(); // vue → { node, revision, day, scroll }
const KEPT = ['week', 'session', 'progress'];
const today = () => new Date().toDateString();

function show(view) {
  const from = screens.get(ui.view);
  if (from) from.scroll = scrollY;
  ui.view = view;
  const kept = screens.get(view);
  if (kept && kept.revision === revision && kept.day === today()) {
    mount(kept.node);
    scrollTo(0, kept.scroll);
    return;
  }
  render();
  scrollTo(0, 0);
}

function render() {
  const views = { onboarding, week, session, progress, settings, done: finishScreen };
  if (ui.view === 'session' && !state.active) ui.view = 'week'; // séance terminée ailleurs (remise à zéro, autre appareil) : retour au programme
  const node = views[ui.view]();
  if (KEPT.includes(ui.view)) screens.set(ui.view, { node, revision, day: today(), scroll: 0 });
  mount(node);
  broadcast();
}

function mount(node) {
  document.body.classList.toggle('has-tabs', ui.view !== 'onboarding');
  document.body.classList.toggle('ob-mode', ui.view === 'onboarding');
  document.body.classList.toggle('focus-mode', ui.view === 'session' && !state.listMode && !state.active?.paused);
  app.replaceChildren(...[node, nav()].filter(Boolean));
  placeBars();
  if (ui.view === 'session') keepAwake();
  // Nouvel écran d'onboarding : le lecteur d'écran repart du titre.
  if (ui.focus) { ui.focus = false; const t = app.querySelector('h1'); t.tabIndex = -1; t.focus({ preventScroll: true }); }
}

function nav() {
  if (ui.view === 'onboarding') return null;
  const tab = (view, label, name) => h('button', { type: 'button', className: 'tab', ariaCurrent: ui.view === view ? 'page' : null, onclick: () => show(view) }, icon(name), label);
  return h('nav', { className: 'tabs' }, tab('week', 'Programme', 'calendar'), state.active && tab('session', 'Séance', 'timer'), tab('progress', 'Progrès', 'chart'));
}

// --- Onboarding (premier lancement) ---

const standalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const iphone = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

// Écrans selon le contexte : installation seulement dans Safari sur iPhone, charges seulement si du matériel chargeable est coché.
function steps(d) {
  return [welcome, iphone() && !standalone() && stepInstall, stepLevel, stepGoal, stepEquipment,
    d.equipment.some((q) => LOADED_GEAR.includes(q)) && stepLoads, stepPlanning, stepZones, stepFirstWeek].filter(Boolean);
}

function onboarding() {
  const d = (ui.draft ||= structuredClone(DEFAULTS));
  const list = steps(d);
  const last = ui.step === list.length - 1;
  return h('div', { className: 'ob' },
    ui.step > 0 && h('div', { className: 'ob-top' },
      button('Retour', () => go(-1), { variant: 'plain', icon: 'back' }),
      h('div', { className: 'progress' }, h('span', { style: `width: ${(ui.step / (list.length - 1)) * 100}%` })),
      h('span', { className: 'caption' }, `${ui.step}/${list.length - 1}`)),
    list[ui.step](d),
    h('div', { className: 'ob-footer' },
      button(ui.step === 0 ? 'Commencer' : last ? 'Voir ma semaine' : 'Continuer', () => (last ? applyConfig() : go(1)),
        { variant: 'primary', size: 'large', disabled: !d.days.length })));
}

function go(delta) {
  ui.step += delta;
  ui.focus = true;
  render();
  scrollTo(0, 0);
}

function step(title, lead, ...content) {
  return h('div', { className: 'step' }, h('div', { className: 'stack' }, h('h1', {}, title), lead && h('p', { className: 'lead' }, lead)), ...content);
}

// Choix unique en grandes lignes, coche à droite : entries = [[valeur, titre, détail]].
function choice(d, key, entries) {
  return h('div', { className: 'options' }, entries.map(([value, label, hint]) =>
    h('button', { type: 'button', className: 'option', ariaPressed: String(d[key] === value), onclick: () => { d[key] = value; render(); } },
      h('span', { className: 'stack tight' }, h('strong', {}, label), hint && h('span', { className: 'meta' }, hint)), icon('check'))));
}

// Choix unique en pastilles : entries = [[valeur, libellé]].
function pills(d, key, entries) {
  const group = h('div', { className: 'chips' }, entries.map(([value, label]) => chip(label, d[key] === value, () => { d[key] = value; renderInPlace(key); })));
  group.dataset.key = key;
  return group;
}
// Re-rendu sans saut : le groupe touché reste à la même hauteur à l'écran, même si un message apparaît au-dessus
// (Réglages : « nouveau programme » en tête dès qu'on change la durée ou les jours).
function renderInPlace(key) {
  const top = () => document.querySelector(`[data-key="${key}"]`)?.getBoundingClientRect().top;
  const before = top();
  render();
  const after = top();
  if (before != null && after != null) scrollBy(0, after - before);
}

// Choix multiple en pastilles : entries = [[valeur, libellé]].
function chips(d, key, entries, { max, className = 'chips' } = {}) {
  const toggle = (value) => {
    if (d[key].includes(value)) d[key] = d[key].filter((v) => v !== value);
    else if (max && d[key].length >= max) return toast(`${max} jours maximum : garde au moins un jour de repos.`, 'warning');
    else d[key] = [...d[key], value];
    renderInPlace(key);
  };
  const group = h('div', { className }, entries.map(([value, label]) => chip(label, d[key].includes(value), () => toggle(value))));
  group.dataset.key = key;
  return group;
}

// Valeur puis compteur « − | + » compact façon iOS, mis à jour sur place : le focus reste sur le bouton touché.
function stepper(value, onChange, { min = 0, max, step = 1, unit, label }) {
  const out = h('output', {});
  const show = () => { out.textContent = unit === 'kg' ? kgText(value) : `${value} ${unit}${value > 1 ? 's' : ''}`; };
  const set = (v) => { value = Math.min(max, Math.max(min, Math.round(v * 100) / 100)); show(); onChange(value); };
  show();
  return h('span', { className: 'stepper-field' }, out,
    h('span', { className: 'stepper', role: 'group', ariaLabel: label },
      button('−', () => set(value - step), { variant: 'plain', ariaLabel: `Moins : ${label}` }),
      h('i', { className: 'divider' }),
      button('+', () => set(value + step), { variant: 'plain', ariaLabel: `Plus : ${label}` })));
}

// « 10, 12,5 » = 10 et 12,5 : la virgule entre deux chiffres est décimale.
const numbers = (text) => [...new Set(String(text).replace(/(\d),(\d)/g, '$1.$2').split(/[;,\s]+/).map(Number).filter((x) => x > 0 && x <= 300))];

// Poids disponibles (haltères, kettlebells, élastiques) : une ligne par poids avec « Retirer » (annulable), champ pour en ajouter.
const WEIGHTS = {
  halteres: ['Haltères', 'Chaque poids que tu peux monter sur un haltère. Le programme ne proposera que ceux-là.'],
  kettlebell: ['Kettlebells', 'Le poids de chaque kettlebell que tu as.'],
  elastiques: ['Élastiques', 'La résistance indiquée sur chacun de tes élastiques.'],
};
function weights(d, key) {
  const [label, help] = WEIGHTS[key];
  const box = h('section', { className: 'card' });
  const draw = (focus) => {
    const input = h('input', { className: 'input', type: 'text', inputMode: 'decimal', placeholder: 'Ajouter un poids (kg)', ariaLabel: `Ajouter un poids : ${label}` });
    const add = () => {
      const v = numbers(input.value);
      if (!v.length) return toast('Indique un poids en kg.', 'warning');
      d.loads[key] = [...new Set([...(d.loads[key] || []), ...v])].sort((a, b) => a - b);
      draw(true);
    };
    input.onkeydown = (ev) => { if (ev.key === 'Enter') add(); };
    const list = [...(d.loads[key] || [])].sort((a, b) => a - b);
    const remove = (kg) => {
      d.loads[key] = list.filter((x) => x !== kg);
      draw();
      toast(`${kgText(kg)} retiré`, 'info', () => { d.loads[key] = [...d.loads[key], kg].sort((a, b) => a - b); draw(); });
    };
    box.replaceChildren(h('div', { className: 'stack tight' }, h('h2', {}, label), h('p', { className: 'caption' }, help)),
      list.length ? h('div', { className: 'list' }, list.map((kg) => h('div', { className: 'line' }, h('span', {}, kgText(kg)),
        button('Retirer', () => remove(kg), { variant: 'plain', className: 'btn plain destructive', ariaLabel: `Retirer ${kgText(kg)} (${label})` }))))
        : h('p', { className: 'note' }, icon('warning'), 'Aucun poids : les exercices concernés sont écartés du programme.'),
      h('div', { className: 'row' }, h('div', { style: 'flex: 1' }, input), button('Ajouter', add)));
    if (focus) input.focus();
  };
  draw();
  return box;
}

// Charges exactes : le programme ne proposera que ce que tu peux monter.
function loadsEditor(d) {
  const has = (q) => d.equipment.includes(q);
  const range = h('p', { className: 'meta' });
  const refresh = () => {
    const grid = loadable({ load: 'smith' }, d.loads);
    range.textContent = grid.length > 1
      ? `Charges possibles : ${kgText(grid[0])} à ${kgText(grid.at(-1))}, par ${kgText(Math.min(...grid.slice(1).map((kg, i) => kg - grid[i])))}.`
      : 'Ajoute des disques pour charger la barre.';
  };
  refresh();
  return [
    has('smith') && h('section', { className: 'card' }, h('h2', {}, 'Smith machine'),
      h('div', { className: 'list' },
        h('div', { className: 'line' }, h('span', {}, 'Barre'),
          stepper(d.loads.bar, (v) => { d.loads.bar = v; refresh(); }, { step: 0.5, max: 40, unit: 'kg', label: 'poids de la barre' }))),
      h('div', { className: 'group' }, h('span', { className: 'label' }, 'Disques, par paires (un de chaque côté)'),
        h('div', { className: 'list' }, PLATES.map((p) => h('div', { className: 'line' }, h('span', {}, kgText(p)),
          stepper(Math.floor((d.loads.plates[p] || 0) / 2), (v) => { d.loads.plates[p] = v * 2; refresh(); }, { max: 10, unit: 'paire', label: `paires de disques de ${kgText(p)}` }))))),
      range),
    ...Object.entries(WEIGHT_LISTS).map(([q, key]) => has(q) && weights(d, key)),
  ];
}

// Jours et durée, avec ce que ça donne : la répartition des séances change selon les jours choisis.
function planningEditor(d) {
  const sessions = d.days.length ? generate(EXOS, d) : [];
  return [
    h('div', { className: 'group' }, h('span', { className: 'label' }, 'Jours'),
      chips(d, 'days', DAYS.map((day, i) => [i, day.slice(0, 3)]), { max: MAX_DAYS, className: 'days' })),
    sessions.length > 0 && h('div', { className: 'list' }, sessions.map((s) => h('div', { className: 'line' }, h('span', {}, DAYS[s.day]), h('span', { className: 'meta' }, s.name)))),
    backToBack(d.days) && h('p', { className: 'caption' }, "Jours qui se suivent : jamais les mêmes muscles deux jours d'affilée."),
    h('div', { className: 'group' }, h('span', { className: 'label' }, 'Durée par séance'),
      pills(d, 'minutes', [30, 45, 60, 75].map((m) => [m, `${m} min`])),
      h('p', { className: 'caption' }, `${exerciseCount(d.minutes)} exercices par séance.`)),
  ];
}

function zonesEditor(d) {
  const reintegrate = (id) => { d.avoid = d.avoid.filter((x) => x !== id); render(); };
  return [
    chips(d, 'zones', Object.entries(ZONES)),
    d.avoid.length > 0 && h('div', { className: 'group' },
      h('span', { className: 'label' }, 'Exercices écartés après une douleur. Réintégré, un exercice repart en apprentissage : 2 séances légères.'),
      h('div', { className: 'list' }, d.avoid.map((id) => h('div', { className: 'line' }, h('span', {}, byId.get(id)?.name || `Exercice ${id}`),
        button('Réintégrer', () => reintegrate(id), { size: 'compact' }))))),
  ];
}

function welcome() {
  return h('div', { className: 'step welcome' },
    h('img', { className: 'app-icon', src: 'icon-180.png', alt: '' }),
    h('div', { className: 'stack' }, h('h1', {}, 'Steady'), h('p', { className: 'lead' }, 'Progresse sans te blesser : tes séances, programmées selon ton matériel.')),
    h('ul', { className: 'features' },
      [['calendar', 'Programme automatique', 'Renouvelé par cycles, adapté à tes jours.'],
        ['eye', 'Chaque geste montré', 'Visuels, muscles et consignes de sécurité.'],
        ['chart', 'La technique avant la charge', 'Les charges montent seulement quand le geste est propre.']]
        .map(([name, title, text]) => h('li', {}, icon(name), h('div', { className: 'stack tight' }, h('strong', {}, title), h('span', { className: 'meta' }, text))))),
    h('div', {}, button("J'ai un code de récupération", restoreFlow, { variant: 'plain' })));
}

// Sur iPhone, l'appli installée a son propre stockage : on installe avant de régler, sinon tout est à refaire.
const stepInstall = () => step("Installe-la d'abord", "Sur l'écran d'accueil, l'appli s'ouvre en plein écran, marche sans réseau, et Safari n'efface pas ton suivi.",
  h('ol', { className: 'howto' },
    h('li', {}, 'Touche ', h('strong', {}, 'Partager'), ' en bas de Safari (carré avec une flèche).'),
    h('li', {}, 'Choisis ', h('strong', {}, "Sur l'écran d'accueil"), ', puis Ajouter.'),
    h('li', {}, 'Ouvre Steady depuis sa nouvelle icône et règle-la là.')),
  h('p', { className: 'note' }, icon('warning'), "Ce que tu règles ici dans Safari ne suit pas dans l'appli installée."));

const stepLevel = (d) => step('Ton niveau', 'Il règle le nombre de séries et la marge de sécurité.',
  choice(d, 'level', Object.entries(LEVELS).map(([k, l]) => [k, l.label, l.hint])));

const stepGoal = (d) => step('Ton objectif', null,
  choice(d, 'goal', Object.entries(GOALS).map(([k, g]) => [k, g.label, g.hint])),
  d.level === 'debutant' && d.goal === 'force' && h('p', { className: 'note' }, icon('warning'), 'La force demande une technique solide : commence plutôt par la prise de muscle quelques mois.'));

const stepEquipment = (d) => step('Ton matériel', 'Coche ce que tu as. Le poids du corps est toujours inclus.',
  chips(d, 'equipment', Object.entries(TAGS)));

const stepLoads = (d) => step('Tes charges', 'Le programme ne proposera que ce que tu peux vraiment charger.', loadsEditor(d));

const stepPlanning = (d) => step('Ton planning', null, h('section', { className: 'card' }, planningEditor(d)));

const stepZones = (d) => step('Des zones fragiles ?', 'Les exercices à risque pour elles sont écartés. Douleur persistante : consulte un professionnel de santé.', zonesEditor(d));

function stepFirstWeek(d) {
  const plan = d.days.length ? generate(EXOS, d) : [];
  return step('Ta première semaine', null,
    plan.map((s) => h('section', { className: 'card' }, h('h2', {}, `${DAYS[s.day]} · ${s.name}`),
      h('p', { className: 'meta' }, s.items.map((it) => byId.get(it.ex).name).join(' · ')))),
    h('section', { className: 'card' }, h('h2', {}, 'À ta première séance'),
      h('ul', { className: 'stack' },
        h('li', {}, "Charges légères : chaque exercice commence par 2 séances d'apprentissage."),
        h('li', {}, `Garde au moins ${Math.max(2, LEVELS[d.level].rir)} répétitions en réserve sur les gros mouvements.`),
        h('li', {}, 'Le minuteur de repos démarre tout seul après chaque série.'),
        h('li', {}, "Douleur articulaire : arrête et signale-la, l'exercice sera écarté."))));
}

// --- Réglages : chaque section se modifie seule, enregistrement en une fois ---

function openSettings() {
  ui.draft = structuredClone(state.config);
  ui.draft.mirrorCam ||= 'front';
  show('settings');
}

function settings() {
  const d = (ui.draft ||= structuredClone(state.config));
  const restart = ['days', 'goal', 'level', 'minutes'].some((k) => JSON.stringify(d[k]) !== JSON.stringify(state.config[k]));
  // Pendant une séance, un nouveau programme la casserait : seuls matériel, poids, zones et mise à jour restent modifiables.
  const blocked = restart && state.active;
  const section = (title, ...content) => h('section', { className: 'card' }, h('h2', {}, title), ...content);
  return h('div', { className: 'screen' },
    h('header', { className: 'navbar' },
      button('Annuler', () => { ui.draft = null; show('week'); }, { variant: 'plain', className: 'btn plain start' }),
      h('h1', {}, 'Réglages'),
      button('Enregistrer', applyConfig, { variant: 'plain', className: 'btn plain end', disabled: !d.days.length || blocked })),
    blocked ? h('p', { className: 'note' }, icon('warning'), 'Une séance est en cours : termine-la ou arrête-la avant de changer le niveau, l\'objectif, les jours ou la durée.')
      : restart && h('p', { className: 'note' }, icon('warning'), 'Niveau, objectif, jours ou durée changés : un nouveau programme et un nouveau cycle commenceront.'),
    section('Niveau', pills(d, 'level', Object.entries(LEVELS).map(([k, l]) => [k, l.label]))),
    section('Objectif', pills(d, 'goal', Object.entries(GOALS).map(([k, g]) => [k, g.label]))),
    section('Matériel', chips(d, 'equipment', Object.entries(TAGS)), loadsEditor(d)),
    section('Planning', planningEditor(d)),
    section('Zones fragiles', zonesEditor(d)),
    section('Sauvegarde', cloudEditor()),
    section('Séance',
      h('div', { className: 'list' }, toggle('Coach vocal', d.voice !== false, (v) => { d.voice = v; })),
      h('p', { className: 'caption' }, "Annonce la série suivante, la fin du repos et tes records. Sur l'écran projeté s'il est connecté, sinon sur l'iPhone."),
      window.speechSynthesis && voicePicker(d),
      h('div', { className: 'stack tight' }, h('span', {}, 'Caméra du miroir'), pills(d, 'mirrorCam', [['front', 'Avant'], ['back', 'Arrière grand-angle']])),
      h('p', { className: 'caption' }, "Pour la pastille Miroir. L'arrière grand-angle cadre bien plus large : tu restes plus près. Pose l'iPhone écran vers le mur."),
      state.screen && h('div', { className: 'line' }, h('span', {}, 'Écran projeté'), button("Oublier l'écran", forgetScreen, { variant: 'plain', className: 'btn plain destructive' }))),
    section('Notifications', notifyEditor(d)),
    section('Appli',
      // La doc s'ouvre hors de l'appli (feuille Safari sur iPhone) : on y revient d'un geste.
      h('a', { className: 'line doc-link', href: 'https://laurent-stp95.github.io/steady-docs/', target: '_blank', rel: 'noopener' }, h('span', {}, 'Aide et documentation'), icon('chevron', 'chev')),
      h('div', { className: 'line' },
        h('span', { className: 'meta' }, `Version du ${new Date(document.lastModified).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`),
        button('Mettre à jour', forceUpdate, { size: 'compact' })),
      log.length > 0 && h('div', { className: 'line' }, h('span', {}, 'Séances et séries'), button('Réinitialiser', resetLog, { variant: 'plain', className: 'btn plain destructive' }))));
}

// Voix du coach : « Automatique » prend la plus naturelle de l'iPhone (frenchVoice, shared.js). L'écran projeté garde la sienne.
function voicePicker(d) {
  const synth = window.speechSynthesis;
  const names = [...new Set(frenchVoices(synth).map((v) => v.name))];
  const menu = h('select', { className: 'input', ariaLabel: 'Voix du coach', onchange: () => { d.voiceName = menu.value || null; } },
    h('option', { value: '' }, 'Automatique'), names.map((name) => h('option', { value: name, selected: name === d.voiceName }, name)));
  const listen = () => {
    const u = new SpeechSynthesisUtterance("C'est reparti. Troisième série, 10 répétitions à 20 kilos.");
    u.lang = 'fr-FR';
    u.voice = frenchVoice(synth, d.voiceName);
    synth.cancel();
    synth.speak(u);
  };
  return h('div', { className: 'stack tight' },
    h('span', {}, 'Voix'),
    h('div', { className: 'line' }, menu, button('Écouter', listen, { size: 'compact', icon: 'play', style: 'flex: none' })),
    h('p', { className: 'caption' }, "Voix plus naturelle : sur l'iPhone, Réglages, Accessibilité, Contenu énoncé, Voix, Français, puis télécharge Amélie ou Thomas en version Premium. Elle est choisie toute seule ensuite."));
}

// Interrupteur iOS : toute la ligne se touche.
function toggle(label, checked, onchange) {
  return h('label', { className: 'line' }, h('span', {}, label),
    h('input', { type: 'checkbox', className: 'switch', role: 'switch', checked, onchange: (ev) => onchange(ev.target.checked) }));
}

function applyConfig() {
  const prev = state.config;
  state.config = structuredClone(ui.draft);
  const c = state.config;
  // Jours, objectif, niveau ou durée changés : nouveau programme et nouveau cycle. Sinon on répare et le cycle continue.
  if (!state.plan || ['days', 'goal', 'level', 'minutes'].some((k) => JSON.stringify(prev[k]) !== JSON.stringify(c[k]))) {
    state.plan = generate(EXOS, c);
    state.cycle = { start: monday(new Date()).toISOString() };
  } else {
    repair(EXOS, state.plan, c);
  }
  for (const id of prev?.avoid || []) if (!c.avoid.includes(id)) record({ type: 'reintegrate', ex: id });
  ui = { view: 'week', step: 0, draft: null };
  save();
  render();
  scrollTo(0, 0);
  syncPush();
  if (prev) toast('Réglages enregistrés', 'success');
}

// --- Programme ---

const restText = (s) => (s >= 120 ? `${s / 60} min` : `${s} s`);
const unitText = (e) => (e.unit === 's' ? 's' : 'rép.');
const cycle = () => cycleWeek(state.cycle);
// live = séance en cours : un point de forme « basse » l'allège comme une semaine allégée.
// Séance express : state.active.cut = { [ex]: séries gardées } (0 = exercice retiré aujourd'hui).
const effective = (item, live = false) => {
  const sets = cycle().deload || (live && state.active?.readiness === 'light') ? Math.ceil(item.sets / 2) : item.sets;
  const cut = live ? state.active?.cut?.[item.ex] : undefined;
  return { ...item, sets: cut != null ? Math.min(sets, cut) : sets };
};
const prescriptionText = (e, item) => `${item.sets} × ${item.reps}${e.unit === 's' ? ' s' : ''} · repos ${restText(item.rest)}`;
const muscles = (e) => e.mus.map((m) => MUSCLES[m]).join(', ');
const daysAgo = (iso) => Math.floor((Date.now() - Date.parse(iso)) / 864e5);
const freshCycle = () => !log.some((x) => x.type === 'start' && x.t >= state.cycle.start);

function banner(name, title, ...content) {
  return h('section', { className: 'card' }, h('div', { className: 'banner-head' }, icon(name), h('h2', {}, title)), ...content);
}

const weekday = (date = new Date()) => (date.getDay() + 6) % 7; // 0 = lundi

// Séances faites cette semaine (ahead : la semaine suivante), par jour : { t, sets, session }. Une séance abandonnée, vide
// ou réinitialisée ne compte pas. Une séance compte pour la semaine de son début, ou pour celle notée au départ (week :
// séance faite en avance, quand plus rien n'était prévu d'ici dimanche).
const weekOf = (x) => x.week || monday(new Date(x.t)).toISOString();
function doneThisWeek(ahead = false) {
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
function weekFrame() {
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
function weekProgress(plan, done, focus, heading) {
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

function week() {
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
async function resetLog() {
  const text = `Toutes tes séances et séries validées (${plural(log.length, 'saisie')}) seront effacées : records, courbes et historique repartent de zéro, et le cycle recommence cette semaine.${state.active ? ' La séance en cours sera abandonnée.' : ''} Ton profil, ton matériel et ton programme sont gardés.`;
  if (!await ask({ title: 'Es-tu sûr de vouloir réinitialiser tes séances ?', text, confirm: 'Réinitialiser', danger: true })) return;
  const before = { log, cycle: state.cycle, active: state.active };
  if (warm) { clearInterval(warm.timer); warm = null; }
  stopEar(false);
  stopRest();
  log = [];
  state.active = null;
  state.ended = null;
  state.cycle = { start: monday(new Date()).toISOString() };
  ui.at = ui.pick = null;
  save();
  render();
  toast('Séances réinitialisées', 'success', () => { log = before.log; Object.assign(state, { cycle: before.cycle, active: before.active }); save(); render(); });
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

// Onglets ARIA : un seul panneau construit à la fois (la vidéo ne charge qu'à l'ouverture), flèches pour naviguer.
// Même barre que le contrôle segmenté (segmented), sans aria-pressed : rôles tablist / tab et aria-selected à la place.
function tabs(segments) {
  if (segments.length === 1) return segments[0][1]();
  const bar = segmented(segments.map(([label], i) => [i, label]), undefined, (i) => select(i));
  const panel = h('div', { className: 'seg-panel' });
  bar.setAttribute('role', 'tablist');
  panel.setAttribute('role', 'tabpanel');
  const buttons = [...bar.children];
  buttons.forEach((b) => b.setAttribute('role', 'tab'));
  function select(i, focus) {
    buttons.forEach((b, n) => { b.setAttribute('aria-selected', String(n === i)); b.tabIndex = n === i ? 0 : -1; });
    panel.setAttribute('aria-label', segments[i][0]);
    panel.replaceChildren(segments[i][1]());
    if (focus) buttons[i].focus();
  }
  bar.onkeydown = (ev) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[ev.key];
    if (!step) return;
    const current = buttons.findIndex((b) => b.tabIndex === 0);
    select((current + step + buttons.length) % buttons.length, true);
  };
  select(0);
  return h('div', { className: 'segments' }, bar, panel);
}

// Repli dont le contenu n'est construit qu'à la première ouverture : rien à créer ni à charger tant qu'on ne regarde pas.
function lazy(className, summary, build) {
  const node = h('details', { className }, summary);
  node.addEventListener('toggle', () => { if (node.open && node.childElementCount === 1) node.append(build()); });
  return node;
}

// Visuels en onglets (mouvement, vidéo, muscles), puis consignes et description.
function exerciseInfo(e) {
  const img = (src, alt = '') => h('img', { src, alt, loading: 'lazy', onerror: (ev) => ev.target.remove() });
  const names = (ids) => ids.map((m) => MUSCLES[m]).join(', ');
  const side = (front) => h('div', { className: 'body' },
    img(`muscles/muscular_system_${front ? 'front' : 'back'}.svg`),
    e.mus2.filter((m) => FRONT.has(m) === front).map((m) => img(`muscles/secondary/muscle-${m}.svg`)),
    e.mus.filter((m) => FRONT.has(m) === front).map((m) => img(`muscles/main/muscle-${m}.svg`)));
  const anatomy = () => {
    const bodies = h('div', { className: 'bodies' }, side(true), side(false));
    bodies.setAttribute('role', 'img');
    bodies.setAttribute('aria-label', `Muscles travaillés : ${muscles(e)}`);
    return h('div', { className: 'anatomy' }, bodies,
      h('div', { className: 'legend' },
        h('span', {}, h('i', { className: 'dot main' }), `Principaux : ${names(e.mus)}`),
        e.mus2.length > 0 && h('span', {}, h('i', { className: 'dot second' }), `Secondaires : ${names(e.mus2)}`)));
  };
  const movement = () => h('div', {}, h('div', { className: 'shots' }, e.img.map((src, i) => img(src, `${e.name}, position ${i + 1}`))),
    e.visual && h('p', { className: 'caption' }, `Visuel : ${e.visual}${e.load === 'smith' && /barre libre/.test(e.visual) ? ', à faire à la Smith' : ''}.`));
  // Hors ligne, la vidéo (hébergée sur wger.de) ne peut pas charger : on le dit au lieu d'un lecteur vide.
  const offline = () => h('p', { className: 'note' }, icon('offline'), 'Hors ligne : la vidéo a besoin du réseau. Les images et les consignes restent disponibles.');
  const video = () => {
    if (!navigator.onLine) return h('div', {}, offline());
    const box = h('div', {});
    box.append(h('video', { src: e.vid, controls: true, preload: 'none', playsInline: true, onerror: () => box.replaceChildren(offline()) }),
      h('p', { className: 'caption' }, `Vidéo sur wger.de, ${e.vidMb} Mo. `, h('a', { href: e.vid, target: '_blank', rel: 'noopener' }, 'Ouvrir à part')));
    return box;
  };
  return h('div', { className: 'info' },
    tabs([e.img.length > 0 && ['Mouvement', movement], e.vid && ['Vidéo', video], ['Muscles', anatomy]].filter(Boolean)),
    h('ul', { className: 'cue' }, (e.cues || [CUES[e.zone]]).map((c) => h('li', {}, c))),
    e.desc && h('p', {}, e.desc),
    h('p', { className: 'caption' }, `Matériel : ${e.eq.map((q) => TAGS[q] || 'poids du corps').join(', ')}`),
    h('p', { className: 'caption' }, `Source wger.de · texte d'origine : ${e.author || 'wger'} (${e.lic}), réécrit et adapté en français${e.imgBy ? ` · images : ${e.imgBy}` : ''}`));
}

// --- Séance ---

async function start(d) {
  if (state.active && state.active.day !== d) {
    if (!await ask({ title: 'Une séance est déjà en cours', text: 'Elle sera terminée et enregistrée avant de commencer celle-ci.', confirm: 'Terminer et commencer' })) return;
    closeSession();
  }
  if (!state.active) {
    const ahead = weekFrame().focus.nextWeek; // plus rien cette semaine : la séance compte pour la suivante
    const fit = await fitnessCheck(state.plan[d]);
    if (!fit) return;
    state.active = { session: new Date().toISOString(), day: d, readiness: fit.level, off: daysOff(journal()) };
    if (fit.minutes) {
      state.active.express = fit.minutes;
      state.active.cut = express(EXOS, state.plan[d].items.map((item) => effective(item, true)), fit.minutes);
    }
    // Dans le même geste que « Commencer » : l'écran bascule, le micro s'ouvre (iOS n'autorise le micro qu'après un geste).
    if (state.screen && fit.project !== state.screen.on) {
      state.screen.on = fit.project;
      if (fit.project) { link.delay = 1000; connectScreen(); } else { link.socket?.close(); setTv(0); }
    }
    if (fit.voice) startEar(); else if (state.voiceInput) { state.voiceInput = false; }
    ui.at = ui.pick = ui.weekPick = null;
    record({ type: 'start', day: state.plan[d].day, name: state.plan[d].name, ...(ahead && { week: monday(new Date(Date.now() + 7 * 864e5)).toISOString() }) });
    record({ type: 'readiness', sleep: fit.sleep, soreness: fit.soreness, energy: fit.energy, level: fit.level });
  } else if (state.active.paused) resume();
  show('session');
}

// Point de forme : 3 questions, réponses « tout va bien » déjà cochées. 0-1 = normal, 2-3 = pas d'augmentation, 4+ = séance allégée.
const FITNESS = [['sleep', 'Sommeil', ['Bien', 'Moyen', 'Mal']], ['soreness', 'Courbatures', ['Aucune', 'Légères', 'Fortes']], ['energy', 'Énergie', ['Bonne', 'Moyenne', 'Faible']]];
async function fitnessCheck(s) {
  const answers = { sleep: 0, soreness: 0, energy: 0, minutes: null };
  const groups = FITNESS.map(([key, label, options]) => {
    const buttons = options.map((option, i) => chip(option, i === 0, () => {
      answers[key] = i;
      buttons.forEach((b, n) => { b.ariaPressed = String(n === i); });
    }));
    return h('div', { className: 'group' }, h('span', { className: 'label' }, label), h('div', { className: 'chips' }, buttons));
  });
  // Séance express : seulement les durées plus courtes que la séance complète estimée.
  const full = sessionMinutes(s.items.map((item) => effective(item)));
  const times = [[null, `Complète · ${full} min`], ...[30, 20].filter((m) => m < full - 5).map((m) => [m, `${m} min`])];
  const timeButtons = times.map(([m, label], i) => chip(label, i === 0, () => {
    answers.minutes = m;
    timeButtons.forEach((b, n) => { b.ariaPressed = String(n === i); });
  }));
  if (times.length > 1) groups.push(h('div', { className: 'group' }, h('span', { className: 'label' }, 'Temps disponible'), h('div', { className: 'chips' }, timeButtons)));
  // Écran et micro activés en même temps que la séance, d'un seul geste ; le choix est gardé pour la prochaine fois.
  answers.project = !!state.screen?.on;
  answers.voice = !!state.voiceInput && !!Recognition;
  const options = [state.screen && toggle("Projeter sur l'écran", answers.project, (v) => { answers.project = v; }),
    Recognition && toggle('Valider à la voix', answers.voice, (v) => { answers.voice = v; })].filter(Boolean);
  if (options.length) groups.push(h('div', { className: 'list' }, options));
  const go = await choose({
    title: 'Comment tu te sens ?', text: "La séance s'adapte si ça va moins bien.", extra: h('div', { className: 'stack' }, groups),
    actions: [{ label: 'Commencer la séance', value: true, variant: 'primary' }, { label: 'Annuler', value: null }],
  });
  if (!go) return null;
  const score = answers.sleep + answers.soreness + answers.energy;
  return { ...answers, level: score >= 4 ? 'light' : score >= 2 ? 'hold' : 'normal' };
}

// « Séance express (30 min) : 2 exercices retirés, séries réduites. »
function expressText() {
  const items = state.plan[state.active.day].items;
  const dropped = items.filter((it) => state.active.cut?.[it.ex] === 0).length;
  const fewer = items.some((it) => state.active.cut?.[it.ex] > 0 && state.active.cut[it.ex] < it.sets);
  const parts = [dropped && `${plural(dropped, 'exercice retiré', 'exercices retirés')}`, fewer && 'séries réduites'].filter(Boolean);
  return `Séance express (${state.active.express} min)${parts.length ? ` : ${parts.join(', ')}` : ''}. Les mouvements principaux restent entiers.`;
}

// Historique d'un exercice, relu une seule fois par état du journal (il ne fait que grandir, ou change d'objet à l'import).
let histories = { log: null, n: 0, byEx: new Map(), clean: null };
function syncHistoryCache() { if (histories.log !== log || histories.n !== log.length) histories = { log, n: log.length, byEx: new Map(), clean: null }; }
function historyOf(id) {
  syncHistoryCache();
  if (!histories.byEx.has(id)) histories.byEx.set(id, exerciseHistory(log, id));
  return histories.byEx.get(id);
}
// Journal tel qu'on le lit : sans les séries annulées (le journal enregistré, lui, garde tout).
function journal() {
  syncHistoryCache();
  return (histories.clean ||= withoutUndone(log));
}

const sessionSets = (sid) => {
  const sets = new Map();
  for (const x of journal()) if (x.session === sid && x.type === 'set') sets.set(`${x.ex}-${x.set}`, x);
  return sets;
};

// Durée d'effort : de l'ouverture à maintenant (ou au début de la pause en cours), pauses déduites.
function activeMinutes(sid) {
  let paused = 0, since = null, end = null;
  for (const x of log) {
    if (x.session !== sid) continue;
    if (x.type === 'pause') since = Date.parse(x.t);
    if (x.type === 'resume' && since) { paused += Date.parse(x.t) - since; since = null; }
    if (x.type === 'end') end = Date.parse(x.t); // séance terminée : sa durée s'arrête là
  }
  return Math.max(1, Math.round(((since ?? end ?? Date.now()) - Date.parse(sid) - paused) / 60000));
}

// Bilan : séries faites, durée d'effort, volume, exercices pas commencés.
function sessionSummary() {
  const sid = state.active.session;
  const s = state.plan[state.active.day];
  const sets = sessionSets(sid);
  const planned = s.items.reduce((n, it) => n + effective(it, true).sets, 0); // 0 pour un exercice retiré (séance express)
  const volume = Math.round([...sets.values()].reduce((v, x) => v + (x.kg || 0) * x.reps, 0));
  const skipped = s.items.filter((it) => effective(it, true).sets > 0 && ![...sets.values()].some((x) => x.ex === it.ex)).map((it) => byId.get(it.ex).name);
  const prs = [...sets.values()].filter((x) => x.pr && byId.has(x.ex)).map((x) => `${byId.get(x.ex).name} : ${setText(byId.get(x.ex), x.kg, x.reps)}`);
  const stat = (value, label) => h('div', { className: 'stat' }, h('strong', {}, value), h('span', { className: 'caption' }, label));
  return h('div', { className: 'stack' },
    h('div', { className: 'stats' }, stat(`${sets.size}/${planned}`, planned > 1 ? 'séries' : 'série'), stat(`${activeMinutes(sid)} min`, 'effort'), stat(volume.toLocaleString('fr-FR'), 'kg soulevés')),
    prs.length > 0 && h('p', { className: 'note' }, icon('flag'), `${prs.length > 1 ? 'Records' : 'Record'} : ${prs.join(' · ')}`),
    skipped.length > 0 && h('p', { className: 'caption' }, `${skipped.length > 1 ? 'Pas commencés' : 'Pas commencé'} : ${skipped.join(', ')}.`));
}

// Pause : minuteur coupé, écran libre de s'éteindre, temps de pause hors durée. Réversible, donc sans confirmation.
function pause() {
  if (warm) { clearInterval(warm.timer); warm = null; }
  stopEar(false);
  record({ type: 'pause' });
  state.active.paused = new Date().toISOString();
  stopRest();
  wakeLock?.release().catch(() => {});
  wakeLock = null;
  save();
  render();
  scrollTo(0, 0);
}

function resume() {
  record({ type: 'resume' });
  delete state.active.paused;
  save();
  if (state.voiceInput && Recognition) startEar();
}

// Arrêter : terminer (enregistrée), abandonner (marquée, ignorée dans le suivi, annulable 5 s) ou continuer.
async function stopSession() {
  const choice = await choose({
    title: 'Arrêter la séance ?',
    text: 'Terminer enregistre tes séries. Abandonner retire la séance de ton suivi.',
    extra: sessionSummary(),
    actions: [
      { label: 'Terminer et enregistrer', value: 'end', variant: 'primary' },
      { label: 'Abandonner sans enregistrer', value: 'cancel', variant: 'gray destructive' },
      { label: 'Continuer la séance', value: null }],
  });
  if (choice === 'end') finishSession();
  if (choice === 'cancel') abandonSession();
}
function abandonSession() {
  const active = { ...state.active };
  record({ type: 'cancel' });
  closeSession();
  show('week');
  toast('Séance abandonnée', 'info', () => {
    state.active = active;
    record({ type: 'restore' });
    save();
    show('session');
  });
}

// Séance restée ouverte (iPhone verrouillé puis oublié) : passé 6 h sans aucune saisie, on demande quoi en faire, une fois par
// ouverture de l'appli. Enregistrée, sa durée s'arrête à la dernière saisie, pas à maintenant.
let staleAsked = false;
async function staleSession() {
  if (!state.active || staleAsked) return;
  const sid = state.active.session, last = log.findLast((x) => x.session === sid);
  if (!last || Date.now() - Date.parse(last.t) < 6 * 3600e3) return;
  staleAsked = true;
  const s = state.plan[state.active.day], sets = sessionSets(sid).size, at = new Date(last.t);
  const yesterday = new Date(Date.now() - 864e5).toDateString();
  const day = at.toDateString() === today() ? "aujourd'hui" : at.toDateString() === yesterday ? 'hier' : DAYS[weekday(at)].toLowerCase();
  const choice = await choose({ title: 'Séance restée ouverte',
    text: `${DAYS[s.day]} · ${s.name} : rien d'enregistré depuis ${day} à ${clock(last.t)}${sets ? `, ${plural(sets, 'série')} faite${sets > 1 ? 's' : ''}` : ', aucune série'}.`,
    actions: [sets && { label: 'Enregistrer la séance', value: 'end', variant: 'primary' },
      { label: sets ? 'Abandonner sans enregistrer' : 'Abandonner', value: 'cancel', variant: 'gray destructive' },
      { label: 'Reprendre la séance', value: null }].filter(Boolean) });
  if (choice === 'end') {
    closeSession(last.t);
    show('week');
    toast('Séance enregistrée', 'success');
  }
  if (choice === 'cancel') abandonSession();
}

// at : heure de fin à retenir (séance restée ouverte : sa dernière saisie), sinon maintenant.
function closeSession(at) {
  const s = state.plan[state.active.day];
  ui.weekPick = null;
  record({ type: 'end', ...(at && { t: at }) });
  state.ended = { t: Date.now(), title: `${DAYS[s.day]} · ${s.name}`, summary: summaryData(activeItems()) };
  if (warm) { clearInterval(warm.timer); warm = null; }
  stopEar(false);
  state.active = null;
  stopRest();
  wakeLock?.release().catch(() => {});
  wakeLock = null;
  save();
  cloudBackup();
  syncPush();
}

// Fin de séance : bilan plein écran, comme sur l'écran projeté. Toutes les séries faites, on y arrive sans passer par « Arrêter ».
const allDone = () => nextItem(activeItems()) >= activeItems().length;
function finishSession() {
  const ahead = !!log.findLast((x) => x.type === 'start' && x.session === state.active.session)?.week;
  closeSession();
  ui.finished = { ...state.ended, ahead };
  show('done');
  const n = state.ended.summary.records.length;
  announce(n ? `Séance enregistrée, avec ${n > 1 ? 'des records' : 'un record'}. Beau travail !` : 'Séance enregistrée. Beau travail !');
}
// Records en avant, semaine qui avance d'un segment, prochaine séance. Une seule action.
function finishScreen() {
  const f = ui.finished;
  if (!f) { ui.view = 'week'; return week(); }
  const { stats, records } = f.summary;
  const plan = state.plan, { done, cards, focus } = weekFrame(), next = plan[focus.index];
  const stat = (value, label) => h('div', { className: 'stat' }, h('strong', {}, value), h('span', { className: 'caption' }, label));
  return h('div', { className: 'screen' },
    h('header', { className: 'finish-head' }, h('span', { className: 'finish-mark' }, icon('check')), h('h1', {}, 'Séance terminée'), h('p', { className: 'meta' }, f.title)),
    h('div', { className: 'stats' }, stats.map(([value, label]) => stat(value, label))),
    records.length > 0 && h('section', { className: 'card finish-records' },
      h('div', { className: 'banner-head' }, icon('flag'), h('h2', {}, records.length > 1 ? `${records.length} records` : 'Nouveau record')),
      h('div', { className: 'stack tight' }, records.map((r) => h('p', {}, r)))),
    // Séance faite en avance : c'est la semaine suivante qui avance d'un segment.
    f.ahead ? weekProgress(plan, cards, { ...focus, nextWeek: false }, 'Semaine prochaine') : weekProgress(plan, done, focus),
    (f.ahead || !focus.nextWeek) && !cards.has(next.day) && h('p', { className: 'meta center' }, `Prochaine séance : ${DAYS[next.day].toLowerCase()} · ${next.name}`),
    button('Terminé', () => { ui.finished = null; show('week'); }, { variant: 'primary', size: 'large' }));
}

function pausedScreen(s) {
  const since = clock(state.active.paused);
  return h('div', { className: 'screen' },
    h('header', { className: 'top' }, h('h1', {}, `${DAYS[s.day]} · ${s.name}`)),
    h('section', { className: 'card empty' }, icon('pause'), h('h2', { className: 'title' }, 'Séance en pause'),
      h('p', { className: 'meta' }, `Depuis ${since}. Le minuteur est coupé et le temps de pause ne compte pas dans la durée.`),
      sessionSummary(),
      h('div', { className: 'stack', style: 'width: 100%' },
        button('Reprendre', () => { resume(); render(); }, { variant: 'primary', size: 'large', icon: 'play' }),
        button('Arrêter la séance', stopSession, { variant: 'gray', size: 'large' }))));
}

function session() {
  const s = state.plan[state.active.day];
  if (state.active.paused) return pausedScreen(s);
  const list = !!state.listMode;
  const warmBanner = () => (warm ? warmCard() : banner('flame', `Échauffement · ${warmMinutes()} min`,
    h('p', {}, "Un mouvement général puis la mobilité des zones du jour, guidés et minutés. Les séries d'approche sont indiquées sur chaque mouvement lourd."),
    h('div', {}, warmButton())));
  // Barre collante : Pause et Arrêter restent à portée pendant tout le défilement.
  return h('div', { className: 'screen' },
    h('header', { className: 'navbar' },
      button('Pause', pause, { variant: 'plain', icon: 'pause', className: 'btn plain start' }),
      h('h1', {}, `${DAYS[s.day]} · ${s.name}`),
      button('Arrêter', stopSession, { variant: 'plain', className: 'btn plain end destructive' })),
    segmented([[false, 'Une série à la fois'], [true, 'Toute la séance']], list, (v) => { state.listMode = v; ui.pick = null; save(); render(); }),
    statusBar(list),
    cycle().deload && h('p', { className: 'note' }, icon('leaf'), 'Semaine allégée : moitié moins de séries, charges −10 %.'),
    state.active.readiness === 'hold' && h('p', { className: 'note' }, icon('info'), "Forme moyenne : pas d'augmentation de charge aujourd'hui."),
    state.active.readiness === 'light' && h('p', { className: 'note' }, icon('leaf'), 'Forme basse : séance allégée, moitié moins de séries et charges −10 %. Écoute ton corps.'),
    state.active.express && h('p', { className: 'note' }, icon('timer'), expressText()),
    comeback(state.active.off) && h('p', { className: 'note' }, icon('leaf'), `Reprise après ${state.active.off} jours sans séance : charges réduites aujourd'hui, pour repartir sans te blesser.`),
    list ? [warmBanner(), s.items.map((item, i) => effective(item, true).sets > 0 && block(item, state.active.day, i)),
      // Fin de liste = fin de séance : le bouton est là où on en a besoin, sans remonter.
      allDone() ? button('Enregistrer la séance', finishSession, { variant: 'primary', size: 'large', icon: 'check' }) : button('Terminer la séance', stopSession, { variant: 'primary', size: 'large' })]
      : warm ? warmCard()
      : [!sessionSets(state.active.session).size && h('div', { className: 'stack' }, h('p', { className: 'note' }, icon('flame'), `Avant la première série, échauffe-toi : ${warmMinutes()} minutes guidées et minutées.`), warmButton()),
        focusView(s, state.active.day)]);
}

// Contrôle segmenté iOS : options = [[valeur, libellé]]. value undefined : pas d'aria-pressed (onglets, voir tabs).
function segmented(options, value, onPick) {
  return h('div', { className: 'seg' }, options.map(([v, label]) => h('button', { type: 'button', className: 'seg-tab', ariaPressed: value === undefined ? null : String(v === value), onclick: () => onPick(v) }, label)));
}

// Exercices de la séance en cours, sans ceux que la séance express retire ; k = place dans le programme (douleur, Remplacer).
const activeItems = () => state.plan[state.active.day].items.map((item, k) => ({ ...exercise(item), k })).filter((x) => x.it.sets > 0);

// Tout ce qu'il faut pour un exercice de la séance en cours : conseil du jour, historique, séries déjà faites.
function exercise(item) {
  const e = byId.get(item.ex);
  const sid = state.active.session;
  const it = effective(item, true);
  const all = historyOf(e.id);
  const past = all.filter((x) => x.session !== sid);
  const fit = state.active.readiness;
  const tip = suggest(e, it, past, { loads: state.config.loads, learned: learned(log, e.id, past), deload: cycle().deload || fit === 'light', hold: fit === 'hold', comeback: comeback(state.active.off) });
  const done = new Map((all.find((x) => x.session === sid)?.sets || []).map((x) => [x.set, x]));
  return { e, it, past, tip, done };
}
// Prochaine série d'un exercice (la première pas encore validée), null si toutes sont faites.
const nextSet = (x) => Array.from({ length: x.it.sets }, (_, k) => k + 1).find((k) => !x.done.has(k)) ?? null;
// Exercice en cours : le premier qui a encore une série à faire (items.length = tout est fait).
const nextItem = (items) => { const i = items.findIndex((x) => nextSet(x) != null); return i < 0 ? items.length : i; };
// Charge de départ d'une série : celle de la série précédente du jour, sinon la charge conseillée.
// Répétitions prévues d'une série de l'exercice x, à la charge kg (null : poids du corps).
const plannedReps = (x, kg, n) => targetReps(x.it, x.past, kg, n, x.e.unit);
const startKg = (x) => (isBodyweight(x.e) ? null : [...x.done.values()].at(-1)?.kg ?? x.tip.kg);

// Prochaine série à faire de la séance en cours : { x, i, n, kg, reps }, null si tout est fait.
function upNext() {
  const items = activeItems();
  const i = nextItem(items);
  if (i >= items.length) return null;
  const x = items[i], n = nextSet(x), kg = startKg(x);
  return { x, i, n, kg, reps: plannedReps(x, kg, n) };
}

// --- Échauffement guidé ---
// 5 minutes avant la première série : un mouvement général, la mobilité des zones travaillées aujourd'hui, puis le dos.
// Chaque mouvement est minuté et annoncé ; sur l'écran projeté, il s'affiche comme un repos (anneau, mouvement suivant).
const WARMUP = [
  { name: 'Marche sur place, genoux hauts', s: 60, cue: 'Monte les genoux, bras actifs, respire calmement.', mus: [10, 8], for: 'all' },
  { name: 'Moulinets des bras', s: 30, cue: "Grands cercles lents, vers l'avant puis vers l'arrière.", mus: [2], for: 'upper' },
  { name: "Écartés à l'élastique léger", s: 40, cue: "Bras tendus devant toi, écarte jusqu'à la poitrine en serrant les omoplates.", mus: [2, 9], for: 'upper', eq: 'elastique' },
  { name: 'Pompes inclinées, lentes', s: 40, cue: 'Mains sur le banc, corps gainé, descends doucement.', mus: [4, 5], for: 'upper', eq: 'banc' },
  { name: 'Squats au poids du corps, lents', s: 40, cue: "Descends en 3 secondes, genoux dans l'axe des pieds.", mus: [10, 8], for: 'lower' },
  { name: 'Fentes arrière alternées', s: 40, cue: 'Grand pas en arrière, buste droit, genou avant au-dessus de la cheville.', mus: [10, 8], for: 'lower' },
  { name: 'Cercles de hanches', s: 30, cue: "Mains sur les hanches, grands cercles dans un sens puis dans l'autre.", mus: [8], for: 'lower' },
  { name: 'Chat-vache à quatre pattes', s: 30, cue: 'Arrondis puis creuse le dos, lentement, au rythme de ta respiration.', mus: [16], for: 'all' },
];
const UPPER = ['chest', 'back', 'shoulders', 'biceps', 'triceps'], LOWER = ['quad', 'hinge', 'calves'];
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
let warm = null; // { list, i, end, total, timer }

function warmupPlan() {
  const zones = new Set(activeItems().map((x) => x.e.zone));
  const want = { all: true, upper: UPPER.some((z) => zones.has(z)), lower: LOWER.some((z) => zones.has(z)) };
  return WARMUP.filter((m) => want[m.for] && (!m.eq || state.config.equipment.includes(m.eq)));
}
const warmMinutes = () => Math.round(warmupPlan().reduce((t, m) => t + m.s, 0) / 60);

function startWarm() {
  audio ||= new (window.AudioContext || window.webkitAudioContext)(); // créé au geste : iOS n'autorise le son qu'après
  audio.resume?.();
  warm = { list: warmupPlan(), i: -1 };
  nextWarm();
}
function nextWarm() {
  clearInterval(warm.timer);
  warm.i++;
  if (warm.i >= warm.list.length) {
    warm = null;
    speak('Échauffement fini. On attaque les séries.');
    toast('Échauffement terminé', 'success');
    render();
    return;
  }
  const m = warm.list[warm.i];
  warm.total = m.s * 1000;
  warm.end = Date.now() + warm.total;
  // Projeté : l'écran annonce le mouvement suivant à la fin du précédent ; le premier passe par announce().
  const text = micOpen() ? `${m.name}. ${m.cue}` : `${m.name}, ${m.s} secondes. ${m.cue}`;
  if (warm.i === 0) announce(text); else speak(text);
  warm.timer = setInterval(() => {
    const left = Math.ceil((warm.end - Date.now()) / 1000);
    document.querySelectorAll('.warm-time').forEach((el) => { el.textContent = mmss(Math.max(0, left)); });
    if (left > 0) return;
    if (!projected()) beep(audio);
    nextWarm();
  }, 250);
  render();
}
function stopWarm() {
  if (!warm) return;
  clearInterval(warm.timer);
  warm = null;
  render();
}

function warmCard() {
  const m = warm.list[warm.i], next = warm.list[warm.i + 1];
  return h('section', { className: 'card focus-card' },
    h('div', { className: 'stack tight center' },
      h('div', {}, h('span', { className: 'badge' }, `Échauffement · ${warm.i + 1} sur ${warm.list.length}`)),
      h('h2', { className: 'title' }, m.name), h('p', { className: 'meta' }, m.cue)),
    h('div', { className: 'focus-rest', role: 'timer' },
      h('strong', { className: 'rest-time warm-time' }, mmss(Math.max(0, Math.ceil((warm.end - Date.now()) / 1000)))),
      h('div', { className: 'row' }, button('Passer', nextWarm, { variant: 'gray', size: 'compact' }), button('Arrêter', stopWarm, { variant: 'gray', size: 'compact' }))),
    next && h('p', { className: 'caption center' }, `Ensuite : ${next.name} · ${next.s} s`));
}
const warmButton = () => button(`Échauffement guidé · ${warmMinutes()} min`, startWarm, { variant: 'tinted', icon: 'flame' });

// --- Mode focus ---
// Une série à la fois : gros chiffres, gros boutons, sans clavier. C'est aussi la télécommande de l'écran projeté.
const LOAD_CAPTION = { smith: 'kg au total', halteres: 'kg par haltère', kettlebell: 'kg', elastique: "kg d'élastique" };

function focusView(s, d) {
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
function validateSet({ x, n, i, count, pick }) {
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
function focusTarget() {
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
  audio ||= new (window.AudioContext || window.webkitAudioContext)();
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
function barPlan(e, kg) {
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
function undoSet(entry) {
  record({ type: 'undo', target: entry.t, ex: entry.ex, set: entry.set });
  stopRest();
  ui.pick = null;
  render();
  toast(`Série ${entry.set} retirée`, 'info');
}
const setText = (e, kg, reps) => (isBodyweight(e) ? `${reps}\u00a0${unitText(e)}` : `${kgLabel(e, kg)}\u00a0×\u00a0${reps}${e.unit === 's' ? '\u00a0s' : ''}`);
// Texte d'une série pour la voix : « 10 répétitions à 42,5 kilos ».
function setSpeech(e, kg, reps) {
  const what = `${reps} ${e.unit === 's' ? 'secondes' : 'répétitions'}`;
  if (isBodyweight(e) || kg == null) return what;
  return `${what} à ${kg.toLocaleString('fr-FR')} kilos${{ halteres: ' par haltère', elastique: " d'élastique" }[e.load] || ''}`;
}

function block(item, d, i) {
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
const plural = (n, one, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
const kgText = (kg) => `${kg.toLocaleString('fr-FR')}\u00a0kg`; // espace insécable : « kg » ne part jamais seul à la ligne
const clock = (iso) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

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

async function onFeel(e, value, d, i, buttons) {
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

// --- Minuteur de repos et écran allumé ---
// Une appli web iPhone ne peut ni vibrer ni notifier sans serveur : le son ne joue que si l'écran reste allumé.

let audio = null, rest = null, restEnd = 0, restTotal = 0, restPushed = false, wakeLock = null;
const restBar = h('div', { className: 'rest', hidden: true, role: 'timer' });

// Record : quatre notes montantes, à ne pas confondre avec les bips de série ou de repos.
function fanfare() {
  if (!audio) return;
  [523, 659, 784, 1047].forEach((freq, i) => {
    const osc = audio.createOscillator(), gain = audio.createGain(), at = audio.currentTime + i * 0.11;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.22, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + (i === 3 ? 0.5 : 0.18));
    osc.connect(gain).connect(audio.destination);
    osc.start(at);
    osc.stop(at + 0.55);
  });
}

// Bip court du métronome : grave pendant la descente, aigu pour remonter.
function tick(freq) {
  if (!audio) return;
  const osc = audio.createOscillator(), gain = audio.createGain();
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.25, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.09);
  osc.connect(gain).connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + 0.1);
}

function startRest(seconds) {
  // Créé au premier ✓ : iOS n'autorise le son qu'après un geste.
  audio ||= new (window.AudioContext || window.webkitAudioContext)();
  audio.resume?.();
  restPushed = false; // le nouvel envoi remplace l'ancien côté serveur : pas d'annulation qui pourrait arriver après lui
  stopRest();
  const end = Date.now() + seconds * 1000;
  restEnd = end;
  restTotal = seconds * 1000;
  // Prévenu tout de suite, appli active : au verrouillage de l'écran, iOS la suspend avant qu'une requête parte.
  // « Repos en cours, reprends à … » part 5 s après si l'écran a été verrouillé dans les 3 premières secondes.
  const started = Date.now();
  let notice = false;
  if (pushOn() && state.config.notify?.rest !== false) {
    restPushed = notice = true;
    const label = new Date(end).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    pushCall('POST', '/rest', { at: end, notice: started + 5000, label }).catch(() => { restPushed = notice = false; });
  }
  const time = h('span', {});
  restBar.replaceChildren(time, button('Passer', stopRest, { size: 'compact' }));
  const tick = () => {
    const left = Math.ceil((end - Date.now()) / 1000);
    const visible = document.visibilityState === 'visible';
    // Appli toujours à l'écran après 3 s : pas besoin d'annoncer l'heure de fin.
    if (notice && restPushed && visible && Date.now() - started >= 3000) { notice = false; pushCall('DELETE', '/rest/notice').catch(() => {}); }
    // Appli toujours à l'écran juste avant la fin : le bip suffit, on annule la notification.
    if (restPushed && left <= 3 && visible) { restPushed = false; pushCall('DELETE', '/rest').catch(() => {}); }
    if (left > 0) {
      time.textContent = `Repos ${restClock()}`;
      document.querySelectorAll('.rest-time').forEach((el) => { el.textContent = restClock(); });
      return;
    }
    stopRest();
    // Écran projeté connecté : c'est lui qui sonne et annonce, l'iPhone reste silencieux.
    const said = restSay();
    hush(said);
    if (!projected()) { beep(audio); speak(said); }
    toast('Repos terminé : série suivante.', 'timer');
  };
  rest = setInterval(tick, 250);
  restBar.hidden = false;
  tick();
  broadcast();
}

function stopRest() {
  clearInterval(rest);
  rest = null;
  restBar.hidden = true;
  document.querySelector('.focus-rest')?.remove();
  broadcast();
  if (restPushed) { restPushed = false; pushCall('DELETE', '/rest').catch(() => {}); }
}

const restClock = () => { const left = Math.max(0, Math.ceil((restEnd - Date.now()) / 1000)); return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; };
const extendRest = (seconds) => startRest(Math.ceil((restEnd - Date.now()) / 1000) + seconds);

// Annonce de fin de repos : la série qui suit, ou l'exercice suivant. La tournure varie d'une série à l'autre, mais reste la même
// pour une série donnée (restSay est recalculée à chaque envoi vers l'écran projeté).
const ORDINALS = ['Première', 'Deuxième', 'Troisième', 'Quatrième', 'Cinquième', 'Sixième', 'Septième', 'Huitième', 'Neuvième', 'Dixième'];
const vary = (list, seed) => list[Math.abs(seed) % list.length];
function restSay() {
  const u = upNext();
  if (!u) return 'Repos terminé.';
  const seed = u.n + u.x.e.id, last = u.n === u.x.it.sets;
  // Micro ouvert : sans aucun nombre (série, répétitions, charge restent affichés sur l'écran).
  if (micOpen()) return u.n === 1 ? `On enchaîne : ${u.x.e.name}.` : last ? 'Dernière série, à toi.' : vary(["C'est reparti, à toi.", 'Allez, on y retourne.', 'À toi de jouer.'], seed);
  const what = setSpeech(u.x.e, u.kg, u.reps);
  if (u.n === 1) return `${vary(['On enchaîne', 'Nouvel exercice'], seed)} : ${u.x.e.name}. ${what[0].toUpperCase()}${what.slice(1)}.`;
  const which = last ? 'Dernière série' : ORDINALS[u.n - 1] ? `${ORDINALS[u.n - 1]} série` : `Série ${u.n}`;
  return `${vary(["C'est reparti", 'Allez, on y retourne', 'À toi'], seed)}. ${which}, ${what}.`;
}

// --- Coach vocal ---
// Annonces lues par la voix française de l'appareil (réglable dans Réglages). Quand l'écran projeté est connecté, c'est lui qui parle.
const voiceOn = () => state.config?.voice !== false;
function speak(text, here = false) {
  const synth = window.speechSynthesis;
  if (!text || !synth || !voiceOn() || (projected() && !here)) return;
  if (micOpen() && saysCommand(text)) return; // ne jamais se valider soi-même
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'fr-FR';
  u.voice = frenchVoice(synth, state.config?.voiceName);
  u.onend = () => { mic.spokeAt = Date.now(); };
  mic.spokeAt = Date.now();
  hush(text);
  synth.cancel();
  synth.speak(u);
}

async function keepAwake() {
  if (!state.active || state.active.paused || wakeLock || !navigator.wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { /* refusé (batterie faible) : l'écran s'éteindra normalement */ }
}

// --- Progrès ---

function progress() {
  const skip = cancelled(log);
  const sets = journal().filter((x) => x.type === 'set' && byId.has(x.ex) && !skip.has(x.session)); // exercices retirés et séances abandonnées : pas comptés
  const sessions = new Set(sets.map((x) => x.session)).size;
  const cards = [...new Set(sets.map((x) => x.ex))]
    .filter((id) => byId.has(id))
    .map((id) => ({ e: byId.get(id), past: historyOf(id) }))
    .sort((a, b) => b.past.at(-1).t.localeCompare(a.past.at(-1).t));
  const capped = cards.filter(({ e, past }) => tipFor(e, past)?.plafond).map(({ e }) => e.name);
  return h('div', { className: 'screen' },
    h('header', { className: 'stack tight' }, h('div', { className: 'top' }, h('h1', {}, 'Progrès')),
      sessions > 0 && h('p', { className: 'meta' }, `${plural(sessions, 'séance')} · ${plural(sets.length, 'série enregistrée', 'séries enregistrées')}`)),
    !cards.length && h('section', { className: 'card empty' }, icon('chart'), h('h2', { className: 'title' }, 'Pas encore de séance'),
      h('p', { className: 'meta' }, 'Après ta première séance, tu verras ici tes charges, tes répétitions et la prochaine étape pour chaque exercice.'),
      button('Voir ma semaine', () => show('week'), { variant: 'primary' })),
    sessions > 0 && weekReview(),
    capped.length >= 2 && banner('warning', `${capped.length} exercices au plafond`,
      h('p', {}, `${capped.join(', ')} : ton matériel ne permet plus de progresser. Des charges plus lourdes (haltères réglables, par exemple) relanceraient la progression ; ajoute-les dans Réglages quand tu les as.`)),
    cards.map(({ e, past }) => progressCard(e, past)),
    painCard(),
    sessions > 0 && historyCard(),
    h('section', { className: 'card' },
      h('h2', {}, 'Mes données'),
      h('p', { className: 'meta' }, `Chaque saisie est horodatée et reste sur cet appareil. ${lastCopy() ? `Dernière sauvegarde : ${new Date(lastCopy()).toLocaleDateString('fr-FR')}.` : 'Jamais sauvegardé.'}`),
      h('div', { className: 'row' },
        button('Sauvegarder', backup, { variant: 'primary', icon: 'save' }),
        button('Exporter CSV', exportCsv),
        button('Copier pour Claude', copyForClaude, { icon: 'copy' }),
        importButton())));
}

// Bilan de la semaine (depuis lundi) : séances, séries, volume comparé à la semaine passée, records, charges en hausse.
function weekReview() {
  const skip = cancelled(log);
  const since = monday(new Date()).toISOString(), before = new Date(Date.parse(since) - 7 * 864e5).toISOString();
  const sets = (from, to) => journal().filter((x) => x.type === 'set' && x.t >= from && x.t < to && !skip.has(x.session) && byId.has(x.ex));
  const now = sets(since, '9'), prev = sets(before, since);
  const volume = (list) => Math.round(list.reduce((v, x) => v + (x.kg || 0) * x.reps, 0));
  const done = doneThisWeek().size;
  const best = new Map(now.filter((x) => x.pr).map((x) => [x.ex, x])); // un record par exercice : le dernier de la semaine
  const records = [...best.values()].map((x) => `${byId.get(x.ex).name} : ${setText(byId.get(x.ex), x.kg, x.reps)}`);
  // Charge en hausse : la meilleure charge de la semaine dépasse celle de la dernière séance d'avant lundi.
  const up = [...new Set(now.map((x) => x.ex))].flatMap((id) => {
    const e = byId.get(id);
    if (isBodyweight(e)) return [];
    const top = Math.max(...now.filter((x) => x.ex === id).map((x) => x.kg || 0));
    const old = historyOf(id).filter((s) => s.t < since).at(-1);
    const was = old && Math.max(...old.sets.map((x) => x.kg || 0));
    return was && top > was ? [`${e.name} : ${kgText(was)} → ${kgText(top)}`] : [];
  });
  const stat = (value, label) => h('div', { className: 'stat' }, h('strong', {}, value), h('span', { className: 'caption' }, label));
  return h('section', { className: 'card', id: 'bilan' },
    h('div', { className: 'line-head' }, h('h2', {}, 'Bilan de la semaine'), h('span', { className: 'meta' }, `depuis lundi`)),
    h('div', { className: 'stats' }, stat(`${done}/${state.plan.length}`, 'séances'), stat(String(now.length), plural(now.length, 'série', 'séries').replace(/^\d+ /, '')), stat(volume(now).toLocaleString('fr-FR'), 'kg soulevés')),
    prev.length > 0 && h('p', { className: 'caption' }, `Semaine dernière : ${plural(prev.length, 'série')}, ${kgText(volume(prev))}.`),
    records.length > 0 && listNote('flag', records.length > 1 ? 'Records' : 'Record', records),
    up.length > 0 && listNote('chart', 'Charges en hausse', up),
    balanceNote(),
    !now.length && h('p', { className: 'caption' }, 'Pas encore de série cette semaine.'));
}

// Note à puce suivie d'une ligne par élément : plus lisible qu'une phrase enchaînée de « · ».
const listNote = (name, title, lines) => h('div', { className: 'note' }, icon(name),
  h('div', { className: 'stack tight' }, h('strong', { className: 'note-title' }, title), lines.map((l) => h('span', {}, l))));

// Poussée / tirage sur 2 semaines : trop de poussée use les épaules ; le prochain cycle rééquilibre (balance() dans plan.js).
function balanceNote() {
  const since = new Date(Date.now() - 14 * 864e5).toISOString(), skip = cancelled(log);
  const sets = journal().filter((x) => x.type === 'set' && x.t >= since && byId.has(x.ex) && !skip.has(x.session));
  const push = sets.filter((x) => PUSH_ZONES.includes(byId.get(x.ex).zone)).length, pull = sets.filter((x) => PULL_ZONES.includes(byId.get(x.ex).zone)).length;
  if (push < 6 || push <= pull * 1.3) return null;
  return h('p', { className: 'note' }, icon('warning'), `Tu pousses plus que tu ne tires : ${push} séries contre ${pull} en 2 semaines. Pour tes épaules, le prochain cycle remplacera un exercice de poussée par du dos.`);
}

// Douleurs notées par zone, sur 8 semaines.
function painCard() {
  const since = new Date(Date.now() - 56 * 864e5).toISOString(), skip = cancelled(log);
  const pains = log.filter((x) => x.type === 'pain' && x.t >= since && !skip.has(x.session));
  if (!pains.length) return null;
  const zones = [...new Set(pains.map((x) => x.zone))].map((z) => {
    const list = pains.filter((x) => x.zone === z);
    return { z, n: list.length, last: list.at(-1).t, ex: [...new Set(list.map((x) => byId.get(x.ex)?.name).filter(Boolean))] };
  }).sort((a, b) => b.n - a.n);
  return h('section', { className: 'card' },
    h('h2', {}, 'Douleurs, 8 dernières semaines'),
    h('div', { className: 'list' }, zones.map(({ z, n, last, ex }) => h('div', { className: 'line' },
      h('span', { className: 'stack tight' }, h('strong', {}, z === 'other' ? 'Ailleurs' : ZONES[z]), h('span', { className: 'caption' }, ex.join(', '))),
      h('span', { className: 'meta' }, `${plural(n, 'fois', 'fois')} · ${new Date(last).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`)))),
    h('p', { className: 'caption' }, 'Une zone qui revient peut être ajoutée aux zones fragiles dans Réglages. Si une douleur persiste, consulte un professionnel de santé.'));
}

// Historique : séances terminées, de la plus récente à la plus ancienne ; le détail se construit à l'ouverture.
function historyCard() {
  const skip = cancelled(log), clean = journal();
  const ended = new Set(log.filter((x) => x.type === 'end').map((x) => x.session));
  const starts = log.filter((x) => x.type === 'start' && ended.has(x.session) && !skip.has(x.session)).reverse();
  const rows = starts.map((st) => ({ st, sets: clean.filter((x) => x.session === st.session && x.type === 'set' && byId.has(x.ex)) })).filter((r) => r.sets.length);
  const shown = rows.slice(0, ui.historyCount || 10);
  return h('section', { className: 'card' },
    h('h2', {}, 'Historique'),
    h('div', { className: 'list' }, shown.map(({ st, sets }) => {
      const last = new Map(sets.map((x) => [`${x.ex}-${x.set}`, x])); // la dernière saisie d'une série fait foi
      const volume = Math.round([...last.values()].reduce((v, x) => v + (x.kg || 0) * x.reps, 0));
      const prs = [...last.values()].filter((x) => x.pr).length;
      return lazy('ex', h('summary', {}, h('span', { className: 'stack tight' },
        h('strong', {}, `${new Date(st.t).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · ${st.name}`),
        h('span', { className: 'meta' }, [`${activeMinutes(st.session)} min`, plural(last.size, 'série'), volume > 0 && kgText(volume), prs > 0 && plural(prs, 'record')].filter(Boolean).join(' · '))), icon('chevron', 'chev')),
        () => h('div', { className: 'ex-body' }, [...new Set([...last.values()].map((x) => x.ex))].map((id) => {
          const e = byId.get(id);
          return h('p', {}, h('strong', {}, e.name), h('br'), h('span', { className: 'meta' }, [...last.values()].filter((x) => x.ex === id).sort((a, b) => a.set - b.set).map((x) => setText(e, x.kg, x.reps) + (x.pr ? ' · record' : '')).join(' · ')));
        })));
    })),
    rows.length > shown.length && h('div', {}, button(`Voir ${Math.min(10, rows.length - shown.length)} séances de plus`, () => { ui.historyCount = shown.length + 10; render(); }, { variant: 'plain' })));
}

// Technique mesurée par la caméra, par séance : angle moyen au point bas (plus petit = plus profond), descente moyenne, répétitions incomplètes.
function technique(e) {
  const skip = cancelled(log), sessions = new Map();
  for (const x of journal()) {
    if (x.type !== 'cam' || x.ex !== e.id || skip.has(x.session)) continue;
    const s = sessions.get(x.session) || { t: x.t, reps: [] };
    s.reps.push(...x.reps);
    sessions.set(x.session, s);
  }
  const avg = (list) => Math.round(list.reduce((a, b) => a + b, 0) / list.length);
  return [...sessions.values()].map((s) => ({ t: s.t, depth: avg(s.reps.map((r) => r.depth)), down: avg(s.reps.map((r) => r.down)), partial: s.reps.filter((r) => !r.full).length, total: s.reps.length }));
}

function techniqueBlock(e) {
  const list = technique(e);
  if (!list.length) return null;
  const first = list[0], last = list.at(-1), delta = last.depth - first.depth;
  return h('div', { className: 'stack' },
    h('p', { className: 'label' }, 'Technique, mesurée par la caméra'),
    list.length > 1 && chart(list.map((s) => ({ x: Date.parse(s.t), y: s.depth })), [], '°'),
    h('p', { className: 'meta' }, [`${last.depth}° au point bas${list.length > 1 && delta ? ` (${Math.abs(delta)}° ${delta < 0 ? 'plus bas' : 'moins bas'} qu'au début)` : ''}`,
      `descente ${(last.down / 1000).toFixed(1).replace('.', ',')} s`, `${plural(last.partial, 'répétition incomplète', 'répétitions incomplètes')} sur ${last.total}`].join(' · ')),
    list.length > 1 && h('p', { className: 'caption' }, 'Plus la courbe descend, plus tu descends bas.'));
}

function tipFor(e, past) {
  const item = state.plan.flatMap((s) => s.items).find((it) => it.ex === e.id);
  return item && suggest(e, effective(item), past, { loads: state.config.loads, learned: learned(log, e.id, past), deload: cycle().deload, comeback: comeback(daysOff(journal())) });
}

function progressCard(e, past) {
  const level = state.config.level;
  // Courbe des charges si elles changent ; sinon (poids du corps, charge fixe comme les haltères à 10 kg) les répétitions.
  const kgs = new Set(past.map((s) => Math.max(0, ...s.sets.map((x) => x.kg || 0))).filter((kg) => kg > 0));
  const withKg = !isBodyweight(e) && kgs.size > 1;
  const fixed = !isBodyweight(e) && kgs.size === 1 ? [...kgs][0] : null;
  const value = (s) => (withKg ? Math.max(0, ...s.sets.map((x) => x.kg || 0)) : Math.max(...s.sets.map((x) => x.reps)));
  const points = past.map((s) => ({ x: Date.parse(s.t), y: value(s) })).filter((p) => !withKg || p.y > 0); // séance sans charge : hors courbe des kg
  const ahead = e.load === 'smith' && withKg ? project(points.at(-1).y, level) : [];
  const last = past.at(-1);
  const tip = tipFor(e, past);
  return h('section', { className: 'card' },
    h('h2', { className: 'title' }, e.name),
    // Une seule séance : pas de courbe (un point perdu dans un cadre vide se lit comme un bug).
    points.length > 1 ? chart(points, ahead, withKg ? 'kg' : unitText(e)) : h('p', { className: 'caption' }, 'Ta courbe apparaîtra après ta deuxième séance de cet exercice.'),
    points.length > 1 && fixed != null && h('p', { className: 'caption' }, `Charge fixe (${kgLabel(e, fixed)}) : la courbe suit tes répétitions.`),
    techniqueBlock(e),
    h('p', { className: 'meta' }, `Dernière séance, ${new Date(last.t).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })} : ${last.sets.map((x) => (!isBodyweight(e) ? `${x.reps}\u00a0×\u00a0${kgLabel(e, x.kg)}` : `${x.reps}\u00a0${unitText(e)}`)).join(' · ')}${last.tech === false ? ' · technique à revoir' : ''}`),
    tip && h('p', { className: 'tip' }, tip.kg != null && h('strong', {}, `Prochaine : ${kgLabel(e, tip.kg)} · `), tip.note),
    ahead.length > 0 && h('p', { className: 'caption' }, `Repère ${LEVELS[level].label.toLowerCase()} : environ ${kgText(ahead.at(-1))} dans 8 semaines si tout se passe bien. Indicatif : la technique et l'absence de douleur passent avant.`));
}

// Courbe SVG : réalisé (trait plein) + repère selon le niveau (pointillés, une valeur par semaine).
function chart(points, ahead, unit) {
  const W = 320, H = 130, P = 26, WEEK = 7 * 864e5;
  const future = ahead.map((y, i) => ({ x: points.at(-1).x + (i + 1) * WEEK, y }));
  const all = [...points, ...future];
  const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
  const [x0, x1, low, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const y0 = low === y1 ? low : Math.min(low, Math.floor(y1 * 0.75)); // axe d'au moins 25 % de la valeur haute : un petit écart reste petit
  // Une seule séance : point au centre ; valeur qui ne change pas : ligne au milieu, une seule étiquette.
  const sx = (x) => (x1 === x0 ? W / 2 : P + ((x - x0) / (x1 - x0)) * (W - 2 * P)).toFixed(1);
  const sy = (y) => (y1 === y0 ? H / 2 : H - P - ((y - y0) / (y1 - y0)) * (H - 2 * P)).toFixed(1);
  const line = (pts) => pts.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ');
  const box = h('div', { className: 'chart' });
  // Valeurs numériques et libellés fixes uniquement : innerHTML sans risque ici.
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution en ${unit}">
    <text x="2" y="${y1 === y0 ? H / 2 - 8 : sy(y1)}" class="axis">${y1.toLocaleString('fr-FR')} ${unit}</text>
    ${y1 !== y0 ? `<text x="2" y="${sy(y0)}" class="axis">${y0.toLocaleString('fr-FR')}</text>` : ''}
    ${future.length ? `<polyline points="${line([points.at(-1), ...future])}" class="ahead"/>` : ''}
    <polyline points="${line(points)}" class="done"/>
    ${points.map((p) => `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="3.5"/>`).join('')}
  </svg>`;
  return box;
}

const loadText = (e, kg) => (isBodyweight(e) ? 'Poids du corps' : kg == null ? 'Charge à choisir' : kgLabel(e, kg).replace(/^./, (c) => c.toUpperCase()));
const repsText = (e, reps) => `${reps} ${e.unit === 's' ? 's' : 'rép.'}`;

// Aperçu d'une séance à venir : exercices avec la charge conseillée, matériel à préparer.
function preview(s, nextWeek) {
  const entries = s.items.map((item) => {
    const e = byId.get(item.ex);
    const it = effective(item);
    return { e, it, kg: isBodyweight(e) ? null : tipFor(e, historyOf(e.id))?.kg ?? null };
  });
  return {
    when: s.day === weekday() && !nextWeek ? "Aujourd'hui" : DAYS[s.day],
    items: entries.map(({ e, it, kg }) => ({ name: e.name, detail: `${it.sets} × ${it.reps}${e.unit === 's' ? ' s' : ''} · ${loadText(e, kg)}` })),
    gear: gearList(entries, state.config.loads),
  };
}

// Bilan chiffré d'une séance (écran projeté, fin de séance).
function summaryData(items) {
  const sets = sessionSets(state.active.session);
  const planned = items.reduce((n, x) => n + x.it.sets, 0);
  const volume = Math.round([...sets.values()].reduce((v, x) => v + (x.kg || 0) * x.reps, 0));
  return {
    stats: [[`${sets.size}/${planned}`, planned > 1 ? 'séries' : 'série'], [`${activeMinutes(state.active.session)} min`, 'effort'], [volume.toLocaleString('fr-FR'), 'kg soulevés']],
    records: [...sets.values()].filter((x) => x.pr && byId.has(x.ex)).map((x) => `${byId.get(x.ex).name} : ${setText(byId.get(x.ex), x.kg, x.reps)}`),
  };
}

// --- Mises à jour ---
// Le service worker sert la version en cache puis revérifie : s'il trouve du neuf, il prévient et on propose de recharger.

const updateBar = h('div', { className: 'update', hidden: true, role: 'status' },
  h('span', {}, 'Nouvelle version disponible'), button('Recharger', reloadApp, { variant: 'primary', size: 'compact' }));
const showUpdate = () => { updateBar.hidden = false; placeBars(); };

// --- Réseau ---
// Hors ligne, tout marche (données sur l'iPhone, appli en cache) sauf les vidéos : bandeau tant que ça dure, message à chaque bascule.
const offlineBar = h('div', { className: 'offline', hidden: navigator.onLine, role: 'status' }, icon('offline'),
  h('div', { className: 'stack tight' }, h('strong', {}, 'Hors ligne'), h('span', { className: 'caption' }, "Tes séances marchent et tes saisies restent sur l'iPhone. L'écran projeté, la sauvegarde et les vidéos attendent le réseau.")));

// Bandeaux d'état (hors ligne, nouvelle version) : sous l'en-tête de l'écran affiché, jamais par-dessus la barre collante.
function placeBars() {
  const bars = [offlineBar, updateBar];
  bars.forEach((b) => b.remove());
  const view = app.firstElementChild;
  const shown = bars.filter((b) => !b.hidden);
  if (!view || !shown.length) return;
  const header = view.querySelector(':scope > header');
  if (header) header.after(...shown);
  else view.prepend(...shown);
}

// Bouton des Réglages : retélécharge le code sans passer par aucun cache, puis recharge.
async function forceUpdate() {
  if (!navigator.onLine) return toast('Hors ligne : reconnecte-toi pour mettre à jour.', 'offline');
  toast('Mise à jour en cours…', 'info');
  try {
    await (await navigator.serviceWorker?.getRegistration())?.update();
    const cache = await caches.open('muscu-auto');
    await Promise.all(['./', 'index.html', 'app.js', 'plan.js', 'data.js', 'shared.js', 'voice.js', 'camera.js', 'screen.js', 'push.js', 'backup.js', 'main.js'].map(async (f) => {
      const res = await fetch(f, { cache: 'reload' });
      if (res.ok) await cache.put(f, res);
    }));
  } catch { /* sans service worker : on recharge quand même */ }
  reloadApp();
}

// Recharger pour une mise à jour : on revient sur l'écran où l'on était (Réglages, Progrès…), avec une confirmation.
const RELOAD_KEY = 'muscu-auto-reload';
function reloadApp() {
  try { sessionStorage.setItem(RELOAD_KEY, ui.view); } catch { /* stockage indisponible : retour au programme */ }
  location.reload();
}

function resumeAfterReload() {
  let view = null;
  try { view = sessionStorage.getItem(RELOAD_KEY); sessionStorage.removeItem(RELOAD_KEY); } catch { /* rien à reprendre */ }
  if (!view || !state.config) return false;
  if (view === 'settings') ui = { view, step: 0, draft: structuredClone(state.config) };
  else if (view === 'progress' || (view === 'session' && state.active)) ui.view = view;
  return true;
}
