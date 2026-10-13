// 3.70.0 – FVG-Ebene im Chart: Knopf „FVG“ in „Chart-Ebenen, Whales & Werkzeuge“ mit ⓘ-Erklärung, Boxen grün/rot (Deckkraft 0,2)
// bis zur schließenden Kerze bzw. offen bis zur letzten Kerze, Rückmeldung beim Einschalten, gespeichert, „Alle ausblenden“,
// Heikin-Ashi (Erkennung auf echten Kerzen), Handy. Feste Kerzen aus der Attrappe: bullisch 100,2…101 (an Kerze 40, berührt
// bei 70, geschlossen bei 75) und bärisch 99,8…100,3 (an Kerze 92, offen) – je 100 = Grundpreis.
// Aufruf: node m105.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + String(detail).slice(0, 500) : ''}`); };
const real = errs => errs.filter(e => !/Service Worker registration blocked|Failed to load resource|ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|net::ERR/.test(e));
const until = async (fn, ms = 15000, step = 200) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await h.sleep(step); } };

(async () => {
  await h.setup(); await h.ctl('/reset'); await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=SOLUSDT&price=150');
  const sh = await h.ctl('/shape?symbol=SOLUSDT&interval=1m&kind=fvg'), f = 150 / 100;
  const browser = await h.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(`${h.URL_BASE}/weather-widget-v2.html`);
    await page.waitForFunction(() => document.getElementById('price').textContent.trim() !== '—', null, { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => { document.getElementById('symbol').value = 'SOL'; document.getElementById('market-form').requestSubmit(); });
    await until(() => page.evaluate(() => document.getElementById('lb-sym')?.textContent === 'SOL' && document.querySelectorAll('#chart svg').length > 0));
    await page.waitForTimeout(1200);
    await page.evaluate(() => { const t = document.querySelector('.overlay-toggles'); const d = t.closest('details'); if (d) d.open = true; t.scrollIntoView({ block: 'center' }); });
    const btn = await page.evaluate(() => { const b = document.querySelector('.overlay-toggles [data-overlay="fvg"]'), tip = b?.nextElementSibling; return b && { text: b.textContent.trim(), pressed: b.getAttribute('aria-pressed'), tip: tip?.id, visible: b.getBoundingClientRect().width > 0, title: b.title }; });
    check('Knopf „FVG“ in „Chart-Ebenen, Whales & Werkzeuge“, daneben ⓘ; anfangs aus, keine Boxen', btn?.text === 'FVG' && btn.pressed === 'false' && btn.tip === 'fvg-tip' && btn.visible && /Kerze 1 und Kerze 3/.test(btn.title) && await page.evaluate(() => !document.querySelector('.fvg-box')), JSON.stringify({ sh, btn }));
    await page.click('[data-overlay="fvg"]'); await page.waitForTimeout(600);
    const toast = await page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent).join(' | '));
    check('Einschalten: Rückmeldung mit offenen/geschlossenen Lücken und der nächsten offenen', /FVG an: 1 offen \(0 bullisch grün, 1 bärisch rot\), 1 schon geschlossen\. Nächste offene: bärisch 149,7\d* – 150,45/.test(toast), toast);
    const L = await page.evaluate(() => __fvg.list());
    const bull = L.find(g => g.dir === 'bull'), bear = L.find(g => g.dir === 'bear'), near = (a, b) => Math.abs(a - b) < 1e-6;
    check('Erkennung: genau die zwei Lücken; bullisch berührt nach 30 und geschlossen nach 35 Kerzen, bärisch offen', L.length === 2 && near(bull.bottom, 100.2 * f) && near(bull.top, 101 * f) && bull.touch - bull.i === 30 && bull.mit - bull.i === 35 && near(bear.bottom, 99.8 * f) && near(bear.top, 100.3 * f) && bear.mit === -1, JSON.stringify(L));
    const boxes = () => page.evaluate(() => [...document.querySelectorAll('#chart .fvg-box')].map(r => ({ cls: r.getAttribute('class'), x: +r.getAttribute('x'), w: +r.getAttribute('width'), fill: r.getAttribute('fill'), op: r.getAttribute('fill-opacity'), title: r.querySelector('title')?.textContent })));
    let B = await boxes(); const bb = B.find(b => /bull/.test(b.cls)), be = B.find(b => /bear/.test(b.cls));
    const plot = await page.evaluate(() => { const c = [...document.querySelectorAll('#chart svg rect')].filter(r => +r.getAttribute('height') > 0 && r.getAttribute('rx') === '0.4'); const xs = c.map(r => +r.getAttribute('x') + +r.getAttribute('width')); return { lastRight: Math.max(...xs) }; });
    check('Zwei Boxen hinter den Kerzen: grün bullisch, rot bärisch, Deckkraft 0,2', B.length === 2 && bb && be && bb.op === '0.2' && be.op === '0.2' && bb.fill !== be.fill && /geschlossen/.test(bb.title) && /offen/.test(be.title) && await page.evaluate(() => { const g = document.querySelector('#chart .fvg-layer'), k = [...document.querySelectorAll('#chart svg > line')].find(l => l.getAttribute('stroke')); return !!g && !!k && !!(g.compareDocumentPosition(k) & Node.DOCUMENT_POSITION_FOLLOWING); }), JSON.stringify(B));
    check('Geschlossene Box endet an der schließenden Kerze, offene reicht bis zur letzten Kerze', bb.x + bb.w < be.x && be.x + be.w >= plot.lastRight - 2 && be.x + be.w <= plot.lastRight + 6, JSON.stringify({ bullEnd: bb.x + bb.w, bearStart: be.x, bearEnd: be.x + be.w, lastRight: plot.lastRight }));
    await page.click('#fvg-tip > summary'); await page.waitForTimeout(300);
    const tip = await page.evaluate(() => { const b = document.querySelector('#fvg-tip .tip-body'); return { open: document.getElementById('fvg-tip').open, vis: b.getBoundingClientRect().height > 0, text: b.textContent }; });
    check('ⓘ erklärt: Lücke zwischen Kerze 1 und 3, Marktungleichgewicht, Farben, mitigiert', tip.open && tip.vis && /Kerze 1 und Kerze 3/.test(tip.text) && /Marktungleichgewicht/.test(tip.text) && /Grün \(bullisch\)/.test(tip.text) && /mitigiert/.test(tip.text) && /kein Handelssignal/.test(tip.text));
    await page.click('#fvg-tip > summary');
    await page.click('#ha-btn'); await page.waitForTimeout(700);
    check('Heikin-Ashi an: dieselben zwei Boxen (Erkennung auf echten Kerzen)', (await boxes()).length === 2 && await page.evaluate(() => document.getElementById('ha-btn').getAttribute('aria-checked') === 'true'));
    await page.click('#ha-btn'); await page.waitForTimeout(400);
    await page.reload(); await page.waitForFunction(() => document.getElementById('price').textContent.trim() !== '—', null, { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => { document.getElementById('symbol').value = 'SOL'; document.getElementById('market-form').requestSubmit(); });
    await until(() => page.evaluate(() => document.getElementById('lb-sym')?.textContent === 'SOL' && document.querySelectorAll('#chart .fvg-box').length === 2));
    check('Neu laden: FVG bleibt an (gespeichert), Boxen wieder da', (await page.evaluate(() => JSON.parse(localStorage.getItem('scalpdesk.overlays.v1')).fvg)) === true && (await boxes()).length === 2);
    await page.evaluate(() => { const d = document.querySelector('.overlay-toggles').closest('details'); if (d) d.open = true; });
    await page.click('#ov-all'); await page.waitForTimeout(500);
    const hidden = await page.evaluate(() => ({ pressed: document.querySelector('[data-overlay="fvg"]').getAttribute('aria-pressed'), n: document.querySelectorAll('#chart .fvg-box').length }));
    await page.click('#ov-all'); await page.waitForTimeout(500);
    check('„Alle ausblenden“ blendet FVG mit aus, „Alle einblenden“ wieder ein', hidden.pressed === 'false' && hidden.n === 0 && (await boxes()).length === 2, JSON.stringify(hidden));
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(800);
    const mob = await page.evaluate(() => { const b = document.querySelector('[data-overlay="fvg"]').getBoundingClientRect(), i = document.querySelector('#fvg-tip > summary').getBoundingClientRect(); return { over: document.documentElement.scrollWidth - innerWidth, bw: b.width, bh: b.height, sib: document.querySelector('[data-overlay="fib"]').getBoundingClientRect().height, inRow: Math.abs((b.top + b.bottom) / 2 - (i.top + i.bottom) / 2) < 12 }; });
    check('Handy 390 px: Knopf so groß wie die übrigen Ebenen, ⓘ in derselben Zeile, kein seitliches Scrollen', mob.over <= 1 && mob.bh >= 34 && mob.bh === mob.sib && mob.inRow, JSON.stringify(mob));
    check('keine Fehler', !real(errors).length, real(errors).join(' | '));
    await ctx.close();
  } catch (e) { check('Abbruch', false, e.stack || e.message); }
  finally { await browser.close(); await h.ctl('/walk?on=1'); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
