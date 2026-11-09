// --- Échauffement guidé ---
// 5 minutes avant la première série : un mouvement général, la mobilité des zones travaillées aujourd'hui, puis le dos.
// Chaque mouvement est minuté et annoncé ; sur l'écran projeté, il s'affiche comme un repos (anneau, mouvement suivant).
const WARMUP = [
  { name: 'Marche sur place, genoux hauts', s: 60, cue: 'Monte les genoux, bras actifs, respire calmement.', mus: [10, 8], for: 'all' },
  { name: 'Moulinets des bras', s: 30, cue: "Grands cercles lents, vers l'avant puis vers l'arrière.", mus: [2], for: 'upper' },
  { name: "Écartés à l'élastique léger", s: 40, cue: "Bras tendus devant toi, écarte jusqu'à la poitrine en serrant les omoplates.", mus: [2, 9], for: 'upper', eq: 'elastique' },
  { name: 'Pompes inclinées, lentes', s: 40, cue: 'Mains sur le banc, corps gainé, descends doucement.', mus: [4, 5], for: 'upper', eq: 'banc' },
  { name: 'Squats au poids du corps, lents', s: 40, cue: "Descends en 3 secondes, genoux dans l'axe des pieds.", mus: [10, 8], for: 'lower' },
  { name: 'Fentes arrière alternées', s: 40, cue: 'Grand pas en arrière, buste droit, genou avant au-dessus de la cheville.', mus: [10, 8], for: 'lower' },
  { name: 'Cercles de hanches', s: 30, cue: "Mains sur les hanches, grands cercles dans un sens puis dans l'autre.", mus: [8], for: 'lower' },
  { name: 'Chat-vache à quatre pattes', s: 30, cue: 'Arrondis puis creuse le dos, lentement, au rythme de ta respiration.', mus: [16], for: 'all' },
];
const UPPER = ['chest', 'back', 'shoulders', 'biceps', 'triceps'], LOWER = ['quad', 'hinge', 'calves'];
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
let warm = null; // { list, i, end, total, timer }

function warmupPlan() {
  const zones = new Set(activeItems().map((x) => x.e.zone));
  const want = { all: true, upper: UPPER.some((z) => zones.has(z)), lower: LOWER.some((z) => zones.has(z)) };
  return WARMUP.filter((m) => want[m.for] && (!m.eq || state.config.equipment.includes(m.eq)));
}
const warmMinutes = () => Math.round(warmupPlan().reduce((t, m) => t + m.s, 0) / 60);

function startWarm() {
  audio ||= new (window.AudioContext || window.webkitAudioContext)(); // créé au geste : iOS n'autorise le son qu'après
  audio.resume?.();
  warm = { list: warmupPlan(), i: -1 };
  nextWarm();
}
function nextWarm() {
  clearInterval(warm.timer);
  warm.i++;
  if (warm.i >= warm.list.length) {
    warm = null;
    speak('Échauffement fini. On attaque les séries.');
    toast('Échauffement terminé', 'success');
    render();
    return;
  }
  const m = warm.list[warm.i];
  warm.total = m.s * 1000;
  warm.end = Date.now() + warm.total;
  // Projeté : l'écran annonce le mouvement suivant à la fin du précédent ; le premier passe par announce().
  const text = micOpen() ? `${m.name}. ${m.cue}` : `${m.name}, ${m.s} secondes. ${m.cue}`;
  if (warm.i === 0) announce(text); else speak(text);
  warm.timer = setInterval(() => {
    const left = Math.ceil((warm.end - Date.now()) / 1000);
    document.querySelectorAll('.warm-time').forEach((el) => { el.textContent = mmss(Math.max(0, left)); });
    if (left > 0) return;
    if (!projected()) beep(audio);
    nextWarm();
  }, 250);
  render();
}
function stopWarm() {
  if (!warm) return;
  clearInterval(warm.timer);
  warm = null;
  render();
}

function warmCard() {
  const m = warm.list[warm.i], next = warm.list[warm.i + 1];
  return h('section', { className: 'card focus-card' },
    h('div', { className: 'stack tight center' },
      h('div', {}, h('span', { className: 'badge' }, `Échauffement · ${warm.i + 1} sur ${warm.list.length}`)),
      h('h2', { className: 'title' }, m.name), h('p', { className: 'meta' }, m.cue)),
    h('div', { className: 'focus-rest', role: 'timer' },
      h('strong', { className: 'rest-time warm-time' }, mmss(Math.max(0, Math.ceil((warm.end - Date.now()) / 1000)))),
      h('div', { className: 'row' }, button('Passer', nextWarm, { variant: 'gray', size: 'compact' }), button('Arrêter', stopWarm, { variant: 'gray', size: 'compact' }))),
    next && h('p', { className: 'caption center' }, `Ensuite : ${next.name} · ${next.s} s`));
}
const warmButton = () => button(`Échauffement guidé · ${warmMinutes()} min`, startWarm, { variant: 'tinted', icon: 'flame' });
