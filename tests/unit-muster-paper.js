const { fixture, STEP } = require('./muster-fixtures');
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
(async () => {
  const { createMusterPaper } = await import('../shared/muster-bot-paper.mjs'); const { MUSTER_VERSION } = await import('../shared/muster-bot-core.mjs');
  const source = fixture(), calls = [], messages = []; let now = source.rows[30].end - 1000, picked = { symbol: 'BTCUSDT', market: 'spot' }, stored = null, waiting = null;
  const write = async (value, expected) => { if ((stored?.revision ?? 0) !== expected) throw new Error('in einem anderen Tab geändert'); stored = value ? { ...value, revision: expected + 1 } : null; return structuredClone(stored); };
  const client = { load: async input => { calls.push(input); if (waiting) await waiting; return { ...source, symbol: input.symbol, market: input.market, rows: { '15m': source.rows }, config: input.config, startTime: input.startTime, asOf: input.asOf }; } };
  const p = createMusterPaper({ read: async () => structuredClone(stored), write, client, selection: () => picked, now: () => now, notify: async event => messages.push(event) });
  await p.restore(); await p.start({ timeframe: '15m' }, true); check('Start erstellt eigenen Paper-Lauf und handelt keine noch laufende Kerze', p.state.book.active && p.state.book.symbol === 'BTCUSDT' && p.state.book.result.signals.length === 0);
  picked = { symbol: 'LTCUSDT', market: 'futures' }; now = source.rows[31].end; await p.poll(); check('Coinwechsel mischt keine fremden Coin-/Marktdaten in laufende Demo', calls.at(-1).symbol === 'BTCUSDT' && calls.at(-1).market === 'spot' && p.state.book.result.position.symbol === 'BTCUSDT');
  check('Sofort-Einstieg: genau eine Meldung (Einstieg mit Muster) nach dauerhafter Buchung', messages.length === 1 && messages[0].kind === 'entry' && messages[0].symbol === 'BTCUSDT' && messages[0].timeframe === '15m' && Object.keys(stored.notified).length === 1);
  await p.poll(); check('Weitere Prüfung sendet den Einstieg nicht doppelt', messages.length === 1);
  let release; waiting = new Promise(resolve => { release = resolve; }); const poll = p.poll(); await p.stop(); release(); await poll; waiting = null;
  check('Roter Stop beendet Demo und verwirft verspätete alte Datenantwort', !p.state.book.active && !p.state.busy);
  await p.clear(); check('Gezieltes Löschen entfernt ausschließlich das eigene Muster-Demo-Buch', stored === null && p.state.book === null);
  now += STEP; await p.start({ timeframe: '15m' }, false); check('Neuer Lauf übernimmt jetzt den ausgewählten Coin statt BTC/LTC-Altbestand', p.state.book.symbol === 'LTCUSDT' && p.state.book.market === 'futures');
  stored.revision++; await p.poll(); check('Konkurrierende Änderung pausiert statt Demo-Zustand zu überschreiben', !p.state.book.active && /anderen Tab/.test(p.state.message));
  { // 3.68.0: Buy-Stop wartet nach dem Signal – dann eigene Signalmeldung mit Coin aus dem Lauf
    let box = null; const w2 = async (value, expected) => { box = value ? { ...value, revision: expected + 1 } : null; return structuredClone(box); }, got = [];
    const q = createMusterPaper({ read: async () => null, write: w2, client, selection: () => ({ symbol: 'ETHUSDT', market: 'spot' }), now: () => source.rows[30].end - 1000, notify: async event => got.push(event) });
    await q.start({ timeframe: '15m', hammerEntry: 'buy-stop', engulfEntry: 'buy-stop' }, true); const late = createMusterPaper({ read: async () => structuredClone(box), write: w2, client, selection: () => null, now: () => source.rows[30].end + 1, notify: async event => got.push(event) }); await late.restore(); await late.poll();
    check('Buy-Stop: Signalmeldung mit Coin, Markt und Ebene des Laufs', got.some(e => e.kind === 'signal' && e.entryMode === 'buy-stop' && e.symbol === 'ETHUSDT' && e.market === 'spot' && e.timeframe === '15m'));
  }
  const bad = createMusterPaper({ read: async () => ({ version: 'future-unknown' }), write, client, selection: () => picked }); await bad.restore(); check('Unbekanntes Modell wird erhalten und verständlich gemeldet', bad.state.message.includes('unbekanntes Modell') && MUSTER_VERSION !== 'future-unknown');
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
