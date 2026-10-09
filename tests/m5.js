// Ruhiges Layout und flüssiges Scrollen. Aufruf: node m5.js [testname ...]   (PAGE=datei.html für die Gegenprobe)
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const PAGE = process.env.PAGE || 'weather-widget-v2.html';
const now = Date.now();
const seed = ({ now }) => { if (localStorage.getItem('scalpdesk.savedat.v1')) return;
  const P = (id, sym, side, entry, extra = {}) => ({ id, symbol: sym, side, mode: 'isolated', entry, leverage: 20, qty: side === 'long' ? 0.02 : 300, margin: 60, openedAt: now - 3600e3, source: 'spot', liqExchange: null, preRealized: 0, sl: null, tp: null, ack: { sl: false, tp: false }, ...extra });
  localStorage.setItem('scalpdesk.positions.v1', JSON.stringify([P('s1', 'XRPUSDT', 'long', 1.5, { sl: 1.49, tp: 1.6 }), P('s2', 'BTCUSDT', 'long', 63900, { sl: 63000, tp: 65500 }), P('s3', 'ETHUSDT', 'long', 2500, { sl: 2400 })]));
  localStorage.setItem('scalpdesk.alarms.v1', JSON.stringify([{ id: 'sa', symbol: 'BTCUSDT', dir: 'above', price: 64800, note: 'Ausbruch über Widerstand', source: 'spot', createdAt: now, triggeredAt: null, triggerPrice: null }]));
};
// Safari nachstellen: kein eingebauter Scroll-Anker
const safari = () => { const orig = CSS.supports.bind(CSS); CSS.supports = (p, v) => (p === 'overflow-anchor' ? false : orig(p, v)); document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = 'html{overflow-anchor:none!important}'; document.head.append(s); }); };
async function open(browser, view, { init = [] } = {}) {
  const ctx = await browser.newContext(view); for (const [fn, arg] of [[seed, { now }], ...init]) await ctx.addInitScript(fn, arg);
  const page = await ctx.newPage(), errors = []; h.collect(page, errors);
  await page.goto(h.URL_BASE + '/' + PAGE);
  await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  return { ctx, page, errors };
}
const ipad = { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true };
const tests = {
  async heights(browser) {
    for (const w of [390, 820, 1024, 1180]) {
      const { ctx, page, errors } = await open(browser, { viewport: { width: w, height: 1000 }, hasTouch: true, isMobile: true });
      const r = await page.evaluate(() => {
        const H = s => Math.round(document.querySelector(s).getBoundingClientRect().height), set = (id, t) => { document.getElementById(id).textContent = t; };
        const base = [H('.topbar'), H('#livebar'), H('.chart-heading')];
        for (const t of ['Pausiert', 'Datenfehler · 14 s', 'Teils live · 58 s']) set('status', t);
        set('lb-open', '+1.234,56 USDT · 3'); set('lb-day', '−234,56 USDT'); set('lb-price', '104.123,45'); set('lb-change', '−12,34 %'); document.getElementById('lb-alarm').hidden = false; set('lb-alarm', '🔔 12');
        set('price-eur', '≈ 88.123,79 € / BTC'); set('updated', 'Zwischenspeicher, wird aktualisiert · 14:50:50 UTC'); set('price', '104.123,45'); set('candle-change', '−12,34 % · Kerze');
        return { base, after: [H('.topbar'), H('#livebar'), H('.chart-heading')] };
      });
      check(`${w}px: Kopfzeile, Live-Leiste und Chart-Kopf behalten ihre Höhe bei langen Werten`, r.base.join() === r.after.join(), `${r.base.join('/')} → ${r.after.join('/')}`);
      check(`${w}px: keine Fehler`, !errors.length, errors.join(' | ')); await ctx.close();
    }
  },
  async shifts(browser) {
    const { ctx, page, errors } = await open(browser, ipad, { init: [[safari, null]] });
    await page.evaluate(() => { window.__ls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__ls += e.value; }).observe({ type: 'layout-shift' }); });
    let sum = 0;
    for (const tab of ['chart', 'pos']) {
      await page.click(`#tabbar [data-tab="${tab}"]`); await page.waitForTimeout(500);
      const H = await page.evaluate(() => document.scrollingElement.scrollHeight - innerHeight);
      for (const f of [0.3, 0.7]) { await page.evaluate(y => scrollTo(0, y), Math.round(H * f)); await page.waitForTimeout(300); await page.evaluate(() => { window.__ls = 0; }); await page.waitForTimeout(6000); sum += await page.evaluate(() => window.__ls); }
    }
    check('Live-Updates 24 s lang (iPad, Chart und Positionen): keine Layout-Verschiebung', sum < 0.005, `Summe ${sum.toFixed(4)}`);
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async anchor(browser) {
    await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=XRPUSDT&price=1.5');
    const { ctx, page, errors } = await open(browser, ipad, { init: [[safari, null]] });
    await page.click('#tabbar [data-tab="pos"]'); await page.waitForTimeout(800);
    // Erste Karte (XRP) ganz über dem sichtbaren Bereich; Bezugspunkt: die erste Karte der nächsten Reihe (iPad: zwei Spalten)
    const refIdx = await page.evaluate(() => { const c = [...document.querySelectorAll('.pos-card')], b = c[0].getBoundingClientRect().bottom; return c.findIndex(x => x.getBoundingClientRect().top >= b); });
    const y = await page.evaluate(i => Math.round(scrollY + document.querySelectorAll('.pos-card')[i].getBoundingClientRect().top - document.getElementById('livebar').getBoundingClientRect().bottom - 20), refIdx);
    await page.evaluate(y => scrollTo(0, y), y); await page.waitForTimeout(800);
    const ref = () => page.evaluate(i => Math.round(document.querySelectorAll('.pos-card')[i].getBoundingClientRect().top), refIdx);
    const t0 = await ref(), cardH0 = await page.evaluate(() => Math.round(document.querySelector('.pos-card').getBoundingClientRect().height));
    await h.ctl('/set?symbol=XRPUSDT&price=1.48');   // Stop-Loss der ersten Karte: Hinweis erscheint oberhalb des Bildausschnitts
    await page.waitForFunction(() => !document.querySelector('.pos-card .pos-alert').hidden, null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const t1 = await ref(), cardH1 = await page.evaluate(() => Math.round(document.querySelector('.pos-card').getBoundingClientRect().height));
    check('Hinweis oberhalb wächst die erste Karte', cardH1 > cardH0, `${cardH0} → ${cardH1} px`);
    check('Sichtbarer Inhalt bleibt stehen (Scroll-Anker ohne Browser-Unterstützung)', Math.abs(t1 - t0) <= 1, `Bezugskarte ${t0} → ${t1} px`);
    await h.ctl('/walk?on=1');
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async scrolldefer(browser) {
    const { ctx, page, errors } = await open(browser, ipad);
    const res = await page.evaluate(async () => {
      let n = 0; const mo = new MutationObserver(ms => { n += ms.length; }); mo.observe(document.getElementById('lb-price'), { childList: true, characterData: true, subtree: true });
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      await sleep(3000); const idle = n; n = 0;
      document.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [] })); // Finger liegt auf
      for (let i = 0; i < 100; i++) { scrollBy(0, i % 2 ? 3 : -3); await sleep(30); }  // 3 s wischen
      const during = n; n = 0;
      document.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [] }));
      await sleep(3000); const after = n; mo.disconnect();
      return { idle, during, after };
    });
    check('Ohne Wischen: Kurs in der Live-Leiste aktualisiert sich', res.idle >= 2, JSON.stringify(res));
    check('Während des Wischens: keine Änderungen an der Seite', res.during === 0, JSON.stringify(res));
    check('Danach: Aktualisierung läuft weiter', res.after >= 2, JSON.stringify(res));
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async stucktouch(browser) {
    const { ctx, page, errors } = await open(browser, ipad);
    const res = await page.evaluate(async () => {
      let n = 0; const mo = new MutationObserver(ms => { n += ms.length; }); mo.observe(document.getElementById('lb-price'), { childList: true, characterData: true, subtree: true });
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      document.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [] }));  // „touchend“ kommt nie an (berührtes Element ersetzt)
      await sleep(3000); const held = n; n = 0;
      await sleep(4000); const later = n; mo.disconnect();
      return { held, later };
    });
    check('Finger liegt auf: Anzeige wartet', res.held <= 1, JSON.stringify(res));
    check('„touchend“ geht verloren: nach spätestens 4 s laufen die Live-Werte weiter', res.later >= 2, JSON.stringify(res));
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async offscreen(browser) {
    const { ctx, page, errors } = await open(browser, { viewport: { width: 820, height: 700 }, hasTouch: true, isMobile: true });
    // Der zusätzliche BTC-Kopf kann den Chart unter den ersten Bildschirm verschieben.
    await page.locator('#chart').scrollIntoViewIfNeeded();
    const count = () => page.evaluate(() => new Promise(r => { let n = 0; const mo = new MutationObserver(ms => { n += ms.filter(m => m.type === 'childList').length; }); mo.observe(document.getElementById('chart'), { childList: true }); setTimeout(() => { mo.disconnect(); r(n); }, 4000); }));
    const vis = await count();
    await page.evaluate(() => document.getElementById('alarms').scrollIntoView()); await page.waitForTimeout(400);
    const off = await count();
    await page.locator('#chart').scrollIntoViewIfNeeded(); await page.waitForTimeout(600);
    const back = await page.evaluate(() => !!document.querySelector('#chart svg') && /UTC/.test(document.getElementById('updated').textContent));
    check('Chart sichtbar: wird live neu gezeichnet', vis >= 2, `${vis}× in 4 s`);
    check('Chart außerhalb des Bildes: kein Neuzeichnen', off === 0, `${off}× in 4 s`);
    check('Zurückgescrollt: Chart sofort aktuell', back);
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
};
(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(tests);
  await h.setup(); await h.ctl('/reset');
  const browser = await h.launch();
  try { for (const n of names) { console.log(`▶ ${n}`); await h.ctl('/reset'); try { await tests[n](browser); } catch (e) { check(n + ' (Abbruch)', false, e.message.split('\n')[0]); } } }
  finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
