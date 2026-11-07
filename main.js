// Démarrage : seul code exécuté au chargement, après tous les autres scripts (index.html les charge dans l'ordre).

// Retour dans l'appli après un verrouillage : on tente de relancer le micro (sinon « Micro coupé » reste affiché).
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && mic.wanted && !mic.rec && state.active) startEar(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ui.view === 'session') keepAwake(); });
// iOS coupe la connexion et la caméra quand l'écran se verrouille : on se reconnecte au retour, l'écran reçoit tout de suite l'état.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return stopCam(false);
  connectScreen();
  resumeCam();
});
addEventListener('online', connectScreen);
setInterval(() => { if (link.socket?.readyState === 1) link.socket.send('ping'); }, 30000); // le serveur répond seul, sans se réveiller
// Réseau : bandeau hors ligne tant que ça dure, message à chaque bascule (voir offlineBar).
addEventListener('offline', () => { offlineBar.hidden = false; placeBars(); toast('Hors ligne : tout reste utilisable, sauf les vidéos', 'offline'); });
addEventListener('online', () => { offlineBar.hidden = true; placeBars(); toast('De retour en ligne', 'success'); });

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
