// Schritt 2.5 – Whale-Alert: Leiste unter dem Chart (Ebene „Whales“, Standard an), Einzel-Trade-Abo (aggTrade) für das
// Chart-Kürzel, große Marktorders ab 100.000 USDT mit zusammengefassten Teil-Ausführungen, Schwelle wählbar und gespeichert,
// Anteil der Taker-Käufe aller Trades der letzten 60 s, 60-s-Fenster läuft ab, feste Höhe, Kürzelwechsel setzt zurück,
// Ebene aus = Stream abgemeldet, Vollbild ausgeblendet, ehrlicher Hinweis, Handy ohne Querscrollen. Aufruf: node m22.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
const wh = page => page.evaluate(() => {
  const g = id => document.getElementById(id), s = g('wh-strip'), r = s.getBoundingClientRect();
  const chips = ['wh-buy', 'wh-sell'].map(id => { const c = g(id), v = c.querySelector('.wh-v'); return c.scrollWidth > c.clientWidth + 1 || v.scrollWidth > v.clientWidth + 1; });
  return { hidden: s.hidden, display: getComputedStyle(s).display, h: Math.round(r.height), top: Math.round(r.top), right: r.right, buy: g('wh-buy-v').textContent, sell: g('wh-sell-v').textContent,
    flow: g('wh-flow-v').textContent, bar: g('wh-bar-b').style.width, last: g('wh-last-l').textContent, lastS: g('wh-last-s').textContent, lastCls: g('wh-last').className, src: g('wh-src').textContent,
    min: g('wh-min').value, tip: s.querySelector('.tip-body').textContent, flashB: g('wh-buy').classList.contains('flash'), flashS: g('wh-sell').classList.contains('flash'),
    lmBottom: Math.round(g('lmap-strip').getBoundingClientRect().bottom), cut: chips, flowCut: g('wh-flow-v').scrollWidth > g('wh-flow-v').clientWidth + 1 || g('wh-flow').scrollWidth > g('wh-flow').clientWidth + 1, lastVisible: [g('wh-last-l'), g('wh-last-s')].filter(e => e.getClientRects().length).map(e => e.id) };
});
const streams = async () => (await h.ctl('/state')).conns.filter(c => !/fstream/.test(c.host)).flatMap(c => c.streams);
const until = async (page, fn, arg, ms = 4000) => { try { await page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }); return true; } catch { return false; } };
const txt = (id, re) => [id, re.source];
const waitText = (page, id, re, ms) => until(page, ([i, r]) => new RegExp(r).test(document.getElementById(i).textContent), txt(id, re), ms);
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  const browser = await h.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page); await page.waitForTimeout(6500);
    let d = await wh(page);
    check('Leiste „Whales“ unter der Heatmap-Leiste (Ebene standardmäßig an)', !d.hidden && d.display !== 'none' && Math.abs(d.top - d.lmBottom) <= 2 && /letzte \d+ s · Spot/.test(d.src), JSON.stringify({ top: d.top, lm: d.lmBottom, src: d.src }));
    check('Einzel-Trade-Stream des Chart-Kürzels abonniert (btcusdt@aggTrade)', (await streams()).includes('btcusdt@aggTrade'), (await streams()).join(', '));
    check('Ohne Trades: „keine“ und „keine Trades“', d.buy === 'keine' && d.sell === 'keine' && d.flow === 'keine Trades', JSON.stringify({ buy: d.buy, sell: d.sell, flow: d.flow }));
    const H0 = d.h, hs = new Set([H0]);
    // Gewöhnlicher Handel: 600 Tsd. Käufe, 400 Tsd. Verkäufe in je zehn kleinen Trades (keiner ist ein Whale)
    await h.ctl('/flow?symbol=BTCUSDT&buy=600000&sell=400000&n=10'); await waitText(page, 'wh-flow-v', /Käufe 60 %/); d = await wh(page); hs.add(d.h);
    check('Alle Trades: Anteil der Taker-Käufe 60 %, Balken 60 %, keine Whales', /^Käufe 60 % · 1,0 Mio\.$/.test(d.flow) && d.bar === '60%' && d.buy === 'keine' && d.sell === 'keine', JSON.stringify({ flow: d.flow, bar: d.bar, buy: d.buy, sell: d.sell }));
    // Große Kauforder 250 Tsd. in drei Teil-Ausführungen (gleiche Handelszeit) = eine Order
    await h.ctl('/whale?symbol=BTCUSDT&usd=250000&side=buy&parts=3'); await waitText(page, 'wh-buy-v', /^1 · 250 Tsd\.$/); d = await wh(page); hs.add(d.h);
    check('Kauf-Whale 250 Tsd. aus drei Teilen: als eine Order gezählt, aufgeleuchtet, als letzte große Order genannt', d.buy === '1 · 250 Tsd.' && d.flashB && /^Letzte: ▲ Kauf 250 Tsd\. @ [\d.,]+ · vor \d s$/.test(d.last) && /\bbuy\b/.test(d.lastCls), JSON.stringify({ buy: d.buy, flash: d.flashB, last: d.last }));
    check('Die Order zählt auch im Anteil aller Trades mit (850 Tsd. zu 400 Tsd. = 68 %), nicht abgeschnitten', /^Käufe 68 % · 1,3 Mio\.$/.test(d.flow) && !d.flowCut, JSON.stringify({ flow: d.flow, cut: d.flowCut }));
    // 450 Tsd. in drei Teilen à 150 Tsd.: ohne Zusammenfassen wären es drei Whales – es muss eine sein
    await h.ctl('/whale?symbol=BTCUSDT&usd=450000&side=buy&parts=3'); await waitText(page, 'wh-buy-v', /^2 · 700 Tsd\.$/); d = await wh(page);
    check('450 Tsd. in drei Teilen à 150 Tsd.: eine Order (2 · 700 Tsd.), nicht drei', d.buy === '2 · 700 Tsd.', d.buy);
    await h.ctl('/whale?symbol=BTCUSDT&usd=150000&side=sell&parts=1'); await waitText(page, 'wh-sell-v', /^1 · 150 Tsd\.$/); d = await wh(page); hs.add(d.h);
    check('Verkauf-Whale 150 Tsd.: Verkäufe 1 · 150 Tsd., letzte Order ▼ Verkauf', d.sell === '1 · 150 Tsd.' && d.flashS && /^Letzte: ▼ Verkauf 150 Tsd\./.test(d.last) && /\bsell\b/.test(d.lastCls), JSON.stringify({ sell: d.sell, last: d.last }));
    // Drei Trades à 80 Tsd. in derselben Millisekunde zum selben Preis: drei verschiedene kleine Orders, kein Whale von 240 Tsd.
    await h.ctl('/whale?symbol=BTCUSDT&usd=240000&side=buy&parts=3&flat=1'); await page.waitForTimeout(1200); d = await wh(page);
    check('Gleiche Millisekunde, gleicher Preis (verschiedene Orders): nicht zusammengefasst, kein Whale', d.buy === '2 · 700 Tsd.', d.buy);
    await h.ctl('/whale?symbol=BTCUSDT&usd=80000&side=buy&parts=1'); await page.waitForTimeout(1200); d = await wh(page);
    check('80 Tsd. liegt unter der Schwelle: zählt nicht als Whale', d.buy === '2 · 700 Tsd.' && /Verkauf 150 Tsd\./.test(d.last), JSON.stringify({ buy: d.buy, last: d.last }));
    // Schwelle wählbar und gespeichert
    await page.selectOption('#wh-min', '250000'); await page.waitForTimeout(400); const s250 = await wh(page);
    await page.selectOption('#wh-min', '500000'); await page.waitForTimeout(400); const s500 = await wh(page);
    check('Schwelle 250 Tsd.: Käufe 2 · 700 Tsd., Verkäufe keine; 500 Tsd.: keine, keine letzte Order', s250.buy === '2 · 700 Tsd.' && s250.sell === 'keine' && /Kauf 450 Tsd\./.test(s250.last) && s500.buy === 'keine' && s500.last === '', JSON.stringify({ 250: [s250.buy, s250.sell, s250.last], 500: [s500.buy, s500.last] }));
    await page.reload(); await live(page); await page.waitForTimeout(3000); d = await wh(page);
    check('Gewählte Schwelle bleibt nach dem Neuladen', d.min === '500000', d.min);
    await page.selectOption('#wh-min', '100000'); await page.waitForTimeout(300);
    check('Feste Höhe bei allen Aktualisierungen', hs.size === 1, [...hs].join('/'));
    check('Ehrlicher Hinweis: Beschreibung, keine Vorhersage, nicht geprüft', /keine Vorhersage/.test(d.tip) && /nicht geprüft/.test(d.tip) && /zu einer Order zusammen/.test(d.tip), d.tip.slice(0, 90));
    // Kürzelwechsel: Zählung beginnt neu, Stream des neuen Kürzels
    await h.ctl('/whale?symbol=BTCUSDT&usd=300000&side=sell&parts=2'); await waitText(page, 'wh-sell-v', /^1 · 300 Tsd\.$/);
    await page.fill('#symbol', 'ETH'); await page.press('#symbol', 'Enter'); await page.waitForTimeout(7000); d = await wh(page); const st1 = await streams();
    check('Kürzelwechsel (ETH): Zählung beginnt neu, ethusdt@aggTrade statt btcusdt@aggTrade', d.buy === 'keine' && d.sell === 'keine' && d.last === '' && st1.includes('ethusdt@aggTrade') && !st1.includes('btcusdt@aggTrade'), JSON.stringify({ buy: d.buy, sell: d.sell, last: d.last, streams: st1 }));
    // Ebene aus: Leiste weg, Stream abgemeldet; wieder an
    await page.click('[data-overlay="whale"]'); await page.waitForTimeout(7000); const off = await wh(page), st2 = await streams();
    await page.click('[data-overlay="whale"]'); await page.waitForTimeout(7000); const on = await wh(page), st3 = await streams();
    check('Ebene „Whales“ aus: Leiste weg und Stream abgemeldet; wieder an: beides zurück', off.hidden && !st2.includes('ethusdt@aggTrade') && !on.hidden && st3.includes('ethusdt@aggTrade'), JSON.stringify({ aus: [off.hidden, st2.includes('ethusdt@aggTrade')], an: [on.hidden, st3.includes('ethusdt@aggTrade')] }));
    await page.click('#chart-full'); await page.waitForTimeout(800); const fs = await wh(page); await page.click('#fb-exit'); await page.waitForTimeout(500);
    check('Vollbild: Leiste ausgeblendet', fs.display === 'none', fs.display);
    // 60-s-Fenster: nach 61 s zählt die Order nicht mehr, bleibt aber als letzte große Order stehen
    await h.ctl('/whale?symbol=ETHUSDT&usd=200000&side=buy&parts=1'); await waitText(page, 'wh-buy-v', /^1 · 200 Tsd\.$/);
    await page.waitForTimeout(61500); d = await wh(page);
    check('Nach 61 s: nicht mehr in den 60 s gezählt, als letzte Order „vor 1 Min.“', d.buy === 'keine' && /Kauf 200 Tsd\. @ [\d.,]+ · vor 1 Min\.$/.test(d.last) && d.flow === 'keine Trades', JSON.stringify({ buy: d.buy, last: d.last, flow: d.flow }));
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
    // Handy hochkant: drei feste Zeilen, kurze Angabe der letzten Order, nichts abgeschnitten, kein seitliches Scrollen
    for (const w of [390, 320]) {
      const pc = await browser.newContext({ viewport: { width: w, height: 800 }, hasTouch: true, isMobile: true }), pp = await pc.newPage(), pe = []; h.collect(pp, pe);
      await pp.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(pp); await pp.waitForTimeout(6000);
      await pp.evaluate(() => document.getElementById('wh-strip').scrollIntoView({ block: 'center' }));
      const a = await wh(pp); await h.ctl('/whale?symbol=BTCUSDT&usd=1250000&side=sell&parts=4'); await h.ctl('/flow?symbol=BTCUSDT&buy=90000&sell=50000&n=2');
      await waitText(pp, 'wh-sell-v', /^1 · 1,3 Mio\.$/); const b = await wh(pp), sw = await pp.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
      check(`Handy ${w} px: drei feste Zeilen, kurze letzte Order, nichts abgeschnitten, kein seitliches Scrollen`, a.h === b.h && b.h >= 90 && b.lastVisible.join() === 'wh-last-s' && /^▼ 1,3 Mio\. · \d+ s$/.test(b.lastS) && !b.cut.some(Boolean) && !b.flowCut && b.right <= w && sw <= 0,
        JSON.stringify({ h: [a.h, b.h], lastS: b.lastS, vis: b.lastVisible, cut: b.cut, flowCut: b.flowCut, sw, flow: b.flow }));
      if (w === 390) await (await pp.$('#wh-strip')).screenshot({ path: __dirname + '/shots/m22-phone-390.png' });
      check(`Handy ${w} px: keine Fehler`, !pe.length, pe.join(' | ')); await pc.close();
    }
    for (const w of [620, 700, 1100]) {
      const pc = await browser.newContext({ viewport: { width: w, height: 900 } }), pp = await pc.newPage(); await pp.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(pp); await pp.waitForTimeout(6000);
      await h.ctl('/flow?symbol=BTCUSDT&buy=9000000&sell=3500000&n=100'); await h.ctl('/whale?symbol=BTCUSDT&usd=12500000&side=buy&parts=5'); await waitText(pp, 'wh-buy-v', /^1 · 13 Mio\.$/); const m = await wh(pp);
      check(`Breite ${w} px: lange Werte nicht abgeschnitten`, !m.cut.some(Boolean) && !m.flowCut, JSON.stringify({ buy: m.buy, flow: m.flow, cut: m.cut, flowCut: m.flowCut })); await pc.close();
    }
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await browser.close(); await h.ctl('/walk?on=1').catch(() => {}); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
