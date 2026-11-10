// --- Mises à jour ---
// Le service worker sert la version en cache puis revérifie : s'il trouve du neuf, il prévient et on propose de recharger.

import { FILES } from './common.js';
import { h, button, icon, toast } from './ui.js';
import { state } from './store.js';
import { app, ui, setUi } from './router.js';

const updateBar = h('div', { className: 'update', hidden: true, role: 'status' },
  h('span', {}, 'Nouvelle version disponible'), button('Recharger', reloadApp, { variant: 'primary', size: 'compact' }));
export const showUpdate = () => { updateBar.hidden = false; placeBars(); };

// --- Réseau ---
// Hors ligne, tout marche (données sur l'iPhone, appli en cache) sauf les vidéos : bandeau tant que ça dure, message à chaque bascule.
export const offlineBar = h('div', { className: 'offline', hidden: navigator.onLine, role: 'status' }, icon('offline'),
  h('div', { className: 'stack tight' }, h('strong', {}, 'Hors ligne'), h('span', { className: 'caption' }, "Tes séances marchent et tes saisies restent sur l'iPhone. L'écran projeté, la sauvegarde et les vidéos attendent le réseau.")));

// Bandeaux d'état (hors ligne, nouvelle version) : sous l'en-tête de l'écran affiché, jamais par-dessus la barre collante.
export function placeBars() {
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
export async function forceUpdate() {
  if (!navigator.onLine) return toast('Hors ligne : reconnecte-toi pour mettre à jour.', 'offline');
  toast('Mise à jour en cours…', 'info');
  try {
    await (await navigator.serviceWorker?.getRegistration())?.update();
    const cache = await caches.open('muscu-auto');
    await Promise.all(['./', ...FILES.code].map(async (f) => {
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

export function resumeAfterReload() {
  let view = null;
  try { view = sessionStorage.getItem(RELOAD_KEY); sessionStorage.removeItem(RELOAD_KEY); } catch { /* rien à reprendre */ }
  if (!view || !state.config) return false;
  if (view === 'settings') setUi({ view, step: 0, draft: structuredClone(state.config) });
  else if (view === 'progress' || (view === 'session' && state.active)) ui.view = view;
  return true;
}
