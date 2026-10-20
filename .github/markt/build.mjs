// Markt-Lage (3.84.0): holt die Marktanteile von CoinGecko (/api/v3/global, frei, ohne Schlüssel) und schreibt sie als Verlauf fort.
//   node .github/markt/build.mjs vorher.json neu.json [--global antwort.json]
// vorher.json = bisheriger Stand aus dem Zweig „markt-lage“ (darf fehlen); --global liest die CoinGecko-Antwort aus einer Datei (Test).
// Ausgang 0 = geschrieben, 3 = Quelle nicht erreichbar oder unplausibel (bisheriger Stand bleibt, der Ablauf veröffentlicht nichts).
import fs from 'node:fs';
import { snapshotFromGlobal, mergeHistory } from '../../shared/market-context.mjs';

const args = process.argv.slice(2), at = args.indexOf('--global'), globalFile = at >= 0 ? args.splice(at, 2)[1] : null, [prevPath, outPath] = args;
if (!outPath) { console.error('Aufruf: node .github/markt/build.mjs vorher.json neu.json [--global antwort.json]'); process.exit(2); }
let prev = null; try { prev = JSON.parse(fs.readFileSync(prevPath, 'utf8')); } catch { console.log('Noch kein voriger Stand.'); }
async function load() {
  if (globalFile) return JSON.parse(fs.readFileSync(globalFile, 'utf8'));
  let last = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch('https://api.coingecko.com/api/v3/global', { headers: { accept: 'application/json', 'user-agent': `ScalpDesk-Marktlage (github.com/${process.env.GITHUB_REPOSITORY || 'NicoAHB/wx-widget'})` }, signal: AbortSignal.timeout(30000) });
      if (r.ok) return await r.json();
      last = new Error(`HTTP ${r.status}`);
    } catch (e) { last = e; }
    await new Promise(res => setTimeout(res, 3000 * attempt));
  }
  throw last;
}
let raw; try { raw = await load(); } catch (e) { console.error(`::warning::CoinGecko nicht erreichbar (${e.message}); letzter Stand bleibt.`); process.exit(3); }
const snapshot = snapshotFromGlobal(raw);
if (!snapshot) { console.error('::warning::CoinGecko-Antwort unplausibel; letzter Stand bleibt.'); process.exit(3); }
const out = mergeHistory(prev, snapshot);
fs.writeFileSync(outPath, JSON.stringify(out) + '\n');
console.log(`Geschrieben: ${out.history.length} Messpunkte · BTC-Dominanz ${snapshot.btc} % · ETH ${snapshot.eth} % · Stablecoins ${snapshot.stable} %`);
