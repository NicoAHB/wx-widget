// 3.89.0 – Bereich „Chart-Ebenen“: vier Gruppen mit Überschrift, klarer Zustand (an mit Haken / aus / gesperrt mit Schloss), Zähler im Titel,
// Hinweis auf gesperrte Ebenen, Auswahl „Ansicht“ (Trend, Niveaus, Wellen, Orderflow, Nur Kerzen), Einstellungen als Kapsel am Schalter,
// Erklärliste „Was zeigt welche Ebene?“, Breiten 320–1440 ohne Überlauf, Vollbild bleibt eine schmale Chipleiste. Aufruf: node m147.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + String(detail).slice(0, 500) : ''}`); };
const KEY = 'scalpdesk.overlays.v1';
const OFF = { vp: false, ema200: false, bb: false, liq: false, lmap: false, zz: false, div: false, ew: false, ewfc: false, fib: false, whale: false, hilo: false, hz: false, fvg: false, kl: false, vwap: true, macd: true };
const real = errs => errs.filter(e => !/Service Worker registration blocked|Failed to load resource|ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|net::ERR/.test(e));

async function open(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, timezoneId: 'Europe/Berlin', ...opts }), page = await ctx.newPage(), errors = [];
  h.collect(page, errors);
  await ctx.addInitScript(([key, value]) => { if (!localStorage.getItem('m147-seeded')) { localStorage.setItem('m147-seeded', '1'); localStorage.setItem(key, JSON.stringify(value)); } }, [KEY, OFF]);
  await page.goto(h.URL_BASE + '/weather-widget-v2.html');
  await page.waitForFunction(() => document.getElementById('status')?.dataset.feed === 'live' && __g05.state.candles.length > 30, null, { timeout: 30000 });
  await page.evaluate(() => { document.getElementById('workspace-chart-tools').open = true; });
  await page.waitForTimeout(800);
  return { ctx, page, errors };
}
const pressed = page => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.overlay-toggles [data-overlay], #zz-fc')].map(b => [b.dataset.overlay || 'zzfc', b.getAttribute('aria-pressed') === 'true'])));
const on = async page => Object.entries(await pressed(page)).filter(([, v]) => v).map(([k]) => k).sort();
const stored = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const count = page => page.textContent('#ov-count');

(async () => {
  await h.setup(); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  const browser = await h.launch({ workspace: 'fresh' });
  try {
    let { ctx, page, errors } = await open(browser);

    // ---------- 1. Aufbau ----------
    const st = await page.evaluate(() => {
      const heads = [...document.querySelectorAll('.ov-group-h')].map(n => n.textContent), groups = [...document.querySelectorAll('.ov-group')].map(g => [...g.querySelectorAll('[data-overlay], #zz-fc')].map(b => b.dataset.overlay || 'zzfc'));
      const summary = document.querySelector('#workspace-chart-tools>summary');
      return { heads, groups, total: document.querySelectorAll('.overlay-toggles [data-overlay], #zz-fc').length, title: summary.firstChild.textContent.trim(), summaryText: summary.textContent, labelled: [...document.querySelectorAll('.ov-group')].every(g => document.getElementById(g.getAttribute('aria-labelledby'))?.textContent) };
    });
    check('Vier Gruppen mit Überschrift: Preisniveaus, Trend & Indikatoren, Wellen, Orderflow & Liquidität', JSON.stringify(st.heads) === JSON.stringify(['Preisniveaus', 'Trend & Indikatoren', 'Wellen', 'Orderflow & Liquidität']) && st.labelled, JSON.stringify(st.heads));
    check('Alle 18 Schalter liegen in einer Gruppe, in der festgelegten Reihenfolge', st.total === 18 && JSON.stringify(st.groups) === JSON.stringify([['hilo', 'vp', 'hz', 'kl', 'fib', 'fvg'], ['ema200', 'bb', 'vwap', 'macd', 'div'], ['zz', 'zzfc', 'ew', 'ewfc'], ['liq', 'lmap', 'whale']]), JSON.stringify(st.groups));
    check('Titel heißt „Chart-Ebenen“ (nicht mehr „… Whales & Werkzeuge“) und trägt den Zähler', st.title === 'Chart-Ebenen' && /^Chart-Ebenen\s*\d+ von 18 aktiv/.test(st.summaryText), st.summaryText);
    check('Oben: „Alle ausblenden“ und die Auswahl „Ansicht“ (Eigene Auswahl, Trend, Niveaus, Wellen, Orderflow, Nur Kerzen)', await page.evaluate(() => !!document.getElementById('ov-all') && [...document.querySelectorAll('#ov-view option')].map(o => o.textContent).join('|') === 'Eigene Auswahl|Trend|Niveaus|Wellen|Orderflow|Nur Kerzen'));

    // ---------- 2. Zustand: an / aus / gesperrt ----------
    const look = await page.evaluate(() => {
      const mark = b => { const cs = getComputedStyle(b, '::before'); return { content: cs.content, opacity: cs.opacity }; };
      const macd = document.querySelector('[data-overlay=macd]'), vp = document.querySelector('[data-overlay=vp]'), lock = document.querySelector('.overlay-toggles .na[data-overlay], .overlay-toggles #zz-fc.na');
      const box = b => { const cs = getComputedStyle(b); return { bg: cs.backgroundColor, border: cs.borderTopColor, style: cs.borderTopStyle }; };
      const capsule = macd.closest('.ov-pair'), capCs = getComputedStyle(capsule), offCap = document.querySelector('[data-overlay=kl]').closest('.ov-pair'), offCs = getComputedStyle(offCap);
      return { onMark: mark(macd), offMark: mark(vp), onBox: box(vp), offBox: box(vp), capOn: { bg: capCs.backgroundColor, border: capCs.borderTopColor }, capOff: { bg: offCs.backgroundColor, border: offCs.borderTopColor }, lock: lock && { label: lock.textContent.trim(), mark: mark(lock), box: box(lock), disabled: lock.getAttribute('aria-disabled') } };
    });
    check('An: Haken sichtbar und Akzent-Fläche; aus: Haken unsichtbar und keine Fläche (auch bei Schaltern mit Einstellung)', look.onMark.content === '"✓"' && look.onMark.opacity === '1' && look.offMark.opacity === '0' && look.capOn.bg !== 'rgba(0, 0, 0, 0)' && look.capOn.border !== look.capOff.border && look.capOff.bg === 'rgba(0, 0, 0, 0)', JSON.stringify({ on: look.onMark, off: look.offMark, capOn: look.capOn, capOff: look.capOff }));
    check('Gesperrt: gestrichelt, Schloss statt Haken, aria-disabled', !!look.lock && look.lock.box.style === 'dashed' && look.lock.mark.content === '"🔒"' && look.lock.disabled === 'true', JSON.stringify(look.lock));
    const note = await page.evaluate(() => ({ text: document.getElementById('ov-note').textContent, hidden: document.getElementById('ov-note').hidden, locked: [...document.querySelectorAll('.overlay-toggles .na')].length }));
    check('Hinweis nennt die Zahl der gesperrten Ebenen und ihre Namen', !note.hidden && new RegExp(`${note.locked} gesperrt`).test(note.text) && /Wellen-Prognose/.test(note.text) && /antippen zeigt den Grund/.test(note.text), note.text);
    const countBefore = await count(page), vwapOn = (await on(page)).length;
    check('Zähler zählt eingeschaltete, nicht gesperrte Ebenen („2 von 18 aktiv“ bei VWAP + MACD)', countBefore === `${vwapOn} von 18 aktiv` && vwapOn === 2, countBefore);
    await page.click('[data-overlay=vp]'); await page.waitForTimeout(300);
    check('Antippen einer Ebene ändert den Zähler sofort (3 von 18) und merkt sie', await count(page) === '3 von 18 aktiv' && (await stored(page)).vp === true);
    await page.click('[data-overlay=vp]'); await page.waitForTimeout(300);
    const lockedKey = await page.evaluate(() => { const b = document.querySelector('.overlay-toggles .na[data-overlay]'); return b?.dataset.overlay; });
    if (lockedKey) {
      const was = await pressed(page); await page.locator(`[data-overlay=${lockedKey}]`).click({ force: true }); await page.waitForTimeout(300); // aria-disabled: Playwright klickt sonst nicht
      check('Antippen einer gesperrten Ebene schaltet nichts, nennt aber den Grund', JSON.stringify(await pressed(page)) === JSON.stringify(was) && await page.evaluate(() => /Prognose|braucht|Voraussetzung|Zählung|Kerzen/.test(document.getElementById('toasts').textContent)), await page.evaluate(() => document.getElementById('toasts').textContent.slice(0, 120)));
    }

    // ---------- 3. Ansicht ----------
    await page.selectOption('#ov-view', 'trend'); await page.waitForTimeout(400);
    check('Ansicht „Trend“: genau EMA 200, Bollinger, VWAP, MACD', JSON.stringify(await on(page)) === JSON.stringify(['bb', 'ema200', 'macd', 'vwap']), JSON.stringify(await on(page)));
    const keys = await stored(page);
    check('… gespeichert (alle anderen Ebenen aus) und im Zähler (4 von 18)', keys.ema200 && keys.bb && keys.vwap && keys.macd && !keys.vp && !keys.whale && !keys.zz && await count(page) === '4 von 18 aktiv');
    await page.selectOption('#ov-view', 'flow'); await page.waitForTimeout(400);
    check('Ansicht „Orderflow“: Liquidation, Liq-Heatmap, Whales, VWAP', JSON.stringify(await on(page)) === JSON.stringify(['liq', 'lmap', 'vwap', 'whale']), JSON.stringify(await on(page)));
    await page.selectOption('#ov-view', 'levels'); await page.waitForTimeout(400);
    check('Ansicht „Niveaus“: Hoch/Tief, Volumenprofil, Levels, Fibonacci, FVG', JSON.stringify(await on(page)) === JSON.stringify(['fib', 'fvg', 'hilo', 'kl', 'vp']), JSON.stringify(await on(page)));
    await page.selectOption('#ov-view', 'waves'); await page.waitForTimeout(400);
    check('Ansicht „Wellen“: ZigZag, RSI-Div., Elliott, Fibonacci', JSON.stringify(await on(page)) === JSON.stringify(['div', 'ew', 'fib', 'zz']), JSON.stringify(await on(page)));
    await page.click('[data-overlay=whale]'); await page.waitForTimeout(300);
    check('Eine Ebene dazu geschaltet: die Auswahl zeigt „Eigene Auswahl“', await page.inputValue('#ov-view') === 'custom');
    await page.click('[data-overlay=whale]'); await page.waitForTimeout(300);
    check('Wieder weggeschaltet: die Auswahl erkennt „Wellen“ erneut', await page.inputValue('#ov-view') === 'waves');
    await page.reload(); await page.waitForFunction(() => document.getElementById('status')?.dataset.feed === 'live' && document.getElementById('ov-count')?.textContent); await page.waitForTimeout(800);
    check('Nach dem Neuladen: Ansicht und Ebenen erhalten', await page.inputValue('#ov-view') === 'waves' && JSON.stringify(await on(page)) === JSON.stringify(['div', 'ew', 'fib', 'zz']));
    await page.selectOption('#ov-view', 'none'); await page.waitForTimeout(400);
    check('Ansicht „Nur Kerzen“: alles aus, „Alle ausblenden“ bleibt ein Ausblenden (keine alte Rückkehr)', (await on(page)).length === 0 && await count(page) === '0 von 18 aktiv' && /Alle ausblenden/.test(await page.textContent('#ov-all')) && await page.inputValue('#ov-view') === 'none');
    await page.selectOption('#ov-view', 'trend'); await page.waitForTimeout(300);
    await page.click('#ov-all'); await page.waitForTimeout(300);
    check('„Alle ausblenden“ blendet die gewählte Ansicht aus; Auswahl zeigt „Nur Kerzen“', (await on(page)).length === 0 && await page.inputValue('#ov-view') === 'none' && /Alle einblenden/.test(await page.textContent('#ov-all')));
    await page.click('#ov-all'); await page.waitForTimeout(300);
    check('… und noch einmal tippen blendet genau „Trend“ wieder ein', JSON.stringify(await on(page)) === JSON.stringify(['bb', 'ema200', 'macd', 'vwap']) && await page.inputValue('#ov-view') === 'trend');

    // ---------- 4. Kapsel und ⓘ ----------
    const cap = await page.evaluate(() => {
      const pair = k => document.querySelector(`[data-overlay=${k}]`).closest('.ov-pair');
      return { zz: [...pair('zz').children].map(n => n.id || n.dataset.overlay || n.tagName), kl: [...pair('kl').children].map(n => n.id || n.dataset.overlay || n.tagName), vwap: [...pair('vwap').children].map(n => n.id || n.dataset.overlay || n.tagName), macd: [...pair('macd').children].map(n => n.id || n.dataset.overlay || n.tagName), fvg: [...pair('fvg').children].map(n => n.id || n.dataset.overlay || n.tagName) };
    });
    check('ZigZag + Mindestbewegung, Levels + Auswahl + ⓘ, VWAP + Auswahl + ⚓ + ⓘ, MACD + ⓘ, FVG + ⓘ bilden je eine Kapsel', cap.zz.join() === 'zz,zz-pct' && cap.kl.join() === 'kl,kl-set,kl-tip' && cap.vwap.join() === 'vwap,vw-mode,vw-anchor,vw-tip' && cap.macd.join() === 'macd,macd-info' && cap.fvg.join() === 'fvg,fvg-tip', JSON.stringify(cap));
    const info = await page.evaluate(() => { const b = document.getElementById('macd-info').getBoundingClientRect(), t = document.querySelector('#kl-tip>summary>span').getBoundingClientRect(); return { macd: [Math.round(b.width), Math.round(b.height)], tip: [Math.round(t.width), Math.round(t.height)] }; });
    check('Die ⓘ-Knöpfe sehen gleich aus: runde Marke (MACD wie die anderen, nicht als breite Pille)', info.macd[0] >= 20 && info.macd[0] <= 24 && info.macd[0] === info.macd[1] && Math.abs(info.macd[0] - info.tip[0]) <= 2, JSON.stringify(info));

    // ---------- 5. Erklärliste ----------
    check('„Was zeigt welche Ebene?“ ist zugeklappt, ohne Einträge', await page.evaluate(() => !document.getElementById('ov-help').open && document.getElementById('ov-help-list').children.length === 0));
    await page.click('#ov-help>summary'); await page.waitForTimeout(300);
    const help = await page.evaluate(() => { const ps = [...document.querySelectorAll('#ov-help-list p:not(.ov-help-key)')]; return { n: ps.length, heads: [...document.querySelectorAll('#ov-help-list h4')].map(n => n.textContent), labels: ps.map(p => p.querySelector('b').textContent), empty: ps.filter(p => p.textContent.replace(p.querySelector('b').textContent, '').trim().length < 20).length, dup: ps.filter(p => { const b = p.querySelector('b').textContent.toLowerCase(), t = p.textContent.slice(b.length).toLowerCase(); return /^ – [^–]*\b/.test(t) && t.slice(3).startsWith(b + ':'); }).length, key: document.querySelector('#ov-help-list .ov-help-key')?.textContent || '' }; });
    check('Aufgeklappt: Legende (✓, 🔒) und alle 18 Ebenen, nach Gruppen, jede mit Erklärung', help.n === 18 && help.heads.length === 4 && help.empty === 0 && /✓/.test(help.key) && /🔒/.test(help.key), JSON.stringify({ n: help.n, empty: help.empty }));
    const named = await page.evaluate(() => { const ps = [...document.querySelectorAll('#ov-help-list p')].map(p => p.textContent); return { zonen: ps.some(t => /^Zonen 4h \(Höhere Zonen\) – /.test(t)), fvg: ps.some(t => /^FVG \(Fair Value Gaps\) – /.test(t)), ema: ps.some(t => /^EMA 200 – exponentieller/.test(t)) }; });
    check('… ohne den Namen doppelt zu nennen („EMA 200 – EMA 200: …“), lange Namen stehen in Klammern', help.dup === 0 && help.labels.includes('Zonen 4h') && named.zonen && named.fvg && named.ema, JSON.stringify(named));
    await page.click('#ov-help>summary');

    check('Keine JavaScript-Fehler (Aufbau, Zustand, Ansicht, Erklärliste)', !real(errors).length, real(errors).join(' | '));
    await ctx.close();

    // ---------- 6. Breiten ----------
    for (const [width, height, touch] of [[320, 700, true], [390, 844, true], [768, 1024, true], [1024, 768, false], [1440, 900, false]]) {
      ({ ctx, page, errors } = await open(browser, { viewport: { width, height }, isMobile: touch, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1 }));
      const g = await page.evaluate(() => {
        const footer = document.querySelector('#workspace-chart-tools .chart-footer'), fr = footer.getBoundingClientRect();
        const chips = [...document.querySelectorAll('.overlay-toggles button, .overlay-toggles select')].filter(n => !n.closest('.tip-body') && n.getBoundingClientRect().width > 0);
        const outside = chips.filter(n => { const r = n.getBoundingClientRect(); return r.left < fr.left - 1 || r.right > fr.right + 1; }).map(n => n.id || n.dataset.overlay);
        const group = document.querySelector('.ov-group'), head = group.querySelector('.ov-group-h').getBoundingClientRect(), first = group.querySelector('.ov-chips').getBoundingClientRect();
        const small = [...document.querySelectorAll('.overlay-toggles [data-overlay], #zz-fc, #ov-all')].filter(n => n.getBoundingClientRect().height < 34 - 0.5).length;
        return { sw: document.scrollingElement.scrollWidth - innerWidth, outside, sideBySide: head.right <= first.left + 1 && Math.abs(head.top - first.top) < 40, above: head.bottom <= first.top + 1, small, fold: Math.round(document.getElementById('workspace-chart-tools').getBoundingClientRect().height) };
      });
      check(`${width}px: kein seitliches Scrollen, alle Schalter im Bereich, Mindesthöhe 34 px`, g.sw <= 0 && g.outside.length === 0 && g.small === 0, JSON.stringify(g));
      check(`${width}px: Überschrift ${width >= 700 ? 'links neben' : 'über'} den Schaltern`, width >= 700 ? g.sideBySide : g.above, JSON.stringify({ sideBySide: g.sideBySide, above: g.above }));
      if (width === 390) {
        const vw = await page.evaluate(() => { const r = ['[data-overlay=vwap]', '#vw-mode', '#vw-tip > summary'].map(q => document.querySelector(q).getBoundingClientRect()), f = document.querySelector('#workspace-chart-tools .chart-footer').getBoundingClientRect(); return Math.max(...r.map(x => x.right)) <= f.right + 1; });
        check('390px: VWAP, Auswahl und ⓘ bleiben in einer Zeile innerhalb des Bereichs', vw);
      }
      check(`${width}px: keine JavaScript-Fehler`, !real(errors).length, real(errors).join(' | '));
      await ctx.close();
    }

    // ---------- 7. Vollbild ----------
    ({ ctx, page, errors } = await open(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }));
    await page.evaluate(() => { document.documentElement.dataset.chartfull = '1'; document.documentElement.dataset.chartbar = 'open'; });
    await page.waitForTimeout(400);
    const fs = await page.evaluate(() => {
      const hidden = q => [...document.querySelectorAll(q)].every(n => getComputedStyle(n).display === 'none');
      const t = document.querySelector('.overlay-toggles'), cs = getComputedStyle(t), chips = [...document.querySelectorAll('.overlay-toggles [data-overlay]')].filter(n => n.getBoundingClientRect().width > 0);
      return { headsHidden: hidden('.ov-group-h'), viewHidden: hidden('.ov-view'), helpHidden: hidden('.ov-help, .ov-note'), dir: cs.flexDirection, chips: chips.length, overflow: document.scrollingElement.scrollWidth - innerWidth };
    });
    check('Vollbild: keine Gruppenüberschriften, keine Ansicht-Auswahl, keine Erklärliste – die Chips bleiben eine schmale Leiste', fs.headsHidden && fs.viewHidden && fs.helpHidden && fs.dir === 'row' && fs.chips >= 12 && fs.overflow <= 0, JSON.stringify(fs));
    check('Vollbild: keine JavaScript-Fehler', !real(errors).length, real(errors).join(' | '));
    await ctx.close();
  } catch (e) { check('Abbruch', false, e.stack || e.message); }
  finally { await browser.close(); await h.ctl('/walk?on=1'); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
