// --- Minuteur de repos et écran allumé ---
// Une appli web iPhone ne peut ni vibrer ni notifier sans serveur : le son ne joue que si l'écran reste allumé.

let audio = null, rest = null, restEnd = 0, restTotal = 0, restPushed = false, wakeLock = null;
const restBar = h('div', { className: 'rest', hidden: true, role: 'timer' });

// Record : quatre notes montantes, à ne pas confondre avec les bips de série ou de repos.
function fanfare() {
  if (!audio) return;
  [523, 659, 784, 1047].forEach((freq, i) => {
    const osc = audio.createOscillator(), gain = audio.createGain(), at = audio.currentTime + i * 0.11;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.22, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + (i === 3 ? 0.5 : 0.18));
    osc.connect(gain).connect(audio.destination);
    osc.start(at);
    osc.stop(at + 0.55);
  });
}

// Bip court du métronome : grave pendant la descente, aigu pour remonter.
function tick(freq) {
  if (!audio) return;
  const osc = audio.createOscillator(), gain = audio.createGain();
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.25, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.09);
  osc.connect(gain).connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + 0.1);
}

function startRest(seconds) {
  // Créé au premier ✓ : iOS n'autorise le son qu'après un geste.
  audio ||= new (window.AudioContext || window.webkitAudioContext)();
  audio.resume?.();
  restPushed = false; // le nouvel envoi remplace l'ancien côté serveur : pas d'annulation qui pourrait arriver après lui
  stopRest();
  const end = Date.now() + seconds * 1000;
  restEnd = end;
  restTotal = seconds * 1000;
  // Prévenu tout de suite, appli active : au verrouillage de l'écran, iOS la suspend avant qu'une requête parte.
  // « Repos en cours, reprends à … » part 5 s après si l'écran a été verrouillé dans les 3 premières secondes.
  const started = Date.now();
  let notice = false;
  if (pushOn() && state.config.notify?.rest !== false) {
    restPushed = notice = true;
    const label = new Date(end).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    pushCall('POST', '/rest', { at: end, notice: started + 5000, label }).catch(() => { restPushed = notice = false; });
  }
  const time = h('span', {});
  restBar.replaceChildren(time, button('Passer', stopRest, { size: 'compact' }));
  const tick = () => {
    const left = Math.ceil((end - Date.now()) / 1000);
    const visible = document.visibilityState === 'visible';
    // Appli toujours à l'écran après 3 s : pas besoin d'annoncer l'heure de fin.
    if (notice && restPushed && visible && Date.now() - started >= 3000) { notice = false; pushCall('DELETE', '/rest/notice').catch(() => {}); }
    // Appli toujours à l'écran juste avant la fin : le bip suffit, on annule la notification.
    if (restPushed && left <= 3 && visible) { restPushed = false; pushCall('DELETE', '/rest').catch(() => {}); }
    if (left > 0) {
      time.textContent = `Repos ${restClock()}`;
      document.querySelectorAll('.rest-time').forEach((el) => { el.textContent = restClock(); });
      return;
    }
    stopRest();
    // Écran projeté connecté : c'est lui qui sonne et annonce, l'iPhone reste silencieux.
    const said = restSay();
    hush(said);
    if (!projected()) { beep(audio); speak(said); }
    toast('Repos terminé : série suivante.', 'timer');
  };
  rest = setInterval(tick, 250);
  restBar.hidden = false;
  tick();
  broadcast();
}

function stopRest() {
  clearInterval(rest);
  rest = null;
  restBar.hidden = true;
  document.querySelector('.focus-rest')?.remove();
  broadcast();
  if (restPushed) { restPushed = false; pushCall('DELETE', '/rest').catch(() => {}); }
}

const restClock = () => { const left = Math.max(0, Math.ceil((restEnd - Date.now()) / 1000)); return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; };
const extendRest = (seconds) => startRest(Math.ceil((restEnd - Date.now()) / 1000) + seconds);

// Annonce de fin de repos : la série qui suit, ou l'exercice suivant. La tournure varie d'une série à l'autre, mais reste la même
// pour une série donnée (restSay est recalculée à chaque envoi vers l'écran projeté).
const ORDINALS = ['Première', 'Deuxième', 'Troisième', 'Quatrième', 'Cinquième', 'Sixième', 'Septième', 'Huitième', 'Neuvième', 'Dixième'];
const vary = (list, seed) => list[Math.abs(seed) % list.length];
function restSay() {
  const u = upNext();
  if (!u) return 'Repos terminé.';
  const seed = u.n + u.x.e.id, last = u.n === u.x.it.sets;
  // Micro ouvert : sans aucun nombre (série, répétitions, charge restent affichés sur l'écran).
  if (micOpen()) return u.n === 1 ? `On enchaîne : ${u.x.e.name}.` : last ? 'Dernière série, à toi.' : vary(["C'est reparti, à toi.", 'Allez, on y retourne.', 'À toi de jouer.'], seed);
  const what = setSpeech(u.x.e, u.kg, u.reps);
  if (u.n === 1) return `${vary(['On enchaîne', 'Nouvel exercice'], seed)} : ${u.x.e.name}. ${what[0].toUpperCase()}${what.slice(1)}.`;
  const which = last ? 'Dernière série' : ORDINALS[u.n - 1] ? `${ORDINALS[u.n - 1]} série` : `Série ${u.n}`;
  return `${vary(["C'est reparti", 'Allez, on y retourne', 'À toi'], seed)}. ${which}, ${what}.`;
}

async function keepAwake() {
  if (!state.active || state.active.paused || wakeLock || !navigator.wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { /* refusé (batterie faible) : l'écran s'éteindra normalement */ }
}
