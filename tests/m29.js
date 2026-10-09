// 3.19.1 – Teilen am iPhone und Telegram-Sicherung auf Knopfdruck. Das Teilen-Menü ist nachgestellt wie in Safari: Es öffnet
// sich nur, wenn navigator.share noch im selben Tippen aufgerufen wird (window.event = das Tippen), sonst NotAllowedError.
// Ohne Passwort: ein Tippen genügt, nur die Datei (ohne Titel); mit Passwort: vorbereiten, dann „Jetzt teilen ↗“; Abbrechen;
// Meldung direkt unter den Knöpfen; „Jetzt an Telegram senden“ auch ohne Automatik. Aufruf: node m29.js (PAGE=… Gegenprobe)
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const PAGE = process.env.PAGE || 'weather-widget-v2.html';
// Bei einem seltenen mobilen Tipp-Timeout den tatsächlichen Ziel-/Trefferzustand erhalten.
// Keine längeren Wartezeiten, erzwungenen Klicks oder geänderten Ergebniserwartungen.
const tap = async (page, selector) => {
  try { await page.tap(selector); }
  catch (e) {
    const state = await page.evaluate(sel => {
      const el = document.querySelector(sel), r = el?.getBoundingClientRect();
      const hit = r && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { selector: sel, hidden: el?.hidden, rect: r?.toJSON(), hit: hit?.id || hit?.tagName,
        scrollY, viewport: [innerWidth, innerHeight], openDialogs: [...document.querySelectorAll('dialog[open]')].map(d => d.id) };
    }, selector).catch(() => null);
    console.log('Tipp-Diagnose ' + JSON.stringify(state)); console.log(e.message);
    throw e;
  }
};
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const TG = { tg: { token: '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw', chat: '987654321', on: true }, dc: { url: '', on: true }, ev: { alarm: true, pos: true, day: true, news: true } }; // Test-Token der Attrappe
// Teilen-Menü wie in Safari: nur im selben Tippen; mode 'abort' = Nutzer bricht ab
const shareStub = () => {
  window.__share = { calls: [], mode: 'ok' };
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: d => !!d && Array.isArray(d.files) && d.files.every(f => f instanceof File) });
  Object.defineProperty(navigator, 'share', { configurable: true, value: data => {
    const ev = window.event, inTap = !!ev && ['click', 'pointerup', 'touchend'].includes(ev.type);
    window.__share.calls.push({ inTap, keys: Object.keys(data || {}), files: (data?.files || []).map(f => ({ name: f.name, type: f.type, size: f.size })) });
    if (!inTap) return Promise.reject(new DOMException('The request is not allowed by the user agent or the platform in the current context.', 'NotAllowedError'));
    if (window.__share.mode === 'abort') return Promise.reject(new DOMException('Share canceled', 'AbortError'));
    return new Promise(r => setTimeout(r, 200));
  } });
};
const ui = page => page.evaluate(() => {
  const R = e => e.getBoundingClientRect(), b = document.getElementById('backup-share'), st = document.getElementById('history-status'), rb = R(b), rs = R(st);
  return { calls: window.__share.calls, btn: b.textContent, btnHidden: b.hidden, status: st.textContent, gap: Math.round(rs.top - rb.bottom), inView: rs.top >= 0 && rs.bottom <= innerHeight };
});
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset'); await h.ctl('/sentreset');
  const browser = await h.launch();
  try {
    // ---- Teilen am Handy ----
    let ctx = await browser.newContext(phone); await ctx.addInitScript(shareStub);
    let page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/' + PAGE); await live(page); await page.waitForTimeout(1500);
    await tap(page, '#backup-badge'); await page.waitForTimeout(600);
    const open = await page.evaluate(() => !document.getElementById('data-panel').hidden && !document.getElementById('backup-share').hidden);
    check('Handy: Datensicherung offen, Knopf „Teilen / in Dateien sichern“ da', open);
    await page.evaluate(() => document.getElementById('backup-share').scrollIntoView({ block: 'center' })); await page.waitForTimeout(300);
    await tap(page, '#backup-share'); await page.waitForTimeout(600); let u = await ui(page);
    const c0 = u.calls[0];
    check('Ohne Passwort: ein Tippen öffnet das Teilen-Menü (Aufruf noch im Tippen)', u.calls.length === 1 && c0.inTap, JSON.stringify(u.calls));
    check('Geteilt wird nur die Datei backup-JJJJ-MM-TT.json (ohne Titel)', c0 && c0.keys.join() === 'files' && c0.files.length === 1 && /^backup-\d{4}-\d\d-\d\d\.json$/.test(c0.files[0].name) && c0.files[0].type === 'application/json' && c0.files[0].size > 200, JSON.stringify(c0));
    check('Meldung „Backup geteilt …“ direkt unter den Knöpfen, im Bild', /^Backup geteilt\./.test(u.status) && u.gap >= 0 && u.gap <= 80 && u.inView, JSON.stringify({ status: u.status, gap: u.gap, inView: u.inView }));
    // mit Passwort: erst verschlüsseln (danach ist das Tippen vorbei), dann „Jetzt teilen ↗“
    await page.fill('#backup-pass', 'geheim-123'); await tap(page, '#backup-share'); await page.waitForTimeout(900); u = await ui(page);
    check('Mit Passwort: vorbereitet, Hinweis „noch einmal … tippen“ direkt unter dem Knopf', u.calls.length === 2 && !u.calls[1].inTap && u.btn === 'Jetzt teilen ↗' && /vorbereitet – zum Teilen noch einmal auf „Jetzt teilen ↗“ tippen/.test(u.status) && u.gap <= 80 && u.inView, JSON.stringify({ btn: u.btn, status: u.status, gap: u.gap }));
    await tap(page, '#backup-share'); await page.waitForTimeout(600); u = await ui(page);
    const c2 = u.calls[2];
    check('Zweites Tippen teilt die verschlüsselte Datei', c2 && c2.inTap && /^backup-\d{4}-\d\d-\d\d-verschluesselt\.json$/.test(c2.files[0].name) && /^Backup geteilt\./.test(u.status) && u.btn === 'Teilen / in Dateien sichern', JSON.stringify(c2));
    // Abbrechen
    await page.fill('#backup-pass', ''); await page.evaluate(() => { window.__share.mode = 'abort'; }); await tap(page, '#backup-share'); await page.waitForTimeout(500); u = await ui(page);
    check('Abgebrochen: „Teilen abgebrochen.“', u.status === 'Teilen abgebrochen.' && u.calls.at(-1).inTap, u.status);
    check('Teilen: keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();

    // ---- Telegram-Sicherung auf Knopfdruck, ohne Automatik ----
    ctx = await browser.newContext(phone); await ctx.addInitScript(shareStub); await ctx.addInitScript(c => localStorage.setItem('scalpdesk.channels.v1', JSON.stringify(c)), TG);
    page = await ctx.newPage(); errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/' + PAGE); await live(page); await page.waitForTimeout(1500);
    await tap(page, '#backup-badge'); await page.waitForTimeout(600);
    let t = await page.evaluate(() => ({ now: !document.getElementById('tgb-now').hidden && document.getElementById('tgb-now').textContent, auto: document.getElementById('tgb-on').checked, info: document.getElementById('tgb-info').textContent }));
    check('Telegram eingerichtet, Automatik aus: „Jetzt an Telegram senden“ sichtbar, Ziel genannt (3.25.0)', t.now === 'Jetzt an Telegram senden' && !t.auto && /schickt die Datei einmal direkt in den Sicherungschat/.test(t.info) && / · Ziel: (Sicherungschat|Kursalarm-Chat)/.test(t.info), JSON.stringify(t));
    await page.evaluate(() => document.getElementById('tgb-now').scrollIntoView({ block: 'center' })); await tap(page, '#tgb-now');
    let docs = []; for (let i = 0; i < 20 && !docs.length; i++) { await page.waitForTimeout(250); docs = (await h.ctl('/sent')).filter(m => m.svc === 'tg' && m.method === 'sendDocument'); }
    t = await page.evaluate(() => document.getElementById('tgb-info').textContent);
    check('… sendet die Datei direkt an Telegram, Stand in der Anzeige', docs.length === 1 && /Scalp-Desk-Sicherung/.test(docs[0].caption) && /Zuletzt gesendet \d/.test(t), JSON.stringify({ n: docs.length, caption: docs[0]?.caption?.split('\n')[0], info: t }));
    await tap(page, '#tgb-now'); await page.waitForTimeout(1500);
    const edits = (await h.ctl('/sent')).filter(m => m.svc === 'tg' && m.method === 'editMessageMedia');
    check('Nochmal senden ersetzt die vorige Nachricht (keine zweite Datei im Chat)', edits.length === 1 && (await h.ctl('/sent')).filter(m => m.method === 'sendDocument').length === 1, `${edits.length} ersetzt`);
    check('Telegram: keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
