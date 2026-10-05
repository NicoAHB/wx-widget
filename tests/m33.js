// 3.21.2 – Sprung-Rekorder (Fehlersuche): aus, bis man ihn einschaltet; schreibt Wischen (Finger, Scrollen, Scroll-Ende),
// Nachholen der Live-Updates, Ausgleich, Höhenänderungen und sichtbare Sprünge mit; Anzeige unten links zählt Sprünge und
// kopiert das Protokoll; keine Kurse im Protokoll; bleibt nach Neuladen an; Ausschalten. Handy 390×844, Safari nachgestellt.
// 3.21.3: Scrollen ohne Finger nach dem Scroll-Ende zählt als Sprung (so verschob Safari die Seite), Scrollen der App nicht.
// Aufruf: node m33.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const safari = () => {
  const orig = CSS.supports.bind(CSS); CSS.supports = (a, b) => /overflow-anchor/.test(String(a) + String(b ?? '')) ? false : orig(a, b);
  const add = () => { const st = document.createElement('style'); st.textContent = '*{overflow-anchor:none!important}'; document.documentElement.append(st); };
  if (document.documentElement) add(); else document.addEventListener('DOMContentLoaded', add);
};
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
// Zustand nur über die Oberfläche (die Daten des Rekorders liegen im Modul): Anzeige, Knopf, Speicher
const ui = page => page.evaluate(() => ({ vis: !document.getElementById('rec-badge').hidden, badge: document.getElementById('rec-badge').textContent, btn: document.getElementById('rec-toggle').textContent,
  copy: !document.getElementById('rec-copy').hidden, stored: localStorage.getItem('scalpdesk.sprungrec.v1') }));
// Protokoll lesen wie der Nutzer: Anzeige antippen, dann aus der Zwischenablage
const readLog = async page => { await page.click('#rec-badge'); await page.waitForTimeout(250); return (await page.evaluate(() => navigator.clipboard.readText())).split('\n'); };
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset');
  const browser = await h.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: h.URL_BASE });
    await ctx.addInitScript(safari);
    const page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page); await page.waitForTimeout(3000);
    // ---- aus ----
    let st = await ui(page);
    check('Ausgeschaltet: keine Anzeige, kein Protokoll zum Kopieren, nichts gespeichert', !st.vis && !st.copy && !st.stored && /einschalten/.test(st.btn), JSON.stringify(st));
    // ---- einschalten über das Menü „Ansicht“ ----
    await page.click('#view-menu'); await page.waitForTimeout(300);
    const note = await page.textContent('#rec-note');
    await page.click('#rec-toggle'); await page.waitForTimeout(300);
    st = await ui(page);
    const box = await page.evaluate(() => { const r = document.getElementById('rec-badge').getBoundingClientRect(), t = document.getElementById('tabbar').getBoundingClientRect(); return { left: Math.round(r.left), bottom: Math.round(r.bottom), tabTop: Math.round(t.top), pos: getComputedStyle(document.getElementById('rec-badge')).position }; });
    check('Einschalten im Menü: Anzeige unten links „● Rekorder · 0 Sprünge“ (fest, über der Tab-Leiste), Knopf „ausschalten“, gespeichert',
      st.vis && /^● Rekorder · 0 Sprünge · antippen = kopieren$/.test(st.badge) && /ausschalten/.test(st.btn) && /"on":true/.test(st.stored || '') && box.pos === 'fixed' && box.left <= 12 && box.bottom <= box.tabTop, JSON.stringify({ ...st, box }));
    check('Hinweis im Menü: nur Zeiten, Pixelwerte, Bereichsnamen', /keine Kurse, Notizen oder Zugangsdaten/.test(note), note.slice(0, 90));
    await page.click('#view-menu'); await page.waitForTimeout(200);
    // ---- wischen wie mit dem Finger (ab dem Chart abwärts) ----
    await page.evaluate(() => scrollTo(0, document.getElementById('chart').getBoundingClientRect().top + scrollY - 80)); await page.waitForTimeout(800);
    const cdp = await ctx.newCDPSession(page);
    const swipe = async () => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 600 }] });
      for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 600 - i * 26 }] }); await page.waitForTimeout(16); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await swipe(); await page.waitForTimeout(3500); await swipe(); await page.waitForTimeout(3500);
    let log = await readLog(page);
    const has = re => log.some(l => re.test(l));
    check('Kopfzeile: Version, Gerät, Ausgleich durch die App (Safari), Größe, Layout, Tab', /^\d+ Sprung-Rekorder \d+\.\d+\.\d+ · .+ · Browser · Ausgleich durch die App · 390×844 @3 .*· Layout tablet · Tab chart · y=/.test(log[0]), log[0].slice(0, 170));
    check('Wischen mitgeschrieben: Finger auf/ab, Scrollen, „250 ms ohne Scroll-Ereignis“', has(/^\d+ T\+ Finger auf y=/) && has(/^\d+ T- Finger ab y=/) && has(/^\d+ S (y=|nach )/) && has(/^\d+ S\. 250 ms ohne Scroll-Ereignis/), log.filter(l => / [TS]/.test(l)).slice(0, 4).join(' | '));
    check('Nachholen nach dem Scrollen mit Abstand zum letzten Scroll-Ereignis und Ausgleich', has(/^\d+ F nachgeholt: .+ · \d+ ms nach dem letzten Scroll-Ereignis, y=/) && has(/^\d+ A (App gleicht aus|kein Ausgleich nötig)/), log.filter(l => / [FA] /.test(l)).slice(0, 3).join(' | '));
    // ---- ein echter Sprung: oberhalb des Bildes 40 px einfügen, ohne Ausgleich ----
    await page.waitForTimeout(4200); // Bestätigung „kopiert“ abwarten, dann zählt die Anzeige wieder
    const j0 = log.filter(l => / J sichtbar /.test(l)).length;
    await page.evaluate(() => { const d = document.createElement('div'); d.id = 'test-einschub'; d.style.height = '40px'; document.getElementById('chart-sec').prepend(d); });
    await page.waitForTimeout(600);
    const badgeNow = (await ui(page)).badge;
    log = await readLog(page);
    const jl = log.filter(l => / J sichtbar /.test(l)), rl = log.filter(l => / R /.test(l));
    check('Sichtbarer Sprung erkannt: +40 px, in Ruhe, Anzeige zählt mit', jl.length === j0 + 1 && /J sichtbar \+40 · Inhalt \+40 · Scroll \+0 \(App \+0\) · in Ruhe/.test(jl.at(-1)) && new RegExp(`· ${j0 + 1} (Sprung|Sprünge) ·`).test(badgeNow), `${jl.at(-1)} · ${badgeNow}`);
    check('Höhenänderung des Bereichs mitgeschrieben (R …→…)', rl.some(l => /R .*#chart-sec.* \d+(\.\d)?→\d+(\.\d)? oben=/.test(l)), rl.slice(-2).join(' | '));
    // ---- Scrollen der App wird mit angewandtem Betrag mitgeschrieben – und ist kein Sprung ----
    await page.evaluate(() => document.getElementById('test-einschub').remove()); await page.waitForTimeout(500);
    log = await readLog(page); const j1 = log.filter(l => / J sichtbar /.test(l)).length;
    await page.evaluate(() => { const d = document.createElement('div'); d.id = 'test-einschub2'; d.style.height = '30px'; document.getElementById('chart-sec').prepend(d); window.scrollBy(0, 30); });
    await page.waitForTimeout(600);
    log = await readLog(page);
    const pl = log.filter(l => / P scrollBy/.test(l)).at(-1) || '', j2 = log.filter(l => / J sichtbar /.test(l)).length;
    check('Ausgleich per scrollBy: „P scrollBy(0, 30) angewandt +30“, kein Sprung gezählt', j2 === j1 && /P scrollBy\(0, 30\) angewandt \+30 y=/.test(pl), `${pl} · Sprünge ${j1}→${j2}`);
    await page.evaluate(() => document.getElementById('test-einschub2').remove()); await page.waitForTimeout(400);
    // ---- Safari-Fall (3.21.3): Der Browser scrollt nach dem Scroll-Ende von selbst – ohne Finger, ohne App → Sprung ----
    await page.waitForTimeout(4200);
    log = await readLog(page); const j3 = log.filter(l => / J sichtbar /.test(l)).length;
    await page.waitForTimeout(4200);
    await page.evaluate(() => { document.scrollingElement.scrollTop += 50; }); await page.waitForTimeout(500);
    log = await readLog(page);
    const jb = log.filter(l => / J sichtbar /.test(l));
    check('Scrollt der Browser nach dem Scroll-Ende von selbst (ohne Finger, ohne App): als Sprung gezählt', jb.length === j3 + 1 && /J sichtbar -50 · Inhalt \+0 · Scroll \+50 \(App \+0\) · in Ruhe/.test(jb.at(-1)), jb.at(-1));
    // ---- Absichtliches Scrollen der App (z. B. zum Chart nach Antippen einer Signalzeile): kein Sprung ----
    const j4 = jb.length;
    await page.evaluate(() => document.getElementById('chart').scrollIntoView({ behavior: 'smooth', block: 'start' })); await page.waitForTimeout(1600);
    log = await readLog(page);
    const j5 = log.filter(l => / J sichtbar /.test(l)).length, piv = log.filter(l => / P scrollIntoView div#chart/.test(l));
    check('Absichtliches Scrollen der App (scrollIntoView, weich): mitgeschrieben, kein Sprung', piv.length >= 1 && j5 === j4, `${piv.at(-1)} · Sprünge ${j4}→${j5}`);
    // ---- kopieren über die Anzeige ----
    const price = await page.evaluate(() => document.getElementById('lb-price')?.textContent || document.querySelector('.wl-price')?.textContent || '');
    await page.waitForTimeout(4200);
    await page.click('#rec-badge'); await page.waitForTimeout(400);
    const clip = await page.evaluate(() => navigator.clipboard.readText()), badge = await page.textContent('#rec-badge');
    check('Antippen der Anzeige kopiert das Protokoll (Kopfzeile bis „Ende des Protokolls“), Anzeige bestätigt', /^\d+ Sprung-Rekorder \d+\.\d+\.\d+/.test(clip) && /Ende des Protokolls$/.test(clip) && /Protokoll kopiert ✓/.test(badge), `${clip.length} Zeichen · ${badge}`);
    check('Keine Kurse im Protokoll (nur Pixelwerte und Bereichsnamen)', price && !clip.includes(price.trim()) && !/\d{1,3}(\.\d{3})+,\d{2}/.test(clip), `Kurs ${price.trim()}`);
    // ---- bleibt nach Neuladen an ----
    await page.reload(); await live(page); await page.waitForTimeout(1500);
    st = await ui(page); log = await readLog(page);
    check('Nach Neuladen weiter an (neues Protokoll)', st.vis && /ausschalten/.test(st.btn) && /^\d+ Sprung-Rekorder \d+\.\d+\.\d+/.test(log[0]) && !log.some(l => /test-einschub|P scrollBy\(0, 30\)/.test(l)), JSON.stringify({ vis: st.vis, lines: log.length }));
    // ---- ausschalten ----
    await page.click('#view-menu'); await page.waitForTimeout(300); await page.click('#rec-toggle'); await page.waitForTimeout(300);
    st = await ui(page);
    check('Ausschalten: Anzeige weg, nichts mehr gespeichert, Protokoll bleibt im Menü kopierbar', !st.vis && st.copy && /einschalten/.test(st.btn) && !st.stored, JSON.stringify(st));
    check('keine Fehler', !errors.length, errors.join(' | '));
    await ctx.close();
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
