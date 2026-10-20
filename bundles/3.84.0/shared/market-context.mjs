// Gesamtmarkt-Lage (3.84.0): BTC-Dominanz (stündlicher Auszug von CoinGecko über einen GitHub-Ablauf) und ETH/BTC (Binance, Tageskerzen).
// Reiner Rechenkern ohne Netz und Oberfläche; wird vom Ablauf (.github/markt/build.mjs) und von der App benutzt.
// Beantwortet nur eine Frage: Laufen Altcoins gerade eher besser oder schlechter als Bitcoin? Orientierung, kein Handelssignal.
const H = 36e5, D = 864e5, finite = Number.isFinite;
export const MARKET_CONTEXT = Object.freeze({ version: 1, keep: 336, minGapMs: 50 * 60000, staleMs: 6 * H, refreshMs: 15 * 60000, ethBtcSymbol: 'ETHBTC', domStepPp: .5, ethBtcStepPct: 1.5, stableStepPp: .3 });
// Rohantwort von CoinGecko (/api/v3/global) → Messpunkt oder null, wenn etwas unplausibel ist
export function snapshotFromGlobal(raw, now = Date.now()) {
  const d = raw?.data, p = d?.market_cap_percentage, total = d?.total_market_cap?.usd;
  const btc = Number(p?.btc), eth = Number(p?.eth), usdt = Number(p?.usdt ?? 0), usdc = Number(p?.usdc ?? 0), chg24 = Number(d?.market_cap_change_percentage_24h_usd);
  if (![btc, eth, usdt, usdc].every(finite) || !(btc > 20 && btc < 90) || !(eth > 0 && eth < 50) || usdt < 0 || usdc < 0 || !(Number(total) > 1e11)) return null;
  const t = Number(d.updated_at) > 0 ? Number(d.updated_at) * 1000 : now;
  return { t: Math.abs(now - t) < 3 * H ? t : now, btc: +btc.toFixed(3), eth: +eth.toFixed(3), stable: +(usdt + usdc).toFixed(3), total: Math.round(total), chg24: finite(chg24) ? +chg24.toFixed(3) : null };
}
const validPoint = x => x && [x.t, x.btc, x.eth, x.stable, x.total].every(finite);
// Verlauf fortschreiben: höchstens ein Punkt je ~Stunde, nur die letzten 14 Tage, aufsteigend
export function mergeHistory(prev, snapshot, now = Date.now()) {
  const old = Array.isArray(prev?.history) ? prev.history.filter(validPoint) : [], last = old.at(-1);
  const history = snapshot && (!last || snapshot.t - last.t >= MARKET_CONTEXT.minGapMs) && (!last || snapshot.t > last.t) ? [...old, snapshot] : old;
  return { v: MARKET_CONTEXT.version, updated: new Date(now).toISOString(), history: history.slice(-MARKET_CONTEXT.keep) };
}
// Datei aus dem Zweig prüfen (Fehler → Ausnahme mit lesbarem Grund)
export function parseMarketContext(data) {
  if (!data || data.v !== MARKET_CONTEXT.version || !Array.isArray(data.history)) throw new Error('Markt-Lage-Datei hat ein unbekanntes Format.');
  const history = data.history.filter(validPoint).sort((a, b) => a.t - b.t);
  if (!history.length) throw new Error('Markt-Lage-Datei enthält noch keine Messpunkte.');
  return { updated: Date.parse(data.updated) || history.at(-1).t, history };
}
// Veränderung von key (Prozentpunkte) zwischen dem letzten Punkt und dem Punkt nahe „vor spanMs“; null, wenn dort keiner liegt
export function historyChange(history, key, spanMs) {
  const last = history.at(-1); if (!last) return null;
  const target = last.t - spanMs, tol = Math.max(2 * H, spanMs * .15);
  const near = history.filter(p => Math.abs(p.t - target) <= tol).sort((a, b) => Math.abs(a.t - target) - Math.abs(b.t - target))[0];
  return near && near !== last && finite(near[key]) ? last[key] - near[key] : null;
}
// ETH/BTC aus Tageskerzen: Veränderung des Schlusskurses gegenüber dem Schluss vor `days` Tagen in Prozent (laufende Kerze zählt als jetziger Stand)
export function ethBtcChange(rows, days) {
  const r = (rows || []).filter(c => finite(c?.close) && finite(c?.time)).sort((a, b) => a.time - b.time), last = r.at(-1);
  if (!last || r.length <= days) return null;
  const before = r[r.length - 1 - days]; if (last.time - before.time !== days * D || !(before.close > 0)) return null;
  return (last.close / before.close - 1) * 100;
}
// Urteil und Zeilen für die Anzeige. dom/eth: aus historyChange bzw. ethBtcChange.
export function marketContext({ history = [], ethbtc = [], now = Date.now() } = {}) {
  const C = MARKET_CONTEXT, last = history.at(-1), stale = !last || now - last.t > C.staleMs;
  const dom24 = last ? historyChange(history, 'btc', D) : null, dom7 = last ? historyChange(history, 'btc', 7 * D) : null, stable7 = last ? historyChange(history, 'stable', 7 * D) : null;
  const e24 = ethBtcChange(ethbtc, 1), e7 = ethBtcChange(ethbtc, 7), ethBtcNow = ethbtc.at(-1)?.close ?? null;
  const vote = (v, step, sign) => (v === null ? 0 : v <= -step ? sign : v >= step ? -sign : 0);   // sinkende BTC-Dominanz / steigendes ETH/BTC → +1 (Altcoins)
  const score = vote(dom7, C.domStepPp, 1) + (e7 === null ? 0 : e7 >= C.ethBtcStepPct ? 1 : e7 <= -C.ethBtcStepPct ? -1 : 0), known = (dom7 !== null) + (e7 !== null);
  const status = !known ? 'unknown' : score >= 1 ? 'alt' : score <= -1 ? 'btc' : 'neutral';
  const headline = { unknown: 'Noch zu wenig Verlauf für eine Einschätzung.', alt: 'Altcoins laufen auf Wochensicht eher besser als Bitcoin.', btc: 'Bitcoin läuft auf Wochensicht eher besser als Altcoins.', neutral: 'Kein klarer Vorteil für Altcoins oder Bitcoin.' }[status];
  const hint = stable7 === null ? '' : stable7 >= C.stableStepPp ? 'Der Stablecoin-Anteil steigt: Anleger gehen eher auf Nummer sicher.' : stable7 <= -C.stableStepPp ? 'Der Stablecoin-Anteil sinkt: mehr Risikobereitschaft.' : '';
  return { status, headline, hint, stale, score, known, now: last ? { btc: last.btc, eth: last.eth, stable: last.stable, total: last.total, chg24: last.chg24, at: last.t } : null, dom24, dom7, stable7, ethBtc: { now: ethBtcNow, d1: e24, d7: e7 } };
}
