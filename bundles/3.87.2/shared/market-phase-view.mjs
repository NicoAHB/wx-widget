import { MARKET_PHASE, PHASE_NAMES, PHASE_ARROWS, PHASE_LOG_KEY, PHASE_CHECK_KEY } from './market-phase-core.mjs';
import { runPhaseCheck } from './market-phase-check.mjs';
const number = (v, d = 2) => Number.isFinite(v) ? v.toLocaleString('de-DE', { maximumFractionDigits: d, minimumFractionDigits: d }) : '–';
const price = v => number(v, Math.abs(v) >= 100 ? 2 : Math.abs(v) >= 1 ? 4 : 6);
const clock = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }),
  date = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const direction = d => PHASE_NAMES[d] || 'Nicht verfügbar';
export function phaseExplanation(r) {
  if (!r?.ready) return { title: 'Marktphase (1H-Chart)', state: 'Nicht verfügbar', rows: [], pending: r?.reason || '1H-Daten werden geladen.', stamp: 'Zuletzt berechnet: –' };
  const v = r.votes, pair = a => a.length === 2 ? a.map(p => price(p.price)).join(' → ') : 'Noch keine zwei bestätigten Swings';
  return { title: 'Marktphase (1H-Chart)', state: `${direction(r.phase)} · ${r.count} von 4 Messwerten`, rows: [
    ['Marktstruktur', direction(v.structure.direction), `Hochs ${pair(v.structure.highs)} · Tiefs ${pair(v.structure.lows)}. Je ${MARKET_PHASE.swingLeft} Kerzen links und ${MARKET_PHASE.swingRight} rechts bestätigen einen Swing.`],
    ['EMA-Lage und Steigung', direction(v.ema.direction), `EMA 20 ${price(v.ema.ema20)} · EMA 50 ${price(v.ema.ema50)} · EMA 200 ${price(v.ema.ema200)}. EMA 50 über ${MARKET_PHASE.slopeBars} Kerzen: ${price(v.ema.slope)}; nötiger Betrag ${price(v.ema.threshold)} (${number(MARKET_PHASE.slopeATR, 1)} × ATR ${price(v.ema.atr)}).`],
    ['Trendstärke', direction(v.adx.direction), `ADX ${MARKET_PHASE.adxPeriod}: ${number(v.adx.adx)} · +DI ${number(v.adx.plusDI)} · −DI ${number(v.adx.minusDI)}. Unter ${MARKET_PHASE.minADX}: Seitwärts.`],
    ['Effizienz der Bewegung', direction(v.efficiency.direction), `ER ${number(v.efficiency.value, 3)} über ${MARKET_PHASE.efficiencyBars} Kerzen. Unter ${number(MARKET_PHASE.minEfficiency)}: Seitwärts. Netto ${price(v.efficiency.move)}; Summe der Bewegungen ${price(v.efficiency.path)}.`]
  ], pending: r.pending !== null ? `Wechsel zu ${direction(r.pending)}: ${r.streak}/${MARKET_PHASE.confirmations} Schlusskerzen bestätigt. Bis dahin bleibt der bisherige Pfeil.` : '',
  stamp: `Zuletzt berechnet: Schluss der 1H-Kerze von ${clock.format(r.at)} MEZ/MESZ` };
}
export function createMarketPhaseView({ root, getMarktphase, symbols, history, available, read, write, now = Date.now, workerFactory }) {
  const doc = root.ownerDocument, el = (tag, cls, text = '') => { const e = doc.createElement(tag); if (cls) e.className = cls; e.textContent = text; return e; },
    control = el('span', 'market-phase-control'), badge = el('span', 'market-phase-badge'), glyph = el('span','market-phase-glyph','–'), tip = el('details', 'tip left market-phase-tip'), summary = el('summary'), body = el('div', 'tip-body');
  // SVG vermeidet fehlende Pfeil-Glyphen in reduzierten Systemschriften; Screenreader nutzt den Text am Badge.
  const arrow=doc.createElementNS('http://www.w3.org/2000/svg','svg'),path=doc.createElementNS('http://www.w3.org/2000/svg','path');
  arrow.setAttribute('viewBox','0 0 24 24');arrow.setAttribute('width','20');arrow.setAttribute('height','20');arrow.setAttribute('aria-hidden','true');arrow.setAttribute('focusable','false');arrow.style.display='none';
  for(const [key,value]of Object.entries({d:'M5 12H19 M13 6L19 12L13 18',fill:'none',stroke:'currentColor','stroke-width':'1.8','stroke-linecap':'round','stroke-linejoin':'round'}))path.setAttribute(key,value);arrow.append(path);badge.append(glyph,arrow);
  badge.setAttribute('role', 'img'); summary.setAttribute('aria-label', 'Marktphase erklären'); summary.append(el('span', '', 'i')); tip.dataset.side = 'left'; tip.append(summary, body); control.append(badge, tip); root.append(control);
  const title = el('strong'), state = el('p', 'market-phase-state'), rows = el('dl', 'market-phase-values'), pending = el('p', 'market-phase-pending'), stamp = el('p', 'market-phase-stamp'),
    explanation = el('p', '', `Der Pfeil zeigt, ob der Coin aufwärts, abwärts oder seitwärts läuft. Er wird nur aus dem 1H-Chart berechnet und ist in allen Zeiträumen gleich. Aufwärts bzw. Abwärts: mindestens ${MARKET_PHASE.minVotes} von 4 Messwerten zeigen in diese Richtung. Seitwärts: kein klarer Trend. Der Pfeil wechselt erst, wenn die neue Phase ${MARKET_PHASE.confirmations} Kerzen in Folge bestätigt ist, deshalb kommt ein Wechsel mit Verzögerung. Der Pfeil ist nur eine Information und ändert die Signale der Karte nicht.`),
    check = el('button', 'button ghost', 'Phasen-Check'); check.type = 'button'; body.append(title, state, rows, pending, explanation, stamp, check);
  let selected = '', last = '';
  function paint(coin = selected) {
    selected = coin; const r = getMarktphase(coin), key = coin + '|' + JSON.stringify(r);
    if (key === last) return; last = key; glyph.textContent = r.ready ? PHASE_ARROWS[r.phase] : '–';glyph.classList.toggle('sr-only',r.ready);arrow.style.display=r.ready?'':'none';path.setAttribute('transform',`rotate(${r.phase===1?-45:r.phase===-1?45:0} 12 12)`);badge.dataset.phase = r.ready ? String(r.phase) : 'unknown';
    badge.setAttribute('aria-label', `Marktphase: ${r.ready ? direction(r.phase) : 'Nicht verfügbar'}`); badge.title = `Marktphase · 1H · ${r.ready ? direction(r.phase) : 'Nicht verfügbar'}`;
    const info = phaseExplanation(r); title.textContent = info.title; state.textContent = info.state; pending.textContent = info.pending; pending.hidden = !info.pending; stamp.textContent = info.stamp;
    rows.replaceChildren(...info.rows.map(([name, outcome, detail]) => { const box = el('div'); box.append(el('dt', '', `${name} · ${outcome}`), el('dd', '', detail)); return box; }));
  }
  function placeInfo(){
    if(!tip.open)return;
    const win=doc.defaultView,nav=doc.getElementById('tabbar'),bar=doc.getElementById('livebar')?.getBoundingClientRect(),
      view=win.visualViewport,minX=(view?.offsetLeft||0)+6,maxX=minX+(view?.width||win.innerWidth)-12,
      minY=Math.max((view?.offsetTop||0)+8,bar&&bar.top<=8&&bar.bottom>0?bar.bottom+8:0),
      end=nav?.getClientRects().length?Math.min(win.innerHeight,nav.getBoundingClientRect().top)-8:win.innerHeight-8,
      anchor=tip.getBoundingClientRect(),below=end-anchor.bottom-8,above=anchor.top-minY-8,width=Math.min(360,maxX-minX);
    body.style.width=width+'px';body.style.maxWidth=width+'px';body.style.right='auto';body.style.left=(Math.max(minX,Math.min(maxX-width,anchor.left))-anchor.left)+'px';
    if(below<160&&above>below){body.style.top='auto';body.style.bottom='calc(100% + 8px)';body.style.maxHeight=Math.max(0,Math.min(520,above))+'px';}
    else {body.style.bottom='auto';body.style.top='calc(100% + 8px)';body.style.maxHeight=Math.max(0,Math.min(520,below))+'px';}
  }
  let placement=0;const schedulePlacement=()=>{if(!tip.open||placement)return;placement=doc.defaultView.requestAnimationFrame(()=>{placement=0;placeInfo();});};
  tip.addEventListener('toggle',()=>{if(tip.open){paint();placeInfo();}});
  doc.addEventListener('scroll',e=>{if(!body.contains(e.target))schedulePlacement();},true);doc.defaultView.addEventListener('resize',schedulePlacement);doc.defaultView.visualViewport?.addEventListener('resize',schedulePlacement);
  // Bestehende Blatt-/Info-Stile und derselbe Historienclient wie NY/Analyse-Backtests.
  const dialog = el('dialog', 'sheet market-phase-check'), head = el('div', 'sheet-head'), heading = el('h2', '', 'Phasen-Check · 1H'); dialog.id = 'market-phase-check'; heading.id = 'market-phase-check-title'; dialog.setAttribute('aria-labelledby', heading.id);
  const close = el('button', 'button ghost', 'Schließen'); close.type = 'button'; head.append(heading, close);
  const content = el('div', 'sheet-body'), intro = el('p', '', `${MARKET_PHASE.checkMonths} Monate, alle Vorauswahl-Coins: Die folgenden ${MARKET_PHASE.checkForwardBars} Stunden bestätigen Aufwärts oberhalb +${MARKET_PHASE.checkMoveATR} ATR, Abwärts unterhalb −${MARKET_PHASE.checkMoveATR} ATR, sonst Seitwärts. ATR stammt vom Prüfzeitpunkt. Die Basisrate zeigt, wie oft die jeweilige Entwicklung über alle geprüften Stunden auftrat.`),
    actions = el('div', 'ny-actions'), run = el('button', 'chip-tool', 'Phasen-Check starten'), cancel = el('button', 'chip-tool', 'Abbrechen'), status = el('p', 'ny-backtest-status'), report = el('div', 'market-phase-report'), journal = el('details', 'ny-journal'), log = el('ol');
  run.type = cancel.type = 'button'; cancel.hidden = true; status.setAttribute('role', 'status'); actions.append(run, cancel); journal.append(el('summary', '', 'Phasen-Protokoll · letzte Wechsel'), log);
  content.append(intro, actions, status, report, el('p', 'analysis-hint', 'Überlappende 24h-Fenster sind voneinander abhängig. Trefferquoten sind keine Handelsergebnisse. Keine Änderung an Signalen oder Telegram.'), journal); dialog.append(head, content); doc.body.append(dialog);
  let controller = null;
  function paintReport() {
    const saved = read(PHASE_CHECK_KEY); report.replaceChildren(); if (!saved) { status.textContent = 'Noch kein Phasen-Check. Start lädt historische 1H-Kerzen begrenzt und zwischengespeichert.'; return; }
    status.textContent = `${saved.checked}/${saved.symbols.length} Coins geprüft · ${date.format(saved.from)}–${date.format(saved.to)} MEZ/MESZ · ${saved.errors.length} Datenfehler.`;
    const table = el('table'), thead = el('thead'), tr = el('tr'), tbody = el('tbody');
    for (const label of ['Coin', 'Phase', 'Anzahl', 'Trefferquote', 'Basisrate']) tr.append(el('th', '', label)); thead.append(tr); table.append(thead, tbody);
    for (const coin of saved.coins) for (const row of coin.rows) { const r = el('tr'); for (const text of [coin.symbol.replace(/USDT$/, '/USDT'), direction(row.phase), String(row.count), row.hitrate === null ? '–' : number(row.hitrate * 100, 1) + ' %', row.baseline === null ? '–' : number(row.baseline * 100, 1) + ' %']) r.append(el('td', '', text)); tbody.append(r); }
    const scroll = el('div', 'market-phase-table'); scroll.append(table); report.append(scroll);
    for (const e of saved.errors) report.append(el('p', '', e.symbol + ': ' + e.text));
  }
  function paintLog() { const saved = read(PHASE_LOG_KEY); log.replaceChildren(...(Array.isArray(saved) ? saved : []).slice(-MARKET_PHASE.visibleLog).reverse().map(r => el('li', '', `${date.format(r.at)} MEZ/MESZ · ${r.symbol} · ${direction(r.phase)} · ${r.count}/4 · Struktur ${direction(r.votes.structure.direction)}, EMA ${direction(r.votes.ema.direction)}, ADX ${number(r.votes.adx.adx)}, ER ${number(r.votes.efficiency.value, 3)}`))); }
  check.addEventListener('click', () => { tip.open = false; paintReport(); paintLog(); dialog.showModal(); }); close.addEventListener('click', () => dialog.close()); dialog.addEventListener('keydown', e => e.stopPropagation());
  run.addEventListener('click', async () => {
    if (controller) return; if (!available()) { status.textContent = 'App ist pausiert, offline oder nicht sichtbar.'; return; }
    controller = new AbortController(); const signal = controller.signal; run.disabled = true; cancel.hidden = false;
    try { const result = await runPhaseCheck({ symbols: symbols(), history, now: now(), signal, workerFactory, progress: p => { status.textContent = `${p.checked}/${p.total} Coins · ${p.symbol} · 1H-Historie wird geprüft …`; } }); if (!signal.aborted) { if (write(PHASE_CHECK_KEY, result) === false) throw Error('Phasen-Check konnte nicht gespeichert werden.'); paintReport(); } }
    catch (e) { status.textContent = signal.aborted ? 'Phasen-Check abgebrochen; der bisherige Bericht bleibt gespeichert.' : e.message; }
    finally { controller = null; run.disabled = false; cancel.hidden = true; }
  }); cancel.addEventListener('click', () => controller?.abort()); journal.addEventListener('toggle', () => { if (journal.open) paintLog(); });
  function availabilityChanged() { if (!available()) controller?.abort(); }
  doc.addEventListener('visibilitychange', availabilityChanged); doc.defaultView.addEventListener('offline', availabilityChanged);
  return { paint, control, badge, tip, dialog, availabilityChanged };
}
