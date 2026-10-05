// Rauchtest: Desktop und iPad, beide Designs; Live-Stream, Signale, Fehlerfreiheit; Screenshots.
const h = require('./harness');
const [,, only] = process.argv;
(async () => {
  await h.setup(); await h.ctl('/reset');
  const browser = await h.launch(), errors = [];
  try {
    const runs = [
      { name: 'desktop-dark', viewport: { width: 1600, height: 1000 }, theme: null },
      { name: 'desktop-1280', viewport: { width: 1280, height: 900 }, theme: null },
      { name: 'ipad-light', viewport: { width: 820, height: 1180 }, theme: 'light', touch: true },
    ].filter(r => !only || r.name === only);
    for (const run of runs) {
      const ctx = await browser.newContext({ viewport: run.viewport, hasTouch: !!run.touch, isMobile: false });
      if (run.theme) await ctx.addInitScript(t => { try { localStorage.setItem('scalpdesk.theme.v1', JSON.stringify(t)); } catch {} }, run.theme);
      const page = await ctx.newPage(); h.collect(page, errors);
      await page.goto(h.URL_BASE + '/weather-widget-v2.html');
      await page.waitForFunction(() => document.getElementById('price').textContent.trim() !== '—', null, { timeout: 15000 });
      await page.waitForFunction(() => /Live/.test(document.getElementById('status').textContent), null, { timeout: 15000 }).catch(() => {});
      await h.sleep(2500);
      const info = await page.evaluate(() => ({
        layout: document.documentElement.dataset.layout, theme: document.documentElement.dataset.theme, tab: document.documentElement.dataset.activeTab,
        status: document.getElementById('status').textContent, feed: document.getElementById('status').dataset.feed, title: document.getElementById('status').title,
        price: document.getElementById('price').textContent, lb: document.getElementById('lb-price').textContent, heat: document.querySelectorAll('#lb-heat .hc').length,
        rows: [...document.querySelectorAll('.signal-row')].map(r => r.dataset.tone).join(','), updated: document.getElementById('updated').textContent,
      }));
      console.log(run.name, JSON.stringify(info));
      await page.screenshot({ path: `${__dirname}/shots/${run.name}.png`, fullPage: run.name !== 'ipad-light' });
      if (run.touch) for (const tab of ['calc', 'pos', 'ind']) { await page.click(`#tabbar [data-tab="${tab}"]`); await h.sleep(600); await page.screenshot({ path: `${__dirname}/shots/${run.name}-${tab}.png`, fullPage: true }); }
      await ctx.close();
    }
  } finally { console.log(errors.length ? errors.join('\n') : 'no errors'); await browser.close(); await h.teardown(); }
})().catch(e => { console.error(e); process.exit(1); });
