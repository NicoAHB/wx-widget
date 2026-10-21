// Nur Darstellung. Niemals Zeitstempel, Börsenintervalle oder API-Parameter verschieben.
export const DISPLAY_TIME_ZONE = 'Europe/Berlin';
const clock = new Intl.DateTimeFormat('de-DE', { timeZone: DISPLAY_TIME_ZONE, hour: '2-digit', minute: '2-digit' });
const day = new Intl.DateTimeFormat('de-DE', { timeZone: DISPLAY_TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric' });
const zone = new Intl.DateTimeFormat('de-DE', { timeZone: DISPLAY_TIME_ZONE, timeZoneName: 'short' });
const cache = new Map();
export function displayTimeParts(time) {
  if (!Number.isFinite(time)) return null;
  if (!cache.has(time)) {
    if (cache.size >= 4096) cache.delete(cache.keys().next().value);
    cache.set(time, { clock: clock.format(time), day: day.format(time), zone: zone.formatToParts(time).find(p => p.type === 'timeZoneName').value });
  }
  return cache.get(time);
}
