// Liste unique des fichiers de l'appli (les images des exercices se déduisent de data.js) : le service worker les met en cache
// pour le hors-ligne (sw.js) et « Mettre à jour » les retélécharge (src/update.js). tests/ vérifie qu'elle correspond à ce
// qu'index.html charge. Ordre de `code` = ordre de chargement.
const FILES = {
  // Un changement de l'un de ces fichiers = nouvelle version, proposée par le bandeau « Nouvelle version disponible ».
  code: [
    'index.html', 'common/files.js', 'data/data.js', 'src/plan.js', 'common/shared.js', 'common/push-config.js', 'src/constants.js',
    'src/ui.js', 'src/store.js', 'src/router.js', 'src/onboarding.js', 'src/settings.js', 'src/week.js', 'src/exercise-info.js',
    'src/session.js', 'src/warmup.js', 'src/focus.js', 'src/rest.js', 'src/coach.js', 'src/progress.js', 'src/update.js',
    'src/voice.js', 'src/camera.js', 'src/screen.js', 'src/push.js', 'src/backup.js', 'src/main.js',
  ],
  assets: ['manifest.webmanifest', 'assets/icon-180.png', 'assets/icon-192.png', 'assets/icon-512.png',
    'muscles/muscular_system_front.svg', 'muscles/muscular_system_back.svg'],
};
if (typeof module !== 'undefined') module.exports = FILES;
