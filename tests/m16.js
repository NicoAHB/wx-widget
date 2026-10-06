// Elliott-Prognose (Schalter „Wellen-Prognose“): nur bei aktueller Zählung frei, Weg der nächsten Wellen rechts vom letzten
// Kurs, Ziele je Zustand (5 läuft → A B C, A läuft → B C, B läuft → C, nach C → (1)), Tooltip ohne Prozentzahl, gesperrt mit
// Grund, gespeichert, Vollbild, zurückgeblättert, Handy. Die Attrappe liefert per /shape gezielte Verläufe. Aufruf: node m16.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const fc = page => page.evaluate(() => {
  const b = document.querySelector('[data-overlay="ewfc"]'), g = document.querySelector('#chart svg .ew-fc'), svg = document.querySelector('#chart svg');
  const candles = [...svg.querySelectorAll(':scope > rect')].map(r => +r.getAttribute('x') + +r.getAttribute('width') / 2), lastX = candles.length ? Math.max(...candles) : 0;
  const line = g?.querySelector('.ew-fc-line'), pts = line ? line.getAttribute('points').trim().split(/\s+/).map(p => p.split(',').map(Number)) : [];
  return { pressed: b?.getAttribute('aria-pressed'), dis: b?.getAttribute('aria-disabled'), na: b?.classList.contains('na'), g: !!g, tip: g?.querySelector('title')?.textContent || '',
    lbl: g ? [...g.querySelectorAll('.ew-fc-lbl')].map(l => l.dataset.wave).join(' ') : '', note: g?.querySelector('.ew-fc-note')?.textContent || '', pts, lastX, vbw: +svg.getAttribute('viewBox').split(' ')[2] };
});
const settle = page => page.waitForTimeout(900);
const load = async (page, sym) => { await page.fill('#symbol', sym); await page.press('#symbol', 'Enter'); await page.waitForFunction(s => document.getElementById('lb-sym').textContent === s, sym, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(1500); };
const toastText = page => page.evaluate(() => [...document.querySelectorAll('#toasts .toast.info')].map(t => t.textContent).join(' | '));
const clearToasts = page => page.evaluate(() => document.querySelectorAll('#toasts .toast.info').forEach(t => t.remove()));
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  for (const [sym, kind] of [['XRPUSDT', 'ew-up'], ['SOLUSDT', 'ew-five'], ['LTCUSDT', 'ew-open'], ['BCHUSDT', 'ew-bopen'], ['ETCUSDT', 'ew-none']]) await h.ctl(`/shape?symbol=${sym}&interval=1m&kind=${kind}`);
  await h.ctl('/shape?symbol=NEARUSDT&interval=1m&kind=short&n=30');
  const P = (await h.ctl('/state')).price, browser = await h.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html');
    await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
    await load(page, 'SOL');
    let d = await fc(page);
    check('Schalter „Wellen-Prognose“ neben „Elliott“, standardmäßig aus, bei aktueller Zählung frei', d.pressed === 'false' && d.dis === 'false' && !d.na && !d.g, JSON.stringify({ pressed: d.pressed, dis: d.dis, g: d.g }));
    await page.click('[data-overlay="ewfc"]'); await settle(page); d = await fc(page);
    check('Welle 5 läuft: Weg über A, B, C', d.g && d.lbl === 'A B C', d.lbl);
    check('Weg beginnt am laufenden Extrempunkt, die Zielpunkte liegen rechts der letzten Kerze im Chart', d.pts.length === 4 && d.pts.slice(1).every(([x]) => x > d.lastX) && d.pts.every(([x]) => x > 0 && x < d.vbw) && d.pts[0][0] <= d.lastX + 1, JSON.stringify({ pts: d.pts.map(p => p.map(Math.round)), lastX: Math.round(d.lastX) }));
    check('Ziel am Ende mit Kurs und Abstand („C ≈ … (−… %)“)', /^C ≈ [\d.,]+ \([+−][\d,]+ %\)$/.test(d.note), d.note);
    check('Tooltip: schematisch, Regeln, Annahme, ehrlich ohne Prozentzahl mit Backtest-Zahlen', /Elliott-Prognose, schematisch \(A → B → C\)/.test(d.tip) && /38,2 % Rückgang des Impulses/.test(d.tip) && /Annahme: der laufende Extrempunkt ist die Umkehr/.test(d.tip) && /Keine Prozentzahl, kein Handelssignal/.test(d.tip) && /A-Ziel 40–51 %, C-Ziel 28–43 %/.test(d.tip), d.tip.slice(0, 140));
    // Kurse der Ziele: A = 38,2 % Rückgang des Impulses (Attrappe: Start 0,90 → Ende 1,08 des Grundkurses, abwärts gespiegelt für SOL)
    await load(page, 'LTC'); d = await fc(page);
    check('A läuft: Weg über B und C, Tooltip mit Ungültigkeits-Marke (Ende von Welle 5)', d.lbl === 'B C' && /Ungültig, sobald der Kurs über [\d.,]+ \(Ende von Welle 5\) läuft/.test(d.tip), `${d.lbl} · ${d.tip.match(/Ungültig[^.]*\)/)?.[0] || ''}`);
    await load(page, 'BCH'); d = await fc(page);
    check('B läuft: Ziel C', d.lbl === 'C' && /^C ≈ /.test(d.note), `${d.lbl} · ${d.note}`);
    await load(page, 'XRP'); d = await fc(page);
    check('C bestätigt, neuer Schwung läuft: Ziel „(1)“ neuer Impuls, 61,8 % zurück Richtung Welle 5', d.lbl === '(1)' && /^\(1\) ≈ /.test(d.note) && /neuer Impuls/.test(d.tip), `${d.lbl} · ${d.note}`);
    const exp = P.XRPUSDT, t1 = (0.995 + 0.618 * (1.08 - 0.995)); // Grundkurs × Anteil, Wicks ±0,02 %
    const got = +d.note.match(/≈ ([\d.,]+)/)[1].replace(/\./g, '').replace(',', '.');
    check('Zielkurs „(1)“ stimmt (C + 61,8 % × (Ende 5 − C))', Math.abs(got / (exp / 1.035) - t1) < 0.004, `${got} vs ${(exp / 1.035 * t1).toFixed(4)}`);
    // gesperrt mit Grund
    await clearToasts(page); await load(page, 'ETC'); d = await fc(page);
    check('Keine Zählung: Schalter gesperrt, kein Weg', d.dis === 'true' && d.na && !d.g, JSON.stringify({ dis: d.dis, g: d.g }));
    await page.click('[data-overlay="ewfc"]', { force: true }); await page.waitForTimeout(400); let tt = await toastText(page);
    check('Antippen erklärt den Grund, Schalter bleibt an', /^Wellen-Prognose: In diesem Chart erfüllt gerade kein Verlauf die drei Grundregeln/.test(tt) && (await fc(page)).pressed === 'true', tt.slice(0, 110));
    await clearToasts(page); await load(page, 'NEAR'); d = await fc(page); await page.click('[data-overlay="ewfc"]', { force: true }); await page.waitForTimeout(400); tt = await toastText(page);
    check('Unter 50 Kerzen: gesperrt, Hinweis mit Anzahl', d.dis === 'true' && /ab 50 Kerzen – dieser Chart hat erst \d+/.test(tt), tt.slice(0, 90));
    await clearToasts(page); await load(page, 'SOL');
    // 3.32.0 (G04.1): abhängige Ebene bleibt einschaltbar – bei ausgeschaltetem Elliott frei und nicht gedrückt, der Wunsch bleibt gespeichert
    await page.click('[data-overlay="ew"]'); await settle(page); d = await fc(page);
    check('Elliott aus: Prognose verschwunden, Schalter frei und nicht gedrückt (wirkt erst mit Elliott)', d.dis === 'false' && !d.na && d.pressed === 'false' && !d.g, JSON.stringify({ dis: d.dis, pressed: d.pressed, g: d.g }));
    await page.click('[data-overlay="ew"]'); await settle(page); d = await fc(page);
    check('Elliott wieder an: Prognose wieder da (Schalter blieb an)', d.pressed === 'true' && d.g && d.lbl === 'A B C', d.lbl);
    await page.click('[data-overlay="ew"]'); await settle(page); await page.click('[data-overlay="ewfc"]'); await settle(page); d = await fc(page);
    const ewOn = await page.evaluate(() => document.querySelector('[data-overlay="ew"]').getAttribute('aria-pressed'));
    check('Elliott aus, „Wellen-Prognose“ antippen: schaltet Elliott mit ein, Prognose da', ewOn === 'true' && d.pressed === 'true' && d.g && d.lbl === 'A B C', JSON.stringify({ ew: ewOn, fc: d.pressed, lbl: d.lbl }));
    await page.reload(); await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(1500);
    const sym0 = await page.evaluate(() => document.getElementById('lb-sym').textContent); if (sym0 !== 'SOL') await load(page, 'SOL');
    d = await fc(page); check('Nach dem Neuladen bleibt die Prognose an', d.pressed === 'true' && d.g && d.lbl === 'A B C', JSON.stringify({ pressed: d.pressed, g: d.g, symbolNachNeuladen: sym0 }));
    // zurückgeblättert: keine Prognose
    await page.click('#pan-back'); await settle(page); d = await fc(page); await page.click('#pan-now'); await settle(page); const d2 = await fc(page);
    check('Zurückgeblättert keine Prognose, am aktuellen Rand wieder', !d.g && d2.g, JSON.stringify({ zurück: d.g, jetzt: d2.g }));
    // Vollbild
    await page.click('#chart-full'); await page.waitForTimeout(800); await page.click('#fb-tools'); await page.waitForTimeout(600);
    const f1 = await fc(page); await page.click('[data-overlay="ewfc"]'); await settle(page); const f2 = await fc(page); await page.click('[data-overlay="ewfc"]'); await settle(page); const f3 = await fc(page);
    check('Vollbild: Prognose sichtbar, Schalter in der Werkzeugzeile blendet aus und ein', f1.g && !f2.g && f3.g, JSON.stringify({ an: f1.g, aus: f2.g, wieder: f3.g }));
    await page.click('#fb-exit'); await page.waitForTimeout(400);
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
    // Handy hochkant: Weg und Beschriftung im Chart, nichts unter den Kurs-Schildchen, kein seitliches Scrollen
    for (const w of [390, 320]) {
      const pc = await browser.newContext({ viewport: { width: w, height: 800 }, hasTouch: true, isMobile: true });
      await pc.addInitScript(() => localStorage.setItem('scalpdesk.overlays.v1', JSON.stringify({ vp: true, ema200: true, bb: true, liq: true, lmap: true, zz: true, div: true, ew: true, ewfc: true })));
      const pp = await pc.newPage(), pe = []; h.collect(pp, pe); await pp.goto(h.URL_BASE + '/weather-widget-v2.html');
      await pp.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {}); await load(pp, 'SOL');
      await pp.evaluate(() => document.getElementById('chart').scrollIntoView({ block: 'center' })); await pp.waitForTimeout(800);
      const m = await fc(pp), o = await pp.evaluate(() => { const R = e => e.getBoundingClientRect(), svg = R(document.querySelector('#chart svg')), hit = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
        const mine = [...document.querySelectorAll('#chart .ew-fc-lbl circle, #chart .ew-fc-note')].map(R), tags = [...document.querySelectorAll('#chart rect.axis-tag')].map(R), out = [];
        for (const a of mine) { if (a.left < svg.left - 1 || a.right > svg.right + 1) out.push('außerhalb'); for (const t of tags) if (hit(a, t)) out.push('unter Schildchen'); }
        return { out, sw: document.scrollingElement.scrollWidth - innerWidth }; });
      check(`Handy ${w} px: Prognose im Chart, nicht unter den Kurs-Schildchen, kein seitliches Scrollen`, m.g && m.lbl === 'A B C' && !o.out.length && o.sw <= 0, JSON.stringify({ lbl: m.lbl, note: m.note, ...o }));
      check(`Handy ${w} px: keine Fehler`, !pe.length, pe.join(' | ')); await pc.close();
    }
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await browser.close(); await h.ctl('/walk?on=1').catch(() => {}); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
