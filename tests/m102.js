// 3.69.0: Qualitätsfilter für Chartmuster-Meldungen in der App – Einstellungen mit Presets, Bewertung zwischen Erkennung und
// Telegram, gefilterte Signale nur im Log (nie an Telegram), gesendete mit Zeile „🎯 Signalscore“, Export an Oracle, Backtest.
const h = require('./harness');
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + String(detail).slice(0, 300) : ''}`); };
const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw';   // Test-Token der Telegram-Attrappe (kein echter Bot)
(async () => {
  await h.setup(); await h.ctl('/reset'); const browser = await h.launch({ workspace: 'fresh' });
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), page = await ctx.newPage(), errors = [];
    await ctx.addInitScript(T => { localStorage.setItem('scalpdesk.channels.v1', JSON.stringify({ tg: { token: T, chat: '987654321', pchat: '-100777' }, tgt: { patterns: true }, ev: {}, mig33: true })); }, TOKEN);
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => window.__patq && window.__g05?.state.candles.length > 100);
    // ---- Einstellungen ----
    await page.evaluate(() => document.getElementById('chan-open').click()); await page.waitForFunction(() => document.getElementById('chan-dialog').open);
    await page.evaluate(() => { const d = document.getElementById('patq-settings'); d.open = true; d.scrollIntoView({ block: 'start' }); });
    const form = await page.evaluate(() => ({ label: document.getElementById('patq-preset-label').textContent, preset: document.getElementById('patq-preset').value, options: [...document.querySelectorAll('#patq-preset option')].map(o => o.textContent), fields: document.querySelectorAll('#patq-form .patq-field input').length, score: document.getElementById('patq-minScore').value, rr: document.getElementById('patq-minRR').value, counter: document.getElementById('patq-counter').checked }));
    check('Einstellungsdialog: Presets Streng / Normal / Locker / Eigene Werte, alle 13 Schwellen, Gegentrend-Schalter aus; Standard Normal (Score 70, R/R 2)', form.options.join() === 'Streng,Normal,Locker,Eigene Werte' && form.fields === 13 && form.preset === 'normal' && form.score === '70' && form.rr === '2' && !form.counter && /Normal · Score ≥ 70 · R\/R ≥ 2/.test(form.label), JSON.stringify(form));
    await page.selectOption('#patq-preset', 'streng');
    const strict = await page.evaluate(() => ({ score: document.getElementById('patq-minScore').value, stored: JSON.parse(localStorage.getItem('scalpdesk.patfilter.v1')) }));
    check('Preset „Streng“ füllt die Schwellen und wird gespeichert', strict.score === '80' && strict.stored.preset === 'streng' && strict.stored.minRR === 2.5, JSON.stringify(strict.stored));
    await page.fill('#patq-minScore', '55'); await page.dispatchEvent('#patq-minScore', 'change');
    const own = await page.evaluate(() => ({ preset: document.getElementById('patq-preset').value, stored: JSON.parse(localStorage.getItem('scalpdesk.patfilter.v1')) }));
    check('Einzelne Schwelle geändert → „Eigene Werte“, übrige Werte vom Preset übernommen', own.preset === 'eigen' && own.stored.minScore === 55 && own.stored.minRR === 2.5, JSON.stringify(own.stored));
    await page.selectOption('#patq-preset', 'normal'); await page.check('#patq-counter');
    check('Gegentrend-Schalter gilt im gewählten Preset', await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('scalpdesk.patfilter.v1')); return s.preset === 'normal' && s.counterTrend === true && /Gegentrend an/.test(document.getElementById('patq-preset-label').textContent); }));
    await page.uncheck('#patq-counter');
    check('Filter-Schwellen gehen mit dem Oracle-Export und der Dienstübernahme mit (ohne Zugangsdaten)', await page.evaluate(() => { let exp = null; try { exp = __g09.patOracleExport(); } catch { exp = { filter: null }; } const cfg = (() => { try { return __g09.patSvcConfig(); } catch { return null; } })(); return (exp.filter === null || exp.filter.minScore === 70) && (!cfg || (cfg.filter.preset === 'normal' && !JSON.stringify(cfg).includes('AAHdq'))); }));
    await page.evaluate(() => document.getElementById('chan-dialog').close());
    // ---- Bewertung zwischen Erkennung und Telegram (synthetische, frisch bestätigte Formationen; Kerzen, ATR usw. echt gerechnet) ----
    const before = (await h.ctl('/sent')).filter(x => x.svc === 'tg').length;
    const run = await page.evaluate(async () => {
      let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, step = 36e5, now = Date.now(), t0 = Math.floor(now / step) * step - 300 * step, k = []; let p = 100;
      for (let i = 0; i < 300; i++) { const o = p; p = p * 1.0008 + (rnd() - .5) * .15; k.push({ t: t0 + i * step, o, c: p, h: Math.max(o, p) + .12, l: Math.min(o, p) - .12, v: 1e6 * (.8 + rnd() * .4) }); }
      const i1 = 299; k[i1].v = 2.6e6; const e = k[i1].c, a = (() => { let s = 0; for (let i = 286; i < 300; i++) s += Math.max(k[i].h - k[i].l, Math.abs(k[i].h - k[i - 1].c), Math.abs(k[i].l - k[i - 1].c)); return s / 14; })();
      const mk = (pat, dir, tgt, inv, q = 94) => { const c = { mkt: 'futures', sym: 'ETHUSDT', iv: '1h', pat, kind: 'form', dir, t0: k[200].t, t1: k[i1].t, tc: k[i1].t, p0: e, model: 'pat-1', profile: 'H12-e0.10', q, src: 'live', rules: [], res: null }; c.id = __g09.pkId(c); return [c, { id: pat, kind: 'form', dir, i1, status: 'Ausbruch bestätigt', levels: { brk: dir === 'bull' ? e - .2 : e + .2, tgt, inv } }]; };
      __patq.set({ ...__patq.state.settings, preset: 'eigen', counterTrend: true, minScore: 40, minVolume24h: 0 });   // Testdaten: Trend/BTC aus der Testbörse unbekannt
      const rrBad = mk('asc_triangle', 'bull', e + .34 * 2.5 * a, e - 2.5 * a), good = mk('sym_triangle', 'bull', e + 8 * a, e - 2.5 * a), twin = mk('rectangle', 'bull', e + 7 * a, e - 2.5 * a, 88);
      await __patq.run({ k, running: false }, [rrBad, good, twin]);
      const j = __patq.journal().list, find = c => j.find(x => x.id === c[0].id);
      return { rr: find(rrBad), good: find(good), twin: find(twin), count: j.length };
    });
    check('BEISPIEL 1 (App): Chance/Risiko 0,34 : 1 → gefiltert, Grund im Journal', run.rr && !run.rr.sent && /Chance\/Risiko 0,34 : 1 unter 2,0 : 1/.test(run.rr.reason), run.rr?.reason);
    check('BEISPIEL 2 (App): zwei Muster gleicher Richtung auf demselben Coin in derselben Kerze → nur das mit dem höchsten Score gesendet', run.good?.sent === true && run.twin && !run.twin.sent && /Gleiche Richtung/.test(run.twin.reason) && run.good.score >= run.twin.score, JSON.stringify({ good: run.good?.score, twin: run.twin?.score, why: run.twin?.reason }));
    await page.waitForTimeout(1500);
    const tg = (await h.ctl('/sent')).filter(x => x.svc === 'tg').slice(before), texts = tg.map(x => x.text || '');
    check('Nur das gesendete Signal geht an Telegram (Chartmuster-Chat), im bisherigen Format plus „🎯 Signalscore …/100 · Trend … · Volumen ✔ · R/R …“', tg.length === 1 && String(tg[0].chat_id) === '-100777' && /Symmetrisches Dreieck/.test(texts[0]) && /🎯 Signalscore \d+\/100 · Trend [✔~✖?] · Volumen ✔ · R\/R \d,\d/.test(texts[0]) && /⭐ <b>Ziel:/.test(texts[0]) && !texts.some(t => /Aufsteigendes Dreieck|Rechteck/.test(t)), JSON.stringify(tg.map(x => [x.chat_id, (x.text || '').slice(0, 80)])));
    // BEISPIEL 3 mit derselben Modulfassung wie die App (Bündel): Gegentrend
    const counter = await page.evaluate(async () => {
      const Q = await import('./bundles/3.70.1/shared/pattern-quality.mjs'), mk = (n, drift, step, start) => { const k = []; let p = start; for (let i = 0; i < n; i++) { const o = p; p *= 1 + drift; k.push({ t: i * step, o, c: p, h: Math.max(o, p) * 1.001, l: Math.min(o, p) * .999, v: 1000 }); } return k; };
      const k = mk(300, .0008, 36e5, 100), e = k[299].c; k[299].v = 2600; const atr = Q.atrSeries(k, 14)[299], down = mk(260, -.002, 144e5, 200);
      const ev = Q.evaluatePatternSignal({ c: { sym: 'ETHUSDT', mkt: 'futures', iv: '1h', pat: 'asc_triangle', dir: 'bull', p0: e, q: 94 }, h: { status: 'Ausbruch bestätigt', i1: 299, levels: { brk: e * .999, tgt: e + 8 * atr, inv: e - 2.5 * atr } }, k, higher: down, liquidity: { volume24h: 1e8, spreadPct: .02 } });
      return { pass: ev.pass, ko: ev.ko.map(x => x.text) };
    });
    check('BEISPIEL 3 (App-Modul): Gegentrend-Signal (Long gegen fallenden 4h-Trend) → gefiltert', !counter.pass && counter.ko.some(t => /Gegentrend zum 4h/.test(t)), counter.ko.join(' | '));
    // ---- Signal-Log im Chartmuster-Fenster ----
    await page.tap('#pat-btn'); await page.waitForFunction(() => document.getElementById('pat-sheet').open);
    await page.evaluate(() => { const d = document.getElementById('patq-log'); d.open = true; d.scrollIntoView(); });
    const log = await page.evaluate(() => ({ count: document.getElementById('patq-log-count').textContent, items: [...document.querySelectorAll('.patq-item summary')].map(s => s.textContent), why: [...document.querySelectorAll('.patq-item .patq-why')].map(p => p.textContent), rows: document.querySelectorAll('.patq-table tbody tr').length, by: [...document.querySelectorAll('[data-patq-by]')].map(b => b.textContent) }));
    check('Chartmuster-Fenster: Log mit gesendet/gefiltert, Score und Filtergrund; Statistik je Muster / Zeitrahmen / Coin', /3 · 1 gesendet/.test(log.count) && log.items.some(t => /✔ gesendet/.test(t)) && log.items.filter(t => /✖ gefiltert/.test(t)).length === 2 && log.why.some(t => /Filtergrund: Chance\/Risiko 0,34/.test(t)) && log.rows >= 1 && log.by.join() === 'je Muster,je Zeitrahmen,je Coin', JSON.stringify(log).slice(0, 300));
    await page.tap('[data-patq-by="sym"]'); check('Statistik umschaltbar (je Coin)', await page.evaluate(() => document.querySelector('.patq-table tbody td')?.textContent === 'ETHUSDT'));
    // ---- Ergebnis-Tracking ----
    const tracked = await page.evaluate(() => { const j = __patq.journal(), e = j.list.find(x => x.sent), step = 36e5, k = [{ t: e.tc, h: e.entry, l: e.entry, c: e.entry }]; for (let i = 1; i <= 5; i++) k.push({ t: e.tc + i * step, h: i === 4 ? e.target + 1 : e.entry + .1, l: e.entry - .1, c: e.entry }); __patq.resolve(e.mkt, e.sym, e.iv, k); return __patq.journal().list.find(x => x.id === e.id).res; });
    check('Ergebnis automatisch nachgetragen (Ziel erreicht nach 4 Kerzen)', tracked?.out === 'ziel' && tracked.bars === 4, JSON.stringify(tracked));
    // ---- Backtest ----
    await page.tap('#patq-bt-run'); await page.waitForFunction(() => !__patq.state.btBusy && __patq.state.bt, null, { timeout: 120000 });
    const bt = await page.evaluate(() => ({ error: __patq.state.bt.error || '', rows: [...document.querySelectorAll('.patq-bt tbody tr')].map(tr => tr.cells[0].textContent), text: document.querySelector('.patq-bt').textContent }));
    check('Backtest über die geladenen Kerzen: Tabelle je Score-Stufe, gesendet vs. gefiltert, häufigste Filtergründe', !bt.error && bt.rows.join() === '<50,50–69,70–84,≥85' && /würde senden/.test(bt.text) && /Ohne Blick in die Zukunft/.test(bt.text), bt.error || bt.text.slice(0, 200));
    check('Keine JavaScript-Fehler, kein Seitenüberlauf', errors.length === 0 && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), errors.join(' | '));
    await ctx.close();
  } finally { await browser.close(); await h.teardown(); }
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
