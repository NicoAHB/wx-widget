// Vorauswahl: gemeinsame Raster-/Listenansicht, echte Touch-Gesten und Zahlenbreiten.
// Aufruf: node tests/m112.js; optional PROOF_DIR für Bildschirmfotos.
const h = require('./harness'), fs = require('fs'), path = require('path');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + String(detail).slice(0, 700) : ''}`); };
const order = page => page.$$eval('#watchlist .wl-grid > [data-coin]', items => items.map(it => it.dataset.coin));
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('scalpdesk.watchlist.v1')));
const ready = page => page.waitForFunction(() => window.__g09 && __g09.wl.c.size === 6 && [...__g09.wl.c.values()].every(e => e.rating && !e.loading && !e.tfLoading), null, { timeout: 45000 });
const tile = coin => `#watchlist .wl-tile[data-watch="${coin}"]`;
const center = (page, selector) => page.$eval(selector, e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });

(async () => {
  await h.setup(); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  const browser = await h.launch({ workspace: 'fresh' });
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.stack || e.message));
    await ctx.addInitScript(() => { if (!localStorage.getItem('scalpdesk.wlspan.v1')) localStorage.setItem('scalpdesk.wlspan.v1', '"1h"'); });
    await page.goto(`${h.URL_BASE}/weather-widget-v2.html`); await ready(page);
    check('Native Oberfläche: Kacheln sind der Standard, Zeitraumleiste verborgen', await page.getAttribute('#watchlist', 'data-wlview') === 'grid' && !(await page.locator('.wl-periods').isVisible()));
    const initial = await order(page);
    await page.$$eval('#watchlist .wl-tile', nodes => nodes.forEach(t => { t.__original = t; }));
    await page.tap('button[data-wlview="list"]');
    check('Ein Tipp zeigt die Liste; dieselben Coin-Elemente, Kurse und Reihenfolge', (await order(page)).join() === initial.join() && await page.$$eval('#watchlist .wl-tile', ts => ts.every(t => t.__original === t && /\d/.test(t.querySelector('.wl-price').textContent))) && await page.getAttribute('button[data-wlview="list"]', 'aria-pressed') === 'true');
    check('Zeitraumleiste: 1m / 5m / 1h / 1d mit aktiver Stunde', (await page.$$eval('[data-wlperiod]', bs => bs.map(b => b.textContent))).join() === '1m,5m,1h,1d' && await page.getAttribute('[data-wlperiod="1h"]', 'aria-pressed') === 'true');
    const rows = await page.$$eval('#watchlist .wl-tile', ts => ts.map(t => { const r = t.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, arrows: t.querySelectorAll('.wl-arrows i').length, change: t.querySelector('.wl-list-change').textContent, rsi: t.querySelector('.wl-rsi-l').textContent }; }));
    check('Liste: eine Zeile pro Coin mit drei Dreiecken, Preis, RSI, Verlauf und Prozentfeld', rows.every((r, i) => r.x === rows[0].x && r.w === rows[0].w && r.h >= 64 && r.arrows === 3 && /%$/.test(r.change) && /^RSI \d/.test(r.rsi) && (!i || r.y > rows[i - 1].y)), JSON.stringify(rows[0]));
    check('Auswahl hat grünen Rand; „+ Coin hinzufügen“ bleibt am Ende', await page.locator(`${tile('BTC')}[aria-current="true"]`).count() === 1 && await page.locator('#watchlist .wl-grid > .wl-add-item:last-child .wl-add').isVisible());
    await page.evaluate(() => __g05.state.alarms.push({ id: 'test-wl-bell', symbol: 'BTCUSDT', source: 'spot', price: 1e9, dir: 'above', note: '', createdAt: Date.now(), armedAt: Date.now(), triggeredAt: null }));
    await page.waitForFunction(() => !document.querySelector('[data-watch="BTC"] .wl-alarm').hidden);
    check('Aktiver BTC-Alarm zeigt die Glocke', await page.locator(`${tile('BTC')} .wl-alarm`).isVisible());
    await page.evaluate(() => { __g05.state.alarms.find(a => a.id === 'test-wl-bell').triggeredAt = Date.now(); });
    await page.waitForFunction(() => document.querySelector('[data-watch="BTC"] .wl-alarm').hidden);
    check('Ausgelöster Alarm blendet die Glocke wieder aus', !(await page.locator(`${tile('BTC')} .wl-alarm`).isVisible()));
    await page.evaluate(() => { __g05.state.alarms = __g05.state.alarms.filter(a => a.id !== 'test-wl-bell'); });
    await page.tap('[data-wlperiod="5m"]'); await ready(page);
    check('5m nutzt den bestehenden Datenweg mit 1m-Kerzen; Auswahl und Daten stimmen überein', await page.evaluate(() => __g09.wl.span === '5m' && [...__g09.wl.c.values()].every(e => e.iv === '1m')) && await page.getAttribute('[data-wlperiod="5m"]', 'aria-pressed') === 'true');
    await page.reload(); await ready(page);
    check('Neustart stellt Liste und 5m wieder her', await page.getAttribute('#watchlist', 'data-wlview') === 'list' && await page.getAttribute('[data-wlperiod="5m"]', 'aria-pressed') === 'true');
    await page.tap(tile('BTC')); await page.selectOption('.wl-d-span', '30m'); await ready(page);
    check('Bestehende 30m-Auswahl bleibt erhalten; 1m / 5m / 1h / 1d bleiben direkt wählbar', (await page.$$eval('[data-wlperiod]', bs => bs.map(b => b.textContent))).join() === '1m,5m,30m,1h,1d' && await page.getAttribute('[data-wlperiod="30m"]', 'aria-pressed') === 'true');
    await page.tap(tile('BTC')); await page.waitForTimeout(400);
    await page.tap('[data-wlperiod="1h"]'); await ready(page);
    const cdp = await ctx.newCDPSession(page);
    const touch = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y, id: 1 }] : [] });
    const position = async () => { await page.$eval('#watchlist', e => e.scrollIntoView({ block: 'start' })); await page.evaluate(() => scrollBy(0, -70)); await page.waitForTimeout(350); };
    const drag = async (from, to, cancel = false) => {
      await position(); const a = await center(page, tile(from)), b = await center(page, tile(to)), y = await page.evaluate(() => scrollY);
      await touch('touchStart', a); await page.waitForTimeout(380);
      const lifted = await page.evaluate(() => !!document.querySelector('.wl-ghost') && document.documentElement.dataset.wldrag === 'hold');
      let animated = false;
      for (let i = 1; i <= 12; i++) { await touch('touchMove', { x: a.x + (b.x - a.x) * i / 12, y: a.y + (b.y - a.y) * i / 12 }); animated ||= await page.$$eval('#watchlist .wl-item', ns => ns.some(n => n.getAnimations().length > 0)); await page.waitForTimeout(18); }
      const yEnd = await page.evaluate(() => scrollY);
      if (cancel) await page.keyboard.press('Escape');
      await touch('touchEnd'); await page.waitForTimeout(550);
      return { lifted, animated, scroll: yEnd - y };
    };
    let d = await drag('BTC', 'LTC');
    check('Liste: nach 380 ms angehoben, Nachbarn animiert, BTC hinter LTC gespeichert', d.lifted && d.animated && (await order(page)).join() === 'ETC,BCH,LTC,BTC,XRP,NEAR' && (await saved(page)).join() === (await order(page)).join(), JSON.stringify(d));
    check('Beim Ziehen scrollt die Seite nicht und es öffnet sich kein Detailfeld', Math.abs(d.scroll) < 2 && await page.locator('#watchlist .wl-tile[aria-expanded="true"]').count() === 0, JSON.stringify(d));
    await page.tap('button[data-wlview="grid"]');
    check('Raster übernimmt dieselbe manuelle Reihenfolge', (await order(page)).join() === 'ETC,BCH,LTC,BTC,XRP,NEAR');
    d = await drag('ETC', 'BTC');
    check('Raster: lang drücken und ziehen speichert dieselbe Reihenfolge für beide Ansichten', d.lifted && d.animated && (await order(page)).join() === 'BCH,LTC,BTC,ETC,XRP,NEAR' && (await saved(page)).join() === (await order(page)).join(), JSON.stringify(d));
    await page.tap('button[data-wlview="list"]');
    await page.evaluate(() => { for (const [c, score] of Object.entries({ BTC: -1, ETC: 1, BCH: 3, LTC: 2, XRP: -3, NEAR: 0 })) __g09.wl.c.get(c + 'USDT').rating = { score, closeTime: Date.now() - 1, rules: [{ label: 'Trend', score: Math.sign(score) }, { label: 'Kurs', score: Math.abs(score) >= 2 ? Math.sign(score) : 0 }, { label: 'RSI 55', score: 0 }, { label: 'MACD', score: Math.abs(score) >= 3 ? Math.sign(score) : 0 }] }; });
    await page.tap('[data-wlsort]');
    const scoreOrder = await order(page); d = await drag(scoreOrder[0], scoreOrder[2]);
    const expected = [...scoreOrder]; expected.splice(2, 0, expected.shift());
    check('Score ↓ → Verschieben → Manuell: sichtbare Reihenfolge übernommen, übrige Coins bleiben geordnet', d.lifted && await page.textContent('[data-wlsort]') === 'Manuell' && (await order(page)).join() === expected.join() && (await saved(page)).join() === expected.join(), (await order(page)).join());
    const beforeCancel = await order(page); await drag(beforeCancel[0], beforeCancel[3], true);
    check('Esc bricht ab und stellt die gespeicherte Reihenfolge wieder her', (await order(page)).join() === beforeCancel.join() && (await saved(page)).join() === beforeCancel.join() && await page.locator('.wl-ghost').count() === 0);
    await page.tap('[data-wlsort]');
    check('Score-Sortierung bleibt per Tipp wieder wählbar', await page.textContent('[data-wlsort]') === 'Score ↓' && (await order(page)).join() === scoreOrder.join());
    await page.tap('[data-wlsort]'); await position();
    const beforeScroll = await order(page), a = await center(page, tile(beforeScroll[0])), y0 = await page.evaluate(() => scrollY);
    await touch('touchStart', a); await page.waitForTimeout(40);
    for (let i = 1; i <= 6; i++) { await touch('touchMove', { x: a.x, y: a.y - i * 14 }); await page.waitForTimeout(15); }
    await page.waitForTimeout(380);
    check('Bewegung vor der Haltezeit scrollt normal und hebt keine Zeile an', await page.locator('.wl-ghost').count() === 0 && await page.evaluate(y => scrollY > y + 15, y0) && (await order(page)).join() === beforeScroll.join());
    await touch('touchEnd'); await page.waitForTimeout(500);
    await page.tap(tile('BTC'));
    check('Ein normaler Tipp öffnet weiterhin den Coin', await page.getAttribute(tile('BTC'), 'aria-expanded') === 'true');
    await page.tap(tile('BTC')); await page.waitForTimeout(450);
    await page.setViewportSize({ width: 390, height: 500 }); await page.locator(tile(beforeScroll[0])).scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
    const top = await center(page, tile(beforeScroll[0])), sy = await page.evaluate(() => scrollY), bottom = await page.evaluate(() => { const b = document.getElementById('tabbar'); return Math.min(innerHeight, getComputedStyle(b).display === 'none' ? innerHeight : b.getBoundingClientRect().top) - 10; });
    await touch('touchStart', top); await page.waitForTimeout(380); await touch('touchMove', { x: top.x, y: bottom }); await page.waitForTimeout(400);
    check('Am unteren Rand scrollt die Seite beim Ziehen automatisch', await page.evaluate(y => scrollY > y + 15, sy) && await page.locator('.wl-ghost').count() === 1);
    await touch('touchCancel'); await page.waitForTimeout(500);
    check('Touch-Abbruch hinterlässt weder Ghost noch geänderte Reihenfolge', await page.locator('.wl-ghost').count() === 0 && (await order(page)).join() === beforeScroll.join());
    await page.setViewportSize({ width: 390, height: 844 });
    await position();
    const multi = await center(page, tile(beforeScroll[0])); await touch('touchStart', multi); await page.waitForTimeout(380);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...multi, id: 1 }, { x: multi.x + 35, y: multi.y + 10, id: 2 }] });
    check('Zweiter Finger bricht das Verschieben ohne Datenverlust ab', await page.locator('.wl-ghost').count() === 0 && (await order(page)).join() === beforeScroll.join());
    await touch('touchEnd'); await page.waitForTimeout(500);
    await position(); const rotating = await center(page, tile(beforeScroll[0])); await touch('touchStart', rotating); await page.waitForTimeout(380);
    await page.setViewportSize({ width: 393, height: 844 }); await page.waitForTimeout(200);
    check('Breitenänderung beim Ziehen räumt die Geste auf und erhält die Reihenfolge', await page.locator('.wl-ghost').count() === 0 && (await order(page)).join() === beforeScroll.join());
    await touch('touchEnd'); await page.waitForTimeout(500); await page.setViewportSize({ width: 390, height: 844 });
    await page.tap('button[data-wlview="grid"]');
    await page.evaluate(() => { __g05.state.paused = true; });
    for (const width of [320, 390, 430, 768]) {
      await page.$$eval('#watchlist .wl-tile', ts => ts.forEach((t, i) => { const p = t.querySelector('.wl-price'); p.dataset.full = i ? '1.234.567,89' : '81.245,67'; p.textContent = p.dataset.full; t.querySelectorAll('.wl-tfv').forEach((v, j) => { v.dataset.full = ['+0,40', '−2,98', '−5,75', '+12,34'][j]; v.dataset.compact = ['+0,4', '−3,0', '−5,8', '+12,3'][j]; v.textContent = v.dataset.full; }); }));
      await page.setViewportSize({ width, height: 844 }); await page.waitForTimeout(200);
      const header = await page.$eval('#watchlist .wl-head', head => {
        const rect = n => { const r = n.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, middle: (r.top + r.bottom) / 2 }; }, box = rect(head);
        const top = [...head.querySelectorAll('.wl-heading,.wl-sortbtn,.wl-view,[data-watchedit]')].map(rect), filters = [...head.querySelectorAll('[data-wlfilter]')].map(rect);
        return { oneTopRow: Math.max(...top.map(r => r.middle)) - Math.min(...top.map(r => r.middle)) < 1, oneFilterRow: Math.max(...filters.map(r => r.top)) - Math.min(...filters.map(r => r.top)) < 1,
          inside: [...top, ...filters].every(r => r.left >= box.left - .5 && r.right <= box.right + .5), readable: [...head.querySelectorAll('[data-wlfilter]')].every(n => n.scrollWidth <= n.clientWidth + 1), filterBelow: filters[0].top >= Math.max(...top.map(r => r.bottom)) - .5 };
      });
      check(`${width}px: Kopfbedienung auf einer Höhe, drei Filter in einer Zeile und vollständig lesbar`, Object.values(header).every(Boolean), JSON.stringify(header));
      if (width === 320) {
        await page.$$eval('#watchlist [data-wlfilter]', ns => ns.forEach(n => { n.style.fontFamily = 'monospace'; }));
        check('320px: auch mit breiter Ersatzschrift sind alle Filter vollständig lesbar', await page.$$eval('#watchlist [data-wlfilter]', ns => ns.every(n => n.scrollWidth <= n.clientWidth + 1)));
        await page.$$eval('#watchlist [data-wlfilter]', ns => ns.forEach(n => n.style.removeProperty('font-family')));
      }
      const geometry = await page.$$eval('#watchlist .wl-tile', ts => ts.map(t => {
        const cells = [...t.querySelectorAll('.wl-tfc')], values = [...t.querySelectorAll('.wl-tfv')], price = t.querySelector('.wl-price');
        const fits = n => { const r = document.createRange(); r.selectNodeContents(n); return r.getBoundingClientRect().width <= n.clientWidth + .5; };
        return { fits: values.every(fits) && fits(price), equal: Math.max(...cells.map(c => c.clientWidth)) - Math.min(...cells.map(c => c.clientWidth)) <= 1, gaps: cells.slice(1).every((c, i) => c.getBoundingClientRect().left - cells[i].getBoundingClientRect().right >= 3), texts: values.map(v => v.textContent), price: price.textContent };
      }));
      check(`${width}px: vier gleich breite Spalten, Abstand, vollständige Werte und lange Preise`, geometry.every(g => g.fits && g.equal && g.gaps && g.texts.every(t => /^[+−]\d+,\d{1,2}$/.test(t))) && geometry[0].price === '81.245,67', JSON.stringify(geometry[0]));
      if (width === 320) check('Bei knappem Platz wird auf eine Nachkommastelle gerundet', geometry.some(g => g.texts.some(t => /^[+−]\d+,\d$/.test(t))));
      if (process.env.PROOF_DIR && [320, 390].includes(width)) { fs.mkdirSync(process.env.PROOF_DIR, { recursive: true }); await page.locator('#watchlist').screenshot({ path: path.join(process.env.PROOF_DIR, `vorauswahl-raster-${width}.png`) }); }
    }
    // Inter hat proportionale Standardziffern. Die CSS-Tabellenziffern müssen nach ihrer gerenderten Breite eingepasst werden.
    await page.evaluate(async () => {
      const font = new FontFace('Ziffernprobe', 'url(/server/fonts/Inter-Regular.otf)'); await font.load(); document.fonts.add(font);
      for (const n of document.querySelectorAll('#watchlist .wl-price,#watchlist .wl-tfv')) { n.style.fontFamily = 'Ziffernprobe'; n.style.fontWeight = '400'; }
      document.querySelectorAll('#watchlist .wl-price').forEach((n, i) => { n.dataset.full = i % 2 ? '1.111.111,11' : '111.111,11'; n.textContent = n.dataset.full; });
      document.querySelectorAll('#watchlist .wl-tfv').forEach(n => { n.dataset.full = '+11,11'; n.dataset.compact = '+11,1'; n.textContent = n.dataset.full; });
    });
    await page.setViewportSize({ width: 321, height: 844 }); await page.waitForTimeout(200);
    check('Tabellenziffern: auch eine proportionale Schrift und viele Einsen bleiben vollständig im Feld', await page.$$eval('#watchlist .wl-price,#watchlist .wl-tfv', ns => ns.every(n => { const r = document.createRange(); r.selectNodeContents(n); return r.getBoundingClientRect().width <= n.clientWidth + .5; })));
    await page.setViewportSize({ width: 320, height: 844 }); await page.tap('button[data-wlview="list"]'); await page.waitForTimeout(200);
    check('320px-Liste: lange Preise bleiben vollständig im Feld', await page.$$eval('#watchlist .wl-price', ns => ns.every(n => n.scrollWidth <= n.clientWidth + 1)));
    check('Kein Textmarkieren beim langen Drücken', await page.$eval(tile('BTC'), t => (getComputedStyle(t).webkitUserSelect || getComputedStyle(t).userSelect) === 'none'));
    if (process.env.PROOF_DIR) await page.locator('#watchlist').screenshot({ path: path.join(process.env.PROOF_DIR, 'vorauswahl-liste-320.png') });
    await page.reload(); await ready(page);
    check('Neustart: Ansicht und manuelle Reihenfolge bleiben gemeinsam erhalten', await page.getAttribute('#watchlist', 'data-wlview') === 'list' && (await order(page)).join() === beforeScroll.join());
    check('Keine JavaScript-Fehler', errors.length === 0, errors.join(' | '));
    await ctx.close();
  } finally { await browser.close(); await h.teardown(); }
  const ok = results.filter(r => r.ok).length; console.log(`\n${ok}/${results.length} bestanden`); process.exitCode = ok === results.length ? 0 : 1;
})().catch(e => { console.error('Abbruch:', e); process.exit(1); });
