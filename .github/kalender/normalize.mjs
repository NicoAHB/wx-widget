// Wirtschaftskalender für Scalp Desk (Schritt 4.1): bereitet den Wochenkalender von Forex Factory (JSON-Export von
// nfs.faireconomy.media) für die App auf. Der GitHub-Job .github/workflows/kalender.yml ruft das Skript alle 3 Stunden auf.
// Aufruf: node normalize.mjs ff_thisweek.json [ff_nextweek.json] > calendar.json
// Fehlt eine Datei oder ist sie kein gültiger Kalender, zählt sie nicht. Ohne einen einzigen gültigen Termin endet das
// Skript mit Fehler (Exit 1) und schreibt nichts – dann bleibt der bisherige Stand im Zweig „kalender“ erhalten.
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const IMPACT = { high: 'high', medium: 'medium', low: 'low', holiday: 'holiday' };
const text = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

// Liste(n) im Format von Forex Factory → einheitliche Termine, zeitlich sortiert, ohne Doppelte
export function normalize(lists) {
  const seen = new Set(), events = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const e of list) {
      const t = Date.parse(e?.date), title = text(e?.title, 90), cur = text(e?.country, 5).toUpperCase();
      if (!Number.isFinite(t) || !title || !/^[A-Z]{3}$/.test(cur)) continue;
      const key = `${t}|${cur}|${title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      events.push({ t, cur, impact: IMPACT[text(e.impact, 20).toLowerCase()] || 'none', title,
        forecast: text(e.forecast, 20), previous: text(e.previous, 20), actual: text(e.actual, 20) });
    }
  }
  return events.sort((a, b) => a.t - b.t || a.cur.localeCompare(b.cur) || a.title.localeCompare(b.title));
}

export function build(files, now = Date.now()) {
  const lists = [];
  for (const f of files) {
    if (!existsSync(f)) { console.error(`${f}: fehlt`); continue; }
    try { const j = JSON.parse(readFileSync(f, 'utf8')); if (Array.isArray(j)) lists.push(j); else console.error(`${f}: keine Liste`); }
    catch (e) { console.error(`${f}: kein JSON (${e.message})`); }
  }
  const events = normalize(lists);
  if (!events.length) throw new Error('keine gültigen Termine');
  return { v: 1, source: 'Forex Factory', fetchedAt: new Date(now).toISOString(), lists: lists.length, events };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.stdout.write(JSON.stringify(build(process.argv.slice(2)))); }
  catch (e) { console.error(`Abbruch: ${e.message}`); process.exit(1); }
}
