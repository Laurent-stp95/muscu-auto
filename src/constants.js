// Libellés et constantes de l'interface, exercices par identifiant. Logique métier dans plan.js ; un fichier par écran ou domaine
// (onboarding.js, week.js, session.js, focus.js… ; voice.js, camera.js, screen.js, push.js, backup.js) ; démarrage dans main.js.

import { EXOS } from './common.js';

export const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export const MUSCLES = { 1: 'biceps', 2: 'épaules', 3: 'dentelé', 4: 'pectoraux', 5: 'triceps', 6: 'abdos', 7: 'mollets', 8: 'fessiers', 9: 'trapèzes', 10: 'quadriceps', 11: 'ischios', 12: 'grand dorsal', 13: 'brachial', 14: 'obliques', 15: 'soléaire', 16: 'lombaires' };
export const FEELS = [['easy', 'Facile'], ['ok', 'Bien'], ['hard', 'Dur'], ['pain', 'Douleur']];
export const PLATES = [1.25, 2.5, 5, 10, 15, 20, 25];
export const LOAD_HEAD = { smith: 'kg (total)', halteres: 'kg / haltère', kettlebell: 'kg', elastique: 'Élastique', pdc: 'Charge' };
// Matériel de Laurent (2026-11-01) : modifiable dans Réglages.
export const DEFAULTS = {
  level: 'debutant', goal: 'muscle', days: [0, 2, 4], minutes: 45, zones: [], avoid: [], seed: 1,
  equipment: ['smith', 'halteres', 'kettlebell', 'banc', 'banc-incline', 'traction', 'elastique', 'tapis'],
  loads: { bar: 19, plates: { 1.25: 2, 2.5: 2, 5: 2, 10: 2, 20: 4 }, halteres: [10], kettlebell: [16], elastiques: [30, 20, 10] },
};

export const BACKUP_DAYS = 14;

export const byId = new Map(EXOS.map((e) => [e.id, e]));
