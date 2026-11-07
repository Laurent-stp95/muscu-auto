// Code commun à l'appli (index.html) et à l'écran projeté (tv/index.html) : son, voix, caméra qui compte, WebRTC.
// Lu par les navigateurs de TV (Chromium 68+) : ES2018 au plus (pas de ?., ??, ||=, flat/flatMap, Object.fromEntries,
// replaceChildren, catch sans variable).

// Triple bip de fin de repos. audio : AudioContext créé au premier geste (sans lui, pas de son).
function beep(audio) {
  if (!audio) return;
  [0, 0.25, 0.5].forEach((at) => {
    const osc = audio.createOscillator(), gain = audio.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, audio.currentTime + at);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + at + 0.2);
    osc.connect(gain).connect(audio.destination);
    osc.start(audio.currentTime + at);
    osc.stop(audio.currentTime + at + 0.2);
  });
}

// Voix française de l'appareil : Amélie, Thomas, Audrey, Aurélie, sinon toute voix française.
const VOICES = ['Amélie', 'Thomas', 'Audrey', 'Aurélie'];
function frenchVoice(synth) {
  const fr = synth.getVoices().filter((v) => /^fr/i.test(v.lang));
  return VOICES.map((name) => fr.find((v) => v.name.startsWith(name))).find(Boolean) || fr.find((v) => /fr.FR/i.test(v.lang)) || fr[0] || null;
}

const FRONT = new Set([1, 2, 3, 4, 6, 10, 13, 14]); // muscles visibles de face (wger is_front)

// --- Caméra qui compte : suivi du corps par MediaPipe, calcul sur l'appareil, aucune image envoyée ---
// Bibliothèque et modèle (environ 19 Mo) téléchargés à la première utilisation, puis gardés par le navigateur.
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1';
const POSE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const JOINTS = { knee: [[23, 25, 27], [24, 26, 28]], elbow: [[11, 13, 15], [12, 14, 16]] }; // hanche-genou-cheville, épaule-coude-poignet (gauche, droite)
// Seuils d'angle (degrés) : haut = bras ou jambe tendus, start = la descente commence, count = assez bas pour compter,
// deep = amplitude complète ; minMs = durée minimale d'une répétition (un geste plus vif est un bruit, pas une répétition).
const COUNTER = { knee: { top: 160, start: 145, count: 120, deep: 100, minMs: 800 }, elbow: { top: 155, start: 135, count: 110, deep: 90, minMs: 600 } };
const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
let landmarker = null; // promesse du modèle, gardée ; remise à null en cas d'échec (nouvel essai au prochain appel)

function poseModel() {
  if (!landmarker) {
    landmarker = import(MP + '/vision_bundle.mjs').then((mp) => mp.FilesetResolver.forVisionTasks(MP + '/wasm')
      .then((files) => mp.PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'GPU' }, runningMode: 'VIDEO', numPoses: 2 }))); // 2 : repérer quelqu'un qui passe
    landmarker.catch(() => { landmarker = null; });
  }
  return landmarker;
}

// Angle (degrés, 0 à 180) au point b entre les segments b→a et b→c : genou (hanche, genou, cheville) ou coude (épaule, coude, poignet).
function jointAngle(a, b, c) {
  const deg = Math.abs(Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x)) * 180 / Math.PI;
  return deg > 180 ? 360 - deg : deg;
}

// Compteur de répétitions à partir de l'angle d'une articulation suivie par la caméra.
// Une répétition = en haut (angle ≥ top) → descente (angle < start) → remontée en haut. push(angle, ms) renvoie, à chaque remontée,
// { rep, depth (angle le plus fermé), down (durée de la descente en ms), full (depth ≤ deep : amplitude atteinte) }, sinon null.
// Compteur de répétitions. Contre les faux comptes : angle filtré (médiane des 5 dernières mesures, un point qui saute
// ne compte pas), changement d'état après 3 mesures d'affilée seulement, départ d'une position haute tenue 0,25 s,
// descente au moins jusqu'à count et durée plausible (minMs à 8 s). push renvoie une répétition comptée
// { rep, depth, down, full }, { partial, depth } pour un mouvement trop peu profond (rien n'est compté), ou null.
// reset() abandonne la répétition en cours (personne qui bouge, sort de l'image, autre côté suivi).
function repCounter({ top, start, count: low = start, deep, minMs = 0, maxMs = 8000 }) {
  let last = [], streak = 0, down = false, topSince = null, topLast = 0, min = 180, bottomAt = 0, reps = 0;
  const median = () => last.slice().sort((a, b) => a - b)[last.length >> 1];
  return {
    push(raw, t) {
      last = last.concat([raw]).slice(-5);
      const angle = median();
      if (!down) {
        if (angle >= top) { if (topSince == null) topSince = t; topLast = t; streak = 0; return null; }
        streak = angle < start ? streak + 1 : 0;
        if (streak < 3) return null;
        streak = 0;
        if (topSince == null || topLast - topSince < 250) { topSince = null; return null; } // pas parti d'en haut : ignoré
        down = true;
        min = angle;
        bottomAt = t;
        return null;
      }
      if (angle < min) { min = angle; bottomAt = t; }
      if (t - topLast > maxMs) { this.reset(); return null; }
      streak = angle >= top ? streak + 1 : 0;
      if (streak < 3) return null;
      const duration = t - topLast, depth = Math.round(min), descent = bottomAt - topLast;
      down = false;
      streak = 0;
      topSince = topLast = t;
      if (duration < minMs) return null;
      if (min > low) return { partial: true, depth: depth };
      return { rep: ++reps, depth: depth, down: descent, full: min <= deep };
    },
    reset() { last = []; streak = 0; down = false; topSince = null; },
  };
}

// Suivi d'une série devant la caméra, pour l'iPhone comme pour l'écran : choisit la bonne personne, vérifie qu'elle est
// entière dans l'image et sur place, garde le même côté (gauche ou droite) et compte.
// update(poses, t, paused, aspect) : poses = corps détectés (points MediaPipe en 0-1), aspect = largeur / hauteur de l'image.
// Renvoie { pose, side, state, ev } : side = les 3 points de l'angle suivi ; state = 'ok', 'none' (personne), 'partial'
// (corps pas entier), 'moving' (se déplace), 'switch' (autre personne, ou suivi qui saute) ou 'paused' ; ev = événement du compteur.
function poseTracker(kind) {
  const counter = repCounter(COUNTER[kind]);
  const whole = kind === 'knee' ? [0, 27, 28] : [11, 12, 15, 16]; // tête et chevilles, ou épaules et poignets
  const vis = (q) => (q.visibility == null ? 1 : q.visibility);
  const mid = (p, a, b) => ({ x: (p[a].x + p[b].x) / 2, y: (p[a].y + p[b].y) / 2 });
  let prev = null, side = null, feet = [];
  return {
    update(poses, t, paused, aspect) {
      const stop = (state, pose) => { counter.reset(); return { pose: pose || null, side: null, state: state, ev: null }; };
      if (!poses || !poses.length) { prev = null; feet = []; return stop('none'); }
      // La personne suivie : la plus proche de celle d'avant ; au départ, la plus grande à l'image (la plus près de la caméra).
      const found = poses.map((p) => {
        const hip = mid(p, 23, 24), sh = mid(p, 11, 12);
        return { p: p, x: hip.x, y: hip.y, size: Math.hypot(sh.x - hip.x, sh.y - hip.y) };
      });
      const gap = (c) => Math.hypot(c.x - prev.x, c.y - prev.y);
      const me = prev ? found.sort((a, b) => gap(a) - gap(b))[0] : found.sort((a, b) => b.size - a.size)[0];
      const jumped = prev && (gap(me) > 0.12 || Math.abs(me.size / prev.size - 1) > 0.3);
      prev = me;
      const p = me.p;
      if (jumped) { feet = []; side = null; return stop('switch', p); }
      // Sur place : on marche si les deux pieds bougent de plus de 12 % de l'image en 1 s (une fente n'en bouge qu'un) ;
      // pieds hors de l'image (développé allongé) : le bassin.
      const anchor = vis(p[27]) > 0.5 && vis(p[28]) > 0.5 ? [p[27].x, p[28].x] : [me.x, me.x];
      feet = feet.filter((f) => t - f.t < 1000).concat([{ t: t, a: anchor[0], b: anchor[1] }]);
      const range = (k) => Math.max.apply(null, feet.map((f) => f[k])) - Math.min.apply(null, feet.map((f) => f[k]));
      if (!whole.every((k) => vis(p[k]) > 0.5)) return stop('partial', p);
      if (Math.min(range('a'), range('b')) > 0.12) return stop('moving', p);
      if (paused) return stop('paused', p);
      const sideVis = (s) => Math.min.apply(null, JOINTS[kind][s].map((k) => vis(p[k])));
      const next = side != null && sideVis(side) > 0.5 ? side : sideVis(0) >= sideVis(1) ? 0 : 1;
      if (sideVis(next) <= 0.5) return stop('partial', p);
      if (next !== side) { counter.reset(); side = next; }
      const j = JOINTS[kind][side].map((k) => ({ x: p[k].x * (aspect || 1), y: p[k].y }));
      return { pose: p, side: JOINTS[kind][side], state: 'ok', ev: counter.push(jointAngle(j[0], j[1], j[2]), t) };
    },
  };
}

// --- Caméra de l'iPhone vers l'écran (WebRTC, d'appareil à appareil sur le Wi-Fi) ---
const ICE = [{ urls: 'stun:stun.cloudflare.com:3478' }]; // STUN de Cloudflare : adresse publique, si le Wi-Fi isole les appareils
// Candidats réseau dans l'offre ou la réponse (pas d'envoi au fil de l'eau) : 2 s au plus, le réseau local arrive tout de suite.
function gathered(pc) {
  return new Promise((done) => {
    const timer = setTimeout(done, 2000);
    const check = () => { if (pc.iceGatheringState === 'complete') { clearTimeout(timer); done(); } };
    pc.addEventListener('icegatheringstatechange', check);
    check();
  });
}

if (typeof module !== 'undefined') {
  module.exports = { jointAngle, repCounter, poseTracker, COUNTER };
}
