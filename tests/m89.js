// Native Muster-Oberfläche und eigener Worker; API-Daten sind feste öffentliche Attrappen.
const h = require('./harness');
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
(async () => {
  await h.setup(); const browser = await h.launch({ workspace: 'fresh' });
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await ctx.route(/https:\/\/(?:data-api\.binance\.vision|api\.binance\.com|fapi\.binance\.com)\/.*klines\?/, async route => {
      const u = new URL(route.request().url()); if (!u.searchParams.has('startTime')) return route.continue();
      const ms = { '5m': 300000, '15m': 900000, '1h': 3600000, '4h': 14400000 }[u.searchParams.get('interval')]; if (!ms) return route.continue();
      const from = +u.searchParams.get('startTime'), to = +u.searchParams.get('endTime'), rows = []; const end = Math.min(to + 1, from + 1000 * ms);
      for (let t = from; t < end; t += ms) { const i = Math.floor(t / ms) % 30, hammer = i === 10, target = i === 11; rows.push([t, hammer ? '101.6' : '101.7', target ? '106' : hammer ? '101.8' : '102', '100', target ? '105' : '101.7', hammer ? '500' : '100', t + ms - 1]); }
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(rows) });
    });
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => window.__muster && __g05.state.loadedSymbol === 'BTCUSDT');
    await page.click('[data-workspace-target="ind"]'); await page.locator('#muster-bot > summary').click();
    check('Eigenes klappbares Panel in Analysen übernimmt gewählten BTC', (await page.locator('.muster-context').innerText()).includes('BTC/USDT') && await page.locator('#muster-capital').isVisible());
    const count = await page.evaluate(() => document.querySelectorAll('.muster-field').length);
    check('Alle 35 Strategieparameter (3.68.0: + Hebel, Größe, Short, Konfluenz, PO3) sind eindeutig mit Label und i verknüpft', count === 35 && await page.evaluate(() => [...document.querySelectorAll('.muster-field')].every(f => f.querySelector('label').htmlFor === f.querySelector('input,select').id && f.querySelector('.muster-info'))));
    await page.locator('.muster-field').filter({ has: page.locator('#muster-hammerEntry') }).locator('.muster-info').click();
    check('Tippen öffnet Anfängererklärung und Kerzen-SVG', await page.locator('.muster-help').isVisible() && await page.locator('.muster-help svg').count() === 1 && (await page.locator('.muster-help').innerText()).includes('Beispiel'));
    await page.locator('.muster-help > button').click(); check('X schließt Popup', !(await page.locator('.muster-help').isVisible()));
    await page.locator('.muster-field').filter({ has: page.locator('#muster-engulfEntry') }).locator('.muster-info').click(); await page.mouse.click(5, 5); check('Tippen neben Popup schließt es ohne Hover', !(await page.locator('.muster-help').isVisible()));
    await page.fill('#muster-days', '2'); await page.selectOption('#muster-hammerEntry', 'close'); await page.selectOption('#muster-engulfEntry', 'instant');
    await page.getByRole('button', { name: 'Einzeltest · meine Einstellungen', exact: true }).click(); await page.waitForFunction(() => document.querySelectorAll('.muster-results tbody tr').length === 1, null, { timeout: 90000 });
    check('Einzeltest behält getrennte Hammer-/Engulfing-Einstiege', (await page.locator('.muster-results tbody').innerText()).includes('Schlusskurs/Sofort'));
    await page.getByRole('button', { name: 'Backtest · alle 33 Varianten', exact: true }).click(); await page.waitForFunction(() => document.querySelectorAll('.muster-results tbody tr').length === 33, null, { timeout: 150000 });
    check('Echter Worker berechnet alle 33 Varianten (27 Hammer/Engulfing + Konfluenz/PO3 je Ebene)', await page.locator('.muster-results tbody tr').count() === 33 && (await page.locator('.muster-results tbody').innerText()).includes('Konfluenz') && (await page.locator('.muster-results tbody').innerText()).includes('Power of Three'));
    check('Ergebnis-Spalten haben antippbare Erklärungen (inkl. Liquidationen)', await page.locator('.muster-results th .muster-info').count() === 10);
    await page.locator('.muster-results th').filter({ hasText: 'Trades' }).locator('button').first().click(); await page.locator('.muster-results tbody tr').first().click(); check('Sortieren/Zeile antippen zeigt Equity-Kurve', await page.locator('.muster-equity path').count() === 1 && (await page.locator('.muster-warning').innerText()).includes('100'));
    // 3.68.0: Modelle mit Erklärung, passende Felder, Hebelhinweis, verständliches Telegram-Feld
    await page.selectOption('#muster-pattern', 'po3'); await page.waitForTimeout(50);
    check('PO3 gewählt: Erklärung sichtbar, Einstiegsmodi ausgeblendet, Short-Haken sichtbar', (await page.locator('.muster-model-note span').first().innerText()).includes('Power of Three') && await page.locator('#muster-hammerEntry').isHidden() && await page.locator('#muster-allowShort').isVisible());
    await page.locator('.muster-model-note .muster-info').first().click(); check('Modell-i erklärt alle Modelle mit PO3-Skizze', (await page.locator('.muster-help').innerText()).includes('Konfluenz (K)') && await page.locator('.muster-help svg').count() === 1); await page.locator('.muster-help > button').click();
    await page.fill('#muster-leverage', '10'); await page.dispatchEvent('#muster-leverage', 'change'); await page.selectOption('#muster-sizing', 'margin');
    check('Hebel 10: Liquidationshinweis, Einsatz-Feld statt Risiko-Feld, Untertitel mit Hebel', (await page.locator('#muster-bot').innerText()).includes('etwa 9,5 % gegen den Trade') && await page.locator('#muster-marginPercent').isVisible() && await page.locator('#muster-riskPercent').isHidden() && (await page.locator('#muster-bot .muster-body > p.muted').first().innerText()).includes('Hebel 10×'));
    const tg = await page.evaluate(() => { const c = document.getElementById('muster-paper-telegram').getBoundingClientRect(), l = document.querySelector('label[for=muster-paper-telegram]').getBoundingClientRect(); return { w: c.width, h: c.height, lw: l.width, lh: l.height, beside: l.left > c.right && Math.abs((l.top + l.bottom) / 2 - (c.top + c.bottom) / 2) < 20 }; });
    check('Telegram-Ankreuzfeld 22 px mit waagrechter Beschriftung daneben (kein senkrechter Text)', tg.w === 22 && tg.h === 22 && tg.beside && tg.lw > 150 && tg.lh < 50 && (await page.locator('.muster-telegram-hint').innerText()).includes('Trades'));
    await page.selectOption('#muster-pattern', 'both'); await page.fill('#muster-leverage', '1'); await page.dispatchEvent('#muster-leverage', 'change'); await page.selectOption('#muster-sizing', 'risk');
    await page.getByRole('button', { name: 'Demo starten', exact: true }).click(); await page.waitForFunction(() => __muster.paper.state.book?.active && !__muster.paper.state.busy);
    check('Demo grün und Start-Coin sichtbar', await page.locator('.muster-run-status.running').count() === 1 && (await page.locator('.muster-run-status').innerText()).includes('BTC/USDT'));
    await page.evaluate(() => __intervals.setMarket('LTCUSDT', '15m')); await page.waitForFunction(() => __g05.state.loadedSymbol === 'LTCUSDT' && !__g05.state.busy);
    check('Chartwechsel zu LTC verändert gestarteten BTC-Lauf nicht', await page.evaluate(() => __muster.paper.state.book.symbol === 'BTCUSDT') && (await page.locator('.muster-run-status').innerText()).includes('BTC/USDT'));
    await page.getByRole('button', { name: 'Demo beenden', exact: true }).click(); await page.waitForFunction(() => __muster.paper.state.book?.active === false); check('Roter Beenden-Button stoppt nur diese Demo', !(await page.evaluate(() => __muster.paper.state.book.active)) && await page.locator('.muster-stop').count() === 1);
    const personal = await page.evaluate(() => JSON.stringify({ p: __g05.state.positions, t: __g05.state.trades })); await page.getByRole('button', { name: 'Demo-Trade-Daten löschen', exact: true }).click(); await page.waitForFunction(() => __muster.paper.state.book === null); check('Demo löschen erhält persönliche Positionen/Trades', await page.evaluate(() => __muster.paper.state.book === null) && await page.evaluate(() => JSON.stringify({ p: __g05.state.positions, t: __g05.state.trades })) === personal);
    await page.evaluate(() => document.querySelectorAll('#muster-bot details.muster-group').forEach(d => d.open = true));
    for (const width of [320, 390, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(100); check(`${width}px: Felder und Labels bleiben im Panel, Tabelle separat scrollbar`, await page.evaluate(() => { const root = document.querySelector('#muster-bot').getBoundingClientRect(); return [...document.querySelectorAll('.muster-field')].filter(n => n.offsetWidth).every(n => { const r = n.getBoundingClientRect(); return r.left >= root.left - 1 && r.right <= root.right + 1 && n.scrollWidth <= n.clientWidth + 1; }); })); }
    check('Kein JavaScript-Absturz, alte Chart-/Buchfunktionen weiter vorhanden', errors.length === 0 && await page.evaluate(() => !!__g05 && !!__g09 && !document.getElementById('ki-signal-panel'))); await ctx.close();
  } finally { await browser.close(); await h.teardown(); }
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
