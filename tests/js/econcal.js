// 3.60.0: isolierte Kopie mit optionalem UI-Arbeitsbereich; Fachregeln unverändert.
var workspace;
// ---------- Schritt 4.1: Wirtschaftskalender mit Warnung vor wichtigen Terminen ----------
// Quelle: Wochenkalender von Forex Factory. Der GitHub-Job .github/workflows/kalender.yml holt ihn alle 3 Stunden und legt
// ihn als calendar.json im Zweig „kalender“ ab. Die App liest die Datei über raw.githubusercontent.com (Abruf aus dem
// Browser erlaubt) beim Öffnen, danach alle 30 Minuten; nach einem Fehler erneut nach 5 Minuten. Der letzte Stand liegt im
// Speicher und steht so sofort da, auch ohne Netz.
// Anzeige unter dem Chart: die nächsten Termine der gewählten Währung (USD oder alle) und Bedeutung (hoch oder hoch und
// mittel), auf Wunsch die ganze Woche; Zeiten in Ortszeit. Warnung ab 15 Minuten (einstellbar: 5, 30, 60, aus) vor einem
// Termin mit hoher Bedeutung bis 15 Minuten danach: als Zeile in der Live-Leiste (auf jedem Tab) und im Kalender, dazu
// einmal ein Hinweis mit Ton und Systemmeldung und, falls eingerichtet, eine Nachricht an Telegram/Discord. Termine zur
// selben Zeit (z. B. CPI m/m und CPI y/y) gelten als einer; bei mehreren Tabs meldet nur einer.
// var statt const/let: econTick kann über den Sekundentakt schon laufen, bevor dieser Abschnitt ausgewertet ist
var EC_URL = 'https://raw.githubusercontent.com/NicoAHB/wx-widget/kalender/calendar.json';
var EC_KEY = 'scalpdesk.econ.v1', EC_DATA_KEY = 'scalpdesk.idb.econdata', EC_EVERY = 30 * 60e3, EC_RETRY = 5 * 60e3, EC_AFTER = 15 * 60e3, EC_STALE = 12 * 3600e3, EC_TOP = 5;
// Deutsche Kurzbeschreibung zu den wichtigsten (englischen) Titeln
var EC_DE = [[/^(Core )?CPI/i, 'Inflation'], [/^(Core )?PCE/i, 'PCE-Inflation'], [/^(Core )?PPI/i, 'Erzeugerpreise'], [/Non-Farm Employment/i, 'US-Arbeitsmarkt'],
  [/Unemployment Rate/i, 'Arbeitslosenquote'], [/Unemployment Claims/i, 'Erstanträge'], [/Average Hourly Earnings/i, 'Stundenlöhne'], [/Federal Funds Rate/i, 'Fed-Zinsentscheid'],
  [/FOMC|Fed Chair|Powell/i, 'US-Notenbank'], [/GDP/i, 'BIP'], [/Retail Sales/i, 'Einzelhandel'], [/ISM Manufacturing/i, 'ISM Industrie'], [/ISM Services/i, 'ISM Dienstleister'],
  [/JOLTS/i, 'offene Stellen'], [/Consumer (Confidence|Sentiment)/i, 'Verbrauchervertrauen'], [/Main Refinancing Rate|Monetary Policy Statement|ECB Press/i, 'EZB-Zinsentscheid'],
  [/Bank Holiday/i, 'Feiertag']];
function loadEc() {
  const v = store.get(EC_KEY), warn = [0, 5, 15, 30, 60].includes(v?.warn) ? v.warn : 15;
  return { cur: v?.cur === 'all' ? 'all' : 'usd', imp: v?.imp === 'medium' ? 'medium' : 'high', warn };
}
var ec = { cfg: loadEc(), data: null, at: 0, error: '', busy: false, retryAt: 0, more: false, rev: 0, key: '', list: '', seen: new Set() };
{ const c = store.get(EC_DATA_KEY); try { if (c?.d) { ec.data = ecParse(c.d); ec.at = Number(c.at) || 0; } } catch { /* alter oder kaputter Stand: neu laden */ } }
// Kalenderdatei prüfen und auf bekannte Felder beschränken (Texte landen nur als textContent im Dokument)
function ecParse(d) {
  if (!d || !Array.isArray(d.events)) throw new Error('Kalenderdatei ohne Termine');
  const s = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  const events = d.events.filter(e => Number.isFinite(e?.t) && typeof e.title === 'string' && /^[A-Z]{3}$/.test(e.cur)).slice(0, 800)
    .map(e => ({ t: e.t, cur: e.cur, impact: ['high', 'medium', 'low', 'holiday'].includes(e.impact) ? e.impact : 'none', title: s(e.title, 90), forecast: s(e.forecast, 20), previous: s(e.previous, 20), actual: s(e.actual, 20) }));
  return { fetchedAt: Date.parse(d.fetchedAt) || 0, source: s(d.source, 40) || 'Forex Factory', events };
}
async function ecFetch() {
  if (ec.busy) return;
  ec.busy = true;
  try {
    const r = await fetch(EC_URL, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (r.status === 404) throw new Error('Noch keine Kalenderdaten – der GitHub-Job legt sie nach der Veröffentlichung an.');
    if (!r.ok) throw new Error(`Kalender nicht erreichbar (Fehler ${r.status})`);
    const d = await r.json();
    ec.data = ecParse(d); ec.at = Date.now(); ec.error = ''; ec.retryAt = 0;
    store.set(EC_DATA_KEY, { at: ec.at, d });
  } catch (e) {
    ec.error = e instanceof TypeError ? 'Kalender nicht erreichbar – Internet oder Werbeblocker prüfen.' : e?.message || String(e);
    ec.retryAt = Date.now() + EC_RETRY;
  } finally { ec.busy = false; ec.rev++; }
}
// Termine nach Währung und Bedeutung; Feiertage der gewählten Währung immer
function ecFilter(events, cfg) {
  return events.filter(e => (cfg.cur === 'all' || e.cur === 'USD') && (e.impact === 'high' || e.impact === 'holiday' || (cfg.imp === 'medium' && e.impact === 'medium')));
}
// Termine mit hoher Bedeutung zur selben Zeit zusammengefasst; aktiv von warn Minuten vorher bis 15 Minuten danach
function ecWarnGroups(events, now, warn) {
  if (!warn) return [];
  const groups = new Map();
  for (const e of events) if (e.impact === 'high' && now >= e.t - warn * 60e3 && now <= e.t + EC_AFTER) { if (!groups.has(e.t)) groups.set(e.t, []); groups.get(e.t).push(e); }
  return [...groups].sort((a, b) => a[0] - b[0]).map(([t, list]) => ({ t, list }));
}
// „in 8 min“, „in 2 h 15 min“, „jetzt“ (erste Minute), „vor 3 min“
function ecIn(ms) {
  if (ms <= 0 && ms > -60e3) return 'jetzt';
  const m = ms > 0 ? Math.ceil(ms / 60e3) : Math.floor(-ms / 60e3), s = m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`;
  return ms > 0 ? `in ${s}` : `vor ${s}`;
}
function ecDay(t, now) {
  const d = new Date(t), a = new Date(now), day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(), diff = Math.round((day(d) - day(a)) / 864e5);
  if (diff === 0) return 'Heute'; if (diff === 1) return 'Morgen'; if (diff === -1) return 'Gestern';
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace(',', '');
}
var ecTime = t => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
var ecNum = s => s.replace(/(\d)\.(\d)/g, '$1,$2').replace(/(\d)%/, '$1 %');
var ecDe = title => EC_DE.find(([re]) => re.test(title))?.[1] || '';
var ecNames = g => g.list.map(e => e.title).join(', ');
function ecRow(e, now, warnT) {
  const row = el('div', `ec-row ${e.impact}${e.t + EC_AFTER < now ? ' past' : ''}${warnT.has(e.t) ? ' warn' : ''}`);
  const imp = el('i', `ec-imp ${e.impact}`); imp.title = { high: 'hohe Bedeutung', medium: 'mittlere Bedeutung', low: 'geringe Bedeutung', holiday: 'Feiertag – oft wenig Handel' }[e.impact] || '';
  const title = el('span', 'ec-title', e.title), de = ecDe(e.title); if (de && de !== e.title) title.append(el('small', '', ` · ${de}`));
  const vals = [e.actual && `Ist ${ecNum(e.actual)}`, e.forecast && `Prog. ${ecNum(e.forecast)}`, e.previous && `vorher ${ecNum(e.previous)}`].filter(Boolean).join(' · ');
  const soon = e.impact !== 'holiday' && Math.abs(e.t - now) < 12 * 3600e3, when = soon ? ecIn(e.t - now) : '';
  row.append(el('span', 'ec-time', e.impact === 'holiday' ? 'ganztags' : ecTime(e.t)), el('span', 'ec-cur', e.cur), imp, title, el('span', 'ec-in', when));
  // schmal (Handy): „in 11 min“ vorn in der Zeile mit Prognose und Vorwert statt in einer eigenen Spalte
  if (vals || when) { const v = el('span', 'ec-vals'); if (when) v.append(el('b', 'ec-in-n', vals ? `${when} · ` : when)); v.append(vals); row.append(v); }
  return row;
}
function renderEcon(now = Date.now()) {
  const box = $('econ'); if (!box) return;
  const cfg = ec.cfg, all = ec.data ? ecFilter(ec.data.events, cfg) : [], groups = ecWarnGroups(all, now, cfg.warn), warnT = new Set(groups.map(g => g.t));
  // Liste: die nächsten Termine (auch die der letzten 15 Minuten) oder die ganze Woche
  const shown = ec.more ? all : all.filter(e => e.t + EC_AFTER >= now).slice(0, workspace?.mode === 'focus' ? 3 : EC_TOP);
  const sig = JSON.stringify([ec.more, shown.map(e => [e.t, e.title, e.actual]), [...warnT], Math.floor(now / 60e3), ec.error && !ec.data]);
  if (sig !== ec.list) {
    ec.list = sig;
    const list = $('econ-list'), parts = []; let day = '';
    for (const e of shown) { const d = ecDay(e.t, now); if (d !== day) { day = d; parts.push(el('div', 'ec-day', d)); } parts.push(ecRow(e, now, warnT)); }
    if (!shown.length) parts.push(el('p', 'ec-empty', !ec.data ? (ec.error || 'Kalender wird geladen …')
      : `Keine ${cfg.imp === 'medium' ? 'wichtigen' : 'sehr wichtigen'} Termine${cfg.cur === 'usd' ? ' für USD' : ''} mehr${all.length ? ' in den geladenen Tagen' : ''}.`));
    list.replaceChildren(...parts);
    $('econ-more').textContent = ec.more ? 'Nur nächste Termine' : 'Ganze Woche'; $('econ-more').hidden = !all.length;
  }
  // Stand der Daten
  const src = $('econ-src'), f = ec.data?.fetchedAt, stale = !!f && now - f > EC_STALE, fd = f ? ecDay(f, now) : '';
  const fday = fd === 'Heute' ? '' : `${['Gestern', 'Morgen'].includes(fd) ? fd.toLowerCase() : fd} `;
  const srcText = !ec.data ? '' : `${ec.data.source} · Stand ${f ? fday + ecTime(f) : 'unbekannt'}${stale ? ' – veraltet, GitHub-Job prüfen' : ' · alle 3 h'}${ec.error ? ' · gerade nicht erreichbar' : ''}`;
  if (src.textContent !== srcText) src.textContent = srcText;
  src.classList.toggle('err', stale || (!!ec.error && !!ec.data));
  // Warnung im Kalender und in der Live-Leiste
  const g = groups[0], warnBox = $('econ-warn'), chip = $('lb-news');
  if (g) {
    const dt = g.t - now, cur = [...new Set(g.list.map(e => e.cur))].join('/'), done = dt <= 0;
    const text = done ? `⚠ ${cur} ${ecNames(g)} ${ecIn(dt)} (${ecTime(g.t)})${g.list.some(e => e.actual) ? ' – Ist ' + g.list.filter(e => e.actual).map(e => ecNum(e.actual)).join(', ') : ''}: noch bis ${ecTime(g.t + EC_AFTER)} starke Kursausschläge möglich.`
      : `⚠ ${ecIn(dt)} (${ecTime(g.t)}): ${cur} ${ecNames(g)} – hohe Bedeutung. Starke Kursausschläge möglich, vorsichtig mit neuen Trades.`;
    if (warnBox.textContent !== text) warnBox.textContent = text;
    warnBox.hidden = false; warnBox.classList.toggle('now', done);
    const chipText = `⚠ ${ecIn(dt)}: ${g.list[0].title}${g.list.length > 1 ? ` +${g.list.length - 1}` : ''}`; // Zeit vorn: gekürzt wird notfalls der Titel
    if (chip.textContent !== chipText) chip.textContent = chipText;
    chip.title = text; chip.hidden = false; chip.classList.toggle('now', done);
    void ecNotify(g, now);
  } else { warnBox.hidden = true; chip.hidden = true; }
}
// Einmal je Termin vorab melden: Hinweis mit Ton, Systemmeldung, Telegram/Discord (nur ein Tab, auch nach dem Neuladen
// nicht erneut). Nach der Veröffentlichung nicht mehr – dann bleiben nur die Warnzeilen.
async function ecNotify(g, now) {
  const key = `econ:${g.t}`;
  if (g.t <= now || ec.seen.has(key)) return;
  ec.seen.add(key);
  if (!(await store.claim(key, 24 * 3600e3))) return;
  const cur = [...new Set(g.list.map(e => e.cur))].join('/'), when = `in ${Math.ceil((g.t - now) / 60e3)} min (${ecTime(g.t)} Uhr)`;
  const title = `⚠ Wirtschaftstermin ${when}`, body = `${cur} ${ecNames(g)} – hohe Bedeutung, starke Kursausschläge möglich.`;
  if (!$('toasts').querySelector(`.toast.news[data-id="${key}"]`)) {
    const t = el('div', 'toast alarm news'); t.dataset.id = key; t.setAttribute('role', 'alert');
    const ok = btn('button ghost', 'OK'); ok.addEventListener('click', () => t.remove());
    t.append(el('span', '', `${title}: ${body}`), ok); $('toasts').append(t);
  }
  beep(); desktopNotify(title, body, key);
  const vals = g.list.map(e => [e.forecast && `Prognose ${e.forecast}`, e.previous && `vorher ${e.previous}`].filter(Boolean).join(', ')).filter(Boolean);
  void notifyChannels('news', `econ-chan:${g.t}`, `${title}\n${body}${vals.length ? `\n${vals.join(' · ')}` : ''}`, 24 * 3600e3);
}
// Sekundentakt: abrufen, wenn fällig; Anzeige alle 15 s oder bei neuen Daten und Einstellungen – wie alle Live-Anzeigen über
// calmDo: während des Scrollens wartet sie, danach bleibt der sichtbare Inhalt stehen (3.21.1: sonst Seitensprünge am Handy)
var ecCalm = () => renderEcon();
function econTick() {
  if (!ec || !$('econ')) return;
  const now = Date.now();
  if (!ec.busy && now >= ec.retryAt && (!ec.at || now - ec.at > EC_EVERY)) void ecFetch().then(() => calmDo(ecCalm));
  const k = `${Math.floor(now / 15e3)}|${ec.rev}`;
  if (k !== ec.key) { ec.key = k; calmDo(ecCalm); }
}
function saveEc() { store.set(EC_KEY, ec.cfg); ec.rev++; renderEcon(); scheduleS247(); }
(function econUi() {
  const sel = { 'econ-cur': 'cur', 'econ-imp': 'imp', 'econ-warn-min': 'warn' };
  for (const [id, k] of Object.entries(sel)) {
    const s = $(id); s.value = String(ec.cfg[k]);
    s.addEventListener('change', () => { ec.cfg = { ...ec.cfg, [k]: k === 'warn' ? Number(s.value) : s.value }; saveEc(); });
  }
  $('econ-more').addEventListener('click', () => { ec.more = !ec.more; ec.rev++; renderEcon(); });
  renderEcon();
})();
