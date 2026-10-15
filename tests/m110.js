// 3.71.0 – Nutzerrückmeldung (Handy): Rein- und Rauszoomen im Chart ruckelt. Jetzt folgt das fertige Chartbild während der Geste in jedem
// Bild per Strecken/Verschieben dem Finger (auch Bruchteile einer Kerze), neu gezeichnet wird nur gelegentlich und am Ende der Geste genau.
// Geprüft: zwei Finger (iPhone, CDP-Touch) zoomen hinein und heraus, die Kerze unter der Fingermitte bleibt dort, weniger Neuzeichnungen als
// Bewegungen, Zwischenbilder per Transformation, Seite scrollt nicht mit; Wischen mit Schwung; Tippen wählt weiter eine Kerze; PC: Strg+Mausrad
// (Trackpad-Zoom) und waagrechtes Blättern; keine Fehler.
// Aufruf: node m110.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + String(detail).slice(0, 600) : ''}`); };
const real = errs => errs.filter(e => !/Service Worker registration blocked|Failed to load resource|ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|net::ERR/.test(e));

// Beobachter im Browser: Neuzeichnungen (neues SVG im Chart) und je Bild die Transformation der wandernden Ebene
const WATCH = () => {
  const box = document.getElementById('chart'), W = window.__m110 = { draws: 0, frames: [], on: true };
  new MutationObserver(ms => { for (const m of ms) if ([...m.addedNodes].some(n => n.tagName === 'svg')) W.draws++; }).observe(box, { childList: true });
  const tick = () => { if (!W.on) return; const g = box.querySelector(':scope > svg > g.lv-clip > g'); W.frames.push(g?.getAttribute('transform') || ''); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
};
const view = page => page.evaluate(() => { const v = __g05.state; const G = window.__chartDetail.geometry; return { count: Math.min(v.count, v.candles.length), pan: v.pan, len: v.candles.length, offset: G?.offset, step: G?.step, left: G?.left, w: G?.w, n: G?.count }; });
// Kerze (absoluter Index) unter einer Bildschirmstelle x
const candleAt = (page, x) => page.evaluate(x => { const box = document.getElementById('chart'), b = box.getBoundingClientRect(), G = window.__chartDetail.geometry; return G.offset + Math.floor(((x - b.left) * G.w / b.width - G.left) / G.step); }, x);

(async () => {
  await h.setup(); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  const browser = await h.launch();
  try {
    // ---------- iPhone: zwei Finger ----------
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 }), page = await ctx.newPage(), errors = [];
    h.collect(page, errors);
    await page.goto(`${h.URL_BASE}/weather-widget-v2.html`); await page.waitForFunction(() => __g05.state.candles.length > 100, null, { timeout: 20000 });
    await page.locator('#chart').scrollIntoViewIfNeeded(); await page.waitForFunction(() => document.querySelector('#chart svg'), null, { timeout: 15000 }); await page.waitForTimeout(800);
    await page.evaluate(WATCH);
    const cdp = await ctx.newCDPSession(page), box = await page.locator('#chart').boundingBox();
    const cx = box.x + box.width * .5, cy = box.y + box.height * .45;
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x: Math.round(x), y: Math.round(y), id: i + 1 })) });
    const pinch = async (d0, d1, steps = 24, dy = 0, cx1 = cx) => {
      await touch('touchStart', [[cx - d0 / 2, cy], [cx + d0 / 2, cy]]);
      for (let i = 1; i <= steps; i++) { const d = d0 + (d1 - d0) * i / steps, m = cx + (cx1 - cx) * i / steps, y = cy + dy * i / steps; await touch('touchMove', [[m - d / 2, y], [m + d / 2, y]]); await page.waitForTimeout(16); }
      await touch('touchEnd', []);
    };
    const v0 = await view(page), mid0 = await candleAt(page, cx), y0 = await page.evaluate(() => scrollY);
    await page.evaluate(() => { __m110.draws = 0; __m110.frames = []; });
    await pinch(80, 240, 24, 30);   // auseinander (hineinzoomen), dabei 30 px nach unten verzogen
    const during = await page.evaluate(() => ({ draws: __m110.draws, frames: __m110.frames.slice() }));
    await page.waitForTimeout(500);
    const v1 = await view(page), mid1 = await candleAt(page, cx), y1 = await page.evaluate(() => scrollY), final1 = await page.evaluate(() => !!document.querySelector('#chart > svg > g.lv-clip'));
    const moved = during.frames.filter(Boolean), kinds = new Set(moved);
    check('Hineinzoomen mit zwei Fingern: etwa ein Drittel der Kerzen (Fingerabstand 80 → 240 px)', v1.count < v0.count * .45 && v1.count > v0.count * .22, `${v0.count} → ${v1.count}`);
    check('… die Kerze unter der Fingermitte bleibt unter der Fingermitte (±1)', Math.abs(mid1 - mid0) <= 1, `${mid0} → ${mid1}`);
    check('… Zwischenbilder per Transformation (viele verschiedene)', kinds.size >= 6, `${kinds.size} Transformationen in ${during.frames.length} Bildern · ${during.draws} Neuzeichnungen bei 24 Bewegungen`);
    // Flüssigkeit wie auf einem 120-Hz-Display: 60 Fingerbewegungen im 8-ms-Takt direkt im Browser (CDP liefert nur etwa alle 60 ms)
    const fast = await page.evaluate(async ([cx, cy]) => {
      const box = document.getElementById('chart'), ev = (type, id, x) => box.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: id === 11, clientX: x, clientY: cy }));
      const s0 = { ...__chartLive.stats }; __m110.draws = 0; __m110.frames = [];
      ev('pointerdown', 11, cx - 50); ev('pointerdown', 12, cx + 50);
      for (let i = 1; i <= 60; i++) { const d = 100 + 120 * i / 60; ev('pointermove', 11, cx - d / 2); ev('pointermove', 12, cx + d / 2); await new Promise(r => setTimeout(r, 8)); }
      const mid = { draws: __m110.draws, lite: __chartLive.stats.lite - s0.lite, kinds: new Set(__m110.frames.filter(Boolean)).size, ms: Math.round(__chartLive.ms) };
      ev('pointerup', 11, cx - 110); ev('pointerup', 12, cx + 110); await new Promise(r => setTimeout(r, 400));
      return { ...mid, after: __m110.draws, full: __chartLive.stats.draw - __chartLive.stats.lite - (s0.draw - s0.lite) };
    }, [cx, cy]);
    check('… flüssig bei 120 Hz: jedes Bild per Transformation, höchstens etwa alle 50 ms neu gezeichnet (vereinfacht), am Ende einmal vollständig', fast.kinds >= 10 && fast.lite <= 14 && fast.lite >= 2 && fast.full >= 1, JSON.stringify(fast));
    check('… Seite scrollt beim Zoomen nicht mit (auch mit senkrechtem Versatz)', Math.abs(y1 - y0) < 2, `${y0} → ${y1}`);
    check('… am Ende genau gezeichnet: ganze Kerzen, keine Transformation mehr', Number.isInteger(v1.count) && Number.isInteger(v1.pan) && !final1, JSON.stringify(v1));
    await page.waitForTimeout(300); const v1b = await view(page);
    await page.evaluate(() => { __m110.draws = 0; __m110.frames = []; });
    await pinch(240, 100, 20);   // zusammen (herauszoomen)
    await page.waitForTimeout(500);
    const v2 = await view(page);
    check('Herauszoomen mit zwei Fingern: wieder mehr Kerzen (etwa 2,4-fach)', v2.count > v1b.count * 1.8, `${v1b.count} → ${v2.count}`);
    // Zoomen und gleichzeitig verschieben: Fingermitte wandert 80 px nach rechts → ältere Kerzen
    const midA = await candleAt(page, cx);
    await pinch(120, 140, 20, 0, cx + 80); await page.waitForTimeout(500);
    const midB = await candleAt(page, cx + 80), v3 = await view(page);
    check('Zwei Finger verschieben beim Zoomen: dieselbe Kerze folgt der Fingermitte (±1), Ausschnitt in die Vergangenheit', Math.abs(midB - midA) <= 1 && v3.pan > v2.pan, `${midA} → ${midB} · pan ${v2.pan} → ${v3.pan}`);
    // Wischen mit Schwung
    await page.evaluate(() => { __g05.state.pan = 0; __g05.state.anchorTime = null; window.__chartDetail.pan(0); }); await page.waitForTimeout(300);
    const p0 = (await view(page)).pan;
    await touch('touchStart', [[cx - 60, cy]]);
    for (let i = 1; i <= 6; i++) { await touch('touchMove', [[cx - 60 + i * 22, cy]]); await page.waitForTimeout(12); }
    await touch('touchEnd', []);
    const atRelease = await page.evaluate(() => window.__chartDetail.geometry && __g05.state.pan);
    await page.waitForTimeout(1200);
    const pEnd = (await view(page)).pan;
    check('Wischen nach rechts: blättert zurück und läuft nach dem Loslassen mit Schwung weiter', pEnd > p0 && pEnd > atRelease + 2 && Number.isInteger(pEnd), `vorher ${p0} · beim Loslassen ${atRelease} · danach ${pEnd}`);
    // Tippen wählt weiter eine Kerze, doppelt tippen springt zurück zu jetzt
    await page.waitForTimeout(400); await page.touchscreen.tap(cx, cy); await page.waitForTimeout(400);
    const sel = await page.evaluate(() => __g05.state.selected);
    await page.touchscreen.tap(cx, cy); await page.waitForTimeout(80); await page.touchscreen.tap(cx, cy); await page.waitForTimeout(600);
    check('Tippen wählt eine Kerze; doppelt tippen springt zurück zu jetzt', sel !== null && sel !== undefined && (await view(page)).pan === 0, `Auswahl ${sel} · pan ${(await view(page)).pan}`);
    check('keine Fehler (iPhone)', !real(errors).length, real(errors).join(' | '));
    await ctx.close();

    // ---------- PC: Strg+Mausrad (Trackpad-Zoom), waagrechtes Blättern ----------
    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } }), pc = await ctx2.newPage(), err2 = [];
    h.collect(pc, err2);
    await pc.goto(`${h.URL_BASE}/weather-widget-v2.html`); await pc.waitForFunction(() => __g05.state.candles.length > 100, null, { timeout: 20000 });
    await pc.locator('#chart').scrollIntoViewIfNeeded(); await pc.waitForFunction(() => document.querySelector('#chart svg'), null, { timeout: 15000 }); await pc.waitForTimeout(800); await pc.evaluate(WATCH);
    const b2 = await pc.locator('#chart').boundingBox(), px = b2.x + b2.width * .4, py = b2.y + b2.height * .45;
    const w0 = await view(pc), m0 = await candleAt(pc, px), sy0 = await pc.evaluate(() => scrollY);
    await pc.mouse.move(px, py);
    await pc.evaluate(() => { __m110.draws = 0; __m110.frames = []; });
    // Trackpad-Zoom: 40 kleine Schritte im 8-ms-Takt direkt im Browser (wie Safari/Chrome sie bei Strg bzw. Pinch liefern)
    await pc.keyboard.up('Control');
    const wt = await pc.evaluate(async ([x, y]) => { const box = document.getElementById('chart'), t0 = performance.now(), l0 = __chartLive.stats.lite; for (let i = 0; i < 40; i++) { box.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -3, clientX: x, clientY: y })); await new Promise(r => setTimeout(r, 8)); } return { ms: performance.now() - t0, lite: __chartLive.stats.lite - l0 }; }, [px, py]);
    await pc.waitForTimeout(500);
    const w1 = await view(pc), m1 = await candleAt(pc, px), dd = await pc.evaluate(() => ({ draws: __m110.draws, kinds: new Set(__m110.frames.filter(Boolean)).size }));
    check('PC: Strg+Mausrad/Trackpad zoomt flüssig hinein (Kerze unter dem Mauszeiger bleibt, Seite scrollt nicht)', w1.count < w0.count * .5 && Math.abs(m1 - m0) <= 1 && Math.abs(await pc.evaluate(() => scrollY) - sy0) < 2 && dd.kinds >= 8 && wt.lite <= wt.ms / 45 + 2, `${w0.count} → ${w1.count} · Kerze ${m0} → ${m1} · ${dd.kinds} Transformationen, ${wt.lite} vereinfachte Neuzeichnungen in ${Math.round(wt.ms)} ms`);
    await pc.keyboard.down('Control'); await pc.mouse.wheel(0, 400); await pc.keyboard.up('Control'); await pc.waitForTimeout(500);
    const w2 = await view(pc);
    check('… ein grober Mausrad-Schritt zoomt höchstens etwa 1,65-fach heraus (nicht schlagartig)', w2.count > w1.count && w2.count <= Math.ceil(w1.count * 1.7), `${w1.count} → ${w2.count}`);
    for (let i = 0; i < 10; i++) { await pc.mouse.wheel(30, 0); await pc.waitForTimeout(16); }
    await pc.waitForTimeout(500);
    check('… waagrechtes Blättern (Trackpad) verschiebt in die Vergangenheit, ganze Kerzen', (await view(pc)).pan > 0 && Number.isInteger((await view(pc)).pan), JSON.stringify(await view(pc)));
    check('… Zoom-Knöpfe arbeiten weiter', await (async () => { const a = (await view(pc)).count; await pc.click('#zoom-out'); await pc.waitForTimeout(300); return (await view(pc)).count > a; })());
    check('keine Fehler (PC)', !real(err2).length, real(err2).join(' | '));
    await ctx2.close();
  } catch (e) { check('Abbruch', false, e.stack); }
  finally { await browser.close(); await h.teardown?.(); }
  const ok = results.filter(r => r.ok).length; console.log(`\n${ok}/${results.length} bestanden`); process.exit(ok === results.length ? 0 : 1);
})();
