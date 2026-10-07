// G09 der Übergabe (3.37.0): regelbasierte Mustererkennung („KI“) – Engine, 41 Katalogfälle, Vortrend (Revision 2), 8 Intervalle,
// Panel, Info-Sheet, Chart-Markierung, Kontextwechsel, keine externen Abrufe.
// Aufruf: node m58.js [abschnitt ...]   Abschnitte: trend, catalog, ui, wl, know, sync, pub
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + String(detail).slice(0, 700) : ''}`); };
const real = errs => errs.filter(e => !/Service Worker registration blocked|Failed to load resource|net::ERR/.test(e));
async function openPage(browser, viewport = { width: 1440, height: 1000 }, opts = {}) {
  const ctx = await browser.newContext({ viewport, timezoneId: 'Europe/Berlin', ...opts }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
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
    const selTxt = await page.evaluate(() => document.querySelector('#chart .pat-label.sel')?.firstChild?.textContent || ''), nMk = await page.evaluate(() => document.querySelectorAll('#chart .pat-mk').length);
    const lab = await page.$('#chart .pat-mk');
    if (lab) { await lab.click({ force: true }); await page.waitForTimeout(300); }
    check('Chart: ausgewähltes Muster mit Namen und ⓘ, übrige als kleine Zeichen (▲ ▼ ◆); Antippen eines Zeichens öffnet das Info-Sheet', /ⓘ$/.test(selTxt) && nMk >= 1 && !!lab && await page.evaluate(() => document.getElementById('pat-info').open), JSON.stringify({ selTxt, nMk }));
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
  async wl(browser) {
    const { ctx, page, errors } = await openPage(browser);
    // Erkennung auf den Kerzen einer Vorauswahl-Kachel (Doppel-Boden mit Ausbruch in den letzten 30 Kerzen)
    const u = await page.evaluate(`(() => { const B = (${BUILD.toString()})(), k = B.path([[0, 110], [30, 112], [45, 100], [55, 110], [65, 100], [75, 116]]);
      const e = { iv: '1h', closed: k.map(c => ({ time: c.t, open: c.o, high: c.h, low: c.l, close: c.c, volume: c.v })) }; return __g09.wlPat(e); })()`);
    check('Vorauswahl erkennt die jüngste Formation auf den Kachel-Kerzen (Doppel-Boden, Regelgüte ≥ 60 %)', u && u.id === 'double_bottom' && u.q >= 60, JSON.stringify(u));
    await page.click('.wl-tile[data-watch="ETC"]'); await page.waitForTimeout(2500);
    const prep = await page.evaluate(() => { const e = __g09.wl.c.get('ETCUSDT'), c = e.closed; e.pat = { id: 'double_bottom', q: 75, status: 'in Bildung (Ausbruch fehlt)', dir: 'bull', t0: c.at(-40).time, t1: c.at(-20).time }; __g09.wldPaint(); const b = document.querySelector('.wl-d-pat'); return { iv: e.iv, t0: e.pat.t0, t1: e.pat.t1, vis: !!b && !b.hidden && !b.disabled, txt: b?.textContent }; });
    check('Detailfeld zeigt „Chartmuster erkannt“ mit Name, Intervall, Status und Regelgüte', prep.vis && prep.txt === `📐 Chartmuster erkannt: Doppel-Boden · ${prep.iv} · in Bildung (Ausbruch fehlt) · Regelgüte 75 % – im Chart zeigen`, prep.txt);
    await page.click('.wl-d-pat');
    await page.waitForFunction(iv => __g05.state.symbol === 'ETCUSDT' && __g05.state.interval === iv && __g05.state.loadedSymbol === 'ETCUSDT' && !__g09.pat.want && !!__g09.pat.res, prep.iv, { timeout: 15000 }).catch(() => {});
    const toast = await page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent).find(t => /Doppel-Boden/.test(t)) || '');
    const v = await page.evaluate(([t0, t1]) => { const c = __g05.state.candles, len = c.length, end = len - __g05.state.pan, start = end - Math.min(__g05.state.count, len), a = c.findIndex(x => x.time === t0), b = c.findIndex(x => x.time === t1); return { tab: document.documentElement.dataset.activeTab, inView: a >= start && b < end, on: __g09.pat.on, key: __g09.pat.res?.key }; }, [prep.t0, prep.t1]);
    check('Antippen öffnet ausdrücklich den Chart: Coin und Intervall geladen, Ausschnitt um die Formation, „KI“ an; Meldung sagt ehrlich, ob die Formation dort markiert ist', v.tab === 'chart' && v.inView && v.on && /ETCUSDT\|spot\|/.test(v.key || '') && /Doppel-Boden (· .+ – im Chart markiert|ist im Chart-Ausschnitt nicht mehr eindeutig erkennbar)/.test(toast), JSON.stringify({ v, toast }));
    check('keine Fehler (wl)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },
  async know(browser) {
    // Beschädigter Bestand → Quarantäne statt Löschen
    const ctx0 = await browser.newContext(); await ctx0.addInitScript(() => { if (!sessionStorage.getItem('s58')) { sessionStorage.setItem('s58', '1'); localStorage.setItem('scalpdesk.patknow.v1', '{kaputt'); } });
    const p0 = await ctx0.newPage(); await p0.goto(`${h.URL_BASE}/weather-widget-v2.html`); await p0.waitForTimeout(1500);
    const q = await p0.evaluate(() => ({ q: localStorage.getItem('scalpdesk.patknow.quarantine.v1'), flag: __g09.pk.quarantined, n: Object.keys(__g09.pk.cases).length }));
    check('Fehlerhafter Wissensbestand wird in Quarantäne gelegt (Rohdaten erhalten), die App läuft mit leerem Bestand weiter', q.q === '{kaputt' && q.flag === true && q.n === 0, JSON.stringify(q)); await ctx0.close();
    const { ctx, page, errors } = await openPage(browser);
    await page.evaluate(() => document.getElementById('chart').scrollIntoView()); await page.click('#pat-btn');
    await page.waitForFunction(() => __g09.pat.res && !__g09.pat.busy, null, { timeout: 10000 });
    const rec = await page.evaluate(() => { const cs = Object.values(__g09.pk.cases); return { n: cs.length, sep: !!localStorage.getItem('scalpdesk.patknow.v1'), ok: cs.every(c => c.id === __g09.pkId(c) && c.model === 'pat-1' && c.profile === 'H12-e0.10' && ['live', 'rekonstruiert'].includes(c.src) && c.dir !== 'neutral' && Number.isFinite(c.p0) && Array.isArray(c.rules)), srcs: [...new Set(cs.map(c => c.src))], res: cs.filter(c => c.res).length }; });
    check('Bestätigte Muster werden als Fälle gespeichert (stabile ID, Modell, Profil, Regeln, Prognose, Quelle live/rekonstruiert), eigener Schlüssel; Ergebnisse nach 12 Kerzen angehängt', rec.n >= 1 && rec.sep && rec.ok && rec.res >= 1, JSON.stringify(rec));
    // Zurücksetzen (Handelsdaten) und Neuladen: Wissen bleibt; nicht in der persönlichen Sicherung
    const n0 = rec.n;
    await page.evaluate(() => { document.querySelector('#reset-go').click(); }).catch(() => {});
    await page.reload(); await page.waitForTimeout(1500);
    const after = await page.evaluate(() => ({ n: Object.keys(__g09.pk.cases).length }));
    check('„Zurücksetzen“ und Neuladen löschen das Musterwissen nicht', after.n === n0, `${n0} → ${after.n}`);
    // Import zweimal: zählt einmal; Ergebnis nur angehängt, Prognose unverändert; Konflikt gezählt; negative Fälle bleiben
    const imp = await page.evaluate(() => {
      const mk = (i, out, r, src = 'live') => { const c = { mkt: 'spot', sym: 'TESTUSDT', iv: '1h', pat: 'double_bottom', kind: 'form', dir: 'bull', t0: 1e12 + i * 1e7, t1: 1e12 + i * 1e7 + 5e6, tc: 1e12 + i * 1e7 + 6e6, p0: 100, model: 'pat-1', profile: 'H12-e0.10', q: 80, at: 1, src, rules: [], res: out ? { at: 1, tH: 2, ph: 100 + r, r, out, path: Array.from({ length: 13 }, (_, j) => +(r * j / 12).toFixed(4)) } : null }; c.id = __g09.pkId(c); return c; };
      const list = [mk(1, 'auf', 2), mk(2, 'auf', 1), mk(3, 'ab', -1.5), mk(4, 'seitwärts', 0.05), mk(5, 'auf', 3, 'rekonstruiert'), mk(6, null)];
      const a = __g09.pkMerge(list), b = __g09.pkMerge(list);
      const open6 = mk(6, 'ab', -2), c1 = __g09.pkMerge([open6]), conf = __g09.pkMerge([{ ...mk(1, 'ab', -3), dir: 'bear' }]);
      const st = __g09.pkStats({ mkt: 'spot', sym: 'TESTUSDT', iv: '1h', pat: 'double_bottom' }), band = __g09.pkBand(st.live.paths);
      return { a, b, c1, conf, dir1: __g09.pk.cases[mk(1).id].dir, out1: __g09.pk.cases[mk(1).id].res.out, st: { live: { n: st.live.n, auf: st.live.auf, ab: st.live.ab, sw: st.live.seitwärts, offen: st.live.offen, k: st.live.konflikt }, rek: { n: st.rek.n } }, med12: band.med[12], p25: band.p25[12], p75: band.p75[12], rep: band.rep.res.r, neg: band.neg.res.out };
    });
    check('Doppelter Import zählt nicht doppelt; fehlendes Ergebnis wird angehängt; abweichendes Ergebnis ändert nichts (Konflikt gezählt), Prognose bleibt', imp.a.added === 6 && imp.b.added === 0 && imp.c1.results === 1 && imp.conf.conflicts === 1 && imp.dir1 === 'bull' && imp.out1 === 'auf', JSON.stringify(imp));
    check('Kursrichtungsstatistik nur vergleichbarer Fälle, live und rekonstruiert getrennt; negative Fälle zählen mit', imp.st.live.n === 5 && imp.st.live.auf === 2 && imp.st.live.ab === 2 && imp.st.live.sw === 1 && imp.st.live.offen === 0 && imp.st.live.k === 1 && imp.st.rek.n === 1, JSON.stringify(imp.st));
    check('Median und 25–75-%-Band nach 12 Kerzen; repräsentativer Fall = geringste Abweichung vom Median; Gegenbeispiel nicht aufwärts', Math.abs(imp.med12 - 0.05) < 1e-9 && imp.p25 < imp.med12 && imp.p75 > imp.med12 && imp.rep === 0.05 && imp.neg !== 'auf', JSON.stringify({ med: imp.med12, p25: imp.p25, p75: imp.p75, rep: imp.rep, neg: imp.neg }));
    // Info-Sheet: „Vergangene Verläufe ansehen“ für die aktuelle Auswahl
    await page.evaluate(() => document.getElementById('chart').scrollIntoView()); await page.click('#pat-btn');
    await page.waitForFunction(() => __g09.pat.res && !__g09.pat.busy, null, { timeout: 10000 });
    await page.evaluate(() => { __g09.pat.minQ = 0; document.getElementById('pat-minq').value = '0'; document.querySelector('[data-pfil="all"]').click(); });
    const sel = await page.evaluate(() => { const i = __g09.pat.res.hits.indexOf(__g09.pat.res.hits.find(x => x.kind === 'form') || __g09.pat.res.hits[0]), h = __g09.pat.res.hits[i];
      const mk = (j, out, r) => { const c = { mkt: 'spot', sym: __g05.state.symbol, iv: __g05.state.interval, pat: h.id, kind: h.kind, dir: 'bull', t0: 2e12 + j, t1: 2e12 + j + 1, tc: 2e12 + j + 2, p0: 100, model: 'pat-1', profile: 'H12-e0.10', q: 70, at: 1, src: 'live', rules: [], res: { at: 1, tH: 1, ph: 100 + r, r, out, path: Array.from({ length: 13 }, (_, k) => +(r * k / 12).toFixed(4)) } }; c.id = __g09.pkId(c); return c; };
      __g09.pkMerge([mk(1, 'auf', 1), mk(2, 'ab', -1), mk(3, 'auf', 2)]); __g09.info(i); return i; });
    await page.click('.pk-btn'); await page.waitForTimeout(200);
    const pkTxt = await page.evaluate(() => ({ t: document.querySelector('.pk-out').textContent, svg: !!document.querySelector('.pk-out svg.pk-svg') }));
    check('„Vergangene Verläufe ansehen“: „X von N aufwärts, Y abwärts, Z seitwärts“, Median/Band (kein Prognoseintervall), echter Einzelfall mit Datum, Abdeckung „Chart: X von N“, Speicherzustand „nur lokal“', /Live protokolliert: \d+ von \d+ aufwärts, \d+ abwärts, \d+ seitwärts/.test(pkTxt.t) && pkTxt.svg && /kein Prognoseintervall/.test(pkTxt.t) && /Chart: \d+ von \d+ Fällen/.test(pkTxt.t) && /Repräsentativer Fall .+ UTC, Binance Spot/.test(pkTxt.t) && /nur lokal/.test(pkTxt.t) && /Kursrichtung ≠ Zieltreffer/.test(pkTxt.t), pkTxt.t.slice(0, 400));
    // volle Warteschlange: neues Lernen stoppt mit Hinweis, nichts wird gelöscht
    const full = await page.evaluate(() => { const n = Object.keys(__g09.pk.cases).length; __g09.pk.full = true; __g09.run('Test'); return new Promise(r => setTimeout(() => r({ n, m: Object.keys(__g09.pk.cases).length }), 800)); });
    check('Volle Lern-Warteschlange: keine neuen Fälle, keine gelöschten', full.m === full.n, JSON.stringify(full));
    check('keine Fehler (know)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },
  async sync(browser) {
    // G09 C4: Fälle zusätzlich im Muster-Archiv des 24/7-Dienstes (eigener HTTPS-Weg, kein Sicherungsbot); Dienst hier abgefangen
    const { ctx, page, errors } = await openPage(browser);
    let bodies = [], mode = 'ok';
    await page.route('https://svc.test/v1/patterns/cases', async route => {
      const b = JSON.parse(route.request().postData() || '{}'); bodies.push({ auth: route.request().headers().authorization, b });
      if (mode === 'ok') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, count: b.cases.length, stored: b.cases.length, results: 0, dup: 0, conflicts: 0, rejected: 0, backup: { ok: true, at: Date.now() + 5000, why: '' } }) });
      return route.fulfill({ status: 503, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: false, error: 'Muster-Archiv nicht eingerichtet (kein Zustandsordner).' }) });
    });
    const run = async () => page.evaluate(async () => { const keep = { ...__g05.svc.cfg }; __g05.svc.cfg = { ...keep, url: 'https://svc.test', key: 'k'.repeat(40) }; await __g09.pkSync(); await new Promise(r => setTimeout(r, 1800)); await __g09.pkSync(); __g05.svc.cfg = keep; });
    await page.evaluate(() => { const mk = (i, out) => { const c = { mkt: 'spot', sym: 'SYNCUSDT', iv: '1h', pat: 'double_top', kind: 'form', dir: 'bear', t0: 3e12 + i * 1e7, t1: 3e12 + i * 1e7 + 5e6, tc: 3e12 + i * 1e7 + 6e6, p0: 50, model: 'pat-1', profile: 'H12-e0.10', q: 70, at: Date.now(), src: 'live', rules: [['Regel', 2, true]], res: out ? { at: 1, tH: 2, ph: 49, r: -2, out, path: [0, -2] } : null }; c.id = __g09.pkId(c); return c; };
      __g09.pkMerge(Array.from({ length: 30 }, (_, i) => mk(i, i % 3 ? null : 'ab'))); });
    mode = 'fail'; await run();
    const f = await page.evaluate(() => ({ err: __g09.pk.extErr, open: Object.values(__g09.pk.cases).filter(c => c.sym === 'SYNCUSDT' && !c.ext).length, st: __g09.pkState(Object.values(__g09.pk.cases).find(c => c.sym === 'SYNCUSDT')) }));
    check('Dienst ohne Archiv (503): Fälle bleiben „nur lokal“, Grund wird gemerkt, nichts geht verloren', /nicht eingerichtet/.test(f.err) && f.open === 30 && f.st === 'nur lokal', JSON.stringify(f));
    mode = 'ok'; bodies = []; await run();
    const s = await page.evaluate(() => { const cs = Object.values(__g09.pk.cases).filter(c => c.sym === 'SYNCUSDT'); return { ext: cs.filter(c => c.ext).length, extRes: cs.filter(c => c.res && c.extRes).length, withRes: cs.filter(c => c.res).length, st: __g09.pkState(cs[0]), err: __g09.pk.extErr }; });
    const keys = new Set(bodies.flatMap(x => x.b.cases.flatMap(c => Object.keys(c))));
    check('Mit Archiv: in Paketen zu höchstens 25 Fällen mit Schlüssel übertragen, Fälle und Ergebnisse als übertragen markiert', bodies.length >= 2 && bodies.every(x => x.b.cases.length <= 25 && x.auth === `Bearer ${'k'.repeat(40)}`) && s.ext >= 30 && s.extRes === s.withRes && !s.err, JSON.stringify({ n: bodies.map(x => x.b.cases.length), s }));
    check('Nur Marktdaten des Falls werden gesendet (keine Trades, Positionen, Notizen oder Zugänge)', [...keys].every(k => ['id', 'mkt', 'sym', 'iv', 'pat', 'kind', 'dir', 't0', 't1', 'tc', 'p0', 'model', 'profile', 'q', 'at', 'src', 'rules', 'res', 'ext', 'extRes'].includes(k)), [...keys].join(','));
    check('Speicherzustand nach geprüfter Sicherung am Dienst: „zusätzlich gesichert“', s.st === 'zusätzlich gesichert', s.st);
    // unabhängige Kopie auf dem Gerät: bereinigter Bestand als Datei
    await page.route('https://svc.test/v1/patterns/export', route => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, v: '2.1.0', at: Date.now(), cases: [{ id: 'x' }, { id: 'y' }] }) }));
    await page.evaluate(() => { __g05.svc.cfg = { ...__g05.svc.cfg, url: 'https://svc.test', key: 'k'.repeat(40) }; document.getElementById('chart').scrollIntoView(); });
    await page.click('#pat-btn'); await page.waitForFunction(() => __g09.pat.res && !__g09.pat.busy, null, { timeout: 10000 });
    await page.evaluate(() => __g09.info(0));
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }).catch(() => null), page.click('text=Archiv vom Dienst als Datei sichern')]);
    const fileOk = dl && /^muster-archiv-\d{4}-\d\d-\d\d\.json$/.test(dl.suggestedFilename()) && JSON.parse(require('fs').readFileSync(await dl.path(), 'utf8')).cases.length === 2;
    await page.evaluate(() => { __g05.svc.cfg = { ...__g05.svc.cfg, url: '', key: '' }; });
    check('„Archiv vom Dienst als Datei sichern“: bereinigter Bestand als Datei auf dem Gerät (unabhängige Kopie)', !!fileOk, dl ? dl.suggestedFilename() : 'kein Download');
    check('keine Fehler (sync)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },  async pub(browser) {
    // G09 C5: veröffentlichter Stand (data/muster/ auf GitHub Pages) – nur lesen, kein Schreibschlüssel; ohne Veröffentlichung ehrlich „noch keine“
    const X = await import(require('path').join(__dirname, '..', 'server/muster-export.mjs'));
    const { ctx, page, errors } = await openPage(browser, undefined, { serviceWorkers: 'block' });   // sonst holt der Service Worker selbst (am Abfangen vorbei)
    const reqs = []; let pubBody = null, stats = {};
    await page.route('**/data/muster/*', route => { const r = route.request(), n = r.url().split('/').pop(); reqs.push({ m: r.method(), n, auth: r.headers().authorization || '' });
      if (n === 'manifest.json' && pubBody) return route.fulfill({ status: 200, contentType: 'application/json', body: pubBody });
      if (stats[n]) return route.fulfill({ status: 200, contentType: 'application/json', body: stats[n] });
      return route.fulfill({ status: 404, contentType: 'text/html', body: 'Not Found' }); });
    await page.evaluate(() => document.getElementById('chart').scrollIntoView()); await page.click('#pat-btn');
    await page.waitForFunction(() => __g09.pat.res && !__g09.pat.busy, null, { timeout: 10000 });
    await page.evaluate(() => { __g09.pat.minQ = 0; document.getElementById('pat-minq').value = '0'; document.querySelector('[data-pfil="all"]').click(); });
    const sel = await page.evaluate(() => { const i = __g09.pat.res.hits.indexOf(__g09.pat.res.hits.find(x => x.kind === 'form') || __g09.pat.res.hits[0]), h = __g09.pat.res.hits[i]; __g09.info(i); return { i, mkt: 'spot', sym: __g05.state.symbol, iv: __g05.state.interval, pat: h.id, kind: h.kind }; });
    await page.click('.pk-btn');
    await page.waitForFunction(() => /noch keine Veröffentlichung/.test(document.querySelector('.pk-out')?.textContent || ''), null, { timeout: 5000 }).catch(() => {});
    const t0 = await page.evaluate(() => document.querySelector('.pk-out').textContent);
    check('Ohne Veröffentlichung: „Gemeinsames Musterwissen: noch keine Veröffentlichung“', /Gemeinsames Musterwissen: noch keine Veröffentlichung/.test(t0), t0.slice(-300));
    // Veröffentlichung mit dem echten Export-Skript erzeugen (Revision 3), dann neu laden
    const mk = (j, out, src = 'live') => ({ id: `p${j}`, ...sel, dir: 'bull', t0: 2e12 + j, t1: 2e12 + j + 1, tc: 2e12 + j * 1e6, p0: 100, model: 'pat-1', profile: 'H12-e0.10', q: 70, at: 1, src, res: out ? { at: 1, tH: 1, ph: 101, r: 1, out, path: [0, 1] } : null });
    const pubd = X.buildPublication({ cases: [mk(1, 'auf'), mk(2, 'auf'), mk(3, 'ab'), mk(4, 'seitwärts', 'rekonstruiert'), mk(5, null)] }, { rev: 2 }, Date.UTC(2033, 4, 6));
    pubBody = pubd.mBody; for (const f of pubd.files) stats[f.name] = f.body;
    await page.evaluate(() => __g09.pubLoad(true));
    await page.click('.pk-btn'); await page.click('.pk-btn');
    await page.waitForFunction(() => /Revision 3.*(live:|nichts)/.test(document.querySelector('.pk-pub')?.textContent || ''), null, { timeout: 5000 }).catch(() => {});
    const t1 = await page.evaluate(() => document.querySelector('.pk-pub')?.textContent || '');
    check('Veröffentlichter Stand mit Revision und Datum, Zählung der Auswahl live und rekonstruiert getrennt', /Veröffentlicht: Revision 3 vom 06\.05\.2033/.test(t1) && /live: 2 von 3 aufwärts, 1 abwärts, 0 seitwärts/.test(t1) && /rekonstruiert: 0 von 1 aufwärts, 0 abwärts, 1 seitwärts/.test(t1), t1);
    const st = await page.evaluate(m => { const c = { mkt: 'spot', sym: 'PUBUSDT', iv: '1h', pat: 'double_top', tc: 2e12, at: 1, ext: 1 }; return { pub: __g09.pkState(c), later: __g09.pkState({ ...c, tc: m.until + 1 }), local: __g09.pkState({ ...c, ext: 0 }) }; }, pubd.manifest);
    check('Speicherzustand „veröffentlicht“ für übertragene Fälle bis zum Stand der Revision; jüngere bleiben „extern gespeichert“, lokale „nur lokal“', st.pub === 'veröffentlicht' && st.later === 'extern gespeichert' && st.local === 'nur lokal', JSON.stringify(st));
    check('Nur lesend: ausschließlich GET auf data/muster/ (Manifest, eine Statistikdatei), ohne Schlüssel', reqs.length >= 2 && reqs.every(r => r.m === 'GET' && !r.auth) && reqs.some(r => r.n === 'stats-1.json'), JSON.stringify(reqs));
    check('keine Fehler (pub)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
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
