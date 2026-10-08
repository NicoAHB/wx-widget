// Nutzeroptimierung: Anzeigealter und DOM-Erhalt; echte Erkennung separat weiterhin in m58/unit-247e.
const h = require('./harness');
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };
(async () => {
  let browser;
  try {
    await h.setup(); browser = await h.launch(); const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => !!window.__g09 && __g05.state.candles.length > 100);
    await h.ctl('/walk?on=0'); await page.click('#pat-btn'); await page.waitForFunction(() => __g09.pat.res && !__g09.pat.busy);
    await page.evaluate(() => {
      const s = __g05.state, p = __g09.pat, rows = s.candles; p.on = false; p.minQ = 0; p.filter = 'all';
      const mk = (id, bars, q, dir, levels = null) => { const i = rows.length - 1 - bars; return { id, q, dir, levels, i0: i, i1: i, t0: rows[i].time, t1: rows[i].time, kind: levels ? 'form' : 'candle', status: bars === 0 ? 'vorläufig' : 'bestätigt', rules: [], vals: {} }; };
      p.res.hits = [mk('hammer', 0, 60, 'bull'), mk('spinning_top', 0, 95, 'neutral'), mk('marubozu_bull', 3, 90, 'bull', { tgt: 70000 }),
        mk('marubozu_bear', 4, 70, 'bear', { tgt: 50000 }), mk('hanging_man', 10, 99, 'bear'), mk('morning_star', 11, 99, 'bull'), mk('double_bottom', 53, 100, 'bull', { tgt: 71000 })];
      __g09.panel();
    });
    const initial = await page.evaluate(() => ({ badges: [...document.querySelectorAll('#pat-current-list .pat-age-badge')].map(e => e.textContent),
      ages: [...document.querySelectorAll('#pat-current-list .pat-age-line')].map(e => e.textContent), old: document.querySelectorAll('#pat-expired-list .pat-row').length,
      closed: !document.getElementById('pat-expired').open, oldLabel: document.getElementById('pat-expired-label').textContent, text: document.getElementById('pat-list').textContent }));
    check('Grenzen 0/3 frisch, 4/10 aktiv, 11/53 abgelaufen; jüngste zuerst, Güte nur bei gleichem Alter', JSON.stringify(initial.badges) === JSON.stringify(['Frisch', 'Frisch', 'Frisch', 'Aktiv', 'Aktiv']) && initial.ages[0].includes('vor 0 Kerzen') && initial.ages[2].includes('vor 3 Kerzen') && initial.ages[4].includes('vor 10 Kerzen') && initial.old === 2);
    check('Abgelaufene standardmäßig zu; Anzahl korrekt und vorläufig bleibt erhalten', initial.closed && initial.oldLabel === 'Abgelaufen (2)' && initial.text.includes('vorläufig'));
    check('Alter zusätzlich mit UTC-Uhrzeit und verstrichener Zeit', initial.ages[2].includes('UTC') && /vor \d+ Min/.test(initial.ages[2]));
    check('Header zeigt den vorhandenen Kurs ohne neue Quelle', await page.evaluate(() => /\d/.test(document.getElementById('pat-live-price').textContent) && /BTC\/USDT.*Binance/.test(document.getElementById('pat-live-price').title)));
    check('Header folgt Kursänderung und kennzeichnet Pause', await page.evaluate(() => { const s = __g05.state, old = s.candles.at(-1).close; s.candles.at(-1).close = 12345.67; s.paused = true; __g09.panel();
      const p = document.getElementById('pat-live-price'), ok = p.textContent === '12.345,67' && p.classList.contains('stale') && /pausierter Kurs/.test(p.title); s.candles.at(-1).close = old; s.paused = false; __g09.panel(); return ok; }));
    check('Monatskerzen zählen als Kerzen, trotz verschieden langer Monate', await page.evaluate(() => { const s = __g05.state, old = s.candles, bar = old.at(-1); s.candles = [Date.UTC(2026, 0, 1), Date.UTC(2026, 1, 1), Date.UTC(2026, 2, 1)].map(time => ({ ...bar, time }));
      const age = __g09.age({ t1: s.candles[0].time }, Date.UTC(2026, 2, 1)); s.candles = old; return age.bars === 2 && age.status === 'Frisch'; }));
    check('Bullishes Ziel grün, bearishes Ziel rot, im hellen und dunklen Schema', await page.evaluate(() => ['dark', 'light'].every(theme => { document.documentElement.dataset.theme = theme; const up = document.querySelector('.pat-target.bull'), down = document.querySelector('.pat-target.bear'); return getComputedStyle(up).color !== getComputedStyle(down).color; })));
    await page.click('#pat-expired-label');
    check('Abgelaufene abgegraut und ohne Richtungsbalken', await page.evaluate(() => [...document.querySelectorAll('#pat-expired-list .pat-row')].every(row => getComputedStyle(row).opacity === '0.55' && getComputedStyle(row).borderLeftWidth === '1px')));
    await page.click('[data-pfil="bear"]');
    check('Richtungsfilter wirkt auf beide Bereiche', await page.evaluate(() => document.querySelectorAll('#pat-current-list .pat-row').length === 2 && document.getElementById('pat-expired').hidden));
    await page.click('[data-pfil="all"]'); await page.selectOption('#pat-minq', '80');
    check('Mindestregelgüte wirkt auch auf Altmuster', await page.evaluate(() => document.querySelectorAll('#pat-current-list .pat-row').length === 3 && document.querySelectorAll('#pat-expired-list .pat-row').length === 2));
    await page.selectOption('#pat-minq', '0');
    const stable = await page.evaluate(() => { const first = document.querySelector('#pat-current-list .pat-row'), old = document.querySelector('#pat-expired-list .pat-row'); document.getElementById('pat-expired').open = true;
      __g09.panel(); const same = first === document.querySelector('#pat-current-list .pat-row') && old === document.querySelector('#pat-expired-list .pat-row');
      const s = __g05.state, last = s.candles.at(-1); s.candles.push({ ...last, time: last.time + 60000, closeTime: last.closeTime + 60000 }); __g09.panel();
      return { same, open: document.getElementById('pat-expired').open, age: first.querySelector('.pat-age-line').textContent, oldN: document.querySelectorAll('#pat-expired-list .pat-row').length }; });
    check('Wiederholung erhält Kartenelemente und offenen Altbereich', stable.same && stable.open);
    check('Neue Kerze aktualisiert Alter und verschiebt 10→11 in den Altbereich', stable.age.includes('vor 1 Kerze') && stable.oldN === 3);
    await page.evaluate(() => { const p = __g09.pat; p.res.hits = p.res.hits.filter(x => x.id === 'double_bottom'); __g09.panel(); });
    check('Ohne aktuelle Treffer ehrlicher Leerzustand; ältere bleiben zugänglich', await page.evaluate(() => !document.getElementById('pat-current-empty').hidden && document.getElementById('pat-current-empty').textContent === 'Keine aktuellen Muster in den letzten 10 Kerzen.' && document.querySelectorAll('#pat-expired-list .pat-row').length === 1));
    await page.evaluate(() => { __g09.info(0); });
    check('Ziel auch im Info-Sheet in Richtungsfarbe', await page.locator('#pat-info-body .pat-target.bull').count() === 1);
    await page.evaluate(() => document.getElementById('pat-info').close());
    await page.evaluate(() => { __g05.state.interval = '1h'; __g09.panel(); });
    check('Intervallwechsel verwirft Anzeige und klappt Altmuster zu', await page.evaluate(() => !document.querySelector('#pat-list .pat-row') && !document.getElementById('pat-expired').open));
    for (const width of [320, 390, 768]) { await page.setViewportSize({ width, height: 1000 }); check(`Panel bei ${width}px ohne horizontalen Überlauf`, await page.evaluate(() => { const d = document.getElementById('pat-sheet'); return d.scrollWidth <= d.clientWidth + 1; })); }
    check('Keine Appfehler', !errors.length, errors.join(' | ')); await ctx.close();
  } finally { await browser?.close(); await h.teardown(); }
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
