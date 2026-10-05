// 3.11.1 – Fibonacci-Leiste unter dem Chart: 38,2 / 50 / 61,8 % mit Kurs und Abstand zum aktuellen Kurs, Werte wie die Linien
// im Chart, Antippen legt einen Alarm an (Computer: Formular, iPad/Handy: Schnell-Alarm), feste Höhe (Live-Kurse, Laden, ohne
// Schwung), nur mit der Ebene „Fibonacci“, im Vollbild ausgeblendet, Magnet rastet an den Marken ein, Handy ohne seitliches
// Scrollen. Die Attrappe liefert per /shape gezielte Verläufe. Aufruf: node m18.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const num = s => +String(s).replace(/[^\d,.+−-]/g, '').replace(/\./g, '').replace(',', '.').replace('−', '-');
const R = { '38,2': .382, '50': .5, '61,8': .618 };
const strip = page => page.evaluate(() => {
  const s = document.getElementById('fib-strip'), r = s.getBoundingClientRect(), c = document.getElementById('chart').getBoundingClientRect(), note = document.getElementById('fs-note');
  const chips = [...s.querySelectorAll('.fs-chip')].map(b => { const v = b.querySelector('.fs-val'), br = b.getBoundingClientRect();
    return { fib: b.dataset.fib, r: b.querySelector('.fs-r').textContent, v: v.textContent, d: b.querySelector('.fs-dist').textContent, price: b.dataset.price, dis: b.disabled, hid: b.hidden, skel: v.classList.contains('skel'),
      cut: v.scrollWidth > v.clientWidth + 1 || b.scrollWidth > b.clientWidth + 1, title: b.title, top: Math.round(br.top), h: Math.round(br.height), right: br.right }; });
  return { hidden: s.hidden, display: getComputedStyle(s).display, h: Math.round(r.height), top: Math.round(r.top), right: r.right, chartBottom: Math.round(c.bottom), chips, note: note.hidden ? '' : note.textContent,
    head: document.getElementById('fs-head').textContent, headTip: document.getElementById('fs-head').title, text: [...s.querySelectorAll('.fs-chip, #fs-note, #fs-head')].map(e => e.textContent).join(' '), layout: document.documentElement.dataset.layout };
});
// Höhe der Leiste bei jedem Bild messen, solange sie sichtbar ist
const sample = (page, ms) => page.evaluate(ms => new Promise(res => { const hs = new Set(), t0 = performance.now();
  (function f() { const s = document.getElementById('fib-strip'); if (!s.hidden) hs.add(Math.round(s.getBoundingClientRect().height)); if (performance.now() - t0 < ms) requestAnimationFrame(f); else res([...hs]); })(); }), ms);
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
const load = async (page, sym) => { await page.fill('#symbol', sym); await page.press('#symbol', 'Enter'); await page.waitForFunction(s => document.getElementById('lb-sym').textContent === s, sym, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(1500); };
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  await h.ctl('/shape?symbol=SOLUSDT&interval=1m&kind=ew-open'); await h.ctl('/shape?symbol=NEARUSDT&interval=1m&kind=short&n=120');
  const P = (await h.ctl('/state')).price, browser = await h.launch();
  // SOL (ew-open): letzter abgeschlossener Schwung = Welle 4 (0,99) → Welle 5 (1,08) aufwärts, Kurs danach bei 1,02 (Grundkurs = Kurs / 1,02)
  const base = P.SOLUSDT / 1.02, lo = 0.99 * base * 0.9998, hi = 1.08 * base * 1.0002, exp = r => hi - r * (hi - lo);
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page);
    await load(page, 'SOL');
    let s = await strip(page);
    check('Leiste direkt unter dem Chart (Ebene „Fibonacci“ ist standardmäßig an)', !s.hidden && s.display !== 'none' && Math.abs(s.top - s.chartBottom) <= 2 && s.head === 'Fib', JSON.stringify({ hidden: s.hidden, top: s.top, chart: s.chartBottom, head: s.head }));
    check('Knöpfe so hoch wie die Zeile (34 px), innerhalb der Leiste', s.chips.every(c => c.h === 34 && c.top >= s.top && c.top + c.h <= s.top + s.h), JSON.stringify({ leiste: [s.top, s.h], knöpfe: s.chips.map(c => [c.top, c.h]) }));
    check('Drei Marken 38,2 / 50 / 61,8 %, bereit zum Antippen', s.chips.map(c => c.r).join(' | ') === '38,2 % | 50 % | 61,8 %' && s.chips.every(c => !c.hid && !c.dis && !c.skel && /Antippen: Alarm/.test(c.title)), s.chips.map(c => `${c.r} ${c.v} (${c.d})`).join(' · '));
    check('Kurse wie die Marken im Chart (letzter abgeschlossener Schwung)', s.chips.every(c => Math.abs(num(c.v) / exp(R[c.fib]) - 1) < 0.002 && Math.abs(Number(c.price) / exp(R[c.fib]) - 1) < 0.002), s.chips.map(c => `${c.v} / ${c.price} erw. ${exp(R[c.fib]).toFixed(3)}`).join(' · '));
    const lines = await page.evaluate(() => [...document.querySelectorAll('#chart .fib-line')].map(l => l.dataset.r).join(' '));
    check('Dieselben Marken sind im Chart eingezeichnet', ['38,2', '50', '61,8'].every(r => lines.split(' ').includes(r)), lines);
    check('Abstand zum aktuellen Kurs mit Vorzeichen und einer Nachkommastelle', s.chips.every(c => /^[+−]\d,\d %$/.test(c.d) && Math.abs(num(c.d) - (exp(R[c.fib]) / P.SOLUSDT - 1) * 100) < 0.08), s.chips.map(c => `${c.d} erw. ${((exp(R[c.fib]) / P.SOLUSDT - 1) * 100).toFixed(2)}`).join(' · '));
    check('Keine Trefferquote, Tooltip ehrlich (kein Handelssignal)', !/Treffer|Quote|Wahrscheinlich|Chance/i.test(s.text) && /letzten abgeschlossenen ZigZag-Schwungs \(Tief [\d.,]+ → Hoch [\d.,]+, ZigZag 3 %\) – Orientierung, kein Handelssignal/.test(s.headTip), s.headTip);
    // Feste Höhe: Live-Kurse ändern die Abstände, nie die Höhe
    const H0 = s.h; await h.ctl('/walk?on=1'); const hs = await sample(page, 4000), ds = new Set((await strip(page)).chips.map(c => c.d)); await h.ctl('/walk?on=0');
    check('Feste Höhe bei Live-Kursen', hs.length === 1 && hs[0] === H0, `Höhe ${H0} → ${hs.join('/')} · Abstände ${[...ds].join(' ')}`);
    // Symbolwechsel: Laden (Platzhalter) und ein Verlauf ohne abgeschlossenen Schwung – Hinweis statt Knöpfen, gleiche Höhe
    let pr = sample(page, 3500); await page.fill('#symbol', 'NEAR'); await page.press('#symbol', 'Enter'); const hsN = await pr; await page.waitForTimeout(500);
    const n = await strip(page);
    check('Ohne abgeschlossenen Schwung: Hinweis statt Knöpfen', /^Noch kein abgeschlossener Schwung ab 3 % im geladenen Verlauf/.test(n.note) && n.chips.every(c => c.hid), n.note);
    check('Gleiche Höhe beim Laden und mit Hinweis', hsN.every(v => v === H0) && n.h === H0, `Höhen beim Wechsel ${hsN.join('/')} · danach ${n.h} · vorher ${H0}`);
    pr = sample(page, 3500); await page.fill('#symbol', 'SOL'); await page.press('#symbol', 'Enter'); const hsS = await pr; await page.waitForTimeout(500);
    s = await strip(page);
    check('Zurück zu SOL: Knöpfe wieder da, Höhe unverändert', s.chips.every(c => !c.hid && !c.dis) && hsS.every(v => v === H0), `Höhen ${hsS.join('/')}`);
    // Klick am Computer: Alarm-Formular mit Kurs und Notiz, wie bei der Liq-Heatmap-Leiste
    const c50 = s.chips.find(c => c.fib === '50');
    await page.click('#fib-strip [data-fib="50"]'); await page.waitForTimeout(500);
    const f = await page.evaluate(() => ({ open: !document.getElementById('alarm-form').hidden, price: document.getElementById('al-price').value, note: document.getElementById('al-note').value, prev: document.getElementById('al-preview').textContent }));
    check('Computer: Klick auf „50 %“ füllt das Alarm-Formular (Kurs und Notiz)', f.open && Math.abs(num(f.price) / Number(c50.price) - 1) < 1e-9 && f.note === 'Fib 50 % (1m)' && /Meldet sich, sobald SOL auf oder (über|unter)/.test(f.prev), JSON.stringify(f));
    await page.press('#al-price', 'Enter'); await page.waitForTimeout(500);
    const al = await page.textContent('#alarm-list');
    check('Alarm gespeichert, Notiz nennt die Marke', /Fib 50 % \(1m\)/.test(al), al.slice(0, 160));
    // Magnet: rastet an der Marke ein (rechts vom Schwungstart), links davon nicht
    await page.evaluate(() => document.getElementById('chart').scrollIntoView({ block: 'center' })); await page.waitForTimeout(400);
    const at = () => page.evaluate(() => { const svg = document.querySelector('#chart svg'), l = svg.querySelector('.fib-line[data-r="50"]'); if (!l) return null;
      const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, x1 = +l.getAttribute('x1'), x2 = +l.getAttribute('x2'), y = +l.getAttribute('y1'), X = v => r.left + v * r.width / vb.width;
      return { x: X((x1 + x2) / 2), xl: X(Math.max(20, x1 - 60)), y: r.top + y * r.height / vb.height }; });
    let ml = await at(); await page.mouse.move(ml.x, ml.y + 1); await page.waitForTimeout(200);
    const mg = await page.evaluate(() => ({ label: document.querySelector('#chart .magnet-label')?.textContent, price: document.querySelector('#chart .magnet-price')?.textContent }));
    await page.mouse.move(ml.xl, ml.y + 1); await page.waitForTimeout(200);
    const ml2 = await page.evaluate(() => document.querySelector('#chart .magnet-label')?.textContent || '');
    check('Fadenkreuz rastet an „Fib 50 %“ ein, links vom Schwungstart nicht', mg.label === 'Fib 50 %' && Math.abs(num(mg.price) / Number(c50.price) - 1) < 1e-4 && ml2 !== 'Fib 50 %', `${JSON.stringify(mg)} · links: ${ml2}`);
    await page.click('#magnet'); ml = await at(); await page.mouse.move(ml.x, ml.y + 1); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(400);
    const mf = await page.evaluate(() => ({ price: document.getElementById('al-price').value, note: document.getElementById('al-note').value }));
    check('Magnet-Klick: Alarm-Formular mit der Fibonacci-Marke', Math.abs(num(mf.price) / Number(c50.price) - 1) < 1e-4 && mf.note === 'Fib 50 % (1m)', JSON.stringify(mf));
    await page.mouse.move(5, 5);
    // Ebene aus/an und Vollbild
    await page.click('[data-overlay="fib"]'); await page.waitForTimeout(600); const off = await strip(page);
    await page.click('[data-overlay="fib"]'); await page.waitForTimeout(600); const on = await strip(page);
    check('Ebene „Fibonacci“ aus: Leiste weg; wieder an: Leiste da', off.hidden && off.display === 'none' && !on.hidden && on.chips.every(c => !c.dis), JSON.stringify({ aus: [off.hidden, off.display], an: [on.hidden, on.chips.map(c => c.v).join(' ')] }));
    await page.click('#chart-full'); await page.waitForTimeout(800); const fs = await strip(page);
    await page.click('#fb-exit'); await page.waitForTimeout(500); const ex = await strip(page);
    check('Vollbild: Leiste ausgeblendet, danach wieder da', fs.display === 'none' && ex.display !== 'none' && !ex.hidden, JSON.stringify({ voll: fs.display, danach: ex.display }));
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
    // iPad: Antippen öffnet den Schnell-Alarm
    const tc = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true }), tp = await tc.newPage(), te = []; h.collect(tp, te);
    await tp.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(tp); await load(tp, 'SOL');
    await tp.evaluate(() => document.getElementById('fib-strip').scrollIntoView({ block: 'center' })); await tp.waitForTimeout(600);
    const t = await strip(tp), coarse = await tp.evaluate(() => matchMedia('(pointer:coarse)').matches), c618 = t.chips.find(c => c.fib === '61,8');
    check('iPad: Leiste mit drei Knöpfen in einer Reihe, fingergroß', t.layout === 'tablet' && t.chips.every(c => !c.hid && !c.cut && c.top === t.chips[0].top && (!coarse || c.h >= 43)), JSON.stringify({ layout: t.layout, coarse, h: t.chips.map(c => c.h), text: t.chips.map(c => `${c.r} ${c.v} (${c.d})`) }));
    await tp.tap('#fib-strip [data-fib="61,8"]'); await tp.waitForTimeout(600);
    const qa = await tp.evaluate(() => ({ open: document.getElementById('qa-dialog').open, price: document.getElementById('qa-price').value, prev: document.getElementById('qa-preview').textContent }));
    check('iPad: Antippen öffnet den Schnell-Alarm mit dem Kurs der Marke', qa.open && Math.abs(num(qa.price) / Number(c618.price) - 1) < 1e-9 && /🧲 Fib 61,8 %/.test(qa.prev), JSON.stringify(qa));
    await tp.tap('#qa-save'); await tp.waitForTimeout(500);
    const al2 = await tp.evaluate(() => JSON.parse(localStorage.getItem('scalpdesk.alarms.v1') || '[]').map(a => `${a.symbol} ${a.price} ${a.note}`));
    check('iPad: Alarm gespeichert mit der Marke als Notiz', al2.some(a => a === `SOLUSDT ${Number(c618.price)} Fib 61,8 % (1m)`), al2.join(' | '));
    check('iPad: keine Fehler', !te.length, te.join(' | ')); await tc.close();
    // Handy hochkant: Knöpfe zweizeilig nebeneinander, nichts abgeschnitten, kein seitliches Scrollen, feste Höhe
    for (const w of [390, 320]) {
      const pc = await browser.newContext({ viewport: { width: w, height: 800 }, hasTouch: true, isMobile: true }), pp = await pc.newPage(), pe = []; h.collect(pp, pe);
      await pp.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(pp); await load(pp, 'SOL');
      await pp.evaluate(() => document.getElementById('fib-strip').scrollIntoView({ block: 'center' })); await pp.waitForTimeout(800);
      const m = await strip(pp), sw = await pp.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
      check(`Handy ${w} px: drei Knöpfe nebeneinander, nichts abgeschnitten, kein seitliches Scrollen`, m.chips.length === 3 && m.chips.every(c => !c.hid && !c.cut && c.top === m.chips[0].top && c.right <= w) && m.right <= w && sw <= 0, JSON.stringify({ chips: m.chips.map(c => `${c.r} ${c.v} ${c.d}${c.cut ? ' ABGESCHNITTEN' : ''}`), h: m.h, sw }));
      await h.ctl('/walk?on=1'); const hp = await sample(pp, 3000); await h.ctl('/walk?on=0');
      check(`Handy ${w} px: feste Höhe bei Live-Kursen`, hp.length === 1 && hp[0] === m.h, `${m.h} → ${hp.join('/')}`);
      const c382 = m.chips.find(c => c.fib === '38,2'); await pp.tap('#fib-strip [data-fib="38,2"]'); await pp.waitForTimeout(600);
      const q = await pp.evaluate(() => ({ open: document.getElementById('qa-dialog').open, price: document.getElementById('qa-price').value }));
      check(`Handy ${w} px: Antippen öffnet den Schnell-Alarm`, q.open && Math.abs(num(q.price) / Number(c382.price) - 1) < 1e-9, JSON.stringify(q));
      await pp.evaluate(() => document.getElementById('qa-dialog').close());
      if (w === 390) await pp.screenshot({ path: __dirname + '/shots/m18-phone-390.png' });
      if (w === 320) {
        // Großer Abstand (Kurssprung +20 %): Abstände ab 10 % ohne Nachkommastelle, weiterhin nichts abgeschnitten
        const now = (await h.ctl('/state')).price.SOLUSDT; await h.ctl(`/set?symbol=SOLUSDT&price=${(now * 1.2).toPrecision(8)}`); await pp.waitForTimeout(2000);
        const g = await strip(pp);
        check('Handy 320 px: Abstand ab 10 % ohne Nachkommastelle, nichts abgeschnitten, gleiche Höhe', g.chips.every(c => /^−1\d %$/.test(c.d) && !c.cut) && g.h === m.h, JSON.stringify({ chips: g.chips.map(c => `${c.r} ${c.v} ${c.d}${c.cut ? ' ABGESCHNITTEN' : ''}`), h: g.h }));
        await (await pp.$('#fib-strip')).screenshot({ path: __dirname + '/shots/m18-phone-320.png' });
      }
      check(`Handy ${w} px: keine Fehler`, !pe.length, pe.join(' | ')); await pc.close();
    }
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await browser.close(); await h.ctl('/walk?on=1').catch(() => {}); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
