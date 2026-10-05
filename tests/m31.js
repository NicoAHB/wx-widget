// Schritt 4.2 (3.21.0) – Mini-Watchlist: Vorauswahl als Live-Kacheln mit Kurs, 1m-Veränderung, 30-Minuten-Linie und
// 1m-Tendenz; Streams für alle Vorauswahl-Coins; Live-Werte verschieben nichts (Kacheln und Chart bleiben stehen);
// Antippen öffnet das Detailfeld und lädt den Coin im Chart (3.26.0, vorher „Im Chart öffnen“ im Feld); Bearbeiten (entfernen, Standard) und „+ Coin“ in
// der Kopfzeile; Handy 390/320 px. 3.24.0: je Kachel auch „1 Min. …“, „30 Min. …“ und die Zeile Trend · Kurs · RSI · MACD.
// 3.25.0: Tendenz und Veränderung über die letzte Stunde (Standard): „1 Std. …“, Linie aus 12 Kerzen zu 5 Minuten, Streams 5m.
// Aufruf: node m31.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
const tiles = page => page.evaluate(() => [...document.querySelectorAll('#watchlist .wl-tile')].map(t => {
  const r = t.getBoundingClientRect(), q = s => t.querySelector(s);
  return { coin: t.dataset.watch, pressed: t.getAttribute('aria-current') || 'false', expanded: t.getAttribute('aria-expanded'), price: q('.wl-price').textContent, chg: q('.wl-chg').textContent, chgCls: q('.wl-chg').className, sig: q('.wl-sig').textContent,
    rules: [...q('.wl-rules').children].map(r => r.textContent).join(' '),
    tone: q('.wl-sig').dataset.tone, pts: (q('polyline').getAttribute('points') || '').split(' ').filter(Boolean).length, title: t.title,
    box: [r.left, r.top + scrollY, r.width, r.height].map(Math.round), inside: [...t.querySelectorAll('*')].filter(c => { const b = c.getBoundingClientRect(); return b.width && b.height && !c.classList.contains('sr-only'); }).every(c => { const b = c.getBoundingClientRect(); return b.left >= r.left - 0.5 && b.right <= r.right + 0.5 && b.top >= r.top - 0.5 && b.bottom <= r.bottom + 0.5; }) };
}));
const chartTop = page => page.evaluate(() => Math.round(document.getElementById('chart').getBoundingClientRect().top + scrollY));
const ready = page => page.waitForFunction(() => [...document.querySelectorAll('#watchlist .wl-tile .wl-sig')].every(s => /^[+−]?\d$/.test(s.textContent)), null, { timeout: 30000 }).catch(() => {});
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset');
  const browser = await h.launch();
  try {
    // ---- Computer ----
    let ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page); await ready(page); await page.waitForTimeout(1500);
    let t = await tiles(page);
    check('Sechs Kacheln in der Reihenfolge der Vorauswahl, BTC ausgewählt', t.map(x => x.coin).join() === 'BTC,ETC,BCH,LTC,XRP,NEAR' && t[0].pressed === 'true' && t.slice(1).every(x => x.pressed === 'false'), t.map(x => x.coin + ':' + x.pressed).join());
    check('Jede Kachel: Kurs, „1 Std. ±x,xx %“, Linie der Stunde (12 Kerzen zu 5 Minuten und der Kurs), Tendenz −4…+4, Zeile Trend · Kurs · RSI n · MACD mit Pfeilen', t.every(x => /^\d[\d.]*,\d+$/.test(x.price) && /^1 Std\. [+−±]\d+,\d\d %$/.test(x.chg) && !x.c30 && x.pts === 13 && /^[+−]?\d$/.test(x.sig) && x.tone !== 'none' && /^Trend[▲▼–] Kurs[▲▼–] RSI \d{1,3}[▲▼–] MACD[▲▼–]$/.test(x.rules)),
      JSON.stringify(t.map(x => [x.coin, x.price, x.chg, x.pts, x.sig, x.rules])));
    check('Hinweis beim Zeigen: Kurs, 1 Std., Tendenz der letzten Stunde mit Regeln und Gesamtbewertung', /^BTC\/USDT: [\d.,]+ USDT · 1 Std\. .+ % · Tendenz der letzten Stunde [+−]?\d\/4 \(Trend .+\) · (Long-Tendenz|Short-Tendenz|Abwarten)( · zu wenig Bewegung)? · antippen zeigt die Signale und lädt den Coin im Chart$/.test(t[0].title), t[0].title);
    const st = await h.ctl('/state'), subs = new Set(st.conns.flatMap(c => c.streams));
    check('Live-Stream: 5-Minuten-Kerzen aller sechs Coins abonniert', ['btcusdt', 'etcusdt', 'bchusdt', 'ltcusdt', 'xrpusdt', 'nearusdt'].every(s => subs.has(`${s}@kline_5m`)), [...subs].filter(s => s.endsWith('@kline_5m')).join(' '));
    // Live-Werte ändern sich, nichts verschiebt sich
    const top0 = await chartTop(page), t0 = t; await page.waitForTimeout(6000); t = await tiles(page); const top1 = await chartTop(page);
    const moved = t.filter((x, i) => x.box.join() !== t0[i].box.join());
    check('Live: Kurse ändern sich laufend', t.some((x, i) => x.price !== t0[i].price), JSON.stringify(t.map((x, i) => [t0[i].price, x.price])));
    check('Beim Aktualisieren verschiebt sich nichts: Kacheln und Chart bleiben an ihrem Platz', !moved.length && top0 === top1, JSON.stringify({ moved: moved.map(x => x.coin), top0, top1 }));
    check('Alles bleibt innerhalb der Kacheln', t.every(x => x.inside), JSON.stringify(t.filter(x => !x.inside).map(x => x.coin)));
    // Antippen öffnet das Detailfeld und lädt den Coin im Chart (3.26.0: kein eigener Knopf mehr)
    await page.click('#watchlist .wl-tile[data-watch="XRP"]'); await page.waitForTimeout(500); t = await tiles(page);
    check('Antippen öffnet das Detailfeld (Kachel aufgeklappt), ohne Knopf „Im Chart öffnen“', t.find(x => x.coin === 'XRP').expanded === 'true' && t.filter(x => x.expanded === 'true').length === 1 && !(await page.$('#wl-detail .wl-d-chart')));
    await live(page); await page.waitForTimeout(2500);
    const pair = await page.evaluate(() => document.getElementById('pair-label').textContent); t = await tiles(page);
    check('… und lädt den Coin im Chart, die Kachel ist als Chart-Coin markiert', /^XRP/.test(pair) && t.find(x => x.coin === 'XRP').pressed === 'true' && t.find(x => x.coin === 'BTC').pressed === 'false', pair);
    await page.click('#watchlist .wl-tile[data-watch="XRP"]'); await page.waitForTimeout(400);
    // Bearbeiten: entfernen, Standard
    await page.click('#watchlist [data-watchedit]'); await page.waitForTimeout(300);
    const xs = await page.$$eval('#watchlist [data-unwatch]', b => b.map(x => x.dataset.unwatch));
    await page.click('#watchlist [data-unwatch="ETC"]'); await page.waitForTimeout(400); t = await tiles(page);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('scalpdesk.watchlist.v1')));
    check('Bearbeiten: × an jeder Kachel, ETC entfernt und gespeichert', xs.join() === 'BTC,ETC,BCH,LTC,XRP,NEAR' && t.map(x => x.coin).join() === 'BTC,BCH,LTC,XRP,NEAR' && stored.join() === 'BTC,BCH,LTC,XRP,NEAR', `${xs} → ${t.map(x => x.coin)}`);
    await page.click('#watchlist [data-watchreset]'); await page.click('#watchlist [data-watchedit]'); await page.waitForTimeout(400); t = await tiles(page);
    check('„Standard“ stellt die sechs wieder her, „Fertig“ blendet × aus', t.length === 6 && !(await page.$('#watchlist [data-unwatch]')), t.map(x => x.coin).join());
    // Neuer Coin: „+ SOL“ in der Kopfzeile, danach eigene Kachel mit Live-Werten
    await page.fill('#symbol', 'SOL'); await page.click('#market-form [type=submit]'); await live(page); await page.waitForTimeout(2500);
    const add = await page.evaluate(() => { const a = document.querySelector('#watchlist [data-addwatch]'); return a && { text: a.textContent, inHead: !!a.closest('.wl-head') }; });
    const gridH0 = await page.evaluate(() => document.querySelector('#watchlist .wl-grid').getBoundingClientRect().height);
    check('Geöffneter Coin nicht in der Vorauswahl: „+ SOL“ in der Kopfzeile (keine neue Kachelreihe)', add && add.text === '+ SOL' && add.inHead, JSON.stringify(add));
    await page.click('#watchlist [data-addwatch="SOL"]'); await page.waitForTimeout(500);
    await page.waitForFunction(() => /^[+−]?\d$/.test(document.querySelector('#watchlist .wl-tile[data-watch="SOL"] .wl-sig')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
    t = await tiles(page); const sol = t.find(x => x.coin === 'SOL');
    check('Aufgenommen: SOL-Kachel ausgewählt, lädt Kurs, Linie und Tendenz', t.length === 7 && sol && sol.pressed === 'true' && /^\d/.test(sol.price) && sol.pts === 13 && /^[+−]?\d$/.test(sol.sig), JSON.stringify(sol));
    check('Grid wuchs erst mit der neuen Kachel (vorher gleich hoch)', gridH0 > 0);
    check('Computer: keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();

    // ---- Handy ----
    for (const [w, hh, cols] of [[390, 844, 2], [320, 700, 2]]) {
      ctx = await browser.newContext({ viewport: { width: w, height: hh }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); page = await ctx.newPage(); errors = []; h.collect(page, errors);
      await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page); await ready(page); await page.waitForTimeout(1500);
      t = await tiles(page);
      const lefts = new Set(t.map(x => x.box[0])), sw = await page.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
      check(`Handy ${w} px: ${cols} Spalte${cols > 1 ? 'n' : ''}, Kacheln mindestens 44 px hoch, alles innerhalb, kein seitliches Scrollen`, lefts.size === cols && t.every(x => x.box[3] >= 44 && x.inside) && sw <= 0,
        JSON.stringify({ cols: [...lefts], h: t.map(x => x.box[3]), sw }));
      // Stehen bleiben beim Aktualisieren, auch weiter unten gescrollt
      await page.evaluate(() => scrollTo(0, 250)); await page.waitForTimeout(500);
      const a0 = await page.evaluate(() => Math.round(document.getElementById('chart').getBoundingClientRect().top)), b0 = await tiles(page); await page.waitForTimeout(6000);
      const a1 = await page.evaluate(() => Math.round(document.getElementById('chart').getBoundingClientRect().top)), b1 = await tiles(page);
      check(`Handy ${w} px: Live-Werte verschieben nichts (Chart und Kacheln stehen)`, a0 === a1 && b1.every((x, i) => x.box.join() === b0[i].box.join()) && b1.some((x, i) => x.price !== b0[i].price), JSON.stringify({ a0, a1 }));
      check(`Handy ${w} px: keine Fehler`, !errors.length, errors.join(' | ')); await ctx.close();
    }
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
