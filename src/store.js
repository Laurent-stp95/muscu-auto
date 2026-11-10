// Données de l'utilisateur : réglages et programme (state), journal en ajout seul (log), enregistrés sur l'iPhone (localStorage).

import { toast } from './ui.js';

const VERSION = 2; // v1 = matériel et exercices wger bruts : on refait l'onboarding, le journal est gardé

const KEY = 'muscu-auto';
const LOG_KEY = 'muscu-auto-log';

const load = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
export let state = load(KEY) || {};
if (state.v !== VERSION) state = { v: VERSION, lastExport: state.lastExport };
export let log = load(LOG_KEY) || [];
// Un `let` exporté ne se réaffecte que depuis son module : les autres fichiers passent par setLog.
export function setLog(entries) { log = entries; }

export let revision = 0; // change à chaque enregistrement : un écran gardé en mémoire d'une révision antérieure est périmé
// Prévenus à chaque enregistrement (l'écran projeté, screen.js) : store.js ne dépend ainsi d'aucun écran.
const savedListeners = [];
export function onSave(listener) { savedListeners.push(listener); }
export function save() {
  revision++;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
    savedListeners.forEach((listener) => listener());
  } catch {
    toast("Enregistrement impossible : sauvegarde ton journal depuis l'onglet Progrès.", 'error');
  }
}

// Toute saisie passe ici : horodatage automatique, journal en ajout seul.
export function record(entry) {
  log.push({ t: new Date().toISOString(), ...(state.active && { session: state.active.session }), ...entry });
  save();
}
