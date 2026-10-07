// 3.42.0 (G09 C6b): bewusste HTTPS-Übergabe, Revision/Retry, keine Geheimnisse, Dienst als einziger Mustersender.
const h = require('./harness');
const results = [], check = (name, ok, info = '') => { results.push(!!ok); console.log(`${ok ? '✓' : '✗'} ${name}${info ? ' — ' + String(info).slice(0, 500) : ''}`); };
(async () => {
  await h.setup(); await h.ctl('/reset'); const browser = await h.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
    const TOKEN = '123456789:TEST_ONLY_not_a_real_token_000000000', KEY = 'k'.repeat(43), calls = [];
    let watch = { rev: 0, since: 0, config: null }, conflict = false, lost = false, notifyFail = false;
    await page.route('https://svc.test/v1/**', async route => {
      const req = route.request(), p = new URL(req.url()).pathname, body = req.postDataJSON();
      const send = (j, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(j) });
      if (p === '/v1/state') return send({ ok: true, v: '2.4.0', rev: 0, targets: Object.fromEntries(['course-alert', 'backup', 'trades', 'patterns'].map(id => [id, { on: true, epoch: 1, since: 1 }])), eps: {}, events: [], patternWatch: watch });
      if (p === '/v1/patterns/watch') {
        calls.push({ p, body });
        if (conflict) { conflict = false; watch = { ...watch, rev: watch.rev + 1 }; return send({ ok: false, error: 'Musterliste am Dienst geändert – erneut bewusst übernehmen.', patternWatch: watch }, 409); }
        if (lost) { lost = false; return route.abort('failed'); }
        watch = { rev: watch.rev + 1, since: Date.now(), config: body.config }; return send({ ok: true, commandId: body.commandId, patternWatch: watch });
      }
      if (p === '/v1/patterns/notify') { calls.push({ p, body }); return notifyFail ? route.abort('failed') : send({ ok: true, st: 'confirmed', eventId: `pat:${body.c.id}` }); }
      return send({ ok: false }, 404);
    });
    await ctx.addInitScript(({ TOKEN, KEY }) => {
      localStorage.setItem('scalpdesk.channels.v1', JSON.stringify({ tg: { token: TOKEN, chat: '987654321', pchat: '-100888', pthread: '77' }, tgt: { patterns: true }, ev: {}, mig33: true }));
      localStorage.setItem('scalpdesk.svc.v1', JSON.stringify({ url: 'https://svc.test', key: KEY, inst: 'iphone01' }));
    }, { TOKEN, KEY });
    await page.goto(h.URL_BASE + '/weather-widget-v2.html');
    await page.waitForFunction(() => window.__g05?.svc.pol.conf?.patternWatch && window.__g09?.wl.c.size > 0 && [...__g09.wl.c.values()].every(e => e.at && !e.loading && !e.error), null, { timeout: 30000 });
    await page.evaluate(() => document.getElementById('chan-open').click());
    check('Ohne Übernahme wird keine Musterliste eigenmächtig übertragen', calls.length === 0);
    await page.click('#pat-svc-apply'); await page.waitForFunction(() => /Übernommen/.test(document.getElementById('pat-svc-status').textContent));
    const first = calls.find(x => x.p.endsWith('/watch'))?.body;
    check('Übergabe enthält wirkliche Vorauswahlmärkte und das Kerzenintervall (Standard 1h-Zeitraum = 5m)', first?.config.items.length > 0 && first.config.items.every(x => ['spot', 'futures'].includes(x.mkt) && x.iv === '5m') && first.config.chat === '-100888' && first.config.thread === '77');
    check('HTTPS-Vertrag enthält Bot-ID, keinerlei Telegram-Token oder Dienstschlüssel', first?.config.bot === '123456789' && !JSON.stringify(calls).includes(TOKEN) && !JSON.stringify(calls).includes(KEY));
    check('Bestätigte Revision und Marktanzahl erscheinen im Status', /Revision 1/.test(await page.locator('#pat-svc-status').textContent()));
    conflict = true; await page.click('#pat-svc-apply'); await page.waitForFunction(() => /erneut bewusst/.test(document.getElementById('pat-svc-status').textContent));
    const atConflict = calls.length; await page.waitForTimeout(1200);
    check('Revisionskonflikt bleibt sichtbar, kein automatisches Wiederholen', calls.length === atConflict);
    await page.click('#pat-svc-apply'); await page.waitForFunction(() => /Übernommen/.test(document.getElementById('pat-svc-status').textContent));
    check('Erst zweiter bewusster Klick verwendet den neuen bestätigten Stand', calls.at(-1).body.expectedRevision === 2);
    lost = true; await page.click('#pat-svc-apply'); await page.waitForFunction(() => /nicht erreichbar/.test(document.getElementById('pat-svc-status').textContent));
    const retryId = calls.at(-1).body.commandId; await page.click('#pat-svc-apply'); await page.waitForFunction(() => /Übernommen/.test(document.getElementById('pat-svc-status').textContent));
    check('Verlorene Übernahmeantwort: gleicher Command beim bewussten Retry', calls.at(-1).body.commandId === retryId);
    const fire = () => page.evaluate(async () => {
      const t = Math.floor(Date.now() / 36e5) * 36e5 - 36e5, c = { mkt: 'spot', sym: 'BTCUSDT', iv: '1h', pat: 'double_bottom', kind: 'form', dir: 'bull', t0: t - 20 * 36e5, t1: t, tc: t, p0: 100, model: 'pat-1', profile: 'H12-e0.10', q: 88, src: 'live', rules: [], res: null };
      c.id = __g09.pkId(c); await __g09.patNotify(c, { levels: { tgt: 110, inv: 90 } });
    });
    await fire(); const notices = calls.filter(x => x.p.endsWith('/notify'));
    check('Offene App übergibt denselben Fall an Oracle mit erwarteter Zielrevision', notices.length === 1 && notices[0].body.c.id.includes('|') && notices[0].body.expectedRevision === watch.rev);
    check('Kein zusätzlicher direkter Telegram-Versand aus der App', !(await h.ctl('/sent')).some(x => x.svc === 'tg' && String(x.chat_id) === '-100888'));
    notifyFail = true; await fire();
    check('Dienst nicht erreichbar: unbestätigt sichtbar, kein lokaler Ersatzversand', /unbestätigt.*Kein Ersatzversand/.test(await page.locator('#pat-svc-status').textContent()) && !(await h.ctl('/sent')).some(x => x.svc === 'tg' && String(x.chat_id) === '-100888'));
    await page.fill('#tg-pchat', '-100999'); await page.evaluate(() => document.getElementById('tg-pchat').dispatchEvent(new Event('change', { bubbles: true }))); const count = calls.length; await fire();
    check('Geänderter lokaler Chat wird vor neuer Übernahme nicht an alten Dienstchat gesendet', calls.length === count && /erst am Dienst übernehmen/.test(await page.locator('#pat-svc-status').textContent()));
    check('Keine JavaScript-Fehler', !errors.filter(x => x.startsWith('[pageerror]')).length, errors.filter(x => x.startsWith('[pageerror]')).join(' | '));
    await ctx.close();
  } catch (e) { check('Abbruch', false, e.message); }
  finally { await browser.close(); await h.teardown(); }
  const pass = results.filter(Boolean).length; console.log(`\n${pass}/${results.length} bestanden`); process.exit(pass === results.length ? 0 : 1);
})();
