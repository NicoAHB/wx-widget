// PDF Etappe 1: tatsächlicher Worker/REST, Spot-Schutz, Frische, feste Zeilen und iPad-Anordnung.
const h = require('./harness'), fs = require('fs'); let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };
(async () => { let browser;
  try {
    await h.setup(); await h.ctl('/orderflow?mult=100'); browser = await h.launch();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(h.URL_BASE + '/weather-widget-v2.html');
    await page.waitForFunction(() => window.__pdf1 && ['1m', '1h'].every(iv => document.querySelector(`.of-block[data-interval="${iv}"]`).dataset.quality === 'live'), null, { timeout: 20000 });
    await page.waitForFunction(() => __g05.state.sourceFor === 'BTCUSDT' && !__g05.state.busy && __g05.state.prices.BTCUSDT?.live);
    check('Zwei Blöcke mit je vier geschlossenen Kerzen und jetzt', await page.locator('.of-block').count() === 2 && await page.locator('.of-row:not(.of-legend)').count() === 10 && await page.locator('.of-running').count() === 2);
    check('Bestehende Chartleisten bleiben gemeinsam beim Chart, Zusatzpanel daneben oder danach', await page.evaluate(() => { const pane = document.querySelector('.of-chart-pane'); return ['chart', 'fib-strip', 'lmap-strip', 'wh-strip'].every(id => pane.contains(document.getElementById(id))) && pane.contains(document.querySelector('.chart-footer')) && !pane.contains(document.getElementById('orderflow-panel')); }));
    check('Futures-Quelle ausdrücklich genannt, Hauptchart weiterhin Spot', /BTCUSDT.*Binance USDT-Futures/.test(await page.textContent('.of-source')) && await page.evaluate(() => __g05.state.source === 'spot'));
    check('Worker liefert echtes Taker-/Quotevolumen in beiden Zeitebenen', await page.evaluate(() => ['1m', '1h'].every(iv => { const c = __pdf1.view.state.series[iv].at(-1); return c.source === 'ws' && c.usdt && c.coins; })));
    check('100-facher Futures-Kurs überschreibt Spot weder im Chart noch im Preisbestand', await page.evaluate(() => __pdf1.view.state.series['1m'].at(-1).c > 6000000 && __g05.state.candles.at(-1).close < 100000 && __g05.state.prices.BTCUSDT.price < 100000));
    check('Zusätzlicher Futures-Markt zählt nicht zum bestehenden globalen Feed', await page.evaluate(() => !__pdf1.live.need.has('futures') && __pdf1.live.need.has('spot')));
    const conns = (await h.ctl('/state')).conns.filter(c => /fstream/.test(c.host));
    check('Eine gemeinsame Futures-Verbindung, 1m/1h einmal, korrekter /market/-Pfad', conns.length === 1 && conns[0].path.startsWith('/market/') && conns[0].streams.filter(s => s === 'btcusdt@kline_1m').length === 1 && conns[0].streams.includes('btcusdt@kline_1h'));
    const log = await h.ctl('/log'), requests = log.filter(e => e.path === '/fapi/v1/klines');
    check('Start-Historie begrenzt: 30 Minuten, 5 Stunden', requests.some(e => e.q?.limit === '30' && e.q.interval === '1m') && requests.some(e => e.q?.limit === '5' && e.q.interval === '1h'), JSON.stringify(requests.map(e => e.q)));
    await page.evaluate(() => { window.m74Rows = [...document.querySelectorAll('.of-row')]; window.m74Height = document.getElementById('orderflow-panel').offsetHeight; });
    await page.locator('.of-info>summary').click(); check('Info erklärt Taker, Delta und konkrete nächste Handlung', /Taker.*Delta.*Trend, Stop-Loss und Gebühren prüfen/s.test(await page.textContent('.of-explanation')));
    await page.locator('.of-info>summary').click(); await page.selectOption('#of-unit', 'coins');
    check('Einheitenwahl gespeichert und im persönlichen Backup enthalten', await page.evaluate(() => __g05.backupPayload().prefs['scalpdesk.orderflow.v1'].unit === 'coins' && __pdf1.view.state.unit === 'coins'));
    check('Coinwerte entsprechen gelieferten Mengen, nicht Quotevolumen', await page.evaluate(() => { const c = __pdf1.view.state.series['1m'].at(-1); return c.usdt.total / Math.max(c.coins.total, 1) > 100000; }));
    await page.selectOption('#of-unit', 'usdt');
    // Fehlende Quote wird über den echten Futures-Worker geliefert; kein Wechsel auf geschätzte Coins.
    await h.ctl('/orderflow?mult=100&missing=1');
    await page.waitForFunction(() => __pdf1.view.state.series['1m'].at(-1).usdt === null && document.querySelector('.of-block[data-interval="1m"]').dataset.quality === 'incomplete');
    check('Fehlende ausgewählte Quote: Striche und unvollständig, kein grünes Signal', await page.evaluate(() => document.querySelector('.of-block[data-interval="1m"]').dataset.quality === 'incomplete' && document.querySelector('.of-block[data-interval="1m"] .of-running .of-delta').textContent === '—'));
    await h.ctl('/orderflow?mult=100');
    await page.waitForFunction(() => document.querySelector('.of-block[data-interval="1m"]').dataset.quality === 'live');
    await h.ctl('/orderflow?mult=100&hold=1'); await page.waitForTimeout(6500);
    check('Über 5 s ohne passende Kerze veraltet, obwohl Spot weiter live ist', await page.evaluate(() => document.querySelector('.of-block[data-interval="1m"]').dataset.quality === 'stale' && __g05.state.prices.BTCUSDT.live));
    await h.ctl('/orderflow?mult=100'); await page.waitForFunction(() => document.querySelector('.of-block[data-interval="1m"]').dataset.quality === 'live');
    await page.click('#pause'); await page.waitForFunction(() => document.querySelector('.of-block').dataset.quality === 'paused');
    check('Pause sichtbar und Panel-Abos abgeschaltet', await page.evaluate(() => __pdf1.view.state.paused && !__pdf1.live.wantKey.futures));
    await page.click('#pause'); await page.waitForFunction(() => document.querySelector('.of-block[data-interval="1m"]').dataset.quality === 'live');
    check('Fortsetzen stellt vollständige Live-Daten her', await page.evaluate(() => !__pdf1.view.state.paused));
    // Ein echter Kerzenwechsel, kein künstlicher Datumstimer: bestehende Mock-Verbindung sendet x=true.
    const before = await page.getAttribute('.of-block[data-interval="1m"] .of-running', 'data-time');
    console.log('Warte auf echten Minutenabschluss');
    await page.waitForFunction(t => document.querySelector('.of-block[data-interval="1m"] .of-running').dataset.time !== t, before, { timeout: 65000 });
    await page.waitForFunction(t => __pdf1.view.state.series['1m'].some(c => c.t === Number(t) && c.closed), before);
    await page.waitForFunction(t => { const rows = [...document.querySelectorAll('.of-block[data-interval="1m"] .of-row:not(.of-legend)')]; return rows[3].dataset.time === t && rows[3].dataset.closed === 'true'; }, before);
    check('Abschluss wird Zeitzeile vor jetzt, neue laufende Zeile unten', await page.evaluate(t => { const rows = [...document.querySelectorAll('.of-block[data-interval="1m"] .of-row:not(.of-legend)')]; return rows[3].dataset.time === t && rows[3].dataset.closed === 'true' && rows[4].dataset.running === 'true' && Number(rows[4].dataset.time) === Number(t) + 60000; }, before));
    check('Live/Abschluss erhält feste DOM-Zeilen und Panelhöhe', await page.evaluate(() => m74Rows.every((n, i) => n === document.querySelectorAll('.of-row')[i]) && m74Height === document.getElementById('orderflow-panel').offsetHeight));
    await page.fill('#symbol', 'ETH'); await page.press('#symbol', 'Enter');
    await page.waitForFunction(() => __pdf1.view.state.symbol === 'ETHUSDT' && __pdf1.view.state.series['1m'].length >= 5);
    const original = await page.evaluate(() => JSON.stringify(__pdf1.view.state.series));
    await page.evaluate(() => __pdf1.view.acceptRest({ symbol: 'BTCUSDT', interval: '1m', rows: [], startedAt: Date.now() }));
    check('Coinwechsel berechnet neu, verspätete fremde Antwort bleibt wirkungslos', await page.evaluate(raw => JSON.stringify(__pdf1.view.state.series) === raw && document.getElementById('orderflow-panel').dataset.symbol === 'ETHUSDT', original));
    await page.selectOption('#of-unit', 'coins'); await page.reload(); await page.waitForFunction(() => window.__pdf1 && __pdf1.view.state.symbol);
    check('Neustart stellt Einheit wieder her', await page.inputValue('#of-unit') === 'coins');
    for (const layout of ['standard', 'dashboard']) for (const [width, height] of [[320, 844], [390, 844], [768, 1024], [1024, 768]]) {
      await page.setViewportSize({ width, height }); await page.evaluate(layout => { document.documentElement.dataset.presentation = layout; document.documentElement.dataset.layout = 'tablet'; }, layout);
      check(`${layout} ${width}×${height}: Panel im Bild, kein Seitenüberlauf`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.getElementById('orderflow-panel').scrollWidth <= document.getElementById('orderflow-panel').clientWidth + 1));
      check(`${layout} ${width}×${height}: ${width === 1024 ? 'rechte 380px-Spalte' : 'unter dem Chart'}`, await page.evaluate(side => { const c = document.getElementById('chart').getBoundingClientRect(), p = document.getElementById('orderflow-panel').getBoundingClientRect(); return side ? p.left >= c.right && Math.abs(p.width - 380) < 1 : p.top >= c.bottom; }, width === 1024));
      if (width !== 1024) check(`${layout} ${width}px: bestehende Ebenenschalter vor dem Zusatzpanel`, await page.evaluate(() => document.querySelector('.chart-footer').getBoundingClientRect().bottom <= document.getElementById('orderflow-panel').getBoundingClientRect().top));
      for (const unit of ['coins', 'usdt']) { await page.selectOption('#of-unit', unit);
        check(`${layout} ${width}px / ${unit}: alle Zahlen vollständig sichtbar`, await page.evaluate(() => [...document.querySelectorAll('.of-buy,.of-sell,.of-delta')].every(n => n.scrollWidth <= n.clientWidth + 1)));
      }
    }
    await page.setViewportSize({ width: 1024, height: 768 }); await page.click('#view-menu');
    for (const mode of ['light', 'dark']) { await page.click(`[data-theme-set=${mode}]`);
      check(`${mode}: Zahlen lesbar auf Kauf- und Verkaufshintergrund`, await page.evaluate(() => { const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue('--' + n).trim(); return ['up-bg', 'down-bg', 'surface'].every(bg => __sdAppearance.contrast(v('text'), v(bg)) >= 4.5); }));
    }
    await page.click('[data-theme-set=custom]');
    for (const { name, color } of await page.evaluate(() => __sdAppearance.palette)) { await page.click(`[data-background-color="${color}"]`);
      check(`${name}: Paneltexte und Delta auf eigener Farbe mit AA-Kontrast`, await page.evaluate(() => { const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue('--' + n).trim(); return ['up-bg', 'down-bg', 'surface'].every(bg => __sdAppearance.contrast(v('text'), v(bg)) >= 4.5) && ['up-text', 'down-text', 'warn-text', 'muted'].every(fg => __sdAppearance.contrast(v(fg), v('surface')) >= 4.5); }));
    }
    await page.click('#view-menu');
    check('Berührbare Einheit/Info/Neu laden mindestens 44px hoch', await page.evaluate(() => ['#of-unit', '#of-retry', '.of-info>summary'].every(s => document.querySelector(s).getBoundingClientRect().height >= 44)));
    await page.click('#chart-full'); await page.waitForTimeout(300);
    check('Vollbild behält Hauptchart, Zusatzpanel ausgeblendet', await page.evaluate(() => document.documentElement.dataset.chartfull === '1' && document.getElementById('chart').getBoundingClientRect().height > 200 && getComputedStyle(document.getElementById('orderflow-panel')).display === 'none'));
    check('Divergenz-Halo bleibt direkt im ursprünglichen Chartpanel', await page.evaluate(() => document.getElementById('div-halo').parentElement.id === 'chart-sec' && getComputedStyle(document.querySelector('.of-chart-grid')).position === 'static'));
    await page.click('#fb-exit'); await page.waitForTimeout(300);
    await page.locator('#orderflow-panel').scrollIntoViewIfNeeded();
    if (process.env.OF_SCREENSHOT_DIR) { fs.mkdirSync(process.env.OF_SCREENSHOT_DIR, { recursive: true }); await page.screenshot({ path: process.env.OF_SCREENSHOT_DIR + '/orderflow-ipad-quer.png' }); }
    await page.fill('#symbol', 'PAXG'); await page.press('#symbol', 'Enter');
    await page.waitForFunction(() => __pdf1.view.state.unavailable && /nicht verfügbar/.test(document.getElementById('of-status').textContent) && __g05.state.sourceFor === 'PAXGUSDT', null, { timeout: 20000 });
    check('Spot-only Coin: Futures fehlen offen benannt, keine stille Ersatzquelle', /nicht verfügbar/.test(await page.textContent('#of-status')) && await page.evaluate(() => __pdf1.view.state.series['1m'].length === 0 && __g05.state.source === 'spot'));
    await page.waitForTimeout(1200);
    check('Ungültiges Futures-Symbol entfernt Zusatzabos', await page.evaluate(() => !__pdf1.live.wantKey.futures.includes('paxgusdt')));
    check('Keine JavaScript-Fehler', errors.length === 0, errors.join(' | ')); await ctx.close();
    console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
  } catch (e) { console.error('Abbruch', e); process.exitCode = 1; }
  finally { if (browser) await browser.close(); await h.teardown(); }
})();
