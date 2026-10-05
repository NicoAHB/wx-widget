// 3.21.1 – Seitensprünge auf der Chart-Seite am Handy. Safari nachgestellt (keine eingebaute Scroll-Verankerung, die App
// gleicht dann selbst aus). Man liest weiter unten (Signal-Übersicht unter Kalender und Coin-News), während oben die
// Termin-Warnung erscheint: Warnzeile im Kalender und eigene Zeile in der Live-Leiste. Der sichtbare Inhalt muss stehen
// bleiben. Dazu: Der Kalender aktualisiert nicht, solange ein Finger auf dem Bildschirm liegt, und holt es danach nach.
// Aufruf: node m32.js (PAGE=datei.html für die Gegenprobe mit einer älteren Fassung)
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const PAGE = process.env.PAGE || 'weather-widget-v2.html';
const safari = () => {
  const orig = CSS.supports.bind(CSS); CSS.supports = (a, b) => /overflow-anchor/.test(String(a) + String(b ?? '')) ? false : orig(a, b);
  const add = () => { const st = document.createElement('style'); st.textContent = '*{overflow-anchor:none!important}'; document.documentElement.append(st); };
  if (document.documentElement) add(); else document.addEventListener('DOMContentLoaded', add);
};
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset');
  const browser = await h.launch();
  try {
    // Termin in 16 Minuten: die Warnung (15 Minuten vorher) beginnt gut eine Minute nach dem Laden
    await h.ctl('/cal?mode=soon&min=16');
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await ctx.addInitScript(safari);
    const page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/' + PAGE);
    await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(4000);
    const pre = await page.evaluate(() => ({ warn: !document.getElementById('econ-warn').hidden, anchor: !(globalThis.CSS && CSS.supports('overflow-anchor', 'auto')) }));
    check('Ausgangslage: Safari-Verhalten (ohne eingebaute Verankerung), noch keine Warnung', pre.anchor && !pre.warn, JSON.stringify(pre));
    // Weiter unten lesen: Signal-Übersicht knapp unter der Live-Leiste
    await page.evaluate(() => { const r = document.getElementById('signals').getBoundingClientRect(); scrollBy(0, r.top - 220); });
    await page.waitForTimeout(800);
    const track = await page.evaluate(() => new Promise(done => {
      const s = document.getElementById('signals'), w = document.getElementById('econ-warn'), chip = document.getElementById('lb-news'), lb = document.getElementById('livebar');
      const top0 = s.getBoundingClientRect().top, lb0 = lb.getBoundingClientRect().height, t0 = Date.now(), samples = [];
      let seen = 0;
      const id = setInterval(() => {
        const top = s.getBoundingClientRect().top, on = !w.hidden;
        samples.push(Math.round(top - top0));
        if (on && !seen) seen = Date.now();
        if ((seen && Date.now() - seen > 4000) || Date.now() - t0 > 110000) {
          clearInterval(id);
          done({ seenAfter: seen ? Math.round((seen - t0) / 1000) : null, maxShift: Math.max(...samples.map(Math.abs)), last: samples.at(-1), warnH: Math.round(w.getBoundingClientRect().height),
            chip: !chip.hidden, lbGrow: Math.round(lb.getBoundingClientRect().height - lb0), scroll: Math.round(scrollY) });
        }
      }, 200);
    }));
    check('Termin-Warnung erscheint während des Lesens (Warnzeile im Kalender und Zeile in der Live-Leiste)', track.seenAfter !== null && track.warnH > 20 && track.chip && track.lbGrow > 10, JSON.stringify(track));
    check('Der gelesene Inhalt bleibt stehen (höchstens 2 px)', track.maxShift <= 2, JSON.stringify({ maxShift: track.maxShift, last: track.last }));
    // Solange ein Finger auf dem Bildschirm liegt (und sich bewegt), wartet der Kalender mit dem Aktualisieren – danach holt er nach
    const held = await page.evaluate(() => new Promise(done => {
      const box = document.getElementById('econ'); let during = 0, after = 0, phase = 'hold';
      const mo = new MutationObserver(ms => { if (phase === 'hold') during += ms.length; else after += ms.length; }); mo.observe(box, { childList: true, subtree: true, characterData: true });
      const touch = t => dispatchEvent(new TouchEvent(t, { touches: [], bubbles: true }));
      touch('touchstart'); const keep = setInterval(() => touch('touchmove'), 500);
      setTimeout(() => { clearInterval(keep); phase = 'after'; touch('touchend'); setTimeout(() => { mo.disconnect(); done({ during, after }); }, 3000); }, 65000);
    }));
    check('Während ein Finger auf dem Bildschirm liegt, wartet der Kalender; danach holt er nach', held.during === 0 && held.after > 0, JSON.stringify(held));
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await h.ctl('/cal?mode=normal').catch(() => {}); await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
