// KI-Übersicht: tatsächliche App, gemeinsame Filter, Original-ID einmal, Details/Fokus und beide Layouts.
const h = require('./harness'); let pass = 0, fail = 0;
const check = (name, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
(async () => { let browser;
  try {
    const F = await import('./fixtures/confluence-live.mjs'), A = await import('./fixtures/model-archive.mjs'), fixture = await A.modelArchiveFixture();
    await h.setup(); browser = await h.launch(); const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message)); const at = Date.now(); let calls = 0;
    await ctx.route('https://api.bitget.com/**', async route => { calls++; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(F.liveBitgetResponse(route.request().url(), Date.now(), at)) }); });
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => !!window.__g10 && !__g10.state.busy); await page.click('#ki-signal-tab');
    await page.evaluate(() => { __g05.state.watch = ['BTC']; }); await page.fill('#ki-slippageBps', '0'); await page.selectOption('#ki-fundingMode', 'current-rate'); await page.selectOption('#ki-anchorPolicy', 'nearest'); await page.fill('#ki-patternWeight', '0'); await page.uncheck('#ki-longOn'); await page.click('#ki-save');
    await page.waitForFunction(() => __g10.state.cards.length === 1 && !__g10.state.busy);
    const original = await page.evaluate(() => JSON.stringify(__g10.state.cards));
    check('Eine gemeinsame Karte für gespeichertes und aktuelles Signal derselben ID', await page.locator('#ki-list [data-ki-id]').count() === 1 && await page.locator('#ki-current article').count() === 0);
    check('Karten zuerst, Einrichtung und Einzelbelege standardmäßig eingeklappt', await page.evaluate(() => !document.getElementById('ki-setup').open && !document.querySelector('#ki-list .ki-card-details').open && document.getElementById('ki-list').compareDocumentPosition(document.getElementById('ki-setup')) & Node.DOCUMENT_POSITION_FOLLOWING));
    check('Kompakte Karte nennt Modell, Score, nächste Handlung und drei Preislevel', /Konfluenz.*Entry.*Stop-Loss.*Take-Profit/s.test(await page.textContent('#ki-list')));
    await page.locator('#ki-list .ki-card-details > summary').click(); await page.locator('#ki-list .ki-card-details .ki-info > summary').first().click();
    const kept = await page.evaluate(() => { const article = document.querySelector('#ki-list article'), summary = article.querySelector('summary'); summary.focus(); __g10.render(); return article === document.querySelector('#ki-list article') && document.activeElement === summary && article.querySelector('details').open && article.querySelector('details details').open; });
    check('Unveränderte Aktualisierung erhält Kartenknoten, Fokus und offene Details', kept);
    await page.evaluate(() => { const article = document.querySelector('#ki-list article'); window.__m72OldArticle = article; __g10.state.historyRevision++; __g10.render(); });
    check('Geänderte Belege erhalten offene Details und Tastaturfokus', await page.evaluate(() => { const article = document.querySelector('#ki-list article'); return article !== __m72OldArticle && article.querySelector('details').open && article.querySelector('details details').open && article.contains(document.activeElement); }));
    await page.selectOption('#ki-filter-direction', '-1'); check('Gemeinsamer Shortfilter entfernt Long-Kandidaten', await page.locator('#ki-list article').count() === 0); await page.selectOption('#ki-filter-direction', '');
    await page.evaluate(po => { const view = __g11.view; Object.assign(view.state.options, { config: po.config, on: false, journalPeriod: 'all', origin: po.source.origin, minimumScore: 0 }); view.accept({ journal: [po], stream: null, revision: 1 }); }, fixture.po3Journal[0]);
    await page.click('#ki-view-watch'); check('PO3 unter Beobachten als eigenes hypothetisches Modell', await page.locator('#ki-list [data-po3-id]').count() === 1 && /Power of Three.*kein Ausführungsbeleg/s.test(await page.textContent('#ki-list')));
    await page.click('#ki-view-confluence'); check('Konfluenzfilter entfernt PO3 aus gemeinsamer Liste', await page.locator('#ki-list [data-po3-id]').count() === 0);
    await page.click('#ki-view-po3'); check('PO3-Modellfilter zeigt eigenes Journal ohne Konfluenzkarte', await page.locator('#ki-list [data-po3-id]').count() === 1 && await page.locator('#ki-list [data-ki-id]').count() === 0);
    await page.selectOption('#ki-filter-direction', '-1'); check('Richtungsfilter wirkt auch auf PO3', await page.locator('#ki-list article').count() === 0); await page.selectOption('#ki-filter-direction', '');
    await page.selectOption('#ki-filter-horizon', 'short'); check('Konfluenz-Horizontfilter bezeichnet PO3 nicht als kurz/lang', await page.locator('#ki-list [data-po3-id]').count() === 0); await page.selectOption('#ki-filter-horizon', '');
    await page.click('#ki-view-all'); await page.evaluate(() => { const card = structuredClone(__g10.state.cards[0]); card.id += '|TEST-ALT'; card.scope.modelVersion = 'cf-1'; __g10.state.cards.push(card); __g10.render(); });
    await page.click('#ki-view-archive'); check('Archiv enthält früheres Modell, Standard-Kandidatenansicht blendet es aus', await page.locator('#ki-list [data-ki-id]').count() === 1 && /früheres Modell/.test(await page.textContent('#ki-list')));
    await page.click('#ki-view-ready'); check('Archivkarte erscheint nicht unter Kandidaten', !await page.locator('#ki-list').evaluate(n => n.textContent.includes('früheres Modell')));
    check('Originale nach Darstellungsfiltern unverändert', await page.evaluate(raw => JSON.stringify(__g10.state.cards.slice(0, 1)) === raw, original));
    check('KI-Bereich nutzt am Desktop mehr als 900px Breite', await page.locator('#ki-signal-panel').evaluate(n => n.getBoundingClientRect().width > 900), JSON.stringify(await page.evaluate(() => ({ html: document.documentElement.dataset, widths: ['ki-signal-panel', 'alarms'].map(id => [id, document.getElementById(id).getBoundingClientRect().width]), control: getComputedStyle(document.querySelector('.col-control')).gridArea }))));
    for (const layout of ['standard', 'dashboard']) for (const width of [320, 390, 768, 1440]) { console.log('Prüfe Layout', layout, width); await page.setViewportSize({ width, height: 1000 }); await page.evaluate(layout => { document.documentElement.dataset.presentation = layout; document.documentElement.dataset.layout = innerWidth < 1100 ? 'tablet' : 'desktop'; }, layout);
      check(`${layout} ${width}px: gemeinsame Filter ohne Seitenüberlauf`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      if (width === 1440) {
        const ratio = page.locator('#ki-list [data-ki-id] .ki-grid p:last-child').first(); await ratio.scrollIntoViewIfNeeded();
        const visible = await ratio.evaluate(n => { const r = n.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { ok: n.contains(hit), hit: hit?.closest('[id]')?.id, rect: { x: r.left, y: r.top, width: r.width, height: r.height } }; });
        check(`${layout}: rechtes Preis-/Risikofeld beim Scrollen ohne Überlagerung durch Seitenspalte`, visible.ok, JSON.stringify(visible));
      }
    }
    await page.evaluate(() => { document.documentElement.dataset.presentation = 'standard'; }); await page.click('#ki-price-tab');
    check('Preisalarmansicht behält die bisher mitlaufende Desktop-Seitenspalte', await page.evaluate(() => document.documentElement.dataset.kiOverview !== '1' && getComputedStyle(document.querySelector('.col-control')).position === 'sticky'));
    await page.evaluate(() => __g10.stop()); check('Keine JavaScript-Fehler', !errors.length, errors.join('; ')); check('Keine zusätzlichen Abrufe durch Modell-/Listenfilter', calls > 0 && await page.evaluate(() => !__g05.state.positions.length && !__g05.state.demoPositions.length));
    await ctx.close();
  } finally { await browser?.close(); await h.teardown(); }
  console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
