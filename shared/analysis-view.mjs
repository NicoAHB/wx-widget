import { ANALYSES, analysisSettings } from './analysis-config.mjs';
const make = (doc, tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };

export function createAnalysisView({ root, definitions = ANALYSES, read, save, getOverlays, setOverlays, coins, changed = () => {} }) {
  const doc = root.ownerDocument, rows = new Map(); let settings = analysisSettings(read(), definitions);
  root.id = 'analysis-panel'; root.className = 'analysis-panel'; root.open = settings.open;
  const summary = make(doc, 'summary', 'analysis-heading'), glyph = make(doc, 'span', 'analysis-glyph', '◇'), heading = make(doc, 'span', '', 'Analyse');
  summary.append(glyph, heading, make(doc, 'small', '', 'Chart & Telegram')); root.append(summary);
  const body = make(doc, 'div', 'analysis-body'), table = make(doc, 'div', 'analysis-table'); table.setAttribute('role', 'table'); table.setAttribute('aria-label', 'Fest programmierte Analysen');
  const head = make(doc, 'div', 'analysis-row analysis-columns'); head.setAttribute('role', 'row');
  for (const text of ['Analyse', 'Telegram-Benachrichtigung', 'Im Chart anzeigen']) { const n = make(doc, 'span', '', text); n.setAttribute('role', 'columnheader'); head.append(n); } table.append(head);
  const button = (text, cls = 'chip-tool') => { const b = make(doc, 'button', cls, text); b.type = 'button'; return b; };
  function commit() { save(JSON.parse(JSON.stringify(settings))); changed(); }
  function apply() {
    const active = settings.focus || definitions.some(d => settings.rows[d.id].chart);
    if (active && !settings.base) settings.base = { ...getOverlays() };
    if (!active) { if (settings.base) setOverlays({ ...settings.base }, null); settings.base = null; return; }
    const overlays = { ...settings.base };
    if (settings.focus) for (const k of Object.keys(overlays)) overlays[k] = false;
    for (const d of definitions) if (settings.focus ? d.id === settings.focus : settings.rows[d.id].chart) for (const k of d.indicators) if (k in overlays) overlays[k] = true;
    setOverlays(overlays, settings.focus);
  }
  for (const d of definitions) {
    const row = make(doc, 'div', 'analysis-row'); row.dataset.analysis = d.id; row.setAttribute('role', 'row');
    const nameCell = make(doc, 'div', 'analysis-name'), name = button(d.name, 'analysis-focus'), sub = make(doc, 'small'), coinButton = button('Coins', 'chip-tool analysis-coins');
    name.title = 'Nur die Indikatoren dieser Analyse zeigen'; name.addEventListener('click', () => { settings.focus = settings.focus === d.id ? null : d.id; apply(); commit(); paint(); }); nameCell.append(name, sub, coinButton);
    const toggle = make(doc, 'label', 'analysis-switch'), telegram = make(doc, 'input'), onText = make(doc, 'span'); telegram.type = 'checkbox'; telegram.setAttribute('role', 'switch'); telegram.setAttribute('aria-label', `${d.name}: Telegram-Benachrichtigung`); toggle.append(telegram, onText);
    telegram.addEventListener('change', () => { settings.rows[d.id].telegram = telegram.checked; commit(); paint(); });
    const chartCell = make(doc, 'label', 'analysis-check'), chart = make(doc, 'input'); chart.type = 'checkbox'; chart.setAttribute('aria-label', `${d.name}: Im Chart anzeigen`); chartCell.append(chart);
    chart.addEventListener('change', () => { settings.rows[d.id].chart = chart.checked; if (!chart.checked && settings.focus === d.id) settings.focus = null; apply(); commit(); paint(); });
    for (const n of [nameCell, toggle, chartCell]) n.setAttribute('role', 'cell');
    const coinList = make(doc, 'div', 'analysis-coin-list'); coinList.id = 'analysis-coins-' + d.id; coinButton.setAttribute('aria-controls', coinList.id);
    const notice = make(doc, 'div', 'analysis-notice'); notice.hidden = true;
    const reason = make(doc, 'span'), acknowledge = button('Gelesen', 'chip-tool'); notice.append(reason, acknowledge);
    acknowledge.addEventListener('click', () => acknowledgeNotice(d.id)); name.addEventListener('click', () => acknowledgeNotice(d.id));
    row.append(nameCell, toggle, chartCell, notice, coinList); table.append(row); rows.set(d.id, { row, name, sub, telegram, onText, chart, coinButton, notice, reason, coinList, coinKey: null });
    coinButton.addEventListener('click', () => { settings.rows[d.id].coinsOpen = !settings.rows[d.id].coinsOpen; commit(); paint(); });
  }
  const focusBar = make(doc, 'div', 'analysis-focusbar'), restore = button('Alle Indikatoren wieder an');
  restore.title = 'Vorherige Indikator-Auswahl wiederherstellen'; restore.addEventListener('click', () => { settings.focus = null; apply(); commit(); paint(); });
  focusBar.append(make(doc, 'span', '', 'Fokus aktiv: übrige Indikatoren ausgeblendet.'), restore);
  const hint = make(doc, 'p', 'analysis-hint', 'Name antippen: Fokus. Haken: zusätzlich einblenden. „Wieder an“ stellt deine vorherige Auswahl wieder her.');
  const status = make(doc, 'div', 'analysis-status'); status.setAttribute('aria-live', 'polite');
  const info = make(doc, 'details', 'analysis-info'), infoSummary = make(doc, 'summary', '', 'ⓘ Analysen & Indikator-Erklärungen');
  info.append(infoSummary, make(doc, 'p', '', definitions.map(d => d.name + ': ' + d.description).join(' ')), make(doc, 'p', '', 'EMA 200 zeigt den langfristigen Trend. Ein Order Block ist die letzte Gegenkerze vor einem Impuls von mindestens 1,5 ATR mit Strukturbruch. FVG ist eine noch offene Drei-Kerzen-Lücke. Ein Sweep durchsticht ein früher bestätigtes Hoch/Tief und schließt wieder dahinter. Liquiditätspools sind aus ähnlichen Hochs/Tiefs abgeleitete Preisbereiche; Liquidation und Liq-Heatmap bleiben die bestehenden Hebel-Schätzungen.'), make(doc, 'p', '', 'Nur normale, geschlossene Börsenkerzen. Ein Setup braucht mindestens zwei unterschiedliche Bausteinarten. Eine Umkehr allein genügt nicht: erst der folgende 15m-Schluss über/unter der davor bekannten Mikrostruktur bestätigt. Ziele sind vorhandene Levels; fehlen zwei passende Ziele, gibt es kein Signal. CRV ist brutto, ohne Gebühren/Slippage.'), make(doc, 'p', '', 'Telegram muss für Analyse, Coin global und Coin in dieser Analyse an sein. Standard: Analyse aus, alle Coins freigegeben. Die App prüft die freigegebenen Coins im Hintergrund, solange sie geöffnet und aktiv ist. Spätere 24/7-Dienstübergabe ist vorbereitet; aktuell sendet der Dienst diese Analyse noch nicht. Ein Signal je Setup, anschließend mindestens zwei Stunden Sperre je Coin und Richtung. Keine Erfolgswahrscheinlichkeit.'));
  const log = make(doc, 'details', 'analysis-log'), logSummary = make(doc, 'summary', '', 'Analyse-Protokoll'), logList = make(doc, 'ol'); log.append(logSummary, logList);
  body.append(table, focusBar, hint, status, info, log); root.append(body);
  root.addEventListener('toggle', () => { if (settings.open !== root.open) { settings.open = root.open; commit(); } });
  function paint() {
    const symbols = coins();
    for (const d of definitions) { const r = rows.get(d.id), s = settings.rows[d.id]; r.name.setAttribute('aria-pressed', String(settings.focus === d.id)); r.sub.textContent = settings.focus === d.id ? 'Fokus aktiv' : 'Nur diese zeigen'; r.telegram.checked = s.telegram; r.onText.textContent = s.telegram ? 'An' : 'Aus'; r.chart.checked = shown(d.id); r.coinButton.textContent = `Coins (${symbols.filter(s => settings.rows[d.id].coins[s] !== false).length}/${symbols.length})`; r.row.dataset.focus = String(settings.focus === d.id); r.coinButton.setAttribute('aria-expanded', String(s.coinsOpen)); r.coinList.hidden = !s.coinsOpen; paintCoins(d, r); }
    focusBar.hidden = !settings.focus;
  }
  function paintCoins(d, row) {
    const symbols = coins(), key = symbols.join('|');
    if (row.coinKey !== key) {
      row.coinKey = key; row.coinList.replaceChildren();
      for (const symbol of symbols) {
        const choice = make(doc, 'div', 'analysis-coin-choice'), label = make(doc, 'label', 'analysis-switch'), checkbox = make(doc, 'input'), word = make(doc, 'span'), name = make(doc, 'span', 'analysis-inline-coin', symbol.replace(/USDT$/, '')), hint = make(doc, 'small');
        choice.dataset.coin = symbol; checkbox.type = 'checkbox'; checkbox.setAttribute('role', 'switch'); checkbox.setAttribute('aria-label', `${d.name}: ${symbol} für Telegram`); label.append(checkbox, word); choice.append(name, hint, label); row.coinList.append(choice);
        checkbox.addEventListener('change', () => { settings.rows[d.id].coins[symbol] = checkbox.checked; commit(); paint(); });
      }
    }
    for (const choice of row.coinList.children) { const symbol = choice.dataset.coin, on = settings.rows[d.id].coins[symbol] !== false; choice.querySelector('input').checked = on; choice.querySelector('label span').textContent = on ? 'An' : 'Aus'; choice.querySelector('small').textContent = settings.globalCoins[symbol] === false ? 'Global stumm' : !settings.rows[d.id].telegram ? 'Analyse-Telegram aus' : on ? 'Telegram freigegeben' : 'Telegram stumm'; }
  }
  function reload() { settings = analysisSettings(read(), definitions); root.open = settings.open; apply(); paint(); }
  function globalToggle(symbol) { settings.globalCoins[symbol] = settings.globalCoins[symbol] === false; commit(); paint(); }
  function shown(id) { return settings.focus ? settings.focus === id : settings.rows[id]?.chart === true; }
  let noticeEvents = [], onAcknowledge = () => {};
  function acknowledgeNotice(id) { onAcknowledge(id); }
  function paintNotices(events, now, acknowledge) {
    noticeEvents = events || []; onAcknowledge = acknowledge;
    for (const d of definitions) {
      const r = rows.get(d.id), e = noticeEvents.filter(e => e.analysisId === d.id && !e.acknowledged && now < e.until).at(-1);
      r.notice.hidden = !e; if (e) { r.reason.textContent = e.reason; r.row.dataset.noticeTone = e.tone; } else delete r.row.dataset.noticeTone;
    }
  }
  function paintResult(text, entries = []) { if (status.textContent !== text) status.textContent = text; if (log.open) logList.replaceChildren(...entries.slice(-25).reverse().map(e => make(doc, 'li', '', e.text))); }
  function rememberManual(keys) { if (!settings.base) return; const current = getOverlays(); for (const k of keys) if (k in settings.base) settings.base[k] = !!current[k]; commit(); }
  // Persistierte Basis verhindert, dass nach einem Neustart die Fokus-Auswahl als ursprünglicher Zustand gespeichert wird.
  apply(); paint();
  return { root, get settings() { return settings; }, paint, reload, shown, globalToggle, paintResult, paintNotices, rememberManual,
    endFocus: () => { if (!settings.focus) return; settings.focus = null; apply(); commit(); paint(); } };
}
