// 3.86.1 – Euro-Wert in der Kopfzeile („Offen … USDT · 3 (€ n. v.)“): Der EUR/USDT-Kurs wird (1) auch geholt, wenn der große Marktabruf noch
// nicht fertig ist, (2) über einen Neustart behalten (als „veraltet“ gekennzeichnet, nach 7 Tagen nicht mehr benutzt) und (3) nach einem Ausfall
// spätestens nach 15 s neu geholt. Der Kurs für eingefrorene Abschlusswerte bleibt davon unberührt (nur frische Kurse).
// Aufruf: node m143.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + String(detail).slice(0, 600) : ''}`); };
const real = errs => errs.filter(e => !/Service Worker registration blocked|Failed to load resource|ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|net::ERR|Test-Ausfall|EUR\/USDT/.test(e));
const CORS = { 'access-control-allow-origin': '*' };
const bar = page => page.evaluate(() => ({ v: document.getElementById('lb-open').textContent, e: document.getElementById('lb-open-eur').textContent, t: document.getElementById('lb-open-eur').title }));
const euroShown = page => page.waitForFunction(() => /€/.test(document.getElementById('lb-open-eur').textContent) && !/n\. v\./.test(document.getElementById('lb-open-eur').textContent), null, { timeout: 12000 }).then(() => true).catch(() => false);
const usdt = t => Number(t.replace(/ ·.*$/, '').replace(/ USDT.*$/, '').replace(/[^\d,−+-]/g, '').replace('−', '-').replace(',', '.'));
const eur = t => Number((t.match(/\(([+−-]?[\d.]+,\d+) €/) || [])[1]?.replace(/\./g, '').replace('−', '-').replace(',', '.'));

(async () => {
  await h.setup(); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  const browser = await h.launch();
  const p0 = (await h.ctl('/state')).price.BTCUSDT, now0 = Date.now();
  const POS = [{ id: 'p143', symbol: 'BTCUSDT', side: 'long', mode: 'isolated', entry: p0 * 1.01, leverage: 5, qty: 0.01, margin: p0 * 0.01 / 5, openedAt: now0 - 60e3, source: 'spot', liqExchange: null, preRealized: 0, sl: null, tp: null, ack: { sl: false, tp: false } }];
  const open = async (init = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } }), page = await ctx.newPage(), errors = [], fx = { blocked: false, delayAll: 0, calls: 0 };
    h.collect(page, errors);
    await ctx.addInitScript(([p, once, extra]) => { if (!localStorage.getItem(once)) { localStorage.setItem(once, '1'); localStorage.setItem('scalpdesk.positions.v1', JSON.stringify(p)); for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, JSON.stringify(v)); } }, [POS, 'm143-' + Math.random(), init]);
    await ctx.route(/https:\/\/[^/]+\/api\/v3\/ticker\/bookTicker/, route => {
      if (!/symbol=EURUSDT/.test(route.request().url())) return route.continue();
      fx.calls++;
      if (fx.blocked) return route.fulfill({ status: 400, json: { code: -1121, msg: 'Test-Ausfall' }, headers: CORS });
      return route.continue();
    });
    return { ctx, page, errors, fx };
  };
  try {
    // ---------- 1. Normalbetrieb: Euro erscheint, der Kurs wird gespeichert ----------
    const A = await open(); await A.page.goto(`${h.URL_BASE}/weather-widget-v2.html`);
    check('Normal: Kopfzeile zeigt den Euro-Wert', await euroShown(A.page), JSON.stringify(await bar(A.page)));
    const b1 = await bar(A.page), saved = await A.page.evaluate(() => JSON.parse(localStorage.getItem('scalpdesk.fx-last.v1') || 'null'));
    check('… Betrag in Euro = USDT-Betrag geteilt durch den Kurs 1,164 (Attrappe)', Math.abs(eur(b1.e) - usdt(b1.v) / 1.164) < 0.02, JSON.stringify(b1));
    check('Der letzte Kurs ist gespeichert (1,164 mit Zeit)', saved && Math.abs(saved.v - 1.164) < 1e-9 && Math.abs(saved.at - Date.now()) < 60000, JSON.stringify(saved));

    // ---------- 2. Neustart, Kurs-Abruf fällt aus: gespeicherter Kurs wird gezeigt ----------
    A.fx.blocked = true; await A.page.reload();
    check('Neustart ohne erreichbaren EUR/USDT-Abruf: Euro-Wert steht trotzdem da (gespeicherter Kurs)', await euroShown(A.page), JSON.stringify(await bar(A.page)));
    const b2 = await bar(A.page);
    check('… mit demselben Kurs gerechnet', Math.abs(eur(b2.e) - usdt(b2.v) / 1.164) < 0.02, JSON.stringify(b2));
    await A.page.waitForTimeout(1500);
    check('… Abrufe laufen weiter, Einstellungen nennen den Grund; kein „n. v.“', (await bar(A.page)).e.includes('€') && /EURUSDT|Test-Ausfall|Kein aktiver/.test(await A.page.evaluate(() => document.getElementById('fx-note').textContent)), await A.page.evaluate(() => document.getElementById('fx-note').textContent));

    // ---------- 3. Wiederkehr: nach dem Ausfall kommt der frische Kurs ohne Neustart ----------
    await A.page.evaluate(() => { __g05.state.fx = null; __g05.state.fxAt = 0; });
    A.fx.blocked = false; const calls = A.fx.calls;
    const back = await A.page.waitForFunction(() => __g05.state.fx > 0 && Date.now() - __g05.state.fxAt < 20000, null, { timeout: 25000 }).then(() => true).catch(() => false);
    check('Nach dem Ausfall holt der Takt den Kurs binnen 15 s selbst', back && A.fx.calls > calls, `${A.fx.calls - calls} Abrufe`);
    check('keine Fehler (Normalbetrieb/Neustart)', !real(A.errors).length, real(A.errors).join(' | '));
    await A.ctx.close();

    // ---------- 4. Marktabruf hängt: Euro kommt trotzdem aus dem eigenen Abruf ----------
    const B = await open(); let hold = true;
    await B.ctx.route(/https:\/\/(?:data-api\.binance\.vision|api\.binance\.com|fapi\.binance\.com)\/(?:api|fapi)\/.*(?:klines|premiumIndex|openInterest|ticker\/price)/, async route => { while (hold) await new Promise(r => setTimeout(r, 200)); try { await route.continue(); } catch {} });
    const t0 = Date.now(); await B.page.goto(`${h.URL_BASE}/weather-widget-v2.html`);
    const early = await B.page.waitForFunction(() => __g05.state.fx > 0, null, { timeout: 9000 }).then(() => true).catch(() => false);
    check('Marktabruf hängt (Kerzen, Futures, Positionskurse): EUR/USDT-Kurs ist trotzdem binnen 9 s da', early, `${Date.now() - t0} ms`);
    hold = false;
    await B.ctx.close();

    // ---------- 5. Gespeicherter Kurs: alt → „veraltet“, älter als 7 Tage → „n. v.“ ----------
    for (const [label, age, expect] of [['2 Stunden alt', 2 * 3600e3, 'stale'], ['8 Tage alt', 8 * 864e5, 'none']]) {
      const C = await open({ 'scalpdesk.fx-last.v1': { v: 1.2, at: Date.now() - age } }); C.fx.blocked = true;
      await C.page.goto(`${h.URL_BASE}/weather-widget-v2.html`);
      await C.page.waitForFunction(() => /USDT/.test(document.getElementById('lb-open').textContent), null, { timeout: 20000 }).catch(() => {});
      await C.page.waitForTimeout(2500);
      const b = await bar(C.page);
      if (expect === 'stale') check(`Gespeicherter Kurs (${label}), Abruf fällt aus: Euro mit Hinweis „Kurs veraltet“, Rechnung mit 1,2`, /€/.test(b.e) && /Kurs veraltet/.test(b.e) && Math.abs(eur(b.e) - usdt(b.v) / 1.2) < 0.02, JSON.stringify(b));
      else check(`Gespeicherter Kurs (${label}): nicht mehr benutzt, ehrlich „(€ n. v.)“ mit Grund im Hinweis`, /^\(€ n\. v\.\)$/.test(b.e) && /kein EUR\/USDT-Kurs/.test(b.t), JSON.stringify(b));
      await C.ctx.close();
    }

    // ---------- 6. Schutz: der gespeicherte Kurs steht nur in fxLast, nie in state.fx (das nehmen eingefrorene Abschlusswerte) ----------
    const D = await open({ 'scalpdesk.fx-last.v1': { v: 1.2, at: Date.now() - 60e3 } }); D.fx.blocked = true;
    await D.page.goto(`${h.URL_BASE}/weather-widget-v2.html`); await D.page.waitForTimeout(3000);
    const st = await D.page.evaluate(() => ({ fx: __g05.state.fx, last: __g05.state.fxLast && __g05.state.fxLast.v }));
    check('Gespeicherter Kurs gilt nur für die Anzeige offener Werte (state.fx leer, fxLast = 1,2)', !(st.fx > 0) && st.last === 1.2, JSON.stringify(st));
    await D.ctx.close();
  } catch (e) { check('Abbruch', false, e.stack || e.message); }
  finally { await browser.close(); await h.ctl('/walk?on=1'); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
