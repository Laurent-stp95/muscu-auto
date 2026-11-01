// Interface : onboarding, programme de la semaine, séance en cours, progrès. Logique métier dans plan.js.

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const MUSCLES = { 1: 'biceps', 2: 'épaules', 3: 'dentelé', 4: 'pectoraux', 5: 'triceps', 6: 'abdos', 7: 'mollets', 8: 'fessiers', 9: 'trapèzes', 10: 'quadriceps', 11: 'ischios', 12: 'grand dorsal', 13: 'brachial', 14: 'obliques', 15: 'soléaire', 16: 'lombaires' };
const FRONT = new Set([1, 2, 3, 4, 6, 10, 13, 14]); // muscles visibles de face (wger is_front)
const FEELS = [['easy', '😌 Facile'], ['ok', '🙂 Bien'], ['hard', '😮‍💨 Dur'], ['pain', '⚠️ Douleur']];
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

function toast(text) {
  const node = h('div', { className: 'toast', role: 'status' }, text);
  document.body.append(node);
  setTimeout(() => node.remove(), 3500);
}

function show(view) {
  ui.view = view;
  render();
  scrollTo(0, 0);
}

function render() {
  const views = { onboarding, week, session, progress };
  app.replaceChildren(...[views[ui.view](), nav()].filter(Boolean));
  if (ui.view === 'session') keepAwake();
}

function nav() {
  if (ui.view === 'onboarding') return null;
  const tab = (view, label) => h('button', { className: 'tab', ariaCurrent: ui.view === view ? 'page' : null, onclick: () => show(view) }, label);
  return h('nav', { className: 'tabs' }, tab('week', '📅 Programme'), state.active && tab('session', '⏱️ Séance'), tab('progress', '📈 Progrès'));
}

// --- Onboarding (et Réglages, qui le rouvre à l'étape 1) ---

function onboarding() {
  const d = (ui.draft ||= structuredClone({ ...DEFAULTS, ...state.config }));
  const last = ui.step === STEPS.length - 1;
  const label = ui.step === 0 ? "C'est parti" : last ? (state.plan ? 'Enregistrer' : 'Générer mon programme') : 'Suivant';
  return h('div', { className: 'ob' },
    h('div', { className: 'progress' }, h('span', { style: `width: ${(ui.step / (STEPS.length - 1)) * 100}%` })),
    STEPS[ui.step](d),
    h('div', { className: 'ob-nav' },
      ui.step > 0 && h('button', { className: 'btn', onclick: () => { ui.step--; render(); } }, 'Retour'),
      state.plan && ui.step > 0 && !last && h('button', { className: 'btn', onclick: () => { ui = { view: 'week', step: 0, draft: null }; render(); } }, 'Annuler'),
      h('button', { className: 'btn primary', disabled: !d.days.length, onclick: () => (last ? finish() : (ui.step++, render())) }, label)));
}

function step(title, lead, ...content) {
  return h('div', { className: 'step' }, h('h1', {}, title), lead && h('p', { className: 'lead' }, lead), ...content);
}

// Choix unique en grandes cartes : entries = [[valeur, icône, titre, détail]].
function choice(d, key, entries) {
  return h('div', { className: 'options' }, ...entries.map(([value, icon, label, hint]) =>
    h('button', { type: 'button', className: 'option', ariaPressed: String(d[key] === value), onclick: () => { d[key] = value; render(); } },
      h('span', { className: 'icon' }, icon), h('strong', {}, label), hint && h('span', { className: 'meta' }, hint))));
}

// Choix multiple en pastilles : entries = [[valeur, libellé]].
function chips(d, key, entries, max) {
  const toggle = (value) => {
    if (d[key].includes(value)) d[key] = d[key].filter((v) => v !== value);
    else if (max && d[key].length >= max) return toast(`${max} jours maximum : garde au moins un jour de repos.`);
    else d[key] = [...d[key], value];
    render();
  };
  return h('div', { className: 'chips' }, ...entries.map(([value, label]) =>
    h('button', { type: 'button', className: 'chip', ariaPressed: String(d[key].includes(value)), onclick: () => toggle(value) }, label)));
}

function welcome() {
  return h('div', { className: 'step' },
    h('div', { className: 'hero' }, '🏋️'),
    h('h1', {}, 'Bienvenue sur Muscu auto'),
    h('p', { className: 'lead' }, "Ton programme s'adapte à ton matériel, à ton niveau et à ton corps. Réglage en une minute."),
    h('ul', { className: 'promises' },
      h('li', {}, '📅 Séances programmées automatiquement'),
      h('li', {}, '🎥 Chaque exercice montré : gestes, muscles, consignes'),
      h('li', {}, '📈 Progression prudente : la technique avant la charge')));
}

const stepLevel = (d) => step('Ton niveau', 'Pour doser les charges et le volume.',
  choice(d, 'level', Object.entries(LEVELS).map(([k, l], i) => [k, ['🌱', '⚡', '🏆'][i], l.label, l.hint])));

const stepGoal = (d) => step('Ton objectif', null,
  choice(d, 'goal', Object.entries(GOALS).map(([k, g], i) => [k, ['💪', '🏋️', '🏃'][i], g.label, g.hint])),
  d.level === 'debutant' && d.goal === 'force' && h('p', { className: 'cue' }, '⚠️ La force demande une technique solide : commence plutôt par la prise de muscle quelques mois.'));

// « 10, 12,5 » = 10 et 12,5 : la virgule entre deux chiffres est décimale.
const numbers = (text) => [...new Set(String(text).replace(/(\d),(\d)/g, '$1.$2').split(/[;,\s]+/).map(Number).filter((x) => x > 0 && x <= 300))];

// Matériel : ce que tu as, et les charges exactes, pour ne proposer que des charges réalisables.
function stepEquipment(d) {
  const has = (q) => d.equipment.includes(q);
  const field = (label, value, onchange, props = {}) => h('label', { className: 'field' }, h('span', {}, label),
    h('input', { value, onchange: (ev) => { onchange(ev.target.value); render(); }, ...props }));
  const list = (key, label, placeholder) => field(label, (d.loads[key] || []).join(', '), (v) => { d.loads[key] = numbers(v); }, { inputMode: 'decimal', placeholder });
  const grid = loadable({ load: 'smith' }, d.loads);
  return step('Ton matériel', 'Coche ce que tu as et précise les charges : le programme ne propose que ce que tu peux vraiment charger.',
    chips(d, 'equipment', Object.entries(TAGS)),
    has('smith') && h('fieldset', { className: 'loads' },
      h('legend', {}, 'Smith machine'),
      field('Poids de la barre (kg)', d.loads.bar, (v) => { d.loads.bar = Number(v.replace(',', '.')) || 0; }, { type: 'number', inputMode: 'decimal', min: 0, max: 40, step: 0.5 }),
      h('p', { className: 'meta' }, 'Nombre de disques de chaque poids (au total, pas par côté) :'),
      h('div', { className: 'plates' }, PLATES.map((p) => field(`${p.toLocaleString('fr-FR')} kg`, d.loads.plates[p] || 0,
        (v) => { d.loads.plates[p] = Math.max(0, Math.floor(Number(v) || 0)); }, { type: 'number', inputMode: 'numeric', min: 0, max: 20, step: 1 }))),
      h('p', { className: 'meta' }, grid.length > 1
        ? `Charges possibles : ${kgText(grid[0])} à ${kgText(grid.at(-1))}, par ${kgText(Math.min(...grid.slice(1).map((kg, i) => kg - grid[i])))}.`
        : 'Ajoute des disques par paires pour charger la barre.')),
    has('halteres') && list('halteres', 'Haltères : poids disponibles (kg par haltère)', '10'),
    has('kettlebell') && list('kettlebell', 'Kettlebells (kg)', '16'),
    has('elastique') && list('elastiques', 'Élastiques : résistances (kg)', '30, 20, 10'));
}

const stepPlanning = (d) => step('Ton planning', 'Quels jours ? On évite deux séances d\'affilée sur les mêmes muscles.',
  chips(d, 'days', DAYS.map((day, i) => [i, day.slice(0, 3)]), MAX_DAYS),
  h('h2', { className: 'sub' }, 'Durée par séance'),
  choice(d, 'minutes', [30, 45, 60, 75].map((m) => [m, '⏱️', `${m} min`, `${Math.min(7, Math.max(4, Math.round(m / 15) + 2))} exercices`])));

function stepZones(d) {
  const reintegrate = (id) => { d.avoid = d.avoid.filter((x) => x !== id); render(); };
  return step('Des zones fragiles ?', 'On écarte les exercices à risque pour elles. Douleur persistante : consulte un professionnel de santé.',
    chips(d, 'zones', Object.entries(ZONES)),
    h('p', { className: 'meta' }, d.zones.length ? `${d.zones.length} zone(s) ménagée(s).` : 'Aucune : tu pourras en ajouter plus tard dans Réglages.'),
    d.avoid.length > 0 && h('div', {},
      h('h2', { className: 'sub' }, 'Exercices écartés après une douleur'),
      h('p', { className: 'meta' }, 'Réintégré, un exercice repart en apprentissage : 2 séances légères.'),
      d.avoid.map((id) => h('div', { className: 'row between' }, h('span', {}, byId.get(id)?.name || `Exercice ${id}`),
        h('button', { type: 'button', className: 'btn small', onclick: () => reintegrate(id) }, 'Réintégrer')))));
}

function stepRecap(d) {
  const equip = d.equipment.map((q) => TAGS[q]).join(', ') || 'poids du corps';
  return step('Tes règles d\'or', 'Pour progresser sans te blesser.',
    h('ol', { className: 'rules' },
      h('li', {}, "Échauffe-toi, puis fais les séries d'approche indiquées sur les mouvements lourds."),
      h('li', {}, `Garde au moins ${Math.max(2, LEVELS[d.level].rir)} répétitions en réserve sur les gros mouvements : aucune série jusqu'à l'échec.`),
      h('li', {}, 'Chaque nouvel exercice commence par 2 séances légères pour apprendre le geste.'),
      h('li', {}, 'Technique pas propre = la charge n\'augmente pas. Filme ta première série lourde.'),
      h('li', {}, 'Douleur articulaire = stop, signale-la. La brûlure musculaire est normale, la douleur vive non.')),
    h('p', { className: 'meta' }, `${LEVELS[d.level].label} · ${GOALS[d.goal].label} · ${[...d.days].sort().map((i) => DAYS[i].slice(0, 3)).join(', ')} · ${d.minutes} min · ${equip}`));
}

const STEPS = [welcome, stepLevel, stepGoal, stepEquipment, stepPlanning, stepZones, stepRecap];

function finish() {
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

function week() {
  const { config, plan } = state;
  const { week: n, deload, ended } = cycle();
  const backupDue = log.length > 0 && (!state.lastExport || daysAgo(state.lastExport) >= BACKUP_DAYS);
  return h('div', { className: 'screen' },
    h('header', { className: 'top' },
      h('h1', {}, 'Ma semaine'),
      !state.active && h('button', { className: 'btn', onclick: () => { ui = { view: 'onboarding', step: 1, draft: null }; render(); } }, 'Réglages')),
    h('p', { className: 'meta' }, `${LEVELS[config.level].label} · ${GOALS[config.goal].label} · ${config.minutes} min · cycle : semaine ${Math.min(n, CYCLE_WEEKS)}/${CYCLE_WEEKS}`),
    deload && h('section', { className: 'card banner' }, h('h2', {}, '🌿 Semaine allégée'),
      h('p', {}, 'Moitié moins de séries et charges baissées de 10 %. Ce repos fait partie de la progression : il évite la fatigue qui mène aux blessures.')),
    ended && h('section', { className: 'card banner' }, h('h2', {}, '🏁 Cycle terminé'),
      h('p', {}, 'Bravo. Le nouveau cycle garde tes mouvements principaux, pour continuer à progresser, et renouvelle les exercices secondaires.'),
      h('button', { className: 'btn primary', onclick: newCycle }, 'Lancer le nouveau cycle')),
    backupDue && h('section', { className: 'card banner' }, h('h2', {}, '💾 Sauvegarde ton journal'),
      h('p', {}, `${state.lastExport ? `Dernière sauvegarde il y a ${daysAgo(state.lastExport)} jours.` : 'Aucune sauvegarde pour l\'instant.'} Ton suivi n'existe que sur cet appareil : envoie une copie dans Fichiers ou iCloud Drive.`),
      h('button', { className: 'btn primary', onclick: backup }, 'Sauvegarder')),
    ...plan.map((s, d) => h('section', { className: 'card' },
      h('div', { className: 'card-head' },
        h('h2', {}, `${DAYS[s.day]} · ${s.name}`),
        h('button', { className: 'btn primary', onclick: () => start(d) }, state.active?.day === d ? 'Reprendre' : 'Commencer')),
      ...s.items.map((item, i) => {
        const e = byId.get(item.ex);
        return h('details', { className: 'ex' },
          h('summary', {}, h('strong', {}, e.name), h('span', { className: 'meta' }, `${prescriptionText(e, effective(item))} · ${muscles(e)}`)),
          exerciseInfo(e),
          !state.active && h('button', { className: 'btn small', onclick: () => replace(d, i) }, '↻ Remplacer'));
      }))),
    !state.active && (freshCycle() || ended) && h('button', { className: 'btn ghost', onclick: reroll }, 'Générer une autre variante'),
    !state.active && !freshCycle() && !ended && h('p', { className: 'meta center' }, 'Exercices fixes jusqu\'à la fin du cycle, pour apprendre les gestes et progresser. « Remplacer » reste possible.'));
}

function replace(d, i) {
  if (!swap(EXOS, state.plan, state.config, d, i)) return toast('Aucun autre exercice possible avec ton matériel.');
  save();
  render();
}

function reroll() {
  state.config.seed = Math.floor(Math.random() * 2 ** 31);
  state.plan = generate(EXOS, state.config);
  state.cycle = { start: monday(new Date()).toISOString() };
  save();
  render();
}

function newCycle() {
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
  const movement = () => h('div', {}, h('div', { className: 'shots' }, e.img.map((src, i) => img(src, `${e.name}, vue ${i + 1}`))),
    e.visual && h('p', { className: 'meta' }, `Visuel : ${e.visual}${e.load === 'smith' && /barre libre/.test(e.visual) ? ', à faire à la Smith' : ''}.`));
  const video = () => h('div', {},
    h('video', { src: e.vid, controls: true, preload: 'none', playsInline: true }),
    h('p', { className: 'meta' }, `Vidéo sur wger.de, ${e.vidMb} Mo : il faut du réseau. `, h('a', { href: e.vid, target: '_blank', rel: 'noopener' }, 'Ouvrir à part')));
  return h('div', { className: 'info' },
    tabs([e.img.length > 0 && ['Mouvement', movement], e.vid && ['Vidéo', video], ['Muscles', anatomy]].filter(Boolean)),
    h('ul', { className: 'cue' }, (e.cues || [CUES[e.zone]]).map((c) => h('li', {}, c))),
    e.desc && h('p', {}, e.desc),
    h('p', { className: 'meta' }, `Matériel : ${e.eq.map((q) => TAGS[q] || 'poids du corps').join(', ')}`),
    h('p', { className: 'meta' }, `Source wger.de · texte original : ${e.author || 'wger'} (${e.lic}), traduit en français${e.imgBy ? ` · images : ${e.imgBy}` : ''}`));
}

// --- Séance ---

function start(d) {
  if (state.active && state.active.day !== d) {
    if (!confirm('Une séance est déjà en cours. La terminer et commencer celle-ci ?')) return;
    endSession(false);
  }
  if (!state.active) {
    state.active = { session: new Date().toISOString(), day: d };
    record({ type: 'start', day: state.plan[d].day, name: state.plan[d].name });
  }
  show('session');
}

function endSession(go = true) {
  record({ type: 'end' });
  state.active = null;
  stopRest();
  wakeLock?.release().catch(() => {});
  wakeLock = null;
  save();
  if (go) { show('progress'); toast('Séance enregistrée 💪'); }
}

function session() {
  const s = state.plan[state.active.day];
  return h('div', { className: 'screen' },
    h('header', { className: 'top' }, h('h1', {}, `${DAYS[s.day]} · ${s.name}`), h('button', { className: 'btn primary', onclick: () => endSession() }, 'Terminer')),
    cycle().deload && h('p', { className: 'cue' }, '🌿 Semaine allégée : moitié moins de séries, charges −10 %.'),
    h('section', { className: 'card warmup' },
      h('h2', {}, '🔥 Échauffement · 5 à 8 min'),
      h('p', {}, "5 min de cardio léger et quelques rotations des articulations. Les séries d'approche sont indiquées sur chaque mouvement lourd."),
      h('p', { className: 'meta' }, 'Le minuteur de repos démarre à chaque ✓ et sonne à la fin : garde le son de l\'iPhone activé. Douleur articulaire = stop.')),
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
  const feelButtons = FEELS.map(([value, label]) =>
    h('button', { type: 'button', className: 'chip', ariaPressed: String(mine('feel')?.feel === value), onclick: () => onFeel(e, value, d, i, feelButtons) }, label));
  feelButtons.forEach((b, n) => { b.dataset.feel = FEELS[n][0]; });
  const techButtons = [[true, 'Oui'], [false, 'Non']].map(([ok, label]) =>
    h('button', { type: 'button', className: 'chip', ariaPressed: String(mine('tech')?.ok === ok), onclick: () => {
      record({ type: 'tech', ex: e.id, ok });
      techButtons.forEach((b, n) => { b.ariaPressed = String(n === (ok ? 0 : 1)); });
      if (!ok) toast("Noté : la charge n'augmentera pas la prochaine fois.");
    } }, label));
  return h('section', { className: 'card' },
    h('div', { className: 'card-head' }, h('h2', {}, e.name), tip.learning && h('span', { className: 'badge' }, `Apprentissage ${tip.learning}/${LEARNING}`)),
    h('p', { className: 'meta' }, `${prescriptionText(e, it)} · garde ${rir(e, state.config.level)} rép. en réserve`),
    h('p', { className: 'tip' }, tip.kg != null && h('strong', {}, `${kgLabel(e, tip.kg)} · `), tip.note),
    approach.length > 0 && h('p', { className: 'meta' }, `Approche : ${approach.map(([kg, reps]) => `${kgText(kg)} × ${reps}`).join(' · ')}`),
    e.main && h('p', { className: 'meta' }, e.load === 'smith' ? '📱 Avant la première série lourde : règle les butées et filme-toi.' : '📱 Filme ta première série pour vérifier le geste.'),
    h('details', {}, h('summary', {}, "Voir l'exercice et les consignes"), exerciseInfo(e)),
    h('div', { className: 'sets' },
      h('span', { className: 'meta' }, 'Série'), h('span', { className: 'meta' }, LOAD_HEAD[e.load]), h('span', { className: 'meta' }, e.unit === 's' ? 'Secondes' : 'Répét.'), h('span'),
      Array.from({ length: it.sets }, (_, n) => setRow(e, it, n + 1, done.get(n + 1), { ...tip, kg: [...done.values()].at(-1)?.kg ?? tip.kg }))),
    h('div', { className: 'feel' }, h('span', { className: 'meta' }, 'Technique propre ?'), techButtons),
    h('div', { className: 'feel' }, h('span', { className: 'meta' }, 'Ressenti :'), feelButtons));
}

const kgText = (kg) => `${kg.toLocaleString('fr-FR')} kg`;
const clock = (iso) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

function setRow(e, item, n, done, tip) {
  let kg;
  if (e.load === 'pdc') kg = h('span', { className: 'meta center' }, 'Poids du corps');
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
  const ok = h('button', { type: 'button', className: done ? 'btn ok done' : 'btn ok', ariaLabel: `Valider la série ${n}` }, done ? `✓ ${clock(done.t)}` : '✓');
  ok.onclick = () => {
    const kgValue = e.load === 'pdc' ? 0 : Number(kg.value);
    const repsValue = Number(reps.value);
    if (e.load !== 'pdc' && kg.value === '') return toast('Choisis la charge utilisée.');
    if (reps.value === '' || !Number.isInteger(repsValue) || repsValue < 0 || repsValue > 300) return toast(`Indique les ${e.unit === 's' ? 'secondes tenues' : 'répétitions faites'}.`);
    record({ type: 'set', ex: e.id, set: n, kg: kgValue, reps: repsValue, ...(tip.mode !== 'normal' && { mode: tip.mode }) });
    ok.className = 'btn ok done';
    ok.textContent = `✓ ${clock(log.at(-1).t)}`;
    // Séries suivantes pas encore choisies : même charge par défaut.
    ok.parentElement.querySelectorAll('select').forEach((s) => { if (s.value === '') s.value = kg.value; });
    if (n < item.sets) startRest(item.rest);
  };
  return [h('span', { className: 'n' }, String(n)), kg, reps, ok];
}

function onFeel(e, value, d, i, buttons) {
  record({ type: 'feel', ex: e.id, feel: value });
  buttons.forEach((b) => { b.ariaPressed = String(b.dataset.feel === value); });
  if (value !== 'pain') return;
  if (confirm('Douleur notée. Écarter cet exercice et le remplacer ?\nTu pourras le réintégrer dans Réglages. Si la douleur persiste, consulte un professionnel de santé.')) {
    state.config.avoid = [...state.config.avoid, e.id];
    if (!swap(EXOS, state.plan, state.config, d, i)) toast('Aucun exercice de remplacement : saute-le aujourd\'hui.');
    save();
    render();
  }
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
  const tick = () => {
    const left = Math.ceil((end - Date.now()) / 1000);
    if (left > 0) {
      restBar.replaceChildren(h('span', {}, `Repos ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`), h('button', { className: 'btn small', onclick: stopRest }, 'Passer'));
      return;
    }
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
  const sets = log.filter((x) => x.type === 'set');
  const sessions = new Set(sets.map((x) => x.session)).size;
  const cards = [...new Set(sets.map((x) => x.ex))]
    .filter((id) => byId.has(id))
    .map((id) => ({ e: byId.get(id), past: exerciseHistory(log, id) }))
    .sort((a, b) => b.past.at(-1).t.localeCompare(a.past.at(-1).t));
  const capped = cards.filter(({ e, past }) => tipFor(e, past)?.plafond).map(({ e }) => e.name);
  return h('div', { className: 'screen' },
    h('header', { className: 'top' }, h('h1', {}, 'Progrès')),
    h('p', { className: 'meta' }, sessions ? `${sessions} séance${sessions > 1 ? 's' : ''} · ${sets.length} séries enregistrées` : 'Lance une séance : tes courbes apparaîtront ici.'),
    capped.length >= 2 && h('section', { className: 'card banner' }, h('h2', {}, `${capped.length} exercices au plafond`),
      h('p', {}, `${capped.join(', ')} : ton matériel ne permet plus de progresser. Des charges plus lourdes (haltères réglables, par exemple) relanceraient la progression ; ajoute-les dans Réglages quand tu les as.`)),
    cards.map(({ e, past }) => progressCard(e, past)),
    h('section', { className: 'card' },
      h('h2', {}, 'Mes données'),
      h('p', { className: 'meta' }, `Chaque saisie est horodatée et reste sur cet appareil. ${state.lastExport ? `Dernière sauvegarde : ${new Date(state.lastExport).toLocaleDateString('fr-FR')}.` : 'Jamais sauvegardé.'}`),
      h('div', { className: 'row' },
        h('button', { className: 'btn primary', onclick: backup }, 'Sauvegarder (JSON)'),
        h('button', { className: 'btn', onclick: exportCsv }, 'Exporter CSV'),
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
    h('h2', {}, e.name),
    chart(points, ahead, withKg ? 'kg' : unitText(e)),
    h('p', { className: 'meta' }, `Dernière séance (${new Date(last.t).toLocaleDateString('fr-FR')}) : ${last.sets.map((x) => (withKg ? `${x.reps} × ${kgLabel(e, x.kg)}` : `${x.reps} ${unitText(e)}`)).join(' · ')}${last.tech === false ? ' · technique à revoir' : ''}`),
    tip && h('p', { className: 'tip' }, tip.kg != null && h('strong', {}, `Prochaine : ${kgLabel(e, tip.kg)} · `), tip.note),
    ahead.length > 0 && h('p', { className: 'meta' }, `Repère ${LEVELS[level].label.toLowerCase()} : environ ${kgText(ahead.at(-1))} dans 8 semaines si tout se passe bien. Indicatif : la technique et l'absence de douleur passent avant.`));
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
  toast('Journal sauvegardé.');
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
      if (!confirm(`Remplacer ton historique (${log.length} saisies) par celui du fichier (${entries.length} saisies) ?`)) return;
      log = entries;
      save();
      render();
      toast('Historique importé.');
    } catch {
      toast('Fichier invalide : choisis une sauvegarde JSON de Muscu auto.');
    }
    input.value = '';
  };
  return h('label', { className: 'btn' }, 'Importer', input);
}

document.body.append(restBar);
render();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
