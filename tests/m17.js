// Schritt 2.4 – Fibonacci-Retracement: fünf Marken des letzten abgeschlossenen ZigZag-Schwungs, Reihenfolge und Kurse,
// Linien ab dem Schwungstart, goldene Zone, lesbare Beschriftung, Schalter (gespeichert, Vollbild), Handy hochkant.
// Die Attrappe liefert per /shape gezielte Verläufe. Aufruf: node m17.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const fib = page => page.evaluate(() => {
  const b = document.querySelector('[data-overlay="fib"]'), g = document.querySelector('#chart svg .fib');
  const lines = g ? [...g.querySelectorAll('.fib-line')].map(l => ({ r: l.dataset.r, y: +l.getAttribute('y1'), x1: +l.getAttribute('x1'), x2: +l.getAttribute('x2') })) : [];
  const labels = g ? [...g.querySelectorAll('.fib-label')].map(t => ({ r: t.dataset.r, t: t.textContent, y: t.getBBox().y })) : [];
  const zone = g?.querySelector('.fib-zone'), svg = document.querySelector('#chart svg');
  return { pressed: b?.getAttribute('aria-pressed'), g: !!g, cls: g?.getAttribute('class') || '', tip: g?.querySelector('title')?.textContent || '', lines, labels, zone: zone ? { y: +zone.getAttribute('y'), h: +zone.getAttribute('height') } : null, vbw: +svg.getAttribute('viewBox').split(' ')[2] };
});
const settle = page => page.waitForTimeout(900);
const load = async (page, sym) => { await page.fill('#symbol', sym); await page.press('#symbol', 'Enter'); await page.waitForFunction(s => document.getElementById('lb-sym').textContent === s, sym, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(1500); };
const num = s => +s.replace(/\./g, '').replace(',', '.');
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  await h.ctl('/shape?symbol=XRPUSDT&interval=1m&kind=ew-up'); await h.ctl('/shape?symbol=SOLUSDT&interval=1m&kind=ew-open');
  const P = (await h.ctl('/state')).price, browser = await h.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html');
    await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
    await load(page, 'SOL');
    let d = await fib(page);
    check('Schalter „Fibonacci“ bei den Chart-Ebenen, standardmäßig an', d.pressed === 'true' && d.g, JSON.stringify({ pressed: d.pressed, g: d.g }));
    // SOL (ew-open): letzter abgeschlossener Schwung = Welle 4 (0,99) → Welle 5 (1,08) aufwärts; Grundkurs = Kurs / 1,02
    const base = P.SOLUSDT / 1.02, lo = 0.99 * base * 0.9998, hi = 1.08 * base * 1.0002, exp = r => hi - r * (hi - lo);
    check('Fünf Marken 23,6 / 38,2 / 50 / 61,8 / 78,6', d.lines.map(l => l.r).join(' ') === '23,6 38,2 50 61,8 78,6', d.lines.map(l => l.r).join(' '));
    check('Aufwärts-Schwung: 23,6 % oben (nah am Hoch), 78,6 % unten', /\bup\b/.test(d.cls) && d.lines.every((l, i) => !i || l.y > d.lines[i - 1].y), d.lines.map(l => Math.round(l.y)).join(' '));
    check('Linien ab dem Schwungstart bis an den rechten Rand', d.lines.every(l => l.x1 > 100 && l.x2 > d.vbw * .8 && l.x2 > l.x1), JSON.stringify(d.lines[0]));
    const lab = d.labels.map(l => ({ ...l, p: num((l.t.match(/· ([\d.,]+)$/) || [])[1] || '0') }));
    check('Beschriftung in derselben Reihenfolge wie die Linien, Kurse stimmen', lab.length >= 1 && lab.every((l, i) => !i || l.y > lab[i - 1].y) && lab.every(l => /^Fib [\d,]+ % · [\d.,]+$/.test(l.t) && Math.abs(l.p - exp(+l.r.replace(',', '.') / 100)) / l.p < 0.002), lab.map(l => `${l.t} (erw. ${exp(+l.r.replace(',', '.') / 100).toFixed(2)})`).join(' | '));
    const y50 = d.lines.find(l => l.r === '50').y, y618 = d.lines.find(l => l.r === '61,8').y;
    check('Goldene Zone 50–61,8 % hinterlegt', d.zone && Math.abs(d.zone.y - Math.min(y50, y618)) < 1 && Math.abs(d.zone.h - Math.abs(y618 - y50)) < 1, JSON.stringify(d.zone));
    check('Tooltip: Schwung, Marken, ehrlicher Backtest-Hinweis', /Fibonacci-Retracement des letzten abgeschlossenen ZigZag-Schwungs \(Tief [\d.,]+ → Hoch [\d.,]+, ZigZag 3 %\)/.test(d.tip) && /kein Handelssignal/.test(d.tip) && /27–31 % gegenüber 23–35 %/.test(d.tip), d.tip.slice(0, 120));
    // XRP (ew-up): letzter Schwung B (1,055) → C (0,995) abwärts, klein → nur ein Teil der Marken beschriftet, Reihenfolge stimmt
    await load(page, 'XRP'); d = await fib(page);
    check('Abwärts-Schwung: 23,6 % unten (nah am Tief), Beschriftung lesbar ohne Überlappung', /\bdown\b/.test(d.cls) && d.lines.every((l, i) => !i || l.y < d.lines[i - 1].y) && d.labels.every((l, i) => !i || l.y < d.labels[i - 1].y - 12), `${d.lines.map(l => Math.round(l.y)).join(' ')} · ${d.labels.map(l => l.t).join(' | ')}`);
    await page.click('[data-overlay="fib"]'); await settle(page); const off = await fib(page);
    await page.click('[data-overlay="fib"]'); await settle(page); const on = await fib(page);
    check('Ausblenden und wieder einblenden', off.pressed === 'false' && !off.g && on.pressed === 'true' && on.lines.length === 5, JSON.stringify({ aus: [off.pressed, off.g], an: [on.pressed, on.lines.length] }));
    await page.click('[data-overlay="fib"]'); await settle(page);
    await page.reload(); await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(1500);
    d = await fib(page); check('Nach dem Neuladen bleibt der Schalter aus', d.pressed === 'false' && !d.g, JSON.stringify({ pressed: d.pressed, g: d.g }));
    await page.click('[data-overlay="fib"]'); await settle(page); await load(page, 'SOL');
    // Vollbild
    await page.click('#chart-full'); await page.waitForTimeout(800); await page.click('#fb-tools'); await page.waitForTimeout(600);
    const f1 = await fib(page); await page.click('[data-overlay="fib"]'); await settle(page); const f2 = await fib(page); await page.click('[data-overlay="fib"]'); await settle(page); const f3 = await fib(page);
    check('Vollbild: Marken sichtbar, Schalter in der Werkzeugzeile blendet aus und ein', f1.g && !f2.g && f3.g, JSON.stringify({ an: f1.g, aus: f2.g, wieder: f3.g }));
    await page.click('#fb-exit'); await page.waitForTimeout(400);
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
    // Handy hochkant: kurze Beschriftung, vor den Kurs-Schildchen, kein seitliches Scrollen
    for (const w of [390, 320]) {
      const pc = await browser.newContext({ viewport: { width: w, height: 800 }, hasTouch: true, isMobile: true }), pp = await pc.newPage(), pe = []; h.collect(pp, pe);
      await pp.goto(h.URL_BASE + '/weather-widget-v2.html');
      await pp.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {}); await load(pp, 'SOL');
      await pp.evaluate(() => document.getElementById('chart').scrollIntoView({ block: 'center' })); await pp.waitForTimeout(800);
      const m = await fib(pp), o = await pp.evaluate(() => { const R = e => e.getBoundingClientRect(), hit = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
        const labs = [...document.querySelectorAll('#chart .fib-label')].map(R), tags = [...document.querySelectorAll('#chart rect.axis-tag')].map(R), svg = R(document.querySelector('#chart svg'));
        return { under: labs.filter(a => tags.some(t => hit(a, t))).length, out: labs.filter(a => a.left < svg.left || a.right > svg.right).length, sw: document.scrollingElement.scrollWidth - innerWidth }; });
      check(`Handy ${w} px: kurze Beschriftung („50 %“), vor den Kurs-Schildchen, im Chart, kein seitliches Scrollen`, m.g && m.labels.length >= 1 && m.labels.every(l => /^[\d,]+ %$/.test(l.t)) && !o.under && !o.out && o.sw <= 0, JSON.stringify({ labels: m.labels.map(l => l.t), ...o }));
      check(`Handy ${w} px: keine Fehler`, !pe.length, pe.join(' | ')); await pc.close();
    }
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await browser.close(); await h.ctl('/walk?on=1').catch(() => {}); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
