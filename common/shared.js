// Code commun à l'appli (index.html) et à l'écran projeté (tv/index.html) : son, voix, caméra qui compte, WebRTC.
// Script classique, pas un module ES : la page TV le charge tel quel ; l'appli l'importe par src/common.js.
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

// Voix françaises de l'appareil, la plus naturelle d'abord : Premium puis Améliorée (iOS, macOS, à télécharger dans les réglages),
// voix neuronales (Edge : « Natural », « Online »), Google, puis les voix Apple de base. Les voix gadget (Jacques, Eddy…) en dernier.
// À qualité égale, le français de France passe avant celui du Canada ou de Belgique.
const VOICES = ['Amélie', 'Thomas', 'Audrey', 'Aurélie', 'Marie', 'Daniel'];
function voiceRank(v) {
  const id = (v.name + ' ' + v.voiceURI).toLowerCase();
  const tier = /premium/.test(id) ? 5 : /enhanced|amélioré/.test(id) ? 4 : /natural|neural|online/.test(id) ? 3 : /google/.test(id) ? 2
    : VOICES.some((n) => v.name.indexOf(n) === 0) ? 1 : 0;
  return tier * 2 + (/fr.FR/i.test(v.lang) ? 1 : 0);
}
const frenchVoices = (synth) => synth.getVoices().filter((v) => /^fr/i.test(v.lang)).sort((a, b) => voiceRank(b) - voiceRank(a));
// name : voix choisie dans les Réglages, si l'appareil l'a ; sinon la meilleure.
function frenchVoice(synth, name) {
  const fr = frenchVoices(synth);
  return (name && fr.find((v) => v.name === name)) || fr[0] || null;
}

const FRONT = new Set([1, 2, 3, 4, 6, 10, 13, 14]); // muscles visibles de face (wger is_front)

// --- Caméra qui compte : suivi du corps par MediaPipe, calcul sur l'appareil, aucune image envoyée ---
// Bibliothèque et modèle (environ 19 Mo) téléchargés à la première utilisation, puis gardés par le navigateur.
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1';
const POSE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const JOINTS = { knee: [[23, 25, 27], [24, 26, 28]], elbow: [[11, 13, 15], [12, 14, 16]] }; // hanche-genou-cheville, épaule-coude-poignet (gauche, droite)
// Seuils d'angle (degrés, 180 = tendu) : top = de retour en haut (sans exiger le verrouillage), start = la descente commence,
// count = assez bas pour compter, deep = amplitude complète ; minMs = durée minimale (un geste plus vif est un bruit du suivi).
// Tolérants exprès : une répétition imparfaite compte (signalée à l'écran, gardée avec full: false) pour progresser quand même ;
// seul un geste à peine esquissé (entre start et count) n'est pas compté.
const COUNTER = { knee: { top: 155, start: 140, count: 130, deep: 100, minMs: 500 }, elbow: { top: 150, start: 135, count: 125, deep: 90, minMs: 400 } };
// Par exercice, quand le mouvement lui-même plie moins ou plus : fentes, développé au sol (coudes arrêtés par le sol),
// pompes piquées ; goblet squat et pompes descendent plus bas.
const COUNTER_EX = {
  203: { deep: 95 }, 1593: { count: 135, deep: 105 }, 1651: { count: 135, deep: 105 },
  1084: { count: 130, deep: 105 }, 1551: { deep: 95 }, 1112: { deep: 95 }, 454: { count: 130, deep: 100 },
};
const counterFor = (kind, exId) => Object.assign({}, COUNTER[kind], COUNTER_EX[exId]);
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
// ne compte pas), changement d'état après 3 mesures d'affilée seulement, départ d'une position haute tenue 0,15 s,
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
        if (topSince == null || topLast - topSince < 150) { topSince = null; return null; } // pas parti d'en haut : ignoré
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
// exId : l'exercice (règle des mains hautes). Renvoie { pose, side, state, ev } : side = les 3 points de l'angle suivi ;
// state = 'ok', 'none' (personne), 'partial' (corps pas entier dans l'image), 'moving' (se déplace, s'approche ou recule),
// 'hands' (mains pas sur la barre), 'switch' (autre personne, ou suivi qui saute) ou 'paused' ; ev = événement du compteur.
// Barre ou charge tenue haut (squats et fente à la Smith, goblet squat) : mains au-dessus du milieu du buste pendant la série.
// S'accroupir pour toucher l'iPhone, mains en avant ou en bas, ne compte donc pas.
const HANDS_HIGH = new Set([1747, 257, 1593, 203]);
function poseTracker(kind, exId) {
  const counter = repCounter(counterFor(kind, exId));
  const whole = kind === 'knee' ? [0, 27, 28] : [11, 12, 15, 16]; // tête et chevilles, ou épaules et poignets
  const vis = (q) => (q.visibility == null ? 1 : q.visibility);
  // Vraiment dans l'image : le modèle devine aussi les points hors cadre (pieds coupés quand tu es près), parfois sûr de lui.
  const seen = (q) => vis(q) > 0.5 && q.x > 0.01 && q.x < 0.99 && q.y > 0.01 && q.y < 0.99;
  const mid = (p, a, b) => ({ x: (p[a].x + p[b].x) / 2, y: (p[a].y + p[b].y) / 2 });
  const med = (list) => list.slice().sort((x, y) => x - y)[list.length >> 1];
  let prev = null, side = null, past = [], badSince = null, jumpSince = null;
  return {
    update(poses, t, paused, aspect) {
      const out = (state, pose, ev) => ({ pose: pose || null, side: null, state: state, ev: ev || null });
      // Un blocage bref (point du suivi qui saute, image floue) suspend le comptage sans perdre la répétition en cours ;
      // il ne l'abandonne qu'au-delà de 0,5 s.
      const hold = (state, pose) => {
        if (badSince == null) badSince = t;
        if (t - badSince > 500) counter.reset();
        return out(state, pose);
      };
      if (!poses || !poses.length) { prev = null; past = []; return hold('none'); }
      // La personne suivie : la plus proche de celle d'avant ; au départ, la plus grande à l'image (la plus près de la caméra).
      // Taille = longueur du buste ou largeur des épaules, la plus grande : stable de profil comme de face, penché ou pas.
      const found = poses.map((p) => {
        const hip = mid(p, 23, 24), sh = mid(p, 11, 12);
        return { p: p, x: hip.x, y: hip.y, size: Math.max(Math.hypot(sh.x - hip.x, sh.y - hip.y), Math.hypot(p[11].x - p[12].x, p[11].y - p[12].y)) };
      });
      const gap = (c) => Math.hypot(c.x - prev.x, c.y - prev.y);
      const me = prev ? found.sort((a, b) => gap(a) - gap(b))[0] : found.sort((a, b) => b.size - a.size)[0];
      const p = me.p;
      // Saut brusque (autre personne devant toi, ou suivi qui décroche) : comptage suspendu ; au-delà de 0,3 s la répétition
      // en cours est abandonnée, au-delà de 0,5 s on suit la nouvelle position (tu t'es replacé). Une image ratée ne coûte rien.
      if (prev && (gap(me) > 0.12 || Math.abs(me.size / prev.size - 1) > 0.4)) {
        if (jumpSince == null) jumpSince = t;
        if (t - jumpSince > 300) counter.reset();
        if (t - jumpSince > 500) { prev = me; jumpSince = null; past = []; side = null; }
        return out('switch', p);
      }
      jumpSince = null;
      prev = me;
      // Sur place et à distance constante, d'après la tendance et non le bruit du suivi : médiane des 0,3 dernières secondes
      // contre médiane d'il y a 1 s. Tu marches : les deux pieds se décalent de plus de 12 % de l'image (une fente n'en
      // déplace qu'un ; pieds cachés, le bassin). Tu t'approches ou recules : ta taille à l'image change de plus de 40 %.
      const feet = vis(p[27]) > 0.5 && vis(p[28]) > 0.5 ? [p[27].x, p[28].x] : [me.x, me.x];
      past = past.filter((s) => t - s.t < 1300).concat([{ t: t, a: feet[0], b: feet[1], size: me.size }]);
      const recent = past.filter((s) => t - s.t < 300), before = past.filter((s) => t - s.t >= 1000);
      const shift = (k) => Math.abs(med(recent.map((s) => s[k])) - med(before.map((s) => s[k])));
      const grown = before.length ? med(recent.map((s) => s.size)) / med(before.map((s) => s.size)) : 1;
      if (!whole.every((k) => seen(p[k]))) return hold('partial', p);
      if (before.length && (Math.min(shift('a'), shift('b')) > 0.12 || grown > 1.4 || grown < 1 / 1.4)) return hold('moving', p);
      if (HANDS_HIGH.has(exId)) {
        const wrists = [p[15], p[16]].filter((q) => vis(q) > 0.3).map((q) => q.y); // poignets cachés (derrière la barre) : pas de règle
        if (wrists.length && Math.min.apply(null, wrists) > mid(p, 11, 12).y + me.size / 2) return hold('hands', p);
      }
      if (paused) { counter.reset(); return out('paused', p); }
      const sideVis = (s) => Math.min.apply(null, JOINTS[kind][s].map((k) => vis(p[k])));
      const next = side != null && sideVis(side) > 0.5 ? side : sideVis(0) >= sideVis(1) ? 0 : 1;
      if (sideVis(next) <= 0.5) return hold('partial', p);
      badSince = null;
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

// Les déclarations ci-dessus sont des globales pour la page TV (script classique). Les modules ES de l'appli et les tests Node
// ne les voient pas : ils passent par cet objet (voir src/common.js).
(typeof self !== 'undefined' ? self : globalThis).Shared = {
  beep, frenchVoices, frenchVoice, FRONT, JOINTS, COUNTER, COUNTER_EX, counterFor, BONES, poseModel, jointAngle, repCounter,
  HANDS_HIGH, poseTracker, ICE, gathered,
};
