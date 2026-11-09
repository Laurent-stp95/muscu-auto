// --- Écran projeté ---
// La séance s'affiche en grand sur une TV ou un ordinateur (page tv/), l'iPhone sert de télécommande.
// Relais WebSocket par le serveur (push/worker.js, objet Screen) : l'iPhone envoie un instantané à chaque changement,
// l'écran ne fait qu'afficher et tient seul le chrono du repos (il sonne et annonce même si l'iPhone se verrouille).

import { PUSH, ICE, gathered } from './common.js';
import { warmup, CUES } from './plan.js';
import { DAYS } from './labels.js';
import { byId } from './constants.js';
import { toast, chip, h, choose, button } from './ui.js';
import { state, onSave, save } from './store.js';
import { ui, render } from './router.js';
import { weekFrame } from './week.js';
import { activeItems, nextItem, nextSet, activeMinutes, sessionSets, startKg, plannedReps, activeSession, sessionTitle } from './session.js';
import { warm } from './warmup.js';
import { focusTarget, barPlan, setText, kgText, clock } from './focus.js';
import { rest, restEnd, restTotal, restSay } from './rest.js';
import { speak, voiceOn } from './coach.js';
import { preview, summaryData, repsText, loadText } from './progress.js';
import { Recognition, mic, stopEar, startEar, voiceHelp, micOpen, saysCommand, hush } from './voice.js';
import { cameraKind } from './camera.js';

const TV_URL = 'laurent-stp95.github.io/muscu-auto/tv';
// Liaison avec l'écran : socket WebSocket, relancé après timer (délai doublé à chaque échec, jusqu'à 30 s) ; tvCount = écrans connectés ;
// sending = envoi déjà prévu dans ce tour de boucle ; lastSay, lastNotice = dernière annonce et dernière série validée à la voix (reprises
// dans l'instantané) ; cam = caméra de l'iPhone envoyée à l'écran { stream, pc }, camWanted = relancée au retour dans l'appli.
export const link = { socket: null, timer: null, delay: 1000, tvCount: 0, sending: false, lastSay: null, lastNotice: null, cam: null, camWanted: false };
const wsUrl = (room, role) => `${PUSH.url.replace(/^http/, 'ws')}/screen?room=${room}&role=${role}`;
const parse = (text) => { try { return JSON.parse(text); } catch { return null; } };
export const projected = () => link.tvCount > 0;

export function connectScreen() {
  clearTimeout(link.timer);
  if (link.socket && link.socket.readyState > 1) link.socket = null; // ancienne connexion en train de se fermer : on n'attend pas
  if (!state.screen?.on || link.socket || document.visibilityState !== 'visible') return;
  const ws = new WebSocket(wsUrl(state.screen.room, 'phone'));
  link.socket = ws;
  ws.onopen = () => { link.delay = 1000; send(); };
  ws.onmessage = (ev) => {
    const m = parse(ev.data);
    if (m?.type === 'presence') setTv(m.tv);
    if (m?.type === 'reps') screenReps(m);
    // Miroir allumé ou éteint sur l'écran (bouton, touche M) : l'iPhone le sait ; éteint, sa caméra s'arrête.
    if (m?.type === 'mirror') { if (!m.on && link.cam) stopCam(); ui.mirror = !!m.on; refreshStatus(); }
    if (m?.type === 'rtc' && m.sdp) link.cam?.pc?.setRemoteDescription({ type: 'answer', sdp: m.sdp }).catch(() => {}); // 2e écran : ignoré
  };
  ws.onerror = () => ws.close();
  ws.onclose = () => {
    if (link.socket !== ws) return; // ancienne connexion remplacée (nouvel appairage) : ne remet pas l'écran à zéro
    link.socket = null;
    setTv(0);
    if (state.screen?.on) link.timer = setTimeout(connectScreen, link.delay = Math.min(link.delay * 2, 30000));
  };
}

// Miroir de l'écran (webcam du Mac) : il compte les répétitions de la série affichée et les envoie ; elles remplissent le compteur.
function screenReps(m) {
  const f = focusTarget();
  if (!f || m.key !== `${f.x.e.id}|${f.n}` || !(m.n > 0)) return;
  Object.assign(f.pick, { reps: m.n, touched: true, cam: Array.isArray(m.data) ? m.data.slice(0, 100) : null });
  render();
}
// Pastille Miroir : la caméra de l'iPhone filme, l'écran affiche. Miroir allumé depuis l'écran (sa webcam) : l'éteint.
function toggleMirror() {
  if (link.cam) return stopCam();
  if (!ui.mirror) return startCam();
  ui.mirror = false;
  if (link.socket?.readyState === 1) link.socket.send(JSON.stringify({ type: 'mirror', on: false }));
  refreshStatus();
}

// Caméra de l'iPhone sur l'écran : la vidéo part en direct vers l'écran (WebRTC, d'appareil à appareil sur le Wi-Fi), le serveur
// ne relaie que l'offre et la réponse. L'écran l'affiche en miroir et compte les répétitions, comme avec sa propre webcam.
// Caméra du miroir (Réglages > Séance) : avant, ou arrière ultra grand-angle (cadre bien plus large : tu restes plus près ;
// iPhone retourné, écran vers le mur). Les noms des caméras ne sont lisibles qu'une fois l'accès autorisé.
async function mirrorStream() {
  const size = { width: { ideal: 1280 }, height: { ideal: 720 } };
  if (state.config.mirrorCam !== 'back') return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', ...size }, audio: false });
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', ...size }, audio: false });
  const wide = (await navigator.mediaDevices.enumerateDevices()).find((d) => d.kind === 'videoinput' && /ultra/i.test(d.label));
  if (!wide || stream.getVideoTracks()[0]?.getSettings().deviceId === wide.deviceId) return stream;
  stream.getTracks().forEach((track) => track.stop());
  return navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: wide.deviceId }, ...size }, audio: false });
}

async function startCam() {
  if (link.cam || link.socket?.readyState !== 1 || !window.RTCPeerConnection) return;
  link.camWanted = true;
  const me = (link.cam = { stream: null, pc: null });
  ui.mirror = true;
  refreshStatus();
  try {
    me.stream = await mirrorStream();
    if (link.cam !== me) return me.stream.getTracks().forEach((track) => track.stop());
    const pc = (me.pc = new RTCPeerConnection({ iceServers: ICE }));
    me.stream.getTracks().forEach((track) => pc.addTrack(track, me.stream));
    pc.onconnectionstatechange = () => {
      if (link.cam === me && pc.connectionState === 'failed') { stopCam(); toast("Vidéo impossible : l'iPhone et l'écran doivent être sur le même Wi-Fi.", 'warning'); }
    };
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc);
    if (link.cam === me && link.socket?.readyState === 1) link.socket.send(JSON.stringify({ type: 'rtc', sdp: pc.localDescription.sdp }));
  } catch (err) {
    if (link.cam !== me) return;
    stopCam();
    toast(err?.name === 'NotAllowedError' ? "Caméra refusée : autorise-la dans les Réglages de l'iPhone, Steady." : 'Caméra indisponible.', 'warning');
  }
}
// forget = false : arrêt subi (écran verrouillé, écran parti), la caméra repart d'elle-même.
export function stopCam(forget = true) {
  if (forget) link.camWanted = false;
  if (!link.cam) return;
  link.cam.stream?.getTracks().forEach((track) => track.stop());
  link.cam.pc?.close();
  link.cam = null;
  ui.mirror = false;
  if (link.socket?.readyState === 1) link.socket.send(JSON.stringify({ type: 'rtc', stop: true }));
  refreshStatus();
}
export function resumeCam() {
  if (link.camWanted && projected() && document.visibilityState === 'visible') startCam();
}

// Barre d'état de la séance : écran, micro, miroir, chacun allumé (pastille pleine) ou non, d'un geste.
export function statusBar(list = state.listMode) {
  const pill = (label, name, on, onclick, warn) => chip(label, on, onclick, { iconName: name, variant: warn ? 'status warn' : 'status' });
  return h('div', { className: 'status-bar' }, h('div', { className: 'chips' },
    pill(!state.screen?.on || projected() ? 'Écran' : 'Écran en attente', 'tv', projected(), projectSheet),
    Recognition && !list && pill(mic.wanted && !mic.rec ? 'Micro coupé' : 'Micro', 'mic', !!mic.rec, () => (mic.rec ? stopEar() : startEar()), mic.wanted && !mic.rec),
    projected() && !list && pill('Miroir', 'camera', ui.mirror, toggleMirror)),
    mic.rec && h('button', { type: 'button', className: `caption heard${mic.lastHeard && Date.now() - mic.lastHeard.t < 10000 && mic.lastHeard.why ? ' ignored' : ''}`, onclick: voiceHelp },
      mic.lastHeard && Date.now() - mic.lastHeard.t < 10000 ? mic.lastHeard.text : 'Micro prêt : dis « dix répétitions validées ». Toutes les phrases ›'));
}
export function refreshStatus() { document.querySelector('.status-bar')?.replaceWith(statusBar()); }

export function setTv(n) {
  if (link.tvCount === n) return;
  link.tvCount = n;
  // Couleur « connecté » portée par body : juste aussi sur les écrans gardés en mémoire.
  document.body.classList.toggle('projecting', projected());
  if (!projected()) { stopCam(false); ui.mirror = false; }
  refreshStatus();
  resumeCam();
}

function send() {
  if (link.socket?.readyState === 1) link.socket.send(JSON.stringify({ type: 'state', s: live() }));
}
// Un seul envoi par tour de boucle, même si plusieurs changements s'enchaînent.
export function broadcast() {
  if (!state.screen?.on || link.sending) return;
  link.sending = true;
  queueMicrotask(() => { link.sending = false; send(); });
}
onSave(broadcast); // chaque enregistrement est envoyé à l'écran

// Annonce vocale : lue par l'iPhone, ou par l'écran projeté s'il est connecté.
export function announce(text) {
  if (micOpen() && saysCommand(text)) return; // l'écran ne doit pas la dire non plus
  link.lastSay = { id: String(Date.now()), text, t: Date.now() };
  hush(text);
  speak(text);
  broadcast();
}

export async function projectSheet() {
  if (!state.screen) return pairSheet();
  const choice = await choose({
    title: 'Écran projeté',
    text: !state.screen.on ? 'Projection arrêtée.' : projected() ? "La séance s'affiche sur l'écran : ton iPhone sert de télécommande." : `Écran pas encore connecté : ouvre ${TV_URL} sur la TV ou l'ordinateur.`,
    actions: [state.screen.on ? { label: 'Arrêter la projection', value: 'off' } : { label: 'Projeter', value: 'on', variant: 'primary' },
      { label: "Partager le lien de l'écran", value: 'share' }, { label: 'Associer un autre écran', value: 'pair' }, { label: 'Fermer', value: null }],
  });
  if (choice === 'share') shareTvLink();
  if (choice === 'off') {
    stopCam();
    // L'écran affiche « Rien n'est projeté » ; le serveur garde cet état, une page rechargée le retrouve.
    if (link.socket?.readyState === 1) link.socket.send(JSON.stringify({ type: 'state', s: { v: 1, at: Date.now(), phase: 'stopped' } }));
    state.screen.on = false;
    save();
    link.socket?.close();
    setTv(0);
  }
  if (choice === 'on') { state.screen.on = true; save(); connectScreen(); }
  if (choice === 'pair') pairSheet();
}

async function pairSheet() {
  const input = h('input', { className: 'input pair-code', type: 'text', inputMode: 'numeric', pattern: '[0-9]*', maxLength: 4, autocomplete: 'one-time-code', placeholder: '0000', ariaLabel: "Code affiché sur l'écran" });
  const go = await choose({
    title: 'Projeter sur un écran',
    text: `Sur ta TV ou ton ordinateur, ouvre ${TV_URL} dans le navigateur, puis tape ici le code affiché.`,
    extra: h('div', { className: 'stack' }, input, button("Partager le lien de l'écran", shareTvLink, { variant: 'plain', icon: 'share' })),
    actions: [{ label: 'Connecter', value: true, variant: 'primary' }, { label: 'Annuler', value: null }],
  });
  if (go) pair(input.value.trim());
}

// Ailleurs que chez soi (salle, ami) : le lien de la page écran à envoyer ou ouvrir sur l'autre appareil. Feuille de partage iOS,
// sinon copié.
async function shareTvLink() {
  const url = `https://${TV_URL}/`;
  try {
    if (navigator.share) return await navigator.share({ title: 'Steady · Écran', text: 'Ouvre ce lien sur la TV ou l\'ordinateur pour afficher ta séance.', url });
  } catch (err) {
    if (err.name === 'AbortError') return; // partage annulé
  }
  try { await navigator.clipboard.writeText(url); toast('Lien copié', 'success'); } catch { toast(`Copie impossible : ouvre ${TV_URL} sur l'écran.`, 'warning'); }
}

// Appairage : l'écran attend dans une salle temporaire « pair-code » ; l'iPhone lui donne la salle permanente, gardée des deux côtés.
async function pair(code) {
  if (!/^\d{4}$/.test(code)) return toast('Le code fait 4 chiffres.', 'warning');
  const room = state.screen?.room || crypto.randomUUID();
  const ok = await new Promise((resolve) => {
    const ws = new WebSocket(wsUrl(`pair-${code}`, 'phone'));
    const timer = setTimeout(() => done(false), 6000);
    function done(v) { clearTimeout(timer); ws.close(); resolve(v); }
    ws.onmessage = (ev) => {
      const m = parse(ev.data);
      if (m?.type === 'presence' && m.tv > 0) ws.send(JSON.stringify({ type: 'adopt', room }));
      if (m?.type === 'adopted') done(true);
    };
    ws.onerror = () => done(false);
  });
  if (!ok) return toast("Écran introuvable : vérifie le code affiché et que l'écran est connecté à internet.", 'warning');
  link.socket?.close();
  state.screen = { room, on: true };
  save();
  connectScreen();
  toast('Écran connecté', 'success');
}

export function forgetScreen() {
  if (link.socket?.readyState === 1) link.socket.send(JSON.stringify({ type: 'forget' }));
  state.screen = null;
  save();
  link.socket?.close();
  setTv(0);
  render();
  toast('Écran oublié', 'info');
}

// Instantané de la séance pour l'écran projeté (contrat v1, décrit dans tv/tv.js).
function live() {
  const base = { v: 1, at: Date.now(), voice: voiceOn(), upcoming: null, progress: null, ex: null, set: null, done: [], rest: null, next: null, record: null, summary: null, say: null };
  if (!state.plan) return { ...base, phase: 'idle', title: 'Steady' };
  if (!state.active) {
    if (state.ended && Date.now() - state.ended.t < 15 * 60000) return { ...base, phase: 'done', title: state.ended.title, summary: state.ended.summary };
    const { index, nextWeek } = weekFrame().focus;
    const s = state.plan[index];
    return { ...base, phase: 'idle', title: `${DAYS[s.day]} · ${s.name}`, upcoming: preview(s, nextWeek) };
  }
  const s = activeSession();
  const sid = state.active.session;
  const items = activeItems();
  // Séance libre encore vide : rien à afficher qu'une invitation (une séance sans exercice n'est pas « terminée »).
  if (!s.items.length && !state.active.paused) return { ...base, phase: 'idle', title: sessionTitle(s), upcoming: { when: 'Séance libre', items: [{ name: "Ajoute ton premier exercice depuis l'iPhone", detail: '' }], gear: [] } };
  let i = Math.min(state.listMode ? nextItem(items) : ui.at ?? nextItem(items), items.length);
  // Exercice fini (l'iPhone demande le ressenti) : l'écran montre déjà le suivant, à préparer pendant le repos.
  if (i < items.length && nextSet(items[i]) == null) {
    const k = items.findIndex((y, j) => j > i && nextSet(y) != null);
    i = k < 0 ? nextItem(items) : k;
  }
  const title = sessionTitle(s);
  const progress = { ex: Math.min(i + 1, items.length), exCount: items.length, sets: items.reduce((n, x) => n + x.done.size, 0),
    setCount: items.reduce((n, x) => n + x.it.sets, 0), minutes: activeMinutes(sid) };
  const say = link.lastSay && Date.now() - link.lastSay.t < 10000 ? { id: link.lastSay.id, text: link.lastSay.text } : null;
  base.notice = link.lastNotice && Date.now() - link.lastNotice.t < 4000 ? { id: link.lastNotice.id, text: link.lastNotice.text } : null;
  const lh = mic.lastHeard;
  base.heard = lh && lh.cmd && Date.now() - lh.t < 4000 ? { id: String(lh.t), said: lh.said, why: lh.why } : null;
  base.mic = mic.wanted ? (mic.rec ? 'on' : 'off') : null; // « off » : micro coupé sur l'iPhone, signalé sur l'écran
  if (state.active.paused) return { ...base, phase: 'paused', title, progress };
  if (warm) {
    const m = warm.list[warm.i], next = warm.list[warm.i + 1];
    return { ...base, phase: 'rest', title, say, label: `Échauffement · ${warm.i + 1} sur ${warm.list.length}`,
      ex: { id: 0, name: m.name, img: [], mus: m.mus, mus2: [], cues: [m.cue], badge: null, note: null },
      set: { n: null, of: null, target: `${m.s} s`, load: null, plates: null, change: null, last: null, approach: null },
      rest: { end: warm.end, total: warm.total, say: next ? `Mouvement suivant : ${next.name}${micOpen() ? '' : `, ${next.s} secondes`}.` : 'Échauffement fini. On attaque les séries.' },
      next: next ? { name: next.name, detail: `${next.s} s` } : null };
  }
  if (i >= items.length) return { ...base, phase: 'done', title, progress, summary: summaryData(items), say };
  const x = items[i];
  const { e, it } = x;
  const n = nextSet(x);
  const logged = sessionSets(sid);
  const picked = n && ui.pick?.key === `${sid}|${e.id}|${n}` ? ui.pick : null;
  const kg = picked ? picked.kg : startKg(x);
  const reps = picked ? picked.reps : n && plannedReps(x, kg, n);
  const bar = barPlan(e, kg);
  const last = n && x.past.at(-1)?.sets.find((t) => t.set === n);
  const approach = n === 1 ? warmup(e, kg, state.config.loads) : [];
  const pr = [...logged.values()].filter((t) => t.pr && Date.now() - Date.parse(t.t) < 15000).at(-1);
  const after = items[i + 1];
  return {
    ...base, phase: rest ? 'rest' : 'work', title, progress, say,
    ex: { id: e.id, name: e.name, img: e.img, mus: e.mus, mus2: e.mus2, cam: cameraKind(e), cues: (e.cues || [CUES[e.zone]]).slice(0, 3),
      badge: x.tip.learning ? 'Apprentissage du geste' : null, note: x.tip.note },
    set: n && { n, of: it.sets, target: repsText(e, reps), load: loadText(e, kg), plates: bar.plates || null, change: bar.change || null,
      last: last ? `La dernière fois : ${setText(e, last.kg, last.reps)}` : null,
      approach: approach.length ? `Approche : ${approach.map(([w, r]) => `${kgText(w)} × ${r}`).join(' · ')}` : null },
    done: [...x.done.values()].sort((a, b) => a.set - b.set).map((t) => ({ n: t.set, text: setText(e, t.kg, t.reps), t: clock(t.t), record: !!logged.get(`${e.id}-${t.set}`)?.pr })),
    rest: rest ? { end: restEnd, total: restTotal, say: restSay() } : null,
    next: after ? { name: after.e.name, img: after.e.img, detail: `${after.it.sets} × ${after.it.reps}${after.e.unit === 's' ? ' s' : ''} · ${loadText(after.e, startKg(after))}` } : null,
    record: pr ? { id: pr.t, text: `Record : ${setText(byId.get(pr.ex), pr.kg, pr.reps)}` } : null,
  };
}
