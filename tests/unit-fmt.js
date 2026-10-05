// 3.21.1: wiederverwendete Formatierer liefern genau dasselbe wie toLocaleString mit Optionen – in Node und in Chromium.
// Vergleich alte gegen neue Fassung von number(), plain(), utcTime(), utcDate() über viele Werte. Aufruf: node unit-fmt.js
const { chromium } = (() => { try { return require('playwright'); } catch { return require('/opt/node22/lib/node_modules/playwright'); } })();
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
function compare() {
  const oldNumber = (x, decimals = 2) => x === null || !Number.isFinite(x) ? '—' : x.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const oldPlain = x => Number.isFinite(x) ? x.toLocaleString('de-DE', { maximumFractionDigits: 10, useGrouping: false }) : '';
  const oldTime = ms => new Date(ms).toLocaleTimeString('de-DE', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const oldDate = ms => new Date(ms).toLocaleString('de-DE', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  // neue Fassung wie in der App
  const NUM_F = new Map();
  const number = (x, decimals = 2) => { if (x === null || !Number.isFinite(x)) return '—'; let f = NUM_F.get(decimals); if (!f) NUM_F.set(decimals, f = new Intl.NumberFormat('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })); return f.format(x); };
  const UTC_T = new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit' }), UTC_D = new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fmtDate = (f, ms) => { const d = new Date(ms); return Number.isNaN(d.getTime()) ? 'Invalid Date' : f.format(d); };
  const utcTime = ms => fmtDate(UTC_T, ms), utcDate = ms => fmtDate(UTC_D, ms);
  const PLAIN_F = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 10, useGrouping: false });
  const plain = x => Number.isFinite(x) ? PLAIN_F.format(x) : '';
  // Werte: Grenzfälle und viele Zufallszahlen über alle Größenordnungen
  let seed = 42; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const nums = [0, -0, 1, -1, 0.5, 0.005, 0.0049999, 1.005, 2.675, 999.995, 1e21, -1e21, 1e-7, 123456789.123456, 64123.9, 0.000012345, NaN, Infinity, -Infinity, null, undefined, '5', true, 7n];
  for (let i = 0; i < 4000; i++) { const e = Math.floor(rnd() * 24) - 12, v = (rnd() - 0.3) * 10 ** e; nums.push(v, Math.round(v * 100) / 100); }
  const decs = [undefined, 0, 1, 2, 3, 4, 5, 6, 8, 10];
  const same = (a, b) => { let ea = null, eb = null, ra, rb; try { ra = a(); } catch (e) { ea = e.constructor.name; } try { rb = b(); } catch (e) { eb = e.constructor.name; } return ea || eb ? ea === eb : ra === rb; };
  const bad = { number: [], plain: [], time: [], date: [] }; let n = 0;
  for (const x of nums) for (const d of decs) { n++; if (!same(() => oldNumber(x, d), () => number(x, d))) bad.number.push(`${String(x)}/${d}`); }
  for (const x of nums) { n++; if (!same(() => oldPlain(x), () => plain(x))) bad.plain.push(String(x)); }
  const times = [0, -1, 1e12, Date.UTC(2026, 8, 30, 3, 40, 5), Date.UTC(1999, 11, 31, 23, 59, 59), 8.64e15, 8.64e15 + 1, NaN, undefined, null, '2026-09-30T04:00:00Z', 'kein Datum', new Date(5e11)];
  for (let i = 0; i < 3000; i++) times.push(Math.floor(rnd() * 4e12));
  for (const t of times) { n += 2; if (!same(() => oldTime(t), () => utcTime(t))) bad.time.push(String(t)); if (!same(() => oldDate(t), () => utcDate(t))) bad.date.push(String(t)); }
  return { n, bad, sample: [number(64123.456), number(0.00012345, 8), plain(0.1 + 0.2), utcTime(Date.UTC(2026, 8, 30, 3, 40, 5)), utcDate(Date.UTC(2026, 8, 30, 3, 40)), utcTime(NaN)] };
}
(async () => {
  const node = compare();
  check(`Node: alle ${node.n} Vergleiche gleich (number, plain, utcTime, utcDate)`, Object.values(node.bad).every(b => !b.length), JSON.stringify(node.bad).slice(0, 300));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const br = await page.evaluate(`(${compare.toString()})()`);
    check(`Chromium: alle ${br.n} Vergleiche gleich (number, plain, utcTime, utcDate)`, Object.values(br.bad).every(b => !b.length), JSON.stringify(br.bad).slice(0, 300));
    check('Beispiele wie gewohnt', br.sample.join(' | ') === '64.123,46 | 0,00012345 | 0,3 | 03:40:05 | 30.09.2026, 03:40 | Invalid Date', br.sample.join(' | '));
    // Tempo: 20.000 Formatierungen alt gegen neu
    const speed = await page.evaluate(() => {
      const xs = Array.from({ length: 20000 }, (_, i) => 60000 + i * 0.37);
      let t = performance.now(); for (const x of xs) x.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); const old = performance.now() - t;
      const f = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      t = performance.now(); for (const x of xs) f.format(x); const neu = performance.now() - t;
      return { alt: Math.round(old), neu: Math.round(neu) };
    });
    check('Schneller: 20.000 Zahlen mit wiederverwendetem Formatierer mindestens 5× schneller', speed.alt >= 5 * Math.max(1, speed.neu), `alt ${speed.alt} ms, neu ${speed.neu} ms`);
  } finally { await browser.close(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
