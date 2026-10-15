// 3.70.0: Fair Value Gaps (shared/fvg.mjs) – 3-Kerzen-Logik, Mitigation, Zusammenfassung; Abgleich mit fvg-ki (Python), falls vorhanden.
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${!ok && detail !== '' ? ' — ' + String(detail).slice(0, 400) : ''}`); };
const K = rows => rows.map(([open, high, low, close], i) => ({ time: i * 3600e3, open, high, low, close }));
(async () => {
  const F = await import('../shared/fvg.mjs');
  const bull = K([[10, 11, 9, 10.5], [10.5, 14, 10.4, 13.8], [13.8, 15, 12, 14.5], [14.5, 15, 11.6, 14], [14, 14.2, 10.9, 11], [11, 12, 10, 11.5]]);
  const b = F.detectFvgs(bull);
  check('Bullisch: Tief[i] > Hoch[i-2], mittlere Kerze grün → Lücke 11…12', b.length === 1 && b[0].dir === 'bull' && b[0].i === 2 && b[0].start === 0 && b[0].bottom === 11 && b[0].top === 12, JSON.stringify(b));
  check('… berührt bei Kerze 3, mitigiert erst, wenn der Docht die Unterkante erreicht (Kerze 4)', b[0].touch === 3 && b[0].mit === 4);
  const bear = F.detectFvgs(K([[20, 21, 19, 19.5], [19.5, 19.6, 16, 16.2], [16.2, 17.5, 15, 15.5], [15.5, 18.9, 15, 18], [18, 18.5, 16, 16.5]]));
  check('Bärisch: Hoch[i] < Tief[i-2], mittlere Kerze rot → Lücke 17,5…19, offen (Hoch 18,9 schließt nicht)', bear.length === 1 && bear[0].dir === 'bear' && bear[0].bottom === 17.5 && bear[0].top === 19 && bear[0].touch === 3 && bear[0].mit === -1, JSON.stringify(bear));
  check('Falsche Farbe der mittleren Kerze oder anstoßende Kerzen: keine Lücke', !F.detectFvgs(K([[10, 11, 9, 10.5], [13.8, 14, 10.4, 10.6], [13.8, 15, 12, 14.5]])).length && !F.detectFvgs(K([[10, 11, 9, 10.5], [10.5, 14, 10.4, 13.8], [13.8, 15, 11, 14.5]])).length);
  check('Docht genau an der Unterkante schließt (≤), knapp darüber nicht', F.detectFvgs([...bull.slice(0, 3), { time: 9, open: 14, high: 14.5, low: 11, close: 12 }])[0].mit === 3 && F.detectFvgs([...bull.slice(0, 3), { time: 9, open: 14, high: 14.5, low: 11.01, close: 12 }])[0].mit === -1);
  check('Leere oder kurze Reihen', F.detectFvgs([]).length === 0 && F.detectFvgs(null).length === 0 && F.detectFvgs(bull.slice(0, 2)).length === 0);
  const s = F.fvgSummary([...b, ...bear], 20);
  check('Zusammenfassung: offen/geschlossen, nächste offene Lücke mit Abstand', s.total === 2 && s.open === 1 && s.bear === 1 && s.mitigated === 1 && s.near.dir === 'bear' && s.near.inside === false && Math.abs(s.near.pct - (-1 / 20 * 100)) < 1e-9 && F.fvgSummary(bear, 18).near.inside === true, JSON.stringify(s));
  // Zufallsreihe: gegen eine einfache Schleife
  let r = 7; const rnd = () => (r = (r * 48271) % 2147483647) / 2147483647, rows = []; let p = 100;
  // Echte Millisekunden-Zeitstempel: Werte ab 0 würden beim CSV-Import als Sekunden gelesen (außerhalb des Pandas-Zeitbereichs).
  for (let i = 0; i < 4000; i++) { const o = p, shock = rnd() < .05 ? (rnd() - .5) * .04 : 0, c = o * (1 + (rnd() - .5) * .01 + shock), h = Math.max(o, c) * (1 + rnd() * .003), l = Math.min(o, c) * (1 - rnd() * .003); rows.push({ time: Date.UTC(2026, 0, 1) + i * 3600e3, open: o, high: h, low: l, close: c, volume: 100 + rnd() * 50 }); p = c; }
  const got = F.detectFvgs(rows), naive = [];
  for (let i = 2; i < rows.length; i++) for (const up of [true, false]) {
    const a = rows[i - 2], m = rows[i - 1], k = rows[i]; let top, bot;
    if (up && k.low > a.high && m.close > m.open) { top = k.low; bot = a.high; } else if (!up && k.high < a.low && m.close < m.open) { top = a.low; bot = k.high; } else continue;
    let mit = -1, touch = -1; for (let j = i + 1; j < rows.length; j++) { if (touch < 0 && (up ? rows[j].low <= top : rows[j].high >= bot)) touch = j; if (up ? rows[j].low <= bot : rows[j].high >= top) { mit = j; break; } }
    naive.push([i, up ? 'bull' : 'bear', top, bot, touch, mit]);
  }
  check('4000 Zufallskerzen: identisch mit einfacher Schleife', got.length > 50 && JSON.stringify(got.map(g => [g.i, g.dir, g.top, g.bottom, g.touch, g.mit])) === JSON.stringify(naive), `${got.length} vs ${naive.length}`);
  const t0 = Date.now(); for (let i = 0; i < 20; i++) F.detectFvgs(rows); check('Tempo: 4000 Kerzen in unter 5 ms je Lauf', (Date.now() - t0) / 20 < 5, (Date.now() - t0) / 20);
  // Abgleich mit dem Python-Programm (gleiche Kerzen als CSV)
  const PY = process.env.FVG_PYTHON || 'python3', ok = spawnSync(PY, ['-c', 'import pandas, numpy, sklearn, joblib'], { encoding: 'utf8' }).status === 0;   // fvg_ki lädt beim Import auch das Lernmodell (scikit-learn, joblib)
  if (ok) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvg-js-')), csv = path.join(dir, 'k.csv');
    fs.writeFileSync(csv, 'time,open,high,low,close,volume\n' + rows.map(k => [k.time, k.open, k.high, k.low, k.close, k.volume].join(',')).join('\n'));
    const py = spawnSync(PY, ['-c', `import sys, json; sys.path.insert(0, ${JSON.stringify(path.join(__dirname, '..', 'fvg-ki'))}); import pandas as pd; from fvg_ki.model.detection import detect_fvgs; f = detect_fvgs(pd.read_csv(${JSON.stringify(csv)}, float_precision='round_trip')); print(json.dumps([[int(r['index']), 'bull' if r['direction'] == 'bullish' else 'bear', float(r['top']), float(r['bottom']), int(r['touched_index']), int(r['mitigated_index'])] for _, r in f.iterrows()]))`], { encoding: 'utf8', maxBuffer: 64e6 });
    const pyList = py.status === 0 ? JSON.parse(py.stdout) : null;
    const js = got.map(g => [g.i, g.dir, g.top, g.bottom, g.touch, g.mit]), bad = pyList ? pyList.findIndex((x, i) => JSON.stringify(x) !== JSON.stringify(js[i])) : 0;
    check('Gleiches Ergebnis wie fvg-ki (Python, Pandas/NumPy)', pyList && pyList.length === js.length && bad < 0, py.stderr || `erste Abweichung #${bad}: Python ${JSON.stringify(pyList[bad])} / JS ${JSON.stringify(js[bad])}`);
    fs.rmSync(dir, { recursive: true, force: true });
  } else console.log('– Abgleich mit Python übersprungen (pandas, numpy, scikit-learn oder joblib fehlt – siehe fvg-ki/requirements.txt; FVG_PYTHON setzen)');
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})();
