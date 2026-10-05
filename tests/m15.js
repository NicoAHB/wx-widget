// Schritt 2.3 – Elliott-Wellen (schematisch): Beschriftung 1–5 und A–C im Chart, Kennzeichnung „schematisch“, Schalter
// (gespeichert, auch im Vollbild), Abwärtsimpuls, keine Zählung, vorläufiger Punkt, unter 50 Kerzen gesperrt mit Anzahl,
// Linie nur ohne ZigZag, keine Überdeckung, Handy hochkant. Die Attrappe liefert per /shape gezielte Verläufe. Aufruf: node m15.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const ew = page => page.evaluate(() => {
  const b = document.querySelector('[data-overlay="ew"]'), g = document.querySelector('#chart svg .ew');
  const lbl = g ? [...g.querySelectorAll('.ew-lbl')].map(l => { const c = l.querySelector('circle'); return { w: l.dataset.wave, t: l.querySelector('text').textContent, cls: l.getAttribute('class'), cx: +c.getAttribute('cx'), cy: +c.getAttribute('cy'), dash: getComputedStyle(c).strokeDasharray }; }) : [];
  return { pressed: b?.getAttribute('aria-pressed'), dis: b?.getAttribute('aria-disabled'), na: b?.classList.contains('na'), btn: b?.textContent.trim(), g: !!g, cls: g?.getAttribute('class') || '', tip: g?.querySelector('title')?.textContent || '', tag: g?.querySelector('.ew-tag')?.textContent || '', lines: g ? g.querySelectorAll('.ew-line').length : 0, lbl };
});
const seq = d => d.lbl.map(l => l.t).join(' ');
const settle = page => page.waitForTimeout(900);
const load = async (page, sym) => { await page.fill('#symbol', sym); await page.press('#symbol', 'Enter'); await page.waitForFunction(s => document.getElementById('lb-sym').textContent === s, sym, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(1500); };
const toastText = page => page.evaluate(() => [...document.querySelectorAll('#toasts .toast.info')].map(t => t.textContent).join(' | '));
const clearToasts = page => page.evaluate(() => document.querySelectorAll('#toasts .toast.info').forEach(t => t.remove()));
// überdecken sich Elliott-Kreise untereinander oder mit Divergenz-/Prognose-Beschriftungen oder Kurs-Schildchen?
const overlaps = page => page.evaluate(() => {
  const R = e => e.getBoundingClientRect(), hit = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
  const circles = [...document.querySelectorAll('#chart .ew-lbl circle')].map(R), others = [...document.querySelectorAll('#chart .rsi-div-label, #chart .zz-fc-label, #chart rect.axis-tag')].map(R), out = [];
  circles.forEach((a, i) => { circles.slice(i + 1).forEach(b => { if (hit(a, b)) out.push('Kreis/Kreis'); }); others.forEach(b => { if (hit(a, b)) out.push('Kreis/Beschriftung'); }); });
  const svg = R(document.querySelector('#chart svg')); for (const c of circles) if (c.left < svg.left || c.right > svg.right || c.top < svg.top || c.bottom > svg.bottom) out.push('außerhalb des Charts');
  const tag = document.querySelector('#chart .ew-tag'); if (tag) { const t = R(tag); if (t.left < svg.left || t.right > svg.right) out.push('Kennzeichnung ragt heraus'); }
  return out;
});
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  for (const [sym, kind] of [['XRPUSDT', 'ew-up'], ['SOLUSDT', 'ew-down'], ['ETCUSDT', 'ew-none'], ['LTCUSDT', 'ew-open']]) await h.ctl(`/shape?symbol=${sym}&interval=1m&kind=${kind}`);
  await h.ctl('/shape?symbol=NEARUSDT&interval=1m&kind=short&n=30');
  const browser = await h.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html');
    await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
    await load(page, 'XRP');
    let d = await ew(page);
    check('Schalter „Elliott“ bei den Chart-Ebenen, standardmäßig an, frei', d.pressed === 'true' && d.dis === 'false' && !d.na && d.btn === 'Elliott', JSON.stringify({ pressed: d.pressed, dis: d.dis, btn: d.btn }));
    check('Aufwärtsimpuls: 1 2 3 4 5 und Korrektur A B C (ZigZag 3 %, Standard)', seq(d) === '1 2 3 4 5 A B C' && /\bup\b/.test(d.cls), seq(d));
    const L = Object.fromEntries(d.lbl.map(l => [l.w, l]));
    check('Beschriftung an den Umkehrpunkten: 1, 3, 5, B über den Hochs, 2, 4, A, C unter den Tiefs, von links nach rechts', d.lbl.every((l, i) => !i || l.cx > d.lbl[i - 1].cx) && L[1].cy < L[2].cy && L[3].cy < L[4].cy && L[5].cy < L.A.cy && L.B.cy < L.C.cy && L[3].cy < L[1].cy && L[5].cy < L[3].cy, d.lbl.map(l => `${l.t}@${Math.round(l.cx)},${Math.round(l.cy)}`).join(' '));
    check('Ausdrücklich als schematisch gekennzeichnet: „Elliott (schematisch)“ im Chart, Tooltip mit Regeln und „keine Prognose“', d.tag === 'Elliott (schematisch)' && /schematische Zuordnung/.test(d.tip) && /drei Grundregeln/.test(d.tip) && /Welle 3 ist nicht die kürzeste/.test(d.tip) && /Andere Zählungen sind möglich – keine Prognose, kein Handelssignal/.test(d.tip), d.tip.slice(0, 120));
    check('Mit ZigZag keine zusätzliche Wellenlinie (der ZigZag zeigt den Verlauf)', d.lines === 0, String(d.lines));
    await page.click('[data-overlay="zz"]'); await settle(page); const nz = await ew(page);
    check('Ohne ZigZag: Wellenlinie für Impuls und Korrektur', nz.lines === 2 && seq(nz) === '1 2 3 4 5 A B C', String(nz.lines));
    await page.click('[data-overlay="zz"]'); await settle(page);
    const ov = await overlaps(page); check('Keine Überdeckung: Kreise, Divergenz-/Prognose-Beschriftung, Chartrand', !ov.length, ov.join(', ') || 'ok');
    await page.click('[data-overlay="ew"]'); await settle(page); const off = await ew(page);
    await page.click('[data-overlay="ew"]'); await settle(page); const on = await ew(page);
    check('Ausblenden und wieder einblenden', off.pressed === 'false' && !off.g && on.pressed === 'true' && seq(on) === '1 2 3 4 5 A B C', JSON.stringify({ aus: [off.pressed, off.g], an: [on.pressed, seq(on)] }));
    await page.click('[data-overlay="ew"]'); await settle(page);
    await page.reload(); await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(1500);
    const re = await ew(page); check('Nach dem Neuladen bleibt der Schalter aus', re.pressed === 'false' && !re.g, JSON.stringify({ pressed: re.pressed, g: re.g }));
    await page.click('[data-overlay="ew"]'); await settle(page);
    await load(page, 'SOL'); d = await ew(page);
    check('Abwärtsimpuls (Spiegelbild): 1 2 3 4 5 A B C, 1 unter 2', seq(d) === '1 2 3 4 5 A B C' && /\bdown\b/.test(d.cls) && d.lbl[0].cy > d.lbl[1].cy && /Abwärtsimpuls/.test(d.tip), seq(d));
    await clearToasts(page); await load(page, 'ETC'); d = await ew(page);
    check('Welle 4 im Bereich von Welle 1: keine Beschriftung', !d.g && d.pressed === 'true', JSON.stringify({ g: d.g }));
    await page.click('[data-overlay="ew"]'); await settle(page); await page.click('[data-overlay="ew"]'); await page.waitForTimeout(400);
    let tt = await toastText(page); check('Einschalten ohne passenden Verlauf erklärt es (Hinweis mit Mindestbewegung)', /kein Verlauf die drei Grundregeln \(ZigZag 3 %\)/.test(tt), tt.slice(0, 140));
    await load(page, 'LTC'); d = await ew(page);
    check('Noch laufender Punkt: „A?“ vorläufig, gestrichelter Kreis', seq(d) === '1 2 3 4 5 A?' && /\bopen\b/.test(d.lbl.at(-1).cls) && d.lbl.at(-1).dash !== 'none' && /letzter Punkt noch nicht bestätigt/.test(d.tip), `${seq(d)} ${d.lbl.at(-1)?.dash}`);
    await clearToasts(page); await load(page, 'NEAR'); d = await ew(page);
    const nb = d.btn.match(/^Elliott (\d+)\/50$/);
    check('Unter 50 Kerzen: Schalter gesperrt, zeigt die aktuelle Anzahl („Elliott 31/50“)', nb && +nb[1] < 50 && +nb[1] >= 30 && d.dis === 'true' && d.na && !d.g, JSON.stringify({ btn: d.btn, dis: d.dis }));
    // gesperrter Knopf (aria-disabled): Playwright wartet sonst auf „aktiv“ – ein echtes Antippen löst trotzdem aus
    await page.click('[data-overlay="ew"]', { force: true }); await page.waitForTimeout(400); const d2 = await ew(page); tt = await toastText(page);
    check('Antippen erklärt es mit der Anzahl, der Schalter bleibt unverändert', new RegExp(`ab 50 Kerzen – dieser Chart hat erst ${nb?.[1]}`).test(tt) && d2.pressed === 'true', tt.slice(0, 120));
    await load(page, 'XRP'); d = await ew(page);
    check('Zurück bei genug Kerzen: Schalter wieder frei, Beschriftung da', d.btn === 'Elliott' && d.dis === 'false' && !d.na && seq(d) === '1 2 3 4 5 A B C', JSON.stringify({ btn: d.btn, seq: seq(d) }));
    // Vollbild: Schalter in der Werkzeugzeile
    await page.click('#chart-full'); await page.waitForTimeout(800); await page.click('#fb-tools'); await page.waitForTimeout(600);
    const vis = await page.evaluate(() => { const b = document.querySelector('[data-overlay="ew"]'), r = b.getBoundingClientRect(); return { vis: getComputedStyle(b).visibility, w: Math.round(r.width) }; });
    const f1 = await ew(page); await page.click('[data-overlay="ew"]'); await settle(page); const f2 = await ew(page); await page.click('[data-overlay="ew"]'); await settle(page); const f3 = await ew(page);
    check('Vollbild: Beschriftung sichtbar, Schalter in der Werkzeugzeile blendet aus und ein', vis.vis === 'visible' && vis.w > 40 && seq(f1) === '1 2 3 4 5 A B C' && !f2.g && seq(f3) === '1 2 3 4 5 A B C', JSON.stringify({ vis, an: seq(f1), aus: f2.g, wieder: seq(f3) }));
    await page.click('#fb-exit'); await page.waitForTimeout(400);
    // Helles Design: eigene, dunklere Farbe
    const col = async () => page.evaluate(() => getComputedStyle(document.querySelector('#chart .ew-lbl text')).fill);
    const dark = await col(); await page.evaluate(() => { document.getElementById('view-menu')?.click(); document.querySelector('[data-theme-set="light"]').click(); }); await settle(page); const light = await col();
    await page.evaluate(() => document.querySelector('[data-theme-set="dark"]').click());
    check('Helles Design: Beschriftung in dunklerer Elliott-Farbe', dark && light && dark !== light, `${dark} / ${light}`);
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
    // Handy hochkant (390 und 320 px): im Chart, nicht unter den Kurs-Schildchen, kein seitliches Scrollen
    for (const w of [390, 320]) {
      const pc = await browser.newContext({ viewport: { width: w, height: 800 }, hasTouch: true, isMobile: true }), pp = await pc.newPage(), pe = []; h.collect(pp, pe);
      await pp.goto(h.URL_BASE + '/weather-widget-v2.html');
      await pp.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {}); await load(pp, 'XRP');
      await pp.evaluate(() => document.getElementById('chart').scrollIntoView({ block: 'center' })); await pp.waitForTimeout(800);
      const m = await ew(pp), o = await overlaps(pp), sw = await pp.evaluate(() => document.scrollingElement.scrollWidth - innerWidth), btn = await pp.evaluate(() => { const r = document.querySelector('[data-overlay="ew"]').getBoundingClientRect(); return Math.round(r.right) <= innerWidth; });
      check(`Handy ${w} px: Beschriftung und Kennzeichnung im Chart, keine Überdeckung, Schalter im Bild, kein seitliches Scrollen`, m.g && m.lbl.length >= 5 && m.tag === 'Elliott (schematisch)' && !o.length && sw <= 0 && btn, JSON.stringify({ seq: seq(m), o, sw }));
      check(`Handy ${w} px: keine Fehler`, !pe.length, pe.join(' | ')); await pc.close();
    }
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await browser.close(); await h.ctl('/walk?on=1').catch(() => {}); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
