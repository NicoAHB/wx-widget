// Asynchrone Quellenprüfung: Wiederverwendung, Kontextwechsel und tatsächliche Futures-Abos.
let pass = 0, fail = 0; const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
(async () => {
  const F = await import('../shared/orderflow-signal-feed.mjs'); let at = Date.now(), ctx = { symbol: 'BTCUSDT', paused: false, connected: true }, calls = [], marketCalls = [], changed = 0;
  const rows = iv => { const step = F.SIGNAL_PERIODS[iv], end = Math.floor(at / step) * step; return Array.from({ length: 121 }, (_, i) => [end - (121 - i) * step, '100', '102', '99', '101', '10', end - (120 - i) * step - 1, '1000', 1, '6', '650']); };
  const feed = F.createSignalFeed({ context: () => ctx, now: () => at, changed: () => changed++, fetchKlines: async (symbol, iv) => { calls.push(symbol + '|' + iv); return rows(iv); }, fetchMarket: async (kind, symbol) => { marketCalls.push(kind); return kind === 'contract' ? { symbols: [{ symbol, filters: [{ filterType: 'PRICE_FILTER', tickSize: '0.01' }] }] } : kind === 'oi' ? [] : kind === 'funding' ? { lastFundingRate: '0.0001' } : [{ longShortRatio: '1.2' }]; } });
  feed.tick(); feed.tick(); await new Promise(r => setTimeout(r, 5));
  check('BTC als gewählter Coin: vier statt fünf doppelte Historien', calls.length === 4 && new Set(calls).size === 4);
  check('Vier begrenzte Historien vollständig geliefert', Object.values(feed.state.series).every(rs => rs.length === 121) && feed.state.btc.length === 121);
  check('OI/Funding/Verhältnis/Tickgröße einmal je Start geladen', marketCalls.length === 4 && feed.state.tickSize === .01 && feed.state.funding === .0001 && feed.state.longShort === 1.2);
  check('Unbekannte OI-Preis-Basis bleibt null', feed.oi() === null);
  check('Bestehender Worker: vier deduplizierbare BTC-Streams', new Set(feed.streams()).size === 4 && feed.streams().every(s => /^btcusdt@kline_(1m|5m|1h|4h)$/.test(s)));
  const kline = (symbol, iv, market = 'futures', eventAt = at) => { const step = F.SIGNAL_PERIODS[iv], time = Math.floor(at / step) * step; return { s: symbol, i: iv, m: market, E: eventAt, k: { t: time, T: time + step - 1, o: 100, h: 103, l: 99, c: 102, ofV: '20', q: '2000', V: '12', Q: '1300', ofX: false } }; };
  feed.kline(kline('BTCUSDT', '1m')); check('Eigener frischer Futures-Kurs und BTC-Liveprobe', feed.quote()?.fresh && feed.btcQuote()?.fresh && feed.state.samples.at(-1).price === 102);
  const before = JSON.stringify(feed.state.series); feed.kline(kline('BTCUSDT', '1m', 'spot')); check('Spotnachricht überschreibt Futures nicht', JSON.stringify(feed.state.series) === before);
  feed.kline(kline('ETHUSDT', '1m')); check('Fremder Coin überschreibt gewählten Coin nicht', JSON.stringify(feed.state.series) === before);
  feed.kline(kline('BTCUSDT', '1m', 'futures', at - 60000)); check('Älteres WS-Update dreht Kurs nicht zurück', feed.quote().price === 102);
  ctx.connected = false; check('Getrennte Verbindung sperrt beide Quotes', !feed.quote().fresh && !feed.btcQuote().fresh); ctx.connected = true;
  at += 6000; check('Ereignisalter bleibt intern als Frischesperre', !feed.quote().fresh);
  ctx.symbol = 'ETHUSDT'; feed.sync(); check('Coinwechsel entfernt eigene Historie, behält BTC-Kontext', Object.keys(feed.state.series).length === 0 && feed.state.btc.length > 0 && feed.state.tickSize === null);
  const newSince = feed.state.since; feed.acceptRest({ symbol: 'ETHUSDT', interval: '1m', rows: rows('1m'), startedAt: newSince - 1 }); check('Verspätete REST-Antwort vor aktuellem Kontext ignoriert', !feed.state.series['1m']);
  feed.kline(kline('ETHUSDT', '1m')); check('Gewählter Coin und BTC haben getrennte Kurse', feed.quote().price === 102 && feed.state.samples.length === 1);
  check('ETH-Streams plus eigener BTC-Stream ohne Spot-Abos', new Set(feed.streams()).size === 5 && feed.streams().includes('btcusdt@kline_1m') && feed.streams().includes('ethusdt@kline_4h'));
  ctx.unavailable = true; feed.sync(); check('Ohne eigenen Futures-Markt bleibt nur BTC-Kontext', feed.streams().join() === 'btcusdt@kline_1m'); ctx.unavailable = false; feed.sync(); check('Erfolgreicher Quellen-Neuversuch entfernt Sperre', !feed.state.unavailable);
  ctx.paused = true; feed.sync(); check('Pause: keine zusätzlichen Abos oder gültigen Quotes', feed.streams().length === 0 && !feed.quote().fresh);
  check('Datenänderungen melden sich ohne eigenen Sekundentimer', changed > 0);
  console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
