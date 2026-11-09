// --- Caméra qui compte (prototype) ---
// L'iPhone posé de côté suit ton corps (MediaPipe, calcul sur l'appareil, aucune image envoyée), compte les répétitions
// et vérifie l'amplitude et la vitesse de descente : genou pour les squats et fentes, coude pour les développés.
// Modèle, constantes et compteur partagés avec l'écran projeté : shared.js.
// Mouvements où le coude ou le genou se plie peu, ou où l'on avance : pas de comptage (fentes marchées, écarté, élévations
// latérales, oiseau, haussements d'épaules).

import { poseModel, poseTracker, BONES } from './common.js';
import { plural } from './labels.js';
import { h, button, icon } from './ui.js';
import { validateSet } from './focus.js';
import { tick, initAudio, rest } from './rest.js';
import { voiceOn, speak } from './coach.js';
import { technique } from './progress.js';
import { micOpen } from './voice.js';

const NO_COUNT = new Set([206, 238, 348, 828, 571, 572]);
export const cameraKind = (e) => (NO_COUNT.has(e.id) ? null : e.zone === 'quad' ? 'knee' : ['chest', 'shoulders'].includes(e.zone) ? 'elbow' : null);

// Consigne écrite seulement : la voix ne dit que le numéro (repCounted).
function repFeedback(kind, ev) {
  if (!ev.full) return kind === 'knee' ? "Amplitude incomplète : descends jusqu'aux cuisses parallèles." : 'Amplitude incomplète : descends plus bas.';
  if (ev.down < 1000) return 'Descente trop rapide : contrôle-la sur 2 à 3 secondes.';
  return `Répétition ${ev.rep} : bonne amplitude, descente contrôlée.`;
}
// Le numéro à voix haute ; micro ouvert : un bip court à la place (un nombre dit serait pris pour ta réponse). Coach vocal coupé : rien.
function repCounted(n) {
  if (micOpen()) { if (voiceOn()) tick(1320); } else speak(String(n), true);
}

export async function cameraCoach(f) {
  if (!f) return;
  const kind = cameraKind(f.x.e);
  const video = h('video', { playsInline: true, muted: true, autoplay: true, className: 'cam-video' });
  const canvas = h('canvas', { className: 'cam-canvas' });
  const count = h('strong', { className: 'cam-count' }, '0');
  const hint = h('p', { className: 'cam-hint' }, 'Préparation de la caméra…');
  const ok = button('Valider', () => close(true), { variant: 'primary', size: 'large', disabled: true });
  const quit = button('Fermer', () => close(false), { variant: 'gray', size: 'large' });
  const dialog = h('dialog', { className: 'sheet camera' }, h('div', { className: 'sheet-body' },
    h('div', { className: 'cam-view' }, video, canvas, count),
    h('div', { className: 'cam-panel' }, hint,
      h('p', { className: 'caption' }, kind === 'knee' ? "iPhone debout, de côté, à 2 ou 3 m : de la tête aux pieds dans l'image." : "iPhone de côté : épaules, bras et mains dans l'image."),
      ok, quit)));
  let stream = null, closed = false, reps = 0;
  const data = []; // { depth, down, full } par répétition, gardé avec la série (suivi de la technique)
  function close(keep) {
    closed = true;
    stream?.getTracks().forEach((track) => track.stop());
    dialog.close();
    dialog.remove();
    if (keep && reps) { f.pick.reps = reps; f.pick.touched = true; f.pick.cam = data; validateSet(f); }
  }
  dialog.addEventListener('cancel', (ev) => { ev.preventDefault(); close(false); });
  document.body.append(dialog);
  dialog.showModal();
  initAudio();
  let model;
  try {
    [stream, model] = await Promise.all([navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', aspectRatio: { ideal: 3 / 4 }, height: { ideal: 1280 } }, audio: false }), poseModel()]);
  } catch (err) {
    // Pas d'écran noir : un panneau qui dit quoi faire, et la saisie à la main comme sortie.
    dialog.classList.add('failed');
    hint.before(icon('camera', 'cam-off'));
    hint.textContent = err?.name === 'NotAllowedError' ? "Caméra refusée : autorise-la dans les Réglages de l'iPhone, Steady." : 'Caméra ou suivi du corps indisponible (connexion nécessaire la première fois).';
    ok.hidden = true;
    quit.lastChild.textContent = 'Saisir à la main';
    return;
  }
  if (closed) return stream.getTracks().forEach((track) => track.stop());
  video.srcObject = stream;
  await video.play().catch(() => {});
  // Image en paysage : rognée seulement si l'iPhone est tenu en portrait (.cam-view.wide, styles/app.css). Recalculé quand l'iPhone tourne.
  const fit = () => video.parentElement.classList.toggle('wide', video.videoWidth > video.videoHeight);
  fit();
  video.addEventListener('resize', fit);
  const tracker = poseTracker(kind, f.x.e.id); // bonne personne, entière, sur place, même côté : voir shared.js
  const ctx = canvas.getContext('2d');
  const before = technique(f.x.e).at(-1);
  let off = 0, said = `Vas-y : je compte.${before ? ` La dernière fois : ${before.depth}° au point bas, descente ${(before.down / 1000).toFixed(1).replace('.', ',')} s.` : ''}`;
  const tell = (text, warn = false) => { hint.textContent = text; hint.classList.toggle('warn', warn); };
  const HOLD = { none: 'Je ne te vois pas : place-toi face à l\'iPhone.', moving: 'Reste sur place pour que je compte.',
    switch: 'Quelqu\'un passe : comptage suspendu.', paused: 'Repos en cours : je compte à la série suivante.',
    hands: 'Mains sur la barre ou la charge pour que je compte.',
    partial: kind === 'knee' ? 'Recule un peu : la tête et les pieds doivent être dans l\'image.' : 'Recule un peu : épaules et mains doivent être dans l\'image.' };
  const frame = () => {
    if (closed) return;
    if (video.readyState >= 2 && video.videoWidth) {
      const w = (canvas.width = video.videoWidth), hh = (canvas.height = video.videoHeight), now = performance.now();
      const r = tracker.update(model.detectForVideo(video, now).landmarks, now, !!rest, w / hh);
      // Comptage suspendu depuis plus de 0,8 s : on dit pourquoi.
      off = r.state === 'ok' ? 0 : off || now;
      if (off && now - off > 800) tell(HOLD[r.state], r.state !== 'paused');
      else if (!off) tell(said);
      if (r.pose) {
        const at = (k) => ({ x: r.pose[k].x * w, y: r.pose[k].y * hh });
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#c8441d';
        for (const [a, b] of BONES) { ctx.beginPath(); ctx.moveTo(at(a).x, at(a).y); ctx.lineTo(at(b).x, at(b).y); ctx.stroke(); }
        ctx.fillStyle = '#fff';
        r.side?.forEach((k) => { const q = at(k); ctx.beginPath(); ctx.arc(q.x, q.y, 7, 0, 2 * Math.PI); ctx.fill(); });
      }
      const ev = r.ev;
      if (ev?.partial) tell('Pas assez bas : répétition non comptée.', true);
      else if (ev) {
        reps = ev.rep;
        data.push({ depth: ev.depth, down: ev.down, full: ev.full });
        count.textContent = String(reps);
        ok.disabled = false;
        ok.lastChild.textContent = `Valider ${plural(reps, 'répétition')}`;
        said = repFeedback(kind, ev);
        tell(said);
        repCounted(reps);
      }
    }
    requestAnimationFrame(frame);
  };
  frame();
}
