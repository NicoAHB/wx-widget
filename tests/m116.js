// 3.72.0: Journal auf echten schmalen Bereichen: Betrag zusammen, Kurse beschriftet, Aktionen unabhängig.
const h = require('./harness'), fs = require('fs'), path = require('path');
const results = [], check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };
(async () => {
  await h.setup(); await h.ctl('/reset'); const b = await h.launch({ workspace: 'fresh' });
  try {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, timezoneId: 'Europe/Berlin' }), p = await c.newPage(), errors = []; p.on('pageerror', e => errors.push(e.message));
    await c.addInitScript(() => { if (localStorage.getItem('seed116')) return; localStorage.setItem('seed116', '1'); const now = Date.now(); const t = (id, symbol, pnl, extra = {}) => ({ id, symbol, side: 'long', mode: 'cross', entry: 1.4675, exit: 1.5332, leverage: 20, qty: 760, margin: 55.765, openedAt: now - 7200000, closedAt: now - 60000, source: 'spot', liqExchange: null, preRealized: 0, sl: null, tp: null, ack: { sl: false, tp: false }, note: '', setup: null, fees: 0, pnl, pnlSource: 'exchange', fx: 49.93 / 43.88, ...extra });
      localStorage.setItem('scalpdesk.history.v1', JSON.stringify([t('journal116', 'XRPUSDT', 49.93), t('long116', 'BTCUSDT', -1234567.89, { entry: 81245.67, exit: 82345.67, side: 'short', closedAt: now - 120000, note: 'Vollständige bestehende Notiz' })]));
      localStorage.setItem('scalpdesk.tradeimg.v1', JSON.stringify({ jobs: [{ id: 'journal116', st: 'ok', upd: now, sentAt: now - 30000 }] }));
    });
    await p.goto(h.URL_BASE + '/weather-widget-v2.html'); await p.waitForFunction(() => window.__g05 && document.querySelector('[data-trade="journal116"]'));
    await p.click('[data-workspace-target="pos"]'); await p.evaluate(() => document.getElementById('history').open = true);
    const original = await p.evaluate(() => JSON.stringify(__g05.state.trades));
    for (const width of [320, 390, 430, 768, 1440]) {
      await p.setViewportSize({ width, height: 900 }); await p.locator('[data-trade="journal116"]').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
      const layout = await p.$$eval('#history-list .trade-row', rows => rows.map(r => { const b = r.getBoundingClientRect(), value = r.querySelector('.trade-profit-value'), vr = document.createRange(); vr.selectNodeContents(value); const text = vr.getBoundingClientRect(), vb = value.getBoundingClientRect(); return { coin: r.querySelector('.trade-heading').textContent, amount: value.textContent, single: vr.getClientRects().length === 1, contained: text.left >= b.left - 1 && text.right <= b.right + 1 && text.left >= vb.left - 1 && text.right <= vb.right + 1, prices: r.querySelector('.trade-prices').textContent, overflow: r.scrollWidth > r.clientWidth + 1, actions: [...r.querySelectorAll('.tools button')].map(x => { const q = x.getBoundingClientRect(); return { w: q.width, h: q.height, x: q.x, right: q.right }; }) }; }));
      check(`${width}px: Ergebnis und Währung bleiben zusammen und vollständig`, layout.every(r => r.single && r.contained && !r.overflow), JSON.stringify(layout));
      check(`${width}px: beschriftete Ein-/Ausstiege, langer BTC-Preis vollständig`, layout.every(r => /Einstieg.*Ausstieg/.test(r.prices)) && /81\.245,67/.test(layout[1].prices));
      check(`${width}px: vier Aktionen mit eigenem Platz und ≥44px Touch-Fläche`, layout.every(r => r.actions.length === 4 && r.actions.every(x => x.w >= 44 && x.h >= 44 && x.x >= 0 && x.right <= width + 1)));
      check(`${width}px: Euro, Rendite und Versandbestätigung erhalten; keine seitliche Seite`, await p.locator('[data-trade="journal116"] .trade-eur').textContent() === '(+43,88 €)' && /%/.test(await p.locator('[data-trade="journal116"] .trade-roi').textContent()) && /^📷 gesendet \d\d:\d\d$/.test(await p.locator('[data-trade="journal116"] .timg-st').textContent()) && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      if (process.env.PROOF_DIR && width < 440) { fs.mkdirSync(process.env.PROOF_DIR, { recursive: true }); await p.locator('[data-trade="journal116"]').screenshot({ path: path.join(process.env.PROOF_DIR, `journal-${width}.png`) }); }
    }
    check('Versandstatus hat ebenfalls eine große Touch-Fläche', await p.locator('[data-trade="journal116"] .timg-st').evaluate(e => e.offsetHeight >= 44));
    check('Darstellungsänderung verändert keine Journalwerte', await p.evaluate(() => JSON.stringify(__g05.state.trades)) === original);
    await p.setViewportSize({ width: 390, height: 844 }); const row = p.locator('[data-trade="journal116"]');
    await row.locator('[data-action="trade-fx"]').click(); check('€ öffnet die unveränderte Kursverwaltung', await row.locator('.fx-edit').isVisible()); await row.locator('[data-action="trade-cancel"]').click();
    await row.locator('[data-action="trade-note"]').click(); await row.locator('textarea').fill('Neue übersichtliche Notiz'); await row.locator('[data-action="note-save"]').click();
    check('Notiz lässt sich weiterhin speichern', await row.locator('.trade-note').textContent() === 'Neue übersichtliche Notiz');
    await row.locator('[data-action="trade-delete"]').click(); check('Löschen verlangt weiterhin bewusste Bestätigung', await row.locator('[data-action="trade-confirm"]').isVisible()); await row.locator('[data-action="trade-cancel"]').click();
    await row.locator('[data-action="trade-img"]').first().click(); await p.waitForFunction(() => document.getElementById('timg-dialog').open);
    check('Kamera öffnet die bestehende Bildvorschau ohne Versand', await p.locator('#timg-dialog').isVisible() && !(await h.ctl('/sent')).some(x => x.method === 'sendPhoto')); await p.evaluate(() => document.getElementById('timg-dialog').close());
    check('Keine JavaScript-Fehler', !errors.length, errors.join(' | ')); await c.close();
  } catch (e) { check('Abbruch', false, e.stack); }
  finally { await b.close(); await h.teardown(); }
  const pass = results.filter(Boolean).length; console.log(`\n${pass}/${results.length} bestanden`); process.exitCode = pass === results.length ? 0 : 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
