// --- Fiche d'un exercice : images ou vidéo, consignes, muscles ---

// Onglets ARIA : un seul panneau construit à la fois (la vidéo ne charge qu'à l'ouverture), flèches pour naviguer.
// Même barre que le contrôle segmenté (segmented), sans aria-pressed : rôles tablist / tab et aria-selected à la place.
function tabs(segments) {
  if (segments.length === 1) return segments[0][1]();
  const bar = segmented(segments.map(([label], i) => [i, label]), undefined, (i) => select(i));
  const panel = h('div', { className: 'seg-panel' });
  bar.setAttribute('role', 'tablist');
  panel.setAttribute('role', 'tabpanel');
  const buttons = [...bar.children];
  buttons.forEach((b) => b.setAttribute('role', 'tab'));
  function select(i, focus) {
    buttons.forEach((b, n) => { b.setAttribute('aria-selected', String(n === i)); b.tabIndex = n === i ? 0 : -1; });
    panel.setAttribute('aria-label', segments[i][0]);
    panel.replaceChildren(segments[i][1]());
    if (focus) buttons[i].focus();
  }
  bar.onkeydown = (ev) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[ev.key];
    if (!step) return;
    const current = buttons.findIndex((b) => b.tabIndex === 0);
    select((current + step + buttons.length) % buttons.length, true);
  };
  select(0);
  return h('div', { className: 'segments' }, bar, panel);
}

// Repli dont le contenu n'est construit qu'à la première ouverture : rien à créer ni à charger tant qu'on ne regarde pas.
function lazy(className, summary, build) {
  const node = h('details', { className }, summary);
  node.addEventListener('toggle', () => { if (node.open && node.childElementCount === 1) node.append(build()); });
  return node;
}

// Visuels en onglets (mouvement, vidéo, muscles), puis consignes et description.
function exerciseInfo(e) {
  const img = (src, alt = '') => h('img', { src, alt, loading: 'lazy', onerror: (ev) => ev.target.remove() });
  const names = (ids) => ids.map((m) => MUSCLES[m]).join(', ');
  const side = (front) => h('div', { className: 'body' },
    img(`muscles/muscular_system_${front ? 'front' : 'back'}.svg`),
    e.mus2.filter((m) => FRONT.has(m) === front).map((m) => img(`muscles/secondary/muscle-${m}.svg`)),
    e.mus.filter((m) => FRONT.has(m) === front).map((m) => img(`muscles/main/muscle-${m}.svg`)));
  const anatomy = () => {
    const bodies = h('div', { className: 'bodies' }, side(true), side(false));
    bodies.setAttribute('role', 'img');
    bodies.setAttribute('aria-label', `Muscles travaillés : ${muscles(e)}`);
    return h('div', { className: 'anatomy' }, bodies,
      h('div', { className: 'legend' },
        h('span', {}, h('i', { className: 'dot main' }), `Principaux : ${names(e.mus)}`),
        e.mus2.length > 0 && h('span', {}, h('i', { className: 'dot second' }), `Secondaires : ${names(e.mus2)}`)));
  };
  const movement = () => h('div', {}, h('div', { className: 'shots' }, e.img.map((src, i) => img(src, `${e.name}, position ${i + 1}`))),
    e.visual && h('p', { className: 'caption' }, `Visuel : ${e.visual}${e.load === 'smith' && /barre libre/.test(e.visual) ? ', à faire à la Smith' : ''}.`));
  // Hors ligne, la vidéo (hébergée sur wger.de) ne peut pas charger : on le dit au lieu d'un lecteur vide.
  const offline = () => h('p', { className: 'note' }, icon('offline'), 'Hors ligne : la vidéo a besoin du réseau. Les images et les consignes restent disponibles.');
  const video = () => {
    if (!navigator.onLine) return h('div', {}, offline());
    const box = h('div', {});
    box.append(h('video', { src: e.vid, controls: true, preload: 'none', playsInline: true, onerror: () => box.replaceChildren(offline()) }),
      h('p', { className: 'caption' }, `Vidéo sur wger.de, ${e.vidMb} Mo. `, h('a', { href: e.vid, target: '_blank', rel: 'noopener' }, 'Ouvrir à part')));
    return box;
  };
  return h('div', { className: 'info' },
    tabs([e.img.length > 0 && ['Mouvement', movement], e.vid && ['Vidéo', video], ['Muscles', anatomy]].filter(Boolean)),
    h('ul', { className: 'cue' }, (e.cues || [CUES[e.zone]]).map((c) => h('li', {}, c))),
    e.desc && h('p', {}, e.desc),
    h('p', { className: 'caption' }, `Matériel : ${e.eq.map((q) => TAGS[q] || 'poids du corps').join(', ')}`),
    h('p', { className: 'caption' }, `Source wger.de · texte d'origine : ${e.author || 'wger'} (${e.lic}), réécrit et adapté en français${e.imgBy ? ` · images : ${e.imgBy}` : ''}`));
}
