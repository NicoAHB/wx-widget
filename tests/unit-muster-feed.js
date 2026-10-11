let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
(async () => {
  const { createMusterClient } = await import('../shared/muster-bot-feed.mjs'); const time = Date.UTC(2026, 8, 1), ms = 300000;
  const rows = Array.from({ length: 2005 }, (_, i) => [time + i * ms, '100', '102', '99', '101', '100', time + (i + 1) * ms - 1]);
  const requests = [], waits = [], response = data => ({ ok: true, status: 200, json: async () => data });
  const page = url => { const u = new URL(url); requests.push(u); return response(rows.filter(r => r[0] >= Number(u.searchParams.get('startTime')) && r[0] <= Number(u.searchParams.get('endTime'))).slice(0, 1000)); };
  const client = createMusterClient({ fetcher: async url => page(url), sleep: async milliseconds => waits.push(milliseconds) });
  const data = await client.history({ symbol: 'BTCUSDT', market: 'spot', timeframe: '5m', from: time, to: time + rows.length * ms });
  check('Mehrseitige Historie vollständig ohne Dopplungen', data.length === 2005 && requests.length === 3 && data.at(-1).end === time + 2005 * ms);
  check('Binance-Werte, öffentlicher Spot-Feed, sinnvolle Abrufpausen', requests.every(u => u.hostname === 'data-api.binance.vision' && u.searchParams.get('interval') === '5m' && u.searchParams.get('symbol') === 'BTCUSDT') && waits.length === 2 && waits.every(x => x === 250));
  let calls = 0, retryWait = 0; const limited = createMusterClient({ fetcher: async () => ++calls === 1 ? { ok: false, status: 429, headers: { get: () => '2' } } : response(rows.slice(0, 5)), sleep: async n => { retryWait = n; } });
  await limited.history({ symbol: 'BTCUSDT', market: 'futures', timeframe: '5m', from: time, to: time + 5 * ms }); check('429: Retry-After und erfolgreicher erneuter Abruf', calls === 2 && retryWait === 2000);
  calls = 0; const alwaysLimited = createMusterClient({ fetcher: async () => { calls++; return { status: 429, ok: false, headers: { get: () => '' } }; }, sleep: async () => {} }); let error = '';
  try { await alwaysLimited.page({ symbol: 'BTCUSDT', market: 'spot', timeframe: '5m', startTime: time, endTime: time + ms }); } catch (e) { error = e.message; }
  check('Dauerhaftes Rate-Limit endet verständlich und ohne Anfrageschleife', calls === 4 && /begrenzt/.test(error));
  calls = 0; const fallback = createMusterClient({ fetcher: async () => ++calls === 1 ? { status: 451, ok: false } : response(rows.slice(0, 5)) });
  await fallback.history({ symbol: 'BTCUSDT', market: 'spot', timeframe: '5m', from: time, to: time + 5 * ms }); check('Vorhandene Spot-Ausweichquelle bei Regionssperre', calls === 2);
  const corrupt = createMusterClient({ fetcher: async () => response(rows.slice(0, 10).filter((_, i) => i !== 3)) }); error = ''; try { await corrupt.history({ symbol: 'BTCUSDT', market: 'spot', timeframe: '5m', from: time, to: time + 10 * ms }); } catch (e) { error = e.message; } check('Kerzenlücken werden abgelehnt und nicht künstlich gefüllt', /Datenlücke/.test(error));
  const ctrl = new AbortController(); ctrl.abort(); error = ''; try { await client.history({ symbol: 'BTCUSDT', market: 'spot', timeframe: '5m', from: time, to: time + ms, signal: ctrl.signal }); } catch (e) { error = e.name; } check('Abbruch stoppt weitere API-Aufrufe', error === 'AbortError');
  const partial = await client.history({ symbol: 'BTCUSDT', market: 'spot', timeframe: '5m', from: time, to: time + 4 * ms + 1000 }); check('Laufende Kerze ausgeschlossen; ausschließlich ihr bekanntes Open separat', partial.length === 4 && partial.liveOpen.time === time + 4 * ms && partial.liveOpen.open === 100);
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
