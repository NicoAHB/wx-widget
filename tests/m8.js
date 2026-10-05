// Verbindungs-Wächter im Browser: tote Verbindung, stille Leitung, Aufwachen, offline, Statusanzeige oben rechts in
// Grün/Gelb/Rot/Grau. Aufruf: node m8.js [testname ...]
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const desk = { viewport: { width: 1440, height: 900 } };
const phone = w => ({ viewport: { width: w, height: 800 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
async function open(browser, view) {
  const ctx = await browser.newContext(view), page = await ctx.newPage(), errors = []; h.collect(page, errors);
  await page.goto(h.URL_BASE + '/weather-widget-v2.html');
  await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return { ctx, page, errors };
}
const log = since => h.ctl('/log?since=' + since);
const waitLog = async (since, pred, ms) => { for (const end = Date.now() + ms; Date.now() < end; await h.sleep(50)) { const e = (await log(since)).find(pred); if (e) return e; } return null; };
const feed = page => page.evaluate(() => document.getElementById('status').dataset.feed);
const waitFeed = (page, v, ms) => page.waitForFunction(v => document.getElementById('status').dataset.feed === v, v, { timeout: ms }).then(() => true, () => false);
// Farbe eines CSS-Tokens und der beiden Anzeigen (Punkt vor dem Text oben, Punkt in der Live-Leiste)
const colors = page => page.evaluate(() => {
  const tok = v => { const i = document.createElement('i'); i.style.color = `var(${v})`; document.body.append(i); const c = getComputedStyle(i).color; i.remove(); return c; };
  const s = document.getElementById('status'), dot = document.getElementById('lb-conn');
  return { feed: s.dataset.feed, text: s.textContent, dotFeed: dot.dataset.feed, head: getComputedStyle(s, '::before').backgroundColor, dot: getComputedStyle(dot).backgroundColor, green: tok('--buy'), amber: tok('--amber'), red: tok('--down'), grey: tok('--faint') };
});
const tests = {
  async zombie(browser) {
    const { ctx, page, errors } = await open(browser, desk);
    await page.evaluate(() => { window.__feed = []; const s = document.getElementById('status'), add = () => { if (window.__feed.at(-1) !== s.dataset.feed) window.__feed.push(s.dataset.feed); }; add(); new MutationObserver(add).observe(s, { attributes: true, attributeFilter: ['data-feed'] }); });
    const t0 = Date.now(), z = await h.ctl('/zombie');
    const opened = await waitLog(t0, e => e.ws === 'open', 12000), L = await log(t0 - 1);
    const probe = L.find(e => e.ws === 'msg' && e.zombie && e.d?.method === 'LIST_SUBSCRIPTIONS'), closed = L.find(e => e.ws === 'close' && e.zombie);
    check('Verbindung verstummt (halboffen, wie nach Standby oder WLAN-Wechsel)', z.zombies >= 1, `${z.zombies} Verbindung(en)`);
    check('Wächter schickt eine Kontrollanfrage an Binance', !!probe && probe.at - t0 <= 4700, probe ? `${probe.at - t0} ms nach dem Verstummen` : 'keine');
    check('Tote Verbindung hart geschlossen und sofort neu geöffnet – nach höchstens 7,6 s', !!opened && !!closed && opened.at - t0 <= 7600 && Math.abs(closed.at - opened.at) <= 300, opened ? `neu nach ${opened.at - t0} ms, alte geschlossen nach ${closed ? closed.at - t0 : '–'} ms` : 'keine neue Verbindung');
    check('Anzeige wieder grün', await waitFeed(page, 'live', 5000));
    const seq = await page.evaluate(() => window.__feed.join(' → '));
    check('Anzeige: grün → gelb (Neuaufbau) → grün', /^live → rest( → rest)* → live$/.test(seq), seq);
    const p1 = await page.textContent('#lb-price'); await h.sleep(3000); const p2 = await page.textContent('#lb-price');
    check('Kurse laufen danach wieder live', p1 !== p2, `${p1} → ${p2}`);
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async quiet(browser) {
    const { ctx, page, errors } = await open(browser, desk);
    const t0 = Date.now(); await h.ctl('/silent?on=1'); await h.sleep(12000);
    const L = await log(t0), opens = L.filter(e => e.ws === 'open'), probes = L.filter(e => e.ws === 'msg' && e.d?.method === 'LIST_SUBSCRIPTIONS');
    const gaps = probes.map((p, i) => i ? p.at - probes[i - 1].at : null).slice(1);
    check('Leitung lebt, Binance schweigt: keine unnötige Neuverbindung in 12 s', !opens.length, `${opens.length} neue Verbindungen`);
    check('Kontrollanfragen im 3-s-Takt, nicht öfter', probes.length >= 3 && probes.length <= 5 && gaps.every(g => g >= 2800), `${probes.length} Anfragen, Abstände ${gaps.join('/')} ms`);
    check('Anzeige bleibt grün (Verbindung antwortet)', await feed(page) === 'live');
    await h.ctl('/silent?on=0');
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async wake(browser) {
    const { ctx, page, errors } = await open(browser, phone(390));
    const t0 = Date.now(); await h.ctl('/zombie'); await h.sleep(3300);
    const t1 = Date.now(); await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    const opened = await waitLog(t0, e => e.ws === 'open', 3000);
    check('Zurück aus Standby/Hintergrund: neue Verbindung binnen 1 s, vor dem Wächter', !!opened && opened.at - t1 <= 1000 && opened.at - t0 < 4500, opened ? `${opened.at - t1} ms nach dem Zurückkehren` : 'keine');
    check('wieder live', await waitFeed(page, 'live', 5000));
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async offline(browser) {
    const { ctx, page, errors } = await open(browser, phone(390));
    await ctx.setOffline(true); await page.waitForTimeout(600);
    const c = await colors(page);
    check('Offline: sofort rot mit „Offline“, oben und in der Live-Leiste', c.feed === 'offline' && c.text === 'Offline' && c.dotFeed === 'offline' && c.head === c.red && c.dot === c.red, JSON.stringify(c));
    const t1 = Date.now(); await ctx.setOffline(false);
    const ok = await waitFeed(page, 'live', 8000), dt = Date.now() - t1;
    check('Wieder online: sofort neu verbunden und grün', ok && dt <= 6000, `${dt} ms`);
    const real = errors.filter(e => !/ERR_INTERNET_DISCONNECTED|Failed to fetch|WebSocket|NetworkError|Load failed/.test(e));
    check('keine Fehler (außer abgebrochenen Abrufen im Offline-Zustand)', !real.length, real.join(' | ')); await ctx.close();
  },
  async place(browser) {
    for (const [w, mob] of [[320, 1], [390, 1], [820, 1], [1024, 1], [1180, 1], [1440, 0]]) {
      const view = mob ? { viewport: { width: w, height: 900 }, hasTouch: true, isMobile: true } : { viewport: { width: w, height: 900 } };
      const { ctx, page, errors } = await open(browser, view);
      const r = await page.evaluate(() => {
        const R = e => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
        const st = R(document.getElementById('status')), br = R(document.querySelector('.brand'));
        const btns = [...document.querySelectorAll('.update-controls > :not(.status)')].filter(e => e.getClientRects().length).map(R);
        return { vw: innerWidth, st, br, overlap: btns.some(b => !(b[2] <= st[0] || b[0] >= st[2] || b[3] <= st[1] || b[1] >= st[3])) };
      });
      const topRow = r.st[1] < r.br[3] && r.st[3] > r.br[1];
      check(`${w}px: Verbindungsanzeige oben rechts (oberste Zeile, rechter Rand)`, r.vw - r.st[2] <= 28 && topRow && !r.overlap && r.st[0] > r.br[2], JSON.stringify(r));
      await page.evaluate(() => scrollTo(0, 1500)); await page.waitForTimeout(400);
      const d = await page.evaluate(() => { const e = document.getElementById('lb-conn'), b = e.getBoundingClientRect(), i = document.createElement('i'); i.style.color = 'var(--buy)'; document.body.append(i); const green = getComputedStyle(i).color; i.remove();
        return { y: scrollY, top: Math.round(b.top), right: Math.round(b.right), w: b.width, vw: innerWidth, bg: getComputedStyle(e).backgroundColor, green }; });
      check(`${w}px: beim Scrollen grüner Punkt oben rechts in der Live-Leiste`, d.y > 500 && d.w >= 8 && d.top < 110 && d.vw - d.right <= 28 && d.bg === d.green, JSON.stringify(d));
      check(`${w}px: keine Fehler`, !errors.length, errors.join(' | ')); await ctx.close();
    }
  },
  async colors(browser) {
    const { ctx, page, errors } = await open(browser, phone(390));
    let c = await colors(page);
    check('Live: grün', c.feed === 'live' && c.head === c.green && c.dot === c.green, JSON.stringify(c));
    await page.click('#pause'); await page.waitForTimeout(400); c = await colors(page);
    check('Pausiert: grau', c.feed === 'off' && c.text === 'Pausiert' && c.head === c.grey && c.dot === c.grey, JSON.stringify(c));
    await page.click('#pause'); await waitFeed(page, 'live', 10000);
    await h.ctl('/blockws?on=1'); await waitFeed(page, 'rest', 15000); c = await colors(page);
    check('Nur Abruf per REST (Live-Stream gesperrt): gelb', c.feed === 'rest' && c.head === c.amber && c.dot === c.amber, JSON.stringify(c));
    await h.ctl('/restfail?on=1'); await page.click('#refresh'); await waitFeed(page, 'error', 15000); c = await colors(page);
    check('Datenfehler: rot', c.feed === 'error' && c.head === c.red && c.dot === c.red, JSON.stringify(c));
    await h.ctl('/restfail?on=0'); await h.ctl('/blockws?on=0');
    check('danach wieder grün', await waitFeed(page, 'live', 45000));
    const real = errors.filter(e => !/WebSocket|ERR_|403|500|status of 5\d\d|Failed to fetch/.test(e));
    check('keine Fehler (außer den absichtlich gesperrten Abrufen)', !real.length, real.join(' | ')); await ctx.close();
  },
};
(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(tests);
  await h.setup(); await h.sleep(300);
  const browser = await h.launch();
  try { for (const n of names) { console.log(`▶ ${n}`); await h.ctl('/reset'); try { await tests[n](browser); } catch (e) { check(n + ' (Abbruch)', false, e.message.split('\n')[0]); } } }
  finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
