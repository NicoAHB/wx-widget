// Startbestand der ZigZag-Prognose (data/muster-start.json) neu berechnen – mit genau den Regeln der App.
// Die Lernfunktionen (zzMoments, zzpKey, zzpApply …) kommen aus shared/zigzag-patterns.mjs – dieselben, die die App benutzt (bis 3.83.x wurden sie aus
// weather-widget-v2.html herausgeschnitten).
// Ein Durchgang je Zeitrahmen und Mindestbewegung über die ganze Historie (zzMoments + zzpApply wie in der App); jeder Moment
// zählt genau einmal, gruppiert je Extrempunkt und Muster wie beim Lernen im Chart.
// Quelle wie beim bisherigen Bestand: Coinbase BTC-USD, Stundenkerzen 2017-07-01 bis 2019-10-17; 4h und 1d daraus gebildet.
//
//   node tools/zzp-start.mjs                      lädt die Kerzen von Coinbase (braucht Internet, z. B. in GitHub Actions)
//   node tools/zzp-start.mjs --candles datei.json  nimmt vorhandene Stundenkerzen [{time, open, high, low, close}] (ms, UTC)
//   --out data/muster-start.json (Standard)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zzMoments, zzpApply, ZZP_RULE } from '../shared/zigzag-patterns.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]]] : a), []));
const OUT = path.resolve(ROOT, args.out || 'data/muster-start.json');
const FROM = Date.UTC(2017, 6, 1), TO = Date.UTC(2019, 9, 17), H = 3600e3;
const PCTS = [0.25, 0.5, 1, 2, 3, 5, 8];

// ---- Kerzen ----
async function coinbaseHours() {
  const out = new Map(), span = 300 * H;
  for (let start = FROM; start < TO; start += span) {
    const end = Math.min(TO, start + span), url = `https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=3600&start=${new Date(start).toISOString()}&end=${new Date(end).toISOString()}`;
    let rows = null;
    for (let attempt = 1; attempt <= 5 && !rows; attempt++) {
      try { const r = await fetch(url, { headers: { 'user-agent': 'scalpdesk-startbestand' } }); if (r.ok) rows = await r.json(); else if (r.status !== 429) throw new Error(`HTTP ${r.status}`); }
      catch (e) { if (attempt === 5) throw e; }
      if (!rows) await new Promise(res => setTimeout(res, 1000 * attempt));
    }
    for (const [t, low, high, open, close] of rows) { const time = t * 1000; if (time >= FROM && time < TO) out.set(time, { time, open, high, low, close }); }
    await new Promise(res => setTimeout(res, 350));   // öffentliche Grenze: wenige Abrufe je Sekunde
  }
  return [...out.values()].sort((a, b) => a.time - b.time);
}
// Stundenkerzen zu 4h bzw. 1d (UTC-Grenzen) zusammenfassen; nur vollständige Blöcke
function aggregate(hours, ms) {
  const groups = new Map();
  for (const c of hours) { const k = Math.floor(c.time / ms) * ms; (groups.get(k) || groups.set(k, []).get(k)).push(c); }
  return [...groups].filter(([, g]) => g.length === ms / H).map(([time, g]) => ({ time, open: g[0].open, high: Math.max(...g.map(c => c.high)), low: Math.min(...g.map(c => c.low)), close: g.at(-1).close })).sort((a, b) => a.time - b.time);
}

// ---- Lernen: die letzte Kerze gilt wie in der App als noch laufend ----
function learn(app, candles, interval, P) {
  for (const pct of PCTS) app.zzpApply(P, app.zzMoments(candles.slice(0, -1), pct), `BTCUSD|${interval}|${pct}`, `${interval}|${pct}`);
}

const app = { zzMoments, zzpApply, ZZP_RULE };
const hours = args.candles ? JSON.parse(fs.readFileSync(path.resolve(args.candles), 'utf8')) : await coinbaseHours();
if (hours.length < 1000) throw new Error(`Zu wenige Stundenkerzen (${hours.length})`);
const P = { v: 1, rule: app.ZZP_RULE, s: {}, r: {} }, t0 = Date.now();
for (const [interval, data] of [['1h', hours], ['4h', aggregate(hours, 4 * H)], ['1d', aggregate(hours, 24 * H)]]) {
  learn(app, data, interval, P);
  console.log(`${interval}: ${data.length} Kerzen, bisher ${Object.keys(P.s).length} Muster (${Math.round((Date.now() - t0) / 1000)} s)`);
}
const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null, version = (Number(old?.version) || 0) + (old?.rule === app.ZZP_RULE ? 0 : 1);
const first = new Date(hours[0].time).toISOString().slice(0, 10), last = new Date(hours.at(-1).time).toISOString().slice(0, 10);
const file = { kind: 'scalpdesk-patterns', v: 1, rule: app.ZZP_RULE, version, created: new Date().toISOString().slice(0, 10),
  source: `Coinbase BTC-USD, Stundenkerzen ${first} bis ${last} (1h, daraus 4h und 1d), gelernt mit den Regeln der App (Regel ${app.ZZP_RULE})`,
  s: Object.fromEntries(Object.entries(P.s).sort(([a], [b]) => a.localeCompare(b))), r: {} };
fs.writeFileSync(OUT, JSON.stringify(file) + '\n');
console.log(`Geschrieben: ${path.relative(ROOT, OUT)} · Version ${version} · ${Object.keys(file.s).length} Muster · ${Object.values(file.s).reduce((a, v) => a + v[0], 0)} Fälle`);
