// Schritt 3.2 (3.16.0) – RSI-Divergenz: Leuchten im Chart (grün/rot, pulsiert solange neu), Hinweis-Knopf rechts in der
// OHLC-Zeile, Erklärung mit aktuellem Fall, Handlungsleitfaden, Alarm am Extrempunkt und ehrlichem Backtest; gesehen =
// ruhiges Leuchten (auch nach dem Neuladen); „Bewegung reduzieren“ ohne Pulsieren; Vollbild; iPad; Handy. Aufruf: node m24.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
const load = async (page, sym) => { await page.fill('#symbol', sym); await page.press('#symbol', 'Enter'); await page.waitForFunction(s => document.getElementById('lb-sym').textContent === s, sym, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(1500); };
const zz1 = ctx => ctx.addInitScript(() => { if (!localStorage.getItem('scalpdesk.zigzag.v1')) localStorage.setItem('scalpdesk.zigzag.v1', JSON.stringify({ pct: 1 })); });
const obs = page => page.evaluate(() => {
  const g = id => document.getElementById(id), box = g('div-tip'), sum = box.querySelector('summary'), body = box.querySelector('.tip-body'), vis = e => !!e && e.getClientRects().length > 0;
  const grp = [...document.querySelectorAll('#chart svg .rsi-div')], halo = document.querySelector('#chart svg .rsi-div-halo'), row = document.querySelector('.ohlc-row'), ohlc = g('ohlc');
  const r = vis(sum) ? sum.getBoundingClientRect() : null, rr = row.getBoundingClientRect(), o = ohlc.getBoundingClientRect(), br = box.open && vis(body) ? body.getBoundingClientRect() : null;
  return { hidden: box.hidden, open: box.open, cls: box.className, chip: [...sum.querySelectorAll('b')].filter(vis).map(e => e.textContent).join(''), aria: sum.getAttribute('aria-label'),
    anim: vis(sum) ? getComputedStyle(box, '::after').animationName : '', shadow: vis(sum) ? getComputedStyle(sum).boxShadow : '', color: vis(sum) ? getComputedStyle(sum).color : '',
    chipR: r && { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), h: Math.round(r.height), cut: sum.scrollWidth > sum.clientWidth + 1 },
    rowR: { l: Math.round(rr.left), r: Math.round(rr.right), t: Math.round(rr.top), h: Math.round(rr.height) }, ohlcR: { r: Math.round(o.right), h: Math.round(o.height) }, chartTop: Math.round(g('chart').getBoundingClientRect().top),
    ov: (() => { const o = g('div-halo'), b = o.firstElementChild, r = o.getBoundingClientRect(), hr = halo?.getBoundingClientRect(); return { hidden: o.hidden, disp: getComputedStyle(o).display, anim: getComputedStyle(b).animationName, delay: getComputedStyle(o).getPropertyValue('--div-delay').trim(), dx: hr ? Math.round(r.left - (hr.left + hr.width / 2)) : null, dy: hr ? Math.round(r.top - (hr.top + hr.height / 2)) : null }; })(),
    groups: grp.map(e => e.getAttribute('class')), halo: !!halo, haloAnim: halo ? getComputedStyle(halo).animationName : '', haloDelay: halo ? halo.style.animationDelay : '', glow: !!document.querySelector('#chart svg .rsi-div-glow'),
    label: document.querySelector('#chart .rsi-div-label')?.textContent || '',
    body: br && { l: Math.round(br.left), r: Math.round(br.right), t: Math.round(br.top), b: Math.round(br.bottom) }, vw: innerWidth, vh: innerHeight, sw: document.scrollingElement.scrollWidth, navTop: g('tabbar')?.getClientRects().length ? Math.round(g('tabbar').getBoundingClientRect().top) : innerHeight,
    title: g('div-title').textContent, kase: g('div-case').textContent, tent: g('div-tent').hidden ? '' : g('div-tent').textContent, steps: [...box.querySelectorAll('.div-steps li')].map(e => e.textContent),
    honest: box.querySelector('.div-honest').textContent, text: body.textContent, alarm: g('div-alarm').textContent, alarmPrice: g('div-alarm').dataset.price };
});
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  for (const [sym, kind] of [['XRPUSDT', 'bull'], ['SOLUSDT', 'bear'], ['ETCUSDT', 'none'], ['LTCUSDT', 'open']]) await h.ctl(`/shape?symbol=${sym}&interval=1m&kind=${kind}`);
  const browser = await h.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); await zz1(ctx);
    const page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page);
    await load(page, 'ETC'); const none = await obs(page);
    check('Ohne Divergenz (ETC): kein Hinweis-Knopf, kein Leuchten', none.hidden && !none.groups.length && !none.halo, JSON.stringify({ hidden: none.hidden, groups: none.groups }));
    await load(page, 'XRP'); let d = await obs(page);
    check('Bullisch (XRP): Knopf „▲ RSI-Divergenz“ rechts in der OHLC-Zeile, grün, pulsiert', !d.hidden && d.chip === '▲ RSI-Divergenz' && /\bbull\b/.test(d.cls) && /\bpulse\b/.test(d.cls) && d.anim === 'div-ring' && d.chipR.r <= d.rowR.r && d.chipR.l > d.ohlcR.r - 2 && d.chipR.t >= d.rowR.t,
      JSON.stringify({ chip: d.chip, cls: d.cls, anim: d.anim, chipR: d.chipR, row: d.rowR, ohlcR: d.ohlcR }));
    check('Chart: Lichthof am jüngsten Tief pulsiert (eigenes Element genau über dem Punkt, phasengleich), ruhiges Leuchten im SVG', d.groups.length === 1 && /\bpulse\b/.test(d.groups[0]) && d.halo && d.haloAnim === 'none' && d.glow && !d.ov.hidden && d.ov.disp !== 'none' && d.ov.anim === 'div-halo' && /^-\d/.test(d.ov.delay) && Math.abs(d.ov.dx) <= 1 && Math.abs(d.ov.dy) <= 1,
      JSON.stringify({ groups: d.groups, svgHalo: d.haloAnim, ov: d.ov }));
    const green = d.color;
    // Öffnen: Erklärung mit aktuellem Fall, Leitfaden, Alarm-Knopf und ehrlichem Backtest
    await page.evaluate(() => document.getElementById('chart-sec').scrollIntoView({ block: 'start' })); await page.waitForTimeout(300);
    await page.click('#div-tip > summary'); await page.waitForTimeout(400); d = await obs(page);
    const rsi = d.label.match(/RSI (\d+)→(\d+)/), kase = d.kase.match(/RSI 14: höheres Tief (\d+) → (\d+)/);
    check('Erklärung öffnet über der Seite, ganz im Fenster', d.open && d.body && d.body.l >= 0 && d.body.r <= d.vw && d.body.t >= 0 && d.body.b <= d.vh, JSON.stringify(d.body));
    check('Aktueller Fall: „▲ Bullische RSI-Divergenz · 1m“, tieferes Tief und RSI wie im Chart', d.title === '▲ Bullische RSI-Divergenz · 1m' && /^Kurs: tieferes Tief [\d.,]+ → [\d.,]+/.test(d.kase) && rsi && kase && rsi[1] === kase[1] && rsi[2] === kase[2] && /Verkaufsdruck lässt nach/.test(d.kase),
      JSON.stringify({ title: d.title, kase: d.kase, label: d.label }));
    const low = d.kase.match(/→ ([\d.,]+)/)[1];
    check('Leitfaden: kein Einstiegssignal, Tief beachten (Kurs), Short-Position, Risiko', d.steps.length === 4 && /^Kein Einstiegssignal\./.test(d.steps[0]) && d.steps[1].startsWith(`Achte auf das Tief ${low}.`) && /^Offene Short-Position\?/.test(d.steps[2]) && /nicht geprüft/.test(d.steps[2]) && /Positionsrechner/.test(d.steps[3]) && /Signal-Übersicht/.test(d.steps[3]),
      JSON.stringify(d.steps.map(s => s.slice(0, 60))));
    check('Ehrlich: 48–51 %, Verlust nach Gebühren, Warten half nicht (44–48 %, 21–39 %), keine Trefferquote, kein Signal', /48–51 %/.test(d.honest) && /Verlust/.test(d.honest) && /44–48 %/.test(d.honest) && /21–39 %/.test(d.honest) && /keine Trefferquote und kein Kauf- oder Verkaufssignal/.test(d.honest), d.honest.slice(0, 120));
    const pcts = (d.text.match(/\d+(?:,\d+)?\s?%/g) || []).filter(p => !/^(1|0,06)\s?%$/.test(p));
    check('Sonst keine Prozentzahlen als Erfolgsquote in der Erklärung', pcts.every(p => /^(48|51|44|21|39|25|47)/.test(p) || /^−/.test(p)), JSON.stringify(pcts));
    check('Nach dem Öffnen: gesehen – Knopf und Chart leuchten ruhig (kein Pulsieren mehr)', !/\bpulse\b/.test(d.cls) && d.anim === 'none' && /rgb/.test(d.shadow) && d.halo && d.ov.hidden && !d.groups.some(c => /\bpulse\b/.test(c)), JSON.stringify({ cls: d.cls, anim: d.anim, ov: d.ov, groups: d.groups }));
    // Alarm am Tief
    await page.click('#div-alarm'); await page.waitForTimeout(500);
    const f = await page.evaluate(() => ({ open: !document.getElementById('alarm-form').hidden, price: document.getElementById('al-price').value, note: document.getElementById('al-note').value, tip: document.getElementById('div-tip').open }));
    const num = t => Number(String(t).replace(/\./g, '').replace(',', '.'));
    check('„Alarm am Tief“: Erklärung schließt, Alarm-Formular mit dem Tief und Notiz', d.alarm === `🔔 Alarm am Tief ${low}` && f.open && !f.tip && Math.abs(num(f.price) / Number(d.alarmPrice) - 1) < 1e-9 && Math.abs(num(low) / Number(d.alarmPrice) - 1) < 1e-4 && f.note === 'RSI-Divergenz: Tief (1m)', JSON.stringify({ btn: d.alarm, soll: d.alarmPrice, ...f }));
    await page.click('#al-cancel').catch(() => {});
    // Schließen per Escape und per Klick daneben
    await page.click('#div-tip > summary'); await page.waitForTimeout(300); await page.keyboard.press('Escape'); await page.waitForTimeout(200); const esc = await obs(page);
    await page.click('#div-tip > summary'); await page.waitForTimeout(300); await page.click('#signals-title'); await page.waitForTimeout(300); const out = await obs(page);
    check('Schließt mit Escape und per Klick daneben', !esc.open && !out.open, JSON.stringify({ esc: esc.open, daneben: out.open }));
    // Gesehen bleibt nach dem Neuladen: kein Pulsieren, aber Leuchten
    await page.reload(); await live(page); await load(page, 'XRP'); d = await obs(page); // nach dem Neuladen startet die App mit BTC
    check('Nach dem Neuladen: dieselbe Divergenz pulsiert nicht wieder, leuchtet aber', !d.hidden && !/\bpulse\b/.test(d.cls) && d.halo && d.ov.hidden, JSON.stringify({ hidden: d.hidden, cls: d.cls, ov: d.ov.hidden }));
    // Bärisch: rot, Spiegelbild im Text
    await load(page, 'SOL'); d = await obs(page); const red = d.color;
    await page.click('#div-tip > summary'); await page.waitForTimeout(400); const b2 = await obs(page); await page.keyboard.press('Escape');
    check('Bärisch (SOL): „▼ RSI-Divergenz“ rot, pulsiert; Erklärung höheres Hoch / tieferes Hoch, Long-Position', d.chip === '▼ RSI-Divergenz' && /\bbear\b/.test(d.cls) && /\bpulse\b/.test(d.cls) && red !== green && b2.title === '▼ Bärische RSI-Divergenz · 1m' && /höheres Hoch/.test(b2.kase) && /tieferes Hoch/.test(b2.kase) && /Kaufdruck lässt nach/.test(b2.kase) && /^Offene Long-Position\?/.test(b2.steps[2]) && /^Achte auf das Hoch /.test(b2.steps[1]),
      JSON.stringify({ chip: d.chip, cls: d.cls, title: b2.title, color: red }));
    // Vorläufig
    await load(page, 'LTC'); await page.click('#div-tip > summary'); await page.waitForTimeout(400); d = await obs(page); await page.keyboard.press('Escape');
    check('Vorläufig (LTC): Titel „· vorläufig“, Hinweis „noch nicht bestätigt“', /· vorläufig$/.test(d.title) && /noch nicht bestätigt \(ZigZag 1 %\)/.test(d.tent), JSON.stringify({ title: d.title, tent: d.tent }));
    // Ebene aus: kein Knopf, kein Leuchten; wieder an
    await load(page, 'XRP'); await page.click('[data-overlay="div"]'); await page.waitForTimeout(900); const off = await obs(page);
    await page.click('[data-overlay="div"]'); await page.waitForTimeout(900); const on = await obs(page);
    check('Ebene „RSI-Div.“ aus: kein Knopf, kein Leuchten; wieder an: beides zurück', off.hidden && !off.halo && !on.hidden && on.halo, JSON.stringify({ aus: [off.hidden, off.halo], an: [on.hidden, on.halo] }));
    check('Kein Springen: OHLC-Zeile und Chart gleich hoch mit und ohne Hinweis-Knopf', off.rowR.h === on.rowR.h && off.chartTop === on.chartTop, JSON.stringify({ ohne: [off.rowR.h, off.chartTop], mit: [on.rowR.h, on.chartTop] }));
    // Vollbild: Knopf nur bei aufgeklappten Werkzeugen, Leuchten im Chart
    await page.click('#chart-full'); await page.waitForTimeout(800); const fz = await obs(page);
    await page.click('#fb-tools'); await page.waitForTimeout(600); const fo = await obs(page);
    check('Vollbild: Leuchten im Chart; Knopf nur bei aufgeklappten Werkzeugen', fz.halo && !fz.chipR && fo.chipR && fo.chipR.r <= fo.vw, JSON.stringify({ zu: fz.chipR, offen: fo.chipR }));
    await page.click('#fb-exit'); await page.waitForTimeout(400);
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
    // „Bewegung reduzieren“: leuchtet ohne Pulsieren (neuer Browser-Speicher: Divergenz ist neu)
    const rc = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }); await zz1(rc);
    const rp = await rc.newPage(), re = []; h.collect(rp, re); await rp.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(rp); await load(rp, 'XRP'); const rm = await obs(rp);
    check('„Bewegung reduzieren“: neue Divergenz leuchtet, pulsiert aber nicht', !rm.hidden && /\bpulse\b/.test(rm.cls) && rm.anim === 'none' && /rgb/.test(rm.shadow) && rm.halo && rm.ov.disp === 'none', JSON.stringify({ cls: rm.cls, anim: rm.anim, ov: rm.ov }));
    check('„Bewegung reduzieren“: keine Fehler', !re.length, re.join(' | ')); await rc.close();
    // iPad: Alarm über den Schnell-Alarm
    const tc = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true }); await zz1(tc);
    const tp = await tc.newPage(), te = []; h.collect(tp, te); await tp.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(tp); await load(tp, 'XRP');
    await tp.evaluate(() => document.getElementById('chart').scrollIntoView({ block: 'center' })); await tp.waitForTimeout(500);
    const ti = await obs(tp); await tp.tap('#div-tip > summary'); await tp.waitForTimeout(500); const to = await obs(tp); await tp.tap('#div-alarm'); await tp.waitForTimeout(600);
    const qa = await tp.evaluate(() => ({ open: document.getElementById('qa-dialog').open, price: document.getElementById('qa-price').value, prev: document.getElementById('qa-preview').textContent }));
    check('iPad: Knopf fingergroß, Erklärung im Fenster, Alarm öffnet den Schnell-Alarm am Tief', ti.chipR.h >= 34 && to.open && to.body.r <= to.vw && to.body.l >= 0 && qa.open && Math.abs(Number(qa.price.replace(/\./g, '').replace(',', '.')) / Number(to.alarmPrice) - 1) < 1e-9 && /🧲 RSI-Divergenz/.test(qa.prev),
      JSON.stringify({ h: ti.chipR.h, body: to.body, ...qa, soll: to.alarmPrice }));
    check('iPad: keine Fehler', !te.length, te.join(' | ')); await tc.close();
    // Handy hochkant: Kurzform am schmalen Handy, nichts abgeschnitten, kein seitliches Scrollen, Erklärung im Fenster
    for (const w of [390, 320]) {
      const pc = await browser.newContext({ viewport: { width: w, height: 800 }, hasTouch: true, isMobile: true }); await zz1(pc);
      const pp = await pc.newPage(), pe = []; h.collect(pp, pe); await pp.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(pp); await load(pp, 'XRP');
      await pp.evaluate(() => document.getElementById('chart').scrollIntoView({ block: 'center' })); await pp.waitForTimeout(500);
      // Vollbild mit neuer (pulsierender) Divergenz: Lichthof genau über dem Punkt – bei 390 px hochkant ist der Chart gedreht
      await pp.tap('#chart-full'); await pp.waitForTimeout(1200); const fs = await obs(pp); await pp.tap('#fb-exit'); await pp.waitForTimeout(800);
      await pp.evaluate(() => document.getElementById('chart').scrollIntoView({ block: 'center' })); await pp.waitForTimeout(500);
      check(`Handy ${w} px Vollbild: pulsierender Lichthof genau über dem Umkehrpunkt`, fs.halo && !fs.ov.hidden && fs.ov.anim === 'div-halo' && Math.abs(fs.ov.dx) <= 1 && Math.abs(fs.ov.dy) <= 1, JSON.stringify(fs.ov));
      const m = await obs(pp); await pp.tap('#div-tip > summary'); await pp.waitForTimeout(500); const mo = await obs(pp);
      if (w === 390) await pp.screenshot({ path: __dirname + '/shots/m24-phone-390.png' });
      check(`Handy ${w} px: Knopf ${w < 380 ? '„▲ Div.“' : '„▲ RSI-Divergenz“'}, nicht abgeschnitten, rechts im Bild, Erklärung im Fenster, kein seitliches Scrollen`,
        m.chip === (w < 380 ? '▲ Div.' : '▲ RSI-Divergenz') && !m.chipR.cut && m.chipR.r <= w && m.chipR.l > m.ohlcR.r - 2 && mo.open && mo.body.l >= 0 && mo.body.r <= w && mo.body.b <= mo.navTop && m.sw <= w && mo.sw <= w,
        JSON.stringify({ chip: m.chip, chipR: m.chipR, ohlcR: m.ohlcR, body: mo.body, tabLeiste: mo.navTop, sw: [m.sw, mo.sw] }));
      check(`Handy ${w} px: keine Fehler`, !pe.length, pe.join(' | ')); await pc.close();
    }
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await browser.close(); await h.ctl('/walk?on=1').catch(() => {}); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
