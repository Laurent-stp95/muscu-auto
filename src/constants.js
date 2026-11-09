// Libellés et constantes de l'interface, exercices par identifiant. Logique métier dans plan.js ; un fichier par écran ou domaine
// (onboarding.js, week.js, session.js, focus.js… ; voice.js, camera.js, screen.js, push.js, backup.js) ; démarrage dans main.js.

import { EXOS } from './common.js';

export const MUSCLES = { 1: 'biceps', 2: 'épaules', 3: 'dentelé', 4: 'pectoraux', 5: 'triceps', 6: 'abdos', 7: 'mollets', 8: 'fessiers', 9: 'trapèzes', 10: 'quadriceps', 11: 'ischios', 12: 'grand dorsal', 13: 'brachial', 14: 'obliques', 15: 'soléaire', 16: 'lombaires' };
export const FEELS = [['easy', 'Facile'], ['ok', 'Bien'], ['hard', 'Dur'], ['pain', 'Douleur']];
export const PLATES = [1.25, 2.5, 5, 10, 15, 20, 25];
export const LOAD_HEAD = { smith: 'kg (total)', halteres: 'kg / haltère', kettlebell: 'kg', elastique: 'Élastique', pdc: 'Charge' };
export const BACKUP_DAYS = 14;

export const byId = new Map(EXOS.map((e) => [e.id, e]));
