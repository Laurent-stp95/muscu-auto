// --- Réglages : chaque section se modifie seule, enregistrement en une fois ---

import { frenchVoices, frenchVoice, EXOS } from './common.js';
import { LEVELS, GOALS, TAGS, generate, monday, repair } from './plan.js';
import { h, button, icon, toast } from './ui.js';
import { state, log, record, save } from './store.js';
import { ui, show, setUi, render } from './router.js';
import { pills, chips, loadsEditor, planningEditor, zonesEditor } from './onboarding.js';
import { resetLog } from './week.js';
import { forceUpdate } from './update.js';
import { forgetScreen } from './screen.js';
import { notifyEditor, syncPush } from './push.js';
import { cloudEditor } from './backup.js';

export function openSettings() {
  ui.draft = structuredClone(state.config);
  ui.draft.mirrorCam ||= 'front';
  show('settings');
}

export function settings() {
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
export function toggle(label, checked, onchange) {
  return h('label', { className: 'line' }, h('span', {}, label),
    h('input', { type: 'checkbox', className: 'switch', role: 'switch', checked, onchange: (ev) => onchange(ev.target.checked) }));
}

export function applyConfig() {
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
  setUi({ view: 'week', step: 0, draft: null });
  save();
  render();
  scrollTo(0, 0);
  syncPush();
  if (prev) toast('Réglages enregistrés', 'success');
}
