// 3.60.0: isolierte Kopie mit optionalem UI-Arbeitsbereich; Fachregeln unverändert.
var workspace;
// ---------- 3.20.0: Ganz wichtige News und Termine zum geöffneten Coin ----------
// Quelle: Der GitHub-Job .github/workflows/news.yml sammelt stündlich Ankündigungen von Binance (Listings, Delistings,
// entfernte Handelspaare, Netzwerk-Upgrades, Beobachtungsliste) und Schlagzeilen deutschsprachiger Medien über Google News
// (36 bekannte Coins), filtert sie auf wichtige Meldungen und legt sie als news.json im Zweig „news“ ab. Die App lädt die
// Datei beim Öffnen und alle 15 Minuten (nach einem Fehler erneut nach 5 Minuten), speichert den letzten Stand und zeigt
// unter dem Wirtschaftskalender nur, was den geöffneten Coin betrifft: kommende Termine zuerst, dann die neuesten Meldungen.
// var statt const/let: cnewsTick kann über den Sekundentakt schon laufen, bevor dieser Abschnitt ausgewertet ist
var CN_URL = 'https://raw.githubusercontent.com/NicoAHB/wx-widget/news/news.json';
var CN_KEY = 'scalpdesk.cnews.v1', CN_DATA_KEY = 'scalpdesk.idb.cnewsdata', CN_EVERY = 15 * 60e3, CN_RETRY = 5 * 60e3, CN_STALE = 4 * 3600e3, CN_TOP = 5, CN_SOON = 3600e3;
// Art der Binance-Ankündigung: Bezeichnung und kurze Erklärung
var CN_KIND = {
  listing: ['Neues Listing', 'Handelsstart bei Binance.'],
  futures: ['Futures-Start', 'Neuer USDT-Futures-Kontrakt bei Binance.'],
  delist: ['Delisting', 'Binance beendet den Handel mit diesem Coin.'],
  pair: ['Handelspaar entfällt', 'Binance entfernt das Handelspaar {pair}.'],
  margin: ['Margin-Delisting', 'Binance beendet Margin-Handel und Kredite für diesen Coin.'],
  'futures-delist': ['Futures-Delisting', 'Binance beendet den USDT-Futures-Kontrakt.'],
  monitor: ['Beobachtungsliste', 'Binance beobachtet den Coin wegen erhöhten Risikos; ein Delisting ist möglich.'],
  'monitor-off': ['Beobachtung beendet', 'Binance hat den Coin von der Beobachtungsliste genommen.'],
  upgrade: ['Netzwerk-Upgrade', 'Ein- und Auszahlungen bei Binance ruhen um diese Zeit; der Handel läuft meist weiter.'],
};
// Token-Tausch, Zusammenlegung, Migration, Umbenennung: Binance meldet sie als „Support“ wie Netzwerk-Upgrades, der alte Token
// wird aber umgetauscht – dafür kann auch der Handel ruhen (3.20.1)
var CN_SWAP = ['Token-Tausch', 'Binance tauscht den Token um; dafür können Handel sowie Ein- und Auszahlungen ruhen – Details in der Ankündigung.'];
var cnKind = x => (x.kind === 'upgrade' && /swap|merge|migration|redenomination|rebranding|ticker change/i.test(x.title) ? CN_SWAP : CN_KIND[x.kind]);
var CN_CAT = { sicherheit: 'Sicherheit', etf: 'ETF', recht: 'Recht', netz: 'Netzwerk', boerse: 'Börse', firma: 'Unternehmen', angebot: 'Angebot', regulierung: 'Regulierung' };
function loadCn() { return { imp: store.get(CN_KEY)?.imp === 'medium' ? 'medium' : 'high' }; }
var cn = { cfg: loadCn(), data: null, at: 0, error: '', busy: false, retryAt: 0, more: false, base: '', rev: 0, key: '', list: '' };
{ const c = store.get(CN_DATA_KEY); try { if (c?.d) { cn.data = cnParse(c.d); cn.at = Number(c.at) || 0; } } catch { /* alter oder kaputter Stand: neu laden */ } }
// Datei prüfen und auf bekannte Felder beschränken (Texte landen nur als textContent im Dokument, Links nur zu Google News
// und Binance)
function cnParse(d) {
  if (!d || d.v !== 1 || !Array.isArray(d.binance) || !d.news || typeof d.news !== 'object') throw new Error('Nachrichtendatei ungültig');
  const s = (v, n) => (typeof v === 'string' ? v.slice(0, n) : ''), sym = v => typeof v === 'string' && /^[A-Z0-9]{2,15}$/.test(v), imp = v => (v === 'medium' ? 'medium' : 'high');
  const binance = d.binance.filter(b => /^[0-9a-f]{32}$/.test(b?.code) && Number.isFinite(b.t) && Object.hasOwn(CN_KIND, b.kind) && Array.isArray(b.coins) && typeof b.title === 'string').slice(0, 300)
    .map(b => ({ code: b.code, t: b.t, at: Number.isFinite(b.at) ? b.at : null, kind: b.kind, imp: imp(b.imp), coins: b.coins.filter(sym).slice(0, 30),
      pairs: Array.isArray(b.pairs) ? b.pairs.filter(p => typeof p === 'string' && /^[A-Z0-9]{2,15}\/USDT$/.test(p)).slice(0, 30) : [], title: s(b.title, 200) }));
  const news = {};
  for (const [k, list] of Object.entries(d.news)) {
    if (!sym(k) || !Array.isArray(list)) continue;
    const items = list.filter(i => Number.isFinite(i?.t) && typeof i.title === 'string' && typeof i.url === 'string' && i.url.length < 600 && /^https:\/\/news\.google\.com\/[\w./?=&%-]+$/.test(i.url) && Object.hasOwn(CN_CAT, i.cat)).slice(0, 12)
      .map(i => ({ t: i.t, imp: imp(i.imp), cat: i.cat, title: s(i.title, 200), outlet: s(i.outlet, 60), url: i.url, more: Math.max(0, Math.min(50, Math.floor(Number(i.more) || 0))) }));
    if (items.length) news[k] = items;
  }
  return { fetchedAt: Date.parse(d.fetchedAt) || 0, covered: Array.isArray(d.covered) ? d.covered.filter(sym) : [], binance, news };
}
async function cnFetch() {
  if (cn.busy) return;
  cn.busy = true;
  try {
    const r = await fetch(CN_URL, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (r.status === 404) throw new Error('Noch keine Meldungen – der GitHub-Job legt sie nach der Veröffentlichung an.');
    if (!r.ok) throw new Error(`Meldungen nicht erreichbar (Fehler ${r.status})`);
    const d = await r.json();
    cn.data = cnParse(d); cn.at = Date.now(); cn.error = ''; cn.retryAt = 0;
    store.set(CN_DATA_KEY, { at: cn.at, d });
  } catch (e) {
    cn.error = e instanceof TypeError ? 'Meldungen nicht erreichbar – Internet oder Werbeblocker prüfen.' : e?.message || String(e);
    cn.retryAt = Date.now() + CN_RETRY;
  } finally { cn.busy = false; cn.rev++; }
}
// Meldungen zu einem Coin: kommende Binance-Termine (auch die der letzten Stunde) nach Zeit, danach alles andere, neueste zuerst
function cnFor(data, base, cfg, now) {
  const ok = x => x.imp === 'high' || cfg.imp === 'medium';
  const bn = data.binance.filter(b => b.coins.includes(base) && ok(b)).map(b => ({ ...b, src: 'b', when: b.at ?? b.t }));
  const soon = bn.filter(b => b.at != null && b.at >= now - CN_SOON).sort((a, b) => a.at - b.at);
  const feed = [...bn.filter(b => !soon.includes(b)), ...(data.news[base] || []).filter(ok).map(n => ({ ...n, src: 'g', when: n.t }))].sort((a, b) => b.when - a.when);
  return { soon, feed };
}
// „gerade eben“, „vor 12 min“, „vor 3 h“, ab einem Tag „Gestern 14:30“ bzw. „So. 27.09. 21:38“
function cnAgo(t, now) {
  const m = Math.floor((now - t) / 60e3);
  if (m < 1) return 'gerade eben';
  if (m < 60) return `vor ${m} min`;
  if (m < 24 * 60) return `vor ${Math.floor(m / 60)} h`;
  return `${ecDay(t, now)} ${ecTime(t)}`;
}
function cnLink(href, text) { const a = el('a', 'cn-title', text); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; }
function cnRow(x, now, base) {
  const soon = x.src === 'b' && x.at != null && x.at >= now - CN_SOON && x.at - now < 24 * 3600e3;
  const row = el('div', `cn-row ${x.imp}${soon ? ' soon' : ''}`), imp = el('i', `ec-imp ${x.imp}`), main = el('div', 'cn-main'), meta = el('div', 'cn-meta');
  imp.title = x.imp === 'high' ? 'sehr wichtig' : 'wichtig';
  if (x.src === 'b') {
    // Termin: Tag und Uhrzeit, dazu bis 48 h vorher der Countdown („in 3 h 20 min“, ab 12 h „in 30 h“), bis 12 h danach „vor 2 h“
    const [label, note] = cnKind(x), d = x.at - now;
    const when = x.at == null ? cnAgo(x.t, now) : `${ecDay(x.at, now)} ${ecTime(x.at)}${d > 0 && d < 48 * 3600e3 ? ` · ${d < 12 * 3600e3 ? ecIn(d) : `in ${Math.round(d / 3600e3)} h`}` : d <= 0 && d > -12 * 3600e3 ? ` · ${cnAgo(x.at, now)}` : ''}`;
    meta.append(el('b', 'cn-when', when), ` · ${label} · Binance`);
    main.append(meta, cnLink(`https://www.binance.com/de/support/announcement/detail/${x.code}`, x.title),
      el('div', 'cn-note', note.replace('{pair}', x.pairs.filter(p => p.startsWith(`${base}/`)).join(', ') || `${base}/USDT`)));
  } else {
    meta.append(el('b', 'cn-when', cnAgo(x.t, now)), ` · ${CN_CAT[x.cat]} · ${x.outlet || 'Google News'}${x.more ? ` und ${x.more} ${x.more === 1 ? 'weiteres Medium' : 'weitere Medien'}` : ''}`);
    main.append(meta, cnLink(x.url, x.title));
  }
  row.append(imp, main);
  return row;
}
function cnEmpty(base, cfg) {
  const text = `Keine ${cfg.imp === 'medium' ? 'wichtigen' : 'sehr wichtigen'} Meldungen oder Termine zu ${base}.`;
  return cn.data.covered.length && !cn.data.covered.includes(base) ? `${text} Schlagzeilen sucht der Job nur für ${cn.data.covered.length} bekannte Coins – für ${base} kommen nur Ankündigungen von Binance.` : text;
}
function renderCnews(now = Date.now()) {
  const box = $('cnews'); if (!box) return;
  const base = state.symbol.slice(0, -4), cfg = cn.cfg;
  if (base !== cn.base) { cn.base = base; cn.more = false; $('cnews-coin').textContent = base; }
  const { soon, feed } = cn.data ? cnFor(cn.data, base, cfg, now) : { soon: [], feed: [] }, all = [...soon, ...feed];
  // Standard: höchstens 5 Einträge, Termine zuerst; „Alle anzeigen“ zeigt den Rest
  const top = workspace?.mode === 'focus' ? 3 : CN_TOP;
  const shown = cn.more ? all : all.slice(0, top);
  const sig = JSON.stringify([base, cn.more, shown.map(x => [x.code || x.url, x.at, x.more, x.imp]), all.length, Math.floor(now / 60e3), !cn.data && cn.error]);
  if (sig !== cn.list) {
    cn.list = sig;
    const parts = [], nSoon = shown.filter(x => soon.includes(x)).length;
    if (nSoon) parts.push(el('div', 'ec-day', 'Termine'));
    shown.forEach((x, i) => { if (i === nSoon && nSoon) parts.push(el('div', 'ec-day', 'Meldungen')); parts.push(cnRow(x, now, base)); });
    if (!shown.length) parts.push(el('p', 'ec-empty', !cn.data ? (cn.error || 'Meldungen werden geladen …') : cnEmpty(base, cfg)));
    $('cnews-list').replaceChildren(...parts);
    const more = $('cnews-more');
    more.hidden = all.length <= top; more.textContent = cn.more ? 'Weniger anzeigen' : `Alle anzeigen (${all.length})`;
  }
  // Stand der Daten
  const src = $('cnews-src'), f = cn.data?.fetchedAt, stale = !!f && now - f > CN_STALE, fd = f ? ecDay(f, now) : '';
  const fday = fd === 'Heute' ? '' : `${['Gestern', 'Morgen'].includes(fd) ? fd.toLowerCase() : fd} `;
  const srcText = !cn.data ? '' : `Binance · Google News · Stand ${f ? fday + ecTime(f) : 'unbekannt'}${stale ? ' – veraltet, GitHub-Job prüfen' : ' · stündlich'}${cn.error ? ' · gerade nicht erreichbar' : ''}`;
  if (src.textContent !== srcText) src.textContent = srcText;
  src.classList.toggle('err', stale || (!!cn.error && !!cn.data));
}
// Sekundentakt: abrufen, wenn fällig; Anzeige alle 30 s, bei neuen Daten, Einstellungen oder einem anderen Coin – über calmDo
// wie alle Live-Anzeigen (3.21.1: sonst Seitensprünge am Handy)
var cnCalm = () => renderCnews();
function cnewsTick() {
  if (!cn || !$('cnews')) return;
  const now = Date.now();
  if (!cn.busy && now >= cn.retryAt && (!cn.at || now - cn.at > CN_EVERY)) void cnFetch().then(() => calmDo(cnCalm));
  const k = `${Math.floor(now / 30e3)}|${cn.rev}|${state.symbol}`;
  if (k !== cn.key) { cn.key = k; calmDo(cnCalm); }
}
(function cnewsUi() {
  const s = $('cnews-imp'); s.value = cn.cfg.imp;
  s.addEventListener('change', () => { cn.cfg = { ...cn.cfg, imp: s.value === 'medium' ? 'medium' : 'high' }; store.set(CN_KEY, cn.cfg); cn.rev++; renderCnews(); });
  $('cnews-more').addEventListener('click', () => { cn.more = !cn.more; cn.rev++; renderCnews(); });
  renderCnews();
})();
