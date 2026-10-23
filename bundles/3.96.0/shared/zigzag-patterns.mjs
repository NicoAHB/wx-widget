// Gelernte ZigZag-Muster (3.84.0 aus weather-widget-v2.html ausgelagert; Rechnung unverändert): Momente, Musterschlüssel, Übernahme in die
// Lernstatistik. Reine Funktionen – Speicher, Chart und Anzeige bleiben in der App. tools/zzp-start.mjs rechnet damit den Startbestand.
import { ema, macd, rsi } from './indicators.mjs';
import { rsiSignal, RSI_MOMENTUM } from './rsi-momentum.mjs';
import { zzStepper, zzForecast } from './zigzag.mjs';
// ---------- Gelernte Muster: Richtung mit Wahrscheinlichkeit – nur bei nachgewiesenem Vorteil nach Gebühren ----------
// Frage je Moment (abgeschlossene Kerze mit Prognose): Erreicht der Kurs ab dem Schlusskurs zuerst +Mindestbewegung oder
// −Mindestbewegung? Berühren beide Schwellen dieselbe Kerze, zählt der Moment nicht. Muster = drei Merkmale relativ zur
// Prognoserichtung (+ dafür, − dagegen):
//   T Trend: Schlusskurs auf der Seite der EMA 200, in die die Prognose zeigt
//   S Signal-Bewertung (die vier Regeln der Signal-Übersicht): Summe ≥ 2 in Prognoserichtung (+), ≤ −2 (−), sonst 0
//   R RSI 14: + unter 35 bei Aufwärts- bzw. über 65 bei Abwärtsprognose, − umgekehrt, sonst 0
// Backtest mit echten BTC-Stundenkerzen (Coinbase und Bitfinex 2017–2019, Walk-Forward, Gebühr 0,06 % je Seite): Die
// ZigZag-Umkehr allein trifft die Richtung zu 47–50 %. Mit diesen Mustern – Umkehr oder Fortsetzung – zeigte die
// App-Simulation bei 2–3 % Mindestbewegung 55,6–57,1 %, nach Gebühren im Schnitt +0,14 bis +0,24 % je Trade (auch im
// späteren Testzeitraum im Plus); bei 1 % keine einzige Zahl.
// Klassische Muster (Doppelboden/-top, RSI-Divergenz, Bollinger-Ausbruch) verschlechterten das Ergebnis und fehlen deshalb.
// Gelernt wird je Intervall, Mindestbewegung und Muster über alle Symbole, eine Stichprobe je Muster und Extrempunkt,
// dauerhaft gespeichert und in der Sicherung enthalten. Eine Zahl erscheint nur, wenn das Muster mit hoher Sicherheit
// (untere Grenze bei z = 2,77, mind. 100 Fälle) über der Gewinnschwelle nach Gebühren liegt und die untere 95-%-Grenze
// sie um mind. 3 Punkte übertrifft. Angezeigt wird die untere 99-%-Grenze (vorsichtige Schätzung): In der Simulation
// der App (500-Kerzen-Fenster) lag die tatsächliche Trefferquote im Mittel so hoch wie die angezeigte; bei Zufallskursen
// erschien fast nie eine Zahl.
export const ZZP = Object.freeze({ nMin: 100, zGate: 2.77, zEst: 1.645, margin: .03, zShow: 2.33, from: 250 });
// 3.83.0: Regel 2 – die Signal-Bewertung im Muster (M) zählt RSI wie die Signal-Übersicht (Erholung unter 30 ODER ungewöhnlicher Anstieg,
// rsiSignal). Vorher galt nur die alte Erholungsregel, beide Anzeigen konnten sich widersprechen. Lernstände nach Regel 1 (Kennung S)
// werden nicht mit neuen vermischt: alter Stand, alter Startbestand und alte Sicherungen werden für die Prognose nicht mehr verwendet.
export const ZZP_RULE = 2;
export function wilsonLow(k, n, z) { if (!(n > 0)) return 0; const p = k / n, z2 = z * z; return (p + z2 / (2 * n) - z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))) / (1 + z2 / n); }
export function zzpIndicators(closes) { return { e200: ema(closes, 200), e20: ema(closes, 20), e50: ema(closes, 50), r: rsi(closes), m: macd(closes) }; }
export function zzpKey(closes, ind, t, dir) {
  const { e200, e20, e50, r, m } = ind, cl = closes[t];
  if (![e200[t], e20[t], e50[t], r[t], r[t - 1], m.line[t], m.signal[t]].every(Number.isFinite)) return null;
  const score = Math.sign(e20[t] - e50[t]) + Math.sign(cl - e20[t]) + rsiSignal(r.slice(Math.max(0, t - RSI_MOMENTUM.periods), t + 1)).score + Math.sign(m.line[t] - m.signal[t]);
  const T = Math.sign(cl - e200[t]) === dir ? '+' : '-', S = score * dir >= 2 ? '+' : score * dir <= -2 ? '-' : '0';
  const R = dir > 0 ? (r[t] < 35 ? '+' : r[t] > 65 ? '-' : '0') : (r[t] > 65 ? '+' : r[t] < 35 ? '-' : '0');
  return `T${T}M${S}R${R}`;
}
export const zzpWords = k => `Trend ${k[1] === '+' ? 'dafür' : 'dagegen'}, Signal-Bewertung ${k[3] === '+' ? 'dafür' : k[3] === '-' ? 'dagegen' : 'neutral'}, RSI ${k[5] === '+' ? 'günstig' : k[5] === '-' ? 'ungünstig' : 'neutral'}`;
// Momente der abgeschlossenen Kerzen c: hit true = zuerst in Prognoserichtung, false = zuerst dagegen, null = beide in einer
// Kerze, undefined = noch offen
export function zzMoments(c, pct) {
  const n = c.length, f = pct / 100, out = []; if (!(n > ZZP.from + 1) || !(f > 0)) return out;
  const closes = c.map(k => k.close), ind = zzpIndicators(closes), s = zzStepper(pct);
  for (let t = 0; t < n; t++) {
    s.push(c[t], t);
    if (t < ZZP.from) continue;
    const o = s.open(); if (!o) continue;
    const fc = zzForecast([...s.conf, o], t + 1); if (!fc) continue;
    const dir = fc.up ? 1 : -1, key = zzpKey(closes, ind, t, dir); if (!key) continue;
    const hi = closes[t] * (1 + f), lo = closes[t] * (1 - f); let hit;
    for (let j = t + 1; j < n; j++) { const u = c[j].high >= hi, d = c[j].low <= lo; if (u && d) { hit = null; break; } if (u || d) { hit = (u ? 1 : -1) === dir; break; } }
    out.push({ time: c[t].time, ext: o.t, key, up: fc.up, hit });
  }
  return out;
}
// Neue, aufgelöste Momente einer Reihe (Symbol|Intervall|Mindestbewegung) in zeitlicher Folge übernehmen: bis zum ersten
// noch offenen Moment, jeder Moment genau einmal (Merker „bis“ je Reihe), je Muster und Extrempunkt eine Stichprobe.
export function zzpApply(P, ms, series, prefix) {
  const rec = P.r[series] || [0, 0, ''], seen = new Set(rec[2] ? rec[2].split(',') : []); let [until, ext] = rec, moved = false;
  for (const m of ms) {
    if (m.time <= until) continue;
    if (m.hit === undefined) break;
    until = m.time; moved = true;
    if (m.hit === null) continue;
    if (m.ext !== ext) { ext = m.ext; seen.clear(); }
    if (seen.has(m.key)) continue; seen.add(m.key);
    const k = `${prefix}|${m.key}`, st = P.s[k] || (P.s[k] = [0, 0]); st[0]++; if (m.hit) st[1]++;
  }
  if (!moved) return false;
  P.r[series] = [until, ext, [...seen].join(',')];
  const rk = Object.keys(P.r); if (rk.length > 300) rk.sort((a, b) => P.r[a][0] - P.r[b][0]).slice(0, rk.length - 300).forEach(k => delete P.r[k]);
  return true;
}
