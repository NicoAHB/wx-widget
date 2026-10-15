// 3.71.0 – Vorauswahl nach dem Entwurf des Nutzers: Filter „Alle n · Stark ≥ +2 · Schwach ≤ −2“, Sortierung „Score ↓“ / „Eigene“ (gespeichert,
// Verschieben nur in der eigenen Reihenfolge), Kachel „+ Coin hinzufügen“ (mit geöffnetem Coin außerhalb der Vorauswahl „+ SOL hinzufügen“),
// Spalten 1m · 5m · 1h · 1d, RSI-Leiste. Dazu der Schalter „Live-Wert offener Positionen“ in den Einstellungen (Kopfzeile „Offen •••“).
// Aufruf: node m111.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + String(detail).slice(0, 600) : ''}`); };
const real = errs => errs.filter(e => !/Service Worker registration blocked|Failed to load resource|ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|net::ERR/.test(e));
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
const ready = page => page.waitForFunction(() => [...document.querySelectorAll('#watchlist .wl-tile .wl-sig')].every(s => /^[+−]?\d$/.test(s.textContent)), null, { timeout: 40000 }).catch(() => {});
// Bewertung je Coin setzen (Score und Regeln), dann malt der Sekundentakt neu
const rate = (page, scores) => page.evaluate(sc => { for (const [c, v] of Object.entries(sc)) { const e = __g09.wl.c.get(c + 'USDT'); e.rating = { score: v, verdict: 'hold', closeTime: Date.now() - 1, rules: [{ label: 'Trend', score: Math.sign(v) }, { label: 'Kurs', score: v > 1 ? 1 : v < -1 ? -1 : 0 }, { label: 'RSI 55', score: 0 }, { label: 'MACD', score: v > 2 ? 1 : 0 }] }; } }, scores);
const visible = page => page.evaluate(() => [...document.querySelectorAll('#watchlist .wl-grid > .wl-item:not(.wl-add-item)')].filter(i => !i.hidden).map(i => i.dataset.coin).join());

(async () => {
  await h.setup(); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  const browser = await h.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }), page = await ctx.newPage(), errors = [];
    h.collect(page, errors);
    await page.goto(`${h.URL_BASE}/weather-widget-v2.html`); await live(page); await ready(page); await page.waitForTimeout(1500);
    const head = await page.evaluate(() => ({ chips: [...document.querySelectorAll('#watchlist [data-wlfilter]')].map(b => `${b.textContent}:${b.getAttribute('aria-pressed')}`), sort: document.querySelector('#watchlist [data-wlsort]')?.textContent, add: document.querySelector('#watchlist .wl-grid > .wl-add-item:last-child .wl-add')?.textContent }));
    check('Kopf: „Alle 6“ (gewählt), „Stark ≥ +2“, „Schwach ≤ −2“; Sortierung „Eigene ↕“; letzte Kachel „+ Coin hinzufügen“', head.chips.join() === 'Alle 6:true,Stark ≥ +2:false,Schwach ≤ −2:false' && head.sort === 'Eigene ↕' && head.add === '+ Coin hinzufügen', JSON.stringify(head));
    const tile = await page.evaluate(() => { const t = document.querySelector('#watchlist .wl-tile[data-watch="BTC"]'), q = s => t.querySelector(s); return { top: [q('.wl-sym').textContent, q('.wl-sig').textContent, q('.wl-price').textContent], tf: [...t.querySelectorAll('.wl-tfc')].map(c => `${c.dataset.tf}${c.classList.contains('sel') ? '*' : ''}`).join(), chips: [...q('.wl-rules').children].map(c => c.firstChild.textContent).join(), rsi: q('.wl-rsi-l').textContent, knob: !q('.wl-rsi-bar b').hidden, dot: !q('.wl-dot').hidden }; });
    check('Kachel: Kürzel · Score · Kurs; Spalten 1m · 5m · 1h* · 1d (Zeitraum 1 Std. hervorgehoben); Felder Trend · Kurs · MACD; RSI mit Leiste; Punkt am Ende der Linie', tile.top[0] === 'BTC' && /^[+−]?\d$/.test(tile.top[1]) && /\d/.test(tile.top[2]) && tile.tf === '1m,5m,1h*,1d' && tile.chips === 'Trend,Kurs,MACD' && /^RSI \d+$/.test(tile.rsi) && tile.knob && tile.dot, JSON.stringify(tile));
    // Spalten füllen sich (1m-/1h-Kerzen nacheinander je Coin)
    const filled = await page.waitForFunction(() => [...document.querySelectorAll('#watchlist .wl-tile')].every(t => [...t.querySelectorAll('.wl-tfv')].filter(v => /^[+−±]\d+,\d\d$/.test(v.textContent)).length >= 3), null, { timeout: 30000 }).then(() => true).catch(() => false);
    check('Veränderungen je Spalte füllen sich für alle Coins (mindestens 1h, 1d und eine kurze Spalte)', filled, await page.evaluate(() => [...document.querySelectorAll('#watchlist .wl-tile')].map(t => t.dataset.watch + ':' + [...t.querySelectorAll('.wl-tfv')].map(v => v.textContent).join('/')).join(' ')));
    // Filter
    await rate(page, { BTC: 3, ETC: -2, BCH: 1, LTC: 2, XRP: -3, NEAR: 0 }); await page.waitForTimeout(1300);
    await page.tap('#watchlist [data-wlfilter="strong"]'); await page.waitForTimeout(300);
    check('„Stark ≥ +2“: nur BTC (+3) und LTC (+2)', await visible(page) === 'BTC,LTC', await visible(page));
    await page.tap('#watchlist [data-wlfilter="weak"]'); await page.waitForTimeout(300);
    check('„Schwach ≤ −2“: nur ETC (−2) und XRP (−3)', await visible(page) === 'ETC,XRP', await visible(page));
    await rate(page, { ETC: 0, XRP: 1 }); await page.waitForTimeout(1300);
    check('… keiner mehr schwach: Hinweis „Gerade kein Coin mit Tendenz ≤ −2.“', await visible(page) === '' && await page.evaluate(() => document.querySelector('#watchlist .wl-empty')?.textContent) === 'Gerade kein Coin mit Tendenz ≤ −2.');
    await page.tap('#watchlist [data-wlfilter="all"]'); await page.waitForTimeout(300);
    check('„Alle“: wieder alle sechs, kein Hinweis', await visible(page) === 'BTC,ETC,BCH,LTC,XRP,NEAR' && !(await page.$('#watchlist .wl-empty')), await visible(page));
    // Sortierung
    await page.tap('#watchlist [data-wlsort]'); await page.waitForTimeout(300);
    check('„Score ↓“: nach Tendenz, gleiche Tendenz in eigener Reihenfolge (BTC +3, LTC +2, BCH +1, XRP +1, ETC 0, NEAR 0)', await visible(page) === 'BTC,LTC,BCH,XRP,ETC,NEAR' && await page.textContent('#watchlist [data-wlsort]') === 'Score ↓', await visible(page));
    await rate(page, { NEAR: 4 }); await page.waitForTimeout(1300);
    check('… ändert sich eine Tendenz, ordnet sich die Kachel neu ein (NEAR +4 nach vorn)', (await visible(page)).startsWith('NEAR,BTC,LTC'), await visible(page));
    // langes Drücken verschiebt im Score-Modus nicht
    const nb = await page.locator('#watchlist .wl-tile[data-watch="LTC"]').boundingBox(), cdp = await ctx.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: nb.x + 20, y: nb.y + 20 }] }); await page.waitForTimeout(700);
    const lifted = await page.evaluate(() => document.documentElement.dataset.wldrag || ''); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(400);
    check('… im Score-Modus hebt langes Drücken keine Kachel an (verschoben wird nur in der eigenen Reihenfolge)', !lifted, lifted);
    await page.evaluate(() => { const t = document.querySelector('#watchlist .wl-tile[aria-expanded="true"]'); if (t) t.click(); }); await page.waitForTimeout(300);
    await page.reload(); await live(page); await ready(page); await page.waitForTimeout(1000);
    check('Nach dem Neuladen: Sortierung „Score ↓“ und Filter bleiben gespeichert', await page.textContent('#watchlist [data-wlsort]') === 'Score ↓' && await page.getAttribute('#watchlist [data-wlfilter="all"]', 'aria-pressed') === 'true');
    await page.tap('#watchlist [data-watchedit]'); await page.waitForTimeout(300);
    check('Bearbeiten zeigt die eigene Reihenfolge (Sortierknopf gesperrt)', await visible(page) === 'BTC,ETC,BCH,LTC,XRP,NEAR' && await page.evaluate(() => document.querySelector('#watchlist [data-wlsort]').disabled), await visible(page));
    await page.tap('#watchlist [data-watchedit]'); await page.waitForTimeout(300);
    await page.tap('#watchlist [data-wlsort]'); await page.waitForTimeout(300);
    check('„Eigene ↕“: wieder die eigene Reihenfolge', await visible(page) === 'BTC,ETC,BCH,LTC,XRP,NEAR' && await page.textContent('#watchlist [data-wlsort]') === 'Eigene ↕', await visible(page));
    // „+ Coin hinzufügen“
    await page.tap('#watchlist .wl-add'); await page.waitForTimeout(700);
    check('„+ Coin hinzufügen“ führt zur Coin-Suche (Feld fokussiert)', await page.evaluate(() => document.activeElement?.id) === 'symbol', await page.evaluate(() => document.activeElement?.id));
    await page.fill('#symbol', 'SOL'); await page.click('#market-form [type=submit]'); await live(page); await page.waitForTimeout(2500);
    const add2 = await page.evaluate(() => { const a = document.querySelector('#watchlist .wl-add'); return { text: a.textContent, coin: a.dataset.addwatch || '' }; });
    check('Geöffneter Coin außerhalb der Vorauswahl: Kachel „+ SOL hinzufügen“', add2.text === '+ SOL hinzufügen' && add2.coin === 'SOL', JSON.stringify(add2));
    await page.evaluate(() => document.querySelector('#watchlist .wl-add').click()); await page.waitForTimeout(800);
    check('… antippen nimmt SOL auf, danach wieder „+ Coin hinzufügen“ als letzte Kachel', await page.evaluate(() => JSON.parse(localStorage.getItem('scalpdesk.watchlist.v1')).includes('SOL') && document.querySelector('#watchlist .wl-grid').lastElementChild.querySelector('.wl-add')?.textContent === '+ Coin hinzufügen'));
    check('keine Fehler (Vorauswahl)', !real(errors).length, real(errors).join(' | '));
    await ctx.close();

    // ---------- Einstellung: Live-Wert offener Positionen in der Kopfzeile ----------
    const p0 = (await h.ctl('/state')).price.BTCUSDT, now = Date.now();
    const POS = [{ id: 'p111', symbol: 'BTCUSDT', side: 'long', mode: 'isolated', entry: p0 * 1.01, leverage: 5, qty: 0.01, margin: p0 * 0.01 / 5, openedAt: now - 60e3, source: 'spot', liqExchange: null, preRealized: 0, sl: null, tp: null, ack: { sl: false, tp: false } }];
    const ctx2 = await browser.newContext({ viewport: { width: 1180, height: 820 } }), pg = await ctx2.newPage(), err2 = [];
    h.collect(pg, err2); await ctx2.addInitScript(p => { if (!localStorage.getItem('m111')) { localStorage.setItem('m111', '1'); localStorage.setItem('scalpdesk.positions.v1', JSON.stringify(p)); } }, POS);
    await pg.goto(`${h.URL_BASE}/weather-widget-v2.html`); await live(pg); await pg.waitForFunction(() => /USDT/.test(document.getElementById('lb-open').textContent), null, { timeout: 20000 }).catch(() => {});
    const on = await pg.evaluate(() => ({ v: document.getElementById('lb-open').textContent, e: document.getElementById('lb-open-eur').textContent, b: document.getElementById('lb-open-toggle').textContent }));
    check('Standard: Kopfzeile zeigt den Live-Wert („−… USDT“ mit Euro), Schalter „👁 Live-Wert offener Positionen: an“', /^[+−][\d.,]+ USDT$/.test(on.v) && /€/.test(on.e) && on.b === '👁 Live-Wert offener Positionen: an', JSON.stringify(on));
    await pg.evaluate(() => document.getElementById('lb-open-toggle').click()); await pg.waitForTimeout(1200);
    const off = await pg.evaluate(() => ({ v: document.getElementById('lb-open').textContent, e: document.getElementById('lb-open-eur').textContent, cls: document.getElementById('lb-open').className, b: document.getElementById('lb-open-toggle').textContent, pressed: document.getElementById('lb-open-toggle').getAttribute('aria-pressed') }));
    check('Ausgeblendet: „Offen •••“ ohne Betrag, Euro und Farbe; Schalter „aus“', off.v === '•••' && off.e === '' && !/positive|negative/.test(off.cls) && off.b === '👁 Live-Wert offener Positionen: aus' && off.pressed === 'false', JSON.stringify(off));
    await pg.reload(); await live(pg); await pg.waitForTimeout(2500);
    check('… bleibt nach dem Neuladen ausgeblendet (auch bei laufenden Kursen)', await pg.textContent('#lb-open') === '•••');
    await pg.click('#lb-pos'); await pg.waitForTimeout(400);
    check('… Antippen öffnet weiter den Gewinn-/Verlust-Alarm', await pg.evaluate(() => !document.getElementById('pnl-panel').hidden));
    await pg.keyboard.press('Escape');
    await pg.evaluate(() => document.getElementById('lb-open-toggle').click()); await pg.waitForTimeout(1200);
    check('Wieder eingeblendet: Betrag in USDT mit Euro', /^[+−][\d.,]+ USDT$/.test(await pg.textContent('#lb-open')) && /€/.test(await pg.textContent('#lb-open-eur')));
    check('keine Fehler (Kopfzeile)', !real(err2).length, real(err2).join(' | '));
    await ctx2.close();
  } catch (e) { check('Abbruch', false, e.stack || e.message); }
  finally { await browser.close(); await h.ctl('/walk?on=1'); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
