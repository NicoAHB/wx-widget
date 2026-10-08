// Netto-Verteilung: gleiche Kohorte, spätere Daten, vollständige Kosten und keine Optimierung.
let pass = 0, fail = 0; const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
(async () => {
 const { resultEvidence: evidence } = await import('../shared/confluence-evidence.mjs');
 const cases = Array.from({ length: 30 }, (_, i) => ({ id: String(i), observationKey: 'modell-a', threshold: 70, decisionAt: i + 10, entryAt: i + 11, maxHoldMs: 10, resolvedAt: i + 20, outcome: i % 2 ? 'tp' : 'sl', costsComplete: true, costKind: 'history', netR: i % 2 ? 1 : -1 })), args = { key: 'modell-a', threshold: 70, asOf: 100, from: 0 }, raw = JSON.stringify(cases);
 const full = evidence(cases, args);
 check('30 vollständige Kostenfälle: Mittel/Median und Nettoanteil berechnet', full.complete === 30 && full.meanR === 0 && full.medianR === 0 && full.netPositivePercent === 50);
 check('Verteilung zeigt Verlust-/Gewinnspanne', full.p10R === -1 && full.p90R === 1);
 check('Keine Kennzahlen unter 30 Fällen', evidence(cases.slice(0, 29), args).meanR === null);
 check('Andere Modelle bleiben getrennt', evidence([...cases, { ...cases[0], id: 'andere', observationKey: 'modell-b', netR: 100 }], args).meanR === 0);
 check('Andere Schwellen bleiben getrennt', evidence(cases, { ...args, threshold: 80 }).n === 0);
 check('Nachträgliche Dubletten zählen einmal', evidence([...cases, cases[0]], args).n === 30);
 check('Widersprüchliche IDs aus Kennzahlen ausgeschlossen', evidence([...cases, { ...cases[0], netR: 100 }], args).conflicts === 1 && evidence([...cases, { ...cases[0], netR: 100 }], args).meanR === null);
 check('Unreife Haltedauer nicht auswertbar, auch bei bekanntem frühem TP', evidence(cases, { ...args, asOf: 40 }).immature === 10);
 check('Kurslücke transparent', evidence([{ ...cases[0], outcome: 'gap' }], args).gaps === 1);
 check('Fundinglücke blockiert Verteilung statt Nullkosten anzunehmen', evidence([...cases.slice(0, 29), { ...cases[29], costsComplete: false }], args).incompleteCosts === 1 && evidence([...cases.slice(0, 29), { ...cases[29], costsComplete: false }], args).meanR === null);
 check('Szenario-Funding ersetzt keine historischen Kosten', evidence(cases.map(x => ({ ...x, costKind: 'scenario' })), args).complete === 0);
 check('Vorwärtsfenster enthält ausschließlich Entscheidungen ab gewähltem Zeitpunkt', evidence(cases, { ...args, from: 30 }).n === 10 && evidence(cases, { ...args, from: 30 }).period.from === 30);
 check('Auflösung außerhalb Haltedauer ausgeschlossen', evidence([{ ...cases[0], resolvedAt: 99 }], args).gaps === 1);
 check('Vorzeitiger Timeout nicht als Ergebnis gezählt', evidence([{ ...cases[0], outcome: 'timeout', resolvedAt: cases[0].entryAt + 1 }], args).gaps === 1);
 check('Leere Kohorte: keine positive Statistik', evidence([], args).meanR === null);
 let rejected = false; try { evidence(cases, { ...args, from: 101 }); } catch { rejected = true; } check('Zukünftiges Prüfzeitfenster nicht akzeptiert', rejected);
 check('Hypothetischer Kostenumfang und abhängige Signale ausdrücklich benannt', /Hypothetische.*Gebühren.*Slippage.*Funding.*korrelierte/.test(full.label));
 check('Originalfälle bytegleich erhalten', JSON.stringify(cases) === raw);
 console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
