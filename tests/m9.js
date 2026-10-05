// Speicher unter Dauerlast: 1.500 Trades/s über 2 Minuten, Arbeitsspeicher nach Garbage Collection vorher/nachher,
// Hausmeister räumt Kurse nicht mehr gebrauchter Symbole und Merker gelöschter Positionen ab. Aufruf: node m9.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const seed = ({ now }) => { if (localStorage.getItem('scalpdesk.savedat.v1')) return;
  // Alarm 0,9 % über dem Kurs: BTC liegt „nahe einer Marke“, das Dashboard wertet dann jeden einzelnen Trade aus
  localStorage.setItem('scalpdesk.alarms.v1', JSON.stringify([{ id: 'a1', symbol: 'BTCUSDT', dir: 'above', price: 64600, note: '', source: 'spot', createdAt: now, triggeredAt: null, triggerPrice: null }]));
};
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset'); await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=BTCUSDT&price=64000');
  const browser = await h.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); await ctx.addInitScript(seed, { now: Date.now() });
    const page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html');
    await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
    // Hausmeister: SOL laden und zurück zu BTC – SOL wird danach von nichts mehr gebraucht
    for (const s of ['SOL', 'BTC']) { await page.fill('#symbol', s); await page.press('#symbol', 'Enter'); await page.waitForFunction(s => document.getElementById('lb-sym').textContent === s, s, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(2500); }
    const m0 = await page.evaluate(() => window.__sdMem());
    const kept = await page.evaluate(() => window.__sdSweep(Date.now() + 11 * 60e3) >= 0 && window.__sdMem());
    check('Vor dem Aufräumen: Kurs von SOL noch im Speicher', m0.prices.includes('SOLUSDT'), m0.prices.join(','));
    check('Hausmeister: SOL nach 10 min ohne Bedarf entfernt, BTC (Chart + Alarm) bleibt', !kept.prices.includes('SOLUSDT') && !kept.liveTrack.includes('SOLUSDT') && kept.prices.includes('BTCUSDT'), `vorher ${m0.prices.length}, nachher ${kept.prices.join(',')}`);
    check('Kerzenreihe als Ringpuffer: höchstens 500 Kerzen', kept.candles > 0 && kept.candles <= 500, `${kept.candles} Kerzen`);
    // Dauerlast
    const st = await h.ctl('/state'), agg = st.conns.some(c => c.streams.includes('btcusdt@aggTrade'));
    check('Einzel-Trades von BTC abonniert (Kurs nahe am Alarm)', agg);
    await h.ctl('/flood?on=1&symbol=BTCUSDT&rate=1500');
    const cdp = await ctx.newCDPSession(page);
    const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); await h.sleep(300); await cdp.send('HeapProfiler.collectGarbage'); const { usedSize } = await cdp.send('Runtime.getHeapUsage'); return usedSize; };
    const nodes = () => page.evaluate(() => document.getElementsByTagName('*').length);
    await h.sleep(20000);
    const h1 = await heap(), n1 = await nodes(), p1 = await page.textContent('#lb-price');
    await h.sleep(100000);
    const h2 = await heap(), n2 = await nodes(), p2 = await page.textContent('#lb-price');
    await h.ctl('/flood?on=0');
    const mb = x => (x / 1048576).toFixed(1) + ' MB';
    check('2 Minuten mit 1.500 Trades/s: Arbeitsspeicher wächst nicht (unter 1,5 MB)', h2 - h1 < 1.5 * 1048576, `${mb(h1)} → ${mb(h2)} (${h2 >= h1 ? '+' : ''}${((h2 - h1) / 1024).toFixed(0)} KB)`);
    check('Keine wachsende Zahl an Seitenelementen', n2 - n1 <= 50, `${n1} → ${n2}`);
    check('Dabei durchgehend live (Kurs der Attrappe steht absichtlich still)', await page.evaluate(() => document.getElementById('status').dataset.feed) === 'live' && !!p1 && !!p2, `${p1} → ${p2}`);
    const m2 = await page.evaluate(() => window.__sdMem());
    check('Keine liegengebliebenen Alarm-Merker', !m2.alerted.length && !m2.rearmedAt.length && m2.ratingCache <= 4000, JSON.stringify({ alerted: m2.alerted.length, rearmed: m2.rearmedAt.length, rating: m2.ratingCache }));
    check('keine Fehler', !errors.length, errors.join(' | '));
    await ctx.close();
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await browser.close(); await h.ctl('/walk?on=1').catch(() => {}); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
