// Schritt 2.1 – ZigZag-Pivots als Chart-Ebene: Schalter, Mindestbewegung, Speicherung, jedes Intervall/Symbol, Vollbild.
// Aufruf: node m11.js
const h = require('./harness'), fs = require('fs'), path = require('path');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const zz = page => page.evaluate(() => { const l = document.querySelector('#chart svg .zz-line');
  return { pressed: document.querySelector('[data-overlay="zz"]').getAttribute('aria-pressed'), pct: document.getElementById('zz-pct').value, line: l ? l.getAttribute('points').trim().split(/\s+/).length : 0,
    open: document.querySelectorAll('#chart svg .zz-open').length, dots: document.querySelectorAll('#chart svg .zz-dot').length, stroke: l ? getComputedStyle(l).stroke : '' }; });
const settle = page => page.waitForTimeout(900);
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset');
  const browser = await h.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html');
    await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {}); await settle(page);
    let s = await zz(page);
    check('Schalter „ZigZag“ bei den Chart-Ebenen, standardmäßig an, Mindestbewegung 3 %', s.pressed === 'true' && s.pct === '3', JSON.stringify(s));
    await page.selectOption('#zz-pct', '0.25'); await settle(page); s = await zz(page);
    check('0,25 %: ZigZag-Linie mit Umkehrpunkten im Chart (eigene Farbe)', s.line >= 3 && s.dots >= 3 && /rgb/.test(s.stroke), JSON.stringify(s));
    await page.selectOption('#zz-pct', '1'); await settle(page); const s1 = await zz(page);
    check('Größere Mindestbewegung: weniger Umkehrpunkte', s1.dots < s.dots, `${s.dots} → ${s1.dots}`);
    await page.selectOption('#zz-pct', '0.25'); await settle(page);
    await page.click('[data-overlay="zz"]'); await settle(page); const off = await zz(page);
    check('Ausblenden: keine ZigZag-Linie mehr', off.pressed === 'false' && !off.line && !off.dots && !off.open, JSON.stringify(off));
    await page.click('[data-overlay="zz"]'); await settle(page); const on = await zz(page);
    check('Wieder einblenden', on.pressed === 'true' && on.line >= 3, JSON.stringify(on));
    await page.reload(); await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {}); await settle(page);
    const re = await zz(page);
    check('Nach dem Neuladen: Einstellung und Schalter bleiben', re.pct === '0.25' && re.pressed === 'true' && re.line >= 3, JSON.stringify(re));
    // jedes Chart: anderes Intervall, anderes Symbol
    await page.click('.intervals [data-interval="1h"]'); await page.waitForFunction(() => document.querySelector('.intervals [data-interval="1h"]').getAttribute('aria-pressed') === 'true', null, { timeout: 10000 }).catch(() => {}); await page.waitForTimeout(2000);
    const iv = await zz(page); check('1h-Chart: ZigZag wird angezeigt', iv.line >= 2 || iv.open >= 1, JSON.stringify(iv));
    await page.fill('#symbol', 'ETH'); await page.press('#symbol', 'Enter'); await page.waitForFunction(() => document.getElementById('lb-sym').textContent === 'ETH', null, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(2000);
    const eth = await zz(page); check('ETH-Chart: ZigZag wird angezeigt', eth.line >= 2 || eth.open >= 1, JSON.stringify(eth));
    await page.click('.intervals [data-interval="1m"]'); await page.waitForTimeout(2000);
    // Vollbild: Schalter in der Werkzeugzeile, ein- und ausblenden
    await page.click('#chart-full'); await page.waitForTimeout(700); await page.click('#fb-tools'); await page.waitForTimeout(600);
    const fsBtn = await page.evaluate(() => { const b = document.querySelector('[data-overlay="zz"]'), r = b.getBoundingClientRect(); return { vis: getComputedStyle(b).visibility, w: Math.round(r.width) }; });
    const f1 = await zz(page); await page.click('[data-overlay="zz"]'); await settle(page); const f2 = await zz(page); await page.click('[data-overlay="zz"]'); await settle(page); const f3 = await zz(page);
    check('Vollbild: ZigZag sichtbar, Schalter in der Werkzeugzeile blendet aus und ein', fsBtn.vis === 'visible' && fsBtn.w > 40 && f1.line >= 2 && !f2.line && f3.line >= 2, JSON.stringify({ fsBtn, an: f1.line, aus: f2.line, wieder: f3.line }));
    await page.click('#fb-exit'); await page.waitForTimeout(500);
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
    // Handy: Schalter und Auswahl passen ohne seitliches Scrollen
    const pc = await browser.newContext({ viewport: { width: 320, height: 700 }, hasTouch: true, isMobile: true }), pp = await pc.newPage(), pe = []; h.collect(pp, pe);
    await pp.goto(h.URL_BASE + '/weather-widget-v2.html'); await pp.waitForTimeout(3000);
    const m = await pp.evaluate(() => { const b = document.querySelector('[data-overlay="zz"]').getBoundingClientRect(), sel = document.getElementById('zz-pct').getBoundingClientRect(); return { btn: Math.round(b.right), sel: Math.round(sel.right), vw: innerWidth, sw: document.scrollingElement.scrollWidth }; });
    check('Handy 320 px: Schalter und Auswahl im Bild, kein seitliches Scrollen', m.btn <= m.vw && m.sel <= m.vw && m.sw <= m.vw, JSON.stringify(m));
    check('Handy: keine Fehler', !pe.length, pe.join(' | ')); await pc.close();
    // ZigZag-Prognose
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
      await page.goto(h.URL_BASE + '/weather-widget-v2.html');
      await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {}); await settle(page);
      await page.selectOption('#zz-pct', '0.25'); await settle(page);
      const F = () => page.evaluate(() => { const l = document.querySelector('#chart .zz-fc-line'), d = document.querySelector('#chart .zz-fc-dot'), o = document.querySelector('#chart .zz-dot.open'), t = document.querySelector('#chart .zz-fc-label'), n = document.querySelector('#chart .zz-fc-note');
        return { pressed: document.getElementById('zz-fc').getAttribute('aria-pressed'), disabled: document.getElementById('zz-fc').disabled, line: !!l, x1: l ? +l.getAttribute('x1') : 0, x2: l ? +l.getAttribute('x2') : 0, dot: d ? +d.getAttribute('cx') : 0, open: o ? +o.getAttribute('cx') : 0, label: t ? t.textContent : '', note: n ? n.textContent : '', tip: document.querySelector('#chart .zz-fc title')?.textContent || '', badge: document.querySelector('#chart .zz-fc-p')?.textContent || '', badgeCls: document.querySelector('#chart .zz-fc-p')?.getAttribute('class') || '', contra: !!document.querySelector('#chart .zz-fc.contra'), up: l ? +l.getAttribute('y2') < +l.getAttribute('y1') : null }; });
      let a = await F();
      check('Prognose standardmäßig aus', a.pressed === 'false' && !a.line, JSON.stringify(a));
      await page.click('#zz-fc'); await settle(page); a = await F();
      check('Prognose an: gestrichelte Projektion ab dem offenen Extrempunkt nach rechts in die Zukunft', a.pressed === 'true' && a.line && Math.abs(a.x1 - a.open) < 1 && a.x2 > a.x1 && a.dot > a.open && /^Prognose [+−][\d,]+ % · \d+ K\./.test(a.label), JSON.stringify({ x1: a.x1, x2: a.x2, offen: a.open, label: a.label }));
      check('Prognose ist als Statistik gekennzeichnet (Tooltip)', /Statistische Projektion/.test(a.tip) && /Keine Garantie/.test(a.tip), a.tip.slice(0, 80));
      if (process.env.TIP) console.log(a.tip);
      // Zufallskurse der Attrappe: kein Muster mit Vorteil → keine Prozentzahl; der Tooltip sagt warum
      check('Zufallskurse: keine Prozentzahl neben der Linie', /^Prognose [+−][\d,]+ % · \d+ K\.( \([↑↓] außerhalb\)| [↑↓])?$/.test(a.label) && !a.badge, a.label);
      check('Tooltip nennt Muster, Fälle und Gewinnschwelle nach Gebühren', /Keine Prozentzahl: Für dieses Muster \(Trend (dafür|dagegen), Signal-Bewertung (dafür|neutral|dagegen), RSI (günstig|neutral|ungünstig)\) ist noch kein Vorteil nach Gebühren nachgewiesen – \d+ (Fall|Fälle)/.test(a.tip) && /Gewinnschwelle von 74 % \(Ziel und Stopp je 0,25 %, Gebühr 0,06 % je Seite\)/.test(a.tip), (a.tip.match(/Keine Prozentzahl.*?je Seite\)/) || [a.tip])[0].slice(0, 200));
      // Lernfaktor (Größe der Projektion) wie bisher
      const lr = a.tip.match(/Lernfaktor ×([\d,]+) → ([+−][\d,]+) %/), med = a.tip.match(/schwünge dieses Charts \(([+−][\d,]+) %/), lp = a.label.match(/^Prognose ([+−][\d,]+) % · \d+ K\./);
      const gate = a.tip.match(/(Der Lernfaktor hat|Lernfaktor nicht angewendet: er hätte) die Größenschätzung in diesem Chart bisher (?:nicht )?verbessert \(typische Abweichung (\d+) % statt (\d+) %\)/);
      check('Tooltip: Lernfaktor nur angewendet, wenn er die Schätzung in diesem Chart bisher verbessert hat', gate && (gate[1] === 'Der Lernfaktor hat' ? +gate[2] <= +gate[3] && lr : +gate[2] >= +gate[3] && !lr), gate ? gate[0] : a.tip);
      check('Prognoseziel in der Beschriftung = Median, ggf. mit Lernfaktor korrigiert', lp && med && (lr ? lp[1] === lr[2] : lp[1] === med[1]), JSON.stringify({ label: lp && lp[1], median: med && med[1], lernfaktor: lr && lr.slice(1) }));
      // still gelernt und gespeichert, ohne Backup-Hinweis
      const learned = await page.evaluate(() => { const v = JSON.parse(localStorage.getItem('scalpdesk.zzpatterns.v1') || 'null'); const s = v?.s || {}, keys = Object.keys(s).filter(k => k.startsWith('1m|0.25|'));
        return { v: v?.v, keys: keys.length, n: keys.reduce((a, k) => a + s[k][0], 0), series: !!v?.r?.['BTCUSDT|1m|0.25'], badge: document.getElementById('backup-count').hidden ? '' : document.getElementById('backup-count').textContent, changes: localStorage.getItem('scalpdesk.changes.v1') }; });
      check('Muster werden still gelernt und gespeichert – kein Backup-Hinweis dafür', learned.v === 1 && learned.keys >= 2 && learned.n >= 20 && learned.series && !/NEU/.test(learned.badge) && !(+learned.changes > 0), JSON.stringify(learned));
      await page.click('#pan-back'); await settle(page); const back = await F(); await page.click('#pan-now'); await settle(page); const now = await F();
      check('Zurückgeblättert: keine Prognose; zurück am aktuellen Rand: wieder da', !back.line && now.line, JSON.stringify({ zurück: back.line, jetzt: now.line }));
      await page.click('[data-overlay="zz"]'); await settle(page); const zoff = await F(); await page.click('[data-overlay="zz"]'); await settle(page); const zon = await F();
      check('ZigZag aus: Prognose-Knopf gesperrt, keine Projektion; ZigZag an: wieder da', zoff.disabled && !zoff.line && !zon.disabled && zon.line, JSON.stringify({ aus: [zoff.disabled, zoff.line], an: [zon.disabled, zon.line] }));
      await page.selectOption('#zz-pct', '8'); await settle(page); const few = await F(); await page.selectOption('#zz-pct', '0.25'); await settle(page);
      check('Zu wenige Schwünge: Hinweis statt Projektion', !few.line && /zu wenige Schwünge/.test(few.note), few.note);
      await page.reload(); await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {}); await settle(page);
      const re = await F(); check('Nach dem Neuladen bleibt die Prognose an', re.pressed === 'true' && re.line, JSON.stringify({ pressed: re.pressed, line: re.line }));
      await page.click('#chart-full'); await page.waitForTimeout(800); await page.click('#fb-tools'); await page.waitForTimeout(600);
      const fsv = await F(), vis = await page.evaluate(() => getComputedStyle(document.getElementById('zz-fc')).visibility);
      check('Vollbild: Prognose sichtbar, Knopf in der Werkzeugzeile', fsv.line && vis === 'visible', JSON.stringify({ line: fsv.line, vis }));
      await page.click('#fb-exit'); await page.waitForTimeout(400);
      check('Prognose: keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
      // Gelernte Muster mit nachgewiesenem Vorteil (vorbelegt): Zahl in Richtungsfarbe; umgekehrt Fortsetzung
      const seedPat = hits => ({ v: 1, s: Object.fromEntries(['+', '-'].flatMap(T => ['+', '0', '-'].flatMap(S => ['+', '0', '-'].map(R => [`1m|0.25|T${T}S${S}R${R}`, [400, hits]])))), r: {} });
      for (const [hits, name] of [[380, 'Umkehr'], [20, 'Fortsetzung']]) {
        const c2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
        await c2.addInitScript(([p]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem('scalpdesk.zigzag.v1', JSON.stringify({ pct: 0.25, fc: true })); localStorage.setItem('scalpdesk.zzpatterns.v1', JSON.stringify(p)); }, [seedPat(hits)]);
        const p2 = await c2.newPage(), e2 = []; h.collect(p2, e2); await p2.goto(h.URL_BASE + '/weather-widget-v2.html');
        await p2.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {}); await p2.waitForTimeout(1200);
        const F2 = () => p2.evaluate(() => { const t = document.querySelector('#chart .zz-fc-label'), l = document.querySelector('#chart .zz-fc-line'), b = document.querySelector('#chart .zz-fc-p');
          return { label: t ? t.textContent : '', badge: b?.textContent || '', cls: b?.getAttribute('class') || '', fill: b ? getComputedStyle(b).fill : '', contra: !!document.querySelector('#chart .zz-fc.contra'), up: l ? +l.getAttribute('y2') < +l.getAttribute('y1') : null, tip: document.querySelector('#chart .zz-fc title')?.textContent || '' }; });
        const r = await F2(), m = r.badge.match(/^(weiter )?([↑↓]) (\d+) %$/), rise = m && m[2] === '↑';
        if (name === 'Umkehr') check('Muster mit Vorteil: Zahl neben der Linie, Pfeil in Linienrichtung, grün/rot', m && !m[1] && rise === r.up && +m[3] >= 85 && +m[3] < 95 && r.cls.includes(rise ? 'up' : 'down') && !r.contra && /vorsichtig geschätzt/.test(r.tip) && /Gewinnschwelle nach Gebühren \(0,06 % je Seite\): 74 %/.test(r.tip) && /Erwartung je Trade mit Ziel und Stopp je 0,25 %: \+/.test(r.tip), JSON.stringify({ label: r.label, badge: r.badge, cls: r.cls, linieAuf: r.up }));
        else check('Muster spricht für Fortsetzung: „weiter“ mit Gegenpfeil, eingezeichnete Umkehr blass', m && m[1] && rise === !r.up && r.contra && /eher Fortsetzung als die eingezeichnete Umkehr/.test(r.tip), JSON.stringify({ label: r.label, badge: r.badge, linieAuf: r.up, blass: r.contra }));
        if (name === 'Umkehr') {
          // Sicherung enthält die Muster – ohne Erwähnung; Einspielen auf einem frischen Gerät übernimmt sie still
          const [dl] = await Promise.all([p2.waitForEvent('download'), p2.evaluate(() => document.getElementById('backup-save').click())]);
          const file = JSON.parse(fs.readFileSync(await dl.path(), 'utf8')), st = await p2.textContent('#history-status');
          const nS = file.patterns?.s?.['1m|0.25|T+S0R0']?.[0] || 0;
          check('Sicherungsdatei enthält die gelernten Muster, Meldung ohne Erwähnung', file.app === 'scalp-desk' && file.version === 8 && file.patterns?.v === 1 && nS >= 400 && !/Muster/.test(st), JSON.stringify({ muster: Object.keys(file.patterns?.s || {}).length, fälle: nS, meldung: st }));
          const tmp = path.join(__dirname, 'zzp-backup-test.json'); fs.writeFileSync(tmp, JSON.stringify(file));
          const c3 = await browser.newContext({ viewport: { width: 1440, height: 900 } }), p3 = await c3.newPage(), e3 = []; h.collect(p3, e3);
          await p3.goto(h.URL_BASE + '/weather-widget-v2.html'); await p3.waitForTimeout(1500);
          await p3.setInputFiles('#backup-file', tmp); await p3.waitForTimeout(500);
          const imp = await p3.evaluate(() => ({ s: JSON.parse(localStorage.getItem('scalpdesk.zzpatterns.v1') || '{}').s || {}, msg: document.getElementById('history-status').textContent }));
          check('Einspielen auf einem frischen Gerät: Muster still übernommen', (imp.s['1m|0.25|T+S0R0']?.[0] || 0) >= 400 && !/Muster/.test(imp.msg), JSON.stringify({ fälle: imp.s['1m|0.25|T+S0R0'], meldung: imp.msg }));
          check('Einspielen: keine Fehler', !e3.length, e3.join(' | ')); await c3.close();
        }
        check(`${name}: keine Fehler`, !e2.length, e2.join(' | ')); await c2.close();
      }
      // Handy 320 px: Beschriftung mit Trefferquote bleibt im Chart
      const pc = await browser.newContext({ viewport: { width: 320, height: 700 }, hasTouch: true, isMobile: true }); await pc.addInitScript(() => { localStorage.setItem('scalpdesk.zigzag.v1', JSON.stringify({ pct: 0.25, fc: true }));
        localStorage.setItem('scalpdesk.zzpatterns.v1', JSON.stringify({ v: 1, s: Object.fromEntries(['+', '-'].flatMap(T => ['+', '0', '-'].flatMap(S => ['+', '0', '-'].map(R => [`1m|0.25|T${T}S${S}R${R}`, [400, 380]])))), r: {} })); });
      const pp = await pc.newPage(), pe = []; h.collect(pp, pe); await pp.goto(h.URL_BASE + '/weather-widget-v2.html');
      await pp.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
      await pp.evaluate(() => document.getElementById('chart').scrollIntoView({ block: 'center' })); await pp.waitForTimeout(1500);
      const pl = await pp.evaluate(() => { const t = document.querySelector('#chart .zz-fc-label'), c = document.querySelector('#chart svg'); if (!t) return null; const r = t.getBoundingClientRect(), R = c.getBoundingClientRect(); const hit = [...document.querySelectorAll('#chart svg rect.axis-tag')].map(a => a.getBoundingClientRect()).some(a => a.left < r.right && a.right > r.left && a.top < r.bottom && a.bottom > r.top);
        return { text: t.textContent, lines: t.children.length, l: Math.round(r.left - R.left), r: Math.round(R.right - r.right), sw: document.scrollingElement.scrollWidth, vw: innerWidth, overlap: hit }; });
      check('Handy 320 px: Beschriftung mit Prozentzahl vollständig im Chart, nicht unter den Kurs-Schildchen', pl && pl.l >= 0 && pl.r >= 0 && pl.sw <= pl.vw && !pl.overlap && (pl.lines === 1 ? /^Prognose [+−][\d,]+ % · \d+ K\. · [↑↓] \d+ %/ : /^Prognose [+−][\d,]+ % · \d+ K\.[↑↓] \d+ %/).test(pl.text), JSON.stringify(pl));
      check('Handy Prognose: keine Fehler', !pe.length, pe.join(' | ')); await pc.close();
    }
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
