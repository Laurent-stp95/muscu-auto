// --- Mises à jour ---
// Le service worker sert la version en cache puis revérifie : s'il trouve du neuf, il prévient et on propose de recharger.

import { FILES } from './common.js';
import { h, button, icon, toast } from './ui.js';
import { state } from './store.js';
import { app, ui, setUi, render } from './router.js';

// Nouvelle version signalée par le service worker (sw.js compare le contenu des fichiers servis à ceux du serveur).
export const update = { ready: false, busy: false };
const reloadButton = button('Recharger', () => applyUpdate(reloadButton), { variant: 'primary', size: 'compact' });
const updateBar = h('div', { className: 'update', hidden: true, role: 'status' }, h('span', {}, 'Nouvelle version disponible'), reloadButton);
export function showUpdate() {
  update.ready = true;
  // Dans les Réglages, l'état s'affiche sur la ligne de la version, à côté du bouton : pas de bandeau en haut de l'écran.
  if (ui.view === 'settings') return render();
  updateBar.hidden = false;
  placeBars();
}

// --- Réseau ---
// Hors ligne, tout marche (données sur l'iPhone, appli en cache) sauf les vidéos : bandeau tant que ça dure, message à chaque bascule.
export const offlineBar = h('div', { className: 'offline', hidden: navigator.onLine, role: 'status' }, icon('offline'),
  h('div', { className: 'stack tight' }, h('strong', {}, 'Hors ligne'), h('span', { className: 'caption' }, "Tes séances marchent et tes saisies restent sur l'iPhone. L'écran projeté, la sauvegarde et les vidéos attendent le réseau.")));

// Bandeaux d'état (hors ligne, nouvelle version) : sous l'en-tête de l'écran affiché, jamais par-dessus la barre collante.
export function placeBars() {
  updateBar.hidden = !update.ready || ui.view === 'settings'; // Réglages : l'état est sur la ligne de la version
  const bars = [offlineBar, updateBar];
  bars.forEach((b) => b.remove());
  const view = app.firstElementChild;
  const shown = bars.filter((b) => !b.hidden);
  if (!view || !shown.length) return;
  const header = view.querySelector(':scope > header');
  if (header) header.after(...shown);
  else view.prepend(...shown);
}

// Retélécharge le code sans aucun cache et range dans le cache ce qui a changé. Retourne le nombre de fichiers changés.
async function download() {
  const cache = await caches.open('muscu-auto');
  const changed = await Promise.all(['./', ...FILES.code].map(async (f) => {
    const res = await fetch(`${f}${f.includes('?') ? '&' : '?'}fresh=${Date.now()}`, { cache: 'reload' }); // fresh : le service worker laisse passer
    if (!res.ok) throw new Error(`${f} : ${res.status}`);
    const before = await cache.match(f, { ignoreSearch: true });
    const same = before && (await before.text()) === (await res.clone().text());
    if (!same) await cache.put(f, res);
    return !same;
  }));
  return changed.filter(Boolean).length;
}

// Installer la nouvelle version : tout le code d'abord (jamais d'ancien et de nouveau mélangés), puis rechargement.
async function applyUpdate(btn) {
  if (update.busy) return;
  if (!navigator.onLine) return toast('Hors ligne : reconnecte-toi pour mettre à jour.', 'offline');
  update.busy = true;
  if (btn) { btn.disabled = true; btn.textContent = 'Mise à jour…'; }
  try { await download(); } catch { /* réseau coupé en route : le rechargement reprend ce qui est en cache */ }
  reloadApp();
}

// Bouton des Réglages. Nouvelle version déjà signalée : on l'installe. Sinon on cherche : rien de neuf, on le dit sans
// recharger ; du neuf, on l'installe.
export async function checkUpdate() {
  if (update.ready) return applyUpdate();
  if (update.busy) return;
  if (!navigator.onLine) return toast('Hors ligne : reconnecte-toi pour chercher une mise à jour.', 'offline');
  if (!('caches' in window)) return reloadApp();
  update.busy = true;
  render();
  let changed = 0;
  try {
    await (await navigator.serviceWorker?.getRegistration())?.update();
    changed = await download();
  } catch {
    update.busy = false;
    render();
    return toast('Impossible de joindre le serveur. Réessaie dans un moment.', 'error');
  }
  if (changed) return reloadApp();
  update.busy = false;
  render();
  toast('Steady est à jour', 'success');
}

// Ligne de la version dans les Réglages : l'état et l'action au même endroit.
export function versionLine() {
  const date = new Date(document.lastModified).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  if (update.ready) {
    return h('div', { className: 'line update-line' },
      h('span', { className: 'stack tight' }, h('strong', {}, 'Nouvelle version disponible'), h('span', { className: 'caption' }, `Actuelle : version du ${date}`)),
      button(update.busy ? 'Mise à jour…' : 'Installer', checkUpdate, { variant: 'primary', size: 'compact', disabled: update.busy }));
  }
  return h('div', { className: 'line' },
    h('span', { className: 'meta' }, `Version du ${date}`),
    button(update.busy ? 'Vérification…' : 'Vérifier', checkUpdate, { size: 'compact', disabled: update.busy }));
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
