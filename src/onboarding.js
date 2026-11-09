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
    h('img', { className: 'app-icon', src: 'assets/icon-180.png', alt: '' }),
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
