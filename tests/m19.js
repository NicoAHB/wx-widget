// Schritt 3.1 – Info-Knopf (ⓘ) zu den Fibonacci-Marken in der Leiste unter dem Chart: Erklärung der fünf Marken mit den
// aktuellen Kursen (gleich den Linien im Chart), aktueller Schwung auf- und abwärts, Hinweis ohne Schwung, ehrlicher Backtest,
// liegt über der Seite (verschiebt nichts), schließt per Tippen daneben und Escape; iPad, Handy 390/320 px (ⓘ unter „Fib“,
// Knöpfe nicht abgeschnitten), Zwischenbreiten 620/700 px. Aufruf: node m19.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const num = s => +String(s).replace(/[^\d,.+−-]/g, '').replace(/\./g, '').replace(',', '.').replace('−', '-');
const R = { '23,6': .236, '38,2': .382, '50': .5, '61,8': .618, '78,6': .786 };
const tip = page => page.evaluate(() => {
  const t = document.getElementById('fs-tip'), b = t.querySelector('.tip-body'), sm = t.querySelector('summary'), head = document.getElementById('fs-head');
  const r = b.getBoundingClientRect(), sr = sm.getBoundingClientRect(), hr = head.getBoundingClientRect(), strip = document.getElementById('fib-strip').getBoundingClientRect();
  const lines = [...document.querySelectorAll('#chart .fib-line')].map(l => ({ r: l.dataset.r, y: +l.getAttribute('y1') }));
  return { open: t.open, visible: t.open && r.width > 0 && getComputedStyle(b).visibility !== 'hidden', body: { left: r.left, right: r.right, top: r.top, w: r.width }, vw: innerWidth,
    sum: { left: sr.left, top: sr.top, right: sr.right, bottom: sr.bottom, cx: sr.left + sr.width / 2, cy: sr.top + sr.height / 2 }, head: { left: hr.left, right: hr.right, top: hr.top, bottom: hr.bottom },
    strip: { top: strip.top, bottom: strip.bottom, h: Math.round(strip.height) }, swing: document.getElementById('fs-tip-swing').textContent,
    marks: [...t.querySelectorAll('.fs-tip-list li')].map(li => ({ r: li.querySelector('b').textContent, p: li.querySelector('[data-fl]').textContent })), text: b.textContent, lines,
    next: Math.round(document.getElementById('lmap-strip').getBoundingClientRect().top), chips: [...document.querySelectorAll('#fib-strip .fs-chip')].map(c => ({ cut: c.scrollWidth > c.clientWidth + 1 || c.querySelector('.fs-val').scrollWidth > c.querySelector('.fs-val').clientWidth + 1, top: Math.round(c.getBoundingClientRect().top), hid: c.hidden })) };
});
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
const load = async (page, sym) => { await page.fill('#symbol', sym); await page.press('#symbol', 'Enter'); await page.waitForFunction(s => document.getElementById('lb-sym').textContent === s, sym, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(1500); };
const inView = (d, min = 180) => d.visible && d.body.left >= 0 && d.body.right <= d.vw + 0.5 && d.body.w >= min;
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  await h.ctl('/shape?symbol=SOLUSDT&interval=1m&kind=ew-open'); await h.ctl('/shape?symbol=XRPUSDT&interval=1m&kind=ew-up'); await h.ctl('/shape?symbol=NEARUSDT&interval=1m&kind=short&n=120');
  const P = (await h.ctl('/state')).price, browser = await h.launch();
  // SOL (ew-open): Schwung Welle 4 (0,99) → Welle 5 (1,08) aufwärts; Grundkurs = Kurs / 1,02
  const base = P.SOLUSDT / 1.02, lo = 0.99 * base * 0.9998, hi = 1.08 * base * 1.0002, exp = r => hi - r * (hi - lo);
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page); await load(page, 'SOL');
    await page.evaluate(() => document.getElementById('fib-strip').scrollIntoView({ block: 'start' })); await page.waitForTimeout(400);
    let d = await tip(page);
    check('ⓘ rechts neben „Fib“, geschlossen', !d.open && d.sum.cx > d.head.right && Math.abs(d.sum.cy - (d.head.top + d.head.bottom) / 2) < 6, JSON.stringify({ sum: d.sum, head: d.head }));
    const before = { h: d.strip.h, next: d.next };
    await page.click('#fs-tip > summary'); await page.waitForTimeout(300); d = await tip(page);
    check('Klick öffnet die Erklärung, ganz im Fenster', d.open && inView(d, 260), JSON.stringify(d.body));
    check('Erklärung liegt über der Seite: Leiste und Heatmap-Leiste verschieben sich nicht', d.strip.h === before.h && d.next === before.next, JSON.stringify({ vorher: before, nachher: { h: d.strip.h, next: d.next } }));
    check('Aktueller Schwung aufwärts mit ZigZag und Intervall', /aktuell Tief [\d.,]+ → Hoch [\d.,]+ \(ZigZag 3\s%, 1m\)\. Die Marken liegen bei festen Anteilen davon, gemessen vom Hoch zurück Richtung Tief\./.test(d.swing), d.swing);
    check('Alle fünf Marken in Reihenfolge, Kurse wie die Linien im Chart', d.marks.map(m => m.r).join(' ') === '23,6 % 38,2 % 50 % 61,8 % 78,6 %' && d.marks.every(m => Math.abs(num(m.p) / exp(R[m.r.replace(' %', '')]) - 1) < 0.002) && d.lines.length === 5,
      d.marks.map(m => `${m.r}${m.p} (erw. ${exp(R[m.r.replace(' %', '')]).toFixed(3)})`).join(' | '));
    check('Erklärt jede Marke, So nutzen, ehrlicher Backtest, keine Trefferquote in Zahlen', ['flacher Rücklauf', 'erste häufig beachtete Marke', 'halber Rücklauf', 'goldene Zone', 'tiefer Rücklauf', 'So nutzen:', 'Alarm', '27–31 % gegenüber 23–35 %', 'kein Handelssignal'].every(s => d.text.replace(/\u00a0/g, ' ').includes(s)) && !/Trefferquote (von |liegt |bei )?\d|Wahrscheinlichkeit/.test(d.text), d.text.slice(0, 140));
    await page.mouse.click(Math.round(d.sum.cx) + 200, Math.round(d.strip.top) - 30); await page.waitForTimeout(250); const c1 = await tip(page); // in den Chart über der Leiste
    await page.click('#fs-tip > summary'); await page.waitForTimeout(250); await page.keyboard.press('Escape'); await page.waitForTimeout(250); const c2 = await tip(page);
    check('Schließt per Klick daneben und mit Escape', !c1.open && !c2.open, JSON.stringify({ klick: c1.open, escape: c2.open }));
    // Abwärts-Schwung (XRP ew-up: B 1,055 → C 0,995) und ein Verlauf ohne abgeschlossenen Schwung (NEAR)
    await load(page, 'XRP'); await page.click('#fs-tip > summary'); await page.waitForTimeout(300); d = await tip(page);
    check('Abwärts-Schwung: „Hoch → Tief“, gemessen vom Tief zurück Richtung Hoch, Kurse aufsteigend', /aktuell Hoch [\d.,]+ → Tief [\d.,]+ \(ZigZag 3\s%, 1m\)/.test(d.swing) && /vom Tief zurück Richtung Hoch/.test(d.swing) && d.marks.every((m, i) => !i || num(m.p) > num(d.marks[i - 1].p)), `${d.swing.slice(0, 110)} · ${d.marks.map(m => m.p).join('')}`);
    await page.keyboard.press('Escape'); await load(page, 'NEAR'); await page.click('#fs-tip > summary'); await page.waitForTimeout(300); d = await tip(page);
    check('Ohne Schwung: Hinweis in der Erklärung, keine Kurse', /im geladenen Verlauf gibt es noch keinen ab 3\s%/.test(d.swing) && d.marks.every(m => m.p === ''), d.swing);
    await page.keyboard.press('Escape');
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
    // iPad (Finger) und Handy hochkant: ⓘ antippen, Erklärung im Fenster, Knöpfe nicht abgeschnitten
    for (const [name, w, hgt] of [['iPad', 1024, 768], ['Handy 390', 390, 800], ['Handy 320', 320, 700]]) {
      const pc = await browser.newContext({ viewport: { width: w, height: hgt }, hasTouch: true, isMobile: true }), pp = await pc.newPage(), pe = []; h.collect(pp, pe);
      await pp.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(pp); await load(pp, 'SOL');
      await pp.evaluate(() => document.getElementById('fib-strip').scrollIntoView({ block: 'center' })); await pp.waitForTimeout(700);
      const a = await tip(pp), hy = (a.head.top + a.head.bottom) / 2, stacked = a.sum.cy > hy + 8 && Math.abs(a.sum.cx - (a.head.left + a.head.right) / 2) < 4;
      check(`${name}: ⓘ ${w < 700 ? 'unter' : 'neben'} „Fib“ in der Leiste, Knöpfe nicht abgeschnitten`, (w < 700 ? stacked : a.sum.cx > a.head.right && Math.abs(a.sum.cy - hy) < 6) && a.sum.top >= a.strip.top && a.sum.bottom <= a.strip.bottom + 1 && a.chips.every(c => !c.cut && !c.hid && c.top === a.chips[0].top),
        JSON.stringify({ sum: [Math.round(a.sum.left), Math.round(a.sum.top), Math.round(a.sum.bottom)], head: [Math.round(a.head.right), Math.round(a.head.bottom)], strip: [Math.round(a.strip.top), Math.round(a.strip.bottom)], cut: a.chips.map(c => c.cut) }));
      await pp.tap('#fs-tip > summary'); await pp.waitForTimeout(400); const b = await tip(pp);
      check(`${name}: Antippen öffnet die Erklärung, ganz im Fenster, nichts verschoben`, b.open && inView(b) && b.strip.h === a.strip.h && b.next === a.next, JSON.stringify({ body: b.body, vw: b.vw, h: [a.strip.h, b.strip.h] }));
      await pp.touchscreen.tap(Math.round(w * 0.7), Math.round(b.strip.top) - 30); await pp.waitForTimeout(300); // in den Chart über der Leiste
      check(`${name}: Tippen daneben schließt sie`, !(await tip(pp)).open);
      if (w === 320) { await pp.tap('#fs-tip > summary'); await pp.waitForTimeout(400); await pp.screenshot({ path: __dirname + '/shots/m19-phone-320.png' }); }
      check(`${name}: keine Fehler`, !pe.length, pe.join(' | ')); await pc.close();
    }
    // Zwischenbreiten: bis 640 px Container zweizeilig, darüber einzeilig – nie abgeschnitten
    for (const w of [620, 700]) {
      const pc = await browser.newContext({ viewport: { width: w, height: 900 } }), pp = await pc.newPage(); await pp.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(pp); await load(pp, 'SOL');
      const a = await tip(pp), two = await pp.evaluate(() => getComputedStyle(document.querySelector('#fib-strip .fs-chip')).display);
      check(`Breite ${w} px: Knöpfe ${two === 'grid' ? 'zweizeilig' : 'einzeilig'}, nicht abgeschnitten`, a.chips.every(c => !c.cut && !c.hid), JSON.stringify({ display: two, cut: a.chips.map(c => c.cut) })); await pc.close();
    }
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await browser.close(); await h.ctl('/walk?on=1').catch(() => {}); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
