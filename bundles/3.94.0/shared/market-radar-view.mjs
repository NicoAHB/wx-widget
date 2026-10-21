import { marketRadar, RADAR_CONFIG } from './market-radar-core.mjs';
import { radarBook, updateRadarBook, RADAR_KEY } from './market-radar-journal.mjs';

const LABELS = { quiet: 'Ruhig', attention: 'Auffällig', risk: 'Risiko', partial: 'Teildaten', missing: 'Offen', loading: 'Lädt', stale: 'Veraltet', paused: 'Pausiert', offline: 'Offline' };
const FLAGS = { volume: 'Volumen', oi: 'Open Interest', funding: 'Funding', macro: 'USD-Termin', announcement: 'Binance-Meldung', news: 'News' };
const dec = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }), signed = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2, minimumFractionDigits: 2, signDisplay: 'exceptZero' });
const clock = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });
const compact = new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 });
const stamp = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const pct = v => Number.isFinite(v) ? signed.format(v).replace('-', '−') + ' %' : '–';
function age(at, now) {
  if (!(at > 0) || at > now) return 'Zeit unbekannt';
  const seconds = Math.floor((now - at) / 1000);
  return seconds < 60 ? `vor ${seconds} s` : seconds < 3600 ? `vor ${Math.floor(seconds / 60)} Min.` : `vor ${Math.floor(seconds / 3600)} Std.`;
}
const amount = v => Number.isFinite(v) ? compact.format(v) + ' USDT' : '–';
const safeUrl = url => { try { const u = new URL(url); return u.protocol === 'https:' && ['www.binance.com', 'news.google.com'].includes(u.hostname) && !u.username && !u.password ? u.href : ''; } catch { return ''; } };

export function createMarketRadarView({ root, input, read, save, navigate = () => {} }) {
  const doc = root.ownerDocument;
  const el = (tag, cls, value) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (value) n.textContent = value; return n; };
  const text = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  const button = (label, action) => { const b = el('button', 'button ghost', label); b.type = 'button'; b.addEventListener('click', action); return b; };
  const icon = () => {
    const s = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 28 28'); s.setAttribute('aria-hidden', 'true');
    for (const r of [4, 9]) { const c = doc.createElementNS(s.namespaceURI, 'circle'); for (const [key, v] of Object.entries({ cx: 14, cy: 14, r })) c.setAttribute(key, v); s.append(c); }
    const ray = doc.createElementNS(s.namespaceURI, 'path'); ray.setAttribute('d', 'M14 14 23 5M14 3v3M3 14h3M14 22v3M22 14h3'); s.append(ray); return s;
  };
  root.id = 'market-radar'; root.classList.add('market-radar');
  const summary = el('summary'), glyph = el('span', 'mr-glyph'), heading = el('span', 'mr-heading'), title = el('strong', '', 'Marktradar'), meta = el('span', 'mr-meta');
  title.id = 'market-radar-title'; summary.id = 'market-radar-summary'; root.setAttribute('aria-labelledby', title.id);
  const badge = el('span', 'mr-badge'), chevron = el('span', 'mr-chevron', '⌄'); chevron.setAttribute('aria-hidden', 'true'); glyph.append(icon()); heading.append(title, meta); summary.append(glyph, heading, badge, chevron);
  const body = el('div', 'mr-body'), lead = el('p', 'mr-lead'), cards = el('div', 'mr-cards');
  const makeCard = (key, label, number) => {
    const section = el('section', 'mr-card'), head = el('div', 'mr-card-head'), name = el('h4', '', label), numberNode = el('span', 'mr-card-number', number), state = el('span', 'mr-card-state');
    section.dataset.radarCard = key; head.append(numberNode, name, state); section.append(head); cards.append(section); return { section, state };
  };
  const activity = makeCard('activity', 'Aktivität', '01'), activityValue = el('strong', 'mr-value'), activityHint = el('p', 'mr-caption'), bars = el('div', 'mr-bars'); bars.setAttribute('aria-hidden', 'true');
  const taker = el('p', 'mr-fact'), whales = el('p', 'mr-fact'), activitySource = el('p', 'mr-source');
  activity.section.append(activityValue, activityHint, bars, taker, whales, activitySource);
  const positioning = makeCard('positioning', 'Positionierung', '02'), funding = el('strong', 'mr-value'), fundingHint = el('p', 'mr-caption', 'aktuelle Funding-Rate'), oi = el('p', 'mr-fact'), oiPrice = el('p', 'mr-fact'), positionSource = el('p', 'mr-source');
  positioning.section.append(funding, fundingHint, oi, oiPrice, positionSource);
  const context = makeCard('context', 'Umfeld', '03'), event = el('strong', 'mr-event'), eventHint = el('p', 'mr-caption'), headlines = el('div', 'mr-headlines'), newsSource = el('p', 'mr-source'), eventSource = el('p', 'mr-source');
  context.section.append(event, eventHint, headlines, newsSource, eventSource);
  const freshness = el('p', 'mr-freshness'), actions = el('div', 'mr-actions');
  for (const [label, target] of [['Orderflow', 'workspace-orderflow'], ['News', 'cnews'], ['Termine', 'econ']]) actions.append(button(label, () => navigate(target)));
  const method = el('details', 'mr-method'), methodTitle = el('summary', '', 'Was die Hinweise bedeuten'); method.append(methodTitle);
  const rules = el('div');
  for (const value of [
    'Volumen: letzte vollständig geschlossene 1m-Kerze der Binance-USDT-Futures gegen die vorherigen 20. Ab 2× Durchschnitt auffällig. Laufende Kerzen zählen nicht. Große Trades werden separat aus dem gewählten Chartmarkt gezeigt; allein lösen sie keinen Hinweis aus.',
    'Open Interest: Veränderung über 15 Minuten, ab ±3 % auffällig. Es zählt offene Kontrakte, keine Long-/Short-Richtung. Funding: ab ±0,10 % erhöhte Finanzierungskosten und mögliche Überfüllung; die Rate ist keine Kursprognose.',
    'Umfeld: wichtige USD-Termine 15 Minuten davor und danach sowie wichtige Binance-Risikomeldungen. Neue wichtige Schlagzeilen bleiben eine Stunde auffällig. Der News-Auszug wird periodisch aktualisiert; Veröffentlichungszeit und Stand sind getrennt sichtbar.',
    'Ruhig erscheint nur bei aktuellen Futures-Daten und allen fünf verfügbaren Quellen: Volumen, Funding, Open Interest, News und USD-Kalender. Eine Quellenlücke bleibt als Teildaten sichtbar. Futures-Kurse höchstens 5 Sekunden, Funding 3 Minuten, OI 10 Minuten, News-Auszug 4 Stunden und Kalender 12 Stunden alt.',
    'Der Radar beschreibt Marktauffälligkeiten. Er liefert keine Kauf-/Verkaufsempfehlung oder Erfolgswahrscheinlichkeit. Große Börsentrades sind keine nachverfolgten Wallet-Transfers. On-Chain- und Fear-&-Greed-Daten sind hier nicht angebunden.'
  ]) rules.append(el('p', '', value));
  method.append(rules);
  const journal = el('details', 'mr-journal'), journalSummary = el('summary'), journalTitle = el('span', '', 'Beobachtungen'), journalCount = el('span', 'mr-journal-count'); journalSummary.append(journalTitle, journalCount);
  const journalBody = el('div', 'mr-journal-body'), trackLabel = el('label', 'mr-track'), track = el('input'); track.type = 'checkbox'; track.id = 'market-radar-track';
  trackLabel.append(track, el('span', '', 'Radarhinweise im App-Speicher merken'));
  const journalNote = el('p', 'mr-caption', 'Optional · bis zu 200 Beobachtungen. Aufzeichnung bei geöffnetem Programm und aktuellem Futures-Kurs. +15m / +60m zeigen die Kursbewegung zum ersten Minutenschluss danach (höchstens 60 s später). Fehlende Kurse bleiben offen. Das sind Marktbewegungen, keine Trades oder Nettogewinne.');
  const rows = el('div', 'mr-observations'), download = button('Beobachtungen herunterladen', () => {
    const blob = new globalThis.Blob([JSON.stringify({ model: 'market-radar-1', exportedAt: Date.now(), ...radarBook(read()) }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = el('a'); link.href = url; link.download = 'marktradar-' + new Date().toISOString().slice(0, 10) + '.json'; doc.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  });
  const error = el('p', 'mr-save-error'); error.hidden = true; error.setAttribute('role', 'status');
  journalBody.append(trackLabel, journalNote, rows, download); journal.append(journalSummary, journalBody);
  body.append(lead, cards, freshness, actions, method, journal, error); root.append(summary, body);
  let lastOpen = radarBook(read()).open, barsKey = '', itemsKey = '', bookKey = '', latest = null;
  root.open = lastOpen;
  function write(book) { try { save(book); error.hidden = true; return true; } catch { error.hidden = false; text(error, 'Beobachtungen oder Klappzustand konnten nicht gespeichert werden. Gerätespeicher prüfen.'); return false; } }
  root.addEventListener('toggle', e => { if (e.target !== root || root.open === lastOpen) return; lastOpen = root.open; write({ ...radarBook(read()), open: root.open }); });
  track.addEventListener('change', () => { write({ ...radarBook(read()), track: track.checked }); tick(); });
  function cardState(card, state, inactive) { const value = inactive || state; card.section.dataset.state = value; text(card.state, LABELS[value] || LABELS.missing); }
  function tick() {
    const raw = input(), model = marketRadar(raw); latest = model;
    const before = radarBook(read()), book = updateRadarBook(before, model, raw.futures?.symbol === model.symbol ? raw.futures.series : []);
    if (JSON.stringify(before) !== JSON.stringify(book)) write(book);
    if (book.open !== lastOpen) { lastOpen = book.open; root.open = book.open; }
    if (track.checked !== book.track) track.checked = book.track;
    root.dataset.state = model.status; text(meta, model.symbol.replace(/USDT$/, '/USDT') + ' · Futures'); text(badge, LABELS[model.status]);
    summary.setAttribute('aria-label', `Marktradar ${model.symbol.replace(/USDT$/, '')}: ${LABELS[model.status]}. Details ${root.open ? 'schließen' : 'öffnen'}`);
    const inactive = ['paused', 'offline', 'stale', 'loading'].includes(model.status) ? model.status : null;
    const firstFlag = model.flags.find(f => f.severity === 'risk') || model.flags[0];
    text(lead, inactive ? { paused: 'Liveprüfung pausiert.', offline: 'Offline · aktuelle Marktdaten fehlen.', stale: 'Live-Kurs veraltet · Marktprüfung wartet auf aktuelle Daten.', loading: 'Marktdaten werden geladen.' }[inactive]
      : firstFlag ? firstFlag.label + (model.coverage < 5 ? ' · einzelne Quellen fehlen.' : ' · Gründe und Zeitbasis unten.')
        : model.coverage < 5 ? 'Einzelne Quellen fehlen · noch kein vollständiges Marktbild.' : 'Aktuell keine der definierten Auffälligkeiten.');
    const a = model.activity, p = model.positioning, c = model.context;
    cardState(activity, a.status, inactive); cardState(positioning, p.status, inactive); cardState(context, c.status, inactive);
    text(activityValue, a.ratio !== null ? dec.format(a.ratio) + '× Volumen' : '–');
    text(activityHint, a.ready ? 'letzte geschlossene 1m-Kerze · gegen Ø 20' : 'Vergleich wartet auf aktuelle, lückenlose 1m-Daten.');
    const bk = a.bars.join(','); if (bk !== barsKey) { barsKey = bk; const max = Math.max(...a.bars, 1); bars.replaceChildren(...a.bars.map((v, i) => { const b = el('i'); b.style.height = Math.max(3, v / max * 100) + '%'; if (i === a.bars.length - 1) b.dataset.last = 'true'; return b; })); } bars.hidden = !a.bars.length;
    text(taker, a.taker !== null ? `Taker-Käufe ${dec.format(a.taker * 100)} % · ${amount(a.volume)}` : 'Taker-Käufe: –');
    const w = a.whales;
    text(whales, w.ready ? `Große Trades · ${w.market === 'spot' ? 'Spot' : 'Futures'} · ${Math.floor(w.span / 1000)} s: ${w.buyCount} Kauf / ${w.sellCount} Verkauf${w.total ? ' · ' + amount(w.total) : ''}` : 'Große Trades: aktuell nicht erfasst.');
    text(activitySource, `Binance USDT-Futures · ${a.at ? 'Kerzenschluss ' + clock.format(a.at) : 'Vergleich offen'}${w.min ? ' · Trades ab ' + amount(w.min) : ''}`);
    text(funding, pct(p.fundingPct)); text(fundingHint, p.fundingReady ? 'Funding · ' + (p.fundingPct > 0 ? 'Long zahlt an Short' : p.fundingPct < 0 ? 'Short zahlt an Long' : 'aktuell ausgeglichen') : 'Funding derzeit nicht aktuell verfügbar');
    text(oi, `Open Interest · 15m: ${pct(p.oiChange)}`); text(oiPrice, `Kurs im selben Zeitraum: ${pct(p.priceChange)}`);
    text(positionSource, `Binance USDT-Futures · Funding ${age(p.fundingAt, model.now)} · OI ${age(p.oiAt, model.now)}`);
    text(event, c.event ? c.event.title : c.calendarReady ? 'Kein wichtiger USD-Termin' : 'USD-Kalender offen');
    text(eventHint, c.event ? `USD · ${stamp.format(c.event.t)} · ${c.event.t > model.now ? 'in ' + Math.ceil((c.event.t - model.now) / 60000) + ' Min.' : age(c.event.t, model.now)}` : c.calendarReady ? 'im nächsten 24-Stunden-Fenster' : 'Kalender fehlt oder ist veraltet.');
    const ik = JSON.stringify([c.items, c.newsReady, c.newsFresh]); if (ik !== itemsKey) { itemsKey = ik;
      headlines.replaceChildren(...(c.items.length ? c.items.map(x => { const row = el('div', 'mr-headline'), url = safeUrl(x.url), title = el(url ? 'a' : 'span', '', x.title), source = el('small', '', `${x.source} · ${stamp.format(x.publishedAt)}`);
        if (url) { title.href = url; title.target = '_blank'; title.rel = 'noopener noreferrer'; } row.append(title, source); return row; }) : [el('p', 'mr-caption', c.newsReady ? 'Keine wichtige Meldung im aktuellen Auszug.' : c.newsFresh ? 'Coin im News-Auszug nicht abgedeckt.' : 'News-Auszug fehlt oder ist veraltet.')])); }
    text(newsSource, `Binance / Google News · Stand ${c.newsAt > 0 ? stamp.format(c.newsAt) + (c.newsFresh ? '' : ' · veraltet') : 'offen'}`);
    text(eventSource, `${c.calendarSource} · Stand ${c.calendarAt > 0 ? stamp.format(c.calendarAt) + (c.calendarReady ? '' : ' · veraltet') : 'offen'}`);
    text(freshness, `${model.coverage}/5 Quellen aktuell · ${model.quote ? 'Futures-Kurs ' + age(model.quote.at, model.now) : 'kein aktueller Futures-Kurs'} · News sind ein periodischer Auszug.`);
    text(journalCount, String(book.observations.length)); download.disabled = !book.observations.length;
    const jk = JSON.stringify(book.observations); if (jk !== bookKey) { bookKey = jk;
      rows.replaceChildren(...(book.observations.length ? book.observations.slice(-6).reverse().map(r => { const row = el('div', 'mr-observation'), label = el('div', 'mr-observation-label'), values = el('div', 'mr-outcomes');
        label.append(el('strong', '', r.symbol.replace(/USDT$/, '/USDT')), el('small', '', stamp.format(r.at) + ' · ' + r.flags.map(f => FLAGS[f]).join(', ')));
        for (const [key, title] of [['after15', '+15m'], ['after60', '+60m']]) { const cell = el('span'), value = r[key] ? (r[key].price / r.price - 1) * 100 : null; cell.append(el('small', '', title), el('b', '', pct(value))); cell.dataset.tone = value === null ? 'none' : value > 0 ? 'up' : value < 0 ? 'down' : 'none'; values.append(cell); }
        row.append(label, values); return row; }) : [el('p', 'mr-caption', 'Noch keine Beobachtungen. „Merken“ aktivieren, um neue Hinweise und spätere Kursbewegungen lokal zu dokumentieren.')])); }
    return model;
  }
  tick();
  return { root, tick, get model() { return latest; }, key: RADAR_KEY, config: RADAR_CONFIG };
}
