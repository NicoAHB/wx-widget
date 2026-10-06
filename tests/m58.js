// G09 der Übergabe (3.37.0): regelbasierte Mustererkennung („KI“) – Engine, 41 Katalogfälle, Vortrend (Revision 2), 8 Intervalle,
// Panel, Info-Sheet, Chart-Markierung, Kontextwechsel, keine externen Abrufe.
// Aufruf: node m58.js [abschnitt ...]   Abschnitte: trend, catalog, ui
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + String(detail).slice(0, 700) : ''}`); };
const real = errs => errs.filter(e => !/Service Worker registration blocked|Failed to load resource|net::ERR/.test(e));
async function openPage(browser, viewport = { width: 1440, height: 1000 }) {
  const ctx = await browser.newContext({ viewport, timezoneId: 'Europe/Berlin' }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
  await page.goto(`${h.URL_BASE}/weather-widget-v2.html`);
  await page.waitForFunction(() => document.getElementById('price').textContent.trim() !== '—', null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  return { ctx, page, errors };
}
// Bausteine im Browser: Abwärts-/Aufwärtstrend als Vorlauf, Musterkerzen relativ zum letzten Schluss P, Kursverläufe aus Pivots
const BUILD = () => {
  const STEP = 36e5, T0 = Date.UTC(2026, 0, 1);
  const lead = (dir, n = 30, p0 = 100) => { const k = []; let c = p0; for (let i = 0; i < n; i++) { const o = c; c = o + (dir === 'down' ? -1 : dir === 'up' ? 1 : 0); k.push({ t: T0 + i * STEP, o, h: Math.max(o, c) + 0.2, l: Math.min(o, c) - 0.2, c, v: 100 }); } return k; };
  const withPat = (dir, offs, step = STEP, times) => { const k = lead(dir); if (times) k.forEach((x, i) => { x.t = times[i]; }); const P = k.at(-1).c; for (const [o, hh, l, c] of offs) { const i = k.length; k.push({ t: times ? times[i] : T0 + i * step, o: P + o, h: P + hh, l: P + l, c: P + c, v: 150 }); } if (!times && step !== STEP) k.forEach((x, i) => { x.t = T0 + i * step; }); return k; };
  const mir = offs => offs.map(([o, hh, l, c]) => [-o, -l, -hh, -c]);
  const C = {
    hammer: ['down', [[0, 0.32, -1.0, 0.3]]], inverted_hammer: ['down', [[0, 1.3, -0.02, 0.3]]], doji: ['flat', [[0, 0.6, -0.6, 0.02]]], doji_dragonfly: ['down', [[0, 0.02, -1.2, 0.01]]],
    spinning_top: ['flat', [[0, 0.7, -0.4, 0.3]]], marubozu_bull: ['flat', [[0, 2.02, -0.02, 2]]],
    engulfing_bull: ['down', [[0, 0.05, -0.65, -0.6], [-0.7, 0.25, -0.75, 0.2]]], harami_bull: ['down', [[0, 0.05, -1.55, -1.5], [-1.0, -0.55, -1.05, -0.6]]],
    piercing: ['down', [[0, 0.05, -1.25, -1.2], [-1.3, -0.35, -1.35, -0.4]]], tweezer_bottom: ['down', [[0, 0.05, -1.0, -0.6], [-0.6, -0.05, -1.0, -0.1]]],
    morning_star: ['down', [[0, 0.05, -1.55, -1.5], [-1.6, -1.45, -1.7, -1.5], [-1.45, -0.45, -1.5, -0.5]]], three_white_soldiers: ['down', [[0, 0.85, -0.05, 0.8], [0.5, 1.45, 0.45, 1.4], [1.1, 2.05, 1.05, 2.0]]],
  };
  C.hanging_man = ['up', C.hammer[1]]; C.shooting_star = ['up', C.inverted_hammer[1]]; C.doji_gravestone = ['up', mir(C.doji_dragonfly[1])]; C.marubozu_bear = ['flat', mir(C.marubozu_bull[1])];
  C.engulfing_bear = ['up', mir(C.engulfing_bull[1])]; C.harami_bear = ['up', mir(C.harami_bull[1])]; C.dark_cloud = ['up', mir(C.piercing[1])]; C.tweezer_top = ['up', mir(C.tweezer_bottom[1])];
  C.evening_star = ['up', mir(C.morning_star[1])]; C.three_black_crows = ['up', mir(C.three_white_soldiers[1])];
  // Kursverläufe aus Pivots (Index, Preis), linear verbunden
  const path = pts => { const k = []; let prev = pts[0][1]; for (let s = 0; s < pts.length - 1; s++) { const [i0, p0] = pts[s], [i1, p1] = pts[s + 1]; for (let i = i0; i < i1; i++) { const c = p0 + (p1 - p0) * (i + 1 - i0) / (i1 - i0), o = prev; k.push({ t: T0 + k.length * STEP, o, h: Math.max(o, c) + 0.1, l: Math.min(o, c) - 0.1, c, v: 100 }); prev = c; } } return k; };
  const mp = pts => pts.map(([i, p]) => [i, 200 - p]);
  const cup = []; for (let i = 20; i <= 60; i += 2) cup.push([i, 100 - 15 * (1 - ((i - 40) / 20) ** 2)]);
  const F = {
    double_top: [[0, 80], [20, 100], [30, 90], [40, 100], [50, 85]], triple_top: [[0, 80], [15, 100], [25, 90], [35, 100], [45, 90], [55, 100], [65, 85]],
    head_shoulders: [[0, 80], [15, 96], [25, 88], [35, 104], [45, 88], [55, 96], [65, 82]], asc_triangle: [[0, 85], [10, 100], [20, 88], [30, 100], [40, 92], [50, 100], [58, 97]],
    sym_triangle: [[0, 80], [10, 105], [20, 85], [30, 101], [40, 89], [50, 97], [58, 92]], rising_wedge: [[0, 80], [10, 100], [20, 90], [30, 104], [40, 98], [50, 108], [58, 103]],
    asc_channel: [[0, 80], [10, 100], [20, 94], [30, 106], [40, 100], [50, 112], [58, 106]], rectangle: [[0, 80], [10, 100], [20, 90], [30, 100], [40, 90], [50, 100], [58, 94]],
    flag_bull: [[0, 90], [15, 90.5], [25, 110], [27, 106], [29, 108], [31, 105], [33, 107], [35, 104], [37, 106], [39, 103]],
    pennant_bull: [[0, 90], [15, 90.5], [25, 110], [27, 106], [29, 109], [31, 107], [33, 108.6], [35, 107.4], [37, 108.2], [39, 107.7]],
    cup_handle: [[0, 80], ...cup, [66, 96], [70, 98]],
  };
  F.double_bottom = mp(F.double_top); F.triple_bottom = mp(F.triple_top); F.inv_head_shoulders = mp(F.head_shoulders); F.desc_triangle = mp(F.asc_triangle); F.falling_wedge = mp(F.rising_wedge);
  F.desc_channel = mp(F.asc_channel); F.flag_bear = mp(F.flag_bull); F.pennant_bear = mp(F.pennant_bull);
  return { STEP, T0, lead, withPat, C, F, path };
};

const tests = {
  async trend(browser) {
    const { ctx, page, errors } = await openPage(browser);
    const r = await page.evaluate(() => {
      const E = __g09.engine(), STEP = 36e5, mk = closes => closes.map((c, i) => ({ t: i * STEP, o: c, h: c + 1, l: c - 1, c, v: 1 })), lin = (n, b, p0 = 100) => Array.from({ length: n }, (_, i) => p0 + b * i);
      const tr = (k, i0) => { const A = E.atrSeries(k); return E.preTrend(k, i0, A, STEP); };
      const k22 = mk(lin(23, -0.5)), base = tr(k22, 22), k22b = k22.map(x => ({ ...x })); k22b[22] = { ...k22b[22], c: 500, h: 600, l: 1 }; k22b.push({ t: 23 * STEP, o: 1, h: 999, l: 0.5, c: 900, v: 1 });
      return {
        eight: base, eightSame: tr(k22b, 22), seven: tr(mk(lin(23, -0.5)), 7), flat: tr(mk(lin(23, 0)), 22), small: tr(mk(lin(23, -0.05)), 22), up: tr(mk(lin(23, 0.5)), 22),
        atrBelow: tr(mk(lin(23, 0.21)), 22), atrAbove: tr(mk(lin(23, 0.22)), 22), noisy: tr(mk(Array.from({ length: 23 }, (_, i) => 100 + (i % 2 ? 3 : -3) - 0.3 * i)), 22),
        gap: tr(mk(lin(23, -0.5)).map((x, i) => (i === 18 ? { ...x, t: x.t + STEP } : x)), 22),
      };
    });
    check('Acht Vorgängerkerzen genügen: Abwärtstrend (R² 1, Bewegung 3,5 ≥ 0,75·ATR 2)', r.eight.dir === 'down' && Math.abs(r.eight.r2 - 1) < 1e-9 && Math.abs(r.eight.A - 2) < 1e-9, JSON.stringify(r.eight));
    check('Musterkerze und Zukunftskerzen fließen nicht ein (gleiches Ergebnis trotz extremer Musterkerze/Folgekerze)', JSON.stringify(r.eightSame) === JSON.stringify(r.eight));
    check('Sieben Vorgängerkerzen reichen nicht (fehlende Daten, kein Trend)', r.seven.dir === null && /weniger als 8/.test(r.seven.why), JSON.stringify(r.seven));
    check('Flach und zu kleine Bewegung bleiben neutral; Aufwärts erkannt', r.flat.dir === 'neutral' && r.small.dir === 'neutral' && r.up.dir === 'up', `${r.flat.dir}, ${r.small.dir} (Bewegung ${r.small.mv.toFixed(2)}), ${r.up.dir}`);
    check('ATR-Grenze: Bewegung 1,47 < 1,5 (0,75·ATR 2) neutral, 1,54 ≥ 1,5 Trend', r.atrBelow.dir === 'neutral' && r.atrAbove.dir === 'up', `${r.atrBelow.mv.toFixed(2)} → ${r.atrBelow.dir}, ${r.atrAbove.mv.toFixed(2)} → ${r.atrAbove.dir}`);
    check('Zickzack ohne klare Richtung (R² unter 0,35) bleibt neutral', r.noisy.dir === 'neutral' && r.noisy.r2 < 0.35, `R² ${r.noisy.r2.toFixed(2)}, Bewegung ${(r.noisy.mv / r.noisy.A).toFixed(2)} ATR`);
    check('Lücke vor dem Muster: kein Trend (fehlende Daten)', r.gap.dir === null && /Lücke/.test(r.gap.why), JSON.stringify(r.gap));
    check('keine Fehler (trend)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },

  async catalog(browser) {
    const { ctx, page, errors } = await openPage(browser);
    const r = await page.evaluate(`(() => { const B = (${BUILD.toString()})(), E = __g09.engine(), out = {};
      for (const [id, [dir, offs]] of Object.entries(B.C)) { const k = B.withPat(dir, offs), res = E.detect(k, { from: 25, step: B.STEP }).hits; out[id] = { hit: res.find(x => x.id === id && x.i1 === k.length - 1) || null, ids: [...new Set(res.filter(x => x.i1 >= 29).map(x => x.id))] }; }
      for (const [id, pts] of Object.entries(B.F)) { const k = B.path(pts), res = E.detect(k, { from: 15, step: B.STEP }).hits; out[id] = { hit: res.find(x => x.id === id) || null, ids: [...new Set(res.filter(x => x.kind === 'form').map(x => x.id))] }; }
      // acht Intervalle (Hammer), 1M mit echten Monatsanfängen
      const ivs = { '1m': 6e4, '5m': 3e5, '15m': 9e5, '1h': 36e5, '4h': 144e5, '1d': 864e5, '1w': 6048e5, '1M': 0 }, iv = {};
      for (const [n, st] of Object.entries(ivs)) { const times = st ? null : Array.from({ length: 31 }, (_, i) => Date.UTC(2020, i, 1)); const k = B.withPat('down', B.C.hammer[1], st || 36e5, times); iv[n] = !!E.detect(k, { from: 25, step: st }).hits.find(x => x.id === 'hammer'); }
      const lib = __g09.lib, svgs = Object.keys(lib).map(id => __g09.svg(id));
      return { out, iv, libN: Object.keys(lib).length, libOk: Object.values(lib).every(L => L.n && L.e && L.c && ['bull', 'bear', 'neutral'].includes(L.d)), svgN: new Set(svgs).size, svgExt: svgs.some(s => /<image|href=|https?:/.test(s)),
        dt: (() => { const k = B.path(B.F.double_top), x = E.detect(k, { from: 15, step: B.STEP }).hits.find(q => q.id === 'double_top'); return x && { st: x.status, lv: x.levels, q: x.q, rules: x.rules.map(r => [r.k, r.ok]) }; })(),
        hm: (() => { const k = B.withPat('down', B.C.hammer[1]), x = E.detect(k, { from: 25, step: B.STEP }).hits.find(q => q.id === 'hammer'); return x && { q: x.q, rules: x.rules.map(r => [r.k, r.w, r.ok]), st: x.status }; })(),
        gap: (() => { const k = B.withPat('down', B.C.morning_star[1]); return [!!E.detect(k, { from: 25, step: B.STEP }).hits.find(q => q.id === 'morning_star'), !!E.detect(k, { from: 25, step: B.STEP, gap: true }).hits.find(q => q.id === 'morning_star')]; })() }; })()`);
    const ids = Object.keys(r.out), cand = ids.filter(id => r.out[id].hit?.kind === 'candle'), form = ids.filter(id => r.out[id].hit?.kind === 'form'), miss = ids.filter(id => !r.out[id].hit);
    check('Bibliothek: 41 Einträge mit Name, Richtung, Erklärung, Bestätigungsregel und je eigenem Inline-SVG (keine externen Bilder)', r.libN === 41 && r.libOk && r.svgN === 41 && !r.svgExt, `${r.libN} Einträge, ${r.svgN} verschiedene SVG`);
    check('Alle 22 Kerzenmuster in ihren Katalogfällen erkannt (Umkehrmuster nur mit passendem Vortrend)', cand.length === 22, `fehlend: ${miss.filter(id => id in r.out && !(id in { double_top: 1 })).join(', ')} · gefunden: ${cand.length}`);
    check('Alle 19 Formationen in ihren Katalogfällen erkannt', form.length === 19, `fehlend: ${miss.join(', ')} · gefunden: ${form.length}`);
    check('Hammer nach Aufwärtstrend ist kein Hammer (sondern Hängender Mann)', !r.out.hanging_man.ids.includes('hammer') && r.out.hanging_man.ids.includes('hanging_man'), r.out.hanging_man.ids.join(','));
    check('Alle 8 Intervalle (1m … 1M, Monat mit echten Monatsanfängen)', Object.values(r.iv).every(Boolean), JSON.stringify(r.iv));
    check('Doppel-Top: Ausbruch per Schlusskurs bestätigt, Nackenlinie 90, rechnerisches Ziel 80, Invalidierung 100', r.dt && r.dt.st === 'Ausbruch bestätigt' && Math.abs(r.dt.lv.brk - 89.9) < 0.2 && Math.abs(r.dt.lv.tgt - 79.8) < 0.5 && Math.abs(r.dt.lv.inv - 100.1) < 0.2, JSON.stringify(r.dt));
    check('Regelgüte = erfüllte ÷ mögliche Gewichte, unbekannte Bestätigung im Nenner (Hammer an der letzten Kerze: < 100 %)', r.hm && r.hm.q < 100 && r.hm.rules.some(x => x[2] === null) && r.hm.st === 'Bestätigung offen', JSON.stringify(r.hm));
    check('Krypto-Variante Morgenstern ohne Gap erkannt; strenger Gap-Modus verlangt Gaps (hier keiner → nicht erkannt)', r.gap[0] === true && r.gap[1] === false, JSON.stringify(r.gap));
    check('keine Fehler (catalog)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },

  async ui(browser) {
    const { ctx, page, errors } = await openPage(browser);
    const t0 = Date.now();
    await page.evaluate(() => document.getElementById('chart').scrollIntoView()); await page.click('#pat-btn');
    await page.waitForFunction(() => __g09.pat.res && !__g09.pat.busy, null, { timeout: 10000 });
    const s = await page.evaluate(() => ({ open: document.getElementById('pat-sheet').open, scope: document.getElementById('pat-scope').textContent, worker: __g09.pat.viaWorker, minq: document.getElementById('pat-minq').value, rows: document.querySelectorAll('#pat-list .pat-row').length, note: document.querySelector('#pat-sheet .pat-note').textContent, pressed: document.getElementById('pat-btn').getAttribute('aria-pressed') }));
    check('„KI“ analysiert die sichtbaren Kerzen im Worker; Sheet nennt den Ausschnitt, Mindestregelgüte 60, Hinweis „keine Anlageberatung“', s.open && /^BTC\/USDT · 1m · 80 sichtbare Kerzen \(.+ UTC\)/.test(s.scope) && s.worker >= 1 && s.minq === '60' && /keine Anlageberatung/.test(s.note) && /keine Trefferquote/.test(s.note) && s.pressed === 'true', JSON.stringify(s));
    await page.selectOption('#pat-minq', '0'); await page.click('[data-pfil="bull"]'); await page.waitForTimeout(150);
    const bull = await page.evaluate(() => [...document.querySelectorAll('#pat-list .pat-row')].map(r => r.className));
    await page.click('[data-pfil="all"]'); await page.waitForTimeout(100);
    const all = await page.evaluate(() => ({ n: document.querySelectorAll('#pat-list .pat-row').length, dirs: [...document.querySelectorAll('#pat-list .pat-row')].map(r => r.className.split(' ')[1]) }));
    check('Filter Bullish zeigt nur bullishe Treffer; Alle zeigt alle (je Muster das jüngste Vorkommen)', bull.length > 0 && bull.every(c => / bull/.test(c)) && all.n > bull.length, JSON.stringify({ bull: bull.length, all }));
    await page.selectOption('#pat-minq', '80'); await page.waitForTimeout(100);
    await page.evaluate(() => { __g09.pat.minQ = 101; }); await page.click('[data-pfil="all"]'); await page.waitForTimeout(100);
    check('Leerzustand: „Aktuell keine eindeutige Formation erkannt“', /^Aktuell keine eindeutige Formation erkannt/.test(await page.textContent('#pat-list')), await page.textContent('#pat-list'));
    await page.evaluate(() => { __g09.pat.minQ = 0; document.getElementById('pat-minq').value = '0'; }); await page.click('[data-pfil="all"]'); await page.waitForTimeout(100);
    await page.click('#pat-list .pat-row .pat-i');
    const info = await page.evaluate(() => { const b = document.getElementById('pat-info-body'), i = __g09.pat.info, hit = __g09.pat.res.hits[i]; return { open: document.getElementById('pat-info').open, title: document.getElementById('pat-info-title').textContent, svg: !!b.querySelector('svg.pat-svg'), li: b.querySelectorAll('.pat-why li').length, rules: hit.rules.length, why: b.querySelector('.pat-why summary').textContent, q: hit.q, conf: /Bestätigung:/.test(b.textContent), vals: b.querySelectorAll('.pat-vals .pat-kv').length, html: /<script|onerror/i.test(b.innerHTML) }; });
    check('Info-Sheet: Name, eigenes SVG, gemessene Werte, Bestätigung, „Warum X %?“ mit allen Regeln; nur Text (kein fremdes HTML)', info.open && info.svg && info.li === info.rules && info.why === `Warum ${info.q} %?` && info.conf && info.vals >= 1 && !info.html, JSON.stringify(info));
    const v0 = await page.evaluate(() => [__g05.state.count, __g05.state.pan]);
    await page.click('#pat-info-zoom'); await page.waitForTimeout(500);
    const z = await page.evaluate(() => { const h = __g09.pat.res.hits[__g09.pat.sel], c = __g05.state.candles, len = c.length, end = len - __g05.state.pan, start = end - Math.min(__g05.state.count, len), a = c.findIndex(x => x.time === h.t0), b = c.findIndex(x => x.time === h.t1); return { sel: __g09.pat.sel, inView: a >= start && b < end, hl: !!document.querySelector('#chart .pat-hl'), dialogs: document.getElementById('pat-info').open || document.getElementById('pat-sheet').open }; });
    check('„Im Chart zeigen“: Dialoge zu, Ausschnitt bewusst um das Muster, Muster hervorgehoben', z.sel !== null && z.inView && z.hl && !z.dialogs, JSON.stringify({ z, v0 }));
    const c1 = await page.evaluate(() => __g05.state.count); await page.click('#zoom-out'); await page.waitForTimeout(300);
    check('Chart danach frei bedienbar (Herauszoomen wirkt)', (await page.evaluate(() => __g05.state.count)) > c1, `${c1} → ${await page.evaluate(() => __g05.state.count)}`);
    const lab = await page.$('#chart [data-pat]');
    if (lab) { await lab.click({ force: true }); await page.waitForTimeout(300); }
    check('Chart-Label (mit ⓘ) öffnet das Info-Sheet', !!lab && await page.evaluate(() => document.getElementById('pat-info').open) && /ⓘ$/.test(await lab.textContent()), lab ? await lab.textContent() : 'kein Label');
    await page.evaluate(() => document.getElementById('pat-info').close());
    await page.click('.chart-toolbar [data-interval="5m"]'); await page.waitForTimeout(80);
    const cleared = await page.evaluate(() => !__g09.pat.res || __g09.pat.res.key.endsWith('|5m'));
    await page.waitForFunction(() => __g09.pat.res?.key.endsWith('|5m'), null, { timeout: 15000 }).catch(() => {});
    check('Intervallwechsel entfernt alte Treffer sofort; bei eingeschaltetem „KI“ neu für 5m berechnet', cleared && await page.evaluate(() => !!__g09.pat.res?.key.endsWith('|5m')), await page.evaluate(() => __g09.pat.res?.key));
    const hosts = [...new Set((await h.ctl(`/log?since=${t0}`)).map(e => e.host))];
    check('Keine externe KI, keine fremden Bilder: nur Binance-Abrufe seit dem Tipp', hosts.every(x => /binance/.test(x)), hosts.join(', '));
    await page.click('#chart-full'); await page.waitForTimeout(400);
    check('„KI“ auch im Vollbild in der Chart-Leiste', await page.evaluate(() => { const b = document.getElementById('pat-btn'), r = b.getBoundingClientRect(); return document.documentElement.hasAttribute('data-chartfull') && !!b.closest('.chart-toolbar') && (r.width > 0 || document.documentElement.dataset.chartbar !== 'open'); }));
    check('keine Fehler (ui)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },
};
(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(tests);
  await h.setup(); await h.ctl('/reset');
  const browser = await h.launch();
  try { for (const n of names) { console.log(`▶ ${n}`); await h.ctl('/reset'); try { await tests[n](browser); } catch (e) { check(`${n}: Abbruch`, false, e.message.split('\n')[0]); } } }
  finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
