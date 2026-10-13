// 3.70.0 – optische Korrekturen in der echten App-Navigation (Handy, iPad, Desktop; hell und dunkel):
// „Verkaufssignal“ passt vollständig ins Etikett der Signal-Übersicht, die Trend-Zeile unter der Werkzeugleiste beginnt bündig
// mit der OHLC-Zeile, die Klappfläche „Starke Zonen“ steht bündig unter „Orderflow“, das FVG-Farbfeld ist auch ausgeschaltet sichtbar.
// Aufruf: node m106.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + String(detail).slice(0, 500) : ''}`); };
const real = errs => errs.filter(e => !/Service Worker registration blocked|Failed to load resource|ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|net::ERR/.test(e));

(async () => {
  await h.setup(); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  const browser = await h.launch({ workspace: 'fresh' });
  try {
    for (const [name, w, hh, theme] of [['Handy 360 px hell', 360, 780, 'light'], ['Handy 390 px dunkel', 390, 844, 'dark'], ['iPad 820 px', 820, 1180, 'dark'], ['Desktop 1400 px', 1400, 1000, 'light']]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: hh } }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
      await ctx.addInitScript(t => { try { localStorage.setItem('scalpdesk.theme.v1', JSON.stringify(t)); } catch {} }, theme);
      await page.goto(`${h.URL_BASE}/weather-widget-v2.html`);
      await page.waitForFunction(() => document.querySelectorAll('.signal-row .verdict.sell').length > 0 && document.querySelectorAll('#mtf .mtf-c').length > 0, null, { timeout: 20000 }).catch(() => {});
      const m = await page.evaluate(() => {
        const sec = document.getElementById('chart-sec'), L = sec.getBoundingClientRect().left;
        const textLeft = e => { const t = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let n; while ((n = t.nextNode())) { if (!n.textContent.trim()) continue; const r = document.createRange(); r.selectNodeContents(n); const b = r.getBoundingClientRect(); if (b.width > 0) return Math.round(b.left - L); } return null; };
        // Text breiter als der Inhaltsbereich des Etiketts = abgeschnitten bzw. „…“
        const verdicts = [...document.querySelectorAll('.signal-row .verdict')].map(x => { const r = document.createRange(); r.selectNodeContents(x); const cs = getComputedStyle(x); return { t: x.textContent, spare: Math.round((x.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - r.getBoundingClientRect().width) * 10) / 10 }; });
        const of = document.getElementById('workspace-orderflow').getBoundingClientRect(), zl = document.getElementById('zone-lab').getBoundingClientRect();
        const sw = document.querySelector('[data-overlay="fvg"] .sw.fvg'), swcs = getComputedStyle(sw);
        return { over: document.documentElement.scrollWidth - innerWidth, verdicts, mtf: textLeft(document.getElementById('mtf')), ohlc: textLeft(document.querySelector('.ohlc-row')), fold: [of.left, zl.left, of.right, zl.right].map(Math.round), sw: { bg: swcs.backgroundImage, shadow: swcs.boxShadow, w: sw.getBoundingClientRect().width } };
      });
      const sell = m.verdicts.filter(v => v.t === 'Verkaufssignal');
      check(`${name}: „Verkaufssignal“ vollständig im Etikett, kein Etikett abgeschnitten`, sell.length > 0 && m.verdicts.every(v => v.spare >= 0), JSON.stringify(m.verdicts));
      check(`${name}: Trend-Zeile bündig mit der OHLC-Zeile`, m.mtf !== null && m.mtf === m.ohlc && m.mtf >= 10, JSON.stringify({ mtf: m.mtf, ohlc: m.ohlc }));
      check(`${name}: „Starke Zonen“ bündig unter „Orderflow“`, Math.abs(m.fold[0] - m.fold[1]) <= 1 && Math.abs(m.fold[2] - m.fold[3]) <= 1, JSON.stringify(m.fold));
      check(`${name}: FVG-Farbfeld grün/rot mit Rand, kein seitliches Scrollen`, /gradient/.test(m.sw.bg) && m.sw.shadow !== 'none' && m.sw.w >= 14 && m.over <= 1, JSON.stringify(m.sw) + ' over=' + m.over);
      check(`${name}: keine Fehler`, !real(errors).length, real(errors).join(' | '));
      await ctx.close();
    }
  } catch (e) { check('Abbruch', false, e.stack || e.message); }
  finally { await browser.close(); await h.ctl('/walk?on=1'); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
