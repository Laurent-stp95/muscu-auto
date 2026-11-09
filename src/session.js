// --- Séance ---

async function start(d) {
  if (state.active && state.active.day !== d) {
    if (!await ask({ title: 'Une séance est déjà en cours', text: 'Elle sera terminée et enregistrée avant de commencer celle-ci.', confirm: 'Terminer et commencer' })) return;
    closeSession();
  }
  if (!state.active) {
    const ahead = weekFrame().focus.nextWeek; // plus rien cette semaine : la séance compte pour la suivante
    const fit = await fitnessCheck(state.plan[d]);
    if (!fit) return;
    state.active = { session: new Date().toISOString(), day: d, readiness: fit.level, off: daysOff(journal()) };
    if (fit.minutes) {
      state.active.express = fit.minutes;
      state.active.cut = express(EXOS, state.plan[d].items.map((item) => effective(item, true)), fit.minutes);
    }
    // Dans le même geste que « Commencer » : l'écran bascule, le micro s'ouvre (iOS n'autorise le micro qu'après un geste).
    if (state.screen && fit.project !== state.screen.on) {
      state.screen.on = fit.project;
      if (fit.project) { link.delay = 1000; connectScreen(); } else { link.socket?.close(); setTv(0); }
    }
    if (fit.voice) startEar(); else if (state.voiceInput) { state.voiceInput = false; }
    ui.at = ui.pick = ui.weekPick = null;
    record({ type: 'start', day: state.plan[d].day, name: state.plan[d].name, ...(ahead && { week: monday(new Date(Date.now() + 7 * 864e5)).toISOString() }) });
    record({ type: 'readiness', sleep: fit.sleep, soreness: fit.soreness, energy: fit.energy, level: fit.level });
  } else if (state.active.paused) resume();
  show('session');
}

// Point de forme : 3 questions, réponses « tout va bien » déjà cochées. 0-1 = normal, 2-3 = pas d'augmentation, 4+ = séance allégée.
const FITNESS = [['sleep', 'Sommeil', ['Bien', 'Moyen', 'Mal']], ['soreness', 'Courbatures', ['Aucune', 'Légères', 'Fortes']], ['energy', 'Énergie', ['Bonne', 'Moyenne', 'Faible']]];
async function fitnessCheck(s) {
  const answers = { sleep: 0, soreness: 0, energy: 0, minutes: null };
  const groups = FITNESS.map(([key, label, options]) => {
    const buttons = options.map((option, i) => chip(option, i === 0, () => {
      answers[key] = i;
      buttons.forEach((b, n) => { b.ariaPressed = String(n === i); });
    }));
    return h('div', { className: 'group' }, h('span', { className: 'label' }, label), h('div', { className: 'chips' }, buttons));
  });
  // Séance express : seulement les durées plus courtes que la séance complète estimée.
  const full = sessionMinutes(s.items.map((item) => effective(item)));
  const times = [[null, `Complète · ${full} min`], ...[30, 20].filter((m) => m < full - 5).map((m) => [m, `${m} min`])];
  const timeButtons = times.map(([m, label], i) => chip(label, i === 0, () => {
    answers.minutes = m;
    timeButtons.forEach((b, n) => { b.ariaPressed = String(n === i); });
  }));
  if (times.length > 1) groups.push(h('div', { className: 'group' }, h('span', { className: 'label' }, 'Temps disponible'), h('div', { className: 'chips' }, timeButtons)));
  // Écran et micro activés en même temps que la séance, d'un seul geste ; le choix est gardé pour la prochaine fois.
  answers.project = !!state.screen?.on;
  answers.voice = !!state.voiceInput && !!Recognition;
  const options = [state.screen && toggle("Projeter sur l'écran", answers.project, (v) => { answers.project = v; }),
    Recognition && toggle('Valider à la voix', answers.voice, (v) => { answers.voice = v; })].filter(Boolean);
  if (options.length) groups.push(h('div', { className: 'list' }, options));
  const go = await choose({
    title: 'Comment tu te sens ?', text: "La séance s'adapte si ça va moins bien.", extra: h('div', { className: 'stack' }, groups),
    actions: [{ label: 'Commencer la séance', value: true, variant: 'primary' }, { label: 'Annuler', value: null }],
  });
  if (!go) return null;
  const score = answers.sleep + answers.soreness + answers.energy;
  return { ...answers, level: score >= 4 ? 'light' : score >= 2 ? 'hold' : 'normal' };
}

// « Séance express (30 min) : 2 exercices retirés, séries réduites. »
function expressText() {
  const items = state.plan[state.active.day].items;
  const dropped = items.filter((it) => state.active.cut?.[it.ex] === 0).length;
  const fewer = items.some((it) => state.active.cut?.[it.ex] > 0 && state.active.cut[it.ex] < it.sets);
  const parts = [dropped && `${plural(dropped, 'exercice retiré', 'exercices retirés')}`, fewer && 'séries réduites'].filter(Boolean);
  return `Séance express (${state.active.express} min)${parts.length ? ` : ${parts.join(', ')}` : ''}. Les mouvements principaux restent entiers.`;
}

// Historique d'un exercice, relu une seule fois par état du journal (il ne fait que grandir, ou change d'objet à l'import).
let histories = { log: null, n: 0, byEx: new Map(), clean: null };
function syncHistoryCache() { if (histories.log !== log || histories.n !== log.length) histories = { log, n: log.length, byEx: new Map(), clean: null }; }
function historyOf(id) {
  syncHistoryCache();
  if (!histories.byEx.has(id)) histories.byEx.set(id, exerciseHistory(log, id));
  return histories.byEx.get(id);
}
// Journal tel qu'on le lit : sans les séries annulées (le journal enregistré, lui, garde tout).
function journal() {
  syncHistoryCache();
  return (histories.clean ||= withoutUndone(log));
}

const sessionSets = (sid) => {
  const sets = new Map();
  for (const x of journal()) if (x.session === sid && x.type === 'set') sets.set(`${x.ex}-${x.set}`, x);
  return sets;
};

// Durée d'effort : de l'ouverture à maintenant (ou au début de la pause en cours), pauses déduites.
function activeMinutes(sid) {
  let paused = 0, since = null, end = null;
  for (const x of log) {
    if (x.session !== sid) continue;
    if (x.type === 'pause') since = Date.parse(x.t);
    if (x.type === 'resume' && since) { paused += Date.parse(x.t) - since; since = null; }
    if (x.type === 'end') end = Date.parse(x.t); // séance terminée : sa durée s'arrête là
  }
  return Math.max(1, Math.round(((since ?? end ?? Date.now()) - Date.parse(sid) - paused) / 60000));
}

// Bilan : séries faites, durée d'effort, volume, exercices pas commencés.
function sessionSummary() {
  const sid = state.active.session;
  const s = state.plan[state.active.day];
  const sets = sessionSets(sid);
  const planned = s.items.reduce((n, it) => n + effective(it, true).sets, 0); // 0 pour un exercice retiré (séance express)
  const volume = Math.round([...sets.values()].reduce((v, x) => v + (x.kg || 0) * x.reps, 0));
  const skipped = s.items.filter((it) => effective(it, true).sets > 0 && ![...sets.values()].some((x) => x.ex === it.ex)).map((it) => byId.get(it.ex).name);
  const prs = [...sets.values()].filter((x) => x.pr && byId.has(x.ex)).map((x) => `${byId.get(x.ex).name} : ${setText(byId.get(x.ex), x.kg, x.reps)}`);
  const stat = (value, label) => h('div', { className: 'stat' }, h('strong', {}, value), h('span', { className: 'caption' }, label));
  return h('div', { className: 'stack' },
    h('div', { className: 'stats' }, stat(`${sets.size}/${planned}`, planned > 1 ? 'séries' : 'série'), stat(`${activeMinutes(sid)} min`, 'effort'), stat(volume.toLocaleString('fr-FR'), 'kg soulevés')),
    prs.length > 0 && h('p', { className: 'note' }, icon('flag'), `${prs.length > 1 ? 'Records' : 'Record'} : ${prs.join(' · ')}`),
    skipped.length > 0 && h('p', { className: 'caption' }, `${skipped.length > 1 ? 'Pas commencés' : 'Pas commencé'} : ${skipped.join(', ')}.`));
}

// Pause : minuteur coupé, écran libre de s'éteindre, temps de pause hors durée. Réversible, donc sans confirmation.
function pause() {
  if (warm) { clearInterval(warm.timer); warm = null; }
  stopEar(false);
  record({ type: 'pause' });
  state.active.paused = new Date().toISOString();
  stopRest();
  wakeLock?.release().catch(() => {});
  wakeLock = null;
  save();
  render();
  scrollTo(0, 0);
}

function resume() {
  record({ type: 'resume' });
  delete state.active.paused;
  save();
  if (state.voiceInput && Recognition) startEar();
}

// Arrêter : terminer (enregistrée), abandonner (marquée, ignorée dans le suivi, annulable 5 s) ou continuer.
async function stopSession() {
  const choice = await choose({
    title: 'Arrêter la séance ?',
    text: 'Terminer enregistre tes séries. Abandonner retire la séance de ton suivi.',
    extra: sessionSummary(),
    actions: [
      { label: 'Terminer et enregistrer', value: 'end', variant: 'primary' },
      { label: 'Abandonner sans enregistrer', value: 'cancel', variant: 'gray destructive' },
      { label: 'Continuer la séance', value: null }],
  });
  if (choice === 'end') finishSession();
  if (choice === 'cancel') abandonSession();
}
function abandonSession() {
  const active = { ...state.active };
  record({ type: 'cancel' });
  closeSession();
  show('week');
  toast('Séance abandonnée', 'info', () => {
    state.active = active;
    record({ type: 'restore' });
    save();
    show('session');
  });
}

// Séance restée ouverte (iPhone verrouillé puis oublié) : passé 6 h sans aucune saisie, on demande quoi en faire, une fois par
// ouverture de l'appli. Enregistrée, sa durée s'arrête à la dernière saisie, pas à maintenant.
let staleAsked = false;
async function staleSession() {
  if (!state.active || staleAsked) return;
  const sid = state.active.session, last = log.findLast((x) => x.session === sid);
  if (!last || Date.now() - Date.parse(last.t) < 6 * 3600e3) return;
  staleAsked = true;
  const s = state.plan[state.active.day], sets = sessionSets(sid).size, at = new Date(last.t);
  const yesterday = new Date(Date.now() - 864e5).toDateString();
  const day = at.toDateString() === today() ? "aujourd'hui" : at.toDateString() === yesterday ? 'hier' : DAYS[weekday(at)].toLowerCase();
  const choice = await choose({ title: 'Séance restée ouverte',
    text: `${DAYS[s.day]} · ${s.name} : rien d'enregistré depuis ${day} à ${clock(last.t)}${sets ? `, ${plural(sets, 'série')} faite${sets > 1 ? 's' : ''}` : ', aucune série'}.`,
    actions: [sets && { label: 'Enregistrer la séance', value: 'end', variant: 'primary' },
      { label: sets ? 'Abandonner sans enregistrer' : 'Abandonner', value: 'cancel', variant: 'gray destructive' },
      { label: 'Reprendre la séance', value: null }].filter(Boolean) });
  if (choice === 'end') {
    closeSession(last.t);
    show('week');
    toast('Séance enregistrée', 'success');
  }
  if (choice === 'cancel') abandonSession();
}

// at : heure de fin à retenir (séance restée ouverte : sa dernière saisie), sinon maintenant.
function closeSession(at) {
  const s = state.plan[state.active.day];
  ui.weekPick = null;
  record({ type: 'end', ...(at && { t: at }) });
  state.ended = { t: Date.now(), title: `${DAYS[s.day]} · ${s.name}`, summary: summaryData(activeItems()) };
  if (warm) { clearInterval(warm.timer); warm = null; }
  stopEar(false);
  state.active = null;
  stopRest();
  wakeLock?.release().catch(() => {});
  wakeLock = null;
  save();
  cloudBackup();
  syncPush();
}

// Fin de séance : bilan plein écran, comme sur l'écran projeté. Toutes les séries faites, on y arrive sans passer par « Arrêter ».
const allDone = () => nextItem(activeItems()) >= activeItems().length;
function finishSession() {
  const ahead = !!log.findLast((x) => x.type === 'start' && x.session === state.active.session)?.week;
  closeSession();
  ui.finished = { ...state.ended, ahead };
  show('done');
  const n = state.ended.summary.records.length;
  announce(n ? `Séance enregistrée, avec ${n > 1 ? 'des records' : 'un record'}. Beau travail !` : 'Séance enregistrée. Beau travail !');
}
// Records en avant, semaine qui avance d'un segment, prochaine séance. Une seule action.
function finishScreen() {
  const f = ui.finished;
  if (!f) { ui.view = 'week'; return week(); }
  const { stats, records } = f.summary;
  const plan = state.plan, { done, cards, focus } = weekFrame(), next = plan[focus.index];
  const stat = (value, label) => h('div', { className: 'stat' }, h('strong', {}, value), h('span', { className: 'caption' }, label));
  return h('div', { className: 'screen' },
    h('header', { className: 'finish-head' }, h('span', { className: 'finish-mark' }, icon('check')), h('h1', {}, 'Séance terminée'), h('p', { className: 'meta' }, f.title)),
    h('div', { className: 'stats' }, stats.map(([value, label]) => stat(value, label))),
    records.length > 0 && h('section', { className: 'card finish-records' },
      h('div', { className: 'banner-head' }, icon('flag'), h('h2', {}, records.length > 1 ? `${records.length} records` : 'Nouveau record')),
      h('div', { className: 'stack tight' }, records.map((r) => h('p', {}, r)))),
    // Séance faite en avance : c'est la semaine suivante qui avance d'un segment.
    f.ahead ? weekProgress(plan, cards, { ...focus, nextWeek: false }, 'Semaine prochaine') : weekProgress(plan, done, focus),
    (f.ahead || !focus.nextWeek) && !cards.has(next.day) && h('p', { className: 'meta center' }, `Prochaine séance : ${DAYS[next.day].toLowerCase()} · ${next.name}`),
    button('Terminé', () => { ui.finished = null; show('week'); }, { variant: 'primary', size: 'large' }));
}

function pausedScreen(s) {
  const since = clock(state.active.paused);
  return h('div', { className: 'screen' },
    h('header', { className: 'top' }, h('h1', {}, `${DAYS[s.day]} · ${s.name}`)),
    h('section', { className: 'card empty' }, icon('pause'), h('h2', { className: 'title' }, 'Séance en pause'),
      h('p', { className: 'meta' }, `Depuis ${since}. Le minuteur est coupé et le temps de pause ne compte pas dans la durée.`),
      sessionSummary(),
      h('div', { className: 'stack', style: 'width: 100%' },
        button('Reprendre', () => { resume(); render(); }, { variant: 'primary', size: 'large', icon: 'play' }),
        button('Arrêter la séance', stopSession, { variant: 'gray', size: 'large' }))));
}

function session() {
  const s = state.plan[state.active.day];
  if (state.active.paused) return pausedScreen(s);
  const list = !!state.listMode;
  const warmBanner = () => (warm ? warmCard() : banner('flame', `Échauffement · ${warmMinutes()} min`,
    h('p', {}, "Un mouvement général puis la mobilité des zones du jour, guidés et minutés. Les séries d'approche sont indiquées sur chaque mouvement lourd."),
    h('div', {}, warmButton())));
  // Barre collante : Pause et Arrêter restent à portée pendant tout le défilement.
  return h('div', { className: 'screen' },
    h('header', { className: 'navbar' },
      button('Pause', pause, { variant: 'plain', icon: 'pause', className: 'btn plain start' }),
      h('h1', {}, `${DAYS[s.day]} · ${s.name}`),
      button('Arrêter', stopSession, { variant: 'plain', className: 'btn plain end destructive' })),
    segmented([[false, 'Une série à la fois'], [true, 'Toute la séance']], list, (v) => { state.listMode = v; ui.pick = null; save(); render(); }),
    statusBar(list),
    cycle().deload && h('p', { className: 'note' }, icon('leaf'), 'Semaine allégée : moitié moins de séries, charges −10 %.'),
    state.active.readiness === 'hold' && h('p', { className: 'note' }, icon('info'), "Forme moyenne : pas d'augmentation de charge aujourd'hui."),
    state.active.readiness === 'light' && h('p', { className: 'note' }, icon('leaf'), 'Forme basse : séance allégée, moitié moins de séries et charges −10 %. Écoute ton corps.'),
    state.active.express && h('p', { className: 'note' }, icon('timer'), expressText()),
    comeback(state.active.off) && h('p', { className: 'note' }, icon('leaf'), `Reprise après ${state.active.off} jours sans séance : charges réduites aujourd'hui, pour repartir sans te blesser.`),
    list ? [warmBanner(), s.items.map((item, i) => effective(item, true).sets > 0 && block(item, state.active.day, i)),
      // Fin de liste = fin de séance : le bouton est là où on en a besoin, sans remonter.
      allDone() ? button('Enregistrer la séance', finishSession, { variant: 'primary', size: 'large', icon: 'check' }) : button('Terminer la séance', stopSession, { variant: 'primary', size: 'large' })]
      : warm ? warmCard()
      : [!sessionSets(state.active.session).size && h('div', { className: 'stack' }, h('p', { className: 'note' }, icon('flame'), `Avant la première série, échauffe-toi : ${warmMinutes()} minutes guidées et minutées.`), warmButton()),
        focusView(s, state.active.day)]);
}

// Contrôle segmenté iOS : options = [[valeur, libellé]]. value undefined : pas d'aria-pressed (onglets, voir tabs).
function segmented(options, value, onPick) {
  return h('div', { className: 'seg' }, options.map(([v, label]) => h('button', { type: 'button', className: 'seg-tab', ariaPressed: value === undefined ? null : String(v === value), onclick: () => onPick(v) }, label)));
}

// Exercices de la séance en cours, sans ceux que la séance express retire ; k = place dans le programme (douleur, Remplacer).
const activeItems = () => state.plan[state.active.day].items.map((item, k) => ({ ...exercise(item), k })).filter((x) => x.it.sets > 0);

// Tout ce qu'il faut pour un exercice de la séance en cours : conseil du jour, historique, séries déjà faites.
function exercise(item) {
  const e = byId.get(item.ex);
  const sid = state.active.session;
  const it = effective(item, true);
  const all = historyOf(e.id);
  const past = all.filter((x) => x.session !== sid);
  const fit = state.active.readiness;
  const tip = suggest(e, it, past, { loads: state.config.loads, learned: learned(log, e.id, past), deload: cycle().deload || fit === 'light', hold: fit === 'hold', comeback: comeback(state.active.off) });
  const done = new Map((all.find((x) => x.session === sid)?.sets || []).map((x) => [x.set, x]));
  return { e, it, past, tip, done };
}
// Prochaine série d'un exercice (la première pas encore validée), null si toutes sont faites.
const nextSet = (x) => Array.from({ length: x.it.sets }, (_, k) => k + 1).find((k) => !x.done.has(k)) ?? null;
// Exercice en cours : le premier qui a encore une série à faire (items.length = tout est fait).
const nextItem = (items) => { const i = items.findIndex((x) => nextSet(x) != null); return i < 0 ? items.length : i; };
// Charge de départ d'une série : celle de la série précédente du jour, sinon la charge conseillée.
// Répétitions prévues d'une série de l'exercice x, à la charge kg (null : poids du corps).
const plannedReps = (x, kg, n) => targetReps(x.it, x.past, kg, n, x.e.unit);
const startKg = (x) => (isBodyweight(x.e) ? null : [...x.done.values()].at(-1)?.kg ?? x.tip.kg);

// Prochaine série à faire de la séance en cours : { x, i, n, kg, reps }, null si tout est fait.
function upNext() {
  const items = activeItems();
  const i = nextItem(items);
  if (i >= items.length) return null;
  const x = items[i], n = nextSet(x), kg = startKg(x);
  return { x, i, n, kg, reps: plannedReps(x, kg, n) };
}
