// Smartphone hochkant: kein seitliches Scrollen, ruhige Tabs, Tageslimit-Banner. Aufruf: node m7.js [testname ...]
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const now = Date.now();
const seed = ({ now, limit }) => { if (localStorage.getItem('scalpdesk.savedat.v1')) return;
  const P = (id, sym, side, entry, extra = {}) => ({ id, symbol: sym, side, mode: 'isolated', entry, leverage: 20, qty: side === 'long' ? 0.02 : 300, margin: 60, openedAt: now - 3600e3, source: 'spot', liqExchange: null, preRealized: 0, sl: null, tp: null, ack: { sl: false, tp: false }, ...extra });
  localStorage.setItem('scalpdesk.positions.v1', JSON.stringify([P('s1', 'BTCUSDT', 'long', 64000, { tp: 69000 }), P('s2', 'XRPUSDT', 'long', 1.47, { sl: 1.2, tp: 1.9, preRealized: 12.5 }), P('s3', 'ETHUSDT', 'short', 2500, { sl: 2900 })]));
  localStorage.setItem('scalpdesk.alarms.v1', JSON.stringify([{ id: 'sa', symbol: 'BTCUSDT', dir: 'above', price: 66800, note: 'Ausbruch über Widerstand mit einer etwas längeren Notiz', source: 'spot', createdAt: now, triggeredAt: null, triggerPrice: null }]));
  if (limit) localStorage.setItem('scalpdesk.daylimit.v1', JSON.stringify(limit));
};
// Safari nachstellen: kein eingebauter Scroll-Anker
const safari = () => { const orig = CSS.supports.bind(CSS); CSS.supports = (p, v) => (p === 'overflow-anchor' ? false : orig(p, v)); document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = 'html{overflow-anchor:none!important}'; document.head.append(s); }); };
const phone = w => ({ viewport: { width: w, height: 800 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
async function open(browser, view, { init = [], limit = null, quietFutures = false } = {}) {
  const ctx = await browser.newContext(view); for (const [fn, arg] of [[seed, { now, limit }], ...init]) await ctx.addInitScript(fn, arg);
  const page = await ctx.newPage(), errors = []; h.collect(page, errors);
  if (quietFutures) await ctx.route('**/fapi/v1/klines?*', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto(h.URL_BASE + '/weather-widget-v2.html');
  await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  return { ctx, page, errors };
}
const tab = async (page, t) => { await page.click(`#tabbar [data-tab="${t}"]`); await page.waitForTimeout(500); await page.evaluate(() => { for (const d of document.querySelectorAll('details:not(.tip):not([open])')) if (d.getClientRects().length) d.open = true; }); await page.waitForTimeout(400); };
// Längste Beschriftungen in beide Signal-Zeilen und Alarm-Hinweis in die Live-Leiste
const longest = page => page.evaluate(() => {
  for (const v of document.querySelectorAll('.heat .verdict')) { v.className = 'verdict sell'; v.replaceChildren(Object.assign(document.createElement('span'), { className: 'v-long', textContent: 'Verkaufssignal' }), Object.assign(document.createElement('span'), { className: 'v-short', textContent: 'Verkauf' })); const t = document.createElement('span'); t.className = 'lb-trend trend down'; t.textContent = '↘'; v.after(t); }
  const a = document.getElementById('lb-alarm'); a.hidden = false; a.textContent = '🔔 12';
});
const overflow = page => page.evaluate(() => {
  const vw = document.documentElement.clientWidth, out = [];
  for (const e of document.querySelectorAll('body *')) {
    if (!e.getClientRects().length || e.closest('details:not([open]) > :not(summary)') || e.closest('dialog:not([open])')) continue;
    const b = e.getBoundingClientRect(); if (b.width && b.right > vw + 0.5 && getComputedStyle(e).position !== 'fixed') {
      let clipped = false; for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o !== 'visible' && p.getBoundingClientRect().right <= vw + 0.5) { clipped = true; break; } } if (clipped) continue;
      let p = e.parentElement, inner = false; while (p && p !== document.body) { if (p.getBoundingClientRect().right > vw + 0.5) { inner = true; break; } p = p.parentElement; }
      if (!inner) out.push(`${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : ''} +${Math.round(b.right - vw)}`);
    }
  }
  const y = scrollY; scrollTo(80, y); const sx = scrollX; scrollTo(0, y);
  return { sw: document.scrollingElement.scrollWidth, vw, sx, out: out.slice(0, 6) };
});
// Bildschirmposition eines Elements in der Bildmitte je Frame verfolgen
const watch = (page, secs) => page.evaluate(async secs => {
  // Bezug: das innerste Element in der Bildmitte, das nicht höher als ein Drittel des Bildes ist – bei einem langen Absatz ohne
  // Unterelemente der Absatz selbst
  let e = document.elementFromPoint(innerWidth / 2, innerHeight * .55); while (e && e.getBoundingClientRect().height > innerHeight / 3 && e.firstElementChild) e = e.firstElementChild;
  if (!e) return { jumps: ['kein Bezug'], y: scrollY };
  let last = e.getBoundingClientRect().top; const jumps = [], t0 = performance.now(), y0 = scrollY;
  await new Promise(r => { const f = () => { if (e.isConnected) { const t = e.getBoundingClientRect().top; if (Math.abs(t - last) >= 1) jumps.push(Math.round(t - last)); last = t; } if (performance.now() - t0 < secs * 1000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); });
  return { jumps, y: Math.round(y0), ref: e.id || e.className || e.tagName };
}, secs);
const tests = {
  async noside(browser) {
    for (const w of [320, 360, 375, 390, 414, 430]) {
      const { ctx, page, errors } = await open(browser, phone(w));
      const bad = [];
      for (const t of ['chart', 'calc', 'pos', 'ind']) {
        await tab(page, t); await longest(page); await page.waitForTimeout(100);
        const r = await overflow(page);
        if (r.sw > r.vw || r.sx !== 0 || r.out.length) bad.push(`${t}: Breite ${r.sw}/${r.vw}, scrollX ${r.sx} ${r.out.join(' ')}`);
        // jedes sichtbare Info-Fenster öffnen
        const tips = await page.$$('details.tip > summary');
        for (const s of tips) { if (!(await s.isVisible())) continue; await s.click(); await page.waitForTimeout(80); const o = await overflow(page); if (o.sw > o.vw || o.sx !== 0) bad.push(`${t}: Info offen → Breite ${o.sw}/${o.vw} ${o.out.join(' ')}`); await page.keyboard.press('Escape'); }
      }
      check(`${w}px: kein seitliches Scrollen (alle Tabs, längste Signale, Info-Fenster offen)`, !bad.length, bad.slice(0, 3).join(' | '));
      check(`${w}px: keine Fehler`, !errors.length, errors.join(' | ')); await ctx.close();
    }
  },
  async labels(browser) {
    for (const [w, short] of [[390, true], [1180, false]]) {
      const { ctx, page, errors } = await open(browser, w < 600 ? phone(w) : { viewport: { width: w, height: 900 } });
      await page.waitForFunction(() => document.querySelector('#lb-heat .verdict .v-long'), null, { timeout: 15000 }).catch(() => {});
      const r = await page.evaluate(() => { const vis = s => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0; }; return { long: vis('#lb-heat .v-long'), short: vis('#lb-heat .v-short'), text: document.querySelector('#lb-heat .verdict')?.innerText }; });
      check(`${w}px: Gesamturteil in der Live-Leiste ${short ? 'kurz (Kauf/Verkauf/Halten)' : 'ausgeschrieben'}`, short ? r.short && !r.long && /^(Kauf|Verkauf|Halten)$/.test(r.text) : r.long && !r.short && /^(Kaufsignal|Verkaufssignal|Halten)$/.test(r.text), JSON.stringify(r));
      check(`${w}px: keine Fehler`, !errors.length, errors.join(' | ')); await ctx.close();
    }
  },
  async calm(browser) {
    for (const w of [320, 390]) {
      const { ctx, page, errors } = await open(browser, phone(w), { init: [[safari, null]] });
      for (const t of ['pos', 'ind']) {
        await tab(page, t);
        const H = await page.evaluate(() => document.scrollingElement.scrollHeight - innerHeight);
        for (const f of [0.35, 0.7]) {
          await page.evaluate(y => scrollTo(0, y), Math.round(H * f)); await page.waitForTimeout(400);
          const r = await watch(page, 12);
          check(`${w}px ${t} @${Math.round(f * 100)} %: nichts springt bei 12 s Live-Kursen`, r.jumps.length === 0 && r.y > 20, `scrollY ${r.y}, Bezug ${String(r.ref).slice(0, 24)}, Sprünge [${r.jumps.join(', ')}]`);
        }
      }
      check(`${w}px: keine Fehler`, !errors.length, errors.join(' | ')); await ctx.close();
    }
  },
  async lines(browser) {
    const { ctx, page, errors } = await open(browser, phone(320), { limit: 50 });
    await tab(page, 'pos');
    const r = await page.evaluate(() => {
      const lines = e => { const cs = getComputedStyle(e); return Math.round(e.getBoundingClientRect().height / parseFloat(cs.lineHeight)); };
      const c = document.querySelector('.pos-card[data-id="s2"]'), f = k => c.querySelector(`[data-f="${k}"]`);
      return { sub: f('pnl-sub').textContent.split('\n').length, subLines: lines(f('pnl-sub')), liq: f('liq').textContent.split('\n').length, size: f('size').textContent.split('\n').length, stop: c.querySelector('.pos-stops .st strong').textContent.split('\n').length, day: document.getElementById('day-info').textContent.split('\n').length };
    });
    check('Positionskarte: Euro · ROE/Kurs · schon realisiert · Position gesamt in je eigener Zeile', r.sub === 4 && r.subLines === 4, JSON.stringify(r));
    check('Liquidation, Margin/Positionswert, Stops und Tageslimit in festen Zeilen', r.liq === 2 && r.size === 3 && r.stop === 2 && r.day === 2, JSON.stringify(r));
    await tab(page, 'chart');
    // Der Chart (und mit ihm die OHLC-Zeile) wird nur gezeichnet, wenn er im Bild ist – am 320-px-Handy liegt er seit der
    // Mini-Watchlist (4.2) unterhalb des ersten Bildschirms: erst hinscrollen
    await page.evaluate(() => document.getElementById('chart').scrollIntoView({ block: 'center' })); await page.waitForTimeout(1200);
    const o = await page.evaluate(() => { const e = document.getElementById('ohlc'), cs = getComputedStyle(e); return { n: e.textContent.split('\n').length, h: Math.round((e.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / parseFloat(cs.lineHeight)) }; });
    check('OHLC-Zeile am Handy: zwei feste Zeilen', o.n === 2 && o.h === 2, JSON.stringify(o));
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async banner(browser) {
    // Tageslimit 5 USDT, BTC-Long 0,02 @ 64.000: unter 63.750 liegt der offene Verlust über dem Limit
    await h.ctl('/walk?on=0'); for (const [s, p] of [['BTCUSDT', 64200], ['XRPUSDT', 1.47], ['ETHUSDT', 2500]]) await h.ctl(`/set?symbol=${s}&price=${p}`);
    const { ctx, page, errors } = await open(browser, phone(390), { init: [[safari, null]], limit: 5 });
    await tab(page, 'pos');
    // Anfangszustand mitschreiben: die App setzt „hidden“ bei jedem Zeichnen neu, auch unverändert – das ist kein Wechsel
    await page.evaluate(() => { const b = document.getElementById('day-banner'); window.__bn = [b.hidden ? 'aus' : 'an']; new MutationObserver(() => window.__bn.push(b.hidden ? 'aus' : 'an')).observe(b, { attributes: true, attributeFilter: ['hidden'] }); });
    const H = await page.evaluate(() => document.scrollingElement.scrollHeight - innerHeight);
    await page.evaluate(y => scrollTo(0, y), Math.round(H * .5)); await page.waitForTimeout(400);
    const w = watch(page, 16);
    for (const p of [63600, 63820, 63600, 63850, 63650]) { await h.ctl('/set?symbol=BTCUSDT&price=' + p); await page.waitForTimeout(2500); }
    const r = await w, bn = await page.evaluate(() => window.__bn.filter((x, i, a) => x !== a[i - 1]));
    check('Banner erscheint einmal und bleibt, solange der Verlust über der Hälfte des Limits liegt', bn.join() === 'aus,an', bn.join());
    check('Weiter unten gescrollt: das Erscheinen oben verschiebt den sichtbaren Inhalt nicht', r.jumps.length === 0 && r.y > 20, `scrollY ${r.y}, Sprünge [${r.jumps.join(', ')}]`);
    await h.ctl('/set?symbol=BTCUSDT&price=64100'); await page.waitForTimeout(2500);
    check('Erst bei deutlicher Erholung (Gewinn) verschwindet es', await page.$eval('#day-banner', b => b.hidden));
    await h.ctl('/walk?on=1');
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async tgbackup(browser) {
    const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw', CHAT = '987654321';
    const chanSeed = ({ token, chat }) => { if (!localStorage.getItem('scalpdesk.channels.v1')) localStorage.setItem('scalpdesk.channels.v1', JSON.stringify({ tg: { token, chat, on: true }, dc: { url: '', on: false }, ev: { alarm: true, pos: true, day: true } })); };
    // ohne Telegram: Hinweis und Einrichten-Knopf
    await h.ctl('/orderflow?hold=1'); await h.ctl('/walk?on=0');
    let { ctx, page, errors } = await open(browser, phone(390), { quietFutures: true });
    await tab(page, 'pos'); await page.click('#data-toggle'); await page.waitForTimeout(300);
    const off = await page.evaluate(() => ({ dis: document.getElementById('tgb-on').disabled, setup: !document.getElementById('tgb-setup').hidden, info: document.getElementById('tgb-info').textContent }));
    check('Ohne Telegram: Schalter gesperrt, Hinweis auf Safari und „Telegram einrichten“', off.dis && off.setup && /Safari/.test(off.info), JSON.stringify(off));
    await ctx.close();
    ({ ctx, page, errors } = await open(browser, phone(390), { init: [[chanSeed, { token: TOKEN, chat: CHAT }]], quietFutures: true }));
    // 3.54.0: dieser Fall prüft einen unveränderten Vollstand. Neue Futures-Beobachtungen
    // würden Journal/Begleitung legitim ändern; nur diese zusätzliche Quelle hier stillhalten.
    // Vorhandene Bücher bleiben vollständig in der Sicherung, Spot-Positionen/Alarme weiter live.
    // Isolation ab dem ersten Seitenaufruf: keine nachträglich weiterlebende Futures-Historie und kein Spot-Zufallswalk.
    // Spot-Streams und echte Positions-/Alarm-/Sicherungswege bleiben bedienbar; sämtliche Bücher bleiben im Backup.
    await page.waitForTimeout(6000);
    check('Unveränderter Sicherungsfall startet ohne neue Futures-Beobachtungen', await page.evaluate(() => !__pdf2.feed.quote() && Object.values(__pdf2.feed.state.series).every(rows => rows.length === 0) && (__g05.backupPayload().prefs['scalpdesk.orderflow-journal.v1']?.records?.length || 0) === 0));
    await h.ctl('/sentreset');
    await tab(page, 'pos'); await page.click('#data-toggle'); await page.waitForTimeout(300);
    await page.check('#tgb-on');
    const docs = async n => { for (let i = 0; i < 40; i++) { const s = (await h.ctl('/sent')).filter(x => x.method === 'sendDocument' || x.method === 'editMessageMedia'); if (s.length >= n) return s; await h.sleep(250); } return (await h.ctl('/sent')).filter(x => x.method === 'sendDocument' || x.method === 'editMessageMedia'); };
    let s = await docs(1);
    const f1 = (() => { try { return JSON.parse(s[0].file); } catch { return null; } })();
    check('Einschalten: Sicherung sofort als Datei an den Telegram-Chat (lautlos)', s[0]?.method === 'sendDocument' && s[0].chat_id === CHAT && s[0].silent === 'true' && f1?.positions?.length === 3 && /Scalp-Desk-Sicherung/.test(s[0].caption), JSON.stringify({ m: s[0]?.method, pos: f1?.positions?.length }));
    check('Keine Zugangsdaten in der Datei', s[0] && !s[0].file.includes(TOKEN) && !/channels|token/i.test(s[0].file));
    const badge = await page.evaluate(() => ({ tab: document.getElementById('tab-pos-badge').hidden, info: document.getElementById('backup-info').textContent }));
    check('Danach gilt das Backup als aktuell (kein „!“ am Tab, „per Telegram“)', badge.tab && /per Telegram/.test(badge.info), JSON.stringify(badge));
    // Position bearbeiten = neue Position anlegen: dieselbe Nachricht wird ersetzt
    await page.click('#pos-add-toggle'); await page.fill('#pos-symbol', 'SOL'); await page.fill('#pos-lev', '5'); await page.fill('#pos-qty', '2'); await page.fill('#pos-entry', '150'); await page.click('#pos-save');
    s = await docs(2);
    const f2 = (() => { try { return JSON.parse(s[1].file); } catch { return null; } })();
    check('Nach einer Positionsänderung: vorige Nachricht ersetzt (editMessageMedia), Datei aktuell', s[1]?.method === 'editMessageMedia' && s[1].message_id === s[0].message_id && f2?.positions?.length === 4, JSON.stringify({ m: s[1]?.method, id: s[1]?.message_id, first: s[0]?.message_id, pos: f2?.positions?.length }));
    // Nachricht im Chat gelöscht: nächste Änderung sendet neu
    await h.ctl('/tgdel?id=' + s[0].message_id);
    await page.click('#pos-add-toggle'); await page.fill('#pos-symbol', 'LTC'); await page.fill('#pos-lev', '5'); await page.fill('#pos-qty', '1'); await page.fill('#pos-entry', '70'); await page.click('#pos-save');
    s = await docs(3);
    check('Gelöschte Nachricht: Sicherung wird neu gesendet', s[2]?.method === 'sendDocument' && s[2].message_id !== s[0].message_id && JSON.parse(s[2].file).positions.length === 5, JSON.stringify(s.map(x => x.method + ':' + x.message_id)));
    await page.waitForTimeout(500);
    const info = await page.evaluate(() => document.getElementById('tgb-info').textContent);
    check('Anzeige: aktiv, zuletzt gesendet', /^Aktiv · zuletzt gesendet/.test(info), info);
    // 3.16.1 – die iPhone-Fälle. Hilfen: Position anlegen, Anzahl bisheriger Sendungen, Positionen in der letzten Datei
    const addPos = async (sym, entry) => { await page.click('#pos-add-toggle'); await page.fill('#pos-symbol', sym); await page.fill('#pos-lev', '5'); await page.fill('#pos-qty', '1'); await page.fill('#pos-entry', entry); await page.click('#pos-save'); };
    const count = async () => (await h.ctl('/sent')).filter(x => x.method === 'sendDocument' || x.method === 'editMessageMedia').length;
    const lastPos = x => { try { return JSON.parse(x.file).positions.length; } catch { return null; } };
    // (a) Eine Datei-Sicherung direkt nach der Änderung setzt den gemeinsamen Änderungszähler auf 0 – Telegram sendet trotzdem
    let n0 = await count(); await addPos('ETC', '18'); await page.waitForTimeout(300);
    await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.evaluate(() => document.getElementById('backup-save').click())]);
    s = await docs(n0 + 1);
    check('Datei-Sicherung dazwischen: Telegram bekommt die Änderung trotzdem', s.length === n0 + 1 && lastPos(s.at(-1)) === 6, JSON.stringify({ vorher: n0, jetzt: s.length, pos: lastPos(s.at(-1)) }));
    // (b) Seite gleich nach der Änderung geschlossen (am iPhone: in eine andere App gewechselt) – beim Verlassen wird gesendet
    n0 = await count(); await addPos('BCH', '330'); await page.waitForTimeout(200); await page.close();
    s = await docs(n0 + 1);
    check('Seite direkt nach der Änderung geschlossen: Sicherung geht beim Verlassen raus', s.length === n0 + 1 && lastPos(s.at(-1)) === 7, JSON.stringify({ vorher: n0, jetzt: s.length, pos: lastPos(s.at(-1)) }));
    // (c) Senden scheitert, Seite wird geschlossen: beim nächsten Öffnen wird nachgeholt
    const reopen = async () => { page = await ctx.newPage(); h.collect(page, errors); await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {}); };
    await reopen(); await tab(page, 'pos'); await h.ctl('/chan?docfail=1'); await addPos('NEAR', '2.4'); await page.waitForTimeout(6000);
    const failed = await page.evaluate(() => document.getElementById('tgb-info').textContent);
    await page.close(); await h.ctl('/chan?docfail=0'); n0 = await count();
    await reopen(); s = await docs(n0 + 1);
    check('Senden gescheitert (Fehler angezeigt), Seite zu: beim nächsten Öffnen nachgeholt', /Fehler 503/.test(failed) && s.length === n0 + 1 && lastPos(s.at(-1)) === 8, JSON.stringify({ anzeige: failed.slice(0, 60), vorher: n0, jetzt: s.length, pos: lastPos(s.at(-1)) }));
    // (d) Nichts geändert: erneutes Öffnen sendet nicht noch einmal
    n0 = await count(); const lastBeforeReload = (await docs(n0)).at(-1); await page.reload(); await page.waitForTimeout(6000);
    const afterReload = await docs(n0), extra = afterReload.length - n0;
    const backupDelta = (() => { try { const a = JSON.parse(lastBeforeReload.file), b = JSON.parse(afterReload.at(-1).file), keys = Object.keys({ ...a.prefs, ...b.prefs }).filter(k => JSON.stringify(a.prefs?.[k]) !== JSON.stringify(b.prefs?.[k])); return { changedPrefs: keys, journalBefore: a.prefs?.['scalpdesk.orderflow-journal.v1']?.records?.length || 0, journalAfter: b.prefs?.['scalpdesk.orderflow-journal.v1']?.records?.length || 0 }; } catch { return { diagnostic: 'Sicherung nicht lesbar' }; } })();
    check('Unverändert: Neuladen sendet nicht doppelt', extra === 0, JSON.stringify({ vorher: n0, jetzt: afterReload.length, ...backupDelta }));
    // die 400-Antwort beim Ersetzen der gelöschten Nachricht meldet der Browser selbst – erwartet
    const real = errors.filter(e => !/status of (400|503)/.test(e));
    check('keine Fehler (außer den erwarteten 400- und 503-Antworten)', !real.length, real.join(' | ')); await ctx.close(); await h.ctl('/orderflow'); await h.ctl('/walk?on=1');
  },
};
(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(tests);
  await h.setup(); await h.sleep(300);
  const browser = await h.launch();
  try { for (const n of names) { console.log(`▶ ${n}`); await h.ctl('/reset'); try { await tests[n](browser); } catch (e) { check(n + ' (Abbruch)', false, e.message.split('\n')[0]); } } }
  finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
