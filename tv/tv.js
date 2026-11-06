// Écran projeté (TV, ordinateur) : affiche la séance envoyée par l'iPhone, qui reste la source de vérité.
// Relais WebSocket du serveur (push/worker.js, objet Screen). L'écran tient seul le chrono du repos : il sonne et annonce
// même si l'iPhone se verrouille et coupe la connexion. Navigateurs de TV (Chromium 68+) : ES2018 au plus
// (pas de ?., ??, flat, Object.fromEntries, replaceChildren, catch sans variable).
//
// Instantané reçu (s, version 1), construit par live() dans app.js (phase 'stopped' seule : projection arrêtée sur l'iPhone) :
// { v: 1, at: Date.now() du téléphone à l'envoi, phase: 'idle'|'work'|'rest'|'paused'|'done'|'stopped', title, voice: bool,
//   upcoming: { when, items: [{ name, detail }], gear: [texte] } | null,       // phase idle
//   progress: { ex, exCount, sets, setCount, minutes } | null,
//   ex: { id, name, img: ['img/…'], mus: [id], mus2: [id], cues: [texte], badge, note } | null,
//   set: { n, of, target, load, plates, change, last, approach } | null,     // pendant le repos : la série qui suit
//   done: [{ n, text, t, record }], rest: { end: ms (horloge du téléphone), total: ms, say } | null,
//   next: { name, detail, img? } | null, record: { id, text } | null,       // img facultatif : préchargée
//   summary: { stats: [[valeur, libellé]], records: [texte] } | null,      // phase done
//   say: { id, text } | null, label: texte | absent, notice: { id, text } | null (série validée à la voix), mic: 'on'|'off'|null }                         // label : remplace « Série n sur N » (échauffement)
// Messages du serveur : presence { tv, phone } ; state { s, age? } (age : état gardé par le serveur, renvoyé à la connexion) ;
// adopt { room } (appairage : la salle permanente) ; forget (l'iPhone oublie l'écran). Envoyé : adopted, et « ping » toutes les 30 s.

const KEY = 'muscu-auto-screen';
const UUID = /^[0-9a-f-]{36}$/;
const FRONT = [1, 2, 3, 4, 6, 10, 13, 14]; // muscles visibles de face (wger is_front), comme app.js
const VOICES = ['Amélie', 'Thomas', 'Audrey', 'Aurélie'];
const $ = (id) => document.getElementById(id);

let unlocked = false, room = null, sock = null, online = false, phones = 0, delay = 1000, retry = 0, ping = 0, codeTimer = 0;
let s = null; // dernier instantané
let rest = null; // repos en cours : { key: rest.end du téléphone, end: fin sur notre horloge, total, say, voice }
let over = null; // dernier repos terminé (sa clé) : jamais relancé ni resonné
let tickTimer = 0, said = null, recorded = null, noticed = null, noticeTimer = 0, bannerTimer = 0, audio = null, lock = null;

// Maquette en rem sur une base 1920 × 1080 : même rendu de 1280 × 720 à la 4K.
function scale() { document.documentElement.style.fontSize = Math.min(innerWidth / 1920, innerHeight / 1080) * 24 + 'px'; }
addEventListener('resize', scale);
scale();

function h(tag, props, ...kids) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...kids.filter((k) => k != null && k !== ''));
  return node;
}

// Texte réécrit seulement s'il change ; vide = élément masqué.
function text(id, value) {
  const node = $(id), v = value == null ? '' : String(value);
  if (node.textContent !== v) node.textContent = v;
  node.hidden = !v;
}

// Liste reconstruite seulement si son contenu change.
function list(id, items, make) {
  const node = $(id), key = JSON.stringify(items || []);
  node.hidden = !(items && items.length);
  if (node.dataset.key === key) return;
  node.dataset.key = key;
  node.textContent = '';
  (items || []).forEach((it) => node.append(make(it)));
}

// --- Connexion ---

// Serveur : PUSH.url (https → wss). ?server=… n'est pris en compte qu'en local, pour tester avec wrangler dev.
function serverUrl() {
  const dev = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).get('server');
  return (dev || PUSH.url).replace(/^http/, 'ws');
}

function connect(name) {
  if (sock) { sock.onclose = sock.onmessage = null; sock.close(); } // changement de salle : l'ancienne ne se reconnecte pas
  clearTimeout(retry);
  clearInterval(ping);
  const ws = sock = new WebSocket(serverUrl() + '/screen?room=' + name + '&role=tv');
  setOnline(false);
  ws.onopen = () => {
    delay = 1000;
    ping = setInterval(() => ws.send('ping'), 30000); // le serveur répond seul, sans se réveiller
    setOnline(true);
  };
  ws.onmessage = (e) => {
    let m;
    try { m = JSON.parse(e.data) || {}; } catch (err) { return; } // « pong »
    if (m.type === 'presence') { if (m.phone > phones && mirror) tellMirror(true); phones = m.phone; render(); } // iPhone (re)connecté : il apprend que le miroir compte
    else if (m.type === 'state') onState(m);
    else if (m.type === 'adopt' && !room && UUID.test(m.room)) adopt(m.room);
    else if (m.type === 'forget' && room) forget();
    else if (m.type === 'mirror') setMirror(!!m.on);
    else if (m.type === 'rtc' && m.sdp) acceptVideo(m.sdp);
    else if (m.type === 'rtc' && m.stop) { if (mirror && mirror.remote) setMirror(false); else closeVideo(); }
  };
  // Coupure (réseau, serveur redéployé) : reconnexion de plus en plus espacée, 1 s → 30 s.
  ws.onclose = () => {
    clearInterval(ping);
    setOnline(false);
    retry = setTimeout(() => connect(name), delay);
    delay = Math.min(delay * 2, 30000);
  };
}

function setOnline(v) {
  online = v;
  if (!v) phones = 0;
  document.body.classList.toggle('offline', !v);
  render();
}

// Pas de salle : un code à 4 chiffres (salle temporaire pair-XXXX), renouvelé toutes les 10 min.
function pair() {
  const code = String(Math.floor(Math.random() * 1e4)).padStart(4, '0');
  list('code', code.split(''), (d) => h('span', {}, d));
  $('code').setAttribute('aria-label', 'Code ' + code.split('').join(' '));
  clearTimeout(codeTimer);
  codeTimer = setTimeout(pair, 600000);
  connect('pair-' + code);
}

// Appairage réussi : salle permanente gardée, l'écran s'y reconnecte et reçoit aussitôt le dernier état.
function adopt(id) {
  sock.send(JSON.stringify({ type: 'adopted' }));
  store(id);
  room = id;
  clearTimeout(codeTimer);
  connect(id);
}

// L'iPhone oublie l'écran, ou « Nouveau code » sur l'écran (autre iPhone, association perdue) : retour au code.
function forget() {
  store(null);
  room = null;
  s = rest = null;
  clearTimeout(tickTimer);
  pair();
}

function stored() {
  try { const v = localStorage.getItem(KEY); return UUID.test(v) ? v : null; } catch (e) { return null; }
}
function store(v) {
  try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch (e) { /* stockage bloqué : appairage à refaire au prochain lancement */ }
}

// --- Instantané ---

function onState(m) {
  const age = m.age || 0, next = m.s && m.s.v === 1 ? m.s : null;
  const r = next && next.phase === 'rest' ? next.rest : null;
  // Repos en cours qui disparaît : l'iPhone l'a fini juste avant nous (moins de 3 s, il ne sonne pas quand l'écran est là),
  // ou il a été passé, ou rallongé (nouvelle fin) : sans bip.
  if (rest && !(r && r.end === rest.key)) endRest(!r && rest.end - Date.now() < 3000);
  if (rest && r) { rest.say = r.say; rest.voice = next.voice; } // charge changée pendant le repos : l'annonce suit
  // Nouveau repos : les horloges diffèrent, la fin se recale sur l'heure de réception (moins l'ancienneté d'un état renvoyé).
  if (r && !rest && r.end !== over) {
    const end = Date.now() - age + (r.end - next.at);
    if (end > Date.now()) rest = { key: r.end, end, total: r.total, say: r.say, voice: next.voice };
    else over = r.end; // déjà fini à la réception : pas de bip en retard
  }
  s = next;
  const fresh = age < 10000; // état gardé depuis plus longtemps par le serveur : ni annonce ni bandeau en retard
  if (s && s.say && s.say.id !== said) { said = s.say.id; if (fresh && s.voice) speak(s.say.text); }
  if (s && s.record && s.record.id !== recorded) { recorded = s.record.id; if (fresh) banner(s.record.text); }
  if (s && s.notice && s.notice.id !== noticed) { noticed = s.notice.id; if (fresh) notice(s.notice.text); } // série validée à la voix
  if (s && s.next && s.next.img) s.next.img.forEach((src) => { new Image().src = '../' + src; }); // exercice suivant préchargé
  render();
  tick();
}

// Chrono : texte mis à jour à chaque changement de seconde ; l'anneau tourne seul en CSS.
function tick() {
  clearTimeout(tickTimer);
  if (!rest) return;
  const ms = rest.end - Date.now();
  if (ms <= 0) { endRest(true); render(); return; }
  const left = Math.ceil(ms / 1000);
  text('count', Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'));
  tickTimer = setTimeout(tick, ms - (left - 1) * 1000 + 10);
}

// Fin du repos : triple bip puis l'annonce de la série suivante, une seule fois par repos.
function endRest(ring) {
  clearTimeout(tickTimer);
  const r = rest;
  over = r.key;
  rest = null;
  if (!ring) return;
  beep();
  if (r.voice && r.say) setTimeout(() => speak(r.say), 800);
}

// Anneau : une animation CSS sur toute la durée du repos, décalée du temps écoulé (rien à calculer à chaque image).
// Relancée à chaque affichage : même position, et juste même si la vue était masquée.
function ring() {
  const arc = $('arc'), total = rest.total || 1;
  arc.style.animation = 'none';
  arc.getBoundingClientRect();
  arc.style.animation = 'ring ' + total + 'ms linear ' + (rest.end - Date.now() - total) + 'ms both';
}

// --- Affichage : squelette fixe dans index.html, seuls les textes qui changent sont réécrits ---

function render() {
  // Repos fini ici avant que l'iPhone le dise : la série suivante passe à l'écran.
  const phase = !s ? null : s.phase === 'rest' && !rest ? 'work' : s.phase;
  const live = phase === 'work' || phase === 'rest' || phase === 'paused';
  const idle = phase === 'idle' && !!s.upcoming;
  const view = !room ? 'pair' : phase === 'stopped' ? 'stopped' : live || idle || phase === 'done' ? 'session' : 'wait';
  ['pair', 'wait', 'stopped', 'session'].forEach((v) => { if ($(v)) $(v).hidden = v !== view; }); // élément absent : HTML d'une autre version en cache
  // Écran d'attente : « Nouveau code » a le focus, la touche OK de la télécommande suffit.
  const repair = document.querySelector('#' + view + ' .repair');
  if (repair && document.activeElement !== repair) repair.focus();
  if (view !== 'session') return;
  const p = live ? s.progress : null;
  text('title', s.title);
  list('segs', p && Array.from({ length: p.exCount }, (_, i) => (i + 1 < p.ex ? 'on' : i + 1 === p.ex ? 'now' : '')), (c) => h('i', { className: c }));
  const status = live && phones === 0 ? 'iPhone déconnecté : le chrono continue' : !online ? 'Connexion au serveur…'
    : live && s.mic === 'off' ? 'Micro coupé sur l\'iPhone : touche « Micro coupé » pour le relancer' : '';
  text('status', status);
  text('prog', p && !status ? p.sets + '/' + p.setCount + ' séries · ' + p.minutes + ' min' : '');
  $('live').hidden = !(live && s.ex);
  $('idle').hidden = !idle;
  $('done').hidden = phase !== 'done';
  $('pause').hidden = phase !== 'paused';
  $('foot').hidden = !live;
  if (live) renderLive(phase);
  else if (idle) renderIdle(s.upcoming);
  else renderDone(s.summary || {});
}

function renderLive(phase) {
  const ex = s.ex || {}, set = s.set || {}, resting = phase === 'rest';
  list('shots', ex.img, (src) => h('img', { src: '../' + src, alt: '' }));
  document.querySelector('.visual').classList.toggle('bare', !(ex.img && ex.img.length));
  bodies(ex.mus || [], ex.mus2 || []);
  text('ex-name', ex.name);
  text('badge', ex.badge);
  list('cues', ex.cues, (c) => h('li', {}, c));
  $('state').classList.toggle('resting', resting);
  if (resting) ring();
  text('label', s.label || (set.n ? (resting ? 'Prochaine : série ' : 'Série ') + set.n + ' sur ' + set.of : ''));
  text('target', set.target);
  text('load', set.load);
  $('load').classList.toggle('long', String(set.load || '').length > 9);
  text('plates', set.plates);
  text('change', set.change);
  text('last', resting ? '' : set.last);
  text('approach', resting ? '' : set.approach);
  text('note', resting ? '' : ex.note);
  const done = s.done || [], d = done[done.length - 1];
  $('prev').hidden = !d;
  text('prev-text', d ? 'Série ' + d.n + ' : ' + d.text + (d.t ? ' · ' + d.t : '') : '');
  text('prev-record', d && d.record ? 'Record' : '');
  $('next').hidden = !s.next;
  text('next-name', s.next ? s.next.name : '');
  text('next-detail', s.next && s.next.detail ? ' · ' + s.next.detail : '');
}

// Muscles travaillés : silhouettes de face et de dos, principaux en rouge, secondaires en orange (comme la fiche de l'appli).
function bodies(mus, mus2) {
  const node = $('bodies'), key = JSON.stringify([mus, mus2]);
  if (node.dataset.key === key) return;
  node.dataset.key = key;
  node.textContent = '';
  [true, false].forEach((front) => {
    const img = (src) => h('img', { src: '../muscles/' + src, alt: '' });
    const layer = (ids, dir) => ids.filter((m) => FRONT.includes(m) === front).map((m) => img(dir + '/muscle-' + m + '.svg'));
    node.append(h('div', { className: 'body' }, img('muscular_system_' + (front ? 'front' : 'back') + '.svg'), ...layer(mus2, 'secondary'), ...layer(mus, 'main')));
  });
}

function renderIdle(u) {
  text('when', u.when);
  list('items', u.items, (it) => h('li', {}, h('span', { className: 'name' }, it.name), h('span', { className: 'detail' }, it.detail)));
  list('gear', u.gear, (g) => h('li', {}, g));
  $('gear-card').hidden = !(u.gear && u.gear.length);
}

function renderDone(sum) {
  list('stats', sum.stats, (st) => h('div', { className: 'stat' }, h('strong', {}, st[0]), h('span', {}, st[1])));
  list('records', sum.records, (r) => h('li', {}, r));
  $('recs').hidden = !(sum.records && sum.records.length);
}

// Heure en haut à droite, à chaque minute pile.
function clock() {
  text('clock', new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
  setTimeout(clock, 60000 - Date.now() % 60000 + 50);
}
clock();

// Confirmation d'une série validée à la voix : bandeau 2,5 s en haut.
function notice(msg) {
  text('notice-text', msg);
  $('notice').classList.add('show');
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => $('notice').classList.remove('show'), 2500);
}

function banner(msg) {
  text('record-text', msg);
  $('record').classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => $('record').classList.remove('show'), 5000);
}

// --- Son, voix, écran allumé ---

// Triple bip de fin de repos, comme beep() d'app.js.
function beep() {
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
function speak(say) {
  const synth = window.speechSynthesis;
  if (!synth || !say) return;
  const u = new SpeechSynthesisUtterance(say);
  u.lang = 'fr-FR';
  const fr = synth.getVoices().filter((v) => /^fr/i.test(v.lang));
  u.voice = VOICES.map((name) => fr.find((v) => v.name.startsWith(name))).find(Boolean) || fr.find((v) => /fr.FR/i.test(v.lang)) || fr[0] || null;
  if (synth.speaking || synth.pending) synth.cancel(); // la nouvelle annonce remplace l'ancienne
  synth.speak(u);
}

function awake() {
  if (!navigator.wakeLock || lock) return;
  navigator.wakeLock.request('screen').then((l) => { lock = l; l.addEventListener('release', () => { lock = null; }); }, () => {});
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') awake(); });

function fullscreen() {
  const el = document.documentElement, go = el.requestFullscreen || el.webkitRequestFullscreen;
  try { const p = go && go.call(el); if (p && p.catch) p.catch(() => {}); } catch (e) { /* refusé : on reste en fenêtre */ }
}

// --- Miroir : la webcam de l'ordinateur (page ouverte sur le Mac recopié sur la TV) suit le corps, compte les répétitions
// de la série affichée et vérifie l'amplitude ; le compte part vers l'iPhone, qui remplit son compteur. Calcul sur l'appareil,
// aucune image envoyée. Squats et fentes (genou), développés (coude) : s.ex.cam. Bibliothèque chargée seulement si on l'active.
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1';
const POSE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const JOINTS = { knee: [[23, 25, 27], [24, 26, 28]], elbow: [[11, 13, 15], [12, 14, 16]] };
const COUNTER = { knee: { top: 160, start: 140, deep: 100 }, elbow: { top: 155, start: 130, deep: 90 } };
const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
let mirror = null; // { stream, remote, model, counter, key, reps, data, smooth }
let landmarker = null;

// Mêmes calculs que plan.js (jointAngle, repCounter), réécrits ici en ES2018 pour les navigateurs de TV.
function jointAngle(a, b, c) {
  const deg = Math.abs(Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x)) * 180 / Math.PI;
  return deg > 180 ? 360 - deg : deg;
}
function repCounter(o) {
  let down = false, min = 180, topAt = 0, bottomAt = 0, count = 0;
  return function push(angle, t) {
    if (!down) {
      if (angle >= o.top) topAt = t;
      else if (angle < o.start) { down = true; min = angle; bottomAt = t; }
      return null;
    }
    if (angle < min) { min = angle; bottomAt = t; }
    if (angle < o.top) return null;
    count++;
    const ev = { rep: count, depth: Math.round(min), down: bottomAt - topAt, full: min <= o.deep };
    down = false;
    topAt = t;
    return ev;
  };
}
function poseModel() {
  if (!landmarker) {
    landmarker = import(MP + '/vision_bundle.mjs').then((mp) => mp.FilesetResolver.forVisionTasks(MP + '/wasm')
      .then((files) => mp.PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'GPU' }, runningMode: 'VIDEO', numPoses: 1 })));
    landmarker.catch(() => { landmarker = null; });
  }
  return landmarker;
}
function mirrorSay(textValue, warn) {
  const node = $('mirror-say');
  node.textContent = textValue;
  node.classList.toggle('warn', !!warn);
}
function tellMirror(on) { if (sock && sock.readyState === 1) sock.send(JSON.stringify({ type: 'mirror', on: on })); }
function hideMirror() {
  if (mirror && mirror.stream && !mirror.remote) mirror.stream.getTracks().forEach((t) => t.stop());
  mirror = null;
  $('mirror').hidden = true;
  document.querySelector('.ex').classList.remove('mirroring');
}
// remote : flux de la caméra de l'iPhone (voir acceptVideo), il remplace la webcam de l'écran.
function setMirror(on, remote) {
  if (!on) {
    if (!mirror) return;
    tellMirror(false);
    hideMirror();
    closeVideo();
    return;
  }
  if (mirror && !remote) return;
  if (!remote && !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) return;
  if (mirror) hideMirror();
  tellMirror(true);
  const me = mirror = { stream: remote || null, remote: !!remote };
  const video = $('mirror-video');
  $('mirror').hidden = false;
  $('mirror').classList.toggle('remote', !!remote);
  document.querySelector('.ex').classList.add('mirroring');
  $('mirror-count').textContent = '';
  if (remote) { video.srcObject = remote; video.play().catch(() => {}); } // l'image tout de suite, le suivi du corps ensuite
  mirrorSay(remote ? 'Caméra de l\'iPhone' : 'Préparation de la caméra…');
  const source = remote ? Promise.resolve(remote) : navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
  Promise.all([source, poseModel()]).then((res) => {
    if (mirror !== me) { if (!remote) res[0].getTracks().forEach((t) => t.stop()); return; }
    Object.assign(me, { stream: res[0], model: res[1], key: null, reps: 0, data: [], smooth: null, counter: null, kind: null });
    if (!remote) { video.srcObject = res[0]; video.play().catch(() => {}); }
    mirrorFrame(me);
  }, (err) => {
    if (mirror !== me) return;
    // Caméra de l'iPhone : l'image reste, sans comptage. Webcam : message, puis le miroir se referme.
    if (remote) return mirrorSay('Comptage indisponible sur cet écran : valide à la voix.', true);
    mirrorSay(err && err.name === 'NotAllowedError' ? 'Caméra refusée : autorise-la dans le navigateur.' : 'Caméra ou suivi du corps indisponible.', true);
    setTimeout(() => { if (mirror === me) setMirror(false); }, 4000);
  });
}

// Caméra de l'iPhone en direct (WebRTC, d'appareil à appareil sur le Wi-Fi) : l'iPhone envoie son offre, l'écran répond par le
// même relais ; la vidéo ne passe pas par le serveur. STUN de Cloudflare : adresse publique si le Wi-Fi isole les appareils.
const ICE = [{ urls: 'stun:stun.cloudflare.com:3478' }];
let rtc = null;
function closeVideo() { if (rtc) { rtc.close(); rtc = null; } }
// Candidats réseau dans la réponse (pas d'envoi au fil de l'eau) : 2 s au plus.
function gathered(pc) {
  return new Promise((done) => {
    const timer = setTimeout(done, 2000);
    const check = () => { if (pc.iceGatheringState === 'complete') { clearTimeout(timer); done(); } };
    pc.addEventListener('icegatheringstatechange', check);
    check();
  });
}
function acceptVideo(sdp) {
  if (!window.RTCPeerConnection) return;
  closeVideo();
  const pc = rtc = new RTCPeerConnection({ iceServers: ICE });
  pc.ontrack = (e) => { if (rtc === pc) setMirror(true, e.streams[0] || new MediaStream([e.track])); };
  pc.onconnectionstatechange = () => { if (rtc === pc && pc.connectionState === 'failed') setMirror(false); }; // l'iPhone prévient
  pc.setRemoteDescription({ type: 'offer', sdp: sdp })
    .then(() => pc.createAnswer())
    .then((answer) => pc.setLocalDescription(answer))
    .then(() => gathered(pc))
    .then(() => { if (rtc === pc && sock && sock.readyState === 1) sock.send(JSON.stringify({ type: 'rtc', sdp: pc.localDescription.sdp })); })
    .catch(() => { if (rtc === pc) closeVideo(); });
}

function mirrorFrame(me) {
  if (mirror !== me || !me.model) return;
  const video = $('mirror-video'), canvas = $('mirror-canvas'), ctx = canvas.getContext('2d');
  // Nouvelle série affichée : le compte repart de zéro.
  const key = s && s.ex && s.set ? s.ex.id + '|' + s.set.n : null, kind = s && s.ex ? s.ex.cam : null;
  if (key !== mirror.key || kind !== mirror.kind) {
    Object.assign(mirror, { key: key, kind: kind, reps: 0, data: [], smooth: null, counter: kind ? repCounter(COUNTER[kind]) : null, hips: [] });
    $('mirror-count').textContent = kind ? '0' : '';
    mirrorSay(kind ? 'Je compte tes répétitions.' : (key ? 'Comptage disponible pour les squats, les fentes, les pompes et les développés.' : 'Miroir actif.'));
  }
  if (video.readyState >= 2 && video.videoWidth) {
    const w = canvas.width = video.videoWidth, hh = canvas.height = video.videoHeight;
    const res = mirror.model.detectForVideo(video, performance.now());
    const p = res.landmarks && res.landmarks[0];
    if (p) {
      const at = (k) => ({ x: p[k].x * w, y: p[k].y * hh, v: p[k].visibility == null ? 1 : p[k].visibility });
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#c8441d';
      BONES.forEach((b) => { const a = at(b[0]), c = at(b[1]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke(); });
      // On ne compte que pendant une série (pas au repos), corps entier dans l'image et sur place : s'approcher ou repartir en
      // bougeant les bras ne doit pas compter de répétitions (le bassin qui se déplace de plus de 15 % de l'image en 1 s = tu marches).
      const now = performance.now(), hip = (at(23).x + at(24).x) / 2 / w;
      mirror.hips = mirror.hips.filter((q) => now - q.t < 1000).concat([{ t: now, x: hip }]);
      const walking = Math.max.apply(null, mirror.hips.map((q) => q.x)) - Math.min.apply(null, mirror.hips.map((q) => q.x)) > 0.15;
      const whole = (mirror.kind === 'knee' ? [0, 27, 28] : [11, 12, 15, 16]).every((k) => (p[k].visibility == null ? 1 : p[k].visibility) > 0.5);
      if (mirror.counter && (rest || walking || !whole)) mirror.smooth = null; // reprise à zéro de l'angle : pas de demi-répétition comptée
      if (mirror.counter && !rest && !walking && whole) {
        const side = JOINTS[mirror.kind].map((j) => j.map(at)).sort((s1, s2) => Math.min.apply(null, s2.map((q) => q.v)) - Math.min.apply(null, s1.map((q) => q.v)))[0];
        if (Math.min.apply(null, side.map((q) => q.v)) > 0.5) {
          const angle = jointAngle(side[0], side[1], side[2]);
          mirror.smooth = mirror.smooth == null ? angle : mirror.smooth * 0.6 + angle * 0.4;
          const ev = mirror.counter(mirror.smooth, performance.now());
          if (ev) {
            mirror.reps = ev.rep;
            mirror.data.push({ depth: ev.depth, down: ev.down, full: ev.full });
            $('mirror-count').textContent = String(ev.rep);
            const bad = !ev.full ? 'plus bas' : ev.down < 1000 ? 'plus lent' : '';
            mirrorSay(!ev.full ? 'Amplitude incomplète : descends plus bas.' : ev.down < 1000 ? 'Descente trop rapide : contrôle-la.' : 'Répétition ' + ev.rep + ' : bonne amplitude.', !!bad);
            // Micro de l'iPhone ouvert : pas de nombre dit à voix haute (il pourrait le prendre pour ta réponse).
            if (s.voice) { if (bad) speak(s.mic === 'on' ? bad : ev.rep + ', ' + bad); else if (s.mic !== 'on') speak(String(ev.rep)); }
            if (sock && sock.readyState === 1) sock.send(JSON.stringify({ type: 'reps', key: mirror.key, n: ev.rep, data: mirror.data }));
          }
        }
      }
    }
  }
  requestAnimationFrame(() => mirrorFrame(me));
}
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
  $('mirror-btn').hidden = false;
  $('mirror-btn').addEventListener('click', () => setMirror(!mirror));
  addEventListener('keydown', (e) => { if (e.key === 'm' || e.key === 'M') setMirror(!mirror); });
}

// Plein écran à la demande (masque la barre du navigateur) : bouton, double-clic ou touche F ; Échap en sort.
const fsOn = () => document.fullscreenElement || document.webkitFullscreenElement;
function toggleFullscreen() {
  if (!fsOn()) return fullscreen();
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  try { const p = exit.call(document); if (p && p.catch) p.catch(() => {}); } catch (e) { /* déjà sorti */ }
}
if (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen) {
  $('fs').hidden = false;
  $('fs').addEventListener('click', toggleFullscreen);
  addEventListener('dblclick', toggleFullscreen);
  addEventListener('keydown', (e) => { if (e.key === 'f' || e.key === 'F') toggleFullscreen(); });
  ['fullscreenchange', 'webkitfullscreenchange'].forEach((t) => document.addEventListener(t, () => {
    document.body.classList.toggle('full', !!fsOn());
    $('fs').setAttribute('aria-label', fsOn() ? 'Quitter le plein écran' : 'Plein écran');
  }));
}
// Souris (ordinateur, télécommande à pointeur) : bouton et curseur visibles 3 s après chaque mouvement.
let pointerTimer = 0;
addEventListener('mousemove', () => {
  document.body.classList.add('pointer');
  clearTimeout(pointerTimer);
  pointerTimer = setTimeout(() => document.body.classList.remove('pointer'), 3000);
});

// Le son et la voix ont besoin d'un premier geste (navigateurs et TV les bloquent sans) : la page s'affiche et se connecte tout de suite,
// un bandeau invite à toucher OK ; ce premier geste débloque le son, le plein écran et l'écran allumé, sans rien déclencher d'autre.
function unlock(e) {
  if (unlocked) return;
  unlocked = true;
  if (e && e.preventDefault) { e.preventDefault(); e.stopPropagation(); } // OK sur « Nouveau code » ne doit pas le déclencher
  try { audio = new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch (err) { /* pas de WebAudio : pas de bip */ }
  const synth = window.speechSynthesis;
  if (synth) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); synth.getVoices(); } // débloque la voix, charge la liste
  $('sound').hidden = true;
  awake();
  fullscreen();
  ['pointerdown', 'keydown'].forEach((t) => removeEventListener(t, gate, true));
}
function gate(e) { if (e.type === 'pointerdown' || e.key === 'Enter' || e.keyCode === 13 || e.key === ' ') unlock(e); }
['pointerdown', 'keydown'].forEach((t) => addEventListener(t, gate, true));
document.querySelectorAll('.repair').forEach((b) => b.addEventListener('click', forget));

// Au chargement : salle mémorisée, sinon code d'association.
awake();
room = stored();
if (room) connect(room); else pair();
