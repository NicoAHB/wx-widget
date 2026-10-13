// 3.68.2/3.68.3: Rückmeldungen – Heikin-Ashi als Ein/Aus-Schalter, Vollbild ohne Klappfläche, Werkzeugleiste im Vollbild sauber
// (kein Einfrieren/Schließen beim Ein-/Ausblenden), Minimieren, Einfügen-Knopf für Bot-Token und Chat-ID.
const h = require('./harness');
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + String(detail).slice(0, 300) : ''}`); };
const TOKEN = '7012345678:AAHf3kQx_9zY-abcdefghijklmnopqrstuvw';
(async () => {
  await h.setup(); await h.ctl('/reset'); const browser = await h.launch({ workspace: 'fresh' });
  try {
    // ---- 3.68.3: Heikin-Ashi als Ein/Aus-Schalter an 320/360/390/1440 px ----
    for (const [width, height] of [[320, 640], [360, 740], [390, 844], [1440, 900]]) {
      const ctx = await browser.newContext({ viewport: { width, height }, isMobile: width < 800, hasTouch: width < 800 }), page = await ctx.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => window.__g05?.state.candles.length > 100 && window.__ha);
      await page.locator('#chart').scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
      const read = () => page.evaluate(() => { const b = document.getElementById('ha-btn'), sw = b.querySelector('.ha-switch'), knob = getComputedStyle(sw, '::after'), e = document.getElementById('ohlc'), cs = getComputedStyle(e);
        return { role: b.getAttribute('role'), checked: b.getAttribute('aria-checked'), name: b.getAttribute('aria-label'), title: b.title, text: [...b.children].filter(c => getComputedStyle(c).display !== 'none').map(c => c.textContent).join(''), track: getComputedStyle(sw).backgroundColor, knob: knob.transform, swW: Math.round(sw.getBoundingClientRect().width),
          lines: Math.round((e.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / parseFloat(cs.lineHeight)), right: b.getBoundingClientRect().right, ha: __ha.state.on }; });
      const off = await read(), name = width <= 430 ? 'HA' : 'Heikin-Ashi';
      check(`${width}px: Schalter „${name}“ (role=switch) aus: Knopf links, grau, normale Kerzen`, off.role === 'switch' && off.checked === 'false' && !off.ha && off.text === name && off.name === 'Heikin-Ashi-Kerzen' && off.swW >= 24 && (off.knob === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(off.knob)) && /aus \(normale Kerzen\)/.test(off.title), JSON.stringify(off));
      if (width < 800) await page.tap('#ha-btn'); else await page.click('#ha-btn'); await page.waitForTimeout(250);
      const on = await read();
      check(`${width}px: an: Knopf nach rechts, Schiene grün, gleicher Name, Zustand gespeichert`, on.checked === 'true' && on.ha && on.text === name && on.track !== off.track && /matrix\(1, 0, 0, 1, 1[02], 0\)/.test(on.knob) && /Heikin-Ashi an/.test(on.title) && await page.evaluate(() => JSON.parse(localStorage.getItem('scalpdesk.heikin.v1')).on === true), JSON.stringify({ track: [off.track, on.track], knob: on.knob }));
      check(`${width}px: OHLC zweizeilig, Schalter im Bild, kein Seitenüberlauf, keine Fehler`, (width < 800 ? on.lines === 2 : on.lines <= 2) && off.lines === on.lines && on.right <= width && errors.length === 0 && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), JSON.stringify({ lines: [off.lines, on.lines], right: on.right, errors }));
      await ctx.close();
    }
    // ---- Backtest in der normalen Ansicht, dann Vollbild am Handy hochkant (ohne App-Drehung, wie am iPhone des Nutzers) ----
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), page = await ctx.newPage(), errors = [];
      await ctx.addInitScript(() => { try { localStorage.setItem('scalpdesk.fsrotate.v1', '"native"'); localStorage.setItem('scalpdesk.kizones.v1', '{"mode":"strong"}'); localStorage.setItem('scalpdesk.zonesig.v1', '{"on":true,"leverage":5}'); } catch {} });
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => window.__g05?.state.candles.length > 100 && window.__zs);
      await page.evaluate(() => __intervals.setMarket(__g05.state.symbol, '2h')); await page.waitForFunction(() => __g05.state.interval === '2h' && !__g05.state.busy && __g05.state.candles.length > 300);
      await page.evaluate(() => { const d = document.getElementById('zone-lab'); d.open = true; d.scrollIntoView({ block: 'center' }); }); await page.waitForTimeout(200);
      await page.evaluate(() => { window.__lag = 0; let t = performance.now(); window.__lagTimer = setInterval(() => { const n = performance.now(); __lag = Math.max(__lag, n - t - 20); t = n; }, 20); });
      await page.tap('#zs-bt-run'); await page.waitForFunction(() => !__zs.state.busy && window.__zoneBacktest, null, { timeout: 120000 });
      const lag = await page.evaluate(() => { clearInterval(__lagTimer); return Math.round(__lag); });
      check('Backtest gibt regelmäßig ab: Bedienung bleibt flüssig (größte Verzögerung < 250 ms)', lag < 250, `${lag} ms`);
      await page.locator('#chart').scrollIntoViewIfNeeded(); await page.waitForTimeout(300); const y0 = await page.evaluate(() => scrollY);
      await page.tap('#chart-full'); await page.waitForTimeout(500);
      const fs = await page.evaluate(() => { const c = document.getElementById('chart').getBoundingClientRect(), bar = document.querySelector('.full-bar').getBoundingClientRect(), ha = document.getElementById('ha-btn').getBoundingClientRect(); return { full: document.documentElement.dataset.chartfull, lab: getComputedStyle(document.getElementById('zone-lab')).display, chartTop: Math.round(c.top - Math.max(bar.bottom, ha.bottom)), chartToBottom: Math.round(innerHeight - c.bottom) }; });
      check('Vollbild: keine Klappfläche „Starke Zonen …“, der Chart beginnt direkt unter Kopfzeile/HA-Schalter und reicht bis unten', fs.full === '1' && fs.lab === 'none' && fs.chartTop < 40 && fs.chartToBottom < 40, JSON.stringify(fs));
      // „▾ BTC · 2h“ antippen: Werkzeuge öffnen sich, Leiste sauber (Zeiträume sichtbar, Zoom/KI/Zonen/Signale in eigener wischbarer Zeile, keine Überlagerung)
      await page.evaluate(() => { window.__long = []; new PerformanceObserver(l => { for (const e of l.getEntries()) __long.push(Math.round(e.duration)); }).observe({ type: 'longtask' }); });
      await page.tap('#fb-tools'); await page.waitForTimeout(600);
      const tb = await page.evaluate(() => { const r = e => e.getBoundingClientRect(), tb = document.querySelector('.chart-toolbar'), main = tb.querySelector('.tb-main'), iv = tb.querySelector('.intervals'), zc = tb.querySelector('.zoom-controls'), res = [...main.querySelectorAll('select, label')].filter(x => x.offsetParent);
        const vis = [...zc.children].filter(k => k.offsetParent && r(k).width > 0), overlap = (a, b) => !(a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1);
        return { bar: document.documentElement.dataset.chartbar, full: document.documentElement.dataset.chartfull, ivW: Math.round(r(iv).width), mainZc: overlap(r(main), r(zc)), zcIn: r(zc).left >= r(tb).left - 1 && r(zc).right <= r(tb).right + 1, scroll: zc.scrollWidth >= zc.clientWidth, minBtn: Math.min(...vis.filter(k => k.tagName === 'BUTTON').map(k => Math.round(r(k).width))), fullBtn: getComputedStyle(document.getElementById('chart-full')).display, sel: res.map(x => Math.round(r(x).width)), toggles: document.querySelectorAll('.overlay-toggles button').length, ovRows: new Set([...document.querySelectorAll('.overlay-toggles button')].filter(b => b.offsetParent).map(b => b.offsetTop)).size, summary: getComputedStyle(document.querySelector('.chart-pattern-summary') || document.body).display, card: !!document.querySelector('.chart-pattern-overview-card')?.offsetParent, secScroll: getComputedStyle(document.getElementById('chart-sec')).overflowY, chartH: Math.round(r(document.getElementById('chart')).height), sw: document.documentElement.scrollWidth <= innerWidth + 1 }; });
      check('Werkzeuge offen: Zeiträume sichtbar, Zoom-Zeile ohne Überlagerung im Rahmen, alle Knöpfe ≥ 33 px, Minimieren-Knopf der Leiste ausgeblendet, Chart ≥ 220 px', tb.bar === 'open' && tb.full === '1' && tb.ivW >= 100 && !tb.mainZc && tb.zcIn && tb.minBtn >= 33 && tb.fullBtn === 'none' && tb.sel.every(w => w >= 60) && tb.toggles > 3 && tb.chartH >= 220 && tb.sw, JSON.stringify(tb));
      check('Ebenen-Schalter umbrechend in mehreren Reihen sichtbar (statt einer Wischzeile); Gesamtbild/Positionierung im Vollbild ausgeblendet (3.69.0); Vollbild-Bereich scrollbar', tb.ovRows >= 3 && tb.summary === 'none' && !tb.card && tb.secScroll === 'auto', JSON.stringify({ ovRows: tb.ovRows, summary: tb.summary, card: tb.card, secScroll: tb.secScroll }));
      // 3.69.0: Leiste bleibt stabil, wenn sich Beschriftungen ändern (Zonen → Starke Zonen → Zonen ausblenden)
      const layoutOf = () => page.evaluate(() => { const tb = document.querySelector('.chart-toolbar'), r = e => e.getBoundingClientRect(), main = tb.querySelector('.tb-main'), zc = tb.querySelector('.zoom-controls'), iv = tb.querySelector('.intervals [data-interval="1h"]'), sel = document.getElementById('chart-detail-resolution');
        return { rows: Math.abs(r(main).top - r(zc).top) > 10 ? 2 : 1, h: Math.round(r(tb).height), iv: [Math.round(r(iv).left), Math.round(r(iv).top)], zc: Math.round(r(zc).top), selTop: Math.round(r(sel).top - r(main).top), ki: Math.round(r(document.getElementById('pat-btn')).left) }; });
      const lay0 = await layoutOf(); const lays = [];
      for (let n = 0; n < 3; n++) { await page.evaluate(() => document.getElementById('zones-btn').click()); await page.waitForTimeout(150); lays.push(await layoutOf()); }
      check('Leiste stabil: Zonen-Beschriftung wechselt, Zeilen, Höhe, Zeiträume, KI-Knopf und Kerzen-Auflösung bleiben an ihrem Platz', lays.every(l => l.rows === 2 && l.h === lay0.h && l.iv.join() === lay0.iv.join() && l.zc === lay0.zc && l.ki === lay0.ki && l.selTop === lay0.selTop) && lay0.rows === 2, JSON.stringify({ lay0, lays }));
      await page.evaluate(() => document.getElementById('toasts').replaceChildren()); await page.locator('#zsig-btn').scrollIntoViewIfNeeded(); await page.tap('#zsig-btn');
      await page.waitForFunction(() => /Signale an/.test(document.getElementById('toasts').textContent), null, { timeout: 60000 });
      check('3.69.0: „Signale“ im Vollbild antippen → Knopf grün und Hinweis (auch wenn kein Signal entsteht), Vollbild bleibt', await page.evaluate(() => document.getElementById('zsig-btn').getAttribute('aria-pressed') === 'true' && document.documentElement.dataset.chartfull === '1'), await page.evaluate(() => document.getElementById('toasts').textContent.slice(0, 200)));
      await page.tap('#zsig-btn'); await page.waitForTimeout(150);
      // Ebenen ein-/ausblenden, Zeitraum wechseln: alles bleibt im Vollbild
      const tog = page.locator('.overlay-toggles button').nth(1), before = await tog.getAttribute('aria-pressed'); await tog.tap(); await page.waitForTimeout(300);
      const after1 = await page.evaluate(() => ({ full: document.documentElement.dataset.chartfull, bar: document.documentElement.dataset.chartbar }));
      await page.locator('.chart-toolbar .intervals [data-interval="1h"]').tap(); await page.waitForFunction(() => __g05.state.interval === '1h' && !__g05.state.busy); await page.waitForTimeout(300);
      await page.locator('.chart-toolbar .zoom-controls #zoom-in').tap(); await page.waitForTimeout(200);
      const after2 = await page.evaluate(() => ({ full: document.documentElement.dataset.chartfull, bar: document.documentElement.dataset.chartbar, iv: __g05.state.interval, long: __long.filter(d => d > 250) }));
      check('Ebene umschalten, Zeitraum 1h und Zoom: Vollbild bleibt offen, keine langen Blockaden', (await tog.getAttribute('aria-pressed')) !== before && after1.full === '1' && after2.full === '1' && after2.bar === 'open' && after2.iv === '1h' && after2.long.length === 0, JSON.stringify({ before, after1, after2 }));
      await page.tap('#fb-tools'); await page.waitForTimeout(500);
      check('Werkzeuge wieder zu: Chart wieder groß', await page.evaluate(() => !document.documentElement.dataset.chartbar && document.getElementById('chart').getBoundingClientRect().height > 500));
      await page.evaluate(() => { __long.length = 0; });
      await page.tap('#fb-exit'); await page.waitForTimeout(800);
      const after = await page.evaluate(y0 => ({ full: document.documentElement.dataset.chartfull, y: Math.round(scrollY), y0, secTop: document.getElementById('chart-sec').scrollTop, hold: !!document.querySelector('.chart-hold'), long: __long.filter(d => d > 200), lab: getComputedStyle(document.getElementById('zone-lab')).display }), y0);
      check('Minimieren: Seite an alter Stelle, kein Platzhalter, Klappfläche wieder da, keine langen Blockaden', !after.full && Math.abs(after.y - after.y0) <= 2 && !after.hold && after.secTop === 0 && after.long.length === 0 && after.lab !== 'none', JSON.stringify(after));
      await page.mouse.wheel(0, 500); await page.waitForTimeout(400); const y1 = await page.evaluate(() => scrollY);
      check('Danach bleibt die Seite bedienbar und scrollt, keine JavaScript-Fehler', y1 > after.y + 100 && errors.length === 0, JSON.stringify({ y1, errors }));
      await ctx.close();
    }
    // ---- Gedrehtes Vollbild (App dreht, Standard am Handy hochkant): Werkzeugleiste weiter einzeilig ----
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), page = await ctx.newPage();
      await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => window.__g05?.state.candles.length > 100);
      await page.locator('#chart').scrollIntoViewIfNeeded(); await page.tap('#chart-full'); await page.waitForTimeout(500);
      await page.evaluate(() => document.getElementById('fb-tools').click()); await page.waitForTimeout(600);
      const rot = await page.evaluate(() => { const tb = document.querySelector('.chart-toolbar'), main = tb.querySelector('.tb-main'), zc = tb.querySelector('.zoom-controls'); return { native: !!document.documentElement.dataset.fsnative, oneRow: Math.abs(main.offsetTop - zc.offsetTop) < 12, h: tb.offsetHeight }; });
      check('Gedreht: wie hochkant zweizeilig (Zeiträume oben, Zoom/KI/Zonen/Signale darunter), kompakt', !rot.native && !rot.oneRow && rot.h < 120, JSON.stringify(rot));
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
      const grid = await page.evaluate(() => ['tg-token', 'tg-btoken', 'tg-ttoken', 'tg-ptoken', 'tg-chat'].map(id => { const i = document.getElementById(id), w = i.closest('.input-wrap'); return getComputedStyle(w).display === 'grid' && i.getBoundingClientRect().width > 100 && w.querySelector('.tg-paste').getBoundingClientRect().width > 60; }));
      check('Knöpfe innerhalb der Felder (Raster: Feld schrumpft, „Einfügen“ bleibt sichtbar), Dialog ohne seitliches Scrollen, keine Fehler', layout && grid.every(Boolean) && errors.length === 0, JSON.stringify(grid) + errors.join(' | '));
      await ctx.close();
    }
  } finally { await browser.close(); await h.teardown(); }
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
