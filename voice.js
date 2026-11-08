// --- Commande vocale ---
// Mains libres en mode focus, par une liste fermée de phrases (COMMANDS) : « dix répétitions validées », « série validée »,
// « passer le repos », « plus trente », « prochain exercice », « annuler la série », « c'était facile / bien / dur »,
// « mets en pause », « terminer la séance ». Garde-fous : micro sourd pendant que l'iPhone ou l'écran parle, aucune annonce
// ne contient de nombre ni de phrase de commande tant que le micro écoute.
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const WORDS = { 'dix-sept': 17, 'dix-huit': 18, 'dix-neuf': 19, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
  onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, vingt: 20, trente: 30 };
// État de l'écoute : rec = reconnaissance en cours (null : micro fermé), wanted = micro voulu (relancé s'il s'arrête),
// spokeAt = dernière annonce de l'iPhone, quietUntil = micro sourd jusque-là, lastHeard = dernière phrase entendue (voir heard).
const mic = { rec: null, wanted: false, spokeAt: 0, quietUntil: 0, lastHeard: null };
// Micro ouvert : rien de ce que disent l'iPhone ou l'écran ne contient de nombre (il pourrait être pris pour ta réponse).
const micOpen = () => !!mic.rec;
// Durée estimée d'une annonce (environ 14 caractères par seconde) : le micro reste sourd jusque-là.
const hush = (text) => { mic.quietUntil = Math.max(mic.quietUntil, Date.now() + 1500 + String(text || '').length * 70); };

function startEar() {
  if (!Recognition) return toast("Commande vocale indisponible sur cet appareil.", 'warning');
  mic.wanted = true;
  state.voiceInput = true;
  save();
  if (mic.rec) return;
  const rec = new Recognition();
  rec.lang = 'fr-FR';
  // Une phrase à la fois, relancée aussitôt : en mode continu, Safari colle tout ce qu'il entend en une seule phrase
  // (coach, télé, toi), qui dépassait vite les 4 mots et rendait tes « dix » inaudibles.
  rec.continuous = false;
  rec.interimResults = false;
  rec.maxAlternatives = 3;
  rec.onresult = (ev) => { const r = ev.results[ev.results.length - 1]; if (r.isFinal !== false) hear(r[0].transcript, [...r].map((a) => a.transcript)); };
  rec.onerror = (ev) => {
    if (!['not-allowed', 'service-not-allowed'].includes(ev.error)) return;
    mic.wanted = false;
    stopEar(false);
    toast("Micro refusé : autorise-le dans les Réglages de l'iPhone, Steady.", 'warning');
  };
  // Safari s'arrête après un silence : on relance. Impossible (appli en arrière-plan) : micro « coupé », signalé jusqu'à la relance.
  rec.onend = () => { if (mic.rec === rec) setTimeout(() => { if (mic.rec !== rec) return; try { rec.start(); } catch { mic.rec = null; refreshStatus(); broadcast(); } }, 150); };
  mic.rec = rec;
  try { rec.start(); } catch { mic.rec = null; refreshStatus(); return toast('Micro indisponible pour le moment : touche « Micro coupé » pour réessayer.', 'warning'); }
  refreshStatus();
  broadcast();
}
// forget = false : coupure voulue par l'appli (pause, fin de séance) ; la préférence reste pour la prochaine séance.
function stopEar(forget = true) {
  const rec = mic.rec;
  mic.rec = null;
  mic.wanted = false;
  if (forget) { state.voiceInput = false; save(); }
  try { rec?.stop(); } catch { /* déjà arrêté */ }
  refreshStatus();
  broadcast();
}

// Phrases de commande : une liste fermée, que ni le coach ni l'écran ne prononcent jamais (vérifié avant chaque annonce, voir speak).
// Valider demande le nombre suivi de « validées » : un nombre seul, ou une bribe d'annonce, ne valide plus rien.
const COMMANDS = [
  { id: 'valider', say: 'dix répétitions validées', help: 'valide la série à 10 répétitions' },
  { id: 'telle', say: 'série validée', help: 'valide la série telle qu’affichée (compte du miroir)' },
  { id: 'annuler', say: 'annuler la série', help: 'retire la dernière série' },
  { id: 'passer', say: 'passer le repos', help: 'termine le repos' },
  { id: 'rallonger', say: 'plus trente', help: 'ajoute 30 secondes de repos' },
  { id: 'prochain', say: 'prochain exercice', help: 'passe à l’exercice suivant' },
  { id: 'ressenti', say: 'c’était facile (bien, dur, douloureux)', help: 'note le ressenti en fin d’exercice et passe au suivant' },
  { id: 'pause', say: 'mets en pause', help: 'met la séance en pause' },
  { id: 'terminer', say: 'terminer la séance', help: 'enregistre la séance quand toutes les séries sont faites' },
];
const FEELINGS = { facile: 'easy', bien: 'ok', dur: 'hard', difficile: 'hard', douloureux: 'pain' };
// Tolérant à ce que renvoie la reconnaissance (accents, « validé / validées / valider », mots en plus, chiffres ou lettres) :
// une commande = ses mots-clés, que les annonces ne contiennent jamais. Retourne { id, n?, feel? } ou null.
const plain = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['’]/g, ' ').replace(/[^a-z0-9 -]/g, ' ').replace(/\s+/g, ' ').trim();
function commandIn(text) {
  const t = plain(text), has = (re) => re.test(t);
  if (!t) return null;
  if (has(/\bvalid/)) { const n = numberIn(t); return n ? { id: 'valider', n } : has(/\bseries?\b/) ? { id: 'telle' } : null; }
  if (has(/\bannul/)) return { id: 'annuler' };
  if (has(/\bpass/) && has(/\brepos\b/)) return { id: 'passer' };
  if (has(/\bplus\b/) && has(/\b(30|trente)\b/)) return { id: 'rallonger' };
  if (has(/\bprochain/)) return { id: 'prochain' };
  const feel = has(/\b(c etait|ressenti)\b/) && Object.keys(FEELINGS).find((w) => has(new RegExp(`\\b${w}\\b`)));
  if (feel) return { id: 'ressenti', feel };
  if (has(/\bpause\b/) && has(/\b(mets|mettre|met)\b/)) return { id: 'pause' };
  if (has(/\btermin/) && has(/\bseance\b/)) return { id: 'terminer' };
  return null;
}

// Une phrase d'annonce contient-elle une commande (en entier, ou une de ses phrases) ? Sert de garde-fou à speak et à l'écran.
const saysCommand = (text) => [text, ...String(text).split(/[.!?:;,]/)].some((part) => commandIn(part));

function hear(text, alternatives = [text]) {
  if (!state.active || ui.view !== 'session') return;
  if (!plain(text)) return;
  if (Date.now() < mic.quietUntil || Date.now() - mic.spokeAt < 1200) return heard(text, 'pendant une annonce');
  // La première variante de la reconnaissance qui forme une commande connue.
  const alt = alternatives.find((a) => commandIn(a));
  if (!alt) return heard(text, 'phrase inconnue');
  const cmd = commandIn(alt);
  const items = activeItems();
  const i = Math.min(ui.at ?? nextItem(items), items.length);
  const x = items[i];
  if (cmd.id === 'annuler') {
    const last = journal().findLast((y) => y.session === state.active.session && y.type === 'set');
    heard(alt, last ? '' : 'aucune série');
    return last && undoSet(last);
  }
  if (cmd.id === 'passer' || cmd.id === 'rallonger') {
    heard(alt, rest ? '' : 'pas de repos en cours');
    if (rest) cmd.id === 'passer' ? stopRest() : extendRest(30);
    return;
  }
  if (cmd.id === 'pause') { heard(alt); return pause(); }
  if (cmd.id === 'terminer') {
    if (nextItem(items) < items.length) return heard(alt, 'il reste des séries'); // on ne termine pas par erreur
    heard(alt);
    closeSession();
    show('week');
    announce('Séance enregistrée. Beau travail !');
    return toast('Séance enregistrée', 'success');
  }
  if (cmd.id === 'prochain') { heard(alt); return goToItem(i + 1); }
  if (cmd.id === 'ressenti') {
    if (!x || nextSet(x)) return heard(alt, 'termine d’abord les séries de l’exercice');
    heard(alt);
    const feel = FEELINGS[cmd.feel];
    if (feel === 'pain') return onFeel(x.e, 'pain', state.active.day, x.k, []);
    record({ type: 'feel', ex: x.e.id, feel });
    tick(660);
    return goToItem(i + 1);
  }
  const f = focusTarget();
  if (!f) return heard(alt, 'aucune série à valider');
  if (rest) return heard(alt, 'pendant le repos'); // la série suivante n'est pas encore faite
  if (cmd.id === 'telle') { heard(alt); return voiceValidate(f, f.pick.reps); }
  if (!(cmd.n > 0 && cmd.n <= 100)) return heard(alt, 'nombre pas compris');
  heard(alt);
  voiceValidate(f, cmd.n);
}
function numberIn(t) {
  const words = t.replace(/[.,!?]/g, ' ').split(/\s+/).filter(Boolean);
  return Number((t.match(/\d+/) || [])[0]) || WORDS[words.join('-')] || words.map((w) => WORDS[w] || ({ dis: 10, dit: 10 })[w]).find(Boolean) || 0;
}
// Ce que le micro a compris, sous la barre d'état : « Entendu : « dix » », ou pourquoi c'est ignoré.
// Repris sur l'écran projeté seulement si la phrase contient une commande : ni bavardage, ni écho des annonces.
function heard(text, why = '') {
  mic.lastHeard = { said: text.trim(), text: `Entendu : « ${text.trim()} »${why ? ` · ignoré, ${why}` : ''}`, why, cmd: !!commandIn(text), t: Date.now() };
  broadcast();
  const node = document.querySelector('.heard');
  if (!node) return;
  node.textContent = mic.lastHeard.text;
  node.classList.toggle('ignored', !!why);
}
// Les phrases que comprend le micro, rappelées d'un geste.
function voiceHelp() {
  choose({ title: 'Ce que comprend le micro', text: 'Dis la phrase telle quelle, après ta série. Le coach et l’écran ne la prononcent jamais.',
    extra: h('div', { className: 'list' }, COMMANDS.map((c) => h('div', { className: 'line' }, h('span', { className: 'stack tight' }, h('strong', {}, `« ${c.say} »`), h('span', { className: 'caption' }, c.help))))),
    actions: [{ label: 'Fermer', value: null }] });
}

function goToItem(i) {
  ui.at = Math.min(i, activeItems().length);
  ui.pick = null;
  render();
}
// Validée à la voix : bip, puis confirmation sur l'écran (« Série 2 validée · 10 rép. ») et à voix haute, pour savoir que c'est compris.
function voiceValidate(f, reps) {
  f.pick.reps = reps;
  f.pick.touched = true;
  tick(660);
  link.lastNotice = { id: String(Date.now()), text: `Série ${f.n} validée · ${repsText(f.x.e, reps)}`, t: Date.now() };
  const said = link.lastSay;
  validateSet(f);
  // Micro ouvert : le nombre est sur l'écran, pas dans la voix. Record ou dernière série déjà annoncés : on ne les coupe pas.
  if (link.lastSay === said) announce(f.n % 2 ? "C'est noté." : 'Parfait.');
}
