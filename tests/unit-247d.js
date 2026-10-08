// 24/7-Dienst 2.1 (G09 C4): Muster-Archiv – Originaljournal getrennt von der Alarmkonfiguration, nur anhängend, gleiche Fall-ID
// zählt einmal, Ergebnis angehängt, Konflikt protokolliert, fehlerhafte Zeilen in Quarantäne, unabhängige Sicherung mit
// Prüfsumme, Wiederherstellung aus der Sicherung, HTTP-Endpunkte nur mit Schlüssel, bereinigter Export.
// Aufruf: node unit-247d.js
process.env.TZ = 'UTC';
const fs = require('fs'), path = require('path'), os = require('os');
let pass = 0, fail = 0; const check = (n, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${info ? ' — ' + String(info).slice(0, 400) : ''}`); };
const KEY = 'k'.repeat(20) + 'Zz09_-abcdefghijklmnopq', ORIGIN = 'https://nicoahb.github.io';
(async () => {
  const W = await import(path.join(__dirname, '..', 'server/scalpdesk-247.mjs'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 's247d-')), bak = path.join(dir, 'sicherung'), file = path.join(dir, 'daten', 'patterns-journal.jsonl'), logs = [];
  const mk = (i, res = null, extra = {}) => { const c = { mkt: 'spot', sym: 'BTCUSDT', iv: '1h', pat: 'double_bottom', kind: 'form', dir: 'bull', t0: 1e12 + i * 1e7, t1: 1e12 + i * 1e7 + 5e6, tc: 1e12 + i * 1e7 + 6e6, p0: 64000, model: 'pat-1', profile: 'H12-e0.10', q: 80, src: 'live', rules: [['Regel', 2, true]], res, ...extra }; c.id = W.caseId(c); return c; };
  const R = out => ({ at: 1, tH: 2, ph: 64100, r: out === 'auf' ? 0.5 : -0.5, out, path: [0, 0.5] });
  let A = new W.PatternArchive({ file, backupDir: bak, log: m => logs.push(m) });
  let r = A.add([mk(1), mk(2, R('ab')), mk(3, R('auf'))]);
  check('Drei neue Fälle gespeichert, darunter ein negativer', r.stored === 3 && A.status().count === 3 && A.status().results === 2, JSON.stringify(r));
  r = A.add([mk(1), mk(2, R('ab'))]);
  check('Erneut gesendet: gleiche IDs zählen nicht doppelt', r.dup === 2 && r.stored === 0 && A.status().count === 3, JSON.stringify(r));
  r = A.add([mk(1, R('auf'))]);
  check('Fehlendes Ergebnis wird angehängt (Fall bleibt, Prognose unverändert)', r.results === 1 && A.status().results === 3, JSON.stringify(r));
  r = A.add([mk(2, R('auf'))]);
  check('Widersprechendes Ergebnis: als Konflikt protokolliert, Stand bleibt „ab“', r.conflicts === 1 && A.export().find(c => c.id === mk(2).id).res.out === 'ab', JSON.stringify(r));
  r = A.add([{ ...mk(4), id: 'gefälscht' }, { ...mk(5), p0: -1 }, null, 'x']);
  check('Ungültige Fälle (falsche ID, Preis ≤ 0, kein Objekt) abgelehnt', r.rejected === 4 && A.status().count === 3, JSON.stringify(r));
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n').map(l => JSON.parse(l).t);
  check('Journal nur anhängend: Fälle, Ergebnis und Konflikt als eigene Zeilen', JSON.stringify(lines) === JSON.stringify(['case', 'case', 'case', 'res', 'conflict']), lines.join(','));
  const b = A.backupNow();
  check('Unabhängige Sicherung im eigenen Ordner, Prüfsumme nach dem Zurücklesen gleich', b.ok === true && fs.readFileSync(path.join(bak, 'patterns-journal.jsonl'), 'utf8') === fs.readFileSync(file, 'utf8'), JSON.stringify(b));
  // fehlerhafte Zeile: in Quarantäne kopiert, nichts gelöscht
  fs.appendFileSync(file, '{kaputt\n'); A = new W.PatternArchive({ file, backupDir: bak, log: m => logs.push(m) });
  check('Fehlerhafte Zeile: in Quarantäne kopiert, bleibt im Journal, übrige Fälle geladen', A.status().bad === 1 && fs.readFileSync(file + '.quarantine', 'utf8').includes('{kaputt') && fs.readFileSync(file, 'utf8').includes('{kaputt') && A.status().count === 3, JSON.stringify(A.status()));
  // Wiederherstellung: Journal fehlt → aus der Sicherung
  fs.rmSync(file); A = new W.PatternArchive({ file, backupDir: bak, log: m => logs.push(m) });
  check('Journal weg: beim Start aus der Sicherung wiederhergestellt, alle Fälle wieder da', A.status().restored && A.status().count === 3 && logs.some(l => /wiederhergestellt/.test(l)), JSON.stringify(A.status()));
  const ex = A.export();
  check('Export bereinigt: nur Marktdaten (keine Regeltexte), je Fall ein Ergebnisstand', ex.length === 3 && ex.every(c => !('rules' in c) && c.sym === 'BTCUSDT') && ex.find(c => c.id === mk(1).id).res.out === 'auf', JSON.stringify(ex[0]));
  const noBak = new W.PatternArchive({ file: path.join(dir, 'x', 'j.jsonl') });
  check('Ohne Sicherungsordner: ehrlich „kein Sicherungsordner eingerichtet“', noBak.backupNow().ok === false && /kein Sicherungsordner/.test(noBak.backup.why));
  // HTTP: getrennte Datei neben dem Zustand, nur mit Schlüssel
  const statePath = path.join(dir, 'svc', 'state.json'); process.env.SCALPDESK_PATTERN_BACKUP = path.join(dir, 'svc-sicherung');
  const w = new W.Watcher({ token: '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw', chat: '1', key: KEY, origins: [ORIGIN], listen: '127.0.0.1:0', host: 'test.sslip.io', statePath, log: () => {} });
  const port = await w.listenNow(), U = p => `http://127.0.0.1:${port}${p}`;
  const call = async (p, { method = 'GET', body, key = KEY } = {}) => { const res = await fetch(U(p), { method, headers: { ...(key ? { authorization: `Bearer ${key}` } : {}), 'content-type': 'application/json', origin: ORIGIN }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: res.status, j: await res.json().catch(() => null) }; };
  let x = await call('/v1/patterns/cases', { method: 'POST', body: { cases: [mk(7), mk(8, R('ab'))] }, key: 'falsch'.repeat(8) });
  check('Ohne gültigen Schlüssel: 401', x.status === 401);
  x = await call('/v1/patterns/cases', { method: 'POST', body: { cases: [mk(7), mk(8, R('ab'))] } });
  check('POST /v1/patterns/cases speichert in eigener Datei neben dem Zustand (nicht in der Alarmkonfiguration)', x.status === 200 && x.j.stored === 2 && x.j.count === 2 && fs.existsSync(path.join(dir, 'svc', 'patterns-journal.jsonl')) && !fs.readFileSync(path.join(dir, 'svc', 'patterns-journal.jsonl'), 'utf8').includes('course-alert'), JSON.stringify(x.j));
  await new Promise(r2 => setTimeout(r2, 3300));
  x = await call('/v1/patterns/status');
  check('GET /v1/patterns/status: Anzahl und Sicherung (geprüft)', x.status === 200 && x.j.count === 2 && x.j.backup.ok === true, JSON.stringify(x.j));
  x = await call('/v1/patterns/export');
  check('GET /v1/patterns/export: bereinigter Bestand', x.status === 200 && x.j.cases.length === 2 && x.j.cases.every(c => !('rules' in c)), JSON.stringify(x.j).slice(0, 200));
  // 2.3.0 (Optimierung 8): Alarm bei Kerzenschluss – nur der Schlusskurs der letzten abgeschlossenen Kerze nach dem Scharfschalten
  { const K = (t, h, c) => [t, '100', String(h), '99', String(c), '1', t + 9e5 - 1], a = { dir: 'above', price: 101, cl: '15m' }, T0 = 1.8e12;
    const wick = W.closeHit(a, [K(T0, 101.5, 100.5), K(T0 + 9e5, 100.8, 100.6)], T0 - 1, T0 + 9e5 + 5000), close = W.closeHit(a, [K(T0, 101.5, 101.2), K(T0 + 9e5, 101.4, 101.3)], T0 - 1, T0 + 9e5 + 5000);
    const before = W.closeHit(a, [K(T0, 101.5, 101.2), K(T0 + 9e5, 101.4, 101.3)], T0 + 9e5, T0 + 9e5 + 5000), below = W.closeHit({ dir: 'below', price: 99.5, cl: '1h' }, [K(T0, 100, 99.4), K(T0 + 9e5, 100, 99.6)], T0 - 1, T0 + 9e5 + 5000);
    check('Schluss-Alarm: Docht über der Marke, Schluss darunter → nein; Schluss über der Marke → ja; Kerze schloss vor dem Scharfschalten → nein; „fällt unter“ spiegelbildlich; laufende Kerze zählt nicht', wick.hit === false && close.hit === true && close.price === 101.2 && before.hit === false && below.hit === true && below.price === 99.4 && W.CL_MS['15m'] === 9e5 && W.VERSION === '2.8.0', JSON.stringify({ wick, close, before, below })); }
  w.server.close(); w.stopped = true;
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exit(fail ? 1 : 0);
})();
