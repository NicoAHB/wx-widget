// BTC-Puls (3.24.0) im Browser: Schwellen je Uhrzeit aus 35 Tagen BTC-5m-Kerzen (Anzeige im Einrichtungsfenster), echte
// Bewegung über den Test-Server → Nachricht an Telegram „Kursalarm“ mit Vorauswahl-Zeile, nachts lautlos, Hinweis in der App;
// Sperre je Richtung (keine Serie), „legt weiter zu“ genau einmal, Gegenrichtung frei; tagsüber mit Ton; ausgeschaltet:
// nichts. Aufruf: node m42.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw', ALERT = '987654321', BACKUP = '-1001234567890';
const chanCfg = pulse => ({ tg: { token: TOKEN, chat: ALERT, thread: '', bchat: BACKUP, bthread: '12', on: true }, dc: { url: '', on: true }, ev: { alarm: true, pos: true, day: true, news: true, pnl: true, pulse } });
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
const until = async (fn, ms = 15000, step = 250) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await h.sleep(step); } };
const pulses = async since => (await h.ctl('/sent')).filter(m => m.svc === 'tg' && /^⚡ BTC-Puls/.test(m.text || '') && m.at >= since);
// Zeitzone, in der es jetzt `hour` Uhr ist (Etc/GMT-x = UTC+x)
const tzAt = hour => { const off = (hour - new Date().getUTCHours() + 24) % 24, o = off > 12 ? off - 24 : off; return o === 0 ? 'Etc/GMT' : o > 0 ? `Etc/GMT-${o}` : `Etc/GMT+${-o}`; };
async function open(browser, tz, pulse = true) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: tz });
  await ctx.addInitScript(c => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.setItem('scalpdesk.channels.v1', JSON.stringify(c)); }, chanCfg(pulse));
  const page = await ctx.newPage(), errors = []; h.collect(page, errors);
  await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page);
  // Vorauswahl-Kacheln geladen (für die zweite Zeile der Nachricht)
  await page.waitForFunction(() => [...document.querySelectorAll('#watchlist .wl-sig')].every(s => /^[+−]?\d$/.test(s.textContent)), null, { timeout: 30000 }).catch(() => {});
  return { ctx, page, errors };
}
const flatBtc = async () => { await h.ctl('/shape?symbol=BTCUSDT&interval=1m&kind=flat&n=60'); return (await h.ctl('/state')).price.BTCUSDT; };
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset'); await h.ctl('/walk?on=0'); await h.ctl('/tgreset');
  const browser = await h.launch();
  try {
    // ================= Nachts (23 Uhr Ortszeit) =================
    let P0 = await flatBtc(); const tzN = tzAt(23);
    let { ctx, page, errors } = await open(browser, tzN);
    const info = await until(() => page.evaluate(() => { const t = document.getElementById('pulse-info').textContent; return /ab [\d,]+ % in 5 Min\./.test(t) ? t : null; }), 30000);
    check('Schwellen je Uhrzeit berechnet (35 Tage BTC-5m-Kerzen), Anzeige mit Uhrzeit und Mindestgrößen', info && /^jetzt \(23 Uhr\) ab 0,50 % in 5 Min\. oder 0,80 % in 15 Min\. · aus 35 Tagen BTC-Kerzen$/.test(info), info);
    const subs = new Set((await h.ctl('/state')).conns.flatMap(c => c.streams));
    check('Live: 1m-Kerzen von BTC (Spot) abonniert', subs.has('btcusdt@kline_1m'));
    await page.waitForTimeout(2500);
    let t0 = Date.now();
    check('Ruhiger Kurs: kein Puls', !(await pulses(0)).length);
    // −3 % in wenigen Sekunden
    await h.ctl(`/set?symbol=BTCUSDT&price=${P0 * 0.97}`);
    let m = await until(async () => { const x = await pulses(t0); return x.length ? x : null; });
    const txt = m?.[0]?.text || '';
    check('BTC −3 %: Nachricht an „Kursalarm“ (nicht an den Sicherungschat)', m?.length === 1 && m[0].chat_id === ALERT && !m[0].message_thread_id, JSON.stringify(m?.map(x => x.chat_id)));
    check('Inhalt: Richtung, Größe, 5-Minuten-Fenster, Kurs, „ungewöhnlich stark für 23 Uhr“ mit Schwelle', /^⚡ BTC-Puls: BTC −3,00 % in 5 Min\. \([\d.,]+ USDT\) – ungewöhnlich stark für 23 Uhr \(Schwelle 0,50 %\)$/.test(txt.split('\n')[0]), txt.split('\n')[0]);
    check('Zweite Zeile: die Vorauswahl im selben Zeitraum (ohne BTC), keine Prognose', /^Vorauswahl im selben Zeitraum: ETC [+−]?\d+,\d\d % · BCH [+−]?\d+,\d\d % · LTC [+−]?\d+,\d\d % · XRP [+−]?\d+,\d\d % · NEAR [+−]?\d+,\d\d %$/.test(txt.split('\n')[1] || '') && !/(wird|dürfte|Prognose|erwart)/i.test(txt), txt.split('\n')[1]);
    check('Nachts lautlos (disable_notification)', m?.[0]?.disable_notification === 'true', String(m?.[0]?.disable_notification));
    const toast = await page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent).find(t => /BTC-Puls/.test(t)) || '');
    check('Hinweis in der App', /⚡ BTC-Puls: BTC −3,00 % in 5 Min\./.test(toast), toast.slice(0, 90));
    // Sperre: weiter fallen, aber nicht deutlich (−3,5 %) → nichts; deutlich (−5 %) → eine weitere; noch mehr → nichts
    await h.ctl(`/set?symbol=BTCUSDT&price=${P0 * 0.965}`); await page.waitForTimeout(2500);
    check('−3,5 % (weniger als das 1,5-Fache): keine zweite Nachricht', (await pulses(t0)).length === 1);
    await h.ctl(`/set?symbol=BTCUSDT&price=${P0 * 0.95}`);
    m = await until(async () => { const x = await pulses(t0); return x.length >= 2 ? x : null; });
    check('−5 % (deutlich mehr): genau eine weitere Nachricht „Bewegung legt weiter zu“', m?.length === 2 && /BTC −5,00 % in 5 Min\. \([\d.,]+ USDT\) – Bewegung legt weiter zu/.test(m[1].text), m?.[1]?.text.split('\n')[0]);
    await h.ctl(`/set?symbol=BTCUSDT&price=${P0 * 0.9}`); await page.waitForTimeout(2500);
    check('−10 %: innerhalb 30 Minuten keine weitere (keine Serie)', (await pulses(t0)).length === 2);
    // Gegenrichtung: +3 % gegenüber dem Kurs vor 5 Minuten
    await h.ctl(`/set?symbol=BTCUSDT&price=${P0 * 1.03}`);
    m = await until(async () => { const x = (await pulses(t0)).filter(y => /BTC \+/.test(y.text)); return x.length ? x : null; });
    check('Gegenrichtung (+3 %): eigene Nachricht, unabhängig von der Sperre abwärts', m?.length === 1 && /^⚡ BTC-Puls: BTC \+3,00 % in 5 Min\./.test(m[0].text), m?.[0]?.text.split('\n')[0]);
    // Zweiter Tab: sendet nicht doppelt
    const page2 = await ctx.newPage(); h.collect(page2, errors); await page2.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page2); await page2.waitForTimeout(4000);
    check('Zweiter Tab: keine erneute Nachricht (Sperre gilt über Tabs)', (await pulses(t0)).length === 3, String((await pulses(t0)).length));
    check('Nachts: keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();

    // ================= Tagsüber (12 Uhr): mit Ton =================
    await h.ctl('/tgreset'); P0 = await flatBtc();
    ({ ctx, page, errors } = await open(browser, tzAt(12)));
    await until(() => page.evaluate(() => /ab [\d,]+ % in 5 Min\./.test(document.getElementById('pulse-info').textContent)), 30000);
    await page.waitForTimeout(2500); t0 = Date.now();
    await h.ctl(`/set?symbol=BTCUSDT&price=${P0 * 0.98}`);
    m = await until(async () => { const x = await pulses(t0); return x.length ? x : null; });
    check('Tagsüber (12 Uhr) −2 %: Nachricht mit Ton, „ungewöhnlich stark für 12 Uhr“', m?.length === 1 && m[0].disable_notification === undefined && /BTC −2,00 % in 5 Min\. .* – ungewöhnlich stark für 12 Uhr/.test(m[0].text), `${m?.[0]?.disable_notification} · ${m?.[0]?.text.split('\n')[0]}`);
    check('Tagsüber: keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();

    // ================= Ausgeschaltet =================
    await h.ctl('/tgreset'); P0 = await flatBtc();
    ({ ctx, page, errors } = await open(browser, tzAt(12), false));
    await page.waitForTimeout(3000); t0 = Date.now();
    await h.ctl(`/set?symbol=BTCUSDT&price=${P0 * 0.95}`); await page.waitForTimeout(4000);
    await page.click('#notify-menu'); await page.waitForTimeout(250); await page.click('#chan-open'); await page.waitForTimeout(400);
    const off = await page.textContent('#pulse-info');
    check('BTC-Puls ausgeschaltet: keine Nachricht, Anzeige „aus“', !(await pulses(t0)).length && off === 'aus', off);
    check('Ausgeschaltet: keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
