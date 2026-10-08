// G10(d): echter Transport, öffentliche Preis-/Fundingseiten und fortgesetzte Historienjobs.
const path = require('path'), { pathToFileURL } = require('url');
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
const rejects = async fn => { try { await fn(); return false; } catch { return true; } };
(async () => {
  const B = await import(pathToFileURL(path.join(__dirname, '../shared/bitget-public.mjs')));
  const H = await import(pathToFileURL(path.join(__dirname, '../shared/confluence-history.mjs')));
  const { replayFixture, HOUR } = await import(pathToFileURL(path.join(__dirname, 'fixtures/confluence-replay.mjs')));
  const f = replayFixture(), at = f.observation.decisionAt, observed = f.asOf + HOUR, calls = [];
  const client = B.createBitgetPublicClient({ now: () => observed, spacingMs: 0, fetch: async (url, init) => {
    const u = new URL(url); calls.push({ u, init }); let data;
    if (u.pathname.endsWith('/history-fund-rate')) data = f.history.events.map(e => ({ symbol: 'BTCUSDT', fundingRate: String(e.rate), fundingTime: String(e.at) })).reverse();
    else { const end = Number(u.searchParams.get('endTime')), limit = Number(u.searchParams.get('limit')), mark = u.pathname.endsWith('/history-mark-candles');
      data = Array.from({ length: limit }, (_, i) => { const time = end - (i + 1) * HOUR, source = (mark ? f.marks : f.rows).find(c => c.time === time) || { open: 100, high: 101, low: 99, close: 100, volume: mark ? 0 : 100 };
        return [time, source.open, source.high, source.low, source.close, source.volume, 0].map(String); }); }
    return new Response(JSON.stringify({ code: '00000', requestTime: observed, data }), { status: 200 });
  } });
  const marks = await client.markRange({ symbol: 'BTCUSDT', timeframe: '1h', from: at, to: at + 2 * HOUR, maxPages: 2 });
  check('Eigener öffentlicher Markkerzenpfad, UTC/exklusiv und echtes Nullvolumen', marks.complete && marks.rows.length === 2 && marks.rows[0].volume === 0 && calls[0].u.pathname.endsWith('/history-mark-candles'));
  check('Vergangene Markkerzen tragen tatsächliche spätere Abrufzeit', marks.rows.every(c => c.knownAt === observed && c.end <= at + 2 * HOUR));
  const page = await client.fundingPage({ symbol: 'BTCUSDT', pageNo: 2, pageSize: 100 });
  check('Fundingseite: Nummer/Limit und tatsächliche Abrechnungen', calls.at(-1).u.searchParams.get('pageNo') === '2' && page.rawCount === 7 && page.events.every(e => e.kind === 'settled'));
  check('Keine historische angekündigte Rate oder erfundenes Intervall', page.events.every(e => e.announcedRate === null && e.intervalHours === null));
  check('Historienabrufe ausschließlich öffentliche GETs ohne Konto/Order/Schlüssel', calls.every(c => c.u.origin === B.BITGET_ORIGIN && c.u.pathname.startsWith('/api/v2/mix/market/') && c.init.method === 'GET' && c.init.credentials === 'omit' && !c.init.body && Object.keys(c.init.headers).join() === 'Accept'));
  check('Übergrenzen bei Fundingseiten werden ohne API-Abfrage abgelehnt', await rejects(() => client.fundingPage({ symbol: 'BTCUSDT', pageNo: 0 })) && await rejects(() => client.fundingPage({ symbol: 'BTCUSDT', pageSize: 101 })));
  const before = calls.length, aborted = new AbortController(); aborted.abort();
  check('Abgebrochene Historie startet keinen Abruf', await rejects(() => client.fundingPage({ symbol: 'BTCUSDT', signal: aborted.signal })) && calls.length === before);
  const args = { client, instrument: 'BTCUSDT', key: f.observation.key, observations: [f.observation], asOf: f.asOf };
  const prices = await H.loadHistoryJob(args), markJob = await H.loadHistoryJob({ ...args, saved: prices.saved }), funding = await H.loadHistoryJob({ ...args, saved: markJob.saved });
  check('Begrenzte Phasen Preis → Mark → Funding → Replay, Fortsetzung statt Gesamtlauf', prices.saved.stage === 'marks' && markJob.saved.stage === 'funding' && funding.saved.stage === 'replay' && funding.complete);
  check('Historische Abrufzeit ändert gespeicherte Auswertungsgrenze nicht', funding.saved.asOf === f.asOf && funding.saved.rows.every(c => c.knownAt === observed));
  check('Tatsächliche Fundingabdeckung bis originalem Einstieg belegt', funding.saved.history.complete && funding.saved.history.from <= at && funding.saved.history.to === observed);
  check('Gespeicherter Preiszustand durch Folgejob nicht verändert', prices.saved.stage === 'marks' && !prices.saved.marks.length && markJob.saved.stage === 'funding');
  check('Fremder gespeicherter Grenzzeitpunkt ist Fehler, keine Mischung', await rejects(() => H.loadHistoryJob({ ...args, asOf: f.asOf + HOUR, saved: prices.saved })));
  const noDataAt = calls.length, none = await H.loadHistoryJob({ ...args, observations: [] });
  check('Ohne Originalarchiv kein künstlicher Historien-/Fundingabruf', none.saved === null && calls.length === noDataAt && /nicht verfügbar/.test(none.reason));
  const young = await H.loadHistoryJob({ ...args, asOf: at + 1 });
  check('Noch keine nächste geschlossene Kerze: fertiger Wartezustand erlaubt später neuen Grenzzeitpunkt', young.waiting && young.saved.stage === 'done');
  const throttleCalls = [], throttle = B.createBitgetPublicClient({ now: () => observed, spacingMs: 0, fetch: async url => { throttleCalls.push(url); return new Response('', { status: 429, headers: { 'Retry-After': '3' } }); } });
  check('429-Cooldown gemeinsam für Funding und Markkerzen', await rejects(() => throttle.fundingPage({ symbol: 'BTCUSDT' })) && await rejects(() => throttle.markRange({ symbol: 'BTCUSDT', timeframe: '1h', from: at, to: at + HOUR })) && throttleCalls.length === 1);
  console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
