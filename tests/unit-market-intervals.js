let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
(async () => {
  const I = await import('../shared/market-intervals.mjs'), P = await import('../server/pattern-monitor.mjs');
  check('2h zwischen 1h und 4h, API-Wert und Dauer stimmen', I.CHART_INTERVALS.join(',') === '1m,5m,15m,1h,2h,4h,1d,1w,1M' && I.MARKET_INTERVALS.find(x => x.id === '2h').api === '2h' && I.INTERVAL_MS['2h'] === 7200000);
  check('Die bisherigen sechs Gesamt-Signalstimmen sind unverändert', I.SIGNAL_INTERVALS.join(',') === '1m,5m,15m,1h,4h,1d');
  check('Dienst und Chart verwenden dieselbe Konfiguration', P.PAT_STEPS === I.PATTERN_STEPS && P.patternEnd(7200000, '2h') === 14400000);
  check('Monatsende kalendergenau, Februar und Jahreswechsel', I.intervalEnd(Date.UTC(2026, 1, 1), '1M') === Date.UTC(2026, 2, 1) && I.intervalEnd(Date.UTC(2026, 11, 1), '1M') === Date.UTC(2027, 0, 1));
  check('Unbekannte Dauer wechselt zum nächstliegenden Chartintervall', I.nearestChartInterval('3h') === '4h' && I.nearestChartInterval('90m') === '2h');
  check('Wirklich unbekannter Name nutzt gültigen bisherigen Chart', I.nearestChartInterval('irgendwas', '2h') === '2h' && I.nearestChartInterval('irgendwas', 'kaputt') === '1h');
  check('Alle Intervalle und Konfigurationen unveränderlich', Object.isFrozen(I.MARKET_INTERVALS) && I.MARKET_INTERVALS.every(Object.isFrozen));
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
