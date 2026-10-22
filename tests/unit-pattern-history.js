// 2.18.0 / Chartmusterdienst 1.4.0 – Lernbestand der Dienste aus dem Kerzenverlauf („als ob live“): vorher blieb er fast leer, daher „0/30 Fälle“.
// Aufruf: node unit-pattern-history.js
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm'), assert = require('assert');
let pass = 0, fail = 0;
const check = (name, fn) => { try { fn(); pass++; console.log('✓ ' + name); } catch (e) { fail++; console.log('✗ ' + name + ' — ' + String(e.message).split('\n')[0]); } };
(async () => {
  const W = await import('../server/scalpdesk-247.mjs'), P = await import('../server/pattern-monitor.mjs'), PK = await import('../shared/pattern-knowledge.mjs');
  const catalog = fs.readFileSync(path.join(__dirname, 'm58.js'), 'utf8');
  const build = vm.runInNewContext(catalog.slice(catalog.indexOf('const BUILD = () => {'), catalog.indexOf('\nconst tests = {')) + '\nBUILD()');
  const STEP = build.STEP, item = { mkt: 'spot', sym: 'BTCUSDT', iv: '1h' };
  // Reihe: dieselbe Formation viermal hintereinander (Preis jeweils fortgeführt), dazwischen eine ruhige Seitwärtsphase
  const repeated = (id, times = 4) => {
    const one = build.path(build.F[id]); let k = [], t = Date.UTC(2026, 0, 1);
    for (let rep = 0; rep < times; rep++) {
      const scale = (k.length ? k.at(-1).c : one[0].c) / one[0].c;
      k = k.concat(one.map((c, i) => ({ t: t + i * STEP, o: c.o * scale, h: c.h * scale, l: c.l * scale, c: c.c * scale, v: c.v }))); t += one.length * STEP;
      for (let i = 0; i < 30; i++) { const last = k.at(-1).c, p = last * (1 + (i % 2 ? .001 : -.001)); k.push({ t, o: last, h: Math.max(last, p) * 1.0005, l: Math.min(last, p) * .9995, c: p, v: 80 }); t += STEP; }
    }
    return k;
  };
  const NOW = Date.UTC(2026, 5, 1), k = repeated('flag_bear'), cases = P.patternHistory(k, item, NOW), flags = cases.filter(c => c.pat === 'flag_bear');

  check('Verlauf: wiederholte Formationen werden einzeln gefunden (ein Fensterdurchlauf fand höchstens die jüngste)', () => assert.ok(flags.length >= 3, `${flags.length} Bärische Flaggen`));
  check('Jeder Fall: Richtung, Regelgüte ≥ 80, Quelle „rekonstruiert“, Fall-ID wie im Archiv-Vertrag, Ergebnis vorhanden', () => assert.ok(cases.every(c => ['bull', 'bear'].includes(c.dir) && c.q >= 80 && c.src === 'rekonstruiert' && c.id === W.caseId(c) && c.kind === 'form' && c.model === 'pat-1' && W.caseValid(c) && c.res && ['auf', 'ab', 'seitwärts'].includes(c.res.out))));
  check('Keine doppelten Fälle (gleiche ID einmal)', () => assert.strictEqual(new Set(cases.map(c => c.id)).size, cases.length));
  check('Ergebnis wie bei Live-Fällen: Schlusskurs 12 Kerzen nach der Bestätigung gegen ±0,10 %, 13 Pfadpunkte', () => {
    for (const c of cases) { const i = k.findIndex(x => x.t === c.tc), r = (k[i + 12].c / c.p0 - 1) * 100; assert.strictEqual(c.res.path.length, 13); assert.ok(Math.abs(c.res.r - r) < 1e-3); assert.strictEqual(c.res.out, r > .1 ? 'auf' : r < -.1 ? 'ab' : 'seitwärts'); }
  });
  check('Kein Blick in die Zukunft: Mit den Kerzen bis höchstens eine Kerze nach der Bestätigung hätte der Dienst denselben Fall frisch gemeldet', () => {
    for (const c of flags) { const i = k.findIndex(x => x.t === c.tc), seen = [i + 1, i + 2].some(len => { const part = k.slice(0, len), now = P.patternEnd(part.at(-1).t, '1h') + 2000; return part.length >= 40 && P.patternCases(part, item, now).some(x => x.c.id === c.id); }); assert.ok(seen, c.id); }
  });
  check('Ergebnis erst, wenn die 12. Kerze nach der Bestätigung da ist (sonst null)', () => { const i = k.length - 5; assert.strictEqual(P.patternOutcome(k, i, k[i].c, NOW), null); assert.ok(P.patternOutcome(k, k.length - 13, k.at(-13).c, NOW)); });
  check('Zu kurze Reihe: keine Fälle', () => assert.deepStrictEqual(P.patternHistory(k.slice(0, 45), item, NOW), []));

  // Archiv: offene Fälle, selbst auswerten, Neustart
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hist-')), file = path.join(dir, 'patterns-journal.jsonl');
  let arch = new W.PatternArchive({ file }), r = arch.add(cases);
  check('Archiv: Verlaufsfälle mit Ergebnis werden gespeichert, keiner bleibt offen', () => assert.ok(r.stored === cases.length && arch.pending.size === 0));
  const live = { ...flags[0], id: null, t0: flags[0].t0 + 1, t1: flags[0].t1 + 1, src: 'live', res: null }; live.id = W.caseId(live);
  r = arch.add([live]);
  check('Archiv: ein frischer Fall ohne Ergebnis steht in „offen“', () => assert.ok(r.stored === 1 && arch.pending.has(live.id)));
  const fake = { arch, patternLearnAt: new Map(), log: () => {} };
  W.Watcher.prototype.learnPatterns.call(fake, item, k.map(x => ({ ...x })), NOW);
  check('Dienst wertet den offenen Fall selbst aus (Ergebnis nach 12 Kerzen) und legt es im Archiv ab', () => { assert.strictEqual(arch.pending.size, 0); const e = arch.export().find(c => c.id === live.id); assert.ok(e?.res && ['auf', 'ab', 'seitwärts'].includes(e.res.out)); });
  const before = arch.export().length; W.Watcher.prototype.learnPatterns.call(fake, item, k, NOW + 1000);
  check('Verlauf höchstens einmal je 12 Stunden und Markt; derselbe Verlauf ändert nichts (gleiche ID zählt einmal)', () => { assert.strictEqual(arch.export().length, before); W.Watcher.prototype.learnPatterns.call(fake, item, k, NOW + 13 * 36e5); assert.strictEqual(arch.export().length, before); });
  const again = new W.PatternArchive({ file });
  check('Nach einem Neustart: Fälle und Ergebnisse stehen im Archiv, nichts ist offen', () => { assert.strictEqual(again.export().length, arch.export().length); assert.strictEqual(again.pending.size, 0); });
  const open = { ...live, id: null, t0: live.t0 + 5, t1: live.t1 + 5 }; open.id = W.caseId(open); again.add([open]);
  check('Nach einem Neustart bleibt ein offener Fall offen und wird weiter ausgewertet', () => { const third = new W.PatternArchive({ file }); assert.ok(third.pending.has(open.id)); assert.ok(third.resolve(open.id, { at: NOW, tH: 1, ph: 1, r: 0.5, out: 'auf', path: [0] })); assert.ok(!third.resolve(open.id, { out: 'ab' })); assert.strictEqual(new W.PatternArchive({ file }).pending.size, 0); });

  check('Archivstatus nennt je Muster, Zeitrahmen und Richtung die Zahl der Fälle und der Fälle mit Ergebnis', () => {
    const st = arch.status(), row = st.patterns.find(x => x.pat === 'flag_bear' && x.iv === '1h' && x.dir === 'bear');
    assert.ok(row && row.n >= 3 && row.done >= 3 && st.count === arch.idx.size, JSON.stringify(st.patterns.slice(0, 3)));
  });
  // Chartmusterdienst (eigene Einheit): Lernbestand im Zustand
  const O = await import('../server/patterns-247.mjs'), own = { state: { cases: {} }, learnAt: new Map(), now: () => NOW, log: () => {} };
  O.PatternsOnlyService.prototype.learn.call(own, item, k);
  check('Chartmusterdienst: Verlaufsfälle im Lernbestand (mit Ergebnis), nicht doppelt, höchstens einmal je 12 Stunden', () => {
    const n = Object.keys(own.state.cases).length; assert.ok(n >= 3 && Object.values(own.state.cases).every(c => c.res && c.src === 'rekonstruiert'), String(n));
    O.PatternsOnlyService.prototype.learn.call(own, item, k); assert.strictEqual(Object.keys(own.state.cases).length, n);
    own.now = () => NOW + 13 * 36e5; O.PatternsOnlyService.prototype.learn.call(own, item, k); assert.strictEqual(Object.keys(own.state.cases).length, n);
  });

  // Wirkung auf die Meldung: aus „0/30“ wird die tatsächliche Zahl der bekannten Fälle
  const sel = { pat: 'flag_bear', iv: '1h', dir: 'bear', sym: 'BTCUSDT', mkt: 'spot', model: 'pat-1', profile: 'H12-e0.10' };
  check('Meldung: Zahl der bekannten Fälle dieses Musters statt 0 (unter 30 weiter „noch nicht bewertet“)', () => {
    const L = PK.patternLearned(arch.export(), sel); assert.ok(L.available >= 3 && L.minimum === 30, JSON.stringify(L));
    const empty = PK.patternLearned([], sel); assert.strictEqual(empty.available, 0);
  });
  check('Ab 30 Fällen zählt die Quote je Muster über alle Coins (aus Verlaufsfällen)', () => {
    const many = []; for (let i = 0; i < 36; i++) { const c = { ...flags[0], sym: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'][i % 3], tc: flags[0].tc + i * 3600e3, res: { ...flags[0].res, out: i % 3 === 0 ? 'ab' : 'auf' } }; c.id = W.caseId(c); many.push(c); }
    const L = PK.patternLearned(many, sel); assert.ok(L.available === undefined && L.total === 36 && L.source === 'rekonstruiert', JSON.stringify(L));
  });
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('✗ Abbruch — ' + e.stack); process.exit(1); });
