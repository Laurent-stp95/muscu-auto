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
// Articulation suivie = 3 points (gauche, droite), l'angle se mesure au point du milieu : genou (hanche-genou-cheville),
// coude (épaule-coude-poignet), hanche (épaule-hanche-genou) et épaule (hanche-épaule-coude).
const JOINTS = { knee: [[23, 25, 27], [24, 26, 28]], elbow: [[11, 13, 15], [12, 14, 16]], hip: [[11, 23, 25], [12, 24, 26]], shoulder: [[23, 11, 13], [24, 12, 14]] };
// Seuils d'angle (degrés, 180 = tendu) : top = de retour en haut (sans exiger le verrouillage), start = la descente commence,
// count = assez bas pour compter, deep = amplitude complète ; minMs = durée minimale (un geste plus vif est un bruit du suivi).
// Tolérants exprès : une répétition imparfaite compte (signalée à l'écran, gardée avec full: false) pour progresser quand même ;
// seul un geste à peine esquissé (entre start et count) n'est pas compté.
// fast = phase excentrique (la descente de la charge) jugée trop rapide en dessous de cette durée, en ms (tempoCoach) ; 0 = pas de retour.
// La durée mesurée ne couvre pas les premiers degrés (elle part de la sortie de la position haute, ou s'arrête au retour sous
// top) : environ les trois quarts du geste. Seuils prudents : 1 000 ms mesurés au squat ≈ 1,3 s de descente réelle, 800 ms à la
// hanche ≈ 1 s, 600 ms à l'épaule ≈ 0,8 s. En dessous, la charge tombe plus qu'elle n'est retenue.
// Hanche (soulevés de terre, swing) : debout ≈ 175°, buste penché à 45° ≈ 135°, presque à l'horizontale ≈ 100°. L'amplitude
// « complète » reste modeste (120°) : sur ces mouvements on ne pousse pas à descendre plus bas que le dos ne le permet.
// Épaule (élévations latérales, de face) : c'est l'inverse, l'angle AUGMENTE. dir: 'up' : top = position de départ, bras le long
// du corps (≤ 35°), start = le bras décolle (> 45°), count = assez haut pour compter (≥ 60°), deep = bras à l'horizontale
// (≥ 80°, 90° en théorie). both : les deux bras doivent monter (se gratter la tête d'une main ne compte pas).
const COUNTER = {
  knee: { top: 155, start: 140, count: 130, deep: 100, minMs: 500, fast: 1000 },
  elbow: { top: 150, start: 135, count: 125, deep: 90, minMs: 400, fast: 1000 },
  hip: { top: 155, start: 145, count: 135, deep: 120, minMs: 500, fast: 800 },
  shoulder: { dir: 'up', both: true, top: 35, start: 45, count: 60, deep: 80, minMs: 400, fast: 600 },
};
// Par exercice, quand le mouvement lui-même plie moins ou plus : fentes, développé au sol (coudes arrêtés par le sol),
// pompes piquées ; goblet squat et pompes descendent plus bas. Kettlebell swing : geste lancé, vif par nature, aucun retour sur le tempo.
const COUNTER_EX = {
  203: { deep: 95 }, 1593: { count: 135, deep: 105 }, 1651: { count: 135, deep: 105 },
  1084: { count: 130, deep: 105 }, 1551: { deep: 95 }, 1112: { deep: 95 }, 454: { count: 130, deep: 100 },
  960: { minMs: 400, fast: 0 },
};
const counterFor = (kind, exId) => Object.assign({}, COUNTER[kind], COUNTER_EX[exId]);
// Articulation suivie pour chaque exercice (identifiants de data.js), décidée un par un. Absent = pas de comptage : le suivi
// n'y serait pas fiable (CAM_OFF dit pourquoi).
const CAM_EX = {
  knee: [1747, 257, 1593, 203, 1651], // squats, fentes sur place
  elbow: [73, 925, 75, 537, 1084, 1353, 1551, 1112, 916, 567, 454], // développés (couchés, inclinés, au sol, épaules), pompes
  hip: [507, 1652, 1612, 960], // soulevés de terre roumains (Smith, haltères) et sumo, kettlebell swing : de profil
  shoulder: [348], // élévations latérales : de face
};
const CAM_OFF = {
  206: 'fentes marchées : on avance', 238: 'écarté : le coude plie peu', 828: 'oiseau, buste couché sur le banc : épaule masquée',
  571: 'haussements : aucun angle ne change', 572: 'haussements : aucun angle ne change',
  1642: 'hip thrust : allongé, hanche cachée par la barre et les disques', 265: 'pont fessier : allongé au sol, suivi douteux',
  1736: "soulevé de terre sur une jambe : la jambe suivie peut être celle qui reste alignée avec le buste",
  83: 'rowing', 1198: 'rowing', 1283: 'rowing', 81: 'rowing', 1732: 'face pull', 158: 'tirage : bras au-dessus de la tête',
  92: 'curl', 272: 'curl', 1448: 'curl', 76: 'triceps', 1336: 'triceps', 1086: 'triceps',
  622: 'mollets : amplitude trop faible', 1620: 'mollets : amplitude trop faible', 1243: 'mollets : amplitude trop faible',
  458: 'gainage', 1572: 'au sol', 297: 'gainage', 167: 'au sol', 1648: 'au sol', 978: 'suspendu', 1194: 'anti-rotation : rien ne bouge', 1091: 'gainage',
};
// 'knee' | 'elbow' | 'hip' | 'shoulder' | null.
function camKind(exId) {
  return Object.keys(CAM_EX).filter((kind) => CAM_EX[kind].indexOf(exId) >= 0)[0] || null;
}
// Textes propres à chaque articulation, communs à l'iPhone et à l'écran : place = où se mettre, need = ce qui doit être dans
// l'image, low = geste trop court (pas compté), short = amplitude incomplète (compté), fast = phase excentrique trop rapide,
// point = où se mesure l'angle gardé avec la série (point bas ; point haut pour une élévation).
const CAM_TEXT = {
  knee: { place: 'de profil', need: 'la tête et les pieds', low: 'Pas assez bas : répétition non comptée.', short: "Amplitude incomplète : descends jusqu'aux cuisses parallèles.", fast: 'Descente trop rapide : freine-la.', point: 'au point bas' },
  elbow: { place: 'de profil', need: 'épaules et mains', low: 'Pas assez bas : répétition non comptée.', short: 'Amplitude incomplète : descends plus bas.', fast: 'Descente trop rapide : freine-la.', point: 'au point bas' },
  hip: { place: 'de profil', need: 'la tête et les genoux', low: 'Pas assez penché : répétition non comptée.', short: 'Amplitude courte : penche-toi tant que le dos reste droit.', fast: 'Descente trop rapide : freine-la.', point: 'au point bas' },
  shoulder: { place: 'de face', need: 'épaules, coudes et hanches', low: 'Pas assez haut : répétition non comptée.', short: "Amplitude incomplète : monte les bras jusqu'à l'horizontale.", fast: 'Redescente trop rapide : freine les bras.', point: 'au point haut' },
};
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

// Angle (degrés, 0 à 180) au point b entre les segments b→a et b→c : genou (hanche, genou, cheville), coude (épaule, coude, poignet)…
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
// dir: 'up' (élévations) : le geste part d'un angle fermé et l'ouvre. Même machine, sur l'angle retourné (180 − angle) : top est
// alors la position de départ (angle ≤ top), count et deep des angles à atteindre (≥), depth l'angle le plus ouvert.
// down = durée de la phase excentrique, celle où la charge descend : la descente du corps (du départ au point bas), ou, pour
// une élévation, la redescente des bras (du point haut au retour en position de départ).
function repCounter(cfg) {
  const up = cfg.dir === 'up', flip = (a) => (up ? 180 - a : a);
  const top = flip(cfg.top), start = flip(cfg.start), low = flip(cfg.count == null ? cfg.start : cfg.count), deep = flip(cfg.deep);
  const minMs = cfg.minMs || 0, maxMs = cfg.maxMs || 8000;
  let last = [], streak = 0, down = false, topSince = null, topLast = 0, min = 180, bottomAt = 0, backAt = 0, reps = 0;
  const median = () => last.slice().sort((a, b) => a - b)[last.length >> 1];
  return {
    push(raw, t) {
      last = last.concat([flip(raw)]).slice(-5);
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
      if (angle >= top) { if (!streak) backAt = t; streak++; } else streak = 0;
      if (streak < 3) return null;
      const duration = t - topLast, depth = Math.round(flip(min)), descent = up ? backAt - bottomAt : bottomAt - topLast;
      down = false;
      streak = 0;
      topSince = topLast = t;
      if (duration < minMs) return null;
      if (min > low) return { partial: true, depth: depth };
      return { rep: ++reps, depth: depth, down: Math.round(descent), full: min <= deep };
    },
    reset() { last = []; streak = 0; down = false; topSince = null; },
  };
}

// Retour sur le tempo d'une série comptée : la phase excentrique (ev.down) trop rapide, c'est moins de travail et plus de risque.
// Discret exprès : il faut deux répétitions trop rapides d'affilée (une seule peut être une mesure approximative), et après un
// rappel les 3 répétitions suivantes passent sans rien dire. minMs = seuil (COUNTER[kind].fast, 0 = jamais).
// push(ev) (répétition comptée) renvoie null, ou { first } quand il y a lieu de le dire (first : premier rappel de la série).
function tempoCoach(minMs) {
  let fast = 0, quiet = 0, told = 0;
  return {
    push(ev) {
      if (!minMs || !ev || !ev.rep) return null;
      if (quiet > 0) quiet--;
      fast = ev.down < minMs ? fast + 1 : 0;
      if (fast < 2 || quiet > 0) return null;
      fast = 0;
      quiet = 4; // ce rappel + les 3 répétitions suivantes
      return { first: ++told === 1 };
    },
  };
}

// Suivi d'une série devant la caméra, pour l'iPhone comme pour l'écran : choisit la bonne personne, vérifie qu'elle est
// entière dans l'image et sur place, garde le même côté (gauche ou droite) et compte.
// update(poses, t, paused, aspect) : poses = corps détectés (points MediaPipe en 0-1), aspect = largeur / hauteur de l'image.
// kind : 'knee', 'elbow', 'hip' ou 'shoulder' (camKind) ; exId : l'exercice (seuils propres, règle des mains hautes). Renvoie { pose, side, state, ev } : side = les 3 points de l'angle suivi ;
// state = 'ok', 'none' (personne), 'partial' (corps pas entier dans l'image), 'moving' (se déplace, s'approche ou recule),
// 'hands' (mains pas sur la barre), 'switch' (autre personne, ou suivi qui saute) ou 'paused' ; ev = événement du compteur.
// Barre ou charge tenue haut (squats et fente à la Smith, goblet squat) : mains au-dessus du milieu du buste pendant la série.
// S'accroupir pour toucher l'iPhone, mains en avant ou en bas, ne compte donc pas.
const HANDS_HIGH = new Set([1747, 257, 1593, 203]);
function poseTracker(kind, exId) {
  const cfg = counterFor(kind, exId), counter = repCounter(cfg);
  // Cadrage : points qui doivent être dans l'image. Genou : tête et chevilles ; coude : épaules et poignets ; hanche : tête et
  // genoux (les pieds peuvent être coupés) ; épaule : épaules et hanches. Hanche et épaule : en plus, les 3 points de l'angle suivi
  // (un point deviné hors cadre fausserait l'angle).
  const whole = { knee: [0, 27, 28], elbow: [11, 12, 15, 16], hip: [0, 25, 26], shoulder: [11, 12, 23, 24] }[kind];
  const strict = kind === 'hip' || kind === 'shoulder';
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
      if (sideVis(next) <= 0.5 || (strict && !JOINTS[kind][next].every((k) => seen(p[k])))) return hold('partial', p);
      badSince = null;
      if (next !== side) { counter.reset(); side = next; }
      const angleOf = (s) => {
        const j = JOINTS[kind][s].map((k) => ({ x: p[k].x * (aspect || 1), y: p[k].y }));
        return jointAngle(j[0], j[1], j[2]);
      };
      let angle = angleOf(side);
      // Les deux côtés doivent faire le geste (élévations) : on suit le bras le moins levé, tant que l'autre côté est visible.
      if (cfg.both && sideVis(1 - side) > 0.5) angle = cfg.dir === 'up' ? Math.min(angle, angleOf(1 - side)) : Math.max(angle, angleOf(1 - side));
      return { pose: p, side: JOINTS[kind][side], state: 'ok', ev: counter.push(angle, t) };
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
  beep, frenchVoices, frenchVoice, FRONT, JOINTS, COUNTER, COUNTER_EX, counterFor, CAM_EX, CAM_OFF, camKind, CAM_TEXT, BONES, poseModel,
  jointAngle, repCounter, tempoCoach, HANDS_HIGH, poseTracker, ICE, gathered,
};
