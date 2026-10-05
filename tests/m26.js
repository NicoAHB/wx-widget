// Schritt 3.3 (3.17.0) – Countdown bis Kerzenschluss an der Kurslinie: gestrichelte Kurslinie und Kurs-Schild rechts (Farbe
// wie die Kerze), darunter die Restzeit; stimmt mit dem Kerzenschluss von Binance; läuft sekündlich, auch ohne Neuzeichnen;
// neue Kerze beginnt wieder oben; Formate je Intervall; keine Beschriftung überdeckt es; Handy im Chart am rechten Rand,
// ohne die laufende Kerze zu verdecken.
// Die Korrektur einer falsch gehenden Geräteuhr prüft unit-cd.js (hier ginge nur die Seiten-, nicht die Worker-Uhr zu verstellen).
// Aufruf: node m26.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
const secs = t => { const m = /^(?:(\d+)T )?(?:(\d+):)?(\d+):(\d\d)$/.exec(t || ''); if (!m) return NaN; return m[1] ? (+m[1] * 86400 + +m[3] * 3600 + +m[4] * 60) : (+(m[2] || 0) * 3600 + +m[3] * 60 + +m[4]); };
const tag = page => page.evaluate(() => {
  const g = document.querySelector('#chart svg .last-tag'); if (!g) return null;
  const r = g.querySelector('rect').getBoundingClientRect(), svg = document.querySelector('#chart svg').getBoundingClientRect(), box = e => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
  const hit = a => a.l < r.right && a.r > r.left && a.t < r.bottom && a.b > r.top;
  const hits = [...document.querySelectorAll('#chart svg text, #chart svg rect.axis-tag')].filter(e => !g.contains(e) && (e.tagName === 'rect' || e.textContent !== '') && hit(box(e)))
    .map(e => `${e.getAttribute('class') || e.tagName} „${e.textContent.slice(0, 40)}“`);
  // jüngste Kerze (Körper: rect mit rx 0.4, der rechteste) und ihre Überdeckung durch das Schild in px
  // Kurs und Countdown stehen im Schild (nicht verschoben)
  const inside = [...g.querySelectorAll('text')].every(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.left >= r.left - 1 && b.right <= r.right + 1 && b.top >= r.top - 1 && b.bottom <= r.bottom + 1; });
  const bodies = [...document.querySelectorAll('#chart svg rect')].filter(e => e.getAttribute('rx') === '0.4'), last = bodies.reduce((a, e) => !a || +e.getAttribute('x') > +a.getAttribute('x') ? e : a, null);
  const lb = last && box(last), cover = lb ? Math.max(0, Math.min(lb.r, r.right) - Math.max(lb.l, r.left)) * Math.max(0, Math.min(lb.b, r.bottom) - Math.max(lb.t, r.top)) : null;
  const ln = document.querySelector('#chart svg .last-line'), lr = ln && ln.getBoundingClientRect(), ls = ln && getComputedStyle(ln);
  const line = ln && { cls: ln.getAttribute('class'), y: Math.round(lr.top + lr.height / 2 - svg.top), x1: Math.round(lr.left - svg.left), x2: Math.round(svg.right - lr.right), dash: ls.strokeDasharray, stroke: ls.stroke };
  const o = document.getElementById('ohlc').textContent.replace(/\s+/g, ' '), num = s => Number(s.replace(/\./g, '').replace(',', '.')), om = /O ([\d.,]+).*C ([\d.,]+)/.exec(o);
  return { cls: g.getAttribute('class'), price: g.querySelector('.last-price').textContent, cd: g.querySelector('.last-cd').textContent, head: document.getElementById('price').textContent.trim(),
    fill: getComputedStyle(g.querySelector('rect')).fill, ink: getComputedStyle(g.querySelector('text')).fill, l: Math.round(r.left - svg.left), rr: Math.round(svg.right - r.right), w: Math.round(r.width), t: Math.round(r.top - svg.top),
    b: Math.round(r.bottom - svg.top), grid: hits.length, hits, inside, up: om ? num(om[2]) >= num(om[1]) : null, title: g.querySelector('title')?.textContent || '',
    cover, bodyArea: lb ? Math.round((lb.r - lb.l) * (lb.b - lb.t)) : null, svgH: Math.round(svg.height), line };
});
// Schlusszeit der laufenden Kerze laut „Binance“ (Attrappe) – dieselbe Quelle wie die App
const closeAt = (page, iv) => page.evaluate(async iv => { const r = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=${iv}&limit=1`); return (await r.json())[0][6]; }, iv);
const load = async (page, iv) => { await page.click(`.chart-toolbar [data-interval="${iv}"]`); await page.waitForFunction(iv => document.getElementById('chart-caption').textContent.includes(iv), iv, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(1500); };
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset');
  const browser = await h.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page); await page.waitForTimeout(2000);
    await page.evaluate(() => document.getElementById('chart-sec').scrollIntoView({ block: 'start' }));
    let t = await tag(page), exp = (await closeAt(page, '1m') + 1 - Date.now()) / 1000;
    check('Kurs-Schild an der Kurslinie in der Kursspalte: aktueller Kurs, Farbe wie die laufende Kerze', t && t.inside && t.price === t.head && t.cls === `last-tag ${t.up ? 'up' : 'down'}` && t.rr >= 0 && t.w >= 70 && /Zeit bis zum Schluss der laufenden 1m-Kerze/.test(t.title), JSON.stringify(t));
    check('Countdown 1m („m:ss“) stimmt mit dem Kerzenschluss (±2 s)', /^\d:\d\d$/.test(t.cd) && Math.abs(secs(t.cd) - exp) <= 2, `${t.cd} / erwartet ${exp.toFixed(1)} s`);
    check('Keine Beschriftung überdeckt das Schild', t.grid === 0, t.hits.join(' | '));
    check('Gestrichelte Kurslinie in Kerzenfarbe auf Höhe des Kurses, bis zum Schild', t.line && t.line.cls === `last-line ${t.up ? 'up' : 'down'}` && t.line.stroke === t.fill && /^2(px)?,? 4(px)?$/.test(t.line.dash.replace(/\s+/g, ' ').replace(', ', ' ')) && t.line.y >= t.t && t.line.y <= t.b && t.line.x1 <= 16 && t.line.x2 >= 70 && t.line.x2 <= 90, JSON.stringify(t.line));
    const a = secs((await tag(page)).cd); await page.waitForTimeout(2200); const b = secs((await tag(page)).cd);
    check('Läuft im Sekundentakt', (a - b >= 1 && a - b <= 3) || b > a + 40, `${a} → ${b}`);
    // ohne Neuzeichnen (Live-Stream still): Countdown läuft trotzdem weiter. Nicht über den Kerzenwechsel – ohne Stream kommt
    // keine neue Kerze, dann steht er bis dahin richtig auf 0:00
    for (let i = 0; i < 15 && secs((await tag(page))?.cd) < 8; i++) await page.waitForTimeout(1000);
    await h.ctl('/silent?on=1'); const c1 = secs((await tag(page)).cd); await page.waitForTimeout(3200); const c2 = secs((await tag(page)).cd); await h.ctl('/silent?on=0');
    check('Ohne Kurs-Updates (Stream still) läuft der Countdown weiter', (c1 - c2 >= 2 && c1 - c2 <= 4) || c2 > c1 + 40, `${c1} → ${c2}`);
    // Kerzenwechsel: bei 0:0x abwarten, danach steht die neue Kerze wieder bei knapp 1:00
    for (let i = 0; i < 70 && secs((await tag(page))?.cd) > 3; i++) await page.waitForTimeout(1000);
    const before = (await tag(page)).cd; await page.waitForTimeout(6000); const after = (await tag(page)).cd;
    check('Neue Kerze: Countdown beginnt wieder oben (0:0x → 0:5x)', secs(before) <= 3 && secs(after) >= 50 && secs(after) <= 58, `${before} → ${after}`);
    // Formate je Intervall
    // Format nach Restzeit: unter 1 h „m:ss“, unter 1 Tag „h:mm:ss“, darüber „3T 05:12“ (Minuten, daher ±61 s)
    const fmt = s => s < 3600 ? /^\d{1,2}:\d\d$/ : s < 86400 ? /^\d{1,2}:\d\d:\d\d$/ : /^\dT \d\d:\d\d$/;
    for (const iv of ['1h', '4h', '1d', '1w']) {
      await load(page, iv); t = await tag(page); exp = (await closeAt(page, iv) + 1 - Date.now()) / 1000; const tol = exp >= 86400 ? 61 : 2;
      check(`Intervall ${iv}: Format und Restzeit (±${tol} s)`, t && fmt(secs(t.cd)).test(t.cd) && Math.abs(secs(t.cd) - exp) <= tol, `${t?.cd} / erwartet ${exp.toFixed(0)} s`);
    }
    await load(page, '1m');
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
    // Handy hochkant: Schild im Chart am rechten Rand, ganz sichtbar, ohne Überlappung mit den Kurs-Schildchen
    for (const w of [390, 320]) {
      const pc = await browser.newContext({ viewport: { width: w, height: 800 }, hasTouch: true, isMobile: true }), pp = await pc.newPage(), pe = []; h.collect(pp, pe);
      await pp.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(pp); await pp.waitForTimeout(2000);
      await pp.evaluate(() => document.getElementById('chart').scrollIntoView({ block: 'center' })); await pp.waitForTimeout(500);
      const m = await tag(pp), sw = await pp.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
      if (w === 390) await (await pp.$('#chart')).screenshot({ path: __dirname + '/shots/m26-phone-390.png' });
      check(`Handy ${w} px: Schild am rechten Rand im Chart, ganz sichtbar, Kurs und Countdown im Schild, keine Überlappung`, m && m.inside && m.rr >= 0 && m.rr <= 4 && m.l >= 0 && /^\d:\d\d$/.test(m.cd) && m.grid === 0 && sw <= 0, JSON.stringify(m && { cd: m.cd, inside: m.inside, rr: m.rr, w: m.w, hits: m.hits, sw }));
      check(`Handy ${w} px: Schild verdeckt den Körper der laufenden Kerze nicht, Kurslinie am Schild`, m && m.cover === 0 && m.line && m.line.y >= m.t - 2 && m.line.y <= m.b + 2, JSON.stringify(m && { cover: m.cover, body: m.bodyArea, t: m.t, b: m.b, line: m.line?.y }));
      check(`Handy ${w} px: keine Fehler`, !pe.length, pe.join(' | ')); await pc.close();
    }
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await h.ctl('/silent?on=0').catch(() => {}); await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
