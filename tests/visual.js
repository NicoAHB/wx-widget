// Sichtprüfung einzelner Zustände + Kerzen-Auswahl bleibt bei Live-Updates erhalten
const h = require('./harness');
(async () => {
  await h.setup(); await h.ctl('/reset'); const b = await h.launch(), errors = [];
  try {
    const now = Date.now();
    const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });
    await ctx.addInitScript(({ now }) => { if (localStorage.getItem('scalpdesk.savedat.v1')) return;
      localStorage.setItem('scalpdesk.positions.v1', JSON.stringify([{ id: 'v1', symbol: 'BTCUSDT', side: 'long', mode: 'isolated', entry: 63500, leverage: 20, qty: 0.05, margin: 158.75, openedAt: now - 5400e3, source: 'spot', liqExchange: null, preRealized: -0.4, sl: 63000, tp: 65000, ack: { sl: false, tp: false }, setup: 'Ausbruch', note: 'Über Widerstand' }, { id: 'v2', symbol: 'XRPUSDT', side: 'short', mode: 'cross', entry: 1.49, leverage: 10, qty: 500, margin: 74.5, openedAt: now - 1800e3, source: 'spot', liqExchange: 1.62, preRealized: 0, sl: 1.53, tp: 1.42, ack: { sl: false, tp: false } }]));
      localStorage.setItem('scalpdesk.alarms.v1', JSON.stringify([{ id: 'va', symbol: 'ETHUSDT', dir: 'above', price: 2550, note: 'Ausbruch', source: 'spot', createdAt: now, triggeredAt: null, triggerPrice: null }])); }, { now });
    const p = await ctx.newPage(); h.collect(p, errors);
    await p.goto(h.URL_BASE + '/weather-widget-v2.html');
    await p.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 });
    await h.sleep(2000);
    // Kerze mit der Maus wählen, Live-Updates abwarten
    await p.locator('#chart').scrollIntoViewIfNeeded();
    const box = await p.$eval('#chart', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width * 0.3, y: r.top + r.height * 0.5 }; });
    await p.mouse.move(box.x, box.y); await h.sleep(300);
    const sel1 = await p.textContent('#ohlc'); await h.sleep(4500); const sel2 = await p.textContent('#ohlc');
    console.log('Auswahl bleibt:', sel1 === sel2 && /UTC · O/.test(sel2), '|', sel1.slice(0, 40));
    if (!(sel1 === sel2 && /UTC · O/.test(sel2))) throw new Error('Kerzenauswahl bei Live-Updates nicht erhalten');
    await p.mouse.move(5, 5);
    await p.click('#backup-badge'); await h.sleep(500);
    await p.screenshot({ path: __dirname + '/shots/v-desktop-panel.png' });
    await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=XRPUSDT&price=1.535'); await h.sleep(3000);
    await p.evaluate(() => document.getElementById('positions').scrollIntoView());
    await p.screenshot({ path: __dirname + '/shots/v-desktop-alert.png' });
    await p.click('#qr-export'); await p.fill('#qr-pass', 'geheim12'); await p.click('#qr-make');
    // Vollständige Journale können die Sicherung über die QR-Grenze bringen; die Exportansicht zeigt dann den ehrlichen Dateihinweis.
    await p.waitForFunction(() => !document.getElementById('qr-out').hidden || !document.getElementById('qr-big').hidden);
    console.log('QR-Exportansicht:', await p.textContent('#qr-calc'), await p.textContent('#qr-big-text')); await h.sleep(300);
    await p.screenshot({ path: __dirname + '/shots/v-desktop-qr.png' });
    await p.click('#qr-close');
    await p.click('#signals .tip > summary'); await h.sleep(200);
    await p.screenshot({ path: __dirname + '/shots/v-desktop-tip.png', clip: { x: 0, y: 0, width: 1600, height: 1000 } });
    await ctx.close();
  } finally { console.log(errors.join('\n') || 'no errors'); await b.close(); await h.teardown(); }
})();
