// 3.15.0 – Reiter „Orderbuch“ in der Whales-Leiste: zu = keine Abrufe; offen = alle 10 s Orderbuch (1000 Stufen), größte
// Kauf-Wand unter und Verkaufs-Wand über dem Kurs (±2 %) mit Kurs, Abstand, Größe, „seit …“; verschobene Wand beginnt neu;
// ohne Wand „keine Wand“; erfasster Bereich, wenn das Buch nicht bis ±2 % reicht; Antippen = Alarm; Zustand gespeichert;
// Futures-Chart über /fapi; Fehler sichtbar; feste Höhe; Handy ohne Querscrollen. Aufruf: node m23.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
const obs = page => page.evaluate(() => {
  const g = id => document.getElementById(id), box = g('ob'), strip = g('wh-strip'), row = box.querySelector('.ob-row');
  const chip = side => { const b = g('ob-' + side), vis = e => !!e && e.getClientRects().length > 0;
    return { dis: b.disabled, price: b.dataset.price, usd: b.dataset.usd, k: [...b.querySelectorAll('.ob-k > span')].filter(vis).map(e => e.textContent).join(''), p: g(`ob-${side}-p`).textContent, d: g(`ob-${side}-d`).textContent, u: g(`ob-${side}-u`).textContent,
      a: g(`ob-${side}-a`).hidden ? '' : [...g(`ob-${side}-a`).children].filter(vis).map(e => e.textContent).join(''), title: b.title, skel: g(`ob-${side}-p`).classList.contains('skel'),
      cut: b.scrollWidth > b.clientWidth + 1 || [...b.children].some(c => c.scrollWidth > c.clientWidth + 1), h: Math.round(b.getBoundingClientRect().height), right: b.getBoundingClientRect().right }; };
  return { open: box.open, rowVisible: !!row && row.checkVisibility() /* zugeklappt: per content-visibility verborgen – getClientRects zählt ihn trotzdem */, note: g('ob-note').textContent, sum: box.querySelector('summary').textContent, stripH: Math.round(strip.getBoundingClientRect().height), bid: chip('bid'), ask: chip('ask') };
});
const depthCalls = async (since, host) => (await h.ctl('/log?since=' + since)).filter(e => /\/depth$/.test(e.path || '') && (!host || e.host === host));
const until = async (page, fn, arg, ms = 12000) => { try { await page.waitForFunction(fn, arg, { timeout: ms, polling: 200 }); return true; } catch { return false; } };
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset'); await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=BTCUSDT&price=64000'); // runder Kurs: Wände liegen genau auf Stufen
  const P = (await h.ctl('/state')).price.BTCUSDT, bidP = +(P * 0.99).toPrecision(8), askP = +(P * 1.013).toPrecision(8), askP2 = +(P * 1.017).toPrecision(8);
  await h.ctl(`/book?symbol=BTCUSDT&side=bid&price=${bidP}&usd=12000000`); await h.ctl(`/book?symbol=BTCUSDT&side=ask&price=${askP}&usd=8000000`);
  const browser = await h.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page); await page.waitForTimeout(1500);
    let t0 = Date.now(); await page.waitForTimeout(11000); let d = await obs(page);
    check('Reiter „Orderbuch“ zu: nur die schmale Zeile, keine Orderbuch-Abrufe', !d.open && !d.rowVisible && /Orderbuch\s*größte Wände ±2 %/.test(d.sum) && !(await depthCalls(t0)).length, JSON.stringify({ open: d.open, sum: d.sum, calls: (await depthCalls(t0)).length }));
    const closedH = d.stripH;
    t0 = Date.now(); await page.click('#ob > summary'); await until(page, () => !document.getElementById('ob-bid').disabled);
    d = await obs(page); const c1 = await depthCalls(t0);
    check('Aufklappen lädt sofort das Orderbuch (Spot, 1000 Stufen)', d.open && d.rowVisible && c1.length >= 1 && c1[0].host === 'data-api.binance.vision' && c1[0].q.limit === '1000', JSON.stringify(c1.map(c => [c.host, c.q.limit])));
    check('Kauf-Wand: Kurs, −1,0 %, 12 Mio., neu', d.bid.k === 'Kauf-Wand' && d.bid.p === (P * 0.99).toLocaleString('de-DE', { maximumFractionDigits: 0 }) && d.bid.d === '−1,0 %' && d.bid.u === '12 Mio.' && d.bid.a === 'neu' && Math.abs(Number(d.bid.price) / bidP - 1) < 1e-6, JSON.stringify(d.bid));
    check('Verkaufs-Wand: Kurs, +1,3 %, gut 8 Mio., neu', d.ask.k === 'Verkaufs-Wand' && d.ask.d === '+1,3 %' && /^8,\d Mio\.$/.test(d.ask.u) && d.ask.a === 'neu' && Math.abs(Number(d.ask.price) / askP - 1) < 1e-6, JSON.stringify(d.ask));
    check('Hinweis in der Reiter-Zeile: ±2 % · alle 10 s; Tooltip mit Faktor und Alarm', d.note === 'größte Wände ±2 % · alle 10 s' && /× so viel wie im Schnitt/.test(d.bid.title) && /Antippen: Alarm/.test(d.bid.title), d.note);
    const openH = d.stripH, hs = new Set([openH]);
    // Zwei weitere Abrufe (10 s Takt): „seit 20 s“; dann Verkaufs-Wand verschieben – beginnt neu, Kauf-Wand läuft weiter
    await page.waitForTimeout(20500); d = await obs(page); hs.add(d.stripH); const calls20 = await depthCalls(t0);
    check('Alle 10 s neu geladen; Wände stehen „seit 20 s“', calls20.length >= 3 && d.bid.a === 'seit 20 s' && d.ask.a === 'seit 20 s', JSON.stringify({ calls: calls20.length, bid: d.bid.a, ask: d.ask.a }));
    await h.ctl(`/book?symbol=BTCUSDT&side=ask&remove=${askP}`); await h.ctl(`/book?symbol=BTCUSDT&side=ask&price=${askP2}&usd=8000000`);
    await until(page, p => Math.abs(Number(document.getElementById('ob-ask').dataset.price) / p - 1) < 1e-6, askP2); d = await obs(page); hs.add(d.stripH);
    check('Verschobene Verkaufs-Wand (+1,7 %): neuer Kurs, beginnt bei „neu“; Kauf-Wand läuft weiter', d.ask.d === '+1,7 %' && d.ask.a === 'neu' && /^seit [34]0 s$/.test(d.bid.a), JSON.stringify({ ask: [d.ask.p, d.ask.d, d.ask.a], bid: d.bid.a }));
    // Ohne Wände: „keine Wand“ (nichts doppelt so groß wie der Schnitt)
    await h.ctl('/book?symbol=BTCUSDT&clear=1'); await until(page, () => document.getElementById('ob-bid-p').textContent === 'keine Wand'); d = await obs(page); hs.add(d.stripH);
    check('Ohne Wände: „keine Wand“ auf beiden Seiten, Knöpfe gesperrt, Erklärung im Tooltip', d.bid.p === 'keine Wand' && d.ask.p === 'keine Wand' && d.bid.dis && d.ask.dis && /mindestens doppelt so viel/.test(d.bid.title), JSON.stringify({ bid: d.bid.p, ask: d.ask.p }));
    // Buch reicht nur bis ±1 %: erfasster Bereich steht in der Reiter-Zeile
    await h.ctl('/book?symbol=BTCUSDT&step=0.00001'); await until(page, () => /reicht bis/.test(document.getElementById('ob-note').textContent)); d = await obs(page); hs.add(d.stripH);
    check('Buch reicht nicht bis ±2 %: „Orderbuch reicht bis −1,0 % / +1,0 %“', d.note === 'größte Wände · Orderbuch reicht bis −1,0 % / +1,0 %', d.note);
    await h.ctl('/book?symbol=BTCUSDT&step=0.0002'); await h.ctl(`/book?symbol=BTCUSDT&side=bid&price=${bidP}&usd=12000000`);
    await until(page, () => !document.getElementById('ob-bid').disabled); d = await obs(page); hs.add(d.stripH);
    check('Feste Höhe bei allen Aktualisierungen (offen)', hs.size === 1 && openH > closedH, JSON.stringify({ zu: closedH, offen: [...hs] }));
    // Antippen am Computer: Alarm-Formular mit dem Kurs der Wand
    await page.click('#ob-bid'); await page.waitForTimeout(500);
    const f = await page.evaluate(() => ({ open: !document.getElementById('alarm-form').hidden, price: document.getElementById('al-price').value, note: document.getElementById('al-note').value }));
    check('Klick auf die Kauf-Wand: Alarm-Formular mit Kurs und Notiz', f.open && Math.abs(Number(f.price.replace(',', '.')) / bidP - 1) < 1e-6 && f.note === 'Kauf-Wand im Orderbuch (12 Mio.)', JSON.stringify(f));
    // Zu- und wieder aufklappen: „seit …“ beginnt neu – es zählt nur, was durchgehend beobachtet wurde
    await until(page, () => /^seit /.test(document.getElementById('ob-bid-al').textContent), null, 15000); const before = await obs(page);
    await page.click('#ob > summary'); await page.waitForTimeout(300); const shut = await page.evaluate(() => document.querySelectorAll('#ob .skel').length);
    await page.click('#ob > summary'); await page.waitForTimeout(300); await until(page, () => !document.getElementById('ob-bid').disabled); const again = await obs(page); // toggle kommt asynchron
    check('Zu- und wieder aufgeklappt: Wand beginnt wieder bei „neu“; zugeklappt keine Lade-Platzhalter', /^seit /.test(before.bid.a) && again.bid.a === 'neu' && shut === 0, JSON.stringify({ vorher: before.bid.a, danach: again.bid.a, platzhalterZu: shut }));
    // Fehler bei Binance: Hinweis in der Reiter-Zeile
    await h.ctl('/restfail?on=1'); await until(page, () => /Binance/.test(document.getElementById('ob-note').textContent), null, 14000); d = await obs(page); await h.ctl('/restfail?on=0');
    check('Orderbuch nicht erreichbar: Fehler steht in der Reiter-Zeile', /Binance/.test(d.note), d.note);
    await until(page, () => /±2 %/.test(document.getElementById('ob-note').textContent), null, 14000);
    // Zuklappen: keine weiteren Abrufe; Zustand bleibt nach dem Neuladen
    await page.click('#ob > summary'); t0 = Date.now(); await page.waitForTimeout(12000); const c2 = await depthCalls(t0);
    await page.reload(); await live(page); await page.waitForTimeout(2000); const r1 = await obs(page);
    await page.click('#ob > summary'); await page.waitForTimeout(800); await page.reload(); await live(page); await until(page, () => !document.getElementById('ob-bid').disabled); const r2 = await obs(page);
    check('Zugeklappt keine Abrufe; zu/offen bleibt nach dem Neuladen', !c2.length && !r1.open && r2.open && !r2.bid.dis, JSON.stringify({ abrufe: c2.length, nachZu: r1.open, nachOffen: r2.open }));
    // Ebene „Whales“ aus: keine Abrufe; wieder an
    await page.click('[data-overlay="whale"]'); t0 = Date.now(); await page.waitForTimeout(12000); const c3 = await depthCalls(t0); await page.click('[data-overlay="whale"]'); await page.waitForTimeout(1500);
    check('Ebene „Whales“ aus: keine Orderbuch-Abrufe', !c3.length, String(c3.length));
    // Chart aus den Futures (BSV): Orderbuch über fapi
    t0 = Date.now(); await page.fill('#symbol', 'BSV'); await page.press('#symbol', 'Enter'); await page.waitForTimeout(6000); const c4 = await depthCalls(t0);
    check('Futures-Chart (BSV): Orderbuch von fapi.binance.com', c4.some(c => c.host === 'fapi.binance.com' && c.q.symbol === 'BSVUSDT'), JSON.stringify(c4.map(c => [c.host, c.q.symbol])));
    const real = errors.filter(e => !/status of (400|503)/.test(e)); // BSV nicht als Spot (400), Fehlertest (503)
    check('keine Fehler', !real.length, real.join(' | ')); await ctx.close();
    // iPad: Antippen öffnet den Schnell-Alarm
    await h.ctl(`/book?symbol=BTCUSDT&side=ask&price=${askP}&usd=8000000`);
    const tc = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true }), tp = await tc.newPage(), te = []; h.collect(tp, te);
    await tp.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(tp); await tp.waitForTimeout(1500);
    await tp.evaluate(() => document.getElementById('wh-strip').scrollIntoView({ block: 'center' })); await tp.tap('#ob > summary'); await until(tp, () => !document.getElementById('ob-ask').disabled);
    const ta = await obs(tp); await tp.tap('#ob-ask'); await tp.waitForTimeout(600);
    const qa = await tp.evaluate(() => ({ open: document.getElementById('qa-dialog').open, price: document.getElementById('qa-price').value, prev: document.getElementById('qa-preview').textContent }));
    check('iPad: Knöpfe fingergroß; Antippen der Verkaufs-Wand öffnet den Schnell-Alarm', ta.ask.h >= 43 && qa.open && Math.abs(Number(qa.price.replace(',', '.')) / askP - 1) < 1e-6 && /🧲 Verkaufs-Wand/.test(qa.prev), JSON.stringify({ h: ta.ask.h, ...qa }));
    check('iPad: keine Fehler', !te.length, te.join(' | ')); await tc.close();
    // Handy hochkant: zweizeilige Knöpfe (kurz „Kauf“/„Verkauf“, Alter kurz), nichts abgeschnitten, kein seitliches Scrollen
    for (const w of [390, 320]) {
      const pc = await browser.newContext({ viewport: { width: w, height: 800 }, hasTouch: true, isMobile: true }), pp = await pc.newPage(), pe = []; h.collect(pp, pe);
      await pp.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(pp); await pp.waitForTimeout(1500);
      await pp.evaluate(() => document.getElementById('wh-strip').scrollIntoView({ block: 'center' })); await pp.tap('#ob > summary'); await until(pp, () => !document.getElementById('ob-bid').disabled);
      await pp.waitForTimeout(20500); const m = await obs(pp), sw = await pp.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
      check(`Handy ${w} px: „Kauf“/„Verkauf“ kurz, Alter kurz, nichts abgeschnitten, kein seitliches Scrollen`, m.bid.k === 'Kauf' && m.ask.k === 'Verkauf' && /^\d+ s$/.test(m.bid.a) && !m.bid.cut && !m.ask.cut && m.ask.right <= w && sw <= 0,
        JSON.stringify({ bid: [m.bid.k, m.bid.p, m.bid.d, m.bid.u, m.bid.a, m.bid.cut], ask: [m.ask.k, m.ask.p, m.ask.d, m.ask.u, m.ask.a, m.ask.cut], sw }));
      if (w === 390) await (await pp.$('#wh-strip')).screenshot({ path: __dirname + '/shots/m23-phone-390.png' });
      // Nebenbei (3.15.0): Liq-Heatmap-Knöpfe am Handy zweizeilig – vorher „66.560 · +4,1 % · 76 …“ abgeschnitten
      await until(pp, () => document.querySelectorAll('#lmap-strip .lm-val > span').length >= 2, null, 15000);
      const lmc = await pp.evaluate(() => [...document.querySelectorAll('#lmap-strip .lm-chip:not([hidden])')].map(b => { const sp = [...b.querySelectorAll('.lm-val > span')].filter(s => s.getClientRects().length > 0);
        return { lines: sp.map(s => s.textContent), cut: sp.some(s => s.scrollWidth > s.clientWidth + 1) || b.scrollWidth > b.clientWidth + 1, h: Math.round(b.getBoundingClientRect().height), right: Math.round(b.getBoundingClientRect().right) }; }));
      if (w === 390) await (await pp.$('#lmap-strip')).screenshot({ path: __dirname + '/shots/m23-lmap-390.png' });
      check(`Handy ${w} px: Liq-Heatmap-Knöpfe zweizeilig (Kurs, darunter Abstand · Menge), nichts abgeschnitten`, lmc.length === 2 && lmc.every(c => c.lines.length === 2 && /^[+−]\d/.test(c.lines[1]) && /(Tsd|Mio|Mrd)\.$/.test(c.lines[1]) && !c.cut && c.right <= w && c.h >= 43), JSON.stringify(lmc));
      check(`Handy ${w} px: keine Fehler`, !pe.length, pe.join(' | ')); await pc.close();
    }
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await browser.close(); await h.ctl('/walk?on=1').catch(() => {}); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
