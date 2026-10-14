// 3.71.0 – Nutzerrückmeldung (iPhone): „🔔 Alarm für diesen Kurs“ tat scheinbar nichts. Ursache: In der Bereichs-Navigation (Handy, PC)
// liegt „Alarme“ in einem anderen Bereich; das Formular öffnete unsichtbar. Jetzt wechselt der Knopf in den Bereich „Alarme“, das Formular
// ist sichtbar und trägt Coin und aktuellen Kurs ein. Echte Navigation (launch workspace 'fresh'): iPhone, iPad, PC.
// Aufruf: node m109.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + String(detail).slice(0, 600) : ''}`); };
const real = errs => errs.filter(e => !/Service Worker registration blocked|Failed to load resource|ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|net::ERR/.test(e));
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

(async () => {
  await h.setup(); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  const browser = await h.launch({ workspace: 'fresh' });
  try {
    for (const [name, w, hh, ua, touch] of [['iPhone', 390, 844, IPHONE, true], ['iPad quer', 1180, 820, IPAD, true], ['PC', 1440, 900, undefined, false]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: hh }, hasTouch: touch, isMobile: touch && w < 600, ...(ua ? { userAgent: ua } : {}) }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
      await page.goto(`${h.URL_BASE}/weather-widget-v2.html`); await page.waitForFunction(() => document.getElementById('price').textContent.trim() !== '—', null, { timeout: 20000 });
      const btn = page.locator('#alarm-here'); await btn.scrollIntoViewIfNeeded();
      const before = await page.evaluate(() => ({ ws: document.documentElement.dataset.workspace, view: document.documentElement.dataset.workspaceView, hidden: getComputedStyle(document.getElementById('alarms')).display === 'none' }));
      const box = await btn.boundingBox(); if (touch) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); else await btn.click();
      await page.waitForTimeout(1200);
      const r = await page.evaluate(() => { const f = document.getElementById('alarm-form'), rf = f.getBoundingClientRect(), price = document.getElementById('al-price').value, cur = Number(String(__g05.state.prices[__g05.state.symbol]?.price || 0));
        return { hidden: f.hidden, disp: getComputedStyle(document.getElementById('alarms')).display, top: Math.round(rf.top), h: Math.round(rf.height), vh: innerHeight, sym: document.getElementById('al-symbol').value, price, cur, view: document.documentElement.dataset.workspaceView }; });
      check(`${name}: Ausgangslage – Bereichs-Navigation, „Alarme“ im aktuellen Bereich nicht sichtbar`, before.ws === 'focus' && before.hidden, JSON.stringify(before));
      check(`${name}: Antippen öffnet das Alarm-Formular sichtbar im Bild (Bereich „Alarme“)`, !r.hidden && r.disp !== 'none' && r.h > 100 && r.top >= 0 && r.top < r.vh - 60, JSON.stringify(r));
      check(`${name}: Coin und aktueller Kurs eingetragen`, r.sym === 'BTC' && Number(r.price.replace(/\./g, '').replace(',', '.')) > 0 && Math.abs(Number(r.price.replace(/\./g, '').replace(',', '.')) / (r.cur || 1) - 1) < 0.01, JSON.stringify(r));
      await page.fill('#al-price', String(Math.round(r.cur * 1.01)).replace('.', ',')); await page.fill('#al-note', 'm109'); await page.click('#al-save');   // genau auf dem Kurs lehnt die App ab (schon erreicht)
      const saved = await page.waitForFunction(() => (__g05.state.alarms || []).filter(a => a.note === 'm109').length, null, { timeout: 8000 }).then(x => x.jsonValue()).catch(() => 0);
      const why = await page.evaluate(() => ({ err: document.getElementById('al-error')?.textContent || '', n: (__g05.state.alarms || []).length, keys: Object.keys(__g05.state).filter(k => /alarm/i.test(k)) }));
      check(`${name}: Alarm lässt sich direkt speichern`, saved === 1, JSON.stringify({ saved, ...why }));
      check(`${name}: keine Fehler`, !real(errors).length, real(errors).join(' | '));
      await ctx.close();
    }
  } catch (e) { check('Abbruch', false, e.stack || e.message); }
  finally { await browser.close(); await h.ctl('/walk?on=1'); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
