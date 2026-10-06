// Tests für Skeletons, untere Navigation mit Schnell-Alarm, Signal-Trend, TP-Staffel und Telegram/Discord. Aufruf: node m3.js [testname ...]
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const text = (page, sel) => page.$eval(sel, e => e.textContent).catch(() => '');
const visible = (page, sel) => page.$eval(sel, e => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length)).catch(() => false);
async function waitText(page, sel, re, timeout = 10000) { try { await page.waitForFunction(([s, r]) => { const e = document.querySelector(s); return e && new RegExp(r).test(e.textContent); }, [sel, re.source], { timeout }); return true; } catch { return false; } }
async function open(browser, opts = {}) {
  const ctx = opts.ctx || await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true, ...(opts.context || {}) });
  for (const s of opts.init || []) await ctx.addInitScript(s.fn, s.arg);
  const page = await ctx.newPage(), errors = []; h.collect(page, errors);
  await page.goto(h.URL_BASE + '/weather-widget-v2.html');
  if (opts.wait !== false) await page.waitForFunction(() => document.getElementById('price').textContent.trim() !== '—', null, { timeout: 15000 });
  return { ctx, page, errors };
}
const phone = () => ({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
const TG_TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw', DC_URL = 'https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz_ABC-123';
const seedChan = ({ token, url }) => { if (localStorage.getItem('scalpdesk.savedat.v1')) return; localStorage.setItem('scalpdesk.channels.v1', JSON.stringify({ tg: { token, chat: '987654321', on: true }, dc: { url, on: true }, ev: { alarm: true, pos: true, day: true } })); };
const sentWait = async (pred, ms = 8000) => { const end = Date.now() + ms; let s = []; while (Date.now() < end) { s = await h.ctl('/sent'); if (pred(s)) return s; await h.sleep(250); } return s; };
const tests = {
  async skeleton(browser) {
    await h.ctl('/restdelay?ms=2500');
    const { ctx, page, errors } = await open(browser, { wait: false });
    await page.waitForSelector('#chart .chart-skel', { timeout: 5000 }).catch(() => {});
    const st = await page.evaluate(() => ({ chart: !!document.querySelector('#chart .chart-skel i.skel'), price: document.getElementById('price').classList.contains('skel'), rsi: document.getElementById('rsi-value').classList.contains('skel'), note: document.getElementById('poc-note').classList.contains('skel'), fund: document.getElementById('funding-value').classList.contains('skel'), overall: document.getElementById('overall-verdict').classList.contains('skel'), rows: document.querySelectorAll('#signal-rows .rules.skel').length, busy: document.getElementById('dash').getAttribute('aria-busy'), anim: getComputedStyle(document.getElementById('price')).animationName, color: getComputedStyle(document.getElementById('price')).color }));
    check('Während des Ladens: Chart-Skeleton', st.chart, JSON.stringify(st));
    check('Kurs, RSI, POC-Text, Funding als Platzhalter', st.price && st.rsi && st.note && st.fund);
    check('Signal-Zeilen und Gesamturteil als Platzhalter', st.rows >= 5 && st.overall);
    check('Platzhalter pulsieren, Text unsichtbar', st.anim === 'skel' && /rgba\(0, 0, 0, 0\)|transparent/.test(st.color), st.anim + ' ' + st.color);
    check('Bereich als „lädt“ markiert', st.busy === 'true');
    await page.waitForFunction(() => document.getElementById('price').textContent.trim() !== '—', null, { timeout: 15000 });
    await page.waitForFunction(() => !document.getElementById('overall-verdict').classList.contains('skel'), null, { timeout: 15000 }).catch(() => {});
    const after = await page.evaluate(() => ({ skel: [...document.querySelectorAll('.skel')].map(e => e.id || e.className).slice(0, 8), n: document.querySelectorAll('.skel').length, svg: !!document.querySelector('#chart svg'), busy: document.getElementById('dash').getAttribute('aria-busy') }));
    check('Nach dem Laden keine Platzhalter mehr', after.n === 0 && after.svg && after.busy === 'false', JSON.stringify(after));
    await h.ctl('/restdelay?ms=0');
    // Fehler statt Laden: kein Skeleton, sondern Fehlermeldung
    await h.ctl('/restfail?on=1');
    // 3.32.0 (G04.3): ein unbekanntes Kürzel prüft die App vorher – bei gestörtem Abruf bliebe der geladene Coin. Deshalb ein Coin der
    // Vorauswahl (XRP), der ohne Prüfung wechselt und dann keine Daten bekommt.
    await page.fill('#symbol', 'XRP'); await page.click('#market-form button[type=submit]');
    await page.waitForTimeout(1500);
    const err = await page.evaluate(() => ({ skel: !!document.querySelector('#chart .chart-skel'), msg: document.querySelector('#chart .chart-empty strong')?.textContent, price: document.getElementById('price').classList.contains('skel') }));
    check('Bei Datenfehler: Meldung statt Platzhalter', !err.skel && /Keine Marktdaten/.test(err.msg || '') && !err.price, JSON.stringify(err));
    await h.ctl('/restfail?on=0');
    check('keine Fehler', !errors.filter(e => !/503|Failed to load resource/.test(e)).length, errors.join(' | ')); await ctx.close();
  },
  async bottomnav(browser) {
    const ctx = await browser.newContext(phone());
    const { page, errors } = await open(browser, { ctx });
    const nav = await page.evaluate(() => ({ layout: document.documentElement.dataset.layout, btns: [...document.querySelectorAll('#tabbar button')].map(b => b.textContent.replace(document.getElementById('tab-pos-badge').textContent, '').trim()), fixed: getComputedStyle(document.getElementById('tabbar')).position, bottom: Math.round(innerHeight - document.getElementById('tabbar').getBoundingClientRect().bottom), fab: document.getElementById('qa-open').getBoundingClientRect(), over: document.scrollingElement.scrollWidth - innerWidth, top: document.querySelector('.update-controls').getBoundingClientRect().height }));
    check('Smartphone: untere Leiste fest am Rand', nav.layout === 'tablet' && nav.fixed === 'fixed' && nav.bottom === 0, JSON.stringify(nav));
    check('Fünf Plätze: Chart · Rechner · Alarm · Positionen · Indikatoren', /^.Chart\|.Rechner\|🔔Alarm\|.Positionen\|.Indikatoren$/u.test(nav.btns.join('|')), nav.btns.join('|'));
    check('Alarm-Knopf mittig und groß (≥ 60 px)', nav.fab.width >= 60 && Math.abs(nav.fab.left + nav.fab.width / 2 - 195) < 12, JSON.stringify(nav.fab));
    check('Kein seitliches Scrollen, Kopfzeile einzeilig', nav.over <= 0 && nav.top < 60, `${nav.over} / ${nav.top}`);
    await page.click('#tabbar [data-tab="calc"]');
    check('Rechner in eigenem Tab', await visible(page, '#calc-sec') && !(await visible(page, '#chart-sec')) && !(await visible(page, '#positions')));
    // Schnell-Alarm
    const cur = await page.evaluate(() => Number(document.getElementById('price').textContent.replace(/\./g, '').replace(',', '.')));
    await page.click('#qa-open'); await page.waitForTimeout(400);
    check('Schnell-Alarm öffnet als Blatt von unten', await page.evaluate(() => { const d = document.getElementById('qa-dialog'), r = d.getBoundingClientRect(); return d.open && Math.abs(r.bottom - innerHeight) < 2; }));
    const lv = await page.$$eval('#qa-levels button', bs => bs.map(b => b.textContent));
    check('Marken aus dem Chart angeboten (Widerstand/Unterstützung/POC)', lv.some(t => /POC/.test(t)), lv.join(' | '));
    await page.click('#qa-dialog [data-qa="1"]');
    const qv = await page.evaluate(() => ({ v: document.getElementById('qa-price').value, prev: document.getElementById('qa-preview').textContent, pressed: document.querySelector('#qa-dialog [data-qa="1"]').getAttribute('aria-pressed'), dis: document.getElementById('qa-save').disabled }));
    const target = Number(qv.v.replace(',', '.'));
    check('+1 % setzt den Preis', Math.abs(target / cur - 1.01) < 0.002 && qv.pressed === 'true' && !qv.dis, JSON.stringify(qv));
    check('Vorschau nennt Richtung und Abstand', /auf oder über .* steigt \(\+1,0\d %\)/.test(qv.prev), qv.prev);
    await page.click('#qa-save');
    await page.waitForFunction(() => !document.getElementById('qa-dialog').open, null, { timeout: 3000 }).catch(() => {});
    const saved = await page.evaluate(() => ({ n: document.querySelectorAll('.al-row').length, toast: document.querySelector('.toast.info')?.textContent || '', lb: document.getElementById('lb-alarm').textContent }));
    check('Alarm gespeichert, Bestätigung angezeigt', saved.n === 1 && /Alarm gesetzt: BTC steigt auf\/über/.test(saved.toast) && /1/.test(saved.lb), JSON.stringify(saved));
    // „Andere Kryptowährung oder Notiz …“ → volles Formular im Chart-Tab
    await page.click('#tabbar [data-tab="pos"]'); await page.click('#qa-open'); await page.click('#qa-dialog [data-qa="-2"]'); await page.click('#qa-more');
    await page.waitForTimeout(400);
    const more = await page.evaluate(() => ({ tab: document.documentElement.dataset.activeTab, form: !document.getElementById('alarm-form').hidden, price: document.getElementById('al-price').value }));
    check('Weiter zum vollen Formular mit übernommenem Preis', more.tab === 'chart' && more.form && Number(more.price.replace(',', '.')) > 0, JSON.stringify(more));
    // Erneutes Tippen auf aktiven Tab → nach oben
    await page.evaluate(() => window.scrollTo(0, 800)); await page.click('#tabbar [data-tab="chart"]'); await page.waitForTimeout(700);
    check('Aktiven Tab erneut antippen scrollt nach oben', await page.evaluate(() => scrollY) < 5);
    // Positionsformular aus dem Rechner: wechselt in den Positionen-Tab
    await page.click('#tabbar [data-tab="calc"]'); await page.fill('#risk-entry', String(cur).replace('.', ',')); await page.fill('#risk-stop', String(Math.round(cur * 0.99)).replace('.', ','));
    await page.waitForTimeout(200); await page.click('#risk-to-pos'); await page.waitForTimeout(500);
    check('„Als Position erfassen“ öffnet das Formular im Positionen-Tab', await page.evaluate(() => document.documentElement.dataset.activeTab === 'pos' && !document.getElementById('pos-form').hidden));
    await page.screenshot({ path: __dirname + '/shots/m3-phone-qa.png' });
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async trend(browser) {
    const { ctx, page, errors } = await open(browser);
    await page.waitForFunction(() => /\d/.test(document.getElementById('overall-score').textContent), null, { timeout: 15000 }).catch(() => {});
    const st = await page.evaluate(() => ({ score: document.getElementById('overall-score').textContent, title: document.getElementById('overall-score').title, arrow: document.querySelector('#overall-score .trend')?.className || '', bars: document.querySelectorAll('#overall-spark rect').length, label: document.getElementById('overall-spark').getAttribute('aria-label'), detail: document.getElementById('overall-detail').textContent, lb: document.querySelector('#lb-heat .trend')?.textContent || '' }));
    const m = /(\d+) Kauf · \d+ Halten · (\d+) Verkauf/.exec(st.detail), net = m ? Number(m[1]) - Number(m[2]) : NaN;
    const shown = Number(st.score.replace('−', '-').replace(/[^\d+-]/g, ''));
    check('Gesamtscore = Kauf- minus Verkaufssignale', shown === net, `${st.score} / ${st.detail}`);
    check('Trendpfeil mit Stand vor 5 Minuten', /trend (up|down|flat)/.test(st.arrow) && /vor 5 Min\.: [+−]?\d/.test(st.title), `${st.arrow} · ${st.title}`);
    check('Verlauf über 60 Minuten gezeichnet', /Gesamtscore der letzten \d+ Minuten/.test(st.label || ''), `${st.bars} Balken · ${st.label}`);
    check('Trendpfeil auch in der Live-Leiste', /[↗↘→]/.test(st.lb), st.lb);
    // Konsistenz: Stand „jetzt“ im Verlauf entspricht der Anzeige
    check('Verlauf endet beim angezeigten Score', new RegExp(`jetzt ${st.score.replace(/[↗↘→]/g, '').replace('+', '\\+')}`).test(st.label || ''), st.label);
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async ladder(browser) {
    const { ctx, page, errors } = await open(browser);
    await page.fill('#balance', '1000'); await page.fill('#stake', '100'); await page.fill('#leverage', '10'); await page.dispatchEvent('#leverage', 'input');
    await page.click('#ladder > summary');
    await page.waitForTimeout(200);
    let out = await text(page, '#ladder-out');
    check('Standard-Staffel 50/30/20: alle Ziele +9,50 USDT', /Alle Ziele erreicht\+9,50 USDT/.test(out.replace(/\s+/g, ' ').replace(/ erreicht /, ' erreicht')) || /Alle Ziele erreicht.*\+9,50 USDT/.test(out), out.slice(0, 300));
    check('Tranchen einzeln: +2,50 / +3,00 / +4,00', /TP 1.*\+2,50 USDT.*TP 2.*\+3,00 USDT.*TP 3.*\+4,00 USDT/.test(out));
    check('Auf den Einsatz und Ø Ausstieg', /\+9,5 % auf den Einsatz · Ø Ausstieg 0,95 %/.test(out));
    await page.fill('#ladder-sl', '0,5'); await page.waitForTimeout(150); out = await text(page, '#ladder-out');
    check('Mit Stop: Verlust −5,00, CRV 1,9 : 1, TP 1 dann Stop ±0', /Stop-Loss vor TP 1.*−5,00 USDT/.test(out) && /1,9 : 1/.test(out) && /danach Stop-Loss0,00 USDT/.test(out), out.slice(0, 400));
    await page.check('#ladder-be'); await page.waitForTimeout(150); out = await text(page, '#ladder-out');
    check('Break-even nach TP 1: +2,50', /danach Stop auf Einstieg\+2,50 USDT/.test(out));
    await page.click('[data-split="50,50,0"]'); await page.waitForTimeout(150); out = await text(page, '#ladder-out');
    check('Aufteilung 50/50 per Knopf', /Alle Ziele erreicht.*\+7,50 USDT/.test(out) && !/TP 3/.test(out.split('Alle Ziele')[0]) && await page.getAttribute('[data-split="50,50,0"]', 'aria-pressed') === 'true', out.slice(0, 200));
    check('Kurzfassung in der Überschrift', /Alle Ziele \+7,50 USDT · Chance\/Risiko 1,5 : 1/.test(await text(page, '#ladder-sum')), await text(page, '#ladder-sum'));
    await page.fill('#tp2-move', '0,3'); await page.waitForTimeout(150);
    check('Fehler: Ziele nicht aufsteigend', /TP 2 muss weiter entfernt liegen als TP 1/.test(await text(page, '#ladder-out')));
    await page.fill('#tp2-move', '1');
    await page.click('[data-side="short"]'); await page.waitForTimeout(150); out = await text(page, '#ladder-out');
    const cur = await page.evaluate(() => Number(document.getElementById('price').textContent.replace(/\./g, '').replace(',', '.')));
    const tp1 = Number((/TP 1 · 0,50 % → ([\d.,]+) USDT/.exec(out) || [])[1]?.replace(/\./g, '').replace(',', '.'));
    check('Short: Zielkurs unter dem Einstieg', tp1 > 0 && tp1 < cur, `${tp1} < ${cur}`);
    await page.reload(); await page.waitForFunction(() => document.getElementById('price').textContent.trim() !== '—');
    const kept = await page.evaluate(() => ({ open: document.getElementById('ladder').open, sl: document.getElementById('ladder-sl').value, s3: document.getElementById('tp3-share').value, be: document.getElementById('ladder-be').checked }));
    check('Eingaben und Aufklapp-Zustand bleiben erhalten', kept.open && kept.sl === '0,5' && kept.s3 === '0' && kept.be, JSON.stringify(kept));
    await page.screenshot({ path: __dirname + '/shots/m3-ladder.png', clip: await page.$eval('#calc-sec', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, width: r.width, height: Math.min(r.height, 1600) }; }), fullPage: true });
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async channels(browser) {
    const { ctx, page, errors } = await open(browser);
    await page.click('#notify-menu');
    check('Hinweis-Menü: Eintrag für Telegram/Discord mit Info-Symbol', await visible(page, '#chan-open') && await visible(page, '#notify-panel .head-line .tip') && /Noch kein Kanal/.test(await text(page, '#chan-summary')));
    await page.click('#chan-open');
    const d = await page.evaluate(() => ({ open: document.getElementById('chan-dialog').open, guide: document.getElementById('tg-guide').open, steps: document.querySelectorAll('#tg-guide li').length, dsteps: document.querySelectorAll('#dc-guide li').length, tips: document.querySelectorAll('#chan-dialog details.tip').length }));
    check('Fenster mit Schritt-für-Schritt-Anleitung (Telegram offen)', d.open && d.guide && d.steps === 6 && d.dsteps === 4 && d.tips >= 3, JSON.stringify(d));
    await page.fill('#tg-token', 'falsch'); await page.click('#tg-detect');
    check('Ungültiger Token wird erklärt', await waitText(page, '#tg-status', /nicht wie ein Bot-Token|Bot-Token aus @BotFather/, 3000), await text(page, '#tg-status'));
    await page.fill('#tg-token', TG_TOKEN); await page.click('#tg-detect');
    check('Chat-ID ermittelt', await waitText(page, '#tg-status', /Gefunden: Nico \(ID 987654321\) über Bot @test_kursalarm_bot/, 6000) && await page.inputValue('#tg-chat') === '987654321', await text(page, '#tg-status'));
    await page.click('#tg-test');
    check('Telegram-Test zugestellt', await waitText(page, '#tg-status', /zugestellt/, 6000), await text(page, '#tg-status'));
    let sent = await h.ctl('/sent');
    const tg = sent.find(s => s.svc === 'tg');
    check('Telegram erhält Chat-ID und Text, ohne Vorschau', tg && tg.chat_id === '987654321' && /Test von Scalp Desk/.test(tg.text) && /is_disabled/.test(tg.link_preview_options || ''), JSON.stringify(tg));
    await page.fill('#dc-url', DC_URL); await page.click('#dc-test');
    check('Discord-Test zugestellt', await waitText(page, '#dc-status', /zugestellt/, 6000), await text(page, '#dc-status'));
    sent = await h.ctl('/sent'); const dc = sent.find(s => s.svc === 'dc');
    check('Discord ohne @-Erwähnungen', dc && /Test von Scalp Desk/.test(dc.content) && Array.isArray(dc.allowed_mentions?.parse) && !dc.allowed_mentions.parse.length, JSON.stringify(dc));
    await page.click('#chan-done');
    check('Zusammenfassung im Menü', /Telegram: aktiv.*Discord: aktiv/.test(await text(page, '#chan-summary')), await text(page, '#chan-summary'));
    // Zugangsdaten nicht im Backup
    await page.click('#backup-badge');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#backup-save')]);
    const body = require('fs').readFileSync(await dl.path(), 'utf8');
    check('Backup enthält weder Token noch Webhook', !body.includes(TG_TOKEN.split(':')[1]) && !body.includes('webhooks'), `${body.length} Zeichen`);
    // Alarm → genau eine Meldung je Kanal, auch mit zweitem Tab
    const b = await ctx.newPage(); h.collect(b, errors); await b.goto(h.URL_BASE + '/weather-widget-v2.html'); await b.waitForFunction(() => document.getElementById('price').textContent.trim() !== '—');
    await h.ctl('/sentreset'); await h.ctl('/walk?on=0');
    const st = await h.ctl('/state'), p0 = st.price.BTCUSDT;
    await page.click('#alarm-toggle'); await page.fill('#al-symbol', 'BTC'); await page.fill('#al-price', String((p0 * 1.002).toFixed(2)).replace('.', ',')); await page.fill('#al-note', 'Ausbruch'); await page.click('#al-save');
    await page.waitForFunction(() => document.getElementById('alarm-form').hidden, null, { timeout: 8000 });
    await b.waitForFunction(() => document.querySelectorAll('.al-row').length === 1, null, { timeout: 5000 }).catch(() => {});
    await h.ctl(`/set?symbol=BTCUSDT&price=${(p0 * 1.004).toFixed(2)}`);
    sent = await sentWait(s => s.filter(x => /Kurs-Alarm BTC/.test(x.text || x.content || '')).length >= 2, 10000);
    await h.sleep(2500); sent = await h.ctl('/sent');
    const al = sent.filter(x => /Kurs-Alarm BTC/.test(x.text || x.content || ''));
    check('Kurs-Alarm an Telegram und Discord – je genau einmal trotz zwei Tabs', al.filter(x => x.svc === 'tg').length === 1 && al.filter(x => x.svc === 'dc').length === 1, JSON.stringify(al.map(x => x.svc)));
    check('Meldungstext mit Kurs und Notiz', /auf\/über .* USDT erreicht · Kurs .*\nNotiz: Ausbruch\n\d\d:\d\d:\d\d Uhr/.test(al[0]?.text || al[0]?.content || ''), JSON.stringify(al[0]?.text || al[0]?.content));
    await b.close();
    // 429: Telegram bittet um Pause → erneuter Versuch
    await h.ctl('/sentreset'); await h.ctl('/chan?tg429=1');
    await page.click('#alarm-toggle'); await page.fill('#al-symbol', 'BTC'); const p1 = (await h.ctl('/state')).price.BTCUSDT;
    await page.fill('#al-price', String((p1 * 0.998).toFixed(2)).replace('.', ',')); await page.click('#al-save');
    await page.waitForFunction(() => document.getElementById('alarm-form').hidden, null, { timeout: 8000 });
    await h.ctl(`/set?symbol=BTCUSDT&price=${(p1 * 0.996).toFixed(2)}`);
    sent = await sentWait(s => s.filter(x => x.svc === 'tg').length >= 2, 9000);
    check('Nach „Too Many Requests“ erneut gesendet', sent.filter(x => x.svc === 'tg').length === 2, JSON.stringify(sent.map(x => x.svc)));
    await h.ctl('/walk?on=1');
    check('keine Fehler', !errors.filter(e => !/429|Failed to load resource/.test(e)).length, errors.join(' | ')); await ctx.close();
  },
  async chanerrors(browser) {
    const { ctx, page, errors } = await open(browser, { init: [{ fn: seedChan, arg: { token: TG_TOKEN, url: DC_URL.replace('/123456789012345678/', '/404456789012345678/') } }] });
    await page.click('#notify-menu'); await page.click('#chan-open');
    await page.fill('#tg-chat', '111'); await page.click('#tg-test');
    check('Falsche Chat-ID verständlich erklärt', await waitText(page, '#tg-status', /Chat nicht gefunden – dem Bot zuerst eine Nachricht schreiben/, 6000), await text(page, '#tg-status'));
    await page.click('#dc-test');
    check('Gelöschter Webhook verständlich erklärt', await waitText(page, '#dc-status', /gibt es nicht mehr/, 6000), await text(page, '#dc-status'));
    await h.ctl('/chan?updates=0'); await page.click('#tg-detect');
    check('Noch keine Nachricht an den Bot: Hinweis „Start“ tippen', await waitText(page, '#tg-status', /noch keine Nachricht von dir/, 6000), await text(page, '#tg-status'));
    // Ohne CORS-Freigabe: Zustellung unbestätigt, danach ohne Doppel-Sendung
    await h.ctl('/chan?nocors=1'); await h.ctl('/sentreset'); await page.fill('#tg-chat', '987654321'); await page.click('#tg-test');
    check('Ohne lesbare Antwort: „nicht bestätigen“', await waitText(page, '#tg-status', /nicht bestätigen/, 6000), await text(page, '#tg-status'));
    await h.ctl('/sentreset'); await page.click('#tg-test'); await h.sleep(1500);
    const s2 = (await h.ctl('/sent')).filter(x => x.svc === 'tg');
    check('Danach nur noch eine Anfrage je Meldung', s2.length === 1 && s2[0].mode === 'no-cors', JSON.stringify(s2.map(x => x.mode)));
    await h.ctl('/chan?nocors=0');
    await page.click('#chan-done');
    check('Zugangsdaten nicht im QR-/Backup-Inhalt', await page.evaluate(t => !JSON.stringify(localStorage.getItem('scalpdesk.positions.v1') || '').includes(t), TG_TOKEN));
    check('keine Fehler', !errors.filter(e => !/40[04]|Failed to load resource|CORS|Access-Control/.test(e)).length, errors.join(' | ')); await ctx.close();
  },
  async possl(browser) {
    const now = Date.now();
    const seed = ({ token, url, now }) => { if (localStorage.getItem('scalpdesk.savedat.v1')) return;
      localStorage.setItem('scalpdesk.channels.v1', JSON.stringify({ tg: { token, chat: '987654321', on: true }, dc: { url, on: true }, ev: { alarm: true, pos: true, day: true } }));
      localStorage.setItem('scalpdesk.positions.v1', JSON.stringify([{ id: 'ps1', symbol: 'ETHUSDT', side: 'long', mode: 'isolated', entry: 2500, leverage: 10, qty: 1, margin: 250, openedAt: now - 3600e3, source: 'spot', liqExchange: null, preRealized: 0, sl: 2480, tp: 2600, ack: { sl: false, tp: false } }])); };
    await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=ETHUSDT&price=2500');
    const { ctx, page, errors } = await open(browser, { init: [{ fn: seed, arg: { token: TG_TOKEN, url: DC_URL, now } }] });
    await h.sleep(1500); await h.ctl('/sentreset');
    await h.ctl('/set?symbol=ETHUSDT&price=2475');
    let sent = await sentWait(s => s.length >= 2, 8000);
    check('Stop-Loss an Telegram und Discord', sent.filter(x => /🛑 ETH Long: Stop-Loss erreicht/.test(x.text || x.content || '')).length === 2, JSON.stringify(sent.map(x => (x.text || x.content || '').split('\n')[0])));
    await h.sleep(2000); sent = await h.ctl('/sent');
    check('Solange der Kurs unter dem Stop bleibt: keine Wiederholung', sent.length === 2, String(sent.length) + ' ' + JSON.stringify(sent.map(x => ({ svc: x.svc, m: x.method, t: (x.text || x.content || x.caption || '').slice(0, 50), chat: x.chat_id }))));
    await page.click('.toast.sl button'); await h.ctl('/set?symbol=ETHUSDT&price=2495'); await h.sleep(2500);
    await h.ctl('/set?symbol=ETHUSDT&price=2470');
    sent = await sentWait(s => s.length >= 4, 8000);
    check('Kurs zurück und erneut unter dem Stop: neue Meldung', sent.length === 4, String(sent.length));
    await page.reload(); await page.waitForFunction(() => document.getElementById('price').textContent.trim() !== '—'); await h.sleep(2500);
    check('Neu laden mit Kurs unter dem Stop: keine Doppel-Meldung', (await h.ctl('/sent')).length === 4, String((await h.ctl('/sent')).length));
    await h.ctl('/walk?on=1');
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async daylimit(browser) {
    const now = Date.now(), today = new Date(now);
    const seed = ({ token, now }) => { if (localStorage.getItem('scalpdesk.savedat.v1')) return;
      localStorage.setItem('scalpdesk.channels.v1', JSON.stringify({ tg: { token, chat: '987654321', on: true }, dc: { url: '', on: true }, ev: { alarm: true, pos: true, day: true } }));
      localStorage.setItem('scalpdesk.daylimit.v1', '30');
      localStorage.setItem('scalpdesk.history.v1', JSON.stringify([{ id: 'dl1', symbol: 'BTCUSDT', side: 'long', mode: 'cross', entry: 64000, leverage: 10, qty: 0.1, margin: 640, openedAt: now - 1800e3, source: 'spot', liqExchange: null, preRealized: 0, sl: null, tp: null, ack: { sl: false, tp: false }, exit: 63600, fees: 0, pnl: -40, pnlSource: 'calc', closedAt: now - 60e3, fx: 1.16, note: '' }])); };
    const { ctx, page, errors } = await open(browser, { init: [{ fn: seed, arg: { token: TG_TOKEN, now } }] });
    const sent = await sentWait(s => s.some(x => /Tages-Verlustlimit/.test(x.text || '')), 8000);
    const m = sent.filter(x => /Tages-Verlustlimit/.test(x.text || ''));
    check('Tages-Verlustlimit an Telegram', m.length === 1 && /Heute −40,00 USDT realisiert · Limit 30,00 USDT/.test(m[0].text), JSON.stringify(m.map(x => x.text)));
    check('Banner im Dashboard', await visible(page, '#day-banner'));
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close(); void today;
  },
};
(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(tests);
  await h.setup(); await h.ctl('/reset');
  const browser = await h.launch();
  try { for (const n of names) { console.log(`▶ ${n}`); await h.ctl('/reset'); try { await tests[n](browser); } catch (e) { check(n + ' (Abbruch)', false, e.message.split('\n')[0]); } } }
  finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
