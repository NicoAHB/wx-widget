// Ablaufplan Schritt 8 (3.24.0) – Datensicherung unter „Positionen“: beim Start und nach dem Neuladen zugeklappt, kompakte
// Zeile „Datensicherung“ mit Pfeil (zeigt den Zustand), Auf- und Zuklappen per Tippen (iPad hoch/quer), Sichern (Datei) und
// Einspielen (Wiederherstellen) weiter nutzbar, „Backup“ oben öffnet das Feld. Aufruf: node m41.js
const h = require('./harness'), fs = require('fs'), path = require('path');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
const st = page => page.evaluate(() => { const p = document.getElementById('data-panel'), t = document.getElementById('data-toggle'), c = t.querySelector('.data-chev'), R = e => e.getBoundingClientRect();
  return { hidden: p.hidden, h: Math.round(R(p).height), exp: t.getAttribute('aria-expanded'), rot: getComputedStyle(c).transform, title: t.querySelector('.data-title').textContent, due: t.querySelector('.due').hidden ? '' : t.querySelector('.due').textContent, last: document.getElementById('data-last').textContent, headH: Math.round(R(t).height), headTop: Math.round(R(t).top + scrollY), listTop: Math.round(R(document.getElementById('pos-list')).top + scrollY) }; });
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  const browser = await h.launch(), p0 = Math.round((await h.ctl('/state')).price.BTCUSDT), now = Date.now();
  const POS = [{ id: 'd1', symbol: 'BTCUSDT', side: 'long', mode: 'isolated', entry: p0 - 20, leverage: 10, qty: 0.5, margin: p0 / 20, openedAt: now - 60e3, source: 'spot', liqExchange: null, preRealized: 0, sl: null, tp: null, ack: { sl: false, tp: false } }];
  try {
    for (const [w, hh] of [[820, 1180], [1180, 820]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: hh }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, acceptDownloads: true });
      await ctx.addInitScript(p => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.setItem('scalpdesk.positions.v1', JSON.stringify(p)); }, POS);
      const page = await ctx.newPage(), errors = []; h.collect(page, errors);
      await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page); await page.waitForTimeout(1500);
      await page.tap('#tabbar [data-tab="pos"]'); await page.waitForTimeout(600);
      let s = await st(page);
      check(`${w}×${hh}: beim Start zugeklappt – Zeile „Datensicherung“ mit Pfeil ▸, Feld verborgen`, s.hidden && s.h === 0 && s.exp === 'false' && s.rot === 'none' && s.title === '💾 Datensicherung' && s.headH >= 44, JSON.stringify(s));
      check(`${w}×${hh}: kompakte Zeile zeigt „FÄLLIG“ und den Stand`, s.due === 'FÄLLIG' && s.last === 'noch keine Sicherung', `${s.due} · ${s.last}`);
      check(`${w}×${hh}: die Positionen sind ohne das große Feld sichtbar (Karte direkt unter der Zeile)`, s.listTop > s.headTop && s.listTop - s.headTop < 140, JSON.stringify({ head: s.headTop, list: s.listTop }));
      // Tippen: auf, zu, mehrfach
      const seq = [];
      for (let i = 0; i < 3; i++) { await page.tap('#data-toggle'); await page.waitForTimeout(350); const a = await st(page); await page.tap('#data-toggle'); await page.waitForTimeout(350); const b = await st(page); seq.push([a.hidden, a.exp, a.rot !== 'none', b.hidden, b.exp, b.rot === 'none']); }
      check(`${w}×${hh}: Tippen öffnet und schließt zuverlässig (3 Durchgänge), Pfeil zeigt den Zustand`, seq.every(x => x.join() === 'false,true,true,true,false,true'), JSON.stringify(seq));
      await page.tap('#data-toggle'); await page.waitForTimeout(350); s = await st(page);
      check(`${w}×${hh}: aufgeklappt ist der ganze Inhalt erreichbar (Sichern, Einspielen, QR, Muster, Reset)`, !s.hidden && s.h > 200 && await page.evaluate(() => ['backup-save', 'backup-load', 'qr-export', 'zzp-export', 'reset-open'].every(id => { const r = document.getElementById(id).getBoundingClientRect(); return r.width > 0 && r.height > 0; })), `Höhe ${s.h}px`);
      // Sichern: Datei herunterladen
      const dl = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
      await page.tap('#backup-save'); const d = await dl; let file = null;
      if (d) { const f = path.join(process.env.SP || '/tmp', `m41-${w}.json`); await d.saveAs(f); file = f; }
      const data = file ? JSON.parse(fs.readFileSync(file, 'utf8')) : null; s = await st(page);
      check(`${w}×${hh}: „Backup herunterladen“ funktioniert (Datei mit der Position), Stand „zuletzt …“`, data?.app === 'scalp-desk' && data.positions?.length === 1 && /^zuletzt \d\d\.\d\d\., \d\d:\d\d$/.test(s.last) && s.due !== 'FÄLLIG', `${d?.suggestedFilename()} · ${s.last} · ${s.due}`);
      // Wiederherstellen: Position löschen, Datei einspielen
      await page.evaluate(() => { localStorage.setItem('scalpdesk.positions.v1', '[]'); });
      await page.reload(); await live(page); await page.waitForTimeout(1500); await page.tap('#tabbar [data-tab="pos"]'); await page.waitForTimeout(500);
      s = await st(page);
      check(`${w}×${hh}: nach dem Neuladen wieder zugeklappt`, s.hidden && s.exp === 'false' && s.rot === 'none');
      await page.tap('#data-toggle'); await page.waitForTimeout(300);
      const cards0 = await page.$$eval('.pos-card', c => c.length);
      if (file) await page.setInputFiles('#backup-file', file); await page.waitForTimeout(1200);
      await page.evaluate(() => document.querySelector('#sync-preview .sp-actions .button.primary-lite')?.click()); await page.waitForTimeout(500); // 3.27.0: Vorschau → „Übernehmen“
      const cards1 = await page.$$eval('.pos-card', c => c.length), msg = await page.textContent('#history-status');
      check(`${w}×${hh}: „Backup einspielen“ stellt die Position wieder her`, cards0 === 0 && cards1 === 1 && /1 Position neu/.test(msg), `${cards0} → ${cards1} · ${msg}`);
      // „Backup“ oben öffnet das Feld (und zeigt es)
      await page.tap('#data-toggle'); await page.waitForTimeout(300); await page.tap('#tabbar [data-tab="chart"]'); await page.waitForTimeout(400);
      await page.tap('#backup-badge'); await page.waitForTimeout(900); s = await st(page);
      const inView = await page.evaluate(() => { const r = document.getElementById('data-toggle').getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; });
      check(`${w}×${hh}: „Backup“ oben öffnet das Feld und zeigt es`, !s.hidden && s.exp === 'true' && s.rot !== 'none' && inView, JSON.stringify({ exp: s.exp, inView }));
      check(`${w}×${hh}: keine Fehler`, !errors.length, errors.join(' | '));
      await ctx.close();
    }
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
