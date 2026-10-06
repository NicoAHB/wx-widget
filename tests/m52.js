// 3.31.0 (G03) – Kontostand, Kontrollstände, Euroanzeige, Auswertung je Position, klappbare Bereiche (über die Oberfläche).
// acct: Startwert (leer ≠ 0, 0 erlaubt), frühere Buchungen im Startwert enthalten, gebucht/live, ungebuchte Kosten, fehlender Kurs.
// fix: Beispiel der Übergabe (1.000 + 20, Kontrollstand 1.050, Nachtrag +30 bzw. +12, danach −10), Vorschau, Doppeltipp, erwarteter Stand.
// anchors: mehrere Anker, unbekannter Vorstand, Ersetzen, Zurücknehmen/wieder gelten lassen, Startwert ändern.
// period: Heute/7/30 Tage/eigenes Datum mit Zeitzone, Enddatum einschließlich, Änderung getrennt, keine fiktive Prozentzahl.
// sync: Neuladen, Textcode auf leeres Gerät, erneutes Einspielen, gleiche Zeit mit anderem Ziel und zweiter Startwert als Konflikt,
//   fehlerhafter Anker in der Prüfliste. eur: eingefroren beim Abschluss, Kurswechsel/Neuladen/Import ändern nichts, Summe verschiedener
//   Teilabschlusskurse, zukünftiger/veralteter Kurs → Minutenkurs, fehlender Kurs → „n. v.“ und Nachtrag als Revision, manuell mit
//   Beleg, Näherung, alle nachtragen, Live-Leiste, CSV. stats: Auswertung je Position. folds: Positionsübersicht klappbar mit sichtbaren
//   Karten, Zustand je Profil, Auswertung samt Jahreswahl gemerkt. demo: Demo zählt nicht im Kontostand.
// Aufruf: node m52.js [acct|fix|anchors|period|sync|eur|stats|folds|demo]
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + String(detail).slice(0, 500) : ''}`); };
const real = errs => errs.filter(e => !/Service Worker registration blocked/.test(e));
const until = async (fn, ms = 20000, step = 200) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await h.sleep(step); } };
async function openPage(browser, seed = {}, { ctx = null, viewport = { width: 1500, height: 1000 }, mobile = false } = {}) {
  ctx = ctx || await browser.newContext({ viewport, acceptDownloads: true, timezoneId: 'Europe/Berlin', ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  if (!ctx.seeded) { ctx.seeded = true; await ctx.addInitScript(items => { if (localStorage.getItem('seeded52')) return; localStorage.setItem('seeded52', '1'); for (const [k, v] of items) localStorage.setItem(k, JSON.stringify(v)); }, Object.entries(seed)); }
  const page = await ctx.newPage(), errors = []; h.collect(page, errors);
  page.on('dialog', d => void d.accept());
  await page.goto(`${h.URL_BASE}/weather-widget-v2.html`);
  await page.waitForFunction(() => document.getElementById('price').textContent.trim() !== '—', null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(700);
  return { ctx, page, errors };
}
const ls = (page, k) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), k);
const jsClick = (page, sel) => page.evaluate(sel => { const e = document.querySelector(sel); if (!e) throw new Error('fehlt: ' + sel); e.click(); }, sel);
const txt = (page, sel) => page.evaluate(sel => document.querySelector(sel)?.textContent ?? null, sel);
const inner = (page, sel) => page.evaluate(sel => (document.querySelector(sel)?.innerText ?? '').replace(/\s*\n\s*/g, ' | '), sel);
const fill = (page, sel, v) => page.evaluate(([sel, v]) => { const i = document.querySelector(sel); if (!i) throw new Error('fehlt: ' + sel); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);
// datetime-local in der Zeitzone des Browsers (Europe/Berlin) – nicht in der des Test-Rechners
const fillAt = (page, sel, ms) => page.evaluate(([sel, ms]) => { const d = new Date(ms), z = n => String(n).padStart(2, '0'), i = document.querySelector(sel); i.value = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; i.dispatchEvent(new Event('input', { bubbles: true })); }, [sel, ms]);
const C = id => `.pos-card[data-id="${id}"]`;
const setIn = (page, id, key, v) => page.evaluate(([sel, key, v]) => { const i = document.querySelector(`${sel} [data-input="${key}"]`); if (!i) throw new Error('fehlt ' + key); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, [C(id), key, v]);
async function close(page, id, f, at = null) {
  await jsClick(page, `${C(id)} [data-action="realize"]`); await page.waitForTimeout(120);
  for (const [k, v] of Object.entries(f)) await setIn(page, id, k, v);
  if (at) await page.evaluate(([sel, ms]) => { const d = new Date(ms), z = n => String(n).padStart(2, '0'), i = document.querySelector(`${sel} [data-input="when"]`); i.value = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; i.dispatchEvent(new Event('input', { bubbles: true })); }, [C(id), at]);
  await page.waitForTimeout(500);
  const pv = await txt(page, `${C(id)} [data-f="realize-preview"]`);
  await jsClick(page, `${C(id)} [data-action="save-realize"]`); await page.waitForTimeout(400);
  return pv;
}
const H = 3600e3, NOW = Date.now(), T0 = NOW - 30 * H;
const position = (id, sym, entry, qty, extra = {}) => ({ id, symbol: sym, side: 'long', mode: 'isolated', entry, leverage: 10, qty, margin: entry * qty / 10, openedAt: T0, source: 'spot', liqExchange: null, preRealized: 0, sl: null, tp: null, ack: { sl: false, tp: false }, ...extra });
const trade = (id, at, pnl, extra = {}) => ({ ...position(id, 'SOLUSDT', 100, 1, { openedAt: at - H }), exit: 100 + pnl, fees: 0, pnl, pnlSource: 'calc', closedAt: at, fx: null, ...extra });
const openAcct = page => page.evaluate(() => { document.getElementById('acct').open = true; });
async function setStart(page, amount, at) { await openAcct(page); await fill(page, '#acct-start-amt', amount); if (at) await fillAt(page, '#acct-start-at', at); await jsClick(page, '#acct-start-save'); await page.waitForTimeout(250); }
async function fix(page, amount, at, { reason = '', unknown = false, save = true } = {}) {
  await openAcct(page); await jsClick(page, '#acct-fix-open'); await page.waitForTimeout(80);
  await fill(page, '#acct-fix-amt', amount); if (at) await fillAt(page, '#acct-fix-at', at); if (reason) await fill(page, '#acct-fix-reason', reason);
  if (unknown) await page.evaluate(() => { const c = document.getElementById('acct-fix-unknown'); c.checked = true; c.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(100); const pv = await txt(page, '#acct-fix-preview');
  if (save) { await jsClick(page, '#acct-fix-save'); await page.waitForTimeout(250); }
  return pv;
}
const anchors = async page => ((await ls(page, 'scalpdesk.balance.v1')) || []).slice().sort((a, b) => a.at - b.at);
const booked = page => txt(page, '#acct-booked');
const openData = page => page.evaluate(() => { document.getElementById('pos-over').open = true; if (document.getElementById('data-panel').hidden) document.getElementById('data-toggle').click(); });
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
const trades = async page => ((await ls(page, 'scalpdesk.history.v1')) || []).slice().sort((a, b) => a.closedAt - b.closedAt);
const histOpen = page => page.evaluate(() => { document.getElementById('history').open = true; });
const rowOf = (page, id) => inner(page, `#history-list [data-trade="${id}"]`);

const tests = {
  // ================= Startwert, gebucht, live =================
  async acct(browser) {
    await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=SOLUSDT&price=150');
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.history.v1': [trade('a', T0 + H, 20), trade('b', T0 + 3 * H, 30)], 'scalpdesk.positions.v1': [position('P1', 'SOLUSDT', 100, 2, { preRealized: -1.5 })] });
    check('Ohne Startwert: Überschrift „Mein Kontostand“ bittet um den Startwert, Formular zur Ersteinrichtung', /Startwert festlegen/.test(await txt(page, '#acct-sum')) && await page.evaluate(() => !document.getElementById('acct-setup').hidden && document.getElementById('acct-main').hidden));
    check('„Mein Kontostand“ steht direkt über „Meine Positionen“', await page.evaluate(() => document.getElementById('acct').nextElementSibling?.id === 'positions'));
    await openAcct(page); await fill(page, '#acct-start-amt', ''); await jsClick(page, '#acct-start-save'); await page.waitForTimeout(150);
    check('Leeres Feld ist kein Nullwert: Hinweis statt Speichern', /leeres Feld ist kein Nullwert/.test(await txt(page, '#acct-setup-error')) && !(await anchors(page)).length, await txt(page, '#acct-setup-error'));
    await fill(page, '#acct-start-amt', '1.000'); await fillAt(page, '#acct-start-at', T0 + 2 * H); await page.waitForTimeout(100);
    check('„1.000“ ist mehrdeutig (Tausend oder 1,000): Hinweis statt stiller Deutung', /„1\.000“ ist mehrdeutig/.test(await txt(page, '#acct-start-preview')), await txt(page, '#acct-start-preview'));
    await fill(page, '#acct-start-amt', '1000'); await page.waitForTimeout(100);
    check('Vorschau: 1 Buchung bis dahin im Startwert enthalten, 1 spätere kommt dazu → 1.030', /1 Buchung bis dahin ist darin enthalten/.test(await txt(page, '#acct-start-preview')) && /gebucht jetzt 1\.030,00 USDT/.test(await txt(page, '#acct-start-preview')), await txt(page, '#acct-start-preview'));
    await jsClick(page, '#acct-start-save'); await page.waitForTimeout(250);
    const A = await anchors(page);
    check('Startwert gespeichert: Art „start“, Betrag als Dezimaltext „1000“, Zeitpunkt, Auftrags-ID', A.length === 1 && A[0].type === 'start' && A[0].amount === '1000' && typeof A[0].cmd === 'string', JSON.stringify(A));
    check('Gebucht = Startwert + danach gebuchte Trades (die +20 davor zählt nicht noch einmal): 1.030,00', await booked(page) === '1.030,00 USDT', await booked(page));
    const live = await txt(page, '#acct-live'), sub = await txt(page, '#acct-live-sub');
    check('Live = gebucht + offener Brutto-G/V (2 × 50) + ungebuchte Kosten (−1,50) = 1.128,50', live === '1.128,50 USDT' && /offen \+100,00 · noch ungebuchte Kosten −1,50/.test(sub), `${live} · ${sub}`);
    check('Rechnung sichtbar: „Startwert 1.000,00 … +30,00 Handelsergebnis … = 1.030,00 USDT gebucht“ mit EUR/USDT-Quelle', /Startwert 1\.000,00 USDT am .* \+30,00 Handelsergebnis \(netto\) .*= 1\.030,00 USDT gebucht\. Euro: Binance EUR\/USDT/.test(await txt(page, '#acct-calc')), await txt(page, '#acct-calc'));
    check('Euro in Klammern beim Kontostand (zum Live-Kurs)', /\(\d{1,3}(\.\d{3})*,\d\d €\)/.test(await txt(page, '#acct-booked-sub')));
    await h.ctl('/blockws?on=1'); await page.waitForTimeout(16000); await h.ctl('/tick?fail=SOLUSDT'); await page.evaluate(() => document.getElementById('refresh').click());
    const miss = await until(async () => /unvollständig|veraltet/.test(await txt(page, '#acct-live-sub')), 70000);
    check('Kein frischer Kurs: Live-Wert als unvollständig bzw. veraltet gekennzeichnet', !!miss, await txt(page, '#acct-live-sub'));
    await h.ctl('/tick'); await h.ctl('/blockws?on=0');
    check('Startwert 0 ist erlaubt (Kontrollstand 0)', /Differenz: −1\.030,00 USDT/.test(await fix(page, '0', null, { save: false })), await txt(page, '#acct-fix-preview'));
    await jsClick(page, '#acct-fix-cancel');
    const errs = real(errors).filter(e => !/status of 503/.test(e)); // 503: absichtlich gestörter Kursabruf (oben)
    check('keine Fehler (Startwert, außer dem absichtlich gestörten Kursabruf)', !errs.length, errs.join(' | ')); await ctx.close();
  },
  // ================= Beispiel der Übergabe: Kontrollstand als absoluter Anker =================
  async fix(browser) {
    await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=SOLUSDT&price=150');
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.positions.v1': [position('X', 'SOLUSDT', 100, 4, { openedAt: T0 - 2 * H })] });
    await setStart(page, '1000', T0 - H);
    await close(page, 'X', { qty: '1', exit: '120' }, T0 + H); // +20
    check('1.000 + 20 = 1.020', await booked(page) === '1.020,00 USDT', await booked(page));
    const pv = await fix(page, '1050', T0 + 4 * H, { reason: 'Abgleich mit der Börse', save: false });
    check('Vorschau: vorher 1.020, nachher 1.050, Differenz +30 – abgeleitete Korrektur, keine Buchung', /Vorher \(bis .*berechnet\): 1\.020,00 USDT · Nachher: 1\.050,00 USDT · Differenz: \+30,00 USDT \(abgeleitete Korrektur – keine Buchung, kein Trade, keine Meldung\)/.test(pv), pv);
    await page.evaluate(() => { const b = document.getElementById('acct-fix-save'); b.click(); b.click(); }); await page.waitForTimeout(300);
    let A = await anchors(page);
    check('Doppeltipp auf „Korrektur speichern“: genau ein Kontrollstand (Auftrags-ID)', A.filter(a => a.type === 'cp').length === 1 && A[1].reason === 'Abgleich mit der Börse', JSON.stringify(A.map(a => [a.type, a.amount, a.reason])));
    check('Stand nach dem Kontrollpunkt = Zielstand 1.050', await booked(page) === '1.050,00 USDT');
    check('Korrektur ist kein Trade: Trade-Liste unverändert (1 Teilabschluss)', (await trades(page)).length === 1);
    check('Startwert bleibt unverändert', (await anchors(page))[0].amount === '1000');
    await close(page, 'X', { qty: '1', exit: '130' }, T0 + 2 * H); // vergessener früherer Trade +30
    await page.evaluate(() => { document.getElementById('acct-anchors').open = true; });
    check('Vergessenen früheren Trade +30 nachgetragen: Stand bleibt 1.050, Korrektur wird 0', await booked(page) === '1.050,00 USDT' && /Korrektur 0,00 USDT/.test(await inner(page, '#acct-list')), `${await booked(page)} · ${await inner(page, '#acct-list')}`);
    await page.evaluate(sel => document.querySelector(`${sel} .lot-hist`).open = true, C('X'));
    await jsClick(page, `${C('X')} [data-action="undo"]`); await page.waitForTimeout(150); await page.evaluate(sel => { const b = document.querySelector(`${sel} [data-action="undo-confirm"]`); if (b) b.click(); }, C('X')); await page.waitForTimeout(300);
    await close(page, 'X', { qty: '1', exit: '112' }, T0 + 2 * H); // nur +12
    check('Nachtrag nur +12: Korrektur bleibt +18, Stand 1.050', await booked(page) === '1.050,00 USDT' && /Korrektur \+18,00 USDT/.test(await inner(page, '#acct-list')), `${await booked(page)} · ${await inner(page, '#acct-list')}`);
    await close(page, 'X', { qty: '1', exit: '90' }); // jetzt −10
    check('Danach neuer Trade −10: 1.040', await booked(page) === '1.040,00 USDT', await booked(page));
    // erwarteter Stand: zweiter Tab ändert, während das Formular offen ist
    await openAcct(page); await jsClick(page, '#acct-fix-open'); await fill(page, '#acct-fix-amt', '1045');
    const p2 = await ctx.newPage(); await p2.goto(`${h.URL_BASE}/weather-widget-v2.html`); await p2.waitForTimeout(1500);
    await fix(p2, '1041', NOW - 60e3, { reason: 'zweiter Tab' }); await page.waitForTimeout(600);
    await jsClick(page, '#acct-fix-save'); await page.waitForTimeout(250);
    check('Erwarteter Stand: inzwischen in einem anderen Tab geändert → nicht gespeichert, Hinweis und neue Vorschau', /inzwischen geändert/.test(await txt(page, '#acct-fix-error')) && (await anchors(page)).length === 3, `${await txt(page, '#acct-fix-error')} · ${(await anchors(page)).length}`);
    await jsClick(page, '#acct-fix-save'); await page.waitForTimeout(300);
    check('Nach erneutem Bestätigen gespeichert (4 Anker), Stand 1.045', (await anchors(page)).length === 4 && await booked(page) === '1.045,00 USDT', `${(await anchors(page)).length} · ${await booked(page)}`);
    await p2.close();
    check('keine Fehler (Kontrollstand)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },
  // ================= Mehrere Anker, unbekannter Vorstand, Ersetzen, Zurücknehmen =================
  async anchors(browser) {
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.history.v1': [trade('a', T0 + H, 50), trade('b', T0 + 3 * H, 30), trade('c', T0 + 5 * H, -20)] });
    await setStart(page, '1000', T0);
    await fix(page, '1100', T0 + 2 * H); await fix(page, '1200', T0 + 4 * H);
    await page.evaluate(() => { document.getElementById('acct-anchors').open = true; });
    let list = await inner(page, '#acct-list');
    check('Mehrere Kontrollstände chronologisch: Korrektur +50, dann +70; gebucht 1.180', /Kontrollstand 1\.100,00 USDT.*Korrektur \+50,00 USDT.*Kontrollstand 1\.200,00 USDT.*Korrektur \+70,00 USDT/.test(list) && await booked(page) === '1.180,00 USDT', list);
    const pv = await fix(page, '1150', T0 + 2 * H + 30 * 60e3, { save: false });
    check('Historische Korrektur in der Vorschau: spätere Buchungen rechnen weiter, späterer Kontrollstand bleibt Anker und seine Korrektur ändert sich', /Historische Korrektur: 2 spätere Buchungen rechnen ab dem neuen Stand weiter/.test(pv) && /Kontrollstand vom .* bleibt Anker \(1\.200,00 USDT\); seine Korrektur ändert sich von \+70,00 auf \+20,00/.test(pv), pv);
    await jsClick(page, '#acct-fix-cancel');
    check('Gleicher Zeitpunkt wie ein vorhandener Kontrollstand: abgelehnt mit Hinweis auf „Ersetzen“', /schon: Kontrollstand 1\.100.*„Ersetzen“/.test(await fix(page, '999', T0 + 2 * H, { save: false })));
    await jsClick(page, '#acct-fix-cancel');
    const pu = await fix(page, '700', T0 + 6 * H, { unknown: true, reason: 'Konto bereinigt' });
    check('Vorstand unbekannt: Differenz „nicht bestimmbar“, Zielwert wird neuer Anker (700)', /Differenz: nicht bestimmbar \(Vorstand unbekannt\)/.test(pu) && await booked(page) === '700,00 USDT', `${pu} · ${await booked(page)}`);
    list = await inner(page, '#acct-list');
    check('Liste: „Vorstand unbekannt – Differenz nicht bestimmbar (berechnet wären 1.180,00 USDT)“ und Grund', /Vorstand unbekannt – Differenz nicht bestimmbar \(berechnet wären 1\.180,00 USDT\).*Grund: Konto bereinigt/.test(list), list);
    // Ersetzen
    const A = await anchors(page), k1 = A.find(a => a.amount === '1100');
    await jsClick(page, `#acct-list [data-anchor="${k1.id}"] [data-action="acct-repl"]`); await page.waitForTimeout(100);
    check('Ersetzen: Formular vorbelegt mit 1.100 und Zeitpunkt', await page.evaluate(() => document.getElementById('acct-fix-amt').value) === '1100' && /Kontrollstand vom .* ändern/.test(await txt(page, '#acct-fix-title')));
    await fill(page, '#acct-fix-amt', '1090'); await page.waitForTimeout(80);
    check('Vorschau nennt den bisherigen Eintrag, der als „zurückgenommen“ sichtbar bleibt', /bleibt als „zurückgenommen“ sichtbar/.test(await txt(page, '#acct-fix-preview')));
    await jsClick(page, '#acct-fix-save'); await page.waitForTimeout(300);
    const B = await anchors(page), old = B.find(a => a.id === k1.id), neu = B.find(a => a.repl === k1.id);
    check('Ersetzt, nicht gelöscht: alter Eintrag mit off.by = neuer, neuer mit repl = alter', old?.off?.by === neu?.id && neu.amount === '1090' && B.length === 5, JSON.stringify(B.map(a => [a.amount, !!a.off, a.repl || ''])));
    list = await inner(page, '#acct-list');
    check('Liste zeigt „zurückgenommen … ersetzt durch Kontrollstand 1.090,00 USDT“', /zurückgenommen am .* – ersetzt durch Kontrollstand 1\.090,00 USDT/.test(list), list);
    // Zurücknehmen und wieder gelten lassen
    const k2 = B.find(a => a.amount === '1200');
    await jsClick(page, `#acct-list [data-anchor="${k2.id}"] [data-action="acct-off"]`); await page.waitForTimeout(100);
    await page.fill(`#acct-list [data-anchor="${k2.id}"] input`, 'doppelt erfasst'); await jsClick(page, `#acct-list [data-anchor="${k2.id}"] [data-action="acct-off-ok"]`); await page.waitForTimeout(250);
    let k2s = (await anchors(page)).find(a => a.id === k2.id);
    check('Zurücknehmen mit Grund: bleibt gespeichert (off mit Zeit und Grund), wirkt nicht mehr', k2s.off?.reason === 'doppelt erfasst' && /zurückgenommen am .*doppelt erfasst/.test(await inner(page, '#acct-list')));
    await jsClick(page, `#acct-list [data-anchor="${k2.id}"] [data-action="acct-on"]`); await page.waitForTimeout(250);
    k2s = (await anchors(page)).find(a => a.id === k2.id);
    check('„Wieder gelten lassen“: Vermerk entfernt, wirkt wieder', !k2s.off);
    // Startwert ändern: muss vor allen Kontrollständen liegen
    const st = (await anchors(page)).find(a => a.type === 'start');
    await jsClick(page, `#acct-list [data-anchor="${st.id}"] [data-action="acct-repl"]`); await page.waitForTimeout(80);
    await fillAt(page, '#acct-fix-at', T0 + 3 * H); await page.waitForTimeout(80);
    check('Startwert ändern: Zeitpunkt nach einem Kontrollstand wird abgelehnt', /Der Startwert muss vor allen Kontrollständen liegen/.test(await txt(page, '#acct-fix-preview')));
    await fillAt(page, '#acct-fix-at', T0); await fill(page, '#acct-fix-amt', '900'); await jsClick(page, '#acct-fix-save'); await page.waitForTimeout(250);
    const S = (await anchors(page)).filter(a => a.type === 'start');
    check('Startwert geändert: neuer Startwert 900, der alte bleibt als zurückgenommen erhalten', S.length === 2 && S.some(a => a.amount === '900' && !a.off) && S.some(a => a.amount === '1000' && a.off));
    check('keine Fehler (Anker)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },
  // ================= Zeitraumfilter =================
  async period(browser) {
    const today0 = (() => { const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' })); return NOW - ((d.getHours() * 60 + d.getMinutes()) * 60 + d.getSeconds()) * 1000 - d.getMilliseconds(); })();
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.history.v1': [trade('a', NOW - 20 * 864e5, 100), trade('b', NOW - 3 * 864e5, 40), trade('c', Math.max(today0 + 60e3, NOW - 3 * 60e3), -10)],
      'scalpdesk.money.v1': [{ id: 'd', type: 'deposit', amount: 200, currency: 'USDT', fx: null, date: NOW - 2 * 864e5, note: '', createdAt: NOW }] });
    await setStart(page, '0', NOW - 40 * 864e5);
    await jsClick(page, '[data-acct-range="today"]'); await page.waitForTimeout(150);
    check('Heute: ab 00:00 bis jetzt, mit sichtbarer Gerätezeitzone (Europe/Berlin, UTC+…)', /^Heute, .* ab 00:00 bis jetzt · Zeitzone dieses Geräts: Europe\/Berlin, UTC\+0[12]:00$/.test(await txt(page, '#acct-tz')), await txt(page, '#acct-tz'));
    let out = await inner(page, '#acct-period');
    check('Heute: Handelsergebnis −10, Änderung −10 mit Prozent vom Anfangsstand 340', /Änderung \| −10,00 USDT \| −2,94 % vom Anfangsstand/.test(out) && /Handelsergebnis \| −10,00 USDT/.test(out), out);
    await jsClick(page, '[data-acct-range="7d"]'); await page.waitForTimeout(150);
    out = await inner(page, '#acct-period');
    check('7 Tage rollierend (klar bezeichnet): Handel +30, Einzahlung +200, Änderung +230', /^Letzte 7 Tage, rollierend: .* bis jetzt/.test(await txt(page, '#acct-tz')) && /Änderung \| \+230,00 USDT/.test(out) && /Ein- und Auszahlungen \| \+200,00 USDT/.test(out) && /Handelsergebnis \| \+30,00 USDT/.test(out), out);
    await jsClick(page, '[data-acct-range="30d"]'); await page.waitForTimeout(150);
    out = await inner(page, '#acct-period');
    check('30 Tage: Anfangsstand 0 → Änderung +330, aber keine fiktive Prozentzahl', /Anfang \| 0,00 USDT/.test(out) && /Änderung \| \+330,00 USDT \| keine Prozentzahl \(Anfangsstand 0\)/.test(out), out);
    await jsClick(page, '[data-acct-range="custom"]'); await page.waitForTimeout(100);
    const day = ms => page.evaluate(ms => { const d = new Date(ms), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; }, ms);
    await fill(page, '#acct-from', await day(NOW - 4 * 864e5)); await fill(page, '#acct-to', await day(NOW - 3 * 864e5)); await page.waitForTimeout(150);
    out = await inner(page, '#acct-period');
    check('Eigenes Datum: Enddatum einschließlich (Trade am Endtag zählt, Einzahlung danach nicht)', /bis .* 23:59 \(Enddatum einschließlich\)/.test(await txt(page, '#acct-tz')) && /Handelsergebnis \| \+40,00 USDT/.test(out) && /Ein- und Auszahlungen \| 0,00 USDT/.test(out), `${await txt(page, '#acct-tz')} · ${out}`);
    await fill(page, '#acct-from', await day(NOW - 60 * 864e5)); await page.waitForTimeout(150);
    out = await inner(page, '#acct-period');
    check('Zeitraum vor dem Startwert: Anfang unbekannt, Änderung nicht bestimmbar (keine erfundene Historie)', /Anfang \| unbekannt/.test(out) && /Änderung \| nicht bestimmbar \| Anfangsstand unbekannt/.test(out), out);
    await page.reload(); await page.waitForTimeout(1500); await openAcct(page); await page.waitForTimeout(150);
    check('Gewählter Zeitraum bleibt nach dem Neuladen', await page.evaluate(() => document.querySelector('[data-acct-range="custom"]').getAttribute('aria-pressed')) === 'true');
    check('keine Fehler (Zeitraum)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },
  // ================= Neuladen, Sicherung, Konflikte =================
  async sync(browser) {
    const seed = { 'scalpdesk.history.v1': [trade('a', T0 + H, 20)] };
    const A = await openPage(browser, seed);
    await setStart(A.page, '1000', T0); await fix(A.page, '1050', T0 + 2 * H, { reason: 'iPhone' });
    await A.page.reload(); await A.page.waitForTimeout(1500); await openAcct(A.page);
    check('Nach dem Neuladen: Startwert, Kontrollstand und Stand 1.050 unverändert', await booked(A.page) === '1.050,00 USDT' && (await anchors(A.page)).length === 2);
    const code = await exportCode(A.page);
    const B = await openPage(browser, {});
    let r = await importCode(B.page, code);
    check('Vorschau auf dem leeren Gerät nennt „2 Kontostand-Einträge“', r.items.some(x => /Neu: .*2 Kontostand-Einträge/.test(x)), r.items.join(' || '));
    let s = await takeCode(B.page); await openAcct(B.page); await B.page.waitForTimeout(200);
    check('Textcode iPhone → iPad: derselbe Kontostand 1.050 und dieselben Anker', await booked(B.page) === '1.050,00 USDT' && JSON.stringify((await anchors(B.page)).map(a => a.id)) === JSON.stringify((await anchors(A.page)).map(a => a.id)), s);
    r = await importCode(B.page, code);
    check('Erneutes Einspielen: „Nichts Neues“, kein doppelter Anker', /Nichts Neues/.test(r.status) && (await anchors(B.page)).length === 2, r.status);
    // gleiche Zeit, anderes Ziel auf dem iPad
    await fix(A.page, '1070', T0 + 4 * H, { reason: 'iPhone 2' });
    await fix(B.page, '1080', T0 + 4 * H, { reason: 'iPad 2' });
    r = await importCode(B.page, await exportCode(A.page));
    check('Gleicher Zeitpunkt, anderer Zielstand: Konflikt in der Vorschau', r.items.some(x => /Konflikte.*gleicher Zeitpunkt, anderer Kontostand als hier/.test(x)), r.items.join(' || '));
    s = await takeCode(B.page);
    const dlg = await B.page.evaluate(() => ({ open: document.getElementById('conf-dialog').open, what: document.getElementById('conf-what').textContent, rows: [...document.querySelectorAll('#conf-table tbody tr')].map(tr => tr.innerText.replace(/\s+/g, ' ')) }));
    check('Dialog „Änderungen vergleichen“: beide Fassungen (1.080 hier, 1.070 aus der Sicherung), bis zur Entscheidung gilt der hiesige', dlg.open && /verschiedene Kontrollstände/.test(dlg.what) && dlg.rows.some(x => /Kontostand 1\.080,00 USDT 1\.070,00 USDT/.test(x)) && await booked(B.page) === '1.080,00 USDT', JSON.stringify(dlg));
    await jsClick(B.page, '#conf-later'); await B.page.waitForTimeout(200);
    await B.page.reload(); await B.page.waitForTimeout(1500); await openAcct(B.page); await B.page.waitForTimeout(200);
    check('„Später entscheiden“: bleibt nach dem Neuladen offen, Hinweis beim Kontostand', /Konflikt beim Kontostand wartet/.test(await txt(B.page, '#acct-warn')), await txt(B.page, '#acct-warn'));
    await B.page.evaluate(() => document.getElementById('integrity-conf').click()); await B.page.waitForTimeout(300);
    await jsClick(B.page, '#conf-take'); await B.page.waitForTimeout(300);
    const BA = await anchors(B.page);
    check('„Entwurf übernehmen“: 1.070 gilt, 1.080 bleibt als zurückgenommen erhalten (nicht still gelöscht)', await booked(B.page) === '1.070,00 USDT' && BA.some(a => a.amount === '1080' && a.off?.by) && BA.some(a => a.amount === '1070' && !a.off), JSON.stringify(BA.map(a => [a.amount, !!a.off])));
    r = await importCode(B.page, await exportCode(A.page));
    check('Dieselbe Sicherung erneut: keine neue Rückfrage', !r.items.some(x => /Konflikt/.test(x)) && !(await B.page.evaluate(() => document.getElementById('conf-dialog').open)), r.items.join(' || ') + r.status);
    if (r.shown) await takeCode(B.page);
    // zweiter Startwert auf einem frischen Gerät
    const C2 = await openPage(browser, {});
    await setStart(C2.page, '500', T0 - H);
    r = await importCode(C2.page, code);
    check('Auf beiden Geräten ein Startwert: Konflikt statt stillem Nebeneinander', r.items.some(x => /auf beiden Geräten ein Startwert/.test(x)), r.items.join(' || '));
    await takeCode(C2.page); await jsClick(C2.page, '#conf-keep'); await C2.page.waitForTimeout(300);
    const CA = await anchors(C2.page);
    check('„Bestätigten Stand behalten“: hiesiger Startwert 500 gilt, der andere als zurückgenommen aufbewahrt', CA.some(a => a.type === 'start' && a.amount === '500' && !a.off) && CA.some(a => a.type === 'start' && a.amount === '1000' && a.off), JSON.stringify(CA.map(a => [a.type, a.amount, !!a.off])));
    // fehlerhafter Anker
    const D = await openPage(browser, { 'scalpdesk.balance.v1': [{ id: 'z1', type: 'cp', at: T0, amount: '-5', createdAt: T0 }, { id: 's1', type: 'start', at: T0 - H, amount: '100', createdAt: T0 }] });
    await openAcct(D.page); await D.page.waitForTimeout(200);
    const q = await ls(D.page, 'scalpdesk.quarantine.v1');
    check('Fehlerhafter Anker (−5) verschwindet nicht still: Prüfliste mit Grund, Hinweis beim Kontostand', q.some(x => x.kind === 'bal' && /Kontostand ungültig/.test(x.why)) && /fehlerhafte Eintrag fehlt im Kontostand/.test(await txt(D.page, '#acct-warn')), JSON.stringify(q) + await txt(D.page, '#acct-warn'));
    for (const x of [A, B, C2, D]) { check('keine Fehler (Abgleich)', !real(x.errors).length, real(x.errors).join(' | ')); await x.ctx.close(); }
  },
  // ================= Euro je Buchung =================
  async eur(browser) {
    await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=SOLUSDT&price=150'); await h.ctl('/set?symbol=EURUSDT&price=1.2');
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.positions.v1': [position('E', 'SOLUSDT', 100, 4, { openedAt: NOW - 50 * H }), position('E10', 'SOLUSDT', 100, 1, { openedAt: NOW - 50 * H }), position('EM', 'SOLUSDT', 100, 1, { openedAt: NOW - 50 * H })],
      'scalpdesk.history.v1': [trade('old', Date.UTC(2019, 5, 1, 12), 10), trade('m1', NOW - 40 * H, 12), trade('m2', NOW - 30 * H, -6)] });
    await page.evaluate(() => document.getElementById('refresh').click()); await page.waitForTimeout(1500);
    // Live-Leiste
    const lb = await txt(page, '#lb-open-eur'), lbU = Number((await txt(page, '#lb-open')).replace(/ ·.*$/, '').replace(/[^\d,]/g, '').replace(',', '.'));
    check('Live-Leiste: offener G/V zusätzlich in Euro in Klammern (USDT / 1,2)', lb === `(+${(lbU / 1.2).toFixed(2).replace('.', ',')} €)`, `${lb} · ${lbU}`);
    const pv = await close(page, 'E', { qty: '1', exit: '120' });
    check('Vorschau nennt den Euro-Wert mit Kurs und Quelle', /Euro: \+16,67 € zum Kurs 1,2000 USDT je EUR \(Binance EUR\/USDT, Mitte aus Geld\/Brief, abgerufen/.test(pv), pv);
    let T = await trades(page), t1 = T.find(t => t.id.startsWith('E~'));
    check('Teilabschluss eingefroren: fx 1,2, Quelle live, Kurszeit ≤ Abschluss und ≤ 5 Min., EUR 16,67', Math.abs(t1.fx - 1.2) < 1e-9 && t1.fxSrc === 'live' && t1.fxAt <= t1.closedAt && t1.closedAt - t1.fxAt <= 300e3 && t1.eur === 16.67, JSON.stringify(t1));
    // Kurswechsel: Einstellungen auf manuellen Kurs 1,25
    await page.evaluate(() => { document.getElementById('model-settings').open = true; const s = document.getElementById('fx-mode'); s.value = 'manual'; s.dispatchEvent(new Event('change', { bubbles: true })); const i = document.getElementById('fx'); i.disabled = false; i.value = '1.25'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForTimeout(300);
    await histOpen(page);
    const openU = Number((await txt(page, '#lb-open')).replace(/ ·.*$/, '').replace(/[^\d,]/g, '').replace(',', '.')), openE = `(+${(openU / 1.25).toFixed(2).replace('.', ',')} €)`;
    check('Nach FX-Wechsel: realisierter Euro-Wert des Teilabschlusses bleibt 16,67 €; offene Werte rechnen mit dem neuen Kurs 1,25', /\+20,00 USDT \| \(\+16,67 €\)/.test(await rowOf(page, t1.id)) && await txt(page, '#lb-open-eur') === openE, `${await rowOf(page, t1.id)} · ${await txt(page, '#lb-open-eur')} · erwartet ${openE}`);
    await close(page, 'E', { qty: '3', exit: '125' });
    T = await trades(page); const fin = T.find(t => t.id === 'E');
    check('Schluss zum manuellen Kurs: Quelle „set“, 75 / 1,25 = 60,00 €', fin && fin.fxSrc === 'set' && fin.eur === 60, JSON.stringify(fin));
    check('Position gesamt in Euro = Summe der eingefrorenen Buchungen (16,67 + 60,00), nicht Gesamt-USDT / letzter Kurs (76,00)', Math.round((t1.eur + fin.eur) * 100) / 100 === 76.67);
    await page.reload(); await page.waitForTimeout(1500); await histOpen(page);
    check('Nach dem Neuladen: Euro-Werte unverändert', /\(\+16,67 €\)/.test(await rowOf(page, t1.id)) && /\(\+60,00 €\)/.test(await rowOf(page, 'E')));
    const code = await exportCode(page), P2 = await openPage(browser, {});
    await importCode(P2.page, code); await takeCode(P2.page); await histOpen(P2.page);
    check('Nach dem Import auf einem anderen Gerät (dort anderer Kurs): dieselben Euro-Werte', /\(\+16,67 €\)/.test(await rowOf(P2.page, t1.id)) && /\(\+60,00 €\)/.test(await rowOf(P2.page, 'E')));
    await P2.ctx.close();
    await page.evaluate(() => { const s = document.getElementById('fx-mode'); s.value = 'auto'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await page.waitForTimeout(1500);
    // Kurs liegt nach dem Abschluss (Abschluss vor 10 Min.): nicht der Live-Kurs, sondern die Minute davor
    const nid = 'E10', pv10 = await close(page, nid, { qty: '1', exit: '110' }, Date.now() - 10 * 60e3);
    T = await trades(page); const t10 = T.find(t => t.id === nid);
    const m10 = Math.floor(t10.closedAt / 60e3) - 1, want10 = +(1.1 + (m10 % 1000) / 100000).toFixed(5);
    check('Live-Kurs zeitlich nach dem Abschluss (vor 10 Min.): nicht verwendet, sondern Binance-Minute davor', t10.fxSrc === 'm1' && t10.fx === want10 && t10.fxAt === t10.closedAt && /Schlusskurs der Minute bis/.test(pv10), `${JSON.stringify({ fx: t10.fx, src: t10.fxSrc, at: t10.fxAt, c: t10.closedAt })} · erwartet ${want10}`);
    // fehlender Kurs → n. v., Nachtrag als Revision
    await h.ctl('/eurhist?mode=fail');
    const mid = 'EM', pvm = await close(page, mid, { qty: '1', exit: '105' }, Date.now() - 30 * H);
    await page.waitForTimeout(1200);
    T = await trades(page); let tm = T.find(t => t.id === mid);
    check('Kein gültiger Kurs (Binance gestört): Abschluss trotzdem in USDT gespeichert, fx null, kein Eurobetrag', tm && tm.pnl === 5 && tm.fx === null && tm.eur === undefined && /kein gültiger Kurs zum Abschlusszeitpunkt/.test(pvm), `${JSON.stringify(tm)} · ${pvm}`);
    await histOpen(page);
    check('Trade-Liste: „(€ n. v.)“ mit Hinweis „EUR zum Abschlusszeitpunkt nicht verfügbar“', /\(€ n\. v\.\)/.test(await rowOf(page, mid)) && await page.evaluate(id => document.querySelector(`#history-list [data-trade="${id}"] small`).title, mid) === 'EUR zum Abschlusszeitpunkt nicht verfügbar');
    await h.ctl('/eurhist?mode=on');
    await jsClick(page, `#history-list [data-trade="${mid}"] [data-action="trade-fx"]`); await page.waitForTimeout(150);
    await jsClick(page, `#history-list [data-trade="${mid}"] [data-action="fx-fetch"]`);
    await until(async () => (await trades(page)).find(t => t.id === mid)?.fx > 0, 8000);
    tm = (await trades(page)).find(t => t.id === mid);
    const mm = Math.floor(tm.closedAt / 60e3) - 1, wantm = +(1.1 + (mm % 1000) / 100000).toFixed(5);
    check('„Binance-Kurs abrufen“: historischer Minutenkurs als protokollierte Revision (vorher ohne Kurs)', tm.fx === wantm && tm.fxSrc === 'm1' && tm.fxLog?.length === 1 && tm.fxLog[0].prev === null && tm.fxLog[0].by === 'fetch' && tm.eur === Math.round(5 / wantm * 100) / 100, JSON.stringify(tm.fxLog));
    check('Revision im Trade sichtbar', /Revision .*ohne Kurs → .*von Binance nachgetragen/.test(await rowOf(page, mid)), await rowOf(page, mid));
    // manuell: Beleg Pflicht, Tagesdurchschnitt als Näherung
    await jsClick(page, `#history-list [data-trade="${mid}"] [data-action="fx-form"]`); await page.waitForTimeout(100);
    await fill(page, `#history-list [data-trade="${mid}"] [data-fxin="rate"]`, '1,15');
    await jsClick(page, `#history-list [data-trade="${mid}"] [data-action="fx-save"]`); await page.waitForTimeout(150);
    check('Manuelle Korrektur ohne Beleg: abgelehnt', /ohne Beleg keine Änderung/.test(await rowOf(page, mid)) && (await trades(page)).find(t => t.id === mid).fx === wantm);
    await page.evaluate(id => { const r = document.querySelector(`#history-list [data-trade="${id}"]`); r.querySelector('[data-fxin="rate"]').value = '1,15'; r.querySelector('[data-fxin="kind"]').value = 'day'; r.querySelector('[data-fxin="note"]').value = 'Tagesmittel laut Kontoauszug'; }, mid);
    await jsClick(page, `#history-list [data-trade="${mid}"] [data-action="fx-save"]`); await page.waitForTimeout(250);
    tm = (await trades(page)).find(t => t.id === mid);
    check('Tagesdurchschnitt mit Beleg: als Näherung gekennzeichnet (≈), zweite Revision mit vorherigem Kurs', tm.fx === 1.15 && tm.fxSrc === 'day' && tm.fxNote === 'Tagesmittel laut Kontoauszug' && tm.fxLog.length === 2 && tm.fxLog[1].prev === wantm && /\(≈ \+4,35 €\)/.test(await rowOf(page, mid)), `${JSON.stringify(tm.fxLog)} · ${await rowOf(page, mid)}`);
    // alle ohne Kurs nachtragen
    await page.evaluate(() => { document.getElementById('history').open = true; }); await page.waitForTimeout(100);
    check('Hinweis: 3 Trades ohne Euro-Kurs, Knopf „Euro-Kurse nachtragen …“', /^3 Trades ohne Euro-Kurs/.test(await txt(page, '#fx-fill-info')) && await page.evaluate(() => !document.getElementById('fx-fill-go').hidden), await txt(page, '#fx-fill-info'));
    await jsClick(page, '#fx-fill-go');
    await until(() => page.evaluate(() => /Vorschau/.test(document.getElementById('fx-fill-out').textContent)), 15000);
    const fo = await inner(page, '#fx-fill-out');
    check('Vorschau: 2 von 3 mit Binance-Kurs, der Trade von 2019 ohne („vor 2020“) – noch nichts geändert', /2 von 3 mit Binance-Kurs/.test(fo) && /vor 2020 – kein Binance-Kurs/.test(fo) && (await trades(page)).filter(t => !(t.fx > 0)).length === 3, fo);
    await jsClick(page, '#fx-fill-out [data-action="fx-fill-ok"]'); await page.waitForTimeout(300);
    T = await trades(page);
    check('Übernehmen: 2 Kurse nachgetragen, je Trade eine Revision „alle ohne Kurs“; 2019 bleibt „n. v.“', T.filter(t => ['m1', 'm2'].includes(t.id)).every(t => t.fx > 0 && t.fxLog?.[0]?.by === 'auto-all') && T.find(t => t.id === 'old').fx === null);
    // CSV
    const csv = await page.evaluate(() => tradesCsv(state.trades)).catch(() => null);
    check('CSV-Export nennt EUR-Status, Quelle und Kurszeit', csv === null || /EUR-Status;EUR-Kurs Quelle;EUR-Kurszeit/.test(csv), csv === null ? 'nicht direkt prüfbar (Modul)' : csv.slice(0, 200));
    const errs = real(errors).filter(e => !/status of 503/.test(e)); // 503: absichtlich gestörte Binance-Historie (oben)
    check('keine Fehler (Euro, außer der absichtlich gestörten Binance-Historie)', !errs.length, errs.join(' | ')); await ctx.close();
  },
  // ================= Auswertung je Position =================
  async stats(browser) {
    const P = 'p1', at = NOW - 5 * H;
    const part = (sid, t, pnl, n) => trade(`${P}~${sid}`, t, pnl, { part: { pos: P, sell: sid, n, rest: 1 } });
    const seed = { 'scalpdesk.history.v1': [part('s1', at, 10, 1), trade(P, at + H, -5, { part: { pos: P, sell: 's2', n: 2, final: true } }), trade('q', at + 2 * H, -3), trade('o~s1', at, 4, { part: { pos: 'o', sell: 's1', n: 1, rest: 1 } })],
      'scalpdesk.positions.v1': [position('o', 'SOLUSDT', 100, 1)] };
    const { ctx, page, errors } = await openPage(browser, seed);
    await page.evaluate(() => { document.getElementById('history').open = true; document.getElementById('analysis').open = true; }); await page.waitForTimeout(300);
    const sum = await inner(page, '#history-summary');
    check('Trades je Position: +10 im Teilabschluss und −5 beim Schluss zählen als ein Gewinner (+5); dazu 1 Verlierer (−3)', /Trades \(je Position\) \| 2 \| 1 Gewinner · 1 Verlierer · 50 % Treffer · 4 Buchungen/.test(sum), sum);
    check('Gewinne/Verluste je Position (+5 / −3), Netto je Buchung (+6) mit Teilabschluss der offenen Position', /Gewinne \| \+5,00 USDT/.test(sum) && /Verluste \| −3,00 USDT/.test(sum) && /Netto \(Buchungen\) \| \+6,00 USDT/.test(sum) && /darin \+4,00 aus Teilabschlüssen offener Positionen/.test(sum), sum);
    check('Realisiert: „2 Trades + 1 offen mit Teilabschluss“', /2 Trades \+ 1 offen mit Teilabschluss/.test(await txt(page, '#realized-total-eur')), await txt(page, '#realized-total-eur'));
    const kp = await inner(page, '#analysis-kpis');
    check('Auswertung je Position: Ø Gewinn +5, Ø Verlust −3, Profitfaktor 1,67', /Ø Gewinn \/ Ø Verlust \| \+5,00 \/ −3,00/.test(kp) && /Profitfaktor \| 1,67/.test(kp), kp);
    check('Hinweis: offene Position zählt erst beim Schließen, Kapitalkurve je Buchung', /Gezählt je Position/.test(await txt(page, '#analysis-note')) && /1 Position ist noch offen/.test(await txt(page, '#analysis-note')) && /Kapitalkurve und größter Rückgang je Buchung/.test(await txt(page, '#analysis-note')));
    check('Kapitalkurve je Buchung (4 Punkte)', /Kapitalkurve: 4 Buchungen/.test(await page.evaluate(() => document.querySelector('#equity svg')?.getAttribute('aria-label') || '')));
    const mo = await inner(page, '#monthly');
    check('Monatsübersicht: Trades je Position (2), Netto je Buchung (+6,00)', /Summe \| 2 \| 50 % \| \+6,00/.test(mo), mo);
    check('keine Fehler (Auswertung)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },
  // ================= Klappbare Bereiche =================
  async folds(browser) {
    const seed = { 'scalpdesk.positions.v1': [position('F', 'SOLUSDT', 100, 1)], 'scalpdesk.history.v1': [trade('t25', Date.UTC(2025, 3, 1, 12), 7), trade('t26', NOW - H, 3)] };
    const { ctx, page, errors } = await openPage(browser, seed);
    check('Desktop: Kontostand anfangs offen, Positionsübersicht offen', await page.evaluate(() => document.getElementById('acct').open && document.getElementById('pos-over').open));
    await page.evaluate(() => document.querySelector('#pos-over > summary').click()); await page.waitForTimeout(300);
    const st = await page.evaluate(() => { const v = id => document.getElementById(id).checkVisibility(); return { open: document.getElementById('pos-over').open, card: document.querySelector('.pos-card[data-id="F"]').checkVisibility(), form: v('pos-form'), totals: v('open-total'), day: v('day-strip'), add: v('pos-add-toggle'), h: v('positions-title') }; });
    check('Zugeklappt: Überschrift und offene Karte sichtbar; Summen, Tagesverlustlimit und Formular im Klappbereich verborgen', !st.open && st.card && st.h && !st.totals && !st.day && !st.form, JSON.stringify(st));
    check('Zugeklappt: Kurzfassung in der Überschrift (1 offen · Ergebnis in USDT und €)', /^1 offen · [+−]\d.*USDT \(.*€\)/.test(await txt(page, '#pos-over-sub')), await txt(page, '#pos-over-sub'));
    check('Kein Knopf im Summary (kein verschachtelter Klick); „+ Position“ außerhalb und erreichbar', st.add && await page.evaluate(() => !document.querySelector('#pos-over > summary button') && !document.getElementById('pos-add-toggle').closest('summary')));
    await jsClick(page, '#pos-add-toggle'); await page.waitForTimeout(250);
    check('„+ Position“ im zugeklappten Zustand öffnet den Bereich und das Formular', await page.evaluate(() => document.getElementById('pos-over').open && !document.getElementById('pos-form').hidden));
    await jsClick(page, '#pos-add-toggle'); await page.evaluate(() => document.querySelector('#pos-over > summary').click()); await page.waitForTimeout(150);
    await page.evaluate(() => { document.getElementById('analysis').open = true; const s = document.getElementById('year-filter'); s.value = '2025'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await page.waitForTimeout(200);
    await page.reload(); await page.waitForTimeout(1500);
    const after = await page.evaluate(() => ({ over: document.getElementById('pos-over').open, an: document.getElementById('analysis').open, year: document.getElementById('year-filter').value, count: document.getElementById('analysis-count').textContent }));
    check('Nach dem Neuladen: Positionsübersicht zu, Auswertung offen, Jahreswahl 2025 erhalten (1 Trade in 2025)', !after.over && after.an && after.year === '2025' && /1 Trade in 2025/.test(after.count), JSON.stringify(after));
    const ph = await openPage(browser, {}, { ctx, viewport: { width: 390, height: 844 }, mobile: true });
    await ph.page.setViewportSize({ width: 390, height: 844 }); await ph.page.reload(); await ph.page.waitForTimeout(1500);
    const pst = await ph.page.evaluate(() => ({ lay: document.documentElement.dataset.layout, over: document.getElementById('pos-over').open, acct: document.getElementById('acct').open }));
    check('Anderes Profil (iPad/Handy): eigener Zustand – Positionsübersicht dort offen, Kontostand zu (Vorgabe)', pst.lay === 'tablet' && pst.over && !pst.acct, JSON.stringify(pst));
    check('keine Fehler (Klappbereiche)', !real(errors).length && !real(ph.errors).length, [...real(errors), ...real(ph.errors)].join(' | ')); await ctx.close();
  },
  // ================= Demo zählt nicht =================
  async demo(browser) {
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.demohistory.v1': [trade('d1', T0 + H, 500)], 'scalpdesk.history.v1': [trade('r1', T0 + H, 5)] });
    await setStart(page, '100', T0);
    check('Demo-Trades zählen nicht im Kontostand (100 + 5 = 105, ohne die simulierten +500)', await booked(page) === '105,00 USDT', await booked(page));
    check('keine Fehler (Demo)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },
};

(async () => {
  const only = process.argv[2];
  await h.setup(); const browser = await h.launch();
  try { for (const [name, fn] of Object.entries(tests)) { if (only && only !== name) continue; console.log(`\n▶ ${name}`); try { await fn(browser); } catch (e) { check(`${name}: Abbruch`, false, e.stack.split('\n').slice(0, 3).join(' | ')); } await h.ctl('/reset'); } }
  finally { await browser.close(); await h.teardown(); }
  const ok = results.filter(r => r.ok).length; console.log(`\n${ok}/${results.length} bestanden`); process.exit(ok === results.length ? 0 : 1);
})();
