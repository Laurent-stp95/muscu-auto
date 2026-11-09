# Steady

Anciennement « Muscu auto » (l'adresse /muscu-auto/ est gardée : changer de chemin obligerait à réinstaller et réassocier).

Appli web perso : le programme de musculation se construit tout seul selon le matériel, avec une progression prudente (la technique avant la charge). Faite pour l'iPhone, installable sur l'écran d'accueil, utilisable sans réseau.

Ouvrir `index.html` via un serveur (`python3 -m http.server`), aucune dépendance. Tests : `npm test` (ou `node --test "tests/*.test.js"`, Node 22, aucune dépendance) et `node push/test.mjs` ; lancés à chaque push et pull request (`.github/workflows/test.yml`).

L'appli est en modules ES (`import` / `export`), sans étape de build : `index.html` charge `src/main.js`, qui importe le reste. Les fichiers lus aussi par la page TV ou le service worker (`common/`, `data/data.js`) restent des scripts classiques ; `src/common.js` les réexporte pour les modules.

```
index.html, sw.js, manifest.webmanifest   restent à la racine (portée du service worker, adresse /muscu-auto/)
package.json                              type module, script test (aucune dépendance)
src/                                      l'appli, en modules ES
  main.js                                 démarrage : seul fichier chargé par index.html, importe le reste
  common.js                               pont vers les scripts classiques de common/ et data/
  config.js                               configuration personnelle (matériel et réglages proposés au premier lancement)
  labels.js, constants.js                 libellés (labels.js sert aussi au serveur push/), constantes, exercices par identifiant
  ui.js, store.js, router.js              composants, données (state, journal, localStorage), navigation
  onboarding.js, settings.js, week.js, exercise-info.js, session.js, add-exercise.js, warmup.js, focus.js, rest.js, coach.js,
  progress.js, update.js
                                          un fichier par écran ou domaine
  voice.js, camera.js, screen.js, push.js, backup.js
                                          micro, caméra qui compte, écran projeté, notifications, sauvegarde
  plan.js                                 logique métier, réexporte plan/
  plan/                                   catalog.js (tables), generate.js (programme, séance express), supersets.js (paires de la
                                          séance express), journal.js (lecture du suivi), progression.js (charges),
                                          loads.js (barre et disques), recovery.js (récupération)
common/                                   scripts classiques lus aussi par la page TV ou le service worker
  files.js                                liste unique des fichiers de l'appli (précache, nouvelle version, « Mettre à jour »)
  shared.js                               son, voix, caméra qui compte, WebRTC (ES2018, lu par les TV)
  push-config.js                          adresse et clé publique du serveur de notifications
styles/                                   tokens.css (jetons du système de design), app.css
data/                                     liste.json (exercices retenus), descriptions-fr.json, extract.py, data.js (généré, ne pas éditer)
img/, muscles/                            images des exercices, schémas des muscles (chemins inscrits dans data.js)
assets/                                   icônes
tests/                                    plan.test.js, shared.test.js, data.test.js, structure.test.js, helpers.js
tv/                                       écran projeté : index.html (avec son chargeur), tv.js, tv.css (ES2018, réseau seulement)
push/                                     serveur Cloudflare (notifications, sauvegarde, relais de l'écran)
.github/workflows/test.yml                tests à chaque push et pull request
```

- Modules : les fichiers de `src/` s'importent en rond (un écran en appelle un autre). Au premier niveau d'un fichier, hors fonctions, n'utiliser que `ui.js`, `store.js`, `constants.js`, `labels.js`, `config.js`, `common.js` et `plan.js`, qui n'importent aucun écran. Une variable `let` exportée ne se réaffecte que dans son module (`setLog`, `setUi`…).
- Séance en cours : `state.active` ; les écrans la lisent par `activeSession()` (src/session.js), jamais par `state.plan[state.active.day]` : une séance libre n'a pas de jour (`day` null, `free`), et un exercice ajouté à la volée (`extra`) ne vaut que pour la séance. Le journal est en ajout seul : de nouveaux champs facultatifs (`free` sur l'entrée `start`), jamais de changement de format.
- Caméra qui compte : l'articulation suivie se décide exercice par exercice dans `common/shared.js` (`CAM_EX`, sinon `CAM_OFF` avec la raison ; un test échoue si un exercice n'a ni l'un ni l'autre). Seuils par articulation dans `COUNTER` (`dir: 'up'` quand le geste ouvre l'angle, comme une élévation). Le comptage n'est couvert que par des tests sur des angles et des points synthétiques : tout nouveau réglage est à essayer devant une vraie caméra.
- Nouveau fichier dans `src/`, `common/` ou `styles/` : l'ajouter à `common/files.js`, sinon un test échoue.
- `data/extract.py` reconstruit `data/data.js` et `img/` depuis `data/liste.json` et les données wger (`python3 data/extract.py [clone wger]`).
- `tv/` : un petit chargeur dans `tv/index.html` revalide chaque fichier auprès du serveur à l'ouverture, plus de `?v=` à changer à la main.
- `push/` : `npx wrangler@4 deploy` depuis ce dossier (le Worker importe `../src/labels.js`, inclus par wrangler). Tests : `node push/test.mjs` ; relais : `node push/screen-test.mjs <url du serveur>`.

## Sources et licences

- Exercices, images et vidéos : [wger](https://wger.de), licence CC-BY-SA, auteur indiqué sur chaque exercice. Descriptions traduites et adaptées en français.
- Schémas des muscles : wger, d'après Wikimedia Commons (voir `muscles/SOURCES`).
