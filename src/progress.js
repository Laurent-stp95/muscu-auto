// --- Progrès ---

import {
  cancelled, monday, isBodyweight, PUSH_ZONES, PULL_ZONES, ZONES, suggest, learned, comeback, daysOff, project, kgLabel, LEVELS,
  gearList,
} from './plan.js';
import { DAYS, plural } from './labels.js';
import { byId } from './constants.js';
import { h, icon, button } from './ui.js';
import { log, state } from './store.js';
import { show, ui, render } from './router.js';
import { banner, doneThisWeek, effective, cycle, unitText, weekday } from './week.js';
import { lazy } from './exercise-info.js';
import { journal, historyOf, activeMinutes, sessionSets } from './session.js';
import { setText, kgText } from './focus.js';
import { lastCopy, backup, exportCsv, copyForClaude, importButton } from './backup.js';

export function progress() {
  const skip = cancelled(log);
  const sets = journal().filter((x) => x.type === 'set' && byId.has(x.ex) && !skip.has(x.session)); // exercices retirés et séances abandonnées : pas comptés
  const sessions = new Set(sets.map((x) => x.session)).size;
  const cards = [...new Set(sets.map((x) => x.ex))]
    .filter((id) => byId.has(id))
    .map((id) => ({ e: byId.get(id), past: historyOf(id) }))
    .sort((a, b) => b.past.at(-1).t.localeCompare(a.past.at(-1).t));
  const capped = cards.filter(({ e, past }) => tipFor(e, past)?.plafond).map(({ e }) => e.name);
  return h('div', { className: 'screen' },
    h('header', { className: 'stack tight' }, h('div', { className: 'top' }, h('h1', {}, 'Progrès')),
      sessions > 0 && h('p', { className: 'meta' }, `${plural(sessions, 'séance')} · ${plural(sets.length, 'série enregistrée', 'séries enregistrées')}`)),
    !cards.length && h('section', { className: 'card empty' }, icon('chart'), h('h2', { className: 'title' }, 'Pas encore de séance'),
      h('p', { className: 'meta' }, 'Après ta première séance, tu verras ici tes charges, tes répétitions et la prochaine étape pour chaque exercice.'),
      button('Voir ma semaine', () => show('week'), { variant: 'primary' })),
    sessions > 0 && weekReview(),
    capped.length >= 2 && banner('warning', `${capped.length} exercices au plafond`,
      h('p', {}, `${capped.join(', ')} : ton matériel ne permet plus de progresser. Des charges plus lourdes (haltères réglables, par exemple) relanceraient la progression ; ajoute-les dans Réglages quand tu les as.`)),
    cards.map(({ e, past }) => progressCard(e, past)),
    painCard(),
    sessions > 0 && historyCard(),
    h('section', { className: 'card' },
      h('h2', {}, 'Mes données'),
      h('p', { className: 'meta' }, `Chaque saisie est horodatée et reste sur cet appareil. ${lastCopy() ? `Dernière sauvegarde : ${new Date(lastCopy()).toLocaleDateString('fr-FR')}.` : 'Jamais sauvegardé.'}`),
      h('div', { className: 'row' },
        button('Sauvegarder', backup, { variant: 'primary', icon: 'save' }),
        button('Exporter CSV', exportCsv),
        button('Copier pour Claude', copyForClaude, { icon: 'copy' }),
        importButton())));
}

// Bilan de la semaine (depuis lundi) : séances, séries, volume comparé à la semaine passée, records, charges en hausse.
function weekReview() {
  const skip = cancelled(log);
  const since = monday(new Date()).toISOString(), before = new Date(Date.parse(since) - 7 * 864e5).toISOString();
  const sets = (from, to) => journal().filter((x) => x.type === 'set' && x.t >= from && x.t < to && !skip.has(x.session) && byId.has(x.ex));
  const now = sets(since, '9'), prev = sets(before, since);
  const volume = (list) => Math.round(list.reduce((v, x) => v + (x.kg || 0) * x.reps, 0));
  const done = doneThisWeek().size;
  const best = new Map(now.filter((x) => x.pr).map((x) => [x.ex, x])); // un record par exercice : le dernier de la semaine
  const records = [...best.values()].map((x) => `${byId.get(x.ex).name} : ${setText(byId.get(x.ex), x.kg, x.reps)}`);
  // Charge en hausse : la meilleure charge de la semaine dépasse celle de la dernière séance d'avant lundi.
  const up = [...new Set(now.map((x) => x.ex))].flatMap((id) => {
    const e = byId.get(id);
    if (isBodyweight(e)) return [];
    const top = Math.max(...now.filter((x) => x.ex === id).map((x) => x.kg || 0));
    const old = historyOf(id).filter((s) => s.t < since).at(-1);
    const was = old && Math.max(...old.sets.map((x) => x.kg || 0));
    return was && top > was ? [`${e.name} : ${kgText(was)} → ${kgText(top)}`] : [];
  });
  const stat = (value, label) => h('div', { className: 'stat' }, h('strong', {}, value), h('span', { className: 'caption' }, label));
  return h('section', { className: 'card', id: 'bilan' },
    h('div', { className: 'line-head' }, h('h2', {}, 'Bilan de la semaine'), h('span', { className: 'meta' }, `depuis lundi`)),
    h('div', { className: 'stats' }, stat(`${done}/${state.plan.length}`, 'séances'), stat(String(now.length), plural(now.length, 'série', 'séries').replace(/^\d+ /, '')), stat(volume(now).toLocaleString('fr-FR'), 'kg soulevés')),
    prev.length > 0 && h('p', { className: 'caption' }, `Semaine dernière : ${plural(prev.length, 'série')}, ${kgText(volume(prev))}.`),
    records.length > 0 && listNote('flag', records.length > 1 ? 'Records' : 'Record', records),
    up.length > 0 && listNote('chart', 'Charges en hausse', up),
    balanceNote(),
    !now.length && h('p', { className: 'caption' }, 'Pas encore de série cette semaine.'));
}

// Note à puce suivie d'une ligne par élément : plus lisible qu'une phrase enchaînée de « · ».
export const listNote = (name, title, lines) => h('div', { className: 'note' }, icon(name),
  h('div', { className: 'stack tight' }, h('strong', { className: 'note-title' }, title), lines.map((l) => h('span', {}, l))));

// Poussée / tirage sur 2 semaines : trop de poussée use les épaules ; le prochain cycle rééquilibre (balance() dans plan.js).
function balanceNote() {
  const since = new Date(Date.now() - 14 * 864e5).toISOString(), skip = cancelled(log);
  const sets = journal().filter((x) => x.type === 'set' && x.t >= since && byId.has(x.ex) && !skip.has(x.session));
  const push = sets.filter((x) => PUSH_ZONES.includes(byId.get(x.ex).zone)).length, pull = sets.filter((x) => PULL_ZONES.includes(byId.get(x.ex).zone)).length;
  if (push < 6 || push <= pull * 1.3) return null;
  return h('p', { className: 'note' }, icon('warning'), `Tu pousses plus que tu ne tires : ${push} séries contre ${pull} en 2 semaines. Pour tes épaules, le prochain cycle remplacera un exercice de poussée par du dos.`);
}

// Douleurs notées par zone, sur 8 semaines.
function painCard() {
  const since = new Date(Date.now() - 56 * 864e5).toISOString(), skip = cancelled(log);
  const pains = log.filter((x) => x.type === 'pain' && x.t >= since && !skip.has(x.session));
  if (!pains.length) return null;
  const zones = [...new Set(pains.map((x) => x.zone))].map((z) => {
    const list = pains.filter((x) => x.zone === z);
    return { z, n: list.length, last: list.at(-1).t, ex: [...new Set(list.map((x) => byId.get(x.ex)?.name).filter(Boolean))] };
  }).sort((a, b) => b.n - a.n);
  return h('section', { className: 'card' },
    h('h2', {}, 'Douleurs, 8 dernières semaines'),
    h('div', { className: 'list' }, zones.map(({ z, n, last, ex }) => h('div', { className: 'line' },
      h('span', { className: 'stack tight' }, h('strong', {}, z === 'other' ? 'Ailleurs' : ZONES[z]), h('span', { className: 'caption' }, ex.join(', '))),
      h('span', { className: 'meta' }, `${plural(n, 'fois', 'fois')} · ${new Date(last).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`)))),
    h('p', { className: 'caption' }, 'Une zone qui revient peut être ajoutée aux zones fragiles dans Réglages. Si une douleur persiste, consulte un professionnel de santé.'));
}

// Historique : séances terminées, de la plus récente à la plus ancienne ; le détail se construit à l'ouverture.
function historyCard() {
  const skip = cancelled(log), clean = journal();
  const ended = new Set(log.filter((x) => x.type === 'end').map((x) => x.session));
  const starts = log.filter((x) => x.type === 'start' && ended.has(x.session) && !skip.has(x.session)).reverse();
  const rows = starts.map((st) => ({ st, sets: clean.filter((x) => x.session === st.session && x.type === 'set' && byId.has(x.ex)) })).filter((r) => r.sets.length);
  const shown = rows.slice(0, ui.historyCount || 10);
  return h('section', { className: 'card' },
    h('h2', {}, 'Historique'),
    h('div', { className: 'list' }, shown.map(({ st, sets }) => {
      const last = new Map(sets.map((x) => [`${x.ex}-${x.set}`, x])); // la dernière saisie d'une série fait foi
      const volume = Math.round([...last.values()].reduce((v, x) => v + (x.kg || 0) * x.reps, 0));
      const prs = [...last.values()].filter((x) => x.pr).length;
      return lazy('ex', h('summary', {}, h('span', { className: 'stack tight' },
        h('strong', {}, `${new Date(st.t).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · ${st.name}`),
        h('span', { className: 'meta' }, [`${activeMinutes(st.session)} min`, plural(last.size, 'série'), volume > 0 && kgText(volume), prs > 0 && plural(prs, 'record')].filter(Boolean).join(' · '))), icon('chevron', 'chev')),
        () => h('div', { className: 'ex-body' }, [...new Set([...last.values()].map((x) => x.ex))].map((id) => {
          const e = byId.get(id);
          return h('p', {}, h('strong', {}, e.name), h('br'), h('span', { className: 'meta' }, [...last.values()].filter((x) => x.ex === id).sort((a, b) => a.set - b.set).map((x) => setText(e, x.kg, x.reps) + (x.pr ? ' · record' : '')).join(' · ')));
        })));
    })),
    rows.length > shown.length && h('div', {}, button(`Voir ${Math.min(10, rows.length - shown.length)} séances de plus`, () => { ui.historyCount = shown.length + 10; render(); }, { variant: 'plain' })));
}

// Technique mesurée par la caméra, par séance : angle moyen au point bas (plus petit = plus profond), descente moyenne, répétitions incomplètes.
export function technique(e) {
  const skip = cancelled(log), sessions = new Map();
  for (const x of journal()) {
    if (x.type !== 'cam' || x.ex !== e.id || skip.has(x.session)) continue;
    const s = sessions.get(x.session) || { t: x.t, reps: [] };
    s.reps.push(...x.reps);
    sessions.set(x.session, s);
  }
  const avg = (list) => Math.round(list.reduce((a, b) => a + b, 0) / list.length);
  return [...sessions.values()].map((s) => ({ t: s.t, depth: avg(s.reps.map((r) => r.depth)), down: avg(s.reps.map((r) => r.down)), partial: s.reps.filter((r) => !r.full).length, total: s.reps.length }));
}

function techniqueBlock(e) {
  const list = technique(e);
  if (!list.length) return null;
  const first = list[0], last = list.at(-1), delta = last.depth - first.depth;
  return h('div', { className: 'stack' },
    h('p', { className: 'label' }, 'Technique, mesurée par la caméra'),
    list.length > 1 && chart(list.map((s) => ({ x: Date.parse(s.t), y: s.depth })), [], '°'),
    h('p', { className: 'meta' }, [`${last.depth}° au point bas${list.length > 1 && delta ? ` (${Math.abs(delta)}° ${delta < 0 ? 'plus bas' : 'moins bas'} qu'au début)` : ''}`,
      `descente ${(last.down / 1000).toFixed(1).replace('.', ',')} s`, `${plural(last.partial, 'répétition incomplète', 'répétitions incomplètes')} sur ${last.total}`].join(' · ')),
    list.length > 1 && h('p', { className: 'caption' }, 'Plus la courbe descend, plus tu descends bas.'));
}

export function tipFor(e, past) {
  const item = state.plan.flatMap((s) => s.items).find((it) => it.ex === e.id);
  return item && suggest(e, effective(item), past, { loads: state.config.loads, learned: learned(log, e.id, past), deload: cycle().deload, comeback: comeback(daysOff(journal())) });
}

function progressCard(e, past) {
  const level = state.config.level;
  // Courbe des charges si elles changent ; sinon (poids du corps, charge fixe comme les haltères à 10 kg) les répétitions.
  const kgs = new Set(past.map((s) => Math.max(0, ...s.sets.map((x) => x.kg || 0))).filter((kg) => kg > 0));
  const withKg = !isBodyweight(e) && kgs.size > 1;
  const fixed = !isBodyweight(e) && kgs.size === 1 ? [...kgs][0] : null;
  const value = (s) => (withKg ? Math.max(0, ...s.sets.map((x) => x.kg || 0)) : Math.max(...s.sets.map((x) => x.reps)));
  const points = past.map((s) => ({ x: Date.parse(s.t), y: value(s) })).filter((p) => !withKg || p.y > 0); // séance sans charge : hors courbe des kg
  const ahead = e.load === 'smith' && withKg ? project(points.at(-1).y, level) : [];
  const last = past.at(-1);
  const tip = tipFor(e, past);
  return h('section', { className: 'card' },
    h('h2', { className: 'title' }, e.name),
    // Une seule séance : pas de courbe (un point perdu dans un cadre vide se lit comme un bug).
    points.length > 1 ? chart(points, ahead, withKg ? 'kg' : unitText(e)) : h('p', { className: 'caption' }, 'Ta courbe apparaîtra après ta deuxième séance de cet exercice.'),
    points.length > 1 && fixed != null && h('p', { className: 'caption' }, `Charge fixe (${kgLabel(e, fixed)}) : la courbe suit tes répétitions.`),
    techniqueBlock(e),
    h('p', { className: 'meta' }, `Dernière séance, ${new Date(last.t).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })} : ${last.sets.map((x) => (!isBodyweight(e) ? `${x.reps}\u00a0×\u00a0${kgLabel(e, x.kg)}` : `${x.reps}\u00a0${unitText(e)}`)).join(' · ')}${last.tech === false ? ' · technique à revoir' : ''}`),
    tip && h('p', { className: 'tip' }, tip.kg != null && h('strong', {}, `Prochaine : ${kgLabel(e, tip.kg)} · `), tip.note),
    ahead.length > 0 && h('p', { className: 'caption' }, `Repère ${LEVELS[level].label.toLowerCase()} : environ ${kgText(ahead.at(-1))} dans 8 semaines si tout se passe bien. Indicatif : la technique et l'absence de douleur passent avant.`));
}

// Courbe SVG : réalisé (trait plein) + repère selon le niveau (pointillés, une valeur par semaine).
function chart(points, ahead, unit) {
  const W = 320, H = 130, P = 26, WEEK = 7 * 864e5;
  const future = ahead.map((y, i) => ({ x: points.at(-1).x + (i + 1) * WEEK, y }));
  const all = [...points, ...future];
  const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
  const [x0, x1, low, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const y0 = low === y1 ? low : Math.min(low, Math.floor(y1 * 0.75)); // axe d'au moins 25 % de la valeur haute : un petit écart reste petit
  // Une seule séance : point au centre ; valeur qui ne change pas : ligne au milieu, une seule étiquette.
  const sx = (x) => (x1 === x0 ? W / 2 : P + ((x - x0) / (x1 - x0)) * (W - 2 * P)).toFixed(1);
  const sy = (y) => (y1 === y0 ? H / 2 : H - P - ((y - y0) / (y1 - y0)) * (H - 2 * P)).toFixed(1);
  const line = (pts) => pts.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ');
  const box = h('div', { className: 'chart' });
  // Valeurs numériques et libellés fixes uniquement : innerHTML sans risque ici.
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution en ${unit}">
    <text x="2" y="${y1 === y0 ? H / 2 - 8 : sy(y1)}" class="axis">${y1.toLocaleString('fr-FR')} ${unit}</text>
    ${y1 !== y0 ? `<text x="2" y="${sy(y0)}" class="axis">${y0.toLocaleString('fr-FR')}</text>` : ''}
    ${future.length ? `<polyline points="${line([points.at(-1), ...future])}" class="ahead"/>` : ''}
    <polyline points="${line(points)}" class="done"/>
    ${points.map((p) => `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="3.5"/>`).join('')}
  </svg>`;
  return box;
}

export const loadText = (e, kg) => (isBodyweight(e) ? 'Poids du corps' : kg == null ? 'Charge à choisir' : kgLabel(e, kg).replace(/^./, (c) => c.toUpperCase()));
export const repsText = (e, reps) => `${reps} ${e.unit === 's' ? 's' : 'rép.'}`;

// Aperçu d'une séance à venir : exercices avec la charge conseillée, matériel à préparer.
export function preview(s, nextWeek) {
  const entries = s.items.map((item) => {
    const e = byId.get(item.ex);
    const it = effective(item);
    return { e, it, kg: isBodyweight(e) ? null : tipFor(e, historyOf(e.id))?.kg ?? null };
  });
  return {
    when: s.day === weekday() && !nextWeek ? "Aujourd'hui" : DAYS[s.day],
    items: entries.map(({ e, it, kg }) => ({ name: e.name, detail: `${it.sets} × ${it.reps}${e.unit === 's' ? ' s' : ''} · ${loadText(e, kg)}` })),
    gear: gearList(entries, state.config.loads),
  };
}

// Bilan chiffré d'une séance (écran projeté, fin de séance).
export function summaryData(items) {
  const sets = sessionSets(state.active.session);
  const planned = items.reduce((n, x) => n + x.it.sets, 0);
  const volume = Math.round([...sets.values()].reduce((v, x) => v + (x.kg || 0) * x.reps, 0));
  return {
    stats: [[`${sets.size}/${planned}`, planned > 1 ? 'séries' : 'série'], [`${activeMinutes(state.active.session)} min`, 'effort'], [volume.toLocaleString('fr-FR'), 'kg soulevés']],
    records: [...sets.values()].filter((x) => x.pr && byId.has(x.ex)).map((x) => `${byId.get(x.ex).name} : ${setText(byId.get(x.ex), x.kg, x.reps)}`),
  };
}
