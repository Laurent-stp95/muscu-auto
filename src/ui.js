// Composants communs : toute l'appli passe par eux, les états et tailles sont définis une fois (styles/tokens.css, styles/app.css).
export function h(tag, props = {}, ...kids) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...kids.flat(Infinity).filter((k) => k != null && k !== false && k !== ''));
  return node;
}

// Icônes au trait (style SF Symbols), dessinées sur une grille de 24.
const ICONS = {
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M9.5 2.5h5"/>',
  chart: '<path d="M5 20v-6M12 20V8M19 20V4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  warning: '<path d="M12 3.5L2.5 20h19L12 3.5z"/><path d="M12 10v4.5M12 17.5v.01"/>',
  video: '<rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5L21 7.5v9l-5.5-3"/>',
  flame: '<path d="M12 21c-3.9 0-7-2.7-7-6.5 0-3.4 2.6-5.6 4-8.5.5 2 1.6 3.3 3 4 0-3 1.5-5.5 3-7 .3 3.5 4 5.8 4 11.5 0 3.8-3.1 6.5-7 6.5z"/>',
  leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19c3-4 6-6.5 10-8.5"/>',
  flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
  save: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  offline: '<path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M12 19h.01M3 3l18 18"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8 5.2-5.8"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8v.01"/>',
  xCircle: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  tv: '<rect x="2.5" y="4.5" width="19" height="13" rx="2.5"/><path d="M8 21h8M12 17.5V21"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  camera: '<path d="M3.5 8.5h3.5l2-2.5h6l2 2.5h3.5v10.5h-17z"/><circle cx="12" cy="13.5" r="3.5"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M8 10.5H6.5a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-6.5a2 2 0 0 0-2-2H16"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>',
};
export function icon(name, className = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', `icon ${className}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[name]; // tracés fixes ci-dessus
  return svg;
}

// variant : 'tinted' (défaut) | 'primary' | 'gray' | 'plain' | 'danger' ; size : 'large' | 'compact'.
export function button(label, onclick, { variant, size, icon: name, ...props } = {}) {
  return h('button', { type: 'button', className: ['btn', variant, size].filter(Boolean).join(' '), onclick, ...props }, name && icon(name), label);
}

export function chip(label, pressed, onclick, { danger, iconName, variant, ...props } = {}) {
  return h('button', { type: 'button', className: ['chip', variant, danger && 'danger'].filter(Boolean).join(' '), ariaPressed: String(!!pressed), onclick, ...props }, iconName && icon(iconName), label);
}

// Message en haut d'écran, icône selon sa nature ; avec `undo`, un bouton Annuler pendant 5 s.
const TOAST_ICONS = { record: 'flag', success: 'checkCircle', info: 'info', warning: 'warning', error: 'xCircle', timer: 'timer', offline: 'offline' };
export function toast(text, kind = 'info', undo) {
  document.querySelector('.toast')?.remove();
  const node = h('div', { className: `toast ${kind}`, role: ['warning', 'error', 'offline'].includes(kind) ? 'alert' : 'status' }, icon(TOAST_ICONS[kind]), h('span', {}, text),
    undo && button('Annuler', () => { node.remove(); undo(); }, { variant: 'plain', size: 'compact' }));
  document.body.append(node);
  setTimeout(() => node.remove(), undo ? 5000 : 3000);
}

// Feuille de choix en bas d'écran (façon iOS). actions = [{ label, value, variant }] ; résout la valeur choisie, null si fermée.
export function choose({ title, text, extra, actions }) {
  return new Promise((resolve) => {
    const dialog = h('dialog', { className: 'sheet' });
    if (!dialog.showModal) return resolve(confirm(`${title}\n${text || ''}`) ? actions[0].value : null);
    const close = (value) => { dialog.close(); dialog.remove(); resolve(value); };
    dialog.append(h('div', { className: 'sheet-body' },
      h('div', { className: 'stack' }, h('h2', { className: 'title' }, title), text && h('p', { className: 'meta' }, text)),
      extra,
      h('div', { className: 'stack' }, actions.map((a) => button(a.label, () => close(a.value), { variant: a.variant || 'gray', size: 'large' })))));
    dialog.addEventListener('cancel', (ev) => { ev.preventDefault(); close(null); });
    document.body.append(dialog);
    dialog.showModal();
  });
}

// Confirmation simple : résout true si confirmé.
export async function ask({ confirm: ok, cancel = 'Annuler', danger, ...sheet }) {
  return (await choose({ ...sheet, actions: [{ label: ok, value: true, variant: danger ? 'gray destructive' : 'primary' }, { label: cancel, value: false }] })) === true;
}
