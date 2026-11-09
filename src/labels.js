// Libellés partagés par l'appli et le serveur de notifications (push/worker.js l'importe : aucune dépendance, aucun accès au DOM).
export const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
// « 1 série », « 3 séries » ; pluriel irrégulier en 3e argument.
export const plural = (n, one, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
