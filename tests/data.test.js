// data/data.js (généré par data/extract.py) reste cohérent avec ses sources, sans réseau. node --test tests/
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { EXOS } from '../src/common.js';

const root = path.join(import.meta.dirname, '..');
const json = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const liste = json('data/liste.json'), descriptions = json('data/descriptions-fr.json');

test('data.js : mêmes exercices que liste.json, dans le même ordre (identifiants et noms)', () => {
  assert.deepStrictEqual(EXOS.map((e) => [e.id, e.name]), liste.map((x) => [x.id, x.name]));
  assert.strictEqual(new Set(EXOS.map((e) => e.id)).size, EXOS.length, 'identifiant en double');
});

test('data.js : chaque champ de liste.json est repris tel quel', () => {
  liste.forEach((item, i) => {
    for (const [key, value] of Object.entries(item)) assert.deepStrictEqual(EXOS[i][key], value, `${item.id} ${item.name} : ${key} diffère de liste.json`);
  });
});

test('data.js : description de liste.json, sinon de descriptions-fr.json', () => {
  liste.forEach((item, i) => assert.strictEqual(EXOS[i].desc, item.desc || descriptions[String(item.id)] || '', `${item.id} ${item.name}`));
});

test('data.js : images et schémas de muscles présents dans le dépôt', () => {
  for (const e of EXOS) {
    for (const img of e.img) assert.ok(/^img\//.test(img) && fs.existsSync(path.join(root, img)), `${e.id} ${e.name} : ${img} absent`);
    for (const m of e.mus) assert.ok(fs.existsSync(path.join(root, `muscles/main/muscle-${m}.svg`)), `${e.id} : muscle principal ${m} sans schéma`);
    for (const m of e.mus2) assert.ok(fs.existsSync(path.join(root, `muscles/secondary/muscle-${m}.svg`)), `${e.id} : muscle secondaire ${m} sans schéma`);
  }
});
