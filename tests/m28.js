// Schritt 4.1 (3.19.0) – Wirtschaftskalender mit Warnung: Kalender unter dem Chart (vor der Signal-Übersicht), nächste
// Termine in Ortszeit mit Prognose/Vorwert und deutscher Kurzbeschreibung, Filter Währung/Bedeutung (gespeichert), ganze Woche;
// Warnung 15 min vorher bis 15 min danach in Live-Leiste und Kalender, einmal Hinweis und Telegram, nicht doppelt nach dem
// Neuladen, Einstellung 5/30 min, Antippen springt zum Kalender; nach der Veröffentlichung mit Ist-Wert ohne neue Meldung;
// veraltet; noch keine Daten (404); Quelle aus mit gespeichertem Stand; Handy 390/320 px. Aufruf: node m28.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
const TG = { tg: { token: '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw', chat: '987654321', on: true }, // Test-Token der Attrappe
   dc: { url: '', on: true }, ev: { alarm: true, pos: true, day: true, news: true } };
const info = page => page.evaluate(() => {
  const q = s => document.querySelector(s), R = e => e.getBoundingClientRect(), chip = q('#lb-news'), warn = q('#econ-warn');
  const rows = [...document.querySelectorAll('#econ .ec-row')].map(r => ({ cls: r.className, time: r.querySelector('.ec-time').textContent, cur: r.querySelector('.ec-cur').textContent,
    title: r.querySelector('.ec-title').textContent, in: r.querySelector('.ec-in').textContent, vals: r.querySelector('.ec-vals')?.innerText || '' })); // innerText: nur Sichtbares
  const c = R(q('#chart-sec')), e = R(q('#econ')), s = R(q('#signals'));
  return { rows, days: [...document.querySelectorAll('#econ .ec-day')].map(d => d.textContent), src: q('#econ-src').textContent, srcErr: q('#econ-src').classList.contains('err'), empty: q('#econ .ec-empty')?.textContent || '',
    chip: chip.hidden ? '' : chip.textContent, chipNow: chip.classList.contains('now'), warn: warn.hidden ? '' : warn.textContent, warnNow: warn.classList.contains('now'),
    toasts: [...document.querySelectorAll('.toast.news')].map(t => t.firstChild.textContent), more: q('#econ-more').hidden ? null : q('#econ-more').textContent,
    order: { chartBottom: Math.round(c.bottom + scrollY), econTop: Math.round(e.top + scrollY), econBottom: Math.round(e.bottom + scrollY), signalsTop: Math.round(s.top + scrollY) }, sw: document.scrollingElement.scrollWidth - innerWidth };
});
const localTime = (page, title) => page.evaluate(async title => { const d = await (await fetch('https://raw.githubusercontent.com/NicoAHB/wx-widget/kalender/calendar.json')).json(); const e = d.events.find(x => x.title === title); return new Date(e.t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); }, title);
const tgNews = async () => (await h.ctl('/sent')).filter(m => m.svc === 'tg' && /Wirtschaftstermin/.test(m.text || ''));
const quiet = e => !/Failed to load resource: the server responded with a status of (404|500)/.test(e); // erwartete Antworten der Attrappe
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset');
  const browser = await h.launch();
  const open = async (mode, view = { viewport: { width: 1440, height: 1000 } }, withTg = false) => {
    await h.ctl(`/cal?mode=${mode}&min=10`);
    const ctx = await browser.newContext(view); if (withTg) await ctx.addInitScript(c => localStorage.setItem('scalpdesk.channels.v1', JSON.stringify(c)), TG);
    const page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page); await page.waitForTimeout(2500);
    return { ctx, page, errors };
  };
  try {
    // ---- normal: nächster wichtiger USD-Termin in 3 h ----
    let { ctx, page, errors } = await open('normal'), d = await info(page);
    check('Kalender unter dem Chart, vor der Signal-Übersicht', d.order.econTop >= d.order.chartBottom - 1 && d.order.signalsTop >= d.order.econBottom - 1, JSON.stringify(d.order));
    const jolts = await localTime(page, 'JOLTS Job Openings');
    // Der Termin liegt 3 h in der Zukunft: zwischen 21 und 24 Uhr Ortszeit ist das schon „Morgen“
    const joltsDay = await page.evaluate(async () => { const d = await (await fetch('https://raw.githubusercontent.com/NicoAHB/wx-widget/kalender/calendar.json')).json(); const e = d.events.find(x => x.title === 'JOLTS Job Openings'); return new Date(e.t).toDateString() === new Date().toDateString() ? 'Heute' : 'Morgen'; });
    check('Nächste 5 Termine (USD, hohe Bedeutung, dazu Feiertag) mit deutscher Kurzbeschreibung', d.rows.length === 5 && d.rows.map(r => r.title).join(' | ') === 'JOLTS Job Openings · offene Stellen | Non-Farm Employment Change · US-Arbeitsmarkt | Unemployment Rate · Arbeitslosenquote | Bank Holiday · Feiertag | Federal Funds Rate · Fed-Zinsentscheid', d.rows.map(r => r.title).join(' | '));
    check('Ortszeit, „in 3 h“, Prognose und Vorwert deutsch, Feiertag „ganztags“, Tage', d.rows[0].time === jolts && /^in (3 h( 1 min)?|2 h 59 min)$/.test(d.rows[0].in) && d.rows[0].vals === 'Prog. 7,65M · vorher 7,67M' && d.rows[3].time === 'ganztags' && d.days[0] === joltsDay && d.days.includes('Morgen') && d.rows.every(r => r.cur === 'USD'), JSON.stringify({ r0: d.rows[0], jolts, joltsDay, days: d.days }));
    check('Stand der Daten, keine Warnung, kein Hinweis', /^Forex Factory · Stand \d\d:\d\d · alle 3 h$/.test(d.src) && !d.srcErr && !d.chip && !d.warn && !d.toasts.length, JSON.stringify({ src: d.src, chip: d.chip, warn: d.warn }));
    // Filter
    await page.selectOption('#econ-cur', 'all'); await page.waitForTimeout(300); d = await info(page);
    check('Währung „alle“: EZB-Termin kommt dazu', d.rows.some(r => r.title.startsWith('ECB President Lagarde Speaks') && r.cur === 'EUR') && d.rows.length === 5, d.rows.map(r => r.cur + ' ' + r.title).join(' | '));
    await page.selectOption('#econ-imp', 'medium'); await page.waitForTimeout(300); d = await info(page);
    check('Bedeutung „hoch + mittel“: Verbrauchervertrauen kommt dazu (Punkt orange)', d.rows.some(r => r.title.startsWith('CB Consumer Confidence') && /\bmedium\b/.test(r.cls)), d.rows.map(r => r.title).join(' | '));
    await page.reload(); await live(page); await page.waitForTimeout(1500);
    const sel = await page.evaluate(() => [document.getElementById('econ-cur').value, document.getElementById('econ-imp').value, document.getElementById('econ-warn-min').value]); d = await info(page);
    check('Auswahl nach dem Neuladen gespeichert', sel.join() === 'all,medium,15' && d.rows.some(r => r.title.startsWith('CB Consumer Confidence')), sel.join());
    await page.selectOption('#econ-cur', 'usd'); await page.selectOption('#econ-imp', 'high'); await page.waitForTimeout(300);
    // ganze Woche
    await page.click('#econ-more'); await page.waitForTimeout(300); d = await info(page);
    const ism = d.rows.find(r => r.title.startsWith('ISM Manufacturing PMI'));
    check('„Ganze Woche“: auch Vergangenes, blass, mit Ist-Wert', d.rows.length > 5 && ism && /\bpast\b/.test(ism.cls) && ism.vals.startsWith('Ist 49,5 · Prog. 49,2') && d.more === 'Nur nächste Termine' && d.days.indexOf('Heute') > 0, JSON.stringify({ n: d.rows.length, ism, days: d.days })); // vergangene Tage vor „Heute“ (der Termin liegt 26 h zurück: vor 2 Uhr vorgestern)
    await page.click('#econ-more'); await page.waitForTimeout(300); d = await info(page);
    check('„Nur nächste Termine“: wieder 5', d.rows.length === 5 && d.more === 'Ganze Woche');
    check('Telegram/Discord: Auswahl „Warnung vor wichtigen Wirtschaftsterminen“, vorgewählt', await page.evaluate(() => { const c = document.getElementById('chan-ev-news'); return !!c && c.checked && /Wirtschaftsterminen/.test(c.parentElement.textContent); }));
    check('Computer normal: keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();

    // ---- Termin in 10 min (CPI m/m und Core CPI m/m zur selben Zeit), Telegram eingerichtet ----
    await h.ctl('/sentreset');
    ({ ctx, page, errors } = await open('soon', undefined, true));
    d = await info(page);
    check('Warnung in der Live-Leiste: „⚠ in 10 min: CPI m/m +1“', /^⚠ in 1[01] min: CPI m\/m \+1$/.test(d.chip) && !d.chipNow, d.chip);
    check('Warnung im Kalender mit Uhrzeit, beide Termine hervorgehoben', /^⚠ in 1[01] min \(\d\d:\d\d\): USD CPI m\/m, Core CPI m\/m – hohe Bedeutung\. Starke Kursausschläge möglich/.test(d.warn) && d.rows.filter(r => /\bwarn\b/.test(r.cls)).length === 2, d.warn);
    check('Einmal ein Hinweis (mit Ton)', d.toasts.length === 1 && /^⚠ Wirtschaftstermin in 1[01] min \(\d\d:\d\d Uhr\): USD CPI m\/m, Core CPI m\/m/.test(d.toasts[0]), d.toasts.join(' | '));
    let tg = []; for (let i = 0; i < 20 && !tg.length; i++) { await page.waitForTimeout(250); tg = await tgNews(); }
    check('Nachricht an Telegram', tg.length === 1 && /Wirtschaftstermin in 1[01] min/.test(tg[0].text) && /USD CPI m\/m, Core CPI m\/m/.test(tg[0].text) && /Prognose 0\.3%, vorher 0\.2%/.test(tg[0].text), JSON.stringify(tg.map(m => m.text)));
    await page.reload(); await live(page); await page.waitForTimeout(2500); d = await info(page);
    check('Nach dem Neuladen: Warnung bleibt, kein zweiter Hinweis, keine zweite Nachricht', /^⚠ in 1?\d min: CPI m\/m \+1$/.test(d.chip) && !d.toasts.length && (await tgNews()).length === 1, JSON.stringify({ toasts: d.toasts.length, tg: (await tgNews()).length }));
    await page.selectOption('#econ-warn-min', '5'); await page.waitForTimeout(300); d = await info(page);
    check('„5 min vorher“: bei 10 min noch keine Warnung', !d.chip && !d.warn && !d.rows.some(r => /\bwarn\b/.test(r.cls)));
    await page.selectOption('#econ-warn-min', '30'); await page.waitForTimeout(300); d = await info(page);
    check('„30 min vorher“: Warnung', /^⚠ in 1?\d min: CPI m\/m \+1$/.test(d.chip) && !!d.warn);
    await page.evaluate(() => scrollTo(0, 0)); await page.click('#lb-news'); await page.waitForTimeout(900);
    const inView = await page.evaluate(() => { const r = document.getElementById('econ').getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight * .6; });
    check('Warnung antippen springt zum Kalender', inView);
    check('Termin in 10 min: keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();

    // ---- gerade veröffentlicht (vor 5 min, Ist-Wert) ----
    await h.ctl('/sentreset');
    ({ ctx, page, errors } = await open('past', undefined, true));
    await page.waitForTimeout(1500); d = await info(page);
    check('Nach der Veröffentlichung: Warnung „vor 5 min … Ist 0,4 %“ bis 15 min danach', /^⚠ vor [456] min: CPI m\/m$/.test(d.chip) && d.chipNow && d.warnNow && /^⚠ USD CPI m\/m vor [456] min \(\d\d:\d\d\) – Ist 0,4 %: noch bis \d\d:\d\d starke Kursausschläge möglich\.$/.test(d.warn), `${d.chip} | ${d.warn}`);
    check('… aber kein Hinweis und keine Nachricht mehr', !d.toasts.length && !(await tgNews()).length);
    check('Veröffentlicht: keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();

    // ---- veraltet ----
    ({ ctx, page, errors } = await open('stale')); d = await info(page);
    check('Stand älter als 12 h: „veraltet, GitHub-Job prüfen“', /– veraltet, GitHub-Job prüfen$/.test(d.src) && d.srcErr && d.rows.length === 5, d.src);
    check('Veraltet: keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();

    // ---- noch keine Daten (Job noch nie gelaufen) ----
    ({ ctx, page, errors } = await open('missing')); d = await info(page);
    check('Noch keine Daten (404): Hinweis auf den GitHub-Job', !d.rows.length && d.empty === 'Noch keine Kalenderdaten – der GitHub-Job legt sie nach der Veröffentlichung an.' && !d.src && d.more === null, d.empty);
    check('404: keine weiteren Fehler', !errors.filter(quiet).length, errors.filter(quiet).join(' | ')); await ctx.close();

    // ---- Quelle aus, gespeicherter Stand bleibt ----
    ({ ctx, page, errors } = await open('normal'));
    await page.evaluate(() => new Promise(res => { const r = indexedDB.open('scalpdesk', 1); r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite'), st = tx.objectStore('kv'), g = st.get('scalpdesk.idb.econdata'); g.onsuccess = () => { st.put({ ...g.result, at: 1 }, 'scalpdesk.idb.econdata'); }; tx.oncomplete = () => res(); }; }));
    await h.ctl('/cal?mode=error'); await page.reload(); await live(page); await page.waitForTimeout(2500); d = await info(page);
    check('Quelle nicht erreichbar: letzter Stand bleibt, Hinweis „gerade nicht erreichbar“', d.rows.length === 5 && / · gerade nicht erreichbar$/.test(d.src) && d.srcErr, d.src);
    check('Quelle aus: keine weiteren Fehler', !errors.filter(quiet).length, errors.filter(quiet).join(' | ')); await ctx.close();

    // ---- Handy ----
    for (const [w, mode] of [[390, 'soon'], [320, 'normal']]) {
      ({ ctx, page, errors } = await open(mode, { viewport: { width: w, height: w === 390 ? 844 : 700 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }));
      const m = await page.evaluate(() => {
        const R = e => e.getBoundingClientRect(), bar = R(document.getElementById('livebar')), chip = document.getElementById('lb-news'), c = R(chip), panel = R(document.getElementById('econ'));
        const rows = [...document.querySelectorAll('#econ .ec-row')];
        return { chip: chip.hidden ? null : { w: Math.round(c.width), barW: Math.round(bar.width), inside: c.top >= bar.top - 1 && c.bottom <= bar.bottom + 1 && c.left >= bar.left - 1 && c.right <= bar.right + 1, below: c.top > R(document.querySelector('.livebar .heat')).bottom - 2 },
          inline: rows.length ? getComputedStyle(rows[0].querySelector('.ec-in')).display === 'none' && (!rows[0].querySelector('.ec-in-n') || getComputedStyle(rows[0].querySelector('.ec-in-n')).display === 'inline') : null,
          cut: [...document.querySelectorAll('#econ *')].filter(e => { const r = R(e); return e.checkVisibility() && r.width && (r.right > panel.right + 1 || r.left < panel.left - 1); }).length, sw: document.scrollingElement.scrollWidth - innerWidth };
      });
      const ord = await page.evaluate(() => { const y = id => { const r = document.getElementById(id).getBoundingClientRect(); return { t: Math.round(r.top + scrollY), b: Math.round(r.bottom + scrollY) }; }; return { chart: y('chart-sec'), econ: y('econ'), signals: y('signals') }; });
      check(`Handy ${w} px: Kalender unter dem Chart, vor der Signal-Übersicht`, ord.econ.t >= ord.chart.b - 1 && ord.signals.t >= ord.econ.b - 1, JSON.stringify(ord));
      if (w === 390) {
        check('Handy 390 px: Warnung als eigene Zeile in voller Breite in der Live-Leiste', m.chip && m.chip.inside && m.chip.below && m.chip.w >= m.chip.barW * .85, JSON.stringify(m.chip));
        await page.click('.tabbar [data-tab="pos"]').catch(() => {}); await page.waitForTimeout(500); await page.click('#lb-news'); await page.waitForTimeout(900);
        const jump = await page.evaluate(() => { const r = document.getElementById('econ').getBoundingClientRect(); return { vis: r.height > 0 && r.top >= 0 && r.top < innerHeight * .7, tab: document.documentElement.dataset.activeTab || '' }; });
        check('Handy: Warnung antippen wechselt zum Chart-Tab und zeigt den Kalender', jump.vis && jump.tab === 'chart', JSON.stringify(jump));
      }
      check(`Handy ${w} px: „in … min“ vorn in der Zeile mit Prognose, nichts ragt heraus, kein seitliches Scrollen`, m.inline && !m.cut && m.sw <= 0, JSON.stringify({ inline: m.inline, cut: m.cut, sw: m.sw }));
      // Info-Knopf: Erklärung ganz im Fenster
      await page.evaluate(() => document.getElementById('econ').scrollIntoView({ block: 'start' })); await page.click('#econ .tip summary'); await page.waitForTimeout(400);
      const tip = await page.evaluate(() => { const r = document.querySelector('#econ .tip-body').getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), vw: innerWidth, vis: document.querySelector('#econ .tip-body').checkVisibility() }; });
      check(`Handy ${w} px: Info zum Kalender öffnet ganz im Fenster`, tip.vis && tip.l >= 0 && tip.r <= tip.vw, JSON.stringify(tip));
      check(`Handy ${w} px: keine Fehler`, !errors.length, errors.join(' | ')); await ctx.close();
    }
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await h.ctl('/cal?mode=normal').catch(() => {}); await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
