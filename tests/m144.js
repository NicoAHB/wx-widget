// 3.87.0 – VWAP: „Aktuelle Lage“ und optionale KI-Einschätzung (eher kaufen / eher verkaufen / abwarten, mit Begründung) im Info-Punkt, für jeden der 16 Anker.
// Der Dienst wird gespielt (POST /v1/vwap/explain). Geprüft: Lage-Sätze je Anker gegen die Zahlen der Linie, gesendeter Kontext (nur Zahlen, passender Anker),
// Tendenz-Anzeige, verworfene Antworten (anderer Anker), Fehlermeldungen (kein Dienst, kein Modell, 404/429/503/400, Netz), Anker-Wechsel während der Anfrage,
// Breiten 320–1440 px. Aufruf: node m144.js
const h = require('./harness');
const results = [], check = (name, ok, detail = '') => { results.push({ name, ok: !!ok }); console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + String(detail).slice(0, 700) : ''}`); };
const real = errs => errs.filter(e => !/Service Worker registration blocked|Failed to load resource|ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|net::ERR|Dienst|8999/.test(e));
const until = async (fn, ms = 20000, step = 150) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await h.sleep(step); } };
const MODES = [['day', 'Tag'], ['week', 'Woche'], ['month', 'Monat'], ['asia', 'ab Asien-Open'], ['london', 'ab London-Open'], ['ny', 'ab NY-Open'], ['low', 'ab Swing-Tief'], ['high', 'ab Swing-Hoch'], ['pdl', 'ab Vortag-Tief'], ['pdh', 'ab Vortag-Hoch'], ['wl', 'ab Wochen-Tief'], ['wh', 'ab Wochen-Hoch'], ['pwl', 'ab Vorwochen-Tief'], ['pwh', 'ab Vorwochen-Hoch'], ['vol', 'ab Volumenspitze'], ['anchor', 'ab Anker']];
const CTX_KEYS = 'ageHours,candles,distPct,interval,lower,mode,modeName,model,price,recent,sigma,slope,slopePct,slopeBars,start,symbol,upper,vwap,zone'.split(',').sort().join();
(async () => {
  await h.setup(); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  const browser = await h.launch({ workspace: 'fresh' });
  try {
    const anchorTime = Math.floor((Date.now() - 25 * 60e3) / 60e3) * 60e3;
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } }), page = await ctx.newPage(), errors = [], calls = []; h.collect(page, errors);
    let reply = () => ({ status: 200, body: { ok: true, lean: 'buy', text: 'Der Kurs hält sich über dem VWAP.' } }), delay = 0, netFail = false;
    await ctx.addInitScript(([t, once]) => { if (!localStorage.getItem(once)) { localStorage.setItem(once, '1'); localStorage.setItem('scalpdesk.vwap.v1', JSON.stringify({ mode: 'day', anchor: { symbol: 'BTCUSDT', time: t } })); } }, [anchorTime, 'm144-' + Math.random()]);
    await ctx.route('http://127.0.0.1:8999/**', async route => {
      const headers = { 'access-control-allow-origin': h.URL_BASE, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'authorization,content-type' };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (!route.request().url().endsWith('/v1/vwap/explain')) return route.fulfill({ status: 503, headers, contentType: 'application/json', body: '{"ok":false}' });
      const body = route.request().postDataJSON(), auth = route.request().headers().authorization; calls.push({ body, auth, raw: route.request().postData() });
      if (netFail) return route.abort('connectionrefused');
      if (delay) await new Promise(r => setTimeout(r, delay));
      const r = reply(body); return route.fulfill({ status: r.status, headers, contentType: 'application/json', body: JSON.stringify(r.body) }).catch(() => {});
    });
    await page.goto(`${h.URL_BASE}/weather-widget-v2.html`);
    await until(() => page.evaluate(() => window.__vw && document.querySelectorAll('#chart svg').length > 0)); await page.waitForTimeout(1200);
    await page.evaluate(() => { const t = document.querySelector('.overlay-toggles'), d = t.closest('details'); if (d) d.open = true; t.scrollIntoView({ block: 'center' }); });
    const connect = () => page.evaluate(() => { for (const [id, value] of [['svc-url', 'http://127.0.0.1:8999'], ['svc-key', 'k'.repeat(43)]]) { const input = document.getElementById(id); input.value = value; input.dispatchEvent(new Event('change', { bubbles: true })); } });
    const tip = open => page.evaluate(o => { const d = document.getElementById('vw-tip'); d.open = o; return d.open; }, open);
    const panel = () => page.evaluate(() => ({ sub: document.getElementById('vw-sit-sub').textContent, lines: [...document.querySelectorAll('#vw-sit-lines p')].map(p => p.textContent), btn: { disabled: document.getElementById('vw-ai').disabled, text: document.getElementById('vw-ai').textContent }, out: { lean: document.querySelector('#vw-ai-out .vw-lean')?.textContent || '', leanKey: document.querySelector('#vw-ai-out .vw-lean')?.dataset.lean || '', text: document.querySelector('#vw-ai-out .vw-ai-text')?.textContent || '', msg: document.querySelector('#vw-ai-out .vw-ai-msg')?.textContent || '', foot: document.querySelector('#vw-ai-out .vw-ai-foot')?.textContent || '' } }));

    // ---------- VWAP aus: Hinweis, Knopf gesperrt ----------
    await tip(true); await page.waitForTimeout(300);
    let p = await panel();
    check('VWAP aus: „Aktuelle Lage“ nennt, wie man ihn einschaltet; KI-Knopf gesperrt', /VWAP ist ausgeschaltet/.test(p.lines.join(' ')) && p.btn.disabled && /KI-Einschätzung: kaufen, verkaufen oder abwarten\?/.test(p.btn.text), JSON.stringify(p));
    check('Der Hinweis unter dem Knopf nennt, was gesendet wird: nur Zahlen, über den eigenen Dienst', await page.evaluate(() => /Optional\. Sendet nur die Zahlen oben .* über deinen 24\/7-Dienst/.test(document.getElementById('vw-ai-note').textContent)));
    await tip(false);
    await page.click('[data-overlay="vwap"]'); await until(() => page.evaluate(() => __vw.compute().series)); await page.waitForTimeout(500);
    await page.selectOption('#zz-pct', '0.25'); await page.waitForTimeout(500);
    await tip(true); await page.waitForTimeout(500);

    // ---------- Lage je Anker ----------
    let withSeries = [];
    for (const [mode, name] of MODES) {
      await page.selectOption('#vw-mode', mode);
      const got = await until(() => page.evaluate(m => { const r = __vw.compute(); return __vw.mode === m && (r.series || (r.why && !/werden geladen/.test(r.why))) ? { has: !!r.series, why: r.why } : null; }, mode), 15000);
      if (got?.has) await until(() => page.evaluate(n => (document.querySelector('#vw-sit-lines p')?.textContent || '').startsWith('VWAP ' + n + ' '), name), 5000);
      await page.waitForTimeout(200); p = await panel();
      const sit = await page.evaluate(() => { const s = __vw.situation(), c = __vw.compute(); return s && { vwap: s.vwap, last: c.series.last.vwap, mode: s.mode, name: s.name, start: s.start, seriesStart: c.series.start, candles: s.candles, n: c.series.points.length, zone: s.zone }; });
      if (got?.has) {
        withSeries.push(mode);
        const text = p.lines.join(' ');
        check(`${name}: Lage mit Name, Start, Abstand zum VWAP, Verlauf der letzten Kerzen und Bedeutung des Ankers`, sit && sit.vwap === sit.last && sit.mode === mode && sit.start === sit.seriesStart && sit.candles === sit.n && text.includes(`VWAP ${name} `) && /Start \d/.test(text) && /Der Kurs liegt/.test(text) && /Kerzen seit dem Anker/.test(text) && /Durchschnittspreis (seit|des laufenden|der laufenden)/.test(text) && !/NaN|undefined|null|Infinity/.test(text) && !p.btn.disabled && /^Stand \d\d:\d\d MEZ\/MESZ$/.test(p.sub), JSON.stringify({ sit, lines: p.lines.slice(0, 2) }));
      } else {
        check(`${name}: ohne Linie nennt die Lage den Grund; KI-Knopf gesperrt`, !sit && p.btn.disabled && p.lines.length === 1 && p.lines[0].length > 15 && !/NaN|undefined/.test(p.lines[0]), JSON.stringify({ got, lines: p.lines }));
      }
    }
    check('Mindestens zwölf der 16 Anker haben mit den Kerzen der Attrappe eine Lage (der Rest nennt den Grund)', withSeries.length >= 12, withSeries.join());

    // ---------- Dienst und Modell ----------
    await page.selectOption('#vw-mode', 'day'); await until(() => page.evaluate(() => __vw.mode === 'day' && __vw.compute().series)); await page.waitForTimeout(500);
    await page.click('#vw-ai'); await page.waitForTimeout(400); p = await panel();
    check('Ohne eingerichteten Dienst: erklärt, was fehlt, und sendet nichts', /24\/7-Dienst ist nicht eingerichtet/.test(p.out.msg) && calls.length === 0 && !p.out.text, JSON.stringify(p.out));
    await connect(); await page.waitForTimeout(500);
    await page.click('#vw-ai'); await page.waitForTimeout(400); p = await panel();
    check('Dienst da, aber noch kein KI-Modell gewählt: Hinweis auf die Einstellung, nichts gesendet', /Noch kein KI-Modell gewählt/.test(p.out.msg) && /Orderflow-Signal/.test(p.out.msg) && calls.length === 0, JSON.stringify(p.out));
    // Anbieter und Modell wie in der Oberfläche eintragen (Orderflow-Signal › Einstellungen); die automatische Orderflow-Erklärung bleibt aus
    await page.evaluate(() => { const root = document.getElementById('orderflow-panel'), box = root.querySelector('.of-signal-settings'); box.open = true; const model = [...box.querySelectorAll('input')].find(x => x.getAttribute('aria-label') === 'KI-Modell'); model.value = 'allowed'; model.dispatchEvent(new Event('input', { bubbles: true })); [...box.querySelectorAll('button')].find(b => b.textContent === 'Einstellungen speichern').click(); });
    await page.waitForTimeout(600); await tip(true); // ein Klick außerhalb schließt die Info-Punkte
    check('Einstellung gespeichert: Anbieter OpenAI, Modell „allowed“, automatische Orderflow-Erklärung bleibt aus', await page.evaluate(() => { const c = JSON.parse(localStorage.getItem('scalpdesk.orderflow-signal.v1') || 'null'); return c?.ai?.provider === 'openai' && c.ai.model === 'allowed' && c.ai.enabled === false; }));

    // ---------- KI-Einschätzung für jeden Anker mit Linie ----------
    const leans = ['buy', 'sell', 'wait']; let i = 0, allOk = true, details = [];
    reply = body => { const lean = leans[i++ % 3]; return { status: 200, body: { ok: true, mode: body.context.mode, lean, text: `Begründung für ${body.context.modeName}: ${body.context.zone}.` } }; };
    for (const mode of withSeries) {
      await page.selectOption('#vw-mode', mode); await until(() => page.evaluate(m => __vw.mode === m && __vw.compute().series, mode), 15000); await page.waitForTimeout(400);
      const before = calls.length, s = await page.evaluate(() => { const x = __vw.situation(); return { vwap: x.vwap, price: x.price, start: x.start }; });
      await page.click('#vw-ai'); await until(() => calls.length > before && page.evaluate(() => !!document.querySelector('#vw-ai-out .vw-ai-text')), 8000);
      const c = calls.at(-1)?.body, o = (await panel()).out, want = leans[(i - 1) % 3], label = { buy: 'Eher kaufen', sell: 'Eher verkaufen', wait: 'Abwarten' }[want];
      const ok = calls.length === before + 1 && c.provider === 'openai' && c.model === 'allowed' && c.context.mode === mode && c.context.vwap === s.vwap && c.context.start === new Date(s.start).toISOString() && c.context.model === 'vwap-1' && c.context.symbol === 'BTCUSDT'
        && Object.keys(c.context).sort().join() === CTX_KEYS && calls.at(-1).auth === 'Bearer ' + 'k'.repeat(43) && !/k{43}/.test(calls.at(-1).raw) && o.lean === label && o.leanKey === want && /^Begründung für /.test(o.text) && /Keine Anlageberatung und kein Signal der App/.test(o.foot);
      if (!ok) { allOk = false; details.push({ mode, ok, ctx: c?.context && Object.keys(c.context).sort().join(), o }); }
    }
    check(`Alle ${withSeries.length} Anker mit Linie: Kontext (nur Zahlen, passender Anker, Schlüssel nur im Kopf), Tendenz-Marke und Begründung`, allOk && withSeries.length >= 12, JSON.stringify(details.slice(0, 2)));
    const recent = calls.at(-1).body.context.recent;
    check('Kontext enthält nur Zahlen zur Lage: keine Kerzenlisten, letzte Schlusskurse als Zählung', !('candles' in calls.at(-1).body.context && Array.isArray(calls.at(-1).body.context.candles)) && recent.n >= 3 && recent.above + recent.below <= recent.n && recent.streak && typeof recent.streak.count === 'number' && calls.at(-1).raw.length < 1500, calls.at(-1).raw);

    // ---------- Antworten, die nicht passen, und Fehler ----------
    await page.selectOption('#vw-mode', 'day'); await until(() => page.evaluate(() => __vw.mode === 'day' && __vw.compute().series)); await page.waitForTimeout(400);
    const ask = async () => { const n = calls.length; await page.click('#vw-ai'); await until(() => page.evaluate(() => { const o = document.getElementById('vw-ai-out'); return o.textContent.length > 0 && !/wird geladen/.test(o.textContent); }), 8000); await page.waitForTimeout(150); return { calls: calls.length - n, ...(await panel()).out }; };
    reply = body => ({ status: 200, body: { ok: true, mode: body.context.mode === 'day' ? 'week' : 'day', lean: 'buy', text: 'Falscher Anker.' } });
    let r = await ask(); check('Antwort für einen anderen Anker wird verworfen (keine Tendenz, kein Text)', r.calls === 1 && !r.text && !r.lean && /passte nicht zur Anfrage/.test(r.msg), JSON.stringify(r));
    reply = body => ({ status: 200, body: { ok: true, mode: body.context.mode, text: 'Ohne Tendenz-Wort.' } });
    r = await ask(); check('Antwort ohne Tendenz: Text wird gezeigt, keine Tendenz-Marke erfunden', r.text === 'Ohne Tendenz-Wort.' && r.lean === '' && /Keine Anlageberatung/.test(r.foot), JSON.stringify(r));
    reply = body => ({ status: 200, body: { ok: true, mode: body.context.mode, lean: 'moon', text: 'Unbekannte Tendenz.' } });
    r = await ask(); check('Unbekannte Tendenz aus der Antwort wird nicht angezeigt', r.text === 'Unbekannte Tendenz.' && r.lean === '', JSON.stringify(r));
    for (const [status, rx, label] of [[404, /Installer erneut ausführen \(Dienst ab 2\.16\.0\)/, '404 (alter Dienst)'], [429, /Höchstens eine KI-Einschätzung pro 30 Sekunden/, '429 (zu oft)'], [503, /dieses KI-Modell nicht eingerichtet/, '503 (Modell nicht erlaubt)'], [400, /Zahlen abgelehnt/, '400 (Zahlen abgelehnt)'], [502, /nicht verfügbar/, '502 (Anbieter ausgefallen)']]) {
      reply = () => ({ status, body: { ok: false, error: 'KI-Erklärung nicht verfügbar. Nur Regeln bleibt aktiv.' } });
      r = await ask(); check(`Dienst antwortet ${label}: verständliche Meldung, Lage bleibt`, rx.test(r.msg) && !r.text && (await panel()).lines.length >= 4, JSON.stringify(r));
    }
    netFail = true; r = await ask(); netFail = false;
    check('Dienst nicht erreichbar: Meldung statt Fehler, Panel läuft weiter', r.msg.length > 10 && !r.text && (await panel()).lines.length >= 4, JSON.stringify(r));

    // ---------- Anker-Wechsel während der Anfrage ----------
    reply = body => ({ status: 200, body: { ok: true, mode: body.context.mode, lean: 'sell', text: `Antwort für ${body.context.modeName}.` } }); delay = 1500;
    await page.click('#vw-ai'); await page.waitForFunction(() => /wird geladen/.test(document.getElementById('vw-ai-out').textContent), null, { timeout: 4000 });
    await page.selectOption('#vw-mode', 'week'); await page.waitForTimeout(2300); delay = 0;
    p = await panel(); check('Wechsel des Ankers während der Anfrage: die späte Antwort für „Tag“ erscheint nicht bei „Woche“; Knopf wieder frei', !p.out.text && !/Antwort für Tag/.test(p.out.msg) && !p.btn.disabled, JSON.stringify(p.out));
    await page.selectOption('#vw-mode', 'day'); await page.waitForTimeout(500); p = await panel();
    check('Zurück zu „Tag“: die Antwort mit Uhrzeit ist noch da (nichts neu bezahlt)', /Antwort für Tag/.test(p.out.text) && /\d\d:\d\d MEZ\/MESZ/.test(p.out.foot), JSON.stringify(p.out));

    // ---------- Breiten ----------
    await page.selectOption('#vw-mode', 'week'); await page.waitForTimeout(300);
    reply = body => ({ status: 200, body: { ok: true, mode: body.context.mode, lean: 'wait', text: 'Abwarten, bis der Kurs das obere Band zurückerobert. '.repeat(6) } });
    await page.click('#vw-ai'); await until(() => page.evaluate(() => !!document.querySelector('#vw-ai-out .vw-ai-text')), 8000);
    await tip(false);
    for (const w of [1440, 768, 430, 390, 320]) {
      await page.setViewportSize({ width: w, height: 900 }); await page.waitForTimeout(500);
      await page.evaluate(() => { const t = document.getElementById('vw-tip'); t.scrollIntoView({ block: 'center' }); t.open = true; }); await page.waitForTimeout(500);
      const g = await page.evaluate(() => { const b = document.querySelector('#vw-tip .tip-body').getBoundingClientRect(), btn = document.getElementById('vw-ai').getBoundingClientRect(); return { left: Math.round(b.left), right: Math.round(b.right), width: Math.round(b.width), vw: innerWidth, sw: document.documentElement.scrollWidth, btnH: Math.round(btn.height), btnW: Math.round(btn.width), bodyW: Math.round(document.querySelector('#vw-tip .tip-body').clientWidth), scrollW: document.querySelector('#vw-tip .tip-body').scrollWidth }; });
      check(`${w}px: Info-Punkt liegt im Bild, kein seitliches Scrollen, Knopf groß genug und innerhalb`, g.left >= -1 && g.right <= g.vw + 1 && g.sw <= g.vw + 1 && g.btnH >= 32 && g.btnW <= g.bodyW + 1 && g.scrollW <= g.bodyW + 1, JSON.stringify(g));
      if (process.env.M144_SHOT && [390, 1440].includes(w)) await page.screenshot({ path: `${process.env.M144_SHOT}/m144-${w}.png` });
      await tip(false);
    }
    check('keine Fehler (Seite)', !real(errors).length, real(errors).join(' | '));
    await ctx.close();
  } catch (e) { check('Abbruch', false, e.stack || e.message); if (process.env.M144_DEBUG) { const pg = browser.contexts()[0]?.pages()[0]; if (pg) { console.log(JSON.stringify(await pg.evaluate(() => ({ open: document.getElementById('vw-tip').open, dis: document.getElementById('vw-ai').disabled, mode: __vw.mode, series: !!__vw.compute().series, why: __vw.compute().why, vis: document.getElementById('vw-ai').getBoundingClientRect().toJSON(), lines: [...document.querySelectorAll('#vw-sit-lines p')].map(x => x.textContent), ov: __g05.state.overlays.vwap })))); await pg.screenshot({ path: process.env.M144_DEBUG }); } } }
  finally { await browser.close(); await h.ctl('/walk?on=1'); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
