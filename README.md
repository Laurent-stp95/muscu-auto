# Steady

Anciennement « Muscu auto » (l'adresse /muscu-auto/ est gardée : changer de chemin obligerait à réinstaller et réassocier).

Appli web perso : le programme de musculation se construit tout seul selon le matériel, avec une progression prudente (la technique avant la charge). Faite pour l'iPhone, installable sur l'écran d'accueil, utilisable sans réseau.

Ouvrir `index.html` via un serveur (`python3 -m http.server`), aucune dépendance. Tests : `npm test` (ou `node --test "tests/*.test.js"`, Node 22, aucune dépendance) et `node push/test.mjs` ; lancés à chaque push et pull request (`.github/workflows/test.yml`).

L'appli est en modules ES (`import` / `export`), sans étape de build : `index.html` charge `src/main.js`, qui importe le reste. Les fichiers lus aussi par la page TV ou le service worker (`common/`, `data/data.js`) restent des scripts classiques ; `src/common.js` les réexporte pour les modules.

- `index.html`, `sw.js` (service worker : sa portée impose la racine), `manifest.webmanifest` : restent à la racine.
- `src/` : l'appli (modules ES). `common.js` : pont vers les scripts classiques ; `plan.js` : génération des séances et règles de progression ; interface découpée par écran (`ui.js` composants, `store.js` données, `router.js` navigation, `onboarding.js`, `settings.js`, `week.js`, `exercise-info.js`, `session.js`, `warmup.js`, `focus.js`, `rest.js`, `coach.js`, `progress.js`, `update.js`) ; `voice.js`, `camera.js`, `screen.js`, `push.js`, `backup.js` : micro, caméra qui compte, écran projeté, notifications, sauvegarde ; `main.js` : démarrage.
- `styles/` : `tokens.css` (jetons du système de design) et `app.css`, sortis d'`index.html`.
- `common/` : code commun à l'appli, à la page TV et au service worker. `files.js` (liste unique des fichiers de l'appli : précache, détection de nouvelle version, « Mettre à jour » ; un test échoue si elle diverge de ce que charge `index.html`), `shared.js` (ES2018, lu par les TV), `push-config.js` (adresse du serveur).
- `data/` : `liste.json` (les exercices retenus : nom français, zone, matériel, consignes), `descriptions-fr.json`, `extract.py` (reconstruit `data/data.js` et `img/` depuis `liste.json` et les données wger), `data.js` (généré, ne pas éditer).
- `img/`, `muscles/` : images des exercices et schémas des muscles (chemins inscrits dans `data.js`) ; `assets/` : icônes.
- `tests/` : tests de l'appli, en cas nommés (`node:test`) : `plan.test.js` (programme, progression), `shared.test.js` (caméra qui compte, voix), `structure.test.js` (liste des fichiers, scripts classiques), `helpers.js` (jeux d'essai).
- `tv/` : écran projeté (TV, ordinateur), piloté par l'iPhone (`index.html`, `tv.js`, `tv.css` : scripts classiques ES2018, jamais mis en cache par le service worker ; un petit chargeur dans `tv/index.html` revalide chaque fichier auprès du serveur à l'ouverture, plus de `?v=` à changer à la main) ; `push/` : serveur Cloudflare (notifications, sauvegarde, relais de l'écran). Tests du relais : `node push/screen-test.mjs <url du serveur>`.

## Sources et licences

- Exercices, images et vidéos : [wger](https://wger.de), licence CC-BY-SA, auteur indiqué sur chaque exercice. Descriptions traduites et adaptées en français.
- Schémas des muscles : wger, d'après Wikimedia Commons (voir `muscles/SOURCES`).
