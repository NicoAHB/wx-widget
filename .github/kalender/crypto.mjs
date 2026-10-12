// Kostenloser öffentlicher Kalenderauszug, ohne API-Schlüssel und ohne Browser-CORS.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { normalizePublicCryptoEvents, readPublicCryptoPage } from '../../shared/crypto-calendar.mjs';
export function buildCryptoCalendar(html, now = Date.now()) {
  const rows = readPublicCryptoPage(html), events = normalizePublicCryptoEvents(rows, now);
  if (rows.length && !events.length) throw new Error('Keine kommenden Termine mit konkretem Datum; bisherigen Stand behalten.');
  return { v: 1, source: 'CoinMarketCal · öffentlicher Auszug', fetchedAt: new Date(now).toISOString(), page: 'https://coinmarketcal.com/en/', coverage: 'Öffentlicher Ausschnitt, keine vollständige API-Historie', events };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.stdout.write(JSON.stringify(buildCryptoCalendar(fs.readFileSync(process.argv[2], 'utf8')), null, 2) + '\n'); }
  catch (error) { console.error('Krypto-Kalender: ' + error.message); process.exitCode = 1; }
}
