// Verbindungstest: erreichbare öffentliche Quellen und bewusst gesperrte WebSockets.
const h = require('./harness'); let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const anonymous = (url, status) => url === 'https://api.telegram.org/bot0:status-check/getMe' && status === 401;
(async () => {
  await h.setup(); const b = await h.launch(), errors = [], consoleErrors = [], responses = [], requests = []; let blocked = false;
  try {
    const p = await b.newPage();
    // Das Testprojekt hat kein Favicon; dessen Browserabruf ist keine Verbindungsprüfung.
    await p.route('**/favicon.ico', route => route.fulfill({ status: 204 }));
    // 3.67.0: Bitget-Ticker (KI-Signale/Trading-Bot) mit 400 ms vorgehender Bitget-Uhr; die Seite zeigt die Abweichung.
    await p.route('https://api.bitget.com/**', route => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ code: '00000', msg: 'success', requestTime: Date.now() + 400, data: [{ symbol: 'BTCUSDT', lastPr: '64000.5', bidPr: '64000', askPr: '64001', markPrice: '64000.4', ts: String(Date.now() + 400) }] }) }));
    p.on('pageerror', e => errors.push(e.message));
    p.on('request', r => requests.push(r.url()));
    p.on('response', r => { if (r.status() >= 400) responses.push({ url: r.url(), status: r.status() }); });
    p.on('console', m => { if (!['error', 'warning'].includes(m.type())) return;
      const text = m.text(), url = m.location().url, status = Number(/status of (\d+)/.exec(text)?.[1]);
      if (anonymous(url, status)) return;
      if (blocked && (/WebSocket.*wss:\/\/[^ ]*binance\.(com|vision).*failed/.test(text)
        || status === 403 && /^wss:\/\/[^/]*binance\.(com|vision)\//.test(url))) return;
      consoleErrors.push({ text, url });
    });
    await p.goto(h.URL_BASE + '/status-check.html');
    await p.waitForFunction(() => !document.getElementById('run').disabled, null, { timeout: 20000 });
    const first = await p.evaluate(() => ({ verdict: document.getElementById('verdict').textContent,
      live: [...document.querySelectorAll('#list-live li')].map(li => li.dataset.state),
      notify: [...document.querySelectorAll('#list-notify li')].map(li => ({ state: li.dataset.state, text: li.querySelector('.msg').textContent })) }));
    check('Alle drei Live-Quellen erreichbar, erfolgreiches Gesamturteil', first.verdict === 'Alles erreichbar, auch die Live-Streams.' && first.live.length === 3 && first.live.every(x => x === 'ok'));
    const bot = await p.evaluate(() => [...document.querySelectorAll('#list-bot li')].map(li => ({ state: li.dataset.state, text: li.querySelector('.msg').textContent })));
    check('Bitget-Kurs für KI-Signale/Trading-Bot geprüft, Uhrabweichung angezeigt (+0,4 s)', bot.length === 1 && bot[0].state === 'ok' && /Uhr Gerät ↔ Bitget \+0,[3-5] s/.test(bot[0].text), JSON.stringify(bot));
    check('Anonyme Benachrichtigungsprüfung: erwartete HTTP 401 korrekt als erreichbar erklärt', first.notify.length === 1 && first.notify.every(x => x.state === 'ok' && /ohne Zugangsdaten erwartet/.test(x.text)));
    blocked = true; await h.ctl('/blockws?on=1'); await p.click('#run');
    await p.waitForFunction(() => !document.getElementById('run').disabled, null, { timeout: 20000 });
    const second = await p.evaluate(() => ({ verdict: document.getElementById('verdict').textContent, advice: document.getElementById('advice').textContent,
      live: [...document.querySelectorAll('#list-live li')].map(li => li.dataset.state), rest: [...document.querySelectorAll('#list-spot li,#list-futures li')].map(li => li.dataset.state) }));
    check('Absichtlich gesperrte Streams: alle drei rot, REST erreichbar und 15-Sekunden-Rückfall erklärt', second.verdict === 'Abrufe funktionieren, Live-Streams nicht.' && second.live.length === 3 && second.live.every(x => x === 'bad') && second.rest.every(x => x === 'ok') && /alle 15 Sekunden per REST/.test(second.advice));
    check('HTTP-Fehler ausschließlich vom gezielt anonym geprüften Telegram-Endpunkt', responses.length === 2 && responses.every(x => anonymous(x.url, x.status)), JSON.stringify(responses));
    check('Discord vollständig aus der Diagnose entfernt: keine Anzeige und kein Abruf', !/discord/i.test(await p.locator('body').textContent()) && !requests.some(url => /discord\.com/i.test(url)));
    check('Keine JavaScript-Fehler', !errors.length, errors.join('; '));
    check('Keine unerwarteten Konsolenfehler; erwartete Antworten nach URL/Status gebunden', !consoleErrors.length, JSON.stringify(consoleErrors));
  } finally { await b.close(); await h.teardown(); }
  console.log(`${pass}/${pass + fail} bestanden`); console.log(fail ? 'Fehler' : 'no errors'); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
