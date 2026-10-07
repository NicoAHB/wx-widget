// G09 C5: Veröffentlichung des Musterwissens (server/muster-export.mjs) – nur Zählungen je Markt|Coin|Intervall|Muster, live und
// rekonstruiert getrennt, Grenzen (Manifest ≤ 64 KiB, Dateien ≤ 256 KiB), Revision zählt hoch, ungültige Eingaben abgelehnt,
// Aufruf von der Kommandozeile schreibt data/muster/ und ersetzt alte Statistikdateien.
// Aufruf: node unit-pub.js
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
let pass = 0, fail = 0; const check = (n, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${info ? ' — ' + String(info).slice(0, 400) : ''}`); };
(async () => {
  const X = await import(path.join(__dirname, '..', 'server/muster-export.mjs'));
  const mk = (i, out, extra = {}) => ({ id: `c${i}`, mkt: 'spot', sym: 'BTCUSDT', iv: '1h', pat: 'double_bottom', kind: 'form', dir: 'bull', t0: 1e12 + i, t1: 1e12 + i + 1, tc: 1e12 + i * 1e6, p0: 64000, model: 'pat-1', profile: 'H12-e0.10', q: 80, src: 'live', res: out ? { at: 1, tH: 2, ph: 64100, r: 0.5, out, path: [0, 0.5] } : null, ...extra });
  const cases = [mk(1, 'auf'), mk(2, 'ab'), mk(3, 'seitwärts'), mk(4, null), mk(5, 'auf', { src: 'rekonstruiert' }), mk(6, 'auf', { sym: 'ETHUSDT' }), mk(7, 'auf', { model: 'pat-0' }), null];
  const r = X.buildPublication({ cases }, { rev: 4 }, 1.9e12), g = JSON.parse(r.files[0].body).groups['spot|BTCUSDT|1h|double_bottom'];
  check('Zählungen je Gruppe, live und rekonstruiert getrennt, offene Fälle extra', g.live.n === 3 && g.live.auf === 1 && g.live.ab === 1 && g.live.sw === 1 && g.live.offen === 1 && g.rek.n === 1 && g.rek.auf === 1, JSON.stringify(g));
  check('Fremdes Modell und kaputte Einträge zählen nicht; Revision zählt hoch; Datum und Stand (until) gesetzt', r.manifest.groups === 2 && r.manifest.rev === 5 && r.manifest.date === 1.9e12 && r.manifest.until === 1e12 + 6e6 && r.manifest.resolved === 5 && r.manifest.cases === 6, JSON.stringify(r.manifest));
  const body = r.mBody + r.files.map(f => f.body).join('');
  check('Keine Einzelkurse, Regeln oder Verläufe im veröffentlichten Bestand', !/64000|64100|p0|path|rules/.test(body), body.slice(0, 200));
  let err = ''; try { X.buildPublication({ foo: 1 }); } catch (e) { err = e.message; }
  check('Ungültige Exportdatei wird abgelehnt', /cases/.test(err), err);
  const many = Array.from({ length: 12000 }, (_, i) => mk(i, 'auf', { sym: `C${i}USDT` })), big = X.buildPublication({ cases: many }, null, 2e12);
  check('Großer Bestand: mehrere Statistikdateien je ≤ 256 KiB, Manifest ≤ 64 KiB (kompakte Zuordnung), Revision 1', big.files.length > 1 && big.files.every(f => Buffer.byteLength(f.body) <= X.LIMITS.file) && Buffer.byteLength(big.mBody) <= X.LIMITS.manifest && big.manifest.rev === 1 && big.manifest.files.every(f => f.first && f.last), `${big.files.length} Dateien, Manifest ${Buffer.byteLength(big.mBody)} B`);
  const keys = big.files.map(f => Object.keys(JSON.parse(f.body).groups)), m = big.manifest.files;
  check('Zuordnung im Manifest trifft jede Gruppe genau einer Datei', keys.every((ks, i) => ks.every(k => m.filter(f => k >= f.first && k <= f.last).length === 1 && k >= m[i].first && k <= m[i].last)));
  // Kommandozeile: schreibt data/muster/, ersetzt alte Statistikdateien, Revision aus vorhandenem Manifest
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pub-')), src = path.join(dir, 'export.json'), out = path.join(dir, 'data', 'muster');
  fs.writeFileSync(src, JSON.stringify({ ok: true, cases })); fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'stats-9.json'), '{}');
  const cli = () => execFileSync(process.execPath, [path.join(__dirname, '..', 'server/muster-export.mjs'), src, out], { encoding: 'utf8' });
  const t1 = cli(), t2 = cli(), man = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
  check('Kommandozeile: Manifest + stats-1.json geschrieben, alte Datei ersetzt, Revision 1 → 2', man.rev === 2 && fs.existsSync(path.join(out, 'stats-1.json')) && !fs.existsSync(path.join(out, 'stats-9.json')) && /Revision 1:/.test(t1) && /Revision 2: 6 Fälle/.test(t2), t2.trim());
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exit(fail ? 1 : 0);
})();
