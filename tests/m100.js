// 3.68.2: Rückmeldungen zu 3.68.1 – Kerzenart-Knopf „Normal | HA“, Backtest-Auswertung im Vollbild scrollbar, sauberes
// Minimieren danach (Seite bleibt bedienbar), Einfügen-Knopf für Bot-Token (und Chat-ID) in den Telegram-Einstellungen.
const h = require('./harness');
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + String(detail).slice(0, 300) : ''}`); };
const TOKEN = '7012345678:AAHf3kQx_9zY-abcdefghijklmnopqrstuvw';
(async () => {
  await h.setup(); await h.ctl('/reset'); const browser = await h.launch({ workspace: 'fresh' });
  try {
    // ---- Kerzenart-Knopf an 320/390/1440 px ----
    for (const [width, height] of [[320, 640], [360, 740], [390, 844], [1440, 900]]) {
      const ctx = await browser.newContext({ viewport: { width, height }, isMobile: width < 800, hasTouch: width < 800 }), page = await ctx.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => window.__g05?.state.candles.length > 100 && window.__ha);
      await page.locator('#chart').scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
      const read = () => page.evaluate(() => { const b = document.getElementById('ha-btn'), seg = [...b.querySelectorAll('.ha-seg')], shown = n => getComputedStyle(n).display !== 'none', vis = n => !shown(n) ? '' : [...n.childNodes].map(c => c.nodeType === 3 ? c.textContent : shown(c) ? c.textContent : '').join(''), e = document.getElementById('ohlc'), cs = getComputedStyle(e);
        return { pressed: b.getAttribute('aria-pressed'), label: b.getAttribute('aria-label'), texts: seg.map(vis), bg: seg.map(x => getComputedStyle(x).backgroundColor), btnBg: getComputedStyle(b).backgroundColor, lines: Math.round((e.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / parseFloat(cs.lineHeight)), right: b.getBoundingClientRect().right, ha: __ha.state.on }; });
      const off = await read(), narrow = width < 360;
      check(`${width}px: aus = ${narrow ? 'nur „Normal“ (aktive Kerzenart)' : `„Normal“ hervorgehoben, zweites Feld „${width <= 430 ? 'HA' : 'Heikin-Ashi'}“`}`, off.pressed === 'false' && !off.ha && off.texts[0] === 'Normal' && (narrow ? off.texts[1] === '' : off.texts[1] === (width <= 430 ? 'HA' : 'Heikin-Ashi') && off.bg[0] !== off.bg[1]) && /normale Kerzen – tippen: Heikin-Ashi/.test(off.label), JSON.stringify(off));
      if (width < 800) await page.tap('#ha-btn'); else await page.click('#ha-btn'); await page.waitForTimeout(150);
      const on = await read();
      check(`${width}px: an = „HA“ grün${narrow ? ' (nur „HA“ sichtbar)' : ' hervorgehoben, „Normal“ nicht mehr'}, sichtbar andere Kerzenart, Zustand gespeichert`, on.pressed === 'true' && on.ha && (narrow ? on.texts[0] === '' && on.texts[1] === 'HA' && on.btnBg !== off.btnBg : on.bg[1] !== off.bg[1] && on.bg[0] !== off.bg[0]) && (!narrow || on.texts.join('|') !== off.texts.join('|')) && /Heikin-Ashi – tippen: normale Kerzen/.test(on.label) && await page.evaluate(() => JSON.parse(localStorage.getItem('scalpdesk.heikin.v1')).on === true), JSON.stringify({ texts: on.texts, bg: on.bg, btnBg: on.btnBg }));
      check(`${width}px: OHLC zweizeilig, Knopf im Bild, kein Seitenüberlauf, keine Fehler`, (width < 800 ? on.lines === 2 : on.lines <= 2) && off.lines === on.lines && on.right <= width && errors.length === 0 && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), JSON.stringify({ lines: [off.lines, on.lines], right: on.right, errors }));
      await ctx.close();
    }
    // ---- Vollbild: Backtest-Auswertung scrollbar, danach Minimieren ----
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), page = await ctx.newPage(), errors = [];
      await ctx.addInitScript(() => { try { localStorage.setItem('scalpdesk.fsrotate.v1', '"native"'); } catch {} }); // wie am iPhone des Nutzers: hochkant ohne App-Drehung
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => window.__g05?.state.candles.length > 100 && window.__zs);
      await page.evaluate(() => __intervals.setMarket(__g05.state.symbol, '2h')); await page.waitForFunction(() => __g05.state.interval === '2h' && !__g05.state.busy && __g05.state.candles.length > 300);
      await page.locator('#chart').scrollIntoViewIfNeeded(); await page.waitForTimeout(300); const y0 = await page.evaluate(() => scrollY);
      await page.tap('#chart-full'); await page.waitForTimeout(400);
      const fs = await page.evaluate(() => { const z = document.getElementById('zone-lab').getBoundingClientRect(), c = document.getElementById('chart').getBoundingClientRect(), bar = document.querySelector('.full-bar').getBoundingClientRect(); return { full: document.documentElement.dataset.chartfull, above: z.bottom <= c.top + 1 && z.top >= bar.bottom - 1, chartToBottom: innerHeight - c.bottom < 40 }; });
      check('Vollbild: Klappfläche wie bisher oben unter der Kopfzeile, Chart reicht bis unten', fs.full === '1' && fs.above && fs.chartToBottom, JSON.stringify(fs));
      await page.tap('#zone-lab > summary'); await page.waitForTimeout(250);
      await page.tap('#zs-leverage'); await page.fill('#zs-leverage', '5');
      await page.evaluate(() => { window.__lag = 0; let t = performance.now(); window.__lagTimer = setInterval(() => { const n = performance.now(); __lag = Math.max(__lag, n - t - 20); t = n; }, 20); });
      await page.tap('#zs-bt-run'); await page.waitForFunction(() => !__zs.state.busy && window.__zoneBacktest, null, { timeout: 120000 });
      const lag = await page.evaluate(() => { clearInterval(__lagTimer); return Math.round(__lag); });
      check('Backtest gibt regelmäßig ab: Bedienung bleibt flüssig (größte Verzögerung < 250 ms)', lag < 250, `${lag} ms`);
      const open = await page.evaluate(() => { const z = document.getElementById('zone-lab'), c = document.getElementById('chart').getBoundingClientRect(), sec = document.getElementById('chart-sec'); return { scrollable: z.scrollHeight > z.clientHeight + 20 && getComputedStyle(z).overflowY === 'auto', chartH: Math.round(c.height), labBottom: Math.round(z.getBoundingClientRect().bottom), secClipped: sec.scrollHeight > sec.clientHeight + 1, rows: document.querySelectorAll('#zs-bt-table tbody tr').length }; });
      check('Geöffnet: Fläche scrollt in sich, Chart behält ≥ 160 px, nichts außerhalb des Vollbilds abgeschnitten', open.scrollable && open.chartH >= 160 && open.labBottom <= 845 && !open.secClipped && open.rows === 4, JSON.stringify(open));
      // Scrollen in der Fläche bis ans Ende (Mausrad über der Fläche; synthetische Touch-Gesten scrollen im Testbrowser gar nicht): Tabelle und Hinweis werden sichtbar, der Kopf bleibt stehen
      const box = await page.evaluate(() => { const r = document.getElementById('zone-lab').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height * .6 }; }), docBefore = await page.evaluate(() => scrollY);
      await page.mouse.move(box.x, box.y); for (let k = 0; k < 6; k++) { await page.mouse.wheel(0, 400); await page.waitForTimeout(60); }
      await page.waitForTimeout(300);
      const scrolled = await page.evaluate(() => { const z = document.getElementById('zone-lab'), zr = z.getBoundingClientRect(), t = document.getElementById('zs-bt-table').getBoundingClientRect(), n = document.querySelector('.zone-lab-note').getBoundingClientRect(), s = z.querySelector('summary').getBoundingClientRect(); return { top: z.scrollTop, tableIn: t.top >= zr.top && t.bottom <= zr.bottom + 1, noteIn: n.bottom <= zr.bottom + 1, summary: Math.round(s.top - zr.top), docY: scrollY }; });
      check('Scrollen zeigt Tabelle und Hinweis, Kopf „Starke Zonen …“ bleibt oben stehen, Seite dahinter bewegt sich nicht', scrolled.top > 0 && scrolled.noteIn && Math.abs(scrolled.summary) <= 1 && Math.abs(scrolled.docY - docBefore) <= 1, JSON.stringify(scrolled));
      await page.tap('#zone-lab > summary'); await page.waitForTimeout(200);
      check('Schließen setzt die Fläche zurück', await page.evaluate(() => { const z = document.getElementById('zone-lab'); return !z.open && z.scrollTop === 0; }));
      await page.evaluate(() => { window.__long = []; new PerformanceObserver(l => { for (const e of l.getEntries()) __long.push(Math.round(e.duration)); }).observe({ type: 'longtask' }); });
      await page.tap('#fb-exit'); await page.waitForTimeout(800);
      const after = await page.evaluate(y0 => ({ full: document.documentElement.dataset.chartfull, y: Math.round(scrollY), y0, active: document.activeElement?.id || document.activeElement?.tagName, secTop: document.getElementById('chart-sec').scrollTop, hold: !!document.querySelector('.chart-hold'), long: __long.filter(d => d > 200) }), y0);
      check('Minimieren: Seite an alter Stelle, kein Platzhalter, kein Eingabefeld mehr aktiv, keine langen Blockaden', !after.full && Math.abs(after.y - after.y0) <= 2 && !after.hold && after.active !== 'zs-leverage' && after.secTop === 0 && after.long.length === 0, JSON.stringify(after));
      await page.mouse.wheel(0, 500); await page.waitForTimeout(400); const y1 = await page.evaluate(() => scrollY);
      const tapOk = await page.evaluate(() => new Promise(r => { const t0 = performance.now(); setTimeout(() => r(performance.now() - t0 < 200), 0); }));
      check('Danach bleibt die Seite bedienbar: scrollt, reagiert sofort, keine JavaScript-Fehler', y1 > after.y + 100 && tapOk && errors.length === 0, JSON.stringify({ y1, errors }));
      await ctx.close();
    }
    // ---- Telegram: Einfügen für Bot-Token und Chat-ID ----
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ['clipboard-read', 'clipboard-write'] }), page = await ctx.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => window.__g05 && window.__tgToken);
      const unit = await page.evaluate(t => ({ plain: __tgToken(t), botfather: __tgToken(`Done! Congratulations on your new bot.\nUse this token to access the HTTP API:\n${t}\nKeep your token secure`), spaced: __tgToken(`  ${t}\n`), none: __tgToken('123456789'), short: __tgToken('123456:abc'), url: __tgToken(`https://api.telegram.org/bot${t}/getMe`) }), TOKEN);
      check('Token erkannt: pur, aus der BotFather-Nachricht, mit Leerzeichen, aus einer API-Adresse; Zahl/zu kurz nicht', unit.plain === TOKEN && unit.botfather === TOKEN && unit.spaced === TOKEN && unit.url === TOKEN && unit.none === null && unit.short === null, JSON.stringify(unit));
      await page.evaluate(() => document.getElementById('chan-open').click()); await page.waitForFunction(() => document.getElementById('chan-dialog').open);
      const buttons = await page.evaluate(() => ['tg-token', 'tg-btoken', 'tg-ttoken', 'tg-ptoken'].map(id => { const b = document.querySelector(`.tg-paste[data-token="${id}"]`); return !!b && b.closest('.input-wrap')?.contains(document.getElementById(id)) && b.textContent === 'Einfügen'; }));
      check('Knopf „Einfügen“ an allen vier Token-Feldern (Kursalarm, Sicherung, Trades, Chartmuster)', buttons.every(Boolean), JSON.stringify(buttons));
      await page.evaluate(t => navigator.clipboard.writeText(`Use this token to access the HTTP API:\n${t}`), TOKEN);
      await page.locator('.tg-paste[data-token="tg-btoken"]').scrollIntoViewIfNeeded(); await page.tap('.tg-paste[data-token="tg-btoken"]');
      await page.waitForFunction(() => document.getElementById('tg-btoken').value);
      const got = await page.evaluate(() => { const i = document.getElementById('tg-btoken'), n = i.closest('label').nextElementSibling; return { value: i.value, type: i.type, note: n?.classList.contains('tg-paste-note') ? n.textContent : '' }; });
      check('Sicherungs-Token eingefügt, Feld bleibt verdeckt, Hinweis nennt nur die Bot-ID', got.value === TOKEN && got.type === 'password' && /Bot-ID 7012345678/.test(got.note) && !got.note.includes(TOKEN.split(':')[1]), JSON.stringify({ type: got.type, note: got.note }));
      await page.evaluate(() => navigator.clipboard.writeText('Hallo')); await page.tap('.tg-paste[data-token="tg-token"]'); await page.waitForTimeout(200);
      const bad = await page.evaluate(() => ({ value: document.getElementById('tg-token').value, note: document.getElementById('tg-token').closest('label').nextElementSibling?.textContent || '' }));
      check('Kein Token in der Zwischenablage: Feld unverändert, verständlicher Hinweis', bad.value === '' && /kein Bot-Token/.test(bad.note), JSON.stringify(bad));
      await page.evaluate(() => navigator.clipboard.writeText('https://t.me/c/1234567890/12/345')); await page.locator('.tg-paste[data-paste="tg-bchat"]').scrollIntoViewIfNeeded(); await page.tap('.tg-paste[data-paste="tg-bchat"]'); await page.waitForTimeout(200);
      check('Chat-ID-Einfügen weiterhin: Link mit Thema → -1001234567890 und Thema 12', await page.evaluate(() => document.getElementById('tg-bchat').value === '-1001234567890' && document.getElementById('tg-bthread').value === '12'));
      const layout = await page.evaluate(() => { const d = document.getElementById('chan-dialog'); return [...d.querySelectorAll('.tg-paste')].every(b => { const r = b.getBoundingClientRect(), w = b.closest('.input-wrap').getBoundingClientRect(); return r.right <= w.right + 1 && r.height >= 32; }) && d.scrollWidth <= d.clientWidth + 1; });
      check('Knöpfe innerhalb der Felder, Dialog ohne seitliches Scrollen, keine Fehler', layout && errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
  } finally { await browser.close(); await h.teardown(); }
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
