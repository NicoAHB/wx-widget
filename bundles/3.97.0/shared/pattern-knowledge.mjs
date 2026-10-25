// Chartmuster-Wissen (3.92.0): Trefferzählung je MUSTER statt je Coin – gemeinsam für die App und den 24/7-Dienst. Reine Rechnung.
// Ein Fall = ein bestätigtes Muster (Archiv der App bzw. des Dienstes) mit Ergebnis nach PK.horizon Kerzen: „auf“, „ab“ oder „seitwärts“
// (±PK.eps %). Gezählt wird je Muster, Intervall und Richtung über alle Coins und beide Märkte. Doppelte Fälle (derselbe Coin, dieselbe
// Bestätigungskerze in Spot und Futures) zählen einmal. Fälle verschiedener Coins zur selben Zeit sind nicht unabhängig (BTC zieht den Markt
// mit): Die Zahl der „Zeitpunkte“ (gleiche Stunde bzw. Kerze) bestimmt deshalb die Unsicherheit. Keine Erfolgswahrscheinlichkeit.
import { INTERVAL_MS } from './market-intervals.mjs';

export const PK = Object.freeze({
  horizon: 12, eps: 0.10, profile: 'H12-e0.10', model: 'pat-1',
  minPool: 30,            // so viele Fälle braucht die Musterzahl (vorher 10 je Coin)
  minCoin: 30,            // Coin-Zahl erscheint nur ab so vielen eigenen Fällen
  momentMs: 3600000,      // Fälle in demselben Zeitfenster (mindestens 1 Stunde bzw. 1 Kerze) zählen als ein Zeitpunkt
  baselineWindow: 250, baselineMin: 50
});
const finite = Number.isFinite;

// Wilson-Bereich (95 %) für einen Anteil; n darf eine „wirksame“ Fallzahl sein (Zeitpunkte)
export function wilson(yes, n, z = 1.96) {
  if (!(n > 0) || !finite(yes)) return null;
  const p = Math.min(1, Math.max(0, yes / n)), z2 = z * z, d = 1 + z2 / n, c = (p + z2 / (2 * n)) / d, m = z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / d;
  return { lo: Math.max(0, c - m), hi: Math.min(1, c + m) };
}

const ranks = mkt => mkt === 'futures' ? 0 : 1;
const done = c => c && c.res && ['auf', 'ab', 'seitwärts'].includes(c.res.out) && finite(c.tc);

// Zählung einer Fallliste: Ereignisse (dedupliziert), Verteilung, Coins, Zeitpunkte, Zeitraum
export function patternStat(events, interval) {
  const st = { n: 0, auf: 0, ab: 0, sw: 0, coins: 0, moments: 0, from: null, to: null }, coins = new Set(), moments = new Set(), bucket = Math.max(PK.momentMs, INTERVAL_MS[interval] || 0);
  for (const c of events) {
    st.n++; if (c.res.out === 'auf') st.auf++; else if (c.res.out === 'ab') st.ab++; else st.sw++;
    coins.add(c.sym); moments.add(Math.floor(c.tc / bucket));
    st.from = Math.min(st.from ?? c.tc, c.tc); st.to = Math.max(st.to ?? c.tc, c.tc);
  }
  st.coins = coins.size; st.moments = moments.size;
  return st;
}

// Abgeschlossene Fälle einer Auswahl, ein Ereignis je Coin und Bestätigungskerze (Futures vor Spot, sonst der gewählte Markt zuerst)
export function patternEvents(cases, sel) {
  const want = sel.mkt, byKey = new Map();
  for (const c of cases || []) {
    if (!done(c) || c.iv !== sel.iv || c.pat !== sel.pat || (sel.dir && c.dir !== sel.dir) || (c.model ?? PK.model) !== (sel.model ?? PK.model) || (c.profile ?? PK.profile) !== (sel.profile ?? PK.profile)) continue;
    const key = [c.sym, c.tc, c.src].join('|'), old = byKey.get(key);
    if (!old || (c.mkt === want && old.mkt !== want) || (old.mkt !== want && ranks(c.mkt) < ranks(old.mkt))) byKey.set(key, c);
  }
  return [...byKey.values()];
}

// Zufallsvergleich: Anteil der Kerzen eines Coins, nach deren Schluss der Kurs PK.horizon Kerzen später um mehr als ±eps stand
// (letzte `window` abgeschlossene Kerzen; k = [{ t, c }] aufsteigend, ohne laufende Kerze)
export function patternBaseline(k, { window = PK.baselineWindow, horizon = PK.horizon, eps = PK.eps } = {}) {
  if (!Array.isArray(k)) return null;
  const rows = k.filter(x => finite(x?.c) && x.c > 0), last = rows.length - horizon;
  if (last <= 0) return null;
  const st = { n: 0, auf: 0, ab: 0, sw: 0 };
  for (let i = Math.max(0, last - window); i < last; i++) {
    const r = 100 * (rows[i + horizon].c / rows[i].c - 1);
    st.n++; if (r > eps) st.auf++; else if (r < -eps) st.ab++; else st.sw++;
  }
  return st.n >= PK.baselineMin ? st : null;
}

// Das „Erlernt“-Objekt einer Meldung. sel: { pat, iv, dir ('bull'|'bear'), sym, mkt }.
// Mit genug Fällen: Musterzahl (live vor rekonstruiert) samt Bereich, Coin-Zahl (nur ab PK.minCoin) und Zufallsvergleich; sonst { available, minimum }.
export function patternLearned(cases, sel, { baseline = null, minimum = PK.minPool } = {}) {
  const sign = sel.dir === 'bear' ? -1 : 1, yesOf = s => sign > 0 ? s.auf : s.ab, parts = {};
  for (const src of ['live', 'rekonstruiert']) {
    const all = patternEvents(cases, sel).filter(c => c.src === src);
    parts[src] = { ...patternStat(all, sel.iv), events: all };
  }
  const pick = parts.live.n >= minimum ? 'live' : parts.rekonstruiert.n >= minimum ? 'rekonstruiert' : null;
  if (!pick) return { available: Math.max(parts.live.n, parts.rekonstruiert.n), minimum };
  const { events, ...st } = parts[pick], yes = yesOf(st), eff = st.moments, range = wilson(yes * eff / st.n, eff);
  const ownStat = patternStat(events.filter(c => c.sym === sel.sym), sel.iv);
  return {
    ...st, total: st.n, up: st.auf, down: st.ab, yes, rate: yes / st.n, lo: range?.lo ?? null, hi: range?.hi ?? null, minimum,
    source: pick === 'live' ? 'live protokolliert' : 'rekonstruiert', horizon: PK.horizon, scope: 'alle Coins',
    coin: ownStat.n >= PK.minCoin ? { n: ownStat.n, yes: yesOf(ownStat), rate: yesOf(ownStat) / ownStat.n } : null,
    coinAvailable: ownStat.n,
    base: baseline && baseline.n >= PK.baselineMin ? { n: baseline.n, yes: sign > 0 ? baseline.auf : baseline.ab, rate: (sign > 0 ? baseline.auf : baseline.ab) / baseline.n } : null
  };
}
