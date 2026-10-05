// Schritt 3.4 (3.18.0) – Hoch und Tief des sichtbaren Zeitraums: fett in Grün bzw. Rot an der obersten bzw. untersten
// Dochtspitze, der Kurs passt zur Kursachse; Linie von der Spitze zur Beschriftung; neues Hoch und Tief live; Zurückblättern
// (sichtbarer Ausschnitt); Ebene aus, gespeichert, wieder an; Handy nur mit Kurs und vor den Kurs-Schildchen, auch wenn die
// jüngste Kerze Hoch und Tief hält; gedrehtes Vollbild mit „Hoch …“. Aufruf: node m27.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
const hl = page => page.evaluate(() => {
  const svg = document.querySelector('#chart svg'); if (!svg) return null;
  const S = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, R = e => { const b = e.getBoundingClientRect(); return { l: b.left - S.left, r: b.right - S.left, t: b.top - S.top, b: b.bottom - S.top }; };
  const num = s => Number(String(s).replace(/\./g, '').replace(',', '.'));
  // Dochte: senkrechte Linien ohne Klasse (x1 = x2) mit Farbe
  const wicks = [...svg.querySelectorAll('line')].filter(l => !l.getAttribute('class') && l.getAttribute('stroke') && l.getAttribute('x1') === l.getAttribute('x2')).map(l => ({ x: +l.getAttribute('x1'), top: +l.getAttribute('y1'), bot: +l.getAttribute('y2') }));
  // Kursachse aus zwei Rasterbeschriftungen (Kursspalte oder Schildchen am Handy): y → Kurs
  const labs = [...svg.querySelectorAll('text.axis-label')].filter(t => /^[\d.]+,\d+$/.test(t.textContent)).map(t => ({ p: num(t.textContent), y: +t.getAttribute('y') - 4 }));
  const a = labs[0], b = labs.at(-1), priceAt = y => a.p + (y - a.y) * (b.p - a.p) / (b.y - a.y);
  const colorOf = v => { const d = document.createElement('i'); d.style.color = `var(${v})`; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; };
  const lane = [...svg.querySelectorAll('rect.axis-tag, .last-tag rect')].map(R);
  const mark = kind => { const g = svg.querySelector(`.hl-mark.${kind}`); if (!g) return null; const t = g.querySelector('text'), l = g.querySelector('line'), cs = getComputedStyle(t), m = R(t);
    const hits = [...svg.querySelectorAll('text, rect.axis-tag, .last-tag rect')].filter(e => !g.contains(e) && (e.tagName === 'rect' || e.textContent !== '')).filter(e => { const o = R(e); return o.l < m.r - 1 && o.r > m.l + 1 && o.t < m.b - 1 && o.b > m.t + 1; })
      .map(e => `${e.getAttribute('class') || e.tagName} „${e.textContent.slice(0, 30)}“`);
    const bb = t.getBBox(); // in Chart-Koordinaten, auch im gedrehten Vollbild
    return { text: t.textContent, price: num(t.textContent.replace(/^(Hoch|Tief) /, '')), anchor: t.getAttribute('text-anchor'), box: m, bl: bb.x, br: bb.x + bb.width, x1: +l.getAttribute('x1'), x2: +l.getAttribute('x2'), y: +l.getAttribute('y1'), flat: l.getAttribute('y1') === l.getAttribute('y2'),
      fill: cs.fill, stroke: getComputedStyle(l).stroke, weight: cs.fontWeight, halo: cs.paintOrder.startsWith('stroke'), hits, laneHit: lane.some(o => o.l < m.r - 1 && o.r > m.l + 1 && o.t < m.b - 1 && o.b > m.t + 1) }; };
  const top = Math.min(...wicks.map(w => w.top)), bot = Math.max(...wicks.map(w => w.bot));
  return { w: vb.width, top, bot, topXs: wicks.filter(w => Math.abs(w.top - top) < .01).map(w => w.x), botXs: wicks.filter(w => Math.abs(w.bot - bot) < .01).map(w => w.x), lastX: Math.max(...wicks.map(w => w.x)),
    priceTop: priceAt(top), priceBot: priceAt(bot), up: colorOf('--c-up'), down: colorOf('--c-down'), hi: mark('hi'), lo: mark('lo'), sw: document.scrollingElement.scrollWidth - innerWidth };
});
// Hoch und Tief sitzen an der obersten bzw. untersten Dochtspitze, Kurs wie an der Achse, Linie bis zur Beschriftung
const atTips = d => d && d.hi && d.lo && Math.abs(d.hi.y - d.top) < .06 && Math.abs(d.lo.y - d.bot) < .06 && d.topXs.some(x => Math.abs(x - d.hi.x1) < .06) && d.botXs.some(x => Math.abs(x - d.lo.x1) < .06)
  && Math.abs(d.hi.price - d.priceTop) < .05 && Math.abs(d.lo.price - d.priceBot) < .05 && d.hi.flat && d.lo.flat
  && [d.hi, d.lo].every(m => Math.abs(m.x2 - (m.anchor === 'start' ? m.bl : m.br)) <= 5);
const brief = d => d && JSON.stringify({ hi: d.hi && { t: d.hi.text, y: d.hi.y, spitze: +d.top.toFixed(1), achse: +d.priceTop.toFixed(2), x1: d.hi.x1, x2: d.hi.x2, a: d.hi.anchor, l: Math.round(d.hi.box.l), r: Math.round(d.hi.box.r) },
  lo: d.lo && { t: d.lo.text, y: d.lo.y, spitze: +d.bot.toFixed(1), achse: +d.priceBot.toFixed(2), x1: d.lo.x1, x2: d.lo.x2, a: d.lo.anchor, l: Math.round(d.lo.box.l), r: Math.round(d.lo.box.r) } });
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  const browser = await h.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page); await page.waitForTimeout(1500);
    await page.evaluate(() => document.getElementById('chart-sec').scrollIntoView({ block: 'start' })); await page.waitForTimeout(500);
    let d = await hl(page);
    check('Computer: „Hoch …“ an der obersten, „Tief …“ an der untersten Dochtspitze, Kurs wie an der Kursachse, Linie bis zur Beschriftung', atTips(d) && /^Hoch [\d.]+,\d\d$/.test(d.hi.text) && /^Tief [\d.]+,\d\d$/.test(d.lo.text), brief(d));
    check('Fett, Hoch grün und Tief rot (Schrift und Linie), mit Rand in Hintergrundfarbe', d.hi.weight === '700' && d.lo.weight === '700' && d.hi.fill === d.up && d.hi.stroke === d.up && d.lo.fill === d.down && d.lo.stroke === d.down && d.hi.halo && d.lo.halo, JSON.stringify({ hi: [d.hi.weight, d.hi.fill, d.hi.stroke], lo: [d.lo.weight, d.lo.fill, d.lo.stroke], up: d.up, down: d.down }));
    check('Im Kerzenbereich (nicht in der Kursspalte), nichts liegt darauf', [d.hi, d.lo].every(m => m.box.l >= 15 && m.box.r <= d.w - 82 && !m.hits.length), JSON.stringify([d.hi.hits, d.lo.hits]));
    // neues Hoch und neues Tief an der laufenden Kerze
    const hi0 = d.priceTop, lo0 = d.priceBot;
    await h.ctl(`/set?symbol=BTCUSDT&price=${(hi0 + 150).toFixed(2)}`); await page.waitForTimeout(2500); d = await hl(page);
    check('Neues Hoch live: „Hoch“ springt an die laufende Kerze (zeigt nach links), Kurs + 150', atTips(d) && Math.abs(d.hi.price - (hi0 + 150)) < .01 && Math.abs(d.hi.x1 - d.lastX) < .06 && d.hi.anchor === 'end', brief(d));
    await h.ctl(`/set?symbol=BTCUSDT&price=${(lo0 - 150).toFixed(2)}`); await page.waitForTimeout(2500); d = await hl(page);
    check('Neues Tief live: „Tief“ an der laufenden Kerze, Kurs − 150; Hoch bleibt', atTips(d) && Math.abs(d.lo.price - (lo0 - 150)) < .01 && Math.abs(d.lo.x1 - d.lastX) < .06 && Math.abs(d.hi.price - (hi0 + 150)) < .01, brief(d));
    await page.screenshot({ path: __dirname + '/shots/m27-desktop.png', clip: await (await page.$('#chart')).boundingBox() });
    // Zurückblättern: es gilt der sichtbare Ausschnitt
    await page.click('#pan-back'); await page.waitForTimeout(1200); d = await hl(page);
    check('Zurückgeblättert: Hoch und Tief des sichtbaren Ausschnitts', atTips(d) && d.hi.price < hi0 + 150 && d.lo.price > lo0 - 150, brief(d));
    await page.click('#pan-fwd'); await page.waitForTimeout(1200); d = await hl(page); // ein Schritt vor = wieder ganz vorne
    check('Wieder vorne: Hoch und Tief der laufenden Kerze', atTips(d) && Math.abs(d.hi.price - (hi0 + 150)) < .01 && Math.abs(d.lo.price - (lo0 - 150)) < .01, brief(d));
    // Ebene aus, gespeichert, wieder an
    const btn = '.overlay-toggles [data-overlay="hilo"]';
    const offState = async () => page.evaluate(b => ({ marks: document.querySelectorAll('#chart .hl-mark').length, pressed: document.querySelector(b).getAttribute('aria-pressed'), label: document.querySelector(b).textContent }), btn);
    await page.click(btn); await page.waitForTimeout(800); let o = await offState();
    check('Schalter „Hoch/Tief“ blendet beides aus', o.marks === 0 && o.pressed === 'false' && o.label === 'Hoch/Tief', JSON.stringify(o));
    await page.reload(); await live(page); await page.waitForTimeout(1500); o = await offState();
    check('Nach dem Neuladen weiter aus (gespeichert)', o.marks === 0 && o.pressed === 'false', JSON.stringify(o));
    await page.click(btn); await page.waitForTimeout(800); o = await offState();
    check('Wieder an: beide Beschriftungen da', o.marks === 2 && o.pressed === 'true', JSON.stringify(o));
    check('Computer: keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
    // Handy hochkant: nur der Kurs, vor den Kurs-Schildchen – die laufende Kerze hält Hoch und Tief und liegt unter ihnen
    for (const w of [390, 320]) {
      const pc = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 700 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }), pp = await pc.newPage(), pe = []; h.collect(pp, pe);
      await pp.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(pp); await pp.waitForTimeout(1500);
      await pp.evaluate(() => document.getElementById('chart').scrollIntoView({ block: 'center' })); await pp.waitForTimeout(800);
      const m = await hl(pp);
      if (w === 390) await pp.screenshot({ path: __dirname + '/shots/m27-phone-390.png', clip: await (await pp.$('#chart')).boundingBox() });
      check(`Handy ${w} px: nur der Kurs, an den Dochtspitzen, Kurs wie an der Achse`, atTips(m) && /^[\d.]+,\d\d$/.test(m.hi.text) && /^[\d.]+,\d\d$/.test(m.lo.text), brief(m));
      check(`Handy ${w} px: Beschriftung endet vor den Kurs-Schildchen, im Chart, nichts liegt darauf, kein seitliches Scrollen`, m && [m.hi, m.lo].every(k => k.box.l >= 0 && k.box.r <= m.w && !k.laneHit && !k.hits.length) && m.sw <= 0,
        JSON.stringify(m && { hits: [m.hi.hits, m.lo.hits], lane: [m.hi.laneHit, m.lo.laneHit], jüngste: [Math.abs(m.hi.x1 - m.lastX) < .06, Math.abs(m.lo.x1 - m.lastX) < .06], sw: m.sw }));
      if (w === 390) {
        await pp.click('#chart-full'); await pp.waitForTimeout(900); const r = await hl(pp);
        check('Handy, gedrehtes Vollbild (Kursspalte): „Hoch …“ und „Tief …“ an den Dochtspitzen', atTips(r) && /^Hoch /.test(r.hi.text) && /^Tief /.test(r.lo.text), brief(r));
        await pp.click('#fb-exit'); await pp.waitForTimeout(600);
      }
      check(`Handy ${w} px: keine Fehler`, !pe.length, pe.join(' | ')); await pc.close();
    }
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await h.ctl('/walk?on=1').catch(() => {}); await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
