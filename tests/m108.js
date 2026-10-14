// 3.70.1 – PC-Desktop-Ansicht (Nutzer-Screenshot, Edge unter Windows, 1860 px): „Einstellungen & Sicherung“ lag in der schmalen
// 360-px-Spalte unter der Fußzeile, die Karten darin brachen Wörter um („Datensicheru ng“). Jetzt: Einstellungen oben über die
// volle Breite, darunter „Berechnung & Datenquellen“, dann die Fußzeile. „Analysen“: Zonen und Indikatoren über die volle Breite
// statt einer langen Spalte mit großer Lücke daneben. Echte Gerätezuordnung über Kennung und Bildschirm (PC/iPad → Dashboard).
// Aufruf: node m108.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + String(detail).slice(0, 600) : ''}`); };
const real = errs => errs.filter(e => !/Service Worker registration blocked|Failed to load resource|ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|net::ERR/.test(e));
const PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const layout = page => page.evaluate(() => {
  const dash = document.querySelector('.dash'), out = {}, list = [];
  const walk = n => { for (const c of n.children) { const cs = getComputedStyle(c); if (cs.display === 'contents') walk(c); else if (cs.display !== 'none' && c.getBoundingClientRect().height > 2) { const r = c.getBoundingClientRect(), o = { id: c.id || c.className.toString().split(' ')[0], l: r.left, r: r.right, t: r.top + scrollY, b: r.bottom + scrollY, w: r.width }; out[o.id] = o; list.push(o); } } };
  walk(dash); const cs = getComputedStyle(dash), inner = dash.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const overlaps = []; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const a = list[i], b = list[j]; if (a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1) overlaps.push(a.id + '×' + b.id); }
  return { el: out, inner, overlaps, over: document.documentElement.scrollWidth - innerWidth, pres: document.documentElement.dataset.presentation };
});

(async () => {
  await h.setup(); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  const browser = await h.launch({ workspace: 'fresh' });
  try {
    for (const [name, w, hh, ua, touch] of [['PC 1860 px', 1860, 985, PC, false], ['PC 1280 px', 1280, 900, PC, false], ['iPad quer', 1180, 820, IPAD, true]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: hh }, screen: { width: Math.max(w, 1920), height: 1080 }, userAgent: ua, hasTouch: touch }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
      await page.goto(`${h.URL_BASE}/weather-widget-v2.html`); await page.waitForFunction(() => document.querySelectorAll('.workspace-tabs button').length === 4, null, { timeout: 15000 });
      await page.locator('.workspace-tabs button', { hasText: 'Einstellungen' }).click(); await page.waitForTimeout(500);
      let L = await layout(page); const s = L.el['workspace-settings'], m = L.el['method-sec'], f = L.el.foot;
      check(`${name}: Dashboard-Ansicht erkannt, kein seitliches Scrollen`, L.pres === 'dashboard' && L.over <= 1, JSON.stringify({ pres: L.pres, over: L.over }));
      check(`${name}: „Einstellungen & Sicherung“ oben über die volle Breite (statt 360-px-Spalte)`, s && s.w >= Math.min(1100, L.inner) - 2 && m && f && s.b <= m.t && m.b <= f.t, JSON.stringify({ s, m, f, inner: L.inner }));
      check(`${name}: „Berechnung & Datenquellen“ so breit wie die Einstellungen, keine Überlappung`, m && Math.abs(m.w - s.w) <= 2 && Math.abs(m.l - s.l) <= 2 && !L.overlaps.length, JSON.stringify({ m, s, ov: L.overlaps }));
      await page.locator('#workspace-settings summary', { hasText: 'Darstellung' }).first().click(); await page.waitForTimeout(300);
      const card = await page.evaluate(() => { const c = [...document.querySelectorAll('#workspace-settings .workspace-setting-card')]; const r = c.map(x => x.getBoundingClientRect().width); const t = document.querySelector('#workspace-settings h3'); return { min: Math.min(...r), n: c.length, wrap: t ? t.scrollWidth > t.clientWidth + 1 : false }; });
      check(`${name}: Karten breit genug (keine Wortbrüche wie „Datensicheru ng“)`, card.n >= 2 && card.min >= 360 && !card.wrap, JSON.stringify(card));
      await page.locator('.workspace-tabs button', { hasText: 'Analysen' }).click(); await page.waitForTimeout(600);
      L = await layout(page); const E = L.el;
      check(`${name}: „Analysen“ – Mittelwert-Zonen und Marktindikatoren über die volle Breite`, E['zones-sec'] && E['ind-sec'] && E['zones-sec'].w >= L.inner - 2 && E['ind-sec'].w >= L.inner - 2 && E['zones-sec'].b <= E['ind-sec'].t, JSON.stringify({ z: E['zones-sec'], i: E['ind-sec'], inner: L.inner }));
      check(`${name}: Volatilität neben dem Kalender, News darunter, keine Überlappung`, E.vola && E.econ && Math.abs(E.vola.t - E.econ.t) <= 1 && E.vola.r <= E.econ.l && E.cnews.t >= Math.max(E.vola.b, E.econ.b) && !L.overlaps.length, JSON.stringify({ v: E.vola, e: E.econ, n: E.cnews, ov: L.overlaps }));
      check(`${name}: Reihenfolge Signale → Muster-Bot → Fußzeile`, E.signals && E['muster-bot-panel'] && E.signals.b <= E['muster-bot-panel'].t && E['muster-bot-panel'].b <= E.foot.t, JSON.stringify({ s: E.signals, m: E['muster-bot-panel'], f: E.foot }));
      await page.locator('.workspace-tabs button', { hasText: 'Chart' }).click(); await page.waitForTimeout(500);
      L = await layout(page);
      check(`${name}: Chart-Ansicht unverändert – breiter Chart rechts, Signale links`, L.el['chart-sec'].l > L.el.signals.l && L.el['chart-sec'].w > L.el.signals.w * 1.8 && !L.overlaps.length, JSON.stringify({ c: L.el['chart-sec'], s: L.el.signals }));
      check(`${name}: keine Fehler`, !real(errors).length, real(errors).join(' | '));
      await ctx.close();
    }
    // einspaltig (unter 1100 px): Einstellungen zuerst, Methodik danach
    const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, screen: { width: 820, height: 1180 }, userAgent: IPAD, hasTouch: true }), page = await ctx.newPage();
    await page.goto(`${h.URL_BASE}/weather-widget-v2.html`); await page.waitForFunction(() => document.querySelectorAll('.workspace-tabs button').length === 4, null, { timeout: 15000 });
    await page.locator('.workspace-tabs button', { hasText: 'Einstellungen' }).click(); await page.waitForTimeout(500);
    const L = await layout(page);
    check('iPad hoch: Einstellungen zuerst, dann „Berechnung & Datenquellen“, dann Fußzeile', L.el['workspace-settings'].b <= L.el['method-sec'].t && L.el['method-sec'].b <= L.el.foot.t && L.over <= 1, JSON.stringify(L.el));
    await ctx.close();
  } catch (e) { check('Abbruch', false, e.stack || e.message); }
  finally { await browser.close(); await h.ctl('/walk?on=1'); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
