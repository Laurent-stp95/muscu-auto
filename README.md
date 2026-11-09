# Steady

Anciennement « Muscu auto » (l'adresse /muscu-auto/ est gardée : changer de chemin obligerait à réinstaller et réassocier).

Appli web perso : le programme de musculation se construit tout seul selon le matériel, avec une progression prudente (la technique avant la charge). Faite pour l'iPhone, installable sur l'écran d'accueil, utilisable sans réseau.

Ouvrir `index.html` via un serveur (`python3 -m http.server`), aucune dépendance. Tests : `node tests/test.js`.

- `index.html`, `sw.js` (service worker : sa portée impose la racine), `manifest.webmanifest` : restent à la racine.
- `src/` : l'appli. `plan.js` : génération des séances et règles de progression ; interface découpée par écran (`ui.js` composants, `store.js` données, `router.js` navigation, `onboarding.js`, `settings.js`, `week.js`, `exercise-info.js`, `session.js`, `warmup.js`, `focus.js`, `rest.js`, `coach.js`, `progress.js`, `update.js`) ; `voice.js`, `camera.js`, `screen.js`, `push.js`, `backup.js` : micro, caméra qui compte, écran projeté, notifications, sauvegarde ; `main.js` : démarrage.
- `common/` : code commun à l'appli, à la page TV et au service worker. `files.js` (liste unique des fichiers de l'appli : précache, détection de nouvelle version, « Mettre à jour » ; un test échoue si elle diverge d'`index.html`), `shared.js` (ES2018, lu par les TV), `push-config.js` (adresse du serveur).
- `data/` : `liste.json` (les exercices retenus : nom français, zone, matériel, consignes), `descriptions-fr.json`, `extract.py` (reconstruit `data/data.js` et `img/` depuis `liste.json` et les données wger), `data.js` (généré, ne pas éditer).
- `img/`, `muscles/` : images des exercices et schémas des muscles (chemins inscrits dans `data.js`) ; `assets/` : icônes.
- `tests/` : tests de l'appli.
- `tv/` : écran projeté (TV, ordinateur), piloté par l'iPhone ; `push/` : serveur Cloudflare (notifications, sauvegarde, relais de l'écran). Tests du relais : `node push/screen-test.mjs <url du serveur>`.

## Sources et licences

- Exercices, images et vidéos : [wger](https://wger.de), licence CC-BY-SA, auteur indiqué sur chaque exercice. Descriptions traduites et adaptées en français.
- Schémas des muscles : wger, d'après Wikimedia Commons (voir `muscles/SOURCES`).
