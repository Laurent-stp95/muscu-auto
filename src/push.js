// --- Notifications ---
// Web Push (iOS 16.4+, appli installée) via push/worker.js : rappels de séance, fin du repos quand l'écran est verrouillé.

const NOTIFY = { reminders: true, time: '18:00', before: 30, rest: true, weekly: true }; // réglages par défaut des notifications

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
