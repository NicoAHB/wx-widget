// 3.55.0: tatsächliche Kerzenoptik, Restzeit, Demo-Fills und Trennung von echten Positionen.
const h = require('./harness'); let pass = 0, fail = 0; const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };
(async () => { let browser;
  try {
    await h.setup(); await h.ctl('/orderflow?mult=100'); await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=BTCUSDT&price=64000'); browser = await h.launch(); const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, isMobile: true, hasTouch: true }), page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => window.__pdf1?.view.quote()?.fresh && document.querySelectorAll('.of-price-value').length === 40 && [...document.querySelectorAll('.of-price-value')].every(n => n.textContent !== '—'));
    check('40 reale OHLC-Werte und zehn feste Kerzengrafiken', await page.evaluate(() => document.querySelectorAll('.of-candle-svg').length === 10 && [...document.querySelectorAll('.of-price-value')].every(n => n.textContent !== '—')));
    await page.waitForFunction(() => { const row = document.querySelector('.of-block[data-interval="1m"] .of-running'), c = __pdf1.view.state.series['1m'].at(-1); return row.querySelector('.of-candle').dataset.tone === (c.c > c.o ? 'up' : c.c < c.o ? 'down' : 'neutral'); });
    check('Grafik entspricht gelieferten OHLC, keine Volumenkerze', await page.evaluate(() => { const row = document.querySelector('.of-block[data-interval="1m"] .of-running'), c = __pdf1.view.state.series['1m'].at(-1); return row.querySelector('.of-candle').dataset.tone === (c.c > c.o ? 'up' : c.c < c.o ? 'down' : 'neutral') && Number(row.querySelector('rect').getAttribute('height')) >= 1 && row.querySelectorAll('.of-price-value').length === 4; }));
    check('Beide Restzeiten sichtbar statt Datenalter', await page.evaluate(() => [...document.querySelectorAll('.of-countdown')].every(n => /^Rest \d\d:\d\d$/.test(n.textContent)) && [...document.querySelectorAll('.of-quality')].every(n => n.hidden && !n.textContent)));
    const oldTimer = await page.textContent('.of-countdown'); await page.waitForFunction(old => document.querySelector('.of-countdown').textContent !== old, oldTimer); check('Timer läuft durch bestehenden Sekundentakt', await page.textContent('.of-countdown') !== oldTimer);
    check('Demo standardmäßig zugeklappt', await page.evaluate(() => !document.getElementById('of-demo').open)); await page.click('#of-demo>summary');
    const original = await page.evaluate(() => JSON.stringify([__g05.state.positions, __g05.state.trades, __g05.state.demoPositions, __g05.state.demoTrades]));
    await page.fill('#of-demo-margin', '100'); await page.fill('#of-demo-leverage', '5'); await page.click('#of-demo-price');
    await page.waitForFunction(() => !document.getElementById('of-demo-close').hidden);
    const opened = await page.evaluate(() => __g05.backupPayload().prefs['scalpdesk.orderflow-demo.v1'].active[0]);
    check('Live-Einstieg aus Vorauswahl, Einsatz/Hebel ergeben Menge', opened.entry === 64000 && opened.source === 'spot' && opened.margin === 100 && opened.leverage === 5 && Math.abs(opened.qty * opened.entry - 500) < 1e-6);
    check('Doppelkauf gesperrt, Felder während Trade unveränderlich', await page.evaluate(() => document.getElementById('of-demo-price').disabled && document.getElementById('of-demo-margin').disabled && document.getElementById('of-demo-leverage').disabled));
    await h.ctl('/set?symbol=BTCUSDT&price=65000'); await page.waitForFunction(() => document.getElementById('of-demo-result').dataset.tone === 'up');
    check('Gewinn mit Hebel live, grüner Verkaufsknopf', await page.evaluate(() => /Gewinn \+/.test(document.getElementById('of-demo-result').textContent) && document.getElementById('of-demo-close').dataset.tone === 'up'));
    await page.click('#of-demo-close'); await page.waitForFunction(() => document.getElementById('of-demo-close').hidden);
    const done = await page.evaluate(() => __g05.backupPayload().prefs['scalpdesk.orderflow-demo.v1'].closed.at(-1));
    check('Verkauf nimmt aktuellen Klickkurs, gebührenfreies Ergebnis realisiert', done.exit > done.entry && done.closedAt >= done.openedAt && /realisiert/.test(await page.textContent('#of-demo-result')));
    await page.click('#of-demo-price'); await h.ctl('/set?symbol=BTCUSDT&price=63000'); await page.waitForFunction(() => document.getElementById('of-demo-result').dataset.tone === 'down');
    check('Verlust rot und klarer Realisieren-Button', await page.evaluate(() => document.getElementById('of-demo-close').dataset.tone === 'down' && /Verlust realisieren/.test(document.getElementById('of-demo-close').textContent)));
    const active = await page.evaluate(() => JSON.stringify(__g05.backupPayload().prefs['scalpdesk.orderflow-demo.v1'].active)); await page.reload(); await page.waitForFunction(() => window.__pdf1?.view.quote()?.fresh); await page.waitForFunction(() => document.getElementById('of-demo').open);
    check('Neustart und persönliche Sicherung erhalten den offenen Trade', await page.evaluate(raw => JSON.stringify(__g05.backupPayload().prefs['scalpdesk.orderflow-demo.v1'].active) === raw, active));
    // Erst den wiederhergestellten Live-Zustand samt Zeichnung abwarten; eine noch gesperrte Startansicht darf nicht als Kursverlust gelten.
    await page.waitForFunction(() => __pdf1.view.quote()?.fresh && !document.getElementById('of-demo-close').disabled);
    await h.ctl('/blockws?on=1'); await page.waitForFunction(() => document.getElementById('of-demo-close').disabled, null, { timeout: 10000 });
    const expired = await page.evaluate(() => ({ fresh: __pdf1.view.quote().fresh, disabled: document.getElementById('of-demo-close').disabled, ageText: /Daten veraltet|vor \d+ s/.test(document.getElementById('orderflow-panel').innerText) }));
    check('Fehlender Livekurs sperrt Ausstieg, keine Datenalter-Anzeige', !expired.fresh && expired.disabled && !expired.ageText, JSON.stringify(expired));
    await h.ctl('/blockws?on=0'); await page.waitForFunction(() => !document.getElementById('of-demo-close').disabled); await page.click('#of-demo-close');
    check('Echte/alte Demo-Positionen und Journal vollständig unverändert', await page.evaluate(raw => JSON.stringify([__g05.state.positions, __g05.state.trades, __g05.state.demoPositions, __g05.state.demoTrades]) === raw, original));
    for (const [width, height] of [[320, 844], [390, 844], [768, 1024], [1024, 768]]) { await page.setViewportSize({ width, height });
      check(`${width}px: Kerzen/Kurse/Demo ohne Überlauf`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && [...document.querySelectorAll('.of-price-value,.of-buy,.of-sell,.of-delta')].every(n => n.scrollWidth <= n.clientWidth + 1)));
    }
    check('Touchflächen für Demo mindestens 44 px', await page.evaluate(() => [...document.querySelectorAll('.of-demo input,.of-demo select,.of-demo button:not([hidden]),.of-demo>summary')].every(n => n.getBoundingClientRect().height >= 44)));
    check('Keine JavaScript-Fehler', errors.length === 0, errors.join(' | ')); await ctx.close(); console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
  } catch (e) { console.error('Abbruch', e); process.exitCode = 1; } finally { if (browser) await browser.close(); await h.teardown(); }
})();
