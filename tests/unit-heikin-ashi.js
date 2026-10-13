// 3.68.1: Heikin-Ashi-Umrechnung (reine Funktion, ohne Browser).
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const near = (a, b) => Math.abs(a - b) < 1e-12;
(async () => {
  const { heikinAshi } = await import('../shared/heikin-ashi.mjs');
  const rows = [{ time: 1, open: 10, high: 12, low: 9, close: 11, volume: 5 }, { time: 2, open: 11, high: 15, low: 10, close: 14, volume: 7 }, { time: 3, open: 14, high: 14.5, low: 8, close: 9, volume: 9 }];
  const copy = JSON.stringify(rows), ha = heikinAshi(rows);
  check('Erste Kerze: HA_Open = normales Open, HA_Close = (O+H+L+C)/4', ha[0].open === 10 && near(ha[0].close, 10.5));
  check('Erste Kerze: HA_High = max(H, HA_O, HA_C), HA_Low = min(L, HA_O, HA_C)', ha[0].high === 12 && ha[0].low === 9);
  check('Zweite Kerze: HA_Open = (HA_Open_vorher + HA_Close_vorher)/2', near(ha[1].open, (10 + 10.5) / 2) && near(ha[1].close, (11 + 15 + 10 + 14) / 4));
  check('Dritte Kerze: Hoch/Tief schließen HA_Open/HA_Close ein', near(ha[2].open, (ha[1].open + ha[1].close) / 2) && ha[2].high === Math.max(14.5, ha[2].open, ha[2].close) && ha[2].low === Math.min(8, ha[2].open, ha[2].close));
  check('Zeit und Volumen bleiben, Eingabe unverändert', ha.every((c, i) => c.time === rows[i].time && c.volume === rows[i].volume && c.heikinAshi) && JSON.stringify(rows) === copy);
  const gap = heikinAshi([rows[0], { time: 2, open: NaN, high: 1, low: 1, close: 1 }, rows[2]]);
  check('Ungültige Kerze wird durchgereicht, danach Neustart mit normalem Open', Number.isNaN(gap[1].open) && gap[2].open === 14);
  check('Leere Reihe ergibt leere Reihe', heikinAshi([]).length === 0);
  const long = Array.from({ length: 1500 }, (_, i) => ({ time: i, open: 100 + Math.sin(i), high: 102 + Math.sin(i), low: 98 + Math.sin(i), close: 100 + Math.cos(i), volume: 1 })), t0 = performance.now(); heikinAshi(long);
  check('1.500 Kerzen schnell genug für jedes Zeichnen', performance.now() - t0 < 20);
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
