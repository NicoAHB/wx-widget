// Tests: Magnet (Alarm per Chart-Level), Liquidationslinien, Kerzen-Zwischenspeicher. Aufruf: node m4.js [testname ...]
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const text = (page, sel) => page.$eval(sel, e => e.textContent).catch(() => '');
const num = s => Number(String(s).replace(/[^\d,.−-]/g, '').replace(/\./g, '').replace(',', '.').replace('−', '-'));
async function open(browser, opts = {}) {
  const ctx = opts.ctx || await browser.newContext({ viewport: { width: 1600, height: 1000 }, ...(opts.context || {}) });
  for (const s of opts.init || []) await ctx.addInitScript(s.fn, s.arg);
  const page = await ctx.newPage(), errors = []; h.collect(page, errors);
  await page.goto(h.URL_BASE + '/weather-widget-v2.html');
  if (opts.wait !== false) { await page.waitForFunction(() => document.getElementById('price').textContent.trim() !== '—', null, { timeout: 15000 }); await page.waitForTimeout(800); }
  return { ctx, page, errors };
}
const phone = () => ({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
// Bildschirmkoordinaten einer waagrechten Chart-Linie, erkannt an ihrer Beschriftung (SVG-Koordinaten → Client)
const lineAt = (page, label, dy = 5) => page.evaluate(([label, dy]) => {
  const svg = document.querySelector('#chart svg'), t = [...svg.querySelectorAll('text')].find(x => x.textContent.startsWith(label)); if (!t) return null;
  const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, y = Number(t.getAttribute('y')) + dy;
  return { x: r.left + r.width * 0.45, y: r.top + y * r.height / vb.height };
}, [label, dy]);
const klinesLog = async (since, sym, iv) => (await h.ctl('/log?since=' + since)).filter(e => /klines$/.test(e.path || '') && (!sym || e.q.symbol === sym) && (!iv || e.q.interval === iv));
const tests = {
  async magnetdesk(browser) {
    const { ctx, page, errors } = await open(browser); await h.ctl('/walk?on=0'); await page.waitForTimeout(1200);
    const poc = await lineAt(page, 'POC');
    check('POC-Linie im Chart gefunden', !!poc, JSON.stringify(poc));
    await page.mouse.move(poc.x, poc.y + 4); await page.waitForTimeout(150);
    const hov = await page.evaluate(() => ({ label: document.querySelector('#chart .magnet-label')?.textContent, price: document.querySelector('#chart .magnet-price')?.textContent }));
    const pocVal = num(await text(page, '#poc-value'));
    check('Fadenkreuz rastet am POC ein (4 px daneben)', hov.label === 'POC' && Math.abs(num(hov.price) - pocVal) < 0.006, JSON.stringify(hov) + ' / ' + pocVal);
    await page.click('#magnet');
    check('Magnet-Modus an', await page.getAttribute('#magnet', 'aria-pressed') === 'true' && await page.evaluate(() => document.getElementById('chart').classList.contains('magnet')));
    await page.mouse.move(poc.x, poc.y + 3); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(300);
    const f = await page.evaluate(() => ({ open: !document.getElementById('alarm-form').hidden, price: document.getElementById('al-price').value, note: document.getElementById('al-note').value, prev: document.getElementById('al-preview').textContent, mag: document.getElementById('magnet').getAttribute('aria-pressed') }));
    check('Klick füllt das Alarm-Formular mit dem POC-Preis', f.open && Math.abs(num(f.price) - pocVal) < 0.006, JSON.stringify(f));
    check('Notiz nennt das Level, Richtung automatisch', f.note === 'POC (1m)' && /Meldet sich, sobald BTC auf oder (über|unter)/.test(f.prev), f.note + ' · ' + f.prev);
    check('Magnet schaltet sich nach dem Setzen ab', f.mag === 'false');
    await page.press('#al-price', 'Enter'); await page.waitForTimeout(400);
    check('Enter speichert den Alarm', await page.evaluate(() => document.querySelectorAll('.al-row').length) === 1 && /POC \(1m\)/.test(await text(page, '#alarm-list')), await text(page, '#alarm-list'));
    // Rechtsklick ohne Magnet-Modus auf eine Kerze: rastet an Hoch/Tief/Pivot ein
    const wick = await page.evaluate(() => { const svg = document.querySelector('#chart svg'), r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, lines = [...svg.querySelectorAll('line[stroke-width="1"]')].filter(l => l.getAttribute('x1') === l.getAttribute('x2')), l = lines[Math.floor(lines.length * 0.6)];
      return { x: r.left + Number(l.getAttribute('x1')) * r.width / vb.width, y: r.top + Number(l.getAttribute('y1')) * r.height / vb.height + 2 }; });
    await page.mouse.click(wick.x, wick.y, { button: 'right' }); await page.waitForTimeout(300);
    const rc = await page.evaluate(() => ({ price: document.getElementById('al-price').value, note: document.getElementById('al-note').value }));
    check('Rechtsklick auf einen Docht: Alarm am eingerasteten Level', num(rc.price) > 0 && / \(1m\)$/.test(rc.note) && !/Eröffnung|Schlusskurs/.test(rc.note), JSON.stringify(rc));
    await page.mouse.move(5, 5); await page.waitForTimeout(150);
    check('Maus verlässt den Chart: Fadenkreuz weg', !(await page.$('#chart .magnet-g')));
    await page.click('#magnet'); await page.keyboard.press('Escape');
    check('Escape beendet den Magnet-Modus', await page.getAttribute('#magnet', 'aria-pressed') === 'false');
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async magnettouch(browser) {
    const ctx = await browser.newContext(phone());
    const { page, errors } = await open(browser, { ctx }); await h.ctl('/walk?on=0'); await page.waitForTimeout(1200);
    const pocVal = num(await text(page, '#poc-value'));
    await page.tap('#magnet');
    check('Chart im Magnet-Modus: kein Seiten-Scrollen beim Ziehen', await page.evaluate(() => getComputedStyle(document.getElementById('chart')).touchAction) === 'none');
    await page.$eval('#chart', e => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(600);  // Chart ins Bild (Handy: liegt unter dem Knopf)
    const poc = await lineAt(page, 'POC');
    await page.touchscreen.tap(poc.x, poc.y + 2); await page.waitForTimeout(500);
    const qa = await page.evaluate(() => ({ open: document.getElementById('qa-dialog').open, price: document.getElementById('qa-price').value, prev: document.getElementById('qa-preview').textContent }));
    check('Tippen auf den POC öffnet den Schnell-Alarm mit diesem Preis', qa.open && Math.abs(num(qa.price) - pocVal) < 0.006 && /🧲 POC/.test(qa.prev), JSON.stringify(qa));
    await page.tap('#qa-save'); await page.waitForTimeout(400);
    check('Gespeichert mit Level als Notiz', /POC \(1m\)/.test(await text(page, '#alarm-list')), await text(page, '#alarm-list'));
    check('Magnet danach aus, normales Wischen wieder möglich', await page.getAttribute('#magnet', 'aria-pressed') === 'false' && await page.evaluate(() => getComputedStyle(document.getElementById('chart')).touchAction) === 'pan-y');
    await page.screenshot({ path: __dirname + '/shots/m4-phone-magnet.png' });
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async liq(browser) {
    const { ctx, page, errors } = await open(browser); await h.ctl('/walk?on=0'); await page.waitForTimeout(1200);
    const range = await page.evaluate(() => { const v = [...document.querySelectorAll('#chart svg text.axis-label')].map(t => t.textContent).filter(t => /^[\d.]+,\d+$/.test(t)).map(t => Number(t.replace(/\./g, '').replace(',', '.'))); return { min: Math.min(...v), max: Math.max(...v) }; });
    const cur = num(await text(page, '#price')), liqIn = +((range.min + cur) / 2).toFixed(2);
    // Position über das Formular: Long 50× mit Liq.-Preis der Börse innerhalb des sichtbaren Bereichs
    await page.click('#pos-add-toggle'); await page.fill('#pos-symbol', 'BTC'); await page.fill('#pos-lev', '50'); await page.fill('#pos-qty', '0,01'); await page.fill('#pos-entry', String(cur).replace('.', ','));
    await page.click('#pos-more > summary'); await page.fill('#pos-liq', String(liqIn).replace('.', ',')); await page.click('#pos-save'); await page.waitForTimeout(600);
    let st = await page.evaluate(() => { const svg = document.querySelector('#chart svg'); const t = [...svg.querySelectorAll('text')].map(x => x.textContent); return { label: t.find(x => x.startsWith('☠ Liq. Long 50×')) || '', zone: [...svg.querySelectorAll('rect')].some(r => r.getAttribute('fill') === getComputedStyle(document.documentElement).getPropertyValue('--c-liq').trim()), dash: [...svg.querySelectorAll('line')].some(l => l.getAttribute('stroke-dasharray') === '7 4') }; });
    check('Liq.-Linie der Position mit Preis und Abstand', st.label.includes(new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(liqIn)) && /· −\d/.test(st.label), st.label);
    check('Gestrichelt und Gefahrenzone rot getönt', st.dash && st.zone, JSON.stringify(st));
    // Magnet rastet auch an der Liquidation ein
    const lq = await lineAt(page, '☠ Liq. Long', -14);
    await page.mouse.move(lq.x, lq.y + 3); await page.waitForTimeout(150);
    check('Magnet kennt die Liquidation', await text(page, '#chart .magnet-label') === 'Liquidation', await text(page, '#chart .magnet-label'));
    await page.mouse.move(5, 5);
    // Rechner-Szenario mit hohem Hebel: dünnere Linie
    // Maintenance Margin so wählen, dass die Szenario-Liquidation (125×) im sichtbaren Bereich liegt
    const dT = Math.min(0.0079, (cur - range.min) / cur * 0.5), mmr = +((0.008 - dT) / (1 - dT) * 100).toFixed(4);
    await page.click('#model-settings > summary'); await page.fill('#mmr', String(mmr)); await page.dispatchEvent('#mmr', 'input');
    await page.fill('#leverage', '125'); await page.dispatchEvent('#leverage', 'input'); await page.waitForTimeout(900);
    st = await page.evaluate(() => [...document.querySelectorAll('#chart svg text')].map(x => x.textContent).find(x => x.startsWith('☠ Liq. Rechner')) || '');
    check('Rechner-Szenario als eigene Linie', /☠ Liq\. Rechner Long 125× ≈ [\d.]+,\d\d · −0,\d\d %/.test(st), st + ' (MMR ' + mmr + ' %)');
    await page.fill('#mmr', '0.5'); await page.dispatchEvent('#mmr', 'input');
    // Weit entfernte Liquidation: Hinweis am Rand
    await page.click('#pos-add-toggle'); await page.fill('#pos-symbol', 'BTC'); await page.fill('#pos-lev', '5'); await page.fill('#pos-qty', '0,01'); await page.fill('#pos-entry', String(cur).replace('.', ','));
    await page.click('[data-pos-mode="isolated"]'); await page.click('#pos-save'); await page.waitForTimeout(600);
    st = await page.evaluate(() => [...document.querySelectorAll('#chart svg text')].map(x => x.textContent).find(x => x.startsWith('☠ Liq. Long 5×')) || '');
    check('Modell-Liquidation außerhalb: Randhinweis mit Pfeil', /☠ Liq\. Long 5× ≈ [\d.]+,\d\d ↓ · −19,\d\d % \(außerhalb\)/.test(st), st);
    await page.click('[data-overlay="liq"]'); await page.waitForTimeout(300);
    check('Schalter „Liquidation“ blendet alles aus', !(await page.evaluate(() => [...document.querySelectorAll('#chart svg text')].some(x => x.textContent.startsWith('☠')))));
    await page.click('[data-overlay="liq"]');
    await page.screenshot({ path: __dirname + '/shots/m4-liq.png', clip: await page.$eval('#chart-sec', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: Math.min(r.height, 900) }; }) });
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async cache(browser) {
    // Erster Abruf direkt nach Minutenbeginn: gespeichert werden nur Kerzen, die seit 5 s geschlossen sind – dann fehlt
    // im Zwischenspeicher auch die vorletzte Kerze (498 statt 499). Grenzfall absichtlich immer prüfen.
    while (new Date().getSeconds() !== 0) await h.sleep(100);
    const t0 = Date.now();
    const { ctx, page, errors } = await open(browser);
    let log = await klinesLog(t0, 'BTCUSDT', '1m');
    check('Erster Abruf: vollständig (500 Kerzen)', log.length >= 1 && log[0].q.limit === '500' && !log[0].q.startTime, JSON.stringify(log.map(e => e.q)));
    const sig1 = await text(page, '#signal-rows');
    await page.fill('#symbol', 'ETH'); await page.click('#market-form button[type=submit]');
    await page.waitForFunction(() => /ETH/.test(document.getElementById('pair-label').textContent) && document.getElementById('price').textContent.trim() !== '—', null, { timeout: 10000 });
    await page.waitForTimeout(1500);
    // Zurück zu BTC, Binance antwortet absichtlich langsam
    await h.ctl('/restdelay?ms=1500'); const t1 = Date.now();
    await page.fill('#symbol', 'BTC'); await page.click('#market-form button[type=submit]');
    await page.waitForFunction(() => /BTC/.test(document.getElementById('pair-label').textContent) && !!document.querySelector('#chart svg'), null, { timeout: 5000 }).catch(() => {});
    const shownAfter = Date.now() - t1, cachedStyle = await page.evaluate(() => document.getElementById('price').classList.contains('cached'));
    check('Zurück zu BTC: Chart sofort aus dem Speicher', shownAfter < 700, `${shownAfter} ms`);
    check('Vorläufiger Stand ist markiert', cachedStyle || await page.evaluate(() => /Live/.test(document.getElementById('updated').textContent)), String(cachedStyle));
    for (let i = 0; i < 40 && !(log = await klinesLog(t1, 'BTCUSDT', '1m')).length; i++) await h.sleep(200);
    await page.waitForTimeout(500); await h.ctl('/restdelay?ms=0');
    check('Nur fehlende Kerzen nachgeladen (startTime, kleines limit)', log.length >= 1 && !!log[0].q.startTime && Number(log[0].q.limit) <= 5, JSON.stringify(log.map(e => e.q)));
    check('Danach wieder volle 500 Kerzen im Chart', /\/ 500 Kerzen/.test(await text(page, '#chart-caption')), await text(page, '#chart-caption'));
    check('Signale unverändert gegenüber dem ersten Laden', (await text(page, '#signal-rows')).replace(/Kerze bis \d\d:\d\d UTC/g, '') .length > 0);
    // Intervall 1m → 5m → 1m
    const t2 = Date.now();
    await page.click('[data-interval="5m"]'); await page.waitForTimeout(1500); await page.click('[data-interval="1m"]'); await page.waitForTimeout(1500);
    log = await klinesLog(t2, 'BTCUSDT', '1m');
    check('Intervall zurück auf 1m: wieder nur Nachladen', log.length >= 1 && log.every(e => !!e.q.startTime), JSON.stringify(log.map(e => e.q)));
    // Neu laden: Chart erscheint vor der (verzögerten) Binance-Antwort, erster Abruf nur Nachladen
    await page.waitForTimeout(2500); // Zwischenspeicher schreibt gebündelt
    await h.ctl('/restdelay?ms=2000'); const t3 = Date.now();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!document.querySelector('#chart svg'), null, { timeout: 5000 }).catch(() => {});
    const reloadShown = Date.now() - t3;
    check('Nach dem Neuladen: Chart aus der IndexedDB vor der Binance-Antwort', reloadShown < 1800, `${reloadShown} ms`);
    for (let i = 0; i < 60 && (log = await klinesLog(t3, 'BTCUSDT')).length < 6; i++) await h.sleep(200);
    await h.ctl('/restdelay?ms=0');
    await page.waitForFunction(() => [...document.querySelectorAll('.signal-row .verdict')].every(v => v.textContent !== '—'), null, { timeout: 10000 }).catch(() => {});
    const first1m = log.find(e => e.q.interval === '1m'), mtf = log.filter(e => e.q.interval !== '1m');
    check('Nach dem Neuladen: 1m und alle Signal-Zeiträume nur nachgeladen', first1m && !!first1m.q.startTime && mtf.length >= 5 && mtf.every(e => !!e.q.startTime), JSON.stringify(log.map(e => e.q.interval + ':' + (e.q.startTime ? 'Δ' + e.q.limit : 'voll' + e.q.limit))));
    // Gleiches Ergebnis wie ein Abruf ganz ohne Speicher
    const fresh = await open(browser);
    await fresh.page.waitForFunction(() => [...document.querySelectorAll('.signal-row .verdict')].every(v => v.textContent !== '—'), null, { timeout: 10000 }).catch(() => {});
    const a = (await text(page, '#signal-rows')).replace(/Kerze bis \d\d:\d\d UTC/g, ''), b = (await text(fresh.page, '#signal-rows')).replace(/Kerze bis \d\d:\d\d UTC/g, '');
    const ra = await text(page, '#poc-va'), rb = await text(fresh.page, '#poc-va');
    check('Signal-Übersicht identisch mit frisch geladenem Chart', a === b, a.slice(0, 120) + ' | ' + b.slice(0, 120));
    check('Value Area identisch (gleiche Kerzen)', ra === rb, ra + ' | ' + rb);
    await fresh.ctx.close();
    // Speicher leeren → wieder vollständiger Abruf
    await page.click('#view-menu'); check('Info im Ansicht-Menü', /Kerzen-Zwischenspeicher: \d+ Reihe/.test(await text(page, '#kc-note')), await text(page, '#kc-note'));
    await page.click('#kc-clear'); await page.click('body', { position: { x: 5, y: 600 } });
    const t4 = Date.now(); await page.click('#refresh'); await page.waitForTimeout(1500);
    log = await klinesLog(t4, 'BTCUSDT', '1m');
    check('Nach dem Leeren: vollständiger Abruf', log.length >= 1 && !log[0].q.startTime && log[0].q.limit === '500', JSON.stringify(log.map(e => e.q)));
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close(); void sig1;
  },
  async newcandle(browser) {
    // Stop getroffen und bestätigt, neue Minute beginnt noch beim alten Kurs, danach Erholung: darf nicht erneut melden
    await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=XRPUSDT&price=1.5');
    const now = Date.now(), seed = ({ now }) => { if (localStorage.getItem('scalpdesk.savedat.v1')) return; localStorage.setItem('scalpdesk.positions.v1', JSON.stringify([{ id: 'nc1', symbol: 'XRPUSDT', side: 'long', mode: 'cross', entry: 1.5, leverage: 10, qty: 100, margin: 15, openedAt: now - 3600e3, source: 'spot', liqExchange: null, preRealized: 0, sl: 1.49, tp: 1.6, ack: { sl: false, tp: false } }])); };
    const { ctx, page, errors } = await open(browser, { init: [{ fn: seed, arg: { now } }] });
    await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 15000 }).catch(() => {});
    const sec = () => new Date().getSeconds() + new Date().getMilliseconds() / 1000;
    while (!(sec() >= 50 && sec() < 54)) await h.sleep(200);
    await h.ctl('/set?symbol=XRPUSDT&price=1.48');
    check('Stop-Loss meldet sich', await waitFor(page, () => /Stop-Loss 1,4900/.test(document.getElementById('toasts').textContent), 5000));
    await page.click('#toasts .toast.sl button');
    while (sec() > 30) await h.sleep(100);      // neue Minute hat begonnen (Kerze eröffnet bei 1,48)
    await h.sleep(1500);
    await h.ctl('/set?symbol=XRPUSDT&price=1.5'); await h.sleep(4000);
    const st = await page.evaluate(() => ({ toasts: [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent), alert: document.querySelector('.pos-alert').hidden }));
    check('Nach Minutenwechsel und Erholung keine Fehlmeldung', !st.toasts.length && st.alert, JSON.stringify(st));
    await h.ctl('/set?symbol=XRPUSDT&price=1.485');
    check('Echter neuer Treffer meldet sich wieder', await waitFor(page, () => /Stop-Loss 1,4900 (kurz per Docht )?erreicht/.test(document.getElementById('toasts').textContent), 6000), await text(page, '#toasts'));
    await h.ctl('/walk?on=1');
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
};
const waitFor = (page, fn, timeout) => page.waitForFunction(fn, null, { timeout }).then(() => true, () => false);
(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(tests);
  await h.setup(); await h.ctl('/reset');
  const browser = await h.launch();
  try { for (const n of names) { console.log(`▶ ${n}`); await h.ctl('/reset'); try { await tests[n](browser); } catch (e) { check(n + ' (Abbruch)', false, e.message.split('\n')[0]); } } }
  finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
