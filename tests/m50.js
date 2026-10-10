// 3.29.0 (G01) – Datenintegrität, Konflikte und vollständige Sicherung.
// integrity: fehlerhafte Einträge kommen in die Prüfliste (Grund, Original, Summen „ohne …“), nichts verschwindet still; Korrigieren,
//   Löschen, Export; ungültige Zusatzwerte → eingeschränkt geladen. reasons: keine stille Kürzung beim Laden, Herkunft des Setups.
// backup: Schema 8 vollständig, ohne Zugangsdaten und Gerätezustände; Prüfsumme der Datei; alte Sicherungen; doppelter Import;
//   Rückgängig; Speicherfehler beim Übernehmen; neuere Schema-Version; manipulierte Packung. code: Textcode iPhone → PC, mit und ohne
//   Passwort, beschädigt/unvollständig. qr: 10 Teile mit Wechsel, Pause, Vor/Zurück, Geschwindigkeit, Lesbarkeit (M, ≤ 20, ≥ 3 px);
//   Scan durcheinander und doppelt, fehlender und widersprüchlicher Teil; 11 Teile → kein QR. conflict: zwei Geräte ändern dieselbe
//   Grundlage offline (auch mit falscher Uhr) → „Änderungen vergleichen“, nichts vorausgewählt, später/behalten/übernehmen; schneller
//   Vorlauf und ältere Fassung ohne Rückfrage; Löschung gegen Änderung; Einstellungen; Alarm-Kennung iPhone → iPad ohne erneutes Auslösen.
// money: selbst eingegebenes Datum einer Geldbewegung (vor 2017) bleibt nach dem Neuladen gültig; außerhalb 2009–2099 lehnt das Formular ab.
// Aufruf: node m50.js [integrity|reasons|backup|code|qr|conflict|alarmid|money|sync]
const h = require('./harness'), fs = require('fs'), path = require('path'), os = require('os'), zlib = require('zlib');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + String(detail).slice(0, 300) : ''}`); };
const REPO = require('path').resolve(__dirname, '..'), DBG = 'weather-widget-v2.g01.html';
const real = errs => errs.filter(e => !/Service Worker registration blocked|willReadFrequently/.test(e)); // getImageData des Tests selbst
const until = async (fn, ms = 20000, step = 200) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await h.sleep(step); } };
function writeDebugPage() {
  const s = fs.readFileSync(`${REPO}/weather-widget-v2.html`, 'utf8'), anchor = '\nrender();startLive();';
  if (!s.includes(anchor)) throw new Error('Einstiegspunkt fehlt');
  fs.writeFileSync(`${REPO}/${DBG}`, s.replace(anchor, '\nwindow.__g = { get state() { return state; }, qr, onScanText, parseQrPart, quarList, confList, setLin, packBackup };' + anchor));
}
async function openPage(browser, seed = {}, { ctx = null, viewport = { width: 1600, height: 1000 }, debug = false, init = null, perm = false } = {}) {
  ctx = ctx || await browser.newContext({ viewport, acceptDownloads: true, timezoneId: 'Europe/Berlin', ...(perm ? { permissions: ['clipboard-read', 'clipboard-write'] } : {}) });
  if (!ctx.seeded) {
    ctx.seeded = true;
    if (init) await ctx.addInitScript(init.fn, init.arg);
    await ctx.addInitScript(items => { if (localStorage.getItem('seeded50')) return; localStorage.setItem('seeded50', '1'); for (const [k, v] of items) localStorage.setItem(k, typeof v === 'string' && v.startsWith('RAW:') ? v.slice(4) : JSON.stringify(v)); }, Object.entries(seed));
  }
  const page = await ctx.newPage(), errors = []; h.collect(page, errors);
  page.on('dialog', d => void d.accept());
  await page.goto(`${h.URL_BASE}/${debug ? DBG : 'weather-widget-v2.html'}`);
  await page.waitForFunction(() => document.getElementById('price').textContent.trim() !== '—', null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
  return { ctx, page, errors };
}
const ls = (page, k) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), k);
const ids = async (page, k) => ((await ls(page, k)) || []).map(x => x.id).sort().join(',');
const jsClick = (page, sel) => page.evaluate(sel => { const e = document.querySelector(sel); if (!e) throw new Error('fehlt: ' + sel); e.click(); }, sel);
const txt = (page, sel) => page.evaluate(sel => document.querySelector(sel)?.textContent ?? null, sel);
const vis = (page, sel) => page.evaluate(sel => { const e = document.querySelector(sel); return !!e && !e.hidden && !e.closest('[hidden]') && e.getClientRects().length > 0; }, sel);
const openData = page => page.evaluate(() => { if (document.getElementById('data-panel').hidden) document.getElementById('data-toggle').click(); });
async function download(page, sel, name) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), jsClick(page, sel)]);
  const f = path.join(os.tmpdir(), `m50-${name}`); await dl.saveAs(f); return { f, text: fs.readFileSync(f, 'utf8') };
}
async function backupFile(page, name) { await openData(page); const d = await download(page, '#backup-save', `${name}.json`); return { f: d.f, data: JSON.parse(d.text) }; }
async function loadFile(page, f) {
  await openData(page); await page.setInputFiles('#backup-file', f);
  await until(() => page.evaluate(() => !document.getElementById('sync-preview').hidden || /./.test(document.getElementById('history-status').textContent)), 8000);
  await page.waitForTimeout(150);
  return page.evaluate(() => { const b = document.getElementById('sync-preview'); return { shown: !b.hidden, items: [...b.querySelectorAll('.sp-list > li')].map(li => li.innerText.replace(/\s*\n\s*/g, ' ⏎ ')), head: b.querySelector('.sp-head')?.textContent || '', status: document.getElementById('history-status').textContent }; });
}
async function take(page, box = 'sync-preview') { await jsClick(page, `#${box} .sp-actions .button.primary-lite`); await until(() => page.evaluate(b => document.getElementById(b).hidden, box), 8000); await page.waitForTimeout(200); return page.textContent('#history-status'); }
const trade = (id, sym, pnl, closedAt, extra = {}) => ({ id, symbol: sym, side: 'long', mode: 'isolated', entry: 100, leverage: 10, qty: 1, margin: 10, openedAt: closedAt - 3600e3, source: 'spot', liqExchange: null, preRealized: 0, sl: null, tp: null, ack: { sl: false, tp: false }, note: '', exit: 100 + pnl, fees: 0, pnl, pnlSource: 'calc', closedAt, fx: 1.16, ...extra });
const position = (id, sym, entry, extra = {}) => ({ id, symbol: sym, side: 'long', mode: 'cross', entry, leverage: 10, qty: 1, margin: entry / 10, openedAt: Date.now() - 3600e3, source: 'spot', liqExchange: null, preRealized: 0, sl: null, tp: null, ack: { sl: false, tp: false }, ...extra });
const alarm = (id, sym, price, dir = 'above', extra = {}) => ({ id, symbol: sym, dir, price, note: '', source: 'spot', createdAt: Date.now() - 600e3, triggeredAt: null, triggerPrice: null, ...extra });
// feste Pseudozufallstexte (gleiches n → gleiche Daten): die Grenze 10/11 Teile ist so reproduzierbar
const rnd = (n, seed = 1) => { let x = seed * 2654435761 >>> 0; return Array.from({ length: n }, () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return 'abcdefghijklmnopqrstuvwxyz0123456789'[x % 36]; }).join(''); };
async function exportCode(page, pass = '') {
  await openData(page); await jsClick(page, '#code-export'); await page.waitForTimeout(150);
  await page.fill('#code-pass', pass); await jsClick(page, '#code-make');
  await until(() => page.evaluate(() => !document.getElementById('code-out').hidden && document.getElementById('code-text').value.length > 10), 15000);
  const code = await page.evaluate(() => document.getElementById('code-text').value), status = await txt(page, '#code-status');
  await jsClick(page, '#code-close'); return { code, status };
}
async function importCode(page, code, pass = null) {
  await openData(page); await jsClick(page, '#code-import'); await page.waitForTimeout(150);
  await page.fill('#code-in', code); await jsClick(page, '#code-check');
  await until(() => page.evaluate(() => !document.getElementById('code-preview').hidden || !document.getElementById('code-error').hidden || !document.getElementById('code-unlock').hidden || /Nichts Neues|Übernommen/.test(document.getElementById('code-status').textContent)), 15000);
  if (pass !== null && await page.evaluate(() => !document.getElementById('code-unlock').hidden)) { await page.fill('#code-in-pass', pass); await jsClick(page, '#code-check'); await until(() => page.evaluate(() => !document.getElementById('code-preview').hidden || !document.getElementById('code-error').hidden || /Nichts Neues|Übernommen/.test(document.getElementById('code-status').textContent)), 20000); }
  return page.evaluate(() => { const b = document.getElementById('code-preview'); return { shown: !b.hidden, items: [...b.querySelectorAll('.sp-list > li')].map(li => li.innerText.replace(/\s*\n\s*/g, ' ⏎ ')), error: document.getElementById('code-error').hidden ? '' : document.getElementById('code-error').textContent, status: document.getElementById('code-status').textContent, unlock: !document.getElementById('code-unlock').hidden }; });
}
async function takeCode(page) { await jsClick(page, '#code-preview .sp-actions .button.primary-lite'); await until(() => page.evaluate(() => document.getElementById('code-preview').hidden), 8000); await page.waitForTimeout(200); const s = await txt(page, '#code-status'); if (await page.evaluate(() => document.getElementById('code-dialog').open)) await jsClick(page, '#code-close'); return s; }
const confState = page => page.evaluate(() => { const d = document.getElementById('conf-dialog'); return { open: d.open, count: document.getElementById('conf-count').textContent, what: document.getElementById('conf-what').textContent, rows: [...document.querySelectorAll('#conf-table tbody tr')].map(r => [...r.children].map(c => c.textContent)), active: document.activeElement?.id || document.activeElement?.tagName, take: document.getElementById('conf-take').textContent }; });

const tests = {
  // ================= Prüfliste: nichts verschwindet still =================
  async integrity(browser) {
    const T0 = Date.UTC(2026, 8, 1, 10);
    const badPos = position('PB', 'ETHUSDT', -5), softPos = position('PS', 'XRPUSDT', 1.5, { sl: -1, tp: 'abc' });
    const seed = {
      'scalpdesk.positions.v1': [position('PA', 'BTCUSDT', 60000), badPos, softPos],
      'scalpdesk.history.v1': [trade('T1', 'BTCUSDT', 10, T0), trade('T2', 'ETHUSDT', -4, T0 + 3600e3), trade('T3', 'SOLUSDT', 7, T0 + 7200e3, { closedAt: undefined }), trade('T1', 'BTCUSDT', 99, T0, { note: 'abweichende Zweitfassung' }), trade('T4', 'LTCUSDT', 3, T0 + 9e6, { mode: 'hedge' })],
      'scalpdesk.alarms.v1': [alarm('A1', 'BTCUSDT', 70000), alarm('A2', 'ETHUSDT', 2000, 'sideways')],
      'scalpdesk.money.v1': 'RAW:"kaputt"' };
    const raw = { pos: 3, trades: 5, alarms: 2 };
    let { ctx, page, errors } = await openPage(browser, seed);
    const shown = await page.evaluate(() => ({ cards: [...document.querySelectorAll('#pos-list .pos-card')].map(c => c.dataset.id).sort().join(','), alarms: document.querySelectorAll('.al-row').length }));
    const Q = await ls(page, 'scalpdesk.quarantine.v1') || [];
    const qk = Q.map(x => `${x.kind}:${x.raw?.id ?? x.raw?.key ?? '?'}`).sort();
    check('Gültige Einträge geladen: Positionen PA und PS (PS ohne ungültigen Stop/Ziel), Alarm A1', shown.cards === 'PA,PS' && shown.alarms === 1, JSON.stringify(shown));
    check('Prüfliste: Position PB, Trades T3, T4, zweite Fassung T1, Alarm A2, kaputte Liste Geldbewegungen', qk.join() === 'alarm:A2,list:scalpdesk.money.v1,pos:PB,trade:T1,trade:T3,trade:T4', qk.join());
    const why = Object.fromEntries(Q.map(x => [x.raw?.id ?? 'list', x.why]));
    check('Gründe verständlich: „Einstieg fehlt oder ist nicht positiv“, „Schließzeit fehlt …“, „Margin-Modus ungültig („hedge“)“, „Kennung doppelt …“',
      /Einstieg fehlt/.test(why.PB) && /Schließzeit fehlt/.test(why.T3) && /Margin-Modus ungültig \(„hedge“\)/.test(why.T4) && /Kennung doppelt/.test(why.T1) && /Richtung \(über\/unter\)/.test(why.A2), JSON.stringify(why));
    check('Originaldaten unverändert in der Prüfliste (PB mit Einstieg −5, T1-Zweitfassung mit Notiz)', Q.find(x => x.raw?.id === 'PB')?.raw.entry === -5 && Q.find(x => x.raw?.id === 'T1')?.raw.note === 'abweichende Zweitfassung');
    const counted = shown.cards.split(',').length + Q.filter(x => x.kind === 'pos').length + (await page.evaluate(() => document.querySelectorAll('#history-list .trade-row').length)) + Q.filter(x => x.kind === 'trade').length;
    check('Kein Datensatz still verschwunden: jede gespeicherte Position und jeder Trade ist angezeigt oder in der Prüfliste', counted === raw.pos + raw.trades, `${counted} von ${raw.pos + raw.trades}`);
    const banner = await page.evaluate(() => ({ hidden: document.getElementById('integrity-banner').hidden, text: document.getElementById('integrity-text').textContent }));
    check('Hinweis oben: Einträge konnten nicht geladen werden und fehlen in Anzeigen und Summen', !banner.hidden && /6 Einträge konnten nicht geladen werden \(1 Position, 3 Trades\) und fehlen in Anzeigen und Summen/.test(banner.text) && /2 Werte ungültig/.test(banner.text), banner.text);
    const sums = await page.evaluate(() => ({ open: document.getElementById('open-total-eur').textContent, real: document.getElementById('realized-total-eur').textContent }));
    check('Summen sagen es dazu: „ohne 1 fehlerhafte Position“, „ohne 3 fehlerhafte Trades“', /ohne 1 fehlerhafte Position \(Prüfliste\)/.test(sums.open) && /ohne 3 fehlerhafte Trades \(Prüfliste\)/.test(sums.real), JSON.stringify(sums));
    const ps = (await ls(page, 'scalpdesk.positions.v1'))?.find(p => p.id === 'PS') || (await page.evaluate(() => null));
    await openData(page);
    const ql = await page.evaluate(() => ({ box: !document.getElementById('integrity').hidden, items: [...document.querySelectorAll('#quar-list .quar-item')].map(li => li.innerText.replace(/\s*\n\s*/g, ' | ')) }));
    check('Prüfliste im Bereich Datensicherung: 6 nicht geladene Einträge und 2 eingeschränkt geladene Werte (Stop-Loss −1, Take-Profit „abc“)', ql.box && ql.items.length === 8 && ql.items.some(t => /Stop-Loss: Originalwert „-1“ ungültig – ohne diesen Wert geladen/.test(t)) && ql.items.some(t => /Take-Profit: Originalwert „abc“/.test(t)), ql.items.join(' ## ').slice(0, 400));
    // Neu laden: keine doppelten Einträge; Speichern überschreibt die Originale nicht
    await page.reload(); await page.waitForTimeout(1500);
    check('Neu laden: Prüfliste bleibt bei 6 Einträgen (keine Doppelten)', (await ls(page, 'scalpdesk.quarantine.v1')).length === 6);
    await page.evaluate(() => { const i = document.getElementById('day-limit'); i.value = '40'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await jsClick(page, `.pos-card[data-id="PA"] [data-action="edit"]`).catch(() => {}); await page.waitForTimeout(150);
    await page.evaluate(() => { const n = document.getElementById('pos-note'); n.value = 'geändert'; n.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('pos-save').click(); }); await page.waitForTimeout(500);
    const after = await ls(page, 'scalpdesk.positions.v1'), Q2 = await ls(page, 'scalpdesk.quarantine.v1');
    check('Nach dem Speichern: Hauptliste ohne PB, PB samt Original weiter in der Prüfliste', !after.some(p => p.id === 'PB') && Q2.some(x => x.raw?.id === 'PB' && x.raw.entry === -5), after.map(p => p.id).join());
    check('PS gespeichert mit invalid = { sl: −1, tp: „abc“ } (Original erhalten)', JSON.stringify(after.find(p => p.id === 'PS')?.invalid) === '{"sl":-1,"tp":"abc"}', JSON.stringify(after.find(p => p.id === 'PS')?.invalid));
    // Export der Prüfliste
    await openData(page);
    const ex = await download(page, '#quar-export', 'pruefliste.json'), exj = JSON.parse(ex.text);
    check('Prüfliste als Datei: alle 6 Einträge mit Original und Grund, dazu die 2 eingeschränkten Werte', exj.kind === 'scalpdesk-quarantine' && exj.items.length === 6 && exj.fieldIssues.length === 2 && exj.items.every(x => x.raw !== undefined && x.why));
    // Korrigieren: PB mit Einstieg 2500 → wieder normale Position
    const pb = Q2.find(x => x.raw?.id === 'PB');
    await jsClick(page, `#quar-list [data-quar-edit="${pb.hq}"]`); await page.waitForTimeout(200);
    const dlg = await page.evaluate(() => ({ open: document.getElementById('quar-dialog').open, why: document.getElementById('quar-dlg-why').textContent, json: document.getElementById('quar-json').value }));
    check('„Ansehen / korrigieren“ zeigt Grund und Originaldaten', dlg.open && /Einstieg fehlt/.test(dlg.why) && /"entry": -5/.test(dlg.json), dlg.why);
    await page.evaluate(() => { const t = document.getElementById('quar-json'); t.value = t.value.replace('"entry": -5', '"entry": "x"'); }); await jsClick(page, '#quar-take'); await page.waitForTimeout(200);
    check('Noch ungültig: bleibt in der Prüfliste, Fehler wird genannt', /Noch nicht gültig – Einstieg fehlt/.test(await txt(page, '#quar-dlg-error')) && (await ls(page, 'scalpdesk.quarantine.v1')).length === 6, await txt(page, '#quar-dlg-error'));
    await page.evaluate(() => { const t = document.getElementById('quar-json'); t.value = t.value.replace('"entry": "x"', '"entry": 2500'); }); await jsClick(page, '#quar-take'); await page.waitForTimeout(500);
    check('Korrigiert: PB ist wieder eine normale Position, Prüfliste hat 5 Einträge', (await ls(page, 'scalpdesk.positions.v1')).some(p => p.id === 'PB' && p.entry === 2500) && (await ls(page, 'scalpdesk.quarantine.v1')).length === 5 && !!(await page.$('.pos-card[data-id="PB"]')));
    // Bewusst löschen
    const a2 = (await ls(page, 'scalpdesk.quarantine.v1')).find(x => x.raw?.id === 'A2');
    await jsClick(page, `#quar-list [data-quar-del="${a2.hq}"]`); await page.waitForTimeout(300);
    check('Löschen nach Rückfrage: Alarm A2 aus der Prüfliste entfernt', !(await ls(page, 'scalpdesk.quarantine.v1')).some(x => x.raw?.id === 'A2'));
    // „Erledigt“ für einen eingeschränkten Wert
    await jsClick(page, '#quar-list [data-quar-soft="pos|PS|sl"]'); await page.waitForTimeout(300);
    check('„Erledigt“ entfernt nur den Hinweis zum Stop-Loss (Take-Profit bleibt)', JSON.stringify((await ls(page, 'scalpdesk.positions.v1')).find(p => p.id === 'PS')?.invalid) === '{"tp":"abc"}');
    // Sicherung enthält die Prüfliste; auf leerem Gerät wiederhergestellt
    const b = await backupFile(page, 'integrity');
    check('Sicherung enthält die Prüfliste (4 Einträge) mit Originaldaten', Array.isArray(b.data.quarantine) && b.data.quarantine.length === 4 && b.data.quarantine.some(x => x.raw?.id === 'T3'));
    check('keine Fehler (Gerät 1)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
    ({ ctx, page, errors } = await openPage(browser, {}));
    const pv = await loadFile(page, b.f);
    check('Leeres Gerät: Vorschau nennt „Prüfliste des anderen Geräts: 4 Einträge“', pv.shown && pv.items.some(i => /^Prüfliste des anderen Geräts: 4 Einträge/.test(i)), pv.items.join(' ## '));
    await take(page);
    check('Übernommen: Prüfliste mit 4 Einträgen auch hier, Hinweis oben sichtbar', (await ls(page, 'scalpdesk.quarantine.v1'))?.length === 4 && await vis(page, '#integrity-banner'));
    check('keine Fehler (Gerät 2)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },
  // ================= Gründe: nichts kürzen, Herkunft des Setups =================
  async reasons(browser) {
    const T0 = Date.UTC(2026, 8, 2, 10), many = Array.from({ length: 25 }, (_, i) => `Grund ${i + 1}`), long = 'Ein sehr langer eigener Grund mit mehr als vierzig Zeichen Länge';
    const seed = { 'scalpdesk.history.v1': [
      trade('RM', 'BTCUSDT', 5, T0, { reasons: [...many, long], setup: 'Grund 1' }),
      trade('RP', 'ETHUSDT', 3, T0 + 3600e3, { reasons: ['RSI', 'News'], setup: 'Fibonacci', setupSeen: 'RSI' }), // ältere App hat das Setup geändert (nachweisbar)
      trade('RU', 'SOLUSDT', 2, T0 + 7200e3, { reasons: ['RSI', 'MACD'], setup: 'Funding' })] }; // Herkunft unklar (ohne setupSeen)
    const { ctx, page, errors } = await openPage(browser, seed);
    await page.evaluate(() => { document.getElementById('history').open = true; }); await page.waitForTimeout(300);
    const hist = Object.fromEntries((await page.evaluate(() => [...document.querySelectorAll('#history-list .trade-row')].map(r => [r.dataset.trade, r.textContent]))));
    check('26 Gründe (25 + einer mit 60 Zeichen) vollständig geladen und angezeigt – keine Kürzung auf 20/40', (hist.RM.match(/Grund \d+/g) || []).length === 25 && hist.RM.includes(long), hist.RM.slice(0, 120));
    await jsClick(page, '[data-trade="RM"] [data-action="trade-note"]'); await page.waitForTimeout(200);
    await page.evaluate(() => { const t = document.querySelector('[data-note="RM"]'); t.value = 'Notiz neu'; t.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.evaluate(() => [...document.querySelectorAll('[data-trade="RM"] [data-reason]')].find(b => b.dataset.reason === 'MACD')?.click());
    await jsClick(page, '[data-trade="RM"] [data-action="note-save"]'); await page.waitForTimeout(400);
    const rm = (await ls(page, 'scalpdesk.history.v1')).find(t => t.id === 'RM');
    check('Notiz bearbeitet: alle 26 Gründe bleiben, über 20 kommt kein neuer dazu (MACD nicht ergänzt)', rm.reasons.length === 26 && rm.reasons.includes(long) && !rm.reasons.includes('MACD') && rm.note === 'Notiz neu', `${rm.reasons.length} · ${rm.note}`);
    const rp = (await ls(page, 'scalpdesk.history.v1')).find(t => t.id === 'RP') || null;
    const rpShown = hist.RP;
    check('Ältere App änderte das Setup nachweisbar (setupSeen RSI → Fibonacci): erster Grund ersetzt, „News“ bleibt', /Gründe: Fibonacci, News/.test(rpShown), rpShown?.slice(0, 120));
    const conf = await ls(page, 'scalpdesk.conflicts.v1') || [];
    check('Herkunft unklar (Setup „Funding“, Gründe RSI, MACD): beide Fassungen erhalten, Konflikt zur Entscheidung', conf.length === 1 && conf[0].id === 'RU' && conf[0].why === 'setup' && JSON.stringify(conf[0].draft.reasons) === '["Funding","MACD"]' && /Gründe: RSI, MACD/.test(hist.RU), JSON.stringify(conf.map(c => [c.id, c.why, c.draft?.reasons])));
    check('Hinweis oben: 1 Konflikt wartet auf deine Entscheidung', /1 Konflikt wartet auf deine Entscheidung/.test(await txt(page, '#integrity-text')));
    await jsClick(page, '#integrity-conf'); await page.waitForTimeout(200);
    const cs = await confState(page);
    check('„Änderungen vergleichen“: Feld Gründe – bestätigt „RSI, MACD“, Entwurf „Funding, MACD“', cs.open && cs.rows.some(r => r[0] === 'Gründe' && r[1] === 'RSI, MACD' && r[2] === 'Funding, MACD'), JSON.stringify(cs.rows));
    await jsClick(page, '#conf-take'); await page.waitForTimeout(400);
    const ru = (await ls(page, 'scalpdesk.history.v1')).find(t => t.id === 'RU');
    check('„Entwurf übernehmen“: Gründe Funding, MACD; Konflikt erledigt', JSON.stringify(ru.reasons) === '["Funding","MACD"]' && ru.setup === 'Funding' && !(await ls(page, 'scalpdesk.conflicts.v1')).length, JSON.stringify(ru.reasons));
    void rp;
    check('keine Fehler', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },
  // ================= Sicherungsdatei: vollständig, Prüfsumme, alte Versionen, Rückgängig, Speicherfehler =================
  async backup(browser) {
    const Y1 = Date.UTC(2024, 5, 1), Y2 = Date.UTC(2026, 8, 1);
    const seed = {
      'scalpdesk.positions.v1': [position('BP', 'BTCUSDT', 60000, { sl: 58000 })], 'scalpdesk.demopositions.v1': [position('BD', 'ETHUSDT', 2500)],
      'scalpdesk.history.v1': [trade('B24', 'BTCUSDT', 12, Y1), trade('B26', 'ETHUSDT', -3, Y2)], 'scalpdesk.demohistory.v1': [trade('BDT', 'SOLUSDT', 4, Y2)],
      'scalpdesk.alarms.v1': [alarm('BA', 'BTCUSDT', 99000, 'above', { armedAt: Date.now() - 1000 })],
      'scalpdesk.money.v1': [{ id: 'BM', type: 'deposit', amount: 500, currency: 'EUR', fx: 1.16, date: Y1, note: '' }],
      'scalpdesk.channels.v1': { tg: { token: '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw', chat: '987654321', on: true }, dc: { url: 'https://discord.com/api/webhooks/1/geheim', on: true }, ev: { alarm: true } },
      'scalpdesk.s247.v1': { on: true, msg: 77, tag: 'ab12', at: Date.now() }, 'scalpdesk.theme.v1': 'light' };
    let { ctx, page, errors } = await openPage(browser, seed);
    await page.evaluate(() => { const s = document.getElementById('year-filter'); s.value = '2026'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await page.waitForTimeout(200);
    const b = await backupFile(page, 'voll'), d = b.data;
    const keys = ['positions', 'history', 'demoPositions', 'demoHistory', 'movements', 'alarms', 'setups', 'watchlist', 'settings', 'settingsH', 'deleted', 'deletedH', 'patterns', 'pnlAlarms', 'prefs', 'quarantine', 'conflicts'];
    check('Schema 8 mit persönlichen Bereichen und leeren kompatiblen Demofeldern (Positionen, Trades, Geld, Alarme, Einstellungen mit Abstammung, Listen, Löschungen, Muster, Prüfliste, Konflikte, Anzeige)', d.version === 8 && d.kind === 'full' && keys.every(k => k in d), keys.filter(k => !(k in d)).join());
    check('Neue Sicherung enthält keine Demo-Trades; vorhandene lokale Demo-Bücher bleiben erhalten', d.demoPositions.length === 0 && d.demoHistory.length === 0 && !d.prefs['scalpdesk.orderflow-demo.v1'] && (await ls(page,'scalpdesk.demopositions.v1')).length === 1 && (await ls(page,'scalpdesk.demohistory.v1')).length === 1);
    check('Alle Jahre enthalten, obwohl die Ansicht auf 2026 steht (Trade von 2024 dabei)', d.history.some(t => t.id === 'B24') && d.history.length === 2);
    check('Einträge tragen Abstammung (h, rev), Alarm behält Kennung und Aktivierung', d.positions[0].h && d.positions[0].rev >= 1 && d.alarms[0].id === 'BA' && d.alarms[0].armedAt > 0);
    const s = b.text = fs.readFileSync(b.f, 'utf8');
    check('Keine Zugangsdaten, keine Übergabe an den 24/7-Dienst, keine Sendesperren in der Sicherung', !/AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw|webhooks\/1\/geheim/.test(s) && !('s247' in d) && !/scalpdesk\.s247|scalpdesk\.channels|claims/.test(s));
    check('Anzeige-Einstellungen dabei (Design „hell“), Muster nur als eigenes Lernen mit Verweis auf den Startbestand', d.prefs['scalpdesk.theme.v1'] === 'light' && (d.patterns?.delta === true || !d.patterns?.base));
    check('Datei trägt Prüfsumme über den Inhalt (integrity: Schema 8, Bytes, CRC-32)', d.integrity?.schema === 8 && d.integrity.bytes > 100 && /^[0-9A-F]{8}$/.test(d.integrity.crc32), JSON.stringify(d.integrity));
    check('qr-scope-Auswahl gibt es nicht mehr', !(await page.$('input[name="qr-scope"]')));
    check('keine Fehler (Export)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
    // Verändert → abgelehnt, nichts übernommen
    const bad = path.join(os.tmpdir(), 'm50-manip.json'); fs.writeFileSync(bad, s.replace('"pnl": 12', '"pnl": 1200'));
    ({ ctx, page, errors } = await openPage(browser, {}));
    let pv = await loadFile(page, bad);
    check('Veränderte Datei: „Prüfsumme … stimmt nicht“, keine Vorschau, nichts übernommen', !pv.shown && /Prüfsumme der Sicherungsdatei stimmt nicht/.test(pv.status) && !(await ls(page, 'scalpdesk.history.v1')), pv.status);
    // Vollständig wiederherstellen
    pv = await loadFile(page, b.f);
    check('Vorschau vollständig: Quelle, Schema, persönliche Trades 2024 und 2026, Geldbewegung, Alarm ohne Demo', pv.shown && /Quelle: Datei m50-voll\.json \(Schema 8 · App \d+\.\d+\.\d+/.test(pv.head) && pv.items.some(i => /^Neu: 1 Position, 2 Trades, 1 Geldbewegung, 1 Kurs-Alarm/.test(i)) && !pv.items.some(i=>/Demo-Position|Demo-Trade/.test(i)), pv.head + ' ## ' + pv.items.join(' ## '));
    check('Anzeige-Einstellungen nur auf Wunsch (Kästchen nicht angehakt)', await page.evaluate(() => { const c = [...document.querySelectorAll('#sync-preview input[type=checkbox]')].find(x => /Anzeige-Einstellungen/.test(x.parentElement.textContent)); return !!c && !c.checked; }));
    let msg = await take(page);
    check('Übernommen; danach „Letzten Import rückgängig machen“ sichtbar', /^Übernommen: 1 Position neu, 2 Trades/.test(msg) && await vis(page, '#undo-import'), msg);
    check('Alarm BA mit derselben Kennung und Aktivierung (kein neuer Alarm)', (await ls(page, 'scalpdesk.alarms.v1'))?.[0]?.armedAt === d.alarms[0].armedAt);
    // Doppelter Import: nichts Neues
    pv = await loadFile(page, b.f);
    check('Zweites Einspielen derselben Datei: „Nichts Neues“, alle fünf persönlichen Einträge genau einmal', !pv.shown && /Nichts Neues – alle 5 Einträge waren schon aktuell/.test(pv.status) && (await ls(page, 'scalpdesk.history.v1')).length === 2, pv.status);
    // Rückgängig
    await page.evaluate(() => { const i = document.getElementById('day-limit'); i.value = '25'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await jsClick(page, '#undo-import'); await page.waitForLoadState('load'); await page.waitForTimeout(1500);
    check('„Letzten Import rückgängig machen“: Stand vor dem Import (leer) wiederhergestellt', !((await ls(page, 'scalpdesk.history.v1')) || []).length && !((await ls(page, 'scalpdesk.positions.v1')) || []).length);
    check('keine Fehler (Import)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
    // Alte Sicherungen bewusst übernehmen: Schema 3 (ohne Zeitpunkte, ohne Demo) und Schema 7
    const v3 = { app: 'scalp-desk', version: 3, exportedAt: Date.now() - 864e5 * 300, positions: [{ id: 'OLD1', symbol: 'XRPUSDT', side: 'short', entry: 0.5, leverage: 5, margin: 10, openedAt: Date.UTC(2025, 0, 2), source: 'spot', note: '' }], history: [{ ...trade('OLDT', 'BTCUSDT', 5, Date.UTC(2025, 0, 3)), setup: 'Ausbruch', reasons: undefined, mode: undefined, preRealized: undefined, fx: undefined }], setups: ['Ausbruch', 'Mein Setup'], watchlist: ['BTC', 'SOL'], settings: { dayLimit: 30 } };
    const f3 = path.join(os.tmpdir(), 'm50-v3.json'); fs.writeFileSync(f3, JSON.stringify(v3));
    ({ ctx, page, errors } = await openPage(browser, {}));
    pv = await loadFile(page, f3);
    check('Schema 3: Vorschau mit 1 Position (ohne Menge – aus Margin berechnet) und 1 Trade', pv.shown && pv.items.some(i => /^Neu: 1 Position, 1 Trade/.test(i)) && /ältere Version|Schema 3/.test(pv.head), pv.items.join(' ## '));
    await take(page);
    const o1 = (await ls(page, 'scalpdesk.positions.v1'))?.[0], ot = (await ls(page, 'scalpdesk.history.v1'))?.[0];
    check('Migriert: Menge = Margin × Hebel / Einstieg (100), Modus isoliert, Setup → Grund „Ausbruch“, fehlender EUR-Kurs → unbekannt (null)', o1?.qty === 100 && o1.mode === 'isolated' && JSON.stringify(ot?.reasons) === '["Ausbruch"]' && ot.fx === null && ot.preRealized === 0, JSON.stringify([o1?.qty, o1?.mode, ot?.reasons, ot?.fx]));
    // 3.29.0: Listen ohne Abstammung – hier nie geändert (Standard) → kommen aus der Sicherung; kein bloßes Zusammenführen mehr
    const ol = { setups: await ls(page, 'scalpdesk.setups.v1'), watch: await ls(page, 'scalpdesk.watchlist.v1'), lim: await ls(page, 'scalpdesk.daylimit.v1'), conf: (await ls(page, 'scalpdesk.conflicts.v1')) || [] };
    check('Hier nie geänderte Einstellungen und Listen kommen aus der alten Sicherung (Setups „Ausbruch, Mein Setup“, Vorauswahl „BTC, SOL“, Limit 30), kein Konflikt', JSON.stringify(ol.setups) === '["Ausbruch","Mein Setup"]' && JSON.stringify(ol.watch) === '["BTC","SOL"]' && ol.lim === 30 && !ol.conf.length, JSON.stringify(ol));
    const legacyDemo=path.join(os.tmpdir(),'m50-alte-demo-v7.json');fs.writeFileSync(legacyDemo,JSON.stringify({app:'scalp-desk',version:7,exportedAt:Date.now(),demoPositions:[position('ALTE-DEMO-DATEI','ETHUSDT',2500)],positions:[],history:[]}));pv=await loadFile(page,legacyDemo);await take(page);
    check('Alte Demo-Sicherung bleibt bewusst importierbar; neue Exporte bleiben ohne Demo', (await ls(page,'scalpdesk.demopositions.v1')).some(p=>p.id==='ALTE-DEMO-DATEI') && (await ls(page,'scalpdesk.positions.v1')).some(p=>p.id==='OLD1') && await page.evaluate(()=>__g05.backupPayload().demoPositions.length===0));
    // Neuere Schema-Version → abgelehnt
    const f9 = path.join(os.tmpdir(), 'm50-v9.json'); fs.writeFileSync(f9, JSON.stringify({ ...v3, version: 9 }));
    pv = await loadFile(page, f9);
    check('Schema 9 (neuere App): verständlich abgelehnt, nichts geändert', !pv.shown && /neueren App-Version \(Schema 9\)/.test(pv.status), pv.status);
    check('keine Fehler (alte Sicherungen)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
    // Speicherfehler beim Übernehmen: bisheriger Stand bleibt
    ({ ctx, page, errors } = await openPage(browser, { 'scalpdesk.positions.v1': [position('KEEP', 'LTCUSDT', 80)] }));
    await page.evaluate(() => { const put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (v, k) { if (k === 'scalpdesk.history.v1' && window.__failPut) throw new DOMException('Speicher voll (Test)', 'QuotaExceededError'); return put.call(this, v, k); }; window.__failPut = true; });
    pv = await loadFile(page, b.f);
    msg = await take(page);
    const st = await page.evaluate(() => ({ cards: [...document.querySelectorAll('#pos-list .pos-card')].map(c => c.dataset.id).join(','), trades: document.querySelectorAll('#history-list .trade-row').length }));
    check('Speicherfehler: „Speichern fehlgeschlagen … der bisherige Stand bleibt“, Anzeige unverändert (nur KEEP, keine Trades)', /Speichern fehlgeschlagen .* der bisherige Stand bleibt, nichts wurde übernommen/.test(msg) && st.cards === 'KEEP' && st.trades === 0, `${msg} · ${JSON.stringify(st)}`);
    await page.evaluate(() => { window.__failPut = false; });
    await page.reload(); await page.waitForTimeout(1500);
    check('Nach dem Neuladen: nur KEEP (der fehlgeschlagene Import ist nicht halb übernommen)', (await ids(page, 'scalpdesk.positions.v1')) === 'KEEP' && !((await ls(page, 'scalpdesk.history.v1')) || []).length, await ids(page, 'scalpdesk.positions.v1'));
    check('keine Fehler (Speicherfehler)', !real(errors).filter(e => !/Speicher voll \(Test\)/.test(e)).length, real(errors).join(' | ')); await ctx.close();
  },
  // ================= Textcode: iPhone → PC, Passwort, beschädigt, Grenzen =================
  async code(browser) {
    const T0 = Date.UTC(2026, 8, 3, 9), trades = Array.from({ length: 300 }, (_, i) => trade('C' + i, i % 2 ? 'BTCUSDT' : 'ETHUSDT', (i % 7) - 3, T0 + i * 60e3, { note: 'Trade Nummer ' + i }));
    let A = await openPage(browser, { 'scalpdesk.history.v1': trades, 'scalpdesk.positions.v1': [position('CP', 'BTCUSDT', 60000)] }, { viewport: { width: 390, height: 844 }, perm: true });
    const e1 = await exportCode(A.page);
    check('Textcode erzeugt: beginnt mit „SDB1:“, endet mit einem Punkt, Größe und Prüfsumme genannt, ohne Passwort lesbar', /^SDB1:[A-Za-z0-9+/=]+\.$/.test(e1.code) && /KB Text .* gepackt, ohne Passwort lesbar\) · Prüfsumme [0-9A-F]{8}/.test(e1.status), e1.status);
    const e2 = await exportCode(A.page, 'geheim12');
    check('Mit Passwort: verschlüsselt', /verschlüsselt/.test(e2.status), e2.status);
    await jsClick(A.page, '#code-export'); await A.page.fill('#code-pass', ''); await jsClick(A.page, '#code-make'); await A.page.waitForTimeout(800); await jsClick(A.page, '#code-copy'); await A.page.waitForTimeout(200);
    const clip = await A.page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
    check('„Kopieren“ legt den Textcode in die Zwischenablage und zählt als Sicherung', clip.startsWith('SDB1:') && /Kopiert/.test(await txt(A.page, '#code-status')) && /als Textcode/.test(await txt(A.page, '#backup-info')), await txt(A.page, '#backup-info'));
    check('keine Fehler (iPhone)', !real(A.errors).length, real(A.errors).join(' | ')); await A.ctx.close();
    const B = await openPage(browser, {}, { viewport: { width: 1440, height: 900 } });
    let r = await importCode(B.page, e1.code.slice(0, Math.floor(e1.code.length * 0.7)));
    check('Abgeschnittener Textcode: „unvollständig – das Ende … fehlt“, nichts übernommen', !r.shown && /unvollständig – das Ende/.test(r.error) && !(await ls(B.page, 'scalpdesk.history.v1')), r.error);
    r = await importCode(B.page, 'Hier ist mein Code:\n' + e2.code.replace(/(.{76})/g, '$1\n') + '\nGruß', 'falsch12');
    check('Mit Zeilenumbrüchen und Text drumherum erkannt; falsches Passwort abgewiesen', /Passwort falsch/.test(r.error), r.error || r.status);
    await B.page.fill('#code-in-pass', 'geheim12'); await jsClick(B.page, '#code-check'); await until(() => B.page.evaluate(() => !document.getElementById('code-preview').hidden), 15000);
    r = await B.page.evaluate(() => ({ items: [...document.querySelectorAll('#code-preview .sp-list > li')].map(li => li.innerText.replace(/\s*\n\s*/g, ' ⏎ ')) }));
    check('Richtiges Passwort: Vorschau mit 1 Position und 300 Trades', r.items.some(i => /^Neu: 1 Position, 300 Trades/.test(i)), r.items.join(' ## '));
    const t0 = Date.now(); const m = await takeCode(B.page);
    check('Übernommen am PC: 300 Trades, 1 Position', /^Übernommen: 1 Position neu, 300 Trades/.test(m) && (await ls(B.page, 'scalpdesk.history.v1')).length === 300, `${m} (${Date.now() - t0} ms)`);
    // Manipulierte Packung: Kopf sagt 100 Byte, entpackt sind es 2 MB → abgelehnt
    const big = Buffer.alloc(2e6, 0x20), z = zlib.deflateRawSync(big), head = Buffer.alloc(16); head.write('SB', 0, 'latin1'); head[2] = 1; head[3] = 1; head[4] = 1; head.writeUInt16BE(8, 5); head.writeUInt32BE(100, 7); head.writeUInt32BE(0, 11);
    r = await importCode(B.page, 'SDB1:' + Buffer.concat([head, z]).toString('base64') + '.');
    check('Manipulierte Packung (entpackt größer als angegeben): abgelehnt', /Entpackt größer als angegeben/.test(r.error), r.error);
    const head9 = Buffer.from(head); head9.writeUInt16BE(9, 5);
    r = await importCode(B.page, 'SDB1:' + Buffer.concat([head9, z]).toString('base64') + '.');
    check('Code aus einer neueren App-Version (Schema 9): verständlich abgelehnt', /neueren App-Version \(Schema 9\)/.test(r.error), r.error);
    const cut = e1.code.slice(0, 40) + e1.code.slice(60), r2 = await importCode(B.page, cut);
    check('Code mit fehlendem Mittelstück (Ende vorhanden): erkannt, nichts übernommen', /beschädigt oder unvollständig|Prüfsumme stimmt nicht/.test(r2.error) && (await ls(B.page, 'scalpdesk.history.v1')).length === 300, r2.error);
    check('keine Fehler (PC)', !real(B.errors).length, real(B.errors).join(' | ')); await B.ctx.close();
  },
  // ================= QR-Code: höchstens 10 Teile, Wechsel, Lesbarkeit, Scan =================
  async qr(browser) {
    writeDebugPage();
    const T0 = Date.UTC(2026, 8, 4, 9), mk = n => Array.from({ length: n }, (_, i) => trade('Q' + i, 'BTCUSDT', 1, T0 + i * 60e3, { note: rnd(120, i + 7) }));
    const parts = async page => { await openData(page); await jsClick(page, '#qr-export'); await until(() => page.evaluate(() => /Teil/.test(document.getElementById('qr-calc').textContent)), 15000); const t = await txt(page, '#qr-calc'); await jsClick(page, '#qr-close'); return { n: Number((/· (\d+) Teile?/.exec(t) || [])[1] || 0), t }; };
    // Größe suchen: genau 10 und genau 11 Teile
    let lo = 5, hi = 120, n10 = null, n11 = null, seen = new Map();
    const probe = async n => { if (seen.has(n)) return seen.get(n); const P = await openPage(browser, { 'scalpdesk.history.v1': mk(n) }, { debug: true }); const r = await parts(P.page); await P.ctx.close(); seen.set(n, r.n); return r.n; };
    while (lo < hi) { const mid = (lo + hi) >> 1; if (await probe(mid) <= 10) lo = mid + 1; else hi = mid; }
    // 3.54.0: neue persönliche Journalbücher ändern die Packgröße. Die tatsächlich berechnete,
    // tatsächlich erzeugte vollständige Packung behalten; keine feste Tradezahl als Teilezahl ausgeben.
    const prepared = async (n, target, extra = {}, viewport = { width: 1600, height: 1000 }) => {
      for (let attempt = 0; attempt < 20; attempt++) {
        const P = await openPage(browser, { 'scalpdesk.history.v1': mk(n), ...extra }, { debug: true, viewport });
        await openData(P.page); await jsClick(P.page, '#qr-export');
        const ready = await until(() => P.page.evaluate(() => /Teil/.test(document.getElementById('qr-calc').textContent)), 15000);
        const before = await txt(P.page, '#qr-calc'); await jsClick(P.page, '#qr-make');
        const generated = await until(() => P.page.evaluate(() => !document.getElementById('qr-big').hidden || !document.getElementById('qr-out').hidden), 20000);
        const actual = Number((/· (\d+) Teile?/.exec(await txt(P.page, '#qr-calc')) || [])[1] || 0);
        console.log('  QR-Testpackung:', JSON.stringify({ attempt, n, target, actual, viewport: viewport.width, before, generated }));
        if (ready && generated && actual === target) {
          if (target <= 10) await P.page.evaluate(() => { if (!__g.qr.paused) document.getElementById('qr-pause').click(); });
          return { ...P, n, parts: actual, before };
        }
        await P.ctx.close(); if (!ready || !actual) throw new Error('QR-Testpackung nicht bereit');
        n = Math.max(5, Math.min(120, n + (actual < target ? 1 : -1)));
      }
      throw new Error('Keine vollständige QR-Testpackung mit genau ' + target + ' Teilen gefunden');
    };
    const ten = await prepared(lo - 1, 10, { 'scalpdesk.alarms.v1': [alarm('QA', 'ETHUSDT', 3000)], 'scalpdesk.theme.v1': 'dark' }, { width: 390, height: 844 });
    const eleven = await prepared(lo, 11); n10 = ten.n; n11 = eleven.n;
    check('Testgröße gefunden: genau 10 und 11 Teile (vollständige eingefrorene Sicherungen)', ten.parts === 10 && eleven.parts === 11, `Test mit ${n10} (10 Teile) und ${n11} (11 Teile)`);
    // 11 Teile → kein QR, Textcode/Datei angeboten
    let S = eleven; // bereits aus der vollständigen Sicherung erzeugt
    await until(() => S.page.evaluate(() => !document.getElementById('qr-big').hidden || !document.getElementById('qr-out').hidden), 15000);
    const big = await S.page.evaluate(() => ({ big: !document.getElementById('qr-big').hidden, text: document.getElementById('qr-big-text').textContent, out: !document.getElementById('qr-out').hidden }));
    check('11 Teile: kein QR-Code, „Sicherung zu groß für QR: 11 Teile nötig, höchstens 10 – Textcode oder Datei verwenden“', big.big && !big.out && /11 Teile nötig, höchstens 10 – Textcode oder Datei verwenden\. Es wird nichts weggelassen/.test(big.text), big.text);
    check('… mit Knöpfen „Textcode anzeigen“ und „Backup herunterladen“', await vis(S.page, '#qr-big-code') && await vis(S.page, '#qr-big-file'));
    await S.ctx.close();
    // 10 Teile → einzeln, groß, Wechsel
    S = ten; // exakt die oben erzeugte Packung, einschließlich Alarm und eigener Bücher
    for (let i = 0; i < 10 && await S.page.evaluate(() => __g.qr.idx !== 0); i++) await jsClick(S.page, '#qr-prev');
    await jsClick(S.page, '#qr-pause'); // bei Teil 1 weiterlaufen lassen
    const calc = ten.before;
    check('Vor dem Start: vollständige Sicherung, gepackte Größe und Teilezahl', /Vollständige Sicherung: .*Trades.*KB gepackt · \d+ Teile/.test(calc), calc);
    await until(() => S.page.evaluate(() => !document.getElementById('qr-out').hidden), 20000); // erzeugte Packung unverändert lassen
    const q = await S.page.evaluate(() => { const c = document.getElementById('qr-canvas'), ctx = c.getContext('2d'), px = (x, y) => ctx.getImageData(x, y, 1, 1).data[0]; const k = Number(c.dataset.px), s = c.width / c.getBoundingClientRect().width;
      return { n: __g.qr.codes.length, label: document.getElementById('qr-part').textContent, ver: Number(c.dataset.version), ecl: c.dataset.ecl, k, w: c.getBoundingClientRect().width, size: __g.qr.codes[0].size, corner: px(1, 1), finder: px(Math.round((4 + 3.5) * k * s), Math.round((4 + 3.5) * k * s)), vw: innerWidth }; });
    check('Mobil (390 px): 10 Teile, „Teil 1 von 10 · wechselt alle 1 s“', q.n === 10 && /^Teil 1 von 10 · wechselt alle 1 s/.test(q.label), JSON.stringify(q));
    check('Lesbarkeit: Fehlerkorrektur M, Version ≤ 20, ganze 3+ CSS-Pixel je Modul, 4 Module Rand', q.ecl === 'M' && q.ver <= 20 && q.k >= 3 && Number.isInteger(q.k) && Math.abs(q.w - (q.size + 8) * q.k) < 0.5, `M=${q.ecl} v${q.ver} ${q.k}px ${q.w}px`);
    check('Schwarz auf weiß auch im dunklen Design (Rand weiß, Suchmuster schwarz)', q.corner === 255 && q.finder === 0, `${q.corner}/${q.finder}`);
    const seq = []; for (let i = 0; i < 6; i++) { seq.push(Number((/Teil (\d+)/.exec(await txt(S.page, '#qr-part')) || [])[1])); await h.sleep(500); }
    check('Automatischer Wechsel in Endlosschleife (Teil wechselt etwa jede Sekunde)', new Set(seq).size >= 3, seq.join(','));
    await S.page.selectOption('#qr-speed', '500'); const s5 = []; for (let i = 0; i < 6; i++) { s5.push(Number((/Teil (\d+)/.exec(await txt(S.page, '#qr-part')) || [])[1])); await h.sleep(250); }
    check('Geschwindigkeit 0,5 s wählbar („wechselt alle 0,5 s“)', /wechselt alle 0,5 s/.test(await txt(S.page, '#qr-part')) && new Set(s5).size >= 3, s5.join(','));
    await jsClick(S.page, '#qr-pause'); const p1 = await txt(S.page, '#qr-part'); await h.sleep(1500);
    check('Pause hält den Teil an („angehalten“), Weiter setzt fort', p1 === await txt(S.page, '#qr-part') && /angehalten/.test(p1) && await txt(S.page, '#qr-pause') === 'Weiter', p1);
    const cur = Number((/Teil (\d+)/.exec(p1) || [])[1]); await jsClick(S.page, '#qr-next'); const nx = Number((/Teil (\d+)/.exec(await txt(S.page, '#qr-part')) || [])[1]); await jsClick(S.page, '#qr-prev'); await jsClick(S.page, '#qr-prev'); const pv2 = Number((/Teil (\d+)/.exec(await txt(S.page, '#qr-part')) || [])[1]);
    check('Vor und Zurück (von 10 weiter zu 1)', nx === cur % 10 + 1 && pv2 === ((cur + 8) % 10) + 1, `${cur}→${nx}→${pv2}`);
    // Alle Teile als Bild abgreifen und die Texte merken
    const shots = new Map();
    for (let i = 0; i < 10; i++) { await S.page.evaluate(i => { document.getElementById('qr-pause').click(); }, i); break; }
    for (let t = 0; t < 40 && shots.size < 10; t++) { const i = Number((/Teil (\d+)/.exec(await txt(S.page, '#qr-part')) || [])[1]); if (!shots.has(i)) shots.set(i, await S.page.$eval('#qr-canvas', c => c.toDataURL('image/png'))); await jsClick(S.page, '#qr-next'); }
    const texts = await S.page.evaluate(() => __g.qr.sp.parts);
    check('Alle 10 Teile abgegriffen', shots.size === 10, shots.size);
    check('Jeder Teil nennt Übertragung, Nummer, Anzahl und Gesamtprüfsumme', texts.every((t, i) => new RegExp(`^SQ1:${i + 1}:10:[0-9A-Z]{6}:[0-9A-F]{8}:\\d+:`).test(t)) && new Set(texts.map(t => t.split(':')[3])).size === 1);
    check('keine Fehler (Sender)', !real(S.errors).length, real(S.errors).join(' | ')); await S.ctx.close();
    // Empfänger: Fotos durcheinander und doppelt, ein widersprüchlicher Teil, erst vollständig übernehmen
    const R = await openPage(browser, {}, { debug: true, viewport: { width: 820, height: 1180 } });
    await openData(R.page); await jsClick(R.page, '#qr-scan'); await R.page.waitForTimeout(800);
    const order = [7, 2, 9, 2, 5, 1, 7, 10, 3];
    for (const i of order) { const f = path.join(os.tmpdir(), `m50-qr-${i}.png`); fs.writeFileSync(f, Buffer.from(shots.get(i).split(',')[1], 'base64')); await R.page.setInputFiles('#qr-photo', f); await R.page.waitForTimeout(350); }
    const prog = await R.page.evaluate(() => ({ status: document.getElementById('qr-scan-status').textContent, boxes: [...document.querySelectorAll('#qr-scan-parts i')].map(i => i.className === 'ok' ? 1 : 0).join('') }));
    check('Durcheinander und doppelt gescannt: „7 von 10 Teilen gelesen – fehlt noch: 4, 6, 8“', /^7 von 10 Teilen gelesen – fehlt noch: 4, 6, 8\./.test(prog.status) && prog.boxes === '1110101011', JSON.stringify(prog));
    check('Kein vorzeitiger Import (noch keine Vorschau, keine Daten)', await R.page.evaluate(() => document.getElementById('qr-preview').hidden) && !(await ls(R.page, 'scalpdesk.history.v1')));
    const bad1 = (() => { const p = texts[0].split(':'), d = p.slice(6).join(':'); return [...p.slice(0, 6), (d[0] === 'A' ? 'B' : 'A') + d.slice(1)].join(':'); })();
    await R.page.evaluate(t => __g.onScanText(t), bad1);
    const warn1 = await txt(R.page, '#qr-scan-warn');
    check('Widersprüchlicher Teil (Teil 1 mit anderem Inhalt): abgelehnt, Hinweis', /Teil 1 widerspricht einem schon gelesenen Teil – abgelehnt/.test(warn1), warn1);
    await R.page.evaluate(t => __g.onScanText(t), texts[3].replace(/^SQ1:4:10:/, 'SQ1:4:9:'));
    check('Teil mit abweichender Anzahl: ignoriert, zählt nicht', /passt nicht zur laufenden Übertragung/.test(await txt(R.page, '#qr-scan-warn')) && /^7 von 10/.test(await txt(R.page, '#qr-scan-status')));
    for (const i of [4, 6]) { const f = path.join(os.tmpdir(), `m50-qr-${i}.png`); fs.writeFileSync(f, Buffer.from(shots.get(i).split(',')[1], 'base64')); await R.page.setInputFiles('#qr-photo', f); await R.page.waitForTimeout(350); }
    check('9 von 10: weiter keine Vorschau', /^9 von 10 Teilen gelesen – fehlt noch: 8\./.test(await txt(R.page, '#qr-scan-status')) && await R.page.evaluate(() => document.getElementById('qr-preview').hidden), await txt(R.page, '#qr-scan-status'));
    { const f = path.join(os.tmpdir(), 'm50-qr-8.png'); fs.writeFileSync(f, Buffer.from(shots.get(8).split(',')[1], 'base64')); await R.page.setInputFiles('#qr-photo', f); }
    await until(() => R.page.evaluate(() => !document.getElementById('qr-preview').hidden), 15000);
    const items = await R.page.evaluate(() => [...document.querySelectorAll('#qr-preview .sp-list > li')].map(li => li.innerText.replace(/\s*\n\s*/g, ' ⏎ ')));
    check('Alle 10 gelesen, Prüfsumme stimmt → Vorschau (ohne Passwort)', items.some(i => new RegExp(`^Neu: ${n10} Trades, 1 Kurs-Alarm`).test(i)), items.join(' ## '));
    await jsClick(R.page, '#qr-preview .sp-actions .button.primary-lite'); await R.page.waitForTimeout(600);
    check('Übernommen: alle Trades und der Alarm', (await ls(R.page, 'scalpdesk.history.v1'))?.length === n10 && (await ls(R.page, 'scalpdesk.alarms.v1'))?.[0]?.id === 'QA');
    check('keine Fehler (Empfänger)', !real(R.errors).length, real(R.errors).join(' | ')); await R.ctx.close();
    try { fs.unlinkSync(`${REPO}/${DBG}`); } catch {}
  },
  // ================= Konflikte: zwei Geräte, gleiche Grundlage, falsche Uhr =================
  async conflict(browser) {
    const T0 = Date.UTC(2026, 8, 5, 9);
    const base = { 'scalpdesk.history.v1': [trade('K1', 'BTCUSDT', 10, T0, { note: 'Basis' }), trade('K2', 'ETHUSDT', 5, T0 + 3600e3, { note: 'Basis' }), trade('K3', 'SOLUSDT', 3, T0 + 7200e3), trade('K4', 'XRPUSDT', 2, T0 + 9e6), trade('K5', 'LTCUSDT', 1, T0 + 1e7)],
      'scalpdesk.alarms.v1': [alarm('KA', 'BTCUSDT', 99000), alarm('KB', 'ETHUSDT', 99000)], 'scalpdesk.risk.v1': { riskPct: 1, feePct: 0.06 } };
    // iPhone (richtige Uhr) und iPad (Uhr zwei Tage vor) mit derselben Grundlage
    const clock = { fn: off => { const D = Date, now = D.now.bind(D); Date.now = () => now() + off; }, arg: 2 * 864e5 };
    const P = await openPage(browser, base, { viewport: { width: 390, height: 844 } });
    const e0 = await exportCode(P.page);
    const Q = await openPage(browser, {}, { viewport: { width: 820, height: 1180 }, init: clock });
    let r = await importCode(Q.page, e0.code); await takeCode(Q.page);
    check('Grundlage auf beiden Geräten (iPad mit 2 Tage vorgehender Uhr)', (await ids(Q.page, 'scalpdesk.history.v1')) === 'K1,K2,K3,K4,K5');
    const note = async (page, id, text) => {
      await page.evaluate(() => { document.getElementById('history').open = true; }); await page.waitForTimeout(150);
      await jsClick(page, `[data-trade="${id}"] [data-action="trade-note"]`); await page.waitForTimeout(150);
      await page.evaluate(([id, t]) => { const x = document.querySelector(`[data-note="${id}"]`); x.value = t; x.dispatchEvent(new Event('input', { bubbles: true })); }, [id, text]);
      await jsClick(page, `[data-trade="${id}"] [data-action="note-save"]`); await page.waitForTimeout(300);
    };
    const delTrade = async (page, id) => { await page.evaluate(() => { document.getElementById('history').open = true; }); await jsClick(page, `[data-trade="${id}"] [data-action="trade-delete"]`); await page.waitForTimeout(100); await jsClick(page, `[data-trade="${id}"] [data-action="trade-confirm"]`); await page.waitForTimeout(300); };
    // Offline-Änderungen: K1 auf beiden Geräten verschieden, K2 nur auf dem iPad (iPad-Uhr vor), K3 nur am iPhone,
    // K4 am iPad gelöscht / am iPhone geändert, K5 am iPad gelöscht (am iPhone unverändert)
    await note(P.page, 'K1', 'iPhone sagt A'); await note(Q.page, 'K1', 'iPad sagt B');
    await note(Q.page, 'K2', 'iPad Nachtrag'); await note(P.page, 'K3', 'iPhone Nachtrag');
    await note(P.page, 'K4', 'iPhone ändert'); await delTrade(Q.page, 'K4'); await delTrade(Q.page, 'K5');
    await P.page.evaluate(() => { const i = document.getElementById('risk-pct'); i.value = '1,5'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await Q.page.evaluate(() => { const i = document.getElementById('risk-pct'); i.value = '2'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    const eQ = await exportCode(Q.page);
    r = await importCode(P.page, eQ.code);
    check('Vorschau am iPhone: geändert K2 (iPad, schneller Vorlauf), gelöscht K5, Konflikte K1, K4 und Risiko-Rechner', r.shown && r.items.some(i => /^Geändert: 1 Trade/.test(i) && /K2|ETH/.test(i)) && r.items.some(i => /^Auf dem anderen Gerät gelöscht: 1 Trade/.test(i)) && r.items.some(i => /^⚖ Konflikte: 3/.test(i)), r.items.join(' ## '));
    let m = await takeCode(P.page);
    check('Übernommen: K2 vom iPad, K5 gelöscht; „3 Konflikte warten auf deine Entscheidung“', /3 Konflikte warten auf deine Entscheidung/.test(m) && (await ls(P.page, 'scalpdesk.history.v1')).find(t => t.id === 'K2')?.note === 'iPad Nachtrag' && !(await ls(P.page, 'scalpdesk.history.v1')).some(t => t.id === 'K5'), m);
    check('K3 (nur am iPhone geändert, iPad hat die ältere Fassung) bleibt ohne Rückfrage', (await ls(P.page, 'scalpdesk.history.v1')).find(t => t.id === 'K3')?.note === 'iPhone Nachtrag');
    let cs = await until(async () => { const c = await confState(P.page); return c.open ? c : null; }, 5000) || await confState(P.page);
    check('Dialog „Änderungen vergleichen“ öffnet sich: Konflikt 1 von 3', cs.open && /^Konflikt 1 von 3/.test(cs.count), cs.count);
    check('Nichts vorausgewählt (Fokus auf der Überschrift, nicht auf einer Wahl)', cs.active === 'conf-title', cs.active);
    const k1 = cs.rows.find(x => x[0] === 'Notiz');
    check('K1: Feld „Notiz“ – bestätigter Stand „iPhone sagt A“, Entwurf „iPad sagt B“ (keine Entscheidung nach Uhrzeit)', k1 && k1[1] === 'iPhone sagt A' && k1[2] === 'iPad sagt B' && (await ls(P.page, 'scalpdesk.history.v1')).find(t => t.id === 'K1').note === 'iPhone sagt A', JSON.stringify(cs.rows));
    await jsClick(P.page, '#conf-later'); cs = await confState(P.page);
    check('„Später entscheiden“: nächster Konflikt, K1 bleibt offen', /^Konflikt 2 von 3/.test(cs.count), cs.count);
    const rest = []; for (let i = 0; i < 2; i++) { const c = await confState(P.page); rest.push(c.what + ' ' + JSON.stringify(c.rows)); await jsClick(P.page, '#conf-later'); }
    check('K4 „dort gelöscht, hier vorhanden“ und Risiko-Rechner (1,5 % gegen 2 %) als Konflikte', rest.some(t => /auf dem anderen Gerät gelöscht, hier noch vorhanden/.test(t)) && rest.some(t => /Risiko-Rechner/.test(t) && /Risiko 1,5 %/.test(t) && /Risiko 2 %/.test(t)), rest.join(' ## '));
    await P.page.reload(); await P.page.waitForTimeout(1500);
    check('Nach Neuladen weiter offen: Hinweis „3 Konflikte warten auf deine Entscheidung“, bestätigter Stand gilt', /3 Konflikte warten/.test(await txt(P.page, '#integrity-text')) && (await ls(P.page, 'scalpdesk.history.v1')).find(t => t.id === 'K1').note === 'iPhone sagt A');
    const bk = await backupFile(P.page, 'mit-konflikten');
    check('Sicherung enthält die offenen Konflikte mit beiden Fassungen', bk.data.conflicts.length === 3 && bk.data.conflicts.some(c => c.id === 'K1' && c.draft.note === 'iPad sagt B' && c.local.note === 'iPhone sagt A'));
    // Entscheiden: K1 Entwurf übernehmen, K4 behalten, Risiko behalten
    await jsClick(P.page, '#integrity-conf'); await P.page.waitForTimeout(200);
    for (let i = 0; i < 3; i++) { const c = await confState(P.page); if (/Notiz/.test(JSON.stringify(c.rows))) await jsClick(P.page, '#conf-take'); else await jsClick(P.page, '#conf-keep'); await P.page.waitForTimeout(250); }
    const hp = await ls(P.page, 'scalpdesk.history.v1');
    check('Entschieden: K1 = „iPad sagt B“ (Entwurf), K4 bleibt mit „iPhone ändert“, Risiko bleibt 1,5 %, keine Konflikte mehr', hp.find(t => t.id === 'K1').note === 'iPad sagt B' && hp.find(t => t.id === 'K4')?.note === 'iPhone ändert' && (await ls(P.page, 'scalpdesk.risk.v1')).riskPct === 1.5 && !(await ls(P.page, 'scalpdesk.conflicts.v1')).length);
    // Wiederholung (Command-Retry): derselbe iPad-Code noch einmal → keine neue Rückfrage, nichts doppelt
    r = await importCode(P.page, eQ.code);
    check('Derselbe Code noch einmal: keine neuen Konflikte, nichts doppelt (bereits entschieden)', !r.shown && /Nichts Neues/.test(r.status) && (await ls(P.page, 'scalpdesk.history.v1')).length === 4 && !(await ls(P.page, 'scalpdesk.conflicts.v1')).length, r.status + ' ' + r.items.join(' ## '));
    if (await P.page.evaluate(() => document.getElementById('code-dialog').open)) await jsClick(P.page, '#code-close');
    // Zurück zum iPad: Entscheidungen des iPhones kommen als schneller Vorlauf an
    const eP = await exportCode(P.page);
    r = await importCode(Q.page, eP.code);
    const items = r.items.join(' ## ');
    check('iPad übernimmt die Entscheidungen ohne erneute Rückfrage für K1 (Entwurf war seine Fassung)', !/Konflikte/.test(items.match(/⚖ Konflikte: \d+ – [^#]*K1/)?.[0] || ''), items);
    if (r.shown) await takeCode(Q.page);
    // Doppelklick auf „Übernehmen“ erzeugt keinen zweiten Commit
    const D = await openPage(browser, {});
    r = await importCode(D.page, eP.code);
    await D.page.evaluate(() => { const b = document.querySelector('#code-preview .sp-actions .button.primary-lite'); b.click(); b.click(); });
    await D.page.waitForTimeout(800);
    check('Doppelklick auf „Übernehmen“: einmal übernommen, nichts doppelt', (await ls(D.page, 'scalpdesk.history.v1')).length === 4 && new Set((await ls(D.page, 'scalpdesk.history.v1')).map(t => t.id)).size === 4);
    check('keine Fehler', ![...real(P.errors), ...real(Q.errors), ...real(D.errors)].length, [...real(P.errors), ...real(Q.errors), ...real(D.errors)].join(' | '));
    await P.ctx.close(); await Q.ctx.close(); await D.ctx.close();
  },
  // ================= Alarm-Kennung iPhone → iPad: kein erneutes Auslösen =================
  async alarmid(browser) {
    await h.ctl('/walk?on=0'); const B0 = Math.round((await h.ctl('/state')).price.BTCUSDT); await h.ctl(`/set?symbol=BTCUSDT&price=${B0}`);
    const seed = { 'scalpdesk.alarms.v1': [alarm('AX', 'BTCUSDT', B0 + 30, 'above', { armedAt: Date.now() - 5000 })] };
    const STUB = () => { window.__notes = 0; class N { constructor() { window.__notes++; } close() {} static requestPermission(cb) { cb?.('granted'); return Promise.resolve('granted'); } } N.permission = 'granted'; window.Notification = N; };
    const P = await openPage(browser, seed, { init: { fn: STUB } }); await P.page.waitForTimeout(800);
    await h.ctl(`/set?symbol=BTCUSDT&price=${B0 + 60}`);
    const trig = await until(async () => (await ls(P.page, 'scalpdesk.alarms.v1'))?.[0]?.triggeredAt, 15000);
    check('iPhone: Alarm AX ausgelöst', !!trig);
    const e = await exportCode(P.page); await P.ctx.close();
    await h.ctl(`/set?symbol=BTCUSDT&price=${B0}`);
    const Q = await openPage(browser, seed, { init: { fn: STUB } }); await Q.page.waitForTimeout(800);
    const r = await importCode(Q.page, e.code);
    check('iPad: Vorschau „Geändert: 1 Kurs-Alarm … ausgelöst“ (schneller Vorlauf, gleiche Kennung)', r.items.some(i => /^Geändert: 1 Kurs-Alarm/.test(i) && /ausgelöst/.test(i)), r.items.join(' ## '));
    await takeCode(Q.page);
    await h.ctl(`/set?symbol=BTCUSDT&price=${B0 + 60}`); await Q.page.waitForTimeout(3000);
    const a = (await ls(Q.page, 'scalpdesk.alarms.v1'))?.[0], notes = await Q.page.evaluate(() => window.__notes);
    check('iPad: derselbe Alarm gilt als ausgelöst (Zeit vom iPhone), kein erneutes Auslösen, kein Browser-Hinweis', a?.id === 'AX' && a.triggeredAt === trig && notes === 0, `${a?.triggeredAt} vs ${trig}, Hinweise ${notes}`);
    check('keine Fehler', !real(Q.errors).length, real(Q.errors).join(' | ')); await Q.ctx.close();
    await h.ctl(`/set?symbol=BTCUSDT&price=${B0}`);
  },
  // ================= Zwei Tabs: Prüfliste und Konflikte sofort sichtbar =================
  // ================= Geldbewegung mit selbst eingegebenem Datum: was das Formular annimmt, lädt die App auch wieder =================
  async money(browser) {
    const { ctx, page, errors } = await openPage(browser, {});
    const add = (date, amount) => page.evaluate(([date, amount]) => {
      document.getElementById('mv-type').value = 'deposit'; document.getElementById('mv-amount').value = amount; document.getElementById('mv-date').value = date;
      document.getElementById('money-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      const e = document.getElementById('mv-error'); return e.hidden ? '' : e.textContent;
    }, [date, amount]);
    let err = await add('2015-06-01', '100');
    check('Einzahlung vom 01.06.2015 gespeichert (vor 2017, nach dem Start von Bitcoin)', !err && ((await ls(page, 'scalpdesk.money.v1')) || []).length === 1, err);
    err = await add('2001-01-01', '50');
    check('Datum 2001: „Datum prüfen – möglich ist 2009 bis 2099.“, nichts gespeichert', /^Datum prüfen – möglich ist 2009 bis 2099\.$/.test(err) && ((await ls(page, 'scalpdesk.money.v1')) || []).length === 1, err);
    await page.reload(); await page.waitForTimeout(1500);
    check('Nach dem Neuladen: die Buchung von 2015 ist weiter da und nicht in der Prüfliste', ((await ls(page, 'scalpdesk.money.v1')) || []).length === 1 && !((await ls(page, 'scalpdesk.quarantine.v1')) || []).length && await page.evaluate(() => document.getElementById('integrity-banner').hidden));
    check('Auswahlfeld begrenzt auf 2009 bis 2099', await page.evaluate(() => { const i = document.getElementById('mv-date'); return i.min === '2009-01-01' && i.max === '2099-12-31'; }));
    check('keine Fehler (Geldbewegung)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },
  async sync(browser) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const A = await openPage(browser, { 'scalpdesk.history.v1': [trade('S1', 'BTCUSDT', 1, Date.UTC(2026, 8, 6), { reasons: ['RSI'], setup: 'MACD' })] }, { ctx });
    const B = await openPage(browser, {}, { ctx });
    check('Zweiter Tab zeigt denselben Konflikt (Gründe: Herkunft unklar)', /1 Konflikt wartet/.test(await txt(B.page, '#integrity-text')));
    await jsClick(A.page, '#integrity-conf'); await A.page.waitForTimeout(150); await jsClick(A.page, '#conf-keep'); await A.page.waitForTimeout(600);
    check('Entscheidung in Tab 1 → Hinweis in Tab 2 verschwindet', await B.page.evaluate(() => document.getElementById('integrity-banner').hidden));
    check('keine Fehler', ![...real(A.errors), ...real(B.errors)].length, [...real(A.errors), ...real(B.errors)].join(' | ')); await ctx.close();
  },
};

(async () => {
  const only = process.argv[2];
  await h.setup(); const browser = await h.launch();
  try { for (const [name, fn] of Object.entries(tests)) { if (only && only !== name) continue; console.log(`\n▶ ${name}`); try { await fn(browser); } catch (e) { check(`${name}: Abbruch`, false, e.stack.split('\n').slice(0, 3).join(' ')); } } }
  finally { await browser.close(); await h.teardown(); try { fs.unlinkSync(`${REPO}/${DBG}`); } catch {} }
  const ok = results.filter(r => r.ok).length; console.log(`\n${ok}/${results.length} bestanden`); process.exit(ok === results.length ? 0 : 1);
})();
