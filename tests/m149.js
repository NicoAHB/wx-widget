// 3.93.0 – (1) Kurs-Schild im Chart: Antippen blendet es bis zur nächsten Minuten-Kerze aus (Kurslinie bleibt, Rasterbeschriftung kommt zurück),
// (2) Vorauswahl-Kacheln laden mehrere Coins gleichzeitig (vorher einer je Sekundentakt: sechs Coins brauchten sechs Sekunden).
// Aufruf: node m149.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + String(detail).slice(0, 400) : ''}`); };
const real = errs => errs.filter(e => !/Service Worker registration blocked|Failed to load resource|ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|net::ERR/.test(e));
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
const tagState = page => page.evaluate(() => ({ tag: document.querySelectorAll('#chart svg .last-tag').length, hit: document.querySelectorAll('#chart svg .last-hit').length, line: document.querySelectorAll('#chart svg .last-line').length }));

(async () => {
  await h.setup(); await h.ctl('/reset'); await h.ctl('/walk?on=0'); await h.ctl('/restdelay?ms=300');
  const browser = await h.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }), page = await ctx.newPage(), errors = [];
    h.collect(page, errors);
    // Gleichzeitigkeit der Vorauswahl-Abrufe mitschneiden, sobald die Hilfsschnittstelle da ist
    await page.addInitScript(() => { window.__wlMax = 0; window.__wlLoadedAt = 0; const t0 = performance.now(); setInterval(() => { try { const es = [...__g09.wl.c.values()]; const n = es.filter(e => e.loading).length; if (n > window.__wlMax) window.__wlMax = n; if (es.length && es.every(e => e.at) && !window.__wlLoadedAt) window.__wlLoadedAt = performance.now() - t0; } catch {} }, 10); });
    await page.goto(`${h.URL_BASE}/weather-widget-v2.html`); await live(page);
    await page.waitForFunction(() => window.__wlLoadedAt > 0, null, { timeout: 40000 }).catch(() => {});
    const wl = await page.evaluate(() => ({ max: window.__wlMax, at: Math.round(window.__wlLoadedAt), n: [...__g09.wl.c.values()].length }));
    check('Vorauswahl: mehrere Coins werden gleichzeitig geladen (2 bis 4 Abrufe parallel)', wl.max >= 2 && wl.max <= 4, `parallel ${wl.max}, ${wl.n} Coins`);
    check('Vorauswahl: alle Kacheln stehen nach höchstens 6 s (vorher mit 300 ms Antwortzeit über 8 s)', wl.at > 0 && wl.at < 6000, `${wl.at} ms`);
    const tf = await page.evaluate(() => [...__g09.wl.c.values()].filter(e => e.tf).length);
    await page.waitForFunction(() => [...__g09.wl.c.values()].every(e => e.tf), null, { timeout: 15000 }).catch(() => {});
    check('Vorauswahl: auch die Spalten 1m · 5m · 1h · 1d füllen sich zügig', await page.evaluate(() => [...__g09.wl.c.values()].every(e => e.tf)), `vorher ${tf}`);

    // ---- Kurs-Schild ----
    await h.ctl('/restdelay?ms=0');
    await page.evaluate(() => document.getElementById('chart').scrollIntoView({ block: 'center' })); await page.waitForTimeout(900);
    await page.waitForSelector('#chart svg .last-tag', { timeout: 20000 }).catch(() => {});
    const s0 = await tagState(page);
    check('Kurs-Schild ist da, mit größerer Tippfläche und Kurslinie', s0.tag === 1 && s0.hit === 1 && s0.line === 1, JSON.stringify(s0));
    // kurz vor der vollen Minute tippen, damit der Test nicht eine Minute wartet
    await page.waitForFunction(() => new Date().getSeconds() >= 54 || new Date().getSeconds() <= 1, null, { timeout: 70000, polling: 200 });
    await page.waitForFunction(() => new Date().getSeconds() >= 54, null, { timeout: 70000, polling: 200 }).catch(() => {});
    const box = await page.evaluate(() => { const r = document.querySelector('#chart svg .last-tag rect').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    const rowsBefore = await page.evaluate(() => document.querySelectorAll('#chart svg .axis-tag').length);
    await page.touchscreen.tap(box.x, box.y);
    await page.waitForFunction(() => !document.querySelector('#chart svg .last-tag'), null, { timeout: 3000 }).catch(() => {});
    const s1 = await tagState(page);
    check('Antippen blendet das Kurs-Schild aus; die Kurslinie bleibt', s1.tag === 0 && s1.hit === 0 && s1.line === 1, JSON.stringify(s1));
    const rowsAfter = await page.evaluate(() => document.querySelectorAll('#chart svg .axis-tag').length);
    check('Rasterbeschriftungen, die das Schild verdeckt hatte, sind wieder da (nicht weniger als vorher)', rowsAfter >= rowsBefore, `${rowsBefore} → ${rowsAfter}`);
    await page.waitForTimeout(1200);
    check('Das Schild bleibt bis zum Ende der Minute aus (auch nach Neuzeichnen)', (await tagState(page)).tag === 0 || await page.evaluate(() => new Date().getSeconds() < 5));
    // nächste Minute: Schild kommt wieder
    await page.waitForFunction(() => document.querySelector('#chart svg .last-tag'), null, { timeout: 15000 }).catch(() => {});
    const s2 = await tagState(page);
    check('Mit der nächsten Minuten-Kerze erscheint das Schild wieder (Preis und Uhr)', s2.tag === 1 && /\d/.test(await page.evaluate(() => document.querySelector('#chart svg .last-price')?.textContent || '')), JSON.stringify(s2));
    // erneut ausblenden und Coin wechseln: gilt nur für den getippten Coin
    const box2 = await page.evaluate(() => { const r = document.querySelector('#chart svg .last-tag rect').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    const sec = await page.evaluate(() => new Date().getSeconds());
    if (sec < 50) {
      await page.touchscreen.tap(box2.x, box2.y);
      await page.waitForFunction(() => !document.querySelector('#chart svg .last-tag'), null, { timeout: 3000 }).catch(() => {});
      const hidden = (await tagState(page)).tag === 0;
      await page.evaluate(() => { const b = document.querySelector('#watchlist .wl-tile[data-watch="ETC"]'); b?.click(); });
      await page.waitForFunction(() => document.querySelector('#chart svg .last-tag'), null, { timeout: 15000 }).catch(() => {});
      check('Anderer Coin: Kurs-Schild steht dort wieder', hidden && (await tagState(page)).tag === 1);
    } else check('Anderer Coin: Kurs-Schild steht dort wieder (übersprungen, Minute fast um)', true);
    check('Keine Skriptfehler', real(errors).length === 0, real(errors).join(' | '));
  } finally { await browser.close(); await h.teardown?.(); }
  const bad = results.filter(r => !r.ok).length; console.log(`\n${results.length - bad}/${results.length} bestanden`); process.exit(bad ? 1 : 0);
})().catch(e => { console.error('Abbruch:', e); process.exit(1); });
