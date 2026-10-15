// 3.71.4: tatsächlicher Tradebild-Versand, ausführlicher Text und eindeutige Zustellung; keine realen Telegram-Aufrufe.
const fs = require('node:fs'), path = require('node:path');
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
(async () => {
  const F = await import('../shared/telegram-format.mjs'), app = fs.readFileSync(path.join(__dirname, '../weather-widget-v2.html'), 'utf8');
  const source = app.match(/^const timgDur = .+;$/m)[0] + '\n' + app.slice(app.indexOf('function timgCaption('), app.indexOf('// ---- Auftrag ----', app.indexOf('function timgCaption(')));
  const calls = []; let replies = [], online = true;
  const api = new Function('formatMessage', 'TELEGRAM_CAPTION_LIMIT', 'telegramPlain', 'telegramFormatRejected', 'tgDest', 'navigator', 'fetch', source + '\nreturn { caption: timgCaption, post: timgPost };')(
    F.formatMessage, F.TELEGRAM_CAPTION_LIMIT, F.telegramPlain, F.telegramFormatRejected,
    () => ({ token: 'LOCAL_ONLY', chat: 'LOCAL_ONLY', thread: '42' }), { get onLine() { return online; } },
    async (_url, options) => { calls.push(Object.fromEntries(options.body)); const r = replies.shift(); if (r instanceof Error) throw r; return { ok: r.status === 200, status: r.status, json: async () => r.body }; });
  const d = { sym: 'XRPUSDT', side: 'long', net: 49.94, eur: 43.88, pct: 89.54, openedAt: Date.UTC(2026, 9, 15, 10, 38), closedAt: Date.UTC(2026, 9, 15, 12, 30),
    stats: { gain: { usd: 61.26, eur: 53.83, never: false }, loss: { usd: 0, eur: 0, never: true } } };
  const text = api.caption(d), plain = F.telegramPlain(text);
  check('Vorlage: GEWINN, XRP/USDT und Long', text.startsWith('<b>🟢 GEWINN · XRP/USDT Long</b>'));
  check('Vorlage: Netto in Euro und zwei Prozentstellen', plain.includes('💶 Netto: +43,88 € · +89,54 %'));
  check('Vorlage: ausgeschriebene Haltedauer', plain.includes('⏱ Haltedauer: 1 Std. 52 Min.'));
  check('Vorlage: maximaler Gewinn und nie im Minus', plain.includes('📈 Max. Gewinn: +53,83 €') && plain.includes('📉 Max. Verlust: 0,00 € (nie im Minus)'));
  check('Abschluss-Uhrzeit als letzte Zeile', plain.endsWith('🕐 ' + new Date(d.closedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })));
  check('Short und Verlust mit echtem Minus', api.caption({ ...d, side: 'short', eur: -12.5, pct: -2.25 }).includes('🔴 VERLUST · XRP/USDT Short</b>') && api.caption({ ...d, eur: -12.5, pct: -2.25 }).includes('−12,50 €</b> · −2,25 %'));
  check('Nullergebnis als ausgeglichen', api.caption({ ...d, eur: 0, pct: 0 }).includes('⚪ AUSGEGLICHEN'));
  const usd = api.caption({ ...d, eur: null });
  check('Fehlender Euro-Kurs: USD statt erfundener Euro-Werte', usd.includes('💵 Netto: <b>+49,94 USD</b>') && usd.includes('📈 Max. Gewinn: +61,26 USD') && !usd.includes('€'));
  const noStats = api.caption({ ...d, stats: null });
  check('Ohne Kerzen: Maximalwerte als nicht berechnet, keine erfundenen Nullwerte', noStats.includes('ohne Kerzendaten nicht berechnet') && !noStats.includes('Max. Verlust: 0'));
  const long = api.caption({ ...d, sym: '<&>'.repeat(700) + 'USDT' });
  check('Lange Daten: HTML-sicher auf 1024 begrenzt, Uhrzeit erhalten', long.length <= 1024 && long.endsWith(text.split('\n').at(-1)) && (long.match(/<b>/g) || []).length === (long.match(/<\/b>/g) || []).length && !/&[^;\s]*$/.test(long));
  const photo = new Blob(['LOCAL_IMAGE'], { type: 'image/png' }), ok = { status: 200, body: { ok: true, result: { message_id: 7 } } };
  replies = [ok]; check('Ein Bild mit ausführlicher HTML-Beschriftung', await api.post(photo, d) === 7 && calls.length === 1 && calls[0].caption === text && calls[0].parse_mode === 'HTML' && calls[0].photo.name === 'trade.png' && calls[0].message_thread_id === '42');
  calls.length = 0; replies = [{ status: 400, body: { ok: false, error_code: 400, description: "Bad Request: can't parse entities" } }, ok];
  await api.post(photo, d);
  check('Format abgelehnt: einmal derselbe Text als Klartext, dasselbe Foto und Ziel', calls.length === 2 && calls[1].caption === plain && !calls[1].parse_mode && calls[0].chat_id === calls[1].chat_id && calls[0].message_thread_id === calls[1].message_thread_id && await calls[0].photo.text() === await calls[1].photo.text());
  for (const status of [400, 429, 503]) {
    calls.length = 0; replies = [{ status, body: { ok: false, error_code: status, description: 'LOCAL_REJECTION' } }]; let kind;
    try { await api.post(photo, d); } catch (e) { kind = e.kind; }
    check(`${status} ohne Formatfehler: keine zusätzliche Nachricht`, kind === 'fail' && calls.length === 1);
  }
  calls.length = 0; replies = [new Error('LOCAL_LOST_RESPONSE')]; let kind;
  try { await api.post(photo, d); } catch (e) { kind = e.kind; }
  check('Unklare Zustellung: keine automatische zweite Sendung', kind === 'lost' && calls.length === 1);
  calls.length = 0; online = false; kind = null; try { await api.post(photo, d); } catch (e) { kind = e.kind; }
  check('Offline: kein Versand', kind === 'offline' && !calls.length);
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
