// Calcul des rappels de séance, en heure locale de l'iPhone (fuseau IANA), changement d'heure compris.

// Décalage du fuseau à l'instant ts, en ms (Paris en hiver : +3 600 000).
function offset(ts, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(new Date(ts)).map((p) => [p.type, Number(p.value)]));
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - Math.floor(ts / 1000) * 1000;
}

// Heure locale (y, m, d, h, min) dans le fuseau → instant UTC en ms.
function localToUtc(y, m, d, h, min, timeZone) {
  const guess = Date.UTC(y, m - 1, d, h, min);
  const first = guess - offset(guess, timeZone);
  return guess - offset(first, timeZone);
}

// Jour local (0 = lundi) et date locale d'un instant.
function localDay(ts, timeZone) {
  const local = new Date(ts + offset(ts, timeZone));
  return { y: local.getUTCFullYear(), m: local.getUTCMonth() + 1, d: local.getUTCDate(), weekday: (local.getUTCDay() + 6) % 7 };
}

// Prochain rappel strictement après `now` : { at, day } ou null.
// reminders = { days: [0..6, 0 = lundi], time: 'HH:MM' (heure de la séance), before: minutes avant }.
export function nextReminder(reminders, timeZone, now) {
  if (!reminders?.days?.length || !/^\d{2}:\d{2}$/.test(reminders.time || '')) return null;
  const [h, min] = reminders.time.split(':').map(Number);
  for (let i = 0; i <= 7; i++) {
    const { y, m, d, weekday } = localDay(now + i * 864e5, timeZone);
    if (!reminders.days.includes(weekday)) continue;
    const at = localToUtc(y, m, d, h, min, timeZone) - (reminders.before || 0) * 60000;
    if (at > now) return { at, day: weekday };
  }
  return null;
}
