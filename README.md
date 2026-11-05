# Muscu auto

Appli web perso : le programme de musculation se construit tout seul selon le matériel, avec une progression prudente (la technique avant la charge). Faite pour l'iPhone, installable sur l'écran d'accueil, utilisable sans réseau.

Ouvrir `index.html` via un serveur (`python3 -m http.server`), aucune dépendance. Tests : `node test.js`.

- `liste.json` : les exercices retenus (nom français, zone, matériel, consignes).
- `extract.py` : reconstruit `data.js` et `img/` depuis `liste.json` et les données wger.
- `plan.js` : génération des séances et règles de progression ; `app.js` : interface.
- `tv/` : écran projeté (TV, ordinateur), piloté par l'iPhone ; `push/` : serveur Cloudflare (notifications, sauvegarde, relais de l'écran). Tests du relais : `node push/screen-test.mjs <url du serveur>`.

## Sources et licences

- Exercices, images et vidéos : [wger](https://wger.de), licence CC-BY-SA, auteur indiqué sur chaque exercice. Descriptions traduites et adaptées en français.
- Schémas des muscles : wger, d'après Wikimedia Commons (voir `muscles/SOURCES`).
