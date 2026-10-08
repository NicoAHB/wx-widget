// G13: Originalmodell/Quelle/Version erhalten, keine Wiederaktivierung durch Import.
let pass = 0, fail = 0; const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
(async () => {
  const A = await import('../shared/model-archive.mjs'), F = await import('./fixtures/model-archive.mjs'); const original = await F.modelArchiveFixture(), copy = () => structuredClone(original);
  const rejects = input => { try { A.validateModelArchive(input); return false; } catch { return true; } };
  const restored = A.validateModelArchive(original);
  check('Vollständige lokale Originale mit unveränderten IDs/Quellen/Ankern', JSON.stringify(restored.observations) === JSON.stringify(original.observations) && restored.journal[0].id === original.po3Journal[0].id && restored.journal[0].source.anchors['1m'] === original.po3Journal[0].source.anchors['1m']);
  check('Importiertes Bot-Modell deaktiviert, Gewinnsperre/Basis/Ledger bleiben', !restored.bot.enabled && restored.bot.run.stops.gain && restored.bot.run.referenceUSDT === '1000' && restored.bot.commands.length === 3 && !restored.bot.run.automaticTrading);
  check('Validierung verändert Originaldatei nicht', original.bot.enabled && JSON.stringify(original.po3Journal) === JSON.stringify(restored.journal));
  const old = copy(); old.po3Journal[0].modelVersion = 'po3-altes-modell'; check('Alte PO3-Modelle exportierbar, als alte Version erhalten', A.validateModelArchive(old).journal[0].modelVersion === 'po3-altes-modell');
  const model = copy(); model.bot.version = 'unbekannt'; check('Unbekannter Bot-Kern nicht still migriert', rejects(model));
  const identity = copy(); identity.po3Journal[0].source.dataRevision = 'andere'; check('Aktuelle PO3-ID muss eingefrorener Quelle entsprechen', rejects(identity));
  const funding = copy(); funding.po3Journal[0].completeNet = true; check('PO3 vor Funding nicht als vollständiges Netto umlabeln', rejects(funding));
  const observation = copy(); observation.observations[0].data.scope.indicatorAnchors.base++; check('Konfluenz-Originalanker nicht rückwirkend ersetzen', rejects(observation));
  const secret = copy(); secret.apiKey = 'TEST_ONLY'; check('Zugangsdaten im Archiv abgelehnt', rejects(secret));
  const schema = copy(); schema.version++; check('Unbekanntes Archivformat vor Änderung abgelehnt', rejects(schema));
  const automatic = copy(); automatic.bot.run.automaticTrading = true; check('Datei darf kein automatisches Trading freigeben', rejects(automatic));
  const broken = copy(); broken.bot.run.latest.values.fees = '-1'; check('Beschädigte gesicherte Kostenwerte vor Import abgelehnt', rejects(broken));
  console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
