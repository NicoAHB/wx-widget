// Schritt 4.1 – Wirtschaftskalender ohne Browser: Aufbereitung im GitHub-Job (normalize.mjs) und Übergabe an die App,
// Prüfen der Datei, Filter, Warnfenster, Texte („in 8 min“, Tag, Zahlen, deutsche Kurzbeschreibung), Anzeige und Meldung
// genau einmal vor dem Termin. Aufruf: node unit-ec.js (liest js/econcal.js aus dem Scratchpad und den Job aus dem Repository)
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(process.env.SRC || path.join(__dirname, 'js', 'econcal.js'), 'utf8');
const JOB = process.env.JOB || require('path').join(__dirname, '..', '.github/kalender/normalize.mjs');
let pass = 0, fail = 0; const check = (n, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${info ? ' — ' + info : ''}`); };
// kleine Attrappe für Speicher und Dokument
const mem = new Map(), claims = new Set(), calls = { beep: 0, notify: [], chan: [] };
const store = { get: (k, d) => (mem.has(k) ? mem.get(k) : d), set: (k, v) => { mem.set(k, v); return true; }, claim: async k => (claims.has(k) ? false : (claims.add(k), true)) };
const fake = () => ({ value: '', hidden: false, textContent: '', title: '', dataset: {}, kids: [], classList: { on: new Set(), toggle(c, v) { v ? this.on.add(c) : this.on.delete(c); } },
  addEventListener() {}, setAttribute() {}, querySelector() { return null; }, replaceChildren(...k) { this.kids = k; }, append(...k) { for (const x of k) this.kids.push(x); } });
const els = new Map(), $ = id => { if (!els.has(id)) els.set(id, fake()); return els.get(id); };
const el = (tag, cls, text) => Object.assign(fake(), { tag, className: cls, textContent: text === undefined ? '' : text });
const btn = (cls, text) => el('button', cls, text);
const A = new Function('store', '$', 'el', 'btn', 'beep', 'desktopNotify', 'notifyChannels', 'fetch', src + '\nreturn { ecParse, ecFilter, ecWarnGroups, ecIn, ecDay, ecNum, ecDe, renderEcon, ec };')(
  store, $, el, btn, () => { calls.beep++; }, (t, b, k) => calls.notify.push([t, b, k]), async (type, key, text) => calls.chan.push([type, key, text]), async () => { throw new TypeError('offline'); });
const min = 60e3, h = 60 * min, NOW = Date.parse('2026-09-29T12:00:00Z');
(async () => {
  // ---- GitHub-Job: Aufbereitung und Übergabe an die App ----
  const job = await import(JOB);
  const ff = [{ title: 'CPI m/m', country: 'USD', date: '2026-10-01T08:30:00-04:00', impact: 'High', forecast: '0.3%', previous: '0.2%' },
    { title: 'Core CPI m/m', country: 'USD', date: '2026-10-01T08:30:00-04:00', impact: 'High', forecast: '0.3%', previous: '0.3%' },
    { title: 'German Prelim CPI m/m', country: 'EUR', date: '2026-09-29T08:00:00-04:00', impact: 'Medium', forecast: '0.1%', previous: '-0.1%' },
    { title: 'Bank Holiday', country: 'JPY', date: '2026-09-28T00:00:00-04:00', impact: 'Holiday', forecast: '', previous: '' },
    { title: 'President Speaks', country: 'USD', date: '2026-09-30T13:00:00-04:00', impact: 'Non-Economic' },
    { title: 'CPI m/m', country: 'USD', date: '2026-10-01T08:30:00-04:00', impact: 'High', forecast: '0.3%', previous: '0.2%' }, // doppelt
    { title: 'kaputt', country: 'USD', date: 'morgen', impact: 'High' }, { title: '', country: 'USD', date: '2026-10-01T08:30:00-04:00', impact: 'High' }, { title: 'x', country: 'Dollar', date: '2026-10-01T08:30:00-04:00' }];
  const ev = job.normalize([ff, 'kein Array']);
  check('Job: gültige Termine, sortiert, ohne Doppelte und Kaputte', ev.length === 5 && ev.every((e, i) => !i || e.t >= ev[i - 1].t), ev.map(e => e.title).join(' | '));
  check('Job: Zeit aus Datum mit Zeitzone (08:30 New York = 12:30 UTC)', ev.find(e => e.title === 'CPI m/m').t === Date.parse('2026-10-01T12:30:00Z'));
  check('Job: Bedeutung vereinheitlicht (high, medium, holiday, sonst none)', ['high', 'medium', 'holiday', 'none'].every(x => ev.some(e => e.impact === x)) && ev.find(e => e.title === 'President Speaks').impact === 'none', ev.map(e => e.impact).join(','));
  let thrown = ''; try { job.build([path.join(__dirname, 'gibt-es-nicht.json')]); } catch (e) { thrown = e.message; }
  check('Job: ohne gültige Termine Abbruch (bisheriger Stand bleibt)', /keine gültigen Termine/.test(thrown), thrown);
  const tmp = path.join(__dirname, 'ff-test.json'); fs.writeFileSync(tmp, JSON.stringify(ff));
  const out = job.build([tmp, path.join(__dirname, 'gibt-es-nicht.json')], NOW); fs.unlinkSync(tmp);
  const parsed = A.ecParse(JSON.parse(JSON.stringify(out)));
  check('Übergabe: Datei des Jobs liest die App vollständig (Termine, Stand, Quelle)', parsed.events.length === 5 && parsed.fetchedAt === NOW && parsed.source === 'Forex Factory' && out.lists === 1, JSON.stringify({ n: parsed.events.length, at: parsed.fetchedAt, lists: out.lists }));
  // ---- App: Datei prüfen ----
  let err = ''; try { A.ecParse({ hello: 1 }); } catch (e) { err = e.message; }
  check('App: Datei ohne Termine wird abgelehnt', /ohne Termine/.test(err), err);
  const p2 = A.ecParse({ fetchedAt: 'x', events: [{ t: 1, cur: 'USD', impact: 'boom', title: 'A'.repeat(200) }, { t: 'x', cur: 'USD', title: 'B' }, { t: 2, cur: 'usd', title: 'C' }] });
  check('App: nur gültige Termine, unbekannte Bedeutung = none, lange Titel gekürzt', p2.events.length === 1 && p2.events[0].impact === 'none' && p2.events[0].title.length === 90 && p2.fetchedAt === 0);
  // ---- Filter ----
  const T = (dt, cur, impact, title = 'X', extra = {}) => ({ t: NOW + dt, cur, impact, title, forecast: '', previous: '', actual: '', ...extra });
  const list = [T(-2 * h, 'USD', 'high', 'ISM'), T(10 * min, 'USD', 'high', 'CPI m/m'), T(10 * min, 'USD', 'high', 'Core CPI m/m'), T(10 * min, 'USD', 'medium', 'Mittel'),
    T(3 * h, 'EUR', 'high', 'ECB'), T(4 * h, 'USD', 'holiday', 'Bank Holiday'), T(5 * h, 'USD', 'low', 'Leicht')];
  const f1 = A.ecFilter(list, { cur: 'usd', imp: 'high' }).map(e => e.title), f2 = A.ecFilter(list, { cur: 'all', imp: 'medium' }).map(e => e.title);
  check('Filter USD/hoch: ohne EUR, ohne mittel und gering; USD-Feiertag bleibt', f1.join() === 'ISM,CPI m/m,Core CPI m/m,Bank Holiday', f1.join());
  check('Filter alle/hoch + mittel: mit EUR und mittel, ohne gering', f2.join() === 'ISM,CPI m/m,Core CPI m/m,Mittel,ECB,Bank Holiday', f2.join());
  // ---- Warnfenster ----
  const at = (dt, warn = 15) => A.ecWarnGroups([T(dt, 'USD', 'high', 'CPI m/m'), T(dt, 'USD', 'high', 'Core CPI m/m'), T(dt, 'USD', 'medium', 'M')], NOW, warn);
  check('Warnung ab 15 min vorher bis 15 min danach (Grenzen eingeschlossen)', !at(15 * min + 1000).length && at(15 * min).length === 1 && at(0).length === 1 && at(-15 * min).length === 1 && !at(-15 * min - 1000).length);
  check('Termine zur selben Zeit als einer, nur hohe Bedeutung', at(5 * min)[0].list.map(e => e.title).join() === 'CPI m/m,Core CPI m/m');
  check('Einstellung 5 / 60 min und aus', !at(10 * min, 5).length && at(50 * min, 60).length === 1 && !at(1 * min, 0).length);
  // ---- Texte ----
  const ins = [[30e3, 'in 1 min'], [10 * min, 'in 10 min'], [65 * min, 'in 1 h 5 min'], [2 * h, 'in 2 h'], [0, 'jetzt'], [-30e3, 'jetzt'], [-90e3, 'vor 1 min'], [-200 * min, 'vor 3 h 20 min']];
  check('„in 10 min“, „in 1 h 5 min“, „jetzt“, „vor 3 h 20 min“', ins.every(([ms, t]) => A.ecIn(ms) === t), ins.map(([ms]) => A.ecIn(ms)).join(' | '));
  const noon = new Date(2026, 8, 29, 12).getTime();
  check('Tage: Heute, Morgen, Gestern, sonst Wochentag mit Datum', A.ecDay(noon + 3 * h, noon) === 'Heute' && A.ecDay(noon + 20 * h, noon) === 'Morgen' && A.ecDay(noon - 20 * h, noon) === 'Gestern' && A.ecDay(new Date(2026, 9, 2, 9).getTime(), noon) === 'Fr. 02.10.', A.ecDay(new Date(2026, 9, 2, 9).getTime(), noon));
  check('Zahlen deutsch: 0,3 % · 7,65M · -0,1 %', A.ecNum('0.3%') === '0,3 %' && A.ecNum('7.65M') === '7,65M' && A.ecNum('-0.1%') === '-0,1 %' && A.ecNum('145K') === '145K');
  check('Deutsche Kurzbeschreibung zu wichtigen Titeln', A.ecDe('Core CPI m/m') === 'Inflation' && A.ecDe('Non-Farm Employment Change') === 'US-Arbeitsmarkt' && A.ecDe('Federal Funds Rate') === 'Fed-Zinsentscheid' && A.ecDe('Tankan Index') === '');
  // ---- Anzeige und Meldung (Attrappe des Dokuments) ----
  A.ec.data = { fetchedAt: NOW - 40 * min, source: 'Forex Factory', events: list }; A.ec.cfg = { cur: 'usd', imp: 'high', warn: 15 }; A.ec.error = '';
  A.renderEcon(NOW);
  await new Promise(r => setTimeout(r, 10));
  const chip = $('lb-news'), box = $('econ-warn');
  check('Warnung in der Live-Leiste und im Kalender', !chip.hidden && chip.textContent === '⚠ in 10 min: CPI m/m +1' && !box.hidden && /^⚠ in 10 min \(.+\): USD CPI m\/m, Core CPI m\/m – hohe Bedeutung/.test(box.textContent), `${chip.textContent} | ${box.textContent}`);
  check('Vorab gemeldet: Ton, Systemmeldung, Telegram/Discord (Art „news“)', calls.beep === 1 && calls.notify.length === 1 && calls.chan.length === 1 && calls.chan[0][0] === 'news' && /Wirtschaftstermin in 10 min/.test(calls.chan[0][2]) && /USD CPI m\/m, Core CPI m\/m/.test(calls.chan[0][2]), JSON.stringify(calls.chan[0]));
  A.renderEcon(NOW + 30e3); A.renderEcon(NOW + 60e3); await new Promise(r => setTimeout(r, 10));
  check('Nur einmal je Termin gemeldet', calls.beep === 1 && calls.chan.length === 1);
  A.ec.seen.clear(); A.renderEcon(NOW + 90e3); await new Promise(r => setTimeout(r, 10));
  check('Nach dem Neuladen nicht erneut (Sperre im Speicher)', calls.beep === 1 && calls.chan.length === 1);
  A.ec.data.events = [T(-5 * min, 'USD', 'high', 'NFP', { actual: '180K' })]; A.ec.seen.clear(); A.renderEcon(NOW); await new Promise(r => setTimeout(r, 10));
  check('Nach der Veröffentlichung: Warnung „vor 5 min … Ist 180K“, aber keine neue Meldung', !chip.hidden && chip.classList.on.has('now') && /vor 5 min .*Ist 180K: noch bis/.test(box.textContent) && calls.beep === 1, box.textContent);
  A.ec.cfg = { ...A.ec.cfg, warn: 0 }; A.renderEcon(NOW);
  check('Warnen „aus“: keine Warnung', chip.hidden && box.hidden);
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('✗ Abbruch —', e.message); process.exit(1); });
