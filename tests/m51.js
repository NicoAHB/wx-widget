// 3.30.0 (G02) – Positionen mit Losen: Nachkauf/Short aufstocken, Teilabschluss, exaktes Ergebnis, Abgleich der Schritte.
// lots: Rechenprobe der Übergabe über die Oberfläche (Long und Short spiegelbildlich), Knopf nach G/V, Nachkauf nach Teilabschluss,
//   Rückgängig, Schluss bucht nur den Rest. fees: Gebühren genau einmal, Funding getrennt. net: Ergebnis laut Börse für diesen
//   Abschluss oder die gesamte Position. stop: gewinnsichernder Stop, Stop/Ziel unverändert, Formular mit Losen gesperrt.
//   idem: Doppeltipp, Neuladen, erneutes Einspielen; Liq.-Preis prüfen. sync: zwei Geräte – Schritte vereinigt, Konflikt mit
//   Erhalt aller Schritte, „dort geschlossen, hier nachgekauft“. old: Alt-Position ohne Verlauf, CSV. demo: Teilabschluss in der
//   Demo-Historie. late: nachträglich erfasster Abschluss.
//   svc: 24/7-Übergabe (Menge, Ø-Einstieg, Stop/Ziel) und Chart-Einstiegslinie nach Nachkauf und Teilabschluss.
//   heal: fehlender Teilabschluss-Trade beim Start ergänzt, gelöschter nicht.
// Aufruf: node m51.js [lots|fees|net|stop|idem|sync|old|demo|late|heal|svc]
const h = require('./harness'), fs = require('fs'), path = require('path'), os = require('os');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + String(detail).slice(0, 400) : ''}`); };
const real = errs => errs.filter(e => !/Service Worker registration blocked/.test(e));
const until = async (fn, ms = 20000, step = 200) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await h.sleep(step); } };
async function openPage(browser, seed = {}, { ctx = null, viewport = { width: 1500, height: 1000 } } = {}) {
  ctx = ctx || await browser.newContext({ viewport, acceptDownloads: true, timezoneId: 'Europe/Berlin' });
  if (!ctx.seeded) { ctx.seeded = true; await ctx.addInitScript(items => { if (localStorage.getItem('seeded51')) return; localStorage.setItem('seeded51', '1'); for (const [k, v] of items) localStorage.setItem(k, JSON.stringify(v)); }, Object.entries(seed)); }
  const page = await ctx.newPage(), errors = []; h.collect(page, errors);
  page.on('dialog', d => void d.accept());
  await page.goto(`${h.URL_BASE}/weather-widget-v2.html`);
  await page.waitForFunction(() => document.getElementById('price').textContent.trim() !== '—', null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  return { ctx, page, errors };
}
const ls = (page, k) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), k);
const jsClick = (page, sel) => page.evaluate(sel => { const e = document.querySelector(sel); if (!e) throw new Error('fehlt: ' + sel); e.click(); }, sel);
const txt = (page, sel) => page.evaluate(sel => document.querySelector(sel)?.textContent ?? null, sel);
const C = id => `.pos-card[data-id="${id}"]`;
const setIn = (page, id, key, v) => page.evaluate(([sel, key, v]) => { const i = document.querySelector(`${sel} [data-input="${key}"]`); if (!i) throw new Error('fehlt ' + key); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, [C(id), key, v]);
const posOf = async (page, id, key = 'scalpdesk.positions.v1') => ((await ls(page, key)) || []).find(p => p.id === id) || null;
const tradesOf = async (page, root, key = 'scalpdesk.history.v1') => ((await ls(page, key)) || []).filter(t => t.id === root || t.id.startsWith(root + '~')).sort((a, b) => a.closedAt - b.closedAt);
async function add(page, id, q, p, more = {}) {
  await jsClick(page, `${C(id)} [data-action="add"]`); await page.waitForTimeout(120);
  await setIn(page, id, 'aqty', q); await setIn(page, id, 'aprice', p); for (const [k, v] of Object.entries(more)) await setIn(page, id, k, v);
  const pv = await txt(page, `${C(id)} [data-f="add-preview"]`); await jsClick(page, `${C(id)} [data-action="save-add"]`); await page.waitForTimeout(250); return pv;
}
async function close(page, id, f, { save = true } = {}) {
  await jsClick(page, `${C(id)} [data-action="realize"]`); await page.waitForTimeout(120);
  for (const [k, v] of Object.entries(f)) await setIn(page, id, k, v);
  const pv = await txt(page, `${C(id)} [data-f="realize-preview"]`), sb = await txt(page, `${C(id)} [data-action="save-realize"]`);
  if (save) { await jsClick(page, `${C(id)} [data-action="save-realize"]`); await page.waitForTimeout(300); }
  return { pv, sb };
}
const T = Date.now() - 6 * 3600e3;
const position = (id, sym, entry, qty, extra = {}) => ({ id, symbol: sym, side: 'long', mode: 'isolated', entry, leverage: 10, qty, margin: entry * qty / 10, openedAt: T, source: 'spot', liqExchange: null, preRealized: 0, sl: null, tp: null, ack: { sl: false, tp: false }, ...extra });
const openData = page => page.evaluate(() => { if (document.getElementById('data-panel').hidden) document.getElementById('data-toggle').click(); });
async function exportCode(page) {
  await openData(page); await jsClick(page, '#code-export'); await page.waitForTimeout(150);
  await page.fill('#code-pass', ''); await jsClick(page, '#code-make');
  await until(() => page.evaluate(() => !document.getElementById('code-out').hidden && document.getElementById('code-text').value.length > 10), 15000);
  const code = await page.evaluate(() => document.getElementById('code-text').value); await jsClick(page, '#code-close'); return code;
}
async function importCode(page, code) {
  await openData(page); await jsClick(page, '#code-import'); await page.waitForTimeout(150);
  await page.fill('#code-in', code); await jsClick(page, '#code-check');
  await until(() => page.evaluate(() => !document.getElementById('code-preview').hidden || !document.getElementById('code-error').hidden || /Nichts Neues|Übernommen/.test(document.getElementById('code-status').textContent)), 15000);
  return page.evaluate(() => { const b = document.getElementById('code-preview'); return { shown: !b.hidden, items: [...b.querySelectorAll('.sp-list > li')].map(li => li.innerText.replace(/\s*\n\s*/g, ' ⏎ ')), status: document.getElementById('code-status').textContent }; });
}
async function takeCode(page) {
  await jsClick(page, '#code-preview .sp-actions .button.primary-lite'); await until(() => page.evaluate(() => document.getElementById('code-preview').hidden), 8000); await page.waitForTimeout(250);
  const s = await txt(page, '#code-status'); if (await page.evaluate(() => document.getElementById('code-dialog').open)) await jsClick(page, '#code-close'); return s;
}
const confState = page => page.evaluate(() => ({ open: document.getElementById('conf-dialog').open, what: document.getElementById('conf-what').textContent, note: document.getElementById('conf-note').textContent }));
const evIds = p => (p?.ev || []).map(e => e.id).sort().join(',');

const tests = {
  // ================= Rechenprobe über die Oberfläche =================
  async lots(browser) {
    await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=SOLUSDT&price=150');
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.positions.v1': [position('L1', 'SOLUSDT', 100, 2), position('S1', 'SOLUSDT', 100, 2, { side: 'short' })] });
    await page.waitForTimeout(800);
    const lab = async id => ({ close: await txt(page, `${C(id)} [data-action="realize"]`), add: await txt(page, `${C(id)} [data-action="add"]`) });
    let l = await lab('L1'), s = await lab('S1');
    check('Knöpfe: Long im Gewinn „Gewinn realisieren“ + „Nachkaufen“, Short im Verlust „Verlust realisieren“ + „Short aufstocken“', l.close === 'Gewinn realisieren' && l.add === 'Nachkaufen' && s.close === 'Verlust realisieren' && s.add === 'Short aufstocken', JSON.stringify([l, s]));
    const buttonColors = () => page.evaluate(() => ['L1', 'S1'].map(id => {
      const b = document.querySelector(`.pos-card[data-id="${id}"] [data-action="realize"]`), css = getComputedStyle(b);
      return { text: b.textContent, green: b.classList.contains('primary-lite'), red: b.classList.contains('danger-btn'), bg: css.backgroundColor, color: css.color };
    }));
    let colors = await buttonColors();
    check('Schließen-Button: Gewinn grün, Verlust rot, unterschiedliche Hintergründe und Texte', colors[0].green && !colors[0].red && colors[1].red && !colors[1].green && colors[0].bg !== colors[1].bg && colors[0].color !== colors[1].color, JSON.stringify(colors));
    await page.evaluate(() => { document.querySelector('[data-theme-set="light"]').click(); });
    colors = await buttonColors();
    check('Grün/Rot auch im hellen Farbschema', colors[0].bg !== colors[1].bg && colors[0].color !== colors[1].color, JSON.stringify(colors));
    await h.ctl('/set?symbol=SOLUSDT&price=99');
    await until(async () => (await lab('L1')).close === 'Verlust realisieren', 10000);
    colors = await buttonColors();
    check('Live-Kurswechsel tauscht Text und Farbe ohne Neubau der Position', colors[0].red && !colors[0].green && colors[1].green && !colors[1].red && colors[1].text === 'Gewinn realisieren', JSON.stringify(colors));
    await h.ctl('/set?symbol=SOLUSDT&price=150');
    await until(async () => (await lab('L1')).close === 'Gewinn realisieren', 10000);
    const pv = await add(page, 'L1', '1', '130');
    let p = await posOf(page, 'L1');
    check('Rechenprobe: 2 zu 100 + 1 zu 130 = 3 zu Ø 110 (Vorschau nennt es vorher)', p.qty === 3 && p.entry === 110 && /^Neu: 3 SOL zu Ø 110,00 \(vorher 2 zu Ø 100,00\)/.test(pv), `${p.qty} zu ${p.entry} · ${pv}`);
    check('Karte: „Ø Einstieg“ 110, Margin 33 (Q·E/Hebel), Verlauf mit 2 Losen', /Ø Einstieg/.test(await txt(page, `${C('L1')} .pos-grid`)) && Math.abs(p.margin - 33) < 1e-9 && /2 Lose/.test(await txt(page, `${C('L1')} .lot-hist summary`)));
    const steps = await page.evaluate(sel => [...document.querySelectorAll(`${sel} .lot-list li`)].map(li => li.textContent), C('L1'));
    check('Verlauf: „Eröffnung … 2 SOL zu 100,00“, dann „Nachkauf … 1 SOL zu 130,00“', steps.length === 2 && /^Eröffnung .* · 2 SOL zu 100,00$/.test(steps[0]) && /^Nachkauf .* · 1 SOL zu 130,00$/.test(steps[1]), steps.join(' ## '));
    let r = await close(page, 'L1', { qty: '1', exit: '120' });
    p = await posOf(page, 'L1'); let tr = await tradesOf(page, 'L1');
    check('Teilabschluss 1 zu 120: +10 brutto als eigener Trade, Rest 2 zu Ø 110', tr.length === 1 && tr[0].pnl === 10 && tr[0].qty === 1 && tr[0].entry === 110 && tr[0].part?.n === 1 && p.qty === 2 && p.entry === 110, JSON.stringify([tr.map(t => [t.id, t.pnl]), p.qty, p.entry]));
    check('Vorschau des Teilabschlusses: Menge, Preis, Rest, Ergebnis; Knopf „Teilabschluss speichern“', /^Long · schließt 1 von 3 SOL zu 120,00 · bleibt 2 SOL zu Ø 110,00\. Ergebnis des Teilabschlusses: \+10,00 USDT/.test(r.pv) && r.sb === 'Teilabschluss speichern', `${r.pv} | ${r.sb}`);
    await add(page, 'L1', '1', '80'); p = await posOf(page, 'L1');
    check('Weitere Einheit zu 80: 3 zu Ø 100', p.qty === 3 && p.entry === 100, `${p.qty} zu ${p.entry}`);
    const sub = (await txt(page, `${C('L1')} [data-f="pnl-sub"]`)).replace(/\n/g, ' ⏎ ');
    check('Realisierte +10 nicht im offenen G/V: offen +150 (3 × (150 − 100)), schon realisiert +10, Position gesamt +160', (await txt(page, `${C('L1')} [data-f="pnl"]`)) === '+150,00 USDT' && /schon realisiert \+10,00 ⏎ Position gesamt \+160,00 USDT/.test(sub), sub);
    // Short spiegelbildlich
    await add(page, 'S1', '1', '130'); r = await close(page, 'S1', { qty: '1', exit: '100' });
    const ps = await posOf(page, 'S1'), ts = await tradesOf(page, 'S1');
    check('Short: aufgestockt 1 zu 130 → 3 zu Ø 110; Rückkauf 1 zu 100 = +10 brutto; 2 zu Ø 110 bleiben', ts.length === 1 && ts[0].pnl === 10 && ps.qty === 2 && ps.entry === 110, JSON.stringify([ts.map(t => t.pnl), ps.qty, ps.entry]));
    // Knopf bei genau 0 und ohne Kurs
    await h.ctl('/set?symbol=SOLUSDT&price=100'); await until(async () => (await txt(page, `${C('L1')} [data-f="pnl"]`)) === '0,00 USDT', 10000);
    l = await lab('L1');
    check('Kurs genau beim Ø-Einstieg (G/V exakt 0): „Position schließen“', l.close === 'Position schließen', l.close);
    colors = await buttonColors();
    check('Genau null ist neutral: kein roter oder grüner Gewinn-/Verlust-Button', !colors[0].green && !colors[0].red, JSON.stringify(colors[0]));
    // Rückgängig: der Nachkauf zu 80
    await page.evaluate(id => { document.querySelector(`.pos-card[data-id="${id}"] .lot-hist`).open = true; }, 'L1');
    await jsClick(page, `${C('L1')} [data-action="undo"]`); await page.waitForTimeout(120);
    const q = await txt(page, `${C('L1')} .pos-sub p`); await jsClick(page, `${C('L1')} [data-action="undo-confirm"]`); await page.waitForTimeout(250); p = await posOf(page, 'L1');
    check('„Letzten Schritt rückgängig machen“: Nachkauf zu 80 zurückgenommen (vermerkt), wieder 2 zu Ø 110', /^Letzten Schritt zurücknehmen\? Nachkauf .* 1 SOL zu 80,00/.test(q) && p.qty === 2 && p.entry === 110 && p.evDel?.length === 1, `${q} · ${p.qty} zu ${p.entry}`);
    // Schluss: bucht nur noch den Rest
    r = await close(page, 'L1', { exit: '125', fees: '0,3' });
    tr = await tradesOf(page, 'L1'); const fin = tr.find(t => t.id === 'L1');
    check('Schluss 2 zu 125 mit Gebühr 0,3: gebucht nur dieser Teil (+29,70), Position gesamt +39,70, Teilabschluss bleibt', !(await posOf(page, 'L1')) && fin?.pnl === 29.7 && fin.qty === 2 && fin.posPnl === 39.7 && fin.part?.final && tr.length === 2 && /Position gesamt: \+39,70 USDT aus 2 Abschlüssen/.test(r.pv), `${JSON.stringify(tr.map(t => [t.id.length > 3 ? 'teil' : 'schluss', t.pnl, t.posPnl]))} · ${r.pv}`);
    check('Summe der Buchungen = Position gesamt (10 + 29,70), nichts doppelt', Math.abs(tr.reduce((a, t) => a + t.pnl, 0) - 39.7) < 1e-9);
    await page.evaluate(() => { document.getElementById('history').open = true; }); await page.waitForTimeout(200);
    const rows = await page.evaluate(() => [...document.querySelectorAll('#history-list .trade-row')].map(r => r.textContent));
    check('Trade-Liste: „Teilabschluss 1“ und „Schluss nach 1 Teilabschluss · Position gesamt +39,70 USDT“', rows.some(t => /Teilabschluss 1/.test(t)) && rows.some(t => /Schluss nach 1 Teilabschluss · Position gesamt \+39,70 USDT/.test(t)), rows.join(' ## ').slice(0, 300));
    check('keine Fehler (Lose)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },

  // ================= Gebühren genau einmal, Funding getrennt =================
  async fees(browser) {
    await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=ETHUSDT&price=2200');
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.positions.v1': [position('F1', 'ETHUSDT', 2000, 1)] });
    await add(page, 'F1', '1', '2200', { afees: '1' });
    await close(page, 'F1', { qty: '1', exit: '2300', fees: '0,4' });
    let tr = await tradesOf(page, 'F1');
    check('Teilabschluss: Brutto +200 − Gebühren 1,4 (Einstieg 1 + eigene 0,4) = +198,60', tr[0]?.pnl === 198.6 && tr[0].fees === 1.4, JSON.stringify(tr.map(t => [t.pnl, t.fees])));
    const r = await close(page, 'F1', { exit: '2050', fees: '0,6', fund: '-0,25' });
    tr = await tradesOf(page, 'F1'); const fin = tr.find(t => t.id === 'F1');
    check('Schluss: −50 − 0,6 Gebühr − 0,25 Funding = −50,85; Einstiegsgebühr nicht noch einmal', fin?.pnl === -50.85 && fin.fees === 0.6 && fin.funding === -0.25 && /Funding 0,2500/.test(r.pv), `${JSON.stringify([fin?.pnl, fin?.fees, fin?.funding])} · ${r.pv}`);
    check('Alle eingegebenen Gebühren genau einmal gebucht (1 + 0,4 + 0,6 = 2,0)', Math.abs(tr.reduce((a, t) => a + t.fees, 0) - 2) < 1e-9);
    check('keine Fehler (Gebühren)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },

  // ================= Ergebnis laut Börse =================
  async net(browser) {
    await h.ctl('/walk?on=0');
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.positions.v1': [position('N1', 'BTCUSDT', 60000, 2), position('N2', 'BTCUSDT', 60000, 2)] });
    await close(page, 'N1', { qty: '1', exit: '61000' });
    let r = await close(page, 'N1', { override: '2500', scope: 'pos' }, { save: false });
    check('Gesamtergebnis der Position laut Börse: Vorschau nennt die Differenz zu den schon gebuchten +1.000', /Position gesamt laut Börse \+2\.500,00 USDT; gebucht wird \+1\.500,00 USDT \(bisher gebucht \+1\.000,00\)/.test(r.pv), r.pv);
    await jsClick(page, `${C('N1')} [data-action="save-realize"]`); await page.waitForTimeout(300);
    let tr = await tradesOf(page, 'N1'), fin = tr.find(t => t.id === 'N1');
    check('Schluss bucht +1.500 (laut Börse), Summe = 2.500 – das Gesamtergebnis zählt nicht doppelt', fin?.pnl === 1500 && fin.pnlSource === 'exchange' && Math.abs(tr.reduce((a, t) => a + t.pnl, 0) - 2500) < 1e-9, JSON.stringify(tr.map(t => [t.pnl, t.pnlSource])));
    r = await close(page, 'N2', { qty: '1', override: '-12,5' });
    tr = await tradesOf(page, 'N2');
    check('Teilabschluss nur mit Ergebnis laut Börse (−12,50): genau dieser Betrag, Rest bleibt offen', tr.length === 1 && tr[0].pnl === -12.5 && tr[0].pnlSource === 'exchange' && (await posOf(page, 'N2')).qty === 1, JSON.stringify(tr.map(t => [t.pnl, t.pnlSource])));
    r = await close(page, 'N2', { qty: '0,5', override: '100', scope: 'pos' }, { save: false });
    check('Ergebnis laut Börse „gesamte Position“ nur beim Schließen der ganzen Restmenge (0,5 von 1 → Hinweis, nichts gespeichert)', /gilt nur beim Schließen der ganzen Restmenge/.test(r.pv) && (await tradesOf(page, 'N2')).length === 1, r.pv);
    await jsClick(page, `${C('N2')} [data-action="cancel"]`);
    check('keine Fehler (Börse)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },

  // ================= Gewinnsichernder Stop, Formular mit Losen =================
  async stop(browser) {
    await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=SOLUSDT&price=150');
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.positions.v1': [position('G1', 'SOLUSDT', 100, 1, { sl: 90, tp: 200 })] });
    await page.waitForTimeout(800);
    const edit = async (fill) => { await jsClick(page, `${C('G1')} [data-action="edit"]`); await page.waitForTimeout(200); for (const [id, v] of Object.entries(fill)) await page.evaluate(([id, v]) => { const i = document.getElementById(id); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, [id, v]); };
    await edit({ 'pos-sl': '160' }); await jsClick(page, '#pos-save'); await page.waitForTimeout(400);
    const err = await page.evaluate(() => { const e = document.getElementById('pos-form-error'); return e && !e.hidden ? e.textContent : document.getElementById('pos-preview').textContent; });
    check('Stop über dem aktuellen Kurs (160 > 150): abgelehnt, „würde sofort auslösen“', /über dem aktuellen Kurs .* würde sofort auslösen/.test(err) && (await posOf(page, 'G1')).sl === 90, err);
    await page.evaluate(() => { const i = document.getElementById('pos-sl'); i.value = '120'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await jsClick(page, '#pos-save'); await page.waitForTimeout(500);
    check('Gewinnsichernder Stop 120 (über dem Einstieg 100, unter dem Kurs 150): gespeichert', (await posOf(page, 'G1')).sl === 120);
    await add(page, 'G1', '1', '140'); await close(page, 'G1', { qty: '0,5', exit: '150' });
    let p = await posOf(page, 'G1');
    check('Nachkauf und Teilabschluss verschieben Stop und Ziel nicht (120 / 200)', p.sl === 120 && p.tp === 200 && p.qty === 1.5, JSON.stringify([p.sl, p.tp, p.qty]));
    await jsClick(page, `${C('G1')} [data-action="edit"]`); await page.waitForTimeout(200);
    const f = await page.evaluate(() => ({ qty: document.getElementById('pos-qty').disabled, entry: document.getElementById('pos-entry').disabled, sym: document.getElementById('pos-symbol').disabled, hint: document.getElementById('pos-lot-hint').hidden ? '' : document.getElementById('pos-lot-hint').textContent }));
    check('Bearbeiten einer Position mit Losen: Menge, Einstieg und Kürzel gesperrt, Hinweis sichtbar', f.qty && f.entry && f.sym && /ergeben sich aus den Losen/.test(f.hint), JSON.stringify(f));
    await page.evaluate(() => { const i = document.getElementById('pos-note'); i.value = 'geändert'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await jsClick(page, '#pos-save'); await page.waitForTimeout(500);
    const p2 = await posOf(page, 'G1');
    check('Speichern behält den Verlauf, Menge und Ø-Einstieg (Notiz geändert)', p2.note === 'geändert' && evIds(p2) === evIds(p) && p2.qty === p.qty && p2.entry === p.entry, JSON.stringify([p2.note, p2.qty, p2.entry]));
    await jsClick(page, `${C('G1')} [data-action="edit"]`); await page.waitForTimeout(200); await jsClick(page, '[data-pos-real="demo"]'); await jsClick(page, '#pos-save'); await page.waitForTimeout(400);
    const e2 = await page.evaluate(() => document.getElementById('pos-form-error')?.textContent || '');
    check('Mit gebuchtem Teilabschluss kein Wechsel ECHT → DEMO (Hinweis), Position bleibt echt', /Teilabschlüsse – ECHT\/DEMO lässt sich nicht mehr wechseln/.test(e2) && !!(await posOf(page, 'G1')), e2);
    check('keine Fehler (Stop)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },

  // ================= Doppeltipp, Neuladen, erneutes Einspielen, Liq.-Preis =================
  async idem(browser) {
    await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=ETHUSDT&price=2100');
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.positions.v1': [position('I1', 'ETHUSDT', 2000, 3), position('I2', 'ETHUSDT', 2000, 1, { liqExchange: 1500 })] });
    await close(page, 'I1', { qty: '1', exit: '2100' }, { save: false });
    await page.evaluate(sel => { const b = document.querySelector(sel); b.click(); b.click(); }, `${C('I1')} [data-action="save-realize"]`); await page.waitForTimeout(400);
    let tr = await tradesOf(page, 'I1'), p = await posOf(page, 'I1');
    check('Doppeltipp auf „Teilabschluss speichern“: ein Teilabschluss, Rest 2', tr.length === 1 && p.qty === 2 && p.ev.filter(e => e.t === 's').length === 1, `${tr.length} · ${p.qty}`);
    await page.reload(); await page.waitForTimeout(1500); tr = await tradesOf(page, 'I1'); p = await posOf(page, 'I1');
    check('Nach dem Neuladen: weiter genau ein Teilabschluss, Rest 2', tr.length === 1 && p.qty === 2);
    const code = await exportCode(page), r = await importCode(page, code);
    check('Eigene Sicherung noch einmal eingespielt: „Nichts Neues“, kein zweiter Abschluss', !r.shown && /Nichts Neues/.test(r.status) && (await tradesOf(page, 'I1')).length === 1, r.status);
    if (await page.evaluate(() => document.getElementById('code-dialog').open)) await jsClick(page, '#code-close');
    await add(page, 'I2', '1', '2100');
    const warn = await page.evaluate(sel => document.querySelector(`${sel} .lot-liq`)?.textContent || '', C('I2'));
    check('Nach dem Nachkauf: „Liq.-Preis laut Börse … prüfen“ mit „Stimmt noch“', /Liq\.-Preis laut Börse nach Nachkauf oder Teilabschluss prüfen/.test(warn) && (await posOf(page, 'I2')).liqCheck === true, warn);
    await jsClick(page, `${C('I2')} [data-action="liq-ok"]`); await page.waitForTimeout(250);
    check('„Stimmt noch“: Hinweis weg, Liq.-Preis unverändert', !(await page.evaluate(sel => !!document.querySelector(`${sel} .lot-liq`), C('I2'))) && !(await posOf(page, 'I2')).liqCheck && (await posOf(page, 'I2')).liqExchange === 1500);
    check('keine Fehler (Doppeltipp)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },

  // ================= Zwei Geräte =================
  async sync(browser) {
    await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=SOLUSDT&price=150');
    const A = await openPage(browser, { 'scalpdesk.positions.v1': [position('Y1', 'SOLUSDT', 100, 2), position('Z1', 'SOLUSDT', 100, 2, { sl: 90 }), position('W1', 'SOLUSDT', 100, 2)] });
    const B = await openPage(browser, {});
    let r = await importCode(B.page, await exportCode(A.page)); await takeCode(B.page);
    check('Grundlage auf beiden Geräten', (await posOf(B.page, 'Y1'))?.qty === 2 && (await posOf(B.page, 'Z1'))?.qty === 2);
    // offline: A schließt teilweise, B kauft nach
    await close(A.page, 'Y1', { qty: '1', exit: '120' }); await add(B.page, 'Y1', '1', '130');
    r = await importCode(B.page, await exportCode(A.page));
    check('B spielt A ein: „Zusammengeführt: 1 Position – Nachkäufe und Abschlüsse beider Geräte vereint“ und der Teilabschluss als neuer Trade', r.shown && r.items.some(i => /^Zusammengeführt: 1 Position – Nachkäufe und Abschlüsse beider Geräte vereint/.test(i)) && r.items.some(i => /^Neu: 1 Trade/.test(i)), r.items.join(' ## '));
    await takeCode(B.page);
    const yb = await posOf(B.page, 'Y1');
    check('B: beide Schritte vereint (Teilabschluss vor dem Nachkauf) → 2 zu Ø 115, Teilabschluss +20 wie auf A', yb.qty === 2 && yb.entry === 115 && (await tradesOf(B.page, 'Y1')).map(t => t.pnl).join() === '20', JSON.stringify([yb.qty, yb.entry, (await tradesOf(B.page, 'Y1')).map(t => t.pnl)]));
    r = await importCode(A.page, await exportCode(B.page)); if (r.shown) await takeCode(A.page); else if (await A.page.evaluate(() => document.getElementById('code-dialog').open)) await jsClick(A.page, '#code-close');
    const ya = await posOf(A.page, 'Y1');
    check('A übernimmt den vereinten Stand ohne Rückfrage – beide Geräte gleich (Menge, Ø, Schritte, Trades)', ya.qty === 2 && ya.entry === 115 && evIds(ya) === evIds(yb) && (await tradesOf(A.page, 'Y1')).length === 1 && !((await ls(A.page, 'scalpdesk.conflicts.v1')) || []).length, JSON.stringify([ya.qty, ya.entry]));
    // Konflikt: A ändert den Stop, B schließt teilweise → bei jeder Wahl bleiben alle Schritte
    await A.page.evaluate(() => {}); await jsClick(A.page, `${C('Z1')} [data-action="edit"]`); await A.page.waitForTimeout(200);
    await A.page.evaluate(() => { const i = document.getElementById('pos-sl'); i.value = '95'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await jsClick(A.page, '#pos-save'); await A.page.waitForTimeout(500);
    await close(B.page, 'Z1', { qty: '0,5', exit: '140' });
    r = await importCode(B.page, await exportCode(A.page)); await takeCode(B.page);
    const cs = await until(async () => { const c = await confState(B.page); return c.open ? c : null; }, 5000) || await confState(B.page);
    check('Stop auf A, Teilabschluss auf B: Konflikt mit Hinweis „Nachkäufe und Abschlüsse beider Fassungen bleiben bei jeder Wahl erhalten“', cs.open && /Nachkäufe und Abschlüsse beider Fassungen bleiben bei jeder Wahl erhalten/.test(cs.note), JSON.stringify(cs));
    await jsClick(B.page, '#conf-take'); await B.page.waitForTimeout(400);
    const zb = await posOf(B.page, 'Z1');
    check('„Entwurf übernehmen“: Stop 95 von A, der Teilabschluss von B bleibt (Rest 1,5)', zb.sl === 95 && zb.qty === 1.5 && (await tradesOf(B.page, 'Z1')).length === 1, JSON.stringify([zb.sl, zb.qty]));
    if (await B.page.evaluate(() => document.getElementById('conf-dialog').open)) await jsClick(B.page, '#conf-close');
    // dort geschlossen, hier nachgekauft
    await close(A.page, 'W1', { exit: '110' }); await add(B.page, 'W1', '1', '105');
    r = await importCode(B.page, await exportCode(A.page));
    check('A schließt W1, B kauft nach: Vorschau „Konflikte … dort geschlossen, hier weiter geändert“', r.items.some(i => /⚖ Konflikte/.test(i) && /dort geschlossen, hier weiter geändert/.test(i)), r.items.join(' ## '));
    await takeCode(B.page);
    await until(async () => (await confState(B.page)).open, 5000);
    const c2 = await confState(B.page);
    check('Dialog: „auf dem anderen Gerät geschlossen, hier danach weiter geändert“', /auf dem anderen Gerät geschlossen, hier danach weiter geändert/.test(c2.what), c2.what);
    await jsClick(B.page, '#conf-keep'); await B.page.waitForTimeout(400);
    if (await B.page.evaluate(() => document.getElementById('conf-dialog').open)) await jsClick(B.page, '#conf-close');
    check('„Bestätigten Stand behalten“: W1 bleibt offen (3 SOL), kein Schluss-Trade', (await posOf(B.page, 'W1'))?.qty === 3 && !(await tradesOf(B.page, 'W1')).length);
    r = await importCode(B.page, await exportCode(A.page));
    check('Dieselbe Sicherung noch einmal: keine neue Rückfrage zu W1', !r.items.some(i => /dort geschlossen/.test(i)), r.items.join(' ## ') || r.status);
    if (r.shown) await jsClick(B.page, '#code-preview .sp-actions .button.ghost');
    if (await B.page.evaluate(() => document.getElementById('code-dialog').open)) await jsClick(B.page, '#code-close');
    check('keine Fehler (zwei Geräte)', ![...real(A.errors), ...real(B.errors)].length, [...real(A.errors), ...real(B.errors)].join(' | '));
    await A.ctx.close(); await B.ctx.close();
  },

  // ================= Alt-Position, CSV =================
  async old(browser) {
    await h.ctl('/walk?on=0');
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.positions.v1': [position('O1', 'ETHUSDT', 2000, 0.5)] });
    await close(page, 'O1', { exit: '2100', fees: '0,2' });
    const t = (await ls(page, 'scalpdesk.history.v1')).find(x => x.id === 'O1');
    check('Alte Position ohne Nachkauf ganz geschlossen: Trade wie bisher (ohne Verlauf, ohne Teil-Angaben), 0,5 × 100 − 0,2 = 49,8', t && !('ev' in t) && !('part' in t) && t.pnl === 49.8 && t.qty === 0.5, JSON.stringify(t && { ev: 'ev' in t, part: 'part' in t, pnl: t.pnl }));
    await openData(page);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => document.getElementById('export-csv').click())]);
    const csv = fs.readFileSync(await dl.path(), 'utf8').replace(/^﻿/, '').trim().split('\r\n');
    // 3.31.0 (G03): dahinter die Euro-Spalten „EUR-Status“, „EUR-Kurs Quelle“, „EUR-Kurszeit“
    check('CSV: Spalten „Gebühren USDT“, „Funding USDT“, „Abschluss“ (ganz)', /Gebühren USDT/.test(csv[0]) && /Funding USDT;Abschluss;EUR-Status;EUR-Kurs Quelle;EUR-Kurszeit$/.test(csv[0]) && /;ganz;[^;]*;[^;]*;[^;]*$/.test(csv[1]), csv[0].slice(-80) + ' | ' + csv[1].slice(-40));
    check('keine Fehler (Alt)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
    // Ungültige Zusatzangaben aus Teilabschlüssen (z. B. von Hand verändert): ohne diesen Wert geladen, Original in „invalid“
    const tr = (id, extra) => ({ ...position(id, 'ETHUSDT', 2000, 1), exit: 2100, fees: 0, pnl: 100, pnlSource: 'calc', closedAt: Date.now() - 3600e3, fx: null, ...extra });
    const g = await openPage(browser, { 'scalpdesk.history.v1': [tr('X1', { funding: 'x', part: { pos: 5 } }), tr('X2~s1', { funding: -0.25, part: { pos: 'X2', sell: 's1', n: 1, rest: 1 } })] });
    // Geladen wird ohne die ungültigen Werte (im Speicher bleibt das Original bis zum nächsten Speichern, danach in „invalid“)
    const ban = await g.page.evaluate(() => ({ hidden: document.getElementById('integrity-banner').hidden, text: document.getElementById('integrity-text').textContent }));
    await openData(g.page); await g.page.waitForTimeout(200);
    const ql = await g.page.evaluate(() => [...document.querySelectorAll('#quar-list .quar-item')].map(li => li.innerText.replace(/\s*\n\s*/g, ' | ')));
    await g.page.evaluate(() => { document.getElementById('history').open = true; }); await g.page.waitForTimeout(300);
    const rows = await g.page.evaluate(() => [...document.querySelectorAll('#history-list .trade-row')].map(r => ({ id: r.dataset.trade, text: r.textContent })));
    const r1 = rows.find(r => r.id === 'X1'), r2 = rows.find(r => r.id === 'X2~s1');
    check('Ungültiges Funding und ungültige Teilabschluss-Angabe: Trade bleibt, ohne diese Werte; Prüfliste nennt beide Originale; Hinweis „2 Werte ungültig“',
      r1 && !/Funding|Teilabschluss|undefined|NaN/.test(r1.text) && ql.some(t => /Funding: Originalwert „x“ ungültig/.test(t)) && ql.some(t => /Teilabschluss: Originalwert/.test(t)) && !ban.hidden && /2 Werte ungültig/.test(ban.text),
      `${r1?.text.slice(0, 160)} · ${ql.join(' ## ').slice(0, 300)} · ${ban.text}`);
    check('Gültige Angaben bleiben unverändert (Zeile mit „Teilabschluss 1“ und „Funding −0,25“)', r2 && /Teilabschluss 1/.test(r2.text) && /Funding [−-]0,25/.test(r2.text), r2?.text.slice(0, 200));
    check('keine Fehler (Alt, ungültige Angaben)', !real(g.errors).length, real(g.errors).join(' | ')); await g.ctx.close();
  },

  // ================= Demo =================
  async demo(browser) {
    await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=SOLUSDT&price=150');
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.demopositions.v1': [position('D1', 'SOLUSDT', 100, 2)] });
    await close(page, 'D1', { qty: '1', exit: '140' });
    const dt = await tradesOf(page, 'D1', 'scalpdesk.demohistory.v1'), rt = await ls(page, 'scalpdesk.history.v1');
    check('Demo-Teilabschluss: in der Demo-Historie (+40), nicht bei den echten Trades', dt.length === 1 && dt[0].pnl === 40 && !(rt || []).length && (await posOf(page, 'D1', 'scalpdesk.demopositions.v1')).qty === 1);
    check('keine Fehler (Demo)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },

  // ================= Nachträglich erfasst =================
  async late(browser) {
    await h.ctl('/walk?on=0');
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.positions.v1': [position('H1', 'ETHUSDT', 2000, 2, { openedAt: Date.now() - 3 * 864e5 })] });
    const d = new Date(Date.now() - 2 * 864e5), when = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T10:00`;
    const r = await close(page, 'H1', { qty: '1', exit: '2050', when });
    const t = (await tradesOf(page, 'H1'))[0];
    check('Abschluss vor zwei Tagen nachgetragen: Vorschau „Nachträglich erfasst – wird nicht als neuer Abschluss gemeldet“, Trade mit dieser Zeit und „nachgetragen“', /Nachträglich erfasst – wird nicht als neuer Abschluss gemeldet/.test(r.pv) && t?.part?.late === true && t.closedAt === await page.evaluate(w => new Date(w).getTime(), when) && (t.fx === null || t.fxSrc === 'm1'), `${r.pv} · ${JSON.stringify([t?.part, t?.closedAt, t?.fx, t?.fxSrc])}`); // Zeit in der Zeitzone des Browsers; 3.31.0 (G03): Euro-Kurs aus der Binance-Minute davor statt „unbekannt“ (nie der heutige Kurs)
    const r2 = await close(page, 'H1', { qty: '1', exit: '2050', when: '2020-01-01T10:00' }, { save: false });
    check('Zeitpunkt vor der Eröffnung: abgelehnt', /vor der Eröffnung/.test(r2.pv), r2.pv);
    await jsClick(page, `${C('H1')} [data-action="cancel"]`);
    check('keine Fehler (nachgetragen)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },

  // ================= Start: fehlender Teilabschluss-Trade wird ergänzt, gelöschter nicht =================
  async heal(browser) {
    await h.ctl('/walk?on=0');
    const ev = [{ id: 'm0', t: 'b', at: T, q: '200000000', p: '100', f: '0', mig: true }, { id: 's1', t: 's', at: T + 60e3, k: '100000000', x: '120', f: '0', scope: 'part', fx: null, note: '', rs: [], lev: 10, md: 'isolated' }];
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.positions.v1': [position('HP', 'ETHUSDT', 100, 1, { ev }), position('HQ', 'ETHUSDT', 100, 1, { ev })], 'scalpdesk.deleted.v1': { 'pt:HQ~s1': Date.now() - 60e3 } });
    await page.waitForTimeout(500);
    const H = (await ls(page, 'scalpdesk.history.v1')) || [], hp = H.find(t => t.id === 'HP~s1');
    check('Teilabschluss im Verlauf, aber ohne Trade (Speichern unterbrochen): beim Start ergänzt und gespeichert (+20)', hp && hp.pnl === 20 && hp.part?.n === 1 && hp.part?.rest === 1, JSON.stringify(H.map(t => [t.id, t.pnl])));
    check('Ausdrücklich gelöschter Teilabschluss-Trade (Löschvermerk) kommt nicht wieder', !H.some(t => t.id === 'HQ~s1'), JSON.stringify(H.map(t => t.id)));
    await page.reload(); await page.waitForTimeout(800);
    const H2 = (await ls(page, 'scalpdesk.history.v1')) || [];
    check('Neu laden: weiter genau ein Trade', H2.length === 1 && H2[0].id === 'HP~s1', JSON.stringify(H2.map(t => t.id)));
    check('keine Fehler (Start)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },

  // ================= 24/7-Übergabe (Oracle) und Chart nach Nachkauf und Teilabschluss =================
  async svc(browser) {
    await h.ctl('/walk?on=0');
    const B0 = Math.round((await h.ctl('/state')).price.BTCUSDT); await h.ctl(`/set?symbol=BTCUSDT&price=${B0}`);
    const now = Date.now(), CHAT = '987654321', E1 = B0 - 60, E2 = B0 - 20, SL = B0 - 120, TP = B0 + 120;
    const seed = { 'scalpdesk.channels.v1': { tg: { token: '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw', chat: CHAT, on: true }, dc: { url: 'https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz_ABC-123', on: false }, ev: { alarm: true, pos: true, day: false, news: false, pnl: true, pulse: false } },
      'scalpdesk.s247.v1': { on: true },
      'scalpdesk.pnlalarm.v1': { profit: { on: true, value: 1e6, state: 'armed', at: now - 60e3 }, loss: { on: true, value: 1e6, state: 'armed', at: now - 60e3 }, u: now - 60e3 },
      'scalpdesk.positions.v1': [position('V1', 'BTCUSDT', E1, 2, { sl: SL, tp: TP })] };
    const { ctx, page, errors } = await openPage(browser, seed, { viewport: { width: 1600, height: 1000 } });
    const svcTrace = [];
    page.on('request', r => { const u = new URL(r.url()); if (u.hostname === 'api.telegram.org') svcTrace.push({at:Date.now()-now,method:u.pathname.split('/').pop(),event:'request'}); });
    page.on('requestfailed', r => { const u = new URL(r.url()); if (u.hostname === 'api.telegram.org') svcTrace.push({at:Date.now()-now,method:u.pathname.split('/').pop(),event:'failed',error:r.failure()?.errorText}); });
    page.on('response', async r => { const u = new URL(r.url()); if (u.hostname === 'api.telegram.org') { const body=await r.json().catch(()=>null); svcTrace.push({at:Date.now()-now,method:u.pathname.split('/').pop(),event:'response',status:r.status(),ok:body?.ok,description:body?.description}); } });
    const docs = async () => (await fetch(`http://127.0.0.1:8790/tgmsgs?chat=${CHAT}`).then(r => r.json())).filter(m => m.document?.file_name === 'scalpdesk-247.json').sort((a, b) => b.message_id - a.message_id);
    const pinned = async () => { const d = (await docs()).find(m => m.pinnedAt); try { return d ? JSON.parse(d.content) : null; } catch { return null; } };
    const handed = want => until(async () => { const p = await pinned(), x = p?.pnl?.pos?.find(z => z.id === 'V1'), st = p?.positions?.find(z => z.id === 'V1'); return x && st && want(x) ? { x, st } : null; }, 20000);
    const diagSvc = async phase => console.log('DIAG 24/7', JSON.stringify({phase,trace:svcTrace,pinned:await pinned(),page:await page.evaluate(() => { const c=JSON.parse(localStorage.getItem('scalpdesk.s247.v1')||'null');return {status:document.getElementById('s247-status')?.textContent,cfg:c&&{on:c.on,sentOn:c.sentOn,msg:c.msg,at:c.at,sig:c.sig},positions:__g05.state.positions.map(p=>({id:p.id,qty:p.qty,entry:p.entry})),pnl:JSON.parse(localStorage.getItem('scalpdesk.pnlalarm.v1')||'null')}; })}));
    // Lage der Einstiegslinie zwischen SL- und TP-Linie im Chart (linearer Preismaßstab): (E − SL) / (TP − SL)
    const chartAt = () => page.evaluate(() => { const t = [...document.querySelectorAll('#chart svg text, svg text')], y = re => { const n = t.find(x => re.test(x.textContent)); return n ? Number(n.getAttribute('y')) : null; };
      const e = y(/^Einstieg Long 10×$/), sl = y(/^SL \d/), tp = y(/^TP \d/); return e === null || sl === null || tp === null ? null : (e - sl) / (tp - sl); });
    const near = (a, b) => a !== null && Math.abs(a - b) < 0.02;
    let a = await handed(x => x.qty === 2 && x.entry === E1), at = await until(chartAt, 10000);
    check('Vorher: Übergabe 2 BTC zu Ø Einstieg, Chart-Einstiegslinie an derselben Stelle', !!a && near(at, (E1 - SL) / (TP - SL)), `${a ? JSON.stringify(a.x) : 'keine Übergabe'} · Lage ${at}`);
    await add(page, 'V1', '1', String(B0 + 60)); await page.waitForTimeout(400);
    a = await handed(x => x.qty === 3 && x.entry === E2); at = await until(async () => { const v = await chartAt(); return near(v, (E2 - SL) / (TP - SL)) ? v : null; }, 10000);
    if (!a) await diagSvc('nachkauf');
    check('Nachkauf 1 zu Kurs + 60: Übergabe an den 24/7-Dienst mit 3 BTC zu Ø Kurs − 20 (Stop/Ziel unverändert)', !!a && a.st.sl === SL && a.st.tp === TP, a ? JSON.stringify(a) : 'keine neue Übergabe');
    check('Chart: Einstiegslinie auf dem neuen Ø-Einstieg', at !== null, String(await chartAt()));
    await close(page, 'V1', { qty: '1', exit: String(B0) }); await page.waitForTimeout(400);
    a = await handed(x => x.qty === 2 && x.entry === E2);
    if (!a) await diagSvc('teilabschluss');
    check('Teilabschluss 1 zu Kurs: Übergabe 2 BTC, Ø unverändert, Stop/Ziel unverändert', !!a && a.st.sl === SL && a.st.tp === TP, a ? JSON.stringify(a) : 'keine neue Übergabe');
    const tot = await txt(page, '#open-total');
    check('Offenes Ergebnis (Grundlage des Gewinn-/Verlust-Alarms) +40 = 2 × 20, ohne die realisierten +20 – dieselbe Rechnung wie im Dienst aus Menge und Ø', tot === '+40,00 USDT' && (await tradesOf(page, 'V1'))[0]?.pnl === 20, `${tot} · Teil ${(await tradesOf(page, 'V1'))[0]?.pnl}`);
    check('keine Fehler (Übergabe/Chart)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },
};

(async () => {
  const only = process.argv[2];
  await h.setup(); const browser = await h.launch();
  try { for (const [name, fn] of Object.entries(tests)) { if (only && only !== name) continue; console.log(`\n▶ ${name}`); try { await fn(browser); } catch (e) { check(`${name}: Abbruch`, false, e.stack.split('\n').slice(0, 3).join(' | ')); } await h.ctl('/reset'); } }
  finally { await browser.close(); await h.teardown(); }
  const ok = results.filter(r => r.ok).length; console.log(`\n${ok}/${results.length} bestanden`); process.exit(ok === results.length ? 0 : 1);
})();
