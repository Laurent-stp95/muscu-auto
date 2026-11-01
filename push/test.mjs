// node push/test.mjs
import assert from 'node:assert';
import { nextReminder } from './schedule.js';

const paris = 'Europe/Paris';
const r = { days: [0, 2, 4], time: '18:00', before: 30 }; // lundi, mercredi, vendredi, séance à 18:00, rappel 30 min avant

// Dimanche 1er novembre 2026 12:00 (heure d'hiver, UTC+1) → lundi 2 novembre 17:30 Paris = 16:30 UTC.
let next = nextReminder(r, paris, Date.UTC(2026, 10, 1, 11, 0));
assert.deepStrictEqual(next, { at: Date.UTC(2026, 10, 2, 16, 30), day: 0 });

// Lundi 17:40 Paris (rappel du jour passé) → mercredi 17:30.
next = nextReminder(r, paris, Date.UTC(2026, 10, 2, 16, 40));
assert.deepStrictEqual(next, { at: Date.UTC(2026, 10, 4, 16, 30), day: 2 });

// Changement d'heure : vendredi 27 mars 2026 17:30 Paris = 16:30 UTC (hiver), lundi 30 mars 17:30 = 15:30 UTC (été).
assert.strictEqual(nextReminder(r, paris, Date.UTC(2026, 2, 27, 12, 0)).at, Date.UTC(2026, 2, 27, 16, 30));
assert.strictEqual(nextReminder(r, paris, Date.UTC(2026, 2, 28, 12, 0)).at, Date.UTC(2026, 2, 30, 15, 30));

// Réglages incomplets : pas de rappel.
assert.strictEqual(nextReminder({ days: [], time: '18:00' }, paris, Date.now()), null);
assert.strictEqual(nextReminder({ days: [0], time: '' }, paris, Date.now()), null);

console.log('OK');
