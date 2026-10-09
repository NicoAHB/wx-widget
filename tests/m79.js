// 3.55.0: tatsächliche Karten/Klappbereiche, ruhige Live-Geometrie und Vorauswahl-Kurs.
const h = require('./harness'); let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };
(async () => { let browser;
  try {
    await h.setup(); await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=BTCUSDT&price=64000'); await h.ctl('/orderflow?mult=100');
    browser = await h.launch(); const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    await ctx.addInitScript(() => { if (!localStorage.getItem('scalpdesk.watchlist.v1')) { localStorage.setItem('scalpdesk.watchlist.v1', '["BTC","ETH","BSV","PAXG"]'); localStorage.setItem('scalpdesk.watchclean.v1', '1'); } });
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => window.__g09?.wl?.c.get('BTCUSDT')?.liveAt && window.__pdf1?.view.quote()?.fresh && __pdf2.feed.quote()?.fresh && __pdf2.view.frame.result);
    check('Exakt fünf gerundete Rahmen je Zeitebene', await page.evaluate(() => [...document.querySelectorAll('.of-block')].every(block => { const rows = [...block.querySelectorAll('.of-row:not(.of-legend)')]; return rows.length === 5 && rows.every(row => { const s = getComputedStyle(row); return parseFloat(s.borderRadius) >= 10 && parseFloat(s.borderTopWidth) === 1 && s.borderTopColor !== 'rgba(0, 0, 0, 0)'; }); })));
    check('Demo-Livekurs exakt wie Vorauswahl trotz 100-fachem Futures-Kurs', await page.evaluate(() => { const q = __pdf1.view.quote(), e = __g09.wl.c.get('BTCUSDT'); return q.price === 64000 && q.price === e.run.close && q.source === e.market && __pdf2.feed.quote().price === 6400000; }));
    check('Analysequelle bleibt klar beschriftet', await page.evaluate(() => /Binance USDT-Futures/.test(document.querySelector('#orderflow-panel>.of-source').textContent) && /Kurs wie Vorauswahl · Spot/.test(document.getElementById('of-demo-source').textContent)));
    for (const key of ['1m', '1h', 'signal', 'position']) {
      const selector = `[data-of-fold="${key}"]`; await page.locator(selector + '>summary').click();
      check(`${key}: zugeklappt, Daten und feste Zeilen bleiben erhalten`, await page.evaluate(key => { const n = document.querySelector(`[data-of-fold="${key}"]`); return !n.open && __pdf2.feed.quote().fresh && document.querySelectorAll('.of-row:not(.of-legend)').length === 10; }, key));
    }
    await page.selectOption('#of-unit', 'coins'); await page.waitForFunction(() => __g05.backupPayload().prefs['scalpdesk.orderflow.v1'].unit === 'coins');
    await page.reload(); await page.waitForFunction(() => window.__pdf1?.view.quote()?.fresh && __pdf2.view.frame.result);
    check('Neustart und Einheitwechsel erhalten alle vier Klappzustände', await page.evaluate(() => ['1m', '1h', 'signal', 'position'].every(k => !document.querySelector(`[data-of-fold="${k}"]`).open) && document.getElementById('of-unit').value === 'coins'));
    check('Klappauswahl in persönlicher Sicherung enthalten', await page.evaluate(() => ['1m', '1h', 'signal', 'position'].every(k => __g05.backupPayload().prefs['scalpdesk.orderflow.v1'].folds[k] === false)));
    for (const key of ['1m', '1h', 'signal', 'position']) await page.locator(`[data-of-fold="${key}"]>summary`).click();
    await page.click('#of-demo>summary'); await page.click('#of-demo-price'); await page.waitForFunction(() => __pdf2.view.frame.result.position?.practice);
    check('Übungskauf speichert Vorauswahlpreis und tatsächliche Spot-Quelle', await page.evaluate(() => { const p = __g05.backupPayload().prefs['scalpdesk.orderflow-demo.v1'].active[0]; return p.entry === 64000 && p.source === 'spot'; }));
    check('Übungsbegleitung mischt keinen Futures-ATR in Spot-Schutzlevel', await page.evaluate(() => { const p = __pdf2.view.frame.result.position; return p.source === 'spot' && !p.stop && !p.target && __pdf2.view.frame.result.warnings.some(w => w.includes('kein gemischter')); }));
    await h.ctl('/set?symbol=BTCUSDT&price=65000'); await page.waitForFunction(() => __pdf1.view.quote()?.price === 65000 && document.getElementById('of-demo-result').dataset.tone === 'up'); await page.click('#of-demo-close');
    check('Übungsausstieg verwendet denselben neuen Vorauswahlkurs', await page.evaluate(() => __g05.backupPayload().prefs['scalpdesk.orderflow-demo.v1'].closed.at(-1).exit === 65000)); await page.click('#of-demo>summary');
    // Nur Spot-Kerzenmeldungen zurückhalten: Futures-Analyse bleibt live. Kein Ersatzkurs darf einen Kauf ermöglichen.
    await page.evaluate(() => { const e = __g09.wl.c.get('BTCUSDT'); window.m79WlInterval = e.iv; e.iv = 'nicht-aktiv'; });
    await page.waitForFunction(() => !__pdf1.view.quote()?.fresh && document.getElementById('of-demo-price').disabled, null, { timeout: 10000 });
    check('Fehlender Vorauswahl-Livekurs: keine Futures-Ersatzquote, Demo gesperrt', await page.evaluate(() => __pdf2.feed.quote().fresh && __pdf1.view.quote().price === 65000 && document.getElementById('of-demo-price').disabled));
    await page.evaluate(() => __g09.wl.c.get('BTCUSDT').iv = window.m79WlInterval); await page.waitForFunction(() => __pdf1.view.quote()?.fresh);
    const setEvent = async () => {
      await page.click('.of-signal-settings>summary');
      await page.locator('.of-signal-settings input[type=datetime-local]').fill(await page.evaluate(() => { const d = new Date(Date.now() + 5 * 60000); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); }));
      await page.getByLabel('Terminname').fill('Langer Testtermin mit mehreren gut lesbaren Hinweisen zur Marktlage und anstehenden Veröffentlichung');
      await page.getByRole('button', { name: 'Einstellungen speichern', exact: true }).click(); await page.click('.of-signal-settings>summary');
      await page.waitForFunction(() => __pdf2.view.frame.raw.vetoes.some(v => /Wirtschaftstermin:/.test(v)));
    };
    for (const [width, height] of [[320, 844], [390, 844], [768, 1024], [1024, 768]]) {
      await page.setViewportSize({ width, height }); await page.waitForTimeout(300);
      const before = await page.locator('#of-signal').evaluate(n => n.getBoundingClientRect().height);
      if (width === 320) await setEvent();
      await page.locator('#of-signal').scrollIntoViewIfNeeded();
      const data = await page.evaluate(async () => { const n = document.getElementById('of-signal'), nodes = [...document.querySelectorAll('.of-row')], start = n.getBoundingClientRect().top, heights = [], tops = []; for (let i = 0; i < 6; i++) { await new Promise(r => setTimeout(r, 250)); heights.push(n.getBoundingClientRect().height); tops.push(n.getBoundingClientRect().top); } return { heights, movement: Math.max(...tops.map(t => Math.abs(t - start))), sameRows: nodes.every((n, i) => document.querySelectorAll('.of-row')[i] === n), overflow: document.documentElement.scrollWidth > innerWidth + 1, after: n.getBoundingClientRect().height }; });
      check(`${width}px: Signalhöhe und Scrollposition ohne Live-Sprünge`, Math.max(...data.heights) - Math.min(...data.heights) <= 1 && data.movement <= 1 && (width !== 320 || Math.abs(data.after - before) <= 1), JSON.stringify(data));
      check(`${width}px: kein Seitenüberlauf, bestehende Kerzenknoten erhalten`, !data.overflow && data.sameRows);
      check(`${width}px: O/T und H/S optisch direkt untereinander mit getrennten 44-px-Flächen`, await page.evaluate(() => [...document.querySelectorAll('.of-block[data-interval="1m"] .of-prices')].every(prices => { const buttons = [...prices.querySelectorAll('button')], rect = i => buttons[i].querySelector('.of-price-value').getBoundingClientRect(), gap = (a, b) => rect(b).top - rect(a).bottom; return [gap(0, 2), gap(1, 3)].every(v => v >= 0 && v <= 3) && buttons.every(b => b.getBoundingClientRect().height >= 44) && buttons[0].getBoundingClientRect().bottom <= buttons[2].getBoundingClientRect().top; })));
    }
    check('Längere Begründungen/Warnungen vollständig scrollbar und per Tastatur erreichbar', await page.evaluate(() => [...document.querySelectorAll('.of-signal-reason,.of-signal-explanation,#of-signal>.of-notice')].every(n => n.tabIndex === 0 && getComputedStyle(n).overflowY === 'auto' && n.clientHeight > 0)));
    for (const layout of ['standard', 'dashboard']) {
      await page.evaluate(layout => document.querySelector(`[data-presentation-set="${layout}"]`).click(), layout); await page.waitForTimeout(300);
      check(`${layout}: Signal vor den übrigen Live-Blöcken, identische zehn Karten`, await page.evaluate(() => document.getElementById('of-btc').nextElementSibling.id === 'of-signal' && document.getElementById('of-signal').nextElementSibling.id === 'of-position' && document.querySelectorAll('.of-row:not(.of-legend)').length === 10 && document.documentElement.scrollWidth <= innerWidth + 1));
      for (const entry of await page.evaluate(() => __sdAppearance.palette)) {
        await page.evaluate(color => document.querySelector(`[data-background-color="${color}"]`).click(), entry.color);
        check(`${layout}/${entry.name}: Einzelkarten bleiben mit AA-Text lesbar`, await page.evaluate(() => { const s = getComputedStyle(document.documentElement), v = k => s.getPropertyValue('--' + k).trim(); return ['text', 'muted', 'up-text', 'down-text'].every(k => __sdAppearance.contrast(v(k), v('surface-2')) >= 4.5); }));
      }
    }
    check('Alle neuen Haupt-Klappflächen mindestens 44 px hoch', await page.evaluate(() => [...document.querySelectorAll('[data-of-fold]>summary')].every(n => n.getBoundingClientRect().height >= 44)));
    for (const [coin, source] of [['BSV', 'futures'], ['PAXG', 'spot']]) {
      await page.fill('#symbol', coin); await page.press('#symbol', 'Enter'); await page.waitForFunction(symbol => __pdf1.view.state.symbol === symbol && __pdf1.view.quote()?.fresh && document.getElementById('of-demo-price').textContent.includes(symbol), coin + 'USDT');
      check(`${coin}: gleiche Vorauswahlquote bei ${source === 'spot' ? 'Spot ohne Futures-Paar' : 'Futures ohne Spot-Paar'}`, await page.evaluate(({ coin, source }) => { const e = __g09.wl.c.get(coin + 'USDT'), q = __pdf1.view.quote(); return e.market === source && q.source === source && q.price === e.run.close && !document.getElementById('of-demo-price').disabled; }, { coin, source }));
    }
    await page.setViewportSize({ width: 390, height: 844 }); await page.locator('#of-signal').scrollIntoViewIfNeeded(); await page.locator('#of-signal').screenshot({ path: '/tmp/scalpdesk-355-signal.png' }); await page.screenshot({ path: '/tmp/scalpdesk-355-karten-mobile.png', fullPage: true });
    await page.fill('#symbol', 'BTC'); await page.press('#symbol', 'Enter'); await page.waitForFunction(() => __pdf1.view.state.symbol === 'BTCUSDT' && __pdf1.view.quote()?.fresh && __pdf1.view.state.series['1m'].length >= 5); await page.waitForFunction(() => document.getElementById('orderflow-panel').dataset.symbol === 'BTCUSDT' && [...document.querySelectorAll('.of-block .of-price-value')].every(n => n.textContent !== '—')); check('Nach Coin-Rückkehr alle zehn OHLC-Karten tatsächlich gezeichnet', await page.evaluate(() => document.querySelectorAll('.of-block .of-price-value').length === 40 && !document.querySelector('.of-row.of-missing:not(.of-legend)'))); await page.locator('.of-block[data-interval="1m"]').screenshot({ path: '/tmp/scalpdesk-355-minuten.png' });
    check('Keine JavaScript-Laufzeitfehler', errors.length === 0, errors.join(' | ')); await ctx.close(); console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
  } catch (e) { console.error('Abbruch', e); process.exitCode = 1; } finally { if (browser) await browser.close(); await h.teardown(); }
})();
