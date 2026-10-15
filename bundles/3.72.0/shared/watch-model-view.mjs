// 3.72.0: Schalter und gepaarter Modellvergleich im vorhandenen Einstellungsbereich.
import { WATCH_COMPARE_KEY, WATCH_MODELS, WATCH_COMPARE_DEFAULTS, WATCH_BASE_MS, WATCH_TREND_MS, WATCH_HISTORY, watchCompareSettings, summarizeWatchComparison } from './watch-model-core.mjs';
const element = (tag, cls = '', text = '') => { const e = globalThis.document.createElement(tag); e.className = cls; e.textContent = text; return e; };
const num = (v, digits = 2) => Number.isFinite(v) ? v.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '–';
const date = value => new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' }).format(value);
const button = (text, id) => { const b = element('button', 'button ghost', text); b.type = 'button'; if (id) b.id = id; return b; };
export function createWatchModelView({ host, read, save, getMode, setMode, symbols, history, workerFactory, now = Date.now, available = () => true }) {
  const root = element('section', 'workspace-setting-card watch-model-settings'); root.id = 'watch-model-settings';
  const title = element('h3', '', 'Vorauswahl · Modelltest'); title.id = 'watch-model-title'; root.setAttribute('aria-labelledby', title.id);
  const toggle = button('Strenges 5/5-Modell testen', 'watch-model-toggle'); toggle.className = 'button wm-switch'; toggle.setAttribute('role', 'switch'); toggle.setAttribute('aria-label', 'Strenges 5/5-Testmodell für die Vorauswahl');
  const current = element('p', 'wm-current'), note = element('p', 'muted'); current.id = 'watch-model-current'; toggle.setAttribute('aria-describedby', current.id);
  const go = button('Zur Vorauswahl'); go.dataset.goto = 'watchlist';
  const explain = element('details', 'wm-explain'); explain.append(element('summary', '', 'Regeln und Vergleich erklären'));
  explain.append(element('p', '', 'Bisherig: unveränderte vier Regeln und deine bisherige Zeitraumwahl. Streng: nur abgeschlossene 15m-Kerzen mit 4h-Kontext; Long oder Short erst bei 5/5. Fehlende oder veraltete Daten sperren die Freigabe. Die Prozent-Zeiträume der Kacheln bleiben unabhängig davon wählbar.'));
  const list = element('ol');
  for (const text of ['4h: Schluss über steigender EMA 200 (Short: darunter und fallend).', '15m: Schluss über EMA 200 (Short: darunter).', 'RSI 14 kreuzt über 30 (Short: unter 70).', 'MACD 12/26/9 kreuzt die Signallinie in dieselbe Richtung.', 'Volumen mindestens 2 × Durchschnitt der 20 vorherigen Kerzen.']) list.append(element('li', '', text));
  explain.append(list, element('p', '', 'RSI- und MACD-Kreuzung müssen auf derselben Kerze auftreten. Ein Signal bleibt nur bis zum nächsten 15m-Schluss gültig. 5/5 bedeutet Regelübereinstimmung; eine Trefferwahrscheinlichkeit ist daraus nicht bekannt.'));
  const comparison = element('details', 'wm-comparison'); comparison.id = 'watch-model-comparison'; comparison.append(element('summary', '', 'Beide Modelle vergleichen'));
  comparison.append(element('p', '', 'Beide Modelle werden immer auf denselben Binance-Spot-Kerzen (15m, zusätzlich 4h für das Testmodell) und denselben Coins geprüft. Das bisherige Modell nutzt dabei unverändert seine vier Regeln. Der Schalter beeinflusst das Testergebnis nicht.'));
  const inputs = element('div', 'wm-fields'), fields = {};
  const saved = read(WATCH_COMPARE_KEY); let settings;
  try { settings = watchCompareSettings(saved?.settings || {}); } catch { settings = { ...WATCH_COMPARE_DEFAULTS }; }
  const definitions = [['days', 'Zeitraum · Tage', 7, 90, 1], ['feePct', 'Gebühr je Seite · %', 0, 1, .01], ['slippagePct', 'Slippage je Seite · %', 0, 1, .01], ['stopAtr', 'Stopabstand · ATR 14', .5, 5, .1], ['rewardRisk', 'Zielabstand · Stopabstand', 1, 5, .1], ['holdBars', 'Höchstens 15m-Kerzen je Trade', 1, 96, 1]];
  for (const [key, text, min, max, step] of definitions) {
    const label = element('label', '', text), input = element('input'); input.id = 'watch-compare-' + key; input.type = 'number'; input.min = min; input.max = max; input.step = step; input.value = settings[key]; input.inputMode = step === 1 ? 'numeric' : 'decimal'; fields[key] = input; label.append(input); inputs.append(label);
  }
  const start = button('Vergleich starten', 'watch-compare-start'), stop = button('Abbrechen', 'watch-compare-stop'), download = button('Ergebnis herunterladen', 'watch-compare-download'); stop.hidden = true; download.hidden = true;
  const actions = element('div', 'wm-actions'); actions.append(start, stop, download);
  const status = element('p', 'wm-status'); status.id = 'watch-compare-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const results = element('div', 'wm-results'); results.id = 'watch-compare-results';
  comparison.append(inputs, element('p', 'muted', 'Gleiche Ausführung: nächste Kerzenöffnung, ein Trade je Coin und Modell, identische ATR-Stops/Ziele und Kosten. Stop vor Ziel, wenn beides in einer Kerze liegt. 1 R = modellierter Stopverlust inklusive Kosten; Kurslücken können größer ausfallen. Kein Hebel und kein Funding; Short ist eine hypothetische Rechnung auf Spotkursen.'), actions, status, results);
  root.append(title, toggle, current, note, go, explain, comparison); host.append(root);
  // Sicherungen können alt oder beschädigt sein. Unvollständige Berichte niemals als Ergebnis darstellen.
  function restoreReport(r) {
    try {
      if (r?.protocol !== 'watch-compare-1' || r.models?.classic !== WATCH_MODELS.classic || r.models?.strict !== WATCH_MODELS.strict || !Number.isSafeInteger(r.from) || !Number.isSafeInteger(r.asOf) || r.from >= r.asOf || !Number.isFinite(r.createdAt)) return null;
      if (![r.from, r.asOf, r.createdAt].every(t => t > 0 && t < 8640000000000000)) return null;
      if (!r.settings || typeof r.settings !== 'object') return null;
      watchCompareSettings(r.settings);
      if (!Array.isArray(r.symbols) || !r.symbols.length || r.symbols.length > 30 || new Set(r.symbols).size !== r.symbols.length || r.symbols.some(s => !/^[A-Z0-9]{2,20}USDT$/.test(s))) return null;
      if (!Array.isArray(r.coins) || !r.coins.length || r.coins.length > r.symbols.length || new Set(r.coins.map(c => c.symbol)).size !== r.coins.length || !Array.isArray(r.failed)) return null;
      for (const c of r.coins) {
        if (!r.symbols.includes(c.symbol) || c.from !== r.from || c.asOf !== r.asOf || c.market !== 'spot') return null;
        for (const key of ['classic', 'strict']) {
          const b = c.models[key];
          if (b.version !== WATCH_MODELS[key] || !Array.isArray(b.trades) || b.trades.length > 10000 || b.stats.trades !== b.trades.length || !['open', 'pending', 'signals'].every(k => Number.isSafeInteger(b.stats[k]) && b.stats[k] >= 0)) return null;
          if (!Number.isFinite(b.stats.netR) || b.trades.some(t => t.symbol !== c.symbol || !Number.isFinite(t.netR) || !Number.isSafeInteger(t.exitAt) || t.exitAt <= r.from || t.exitAt > r.asOf)) return null;
        }
      }
      if (r.failed.some(f => !r.symbols.includes(f.symbol) || typeof f.reason !== 'string')) return null;
      return r;
    } catch { return null; }
  }
  const state = { report: restoreReport(saved?.report), busy: false };
  let controller, worker, runId = 0, lastProgress = 0;
  function paintMode() {
    const strict = getMode() === 'strict'; toggle.setAttribute('aria-checked', String(strict));
    current.textContent = strict ? 'Aktiv: Streng 5/5 · Signale 15m / Trend 4h' : 'Aktiv: Bisherige Vorauswahl';
    note.textContent = 'Gespeicherte Auswahl. Zurückschalten stellt die bisherige Logik und ihre Zeitraumwahl sofort wieder her. Vergleichsergebnisse bleiben erhalten.';
  }
  function paintResult() {
    results.replaceChildren(); const r = state.report; download.hidden = !r;
    if (!r) return;
    const stats = summarizeWatchComparison(r.coins);
    results.append(element('p', 'wm-report-meta', `${date(r.from)} – ${date(r.asOf)} · ${r.coins.length}/${r.symbols.length} Coins · Binance Spot · 15m/4h`));
    results.append(element('p', 'muted', `Annahmen dieses Laufs: ${num(r.settings.feePct)} % Gebühr + ${num(r.settings.slippagePct)} % Slippage je Seite · Stop ${num(r.settings.stopAtr, 1)} ATR · Ziel ${num(r.settings.rewardRisk, 1)} × Stopabstand · höchstens ${r.settings.holdBars} Kerzen. Einstellungen oben ändern ein gespeichertes Ergebnis nicht.`));
    const cards = element('div', 'wm-cards');
    for (const [key, label] of [['classic', 'Bisheriges Modell'], ['strict', 'Streng 5/5']]) {
      const s = stats[key], card = element('section', 'wm-result-card'); card.dataset.model = key; card.append(element('h4', '', label));
      const dl = element('dl');
      for (const [name, value] of [['Abgeschlossene Trades', String(s.trades)], ['Netto gesamt', num(s.netR) + ' R'], ['Ø Netto je Trade', num(s.averageR) + (s.averageR === null ? '' : ' R')], ['Trefferquote', num(s.winRate, 1) + (s.winRate === null ? '' : ' %')], ['Profitfaktor', s.noLosses ? 'keine Verlustfälle' : num(s.profitFactor)], ['Rückgang · realisiert', num(s.realizedDrawdownR) + ' R'], ['Offen / wartet', `${s.open} / ${s.pending}`]]) dl.append(element('dt', '', name), element('dd', '', value));
      card.append(dl); cards.append(card);
    }
    results.append(cards, element('p', 'muted', 'Der Rückgang summiert realisierte R-Ergebnisse nach Abschlusszeit; er ist kein Kontodrawdown mit offenen Positionen. Offene und wartende Fälle zählen nicht als abgeschlossene Trades. Wenige oder zeitlich abhängige Trades belegen keinen Vorteil. Es wird kein automatischer Gewinner gewählt.'));
    if (r.failed?.length) results.append(element('p', 'wm-error', 'Teilvergleich – ausgeschlossen: ' + r.failed.map(x => x.symbol + ': ' + x.reason).join(' · ')));
    const perCoin = element('details'); perCoin.append(element('summary', '', 'Ergebnisse je Coin'));
    for (const c of r.coins) { const a = c.models.classic.stats, b = c.models.strict.stats; perCoin.append(element('p', '', `${c.symbol}: Bisherig ${a.trades} Trades / ${num(a.netR)} R · Streng ${b.trades} Trades / ${num(b.netR)} R`)); }
    results.append(perCoin);
  }
  function busy(on) { state.busy = on; start.disabled = on; stop.hidden = !on; for (const input of Object.values(fields)) input.disabled = on; }
  function update(text, force = false) { if (force || now() - lastProgress >= 150) { status.textContent = text; lastProgress = now(); } }
  function abort() { runId++; controller?.abort(); controller = null; worker?.terminate(); worker = null; busy(false); update('Vergleich abgebrochen. Das bisherige Ergebnis bleibt erhalten.', true); }
  function calculate(input, mine, prefix) {
    return new Promise((resolve, reject) => {
      const signal = controller.signal, cancel = () => reject(new Error('Vergleich abgebrochen.'));
      signal.addEventListener('abort', cancel, { once: true });
      worker.onmessage = e => { if (mine !== runId || e.data?.id !== mine) return; if (e.data.kind === 'progress') update(prefix + ' · Berechnung ' + Math.round(e.data.fraction * 100) + ' %'); else { signal.removeEventListener('abort', cancel); if (e.data.kind === 'result') resolve(e.data.result); else reject(new Error(e.data.error)); } };
      worker.onerror = () => { signal.removeEventListener('abort', cancel); reject(new Error('Modellberechnung fehlgeschlagen.')); };
      worker.postMessage({ id: mine, input });
    });
  }
  async function run() {
    if (state.busy) return;
    if (!available()) { update('App öffnen, Pause beenden und Verbindung prüfen.', true); return; }
    let config;
    try { config = watchCompareSettings(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.value.trim() === '' ? NaN : Number(v.value.replace(',', '.'))]))); }
    catch (e) { update(e.message, true); return; }
    const selected = [...new Set(symbols())];
    if (!selected.length || selected.length > 30 || selected.some(s => !/^[A-Z0-9]{2,20}USDT$/.test(s))) { update('Zum Vergleich 1 bis 30 Coins in die Vorauswahl aufnehmen.', true); return; }
    const mine = ++runId, asOf = Math.floor(now() / WATCH_BASE_MS) * WATCH_BASE_MS, from = asOf - config.days * 86400000, coins = [], failed = [];
    controller = new AbortController(); const signal = controller.signal; busy(true);
    try {
      worker = workerFactory();
      for (const [index, symbol] of selected.entries()) {
        if (mine !== runId || signal.aborted) return;
        const prefix = `${index + 1}/${selected.length} · ${symbol}`;
        update(prefix + ' · Historie laden …', true);
        try {
          const progress = x => update(prefix + ' · ' + x.timeframe + ' laden ' + Math.round(x.fraction * 100) + ' %');
          const lower = await history({ symbol, market: 'spot', timeframe: '15m', from: from - WATCH_HISTORY * WATCH_BASE_MS, to: asOf, signal, progress });
          const higher = await history({ symbol, market: 'spot', timeframe: '4h', from: from - WATCH_HISTORY * WATCH_TREND_MS, to: asOf, signal, progress });
          if (mine !== runId || signal.aborted) return;
          coins.push(await calculate({ lower, higher, symbol, from, asOf, settings: config }, mine, prefix));
        } catch (e) { if (mine !== runId || signal.aborted) return; failed.push({ symbol, reason: e.message }); }
      }
      if (!coins.length) throw new Error('Kein vollständiger Vergleich möglich. ' + failed.map(x => x.symbol + ': ' + x.reason).join(' · '));
      const report = { protocol: 'watch-compare-1', models: WATCH_MODELS, createdAt: now(), asOf, from, settings: config, symbols: selected, coins, failed };
      const value = { settings: config, report };
      if (JSON.stringify(value).length > 2e6) throw new Error('Ergebnis zu groß zum Speichern – kürzeren Zeitraum oder weniger Coins wählen.');
      if (mine !== runId || signal.aborted) return;
      state.report = report; paintResult();
      try { await save(WATCH_COMPARE_KEY, value); update('Vergleich abgeschlossen und gespeichert. Beide Modelle wurden auf identischen Zeitfenstern geprüft.', true); }
      catch { update('Vergleich berechnet, aber Speichern fehlgeschlagen. Ergebnis bitte herunterladen.', true); }
    } catch (e) { if (mine === runId) update(e.message, true); }
    finally { if (mine === runId) { worker?.terminate(); worker = null; controller = null; busy(false); } }
  }
  toggle.addEventListener('click', async () => {
    toggle.disabled = true;
    try { await setMode(getMode() === 'strict' ? 'classic' : 'strict'); paintMode(); }
    catch (e) { update(e.message || 'Auswahl konnte nicht gespeichert werden.', true); }
    finally { toggle.disabled = false; }
  });
  start.addEventListener('click', run); stop.addEventListener('click', abort);
  download.addEventListener('click', () => { if (!state.report) return; const url = globalThis.URL.createObjectURL(new globalThis.Blob([JSON.stringify(state.report, null, 2)], { type: 'application/json' })), a = element('a'); a.href = url; a.download = 'scalpdesk-modellvergleich-' + state.report.asOf + '.json'; a.click(); setTimeout(() => globalThis.URL.revokeObjectURL(url), 1000); });
  if (state.report) status.textContent = 'Gespeicherter Vergleich. Zum Aktualisieren einen neuen Lauf starten.';
  paintMode(); paintResult();
  return { root, state, paintMode, abort, run };
}
