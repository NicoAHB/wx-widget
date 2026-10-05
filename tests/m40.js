// Ablaufplan Schritt 7 (3.24.0) – Gewinn- und Verlust-Alarm am Live-Ergebnis (und Schritt 4: das Live-Ergebnis öffnet das Feld):
// Antippen öffnet das Feld mit beiden Eingaben, Einheit und Bezug; ungültige Eingaben werden abgewiesen; Speichern bleibt nach
// dem Neuladen; Grenzfälle knapp darunter, genau auf und jenseits der Schwelle; je Aktivierung genau eine Nachricht an
// „Kursalarm“ (auch mit zwei Tabs), keine an den Sicherungschat; „Wieder aktivieren“ bei schon erreichter Grenze ohne
// sofortiges Duplikat; Deaktivieren; ohne offene Position keine Prüfung; normaler Reset löscht die Alarme; iPad quer, Handy.
// Eine BTC-Long-Position mit Menge 1 zum aktuellen Kurs: Live-Ergebnis = Kurs − Einstieg (in USDT). Aufruf: node m40.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw', ALERT = '987654321', BACKUP = '-1001234567890';
const CHAN = { tg: { token: TOKEN, chat: ALERT, thread: '', bchat: BACKUP, bthread: '12', on: true }, dc: { url: '', on: true }, ev: { alarm: true, pos: true, day: true, news: true, pnl: true, pulse: true } };
const KEY = 'scalpdesk.pnlalarm.v1';
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
const until = async (fn, ms = 15000, step = 200) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await h.sleep(step); } };
const pnlMsgs = async () => (await h.ctl('/sent')).filter(m => m.svc === 'tg' && /(Gewinn|Verlust)-Alarm/.test(m.text || ''));
const lbOpen = page => page.evaluate(() => document.getElementById('lb-open').textContent);
const stored = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const ui = page => page.evaluate(() => { const $ = id => document.getElementById(id); return { open: !$('pnl-panel').hidden, exp: $('lb-pos').getAttribute('aria-expanded'), now: $('pnl-now').textContent, err: $('pnl-err').hidden ? '' : $('pnl-err').textContent, msg: $('pnl-msg').textContent,
  pSt: $('pnl-profit-st').textContent, lSt: $('pnl-loss-st').textContent, pRe: !$('pnl-profit-rearm').hidden, lRe: !$('pnl-loss-rearm').hidden, badge: $('lb-pos').dataset.pnl || '', pInv: $('pnl-profit').getAttribute('aria-invalid'), lInv: $('pnl-loss').getAttribute('aria-invalid') }; });
let P0 = 0;
const setPnl = async (page, v) => { await h.ctl(`/set?symbol=BTCUSDT&price=${P0 + v}`); const want = `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2).replace('.', ',')} USDT`; await page.waitForFunction(w => document.getElementById('lb-open').textContent === w, want, { timeout: 10000 }).catch(() => {}); await page.waitForTimeout(700); return lbOpen(page); };
const fill = async (page, profit, loss) => { await page.fill('#pnl-profit', profit); await page.fill('#pnl-loss', loss); await page.click('#pnl-form [type=submit]'); await page.waitForTimeout(300); };
async function open(browser, opts, seedPos = true) {
  const ctx = await browser.newContext({ timezoneId: 'Europe/Berlin', acceptDownloads: true, ...opts });
  const now = Date.now(), pos = seedPos ? [{ id: 'p1', symbol: 'BTCUSDT', side: 'long', mode: 'isolated', entry: P0, leverage: 10, qty: 1, margin: P0 / 10, openedAt: now - 60e3, source: 'spot', liqExchange: null, preRealized: 0, sl: null, tp: null, ack: { sl: false, tp: false } }] : [];
  await ctx.addInitScript(([c, p]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem('scalpdesk.channels.v1', JSON.stringify(c)); localStorage.setItem('scalpdesk.positions.v1', JSON.stringify(p)); }, [CHAN, pos]);
  const page = await ctx.newPage(), errors = []; h.collect(page, errors);
  await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page); await page.waitForTimeout(1500);
  return { ctx, page, errors };
}
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset'); await h.ctl('/walk?on=0'); await h.ctl('/tgreset');
  P0 = Math.round((await h.ctl('/state')).price.BTCUSDT); await h.ctl(`/set?symbol=BTCUSDT&price=${P0}`);
  const browser = await h.launch();
  try {
    // ================= iPad hochkant (Touch) =================
    let { ctx, page, errors } = await open(browser, { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    check('Ausgangslage: Live-Ergebnis „0,00 USDT“ (eine Position, Menge 1)', await setPnl(page, 0) === '0,00 USDT', await lbOpen(page));
    await page.tap('#lb-pos'); await page.waitForTimeout(300);
    let u = await ui(page);
    const box = await page.evaluate(() => { const r = document.getElementById('pnl-panel').getBoundingClientRect(), p = document.getElementById('lb-pos').getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), posRight: Math.round(p.right), below: r.top >= p.bottom - 1 }; });
    check('Antippen des Live-Ergebnisses öffnet das Feld darunter (rechts, ganz im Bild)', u.open && u.exp === 'true' && box.below && box.l >= 0 && box.r <= 820 && box.b <= 1180, JSON.stringify(box));
    const labels = await page.evaluate(() => [...document.querySelectorAll('#pnl-panel .pnl-on')].map(l => l.textContent.trim()).join(' | ') + ' · ' + document.querySelector('#pnl-panel .pnl-ref').textContent);
    check('Zwei Eingaben „Benachrichtigung bei Gewinn“ / „… bei Verlust“, Einheit USDT und Bezug sichtbar', /^Benachrichtigung bei Gewinn \| Benachrichtigung bei Verlust · Bezug: das Live-Ergebnis „Offen“ .*USDT/.test(labels) && /jetzt 0,00 USDT · 1 Position/.test(u.now), labels);
    await page.tap('#pair-label'); await page.waitForTimeout(250);
    check('Tippen daneben schließt das Feld', !(await ui(page)).open);
    await page.tap('#lb-pos'); await page.waitForTimeout(250); await page.tap('#pnl-close'); await page.waitForTimeout(250);
    check('„×“ schließt das Feld', !(await ui(page)).open);
    await page.tap('#lb-pos'); await page.waitForTimeout(250);
    // ---- ungültige Eingaben ----
    await fill(page, 'abc', '-50'); u = await ui(page);
    check('Ungültig: „abc“ und „-50“ werden abgewiesen, markiert und nicht gespeichert', /Gewinn: kein gültiger Betrag/.test(u.err) && /Verlust: als positiven Betrag eingeben/.test(u.err) && u.pInv === 'true' && u.lInv === 'true' && !(await stored(page)), u.err);
    await fill(page, '0', ''); u = await ui(page);
    check('Ungültig: 0 wird abgewiesen', /Gewinn: muss größer als 0 sein/.test(u.err) && !(await stored(page))?.profit?.value, u.err);
    await page.fill('#pnl-profit', ''); await page.check('#pnl-profit-on'); await page.fill('#pnl-loss', ''); await page.click('#pnl-form [type=submit]'); await page.waitForTimeout(300); u = await ui(page);
    check('Aktiv ohne Betrag wird abgewiesen („Betrag fehlt“)', /Gewinn: Betrag fehlt/.test(u.err), u.err);
    // ---- gültig speichern ----
    await fill(page, '100', '50'); u = await ui(page); let s = await stored(page);
    check('Gültig: Gewinn 100, Verlust 50 gespeichert (aktiv, scharf), Fehler weg', !u.err && u.msg === 'Gespeichert.' && s?.profit?.value === 100 && s.profit.on && s.profit.state === 'armed' && s.loss.value === 50 && s.loss.on && s.loss.state === 'armed', JSON.stringify(s));
    check('Anzeige: „aktiv – meldet einmal bei Offen ≥ +100,00 USDT“ / „≤ −50,00 USDT“, Punkt am Live-Ergebnis', u.pSt === 'aktiv – meldet einmal bei Offen ≥ +100,00 USDT' && u.lSt === 'aktiv – meldet einmal bei Offen ≤ −50,00 USDT' && u.badge === 'on', `${u.pSt} / ${u.lSt}`);
    await page.tap('#pnl-close'); await page.waitForTimeout(200);
    // ---- Gewinn: knapp darunter, genau auf, jenseits ----
    await setPnl(page, 99.99); await page.waitForTimeout(1200);
    check('Knapp unter der Gewinnschwelle (+99,99 USDT): keine Nachricht', (await pnlMsgs()).length === 0 && (await stored(page)).profit.state === 'armed', await lbOpen(page));
    await setPnl(page, 100);
    let m = await until(async () => { const x = await pnlMsgs(); return x.length ? x : null; });
    check('Genau auf der Schwelle (+100,00 USDT): Nachricht „Gewinn-Alarm“ an Kursalarm', m?.length === 1 && m[0].chat_id === ALERT && !m[0].message_thread_id, JSON.stringify(m?.map(x => [x.chat_id, x.text])));
    check('Nachricht nennt Alarmtyp, aktuelles Live-Ergebnis und Schwelle', /^📈 Gewinn-Alarm\nLive-Ergebnis \+100,00 USDT \(1 offene Position\) · Schwelle ≥ \+100,00 USDT erreicht\n\d\d:\d\d:\d\d Uhr$/.test(m?.[0]?.text || ''), m?.[0]?.text);
    for (const v of [105, 110.5, 101, 130]) await setPnl(page, v);
    await page.waitForTimeout(1500);
    check('Weitere Kursänderungen jenseits der Schwelle: keine weitere Nachricht (kein Duplikat)', (await pnlMsgs()).length === 1, String((await pnlMsgs()).length));
    s = await stored(page); await page.tap('#lb-pos'); await page.waitForTimeout(250); u = await ui(page);
    check('Zustand „ausgelöst“ mit Zeit und Wert, „Wieder aktivieren“ sichtbar, Punkt gelb', s.profit.state === 'fired' && s.profit.firedVal === 100 && /^ausgelöst um \d\d:\d\d Uhr bei \+100,00 USDT/.test(u.pSt) && u.pRe && !u.lRe && u.badge === 'fired', u.pSt);
    // ---- Neuladen: Zustand bleibt, keine neue Nachricht ----
    await page.reload(); await live(page); await page.waitForTimeout(2500);
    await page.tap('#lb-pos'); await page.waitForTimeout(300); u = await ui(page);
    check('Nach dem Neuladen: Werte und Zustand erhalten, keine neue Nachricht', (await page.inputValue('#pnl-profit')) === '100' && (await page.inputValue('#pnl-loss')) === '50' && /^ausgelöst/.test(u.pSt) && (await pnlMsgs()).length === 1, `${await page.inputValue('#pnl-profit')} / ${u.pSt}`);
    // ---- Wieder aktivieren, während die Grenze noch erreicht ist ----
    await page.tap('#pnl-profit-rearm'); await page.waitForTimeout(800); u = await ui(page); s = await stored(page);
    check('„Wieder aktivieren“ bei +130 (Grenze schon erreicht): wartet, keine sofortige Nachricht', s.profit.state === 'wait' && /schon erreicht/.test(u.pSt) && (await pnlMsgs()).length === 1, u.pSt);
    await page.tap('#pnl-close'); await page.waitForTimeout(200);
    await setPnl(page, 90); s = await stored(page);
    check('Ergebnis fällt unter die Grenze (+90): wieder scharf', s.profit.state === 'armed');
    await setPnl(page, 120);
    m = await until(async () => { const x = await pnlMsgs(); return x.length >= 2 ? x : null; });
    check('Jenseits der Schwelle (+120,00 USDT): genau eine neue Nachricht mit dem aktuellen Wert', m?.length === 2 && /Live-Ergebnis \+120,00 USDT/.test(m[1].text) && m[1].chat_id === ALERT, m?.[1]?.text);
    // ---- Verlust: knapp darüber, genau auf, jenseits ----
    await setPnl(page, -49.99); await page.waitForTimeout(1200);
    check('Knapp über der Verlustgrenze (−49,99 USDT): keine Nachricht', !(await pnlMsgs()).some(x => /Verlust-Alarm/.test(x.text)));
    await setPnl(page, -50);
    m = await until(async () => { const x = (await pnlMsgs()).filter(y => /Verlust-Alarm/.test(y.text)); return x.length ? x : null; });
    check('Genau auf der Verlustgrenze (−50,00 USDT): „Verlust-Alarm“ an Kursalarm', m?.length === 1 && m[0].chat_id === ALERT && /^📉 Verlust-Alarm\nLive-Ergebnis −50,00 USDT \(1 offene Position\) · Schwelle ≤ −50,00 USDT erreicht/.test(m[0].text), m?.[0]?.text);
    for (const v of [-55, -70.25, -51]) await setPnl(page, v);
    await page.waitForTimeout(1200);
    check('Jenseits der Verlustgrenze: keine Nachrichtenserie', (await pnlMsgs()).filter(y => /Verlust-Alarm/.test(y.text)).length === 1);
    check('Alle Gewinn-/Verlust-Nachrichten nur an Kursalarm, keine an den Sicherungschat', (await pnlMsgs()).every(x => x.chat_id === ALERT) && !(await h.ctl('/sent')).some(x => x.chat_id === BACKUP && /Alarm/.test(x.text || '')));
    // ---- Deaktivieren und wieder aktivieren ----
    await page.tap('#lb-pos'); await page.waitForTimeout(250);
    await page.uncheck('#pnl-loss-on'); await page.click('#pnl-form [type=submit]'); await page.waitForTimeout(300); u = await ui(page); s = await stored(page);
    check('Deaktivieren: Verlust-Alarm aus, Betrag bleibt stehen', !s.loss.on && s.loss.value === 50 && /^deaktiviert/.test(u.lSt) && !u.lRe, u.lSt);
    await page.tap('#pnl-close'); await setPnl(page, -80); await page.waitForTimeout(1000);
    check('Deaktiviert: auch weit jenseits keine Nachricht', (await pnlMsgs()).filter(y => /Verlust-Alarm/.test(y.text)).length === 1);
    await setPnl(page, -10);
    await page.tap('#lb-pos'); await page.waitForTimeout(250); await page.check('#pnl-loss-on'); await page.click('#pnl-form [type=submit]'); await page.waitForTimeout(300); s = await stored(page);
    check('Wieder einschalten (Ergebnis −10): scharf', s.loss.on && s.loss.state === 'armed');
    await page.tap('#pnl-close'); await setPnl(page, -60);
    m = await until(async () => { const x = (await pnlMsgs()).filter(y => /Verlust-Alarm/.test(y.text)); return x.length >= 2 ? x : null; });
    check('… und meldet beim nächsten Erreichen genau einmal', m?.length === 2 && /−60,00 USDT/.test(m[1].text), m?.[1]?.text);
    const errs1 = errors.slice(); await ctx.close();
    check('iPad hoch: keine Fehler', !errs1.length, errs1.join(' | '));

    // ================= Zwei Tabs: nur eine Nachricht =================
    await h.ctl('/tgreset'); await h.ctl(`/set?symbol=BTCUSDT&price=${P0}`);
    ({ ctx, page, errors } = await open(browser, { viewport: { width: 1440, height: 1000 } }));
    await page.click('#lb-pos'); await fill(page, '40', ''); await page.click('#pnl-close');
    const page2 = await ctx.newPage(); h.collect(page2, errors); await page2.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page2); await page2.waitForTimeout(1500);
    const st2 = await page2.evaluate(k => JSON.parse(localStorage.getItem(k)).profit, KEY);
    check('Zweiter Tab kennt die Einstellung', st2.value === 40 && st2.on && st2.state === 'armed', JSON.stringify(st2));
    await setPnl(page, 45); await page2.waitForTimeout(2500);
    const m2 = await pnlMsgs();
    check('Zwei offene Tabs: genau eine Nachricht, beide Tabs zeigen „ausgelöst“', m2.length === 1 && (await page.evaluate(k => JSON.parse(localStorage.getItem(k)).profit.state, KEY)) === 'fired' && (await page2.evaluate(() => document.getElementById('lb-pos').dataset.pnl)) === 'fired', String(m2.length));
    // ---- Ohne offene Position ----
    await page.evaluate(() => localStorage.setItem('scalpdesk.positions.v1', '[]')); await page2.close();
    await page.reload(); await live(page); await page.waitForTimeout(2000);
    await page.click('#lb-pos'); await page.waitForTimeout(200);
    await page.click('#pnl-profit-rearm'); await page.waitForTimeout(300); u = await ui(page);
    check('Ohne offene Position: Hinweis im Feld, Alarm wieder aktiv', /^keine offene Position/.test(u.now) && (await stored(page)).profit.state === 'armed' && (await lbOpen(page)) === '—', u.now);
    await h.ctl(`/set?symbol=BTCUSDT&price=${P0 + 500}`); await page.waitForTimeout(2500);
    check('Ohne offene Position: keine Prüfung, keine Nachricht', (await pnlMsgs()).length === 1 && (await stored(page)).profit.state === 'armed');
    // ---- Normaler Reset löscht die Alarme ----
    await page.click('#pnl-close');
    await page.evaluate(() => { document.querySelector('[data-tab="pos"]')?.click(); });
    const dl = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    await page.evaluate(() => document.getElementById('reset-open').click()); await page.waitForTimeout(300); await page.evaluate(() => document.getElementById('reset-go').click()); await dl; await page.waitForTimeout(500);
    check('„Handelsdaten zurücksetzen“ löscht den Gewinn-/Verlust-Alarm', !(await stored(page)) && !(await page.evaluate(() => document.getElementById('lb-pos').dataset.pnl)));
    const errs2 = errors.slice(); await ctx.close();
    check('Computer (zwei Tabs): keine Fehler', !errs2.length, errs2.join(' | '));

    // ================= iPad quer und Handy: Feld passt, Live-Ergebnis bleibt sichtbar =================
    for (const [w, hh] of [[1180, 820], [390, 844], [320, 700]]) {
      await h.ctl(`/set?symbol=BTCUSDT&price=${P0 + 12.34}`);
      ({ ctx, page, errors } = await open(browser, { viewport: { width: w, height: hh }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }));
      await page.tap('#lb-pos'); await page.waitForTimeout(300);
      const g = await page.evaluate(() => { const r = document.getElementById('pnl-panel').getBoundingClientRect(), n = document.getElementById('lb-open').getBoundingClientRect(), inp = document.getElementById('pnl-profit').getBoundingClientRect();
        return { l: Math.round(r.left), r: Math.round(r.right), b: Math.round(r.bottom), sw: document.scrollingElement.scrollWidth - innerWidth, num: document.getElementById('lb-open').textContent, numVis: n.width > 4 && n.right <= innerWidth, inpH: Math.round(inp.height) }; });
      check(`${w}×${hh}: Feld ganz im Bild, Live-Ergebnis sichtbar, Eingabe fingergroß, kein seitliches Scrollen`, g.l >= 0 && g.r <= w && g.b <= hh && g.sw <= 0 && g.numVis && g.num === '+12,34 USDT' && g.inpH >= 40, JSON.stringify(g));
      await page.tap('#pnl-close'); await page.waitForTimeout(200);
      check(`${w}×${hh}: „×“ schließt, keine Fehler`, !(await ui(page)).open && !errors.length, errors.join(' | '));
      await ctx.close();
    }
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
