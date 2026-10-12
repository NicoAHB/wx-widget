// 3.68.0: KI-Zonen (Kauf-/Verkaufszonen) – reine Berechnung ohne Browser, Netzwerk oder Schlüssel.
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };
// Seitwärtsmarkt zwischen ~100 (Unterstützung) und ~110 (Widerstand) mit leichtem, reproduzierbarem Rauschen.
function range(n, { start = Date.UTC(2026, 0, 1), ms = 3600000, low = 100, high = 110, period = 24, seed = 5 } = {}) {
  let x = seed; const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }, rows = []; let prev = (low + high) / 2;
  for (let i = 0; i < n; i++) {
    const phase = (i % period) / period, target = low + (high - low) * (phase < .5 ? phase * 2 : 2 - phase * 2), close = target + (rnd() - .5) * .6, open = prev;
    rows.push({ time: start + i * ms, open, high: Math.max(open, close) + rnd() * .4, low: Math.min(open, close) - rnd() * .4, close, volume: 100 + rnd() * 50 + (Math.abs(close - low) < 1.5 ? 900 : 0) }); prev = close;
  }
  return rows;
}
(async () => {
  const Z = await import('../shared/ki-zones.mjs');
  const rows = range(300), r = Z.computeKiZones({ candles: rows, interval: '1h' });
  const bestBuy = r.buy[0], bestSell = r.sell[0];
  check('Kaufzone an der Unterstützung ~100 aus Swing-Tiefs', bestBuy && bestBuy.low <= 100.2 && bestBuy.high >= 99.6 && bestBuy.side === 'buy', JSON.stringify(bestBuy && [bestBuy.low, bestBuy.high, bestBuy.score]));
  check('Verkaufszone am Widerstand ~110 aus Swing-Hochs', bestSell && bestSell.low <= 110.4 && bestSell.high >= 109.8 && bestSell.side === 'sell', JSON.stringify(bestSell && [bestSell.low, bestSell.high, bestSell.score]));
  check('Höchstens 3 Kauf- und 3 Verkaufszonen, absteigend nach Score 1–100', r.buy.length <= 3 && r.sell.length <= 3 && [...r.buy, ...r.sell].every(z => Number.isInteger(z.score) && z.score >= 1 && z.score <= 100) && r.buy.every((z, i) => !i || r.buy[i - 1].score >= z.score));
  check('Viele Berührungen und Begründung als Text', bestBuy.touches >= 4 && bestBuy.reasons[0].includes('Berührungen') && bestBuy.reasons.some(t => /Volumen/.test(t)), bestBuy.reasons.join(' · '));
  check('Zonenbreite ATR-basiert (mindestens 0,5 ATR, höchstens Gruppenspanne + Rand)', [...r.buy, ...r.sell].every(z => z.high - z.low >= .5 * r.atr - 1e-9 && z.high - z.low <= 1.8 * r.atr + 1e-9));
  check('Starke Zone mit Volumen bekommt hohen Score', bestBuy.score >= 60 && bestBuy.volumeRatio > 1, `Score ${bestBuy.score}, Volumen ×${bestBuy.volumeRatio?.toFixed(2)}`);
  check('Gleiches Ergebnis bei gleicher Eingabe (kein Zufall, keine Uhrzeit)', JSON.stringify(Z.computeKiZones({ candles: rows, interval: '1h' })) === JSON.stringify(r));
  const sr = Z.computeKiZones({ candles: rows, interval: '1h', levels: [bestBuy.mid] }).buy.find(z => Math.abs(z.mid - bestBuy.mid) < 1e-9);
  check('Übereinstimmung mit S/R-Level erhöht den Score', sr && sr.hits.sr && sr.score > bestBuy.score - (bestBuy.hits.sr ? 1 : 0) && sr.reasons.includes('S/R-Level'));
  const poc = Z.computeKiZones({ candles: rows, interval: '1h', profile: { lo: 95, step: 1, bins: Array.from({ length: 20 }, (_, i) => i === 5 ? 500 : 10), total: 690, poc: bestBuy.mid } }).buy.find(z => Math.abs(z.mid - bestBuy.mid) < 1e-9);
  check('Vorhandenes Volumenprofil der App: POC in der Zone zählt', poc && poc.hits.poc && poc.reasons.includes('POC'));
  check('EMA 200 und Bollinger-Band als Übereinstimmung', (() => { const z = Z.computeKiZones({ candles: rows, interval: '1h', ema200: bestSell.mid, bands: { upper: bestSell.mid, lower: bestBuy.mid } }); return z.sell[0].hits.ema200 && z.sell[0].hits.bollinger && z.buy[0].hits.bollinger; })());
  // Durchbruch: nach der Seitwärtsphase fällt der Kurs deutlich unter die Unterstützung und bleibt dort.
  const fall = [...rows]; let p = rows.at(-1).close;
  for (let i = 0; i < 40; i++) { const t = rows.at(-1).time + (i + 1) * 3600000, o = p, c = Math.max(80, p - (i < 10 ? 2 : .1)); fall.push({ time: t, open: o, high: o + .2, low: c - .2, close: c, volume: 150 }); p = c; }
  const broken = Z.computeKiZones({ candles: fall, interval: '1h' }), old = broken.zones.find(z => z.side === 'buy' && z.low <= 100 && z.high >= 99.5);
  check('Deutlich durchbrochene Kaufzone ist als grau/durchbrochen markiert', old && old.broken && old.reasons.includes('deutlich durchbrochen') && Number.isFinite(old.brokenAt));
  check('Zeitrahmen außerhalb 5m–1d und zu kurze Reihen liefern keine erfundenen Zonen', Z.computeKiZones({ candles: rows, interval: '1m' }).zones.length === 0 && Z.computeKiZones({ candles: rows.slice(0, 30), interval: '1h' }).reason.includes('Zu wenige'));
  check('Fraktalgröße 3–5 je Zeitrahmen', Z.kiZoneFractal('5m') === 3 && Z.kiZoneFractal('1h') === 4 && Z.kiZoneFractal('1d') === 5 && Z.KI_ZONE_INTERVALS.length === 9);
  check('Gewichte ergeben 100', Object.values(Z.KI_ZONE_WEIGHTS).reduce((a, b) => a + b, 0) === 100);
  const unfinished = Z.computeKiZones({ candles: rows.slice(0, -3), interval: '1h' });
  check('Nur bestätigte Fraktale: die letzten Kerzen ohne rechte Nachbarn erzeugen keinen Swing', unfinished.zones.every(z => z.firstTime <= rows.at(-4 - 4).time));
  const big = range(500, { ms: 300000 }), t0 = performance.now(); for (let i = 0; i < 20; i++) Z.computeKiZones({ candles: big, interval: '5m' }); const each = (performance.now() - t0) / 20;
  check('Schnell genug für den Hauptthread (500 Kerzen deutlich unter 20 ms)', each < 20, each.toFixed(2) + ' ms');
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
