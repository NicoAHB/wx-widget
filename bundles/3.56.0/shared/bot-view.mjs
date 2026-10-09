// G12: lokale/Oracle-Laufsimulation. Keine privaten Schlüssel, Orders oder automatischen Moduswechsel.
const doc = () => globalThis.document;
function el(tag, text = '', className = '') { const n = doc().createElement(tag); n.textContent = text; n.className = className; return n; }
const date = x => Number.isFinite(x) ? new Date(x).toLocaleString('de-DE') : 'noch kein Lauf';
const decimal = input => input.value.trim().replace(',', '.');
export function createBotView({ host, globalHost, load, command, exportState, currentSymbol, fxReference, changed, destination = 'local' }) {
  const state = { confirmed: null, destination: destination === 'oracle' ? 'oracle' : 'local', busy: false, message: 'Bot deaktiviert. Simulation einrichten; Demo/Echtgeld gesperrt.' };
  const root = el('section', '', 'bot-view'); root.id = 'bot-view'; root.append(el('h2', 'Trading-Bot'), el('p', 'Modelllauf einrichten → Simulation aktivieren → bewusst starten.', 'bot-intro'));
  const help = el('details', '', 'ki-info'); help.append(el('summary', 'Modus, Stopps und Handlung'), el('p', 'Simulation prüft deine selbst eingegebenen Modellwerte und Laufgrenzen. Sie führt keine Börsenorders aus und simuliert keine automatischen Strategie-Fills. Automatische Trades sind AUS.'),
    el('p', 'Gewinn/Verlust einschließlich Gleichheit: keine neuen Einstiege oder Bot-Bestand schließen. In dieser Simulation wird die Schließwirkung ausdrücklich modelliert; sie ist keine belegte Ausführung. Neue Einzahlung und neuer FX verändern die festgehaltene Laufbasis nicht.'),
    el('p', 'Stopps bleiben nach Kursrückkehr und Neustart verriegelt. Bei Bestandskonflikt: keine neuen Orders und keine Ausgleichsorders. Bereits liegende Schutzorders bleiben bestehen und können auslösen. Nach zehn Sekunden ohne belegten Abgleich dauerhaft pausiert.'),
    el('p', 'Empfehlung: Grenzen zunächst in der Simulation prüfen. Für Demo/Echtgeld fehlen privater Oracle-Executor und bestätigte Kontotyp-/Positionsmodus-/Risikoeinrichtung. Keine Bitget-Schlüssel oder Passwörter in diesem Browser eingeben.')); root.append(help);
  const fields = {}, limits = {}, edited = new Set(), restored = new Set();
  function group(id, title, note, parent = root) { const box = el('fieldset', '', 'bot-group'); box.id = 'bot-group-' + id; box.append(el('legend', title));
    if (note) box.append(el('p', note, 'bot-hint')); const grid = el('div', '', 'bot-grid'); box.append(grid); parent.append(box); return grid; }
  let grid = group('mode', '1 · Modus und Strategie', 'Nur Simulation. Das Strategieprofil bereitet Regeln vor; automatische Strategie-Trades werden noch nicht ausgeführt.');
  function field(key, title, value = '', choices = null, hint = '') { const label = el('label', '', 'bot-field'), input = el(choices ? 'select' : 'input'); input.id = 'bot-' + key; label.htmlFor = input.id;
    const titleNode = el('span', title, 'bot-field-title'); titleNode.id = input.id + '-title'; input.setAttribute('aria-labelledby', titleNode.id); label.append(titleNode);
    if (choices) for (const [v, text] of choices) { const o = el('option', text); o.value = v; input.append(o); } else { input.type = 'text'; input.inputMode = 'decimal'; input.maxLength = 64; }
    input.value = value; fields[key] = input; label.append(input);
    if (hint) { const note = el('small', hint, 'bot-hint'); note.id = input.id + '-hint'; input.setAttribute('aria-describedby', note.id); label.append(note); }
    for (const event of ['input', 'change']) input.addEventListener(event, () => edited.add(key)); grid.append(label); return input; }
  field('destination', 'Speicherort', state.destination, [['local', 'Lokal auf diesem Gerät'], ['oracle', 'Oracle-Server']], 'Lokal: eigener Modelllauf. Oracle: serverbestätigt, nur mit eingerichtetem Dienst.');
  field('mode', 'Modus', 'simulation', [['simulation', 'Simulation'], ['demo', 'Bitget-Demo · gesperrt'], ['live', 'Echtgeld · gesperrt']], 'Die Simulation sendet keine Börsenorders.');
  field('strategy', 'Strategieprofil', 'confluence', [['confluence', 'Konfluenz'], ['po3', 'Power of Three']], 'Startwert: Konfluenz. Nur Vorbereitung, kein automatischer Executor.');
  field('direction', 'Handelsrichtung', 'both', [['both', 'Long + Short'], ['long', 'Nur Long'], ['short', 'Nur Short']], 'Startwert: beide Richtungen.');
  grid = group('risk', '2 · Größe und Risiko', 'Anpassbare Übungswerte sind kein echter Kontostand. Diese Eingaben gelten für den nächsten bewusst gestarteten Modelllauf.');
  field('referenceUSDT', 'Feste Übungsbasis · USDT', '', null, 'Beispiel: 1.000 USDT. Bleibt während des Laufs fest.');
  field('riskPercent', 'Risiko je Modellposition · %', '', null, 'Übungsstart: 1 %. Bezogen auf die feste Laufbasis.');
  field('exposureUSDT', 'Maximale Exposition · USDT', '', null, 'Beispiel: höchstens 100 USDT Positionswert, nicht Einsatz/Margin.');
  field('leverage', 'Rechenhebel', '20', null, 'Vorhandener Modellstart: 20. Höherer Hebel erhöht das Risiko.');
  field('maxPositions', 'Maximale Modellpositionen', '1', null, 'Startwert: 1.'); field('minimumScore', 'Mindestscore', '70', null, 'Startwert: 70 von 100.');
  field('cooldownMs', 'Pause zwischen Einstiegen · Sekunden', '60', null, 'Startwert: 60 Sekunden.');
  const setupActions = el('div', '', 'bot-actions'); grid.before(setupActions);
  grid = group('protection', '3 · Stop und Kursziel', 'Regeln für den Preisplan vorbereiten; sie erzeugen hier keine Schutzorders.');
  field('stopRule', 'Stop-Regel', 'signal', [['signal', 'Signal-Preisplan'], ['own', 'Eigene Regel']], 'Startwert: Signal-Preisplan. Eigene Regeln vor einer Adaptereinrichtung klären.');
  field('tpRule', 'Kursziel / Take Profit', 'tp1', [['tp1', 'Vollständig bei TP1'], ['signal', 'Signal-Preisplan']], 'Startwert: vollständig beim ersten Ziel.');
  const limitGroups = el('div', '', 'bot-limits'); root.append(limitGroups);
  for (const [key, title, hint] of [['gain', '4 · Gewinnstopp', 'Startbeispiel: +10 USDT. Danach keine neuen Einstiege.'], ['loss', '5 · Verluststopp', 'Startbeispiel: −5 USDT. Betrag positiv eingeben; Schließwirkung wird nur modelliert.']]) {
    grid = group(key, title, hint, limitGroups); const l = el('label', '', 'bot-toggle'), check = el('input'); check.type = 'checkbox'; check.id = 'bot-' + key + '-enabled'; l.htmlFor = check.id;
    l.append(check, el('span', key === 'gain' ? 'Gewinnstopp einschalten' : 'Verluststopp einschalten')); grid.append(l); limits[key] = check; check.addEventListener('change', () => edited.add(key));
    field(key + 'Amount', 'Grenzbetrag', '', null, 'Nur wirksam, wenn der Stopp eingeschaltet ist.');
    field(key + 'Unit', 'Einheit der Grenze', 'USDT', [['USDT', 'USDT'], ['EUR', 'EUR'], ['%', '% der festen Basis']], 'EUR benötigt den festen Start-Referenzkurs unten.');
    field(key + 'Action', 'Bei Grenzberührung', key === 'loss' ? 'close' : 'entries', [['entries', 'Keine neuen Einstiege'], ['close', 'Bot-Positionen schließen']], 'Keine neuen Einstiege: Schutz bleibt. Schließen: ausdrückliche Modellwirkung.');
  }
  const fxBox = el('details', '', 'ki-info bot-group'); fxBox.id = 'bot-fx-details'; fxBox.append(el('summary', 'EUR-Grenzen · Referenzkurs')); root.append(fxBox); grid = el('div', '', 'bot-grid'); fxBox.append(grid);
  field('fx', 'EUR/USDT-Startkurs', '', null, 'USDT für 1 EUR. Vor neuem Start prüfen; angezeigter Kurs kann aus dem letzten Lauf stammen.');
  for (const key of ['gain', 'loss']) fields[key + 'Unit'].addEventListener('change', () => { if (fields[key + 'Unit'].value === 'EUR') fxBox.open = true; });
  const automated = el('label', '', 'bot-toggle'), auto = el('input'); auto.type = 'checkbox'; auto.id = 'bot-automatic'; auto.checked = false; auto.disabled = true; automated.append(auto, el('span', 'Automatische Trades AUS · Ausführungsadapter fehlt')); root.append(automated);
  const toolbar = el('div', '', 'ki-toolbar bot-actions'); root.append(el('h3', 'Simulation steuern'), el('p', 'Erst aktivieren, dann starten. Einstellungen ändern einen laufenden Modelllauf erst bei einem neuen Start.', 'bot-hint'), toolbar);
  function button(id, text, fn, parent = toolbar) { const b = el('button', text, 'button ghost'); b.id = id; b.type = 'button'; b.addEventListener('click', fn); parent.append(b); return b; }
  button('bot-preset', 'Übungswerte einsetzen', () => { for (const [key, value] of Object.entries({ referenceUSDT: '1000', riskPercent: '1', exposureUSDT: '100', gainAmount: '10', lossAmount: '5' })) { if (!fields[key].value.trim() && (!key.endsWith('Amount') || fields[key.replace('Amount', 'Unit')].value === 'USDT')) { fields[key].value = value; edited.add(key); } } state.message = 'Leere Felder mit Übungswerten gefüllt. Eigene Werte erhalten; nichts aktiviert oder gestartet. Vor dem Start anpassen.'; render(); }, setupActions);
  button('bot-load', 'Bestätigten Stand laden', () => refresh());
  const activate = button('bot-enable', 'Bot-Simulation aktivieren', () => send('enable', { enabled: !state.confirmed?.enabled }));
  button('bot-start', 'Neuen Modelllauf starten', () => { const at = Date.now(), runId = 'sim-' + at.toString(36) + Math.random().toString(36).slice(2, 8), limit = key => ({ enabled: limits[key].checked, amount: decimal(fields[key + 'Amount']) || null, unit: fields[key + 'Unit'].value, action: fields[key + 'Action'].value });
    const settings = { strategy: fields.strategy.value, coins: [currentSymbol()], direction: fields.direction.value, minimumScore: Number(fields.minimumScore.value), leverage: Number(fields.leverage.value), maxPositions: Number(fields.maxPositions.value), cooldownMs: Number(fields.cooldownMs.value) * 1000,
      stopRule: fields.stopRule.value, tpRule: fields.tpRule.value, exposureUSDT: decimal(fields.exposureUSDT) || null, riskPercent: decimal(fields.riskPercent) || null };
    return send('start', { mode: fields.mode.value, settings, runId, referenceUSDT: decimal(fields.referenceUSDT) || null, fx: decimal(fields.fx) ? { value: decimal(fields.fx), at, source: 'selbst gewählter Startreferenzkurs' } : null, gain: limit('gain'), loss: limit('loss'),
      restartReview: Object.fromEntries(['positionReviewed', 'historyReviewed', 'protectionReviewed'].map(k => [k, doc().getElementById('bot-review-' + k)?.checked === true])), inventory: { complete: true, at, positions: [], source: 'ausdrücklich geprüfter leerer Modellbestand, keine private Börsenauskunft' },
      snapshot: { runId, at, sequence: 0, currency: 'USDT', completeNet: true, source: 'Simulation · leerer eigener Modelllauf, keine Börsenfills', values: { realized: '0', open: '0', fees: '0', rebates: '0', funding: '0', estimatedCloseFees: '0' } } }); });
  button('bot-pause', 'Simulation pausieren', () => send('pause', {}));
  button('bot-fx-use', 'Vorhandenen Referenzkurs übernehmen', () => { const fx = fxReference(); if (!fx) state.message = 'Kein gültiger aktueller Referenzkurs; eigenen Kurs angeben.'; else { fields.fx.value = fx.value; state.message = 'Referenzkurs übernommen; beim Laufstart festgehalten.'; edited.add('fx'); } render(); }, fxBox);
  const review = el('details', '', 'ki-info bot-group'); review.append(el('summary', 'Bewusster neuer Modelllauf nach Störung'), el('p', 'Nur Simulation: alten Verlauf sichern und Modellbestand/Historie/Schutzwirkung bewusst prüfen. Hiermit kann kein privater Demo-/Echtgeldbot freigeschaltet werden.')); for (const [k, title] of [['positionReviewed', 'Leeren Modellbestand (0) geprüft'], ['historyReviewed', 'Modellhistorie geprüft'], ['protectionReviewed', 'Modellschutzwirkung geprüft']]) { const l = el('label', '', 'bot-toggle'), input = el('input'); input.type = 'checkbox'; input.id = 'bot-review-' + k; l.htmlFor = input.id; l.append(input, el('span', title)); review.append(l); } root.append(review);
  fields.destination.addEventListener('change', () => { state.destination = fields.destination.value; state.confirmed = null; changed(state.destination); void refresh(); });
  const status = el('p', '', 'ki-note'); status.id = 'bot-status'; status.setAttribute('role', 'status'); root.append(status);
  const alert = el('div', '', 'ki-tone ki-negative'); alert.id = 'bot-reconciliation'; alert.setAttribute('role', 'alert'); root.append(alert);
  const global = el('div', '', 'ki-tone ki-negative'); global.id = 'bot-global-warning'; global.setAttribute('role', 'alert'); global.hidden = true; globalHost.append(global);
  const summary = el('section', '', 'bot-run-card'); summary.id = 'bot-run-summary'; help.after(status, alert, summary);
  const scenario = el('details', '', 'ki-info bot-group'); scenario.id = 'bot-scenario'; scenario.append(el('summary', 'Modellwerte eingeben · keine Börsendaten'), el('p', 'Werte betreffen nur diesen Modelllauf, in USDT. Brutto realisiert/offen; bezahlte Gebühren positiv, Rabatte positiv, Funding bezahlt positiv/empfangen negativ. Alle sechs Angaben bewusst setzen. Unvollständige PO3-Werte vor Funding sind kein vollständiges Netto.'));
  const scenarioGrid = el('div', '', 'bot-grid'); const valueFields = {};
  for (const [key, label] of [['realized', 'Brutto realisiert · ohne Gebühren'], ['open', 'Brutto offen · ohne Gebühren'], ['fees', 'Bezahlte Gebühren'], ['rebates', 'Gebührenrabatte'], ['funding', 'Vorzeichenbehaftetes Funding'], ['estimatedCloseFees', 'Geschätzte Schließgebühren']]) { const l = el('label', '', 'bot-field'), input = el('input'); l.append(el('span', label, 'bot-field-title')); input.type = 'text'; input.inputMode = 'decimal'; input.maxLength = 64; input.id = 'bot-value-' + key; l.htmlFor = input.id; l.firstElementChild.id = input.id + '-title'; input.setAttribute('aria-labelledby', l.firstElementChild.id); l.append(input); scenarioGrid.append(l); valueFields[key] = input; }
  const scenarioActions = el('div', '', 'bot-actions'); scenario.append(scenarioGrid, scenarioActions); root.append(scenario);
  button('bot-zero-values', 'Alle Modellwerte ausdrücklich auf 0 setzen · Stopps bleiben', () => { for (const input of Object.values(valueFields)) input.value = '0'; }, scenarioActions);
  button('bot-step', 'Modellsnapshot prüfen', () => { const run = state.confirmed?.run; if (!run) { state.message = 'Zuerst bewusst einen Lauf starten.'; render(); return; }
    return send('snapshot', { snapshot: { runId: run.id, at: Date.now(), sequence: run.latest.sequence + 1, currency: 'USDT', completeNet: true, source: 'selbst eingegebene vollständige Modellwerte', values: Object.fromEntries(Object.entries(valueFields).map(([k, input]) => [k, decimal(input)])) } }); }, scenarioActions);
  const close = button('bot-sim-close', 'Schließwirkung ausdrücklich simulieren', () => send('close', {}), scenarioActions);
  button('bot-export', 'Vollständigen Simulationsstand sichern', async () => { try { const text = await exportState(state.destination), a = el('a'), url = URL.createObjectURL(new globalThis.Blob([text], { type: 'application/json' })); a.href = url; a.download = 'scalpdesk-bot-simulation-' + new Date().toISOString().slice(0, 10) + '.json'; a.click(); URL.revokeObjectURL(url); } catch (e) { state.message = e.message; render(); } });
  const logBox = el('details', '', 'ki-info bot-group'); logBox.append(el('summary', 'Laufprotokoll · letzte 20 Ereignisse')); const log = el('div'); log.id = 'bot-log'; logBox.append(log); root.append(logBox); host.append(root);
  async function refresh() { if (state.busy) return; state.busy = true; render(); try { accept(await load(state.destination)); state.message = 'Bestätigter Simulationsstand geladen. Keine automatische Aktivierung und keine Börsenorder.'; } catch (e) { state.message = e.message; } finally { state.busy = false; render(); } }
  async function send(type, parameters) { if (state.busy) return; state.busy = true; render(); try { if (!state.confirmed) accept(await load(state.destination)); accept(await command(state.destination, { type, parameters, expectedRevision: state.confirmed.revision })); state.message = 'Simulationsauftrag dauerhaft bestätigt. Börsenorders und automatische Trades bleiben AUS.'; } catch (e) { state.message = e.message; } finally { state.busy = false; render(); } }
  function accept(confirmed) { state.confirmed = confirmed;
    if (confirmed.run && !restored.has(state.destination)) { restored.add(state.destination); const r = confirmed.run, settings = confirmed.settings ?? {};
      const values = { ...settings, referenceUSDT: r.referenceUSDT, fx: r.fx?.value ?? '', cooldownMs: settings.cooldownMs === undefined ? fields.cooldownMs.value : settings.cooldownMs / 1000 };
      for (const key of ['gain', 'loss']) { values[key + 'Amount'] = r[key].amount ?? ''; values[key + 'Unit'] = r[key].unit; values[key + 'Action'] = r[key].action; if (!edited.has(key)) limits[key].checked = r[key].enabled; }
      for (const [key, value] of Object.entries(values)) if (fields[key] && !edited.has(key) && value !== null) fields[key].value = String(value);
      if (['gain', 'loss'].some(key => fields[key + 'Unit'].value === 'EUR')) fxBox.open = true;
    }
    changed(state.destination, confirmed); render(); }
  function render() { const s = state.confirmed, r = s?.run, conflicted = ['RECONCILING', 'PAUSED_RECONCILIATION_REQUIRED'].includes(r?.state);
    status.textContent = (state.destination === 'oracle' ? 'Oracle · ' : 'Lokal · ') + state.message + (s?.error ? ' ' + s.error : ''); activate.textContent = s?.enabled ? 'Bot-Simulation deaktivieren' : 'Bot-Simulation aktivieren';
    const tone = conflicted ? 'negative' : Object.keys(r?.stops ?? {}).length || r?.dataPaused ? 'warning' : r && s.enabled ? 'positive' : 'muted';
    summary.className = 'bot-run-card'; const heading = el('h3', 'Bestätigter Modelllauf'), badge = el('span', r ? conflicted ? s.actions.label : Object.keys(r.stops).length ? 'Laufgrenze verriegelt' : !s.enabled ? 'Pausiert' : r.dataPaused ? 'Daten fehlen · pausiert' : 'Simulation läuft' : 'Noch kein Lauf', 'ki-tone ki-' + tone);
    summary.replaceChildren(heading, badge);
    if (r) { const facts = el('dl', '', 'bot-run-facts'), action = x => x === 'close' ? 'Bot-Positionen schließen · Modellwirkung' : 'Keine neuen Einstiege', limit = x => x.enabled ? x.amount + ' ' + x.unit + ' · ' + action(x.action) : 'Aus';
      for (const [title, value] of [['Gestartet', date(r.startedAt)], ['Nettoergebnis', r.netUSDT + ' USDT'], ['Feste Übungsbasis', r.referenceUSDT + ' USDT'], ['Gewinnstopp', limit(r.gain)], ['Verluststopp', limit(r.loss)], ['Bestätigte Revision', String(s.revision)]]) { const pair = el('div'), result = el('dd', value); if (title === 'Nettoergebnis') result.className = Number(r.netUSDT) > 0 ? 'bot-net-positive' : Number(r.netUSDT) < 0 ? 'bot-net-negative' : ''; pair.append(el('dt', title), result); facts.append(pair); }
      if (r.fx) { const pair = el('div'); pair.append(el('dt', 'Fester EUR/USDT-Kurs'), el('dd', r.fx.value)); facts.append(pair); } summary.append(facts);
      summary.append(el('p', Object.keys(r.stops).length ? 'Grenze bleibt verriegelt. Werte ändern oder Kursrückkehr öffnen diesen Lauf nicht; bewusst neuen Lauf starten.' : 'Noch keine Laufgrenze berührt.', 'bot-hint'));
    } else summary.append(el('p', 'Übungswerte einsetzen oder eigene Werte eintragen. Aktivierung und Start sind getrennt.', 'bot-hint'));
    summary.append(el('p', 'Automatische Trades AUS · keine ausgeführten Börsenorders.', 'bot-hint'));
    alert.hidden = !conflicted; alert.replaceChildren();
    if (conflicted) { alert.append(el('strong', s.actions.label)); const facts = el('dl', '', 'bot-alert-facts');
      for (const [title, value] of [['Erwarteter Bestand', JSON.stringify(r.inventory.expected ?? {})], ['Tatsächlicher Bestand', JSON.stringify(r.inventory.actual ?? {})], ['Datenzeit', Number.isFinite(r.inventory.at) ? date(r.inventory.at) : 'Unbekannt']]) { const pair = el('div'); pair.append(el('dt', title), el('dd', value)); facts.append(pair); }
      alert.append(facts, el('p', 'Bestand, Fills und Schutzorders prüfen. Keine automatischen Schließungen/Ausgleichsorders; liegende Schutzorders können weiter auslösen.'));
    }
    global.hidden = !conflicted; global.textContent = conflicted ? 'Simulation · ' + s.actions.label + ' · Trading-Bot öffnen und Bestand prüfen.' : '';
    close.disabled = state.busy || !s?.actions?.newCloses || !r?.simulatedClosePending; for (const id of ['bot-enable', 'bot-start', 'bot-pause', 'bot-step', 'bot-load']) doc().getElementById(id).disabled = state.busy;
    if (s) { const key = JSON.stringify([s.revision, s.logs?.slice(-20)]); if (log.dataset.key !== key) { log.replaceChildren(...(s.logs ?? []).slice(-20).reverse().map(x => el('p', `${date(x.at)} · ${x.type} · ${x.state ?? 'deaktiviert'} · Revision ${x.revision}`, 'ki-note'))); log.dataset.key = key; } }
  }
  render(); return { state, accept, render, refresh, send };
}
