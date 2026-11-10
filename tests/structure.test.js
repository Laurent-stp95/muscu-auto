// Structure du dépôt : liste des fichiers, scripts classiques, modules de base. node --test tests/
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { FILES } from '../src/common.js';

const root = path.join(import.meta.dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
// Fichiers importés par un module (import … from './x.js', import './x.js', export … from).
const imports = (f) => [...read(f).matchAll(/^(?:import|export)\s[^'"]*?['"](\.[^'"]+)['"];?$/gm)].map((m) => path.posix.join(path.posix.dirname(f), m[1]));

test("Liste des fichiers (common/files.js) : exactement ce que charge index.html, de proche en proche", () => {
  const html = read('index.html');
  const loaded = new Set(['index.html']);
  const follow = (f) => {
    if (loaded.has(f)) return;
    loaded.add(f);
    if (f.endsWith('.js')) imports(f).forEach(follow);
  };
  for (const m of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) follow(m[1]);
  for (const m of html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)) follow(m[1]);
  assert.deepStrictEqual([...loaded].sort(), [...FILES.code].sort());
});

test('Liste des fichiers : tout existe, rien de src/, common/ ou styles/ n\'est oublié', () => {
  for (const f of [...FILES.code, ...FILES.assets]) assert.ok(fs.existsSync(path.join(root, f)), `${f} listé mais absent`);
  const onDisk = ['src', 'common', 'styles'].flatMap((dir) => fs.readdirSync(path.join(root, dir), { recursive: true }).filter((f) => /\.(js|css)$/.test(f)).map((f) => `${dir}/${f.split(path.sep).join('/')}`));
  assert.deepStrictEqual(onDisk.filter((f) => !FILES.code.includes(f)), []);
});

test("Service worker : n'importe que des fichiers listés", () => {
  for (const f of read('sw.js').match(/importScripts\(([^)]*)\)/)[1].match(/[\w\/.-]+\.js/g)) assert.ok(FILES.code.includes(f), `${f} importé par sw.js mais pas listé`);
});

// Lus par la page TV (Chromium 68, <script> classique) ou par le service worker (importScripts) : jamais de module ES.
test('Scripts classiques : ni import ni export dans common/, data/data.js, tv/tv.js et sw.js', () => {
  const classic = [...fs.readdirSync(path.join(root, 'common')).map((f) => `common/${f}`), 'data/data.js', 'tv/tv.js', 'sw.js'];
  for (const f of classic) assert.doesNotMatch(read(f), /^(import|export)\s/m, `${f} doit rester un script classique`);
});

// Les modules de l'appli s'importent en rond ; ceux-ci sont utilisés dès le chargement des autres (premier niveau des fichiers) :
// ils ne doivent importer aucun écran, pour être toujours prêts avant (voir src/main.js).
test("Modules de base : n'importent aucun écran", () => {
  const allowed = { 'src/common.js': [], 'src/ui.js': [], 'src/labels.js': [], 'src/config.js': [], 'src/constants.js': ['src/common.js'], 'src/store.js': ['src/ui.js'] };
  for (const [f, deps] of Object.entries(allowed)) {
    assert.deepStrictEqual(imports(f).filter((d) => d.startsWith('src/') && !deps.includes(d)), [], `${f} importe trop`);
  }
  // Logique métier : src/plan.js et src/plan/ ne dépendent que d'eux-mêmes (ni interface, ni stockage, ni data.js).
  for (const f of ['src/plan.js', ...fs.readdirSync(path.join(root, 'src/plan')).map((n) => `src/plan/${n}`)]) {
    assert.deepStrictEqual(imports(f).filter((d) => !d.startsWith('src/plan/')), [], `${f} sort de src/plan/`);
  }
});
