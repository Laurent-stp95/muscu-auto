// Sauvegarde et export du journal : fichier JSON, CSV, texte pour Claude, sauvegarde automatique sur le serveur et restauration.

import { PUSH, EXOS } from './common.js';
import { cancelled, LEVELS, GOALS, TAGS, ZONES, generate, monday } from './plan.js';
import { DAYS, byId, FEELS } from './constants.js';
import { h, toast, ask, button, choose } from './ui.js';
import { state, log, save, setLog } from './store.js';
import { render, setUi } from './router.js';
import { toggle } from './settings.js';
import { journal } from './session.js';
import { plural, setText } from './focus.js';

// Dernière copie du journal : fichier ou sauvegarde automatique, la plus récente.
export function lastCopy() { return [state.lastExport, cloudOn() && state.cloud?.t].filter(Boolean).sort().at(-1); }

function download(name, type, text) {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

// Sauvegarde : feuille de partage iOS (Fichiers, iCloud Drive, AirDrop) quand elle accepte les fichiers, sinon téléchargement.
export async function backup() {
  const name = `muscu-auto-${stamp()}.json`;
  const text = JSON.stringify({ exported: new Date().toISOString(), config: state.config, log }, null, 1);
  const file = new File([text], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Steady' });
    else download(name, 'application/json', text);
  } catch (err) {
    if (err.name === 'AbortError') return; // partage annulé
    download(name, 'application/json', text);
  }
  state.lastExport = new Date().toISOString();
  save();
  render();
  toast('Journal sauvegardé', 'success');
}

export function exportCsv() {
  const dayOf = new Map(log.filter((x) => x.type === 'start').map((x) => [x.session, x.day]));
  const cols = [['horodatage', (x) => x.t], ['type', (x) => x.type], ['seance', (x) => x.session], ['jour', (x) => DAYS[x.day ?? dayOf.get(x.session)]],
    ['exercice_id', (x) => x.ex], ['exercice', (x) => byId.get(x.ex)?.name], ['serie', (x) => x.set], ['kg', (x) => x.kg],
    ['repetitions', (x) => x.reps], ['mode', (x) => x.mode], ['technique_ok', (x) => x.ok], ['ressenti', (x) => x.feel]];
  const cell = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const rows = log.map((x) => cols.map(([, get]) => cell(get(x))).join(';'));
  download(`muscu-auto-${stamp()}.csv`, 'text/csv;charset=utf-8', `﻿${[cols.map(([name]) => name).join(';'), ...rows].join('\n')}`);
}

export function importButton() {
  const input = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  input.onchange = async () => {
    try {
      const data = JSON.parse(await input.files[0].text());
      const entries = Array.isArray(data) ? data : data.log;
      if (!Array.isArray(entries) || !entries.every((x) => typeof x?.t === 'string' && typeof x?.type === 'string')) throw new Error();
      if (await ask({ title: 'Remplacer ton historique ?', text: `Ton historique (${plural(log.length, 'saisie')}) sera remplacé par celui du fichier (${plural(entries.length, 'saisie')}).`, confirm: 'Remplacer', danger: true })) {
        setLog(entries);
        save();
        render();
        cloudBackup();
        toast('Historique importé', 'success');
      }
    } catch {
      toast('Fichier invalide : choisis une sauvegarde JSON de Steady.', 'error');
    }
    input.value = '';
  };
  return h('label', { className: 'btn' }, 'Importer', input);
}

// --- Bilan pour Claude ---
// Les 4 dernières semaines en texte, à coller dans Claude pour un avis de coach.
function claudeText() {
  const since = new Date(Date.now() - 28 * 864e5).toISOString();
  const skip = cancelled(log);
  const c = state.config;
  const lines = [
    'Voici mes 4 dernières semaines de musculation à domicile (appli Steady). Analyse ma progression, ma régularité et mes ressentis, signale ce qui pourrait mener à une blessure, puis propose 3 ajustements concrets.',
    '',
    `Profil : ${LEVELS[c.level].label.toLowerCase()}, objectif ${GOALS[c.goal].label.toLowerCase()}, ${plural(c.days.length, 'séance')} par semaine (${c.days.map((d) => DAYS[d].toLowerCase()).join(', ')}), ${c.minutes} min.`,
    `Matériel : ${c.equipment.map((q) => TAGS[q]).join(', ')}.`,
    c.zones.length ? `Zones fragiles : ${c.zones.map((z) => ZONES[z]).join(', ')}.` : null,
  ];
  for (const st of log.filter((x) => x.type === 'start' && x.t >= since && !skip.has(x.session))) {
    const entries = journal().filter((x) => x.session === st.session);
    const sets = entries.filter((x) => x.type === 'set' && byId.has(x.ex));
    if (!sets.length) continue;
    const fit = entries.find((x) => x.type === 'readiness');
    lines.push('', `${new Date(st.t).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · ${st.name}${fit ? ` · forme ${{ normal: 'bonne', hold: 'moyenne', light: 'basse' }[fit.level]}` : ''}`);
    for (const id of new Set(sets.map((x) => x.ex))) {
      const e = byId.get(id);
      const last = new Map(sets.filter((x) => x.ex === id).map((x) => [x.set, x])); // la dernière saisie d'une série fait foi
      const feel = entries.findLast((x) => x.ex === id && x.type === 'feel')?.feel;
      const tech = entries.findLast((x) => x.ex === id && x.type === 'tech')?.ok;
      lines.push(`- ${e.name} : ${[...last.values()].map((x) => setText(e, x.kg, x.reps)).join(', ')}${feel ? ` · ressenti ${FEELS.find(([v]) => v === feel)[1].toLowerCase()}` : ''}${tech === false ? ' · technique à revoir' : ''}`);
    }
  }
  return lines.filter((l) => l != null).join('\n').replace(/ /g, ' ');
}

export async function copyForClaude() {
  try {
    await navigator.clipboard.writeText(claudeText());
    toast('Copié : colle-le dans une conversation avec Claude.', 'success');
  } catch {
    toast('Copie impossible sur cet appareil.', 'error');
  }
}

// --- Sauvegarde automatique ---
// Le journal est copié sur le serveur (push/worker.js) après chaque séance. Le code de récupération (identifiant aléatoire)
// permet de le restaurer sur un autre iPhone : quiconque l'a peut lire le journal, il reste donc privé.

const cloudOn = () => state.cloud?.on !== false;
const deviceId = () => (state.push = { ...state.push, id: state.push?.id || crypto.randomUUID() }).id;
const dateTime = (iso) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

export async function cloudBackup(force = false) {
  // En développement (localhost), on n'écrit jamais sur le serveur réel.
  if (!location.hostname.endsWith('github.io') || !cloudOn() || !navigator.onLine || (!force && state.cloud?.n === log.length) || !log.length) return;
  try {
    const res = await fetch(`${PUSH.url}/backup?id=${deviceId()}`, { method: 'POST', body: JSON.stringify({ exported: new Date().toISOString(), config: state.config, log }) });
    if (!res.ok) throw new Error(String(res.status));
    state.cloud = { on: true, t: new Date().toISOString(), n: log.length };
    save();
    if (force) { render(); toast('Journal sauvegardé sur le serveur de Steady', 'success'); }
  } catch {
    if (force) toast('Sauvegarde impossible : vérifie ta connexion.', 'error');
  }
}

export function cloudEditor() {
  const code = state.push?.id;
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); toast('Code copié', 'success'); } catch { toast('Copie impossible : sélectionne le code à la main.', 'warning'); }
  };
  return [
    h('div', { className: 'list' },
      toggle('Sauvegarde automatique', cloudOn(), async (on) => {
        state.cloud = { ...state.cloud, on };
        save();
        if (on) return cloudBackup(true);
        try { await fetch(`${PUSH.url}/backup?id=${deviceId()}`, { method: 'DELETE' }); } catch { /* hors ligne : copie supprimée plus tard */ }
        render();
        toast('Sauvegarde automatique coupée, copie du serveur supprimée', 'info');
      }),
      cloudOn() && h('div', { className: 'line' },
        h('span', { className: 'meta' }, state.cloud?.t ? `Dernière : ${dateTime(state.cloud.t)}` : 'Pas encore sauvegardé'),
        button('Sauvegarder', () => cloudBackup(true), { size: 'compact' }))),
    h('p', { className: 'caption' }, 'Après chaque séance, ton journal est copié sur le serveur de Steady. Rien d\'autre n\'y est envoyé.'),
    cloudOn() && code && h('div', { className: 'group' },
      h('span', { className: 'label' }, 'Code de récupération, pour restaurer ton suivi sur un nouvel iPhone. Ne le partage pas.'),
      h('div', { className: 'row' }, h('code', { className: 'code' }, code), button('Copier', copy, { size: 'compact' }))),
    h('div', {}, button('Restaurer avec un code', restoreFlow, { variant: 'plain' })),
  ];
}

export async function restoreFlow() {
  const input = h('input', { className: 'input', type: 'text', placeholder: 'Code de récupération', autocapitalize: 'off', autocomplete: 'off', spellcheck: false, ariaLabel: 'Code de récupération' });
  const go = await choose({ title: 'Restaurer ton suivi', text: 'Colle le code affiché dans Réglages, section Sauvegarde, sur ton ancien iPhone.', extra: input,
    actions: [{ label: 'Restaurer', value: true, variant: 'primary' }, { label: 'Annuler', value: null }] });
  if (!go) return;
  const code = input.value.trim().toLowerCase();
  if (!/^[0-9a-f-]{36}$/.test(code)) return toast("Code invalide : vérifie qu'il est complet.", 'warning');
  let data, t;
  try {
    const res = await fetch(`${PUSH.url}/backup?id=${code}`);
    if (res.status === 404) return toast('Aucune sauvegarde pour ce code.', 'warning');
    if (!res.ok) throw new Error(String(res.status));
    t = Number(res.headers.get('X-Backup-Time')) || Date.now();
    data = await res.json();
  } catch {
    return toast('Restauration impossible : vérifie ta connexion.', 'error');
  }
  if (!Array.isArray(data?.log) || !data.config?.days) return toast('Sauvegarde illisible.', 'error');
  if (log.length && !await ask({ title: 'Remplacer ton suivi actuel ?', text: `Ton historique (${plural(log.length, 'saisie')}) sera remplacé par celui du ${dateTime(t)} (${plural(data.log.length, 'saisie')}).`, confirm: 'Remplacer', danger: true })) return;
  setLog(data.log);
  state.config = data.config;
  state.plan = generate(EXOS, state.config);
  state.cycle = { start: monday(new Date()).toISOString() };
  state.active = null;
  state.push = { id: code, on: false }; // les notifications se réactivent sur cet iPhone
  state.cloud = { on: true, t: new Date(t).toISOString(), n: log.length };
  setUi({ view: 'week', step: 0, draft: null });
  save();
  render();
  toast(`Suivi restauré : ${plural(new Set(log.filter((x) => x.type === 'set').map((x) => x.session)).size, 'séance')}`, 'success');
}
