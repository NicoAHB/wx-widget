// Automatisch aus weather-widget-v2.html erzeugt; nicht von Hand ändern.
// Neu erzeugen: node server/generate-pattern-engine.mjs
export function patEngine() {
  const VER = 'pat-1', N_PRE = 8, ZZ_MULT = 1.5;
  const R = (k, w, ok, v = '') => ({ k, w, ok, v });
  const quality = rules => { const all = rules.reduce((s, r) => s + r.w, 0), got = rules.reduce((s, r) => s + (r.ok === true ? r.w : 0), 0); return all ? Math.round(got / all * 100) : 0; };
  function atrSeries(k) {
    const out = new Array(k.length).fill(null); let a = null, sum = 0;
    for (let i = 0; i < k.length; i++) {
      const c = k[i], pc = i ? k[i - 1].c : null, tr = pc === null ? c.h - c.l : Math.max(c.h - c.l, Math.abs(c.h - pc), Math.abs(c.l - pc));
      if (i < 14) { sum += tr; if (i === 13) out[i] = a = sum / 14; } else out[i] = a = (a * 13 + tr) / 14;
    }
    return out;
  }
  // aufeinanderfolgend ohne Lücke (Monat: 27–32 Tage)
  const cont = (k, i, step) => { const d = k[i].t - k[i - 1].t; return step ? d === step : d >= 27 * 864e5 && d <= 32 * 864e5; };
  // Vortrend: N = 8 abgeschlossene Schlusskurse direkt vor der ersten Musterkerze, lineare Regression gegen den Index,
  // A = ATR 14 der letzten Vorgängerkerze; Trend nur bei R² ≥ 0,35 und |b·(N−1)| ≥ 0,75·A. Keine Muster- oder Zukunftskerzen.
  function preTrend(k, i0, A, step) {
    if (i0 - N_PRE < 0) return { dir: null, why: 'weniger als 8 Vorgängerkerzen' };
    for (let i = i0 - N_PRE + 1; i < i0; i++) if (!cont(k, i, step)) return { dir: null, why: 'Lücke vor dem Muster' };
    const a = A[i0 - 1]; if (!(a > 0)) return { dir: null, why: 'ATR 14 fehlt oder ist 0' };
    let sx = 0, sy = 0; for (let j = 0; j < N_PRE; j++) { sx += j; sy += k[i0 - N_PRE + j].c; }
    const mx = sx / N_PRE, my = sy / N_PRE; let sxy = 0, sxx = 0, syy = 0;
    for (let j = 0; j < N_PRE; j++) { const dx = j - mx, dy = k[i0 - N_PRE + j].c - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
    const b = sxy / sxx, r2 = syy > 0 ? (sxy * sxy) / (sxx * syy) : 0, mv = Math.abs(b * (N_PRE - 1));
    return { dir: r2 >= 0.35 && mv >= 0.75 * a ? (b > 0 ? 'up' : 'down') : 'neutral', b, r2, A: a, mv };
  }
  const P = c => { const body = Math.abs(c.c - c.o), range = c.h - c.l; return { body, range, up: c.h - Math.max(c.o, c.c), lo: Math.min(c.o, c.c) - c.l, bull: c.c > c.o, bear: c.c < c.o, mid: (c.o + c.c) / 2, top: Math.max(c.o, c.c), bot: Math.min(c.o, c.c) }; };
  const pct = (a, b) => (b > 0 ? a / b : 0);

  // ---------- Kerzenmuster ----------
  function candles(k, A, opt) {
    const out = [], last = k.length - 1, closedEnd = opt.running ? last - 1 : last;
    const volAvg = i => { let s = 0, n = 0; for (let j = Math.max(0, i - 20); j < i; j++) if (k[j].v > 0) { s += k[j].v; n++; } return n >= 10 ? s / n : null; };
    for (let i = Math.max(opt.from, 1); i <= last; i++) {
      for (const d of DEF) {
        if (i - d.n + 1 < opt.from) continue;
        const i0 = i - d.n + 1, cs = k.slice(i0, i + 1), a = A[i0 - 1] || A[i0];
        if (!(a > 0)) continue;
        const shape = d.f(cs.map(P), cs, a, opt); if (!shape) continue;
        const rules = shape.rules.slice(), tr = preTrend(k, i0, A, opt.step);
        if (d.fam === 'bullRev' || d.fam === 'bearRev') {
          const need = d.fam === 'bullRev' ? 'down' : 'up', ok = tr.dir === null ? null : tr.dir === need;
          if (ok !== true) continue;   // Umkehrmuster brauchen den passenden Vortrend (fehlende Daten → kein Treffer)
          rules.unshift(R(`Vortrend ${need === 'down' ? 'abwärts' : 'aufwärts'} (8 Kerzen, R² ≥ 0,35, Bewegung ≥ 0,75 ATR)`, 2, true, `R² ${tr.r2.toFixed(2)}, Bewegung ${(tr.mv / tr.A).toFixed(2)} ATR`));
        }
        if (d.fam === 'neutral') rules.push(R('nach einem Trend (8 Kerzen) – sonst wenig aussagekräftig', 2, tr.dir === null ? null : tr.dir !== 'neutral', tr.dir === null ? tr.why : tr.dir === 'neutral' ? 'kein Trend' : tr.dir === 'up' ? 'aufwärts' : 'abwärts'));
        const va = volAvg(i0), vl = k[i].v;
        rules.push(R('Volumen der letzten Musterkerze über dem 20er-Schnitt', 1, va === null || !(vl >= 0) ? null : vl > va, va ? `${(vl / va).toFixed(2)}×` : 'kein Volumen'));
        let conf = null;
        if (d.fam !== 'neutral' && d.fam !== 'cont') {
          const nx = i + 1 <= closedEnd ? k[i + 1] : null, up = d.dir === 'bull';
          conf = nx ? (up ? nx.c > k[i].c : nx.c < k[i].c) : null;
          rules.push(R(`Bestätigung: Folgekerze schließt ${up ? 'höher' : 'tiefer'}`, 2, conf, nx ? (conf ? 'ja' : 'nein') : 'noch offen'));
        }
        const prelim = i > closedEnd;
        out.push({ id: d.id, kind: 'candle', dir: d.dir, i0, i1: i, t0: k[i0].t, t1: k[i].t, rules, q: quality(rules), prelim,
          status: prelim ? 'vorläufig (laufende Kerze)' : conf === true ? 'bestätigt' : conf === false ? 'nicht bestätigt' : d.fam === 'neutral' || d.fam === 'cont' ? 'abgeschlossen' : 'Bestätigung offen',
          trend: tr.dir === undefined ? null : { dir: tr.dir, r2: tr.r2, b: tr.b, A: tr.A, why: tr.why }, vals: Object.assign({ ATR: a }, shape.vals || {}), price: k[i].h, low: k[i].l });
      }
    }
    return out;
  }
  // Formen (f bekommt die Proportionen p, die Kerzen c, ATR a, Optionen) → null oder { rules, vals }; Pflichtregeln entscheiden
  // über den Treffer (stehen als erfüllt in den Regeln), weitere Regeln nur über die Regelgüte.
  const req = (...rs) => ({ rules: rs.map(([k, w, v]) => R(k, w, true, v)) });
  const add = (s, ...rs) => { if (s) for (const r of rs) s.rules.push(r); return s; };
  const isDoji = p => p.range > 0 && p.body <= 0.1 * p.range;
  const DEF = [
    { id: 'doji_dragonfly', n: 1, dir: 'bull', fam: 'bullRev', f: ([p]) => isDoji(p) && p.up <= 0.1 * p.range && p.lo >= 0.6 * p.range ? req(['Körper ≤ 10 % der Spanne', 2, `${(pct(p.body, p.range) * 100).toFixed(0)} %`], ['langer unterer Docht (≥ 60 %), kein oberer', 2, `${(pct(p.lo, p.range) * 100).toFixed(0)} %`]) : null },
    { id: 'doji_gravestone', n: 1, dir: 'bear', fam: 'bearRev', f: ([p]) => isDoji(p) && p.lo <= 0.1 * p.range && p.up >= 0.6 * p.range ? req(['Körper ≤ 10 % der Spanne', 2, `${(pct(p.body, p.range) * 100).toFixed(0)} %`], ['langer oberer Docht (≥ 60 %), kein unterer', 2, `${(pct(p.up, p.range) * 100).toFixed(0)} %`]) : null },
    { id: 'doji', n: 1, dir: 'neutral', fam: 'neutral', f: ([p], c, a) => isDoji(p) && !(p.up <= 0.1 * p.range && p.lo >= 0.6 * p.range) && !(p.lo <= 0.1 * p.range && p.up >= 0.6 * p.range) ? add(req(['Körper ≤ 10 % der Spanne', 2, `${(pct(p.body, p.range) * 100).toFixed(0)} %`]), R('Spanne mindestens 0,5 ATR (keine Ruhekerze)', 1, p.range >= 0.5 * a, `${(p.range / a).toFixed(2)} ATR`)) : null },
    { id: 'hammer', n: 1, dir: 'bull', fam: 'bullRev', f: ([p]) => !isDoji(p) && p.lo >= 2 * p.body && p.up <= 0.15 * p.range ? req(['unterer Docht ≥ 2× Körper', 2, `${(p.lo / p.body).toFixed(1)}×`], ['oberer Docht klein (≤ 15 %)', 1, `${(pct(p.up, p.range) * 100).toFixed(0)} %`]) : null },
    { id: 'hanging_man', n: 1, dir: 'bear', fam: 'bearRev', f: ([p]) => !isDoji(p) && p.lo >= 2 * p.body && p.up <= 0.15 * p.range ? req(['unterer Docht ≥ 2× Körper', 2, `${(p.lo / p.body).toFixed(1)}×`], ['oberer Docht klein (≤ 15 %)', 1, `${(pct(p.up, p.range) * 100).toFixed(0)} %`]) : null },
    { id: 'inverted_hammer', n: 1, dir: 'bull', fam: 'bullRev', f: ([p]) => !isDoji(p) && p.up >= 2 * p.body && p.lo <= 0.15 * p.range ? req(['oberer Docht ≥ 2× Körper', 2, `${(p.up / p.body).toFixed(1)}×`], ['unterer Docht klein (≤ 15 %)', 1, `${(pct(p.lo, p.range) * 100).toFixed(0)} %`]) : null },
    { id: 'shooting_star', n: 1, dir: 'bear', fam: 'bearRev', f: ([p]) => !isDoji(p) && p.up >= 2 * p.body && p.lo <= 0.15 * p.range ? req(['oberer Docht ≥ 2× Körper', 2, `${(p.up / p.body).toFixed(1)}×`], ['unterer Docht klein (≤ 15 %)', 1, `${(pct(p.lo, p.range) * 100).toFixed(0)} %`]) : null },
    { id: 'spinning_top', n: 1, dir: 'neutral', fam: 'neutral', f: ([p], c, a) => p.body > 0.1 * p.range && p.body <= 0.35 * p.range && p.up >= 0.25 * p.range && p.lo >= 0.25 * p.range ? add(req(['kleiner Körper (10–35 % der Spanne)', 2, `${(pct(p.body, p.range) * 100).toFixed(0)} %`], ['Dochte oben und unten je ≥ 25 %', 2, `${(pct(p.up, p.range) * 100).toFixed(0)} / ${(pct(p.lo, p.range) * 100).toFixed(0)} %`]), R('Spanne mindestens 0,5 ATR', 1, p.range >= 0.5 * a, `${(p.range / a).toFixed(2)} ATR`)) : null },
    { id: 'marubozu_bull', n: 1, dir: 'bull', fam: 'cont', f: ([p], c, a) => p.bull && p.body >= 0.9 * p.range ? add(req(['Körper ≥ 90 % der Spanne, grün', 2, `${(pct(p.body, p.range) * 100).toFixed(0)} %`]), R('Körper mindestens 1 ATR', 1, p.body >= a, `${(p.body / a).toFixed(2)} ATR`)) : null },
    { id: 'marubozu_bear', n: 1, dir: 'bear', fam: 'cont', f: ([p], c, a) => p.bear && p.body >= 0.9 * p.range ? add(req(['Körper ≥ 90 % der Spanne, rot', 2, `${(pct(p.body, p.range) * 100).toFixed(0)} %`]), R('Körper mindestens 1 ATR', 1, p.body >= a, `${(p.body / a).toFixed(2)} ATR`)) : null },
    { id: 'engulfing_bull', n: 2, dir: 'bull', fam: 'bullRev', f: ([p, q], [x, y]) => p.bear && q.bull && y.o <= x.c && y.c >= x.o && q.body > p.body ? req(['rote Kerze, dann grüne', 1, ''], ['grüner Körper umschließt den roten', 2, `${(q.body / p.body).toFixed(1)}× so groß`]) : null },
    { id: 'engulfing_bear', n: 2, dir: 'bear', fam: 'bearRev', f: ([p, q], [x, y]) => p.bull && q.bear && y.o >= x.c && y.c <= x.o && q.body > p.body ? req(['grüne Kerze, dann rote', 1, ''], ['roter Körper umschließt den grünen', 2, `${(q.body / p.body).toFixed(1)}× so groß`]) : null },
    { id: 'harami_bull', n: 2, dir: 'bull', fam: 'bullRev', f: ([p, q], c, a) => p.bear && q.top <= p.top && q.bot >= p.bot && q.body <= 0.5 * p.body && q.body > 0 ? add(req(['große rote Kerze, dann kleiner Körper darin', 2, `${(q.body / p.body * 100).toFixed(0)} % des Körpers`]), R('erste Kerze groß (≥ 0,6 ATR)', 1, p.body >= 0.6 * a, `${(p.body / a).toFixed(2)} ATR`), R('zweite Kerze grün', 1, q.bull, q.bull ? 'ja' : 'nein')) : null },
    { id: 'harami_bear', n: 2, dir: 'bear', fam: 'bearRev', f: ([p, q], c, a) => p.bull && q.top <= p.top && q.bot >= p.bot && q.body <= 0.5 * p.body && q.body > 0 ? add(req(['große grüne Kerze, dann kleiner Körper darin', 2, `${(q.body / p.body * 100).toFixed(0)} % des Körpers`]), R('erste Kerze groß (≥ 0,6 ATR)', 1, p.body >= 0.6 * a, `${(p.body / a).toFixed(2)} ATR`), R('zweite Kerze rot', 1, q.bear, q.bear ? 'ja' : 'nein')) : null },
    { id: 'piercing', n: 2, dir: 'bull', fam: 'bullRev', f: ([p, q], [x, y], a, o) => p.bear && q.bull && (o.gap ? y.o < x.l : y.o <= x.c) && y.c > p.mid && y.c < x.o ? add(req(['rote Kerze, grüne eröffnet tiefer' + (o.gap ? ' (mit Gap unter dem Tief)' : ' (Krypto: ohne Gap)'), 1, ''], ['schließt über der Mitte des roten Körpers', 2, `${((y.c - x.c) / p.body * 100).toFixed(0)} % zurückgewonnen`]), R('erste Kerze groß (≥ 0,5 ATR)', 1, p.body >= 0.5 * a, `${(p.body / a).toFixed(2)} ATR`)) : null },
    { id: 'dark_cloud', n: 2, dir: 'bear', fam: 'bearRev', f: ([p, q], [x, y], a, o) => p.bull && q.bear && (o.gap ? y.o > x.h : y.o >= x.c) && y.c < p.mid && y.c > x.o ? add(req(['grüne Kerze, rote eröffnet höher' + (o.gap ? ' (mit Gap über dem Hoch)' : ' (Krypto: ohne Gap)'), 1, ''], ['schließt unter der Mitte des grünen Körpers', 2, `${((x.c - y.c) / p.body * 100).toFixed(0)} % abgegeben`]), R('erste Kerze groß (≥ 0,5 ATR)', 1, p.body >= 0.5 * a, `${(p.body / a).toFixed(2)} ATR`)) : null },
    { id: 'tweezer_bottom', n: 2, dir: 'bull', fam: 'bullRev', f: ([p, q], [x, y], a) => p.bear && q.bull && Math.abs(x.l - y.l) <= 0.1 * a ? req(['rote, dann grüne Kerze', 1, ''], ['gleiches Tief (± 0,1 ATR)', 2, `Abstand ${(Math.abs(x.l - y.l) / a).toFixed(2)} ATR`]) : null },
    { id: 'tweezer_top', n: 2, dir: 'bear', fam: 'bearRev', f: ([p, q], [x, y], a) => p.bull && q.bear && Math.abs(x.h - y.h) <= 0.1 * a ? req(['grüne, dann rote Kerze', 1, ''], ['gleiches Hoch (± 0,1 ATR)', 2, `Abstand ${(Math.abs(x.h - y.h) / a).toFixed(2)} ATR`]) : null },
    { id: 'morning_star', n: 3, dir: 'bull', fam: 'bullRev', f: ([p, q, r], [x, y, z], a, o) => p.bear && p.body >= 0.6 * a && q.body <= 0.3 * p.body && r.bull && z.c > p.mid && (!o.gap || (q.top < x.c && z.o > q.top)) ? req(['große rote Kerze (≥ 0,6 ATR)', 1, `${(p.body / a).toFixed(2)} ATR`], ['kleiner Körper in der Mitte (≤ 30 %)', 1, `${(q.body / p.body * 100).toFixed(0)} %`], ['grüne Kerze schließt über der Mitte der roten', 2, ''], [o.gap ? 'Gaps vor und nach dem Stern' : 'Krypto-Variante: Gap nicht verlangt', 0, '']) : null },
    { id: 'evening_star', n: 3, dir: 'bear', fam: 'bearRev', f: ([p, q, r], [x, y, z], a, o) => p.bull && p.body >= 0.6 * a && q.body <= 0.3 * p.body && r.bear && z.c < p.mid && (!o.gap || (q.bot > x.c && z.o < q.bot)) ? req(['große grüne Kerze (≥ 0,6 ATR)', 1, `${(p.body / a).toFixed(2)} ATR`], ['kleiner Körper in der Mitte (≤ 30 %)', 1, `${(q.body / p.body * 100).toFixed(0)} %`], ['rote Kerze schließt unter der Mitte der grünen', 2, ''], [o.gap ? 'Gaps vor und nach dem Stern' : 'Krypto-Variante: Gap nicht verlangt', 0, '']) : null },
    { id: 'three_white_soldiers', n: 3, dir: 'bull', fam: 'bullRev', f: (ps, cs, a) => ps.every(p => p.bull) && cs[1].c > cs[0].c && cs[2].c > cs[1].c && cs[1].o >= cs[0].o && cs[1].o <= cs[0].c && cs[2].o >= cs[1].o && cs[2].o <= cs[1].c ? add(req(['drei grüne Kerzen, jeder Schluss höher', 2, ''], ['jede eröffnet im vorigen Körper', 1, '']), R('Körper je ≥ 0,5 ATR', 1, ps.every(p => p.body >= 0.5 * a), ps.map(p => (p.body / a).toFixed(1)).join(' / ') + ' ATR'), R('kleine obere Dochte (≤ 30 % des Körpers)', 1, ps.every(p => p.up <= 0.3 * p.body), '')) : null },
    { id: 'three_black_crows', n: 3, dir: 'bear', fam: 'bearRev', f: (ps, cs, a) => ps.every(p => p.bear) && cs[1].c < cs[0].c && cs[2].c < cs[1].c && cs[1].o <= cs[0].o && cs[1].o >= cs[0].c && cs[2].o <= cs[1].o && cs[2].o >= cs[1].c ? add(req(['drei rote Kerzen, jeder Schluss tiefer', 2, ''], ['jede eröffnet im vorigen Körper', 1, '']), R('Körper je ≥ 0,5 ATR', 1, ps.every(p => p.body >= 0.5 * a), ps.map(p => (p.body / a).toFixed(1)).join(' / ') + ' ATR'), R('kleine untere Dochte (≤ 30 % des Körpers)', 1, ps.every(p => p.lo <= 0.3 * p.body), '')) : null },
  ];

  // ---------- Formationen ----------
  // ATR-ZigZag: Pivot erst bestätigt, wenn der Kurs um ZZ_MULT·ATR zurückgelaufen ist; der wandernde Endpunkt zählt nie.
  function zigzag(k, A, s, end) {
    const piv = []; let dir = 0, hi = s, lo = s;
    for (let i = s + 1; i <= end; i++) {
      const thr = ZZ_MULT * A[i]; if (!(thr > 0)) continue;
      if (dir !== -1 && k[i].h >= k[hi].h) hi = i;
      if (dir !== 1 && k[i].l <= k[lo].l) lo = i;
      if (dir !== -1 && hi < i && k[hi].h - k[i].l >= thr) { piv.push({ i: hi, p: k[hi].h, t: 'H', conf: i }); dir = -1; lo = i; }
      else if (dir !== 1 && lo < i && k[i].h - k[lo].l >= thr) { piv.push({ i: lo, p: k[lo].l, t: 'L', conf: i }); dir = 1; hi = i; }
    }
    return piv;
  }
  const tolAt = (p, a) => Math.min(0.02 * p, 0.6 * a);
  const fitLine = pts => { const n = pts.length, mx = pts.reduce((s, q) => s + q.i, 0) / n, my = pts.reduce((s, q) => s + q.p, 0) / n; let sxy = 0, sxx = 0; for (const q of pts) { sxy += (q.i - mx) * (q.p - my); sxx += (q.i - mx) ** 2; } const m = sxx ? sxy / sxx : 0; return { m, y: i => my + m * (i - mx) }; };
  // erster Schlusskurs nach Index from (nur abgeschlossene Kerzen) jenseits einer Linie; dir +1 = darüber, −1 = darunter
  const breakAfter = (k, from, end, line, dir) => { for (let i = from + 1; i <= end; i++) { const v = typeof line === 'function' ? line(i) : line; if (dir > 0 ? k[i].c > v : k[i].c < v) return i; } return -1; };
  function formations(k, A, opt) {
    const end = opt.running ? k.length - 2 : k.length - 1, out = [], s = Math.max(14, opt.from - 40);
    if (end - s < 20) return out;
    const piv = zigzag(k, A, s, end), seen = new Set(), covered = [];
    const push = h => { const key = h.id + '|' + h.i0; if (seen.has(key) || h.i1 < opt.from) return; seen.add(key); h.q = quality(h.rules); out.push(h); };
    const volOk = (i1, i2) => { const v1 = k[i1].v, v2 = k[i2].v; return v1 > 0 && v2 > 0 ? v2 < v1 : null; };
    const vol = (i1, i2) => (k[i1].v > 0 && k[i2].v > 0 ? `${(k[i2].v / k[i1].v).toFixed(2)}×` : 'kein Volumen');
    // Doppel-/Dreifach-Top und -Boden, Kopf-Schulter (auch invers) – Pivots von hinten
    for (let j = piv.length - 1; j >= 2 && j >= piv.length - 8; j--) {
      const top = piv[j].t === 'H', sg = top ? 1 : -1, a = A[piv[j].i], tol = tolAt(piv[j].p, a);
      const [P1, M, P2] = [piv[j - 2], piv[j - 1], piv[j]];
      const mk = (id, dir, i0, rules, neck, height, inv, lines, vals, lastI) => {
        const brk = breakAfter(k, lastI, end, neck, -sg), invI = breakAfter(k, lastI, end, inv, sg);
        const broken = brk >= 0 && (invI < 0 || brk < invI); if (invI >= 0 && !broken) return;   // invalidiert → nicht zeigen
        rules.push(R(`Ausbruch per Schlusskurs ${top ? 'unter' : 'über'} der Nackenlinie`, 2, broken, broken ? `am ${brk}. Index` : 'noch nicht'));
        const nv = typeof neck === 'function' ? neck(broken ? brk : end) : neck;
        covered.push([i0, lastI]);
        push({ id, kind: 'form', dir, i0, i1: broken ? brk : lastI, t0: k[i0].t, t1: k[broken ? brk : lastI].t, rules, status: broken ? 'Ausbruch bestätigt' : 'in Bildung (Ausbruch fehlt)',
          levels: { brk: nv, tgt: nv - sg * height, inv }, lines, vals: Object.assign({ ATR: a, Toleranz: tol }, vals), prelim: false });
      };
      // Dreifach
      if (j >= 4) {
        const [Q1, N1, Q2, N2, Q3] = piv.slice(j - 4, j + 1), hs = [Q1.p, Q2.p, Q3.p], mean = (hs[0] + hs[1] + hs[2]) / 3;
        if (hs.every(h => Math.abs(h - mean) <= tol)) {
          const neck = top ? Math.min(N1.p, N2.p) : Math.max(N1.p, N2.p), height = Math.abs(mean - neck);
          if (height >= 1.5 * a) { mk(top ? 'triple_top' : 'triple_bottom', top ? 'bear' : 'bull', Q1.i, [R(`drei ${top ? 'Hochs' : 'Tiefs'} gleich hoch (Toleranz min(2 %, 0,6 ATR))`, 2, true, `Spanne ${(Math.max(...hs) - Math.min(...hs)).toFixed(6)}`), R('Höhe mindestens 1,5 ATR', 1, true, `${(height / a).toFixed(2)} ATR`), R(`Volumen am dritten ${top ? 'Hoch' : 'Tief'} niedriger`, 1, volOk(Q1.i, Q3.i), vol(Q1.i, Q3.i))], neck, height, top ? Math.max(...hs) : Math.min(...hs), [[Q1.i, mean, Q3.i, mean, 'res'], [Q1.i, neck, end, neck, 'neck']], { [top ? 'Hochs' : 'Tiefs']: hs, Nackenlinie: neck }, Q3.i); continue; }
        }
        // Kopf-Schulter
        const head = top ? Q2.p - Math.max(Q1.p, Q3.p) : Math.min(Q1.p, Q3.p) - Q2.p;
        if (head > tol && Math.abs(Q1.p - Q3.p) <= 2 * tol) {
          const nl = (i => N1.p + (N2.p - N1.p) * (i - N1.i) / (N2.i - N1.i)), height = Math.abs(Q2.p - nl(Q2.i));
          if (height >= 1.5 * a) { mk(top ? 'head_shoulders' : 'inv_head_shoulders', top ? 'bear' : 'bull', Q1.i, [R('Kopf deutlich über beiden Schultern', 2, true, `${(head / a).toFixed(2)} ATR`), R('Schultern etwa gleich hoch (≤ 2× Toleranz)', 2, true, `Abstand ${(Math.abs(Q1.p - Q3.p) / a).toFixed(2)} ATR`), R('Höhe mindestens 1,5 ATR', 1, true, `${(height / a).toFixed(2)} ATR`), R('Volumen an der rechten Schulter niedriger', 1, volOk(Q1.i, Q3.i), vol(Q1.i, Q3.i))], nl, height, Q3.p, [[Q1.i, Q1.p, Q2.i, Q2.p, 'shape'], [Q2.i, Q2.p, Q3.i, Q3.p, 'shape'], [N1.i, N1.p, end, nl(end), 'neck']], { 'Schulter links': Q1.p, Kopf: Q2.p, 'Schulter rechts': Q3.p }, Q3.i); continue; }
        }
      }
      // Doppel
      if (Math.abs(P1.p - P2.p) <= tol) {
        const mean = (P1.p + P2.p) / 2, height = Math.abs(mean - M.p);
        if (height >= 1.5 * a && !covered.some(([c0, c1]) => P1.i >= c0 && P2.i <= c1)) {
          const L0 = piv[j - 3], prior = L0 ? (top ? P1.p - L0.p : L0.p - P1.p) : null;
          mk(top ? 'double_top' : 'double_bottom', top ? 'bear' : 'bull', P1.i, [R(`zwei ${top ? 'Hochs' : 'Tiefs'} gleich hoch (Toleranz min(2 %, 0,6 ATR))`, 2, true, `Abstand ${(Math.abs(P1.p - P2.p) / a).toFixed(2)} ATR`), R('Tal dazwischen mindestens 1,5 ATR', 1, true, `${(height / a).toFixed(2)} ATR`), R('Abstand mindestens 5 Kerzen', 1, P2.i - P1.i >= 5, `${P2.i - P1.i} Kerzen`), R(`Vortrend ${top ? 'aufwärts' : 'abwärts'} in das erste ${top ? 'Hoch' : 'Tief'}`, 1, prior === null ? null : prior >= height, prior === null ? 'unbekannt' : `${(prior / a).toFixed(2)} ATR`), R(`Volumen am zweiten ${top ? 'Hoch' : 'Tief'} niedriger`, 1, volOk(P1.i, P2.i), vol(P1.i, P2.i))],
            M.p, height, top ? Math.max(P1.p, P2.p) : Math.min(P1.p, P2.p), [[P1.i, mean, P2.i, mean, 'res'], [P1.i, M.p, end, M.p, 'neck']], { [top ? 'Hochs' : 'Tiefs']: [P1.p, P2.p], Nackenlinie: M.p }, P2.i);
        }
      }
    }
    // Linienformationen: Dreiecke, Keile, Kanäle, Rechteck – letzte 4–6 bestätigte Pivots
    for (let j = piv.length - 1; j >= 3 && j >= piv.length - 3; j--) {
      for (const m of [6, 5, 4]) {
        if (j - m + 1 < 0) continue;
        const ps = piv.slice(j - m + 1, j + 1), hs = ps.filter(q => q.t === 'H'), ls = ps.filter(q => q.t === 'L');
        if (hs.length < 2 || ls.length < 2) continue;
        const i0 = ps[0].i, i1 = ps.at(-1).i, span = i1 - i0, a = A[i1], tol = tolAt(ps.at(-1).p, a), U = fitLine(hs), L = fitLine(ls);
        if (span < 8 || !ps.every(q => Math.abs((q.t === 'H' ? U : L).y(q.i) - q.p) <= tol)) continue;
        const w0 = U.y(i0) - L.y(i0), w1 = U.y(i1) - L.y(i1); if (!(w0 > 0 && w1 > 0)) continue;
        const flat = ln => Math.abs(ln.m * span) <= tol, rise = ln => ln.m * span > tol, fall = ln => ln.m * span < -tol;
        const conv = w1 < 0.7 * w0, par = Math.abs(w1 - w0) <= 0.25 * w0;
        let id = null, sh = '';
        if (conv && flat(U) && rise(L)) { id = 'asc_triangle'; sh = 'obere Linie flach, untere steigt'; }
        else if (conv && flat(L) && fall(U)) { id = 'desc_triangle'; sh = 'untere Linie flach, obere fällt'; }
        else if (conv && fall(U) && rise(L)) { id = 'sym_triangle'; sh = 'obere fällt, untere steigt'; }
        else if (conv && rise(U) && rise(L)) { id = 'rising_wedge'; sh = 'beide steigen und laufen zusammen'; }
        else if (conv && fall(U) && fall(L)) { id = 'falling_wedge'; sh = 'beide fallen und laufen zusammen'; }
        else if (par && rise(U) && rise(L)) { id = 'asc_channel'; sh = 'beide steigen parallel'; }
        else if (par && fall(U) && fall(L)) { id = 'desc_channel'; sh = 'beide fallen parallel'; }
        else if (par && flat(U) && flat(L)) { id = 'rectangle'; sh = 'beide waagerecht'; }
        if (!id) continue;
        const exp = { asc_triangle: 1, desc_triangle: -1, sym_triangle: 0, rising_wedge: -1, falling_wedge: 1, asc_channel: 1, desc_channel: -1, rectangle: 0 }[id];
        const up = breakAfter(k, i1, end, U.y, 1), dn = breakAfter(k, i1, end, L.y, -1);
        const first = up >= 0 && (dn < 0 || up < dn) ? 1 : dn >= 0 ? -1 : 0, bi = first > 0 ? up : first < 0 ? dn : -1;
        if (first && exp && first !== exp) break;   // Ausbruch gegen die erwartete Richtung → invalidiert
        const channel = id === 'asc_channel' || id === 'desc_channel', dirOut = exp || first;
        const rules = [R('mindestens 2 bestätigte Hochs und 2 Tiefs auf den Linien (Toleranz)', 2, true, `${hs.length} Hochs, ${ls.length} Tiefs`), R(`Form: ${sh}`, 2, true, `Breite ${(w0 / a).toFixed(1)} → ${(w1 / a).toFixed(1)} ATR`), R('mindestens 5 Pivots', 1, ps.length >= 5, `${ps.length}`), R('Volumen nimmt ab', 1, volOk(i0, i1), vol(i0, i1))];
        if (!channel) rules.push(R(exp ? `Ausbruch per Schlusskurs ${exp > 0 ? 'nach oben' : 'nach unten'}` : 'Ausbruch per Schlusskurs (eine Richtung)', 2, first !== 0, first ? (first > 0 ? 'nach oben' : 'nach unten') : 'noch nicht'));
        const at = bi >= 0 ? bi : end, brk = dirOut >= 0 ? U.y(at) : L.y(at);
        push({ id, kind: 'form', dir: dirOut > 0 ? 'bull' : dirOut < 0 ? 'bear' : 'neutral', i0, i1: bi >= 0 ? bi : i1, t0: k[i0].t, t1: k[bi >= 0 ? bi : i1].t, rules,
          status: channel ? (first ? (first > 0 ? 'über dem Kanal' : 'unter dem Kanal') : 'im Kanal') : first ? `Ausbruch ${first > 0 ? 'nach oben' : 'nach unten'} bestätigt` : 'in Bildung (Ausbruch fehlt)',
          levels: dirOut === 0 && !first ? { brk: U.y(at), brk2: L.y(at), tgt: null, inv: null } : { brk, tgt: brk + (dirOut >= 0 ? 1 : -1) * w0, inv: dirOut >= 0 ? L.y(at) : U.y(at) },
          lines: [[i0, U.y(i0), end, U.y(end), 'res'], [i0, L.y(i0), end, L.y(end), 'sup']], vals: { ATR: a, Toleranz: tol, 'Breite Anfang': w0, 'Breite Ende': w1, Pivots: ps.length }, prelim: false });
        break;
      }
    }
    // Flagge/Wimpel: Mast (≥ 3 ATR in ≤ 15 Kerzen), danach 4–25 Kerzen Konsolidierung mit höchstens 50 % Rücklauf
    for (const sg of [1, -1]) {
      const lo = Math.max(opt.from, end - 40); let x = -1;
      for (let i = lo; i <= end; i++) if (x < 0 || (sg > 0 ? k[i].h > k[x].h : k[i].l < k[x].l)) x = i;
      if (x < 0 || end - x < 4 || end - x > 25) continue;
      let s0 = -1; for (let i = Math.max(0, x - 15); i < x; i++) if (s0 < 0 || (sg > 0 ? k[i].l < k[s0].l : k[i].h > k[s0].h)) s0 = i;
      const a = A[x], mast = sg > 0 ? k[x].h - k[s0].l : k[s0].h - k[x].l; if (!(a > 0) || mast < 3 * a) continue;
      const cs = []; for (let i = x + 1; i <= end; i++) cs.push(i);
      const ext = sg > 0 ? Math.min(...cs.map(i => k[i].l)) : Math.max(...cs.map(i => k[i].h)), retr = sg > 0 ? (k[x].h - ext) / mast : (ext - k[x].l) / mast;
      if (retr > 0.5) continue;
      const U = fitLine([{ i: x, p: k[x].h }, ...cs.map(i => ({ i, p: k[i].h }))]), L = fitLine(cs.map(i => ({ i, p: k[i].l }))), span = end - x;
      const w0 = U.y(x + 1) - L.y(x + 1), w1 = U.y(end) - L.y(end); if (!(w0 > 0)) continue;
      const pen = w1 < 0.6 * w0 && U.m < 0 && L.m > 0, flagOk = Math.abs(w1 - w0) <= 0.35 * w0 && sg * U.m * span <= 0.25 * mast;
      if (!pen && !flagOk) continue;
      const id = (pen ? 'pennant' : 'flag') + (sg > 0 ? '_bull' : '_bear'), line = sg > 0 ? U.y : L.y;
      const bi = breakAfter(k, x + 3, end, line, sg), broke = bi >= 0;
      const rules = [R(`Mast ≥ 3 ATR in höchstens 15 Kerzen`, 2, true, `${(mast / a).toFixed(1)} ATR in ${x - s0} Kerzen`), R(`Konsolidierung 4–25 Kerzen, Rücklauf ≤ 50 %`, 2, true, `${span} Kerzen, ${(retr * 100).toFixed(0)} %`), R(pen ? 'Linien laufen zusammen (Wimpel)' : 'Kanal parallel oder gegen den Mast (Flagge)', 1, true, `Breite ${(w0 / a).toFixed(1)} → ${(w1 / a).toFixed(1)} ATR`), R('Rücklauf höchstens 38 %', 1, retr <= 0.382, `${(retr * 100).toFixed(0)} %`), R(`Ausbruch per Schlusskurs ${sg > 0 ? 'nach oben' : 'nach unten'}`, 2, broke, broke ? 'ja' : 'noch nicht')];
      const at = broke ? bi : end, b = line(at);
      push({ id, kind: 'form', dir: sg > 0 ? 'bull' : 'bear', i0: s0, i1: at, t0: k[s0].t, t1: k[at].t, rules, status: broke ? 'Ausbruch bestätigt' : 'in Bildung (Ausbruch fehlt)',
        levels: { brk: b, tgt: b + sg * mast, inv: sg > 0 ? Math.min(...cs.map(i => k[i].l)) : Math.max(...cs.map(i => k[i].h)) },
        lines: [[s0, sg > 0 ? k[s0].l : k[s0].h, x, sg > 0 ? k[x].h : k[x].l, 'shape'], [x, U.y(x), end, U.y(end), 'res'], [x + 1, L.y(x + 1), end, L.y(end), 'sup']], vals: { ATR: a, Mast: mast, Rücklauf: retr }, prelim: false });
    }
    // Cup & Handle: zwei Ränder (bestätigte Hochs) fast gleich hoch, dazwischen gerundeter Boden, danach kleiner Henkel
    const Hs = piv.filter(q => q.t === 'H');
    for (let b = Hs.length - 1; b >= 1; b--) {
      let done = false;
      for (let a0 = b - 1; a0 >= 0; a0--) {
        const A1 = Hs[a0], B1 = Hs[b], len = B1.i - A1.i, a = A[B1.i], rim = Math.min(A1.p, B1.p);
        if (len < 20 || len > 200) continue;
        if (Hs.slice(a0 + 1, b).some(q => q.p > rim)) continue;
        if (Math.abs(A1.p - B1.p) > Math.max(2 * tolAt(B1.p, a), 0.03 * B1.p)) continue;
        let bi = A1.i; for (let i = A1.i; i <= B1.i; i++) if (k[i].l < k[bi].l) bi = i;
        const depth = rim - k[bi].l; if (depth < 3 * a) continue;
        // Rundung: Parabel durch die Schlusskurse, nach oben offen und R² ≥ 0,5; Boden im mittleren Teil
        let n = 0, S = [0, 0, 0, 0, 0], T = [0, 0, 0], sy = 0, syy = 0;
        for (let i = A1.i; i <= B1.i; i++) { const xx = (i - A1.i) / len * 2 - 1, y = k[i].c; n++; S[0] += 1; S[1] += xx; S[2] += xx * xx; S[3] += xx ** 3; S[4] += xx ** 4; T[0] += y; T[1] += xx * y; T[2] += xx * xx * y; sy += y; syy += y * y; }
        const M = [[S[0], S[1], S[2]], [S[1], S[2], S[3]], [S[2], S[3], S[4]]], det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
        const D = det(M); if (!D) continue;
        const col = (c) => M.map((r, ri) => r.map((v, ci) => (ci === c ? T[ri] : v))), c0 = det(col(0)) / D, c1 = det(col(1)) / D, c2 = det(col(2)) / D;
        let sse = 0; for (let i = A1.i; i <= B1.i; i++) { const xx = (i - A1.i) / len * 2 - 1; sse += (k[i].c - (c0 + c1 * xx + c2 * xx * xx)) ** 2; }
        const sst = syy - sy * sy / n, r2 = sst > 0 ? 1 - sse / sst : 0, mid = (bi - A1.i) / len;
        if (!(c2 > 0) || r2 < 0.5 || mid < 0.2 || mid > 0.8) continue;
        const hs = []; for (let i = B1.i + 1; i <= end; i++) hs.push(i);
        if (hs.length < 3 || hs.length > 40) continue;
        const hl = Math.min(...hs.map(i => k[i].l)), pull = (B1.p - hl) / depth; if (pull > 0.5 || pull <= 0) continue;
        const lvl = Math.max(A1.p, B1.p), bk = breakAfter(k, B1.i + 2, end, lvl, 1), broke = bk >= 0;
        push({ id: 'cup_handle', kind: 'form', dir: 'bull', i0: A1.i, i1: broke ? bk : end, t0: k[A1.i].t, t1: k[broke ? bk : end].t,
          rules: [R('zwei Ränder fast gleich hoch', 2, true, `${(Math.abs(A1.p - B1.p) / a).toFixed(2)} ATR Abstand`), R('gerundeter Boden (Parabel, R² ≥ 0,5)', 2, true, `R² ${r2.toFixed(2)}`), R('Tiefe mindestens 3 ATR', 1, true, `${(depth / a).toFixed(1)} ATR`), R('Henkel-Rücklauf höchstens ⅓ der Tiefe', 1, pull <= 1 / 3, `${(pull * 100).toFixed(0)} %`), R('Ausbruch per Schlusskurs über den Rand', 2, broke, broke ? 'ja' : 'noch nicht')],
          status: broke ? 'Ausbruch bestätigt' : 'in Bildung (Ausbruch fehlt)', levels: { brk: lvl, tgt: lvl + depth, inv: hl },
          lines: [[A1.i, lvl, end, lvl, 'res'], [B1.i, B1.p, end, hl, 'shape']], vals: { ATR: a, 'Rand links': A1.p, 'Rand rechts': B1.p, Boden: k[bi].l, Tiefe: depth, Rundung: r2 }, prelim: false, cup: [A1.i, bi, B1.i] });
        done = true; break;
      }
      if (done) break;
    }
    return out;
  }
  function detect(k, opt) {
    const A = atrSeries(k), o = { from: Math.max(0, opt.from | 0), step: opt.step || 0, gap: !!opt.gap, running: !!opt.running };
    const hits = [...(opt.formOnly ? [] : candles(k, A, o)), ...formations(k, A, o)];
    return { ver: VER, hits: hits.filter(h => h.i1 >= o.from) };
  }
  return { detect, preTrend, atrSeries, zigzag, VER };
}

export const PAT_NAMES = {
  "double_top": "Doppel-Top",
  "double_bottom": "Doppel-Boden",
  "triple_top": "Dreifach-Top",
  "triple_bottom": "Dreifach-Boden",
  "head_shoulders": "Schulter-Kopf-Schulter",
  "inv_head_shoulders": "Inverse Schulter-Kopf-Schulter",
  "asc_triangle": "Aufsteigendes Dreieck",
  "desc_triangle": "Absteigendes Dreieck",
  "sym_triangle": "Symmetrisches Dreieck",
  "rising_wedge": "Steigender Keil",
  "falling_wedge": "Fallender Keil",
  "flag_bull": "Bullische Flagge",
  "flag_bear": "Bärische Flagge",
  "pennant_bull": "Bullischer Wimpel",
  "pennant_bear": "Bärischer Wimpel",
  "rectangle": "Rechteck (Range)",
  "asc_channel": "Aufwärtskanal",
  "desc_channel": "Abwärtskanal",
  "cup_handle": "Tasse mit Henkel (Cup & Handle)"
};

export const PAT_ALL_NAMES = {
  "doji": "Doji",
  "doji_dragonfly": "Libellen-Doji (Dragonfly)",
  "doji_gravestone": "Grabstein-Doji (Gravestone)",
  "hammer": "Hammer",
  "hanging_man": "Hängender Mann (Hanging Man)",
  "inverted_hammer": "Umgekehrter Hammer",
  "shooting_star": "Sternschnuppe (Shooting Star)",
  "spinning_top": "Kreisel (Spinning Top)",
  "marubozu_bull": "Marubozu grün",
  "marubozu_bear": "Marubozu rot",
  "engulfing_bull": "Bullisches Engulfing",
  "engulfing_bear": "Bärisches Engulfing",
  "harami_bull": "Bullisches Harami",
  "harami_bear": "Bärisches Harami",
  "piercing": "Durchdringungslinie (Piercing Line)",
  "dark_cloud": "Dunkle Wolke (Dark Cloud Cover)",
  "tweezer_top": "Pinzetten-Top",
  "tweezer_bottom": "Pinzetten-Boden",
  "morning_star": "Morgenstern",
  "evening_star": "Abendstern",
  "three_white_soldiers": "Drei weiße Soldaten",
  "three_black_crows": "Drei schwarze Krähen",
  "double_top": "Doppel-Top",
  "double_bottom": "Doppel-Boden",
  "triple_top": "Dreifach-Top",
  "triple_bottom": "Dreifach-Boden",
  "head_shoulders": "Schulter-Kopf-Schulter",
  "inv_head_shoulders": "Inverse Schulter-Kopf-Schulter",
  "asc_triangle": "Aufsteigendes Dreieck",
  "desc_triangle": "Absteigendes Dreieck",
  "sym_triangle": "Symmetrisches Dreieck",
  "rising_wedge": "Steigender Keil",
  "falling_wedge": "Fallender Keil",
  "flag_bull": "Bullische Flagge",
  "flag_bear": "Bärische Flagge",
  "pennant_bull": "Bullischer Wimpel",
  "pennant_bear": "Bärischer Wimpel",
  "rectangle": "Rechteck (Range)",
  "asc_channel": "Aufwärtskanal",
  "desc_channel": "Abwärtskanal",
  "cup_handle": "Tasse mit Henkel (Cup & Handle)"
};
