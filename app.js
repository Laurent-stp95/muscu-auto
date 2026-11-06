// Interface : onboarding, programme de la semaine, séance en cours, progrès. Logique métier dans plan.js.

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const MUSCLES = { 1: 'biceps', 2: 'épaules', 3: 'dentelé', 4: 'pectoraux', 5: 'triceps', 6: 'abdos', 7: 'mollets', 8: 'fessiers', 9: 'trapèzes', 10: 'quadriceps', 11: 'ischios', 12: 'grand dorsal', 13: 'brachial', 14: 'obliques', 15: 'soléaire', 16: 'lombaires' };
const FRONT = new Set([1, 2, 3, 4, 6, 10, 13, 14]); // muscles visibles de face (wger is_front)
const FEELS = [['easy', 'Facile'], ['ok', 'Bien'], ['hard', 'Dur'], ['pain', 'Douleur']];
const PLATES = [1.25, 2.5, 5, 10, 15, 20, 25];
const LOAD_HEAD = { smith: 'kg (total)', halteres: 'kg / haltère', kettlebell: 'kg', elastique: 'Élastique', pdc: 'Charge' };
// Matériel de Laurent (2026-11-01) : modifiable dans Réglages.
const DEFAULTS = {
  level: 'debutant', goal: 'muscle', days: [0, 2, 4], minutes: 45, zones: [], avoid: [], seed: 1,
  equipment: ['smith', 'halteres', 'kettlebell', 'banc', 'banc-incline', 'traction', 'elastique', 'tapis'],
  loads: { bar: 19, plates: { 1.25: 2, 2.5: 2, 5: 2, 10: 2, 20: 4 }, halteres: [10], kettlebell: [16], elastiques: [30, 20, 10] },
};
const NOTIFY = { reminders: true, time: '18:00', before: 30, rest: true, weekly: true }; // réglages par défaut des notifications
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

function chip(label, pressed, onclick, { danger, ...props } = {}) {
  return h('button', { type: 'button', className: danger ? 'chip danger' : 'chip', ariaPressed: String(pressed), onclick, ...props }, label);
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
const TOAST_ICONS = { success: 'checkCircle', info: 'info', warning: 'warning', error: 'xCircle', timer: 'timer', offline: 'offline' };
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
  const views = { onboarding, week, session, progress, settings };
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
const LOADED = ['smith', 'halteres', 'kettlebell', 'elastique'];

// Écrans selon le contexte : installation seulement dans Safari sur iPhone, charges seulement si du matériel chargeable est coché.
function steps(d) {
  return [welcome, iphone() && !standalone() && stepInstall, stepLevel, stepGoal, stepEquipment,
    d.equipment.some((q) => LOADED.includes(q)) && stepLoads, stepPlanning, stepZones, stepFirstWeek].filter(Boolean);
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
  return h('div', { className: 'chips' }, entries.map(([value, label]) => chip(label, d[key] === value, () => { d[key] = value; render(); })));
}

// Choix multiple en pastilles : entries = [[valeur, libellé]].
function chips(d, key, entries, { max, className = 'chips' } = {}) {
  const toggle = (value) => {
    if (d[key].includes(value)) d[key] = d[key].filter((v) => v !== value);
    else if (max && d[key].length >= max) return toast(`${max} jours maximum : garde au moins un jour de repos.`, 'warning');
    else d[key] = [...d[key], value];
    render();
  };
  return h('div', { className }, entries.map(([value, label]) => chip(label, d[key].includes(value), () => toggle(value))));
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
    has('halteres') && weights(d, 'halteres'),
    has('kettlebell') && weights(d, 'kettlebell'),
    has('elastique') && weights(d, 'elastiques'),
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
      state.screen && h('div', { className: 'line' }, h('span', {}, 'Écran projeté'), button("Oublier l'écran", forgetScreen, { variant: 'plain', className: 'btn plain destructive' }))),
    section('Notifications', notifyEditor(d)),
    section('Appli',
      h('div', { className: 'line' },
        h('span', { className: 'meta' }, `Version du ${new Date(document.lastModified).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`),
        button('Mettre à jour', forceUpdate, { size: 'compact' }))));
}

// Interrupteur iOS : toute la ligne se touche.
function toggle(label, checked, onchange) {
  return h('label', { className: 'line' }, h('span', {}, label),
    h('input', { type: 'checkbox', className: 'switch', role: 'switch', checked, onchange: (ev) => onchange(ev.target.checked) }));
}

function notifyEditor(d) {
  const n = (d.notify ||= { ...NOTIFY });
  if (!pushSupported() || (iphone() && !standalone())) return h('p', { className: 'note' }, icon('info'), "Installe l'appli sur l'écran d'accueil pour recevoir des notifications.");
  if (Notification.permission === 'denied') return h('p', { className: 'note' }, icon('warning'), "Notifications refusées. Pour les autoriser : Réglages de l'iPhone, Notifications, Steady.");
  if (!pushOn()) {
    return [h('p', { className: 'meta' }, "Un rappel avant chaque séance, et la fin du repos quand l'écran est verrouillé."),
      h('div', {}, button('Activer les notifications', () => enablePush(d), { variant: 'primary', icon: 'bell' }))];
  }
  return [
    h('div', { className: 'list' },
      toggle('Rappel avant chaque séance', n.reminders, (v) => { n.reminders = v; render(); }),
      n.reminders && h('label', { className: 'line' }, h('span', {}, 'Heure de la séance'),
        h('input', { type: 'time', className: 'input time', value: n.time, onchange: (ev) => { n.time = ev.target.value; } })),
      toggle('Fin du repos, écran verrouillé', n.rest, (v) => { n.rest = v; }),
      toggle('Bilan de la semaine, dimanche 19 h', n.weekly !== false, (v) => { n.weekly = v; })),
    n.reminders && h('div', { className: 'group' }, h('span', { className: 'label' }, 'Me prévenir'),
      pills(n, 'before', [[15, '15 min avant'], [30, '30 min avant'], [60, '1 h avant']])),
    h('div', {}, button('Désactiver les notifications', disablePush, { variant: 'plain', className: 'btn plain destructive' })),
  ];
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

// Séances faites cette semaine (depuis lundi), par jour : { t, sets }. Une séance abandonnée ou vide ne compte pas.
function doneThisWeek() {
  const since = monday(new Date()).toISOString();
  const skip = cancelled(log);
  const ended = new Set(log.filter((x) => x.type === 'end').map((x) => x.session));
  const done = new Map();
  for (const x of log) {
    if (x.type !== 'start' || x.t < since || !ended.has(x.session) || skip.has(x.session)) continue;
    const sets = sessionSets(x.session).size;
    if (sets) done.set(x.day, { t: x.t, sets });
  }
  return done;
}

// Séance mise en avant : celle en cours, sinon la première pas faite à partir d'aujourd'hui,
// sinon (plus rien cette semaine) la première de la semaine suivante.
function focusOf(plan, done) {
  if (state.active) return { index: state.active.day, nextWeek: false };
  const index = plan.findIndex((s) => s.day >= weekday() && !done.has(s.day));
  return index >= 0 ? { index, nextWeek: false } : { index: 0, nextWeek: true };
}

// Carte d'une séance : statut (en cours, en pause, terminée, aujourd'hui), actions, exercices repliés sauf la séance à venir.
function dayCard(s, d, focused, done, nextWeek) {
  const active = state.active?.day === d;
  const upcoming = focused && nextWeek; // séance de la semaine suivante : son statut de cette semaine ne compte plus
  const finished = !active && !upcoming && done.get(s.day);
  const badge = active ? h('span', { className: 'badge' }, state.active.paused ? 'En pause' : 'En cours')
    : finished ? h('span', { className: 'badge ok' }, icon('check'), 'Terminée')
    : upcoming ? h('span', { className: 'badge' }, 'Prochaine')
    : s.day === weekday() && h('span', { className: 'badge' }, "Aujourd'hui");
  // Actions en bas de carte (on lit, puis on agit) : grand bouton pour la séance à venir, compact à gauche pour les autres.
  const actions = active
    ? [button('Reprendre', () => start(d), { variant: 'primary', size: 'compact', icon: 'play' }), button('Arrêter', stopSession, { variant: 'gray', size: 'compact' })]
    : focused && !finished ? [button('Commencer la séance', () => start(d), { variant: 'primary', size: 'large', icon: 'play' })]
    : [button(finished ? 'Refaire' : 'Commencer', () => start(d), { variant: finished ? 'gray' : undefined, size: 'compact' })];
  const details = h('details', { className: 'more', open: ui.open?.[s.day] ?? focused },
    h('summary', {}, plural(s.items.length, 'exercice'), icon('chevron', 'chev')),
    h('div', { className: 'list' }, s.items.map((item, i) => {
      const e = byId.get(item.ex);
      return lazy('ex',
        h('summary', {}, h('span', { className: 'stack tight' }, h('strong', {}, e.name), h('span', { className: 'meta' }, `${prescriptionText(e, effective(item))} · ${muscles(e)}`)), icon('chevron', 'chev')),
        () => h('div', { className: 'ex-body' }, exerciseInfo(e), !state.active && h('div', {}, button('Remplacer', () => replace(d, i), { size: 'compact' }))));
    })));
  details.addEventListener('toggle', () => { (ui.open ||= {})[s.day] = details.open; }); // garde le choix jusqu'au prochain lancement
  return h('section', { className: focused ? 'card focus' : 'card' },
    h('div', { className: 'stack tight' },
      h('div', { className: 'card-head' }, h('h2', { className: 'title' }, `${DAYS[s.day]} · ${s.name}`), badge),
      finished && h('p', { className: 'caption' }, `Faite ${DAYS[weekday(new Date(finished.t))].toLowerCase()} à ${clock(finished.t)} · ${finished.sets} série${finished.sets > 1 ? 's' : ''}`)),
    focused && !finished && !active && h('p', { className: 'caption' }, `À préparer : ${preview(s, nextWeek).gear.join(', ')}`),
    details,
    h('div', { className: 'row' }, actions));
}

// Avancement de la semaine : un segment par séance, vert quand elle est faite, jour du jour en gras.
function weekProgress(plan, done, focus) {
  const count = plan.filter((s) => done.has(s.day)).length;
  const title = !focus.nextWeek ? 'Cette semaine' : count === plan.length ? 'Semaine bouclée' : 'Semaine terminée';
  return h('section', { className: 'card' },
    h('div', { className: 'line-head' }, h('h2', {}, title), h('span', { className: 'meta' }, `${count} sur ${plural(plan.length, 'séance')}`)),
    h('div', { className: 'week-bar', style: `grid-template-columns: repeat(${plan.length}, minmax(0, 1fr))` },
      plan.map((s) => h('div', { className: ['week-day', done.has(s.day) && 'done', s.day === weekday() && 'today'].filter(Boolean).join(' ') },
        h('span', { className: 'week-seg' }), h('span', { className: 'caption' }, DAYS[s.day].slice(0, 3))))),
    focus.nextWeek && h('p', { className: 'caption' }, `Prochaine séance ${DAYS[plan[0].day].toLowerCase()}`));
}

function week() {
  const { plan } = state;
  const { week: n, deload, ended } = cycle();
  const done = doneThisWeek();
  const focus = focusOf(plan, done);
  const lastCopy = [state.lastExport, cloudOn() && state.cloud?.t].filter(Boolean).sort().at(-1);
  const backupDue = log.length > 0 && (!lastCopy || daysAgo(lastCopy) >= BACKUP_DAYS);
  return h('div', { className: 'screen' },
    h('header', { className: 'stack tight' },
      h('div', { className: 'top' }, h('h1', {}, 'Ma semaine'),
        h('div', { className: 'row' }, button(null, projectSheet, { variant: 'plain', icon: 'tv', ariaLabel: 'Projeter sur un écran', className: 'btn plain screen-btn' }), button('Réglages', openSettings, { variant: 'plain' }))),
      h('p', { className: 'meta' }, `Semaine ${Math.min(n, CYCLE_WEEKS)} sur ${CYCLE_WEEKS} du cycle`)),
    weekProgress(plan, done, focus),
    deload && banner('leaf', 'Semaine allégée',
      h('p', {}, 'Moitié moins de séries et charges baissées de 10 %. Ce repos fait partie de la progression : il évite la fatigue qui mène aux blessures.')),
    ended && banner('flag', 'Cycle terminé',
      h('p', {}, 'Le nouveau cycle garde tes mouvements principaux, pour continuer à progresser, et renouvelle les exercices secondaires.'),
      button('Lancer le nouveau cycle', newCycle, { variant: 'primary' })),
    // Rappel compact, toute la ligne se touche (comme une ligne de Réglages iOS).
    backupDue && h('button', { type: 'button', className: 'card notice', onclick: backup },
      h('span', { className: 'notice-icon' }, icon('save')),
      h('span', { className: 'stack tight' }, h('strong', {}, 'Sauvegarde ton journal'),
        h('span', { className: 'caption' }, lastCopy ? `Dernière copie il y a ${plural(daysAgo(lastCopy), 'jour')}` : "Ton suivi n'existe que sur cet iPhone")),
      icon('chevron', 'chev')),
    plan.map((s, d) => dayCard(s, d, d === focus.index, done, focus.nextWeek)),
    !state.active && (freshCycle() || ended) && button('Générer une autre variante', reroll, { variant: 'gray', size: 'large' }),
    !state.active && !freshCycle() && !ended && h('p', { className: 'caption center' }, "Exercices fixes jusqu'à la fin du cycle, pour apprendre les gestes et progresser. « Remplacer » reste possible."));
}

function replace(d, i) {
  const item = state.plan[d].items[i];
  const before = { ...item };
  if (!swap(EXOS, state.plan, state.config, d, i)) return toast('Aucun autre exercice possible avec ton matériel.', 'warning');
  save();
  render();
  toast(`Remplacé par ${byId.get(item.ex).name}`, 'success', () => { Object.assign(item, before); save(); render(); });
}

async function reroll() {
  if (!await ask({ title: 'Générer une autre variante ?', text: 'Tous les exercices de la semaine changent et un nouveau cycle commence. Ton journal est gardé.', confirm: 'Générer' })) return;
  state.config.seed = Math.floor(Math.random() * 2 ** 31);
  state.plan = generate(EXOS, state.config);
  state.cycle = { start: monday(new Date()).toISOString() };
  save();
  render();
  toast('Nouveau programme prêt', 'success');
}

async function newCycle() {
  if (!await ask({ title: 'Lancer le nouveau cycle ?', text: 'Tes mouvements principaux restent ; les exercices secondaires changent.', confirm: 'Lancer' })) return;
  renew(EXOS, state.plan, state.config, Math.random);
  state.cycle = { start: monday(new Date()).toISOString() };
  save();
  render();
  scrollTo(0, 0);
}

// Onglets ARIA : un seul panneau construit à la fois (la vidéo ne charge qu'à l'ouverture), flèches pour naviguer.
function tabs(segments) {
  if (segments.length === 1) return segments[0][1]();
  const bar = h('div', { className: 'seg' });
  const panel = h('div', { className: 'seg-panel' });
  bar.setAttribute('role', 'tablist');
  panel.setAttribute('role', 'tabpanel');
  const buttons = segments.map(([label], i) => h('button', { type: 'button', className: 'seg-tab', onclick: () => select(i) }, label));
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
  bar.append(...buttons);
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
    const fit = await fitnessCheck(state.plan[d]);
    if (!fit) return;
    state.active = { session: new Date().toISOString(), day: d, readiness: fit.level, off: daysOff(journal()) };
    if (fit.minutes) {
      state.active.express = fit.minutes;
      state.active.cut = express(EXOS, state.plan[d].items.map((item) => effective(item, true)), fit.minutes);
    }
    ui.at = ui.pick = null;
    record({ type: 'start', day: state.plan[d].day, name: state.plan[d].name });
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
function fresh() { if (histories.log !== log || histories.n !== log.length) histories = { log, n: log.length, byEx: new Map(), clean: null }; }
function history(id) {
  fresh();
  if (!histories.byEx.has(id)) histories.byEx.set(id, exerciseHistory(log, id));
  return histories.byEx.get(id);
}
// Journal tel qu'on le lit : sans les séries annulées (le journal enregistré, lui, garde tout).
function journal() {
  fresh();
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
    h('div', { className: 'stats' }, stat(`${sets.size}/${planned}`, planned > 1 ? 'séries' : 'série'), stat(`${activeMinutes(sid)} min`, 'effort'), stat(kgText(volume), 'volume')),
    prs.length > 0 && h('p', { className: 'note' }, icon('flag'), `${prs.length > 1 ? 'Records' : 'Record'} : ${prs.join(' · ')}`),
    skipped.length > 0 && h('p', { className: 'caption' }, `${skipped.length > 1 ? 'Pas commencés' : 'Pas commencé'} : ${skipped.join(', ')}.`));
}

// Pause : minuteur coupé, écran libre de s'éteindre, temps de pause hors durée. Réversible, donc sans confirmation.
function pause() {
  if (warm) { clearInterval(warm.timer); warm = null; }
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
  if (choice === 'end') {
    closeSession();
    show('week');
    toast('Séance enregistrée', 'success');
  }
  if (choice === 'cancel') {
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
}

function closeSession() {
  const s = state.plan[state.active.day];
  state.ended = { t: Date.now(), title: `${DAYS[s.day]} · ${s.name}`, summary: summaryData(activeItems()) };
  record({ type: 'end' });
  if (warm) { clearInterval(warm.timer); warm = null; }
  state.active = null;
  stopRest();
  wakeLock?.release().catch(() => {});
  wakeLock = null;
  save();
  cloudBackup();
  syncPush();
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
  const warmBanner = () => (warm ? warmCard() : banner('flame', 'Échauffement · 5 min',
    h('p', {}, "Un mouvement général puis la mobilité des zones du jour, guidés et minutés. Les séries d'approche sont indiquées sur chaque mouvement lourd."),
    h('div', {}, warmButton())));
  // Barre collante : Pause et Arrêter restent à portée pendant tout le défilement.
  return h('div', { className: 'screen' },
    h('header', { className: 'navbar' },
      button('Pause', pause, { variant: 'plain', icon: 'pause', className: 'btn plain start' }),
      h('h1', {}, `${DAYS[s.day]} · ${s.name}`),
      button('Arrêter', stopSession, { variant: 'plain', className: 'btn plain end' })),
    segmented([[false, 'Une série à la fois'], [true, 'Toute la séance']], list, (v) => { state.listMode = v; ui.pick = null; save(); render(); }),
    projector(),
    cycle().deload && h('p', { className: 'note' }, icon('leaf'), 'Semaine allégée : moitié moins de séries, charges −10 %.'),
    state.active.readiness === 'hold' && h('p', { className: 'note' }, icon('info'), "Forme moyenne : pas d'augmentation de charge aujourd'hui."),
    state.active.readiness === 'light' && h('p', { className: 'note' }, icon('leaf'), 'Forme basse : séance allégée, moitié moins de séries et charges −10 %. Écoute ton corps.'),
    state.active.express && h('p', { className: 'note' }, icon('timer'), expressText()),
    comeback(state.active.off) && h('p', { className: 'note' }, icon('leaf'), `Reprise après ${state.active.off} jours sans séance : charges réduites aujourd'hui, pour repartir sans te blesser.`),
    list ? [warmBanner(), s.items.map((item, i) => effective(item, true).sets > 0 && block(item, state.active.day, i)),
      // Fin de liste = fin de séance : le bouton est là où on en a besoin, sans remonter.
      button('Terminer la séance', stopSession, { variant: 'primary', size: 'large' })]
      : warm ? warmCard()
      : [!sessionSets(state.active.session).size && h('div', { className: 'stack' }, h('p', { className: 'note' }, icon('flame'), 'Avant la première série, échauffe-toi : 5 minutes guidées et minutées.'), warmButton()),
        focusView(s, state.active.day)]);
}

// Contrôle segmenté iOS : options = [[valeur, libellé]].
function segmented(options, value, onPick) {
  return h('div', { className: 'seg' }, options.map(([v, label]) => h('button', { type: 'button', className: 'seg-tab', ariaPressed: String(v === value), onclick: () => onPick(v) }, label)));
}

// Exercices de la séance en cours, sans ceux que la séance express retire ; k = place dans le programme (douleur, Remplacer).
const activeItems = () => state.plan[state.active.day].items.map((item, k) => ({ ...exercise(item), k })).filter((x) => x.it.sets > 0);

// Tout ce qu'il faut pour un exercice de la séance en cours : conseil du jour, historique, séries déjà faites.
function exercise(item) {
  const e = byId.get(item.ex);
  const sid = state.active.session;
  const it = effective(item, true);
  const all = history(e.id);
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
const startKg = (x) => (x.e.load === 'pdc' ? null : [...x.done.values()].at(-1)?.kg ?? x.tip.kg);

// Prochaine série à faire de la séance en cours : { x, i, n, kg, reps }, null si tout est fait.
function upNext() {
  const items = activeItems();
  const i = nextItem(items);
  if (i >= items.length) return null;
  const x = items[i], n = nextSet(x), kg = startKg(x);
  return { x, i, n, kg, reps: targetReps(x.it, x.past, kg, n, x.e.unit) };
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
    speak('Échauffement terminé. Place aux séries.');
    toast('Échauffement terminé', 'success');
    render();
    return;
  }
  const m = warm.list[warm.i];
  warm.total = m.s * 1000;
  warm.end = Date.now() + warm.total;
  // Projeté : l'écran annonce le mouvement suivant à la fin du précédent ; le premier passe par announce().
  const text = `${m.name}, ${m.s} secondes. ${m.cue}`;
  if (warm.i === 0) announce(text); else speak(text);
  warm.timer = setInterval(() => {
    const left = Math.ceil((warm.end - Date.now()) / 1000);
    document.querySelectorAll('.warm-time').forEach((el) => { el.textContent = mmss(Math.max(0, left)); });
    if (left > 0) return;
    if (!projected()) beep();
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
        h('p', { className: 'meta' }, "Bravo. Termine la séance pour l'enregistrer.")),
      sessionSummary(),
      button('Terminer la séance', stopSession, { variant: 'primary', size: 'large' }),
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
  const list = e.load === 'pdc' ? [] : loadable(e, loads);
  if (ui.pick?.key !== key) ui.pick = { key, kg: e.load === 'pdc' ? 0 : startKg(x) ?? list[0] ?? null, reps: null, touched: false };
  const pick = ui.pick;
  if (e.load !== 'pdc' && pick.kg != null && !list.includes(pick.kg)) list.push(pick.kg), list.sort((a, b) => a - b);
  const planned = () => targetReps(it, past, e.load === 'pdc' ? null : pick.kg, n, e.unit);
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
  const load = e.load !== 'pdc' && bigStepper(LOAD_CAPTION[e.load], pick.kg, list, (v) => (v == null ? '–' : v.toLocaleString('fr-FR')),
    (v) => { pick.kg = v; if (!pick.touched) { pick.reps = planned(); reps.set(pick.reps); } showPlates(); broadcast(); });
  const last = past.at(-1)?.sets.find((s) => s.set === n);
  const approach = n === 1 ? warmup(e, pick.kg, loads) : [];
  return [
    h('div', { className: 'focus-pick' }, reps.node, load && load.node),
    platesLine, changeLine,
    approach.length > 0 && h('p', { className: 'meta center' }, `Approche : ${approach.map(([kg, r]) => `${kgText(kg)}\u00a0×\u00a0${r}`).join(' · ')}`),
    last && h('p', { className: 'caption center' }, `La dernière fois : ${setText(e, last.kg, last.reps)}`),
    button('Série faite', () => {
      if (e.load !== 'pdc' && pick.kg == null) return toast('Choisis la charge utilisée.', 'warning');
      stopTempo();
      logSet(e, n, pick.kg, pick.reps, tip.mode);
      // Dernière série de l'exercice : on reste dessus pour le ressenti, « Exercice suivant » fait avancer.
      if (x.done.size + 1 >= it.sets) ui.at = i;
      if (n < it.sets || i + 1 < count) startRest(it.rest);
      else announce("Dernière série faite. Bravo ! Termine la séance pour l'enregistrer.");
      ui.pick = null;
      render();
    }, { variant: 'primary', size: 'large', icon: 'check', className: 'btn primary large focus-go' }),
    h('div', { className: 'row focus-tools' },
      (tip.mode === 'tempo' || tip.mode === 'pause') && tempoControl(() => pick.reps, tip.mode),
      filmButton()),
    h('p', { className: 'tip' }, tip.note),
    h('ul', { className: 'cue' }, (e.cues || [CUES[e.zone]]).slice(0, 2).map((c) => h('li', {}, c)))];
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
  speak(hold ? 'Descends en 3 secondes, pause 2 secondes, puis pousse.' : 'Descends en 3 secondes, puis pousse.', true);
  for (let r = 0; r < reps; r++) {
    const t0 = lead + r * rep;
    at(t0, () => { tempo.rep = r + 1; showTempo(); speak(String(r + 1), true); });
    for (let d = 0; d < down; d += 1000) at(t0 + d, () => tick(440));
    at(t0 + down + hold, () => tick(880));
  }
  at(lead + reps * rep, () => { stopTempo(); speak('Série terminée : valide-la.', true); });
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
  const value = e.load === 'pdc' ? 0 : kg;
  const sid = state.active.session;
  const already = journal().some((x) => x.session === sid && x.ex === e.id && x.pr);
  const pr = !already && recordKind(history(e.id), sid, { kg: value, reps });
  record({ type: 'set', ex: e.id, set: n, kg: value, reps, ...(mode !== 'normal' && { mode }), ...(pr && { pr }) });
  const entry = log.at(-1);
  // Erreur de doigt : « Annuler » pendant 5 s retire la série (entrée undo, le journal garde la trace).
  toast(pr ? `Record : ${setText(e, value, reps)}` : `Série ${n} enregistrée`, 'success', () => undoSet(entry));
  if (pr) announce(`Nouveau record : ${setSpeech(e, value, reps)} !`);
  return pr;
}
function undoSet(entry) {
  record({ type: 'undo', target: entry.t, ex: entry.ex, set: entry.set });
  stopRest();
  ui.pick = null;
  render();
  toast(`Série ${entry.set} retirée`, 'info');
}
const setText = (e, kg, reps) => (e.load === 'pdc' ? `${reps}\u00a0${unitText(e)}` : `${kgLabel(e, kg)}\u00a0×\u00a0${reps}${e.unit === 's' ? '\u00a0s' : ''}`);
// Texte d'une série pour la voix : « 10 répétitions à 42,5 kilos ».
function setSpeech(e, kg, reps) {
  const what = `${reps} ${e.unit === 's' ? 'secondes' : 'répétitions'}`;
  if (e.load === 'pdc' || kg == null) return what;
  return `${what} à ${kg.toLocaleString('fr-FR')} kilos${{ halteres: ' par haltère', elastique: " d'élastique" }[e.load] || ''}`;
}

function block(item, d, i) {
  const { e, it, past, tip, done } = exercise(item);
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
      Array.from({ length: it.sets }, (_, n) => setRow(e, it, n + 1, done.get(n + 1), { ...tip, kg: [...done.values()].at(-1)?.kg ?? tip.kg }, past))),
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

function setRow(e, item, n, done, tip, past) {
  let kg;
  if (e.load === 'pdc') kg = h('span', { className: 'caption bw' }, 'Poids du corps');
  else {
    // Liste des charges réalisables : impossible de saisir une charge qu'on ne peut pas monter.
    const list = loadable(e, state.config.loads);
    const value = done?.kg ?? tip.kg;
    if (value != null && !list.includes(value)) list.push(value);
    kg = loadMenu(e, list.sort((a, b) => a - b));
    kg.ariaLabel = `Charge série ${n}`;
    if (value != null) kg.value = String(value);
  }
  const planned = () => targetReps(item, past, e.load === 'pdc' ? null : Number(kg.value) || tip.kg, n, e.unit);
  const reps = h('input', { type: 'number', inputMode: 'numeric', min: 0, max: 300, step: 1, value: done?.reps ?? '', placeholder: String(planned()), ariaLabel: `${e.unit === 's' ? 'Secondes' : 'Répétitions'} série ${n}` });
  if (kg.tagName === 'SELECT') kg.onchange = () => { reps.placeholder = String(planned()); };
  const mark = (t) => { ok.className = 'btn done'; ok.replaceChildren(icon('check'), clock(t)); };
  const ok = button(null, () => {
    const kgValue = e.load === 'pdc' ? 0 : Number(kg.value);
    if (e.load !== 'pdc' && kg.value === '') return toast('Choisis la charge utilisée.', 'warning');
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
  record({ type: 'feel', ex: e.id, feel: value });
  buttons.forEach((b) => { b.ariaPressed = String(b.dataset.feel === value); });
  if (value !== 'pain') return;
  await painZone(e);
  if (!await ask({ title: 'Douleur notée', text: 'Écarter cet exercice et le remplacer ? Tu pourras le réintégrer dans Réglages. Si la douleur persiste, consulte un professionnel de santé.', confirm: 'Écarter et remplacer', cancel: "Garder pour aujourd'hui", danger: true })) return;
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
    actions: [...Object.entries(ZONES).map(([value, label]) => ({ label, value })), { label: 'Ailleurs', value: 'other' }] });
  if (!zone) return;
  record({ type: 'pain', ex: e.id, zone });
  const since = new Date(Date.now() - 56 * 864e5).toISOString();
  const times = log.filter((x) => x.type === 'pain' && x.zone === zone && x.t >= since && !cancelled(log).has(x.session)).length;
  if (zone === 'other' || times < 2 || state.config.zones.includes(zone)) return;
  if (!await ask({ title: `${ZONES[zone]} : ${times}e douleur en 8 semaines`, text: `Ajouter « ${ZONES[zone]} » à tes zones fragiles ? Les exercices à risque pour cette zone seront écartés du programme. Si la douleur persiste, consulte un professionnel de santé.`,
    confirm: 'Ajouter aux zones fragiles', cancel: 'Pas maintenant' })) return;
  state.config.zones = [...state.config.zones, zone];
  repair(EXOS, state.plan, state.config);
  save();
  toast(`${ZONES[zone]} ajoutée aux zones fragiles`, 'success');
}

// --- Minuteur de repos et écran allumé ---
// Une appli web iPhone ne peut ni vibrer ni notifier sans serveur : le son ne joue que si l'écran reste allumé.

let audio = null, rest = null, restEnd = 0, restTotal = 0, restPushed = false, wakeLock = null;
const restBar = h('div', { className: 'rest', hidden: true, role: 'timer' });

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

function beep() {
  if (!audio) return;
  [0, 0.25, 0.5].forEach((at) => {
    const osc = audio.createOscillator(), gain = audio.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, audio.currentTime + at);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + at + 0.2);
    osc.connect(gain).connect(audio.destination);
    osc.start(audio.currentTime + at);
    osc.stop(audio.currentTime + at + 0.2);
  });
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
    if (!projected()) { beep(); speak(restSay()); }
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

// Annonce de fin de repos : la série qui suit, ou l'exercice suivant.
function restSay() {
  const u = upNext();
  if (!u) return 'Repos terminé.';
  const what = setSpeech(u.x.e, u.kg, u.reps);
  return u.n === 1 ? `Repos terminé. Exercice suivant : ${u.x.e.name}. ${what}.` : `Repos terminé. Série ${u.n} sur ${u.x.it.sets} : ${what}.`;
}

// --- Coach vocal ---
// Annonces lues par la voix française de l'appareil (réglable dans Réglages). Quand l'écran projeté est connecté, c'est lui qui parle.
const voiceOn = () => state.config?.voice !== false;
function speak(text, here = false) {
  const synth = window.speechSynthesis;
  if (!text || !synth || !voiceOn() || (projected() && !here)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'fr-FR';
  const fr = synth.getVoices().filter((v) => /^fr/i.test(v.lang));
  u.voice = ['Amélie', 'Thomas', 'Audrey', 'Aurélie'].map((name) => fr.find((v) => v.name.startsWith(name))).find(Boolean) || fr.find((v) => /fr.FR/i.test(v.lang)) || fr[0] || null;
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
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ui.view === 'session') keepAwake(); });

// --- Progrès ---

function progress() {
  const skip = cancelled(log);
  const sets = journal().filter((x) => x.type === 'set' && byId.has(x.ex) && !skip.has(x.session)); // exercices retirés et séances abandonnées : pas comptés
  const sessions = new Set(sets.map((x) => x.session)).size;
  const cards = [...new Set(sets.map((x) => x.ex))]
    .filter((id) => byId.has(id))
    .map((id) => ({ e: byId.get(id), past: history(id) }))
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
      h('p', { className: 'meta' }, `Chaque saisie est horodatée et reste sur cet appareil. ${state.lastExport ? `Dernière sauvegarde : ${new Date(state.lastExport).toLocaleDateString('fr-FR')}.` : 'Jamais sauvegardé.'}`),
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
    if (e.load === 'pdc') return [];
    const top = Math.max(...now.filter((x) => x.ex === id).map((x) => x.kg || 0));
    const old = history(id).filter((s) => s.t < since).at(-1);
    const was = old && Math.max(...old.sets.map((x) => x.kg || 0));
    return was && top > was ? [`${e.name} : ${kgText(was)} → ${kgText(top)}`] : [];
  });
  const stat = (value, label) => h('div', { className: 'stat' }, h('strong', {}, value), h('span', { className: 'caption' }, label));
  return h('section', { className: 'card', id: 'bilan' },
    h('div', { className: 'line-head' }, h('h2', {}, 'Bilan de la semaine'), h('span', { className: 'meta' }, `depuis lundi`)),
    h('div', { className: 'stats' }, stat(`${done}/${state.plan.length}`, 'séances'), stat(String(now.length), plural(now.length, 'série', 'séries').replace(/^\d+ /, '')), stat(kgText(volume(now)), 'volume')),
    prev.length > 0 && h('p', { className: 'caption' }, `Semaine dernière : ${plural(prev.length, 'série')}, ${kgText(volume(prev))}.`),
    records.length > 0 && h('p', { className: 'note' }, icon('flag'), `${records.length > 1 ? 'Records' : 'Record'} : ${records.join(' · ')}`),
    up.length > 0 && h('p', { className: 'note' }, icon('chart'), `Charges en hausse : ${up.join(' · ')}`),
    balanceNote(),
    !now.length && h('p', { className: 'caption' }, 'Pas encore de série cette semaine.'));
}

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

function tipFor(e, past) {
  const item = state.plan.flatMap((s) => s.items).find((it) => it.ex === e.id);
  return item && suggest(e, effective(item), past, { loads: state.config.loads, learned: learned(log, e.id, past), deload: cycle().deload, comeback: comeback(daysOff(journal())) });
}

function progressCard(e, past) {
  const level = state.config.level;
  // Courbe des charges si elles changent ; sinon (poids du corps, charge fixe comme les haltères à 10 kg) les répétitions.
  const kgs = new Set(past.map((s) => Math.max(0, ...s.sets.map((x) => x.kg || 0))).filter((kg) => kg > 0));
  const withKg = e.load !== 'pdc' && kgs.size > 1;
  const fixed = e.load !== 'pdc' && kgs.size === 1 ? [...kgs][0] : null;
  const value = (s) => (withKg ? Math.max(0, ...s.sets.map((x) => x.kg || 0)) : Math.max(...s.sets.map((x) => x.reps)));
  const points = past.map((s) => ({ x: Date.parse(s.t), y: value(s) })).filter((p) => !withKg || p.y > 0); // séance sans charge : hors courbe des kg
  const ahead = e.load === 'smith' && withKg ? project(points.at(-1).y, level) : [];
  const last = past.at(-1);
  const tip = tipFor(e, past);
  return h('section', { className: 'card' },
    h('h2', { className: 'title' }, e.name),
    chart(points, ahead, withKg ? 'kg' : unitText(e)),
    fixed != null && h('p', { className: 'caption' }, `Charge fixe (${kgLabel(e, fixed)}) : la courbe suit tes répétitions.`),
    h('p', { className: 'meta' }, `Dernière séance (${new Date(last.t).toLocaleDateString('fr-FR')}) : ${last.sets.map((x) => (e.load !== 'pdc' ? `${x.reps} × ${kgLabel(e, x.kg)}` : `${x.reps} ${unitText(e)}`)).join(' · ')}${last.tech === false ? ' · technique à revoir' : ''}`),
    tip && h('p', { className: 'tip' }, tip.kg != null && h('strong', {}, `Prochaine : ${kgLabel(e, tip.kg)} · `), tip.note),
    ahead.length > 0 && h('p', { className: 'caption' }, `Repère ${LEVELS[level].label.toLowerCase()} : environ ${kgText(ahead.at(-1))} dans 8 semaines si tout se passe bien. Indicatif : la technique et l'absence de douleur passent avant.`));
}

// Courbe SVG : réalisé (trait plein) + repère selon le niveau (pointillés, une valeur par semaine).
function chart(points, ahead, unit) {
  const W = 320, H = 130, P = 26, WEEK = 7 * 864e5;
  const future = ahead.map((y, i) => ({ x: points.at(-1).x + (i + 1) * WEEK, y }));
  const all = [...points, ...future];
  const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
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

function download(name, type, text) {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

// Sauvegarde : feuille de partage iOS (Fichiers, iCloud Drive, AirDrop) quand elle accepte les fichiers, sinon téléchargement.
async function backup() {
  const name = `muscu-auto-${stamp()}.json`;
  const text = JSON.stringify({ exported: new Date().toISOString(), config: state.config, log }, null, 1);
  const file = new File([text], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Steady' });
    else download(name, 'application/json', text);
  } catch (err) {
    if (err.name === 'AbortError') return; // partage annulé
    download(name, 'application/json', text);
  }
  state.lastExport = new Date().toISOString();
  save();
  render();
  toast('Journal sauvegardé', 'success');
}

function exportCsv() {
  const dayOf = new Map(log.filter((x) => x.type === 'start').map((x) => [x.session, x.day]));
  const cols = [['horodatage', (x) => x.t], ['type', (x) => x.type], ['seance', (x) => x.session], ['jour', (x) => DAYS[x.day ?? dayOf.get(x.session)]],
    ['exercice_id', (x) => x.ex], ['exercice', (x) => byId.get(x.ex)?.name], ['serie', (x) => x.set], ['kg', (x) => x.kg],
    ['repetitions', (x) => x.reps], ['mode', (x) => x.mode], ['technique_ok', (x) => x.ok], ['ressenti', (x) => x.feel]];
  const cell = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const rows = log.map((x) => cols.map(([, get]) => cell(get(x))).join(';'));
  download(`muscu-auto-${stamp()}.csv`, 'text/csv;charset=utf-8', `﻿${[cols.map(([name]) => name).join(';'), ...rows].join('\n')}`);
}

function importButton() {
  const input = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  input.onchange = async () => {
    try {
      const data = JSON.parse(await input.files[0].text());
      const entries = Array.isArray(data) ? data : data.log;
      if (!Array.isArray(entries) || !entries.every((x) => typeof x?.t === 'string' && typeof x?.type === 'string')) throw new Error();
      if (await ask({ title: 'Remplacer ton historique ?', text: `Ton historique (${plural(log.length, 'saisie')}) sera remplacé par celui du fichier (${plural(entries.length, 'saisie')}).`, confirm: 'Remplacer', danger: true })) {
        log = entries;
        save();
        render();
        cloudBackup();
        toast('Historique importé', 'success');
      }
    } catch {
      toast('Fichier invalide : choisis une sauvegarde JSON de Steady.', 'error');
    }
    input.value = '';
  };
  return h('label', { className: 'btn' }, 'Importer', input);
}

// --- Notifications ---
// Web Push (iOS 16.4+, appli installée) via push/worker.js : rappels de séance, fin du repos quand l'écran est verrouillé.

const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const pushOn = () => !!state.push?.on && pushSupported() && Notification.permission === 'granted';
const pushCall = (method, path, body) => fetch(`${PUSH.url}${path}?id=${state.push.id}`, {
  method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body && JSON.stringify(body),
});
const keyBytes = (b64url) => Uint8Array.from(atob(b64url.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const reminderPayload = (c) => {
  const n = c.notify || NOTIFY;
  // last : dernière série enregistrée, pour le rappel de reprise après des séances manquées ; weekly : bilan du dimanche soir.
  const last = journal().findLast((x) => x.type === 'set' && !cancelled(log).has(x.session))?.t || null;
  return { on: n.reminders, days: c.days, time: n.time, before: n.before, sessions: Object.fromEntries((state.plan || []).map((s) => [s.day, s.name])),
    weekly: n.weekly !== false, last };
};

async function subscribePush(c) {
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUSH.key) });
  const res = await pushCall('POST', '/subscribe', { subscription: sub.toJSON(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone, reminders: reminderPayload(c) });
  if (!res.ok) throw new Error(`serveur ${res.status}`);
}

async function enablePush(d) {
  try {
    if (await Notification.requestPermission() !== 'granted') return render();
    state.push = { id: state.push?.id || crypto.randomUUID(), on: true };
    // Le service worker lit l'identifiant ici pour demander le texte d'une notification.
    await (await caches.open('muscu-auto-push')).put('id', new Response(state.push.id));
    await subscribePush({ ...state.config, notify: d.notify });
    await pushCall('POST', '/test');
    save();
    render();
    toast('Notifications activées', 'success');
  } catch {
    state.push = { ...state.push, on: false };
    toast("Activation impossible : vérifie ta connexion et réessaie.", 'error');
  }
}

async function disablePush() {
  try {
    await pushCall('DELETE', '/subscribe');
    await (await (await navigator.serviceWorker.ready).pushManager.getSubscription())?.unsubscribe();
  } catch { /* hors ligne : l'abonnement expirera côté serveur */ }
  state.push.on = false;
  save();
  render();
  toast('Notifications désactivées', 'info');
}

// Réglages enregistrés : le serveur reçoit les nouveaux jours, horaires et noms de séance.
function syncPush() {
  if (pushOn()) subscribePush(state.config).catch(() => toast('Rappels non mis à jour : hors ligne.', 'offline'));
}

// --- Écran projeté ---
// La séance s'affiche en grand sur une TV ou un ordinateur (page tv/), l'iPhone sert de télécommande.
// Relais WebSocket par le serveur (push/worker.js, objet Screen) : l'iPhone envoie un instantané à chaque changement,
// l'écran ne fait qu'afficher et tient seul le chrono du repos (il sonne et annonce même si l'iPhone se verrouille).
const TV_URL = 'laurent-stp95.github.io/muscu-auto/tv';
let socket = null, socketTimer = null, socketDelay = 1000, tvCount = 0, sending = false, lastSay = null;
const wsUrl = (room, role) => `${PUSH.url.replace(/^http/, 'ws')}/screen?room=${room}&role=${role}`;
const parse = (text) => { try { return JSON.parse(text); } catch { return null; } };
const projected = () => tvCount > 0;

function connectScreen() {
  clearTimeout(socketTimer);
  if (!state.screen?.on || socket || document.visibilityState !== 'visible') return;
  const ws = new WebSocket(wsUrl(state.screen.room, 'phone'));
  socket = ws;
  ws.onopen = () => { socketDelay = 1000; send(); };
  ws.onmessage = (ev) => { const m = parse(ev.data); if (m?.type === 'presence') setTv(m.tv); };
  ws.onerror = () => ws.close();
  ws.onclose = () => {
    if (socket === ws) socket = null;
    setTv(0);
    if (state.screen?.on) socketTimer = setTimeout(connectScreen, socketDelay = Math.min(socketDelay * 2, 30000));
  };
}
// iOS coupe la connexion quand l'écran se verrouille : on se reconnecte au retour, l'écran reçoit tout de suite l'état.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') connectScreen(); });
addEventListener('online', connectScreen);
setInterval(() => { if (socket?.readyState === 1) socket.send('ping'); }, 30000); // le serveur répond seul, sans se réveiller

function setTv(n) {
  if (tvCount === n) return;
  tvCount = n;
  // Couleur « connecté » portée par body : juste aussi sur les écrans gardés en mémoire.
  document.body.classList.toggle('projecting', projected());
  document.querySelector('.projector')?.replaceWith(projector());
}

function send() {
  if (socket?.readyState === 1) socket.send(JSON.stringify({ type: 'state', s: live() }));
}
// Un seul envoi par tour de boucle, même si plusieurs changements s'enchaînent.
function broadcast() {
  if (!state.screen?.on || sending) return;
  sending = true;
  queueMicrotask(() => { sending = false; send(); });
}

// Annonce vocale : lue par l'iPhone, ou par l'écran projeté s'il est connecté.
function announce(text) {
  lastSay = { id: String(Date.now()), text, t: Date.now() };
  speak(text);
  broadcast();
}

function projector() {
  const label = !state.screen?.on ? 'Projeter sur un écran' : projected() ? "Projeté sur l'écran" : "En attente de l'écran…";
  return button(label, projectSheet, { variant: 'plain', icon: 'tv', className: 'btn plain projector' });
}

async function projectSheet() {
  if (!state.screen) return pairSheet();
  const choice = await choose({
    title: 'Écran projeté',
    text: !state.screen.on ? 'Projection arrêtée.' : projected() ? "La séance s'affiche sur l'écran : ton iPhone sert de télécommande." : `Écran pas encore connecté : ouvre ${TV_URL} sur la TV ou l'ordinateur.`,
    actions: [state.screen.on ? { label: 'Arrêter la projection', value: 'off' } : { label: 'Projeter', value: 'on', variant: 'primary' },
      { label: 'Associer un autre écran', value: 'pair' }, { label: 'Fermer', value: null }],
  });
  if (choice === 'off') {
    // L'écran affiche « Rien n'est projeté » ; le serveur garde cet état, une page rechargée le retrouve.
    if (socket?.readyState === 1) socket.send(JSON.stringify({ type: 'state', s: { v: 1, at: Date.now(), phase: 'stopped' } }));
    state.screen.on = false;
    save();
    socket?.close();
    setTv(0);
  }
  if (choice === 'on') { state.screen.on = true; save(); connectScreen(); }
  if (choice === 'pair') pairSheet();
}

async function pairSheet() {
  const input = h('input', { className: 'input pair-code', type: 'text', inputMode: 'numeric', pattern: '[0-9]*', maxLength: 4, autocomplete: 'one-time-code', placeholder: '0000', ariaLabel: "Code affiché sur l'écran" });
  const go = await choose({
    title: 'Projeter sur un écran',
    text: `Sur ta TV ou ton ordinateur, ouvre ${TV_URL} dans le navigateur, puis tape ici le code affiché.`,
    extra: input,
    actions: [{ label: 'Connecter', value: true, variant: 'primary' }, { label: 'Annuler', value: null }],
  });
  if (go) pair(input.value.trim());
}

// Appairage : l'écran attend dans une salle temporaire « pair-code » ; l'iPhone lui donne la salle permanente, gardée des deux côtés.
async function pair(code) {
  if (!/^\d{4}$/.test(code)) return toast('Le code fait 4 chiffres.', 'warning');
  const room = state.screen?.room || crypto.randomUUID();
  const ok = await new Promise((resolve) => {
    const ws = new WebSocket(wsUrl(`pair-${code}`, 'phone'));
    const timer = setTimeout(() => done(false), 6000);
    function done(v) { clearTimeout(timer); ws.close(); resolve(v); }
    ws.onmessage = (ev) => {
      const m = parse(ev.data);
      if (m?.type === 'presence' && m.tv > 0) ws.send(JSON.stringify({ type: 'adopt', room }));
      if (m?.type === 'adopted') done(true);
    };
    ws.onerror = () => done(false);
  });
  if (!ok) return toast("Écran introuvable : vérifie le code affiché et que l'écran est connecté à internet.", 'warning');
  socket?.close();
  state.screen = { room, on: true };
  save();
  connectScreen();
  toast('Écran connecté', 'success');
}

function forgetScreen() {
  if (socket?.readyState === 1) socket.send(JSON.stringify({ type: 'forget' }));
  state.screen = null;
  save();
  socket?.close();
  setTv(0);
  render();
  toast('Écran oublié', 'info');
}

const loadText = (e, kg) => (e.load === 'pdc' ? 'Poids du corps' : kg == null ? 'Charge à choisir' : kgLabel(e, kg).replace(/^./, (c) => c.toUpperCase()));
const repsText = (e, reps) => `${reps} ${e.unit === 's' ? 's' : 'rép.'}`;

// Aperçu d'une séance à venir : exercices avec la charge conseillée, matériel à préparer.
function preview(s, nextWeek) {
  const entries = s.items.map((item) => {
    const e = byId.get(item.ex);
    const it = effective(item);
    return { e, it, kg: e.load === 'pdc' ? null : tipFor(e, history(e.id))?.kg ?? null };
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
    stats: [[`${sets.size}/${planned}`, planned > 1 ? 'séries' : 'série'], [`${activeMinutes(state.active.session)} min`, 'effort'], [kgText(volume), 'volume']],
    records: [...sets.values()].filter((x) => x.pr && byId.has(x.ex)).map((x) => `${byId.get(x.ex).name} : ${setText(byId.get(x.ex), x.kg, x.reps)}`),
  };
}

// Instantané de la séance pour l'écran projeté (contrat v1, décrit dans tv/tv.js).
function live() {
  const base = { v: 1, at: Date.now(), voice: voiceOn(), upcoming: null, progress: null, ex: null, set: null, done: [], rest: null, next: null, record: null, summary: null, say: null };
  if (!state.plan) return { ...base, phase: 'idle', title: 'Steady' };
  if (!state.active) {
    if (state.ended && Date.now() - state.ended.t < 15 * 60000) return { ...base, phase: 'done', title: state.ended.title, summary: state.ended.summary };
    const { index, nextWeek } = focusOf(state.plan, doneThisWeek());
    const s = state.plan[index];
    return { ...base, phase: 'idle', title: `${DAYS[s.day]} · ${s.name}`, upcoming: preview(s, nextWeek) };
  }
  const s = state.plan[state.active.day];
  const sid = state.active.session;
  const items = activeItems();
  let i = Math.min(state.listMode ? nextItem(items) : ui.at ?? nextItem(items), items.length);
  // Exercice fini (l'iPhone demande le ressenti) : l'écran montre déjà le suivant, à préparer pendant le repos.
  if (i < items.length && nextSet(items[i]) == null) {
    const k = items.findIndex((y, j) => j > i && nextSet(y) != null);
    i = k < 0 ? nextItem(items) : k;
  }
  const title = `${DAYS[s.day]} · ${s.name}`;
  const progress = { ex: Math.min(i + 1, items.length), exCount: items.length, sets: items.reduce((n, x) => n + x.done.size, 0),
    setCount: items.reduce((n, x) => n + x.it.sets, 0), minutes: activeMinutes(sid) };
  const say = lastSay && Date.now() - lastSay.t < 10000 ? { id: lastSay.id, text: lastSay.text } : null;
  if (state.active.paused) return { ...base, phase: 'paused', title, progress };
  if (warm) {
    const m = warm.list[warm.i], next = warm.list[warm.i + 1];
    return { ...base, phase: 'rest', title, say, label: `Échauffement · ${warm.i + 1} sur ${warm.list.length}`,
      ex: { id: 0, name: m.name, img: [], mus: m.mus, mus2: [], cues: [m.cue], badge: null, note: null },
      set: { n: null, of: null, target: `${m.s} s`, load: null, plates: null, change: null, last: null, approach: null },
      rest: { end: warm.end, total: warm.total, say: next ? `Mouvement suivant : ${next.name}, ${next.s} secondes.` : 'Échauffement terminé. Place aux séries.' },
      next: next ? { name: next.name, detail: `${next.s} s` } : null };
  }
  if (i >= items.length) return { ...base, phase: 'done', title, progress, summary: summaryData(items), say };
  const x = items[i];
  const { e, it } = x;
  const n = nextSet(x);
  const logged = sessionSets(sid);
  const picked = n && ui.pick?.key === `${sid}|${e.id}|${n}` ? ui.pick : null;
  const kg = picked ? picked.kg : startKg(x);
  const reps = picked ? picked.reps : n && targetReps(it, x.past, kg, n, e.unit);
  const bar = barPlan(e, kg);
  const last = n && x.past.at(-1)?.sets.find((t) => t.set === n);
  const approach = n === 1 ? warmup(e, kg, state.config.loads) : [];
  const pr = [...logged.values()].filter((t) => t.pr && Date.now() - Date.parse(t.t) < 15000).at(-1);
  const after = items[i + 1];
  return {
    ...base, phase: rest ? 'rest' : 'work', title, progress, say,
    ex: { id: e.id, name: e.name, img: e.img, mus: e.mus, mus2: e.mus2, cues: (e.cues || [CUES[e.zone]]).slice(0, 3),
      badge: x.tip.learning ? 'Apprentissage du geste' : null, note: x.tip.note },
    set: n && { n, of: it.sets, target: repsText(e, reps), load: loadText(e, kg), plates: bar.plates || null, change: bar.change || null,
      last: last ? `La dernière fois : ${setText(e, last.kg, last.reps)}` : null,
      approach: approach.length ? `Approche : ${approach.map(([w, r]) => `${kgText(w)} × ${r}`).join(' · ')}` : null },
    done: [...x.done.values()].sort((a, b) => a.set - b.set).map((t) => ({ n: t.set, text: setText(e, t.kg, t.reps), t: clock(t.t), record: !!logged.get(`${e.id}-${t.set}`)?.pr })),
    rest: rest ? { end: restEnd, total: restTotal, say: restSay() } : null,
    next: after ? { name: after.e.name, img: after.e.img, detail: `${after.it.sets} × ${after.it.reps}${after.e.unit === 's' ? ' s' : ''} · ${loadText(after.e, startKg(after))}` } : null,
    record: pr ? { id: pr.t, text: `Record : ${setText(byId.get(pr.ex), pr.kg, pr.reps)}` } : null,
  };
}

// --- Bilan pour Claude ---
// Les 4 dernières semaines en texte, à coller dans Claude pour un avis de coach.
function claudeText() {
  const since = new Date(Date.now() - 28 * 864e5).toISOString();
  const skip = cancelled(log);
  const c = state.config;
  const lines = [
    'Voici mes 4 dernières semaines de musculation à domicile (appli Steady). Analyse ma progression, ma régularité et mes ressentis, signale ce qui pourrait mener à une blessure, puis propose 3 ajustements concrets.',
    '',
    `Profil : ${LEVELS[c.level].label.toLowerCase()}, objectif ${GOALS[c.goal].label.toLowerCase()}, ${plural(c.days.length, 'séance')} par semaine (${c.days.map((d) => DAYS[d].toLowerCase()).join(', ')}), ${c.minutes} min.`,
    `Matériel : ${c.equipment.map((q) => TAGS[q]).join(', ')}.`,
    c.zones.length ? `Zones fragiles : ${c.zones.map((z) => ZONES[z]).join(', ')}.` : null,
  ];
  for (const st of log.filter((x) => x.type === 'start' && x.t >= since && !skip.has(x.session))) {
    const entries = journal().filter((x) => x.session === st.session);
    const sets = entries.filter((x) => x.type === 'set' && byId.has(x.ex));
    if (!sets.length) continue;
    const fit = entries.find((x) => x.type === 'readiness');
    lines.push('', `${new Date(st.t).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · ${st.name}${fit ? ` · forme ${{ normal: 'bonne', hold: 'moyenne', light: 'basse' }[fit.level]}` : ''}`);
    for (const id of new Set(sets.map((x) => x.ex))) {
      const e = byId.get(id);
      const last = new Map(sets.filter((x) => x.ex === id).map((x) => [x.set, x])); // la dernière saisie d'une série fait foi
      const feel = entries.findLast((x) => x.ex === id && x.type === 'feel')?.feel;
      const tech = entries.findLast((x) => x.ex === id && x.type === 'tech')?.ok;
      lines.push(`- ${e.name} : ${[...last.values()].map((x) => setText(e, x.kg, x.reps)).join(', ')}${feel ? ` · ressenti ${FEELS.find(([v]) => v === feel)[1].toLowerCase()}` : ''}${tech === false ? ' · technique à revoir' : ''}`);
    }
  }
  return lines.filter((l) => l != null).join('\n').replace(/ /g, ' ');
}

async function copyForClaude() {
  try {
    await navigator.clipboard.writeText(claudeText());
    toast('Copié : colle-le dans une conversation avec Claude.', 'success');
  } catch {
    toast('Copie impossible sur cet appareil.', 'error');
  }
}

// --- Sauvegarde automatique ---
// Le journal est copié sur le serveur (push/worker.js) après chaque séance. Le code de récupération (identifiant aléatoire)
// permet de le restaurer sur un autre iPhone : quiconque l'a peut lire le journal, il reste donc privé.

const cloudOn = () => state.cloud?.on !== false;
const deviceId = () => (state.push = { ...state.push, id: state.push?.id || crypto.randomUUID() }).id;
const dateTime = (iso) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

async function cloudBackup(force = false) {
  // En développement (localhost), on n'écrit jamais sur le serveur réel.
  if (!location.hostname.endsWith('github.io') || !cloudOn() || !navigator.onLine || (!force && state.cloud?.n === log.length) || !log.length) return;
  try {
    const res = await fetch(`${PUSH.url}/backup?id=${deviceId()}`, { method: 'POST', body: JSON.stringify({ exported: new Date().toISOString(), config: state.config, log }) });
    if (!res.ok) throw new Error(String(res.status));
    state.cloud = { on: true, t: new Date().toISOString(), n: log.length };
    save();
    if (force) { render(); toast('Journal sauvegardé sur ton serveur', 'success'); }
  } catch {
    if (force) toast('Sauvegarde impossible : vérifie ta connexion.', 'error');
  }
}

function cloudEditor() {
  const code = state.push?.id;
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); toast('Code copié', 'success'); } catch { toast('Copie impossible : sélectionne le code à la main.', 'warning'); }
  };
  return [
    h('div', { className: 'list' },
      toggle('Sauvegarde automatique', cloudOn(), async (on) => {
        state.cloud = { ...state.cloud, on };
        save();
        if (on) return cloudBackup(true);
        try { await fetch(`${PUSH.url}/backup?id=${deviceId()}`, { method: 'DELETE' }); } catch { /* hors ligne : copie supprimée plus tard */ }
        render();
        toast('Sauvegarde automatique coupée, copie du serveur supprimée', 'info');
      }),
      cloudOn() && h('div', { className: 'line' },
        h('span', { className: 'meta' }, state.cloud?.t ? `Dernière : ${dateTime(state.cloud.t)}` : 'Pas encore sauvegardé'),
        button('Sauvegarder', () => cloudBackup(true), { size: 'compact' }))),
    h('p', { className: 'caption' }, 'Après chaque séance, ton journal est copié sur ton serveur Cloudflare. Rien d\'autre n\'y est envoyé.'),
    cloudOn() && code && h('div', { className: 'group' },
      h('span', { className: 'label' }, 'Code de récupération, pour restaurer ton suivi sur un nouvel iPhone. Ne le partage pas.'),
      h('div', { className: 'row' }, h('code', { className: 'code' }, code), button('Copier', copy, { size: 'compact' }))),
    h('div', {}, button('Restaurer avec un code', restoreFlow, { variant: 'plain' })),
  ];
}

async function restoreFlow() {
  const input = h('input', { className: 'input', type: 'text', placeholder: 'Code de récupération', autocapitalize: 'off', autocomplete: 'off', spellcheck: false, ariaLabel: 'Code de récupération' });
  const go = await choose({ title: 'Restaurer ton suivi', text: 'Colle le code affiché dans Réglages, section Sauvegarde, sur ton ancien iPhone.', extra: input,
    actions: [{ label: 'Restaurer', value: true, variant: 'primary' }, { label: 'Annuler', value: null }] });
  if (!go) return;
  const code = input.value.trim().toLowerCase();
  if (!/^[0-9a-f-]{36}$/.test(code)) return toast("Code invalide : vérifie qu'il est complet.", 'warning');
  let data, t;
  try {
    const res = await fetch(`${PUSH.url}/backup?id=${code}`);
    if (res.status === 404) return toast('Aucune sauvegarde pour ce code.', 'warning');
    if (!res.ok) throw new Error(String(res.status));
    t = Number(res.headers.get('X-Backup-Time')) || Date.now();
    data = await res.json();
  } catch {
    return toast('Restauration impossible : vérifie ta connexion.', 'error');
  }
  if (!Array.isArray(data?.log) || !data.config?.days) return toast('Sauvegarde illisible.', 'error');
  if (log.length && !await ask({ title: 'Remplacer ton suivi actuel ?', text: `Ton historique (${plural(log.length, 'saisie')}) sera remplacé par celui du ${dateTime(t)} (${plural(data.log.length, 'saisie')}).`, confirm: 'Remplacer', danger: true })) return;
  log = data.log;
  state.config = data.config;
  state.plan = generate(EXOS, state.config);
  state.cycle = { start: monday(new Date()).toISOString() };
  state.active = null;
  state.push = { id: code, on: false }; // les notifications se réactivent sur cet iPhone
  state.cloud = { on: true, t: new Date(t).toISOString(), n: log.length };
  ui = { view: 'week', step: 0, draft: null };
  save();
  render();
  toast(`Suivi restauré : ${plural(new Set(log.filter((x) => x.type === 'set').map((x) => x.session)).size, 'séance')}`, 'success');
}

// --- Mises à jour ---
// Le service worker sert la version en cache puis revérifie : s'il trouve du neuf, il prévient et on propose de recharger.

const updateBar = h('div', { className: 'update', hidden: true, role: 'status' },
  h('span', {}, 'Nouvelle version disponible'), button('Recharger', reloadApp, { variant: 'primary', size: 'compact' }));
const showUpdate = () => { updateBar.hidden = false; placeBars(); };

// --- Réseau ---
// Hors ligne, tout marche (données sur l'iPhone, appli en cache) sauf les vidéos : bandeau tant que ça dure, message à chaque bascule.
const offlineBar = h('div', { className: 'offline', hidden: navigator.onLine, role: 'status' }, icon('offline'),
  h('div', { className: 'stack tight' }, h('strong', {}, 'Hors ligne'), h('span', { className: 'caption' }, "Tout fonctionne, sauf les vidéos. Tes saisies restent sur l'iPhone.")));
addEventListener('offline', () => { offlineBar.hidden = false; placeBars(); toast('Hors ligne : tout reste utilisable, sauf les vidéos', 'offline'); });
addEventListener('online', () => { offlineBar.hidden = true; placeBars(); toast('De retour en ligne', 'success'); });

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
    await Promise.all(['./', 'index.html', 'app.js', 'plan.js', 'data.js'].map(async (f) => {
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

document.body.append(restBar);
const updated = resumeAfterReload();
if (location.hash === '#bilan' && state.plan) { ui.view = 'progress'; history.replaceState(null, '', location.pathname); } // ouverte depuis la notification du bilan
render();
setTimeout(cloudBackup, 3000);
// iOS peut renouveler ou révoquer l'abonnement push (mise à jour de l'appli…) : le serveur reçoit le dernier à chaque ouverture.
if (pushOn()) subscribePush(state.config).catch(() => {});
connectScreen();
if (updated) toast(`Appli à jour : version du ${new Date(document.lastModified).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`, 'success');
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const controlled = !!navigator.serviceWorker.controller; // au tout premier lancement, l'installation n'est pas une mise à jour
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', (ev) => { if (ev.data === 'update') showUpdate(); if (ev.data === 'bilan' && state.plan) show('progress'); });
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (controlled) showUpdate(); });
}
