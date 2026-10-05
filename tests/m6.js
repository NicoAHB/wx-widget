// Liquidations-Heatmap und bereinigte Vorauswahl (BSV). Aufruf: node m6.js [testname ...]
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const desk = { viewport: { width: 1600, height: 1000 } }, ipad = { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true };
const P = 3e5;
// 400er-Antworten für Kürzel ohne Futures protokolliert der Browser selbst als Konsolenfehler – das ist erwartet
const realErrors = errs => errs.filter(e => !/Failed to load resource: the server responded with a status of 400/.test(e));
async function open(browser, view, { init = [], path = '/' + (process.env.PAGE || 'weather-widget-v2.html'), ready = true } = {}) {
  const ctx = await browser.newContext(view); for (const [fn, arg] of init) await ctx.addInitScript(fn, arg);
  const page = await ctx.newPage(), errors = []; h.collect(page, errors);
  await page.goto(h.URL_BASE + path);
  if (ready) await page.waitForFunction(() => document.querySelector('#chart svg image.lmap') && document.getElementById('lm-short').dataset.price, null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(500);
  return { ctx, page, errors };
}
// Preis des Knopfes genau im Moment des Klicks (die Schätzung folgt dem laufenden Kurs und kann sich vorher ändern)
const armClick = (page, id) => page.evaluate(id => { const b = document.getElementById(id); b.addEventListener('click', () => { window.__clickedPrice = Number(b.dataset.price); }, { once: true, capture: true }); }, id);
const clickedPrice = page => page.evaluate(() => window.__clickedPrice);
const strip = page => page.evaluate(() => ({
  img: !!document.querySelector('#chart svg image.lmap'), hidden: document.getElementById('lmap-strip').hidden,
  src: document.getElementById('lm-src').textContent, note: document.getElementById('lm-note').hidden ? '' : document.getElementById('lm-note').textContent,
  short: Number(document.getElementById('lm-short').dataset.price) || null, long: Number(document.getElementById('lm-long').dataset.price) || null,
  shortText: document.getElementById('lm-short-v').textContent, longText: document.getElementById('lm-long-v').textContent,
  shortTitle: document.getElementById('lm-short').title, longTitle: document.getElementById('lm-long').title }));
// Erwartete Zonen für den OI-Sprung aus den Mock-Daten selbst nachrechnen (unabhängig vom Code des Dashboards)
async function spikeTruth(page) {
  return page.evaluate(async P => {
    const oi = await (await fetch('https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=5m&limit=500')).json();
    const i = oi.findIndex((x, j) => j && Number(x.sumOpenInterest) > Number(oi[j - 1].sumOpenInterest));
    const t = oi[i].timestamp - P, d = oi[i].sumOpenInterest - oi[i - 1].sumOpenInterest;
    const k = (await (await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=5m&startTime=${t}&limit=1`)).json())[0];
    const vwap = k[7] / k[5], share = Math.min(.9, Math.max(.1, k[9] / k[5])), mmr = Number(document.getElementById('mmr').value) / 100;
    const liq = (lev, side) => side === 'long' ? vwap * (1 - 1 / lev) / (1 - mmr) : vwap * (1 + 1 / lev) / (1 + mmr);
    return { vwap, share, mmr, usd: d * vwap, long20: liq(20, 'long'), short20: liq(20, 'short'), long10: liq(10, 'long'), short50: liq(50, 'short') };
  }, P);
}
const amountOf = title => { const m = /≈ ([\d.,]+) (Mio\.|Mrd\.|Tsd\.)/.exec(title || ''); return m ? Number(m[1].replace(/\./g, '').replace(',', '.')) * { 'Tsd.': 1e3, 'Mio.': 1e6, 'Mrd.': 1e9 }[m[2]] : NaN; };
const within = (a, b, rel) => Math.abs(a / b - 1) <= rel;
const tests = {
  async render(browser) {
    for (const [name, view] of [['Desktop', desk], ['iPad', ipad]]) {
      const { ctx, page, errors } = await open(browser, view);
      const s = await strip(page), box = await page.evaluate(() => { const i = document.querySelector('#chart svg image.lmap'), svg = i?.closest('svg'); return i ? { first: svg.querySelector('g[clip-path]').firstElementChild === i, w: +i.getAttribute('width'), href: (i.getAttribute('href') || '').slice(0, 22) } : null; });
      check(`${name}: Heatmap-Bild liegt als unterste Ebene im Chart`, s.img && box?.first && box.w > 100 && box.href === 'data:image/png;base64,', JSON.stringify(box));
      check(`${name}: Leiste zeigt Datenstand und je ein Cluster oberhalb/unterhalb`, !s.hidden && /Open Interest 5m · Stand \d\d:\d\d UTC/.test(s.src) && s.short > s.long && /^[\d.,]+ · \+[\d,]+ % · [\d.,]+ (Mio|Tsd|Mrd)\./.test(s.shortText) && /· −[\d,]+ % ·/.test(s.longText), `${s.src} | ${s.shortText} | ${s.longText}`);
      const cur = await page.evaluate(() => Number(document.getElementById('price').textContent.replace(/\./g, '').replace(',', '.')));
      check(`${name}: Shorts liegen über, Longs unter dem Kurs (±10 %)`, s.short > cur && s.long < cur && s.short < cur * 1.1 && s.long > cur * .9, `${s.long} < ${cur} < ${s.short}`);
      check(`${name}: keine Fehler`, !errors.length, errors.join(' | ')); await ctx.close();
    }
  },
  async spike(browser) {
    // Open Interest flach, 10 Werte vor jetzt ein Sprung um 6 %: genau eine Gruppe von Zonen
    await h.ctl('/oi?mode=spike&ago=10&amount=0.06');
    const { ctx, page, errors } = await open(browser, desk);
    const s = await strip(page), T = await spikeTruth(page);
    check('Short-Cluster = 20×-Short-Liquidation des Sprungs (VWAP, MMR aus dem Rechner)', within(s.short, T.short20, .002), `${s.short} vs ${T.short20.toFixed(2)} (VWAP ${T.vwap.toFixed(2)}, MMR ${T.mmr})`);
    check('Long-Cluster = 20×-Long-Liquidation des Sprungs', within(s.long, T.long20, .002), `${s.long} vs ${T.long20.toFixed(2)}`);
    const expShort = T.usd * (1 - T.share) * .3, expLong = T.usd * T.share * .3;
    check('Beträge = OI-Anstieg × VWAP × Taker-Anteil × 30 % (20×)', within(amountOf(s.shortTitle), expShort, .05) && within(amountOf(s.longTitle), expLong, .05), `${amountOf(s.shortTitle)} ≈ ${expShort.toFixed(0)}, ${amountOf(s.longTitle)} ≈ ${expLong.toFixed(0)}`);
    // Kurs läuft unter die 20×-Long-Zone: sie ist aufgelöst, das nächste Long-Cluster ist die 10×-Zone
    await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=BTCUSDT&price=' + (T.long20 * 0.995).toFixed(2));
    await page.waitForFunction(l => Math.abs(Number(document.getElementById('lm-long').dataset.price) / l - 1) > .01, T.long20, { timeout: 10000 }).catch(() => {});
    const s2 = await strip(page);
    check('Durchlaufene Zone verschwindet: Long-Cluster springt auf die 10×-Zone', within(s2.long, T.long10, .002), `${s2.long} vs ${T.long10.toFixed(2)}`);
    // Oberhalb: 20×-Short, solange sie höchstens 10 % über dem neuen Kurs liegt, sonst die nächst stärkere 50×-Zone
    const cur = await page.evaluate(() => Number(document.getElementById('price').textContent.replace(/\./g, '').replace(',', '.'))), expS = T.short20 <= cur * 1.1 ? T.short20 : T.short50;
    check('Oberhalb: stärkste Short-Zone im Bereich ±10 % um den neuen Kurs', within(s2.short, expS, .002), `${s2.short} vs ${expS.toFixed(2)} (Kurs ${cur}, 20× bei ${((T.short20 / cur - 1) * 100).toFixed(2)} %)`);
    await h.ctl('/set?symbol=BTCUSDT&price=' + (T.short20 / 1.12).toFixed(2));
    await page.waitForFunction(v => Math.abs(Number(document.getElementById('lm-short').dataset.price) / v - 1) > .01, T.short20, { timeout: 10000 }).catch(() => {});
    const s3 = await strip(page);
    check('Liegt die 20×-Short-Zone über 10 % entfernt, zählt die 50×-Zone', within(s3.short, T.short50, .002), `${s3.short} vs ${T.short50.toFixed(2)}`);
    await page.screenshot({ path: __dirname + '/shots/m6-spike.png', clip: await page.$eval('#chart-sec', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }) });
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async toggle(browser) {
    const { ctx, page, errors } = await open(browser, desk);
    await page.click('[data-overlay="lmap"]'); await page.waitForTimeout(600);
    const off = await strip(page);
    check('Aus: kein Bild, keine Leiste', !off.img && off.hidden);
    const since = Date.now(); await page.reload(); await page.waitForTimeout(4000);
    const off2 = await strip(page), log = (await h.ctl('/log?since=' + since)).filter(e => e.path === '/futures/data/openInterestHist' && e.q.limit === '500');
    check('Bleibt nach dem Neuladen aus und lädt dann nichts', !off2.img && off2.hidden && !log.length && await page.getAttribute('[data-overlay="lmap"]', 'aria-pressed') === 'false', `${log.length} Abrufe`);
    await page.click('[data-overlay="lmap"]');
    await page.waitForFunction(() => document.querySelector('#chart svg image.lmap') && document.getElementById('lm-short').dataset.price, null, { timeout: 15000 }).catch(() => {});
    const on = await strip(page);
    check('Wieder an: Daten werden sofort geladen', on.img && !on.hidden && on.short > 0);
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async delta(browser) {
    // Die Attrappe richtet Open Interest an der echten Uhr aus (5-Minuten-Raster, 5 s Verzug): den letzten Wert vor und nach
    // dem Test festhalten, damit eine Rastergrenze mitten im Test die Erwartung nicht verschiebt
    const t0 = Math.floor((Date.now() - 5000) / P) * P;
    const since = Date.now(), { ctx, page, errors } = await open(browser, desk);
    await page.click('[data-overlay="lmap"]'); await page.waitForTimeout(300); await page.click('[data-overlay="lmap"]');
    await page.waitForTimeout(2500);
    const log = (await h.ctl('/log?since=' + since)).filter(e => (e.path === '/futures/data/openInterestHist' && e.q.limit === '500') || (e.path === '/fapi/v1/klines' && e.q.interval === '5m' && e.q.limit === '500'));
    const oi = log.filter(e => e.path.includes('openInterest')), kl = log.filter(e => e.path.includes('klines'));
    check('Erster Abruf: volle Historie (500 Werte, ohne startTime)', oi[0] && !oi[0].q.startTime && kl[0] && !kl[0].q.startTime, JSON.stringify(oi.map(e => e.q)));
    const lastT = await page.evaluate(async () => (await (await fetch('https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=5m&limit=1')).json())[0].timestamp);
    check('Danach nur nachladen: ab dem vorletzten bekannten Wert', oi.length === 2 && [t0, lastT].some(t => Number(oi[1].q.startTime) === t - 2 * P) && kl.length === 2 && Number(kl[1].q.startTime) > 0, JSON.stringify([...oi.map(e => e.q.startTime || '-'), t0, lastT]));
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async persist(browser) {
    // Gleicher Browser-Kontext = gleiche IndexedDB: nach dem Neuladen sofort zeichnen und nur nachladen
    const { ctx, page, errors } = await open(browser, desk);
    await page.waitForTimeout(2600);   // gespeichert wird 2 s nach dem Abruf
    // Der Heatmap-Abruf wird festgehalten, bis geprüft ist, ob das Bild schon da ist – es kann dann nur aus dem Speicher kommen
    const since = Date.now(); let release; const gate = new Promise(r => { release = r; });
    await page.route('**/futures/data/openInterestHist**', async r => { if (/limit=500/.test(r.request().url())) await gate; await r.continue(); });
    await page.reload();
    const shownBeforeNet = await page.waitForFunction(() => document.querySelector('#chart svg image.lmap') && document.getElementById('lm-short').dataset.price, null, { timeout: 10000 }).then(() => true, () => false);
    release(); await page.waitForTimeout(2500);
    const log = (await h.ctl('/log?since=' + since)).filter(e => (e.path === '/futures/data/openInterestHist' || e.path === '/fapi/v1/klines') && e.q.limit === '500' && (e.q.period === '5m' || e.q.interval === '5m') && e.host === 'fapi.binance.com');
    check('Nach dem Neuladen: Heatmap sofort aus dem Speicher (Abruf absichtlich verzögert)', shownBeforeNet);
    check('Nach dem Neuladen: Open Interest und Futures-Kerzen nur nachgeladen', log.length >= 2 && log.every(e => !!e.q.startTime), JSON.stringify(log.map(e => e.path.split('/').pop() + (e.q.startTime ? ':Δ' : ':voll'))));
    await page.unroute('**/futures/data/openInterestHist**');
    // „Kerzen-Zwischenspeicher leeren“ leert auch die Heatmap-Daten
    await page.evaluate(() => document.getElementById('kc-clear').click()); await page.waitForTimeout(500);
    const since2 = Date.now(); await page.reload(); await page.waitForTimeout(4000);
    const log2 = (await h.ctl('/log?since=' + since2)).filter(e => e.path === '/futures/data/openInterestHist' && e.q.limit === '500');
    check('Nach „Zwischenspeicher leeren“: wieder vollständiger Abruf', log2.length >= 1 && !log2[0].q.startTime, JSON.stringify(log2.map(e => e.q.startTime || 'voll')));
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async nofutures(browser) {
    const { ctx, page, errors } = await open(browser, desk);
    await page.fill('#symbol', 'PAXG'); await page.click('#market-form [type=submit]');
    await page.waitForFunction(() => /keine USDT-Futures/.test(document.getElementById('lm-note').textContent), null, { timeout: 15000 }).catch(() => {});
    const s = await strip(page);
    check('Ohne Futures: Hinweis statt Clustern, kein Bild', /Für PAXG gibt es keine USDT-Futures/.test(s.note) && !s.img && await page.$eval('#lm-short', b => b.hidden), s.note);
    await page.fill('#symbol', 'BTC'); await page.click('#market-form [type=submit]');
    await page.waitForFunction(() => document.querySelector('#chart svg image.lmap') && document.getElementById('lm-short').dataset.price, null, { timeout: 15000 }).catch(() => {});
    const b = await strip(page);
    check('Zurück zu BTC: Heatmap und Cluster wieder da', b.img && b.short > 0 && !b.note);
    check('keine Fehler (außer den 400ern der Futures-Abrufe)', !realErrors(errors).length, realErrors(errors).join(' | ')); await ctx.close();
  },
  async interval(browser) {
    const since = Date.now(), { ctx, page, errors } = await open(browser, desk);
    await page.click('[data-interval="1h"]');
    await page.waitForFunction(() => /Open Interest 1h/.test(document.getElementById('lm-src').textContent) && document.querySelector('#chart svg image.lmap'), null, { timeout: 15000 }).catch(() => {});
    const s = await strip(page), log = (await h.ctl('/log?since=' + since)).filter(e => e.path === '/futures/data/openInterestHist' && e.q.limit === '500').map(e => e.q.period);
    check('1h-Chart: Open Interest je Stunde', /Open Interest 1h/.test(s.src) && s.img && log.includes('1h'), `${s.src} · ${log.join(',')}`);
    await page.screenshot({ path: __dirname + '/shots/m6-1h.png', clip: await page.$eval('#chart-sec', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }) });
    await page.click('[data-interval="1w"]'); await page.waitForTimeout(1500);
    const w = await strip(page);
    check('1w-Chart: Hinweis, keine Heatmap', /bis zum Intervall 1d/.test(w.note) && !w.img, w.note);
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async chip(browser) {
    let { ctx, page, errors } = await open(browser, desk);
    await armClick(page, 'lm-short'); await page.click('#lm-short'); await page.waitForTimeout(500); const s = { short: await clickedPrice(page) };
    const f = await page.evaluate(() => ({ open: !document.getElementById('alarm-form').hidden, price: document.getElementById('al-price').value, note: document.getElementById('al-note').value }));
    check('Desktop: Knopf füllt das Alarm-Formular mit Cluster-Preis und Notiz', f.open && Number(f.price.replace(',', '.')) === s.short && /^Liq-Cluster Shorts \(Schätzung, 1m\)$/.test(f.note), JSON.stringify(f));
    check('keine Fehler (Desktop)', !errors.length, errors.join(' | ')); await ctx.close();
    ({ ctx, page, errors } = await open(browser, ipad));
    await armClick(page, 'lm-long'); await page.click('#lm-long'); await page.waitForTimeout(500); const s2 = { long: await clickedPrice(page) };
    const q = await page.evaluate(() => ({ open: document.getElementById('qa-dialog').open, price: document.getElementById('qa-price').value, prev: document.getElementById('qa-preview').textContent }));
    check('iPad: Knopf öffnet den Schnell-Alarm mit Cluster-Preis', q.open && Number(q.price.replace(',', '.')) === s2.long && /🧲 Liq-Cluster Longs/.test(q.prev), JSON.stringify(q));
    await page.click('#qa-save'); await page.waitForTimeout(500);
    const al = await page.evaluate(() => JSON.parse(localStorage.getItem('scalpdesk.alarms.v1') || '[]').at(-1));
    check('Gespeicherter Alarm trägt die Cluster-Notiz', al && /Liq-Cluster Longs/.test(al.note || ''), JSON.stringify(al));
    await page.click('#qa-open'); await page.waitForTimeout(400);
    const lv = await page.$$eval('#qa-levels button', b => b.map(x => x.textContent));
    check('Schnell-Alarm schlägt die Cluster als Stufen vor', lv.some(t => t.startsWith('Liq-Cluster Shorts')) && lv.some(t => t.startsWith('Liq-Cluster Longs')), lv.join(' | '));
    check('keine Fehler (iPad)', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async stable(browser) {
    for (const w of [390, 820, 1180, 1600]) {
      const { ctx, page, errors } = await open(browser, { viewport: { width: w, height: 1000 }, hasTouch: w < 1200, isMobile: w < 1200 });
      const r = await page.evaluate(() => {
        const H = () => Math.round(document.getElementById('lmap-strip').getBoundingClientRect().height), out = [H()];
        const set = (id, t) => { document.getElementById(id).textContent = t; };
        set('lm-short-v', '104.123 · +9,9 % · 1.234 Mio.'); set('lm-long-v', '94.123 · −9,9 % · 999 Tsd.'); set('lm-src', 'Schätzung · Open Interest 15m · Stand 23:55 UTC · Nachladen fehlgeschlagen'); out.push(H());
        document.getElementById('lm-short-v').classList.add('skel'); document.getElementById('lm-long-v').classList.add('skel'); out.push(H());
        for (const id of ['lm-short', 'lm-long']) document.getElementById(id).hidden = true;
        const n = document.getElementById('lm-note'); n.hidden = false; n.textContent = 'Für ABCDEFGHIJ gibt es keine USDT-Futures – ohne Open Interest keine Heatmap. Liquidationsdaten nicht abrufbar: Binance antwortet mit Fehler.'; out.push(H());
        return out;
      });
      check(`${w}px: Leiste behält ihre Höhe (Daten, lange Werte, Laden, Hinweis)`, r.every(v => v === r[0]), r.join('/'));
      check(`${w}px: keine Fehler`, !errors.length, errors.join(' | ')); await ctx.close();
    }
  },
  // 3.23.1: Das Fenster enthält immer einen Kerzenschluss (1m) und einen Abgleich per REST. Dort lagen die seltenen langen
  // Aufgaben: Heatmap-Modell und -Bild, alle 61 Punkte des Signal-Verlaufs und ein doppeltes Zeichnen im selben Schritt.
  async perf(browser) {
    const res = {};
    for (const on of [true, false]) {
      const { ctx, page, errors } = await open(browser, desk, { init: on ? [] : [[() => localStorage.setItem('scalpdesk.overlays.v1', JSON.stringify({ vp: true, ema200: true, bb: true, liq: true, lmap: false })), null]], ready: on });
      await page.waitForTimeout(2000);
      // Start bei Sekunde 54: Kerzenschluss nach 6 s, danach bleiben 4 s für das Nachrechnen in eigenen Schritten
      await page.evaluate(() => new Promise(r => setTimeout(r, (54000 - Date.now() % 60000 + 60000) % 60000)));
      const cdp = await ctx.newCDPSession(page); await cdp.send('Performance.enable');
      const m0 = (await cdp.send('Performance.getMetrics')).metrics.find(m => m.name === 'ScriptDuration').value;
      const r = await page.evaluate(async () => {
        let urls = 0; const long = [], sec = new Date().getSeconds(), orig = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function (...a) { urls++; return orig.apply(this, a); };
        const po = new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.duration > 50) long.push(Math.round(e.duration)); }); try { po.observe({ type: 'longtask' }); } catch {}
        setTimeout(() => document.getElementById('refresh').click(), 2000);
        await new Promise(r => setTimeout(r, 10000)); po.disconnect(); return { urls, long, sec };
      });
      const m1 = (await cdp.send('Performance.getMetrics')).metrics.find(m => m.name === 'ScriptDuration').value;
      res[on ? 'an' : 'aus'] = { ...r, scriptMsPerS: Math.round((m1 - m0) * 1000 / 10) };
      if (errors.length) check(`keine Fehler (${on ? 'an' : 'aus'})`, false, errors.join(' | '));
      await ctx.close();
    }
    check('Bild wird nur bei Änderungen neu erzeugt (10 s Live-Kurse mit Kerzenschluss)', res.an.urls <= 12, JSON.stringify(res));
    check('Keine langen Aufgaben über 50 ms, auch beim Kerzenschluss und Abgleich (mit und ohne Heatmap)', !res.an.long.length && !res.aus.long.length && res.an.sec === 54 && res.aus.sec === 54, JSON.stringify(res));
    check('Rechenzeit mit Heatmap höchstens 25 ms je Sekunde mehr', res.an.scriptMsPerS - res.aus.scriptMsPerS <= 25, `an ${res.an.scriptMsPerS} ms/s, aus ${res.aus.scriptMsPerS} ms/s`);
  },
  // 3.23.1: Der Preisbereich des Charts folgt der laufenden Kerze. Kleine Verschiebungen dürfen das Bild nicht jedes Mal neu
  // erzeugen (vorher bei jedem Zeichnen, in einem fallenden Markt jede Sekunde); es hat oben und unten einen Rand
  async calm(browser) {
    await h.ctl('/walk?on=0');
    const { ctx, page, errors } = await open(browser, desk);
    await page.evaluate(() => new Promise(r => setTimeout(r, (5000 - Date.now() % 60000 + 60000) % 60000)));   // fern vom Kerzenschluss
    // Kurs fällt unter den bisherigen Bereich: Das Tief der laufenden Kerze begrenzt den Chart, jedes neue Tief verschiebt ihn
    const low = (await h.ctl('/state')).price.BTCUSDT * 0.92; await h.ctl(`/set?symbol=BTCUSDT&price=${low.toFixed(2)}`); await page.waitForTimeout(2500);
    const axis = () => page.evaluate(() => ({ y: document.querySelector('#chart svg image.lmap')?.getAttribute('y'), axis: [...document.querySelectorAll('#chart svg text.axis-label')].map(t => t.textContent).filter(t => /^[\d.,]+$/.test(t))[0] }));
    const before = await axis();
    await page.evaluate(() => { window.__urls = 0; const o = HTMLCanvasElement.prototype.toDataURL; HTMLCanvasElement.prototype.toDataURL = function (...a) { window.__urls++; return o.apply(this, a); }; });
    for (let i = 1; i <= 5; i++) { await h.ctl(`/set?symbol=BTCUSDT&price=${(low * (1 - i * 0.00003)).toFixed(2)}`); await page.waitForTimeout(1300); }
    const r = { urls: await page.evaluate(() => window.__urls), ...await axis() };
    check('Preisbereich verschiebt sich mit jedem neuen Tief', r.axis !== before.axis, JSON.stringify({ vorher: before.axis, nachher: r.axis }));
    check('Dabei kein neues Heatmap-Bild je Tief, nur verschoben (höchstens zwei, falls Zonen erreicht werden)', r.urls <= 2 && r.y !== before.y, JSON.stringify({ urls: r.urls, y: [before.y, r.y] }));
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  // 3.23.1: Spalten genau unter den Kerzen, auch wenn rechts Platz für eine Prognose frei bleibt (vorher über die ganze Breite
  // gestreckt)
  async align(browser) {
    await h.ctl('/walk?on=0'); await h.ctl('/shape?symbol=SOLUSDT&interval=1m&kind=ew-five');
    const { ctx, page, errors } = await open(browser, desk, { ready: false, init: [[() => localStorage.setItem('scalpdesk.overlays.v1', JSON.stringify({ vp: true, ema200: true, bb: true, liq: true, lmap: true, ew: true, ewfc: true })), null]] });
    await page.fill('#symbol', 'SOL'); await page.press('#symbol', 'Enter');
    await page.waitForFunction(() => document.getElementById('lb-sym').textContent === 'SOL' && document.querySelector('#chart svg image.lmap') && document.querySelector('#chart svg .ew-fc'), null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const g = await page.evaluate(() => {
      const svg = document.querySelector('#chart svg'), im = svg.querySelector('image.lmap'), cs = [...svg.querySelectorAll(':scope > rect[rx="0.4"]')].map(r => +r.getAttribute('x') + +r.getAttribute('width') / 2);
      const step = (cs.at(-1) - cs[0]) / (cs.length - 1), x = +im?.getAttribute('x'), w = +im?.getAttribute('width');
      return { fc: !!svg.querySelector('.ew-fc'), n: cs.length, step: +step.toFixed(2), left: +(x - (cs[0] - step / 2)).toFixed(2), right: +(x + w - (cs.at(-1) + step / 2)).toFixed(2), free: +(+svg.getAttribute('viewBox').split(' ')[2] - (x + w)).toFixed(0) };
    });
    check('Mit Prognose: Heatmap beginnt an der ersten und endet an der letzten Kerze', g.fc && g.n > 20 && Math.abs(g.left) < 1 && Math.abs(g.right) < 1 && g.free > 3 * g.step, JSON.stringify(g));
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async bsv(browser) {
    const chips = page => page.$$eval('#watchlist [data-watch]', b => b.map(x => x.dataset.watch));
    let { ctx, page, errors } = await open(browser, desk, { ready: false }); await page.waitForTimeout(1500);
    const def = await chips(page);
    check('Standard-Vorauswahl ohne BSV', !def.includes('BSV') && def.join() === 'BTC,ETC,BCH,LTC,XRP,NEAR', def.join());
    await ctx.close();
    // Gespeicherte Liste mit BSV (aus älterer Version): wird einmalig bereinigt
    ({ ctx, page, errors } = await open(browser, desk, { ready: false, init: [[() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('scalpdesk.watchlist.v1', JSON.stringify(['BTC', 'BSV', 'XRP'])); } }, null]] }));
    await page.waitForTimeout(1500);
    const cleaned = await chips(page), stored = await page.evaluate(() => JSON.parse(localStorage.getItem('scalpdesk.watchlist.v1')));
    check('Gespeicherte Liste: BSV entfernt, Rest bleibt', cleaned.join() === 'BTC,XRP' && stored.join() === 'BTC,XRP', `${cleaned.join()} / gespeichert ${stored.join()}`);
    // Wer BSV danach bewusst wieder hinzufügt, behält es
    await page.fill('#symbol', 'BSV'); await page.click('#market-form [type=submit]'); await page.waitForTimeout(1500);
    await page.click('#watchlist [data-addwatch="BSV"]'); await page.waitForTimeout(300);
    await page.reload(); await page.waitForTimeout(2000);
    const kept = await chips(page);
    check('Selbst wieder hinzugefügtes BSV bleibt nach dem Neuladen', kept.includes('BSV'), kept.join());
    check('keine Fehler', !realErrors(errors).length, realErrors(errors).join(' | ')); await ctx.close();
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
