// Configuration personnelle : réglages et matériel proposés au premier lancement (onboarding), modifiables ensuite dans Réglages.
// À adapter pour un autre utilisateur ou une autre salle.

// Matériel de Laurent (2026-11-01) : modifiable dans Réglages.
export const DEFAULTS = {
  level: 'debutant', goal: 'muscle', days: [0, 2, 4], minutes: 45, zones: [], avoid: [], seed: 1,
  equipment: ['smith', 'halteres', 'kettlebell', 'banc', 'banc-incline', 'traction', 'elastique', 'tapis'],
  loads: { bar: 19, plates: { 1.25: 2, 2.5: 2, 5: 2, 10: 2, 20: 4 }, halteres: [10], kettlebell: [16], elastiques: [30, 20, 10] },
};
