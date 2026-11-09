// Liste unique des fichiers de l'appli (les images des exercices se déduisent de data.js) : le service worker les met en cache
// pour le hors-ligne (sw.js) et « Mettre à jour » les retélécharge (src/update.js). index.html ne charge que src/main.js, qui
// importe le reste : tests/ suit ces imports et échoue si la liste ne correspond plus.
// Script classique (importScripts dans sw.js) ; l'appli le lit par src/common.js.
const FILES = {
  // Un changement de l'un de ces fichiers = nouvelle version, proposée par le bandeau « Nouvelle version disponible ».
  code: [
    'index.html', 'styles/tokens.css', 'styles/app.css', 'common/files.js', 'common/push-config.js', 'common/shared.js',
    'data/data.js', 'src/common.js', 'src/config.js', 'src/labels.js', 'src/constants.js', 'src/ui.js', 'src/store.js',
    'src/router.js', 'src/onboarding.js', 'src/settings.js', 'src/week.js', 'src/exercise-info.js', 'src/session.js',
    'src/warmup.js', 'src/focus.js', 'src/add-exercise.js', 'src/rest.js', 'src/coach.js', 'src/progress.js', 'src/update.js', 'src/plan.js',
    'src/plan/catalog.js', 'src/plan/generate.js', 'src/plan/journal.js', 'src/plan/progression.js', 'src/plan/loads.js',
    'src/plan/recovery.js', 'src/voice.js', 'src/camera.js', 'src/screen.js', 'src/push.js', 'src/backup.js', 'src/main.js',
  ],
  assets: ['manifest.webmanifest', 'assets/icon-180.png', 'assets/icon-192.png', 'assets/icon-512.png',
    'muscles/muscular_system_front.svg', 'muscles/muscular_system_back.svg'],
};
(typeof self !== 'undefined' ? self : globalThis).FILES = FILES; // pour les modules ES (src/common.js) ; le service worker lit la constante
