// Écran projeté (TV, ordinateur) : affiche la séance envoyée par l'iPhone, qui reste la source de vérité.
// Relais WebSocket du serveur (push/worker.js, objet Screen). L'écran tient seul le chrono du repos : il sonne et annonce
// même si l'iPhone se verrouille et coupe la connexion. Navigateurs de TV (Chromium 68+) : ES2018 au plus
// (pas de ?., ??, flat, Object.fromEntries, replaceChildren, catch sans variable). Code commun avec l'appli : ../shared.js.
//
// Instantané reçu (snapshot, version 1), construit par live() dans screen.js (phase 'stopped' seule : projection arrêtée sur l'iPhone) :
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
const $ = (id) => document.getElementById(id);

let unlocked = false, room = null, sock = null, online = false, phones = 0, delay = 1000, retry = 0, ping = 0, codeTimer = 0;
let snapshot = null; // dernier instantané
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
  snapshot = rest = null;
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
  snapshot = next;
  const fresh = age < 10000; // état gardé depuis plus longtemps par le serveur : ni annonce ni bandeau en retard
  if (snapshot && snapshot.say && snapshot.say.id !== said) { said = snapshot.say.id; if (fresh && snapshot.voice) speak(snapshot.say.text); }
  if (snapshot && snapshot.record && snapshot.record.id !== recorded) { recorded = snapshot.record.id; if (fresh) banner(snapshot.record.text); }
  if (snapshot && snapshot.notice && snapshot.notice.id !== noticed) { noticed = snapshot.notice.id; if (fresh) notice(snapshot.notice.text); } // série validée à la voix
  if (snapshot && snapshot.next && snapshot.next.img) snapshot.next.img.forEach((src) => { new Image().src = '../' + src; }); // exercice suivant préchargé
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
  beep(audio);
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
  const phase = !snapshot ? null : snapshot.phase === 'rest' && !rest ? 'work' : snapshot.phase;
  const live = phase === 'work' || phase === 'rest' || phase === 'paused';
  const idle = phase === 'idle' && !!snapshot.upcoming;
  const view = !room ? 'pair' : phase === 'stopped' ? 'stopped' : live || idle || phase === 'done' ? 'session' : 'wait';
  ['pair', 'wait', 'stopped', 'session'].forEach((v) => { if ($(v)) $(v).hidden = v !== view; }); // élément absent : HTML d'une autre version en cache
  // Écran d'attente : « Nouveau code » a le focus, la touche OK de la télécommande suffit.
  const repair = document.querySelector('#' + view + ' .repair');
  if (repair && document.activeElement !== repair) repair.focus();
  if (view !== 'session') return;
  const p = live ? snapshot.progress : null;
  text('title', snapshot.title);
  list('segs', p && Array.from({ length: p.exCount }, (_, i) => (i + 1 < p.ex ? 'on' : i + 1 === p.ex ? 'now' : '')), (c) => h('i', { className: c }));
  const status = live && phones === 0 ? 'iPhone déconnecté : le chrono continue' : !online ? 'Connexion au serveur…'
    : live && snapshot.mic === 'off' ? 'Micro coupé sur l\'iPhone : touche « Micro coupé » pour le relancer' : '';
  text('status', status);
  text('prog', p && !status ? p.sets + '/' + p.setCount + ' séries · ' + p.minutes + ' min' : '');
  $('live').hidden = !(live && snapshot.ex);
  $('idle').hidden = !idle;
  $('done').hidden = phase !== 'done';
  $('pause').hidden = phase !== 'paused';
  $('foot').hidden = !live;
  if (live) renderLive(phase);
  else if (idle) renderIdle(snapshot.upcoming);
  else renderDone(snapshot.summary || {});
}

function renderLive(phase) {
  const ex = snapshot.ex || {}, set = snapshot.set || {}, resting = phase === 'rest';
  list('shots', ex.img, (src) => h('img', { src: '../' + src, alt: '' }));
  document.querySelector('.visual').classList.toggle('bare', !(ex.img && ex.img.length));
  bodies(ex.mus || [], ex.mus2 || []);
  text('ex-name', ex.name);
  text('badge', ex.badge);
  list('cues', ex.cues, (c) => h('li', {}, c));
  $('state').classList.toggle('resting', resting);
  if (resting) ring();
  text('label', snapshot.label || (set.n ? (resting ? 'Prochaine : série ' : 'Série ') + set.n + ' sur ' + set.of : ''));
  text('target', set.target);
  text('load', set.load);
  $('load').classList.toggle('long', String(set.load || '').length > 9);
  text('plates', set.plates);
  text('change', set.change);
  text('last', resting ? '' : set.last);
  text('approach', resting ? '' : set.approach);
  text('note', resting ? '' : ex.note);
  const done = snapshot.done || [], d = done[done.length - 1];
  $('prev').hidden = !d;
  text('prev-text', d ? 'Série ' + d.n + ' : ' + d.text + (d.t ? ' · ' + d.t : '') : '');
  text('prev-record', d && d.record ? 'Record' : '');
  $('next').hidden = !snapshot.next;
  text('next-name', snapshot.next ? snapshot.next.name : '');
  text('next-detail', snapshot.next && snapshot.next.detail ? ' · ' + snapshot.next.detail : '');
}

// Muscles travaillés : silhouettes de face et de dos, principaux en rouge, secondaires en orange (comme la fiche de l'appli).
function bodies(mus, mus2) {
  const node = $('bodies'), key = JSON.stringify([mus, mus2]);
  if (node.dataset.key === key) return;
  node.dataset.key = key;
  node.textContent = '';
  [true, false].forEach((front) => {
    const img = (src) => h('img', { src: '../muscles/' + src, alt: '' });
    const layer = (ids, dir) => ids.filter((m) => FRONT.has(m) === front).map((m) => img(dir + '/muscle-' + m + '.svg'));
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

// Voix française de l'appareil (frenchVoice, shared.js).
function speak(say) {
  const synth = window.speechSynthesis;
  if (!synth || !say) return;
  const u = new SpeechSynthesisUtterance(say);
  u.lang = 'fr-FR';
  u.voice = frenchVoice(synth);
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
// aucune image envoyée. Squats et fentes (genou), développés (coude) : snapshot.ex.cam. Bibliothèque chargée seulement si on l'active.
// Constantes, modèle (poseModel), jointAngle et repCounter : shared.js.
let mirror = null; // { stream, remote, model, tracker, key, reps, data, off }

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
  document.querySelector('.ex').parentNode.classList.remove('mirroring');
  document.querySelector('.top').classList.remove('mirroring');
  $('cues').before(document.querySelector('.ex-head'));
  fitMirror();
}
// Fenêtre du miroir au format de l'image (iPhone en portrait 9:16 ou en paysage 16:9) : aussi grande que possible, sans bandes
// noires, centrée en hauteur ; 62 % de la largeur au plus, la carte d'état garde ses 38 %. Avant la première image et en colonnes empilées : la feuille de style.
function fitMirror() {
  const cols = $('live'), box = $('mirror'), video = $('mirror-video');
  if (!mirror || !video.videoWidth || !matchMedia('(min-aspect-ratio: 4/3)').matches) { cols.style.gridTemplateColumns = box.style.height = box.style.alignSelf = ''; return; }
  const rem = parseFloat(document.documentElement.style.fontSize), H = document.querySelector('.ex').clientHeight;
  const ratio = video.videoWidth / video.videoHeight, w = Math.floor(Math.max(12 * rem, Math.min(H * ratio, (cols.clientWidth - 2 * rem) * .62)));
  cols.style.gridTemplateColumns = w + 'px minmax(0, 1fr)';
  box.style.height = Math.min(H, Math.floor(w / ratio)) + 'px';
  box.style.alignSelf = 'center';
}
$('mirror-video').addEventListener('resize', fitMirror); // nouvelle taille d'image : l'iPhone a tourné
if (window.ResizeObserver) new ResizeObserver(fitMirror).observe($('live')); else addEventListener('resize', fitMirror);
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
  document.querySelector('.ex').parentNode.classList.add('mirroring'); // colonne de l'image élargie
  document.querySelector('.top').classList.add('mirroring');
  $('title').after(document.querySelector('.ex-head')); // le nom de l'exercice remplace le titre : toute la hauteur pour l'image
  $('mirror-count').textContent = '';
  if (remote) { video.srcObject = remote; video.play().catch(() => {}); } // l'image tout de suite, le suivi du corps ensuite
  mirrorSay(remote ? 'Caméra de l\'iPhone' : 'Préparation de la caméra…');
  const source = remote ? Promise.resolve(remote) : navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
  Promise.all([source, poseModel()]).then((res) => {
    if (mirror !== me) { if (!remote) res[0].getTracks().forEach((t) => t.stop()); return; }
    Object.assign(me, { stream: res[0], model: res[1], key: null, reps: 0, data: [], tracker: null, kind: null, off: 0 });
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
// même relais ; la vidéo ne passe pas par le serveur (ICE et gathered : shared.js).
let rtc = null;
function closeVideo() { if (rtc) { rtc.close(); rtc = null; } }
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

// Messages quand le comptage est suspendu (affichés après 0,8 s, pour ne pas clignoter).
const HOLD = { none: 'Je ne te vois pas : place-toi face à la caméra.', moving: 'Reste sur place pour que je compte.',
  switch: "Quelqu'un passe : comptage suspendu.", paused: 'Repos : je reprends à la série suivante.',
  hands: 'Mains sur la barre ou la charge pour que je compte.' };
function mirrorFrame(me) {
  if (mirror !== me || !me.model) return;
  const video = $('mirror-video'), canvas = $('mirror-canvas'), ctx = canvas.getContext('2d');
  // Nouvelle série affichée : le compte repart de zéro.
  const key = snapshot && snapshot.ex && snapshot.set ? snapshot.ex.id + '|' + snapshot.set.n : null, kind = snapshot && snapshot.ex ? snapshot.ex.cam : null;
  if (key !== mirror.key || kind !== mirror.kind) {
    Object.assign(mirror, { key: key, kind: kind, reps: 0, data: [], tracker: kind ? poseTracker(kind, snapshot.ex.id) : null, off: 0 });
    $('mirror-count').textContent = kind ? '0' : '';
    mirrorSay(kind ? 'Je compte tes répétitions.' : (key ? 'Comptage disponible pour les squats, les fentes, les pompes et les développés.' : 'Miroir actif.'));
  }
  if (video.readyState >= 2 && video.videoWidth) {
    const w = canvas.width = video.videoWidth, hh = canvas.height = video.videoHeight, now = performance.now();
    const res = mirror.model.detectForVideo(video, now);
    if (mirror.tracker) {
      // Pendant la série seulement, la bonne personne, entière et sur place : voir poseTracker (shared.js).
      const r = mirror.tracker.update(res.landmarks, now, !!rest, w / hh);
      if (r.pose) {
        const at = (k) => ({ x: r.pose[k].x * w, y: r.pose[k].y * hh });
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#c8441d';
        BONES.forEach((b) => { const a = at(b[0]), c = at(b[1]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke(); });
        if (r.side) { ctx.fillStyle = '#fff'; r.side.forEach((k) => { const q = at(k); ctx.beginPath(); ctx.arc(q.x, q.y, 9, 0, 2 * Math.PI); ctx.fill(); }); }
      }
      if (r.state === 'ok') mirror.off = 0;
      else if (!mirror.off) mirror.off = now;
      else if (now - mirror.off > 800) mirrorSay(r.state === 'partial' ? (mirror.kind === 'knee' ? 'Recule : la tête et les pieds doivent être dans l\'image.' : 'Recule : épaules et mains doivent être dans l\'image.') : HOLD[r.state], r.state !== 'paused');
      const ev = r.ev;
      if (ev && ev.partial) mirrorSay('Pas assez bas : répétition non comptée.', true); // rien n'est dit : un geste anodin ne doit pas faire parler
      else if (ev) {
        mirror.reps = ev.rep;
        mirror.data.push({ depth: ev.depth, down: ev.down, full: ev.full });
        $('mirror-count').textContent = String(ev.rep);
        mirrorSay(!ev.full ? 'Amplitude incomplète : descends plus bas.' : ev.down < 1000 ? 'Descente trop rapide : contrôle-la.' : 'Répétition ' + ev.rep + ' : bonne amplitude.', !ev.full || ev.down < 1000);
        // La voix ne dit que le numéro, la consigne reste écrite. Micro de l'iPhone ouvert : rien (il prendrait le nombre pour ta réponse).
        if (snapshot.voice && snapshot.mic !== 'on') speak(String(ev.rep));
        if (sock && sock.readyState === 1) sock.send(JSON.stringify({ type: 'reps', key: mirror.key, n: ev.rep, data: mirror.data }));
      }
    } else ctx.clearRect(0, 0, w, hh);
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
