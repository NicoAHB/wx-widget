// 3.69.0 / Dienst 2.13.0: Qualitätsfilter für Chartmuster-Meldungen – K.O.-Kriterien, Signalscore, Anti-Spam, Tracking, Backtest.
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };
// Deterministische Kerzen: Trend je Kerze (Anteil), leichtes Rauschen, Volumen ~1000
function series(n, { start = 100, drift = .0008, t0 = Date.UTC(2026, 0, 1), step = 36e5, noise = .15, vol = 1000 } = {}) {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const k = []; let p = start;
  for (let i = 0; i < n; i++) { const o = p; p = p * (1 + drift) + (rnd() - .5) * noise; const c = p; k.push({ t: t0 + i * step, o, c, h: Math.max(o, c) + .12, l: Math.min(o, c) - .12, v: vol * (.8 + rnd() * .4) }); }
  return k;
}
(async () => {
  const Q = await import('../shared/pattern-quality.mjs');
  const k = series(300), i1 = k.length - 1; k[i1].v = 2600;   // Ausbruchskerze mit 2,6-fachem Volumen
  const up4h = series(260, { step: 144e5, drift: .002 }), down4h = series(260, { step: 144e5, drift: -.002, start: 200 }), btcUp = series(260, { step: 144e5, drift: .0015, start: 60000, noise: 50 });
  const entry = k[i1].c, atr = Q.atrSeries(k, 14)[i1];
  const sig = (over = {}, lv = {}) => ({ c: { id: 'ETH|1h|asc_triangle|1', sym: 'ETHUSDT', mkt: 'futures', iv: '1h', pat: 'asc_triangle', dir: 'bull', p0: entry, q: 94, tc: k[i1].t, ...over },
    h: { status: 'Ausbruch bestätigt', i1, levels: { brk: entry - .2, tgt: entry + 8 * atr, inv: entry - 2.5 * atr, ...lv } } });
  const liq = { volume24h: 80e6, spreadPct: .02 };
  check('Presets Streng/Normal/Locker; Normal = Vorgabe (Score 70, R/R 2, 3 Kerzen, 50 %, 2,5 × ATR, 3 × Kosten, Gegentrend aus)', (() => { const n = Q.patternFilterSettings({}); return n.preset === 'normal' && n.minScore === 70 && n.minRR === 2 && n.maxAge === 3 && n.maxProgress === 50 && n.minTargetAtr === 2.5 && n.minFeeMultiple === 3 && n.counterTrend === false && Q.patternFilterSettings({ preset: 'streng' }).minScore > 70 && Q.patternFilterSettings({ preset: 'locker' }).minScore < 70; })());
  check('Eigene Werte: abweichendes Feld → Preset „eigen“, Werte begrenzt', (() => { const s = Q.patternFilterFromForm({ ...Q.PATTERN_FILTER_PRESETS.normal, minScore: 65, maxPerHour: 999 }, 'normal'); return s.preset === 'eigen' && s.minScore === 65 && s.maxPerHour === 60; })());
  check('Nächsthöherer Zeitrahmen 5m→1h, 15m→1h, 1h→4h', Q.HIGHER_TIMEFRAME['5m'] === '1h' && Q.HIGHER_TIMEFRAME['15m'] === '1h' && Q.HIGHER_TIMEFRAME['1h'] === '4h');
  check('Trend über Kurs zur EMA 200 und Steigung der EMA 50', Q.trendOf(up4h).dir === 1 && Q.trendOf(down4h).dir === -1 && Q.trendOf(up4h.slice(0, 100)) === null);
  // Gutes Signal
  let s = sig(), ev = Q.evaluatePatternSignal({ ...s, k, higher: up4h, btc: btcUp, liquidity: liq, hits: { n: 12, wins: 7 } });
  check('Starkes Signal (R/R 3,2, Trend und BTC passend, Volumen 2,6 ×) besteht alle K.O.-Kriterien und Score ≥ 70', ev.pass && ev.ko.length === 0 && ev.score >= 70, `Score ${ev.score}, ${ev.summary}, ${JSON.stringify(ev.parts)}`);
  check('Score-Teile: R/R 3:1 = 20, 2:1 = 10; Trend bis 20; Volumen bis 20; Marktphase bis 15; Regelgüte bis 10; Trefferquote bis 15', (() => {
    const p = ev.parts, e2 = Q.evaluatePatternSignal({ ...sig({}, { tgt: entry + 2 * 2.5 * atr }), k, higher: up4h, btc: btcUp, liquidity: liq });
    return p.rr === 20 && Math.abs(e2.parts.rr - 10) < 1e-9 && p.trend === 20 && p.volume === 20 && p.phase <= 15 && p.quality <= 10 && p.history <= 15; })(), JSON.stringify(ev.parts));
  check('Kurzbegründung für Telegram: „Trend ✔ · Volumen ✔ · R/R 3,2“', ev.summary === `Trend ✔ · Volumen ✔ · R/R ${(ev.rr).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` && /^Trend ✔ · Volumen ✔ · R\/R \d,\d$/.test(ev.summary), ev.summary);
  check('Regelgüte gestreckt (trennt sonst kaum: 88–100 %): 85 % → 0, 94 % → 6, 100 % → 10', [85, 94, 100].map(q => Q.evaluatePatternSignal({ ...sig({ q }), k, higher: up4h, btc: btcUp, liquidity: liq }).parts.quality).join() === '0,6,10');
  check('Trefferquote erst ab 10 abgeschlossenen Fällen, vorher neutral 7 Punkte', Q.evaluatePatternSignal({ ...s, k, higher: up4h, btc: btcUp, liquidity: liq, hits: { n: 9, wins: 9 } }).parts.history === 7 && Q.evaluatePatternSignal({ ...s, k, higher: up4h, btc: btcUp, liquidity: liq, hits: { n: 10, wins: 6 } }).parts.history === 15 && Q.evaluatePatternSignal({ ...s, k, higher: up4h, btc: btcUp, liquidity: liq, hits: { n: 10, wins: 3 } }).parts.history === 0);
  // ---- Beispiel 1: Chance/Risiko 0,34 : 1 ----
  const e1 = Q.evaluatePatternSignal({ ...sig({}, { tgt: entry + .34 * 2.5 * atr }), k, higher: up4h, btc: btcUp, liquidity: liq });
  check('BEISPIEL 1: Signal mit Chance/Risiko 0,34 : 1 wird gefiltert (K.O.)', !e1.pass && e1.ko[0].key === 'rr' && /0,34 : 1 unter 2,0 : 1/.test(e1.reason), `Grund: ${e1.reason}`);
  // ---- Beispiel 3: Gegentrend ----
  const e3 = Q.evaluatePatternSignal({ ...s, k, higher: down4h, btc: btcUp, liquidity: liq });
  check('BEISPIEL 3: Gegentrend-Signal (Long, 4h-Trend abwärts) wird gefiltert', !e3.pass && e3.ko.some(x => x.key === 'trend') && e3.counter, `Grund: ${e3.ko.find(x => x.key === 'trend')?.text}`);
  const e3b = Q.evaluatePatternSignal({ ...s, k, higher: down4h, btc: btcUp, liquidity: liq, settings: { counterTrend: true } });
  check('Gegentrend-Schalter an: kein K.O. mehr, aber weniger Trendpunkte', !e3b.ko.some(x => x.key === 'trend') && e3b.parts.trend < ev.parts.trend && /Trend ✖/.test(e3b.summary), e3b.summary);
  // weitere K.O.-Kriterien
  const kOld = [...k, ...series(4, { t0: k[i1].t + 36e5, start: entry * 1.002 })];
  check('Signal älter als 3 Kerzen → gefiltert', Q.evaluatePatternSignal({ ...s, k: kOld, higher: up4h, btc: btcUp, liquidity: liq }).ko.some(x => x.key === 'age'));
  check('Kurs schon über 50 % des Wegs zum Ziel → gefiltert', Q.evaluatePatternSignal({ ...s, k, price: entry + 5 * atr, higher: up4h, btc: btcUp, liquidity: liq }).ko.some(x => x.key === 'progress'));
  check('Ausbruch ohne Schlusskurs außerhalb der Musterlinie → gefiltert', Q.evaluatePatternSignal({ ...sig({}, { brk: entry + .1 }), k, higher: up4h, btc: btcUp, liquidity: liq }).ko.some(x => x.key === 'breakout') && Q.evaluatePatternSignal({ c: s.c, h: { ...s.h, status: 'in Bildung (Ausbruch fehlt)' }, k, higher: up4h, btc: btcUp, liquidity: liq }).ko.some(x => x.key === 'breakout'));
  check('Zielabstand unter 2,5 × ATR → gefiltert (auch bei gutem R/R)', Q.evaluatePatternSignal({ ...sig({}, { tgt: entry + 2 * atr, inv: entry - .5 * atr }), k, higher: up4h, btc: btcUp, liquidity: liq }).ko.map(x => x.key).join() === 'atr');
  check('Ziel unter 3 × (Gebühren + Spread) → gefiltert', Q.evaluatePatternSignal({ ...s, k, higher: up4h, btc: btcUp, liquidity: { volume24h: 80e6, spreadPct: .9 }, settings: { preset: 'eigen', maxSpread: 5 } }).ko.some(x => x.key === 'fees'));
  check('Liquidität: zu wenig 24h-Volumen bzw. zu großer Spread → gefiltert', Q.evaluatePatternSignal({ ...s, k, higher: up4h, btc: btcUp, liquidity: { volume24h: 1e6, spreadPct: .02 } }).ko.some(x => x.key === 'volume24h') && Q.evaluatePatternSignal({ ...s, k, higher: up4h, btc: btcUp, liquidity: { volume24h: 80e6, spreadPct: .3 } }).ko.some(x => x.key === 'spread'));
  check('Signalscore unter Mindestscore → gefiltert mit Grund', (() => { const e = Q.evaluatePatternSignal({ ...s, k, higher: up4h, btc: btcUp, liquidity: liq, settings: { preset: 'eigen', minScore: 99 } }); return !e.pass && !e.ko.length && /Signalscore \d+ unter 99/.test(e.reason); })());
  check('Ohne Volumenangabe in den Kerzen kein Liquiditäts-K.O. (nicht bewertet)', !Q.evaluatePatternSignal({ ...s, k: k.map(x => ({ ...x, v: undefined })), higher: up4h, btc: btcUp, liquidity: { spreadPct: .02 } }).ko.some(x => x.key === 'volume24h'));
  check('24h-Volumen aus Kerzen: 1h → letzte 24 Kerzen × Kurs', Math.abs(Q.volume24hFromCandles(k, '1h') - k.slice(-24).reduce((t, x) => t + x.v * x.c, 0)) < 1e-6);
  // ---- Anti-Spam ----
  const now = k[i1].t + 36e5, cand = (id, over, e) => ({ id, sym: 'ETHUSDT', iv: '1h', dir: 'bull', tc: k[i1].t, ...over, eval: e });
  const eA = Q.evaluatePatternSignal({ ...s, k, higher: up4h, btc: btcUp, liquidity: liq, hits: { n: 12, wins: 8 } }), eB = Q.evaluatePatternSignal({ ...sig({ pat: 'rectangle', id: 'ETH|1h|rectangle|1', q: 94 }), k, higher: up4h, btc: btcUp, liquidity: liq, hits: { n: 12, wins: 7 } });
  let d = Q.selectPatternSignals([cand('B', {}, eB), cand('A', {}, eA)], [], {}, now);
  check('BEISPIEL 2: zwei gleichzeitige Muster gleicher Richtung auf demselben Coin → nur das mit dem höchsten Score wird gesendet', eA.pass && eB.pass && eA.score > eB.score && d.get('A').send && !d.get('B').send && /Gleiche Richtung/.test(d.get('B').reason), `A ${eA.score} gesendet, B ${eB.score}: ${d.get('B').reason}`);
  d = Q.selectPatternSignals([cand('A', {}, eA), cand('C', { dir: 'bear', id: 'C' }, { ...eA, score: 80 })], [], {}, now);
  check('Gegensätzliche Signale auf demselben Coin im selben Lauf → keins', !d.get('A').send && !d.get('C').send && /Gegensätzliche/.test(d.get('A').reason));
  d = Q.selectPatternSignals([cand('A', {}, eA)], [{ at: now - 30 * 6e4, sym: 'ETHUSDT', iv: '15m', dir: 'bear', id: 'x' }], {}, now);
  check('Gegensätzliches Signal vor 30 Min. gemeldet → nicht senden', !d.get('A').send && /innerhalb von 60 Min/.test(d.get('A').reason));
  d = Q.selectPatternSignals([cand('A', {}, eA)], [{ at: now - 45 * 6e4, sym: 'ETHUSDT', iv: '1h', dir: 'bull', id: 'x' }], {}, now);
  const d2 = Q.selectPatternSignals([cand('A', {}, eA)], [{ at: now - 61 * 6e4, sym: 'ETHUSDT', iv: '1h', dir: 'bull', id: 'x' }], {}, now);
  check('Je Coin und Zeitrahmen höchstens 1 Meldung je 60 Min.', !d.get('A').send && /höchstens 1 Meldung je 60/.test(d.get('A').reason) && d2.get('A').send);
  const many = ['SOL', 'XRP', 'ADA', 'DOGE', 'LINK'].map((c0, i) => cand(c0, { sym: c0 + 'USDT', id: c0 }, { ...eA, score: 90 - i }));
  d = Q.selectPatternSignals(many, [], {}, now);
  check('Insgesamt höchstens 3 Meldungen je Stunde, höchster Score zuerst', ['SOL', 'XRP', 'ADA'].every(x => d.get(x).send) && ['DOGE', 'LINK'].every(x => !d.get(x).send && /Stundenlimit/.test(d.get(x).reason)));
  d = Q.selectPatternSignals(many.slice(0, 2), [{ at: now - 10 * 6e4, sym: 'AVAXUSDT', iv: '1h', dir: 'bull' }, { at: now - 20 * 6e4, sym: 'DOTUSDT', iv: '1h', dir: 'bull' }], {}, now);
  check('Stundenlimit zählt bereits gesendete Meldungen mit', d.get('SOL').send && !d.get('XRP').send);
  check('Gefilterte Kandidaten behalten ihren K.O.-Grund', Q.selectPatternSignals([cand('E1', { id: 'E1' }, e1)], [], {}, now).get('E1').reason === e1.reason);
  // ---- Tracking und Statistik ----
  const tk = series(120), base = tk[10].c, tr = (dir, tgt, inv, id) => ({ id, sym: 'ETHUSDT', mkt: 'futures', iv: '1h', pat: 'asc_triangle', dir, tc: tk[10].t, entry: base, target: tgt, invalid: inv, res: null });
  tk[15].h = base + 5; const j = [tr('bull', base + 4, base - 50, 'z'), tr('bull', base + 50, base - 50, 't'), tr('bear', base - 50, base + 3, 'u')];
  Q.resolvePatternJournal(j, { mkt: 'futures', sym: 'ETHUSDT', iv: '1h' }, tk, 1);
  check('Ergebnis automatisch: Ziel erreicht / Ungültig erreicht / Timeout nach 48 Kerzen', j[0].res.out === 'ziel' && j[0].res.bars === 5 && j[2].res.out === 'ungueltig' && j[1].res.out === 'timeout' && j[1].res.bars === 48, JSON.stringify(j.map(x => x.res && [x.res.out, x.res.bars])));
  const open = [tr('bull', base + 50, base - 50, 'o')]; Q.resolvePatternJournal(open, { mkt: 'futures', sym: 'ETHUSDT', iv: '1h' }, tk.slice(0, 40), 1);
  check('Noch offen, solange weder Ziel/Ungültig noch 48 Kerzen erreicht', open[0].res === null);
  const jj = [...j.map(x => ({ ...x, sent: x.id !== 'u' })), { ...open[0], sent: false }], st = Q.patternJournalStats(jj, 'pat')[0];
  check('Statistik je Muster: Signale, gesendet/gefiltert, abgeschlossen, Treffer; „Erlernt“ zählt nur abgeschlossene', st.signals === 4 && st.sent === 2 && st.filtered === 2 && st.n === 3 && st.ziel === 1 && st.open === 1 && Q.patternHitStats(jj, 'asc_triangle', '1h').n === 3 && Q.patternJournalStats(jj, 'sym')[0].key === 'ETHUSDT' && Q.patternJournalStats(jj, 'iv')[0].key === '1h', JSON.stringify(st));
  const je = Q.patternJournalEntry({ ...s.c }, e1, { send: false, reason: e1.reason }, 5);
  check('Journal-Eintrag: Zeit, Coin, Zeitrahmen, Muster, Richtung, Einstieg, Ziel, Ungültig, Score, Kriterien, Filtergrund', ['at', 'sym', 'iv', 'pat', 'dir', 'entry', 'target', 'invalid', 'score', 'criteria', 'reason'].every(x => je[x] !== undefined) && je.criteria.length === 6 && je.sent === false && /0,34/.test(je.reason));
  check('Journal begrenzt und ohne doppelte IDs', Q.addPatternJournal(Q.addPatternJournal([], je), je).length === 1 && Q.addPatternJournal(Array.from({ length: 5 }, (_, n) => ({ id: 'x' + n })), je, 3).length === 3);
  // ---- Backtest ----
  let calls = 0; const bk = series(320), detect = part => { calls++; const i = part.length - 1; if (i % 37) return []; const e = part[i].c, a = Q.atrSeries(part, 14)[i]; return [{ id: 'asc_triangle', kind: 'form', dir: 'bull', status: 'Ausbruch bestätigt', i1: i, t0: part[i - 20].t, q: 92, levels: { brk: e - .05, tgt: e + 6 * a, inv: e - 2 * a } }]; };
  const bt = await Q.backtestPatternFilter({ k: bk, iv: '1h', sym: 'ETHUSDT', detect, settings: { preset: 'locker' }, from: 260 });
  check('Backtest: walk-forward je Kerze, Tabelle je Score-Stufe, gesendet vs. gefiltert, häufigste Filtergründe', calls === 60 && bt.journal.length > 0 && bt.rows.length === 4 && typeof bt.passed.n === 'number' && Object.keys(bt.reasons).length >= 0, JSON.stringify({ calls, n: bt.journal.length, rows: bt.rows, reasons: bt.reasons }));
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
