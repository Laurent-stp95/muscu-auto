// --- Caméra qui compte (prototype) ---
// L'iPhone posé de côté suit ton corps (MediaPipe, calcul sur l'appareil, aucune image envoyée), compte les répétitions
// et vérifie l'amplitude et la vitesse de descente : genou pour les squats et fentes, coude pour les développés.
// Modèle, constantes et compteur partagés avec l'écran projeté : shared.js.
const cameraKind = (e) => (e.zone === 'quad' ? 'knee' : ['chest', 'shoulders'].includes(e.zone) ? 'elbow' : null);

function repFeedback(kind, ev) {
  if (!ev.full) return { text: kind === 'knee' ? "Amplitude incomplète : descends jusqu'aux cuisses parallèles." : 'Amplitude incomplète : descends plus bas.', voice: `${ev.rep}, plus bas` };
  if (ev.down < 1000) return { text: 'Descente trop rapide : contrôle-la sur 2 à 3 secondes.', voice: `${ev.rep}, plus lent` };
  return { text: `Répétition ${ev.rep} : bonne amplitude, descente contrôlée.`, voice: String(ev.rep) };
}

async function cameraCoach(f) {
  if (!f) return;
  const kind = cameraKind(f.x.e);
  const video = h('video', { playsInline: true, muted: true, autoplay: true, className: 'cam-video' });
  const canvas = h('canvas', { className: 'cam-canvas' });
  const count = h('strong', { className: 'cam-count' }, '0');
  const hint = h('p', { className: 'cam-hint' }, 'Préparation de la caméra…');
  const ok = button('Valider', () => close(true), { variant: 'primary', size: 'large', disabled: true });
  const dialog = h('dialog', { className: 'sheet camera' }, h('div', { className: 'sheet-body' },
    h('div', { className: 'cam-view' }, video, canvas, count),
    h('div', { className: 'cam-panel' }, hint,
      h('p', { className: 'caption' }, kind === 'knee' ? "iPhone debout, de côté, à 2 ou 3 m : de la tête aux pieds dans l'image." : "iPhone de côté : épaules, bras et mains dans l'image."),
      ok, button('Fermer', () => close(false), { variant: 'gray', size: 'large' }))));
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
  audio ||= new (window.AudioContext || window.webkitAudioContext)();
  let model;
  try {
    [stream, model] = await Promise.all([navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', aspectRatio: { ideal: 3 / 4 }, height: { ideal: 1280 } }, audio: false }), poseModel()]);
  } catch (err) {
    hint.textContent = err?.name === 'NotAllowedError' ? "Caméra refusée : autorise-la dans les Réglages de l'iPhone, Steady." : 'Caméra ou suivi du corps indisponible (connexion nécessaire la première fois).';
    return;
  }
  if (closed) return stream.getTracks().forEach((track) => track.stop());
  video.srcObject = stream;
  await video.play().catch(() => {});
  // iPhone en portrait mais image livrée en paysage : on remplit la fenêtre en hauteur (bords coupés), le corps debout est au centre.
  const fit = () => video.parentElement.classList.toggle('crop', video.videoWidth > video.videoHeight && innerHeight > innerWidth);
  fit();
  video.addEventListener('resize', fit);
  const counter = repCounter(COUNTER[kind]);
  const ctx = canvas.getContext('2d');
  const whole = kind === 'knee' ? [0, 27, 28] : [11, 12, 15, 16]; // tête et chevilles, ou épaules et poignets
  const before = technique(f.x.e).at(-1);
  let hips = [];
  let smooth = null, lost = 0, said = `Vas-y : je compte.${before ? ` La dernière fois : ${before.depth}° au point bas, descente ${(before.down / 1000).toFixed(1).replace('.', ',')} s.` : ''}`;
  const tell = (text, warn = false) => { hint.textContent = text; hint.classList.toggle('warn', warn); };
  const frame = () => {
    if (closed) return;
    if (video.readyState >= 2 && video.videoWidth) {
      const w = (canvas.width = video.videoWidth), hh = (canvas.height = video.videoHeight);
      const p = model.detectForVideo(video, performance.now()).landmarks?.[0];
      // Corps pas entier dans l'image depuis plus d'une seconde : on demande de reculer.
      const visible = p && whole.every((k) => (p[k].visibility ?? 1) > 0.5);
      lost = visible ? 0 : lost || performance.now();
      if (lost && performance.now() - lost > 1000) tell(kind === 'knee' ? 'Recule un peu : la tête et les pieds doivent être dans l\'image.' : 'Recule un peu : épaules et mains doivent être dans l\'image.', true);
      else if (!lost) tell(said);
      if (p) {
        const at = (k) => ({ x: p[k].x * w, y: p[k].y * hh, v: p[k].visibility ?? 1 });
        // Sur place et corps entier seulement : s'approcher de l'iPhone en bougeant les bras ne compte pas.
        const now = performance.now(), hip = (at(23).x + at(24).x) / 2 / w;
        hips = hips.filter((q) => now - q.t < 1000).concat([{ t: now, x: hip }]);
        const still = Math.max(...hips.map((q) => q.x)) - Math.min(...hips.map((q) => q.x)) <= 0.15;
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#c8441d';
        for (const [a, b] of BONES) { ctx.beginPath(); ctx.moveTo(at(a).x, at(a).y); ctx.lineTo(at(b).x, at(b).y); ctx.stroke(); }
        // Côté le plus visible de la caméra (de profil, l'autre est caché).
        const side = JOINTS[kind].map((joint) => joint.map(at)).sort((s1, s2) => Math.min(...s2.map((q) => q.v)) - Math.min(...s1.map((q) => q.v)))[0];
        if (!still || !visible) smooth = null;
        if (still && visible && Math.min(...side.map((q) => q.v)) > 0.5) {
          ctx.fillStyle = '#fff';
          side.forEach((q) => { ctx.beginPath(); ctx.arc(q.x, q.y, 7, 0, 2 * Math.PI); ctx.fill(); });
          const angle = jointAngle(...side);
          smooth = smooth == null ? angle : smooth * 0.6 + angle * 0.4; // lissage : le suivi tremble d'une image à l'autre
          const ev = counter.push(smooth, performance.now());
          if (ev) {
            reps = ev.rep;
            data.push({ depth: ev.depth, down: ev.down, full: ev.full });
            count.textContent = String(reps);
            ok.disabled = false;
            ok.lastChild.textContent = `Valider ${plural(reps, 'répétition')}`;
            const feedback = repFeedback(kind, ev);
            said = feedback.text;
            tell(said);
            speak(micOpen() ? feedback.voice.replace(/^\d+,?\s*/, '') : feedback.voice, true); // micro ouvert : pas le numéro
          }
        }
      }
    }
    requestAnimationFrame(frame);
  };
  frame();
}
