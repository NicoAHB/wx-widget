// ZigZag, statistische Prognose des nächsten Schwungs und Walk-Forward-Lernen daraus (3.84.0 aus weather-widget-v2.html ausgelagert; Rechnung
// unverändert). Reine Funktionen auf Kerzen {time, high, low, close}; ohne Oberfläche, Speicher und Netz. Die App ruft sie über kleine
// Hüllen mit den Standardwerten des angezeigten Charts auf; Werkzeuge und Tests importieren sie direkt.

export function zzStepper(pct) {
  const f = pct / 100, conf = []; let dir = 0, hi = 0, hiI = -1, hiT = 0, lo = 0, loI = -1, loT = 0;
  const pivot = (i, t, price, type) => conf.push({ i, t, price, type, ok: true });
  return {
    conf,
    push(k, i) {
      const h = k.high, l = k.low;
      if (hiI < 0) { hi = h; hiI = i; hiT = k.time; lo = l; loI = i; loT = k.time; return; }
      if (dir === 0) { // Richtung noch offen: die erste Bewegung um die Mindestgröße entscheidet
        if (h > hi) { hi = h; hiI = i; hiT = k.time; }
        if (l < lo) { lo = l; loI = i; loT = k.time; }
        if (loI < hiI && hi >= lo * (1 + f)) { pivot(loI, loT, lo, 'L'); dir = 1; }
        else if (hiI < loI && lo <= hi * (1 - f)) { pivot(hiI, hiT, hi, 'H'); dir = -1; }
      } else if (dir === 1) { // aufwärts: Hoch nachziehen, Umkehr erst nach einem Rückgang um die Mindestgröße
        if (h >= hi) { hi = h; hiI = i; hiT = k.time; } else if (l <= hi * (1 - f)) { pivot(hiI, hiT, hi, 'H'); dir = -1; lo = l; loI = i; loT = k.time; }
      } else { // abwärts: Tief nachziehen, Umkehr erst nach einem Anstieg um die Mindestgröße
        if (l <= lo) { lo = l; loI = i; loT = k.time; } else if (h >= lo * (1 + f)) { pivot(loI, loT, lo, 'L'); dir = 1; hi = h; hiI = i; hiT = k.time; }
      }
    },
    open() { return dir === 1 ? { i: hiI, t: hiT, price: hi, type: 'H', ok: false } : dir === -1 ? { i: loI, t: loT, price: lo, type: 'L', ok: false } : null; },
  };
}
export function zigzag(c, pct) {
  if (!(c?.length > 1) || !(pct > 0)) return [];
  const s = zzStepper(pct); c.forEach((k, i) => s.push(k, i));
  const o = s.open(); return o ? [...s.conf, o] : [...s.conf];
}

// ---------- ZigZag-Prognose (statistische Projektion des nächsten Schwungs) ----------
// Aus den bestätigten Schwüngen dieses Charts: Median-Größe und -Dauer der Schwünge in Gegenrichtung zum laufenden,
// dazu die mittlere Hälfte (25–75 %) als Band. Annahme: der laufende Extrempunkt ist die nächste Umkehr. Keine
// Vorhersage, sondern „so groß und so lang waren die Gegenbewegungen hier bisher typischerweise“.
export function zzForecast(piv, n) {
  const conf = piv.filter(p => p.ok), last = piv.at(-1);
  if (!last || last.ok || conf.length < 3) return null;
  const up = last.type === 'L', legs = [];
  for (let k = 1; k < conf.length; k++) { const a = conf[k - 1], b = conf[k]; if ((b.price > a.price) === up) legs.push({ pct: Math.abs(b.price / a.price - 1) * 100, bars: b.i - a.i }); }
  const same = legs.slice(-20); if (same.length < 3) return null;
  const q = (arr, f) => { const s = [...arr].sort((x, y) => x - y), k = (s.length - 1) * f, i = Math.floor(k); return s[i] + ((s[Math.ceil(k)] ?? s[i]) - s[i]) * (k - i); };
  const pcts = same.map(l => l.pct), med = q(pcts, .5), p25 = q(pcts, .25), p75 = q(pcts, .75), bars = Math.max(1, Math.round(q(same.map(l => l.bars), .5)));
  const at = p => last.price * (1 + (up ? 1 : -1) * p / 100);
  return { from: last, up, n: same.length, pct: med, p25, p75, bars, to: { i: Math.max(last.i + bars, n), price: at(med) }, lo: at(p25), hi: at(p75) };
}
// ---------- Lernen aus eingetroffenen und verfehlten Prognosen (Walk-Forward) ----------
// Die App geht die geladenen Kerzen durch und rechnet zu jedem Zeitpunkt nur mit dem, was damals bekannt war:
// – Lernfaktor: für jeden abgeschlossenen Schwung das Verhältnis tatsächliche Größe / damalige Prognose; der Median der
//   letzten (bis zu 12) Verhältnisse je Richtung korrigiert die nächste Prognose (bisher zu groß geschätzt → kleiner und
//   umgekehrt). Ein ZigZag-Schwung ist nie kleiner als die Mindestbewegung, das Ziel also auch nicht.
//   Angewendet wird er nur, solange er die Größenschätzung in diesem Chart bisher genauer gemacht hat (Summe der
//   Abweichungen |ln(tatsächlich / geschätzt)| mit und ohne Korrektur, mind. 6 Schwünge mit Korrektur). Bei zufälligem
//   Kursverlauf gibt es nichts zu lernen – dann würde die Korrektur nur Rauschen hinzufügen.
// – Trefferquote: Anteil der Zeitpunkte, an denen der Kurs das Prognoseziel innerhalb der doppelten erwarteten Dauer
//   erreichte, bevor er den Extrempunkt um mehr als die halbe Mindestbewegung überschritt (gleiche Kerze: zählt als Fehler).
//   Gezählt wird, was die App zum jeweiligen Zeitpunkt angezeigt hätte; zum Vergleich auch ohne Lernfaktor.
//   Die laufende letzte Kerze bleibt außen vor.
export function zzLearn(c, pct) {
  const n = c.length - 1, f = pct / 100, out = { n: 0, hits: 0, plain: 0, corr: { up: 1, down: 1 }, raw: { up: 1, down: 1 }, use: false, swings: 0, k: 0, dev: { c: 0, p: 0 } };
  if (!(n >= 40) || !(f > 0)) return out;
  const s = zzStepper(pct), ratios = { up: [], down: [] }, pend = [], err = { c: 0, p: 0 };
  const med = a => { const x = [...a].sort((p, q) => p - q), m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; };
  const corrOf = up => { const r = ratios[up ? 'up' : 'down'].slice(-12); return r.length >= 3 ? Math.min(2, Math.max(.4, med(r))) : 1; };
  const use = () => out.k >= 6 && err.c < err.p;
  const at = (fc, p) => fc.from.price * (1 + (fc.up ? 1 : -1) * Math.max(pct, p) / 100);
  for (let t = 0; t < n; t++) {
    const k = c[t];
    for (let j = pend.length - 1; j >= 0; j--) { // Stichproben früherer Zeitpunkte mit dieser Kerze auflösen
      const p = pend[j], broke = p.up ? k.low <= p.stop : k.high >= p.stop, late = t > p.until;
      for (const key of ['c', 'p']) if (p[key] === undefined) p[key] = broke || late ? false : (p.up ? k.high >= p[key + 't'] : k.low <= p[key + 't']) || undefined;
      if (p.c !== undefined && p.p !== undefined) { out.n++; out.hits += p.c ? 1 : 0; out.plain += p.p ? 1 : 0; pend.splice(j, 1); }
    }
    const before = s.conf.length; s.push(k, t);
    for (let q = Math.max(2, before); q < s.conf.length; q++) { // Schwung abgeschlossen: tatsächliche Größe / damalige Prognose
      const a = s.conf[q - 1], b = s.conf[q], fc = zzForecast([...s.conf.slice(0, q - 1), { ...a, ok: false }], a.i + 1);
      if (!fc) continue;
      const real = Math.abs(b.price / a.price - 1) * 100, corr = corrOf(fc.up);
      err.p += Math.abs(Math.log(real / fc.pct)); err.c += Math.abs(Math.log(real / Math.max(pct, fc.pct * corr)));
      out.swings++; if (corr !== 1) out.k++;
      ratios[fc.up ? 'up' : 'down'].push(real / fc.pct);
    }
    const o = s.open(); if (!o) continue;
    const fc = zzForecast([...s.conf, o], t + 1); if (!fc) continue;
    pend.push({ up: fc.up, ct: at(fc, fc.pct * (use() ? corrOf(fc.up) : 1)), pt: at(fc, fc.pct), stop: fc.from.price * (1 - (fc.up ? 1 : -1) * f / 2), until: t + Math.max(3, 2 * fc.bars) });
  }
  out.use = use(); out.raw = { up: corrOf(true), down: corrOf(false) }; if (out.use) out.corr = out.raw;
  if (out.swings) out.dev = { c: Math.exp(err.c / out.swings) - 1, p: Math.exp(err.p / out.swings) - 1 }; // typische Abweichung
  return out;
}
