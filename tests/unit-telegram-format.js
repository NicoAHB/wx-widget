// 3.63.0: Format, USD, HTML-Grenzen und eindeutiger Klartext-Rückfall; keine realen Bots.
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
(async () => {
  const F = await import('../shared/telegram-format.mjs');
  const S = await import('../server/scalpdesk-247.mjs');
  check('Preisstufen und deutsches Zahlenformat', [84862.79, 5.2, .02345, .00000123].map(F.telegramPrice).join('|') === '84.862,79|5,2000|0,02345|0,00000123');
  check('Echtes Minus, Vorzeichen und zwei Prozentstellen', F.telegramPercent(-.74) === '−0,74 %' && F.telegramPercent(2.25) === '+2,25 %');
  check('Dynamischer HTML-Text vollständig escaped', F.escapeTelegram('A&B <X>') === 'A&amp;B &lt;X&gt;');
  check('Null, NaN und None erscheinen nicht', !/NaN|None|undefined/.test(F.formatMessage('alarm', { symbol: 'BTCUSDT', price: NaN, level: null, note: 'None' })));
  const at = Date.UTC(2026, 9, 11, 12), fixture = { symbol: 'BTCUSDT', pattern: 'Doppel-Boden', timeframe: '2h', market: 'Futures', status: 'Ausbruch bestätigt', entry: 100, target: 105, invalid: 90, quality: 84, learned: { n: 7, auf: 5, ab: 2 }, model: 'pat-1', at, timezone: 'Europe/Berlin' };
  for (const dir of ['bull', 'bear']) {
    const text = F.formatMessage('pattern', { ...fixture, dir });
    // 3.71.0: Kurztext der Signalkarte – Stop statt „Ungültig bei“, Musterqualität statt Regelgüte, Erlernt erst ab 10 Fällen, Datum im Fuß
    check(`${dir}: Richtung, USD, Ziel, Stop, Chance/Risiko, Musterqualität, „noch nicht bewertet (7/10 Fälle)“ und Datum`, text.includes(dir === 'bull' ? '🟢⬆️' : '🔴⬇️') && text.includes('💰 Einstieg: <code>100,0000 USD</code>') && text.includes('🎯 Ziel: <b>105,0000 USD</b> (+5,00 %)') && text.includes('🛑 Stop: <code>90,0000 USD</code> (−10,00 %)') && text.includes('⚖️ Chance/Risiko: 0,50 : 1') && text.includes('🧠 Musterqualität: 84 % · keine Erfolgswahrscheinlichkeit') && text.includes('📚 Erlernt: noch nicht bewertet (7/10 Fälle)') && !/zu wenig Daten|Regelgüte|Ungültig bei/.test(text) && /🕐 11\.10\.2026 · 14:00:00 · Modell pat-1$/.test(text));
  }
  const zero = F.formatMessage('pattern', { ...fixture, entry: 0, invalid: 0 });
  check('Division durch null: keine erfundene CRV/Prozentzahl', !zero.includes('Chance/Risiko') && !zero.includes('Infinity') && !zero.includes('NaN'));
  const pulse = F.formatMessage('pulse', { coin: 'BTC', change: -.95, minutes: 5, price: 84862.79, threshold: .4, reason: 'stark <für> 06 & 07 Uhr', others: [['NEAR', .5], ['QNT', -2.25], ['ETH', NaN]], at });
  check('Puls: Prozentvorschau, Schwellenfaktor, Feuer und Betrags-Sortierung', pulse.split('\n')[0].includes('−0,95 %') && pulse.includes('2,4× Schwelle') && pulse.includes('🔥') && pulse.indexOf('QNT ') < pulse.indexOf('NEAR') && pulse.includes('<pre>🔴 QNT   −2,25 %'));
  check('Puls: Preis USD und Begründung kursiv escaped', pulse.includes('<code>84.862,79 USD</code>') && pulse.includes('<i>stark &lt;für&gt; 06 &amp; 07 Uhr</i>'));
  check('Schwelle null: kein Infinity', !F.formatMessage('pulse', { change: 1, threshold: 0 }).includes('Infinity'));
  const alarm = F.formatMessage('alarm', { ...fixture, direction: 'below', price: 99, level: 100 });
  check('Alarm: negativer absoluter und prozentualer Abstand', alarm.includes('−1,0000 USD (−1,00 %)') && alarm.includes('⭐ <b>100,0000 USD</b> ⭐ (unter)'));
  for (const limit of [.01, 20, 200]) { const text = F.formatMessage('day', { pnl: -25, limit, at }); check('Geldlimit ' + limit + ' ist kein Zeichenlimit: vollständige Tagesmeldung', text.includes('TAGES-VERLUSTLIMIT ERREICHT') && text.includes('Heute realisiert: −25,00 USD') && text.includes('Limit: ⭐ <b>' + F.telegramNumber(limit) + ' USD</b> ⭐') && !text.includes('…') && /^🕐 /.test(text.split('\n').at(-1))); }
  const trade = F.formatMessage('trade', { symbol: 'ETHUSDT', side: 'long', pnl: -12.5, entry: 1000, exit: 990, percent: -1.25, reasons: 'Stop <SL>', at });
  check('Trade: Verlustvorschau, Codepreise und escaped Grund', trade.startsWith('<b>🔴 VERLUST') && trade.includes('<code>1.000,00 USD</code>') && trade.includes('−1,25 %') && trade.includes('Stop &lt;SL&gt;'));
  for (const type of ['position', 'pnl', 'day', 'news', 'trade', 'backup', 'signal', 'po3', 'notice']) {
    const text = F.formatMessage(type, { ...fixture, direction: 'bull', price: 101, level: 100, hit: 'tp', pnl: 10, limit: 100, headline: 'A&B', events: [{ title: '<Termin>' }], lines: ['<Daten>'], at });
    check(`${type}: HTML, fehlende Werte und Uhrzeit am Ende`, text.includes('<b>') && !/NaN|None|undefined|24\/7-Dienst/.test(text) && /^🕐 /.test(text.split('\n').at(-1)) && text.length <= 4096);
  }
  const handover = F.formatMessage('handover', { headline: '✅ Dienst hat übernommen', items: [{ label: 'Kurs-Alarm A&B', direction: 'above', level: 100 }, { label: 'ETH Long', stop: 90, target: 110 }], lines: ['Auch bei geschlossener App'], at });
  check('Dienstbestätigung: Alarm/Ziel fett mit Sternen, Stop kopierbar und dynamischer Text escaped', handover.includes('A&amp;B') && handover.includes('⭐ <b>Alarm-Level: 100,0000 USD</b> ⭐ (auf/über)') && handover.includes('<code>90,0000 USD</code>') && handover.includes('⭐ <b>Take-Profit: 110,0000 USD</b> ⭐') && /^🕐 /.test(handover.split('\n').at(-1)));
  const long = F.formatMessage('notice', { headline: 'Länge', lines: ['<&>😀'.repeat(2000)], at });
  check('4096-Zeichen-Grenze: Tags/Entities bleiben ganz und Uhrzeit erhalten', long.length <= 4096 && !/&[^;\s]*$/.test(long) && (long.match(/<b>/g) || []).length === (long.match(/<\/b>/g) || []).length && /^🕐 /.test(long.split('\n').at(-1)));
  check('Bildbeschriftung maximal 1024 Zeichen', F.telegramFields(long, { limit: 1024 }).text.length <= 1024);
  // Die tatsächliche Multipart-Funktion prüfen, nicht eine manuelle Kopie des Wrappers.
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '../weather-widget-v2.html'), 'utf8'), source = app.slice(app.indexOf('async function tgPost('), app.indexOf('\nconst tgbForm', app.indexOf('async function tgPost(')));
  let multipart;
  const post = new Function('telegramFields', 'formatMessage', 'telegramPlain', 'telegramFormatRejected', 'TELEGRAM_CAPTION_LIMIT', 'fetch', source + '\nreturn tgPost;')(F.telegramFields, F.formatMessage, F.telegramPlain, F.telegramFormatRejected, F.TELEGRAM_CAPTION_LIMIT, async (_url, options) => { multipart = options.body; return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 1 } }) }; });
  for (const media of [false, true]) {
    const fd = new FormData(); fd.set(media ? 'media' : 'caption', media ? JSON.stringify({ type: 'document', media: 'attach://file', caption: long }) : long);
    await post(media ? 'editMessageMedia' : 'sendDocument', fd, false, 'LOCAL_ONLY');
    const caption = media ? JSON.parse(multipart.get('media')).caption : multipart.get('caption');
    check('App-Multipart ' + (media ? 'Medienwechsel' : 'Datei') + ': lange HTML-Beschriftung auf 1024 begrenzt, Uhrzeit erhalten', caption.length <= 1024 && caption.includes('…') && /^🕐 /.test(caption.split('\n').at(-1)) && (media ? JSON.parse(multipart.get('media')).parse_mode : multipart.get('parse_mode')) === 'HTML');
  }
  check('Klartext entpackt nur Format-Tags und korrekt einmal Entities', F.telegramPlain('<b>A&amp;B</b> &lt;x&gt; &amp;lt;') === 'A&B <x> &lt;');
  check('Fallback ausschließlich explizite Telegram-Formatablehnung', F.telegramFormatRejected(400, "Bad Request: can't parse entities") && !F.telegramFormatRejected(400, 'chat not found') && !F.telegramFormatRejected(429, "can't parse entities") && !F.telegramFormatRejected(0, 'timeout'));
  const fetchBefore = global.fetch, calls = [], svc = Object.create(S.Watcher.prototype); Object.assign(svc, { token: 'LOCAL_ONLY', now: () => at, secret: x => x });
  try {
    global.fetch = async (_url, options) => { const body = JSON.parse(options.body); calls.push(body); return calls.length === 1 ? { ok: false, status: 400, json: async () => ({ ok: false, error_code: 400, description: "can't parse entities" }) } : { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 1 } }) }; };
    await svc.tg('sendMessage', { chat_id: '1', text: alarm });
    check('Dienst sendet HTML, bei Formatfehler einmal dieselbe Nachricht als Klartext', calls.length === 2 && calls[0].parse_mode === 'HTML' && !calls[1].parse_mode && calls[1].text === F.telegramPlain(calls[0].text) && calls[0].chat_id === calls[1].chat_id);
    calls.length = 0; global.fetch = async (_url, options) => { calls.push(JSON.parse(options.body)); throw Object.assign(new Error('weg'), { cause: { code: 'ECONNRESET' } }); };
    let lost = false; try { await svc.tg('sendMessage', { chat_id: '1', text: alarm }); } catch (e) { lost = e.lost; }
    check('Verlorene Antwort: keine zusätzliche Klartext-Nachricht', lost && calls.length === 1);
  } finally { global.fetch = fetchBefore; }
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
