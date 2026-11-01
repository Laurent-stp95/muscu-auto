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

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch {
    toast("Enregistrement impossible : sauvegarde ton journal depuis l'onglet Progrès.");
  }
}

// Toute saisie passe ici : horodatage automatique, journal en ajout seul.
function record(entry) {
  log.push({ t: new Date().toISOString(), ...(state.active && { session: state.active.session }), ...entry });
  save();
}

// Message en haut d'écran ; avec `undo`, un bouton Annuler pendant 5 s.
function toast(text, undo) {
  document.querySelector('.toast')?.remove();
  const node = h('div', { className: 'toast', role: 'status' }, h('span', {}, text),
    undo && button('Annuler', () => { node.remove(); undo(); }, { variant: 'plain', size: 'compact' }));
  document.body.append(node);
  setTimeout(() => node.remove(), undo ? 5000 : 3000);
}

// Feuille de confirmation en bas d'écran (façon iOS). Résout true si confirmé.
function ask({ title, text, confirm: ok, cancel = 'Annuler', danger, extra }) {
  return new Promise((resolve) => {
    const dialog = h('dialog', { className: 'sheet' });
    if (!dialog.showModal) return resolve(confirm(`${title}\n${text || ''}`));
    const close = (value) => { dialog.close(); dialog.remove(); resolve(value); };
    dialog.append(h('div', { className: 'sheet-body' },
      h('div', { className: 'stack' }, h('h2', { className: 'title' }, title), text && h('p', { className: 'meta' }, text)),
      extra,
      h('div', { className: 'stack' },
        button(ok, () => close(true), { variant: danger ? 'danger' : 'primary', size: 'large' }),
        button(cancel, () => close(false), { variant: 'gray', size: 'large' }))));
    dialog.addEventListener('cancel', (ev) => { ev.preventDefault(); close(false); });
    document.body.append(dialog);
    dialog.showModal();
  });
}

function show(view) {
  ui.view = view;
  render();
  scrollTo(0, 0);
}

function render() {
  const views = { onboarding, week, session, progress, settings };
  document.body.classList.toggle('has-tabs', ui.view !== 'onboarding');
  document.body.classList.toggle('ob-mode', ui.view === 'onboarding');
  app.replaceChildren(...[!updateBar.hidden && updateBar, views[ui.view](), nav()].filter(Boolean));
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
    else if (max && d[key].length >= max) return toast(`${max} jours maximum : garde au moins un jour de repos.`);
    else d[key] = [...d[key], value];
    render();
  };
  return h('div', { className }, entries.map(([value, label]) => chip(label, d[key].includes(value), () => toggle(value))));
}

// Compteur − / + mis à jour sur place : le focus reste sur le bouton touché.
function stepper(value, onChange, { min = 0, max, step = 1, unit, label }) {
  const out = h('output', {});
  const show = () => { out.textContent = unit === 'kg' ? kgText(value) : `${value} ${unit}${value > 1 ? 's' : ''}`; };
  const set = (v) => { value = Math.min(max, Math.max(min, Math.round(v * 100) / 100)); show(); onChange(value); };
  show();
  return h('span', { className: 'stepper', role: 'group', ariaLabel: label },
    button('−', () => set(value - step), { ariaLabel: `Moins : ${label}` }), out, button('+', () => set(value + step), { ariaLabel: `Plus : ${label}` }));
}

// « 10, 12,5 » = 10 et 12,5 : la virgule entre deux chiffres est décimale.
const numbers = (text) => [...new Set(String(text).replace(/(\d),(\d)/g, '$1.$2').split(/[;,\s]+/).map(Number).filter((x) => x > 0 && x <= 300))];

// Poids disponibles (haltères, kettlebells, élastiques) : pastilles à retirer d'une tape (annulable), champ pour en ajouter.
function weights(d, key, label) {
  const box = h('section', { className: 'card' });
  const draw = (focus) => {
    const input = h('input', { className: 'input', type: 'text', inputMode: 'decimal', placeholder: 'Poids en kg', ariaLabel: `Ajouter un poids : ${label}` });
    const add = () => {
      const v = numbers(input.value);
      if (!v.length) return toast('Indique un poids en kg.');
      d.loads[key] = [...new Set([...(d.loads[key] || []), ...v])].sort((a, b) => a - b);
      draw(true);
    };
    input.onkeydown = (ev) => { if (ev.key === 'Enter') add(); };
    const list = d.loads[key] || [];
    const remove = (kg) => {
      d.loads[key] = list.filter((x) => x !== kg);
      draw();
      toast(`${kgText(kg)} retiré`, () => { d.loads[key] = [...d.loads[key], kg].sort((a, b) => a - b); draw(); });
    };
    box.replaceChildren(h('h2', {}, label),
      list.length ? h('div', { className: 'chips' }, list.map((kg) => chip(`${kgText(kg)}  ×`, false, () => remove(kg), { ariaLabel: `Retirer ${kgText(kg)}` })))
        : h('p', { className: 'meta' }, 'Ajoute au moins un poids, sinon les exercices concernés sont écartés.'),
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
          stepper(d.loads.bar, (v) => { d.loads.bar = v; refresh(); }, { step: 0.5, max: 40, unit: 'kg', label: 'poids de la barre' })),
        PLATES.map((p) => h('div', { className: 'line' }, h('span', {}, `Disques de ${kgText(p)}`),
          stepper(Math.floor((d.loads.plates[p] || 0) / 2), (v) => { d.loads.plates[p] = v * 2; refresh(); }, { max: 10, unit: 'paire', label: `paires de disques de ${kgText(p)}` })))),
      range),
    has('halteres') && weights(d, 'halteres', 'Haltères (kg par haltère)'),
    has('kettlebell') && weights(d, 'kettlebell', 'Kettlebells (kg)'),
    has('elastique') && weights(d, 'elastiques', 'Élastiques (résistance en kg)'),
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
    h('div', { className: 'stack' }, h('h1', {}, 'Muscu auto'), h('p', { className: 'lead' }, 'Tes séances, programmées selon ton matériel.')),
    h('ul', { className: 'features' },
      [['calendar', 'Programme automatique', 'Renouvelé par cycles, adapté à tes jours.'],
        ['eye', 'Chaque geste montré', 'Visuels, muscles et consignes de sécurité.'],
        ['chart', 'La technique avant la charge', 'Les charges montent seulement quand le geste est propre.']]
        .map(([name, title, text]) => h('li', {}, icon(name), h('div', { className: 'stack tight' }, h('strong', {}, title), h('span', { className: 'meta' }, text))))));
}

// Sur iPhone, l'appli installée a son propre stockage : on installe avant de régler, sinon tout est à refaire.
const stepInstall = () => step("Installe-la d'abord", "Sur l'écran d'accueil, l'appli s'ouvre en plein écran, marche sans réseau, et Safari n'efface pas ton suivi.",
  h('ol', { className: 'howto' },
    h('li', {}, 'Touche ', h('strong', {}, 'Partager'), ' en bas de Safari (carré avec une flèche).'),
    h('li', {}, 'Choisis ', h('strong', {}, "Sur l'écran d'accueil"), ', puis Ajouter.'),
    h('li', {}, 'Ouvre Muscu auto depuis sa nouvelle icône et règle-la là.')),
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
  const section = (title, ...content) => h('section', { className: 'card' }, h('h2', {}, title), ...content);
  return h('div', { className: 'screen' },
    h('header', { className: 'navbar' },
      button('Annuler', () => { ui.draft = null; show('week'); }, { variant: 'plain', className: 'btn plain start' }),
      h('h1', {}, 'Réglages'),
      button('Enregistrer', applyConfig, { variant: 'plain', className: 'btn plain end', disabled: !d.days.length })),
    restart && h('p', { className: 'note' }, icon('warning'), 'Niveau, objectif, jours ou durée changés : un nouveau programme et un nouveau cycle commenceront.'),
    section('Niveau', pills(d, 'level', Object.entries(LEVELS).map(([k, l]) => [k, l.label]))),
    section('Objectif', pills(d, 'goal', Object.entries(GOALS).map(([k, g]) => [k, g.label]))),
    section('Matériel', chips(d, 'equipment', Object.entries(TAGS)), loadsEditor(d)),
    section('Planning', planningEditor(d)),
    section('Zones fragiles', zonesEditor(d)),
    section('Appli',
      h('div', { className: 'line' },
        h('span', { className: 'meta' }, `Version du ${new Date(document.lastModified).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`),
        button('Mettre à jour', forceUpdate, { size: 'compact' }))));
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
  if (prev) toast('Réglages enregistrés');
}

// --- Programme ---

const restText = (s) => (s >= 120 ? `${s / 60} min` : `${s} s`);
const unitText = (e) => (e.unit === 's' ? 's' : 'rép.');
const cycle = () => cycleWeek(state.cycle);
const effective = (item) => ({ ...item, sets: cycle().deload ? Math.ceil(item.sets / 2) : item.sets });
const prescriptionText = (e, item) => `${item.sets} × ${item.reps}${e.unit === 's' ? ' s' : ''} · repos ${restText(item.rest)}`;
const muscles = (e) => e.mus.map((m) => MUSCLES[m]).join(', ');
const daysAgo = (iso) => Math.floor((Date.now() - Date.parse(iso)) / 864e5);
const freshCycle = () => !log.some((x) => x.type === 'start' && x.t >= state.cycle.start);

function banner(name, title, ...content) {
  return h('section', { className: 'card' }, h('div', { className: 'banner-head' }, icon(name), h('h2', {}, title)), ...content);
}

function week() {
  const { config, plan } = state;
  const { week: n, deload, ended } = cycle();
  const backupDue = log.length > 0 && (!state.lastExport || daysAgo(state.lastExport) >= BACKUP_DAYS);
  return h('div', { className: 'screen' },
    h('header', { className: 'stack tight' },
      h('div', { className: 'top' }, h('h1', {}, 'Ma semaine'), !state.active && button('Réglages', openSettings, { variant: 'plain' })),
      h('p', { className: 'meta' }, `Cycle : semaine ${Math.min(n, CYCLE_WEEKS)} sur ${CYCLE_WEEKS}`),
      h('p', { className: 'caption' }, `${LEVELS[config.level].label} · ${GOALS[config.goal].label} · ${config.minutes} min`)),
    deload && banner('leaf', 'Semaine allégée',
      h('p', {}, 'Moitié moins de séries et charges baissées de 10 %. Ce repos fait partie de la progression : il évite la fatigue qui mène aux blessures.')),
    ended && banner('flag', 'Cycle terminé',
      h('p', {}, 'Le nouveau cycle garde tes mouvements principaux, pour continuer à progresser, et renouvelle les exercices secondaires.'),
      button('Lancer le nouveau cycle', newCycle, { variant: 'primary' })),
    backupDue && banner('save', 'Sauvegarde ton journal',
      h('p', {}, `${state.lastExport ? `Dernière sauvegarde il y a ${daysAgo(state.lastExport)} jours.` : "Aucune sauvegarde pour l'instant."} Ton suivi n'existe que sur cet appareil : envoie une copie dans Fichiers ou iCloud Drive.`),
      button('Sauvegarder', backup, { variant: 'primary' })),
    plan.map((s, d) => h('section', { className: 'card' },
      h('div', { className: 'card-head' },
        h('h2', { className: 'title' }, `${DAYS[s.day]} · ${s.name}`),
        button(state.active?.day === d ? 'Reprendre' : 'Commencer', () => start(d), { variant: 'primary', size: 'compact' })),
      h('div', { className: 'list' }, s.items.map((item, i) => {
        const e = byId.get(item.ex);
        return h('details', { className: 'ex' },
          h('summary', {}, h('span', { className: 'stack tight' }, h('strong', {}, e.name), h('span', { className: 'meta' }, `${prescriptionText(e, effective(item))} · ${muscles(e)}`)), icon('chevron', 'chev')),
          h('div', { className: 'ex-body' }, exerciseInfo(e), !state.active && h('div', {}, button('Remplacer', () => replace(d, i), { size: 'compact' }))));
      })))),
    !state.active && (freshCycle() || ended) && button('Générer une autre variante', reroll, { variant: 'gray', size: 'large' }),
    !state.active && !freshCycle() && !ended && h('p', { className: 'caption center' }, "Exercices fixes jusqu'à la fin du cycle, pour apprendre les gestes et progresser. « Remplacer » reste possible."));
}

function replace(d, i) {
  const item = state.plan[d].items[i];
  const before = { ...item };
  if (!swap(EXOS, state.plan, state.config, d, i)) return toast('Aucun autre exercice possible avec ton matériel.');
  save();
  render();
  toast(`Remplacé par ${byId.get(item.ex).name}`, () => { Object.assign(item, before); save(); render(); });
}

async function reroll() {
  if (!await ask({ title: 'Générer une autre variante ?', text: 'Tous les exercices de la semaine changent et un nouveau cycle commence. Ton journal est gardé.', confirm: 'Générer' })) return;
  state.config.seed = Math.floor(Math.random() * 2 ** 31);
  state.plan = generate(EXOS, state.config);
  state.cycle = { start: monday(new Date()).toISOString() };
  save();
  render();
  toast('Nouveau programme prêt');
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
    if (!await ask({ title: 'Une séance est déjà en cours', text: 'La terminer et commencer celle-ci ?', confirm: 'Terminer et commencer' })) return;
    closeSession();
  }
  if (!state.active) {
    state.active = { session: new Date().toISOString(), day: d };
    record({ type: 'start', day: state.plan[d].day, name: state.plan[d].name });
  }
  show('session');
}

// Bilan avant de terminer : séries faites, durée, volume, exercices pas commencés.
function sessionSummary() {
  const sid = state.active.session;
  const s = state.plan[state.active.day];
  const sets = new Map();
  for (const x of log) if (x.session === sid && x.type === 'set') sets.set(`${x.ex}-${x.set}`, x);
  const planned = s.items.reduce((n, it) => n + effective(it).sets, 0);
  const minutes = Math.max(1, Math.round((Date.now() - Date.parse(sid)) / 60000));
  const volume = Math.round([...sets.values()].reduce((v, x) => v + (x.kg || 0) * x.reps, 0));
  const skipped = s.items.filter((it) => ![...sets.values()].some((x) => x.ex === it.ex)).map((it) => byId.get(it.ex).name);
  const stat = (value, label) => h('div', { className: 'stat' }, h('strong', {}, value), h('span', { className: 'caption' }, label));
  return h('div', { className: 'stack' },
    h('div', { className: 'stats' }, stat(`${sets.size}/${planned}`, 'séries'), stat(`${minutes} min`, 'durée'), stat(`${volume.toLocaleString('fr-FR')} kg`, 'volume')),
    skipped.length > 0 && h('p', { className: 'caption' }, `Pas commencés : ${skipped.join(', ')}.`));
}

async function endSession() {
  if (!await ask({ title: 'Terminer la séance ?', extra: sessionSummary(), confirm: 'Terminer', cancel: 'Continuer la séance' })) return;
  closeSession();
  show('progress');
  toast('Séance enregistrée');
}

function closeSession() {
  record({ type: 'end' });
  state.active = null;
  stopRest();
  wakeLock?.release().catch(() => {});
  wakeLock = null;
  save();
}

function session() {
  const s = state.plan[state.active.day];
  return h('div', { className: 'screen' },
    h('header', { className: 'top' }, h('h1', {}, `${DAYS[s.day]} · ${s.name}`), button('Terminer', endSession, { variant: 'gray', size: 'compact' })),
    cycle().deload && h('p', { className: 'note' }, icon('leaf'), 'Semaine allégée : moitié moins de séries, charges −10 %.'),
    banner('flame', 'Échauffement · 5 à 8 min',
      h('p', {}, "5 min de cardio léger et quelques rotations des articulations. Les séries d'approche sont indiquées sur chaque mouvement lourd."),
      h('p', { className: 'caption' }, "Le minuteur de repos démarre à chaque série validée et sonne à la fin : garde le son de l'iPhone activé.")),
    s.items.map((item, i) => block(item, state.active.day, i)));
}

function block(item, d, i) {
  const e = byId.get(item.ex);
  const sid = state.active.session;
  const it = effective(item);
  const all = exerciseHistory(log, e.id);
  const past = all.filter((x) => x.session !== sid);
  const tip = suggest(e, it, past, { loads: state.config.loads, learned: learned(log, e.id, past), deload: cycle().deload });
  const done = new Map((all.find((x) => x.session === sid)?.sets || []).map((x) => [x.set, x]));
  const mine = (type) => log.findLast((x) => x.session === sid && x.ex === e.id && x.type === type);
  const approach = warmup(e, tip.kg, state.config.loads);
  // Le badge dit déjà « Apprentissage n/2 » : la consigne commence directement.
  const note = tip.learning ? tip.note.replace(/^Apprentissage \d\/\d : (.)/, (_, c) => c.toUpperCase()) : tip.note;
  const feelButtons = FEELS.map(([value, label]) => chip(label, mine('feel')?.feel === value, () => onFeel(e, value, d, i, feelButtons), { danger: value === 'pain' }));
  feelButtons.forEach((b, n) => { b.dataset.feel = FEELS[n][0]; });
  const techButtons = [[true, 'Oui'], [false, 'Non']].map(([ok, label]) => chip(label, mine('tech')?.ok === ok, () => {
    record({ type: 'tech', ex: e.id, ok });
    techButtons.forEach((b, n) => { b.ariaPressed = String(n === (ok ? 0 : 1)); });
    if (!ok) toast("Noté : la charge n'augmentera pas la prochaine fois.");
  }));
  const hint = h('p', { className: 'caption', hidden: done.size === 0 }, 'Pour corriger une série, change la valeur puis valide à nouveau.');
  return h('section', { className: 'card' },
    h('div', { className: 'card-head' }, h('h2', { className: 'title' }, e.name), tip.learning && h('span', { className: 'badge' }, `Apprentissage ${tip.learning}/${LEARNING}`)),
    h('p', { className: 'meta' }, `${prescriptionText(e, it)} · garde ${rir(e, state.config.level)} rép. en réserve`),
    h('p', { className: 'tip' }, tip.kg != null && h('strong', {}, `${kgLabel(e, tip.kg)} · `), note),
    approach.length > 0 && h('p', { className: 'meta' }, `Approche : ${approach.map(([kg, reps]) => `${kgText(kg)} × ${reps}`).join(' · ')}`),
    e.main && h('p', { className: 'note' }, icon('video'), e.load === 'smith' ? 'Avant la première série lourde : règle les butées et filme-toi.' : 'Filme ta première série pour vérifier le geste.'),
    h('details', { className: 'more' }, h('summary', {}, "Voir l'exercice et les consignes", icon('chevron', 'chev')), exerciseInfo(e)),
    h('div', { className: 'sets' },
      h('span', { className: 'caption head n' }, 'Série'), h('span', { className: 'caption head' }, LOAD_HEAD[e.load]), h('span', { className: 'caption head' }, e.unit === 's' ? 'Secondes' : 'Répét.'), h('span'),
      Array.from({ length: it.sets }, (_, n) => setRow(e, it, n + 1, done.get(n + 1), { ...tip, kg: [...done.values()].at(-1)?.kg ?? tip.kg }, hint))),
    hint,
    h('div', { className: 'group' }, h('span', { className: 'label' }, 'Technique propre ?'), h('div', { className: 'chips' }, techButtons)),
    h('div', { className: 'group' }, h('span', { className: 'label' }, 'Ressenti'), h('div', { className: 'chips' }, feelButtons)));
}

const kgText = (kg) => `${kg.toLocaleString('fr-FR')} kg`;
const clock = (iso) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

function setRow(e, item, n, done, tip, hint) {
  let kg;
  if (e.load === 'pdc') kg = h('span', { className: 'caption bw' }, 'Poids du corps');
  else {
    // Liste des charges réalisables : impossible de saisir une charge qu'on ne peut pas monter.
    const list = loadable(e, state.config.loads);
    const value = done?.kg ?? tip.kg;
    if (value != null && !list.includes(value)) list.push(value);
    kg = h('select', { ariaLabel: `Charge série ${n}` },
      h('option', { value: '' }, 'Choisir'),
      list.sort((a, b) => a - b).map((x) => h('option', { value: x, selected: x === value }, kgLabel(e, x).replace('élastique ', ''))));
  }
  const reps = h('input', { type: 'number', inputMode: 'numeric', min: 0, max: 300, step: 1, value: done?.reps ?? '', placeholder: item.reps, ariaLabel: `${e.unit === 's' ? 'Secondes' : 'Répétitions'} série ${n}` });
  const mark = (t) => { ok.className = 'btn done'; ok.replaceChildren(icon('check'), clock(t)); };
  const ok = button(null, () => {
    const kgValue = e.load === 'pdc' ? 0 : Number(kg.value);
    const repsValue = Number(reps.value);
    if (e.load !== 'pdc' && kg.value === '') return toast('Choisis la charge utilisée.');
    if (reps.value === '' || !Number.isInteger(repsValue) || repsValue < 0 || repsValue > 300) return toast(`Indique les ${e.unit === 's' ? 'secondes tenues' : 'répétitions faites'}.`);
    record({ type: 'set', ex: e.id, set: n, kg: kgValue, reps: repsValue, ...(tip.mode !== 'normal' && { mode: tip.mode }) });
    mark(log.at(-1).t);
    hint.hidden = false;
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
  if (!await ask({ title: 'Douleur notée', text: 'Écarter cet exercice et le remplacer ? Tu pourras le réintégrer dans Réglages. Si la douleur persiste, consulte un professionnel de santé.', confirm: 'Écarter et remplacer', cancel: "Garder pour aujourd'hui", danger: true })) return;
  const item = state.plan[d].items[i];
  const before = { ...item };
  state.config.avoid = [...state.config.avoid, e.id];
  if (!swap(EXOS, state.plan, state.config, d, i)) toast("Aucun exercice de remplacement : saute-le aujourd'hui.");
  else toast(`${e.name} écarté`, () => { state.config.avoid = state.config.avoid.filter((x) => x !== e.id); Object.assign(item, before); save(); render(); });
  save();
  render();
}

// --- Minuteur de repos et écran allumé ---
// Une appli web iPhone ne peut ni vibrer ni notifier sans serveur : le son ne joue que si l'écran reste allumé.

let audio = null, rest = null, wakeLock = null;
const restBar = h('div', { className: 'rest', hidden: true, role: 'timer' });

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
  stopRest();
  const end = Date.now() + seconds * 1000;
  const time = h('span', {});
  restBar.replaceChildren(time, button('Passer', stopRest, { size: 'compact' }));
  const tick = () => {
    const left = Math.ceil((end - Date.now()) / 1000);
    if (left > 0) { time.textContent = `Repos ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; return; }
    stopRest();
    beep();
    toast('Repos terminé : série suivante.');
  };
  rest = setInterval(tick, 250);
  restBar.hidden = false;
  tick();
}

function stopRest() {
  clearInterval(rest);
  rest = null;
  restBar.hidden = true;
}

async function keepAwake() {
  if (!state.active || wakeLock || !navigator.wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { /* refusé (batterie faible) : l'écran s'éteindra normalement */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ui.view === 'session') keepAwake(); });

// --- Progrès ---

function progress() {
  const sets = log.filter((x) => x.type === 'set' && byId.has(x.ex)); // exercices retirés de la liste : plus affichés
  const sessions = new Set(sets.map((x) => x.session)).size;
  const cards = [...new Set(sets.map((x) => x.ex))]
    .filter((id) => byId.has(id))
    .map((id) => ({ e: byId.get(id), past: exerciseHistory(log, id) }))
    .sort((a, b) => b.past.at(-1).t.localeCompare(a.past.at(-1).t));
  const capped = cards.filter(({ e, past }) => tipFor(e, past)?.plafond).map(({ e }) => e.name);
  return h('div', { className: 'screen' },
    h('header', { className: 'stack tight' }, h('div', { className: 'top' }, h('h1', {}, 'Progrès')),
      sessions > 0 && h('p', { className: 'meta' }, `${sessions} séance${sessions > 1 ? 's' : ''} · ${sets.length} séries enregistrées`)),
    !cards.length && h('section', { className: 'card empty' }, icon('chart'), h('h2', { className: 'title' }, 'Pas encore de séance'),
      h('p', { className: 'meta' }, 'Après ta première séance, tu verras ici tes charges, tes répétitions et la prochaine étape pour chaque exercice.'),
      button('Voir ma semaine', () => show('week'), { variant: 'primary' })),
    capped.length >= 2 && banner('warning', `${capped.length} exercices au plafond`,
      h('p', {}, `${capped.join(', ')} : ton matériel ne permet plus de progresser. Des charges plus lourdes (haltères réglables, par exemple) relanceraient la progression ; ajoute-les dans Réglages quand tu les as.`)),
    cards.map(({ e, past }) => progressCard(e, past)),
    h('section', { className: 'card' },
      h('h2', {}, 'Mes données'),
      h('p', { className: 'meta' }, `Chaque saisie est horodatée et reste sur cet appareil. ${state.lastExport ? `Dernière sauvegarde : ${new Date(state.lastExport).toLocaleDateString('fr-FR')}.` : 'Jamais sauvegardé.'}`),
      h('div', { className: 'row' },
        button('Sauvegarder', backup, { variant: 'primary', icon: 'save' }),
        button('Exporter CSV', exportCsv),
        importButton())));
}

function tipFor(e, past) {
  const item = state.plan.flatMap((s) => s.items).find((it) => it.ex === e.id);
  return item && suggest(e, effective(item), past, { loads: state.config.loads, learned: learned(log, e.id, past), deload: cycle().deload });
}

function progressCard(e, past) {
  const level = state.config.level;
  const withKg = e.load !== 'pdc';
  const value = (s) => (withKg ? Math.max(0, ...s.sets.map((x) => x.kg || 0)) : Math.max(...s.sets.map((x) => x.reps)));
  const points = past.map((s) => ({ x: Date.parse(s.t), y: value(s) }));
  const ahead = e.load === 'smith' && points.at(-1).y > 0 ? project(points.at(-1).y, level) : [];
  const last = past.at(-1);
  const tip = tipFor(e, past);
  return h('section', { className: 'card' },
    h('h2', { className: 'title' }, e.name),
    chart(points, ahead, withKg ? 'kg' : unitText(e)),
    h('p', { className: 'meta' }, `Dernière séance (${new Date(last.t).toLocaleDateString('fr-FR')}) : ${last.sets.map((x) => (withKg ? `${x.reps} × ${kgLabel(e, x.kg)}` : `${x.reps} ${unitText(e)}`)).join(' · ')}${last.tech === false ? ' · technique à revoir' : ''}`),
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
  const sx = (x) => (P + ((x - x0) / (x1 - x0 || 1)) * (W - 2 * P)).toFixed(1);
  const sy = (y) => (H - P - ((y - y0) / (y1 - y0 || 1)) * (H - 2 * P)).toFixed(1);
  const line = (pts) => pts.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ');
  const box = h('div', { className: 'chart' });
  // Valeurs numériques et libellés fixes uniquement : innerHTML sans risque ici.
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution en ${unit}">
    <text x="2" y="${sy(y1)}" class="axis">${y1.toLocaleString('fr-FR')} ${unit}</text>
    <text x="2" y="${sy(y0)}" class="axis">${y0.toLocaleString('fr-FR')}</text>
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
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Muscu auto' });
    else download(name, 'application/json', text);
  } catch (err) {
    if (err.name === 'AbortError') return; // partage annulé
    download(name, 'application/json', text);
  }
  state.lastExport = new Date().toISOString();
  save();
  render();
  toast('Journal sauvegardé');
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
      if (await ask({ title: 'Remplacer ton historique ?', text: `Tes ${log.length} saisies seront remplacées par les ${entries.length} du fichier.`, confirm: 'Remplacer', danger: true })) {
        log = entries;
        save();
        render();
        toast('Historique importé');
      }
    } catch {
      toast('Fichier invalide : choisis une sauvegarde JSON de Muscu auto.');
    }
    input.value = '';
  };
  return h('label', { className: 'btn' }, 'Importer', input);
}

// --- Mises à jour ---
// Le service worker sert la version en cache puis revérifie : s'il trouve du neuf, il prévient et on propose de recharger.

const updateBar = h('div', { className: 'update', hidden: true, role: 'status' },
  h('span', {}, 'Nouvelle version disponible'), button('Recharger', () => location.reload(), { variant: 'primary', size: 'compact' }));
const showUpdate = () => { if (updateBar.hidden) { updateBar.hidden = false; app.prepend(updateBar); } };

// Bouton des Réglages : retélécharge le code sans passer par aucun cache, puis recharge.
async function forceUpdate() {
  if (!navigator.onLine) return toast('Hors ligne : reconnecte-toi pour mettre à jour.');
  toast('Mise à jour…');
  try {
    await (await navigator.serviceWorker?.getRegistration())?.update();
    const cache = await caches.open('muscu-auto');
    await Promise.all(['./', 'index.html', 'app.js', 'plan.js', 'data.js'].map(async (f) => {
      const res = await fetch(f, { cache: 'reload' });
      if (res.ok) await cache.put(f, res);
    }));
  } catch { /* sans service worker : on recharge quand même */ }
  location.reload();
}

document.body.append(restBar);
render();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const controlled = !!navigator.serviceWorker.controller; // au tout premier lancement, l'installation n'est pas une mise à jour
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', (ev) => { if (ev.data === 'update') showUpdate(); });
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (controlled) showUpdate(); });
}
