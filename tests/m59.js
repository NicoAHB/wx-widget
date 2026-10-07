// Optimierungen nach G09 – 4: Auswertung in R; 7: Trend-Ampel je Zeitebene.
// Optimierung 4: Auswertung in R – Erwartungswert je Trade in Vielfachen des Anfangsrisikos, je Grund/Coin/Uhrzeit,
// Anfangsrisiko (erster Stop) beim Anlegen festgehalten, Stop-Verschiebungen ändern es nicht. Aufruf: node m59.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + String(detail).slice(0, 600) : ''}`); };
const real = errs => errs.filter(e => !/Service Worker registration blocked|Failed to load resource|net::ERR/.test(e));
const trade = (id, sym, pnl, closedAt, extra = {}) => ({ id, symbol: sym, side: 'long', mode: 'isolated', entry: 100, leverage: 10, qty: 1, margin: 10, openedAt: closedAt - 3600e3, source: 'spot', liqExchange: null, preRealized: 0, sl: null, tp: null, ack: { sl: false, tp: false }, note: '', exit: 100 + pnl, fees: 0, pnl, pnlSource: 'calc', closedAt, fx: 0.92, ...extra });
(async () => {
  await h.setup(); await h.ctl('/reset'); const browser = await h.launch();
  try {
    const T0 = Date.now() - 3 * 864e5;
    const seed = { 'scalpdesk.history.v1': [
      trade('A1', 'ETHUSDT', 4, T0, { sl: 98, reasons: ['Ausbruch'] }),                                          // Stop beim Schluss: Risiko 2 → +2 R
      trade('A2', 'ETHUSDT', -5, T0 + 36e5, { sl: 100, r0: { sl: 95, entry: 100, qty: 2, at: T0 - 9e6 }, reasons: ['Ausbruch'] }), // r0 vor Stop auf Einstand: Risiko 10 → −0,5 R
      trade('A3', 'SOLUSDT', 3, T0 + 72e5, { side: 'short', sl: 102, reasons: ['Trendfolge'] }),                  // Short: Risiko 2 → +1,5 R
      trade('A4', 'SOLUSDT', 1, T0 + 108e5, { sl: 100, reasons: ['Trendfolge'] })] };                             // Stop auf Einstand, kein r0 → ohne R
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, timezoneId: 'Europe/Berlin' }), errors = [];
    await ctx.addInitScript(items => { if (localStorage.getItem('seeded59')) return; localStorage.setItem('seeded59', '1'); for (const [k, v] of items) localStorage.setItem(k, JSON.stringify(v)); }, Object.entries(seed));
    const page = await ctx.newPage(); h.collect(page, errors); await page.goto(`${h.URL_BASE}/weather-widget-v2.html`); await page.waitForTimeout(1500);
    const u = await page.evaluate(() => { const t = JSON.parse(localStorage.getItem('scalpdesk.history.v1')); const R = id => __opt4.tradeR(t.find(x => x.id === id)); return { a1: R('A1'), a2: R('A2'), a3: R('A3'), a4: R('A4'), part: __opt4.tradeR({ side: 'long', entry: 100, sl: 98, qty: 1, pnl: 4, part: { pos: 'P' } }) }; });
    check('R je Trade: Stop beim Schluss (+2), Anfangsrisiko r0 vor nachgezogenem Stop (−0,5), Short (+1,5); Stop auf Einstand oder Teilschluss ohne r0 → ohne R', u.a1 === 2 && u.a2 === -0.5 && u.a3 === 1.5 && u.a4 === null && u.part === null, JSON.stringify(u));
    // Optimierung 7: Trend-Ampel 5m · 15m · 1h · 4h · 1d über dem Chart
    const mc = await page.evaluate(() => { const up = Array.from({ length: 260 }, (_, i) => 100 + i), dn = up.slice().reverse(); return { up: __opt7.calc(up, 400)?.t, down: __opt7.calc(dn, 50)?.t, mix: __opt7.calc(up, 300)?.t, few: __opt7.calc(up.slice(0, 150), 300) }; });
    check('Trend-Regel: Kurs > EMA 50 > EMA 200 → ▲, Kurs < EMA 50 < EMA 200 → ▼, sonst ◆; unter 200 Kerzen keine Aussage', mc.up === 'up' && mc.down === 'down' && mc.mix === 'mix' && mc.few === null, JSON.stringify(mc));
    await page.waitForFunction(() => document.querySelectorAll('#mtf .mtf-c').length === 5 && ![...document.querySelectorAll('#mtf .mtf-c')].some(c => /…$/.test(c.textContent)), null, { timeout: 15000 }).catch(() => {});
    const mt = await page.evaluate(() => ({ chips: [...document.querySelectorAll('#mtf .mtf-c')].map(c => [c.textContent, c.className.split(' ')[1], c.title]), y: [document.querySelector('.chart-toolbar').getBoundingClientRect().bottom, document.getElementById('mtf').getBoundingClientRect().top, document.getElementById('chart').getBoundingClientRect().top] }));
    const lg = (await h.ctl('/log')).filter(e => /klines$/.test(e.path || '') && e.q.symbol === 'BTCUSDT' && e.q.limit === '261').map(e => e.q.interval);
    check('Ampel über dem Chart: 5 Zeitebenen mit ▲/▼/◆, Erklärung je Zeitebene; je Zeitebene einmal 261 Kerzen geladen', mt.chips.map(c => c[0].split(' ')[0]).join() === '5m,15m,1h,4h,1d' && mt.chips.every(c => /^\S+ [▲▼◆]$/.test(c[0]) && /EMA 50/.test(c[2])) && mt.y[0] <= mt.y[1] && mt.y[1] < mt.y[2] && ['5m', '15m', '1h', '4h', '1d'].every(iv => lg.filter(x => x === iv).length === 1), JSON.stringify({ chips: mt.chips.map(c => c[0]), lg }));
    await page.evaluate(() => { document.querySelector('[data-tab="pos"]')?.click(); const d = document.getElementById('analysis'); d.open = true; d.dispatchEvent(new Event('toggle')); }); await page.waitForTimeout(800);
    const v = await page.evaluate(() => { const k = [...document.querySelectorAll('#analysis-kpis > div')].filter(d => /Erwartungswert/.test(d.textContent)).map(d => `${d.querySelector('strong').textContent} | ${d.querySelector('small').textContent}`)[0] || '';
      const tab = {}; for (const bd of document.querySelectorAll('#breakdowns .bd')) tab[bd.querySelector('h4').textContent] = [...bd.querySelectorAll('.bd-row')].map(r => [...r.querySelectorAll(':scope > span')].slice(0, 4).map(s => s.textContent).join('|'));
      return { k, grund: tab['Nach Grund'] || [], coin: tab['Nach Coin'] || [], thin: document.querySelectorAll('#breakdowns .bd-row.thin').length, note: [...document.querySelectorAll('#breakdowns .bd-note')].map(n => n.textContent).join(' ') }; });
    check('Kennzahl „Erwartungswert je Trade“: USDT und R (Mittel aus 3 von 4 Trades), Ø Gewinn/Verlust in R, „vorläufig (unter 30 Trades)“', /^\+0,75 USDT · \+1,00 R \| /.test(v.k) && /R aus 3 von 4 Trades · Ø Gewinn \+1,75 R \/ Ø Verlust −0,50 R · vorläufig \(unter 30 Trades\)/.test(v.k), v.k);
    check('Tabellen mit Spalte „Ø R“: Ausbruch +0,75 R (2 von 2), Trendfolge +1,50 R nur aus 1 von 2 („·1“)', v.grund[0] === '|Trades|Treffer|Ø R' && v.grund.includes('Ausbruch|2|50 %|+0,75') && v.grund.includes('Trendfolge|2|100 %|+1,50·1'), JSON.stringify(v.grund));
    check('Gruppen unter 30 Trades gedämpft, Erklärung zu Ø R und „vorläufig“', v.thin > 0 && /Ø R = Erwartungswert je Trade in Vielfachen des Anfangsrisikos/.test(v.note) && /unter 30 Trades – vorläufig/.test(v.note), v.note.slice(0, 200));
    // Optimierung 5: „i“ an der Kennzahl – Erklärung und Beurteilung der aktuellen Zahlen
    await page.click('#analysis-kpis .ev-tip summary'); await page.waitForTimeout(300);
    const tip = await page.evaluate(() => { const b = document.querySelector('#analysis-kpis .ev-tip .tip-body'); return { open: document.querySelector('#analysis-kpis .ev-tip').open, t: b?.textContent || '', vis: !!b && b.getBoundingClientRect().width > 0 }; });
    check('„i“ an „Erwartungswert je Trade“: erklärt R und Erwartungswert, beurteilt die aktuellen Zahlen (positiv, vorläufig), Gründe-Vergleich erst ab 5 Trades je Grund', tip.open && tip.vis && /R = Ergebnis eines Trades ÷ sein Anfangsrisiko/.test(tip.t) && /Aktuell: \+1,00 R je Trade aus 3 Trades – positiv/.test(tip.t) && /Vorläufig – erst 3 von 30 Trades/.test(tip.t) && /mindestens zwei Gründe mit je 5 Trades/.test(tip.t) && /keine Garantie/.test(tip.t), tip.t.slice(0, 300));
    await page.click('#analysis-kpis .ev-tip summary');
    // Anfangsrisiko beim Anlegen festhalten; späteres Nachziehen des Stops ändert es nicht
    await page.evaluate(() => document.getElementById('pos-add-toggle').scrollIntoView()); await page.click('#pos-add-toggle'); await page.fill('#pos-symbol', 'XRP'); await page.click('[data-lev-for="pos-lev"] [data-lev="10"]');
    await page.fill('#pos-qty', '100'); await page.fill('#pos-entry', '1,5'); await page.fill('#pos-sl', '1,45'); await page.click('#pos-save'); await page.waitForSelector('.pos-card', { timeout: 8000 });
    const p1 = await page.evaluate(() => JSON.parse(localStorage.getItem('scalpdesk.positions.v1')).find(p => p.symbol === 'XRPUSDT'));
    check('Neue Position mit Stop: Anfangsrisiko r0 (Stop 1,45, Einstieg 1,5, Menge 100) gespeichert', p1?.r0 && p1.r0.sl === 1.45 && p1.r0.entry === 1.5 && p1.r0.qty === 100, JSON.stringify(p1?.r0));
    await page.click('.pos-card [data-action="edit"]'); await page.waitForTimeout(500);
    await page.fill('#pos-sl', '1,48'); await page.click('#pos-save'); await page.waitForTimeout(800);
    const p2 = await page.evaluate(() => JSON.parse(localStorage.getItem('scalpdesk.positions.v1')).find(p => p.symbol === 'XRPUSDT'));
    check('Stop nachgezogen (1,45 → 1,48): Stop geändert, Anfangsrisiko r0 unverändert', p2?.sl === 1.48 && JSON.stringify(p2.r0) === JSON.stringify(p1.r0), JSON.stringify({ sl: p2?.sl, r0: p2?.r0 }));
    // Optimierung 6: Gelerntes bleibt – eigener Speicher, übersteht „Zurücksetzen“ und Neuladen, steckt in der Sicherung
    const l0 = await page.evaluate(() => ({ n: Object.keys(JSON.parse(localStorage.getItem('scalpdesk.rlearn.v1') || '{}').t || {}).length, bk: Object.keys(__g05.backupPayload().rlearn?.t || {}).length }));
    check('Lernspeicher: 4 geschlossene Positionen festgehalten, auch in der Sicherung', l0.n === 4 && l0.bk === 4, JSON.stringify(l0));
    await page.evaluate(() => document.getElementById('reset-go').click()); await page.waitForTimeout(800);
    await page.reload(); await page.waitForTimeout(1500);
    await page.evaluate(() => { document.querySelector('[data-tab="pos"]')?.click(); const d = document.getElementById('analysis'); d.open = true; d.dispatchEvent(new Event('toggle')); }); await page.waitForTimeout(600);
    const l1 = await page.evaluate(() => ({ trades: JSON.parse(localStorage.getItem('scalpdesk.history.v1') || '[]').length, n: Object.keys(JSON.parse(localStorage.getItem('scalpdesk.rlearn.v1') || '{}').t || {}).length, kp: document.getElementById('analysis-kpis').textContent, reset: document.querySelector('#reset-dialog').textContent }));
    check('Nach „Zurücksetzen“ und Neuladen: Journal leer, Gelerntes bleibt (4 Trades · +1,00 R sichtbar), Dialog nennt es unter „Erhalten bleiben“', l1.trades === 0 && l1.n === 4 && /Gelernt \(bleibt nach „Zurücksetzen“\)4 Trades · \+1,00 R/.test(l1.kp) && /Erhalten bleiben:.*das Gelernte aus deinen Trades/.test(l1.reset), JSON.stringify({ trades: l1.trades, n: l1.n, kp: l1.kp.slice(0, 120) }));
    check('keine Fehler', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
