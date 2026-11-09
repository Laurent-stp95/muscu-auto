// Navigation entre les écrans : vue courante (ui), onglets gardés en mémoire, barre d'onglets.
const app = document.getElementById('app');

let ui = { view: state.config ? 'week' : 'onboarding', step: 0, draft: null };

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
