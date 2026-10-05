// Indikatoren-Seite am Handy ruhig: Hinweistexte schrumpfen nach dem Laden nicht, nach dem Aufwärmen ändert sich trotz großer
// Kurssprünge keine Höhe mehr, auch nicht nach einem Tab-Wechsel; Zonen-Zeilen ragen am iPad nicht über den Rand.
// iPhone-Nachstellung: keine eingebaute Scroll-Verankerung (die App nutzt dann ihren JS-Anker). Aufruf: node m14.js
const h = require('./harness'), PAGE = process.env.PAGE || '/weather-widget-v2.html';
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const DYN = '#zones-sec .zone-note, #zones-sec .metric, #zones-sec .zone-rows > div, #zones-sec .metric-foot, #ind-sec .metric, #ind-sec .indicator p, #ind-sec .metric-foot, #ind-sec .level-row, .fold > summary';
const heights = page => page.evaluate(sel => [...document.querySelectorAll(sel)].map(e => ({ id: e.id || e.querySelector('[id]')?.id || e.className, h: e.getClientRects().length ? e.offsetHeight : -1 })), DYN);
const swing = async (k) => { for (let i = 0; i < k; i++) { await h.ctl('/set?symbol=BTCUSDT&price=' + (64000 * (1 + [0.012, -0.012, 0.004, -0.004, 0.02, -0.02][i % 6])).toFixed(2)); await h.sleep(1300); } };
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  const browser = await h.launch();
  try {
    for (const [name, w, hh] of [['iPhone 390', 390, 844], ['iPhone SE 375', 375, 667]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: hh }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      await ctx.addInitScript(() => { const o = CSS.supports.bind(CSS); CSS.supports = (a, b) => /overflow-anchor/.test(String(a) + String(b ?? '')) ? false : o(a, b);
        const add = () => { const st = document.createElement('style'); st.textContent = '*{overflow-anchor:none!important}'; document.documentElement.append(st); }; if (document.documentElement) add(); else document.addEventListener('DOMContentLoaded', add);
        localStorage.setItem('scalpdesk.tab.v1', JSON.stringify('ind')); localStorage.setItem('scalpdesk.details.v1', JSON.stringify({ 'tablet:zones-sec': true, 'tablet:ind-sec': true, 'tablet:method-sec': false })); });
      const page = await ctx.newPage(), errors = []; h.collect(page, errors);
      await page.goto(h.URL_BASE + PAGE);
      // Platzhalter (vor den Daten) gegen geladene Texte: die Hinweise dürfen nicht schrumpfen
      const skel = await page.evaluate(() => [...document.querySelectorAll('#zones-sec .zone-note, #ind-sec .indicator p')].filter(e => e.getClientRects().length).map(e => ({ id: e.id, h: e.offsetHeight, skel: e.classList.contains('skel') })));
      await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(2500);
      const loaded = await page.evaluate(() => [...document.querySelectorAll('#zones-sec .zone-note, #ind-sec .indicator p')].filter(e => e.getClientRects().length).map(e => ({ id: e.id, h: e.offsetHeight })));
      const shrunk = skel.filter(s => s.skel).map(s => ({ ...s, after: loaded.find(l => l.id === s.id)?.h })).filter(s => s.after < s.h - 1);
      check(`${name}: Hinweistexte schrumpfen nach dem Laden nicht (zwei Zeilen reserviert)`, skel.some(s => s.skel) && !shrunk.length, shrunk.length ? JSON.stringify(shrunk) : `${skel.filter(s => s.skel).length} Platzhalter geprüft`);
      // Aufwärmen: alle Kurslagen einmal durchlaufen
      await swing(6);
      const base = await heights(page);
      await swing(6);
      const after = await heights(page), changed = after.filter((a, i) => a.h !== base[i]?.h);
      check(`${name}: nach dem Aufwärmen keine Höhenänderung trotz großer Kurssprünge`, !changed.length, changed.length ? JSON.stringify(changed.slice(0, 6).map((c, i) => `${c.id}: ${base[after.indexOf(c)]?.h}→${c.h}`)) : `${base.length} Elemente stabil`);
      // Tab-Wechsel und zurück: die Mindesthöhen bleiben
      await page.click('#tabbar [data-tab="chart"]'); await page.waitForTimeout(1500); await page.click('#tabbar [data-tab="ind"]'); await page.waitForTimeout(800);
      await swing(6);
      const back = await heights(page), changed2 = back.filter((a, i) => a.h !== base[i]?.h);
      check(`${name}: nach Tab-Wechsel und zurück weiterhin keine Höhenänderung`, !changed2.length, changed2.length ? JSON.stringify(changed2.slice(0, 6).map(c => `${c.id}: ${base[back.indexOf(c)]?.h}→${c.h}`)) : 'stabil');
      // Mitten in der Seite lesen: sichtbarer Inhalt verschiebt sich nicht
      const total = await page.evaluate(() => document.scrollingElement.scrollHeight - innerHeight);
      await page.evaluate(y => scrollTo(0, y), Math.round(total * .5)); await page.waitForTimeout(500);
      const ref = () => page.evaluate(() => { const e = document.elementFromPoint(innerWidth / 2, innerHeight * .5); return e ? Math.round(e.getBoundingClientRect().top) : null; });
      const r0 = await ref(); await swing(5); const r1 = await ref();
      check(`${name}: beim Lesen mitten auf der Seite verschiebt sich nichts`, r0 !== null && r0 === r1, `${r0} → ${r1}`);
      check(`${name}: keine Fehler`, !errors.length, errors.join(' | ')); await ctx.close();
    }
    // iPad (Touch, hoch und quer): kein Text ragt aus Zonen- oder Indikator-Karten
    for (const [name, w, hh] of [['iPad mini hoch', 744, 1133], ['iPad hoch', 820, 1180], ['iPad quer', 1180, 820], ['iPad Pro 12,9 hoch', 1024, 1366]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: hh }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      await ctx.addInitScript(() => { localStorage.setItem('scalpdesk.tab.v1', JSON.stringify('ind')); });
      const page = await ctx.newPage(), errors = []; h.collect(page, errors);
      await page.goto(h.URL_BASE + PAGE);
      await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
      for (const sm of await page.$$('details.fold[data-tabs~="ind"]:not([open]) > summary')) if (await sm.isVisible()) { await sm.click(); await page.waitForTimeout(150); }
      await swing(3);
      const over = await page.evaluate(() => { const out = [];
        for (const e of document.querySelectorAll('#zones-sec *, #ind-sec *')) {
          if (!e.getClientRects().length || e.closest('.tip-body, svg, [hidden]') || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
          const cs = getComputedStyle(e); if (/(hidden|clip|auto|scroll)/.test(cs.overflowX) || cs.textOverflow === 'ellipsis') continue;
          const card = e.closest('.zone, .indicator, article, .panel') || e.parentElement, c2 = getComputedStyle(card), cb = card.getBoundingClientRect();
          const l = cb.left + parseFloat(c2.paddingLeft) + parseFloat(c2.borderLeftWidth), r = cb.right - parseFloat(c2.paddingRight) - parseFloat(c2.borderRightWidth);
          const rg = document.createRange(); rg.selectNodeContents(e); const tr = rg.getBoundingClientRect(), d = Math.max(tr.right - r, l - tr.left);
          if (d > 1) out.push(`${e.textContent.trim().replace(/\s+/g, ' ').slice(0, 40)} (+${Math.round(d)} px)`); }
        return out; });
      check(`${name}: kein Text ragt aus Zonen- oder Indikator-Karten`, !over.length, over.slice(0, 4).join(' | ') || 'ok');
      check(`${name}: keine Fehler`, !errors.length, errors.join(' | ')); await ctx.close();
    }
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await browser.close(); await h.ctl('/walk?on=1').catch(() => {}); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
