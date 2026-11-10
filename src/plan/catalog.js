// Tables du programme : matériel, créneaux, répartitions, objectifs, niveaux, zones fragiles, consignes.
// Exercices = data/liste.json (via data.js).

export const BODYWEIGHT = 'pdc';
export const isBodyweight = (e) => e.load === BODYWEIGHT;
export const TAGS = { smith: 'Smith machine', halteres: 'Haltères', kettlebell: 'Kettlebell', banc: 'Banc plat', 'banc-incline': 'Banc inclinable',
  traction: 'Barre de traction', elastique: 'Élastiques', tapis: 'Tapis' };
// Charges à poids listés par l'utilisateur → clé de leur liste dans loads. Sans aucun poids, l'exercice n'est pas faisable.
export const WEIGHT_LISTS = { halteres: 'halteres', kettlebell: 'kettlebell', elastique: 'elastiques' };
// Matériel dont il faut renseigner les charges (étape « Tes charges ») : la Smith (barre et disques) et le matériel à poids listés.
export const LOADED_GEAR = ['smith', ...Object.keys(WEIGHT_LISTS)];
export const DAY = 864e5; // un jour, en ms
export const TOP = 6; // tirage au hasard parmi 6 candidats
export const LEARNING = 2; // séances d'apprentissage sans augmentation, pour tout exercice nouveau ou réintégré
export const CYCLE_WEEKS = 6; // 5 semaines de travail + 1 semaine allégée

// Un créneau = une ou plusieurs zones de liste.json.
export const SLOTS = {
  quad: { label: 'Quadriceps', zones: ['quad'] },
  hinge: { label: 'Ischios et fessiers', zones: ['hinge'] },
  chest: { label: 'Pectoraux', zones: ['chest'] },
  back: { label: 'Dos', zones: ['back'] },
  shoulders: { label: 'Épaules', zones: ['shoulders'] },
  arms: { label: 'Bras', zones: ['biceps', 'triceps'] },
  biceps: { label: 'Biceps', zones: ['biceps'] },
  triceps: { label: 'Triceps', zones: ['triceps'] },
  calves: { label: 'Mollets', zones: ['calves'] },
  abs: { label: 'Abdos', zones: ['abs'] },
};

// Créneaux par ordre de priorité : une séance courte garde les premiers.
export const SESSIONS = {
  full: { name: 'Full body', slots: ['quad', 'chest', 'back', 'hinge', 'shoulders', 'arms', 'abs'] },
  upper: { name: 'Haut du corps', slots: ['chest', 'back', 'shoulders', 'back', 'chest', 'biceps', 'triceps'] },
  lower: { name: 'Bas du corps', slots: ['quad', 'hinge', 'quad', 'hinge', 'calves', 'abs', 'abs'] },
  push: { name: 'Poussée', slots: ['chest', 'shoulders', 'chest', 'triceps', 'shoulders', 'triceps', 'abs'] },
  pull: { name: 'Tirage', slots: ['back', 'back', 'biceps', 'back', 'biceps', 'abs', 'abs'] },
};

// Répartition selon le nombre de jours (index). 7 jours exclu : un jour de repos minimum.
export const SPLITS = [
  [],
  ['full'],
  ['full', 'full'],
  ['full', 'full', 'full'],
  ['upper', 'lower', 'upper', 'lower'],
  ['push', 'pull', 'lower', 'upper', 'lower'],
  ['push', 'pull', 'lower', 'push', 'pull', 'lower'],
];
// Jours consécutifs : jamais deux séances d'affilée sur les mêmes muscles (48 h de récupération).
export const SPLITS_BACK_TO_BACK = { 2: ['upper', 'lower'], 3: ['push', 'pull', 'lower'] };
export const MAX_DAYS = 6;

// [séries, répétitions, repos en s] pour les 2 premiers exercices (main) puis les suivants (acc).
export const GOALS = {
  muscle: { label: 'Prise de muscle', hint: '8 à 12 répétitions, le plus polyvalent', main: [4, '8-10', 90], acc: [3, '10-12', 60] },
  force: { label: 'Force', hint: 'Charges lourdes, peu de répétitions', main: [5, '5', 180], acc: [3, '8', 90] },
  endurance: { label: 'Endurance', hint: 'Plus de répétitions, repos courts', main: [3, '15-20', 45], acc: [3, '15-20', 45] },
};
export const HOLD = '30-45'; // gainage, en secondes

// rir = répétitions gardées en réserve, sets = séries en plus ou en moins, weekly = progression indicative par semaine.
export const LEVELS = {
  debutant: { label: 'Débutant', hint: "Moins de 6 mois d'entraînement", rir: 3, sets: -1, weekly: 0.025 },
  intermediaire: { label: 'Intermédiaire', hint: '6 mois à 2 ans', rir: 2, sets: 0, weekly: 0.015 },
  confirme: { label: 'Confirmé', hint: 'Plus de 2 ans', rir: 1, sets: 0, weekly: 0.0075 },
};
// Zones fragiles : les exercices marqués `risk` dans liste.json sont écartés.
export const ZONES = { shoulders: 'Épaules', elbows: 'Coudes', wrists: 'Poignets', back: 'Bas du dos', knees: 'Genoux' };
export const ISOLATION_ZONES = ['biceps', 'triceps', 'calves', 'abs'];

// Consigne générale par zone, quand l'exercice n'a pas les siennes.
export const CUES = {
  quad: "Genoux dans l'axe des pieds, dos neutre ; descends tant que le dos reste droit.",
  hinge: 'Dos neutre du début à la fin, le mouvement vient des hanches.',
  chest: 'Omoplates serrées, coudes à 45° du buste, descente contrôlée.',
  back: "Dos neutre, tire avec les coudes, pas d'élan ni d'à-coups.",
  shoulders: 'Charge légère, gainage serré ; arrête si ça pince en haut.',
  biceps: 'Coudes fixes, sans élan, amplitude complète.',
  triceps: 'Coudes fixes, sans élan, amplitude complète.',
  calves: 'Amplitude complète, pause en haut, sans rebond.',
  abs: 'Bas du dos plaqué, nuque relâchée, expire en contractant.',
};
