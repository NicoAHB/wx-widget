// 3.16.1 – Handy: kein automatischer Tastatur-Fokus beim Öffnen von Positions- und Alarm-Formular; untere Tab-Leiste bei
// offener Bildschirmtastatur ausgeblendet (statt über dem Formular zu schweben), danach wieder fest unten; iPad mit
// Hardware-Tastatur: Leiste bleibt; Computer: Fokus wie bisher; Live-Leiste: Tagesergebnis auch in Euro, nichts abgeschnitten.
// Die Bildschirmtastatur wird nachgestellt, indem der sichtbare Bereich (visualViewport) schrumpft. Aufruf: node m25.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
// heute geschlossener Trade mit +12,50 USDT (für den Euro-Wert in der Live-Leiste)
const seedTrade = now => { if (localStorage.getItem('scalpdesk.savedat.v1')) return;
  localStorage.setItem('scalpdesk.history.v1', JSON.stringify([{ id: 't1', symbol: 'BTCUSDT', side: 'long', mode: 'isolated', entry: 64000, leverage: 10, qty: 0.01, margin: 64, openedAt: now - 7200e3, source: 'spot', liqExchange: null, preRealized: 0, sl: null, tp: null, exit: 65250, fees: 0, pnl: 12.5, pnlSource: 'manual', closedAt: now - 600e3, fx: 1.164, note: '' }])); };
const st = page => page.evaluate(() => { const t = document.getElementById('tabbar'), a = document.activeElement;
  return { shown: getComputedStyle(t).display !== 'none' && getComputedStyle(t).visibility !== 'hidden', kbd: document.documentElement.dataset.kbd || '', focus: a ? (a.id || a.tagName) : '', typing: !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) }; });
// Bildschirmtastatur nachstellen: sichtbarer Bereich halb so hoch (wie am iPhone) bzw. wieder normal
const kbd = (page, on) => page.evaluate(on => { const vv = visualViewport; if (on) Object.defineProperty(vv, 'height', { configurable: true, get: () => Math.round(innerHeight * 0.5) }); else delete vv.height; vv.dispatchEvent(new Event('resize')); }, on);
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset'); await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=EURUSDT&price=1.164'); // fester Euro-Kurs
  const browser = await h.launch();
  try {
    // ---------- Handy ----------
    const pc = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), p = await pc.newPage(), pe = []; h.collect(p, pe);
    await p.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(p); await p.waitForTimeout(1500);
    await p.tap('#tabbar [data-tab="pos"]'); await p.waitForTimeout(500); await p.tap('#pos-add-toggle'); await p.waitForTimeout(700);
    let s = await st(p);
    check('Handy: „+ Position erfassen“ öffnet das Formular ohne Tastatur (kein Feld fokussiert), Leiste unten sichtbar', !(await p.$eval('#pos-form', f => f.hidden)) && !s.typing && s.shown && !s.kbd, JSON.stringify(s));
    await p.tap('#pos-chips [data-poschip]'); await p.waitForTimeout(400); s = await st(p);
    check('Handy: Coin im Formular antippen öffnet ebenfalls keine Tastatur', !s.typing, JSON.stringify(s));
    // Feld antippen, Tastatur geht auf: Leiste weg; nächstes Feld (∨ in der Tastaturleiste): bleibt weg, kein Flackern
    await kbd(p, true); await p.tap('#pos-qty'); await p.waitForTimeout(900); s = await st(p);
    check('Feld antippen: Tastatur offen, untere Leiste ausgeblendet', s.typing && s.focus === 'pos-qty' && !s.shown && s.kbd === '1', JSON.stringify(s));
    const seen = []; await p.focus('#pos-entry'); for (const ms of [30, 120, 300]) { await p.waitForTimeout(ms); seen.push((await st(p)).shown); }
    check('Nächstes Feld: Leiste bleibt weg (kein Aufblitzen)', seen.every(v => !v), JSON.stringify(seen));
    // Tastatur zu (✓ in der Tastaturleiste): Leiste wieder fest unten
    await p.evaluate(() => document.activeElement.blur()); await kbd(p, false); await p.waitForTimeout(400); s = await st(p);
    const bar = await p.evaluate(() => { const r = document.getElementById('tabbar').getBoundingClientRect(); return { bottom: Math.round(r.bottom), vh: innerHeight }; });
    check('Tastatur zu: Leiste wieder da, fest am unteren Rand', s.shown && !s.kbd && Math.abs(bar.bottom - bar.vh) <= 1, JSON.stringify({ ...s, ...bar }));
    // beim Scrollen bleibt sie unten (fest, nicht mit dem Inhalt)
    await p.evaluate(() => scrollBy(0, 600)); await p.waitForTimeout(300);
    const bar2 = await p.evaluate(() => Math.round(document.getElementById('tabbar').getBoundingClientRect().bottom));
    check('Beim Scrollen bleibt die Leiste unten', Math.abs(bar2 - bar.vh) <= 1, `${bar2} / ${bar.vh}`);
    // Alarm-Formular („+ Kurs-Alarm“ im Tab Chart) öffnet keine Tastatur
    await p.tap('#tabbar [data-tab="chart"]'); await p.waitForTimeout(500);
    await p.evaluate(() => document.getElementById('alarm-toggle').scrollIntoView({ block: 'center' })); await p.tap('#alarm-toggle'); await p.waitForTimeout(700); s = await st(p);
    check('Handy: „+ Kurs-Alarm“ öffnet das Formular ohne Tastatur', !(await p.$eval('#alarm-form', f => f.hidden)) && !s.typing && s.shown, JSON.stringify(s));
    check('Handy: keine Fehler', !pe.length, pe.join(' | ')); await pc.close();
    // ---------- iPad mit Hardware-Tastatur: sichtbarer Bereich schrumpft nicht, Leiste bleibt ----------
    const tc = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true }), t = await tc.newPage(), te = []; h.collect(t, te);
    await t.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(t); await t.waitForTimeout(1500);
    await t.tap('#tabbar [data-tab="pos"]'); await t.waitForTimeout(500); await t.tap('#pos-add-toggle'); await t.waitForTimeout(600);
    const t0 = await st(t); await t.tap('#pos-qty'); await t.waitForTimeout(1000); const t1 = await st(t);
    check('iPad: Formular öffnet ohne Tastatur; mit Hardware-Tastatur bleibt die Leiste beim Tippen sichtbar', !t0.typing && t1.typing && t1.shown && !t1.kbd, JSON.stringify({ vorher: t0, getippt: t1 }));
    check('iPad: keine Fehler', !te.length, te.join(' | ')); await tc.close();
    // ---------- Computer: Fokus wie bisher; Euro-Wert in der Live-Leiste ----------
    for (const w of [1440, 1280, 1100, 1000]) {
      const dc = await browser.newContext({ viewport: { width: w, height: 900 } }); await dc.addInitScript(seedTrade, Date.now());
      const d = await dc.newPage(), de = []; h.collect(d, de); await d.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(d); await d.waitForTimeout(2000);
      const lb = await d.evaluate(() => { const g = id => document.getElementById(id), p = document.querySelector('.livebar .lb-pos'), vis = e => !!e && e.getClientRects().length > 0;
        return { usdt: g('lb-day').textContent, eur: g('lb-day-eur').textContent, vis: vis(g('lb-day-eur')), cut: p.scrollWidth > p.clientWidth + 1, right: Math.round(p.getBoundingClientRect().right), vw: innerWidth, fx: document.getElementById('price-eur')?.textContent || '' }; });
      if (w === 1440) {
        // 3.31.0 (G03): „Heute“ in Euro aus dem eingefrorenen Wert des Trades (Kurs 1,164 beim Abschluss) – genau, daher ohne „≈“
        check('Computer: Live-Leiste „Heute +12,50 USDT (+10,74 €)“', lb.usdt === '+12,50 USDT' && lb.eur === '(+10,74 €)' && lb.vis, JSON.stringify(lb));
        await d.click('#pos-add-toggle'); await d.waitForTimeout(500); const f1 = await st(d);
        await d.click('#alarm-toggle'); await d.waitForTimeout(700); const f2 = await st(d);
        check('Computer: Formulare setzen den Cursor wie bisher gleich ins Feld (Größe bzw. Alarm-Kurs)', f1.focus === 'pos-qty' && f2.focus === 'al-price', JSON.stringify({ position: f1.focus, alarm: f2.focus }));
        await (await d.$('#livebar')).screenshot({ path: __dirname + '/shots/m25-livebar-1440.png' });
      }
      check(`Computer ${w} px: Euro-Wert ${w >= 1000 ? 'sichtbar, ' : ''}nichts abgeschnitten`, lb.vis && !lb.cut && lb.right <= lb.vw, JSON.stringify(lb));
      check(`Computer ${w} px: keine Fehler`, !de.length, de.join(' | ')); await dc.close();
    }
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await browser.close(); await h.ctl('/walk?on=1').catch(() => {}); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
