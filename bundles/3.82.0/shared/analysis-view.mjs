import { ANALYSES, analysisSettings } from './analysis-config.mjs';
import { analysisOverview } from './analysis-overview.mjs';
const make = (doc, tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };

export function createAnalysisView({ root, definitions = ANALYSES, read, save, getOverlays, setOverlays, coins, selectedCoin = () => null, openCoin = () => {}, changed = () => {}, toolServices = {} }) {
  const doc = root.ownerDocument, rows = new Map(); let settings = analysisSettings(read(), definitions);
  root.id = 'analysis-panel'; root.className = 'analysis-panel'; root.open = settings.open;
  const summary = make(doc, 'summary', 'analysis-heading'), glyph = make(doc, 'span', 'analysis-glyph', '◇'), heading = make(doc, 'span', '', 'Analyse');
  summary.append(glyph, heading, make(doc, 'small', '', 'Chart & Telegram')); root.append(summary);
  const body = make(doc, 'div', 'analysis-body'), table = make(doc, 'div', 'analysis-table'); table.setAttribute('role', 'table'); table.setAttribute('aria-label', 'Fest programmierte Analysen');
  const head = make(doc, 'div', 'analysis-row analysis-columns'); head.setAttribute('role', 'row');
  for (const text of ['Modell', 'Telegram', 'Chart']) { const n = make(doc, 'span', '', text); n.setAttribute('role', 'columnheader'); head.append(n); } table.append(head);
  const button = (text, cls = 'chip-tool') => { const b = make(doc, 'button', cls, text); b.type = 'button'; return b; };
  function commit() { save(JSON.parse(JSON.stringify(settings))); changed(); }
  // 3.78.1: ein Bedienweg, eine unveränderte Basis für die Rückkehr.
  function activate(id) {
    settings.focus = id;
    for (const d of definitions) settings.rows[d.id].chart = d.id === id;
    apply(); commit(); paint();
  }
  function apply() {
    if (settings.focus && !settings.base) settings.base = { ...getOverlays() };
    if (!settings.focus) {
      if (settings.base) setOverlays({ ...settings.base }, null);
      settings.base = null; return;
    }
    const overlays = Object.fromEntries(Object.keys(settings.base).map(k => [k, false]));
    for (const k of definitions.find(d => d.id === settings.focus).indicators) if (k in overlays) overlays[k] = true;
    setOverlays(overlays, settings.focus);
  }

  for (const d of definitions) {
    const row = make(doc, 'div', 'analysis-row'); row.dataset.analysis = d.id; row.setAttribute('role', 'row');
    const nameCell = make(doc, 'div', 'analysis-name'), name = button(d.name, 'analysis-focus'), sub = d.focusOnName?button('', 'analysis-coin-count analysis-coins-button'):make(doc, 'small', 'analysis-coin-count');
    // Modellname klappt nur die Details; Chart-Fokus bleibt am Haken und am Coin-Namen.
    const toggleCoins=()=>{settings.rows[d.id].coinsOpen=!settings.rows[d.id].coinsOpen;commit();paint();};
    name.addEventListener('click', () => { if(d.focusOnName){const on=!shown(d.id);activate(on?d.id:null);if(on)openCoin(selectedCoin(),d.id);}else toggleCoins(); }); nameCell.append(name, sub);
    if(d.focusOnName){sub.addEventListener('click',toggleCoins);name.setAttribute('aria-label',d.name);name.setAttribute('aria-controls','chart');}
    const toggle = make(doc, 'label', 'analysis-switch'), telegram = make(doc, 'input'), onText = make(doc, 'span'); telegram.type = 'checkbox'; telegram.disabled=!!d.information; telegram.setAttribute('role', 'switch'); telegram.setAttribute('aria-label', `${d.name}: Telegram-Benachrichtigung`); toggle.append(telegram, onText);
    telegram.addEventListener('change', () => { settings.rows[d.id].telegram = telegram.checked; commit(); paint(); });
    const chartCell = make(doc, 'label', 'analysis-check'), chart = make(doc, 'input'); chart.type = 'checkbox'; chart.setAttribute('aria-label', `${d.name}: Im Chart anzeigen`); chartCell.append(chart);
    chart.addEventListener('change', () => { activate(chart.checked ? d.id : null);if(chart.checked&&(d.focusOnName||d.defaultInterval))openCoin(selectedCoin(),d.id); });
    for (const n of [nameCell, toggle, chartCell]) n.setAttribute('role', 'cell');
    const details = make(doc, 'div', 'analysis-model-details'), coinList = make(doc, 'div', 'analysis-coin-list'); details.id = 'analysis-coins-' + d.id; details.append(coinList); (d.focusOnName?sub:name).setAttribute('aria-controls', details.id);
    const notice = make(doc, 'div', 'analysis-notice'); notice.hidden = true;
    const reason = make(doc, 'span'), acknowledge = button('Gelesen', 'chip-tool'); notice.append(reason, acknowledge);
    acknowledge.addEventListener('click', () => acknowledgeNotice(d.id)); name.addEventListener('click', () => acknowledgeNotice(d.id));
    const status = make(doc, 'div', 'analysis-status'); status.setAttribute('role', 'cell');
    row.append(nameCell, toggle, chartCell, notice, status, details); table.append(row); rows.set(d.id, { row, name, sub, telegram, onText, chart, details, notice, reason, coinList, status, statusKey: null, coinKey: null });
    if (d.tools) rows.get(d.id).tools = d.tools({root:details,getOptions:()=>settings.rows[d.id].options,setOptions:value=>{settings.rows[d.id].options=d.normalizeOptions(value);commit();},services:toolServices});
    if(d.learning){const actions=make(doc,'div','analysis-model-actions'),learn=button('ⓘ Lernstand','chip-tool');learn.addEventListener('click',()=>rows.get(d.id).tools.openLearning());actions.append(learn);details.before(actions);if(d.id==='trend-pullback'){const count=make(doc,'span','analysis-signal-count');count.hidden=true;nameCell.append(count);rows.get(d.id).signalCount=count;}}
  }
  const hint = make(doc, 'p', 'analysis-hint', 'Modellname klappt Coins auf oder zu. Rücksetzer: Modellname aktiviert den Chart-Fokus, „Coins“ klappt die Liste. Telegram schaltet Nachrichten für das Modell. Chart-Haken: nur diese Analyse anzeigen; ausschalten beendet den Fokus. Coin-Name öffnet dessen Chart. Prüfung & Erklärung zeigt alle Stufen und Werte.');
  const messages = make(doc, 'div', 'analysis-messages'); messages.setAttribute('role', 'status'); messages.hidden = true;
  const info = make(doc, 'details', 'analysis-info'), infoSummary = make(doc, 'summary', '', 'ⓘ Bedienung & Erklärungen');
  info.append(infoSummary, make(doc, 'p', '', definitions.map(d => d.name + ': ' + d.description).join(' ')), make(doc, 'p', '', 'EMA 200 zeigt den langfristigen Trend. Ein Order Block ist die letzte Gegenkerze vor einem Impuls von mindestens 1,5 ATR mit Strukturbruch. FVG ist eine noch offene Drei-Kerzen-Lücke. Ein Sweep durchsticht ein früher bestätigtes Hoch/Tief und schließt wieder dahinter. Liquiditätspools sind aus ähnlichen Hochs/Tiefs abgeleitete Preisbereiche; Beim Top-Down-Fokus erscheinen nur die tatsächlichen Konfluenzzonen und ihre Bausteine, die 4h-EMA-200 sowie MACD. Allgemeine Heatmaps, Muster und Prognosen bleiben ausgeblendet. Zonen und Markierungen antippen: Begründung und Werte öffnen. Top-Down zeichnet erst nach 15m-Bestätigung einen Einstieg ein. NY Open zeigt ausschließlich Opening Range, Signalfenster, FVG und bestätigte NY-Einstiegs-/Ausstiegsmarken.'), make(doc, 'p', '', 'Nur normale, geschlossene Börsenkerzen. Top-Down: Ein Setup braucht mindestens zwei unterschiedliche Bausteinarten. Eine Umkehr allein genügt nicht: erst der folgende 15m-Schluss über/unter der davor bekannten Mikrostruktur bestätigt. Ziele sind vorhandene Levels; fehlen zwei passende Ziele, gibt es kein Signal. CRV ist brutto, ohne Gebühren/Slippage.'), make(doc, 'p', '', 'Telegram muss für Analyse, Coin global und Coin in dieser Analyse an sein. Standard: Analyse aus, alle Coins freigegeben. Die App prüft die freigegebenen Coins im Hintergrund, solange sie geöffnet und aktiv ist. Spätere 24/7-Dienstübergabe ist vorbereitet; aktuell sendet der Dienst diese Analyse noch nicht. Top-Down: ein Signal je Setup, anschließend mindestens zwei Stunden Sperre je Coin und Richtung. NY Open: höchstens ein Signal pro Coin und NY-Handelstag, auch bei Richtungswechsel oder Neustart. Geprüfte Wahrscheinlichkeiten erscheinen ausschließlich nach ausreichenden Lerndaten und einem bestandenen zeitlichen Test.'));
  info.insertBefore(hint, infoSummary.nextSibling);
  const log = make(doc, 'details', 'analysis-log'), logSummary = make(doc, 'summary', '', 'Analyse-Protokoll'), logList = make(doc, 'ol'); log.append(logSummary, logList);
  const commonEvents=make(doc,'details','analysis-common-events');commonEvents.hidden=true;commonEvents.append(make(doc,'summary','','Gemeinsame Marktereignisse'),make(doc,'div'));let commonKey='';
  body.append(table, commonEvents, messages, info, log); root.append(body);
  root.addEventListener('toggle', () => { if (settings.open !== root.open) { settings.open = root.open; commit(); } });
  function paint() {
    const symbols = coins();
    for (const d of definitions) { const r = rows.get(d.id), s = settings.rows[d.id]; (d.focusOnName?r.sub:r.name).setAttribute('aria-expanded', String(s.coinsOpen));if(d.focusOnName)r.name.setAttribute('aria-pressed',String(shown(d.id))); r.name.title = d.focusOnName?`${d.name}: Chart-Fokus ${shown(d.id)?'beenden':'öffnen'}`:`${d.name}: Coins ${s.coinsOpen ? 'ausblenden' : 'anzeigen'}`; r.sub.textContent = `Coins (${symbols.filter(symbol => s.coins[symbol] !== false).length}/${symbols.length})${settings.focus === d.id ? ' · Im Chart' : ''}`; r.telegram.checked = s.telegram; r.onText.textContent = d.information?'Info':s.telegram ? 'An' : 'Aus'; r.chart.checked = shown(d.id); r.row.dataset.focus = String(settings.focus === d.id); r.details.hidden = !s.coinsOpen; paintCoins(d, r); if (d.learning||root.open && s.coinsOpen) r.tools?.paint(); }
  }
  function paintCoins(d, row) {
    const symbols = coins(), key = symbols.join('|');
    if (row.coinKey !== key) {
      row.coinKey = key; row.coinList.replaceChildren();
      for (const symbol of symbols) {
        const choice = make(doc, 'div', 'analysis-coin-choice'), label = make(doc, 'label', 'analysis-switch'), checkbox = make(doc, 'input'), word = make(doc, 'span'), name = button(symbol.replace(/USDT$/, '') + ' ↗', 'analysis-inline-coin'), hint = make(doc, 'small');
        name.dataset.analysisOpenCoin = symbol; name.setAttribute('aria-label', `${symbol.replace(/USDT$/, '')}: Chart mit ${d.name} öffnen`);
        name.addEventListener('click', () => { if (settings.focus !== d.id) activate(d.id); openCoin(symbol, d.id); });
        choice.dataset.coin = symbol; checkbox.type = 'checkbox'; checkbox.setAttribute('role', 'switch'); checkbox.setAttribute('aria-label', `${d.name}: ${symbol} ${d.information?'in Auswahl':'für Telegram'}`); label.append(checkbox, word); choice.append(name, hint, label); row.coinList.append(choice);
        checkbox.addEventListener('change', () => { settings.rows[d.id].coins[symbol] = checkbox.checked; commit(); paint(); });
      }
    }
    for (const choice of row.coinList.children) { const symbol = choice.dataset.coin, on = settings.rows[d.id].coins[symbol] !== false, name = choice.querySelector('.analysis-inline-coin'); if (symbol === selectedCoin()) name.setAttribute('aria-current', 'true'); else name.removeAttribute('aria-current'); choice.querySelector('input').checked = on; choice.querySelector('label span').textContent = on ? 'An' : 'Aus'; choice.querySelector('small').textContent = d.information?(on?'In der Auswahlhilfe':'Aus Auswahlhilfe ausgeblendet'):settings.globalCoins[symbol] === false ? 'Global stumm' : !settings.rows[d.id].telegram ? 'Analyse-Telegram aus' : on ? 'Telegram freigegeben' : 'Telegram stumm'; }
  }
  function reload() {
    const previous = settings; settings = analysisSettings(read(), definitions);
    // Auch beim Ausschalten in einem zweiten Tab die lokale, vorherige Auswahl wiederherstellen.
    if (!settings.focus && !settings.base && previous.focus && previous.base) settings.base = { ...previous.base };
    root.open = settings.open; apply(); paint();
  }
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
  // Jede Modellkarte aktualisiert sich unabhängig; aufgeklappte Prüfungen bleiben offen.
  function paintCard(target, card) {
    const key = JSON.stringify(card); if (target.statusKey === key) return; target.statusKey = key;
    const status = target.status, detail = card.detail, overview = analysisOverview(card);
    const folds = new Map([...status.querySelectorAll('details[data-status-fold]')].map(d => [d.dataset.statusFold, d.open]));
    const activeFold = doc.activeElement?.closest('details[data-status-fold]')?.dataset.statusFold;
    const line = make(doc, 'div', 'analysis-overview-head'), context = make(doc, 'div', 'analysis-context');
    line.setAttribute('aria-live', 'polite'); line.setAttribute('aria-atomic', 'true');
    context.append(make(doc, 'strong', 'analysis-pair', card.pair || ''), make(doc, 'span', 'analysis-stage-count', detail?.counter||`${overview.stage}/3 Stufen`));
    const badge = make(doc, 'span', 'analysis-direction', overview.badge); badge.dataset.tone = overview.tone;
    line.append(context, badge); status.replaceChildren(line);
    if (overview.steps.length) {
      const progress = make(doc, 'ol', 'analysis-progress'); progress.setAttribute('aria-label', 'Fortschritt der Analyse');
      for (const [i, step] of overview.steps.entries()) {
        const item = make(doc, 'li'); item.dataset.done = String(step.done); item.dataset.current = String(step.current);
        item.setAttribute('aria-label', `${step.label}: ${step.state}`);
        item.append(make(doc, 'span', 'analysis-step-number', step.done ? '✓' : String(i + 1)), make(doc, 'span', '', step.label)); progress.append(item);
      }
      status.append(progress);
    }
    status.append(make(doc, 'p', 'analysis-current-reason', overview.reason));
    if(card.fit){const fit=make(doc,'details','analysis-fit'),summary=make(doc,'summary','',`ⓘ ${card.fit.label}`);fit.dataset.statusFold=card.id+'|phase';fit.open=folds.get(fit.dataset.statusFold)??false;fit.dataset.fit=card.fit.state;fit.append(summary,make(doc,'p','',card.fit.text+(card.fit.at&&toolServices.time?' Letzter 1H-Schluss: '+toolServices.time(card.fit.at):'')));status.append(fit);}
    if(card.strength){const rs=make(doc,'small','analysis-strength-note',`Relative Stärke: Rang ${card.strength.rank}/${card.strength.total}${card.strength.stretched?' · bereits weit gelaufen':''}. Auswahlhilfe, keine zusätzliche Signalregel.`);status.append(rs);}

    if (overview.levels.length) {
      const levels = make(doc, 'dl', 'analysis-status-levels');
      for (const [label, value] of overview.levels) { const item = make(doc, 'div'); item.append(make(doc, 'dt', '', label), make(doc, 'dd', '', value)); levels.append(item); }
      status.append(levels);
    }
    if (detail) {
      const inspection = make(doc, 'details', 'analysis-inspection'), foldKey = card.id + '|inspection';
      inspection.dataset.statusFold = foldKey; inspection.open = folds.get(foldKey) ?? false;
      inspection.append(make(doc, 'summary', '', 'ⓘ Prüfung & Erklärung'));
      const box = make(doc, 'div', 'analysis-status-card'); inspection.append(box);
      for (const step of detail.steps) {
        const row = make(doc, 'div', 'analysis-stage'), head = make(doc, 'div', 'analysis-stage-head'), badge = make(doc, 'span', 'analysis-direction', step.state);
        row.dataset.analysisStage = step.id; badge.dataset.tone = step.tone;
        head.append(make(doc, 'strong', '', step.label), badge); row.append(head, make(doc, 'p', '', step.text));
        if (step.id === '4h') {
          const fold = make(doc, 'details', 'analysis-bias-details'), key = card.pair + '|4h'; fold.dataset.statusFold = key; fold.open = folds.get(key) ?? detail.openChecks;
          fold.append(make(doc, 'summary', '', 'ⓘ 4h-Prüfung · Was stimmt überein?'));
          for (const check of detail.checks) {
            const item = make(doc, 'div', 'analysis-bias-check'), label = make(doc, 'div', 'analysis-stage-head'), direction = make(doc, 'span', 'analysis-direction', check.state);
            item.dataset.analysisCheck = check.id; direction.dataset.tone = check.tone;
            label.append(make(doc, 'strong', '', check.label), direction); item.append(label, make(doc, 'p', '', check.value)); fold.append(item);
          }
          const help = make(doc, 'details', 'analysis-check-help'), helpKey = card.pair + '|rules'; help.dataset.statusFold = helpKey; help.open = folds.get(helpKey) ?? false;
          help.append(make(doc, 'summary', '', 'ⓘ Was bedeuten EMA 50/200 und die Farben?'), make(doc, 'p', '', detail.help)); fold.append(help, make(doc, 'small', 'analysis-basis', detail.basis)); row.append(fold);
        }
        box.append(row);
      }

      if(detail.ranking){const ranking=make(doc,'ol','analysis-ranking');for(const item of detail.ranking){const li=make(doc,'li'),coin=button(item.symbol.replace('USDT','/USDT'),'analysis-inline-coin');coin.addEventListener('click',()=>{activate(card.id);openCoin(item.symbol,card.id);});const value=item.changes[1].toLocaleString('de-DE',{maximumFractionDigits:2});li.append(coin,make(doc,'span','',`${item.rank}. · 4h ${value} % zu BTC${item.stretched?' · weit gelaufen':''}`));ranking.append(li);}inspection.append(ranking);}
      status.append(inspection);
    }
    // Auch bei einer tatsächlich neuen geschlossenen Kerze den Tastaturfokus erhalten.
    if (activeFold) [...status.querySelectorAll('details[data-status-fold]')].find(d => d.dataset.statusFold === activeFold)?.querySelector('summary')?.focus({ preventScroll: true });
  }
  function paintResult(text, entries = [], cards = [], events=[]) {
    const next=JSON.stringify(events);if(next!==commonKey){commonKey=next;commonEvents.hidden=!events.length;const target=commonEvents.lastElementChild;target.replaceChildren(make(doc,'p','analysis-hint','Mehrere Modelle für denselben Coin sind ein Marktereignis und keine unabhängigen Bestätigungen. Gegensätzliche Richtungen bleiben als Konflikt sichtbar. Telegram und Signalpunkte bleiben unverändert.'));for(const event of events){const line=make(doc,'p','analysis-common-event'),coin=button(event.symbol.replace('USDT','/USDT'),'analysis-inline-coin');coin.addEventListener('click',()=>{activate(event.models[0].id);openCoin(event.symbol,event.models[0].id);});line.append(coin,make(doc,'span','',`${event.direction===1?'Long':'Short'} · ${event.models.map(m=>m.name).join(' + ')}${event.conflict?' · Richtungskonflikt':''}`));target.append(line);}}
    for (const card of cards) { const target = rows.get(card.id); if (target) paintCard(target, card); }
    const message = cards.length ? cards.filter(c => !rows.has(c.id)).map(c => c.text).filter(Boolean).join('\n') : text;
    if (messages.textContent !== message) messages.textContent = message;
    messages.hidden = !message;
    if (log.open) logList.replaceChildren(...entries.slice(-25).reverse().map(e => make(doc, 'li', '', e.text)));
  }
  function rememberManual(keys) { if (!settings.base) return; const current = getOverlays(); for (const k of keys) if (k in settings.base) settings.base[k] = !!current[k]; commit(); }
  const aggregate=make(doc,'span','analysis-signal-count');aggregate.hidden=true;summary.append(aggregate);
  function paintHighlights(value){const row=rows.get('trend-pullback');if(!row)return;row.row.dataset.pullbackPulse=String(value.pulse);row.signalCount.hidden=!value.count;row.signalCount.textContent=String(value.count);row.signalCount.setAttribute('aria-label',`${value.count} Coins mit Rücksetzer-Signal`);aggregate.hidden=!value.count;aggregate.textContent=String(value.count);aggregate.setAttribute('aria-label',`${value.count} Coins mit Rücksetzer-Signal`);summary.dataset.pullbackPulse=String(value.pulse);}
  // Persistierte Basis verhindert, dass nach einem Neustart die Fokus-Auswahl als ursprünglicher Zustand gespeichert wird.
  apply(); paint();
  return { root, get settings() { return settings; }, paint, reload, shown, globalToggle, paintResult, paintNotices, rememberManual,
    tools:id => rows.get(id)?.tools, paintHighlights, activate,
    endFocus: () => { if (!settings.focus) return; activate(null); } };
}
