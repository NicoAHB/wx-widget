// 3.84.0 – Schlüssel-Levels im Chart: Knopf „Levels“ mit Auswahl und ⓘ in „Chart-Ebenen“, Marken aus Tages- und 15m-Kerzen (unabhängig vom
// Chart-Zeitrahmen), Linien mit Beschriftung und Erklärung, Voreinstellungen Tag / Woche/Monat / Sitzungen, gespeichert, „Alle ausblenden“.
// Die erwarteten Werte werden hier unabhängig aus denselben Kerzen berechnet, die die Attrappe liefert.
// Aufruf: node m139.js
const h = require('./harness');
const results = [], check = (name, ok, detail = '') => { results.push({ name, ok: !!ok }); console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + String(detail).slice(0, 600) : ''}`); };
const real = errs => errs.filter(e => !/Service Worker registration blocked|Failed to load resource|ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|net::ERR/.test(e));
const until = async (fn, ms = 20000, step = 200) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await h.sleep(step); } };
(async () => {
  await h.setup(); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  const browser = await h.launch({ workspace: 'fresh' });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(`${h.URL_BASE}/weather-widget-v2.html`);
    await until(() => page.evaluate(() => window.__kl && document.querySelectorAll('#chart svg').length > 0));
    await page.waitForTimeout(1200);
    await page.evaluate(() => { const t = document.querySelector('.overlay-toggles'); const d = t.closest('details'); if (d) d.open = true; t.scrollIntoView({ block: 'center' }); });
    const btn = await page.evaluate(() => { const b = document.querySelector('.overlay-toggles [data-overlay="kl"]'), sel = document.getElementById('kl-set'); return b && { text: b.textContent.trim(), pressed: b.getAttribute('aria-pressed'), visible: b.getBoundingClientRect().width > 0, selVisible: sel.getBoundingClientRect().width > 0, opts: [...sel.options].map(o => o.textContent).join('|'), tip: !!document.getElementById('kl-tip'), title: b.title }; });
    check('Knopf „Levels“ mit Auswahl und ⓘ; anfangs aus, keine Linien', btn?.text === 'Levels' && btn.pressed === 'false' && btn.visible && btn.selVisible && btn.opts === 'Alle|Tag|Woche/Monat|Sitzungen' && btn.tip && /Vortag/.test(btn.title) && await page.evaluate(() => !document.querySelector('.kl-line')), JSON.stringify(btn));
    // Kerzen aus der Attrappe (wie sie die App lädt) und unabhängig daraus die erwarteten Marken
    const rows = await page.evaluate(async () => (await (await fetch('https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=45')).json()).map(r => ({ time: r[0], open: +r[1], high: +r[2], low: +r[3] })));
    const now = await page.evaluate(() => Date.now()), D = 864e5, day0 = Math.floor(now / D) * D, at = t => rows.find(r => r.time === t);
    const monday = day0 - ((new Date(day0).getUTCDay() + 6) % 7) * D, prevWeek = Array.from({ length: 7 }, (_, i) => at(monday - (i + 1) * D)), monthStart = Date.UTC(new Date(day0).getUTCFullYear(), new Date(day0).getUTCMonth(), 1);
    const expected = { do: at(day0)?.open, pdh: at(day0 - D)?.high, pdl: at(day0 - D)?.low, wo: at(monday)?.open, mo: at(monthStart)?.open, pwh: prevWeek.every(Boolean) ? Math.max(...prevWeek.map(r => r.high)) : undefined, pwl: prevWeek.every(Boolean) ? Math.min(...prevWeek.map(r => r.low)) : undefined };
    check('Attrappe liefert heutige und gestrige Tageskerze (Voraussetzung der Prüfung)', expected.do > 0 && expected.pdh > 0 && rows.length >= 8, `${rows.length} Tageskerzen`);
    await page.click('[data-overlay="kl"]');
    const toast = await until(() => page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent).find(t => /Levels an/.test(t))));
    check('Einschalten: Rückmeldung mit nächster Marke über und unter dem Kurs', /Levels an \(\d+\)\./.test(toast || '') && /Nächstes über dem Kurs: .+ H|Darunter: /.test(toast || ''), toast);
    await until(() => page.evaluate(() => __kl.levels().length > 0));
    const levels = await page.evaluate(() => __kl.levels().map(l => ({ id: l.id, price: l.price, group: l.group, label: l.label, from: l.from, live: l.live })));
    const lv = id => levels.find(l => l.id === id)?.price;
    const close = (a, b) => (a === undefined && b === undefined) || (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b)));
    const diffs = Object.entries(expected).filter(([id, v]) => !close(lv(id), v)).map(([id, v]) => `${id}: erwartet ${v}, App ${lv(id)}`);
    check('Tages-, Wochen- und Monatsmarken stimmen mit den Kerzen überein (Vortag H/T, Tag-/Woche-/Monat-Open, Vorwoche H/T)', !diffs.length, diffs.join(' | ') + ' — ' + levels.map(l => l.id).join(','));
    check('Sitzungsmarken stammen aus 15m-Kerzen (Asien, London, New York je Hoch und Tief, soweit die Kerzen lückenlos sind)', levels.filter(l => l.group === 'sessions').every(l => /^(asia|london|ny)[hl]$/.test(l.id) && l.price > 0 && l.from <= now) && levels.filter(l => l.group === 'sessions').length % 2 === 0, levels.filter(l => l.group === 'sessions').map(l => l.id).join(','));
    // Zeichnen: Tageschart, damit alle Marken im Preisbereich liegen
    await page.click('.chart-toolbar .intervals [data-interval="1d"]'); await page.waitForFunction(() => __g05.state.interval === '1d' && !__g05.state.busy, null, { timeout: 20000 }); await page.waitForTimeout(800);
    const lines = () => page.evaluate(() => [...document.querySelectorAll('#chart .kl-line')].map(l => ({ id: l.getAttribute('class').split(' ').pop(), x1: +l.getAttribute('x1'), x2: +l.getAttribute('x2'), y: +l.getAttribute('y1'), dash: l.getAttribute('stroke-dasharray'), title: l.querySelector('title')?.textContent })));
    const labels = () => page.evaluate(() => [...document.querySelectorAll('#chart .kl-label')].map(t => ({ id: t.getAttribute('class').split(' ').pop(), text: t.textContent })));
    let L = await lines(), T = await labels();
    check('Linien im Chart: je sichtbarer Marke eine Linie mit Beschriftung „Name Preis“ und Erklärung beim Darüberfahren', L.length > 0 && L.length === T.length && L.every(l => l.x2 > l.x1 && /gilt ab/.test(l.title)) && T.some(t => /^Vortag H /.test(t.text)) && T.some(t => /^Tag-Open /.test(t.text)), JSON.stringify(T.map(t => t.text)));
    check('Eröffnungen gepunktet, Hoch/Tief gestrichelt; alle Linien bis zum rechten Rand', L.filter(l => /^(do|wo|mo)$/.test(l.id)).every(l => l.dash === '2 4') && L.filter(l => /^(pdh|pdl|pwh|pwl)$/.test(l.id)).every(l => l.dash === '7 4') && new Set(L.map(l => l.x2)).size === 1);
    const ys = L.map(l => ({ id: l.id, y: l.y })), pdh = lv('pdh'), pdl = lv('pdl');
    check('Vortag-Hoch liegt im Chart über Vortag-Tief (Höhe folgt dem Preis)', !L.some(l => l.id === 'pdh') || !L.some(l => l.id === 'pdl') || ys.find(l => l.id === 'pdh').y < ys.find(l => l.id === 'pdl').y, `${pdh} / ${pdl}`);
    // Hinweis für Analysen: Marken zwischen Einstieg und Ziel 1
    const pathCase = await page.evaluate(() => { const L = __kl.levels().slice().sort((a, b) => a.price - b.price), lo = L[0].price, hi = L.at(-1).price, mid = L.slice(1, -1); return { lo, hi, ids: mid.map(l => l.id), row: __kl.pathRow({ entry: lo, target1: hi }), none: __kl.pathRow({ entry: hi, target1: hi * 1.0001 }), bad: __kl.pathRow({ entry: 0, target1: 5 }), nosig: __kl.pathRow(null) }; });
    check('Analyse-Details: „Schlüssel-Level im Weg“ nennt die drei nächsten Marken mit Abstand und zählt die übrigen', pathCase.row?.[0] === 'Schlüssel-Level im Weg' && /^[^·]+ \([\d,]+ %\)( · [^·]+ \([\d,]+ %\)){2} · \+\d+$/.test(pathCase.row[1]) && Number(pathCase.row[1].match(/\+(\d+)$/)[1]) === pathCase.ids.length - 3, JSON.stringify(pathCase.row));
    check('… „keines bis Ziel 1“, wenn nichts dazwischen liegt; ohne gültiges Signal keine Zeile', pathCase.none?.[1] === 'keines bis Ziel 1' && pathCase.bad === null && pathCase.nosig === null, JSON.stringify([pathCase.none, pathCase.bad, pathCase.nosig]));
    // Voreinstellungen
    const setPreset = async v => { await page.selectOption('#kl-set', v); await page.waitForTimeout(500); return (await labels()).map(t => t.id); };
    const day = await setPreset('day'), higher = await setPreset('higher'), ses = await setPreset('sessions');
    check('Voreinstellung „Tag“ zeigt nur Vortag H/T und Tag-Open', day.length > 0 && day.every(id => /^(pdh|pdl|do)$/.test(id)), day.join(','));
    check('Voreinstellung „Woche/Monat“ zeigt nur Vorwoche H/T, Woche-Open und Monat-Open', higher.length > 0 && higher.every(id => /^(pwh|pwl|wo|mo)$/.test(id)), higher.join(','));
    check('Voreinstellung „Sitzungen“ zeigt nur Sitzungsmarken (oder keine, wenn sie außerhalb des Preisbereichs liegen)', ses.every(id => /^(asia|london|ny)[hl]$/.test(id)), ses.join(','));
    await setPreset('all');
    // Erklärung
    await page.click('#kl-tip > summary'); await page.waitForTimeout(300);
    const tip = await page.evaluate(() => { const b = document.querySelector('#kl-tip .tip-body'); return { open: document.getElementById('kl-tip').open, vis: b.getBoundingClientRect().height > 0, text: b.textContent }; });
    check('ⓘ erklärt: Tag, Woche/Monat, Sitzungen mit Zeiten, nichts wird geschätzt, kein Handelssignal', tip.open && tip.vis && /Vortag H\/T/.test(tip.text) && /Woche-Open/.test(tip.text) && /Asien \(00–08 UTC\)/.test(tip.text) && /nichts geschätzt/.test(tip.text) && /kein Handelssignal/.test(tip.text));
    await page.click('#kl-tip > summary');
    // gespeichert, Neustart
    await page.selectOption('#kl-set', 'higher'); await page.waitForTimeout(300);
    const saved = await page.evaluate(() => ({ set: JSON.parse(localStorage.getItem('scalpdesk.keylevels.v1')), ov: JSON.parse(localStorage.getItem('scalpdesk.overlays.v1')).kl }));
    check('Auswahl und Schalter sind gespeichert', saved.set?.set === 'higher' && saved.ov === true, JSON.stringify(saved));
    await page.reload(); await until(() => page.evaluate(() => window.__kl && document.querySelectorAll('#chart svg').length > 0)); await page.waitForTimeout(1500);
    check('Nach Neustart: Schalter an, Auswahl „Woche/Monat“ erhalten', await page.evaluate(() => document.querySelector('[data-overlay="kl"]').getAttribute('aria-pressed') === 'true' && document.getElementById('kl-set').value === 'higher' && __kl.set === 'higher'));
    // Alle ausblenden / einblenden
    await page.evaluate(() => { const t = document.querySelector('.overlay-toggles'); const d = t.closest('details'); if (d) d.open = true; });
    await page.click('#ov-all'); await page.waitForTimeout(600);
    check('„Alle ausblenden“ nimmt auch die Levels weg', await page.evaluate(() => document.querySelector('[data-overlay="kl"]').getAttribute('aria-pressed') === 'false' && !document.querySelector('#chart .kl-line')));
    await page.click('#ov-all'); await page.waitForTimeout(900);
    check('„Alle einblenden“ bringt sie zurück', await page.evaluate(() => document.querySelector('[data-overlay="kl"]').getAttribute('aria-pressed') === 'true'));
    // Handy
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), mp = await mctx.newPage(); h.collect(mp, errors);
    await mp.goto(`${h.URL_BASE}/weather-widget-v2.html`); await until(() => mp.evaluate(() => window.__kl && document.querySelectorAll('#chart svg').length > 0));
    const mobile = await mp.evaluate(() => { const t = document.querySelector('.overlay-toggles'); const d = t.closest('details'); if (d) d.open = true; const b = document.querySelector('[data-overlay="kl"]').getBoundingClientRect(), s = document.getElementById('kl-set').getBoundingClientRect(); return { right: Math.max(b.right, s.right), vw: innerWidth, h: b.height, doc: document.documentElement.scrollWidth }; });
    check('Handy 390 px: Knopf und Auswahl ohne seitliches Überlaufen', mobile.right <= mobile.vw + 1 && mobile.doc <= mobile.vw + 1, JSON.stringify(mobile));
    await mctx.close();
    check('keine Laufzeitfehler', !real(errors).length, real(errors).join(' | '));
    await ctx.close();
  } catch (e) { check('Abbruch', false, e.stack || e.message); }
  finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
