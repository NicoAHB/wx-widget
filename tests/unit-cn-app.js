// 3.20.0 – App-Seite der Coin-News (js/coinnews.js) mit kleiner DOM-Attrappe; wird von unit-cn.js aufgerufen.
const fs = require('fs'), path = require('path');
module.exports = async function ({ check, job, SRC }) {
  const NOW = Math.floor(Date.now() / 60e3) * 60e3; // Anzeige rechnet teils mit der echten Uhr
  const min = 60e3, h = 60 * min, d = 24 * h;
  const ecSrc = fs.readFileSync(path.join(path.dirname(SRC), 'econcal.js'), 'utf8'), src = fs.readFileSync(SRC, 'utf8');
  const mem = new Map(), store = { get: (k, dflt) => (mem.has(k) ? mem.get(k) : dflt), set: (k, v) => { mem.set(k, v); return true; }, claim: async () => true };
  const fake = () => ({ value: '', hidden: false, textContent: '', title: '', dataset: {}, kids: [], classList: { on: new Set(), toggle(c, v) { v ? this.on.add(c) : this.on.delete(c); } },
    addEventListener(type, fn) { this['on' + type] = fn; }, setAttribute() {}, querySelector() { return null; }, replaceChildren(...k) { this.kids = k; }, append(...k) { for (const x of k) this.kids.push(x); } });
  const els = new Map(), $ = id => { if (!els.has(id)) els.set(id, fake()); return els.get(id); };
  const el = (tag, cls, text) => Object.assign(fake(), { tag, className: cls, textContent: text === undefined ? '' : text });
  const text = n => (typeof n === 'string' ? n : n.textContent + n.kids.map(text).join(''));
  const state = { symbol: 'XRPUSDT' };
  let answer = null; // Antwort der Attrappe für fetch
  const fetchStub = async () => { if (answer instanceof Error) throw answer; return { status: answer.status, ok: answer.status === 200, json: async () => answer.body }; };
  const A = new Function('store', '$', 'el', 'btn', 'beep', 'desktopNotify', 'notifyChannels', 'fetch', 'state',
    `${ecSrc}\n${src}\nreturn { cnParse, cnFor, cnAgo, renderCnews, cnFetch, cnewsTick, cn, CN_KEY, CN_DATA_KEY };`)(
    store, $, el, (c, t) => el('button', c, t), () => {}, () => {}, async () => {}, fetchStub, state);
  // Datei wie vom Job: XRP mit zwei Terminen, einer vergangenen Ankündigung, drei Schlagzeilen; BCH nur Schlagzeile
  const code = c => c.repeat(32);
  const bn = [
    { code: code('a'), t: NOW - 20 * h, at: NOW + 5 * h, kind: 'upgrade', imp: 'high', coins: ['XRP'], title: 'Binance Will Support the XRP Ledger (XRP) Network Upgrade - 2026-09-30' },
    { code: code('b'), t: NOW - 2 * d, at: NOW + 3 * d, kind: 'pair', imp: 'high', coins: ['XRP', 'CAT'], pairs: ['XRP/USDT', 'CAT/USDT'], title: 'Notice of Removal of Spot Trading Pairs - 2026-10-02' },
    { code: code('c'), t: NOW - 3 * d, at: NOW - 30 * h, kind: 'futures', imp: 'medium', coins: ['XRP'], title: 'Binance Futures Will Launch USDⓈ-Margined XRPUSDC Perpetual' },
    { code: code('d'), t: NOW - 1 * d, at: NOW + 2 * h, kind: 'listing', imp: 'high', coins: ['HYPE'], title: 'Binance Will List Hyperliquid (HYPE)' }];
  const g = (hAgo, imp, cat, title, more = 0) => ({ t: NOW - hAgo * h, imp, cat, title, outlet: 'Medium', url: `https://news.google.com/rss/articles/${title.length}${hAgo}`, more });
  const file = job.assemble({ now: NOW, binance: bn, news: { XRP: [g(0.1, 'high', 'sicherheit', 'XRP News heute: Bitget-Hack kostet 157 Mio. Dollar', 2), g(2, 'high', 'netz', 'XRP: Batch-Update für 9. Oktober bestätigt'), g(1, 'medium', 'etf', 'Krypto News: $75 Millionen fließen in XRP-ETFs')], BCH: [g(5, 'high', 'netz', 'Bitcoin Cash: Hard Fork im November')] }, prev: null, state: { binance: 'ok', google: 'ok' } });
  const data = A.cnParse(JSON.parse(JSON.stringify(file)));
  check('App liest die Datei des Jobs vollständig', data.binance.length === 4 && data.news.XRP.length === 3 && data.news.BCH.length === 1 && data.covered.length === job.COINS.length && data.fetchedAt === NOW);
  // Ungültiges fällt weg, Links nur zu Google News
  const bad = JSON.parse(JSON.stringify(file));
  bad.binance.push({ code: 'x', t: NOW, kind: 'listing', coins: ['X'], title: 't' }, { code: code('e'), t: NOW, kind: 'hack', coins: ['XRP'], title: 't' });
  bad.news.XRP.push({ t: NOW, imp: 'high', cat: 'recht', title: 'böse', url: 'javascript:alert(1)' }, { t: NOW, imp: 'high', cat: 'unbekannt', title: 'x', url: 'https://news.google.com/rss/articles/x' },
    { t: NOW, imp: 'high', cat: 'recht', title: 'fremd', url: 'https://evil.example/news.google.com/' });
  bad.news.__proto__x = [g(1, 'high', 'recht', 'x')]; bad.news.xrp = [g(1, 'high', 'recht', 'x')];
  const d2 = A.cnParse(bad);
  let threw = ''; try { A.cnParse({ v: 2, binance: [], news: {} }); } catch (e) { threw = e.message; }
  check('Ungültiges fällt weg (Code, Art, Kategorie, Links außer Google News, Schlüssel); andere Version wird abgelehnt', d2.binance.length === 4 && d2.news.XRP.length === 3 && Object.keys(d2.news).join() === 'XRP,BCH' && threw === 'Nachrichtendatei ungültig', `${Object.keys(d2.news)} ${threw}`);
  // Auswahl je Coin
  const r = A.cnFor(data, 'XRP', { imp: 'high' }, NOW), r2 = A.cnFor(data, 'XRP', { imp: 'medium' }, NOW);
  check('XRP: kommende Termine nach Zeit (5 h, 3 Tage), dann Meldungen neueste zuerst; nur sehr wichtige', r.soon.map(x => x.code[0]).join() === 'a,b' && r.feed.map(x => x.title.slice(0, 8)).join('|') === 'XRP News|XRP: Bat',
    JSON.stringify([r.soon.map(x => x.code[0]), r.feed.map(x => x.title)]));
  check('„auch wichtig“: dazu ETF-Zuflüsse und der vergangene Futures-Start (nach Termin-Zeit einsortiert)', r2.feed.map(x => (x.src === 'b' ? 'B' : x.title.slice(0, 6))).join('|') === 'XRP Ne|Krypto|XRP: B|B', r2.feed.map(x => x.title.slice(0, 12)).join(' | '));
  check('Andere Coins sehen nur ihre eigenen Einträge', A.cnFor(data, 'HYPE', { imp: 'high' }, NOW).soon.length === 1 && !A.cnFor(data, 'HYPE', { imp: 'high' }, NOW).feed.length && A.cnFor(data, 'BCH', { imp: 'high' }, NOW).feed.length === 1 && !A.cnFor(data, 'SOL', { imp: 'high' }, NOW).soon.length);
  check('Zeitangaben: gerade eben, vor 12 min, vor 3 h, ab einem Tag mit Tag und Uhrzeit', A.cnAgo(NOW - 20e3, NOW) === 'gerade eben' && A.cnAgo(NOW - 12 * min, NOW) === 'vor 12 min' && A.cnAgo(NOW - 3.5 * h, NOW) === 'vor 3 h'
    && /^(Gestern|[A-Z][a-z]\. \d\d\.\d\d\.) \d\d:\d\d$/.test(A.cnAgo(NOW - 26 * h, NOW)), [A.cnAgo(NOW - 26 * h, NOW), A.cnAgo(NOW + 5e3, NOW)].join(' | '));
  // Anzeige
  A.cn.data = data; A.cn.at = Date.now(); A.renderCnews(NOW);
  const list = $('cnews-list').kids, rows = list.filter(k => /cn-row/.test(k.className)), heads = list.filter(k => k.className === 'ec-day').map(k => k.textContent);
  const row0 = rows[0], link0 = row0.kids[1].kids[1], row1 = rows[1];
  check('Anzeige XRP: Überschriften „Termine“ und „Meldungen“, 4 Zeilen, Titel „… · XRP“', $('cnews-coin').textContent === 'XRP' && heads.join() === 'Termine,Meldungen' && rows.length === 4, `${heads} ${rows.length}`);
  check('Termin in 5 h: hervorgehoben, Zeit mit Countdown, Art, Link zu Binance in neuem Tab ohne Referrer', /soon/.test(row0.className) && /in 5 h · Netzwerk-Upgrade · Binance$/.test(text(row0.kids[1].kids[0])) && link0.href === `https://www.binance.com/de/support/announcement/detail/${code('a')}`
    && link0.target === '_blank' && link0.rel === 'noopener noreferrer' && /Ein- und Auszahlungen/.test(text(row0.kids[1].kids[2])), text(row0.kids[1].kids[0]));
  // Token-Tausch (von Binance als „Support“ gemeldet wie ein Upgrade): eigene Bezeichnung und Erklärung (3.20.1)
  const swapData = A.cnParse(JSON.parse(JSON.stringify(job.assemble({ now: NOW, binance: [{ code: 'f'.repeat(32), t: NOW - 20 * h, at: NOW + 4 * d, kind: 'upgrade', imp: 'high', coins: ['STG', 'ZRO'], title: 'Binance Will Support the Stargate Finance (STG) Token Merge to LayerZero (ZRO)' }], news: {}, prev: null, state: {} }))));
  const keep = A.cn.data; A.cn.data = swapData; state.symbol = 'STGUSDT'; A.renderCnews(NOW);
  const sw = $('cnews-list').kids.find(k => /cn-row/.test(k.className)), swMeta = text(sw.kids[1].kids[0]), swNote = text(sw.kids[1].kids[2]);
  check('Token-Tausch: „Token-Tausch“ statt „Netzwerk-Upgrade“, Hinweis, dass auch der Handel ruhen kann', /· Token-Tausch · Binance$/.test(swMeta) && /^Binance tauscht den Token um; dafür können Handel sowie Ein- und Auszahlungen ruhen/.test(swNote), `${swMeta} | ${swNote}`);
  A.cn.data = keep; state.symbol = 'XRPUSDT'; A.renderCnews(NOW);
  check('Entferntes Handelspaar nennt das Paar des Coins', /entfernt das Handelspaar XRP\/USDT\.$/.test(text(row1.kids[1].kids[2])) && !/soon/.test(row1.className), text(row1.kids[1].kids[2]));
  const n0 = rows[2];
  check('Schlagzeile: Alter, Kategorie, Medium und Zahl weiterer Medien, Link zu Google News', text(n0.kids[1].kids[0]) === 'vor 6 min · Sicherheit · Medium und 2 weitere Medien' && /^https:\/\/news\.google\.com\//.test(n0.kids[1].kids[1].href) && n0.kids[1].kids[1].rel === 'noopener noreferrer', text(n0.kids[1].kids[0]));
  check('Stand in der Kopfzeile', $('cnews-src').textContent === `Binance · Google News · Stand ${new Date(NOW).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · stündlich` && !$('cnews-src').classList.on.has('err'), $('cnews-src').textContent);
  // Mehr als 5: „Alle anzeigen“
  A.cn.cfg = { imp: 'medium' }; A.renderCnews(NOW);
  const moreBtn = $('cnews-more'), n5 = $('cnews-list').kids.filter(k => /cn-row/.test(k.className)).length;
  moreBtn.onclick(); const n6 = $('cnews-list').kids.filter(k => /cn-row/.test(k.className)).length;
  check('„auch wichtig“: 5 von 6, „Alle anzeigen (6)“ zeigt alle, danach „Weniger anzeigen“', n5 === 5 && n6 === 6 && moreBtn.textContent === 'Weniger anzeigen' && !moreBtn.hidden, `${n5} ${n6} ${moreBtn.textContent}`);
  // Coinwechsel
  state.symbol = 'SOLUSDT'; A.renderCnews(NOW);
  check('Coinwechsel: neuer Titel, alles wieder eingeklappt, leer mit Hinweis', $('cnews-coin').textContent === 'SOL' && !A.cn.more && text($('cnews-list').kids[0]) === 'Keine wichtigen Meldungen oder Termine zu SOL.' && moreBtn.hidden, text($('cnews-list').kids[0]));
  state.symbol = 'PENGUUSDT'; A.cn.cfg = { imp: 'high' }; A.renderCnews(NOW);
  check('Coin ohne Nachrichtensuche: Hinweis, dass nur Binance-Ankündigungen kommen', /^Keine sehr wichtigen Meldungen oder Termine zu PENGU\. Schlagzeilen sucht der Job nur für 36 bekannte Coins – für PENGU kommen nur Ankündigungen von Binance\.$/.test(text($('cnews-list').kids[0])), text($('cnews-list').kids[0]));
  // veraltet, Fehler, Abruf
  A.cn.data = { ...data, fetchedAt: NOW - 5 * h }; A.renderCnews(NOW);
  check('Älter als 4 h: „veraltet, GitHub-Job prüfen“ rot', /– veraltet, GitHub-Job prüfen$/.test($('cnews-src').textContent) && $('cnews-src').classList.on.has('err'), $('cnews-src').textContent);
  answer = { status: 404 }; A.cn.data = null; await A.cnFetch(); A.renderCnews(NOW);
  check('Noch keine Datei (404): Hinweis auf den GitHub-Job, erneuter Versuch in 5 min', text($('cnews-list').kids[0]) === 'Noch keine Meldungen – der GitHub-Job legt sie nach der Veröffentlichung an.' && Math.abs(A.cn.retryAt - Date.now() - 5 * min) < 5e3);
  answer = { status: 200, body: file }; await A.cnFetch();
  check('Abruf: Daten gespeichert (nur IndexedDB-Schlüssel), Fehler gelöscht', A.cn.data?.binance.length === 4 && !A.cn.error && mem.get(A.CN_DATA_KEY)?.d === file && A.CN_DATA_KEY.startsWith('scalpdesk.idb.'));
  answer = new TypeError('Failed to fetch'); await A.cnFetch(); state.symbol = 'XRPUSDT'; A.renderCnews(NOW);
  check('Netzfehler mit gespeichertem Stand: Meldungen bleiben, „gerade nicht erreichbar“', A.cn.data && /gerade nicht erreichbar$/.test($('cnews-src').textContent) && $('cnews-list').kids.some(k => /cn-row/.test(k.className)), $('cnews-src').textContent);
  // Einstellung gespeichert
  $('cnews-imp').value = 'medium'; $('cnews-imp').onchange();
  check('Einstellung „auch wichtig“ wird gespeichert', store.get(A.CN_KEY)?.imp === 'medium' && A.cn.cfg.imp === 'medium');
};
