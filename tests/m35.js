// 3.22.0 – Schritt 4.3: Volatilität und Richtung nach Uhrzeit. Attrappe mit Tagesmuster (lebhaft 14–16 Uhr UTC, Wochenende
// halb so viel), Ortszeit Europe/Berlin. Geprüft: Platz unter den News und vor der Signal-Übersicht (Computer, Tablet, Handy),
// Stand und Menge der Daten, Muster in den Säulen, Wochenende, Stunde antippen/Pfeiltasten/zurück, Richtung nur bei echter
// Tendenz und nur nach Gebühren (Gebühr im Rechner hoch → ▲ weg), Warnstufen in der Live-Leiste (erhöht, stark erhöht, aus,
// gespeichert), Warnung antippen, Handy: beide Warnungen in einer Zeile, nichts ragt heraus, keine Sprünge beim Neuzeichnen und
// beim Erscheinen der Warnung (Chrome und iPhone-Safari), Coinwechsel. Aufruf: node m35.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const TZ = 'Europe/Berlin';
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
const ready = page => page.waitForFunction(() => /Tage/.test(document.getElementById('vola-src').textContent) && /%/.test(document.getElementById('vola-now').textContent), null, { timeout: 40000 }).catch(() => {});
const asSafari = () => { Object.defineProperty(Navigator.prototype, 'vendor', { get: () => 'Apple Computer, Inc.', configurable: true }); };
const info = page => page.evaluate(() => {
  const q = id => document.getElementById(id), bars = [...document.querySelectorAll('#vola-bars .vb')];
  return { src: q('vola-src').textContent, sel: q('vola-sel-t').textContent, med: q('vola-med').textContent, p90: q('vola-p90').textContent, dir: q('vola-dir').textContent,
    now: q('vola-now').textContent, badge: q('vola-badge').textContent, level: q('vola-nowbox').dataset.level, back: !q('vola-back').hidden,
    chip: q('lb-vola').hidden ? '' : q('lb-vola').innerText, strong: q('lb-vola').classList.contains('strong'), title: q('lb-vola').title, n: bars.length,
    heights: bars.map(g => parseFloat(g.children[1].style.height) || 0), arrows: bars.map((g, i) => g.children[2].textContent ? `${i}${g.children[2].textContent}` : '').filter(Boolean),
    sel_: bars.findIndex(g => g.classList.contains('sel')), now_: bars.findIndex(g => g.classList.contains('now')), days: [...document.querySelectorAll('[data-vday]')].map(b => b.getAttribute('aria-pressed')).join(',') };
});
const berlin = (o, d = new Date()) => new Intl.DateTimeFormat('en-GB', { ...o, timeZone: TZ }).format(d);
const nowH = () => Number(berlin({ hour: 'numeric', hourCycle: 'h23' })), isWeekend = () => ['Sat', 'Sun'].includes(berlin({ weekday: 'short' }));
// Minutengrenze meiden (Dochte sollen in derselben 1m-Kerze bleiben, die gerade läuft)
const safeSecond = async () => { while (new Date().getSeconds() > 30 || new Date().getSeconds() < 3) await h.sleep(500); };
const localHour = (utcH, dayOffset = 0) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - dayOffset); d.setUTCHours(utcH, 30, 0, 0); return Number(berlin({ hour: 'numeric', hourCycle: 'h23' }, d)); };
// Spanne der letzten 60 Minuten gezielt setzen: 1m-Kerzen wie die App lesen, dann oben und unten je einen Docht so setzen, dass
// Hoch bis Tief genau `pct` % der Eröffnung am Fensteranfang sind (der Kurs springt dabei nicht)
async function setRange(page, pct, sym = 'BTCUSDT') {
  await h.ctl('/walk?on=0');
  if (new Date().getSeconds() > 45 || new Date().getSeconds() < 3) await safeSecond();
  const k = await page.evaluate(async sym => (await (await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=1m&limit=61`)).json()).map(r => [+r[1], +r[2], +r[3]]), sym);
  const open0 = k[0][0], hi = Math.max(...k.map(r => r[1])), lo = Math.min(...k.map(r => r[2])), mid = (hi + lo) / 2, half = pct / 100 * open0 / 2;
  // Dochte eines früheren Aufrufs liegen noch im Fenster: eine Minute später bezieht sich dieselbe Spanne auf eine andere
  // Eröffnung (z. B. 5,01 statt 5,00 %) – bis 0,1 Prozentpunkte darüber gilt das als „etwa pct“, erst mehr ist ein Abbruch
  if (half * 2 < hi - lo - open0 * 0.001) throw new Error(`natürliche Spanne ${((hi - lo) / open0 * 100).toFixed(2)} % schon größer als ${pct} %`);
  const dp = open0 < 10 ? 5 : 2; await h.ctl(`/wick?symbol=${sym}&to=${(mid + half).toFixed(dp)}`); await h.ctl(`/wick?symbol=${sym}&to=${(mid - half).toFixed(dp)}`);
  return { natural: +((hi - lo) / open0 * 100).toFixed(2) };
}
const waitChip = (page, re, ms = 15000) => page.waitForFunction(re => { const c = document.getElementById('lb-vola'); return !c.hidden && new RegExp(re).test(c.innerText); }, re.source, { timeout: ms }).then(() => true).catch(() => false);
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset');
  const browser = await h.launch();
  try {
    // ---- Computer: Muster (Tagesverlauf) ----
    await h.ctl('/vola?mode=pattern');
    let ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: TZ }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page); await ready(page);
    const ord = await page.evaluate(() => { const y = id => { const r = document.getElementById(id).getBoundingClientRect(); return { t: Math.round(r.top + scrollY), b: Math.round(r.bottom + scrollY) }; }; return { cnews: y('cnews'), vola: y('vola'), signals: y('signals') }; });
    check('Computer: Übersicht unter den News zum Coin, vor der Signal-Übersicht', ord.vola.t >= ord.cnews.b - 1 && ord.signals.t >= ord.vola.b - 1, JSON.stringify(ord));
    let d = await info(page);
    check('Daten: rund 83 Tage, 1.999 abgeschlossene Stundenkerzen, Stand mit Uhrzeit', /^8[23] Tage · 1\.999 Stunden · Stand \d\d:\d\d$/.test(d.src), d.src);
    const hh = d.heights, peak = hh.indexOf(Math.max(...hh)), hot = [localHour(14), localHour(15)], quiet = localHour(3);
    check('Säulen: 24 Stunden, am höchsten nachmittags (14–16 Uhr UTC = Ortszeit ' + hot.join('/') + ' Uhr), nachts höchstens halb so hoch', d.n === 24 && hot.includes(peak) && hh[quiet] < hh[peak] * 0.45, `Spitze ${peak} Uhr, ${hh[peak]} % Höhe, nachts ${hh[quiet]} %`);
    let H = nowH();
    check('Aktuelle Stunde markiert und gewählt, Zeile „(jetzt)“, kein Zurück-Knopf', d.now_ === H && d.sel_ === H && new RegExp(`^${H}–${(H + 1) % 24} Uhr \\(jetzt\\) · (Mo–Fr|Sa–So) · \\d+ Std\\.$`).test(d.sel) && !d.back, `${d.sel} · Säule ${d.sel_}`);
    check('Richtung ohne echte Tendenz: keine Pfeile, „keine nachweisbare Tendenz“ ohne Zahl', !d.arrows.length && d.dir === 'keine nachweisbare Tendenz', d.dir);
    // Stunde antippen: Spitzenstunde am Werktag, dann Wochenende (halb so viel), dann zurück
    await page.evaluate(() => document.getElementById('vola').scrollIntoView({ block: 'center' })); await page.waitForTimeout(300);
    const weekend = isWeekend(), hSel = peak === nowH() ? (peak + 23) % 24 : peak; // nicht die aktuelle Stunde (die hat keinen Zurück-Knopf)
    if (weekend) { await page.click('[data-vday="wd"]'); await page.waitForTimeout(300); }
    await page.click(`#vola-bars .vb[data-h="${hSel}"]`); await page.waitForTimeout(400);
    const wdSel = await info(page);
    await page.click('[data-vday="we"]'); await page.waitForTimeout(400);
    const weSel = await info(page), num = s => parseFloat(s.replace(',', '.'));
    check('Säule antippen: Stunde, Tagesart und Anzahl in der Zeile, Werte der Stunde, Zurück-Knopf', new RegExp(`^${hSel}–${(hSel + 1) % 24} Uhr · Mo–Fr · \\d+ Std\\.$`).test(wdSel.sel) && wdSel.back && /%$/.test(wdSel.med) && num(wdSel.p90) > num(wdSel.med), `${wdSel.sel} · ${wdSel.med} / ${wdSel.p90}`);
    check('Wochenende: dieselbe Stunde rund halb so lebhaft (Attrappe: halb)', /Sa–So/.test(weSel.sel) && weSel.days === 'false,true' && num(weSel.med) / num(wdSel.med) > 0.35 && num(weSel.med) / num(wdSel.med) < 0.7, `${wdSel.med} → ${weSel.med}`);
    await page.click('#vola-back'); await page.waitForTimeout(400); d = await info(page);
    H = nowH();
    check('„↺ jetzt“: zurück zur aktuellen Stunde und Tagesart, Knopf weg', d.sel_ === H && !d.back && d.days === (weekend ? 'false,true' : 'true,false'), d.sel);
    await page.focus('#vola-bars'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(300); const kr = await info(page);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300); const ke = await info(page);
    H = nowH();
    check('Pfeiltasten wählen die nächste Stunde, Esc zurück', kr.sel_ === (H + 1) % 24 && kr.back && ke.sel_ === H && !ke.back, `${kr.sel} → ${ke.sel}`);
    // Info-Knopf
    await page.click('#vola .tip summary'); await page.waitForTimeout(300);
    const tip = await page.evaluate(() => { const b = document.querySelector('#vola .tip-body'), r = b.getBoundingClientRect(); return { vis: b.checkVisibility(), l: r.left, r: r.right, vw: innerWidth, t: b.textContent }; });
    check('Info: Erklärung ganz im Fenster, mit Gebühren-Hinweis zur Richtung', tip.vis && tip.l >= 0 && tip.r <= tip.vw && /auch nach Gebühren/.test(tip.t) && /keine Garantie/.test(tip.t), JSON.stringify({ l: tip.l, r: tip.r }));
    await page.click('#vola .tip summary');
    check('Computer (Muster): keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();

    // ---- Echte Tendenz (Attrappe: jede Stunde 13 Uhr UTC steigt um 1 %) und Gebühren ----
    await h.ctl('/vola?mode=pattern&drift=13');
    ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: TZ }); page = await ctx.newPage(); errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page); await ready(page);
    const up = new Set(Array.from({ length: 84 }, (_, i) => localHour(13, i)));
    d = await info(page);
    const arrowsOk = a => a.length >= 1 && a.every(x => x.endsWith('▲') && up.has(parseInt(x)));
    check(`Echte Tendenz: ▲ nur an der steigenden Stunde (Ortszeit ${[...up].join('/')} Uhr)`, arrowsOk(d.arrows), d.arrows.join(' '));
    const hUp = parseInt(d.arrows[0]);
    await page.evaluate(() => document.getElementById('vola').scrollIntoView({ block: 'center' })); await page.click(`#vola-bars .vb[data-h="${hUp}"]`); await page.waitForTimeout(400); d = await info(page);
    check('Richtung der Stunde: „▲ steigt im Schnitt um … % – auch nach Gebühren gesichert“', /^▲ steigt im Schnitt um (0,9\d|1,0\d) % – auch nach Gebühren gesichert$/.test(d.dir), d.dir);
    await page.click('[data-vday="we"]'); await page.waitForTimeout(400); const dWe = await info(page); await page.click('#vola-back'); await page.waitForTimeout(300);
    check('Auch am Wochenende (rund 24 Stunden je Zelle) gesichert', arrowsOk(dWe.arrows), dWe.arrows.join(' '));
    // Gebühr im Rechner 0,6 % je Seite: hin und zurück 1,2 % > 1 % Bewegung → keine Tendenz mehr
    const fee = v => page.evaluate(v => { const i = document.getElementById('risk-fee'); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, v);
    await fee('0,6'); await page.waitForFunction(() => ![...document.querySelectorAll('#vola-bars .vb-dir')].some(e => e.textContent), null, { timeout: 12000 }).catch(() => {});
    await page.click(`#vola-bars .vb[data-h="${hUp}"]`); await page.waitForTimeout(400); d = await info(page);
    check('Gebühr 0,6 % je Seite (1,2 % hin und zurück > 1 %): ▲ verschwindet, „keine nachweisbare Tendenz“', !d.arrows.length && d.dir === 'keine nachweisbare Tendenz', `${d.arrows.join(' ')} · ${d.dir}`);
    await fee('0,06'); await page.waitForTimeout(6000); d = await info(page);
    check('Gebühr zurück auf 0,06 %: ▲ wieder da', arrowsOk(d.arrows), d.arrows.join(' '));
    check('Tendenz: keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();

    // ---- Warnung (gleichmäßige Attrappe: 90 % ≈ 3,2 %, 99 % ≈ 3,8 % Spanne je Stunde) ----
    await h.ctl('/vola?mode=normal&drift=');
    ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: TZ }); page = await ctx.newPage(); errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page); await ready(page); await page.waitForTimeout(5500);
    d = await info(page);
    check('Ruhig: keine Warnung, Einstufung „üblich“ oder „ruhig“, Standard „stärkste 5 %“', !d.chip && ['üblich', 'ruhig'].includes(d.badge) && d.level === '0' && await page.inputValue('#vola-warn') === '95', `${d.now} · ${d.badge}`);
    await page.selectOption('#vola-warn', '90');
    let r = await setRange(page, 3.45), shown = await waitChip(page, /^⚡ Volatilität erhöht · \d,\d× üblich$/); d = await info(page);
    check('Spanne 3,45 % (über dem 90-%-Wert): Live-Leiste „⚡ Volatilität erhöht · …× üblich“, Einstufung „erhöht“', shown && d.badge === 'erhöht' && d.level === '1' && !d.strong && /stärker als in 90 % der vergleichbaren Stunden/.test(d.title), `${d.chip} · ${d.now} · natürlich ${r.natural} %`);
    r = await setRange(page, 5); shown = await waitChip(page, /^⚡ Volatilität stark erhöht/); d = await info(page);
    check('Spanne 5 % (über dem 99-%-Wert): „stark erhöht“, rot', shown && d.badge === 'stark erhöht' && d.level === '2' && d.strong && /stärker als in 99 %/.test(d.title), `${d.chip} · ${d.now}`);
    await page.evaluate(() => scrollTo(0, 0)); await page.click('#lb-vola'); await page.waitForTimeout(1200);
    const vis = await page.evaluate(() => { const r = document.getElementById('vola').getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight * 0.5; });
    check('Warnung antippen: springt zur Übersicht', vis);
    await page.selectOption('#vola-warn', '0'); await page.waitForTimeout(800); d = await info(page);
    check('Warnen „aus“: Live-Leiste ohne Warnung, die Übersicht stuft trotzdem ein („stark erhöht“)', !d.chip && d.badge === 'stark erhöht' && d.level === '2', `${d.badge}`);
    await page.reload(); await live(page); await ready(page);
    check('Einstellung bleibt nach dem Neuladen („aus“)', await page.inputValue('#vola-warn') === '0');
    await page.selectOption('#vola-warn', '95'); shown = await waitChip(page, /stark erhöht/);
    check('Wieder „stärkste 5 %“: Warnung sofort zurück (Zwischenspeicher, Spanne noch im Fenster)', shown);
    // Coinwechsel
    await page.fill('#symbol', 'ETH'); await page.click('#market-form [type=submit]'); await live(page);
    await page.waitForFunction(() => document.getElementById('vola-coin').textContent === 'ETH' && /Tage/.test(document.getElementById('vola-src').textContent), null, { timeout: 30000 }).catch(() => {});
    d = await info(page);
    check('Coinwechsel: Übersicht für ETH mit eigenen Daten, Warnung von BTC weg', d.src.includes('1.999 Stunden') && !/stark/.test(d.chip), `${d.src} · ${d.chip || 'keine Warnung'}`);
    check('Warnung: keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
    await h.ctl('/reset');

    // ---- Handy 390/320: beide Warnungen in einer Zeile, nichts ragt heraus ----
    for (const w of [390, 320]) {
      await h.ctl('/cal?mode=soon&min=10');
      ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 644 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, timezoneId: TZ }); page = await ctx.newPage(); errors = []; h.collect(page, errors);
      await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page); await ready(page);
      await setRange(page, 5); await waitChip(page, /Vola/);
      await page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove())); await page.waitForTimeout(300);
      const m = await page.evaluate(() => {
        const R = e => e.getBoundingClientRect(), bar = R(document.getElementById('livebar')), v = R(document.getElementById('lb-vola')), n = R(document.getElementById('lb-news')), panel = R(document.getElementById('vola'));
        const out = [...document.querySelectorAll('#vola *')].filter(e => { const r = R(e); return e.checkVisibility() && r.width && (r.right > panel.right + 0.5 || r.left < panel.left - 0.5); }).map(e => e.id || e.className);
        return { same: Math.abs(v.top - n.top) < 2, inside: v.right <= bar.right + 1 && n.left >= bar.left - 1 && v.bottom <= bar.bottom + 1, apart: n.right <= v.left + 1, vText: document.getElementById('lb-vola').innerText,
          cut: document.getElementById('lb-vola').scrollWidth > document.getElementById('lb-vola').clientWidth + 1, out, sw: document.scrollingElement.scrollWidth - innerWidth, barH: Math.round(bar.height) };
      });
      check(`Handy ${w} px: Termin- und Volatilitäts-Warnung nebeneinander in einer Zeile („⚡ Vola …×“), nichts abgeschnitten`, m.same && m.inside && m.apart && /^⚡ Vola \d,\d×$/.test(m.vText) && !m.cut, JSON.stringify(m));
      check(`Handy ${w} px: in der Übersicht ragt nichts heraus, kein seitliches Scrollen`, !m.out.length && m.sw <= 0, m.out.join(', '));
      check(`Handy ${w} px: keine Fehler`, !errors.length, errors.join(' | ')); await ctx.close();
      await h.ctl('/reset');
    }

    // ---- Keine Sprünge: Neuzeichnen alle 5 s und Erscheinen der Warnung, während man darunter liest (Chrome und iPhone-Safari) ----
    for (const [safari, coin] of [[false, 'ETH'], [true, 'SOL']]) {
      await h.ctl('/cal?mode=normal');
      ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, timezoneId: TZ });
      if (safari) await ctx.addInitScript(asSafari);
      page = await ctx.newPage(); errors = []; h.collect(page, errors);
      await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page);
      await page.fill('#symbol', coin); await page.click('#market-form [type=submit]'); await live(page);
      await page.waitForFunction(c => document.getElementById('vola-coin').textContent === c, coin, { timeout: 20000 }).catch(() => {}); await ready(page); await page.waitForTimeout(5500);
      await page.evaluate(() => { const r = document.getElementById('signals').getBoundingClientRect(); scrollBy(0, r.top - 240); }); await page.waitForTimeout(800);
      const track = ms => page.evaluate(ms => new Promise(done => {
        const s = document.getElementById('signals'), lb = document.getElementById('livebar'), top0 = s.getBoundingClientRect().top, lb0 = lb.getBoundingClientRect().height, t0 = Date.now(), samples = [];
        const id = setInterval(() => { samples.push(Math.round(s.getBoundingClientRect().top - top0)); if (Date.now() - t0 > ms) { clearInterval(id); done({ maxShift: Math.max(...samples.map(Math.abs)), lbGrow: Math.round(lb.getBoundingClientRect().height - lb0), chip: !document.getElementById('lb-vola').hidden }); } }, 100);
      }), ms);
      const idle = await track(11000);
      check(`${safari ? 'iPhone-Safari' : 'Chrome'} (${coin}): Neuzeichnen alle 5 s verschiebt nichts, noch keine Warnung`, idle.maxShift <= 1 && !idle.chip, JSON.stringify(idle));
      await safeSecond(); const pending = track(16000); await setRange(page, 5, coin + 'USDT'); const t = await pending;
      check(`${safari ? 'iPhone-Safari' : 'Chrome'} (${coin}): Warnung erscheint oben (Live-Leiste wächst), der gelesene Inhalt bleibt stehen`, t.chip && t.lbGrow >= 30 && t.maxShift <= 2, JSON.stringify(t));
      check(`${safari ? 'iPhone-Safari' : 'Chrome'}: keine Fehler`, !errors.length, errors.join(' | ')); await ctx.close();
      await h.ctl('/reset');
    }

    // ---- Tablet: Chart-Reiter, nach den News ----
    ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: TZ }); page = await ctx.newPage(); errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page); await ready(page);
    const tab = await page.evaluate(() => { const y = id => { const r = document.getElementById(id).getBoundingClientRect(); return { t: Math.round(r.top + scrollY), b: Math.round(r.bottom + scrollY), vis: r.height > 0 }; };
      return { layout: document.documentElement.dataset.layout, cnews: y('cnews'), vola: y('vola'), signals: y('signals') }; });
    check('Tablet: im Chart-Reiter unter den News, vor der Signal-Übersicht', tab.vola.vis && tab.vola.t >= tab.cnews.b - 1 && tab.signals.t >= tab.vola.b - 1, JSON.stringify(tab));
    check('Tablet: keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await h.ctl('/reset').catch(() => {}); await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
