// 3.13.0 – Tab-Titel bei anderen Coins mit BTC-Referenzkurs, seit 3.14.1 ohne Klammern und BTC ohne Nachkommastellen:
// „NEAR - 4,7290 / BTC - 95.200“ (Arbeitsanweisung, gekürzt, damit er meist in den Tab passt);
// BTC selbst „BTC - …“ (seit 3.13.1 mit Bindestrich). Aktualisierung höchstens 3 s nach einer Kursänderung – des Coins und von BTC allein –
// bei Binance-Takt (Kerzen alle 2 s); Titel wird jede Sekunde nachgeführt; Futures-Chart (BSV) bekommt den BTC-Kurs über ein
// eigenes Spot-Abo; ohne WebSocket Kurs-Abruf alle 2 s; Pause ⏸; Schalter „Kurs im Tab-Titel“ aus = normaler Titel. Aufruf: node m20.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const title = page => page.evaluate(() => document.title);
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
const load = async (page, sym) => { await page.fill('#symbol', sym); await page.press('#symbol', 'Enter'); await page.waitForFunction(s => document.getElementById('lb-sym').textContent === s, sym, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(1500); };
// Wartet, bis der Titel genau so lautet; liefert die Dauer in ms (oder -1)
const until = async (page, want, ms) => { const t0 = Date.now(); try { await page.waitForFunction(w => document.title === w, want, { timeout: ms, polling: 50 }); return Date.now() - t0; } catch { return -1; } };
const untilRe = async (page, re, ms) => { const t0 = Date.now(); try { await page.waitForFunction(r => new RegExp(r).test(document.title), re.source, { timeout: ms, polling: 50 }); return Date.now() - t0; } catch { return -1; } };
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  await h.ctl('/period?spot=2000&fut=2000'); // wie Binance: Kerzen-Streams melden sich alle 2 s
  await h.ctl('/set?symbol=BTCUSDT&price=95200'); await h.ctl('/set?symbol=NEARUSDT&price=4.729');
  const browser = await h.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page); await page.waitForTimeout(1500);
    // normaler Seitentitel aus der ausgelieferten Seite (das <title>-Element zeigt immer den aktuellen Titel)
    const base = await page.evaluate(async () => ((await (await fetch(location.href)).text()).match(/<title>([^<]*)<\/title>/) || [])[1] || '');
    let t = await title(page);
    check('BTC im Chart: „BTC - 95.200,00“ ohne Zusatz', t === 'BTC - 95.200,00', t);
    await load(page, 'NEAR'); await until(page, 'NEAR - 4,7290 / BTC - 95.200', 5000); t = await title(page);
    check('NEAR im Chart: genau „NEAR - 4,7290 / BTC - 95.200“ (ohne Klammern, BTC ohne Nachkommastellen)', t === 'NEAR - 4,7290 / BTC - 95.200', t);
    // Nur BTC bewegt sich: der Titel folgt spätestens nach 3 s
    await h.ctl('/set?symbol=BTCUSDT&price=95350.5'); let ms = await until(page, 'NEAR - 4,7290 / BTC - 95.351', 3000);
    check('Nur BTC ändert sich: Titel nach höchstens 3 s aktuell', ms >= 0, `${ms} ms · ${await title(page)}`);
    // Nur NEAR bewegt sich
    await h.ctl('/set?symbol=NEARUSDT&price=4.8123'); ms = await until(page, 'NEAR - 4,8123 / BTC - 95.351', 3000);
    check('Nur NEAR ändert sich: Titel nach höchstens 3 s aktuell', ms >= 0, `${ms} ms · ${await title(page)}`);
    // Mehrere Änderungen hintereinander, jeweils mit Zeitmessung (Stichprobe über Takt-Grenzen hinweg)
    const lat = [];
    for (let k = 1; k <= 6; k++) {
      const b = 95350.5 + k * 11.25, n = +(4.8123 + k * 0.0011).toFixed(4); await page.waitForTimeout(137 * k % 700);
      await h.ctl(`/set?symbol=${k % 2 ? 'BTCUSDT' : 'NEARUSDT'}&price=${k % 2 ? b : n}`);
      const cur = await title(page), wantB = k % 2 ? b : 95350.5 + (k - 1) * 11.25, wantN = k % 2 ? +(4.8123 + (k - 1) * 0.0011).toFixed(4) : n;
      const want = `NEAR - ${wantN.toLocaleString('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} / BTC - ${wantB.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      lat.push(await until(page, want, 3000)); if (lat.at(-1) < 0) lat.push(cur + ' → ' + await title(page) + ' statt ' + want);
    }
    check('Sechs Kursänderungen (abwechselnd BTC/NEAR): jede nach höchstens 3 s im Titel', lat.every(v => typeof v === 'number' && v >= 0), lat.join(' · ') + ' ms');
    // Nachführen im Sekundentakt: ein überschriebener Titel ist spätestens nach gut 1 s wieder richtig
    const right = await title(page); await page.evaluate(() => { document.title = 'x'; }); ms = await until(page, right, 2500);
    check('Titel wird jede Sekunde nachgeführt (auch ohne neue Kursmeldung)', ms >= 0 && ms <= 1500, `${ms} ms`);
    // Pause: Kennzeichen ⏸ am Ende, BTC-Teil bleibt
    await page.click('#pause'); await page.waitForTimeout(1300); t = await title(page);
    check('Pausiert: „… / BTC - … ⏸“', /^NEAR - [\d.,]+ \/ BTC - [\d.]+ ⏸$/.test(t), t);
    await page.click('#pause'); await page.waitForTimeout(2500);
    // Schalter aus: normaler Titel ohne Kurse; wieder an: Format zurück
    await page.evaluate(() => document.getElementById('title-toggle').click()); await page.waitForTimeout(1300); const off = await title(page);
    await page.evaluate(() => document.getElementById('title-toggle').click()); await page.waitForTimeout(1300); const on = await title(page);
    check('Schalter „Kurs im Tab-Titel“ aus: normaler Titel; wieder an: mit BTC-Kurs', off === base && /^NEAR - [\d.,]+ \/ BTC - [\d.]+$/.test(on), JSON.stringify({ aus: off, an: on }));
    // Ohne Live-Streams (WebSocket gesperrt): Kurs-Abruf alle 2 s – der Titel bleibt höchstens 3 s alt
    await h.ctl('/blockws?on=1'); await page.waitForTimeout(2500);
    await h.ctl('/set?symbol=NEARUSDT&price=4.9001'); ms = await until(page, 'NEAR - 4,9001 / BTC - 95.407', 3000);
    await h.ctl('/set?symbol=BTCUSDT&price=95500'); const ms2 = await until(page, 'NEAR - 4,9001 / BTC - 95.500', 3000);
    check('Ohne WebSocket: Titel folgt per Kurs-Abruf nach höchstens 3 s (Coin und BTC)', ms >= 0 && ms2 >= 0, `${ms} ms · ${ms2} ms · ${await title(page)}`);
    await h.ctl('/blockws?on=0'); await live(page); await page.waitForTimeout(2000);
    // Chart aus den Futures (BSV gibt es nur als Futures): BTC-Kurs trotzdem da – über ein eigenes Spot-Abo
    await load(page, 'BSV'); await untilRe(page, /^BSV - [\d.,]+ \/ BTC - 95\.500$/, 6000);
    t = await title(page); const st = await h.ctl('/state'), spot = st.conns.filter(c => !/fstream/.test(c.host)).flatMap(c => c.streams);
    check('Futures-Chart (BSV): Titel mit BTC-Kurs, BTC-Spot-Stream abonniert', /^BSV - [\d.,]+ \/ BTC - 95\.500$/.test(t) && spot.includes('btcusdt@kline_1m'), `${t} · Spot-Streams: ${spot.join(', ') || '—'}`);
    // Zurück zu BTC: wieder das alte Format ohne Referenz
    await load(page, 'BTC'); await page.waitForTimeout(1200); t = await title(page);
    check('Zurück zu BTC: „BTC - 95.500,00“ ohne Zusatz', t === 'BTC - 95.500,00', t);
    // BSV gibt es nicht als Spot: die Spot-Anfrage endet erwartungsgemäß mit 400, danach kommen die Futures-Kerzen
    const real = errors.filter(e => !/status of 400|WebSocket/.test(e)); // gesperrter WebSocket meldet sich in der Konsole
    check('keine Fehler', !real.length, real.join(' | ')); await ctx.close();
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await browser.close(); await h.ctl('/walk?on=1').catch(() => {}); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
