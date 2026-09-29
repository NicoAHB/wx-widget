// Coin-News für Scalp Desk (3.20.0): sammelt ganz wichtige Meldungen und Termine je Kryptowährung für die App.
// Quellen: Ankündigungen von Binance (Listings, Delistings, Netzwerk-Upgrades, Beobachtungsliste; ohne Schlüssel) und
// Schlagzeilen deutschsprachiger Medien über die Google-News-Suche (RSS, je Coin). Der GitHub-Job
// .github/workflows/news.yml ruft das Skript stündlich auf und legt das Ergebnis als news.json im Zweig „news“ ab.
// Aufruf: node build.mjs <vorige news.json> <neue news.json>
// Exit 0: Datei geschrieben. Exit 3: keine Quelle erreichbar – nichts geschrieben, der bisherige Stand bleibt.
// Ist eine Quelle (oder die Suche für einen Coin) gerade nicht erreichbar, bleiben deren Meldungen aus der vorigen Datei
// stehen, solange sie im Zeitfenster liegen.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const H = 3600e3, D = 24 * H;
export const NEWS_WINDOW = 3 * D;   // Schlagzeilen der letzten 3 Tage
export const BN_WINDOW = 21 * D;    // Binance-Ankündigungen der letzten 3 Wochen …
export const BN_PAST = 2 * D;       // … deren Termin höchstens 2 Tage zurückliegt; ohne Termin höchstens 7 Tage alt
export const PER_COIN = 8;          // höchstens so viele Schlagzeilen (nach dem Zusammenfassen) je Coin

// Coins mit Nachrichtensuche: Kürzel, Suchanfrage bei Google News, Name im Titel (ohne Groß/klein), Kürzel im Titel
// (genau so geschrieben, damit „ADA“ nicht auf „Ada“ passt)
export const COINS = [
  ['BTC', 'Bitcoin', /\bbitcoins?\b(?![- ]?(cash|sv|group)\b)(?!\.de)/i, /\bBTC\b/],
  ['ETH', 'Ethereum', /\bethereum\b(?![- ]?classic)/i, /\bETH\b/],
  ['XRP', 'XRP OR Ripple', /\bripple\b/i, /\bXRP\b/],
  ['BCH', '"Bitcoin Cash"', /\bbitcoin[- ]?cash\b/i, /\bBCH\b/],
  ['LTC', 'Litecoin', /\blitecoin\b/i, /\bLTC\b/],
  ['ETC', '"Ethereum Classic"', /\bethereum[- ]?classic\b/i, /(?<![-\w])ETC\b(?![.\w])/],
  ['NEAR', '"NEAR Protocol" OR "NEAR-Protokoll"', /\bnear[- ]?(protocol|protokoll)\b/i, /\bNEAR\b/],
  ['SOL', 'Solana', /\bsolana\b/i, /\bSOL\b/],
  ['BNB', 'BNB OR "BNB Chain"', /\bbnb[- ]?chain\b/i, /\bBNB\b/],
  ['DOGE', 'Dogecoin', /\bdogecoin\b/i, /\bDOGE\b/],
  ['ADA', 'Cardano', /\bcardano\b/i, /\bADA\b/],
  ['TRX', 'TRX OR "Tron-Netzwerk" OR "Tron-Blockchain" OR "Justin Sun"', /\btron\b/i, /\bTRX\b/],
  ['LINK', 'Chainlink', /\bchainlink\b/i, /\bLINK\b/],
  ['DOT', 'Polkadot', /\bpolkadot\b/i, /\bDOT\b/],
  ['AVAX', 'Avalanche AVAX OR Krypto OR Blockchain', /\bavalanche\b/i, /\bAVAX\b/],
  ['XLM', 'Stellar XLM OR Lumens OR Krypto', /\bstellar\b/i, /\bXLM\b/],
  ['SHIB', '"Shiba Inu"', /\bshiba[- ]?inu\b/i, /\bSHIB\b/],
  ['TON', 'Toncoin OR "TON Blockchain"', /\btoncoin\b|\bton[- ]blockchain\b/i, /\bTON\b/],
  ['SUI', 'Sui Krypto OR Blockchain OR Token', /\bsui\b/i, null],
  ['UNI', 'Uniswap', /\buniswap\b/i, /\bUNI\b/],
  ['ATOM', 'Cosmos ATOM OR Krypto OR Blockchain', /\bcosmos\b/i, /\bATOM\b/],
  ['APT', 'Aptos', /\baptos\b/i, /\bAPT\b/],
  ['ARB', 'Arbitrum', /\barbitrum\b/i, /\bARB\b/],
  ['HBAR', 'Hedera', /\bhedera\b/i, /\bHBAR\b/],
  ['ICP', '"Internet Computer"', /\binternet[- ]computer\b/i, /\bICP\b/],
  ['FIL', 'Filecoin', /\bfilecoin\b/i, /\bFIL\b/],
  ['PEPE', 'Pepe Memecoin OR Krypto OR Coin', /\bpepe\b/i, null],
  ['HYPE', 'Hyperliquid', /\bhyperliquid\b/i, /\bHYPE\b/],
  ['WLD', 'Worldcoin OR "World Network"', /\bworldcoin\b|\bworld[- ]network\b/i, /\bWLD\b/],
  ['AAVE', 'Aave', /\baave\b/i, null],
  ['INJ', 'Injective', /\binjective\b/i, /\bINJ\b/],
  ['ALGO', 'Algorand', /\balgorand\b/i, /\bALGO\b/],
  ['TAO', 'Bittensor', /\bbittensor\b/i, /\bTAO\b/],
  ['ENA', 'Ethena', /\bethena\b/i, /\bENA\b/],
  ['ONDO', '"Ondo Finance" OR ONDO', /\bondo\b/i, null],
  ['POL', 'Polygon POL OR MATIC OR Krypto', /\bpolygon\b/i, /\bPOL\b|\bMATIC\b/],
];
const mentions = (text, c) => c[2].test(text) || (!!c[3] && c[3].test(text));

// ---------- Google News: Schlagzeilen je Coin ----------
// Kursprognosen, Kursziele, Marktberichte und Werbung fallen weg
export const NOISE = /prognose|kursziel|preisvorhersage|price prediction|so viel (wert|gewinn|verlust|hätte|bringt)|investition von vor|investment in .{0,40} von vor|wie sich die kryptokurse|so bewegen sich|am (vor|nach)mittag|am (morgen|abend)\b|\btop[- ]?\d|kaufen\?|lohnt sich|chartanalyse|trading[- ]?setup|presale|vorverkauf|kaufsignal|verkaufssignal|kursexplosion|explodier|verdoppel|verdreifach|\b\d+\s?x\b|nächste[nr]? \w*coin|gewinnspiel|sponsored|anzeige:/i;
// Was als wichtig gilt; Reihenfolge = Vorrang. high = sehr wichtig, medium = wichtig
export const CATS = [
  { id: 'sicherheit', imp: 'high', re: /hack|exploit|gestohlen|diebstahl|sicherheitslücke|schwachstelle|\bbug\b|51[ -]?%|rug[- ]?pull|betrug|geldwäsch/i },
  { id: 'etf', imp: 'high', re: /\berste[nrs]?\b.{0,40}\bET[FP]s?\b|\bET[FP]s?\b.{0,50}(zugelassen|zulassung|genehmig|abgelehnt|ablehnung|entscheid|\bfrist|startet|debüt|handelsstart|\bSEC\b)|(zulassung|genehmigung|ablehnung|entscheidung|\bSEC\b).{0,50}\bET[FP]s?\b/i },
  { id: 'recht', imp: 'high', re: /\bSEC\b|\bCFTC\b|\bDOJ\b|\bFBI\b|klage|verklagt|gericht|urteil|richter|anklage|festgenommen|verhaftet|festnahme|geldstrafe|strafzahlung|sanktion|verbot|verbiet|\bbafin\b|staatsanwalt/i },
  { id: 'netz', imp: 'high', re: /hard[- ]?fork|\bforks?\b|mainnet|upgrade|halving|halbierung|(netzwerk|protokoll|ledger|batch|software|core|node)[- ]?update|\bupdate\b.{0,30}\b(aktiviert|bestätigt|live)|amendment|(\bnetzwerk|\bnetz|\bblockchain|\bchain|\b)[- ]?(ausfall|störung|stillstand)|\boutage\b|\bhalted\b/i },
  { id: 'boerse', imp: 'high', re: /delist|handel (wird |ist )?(eingestellt|ausgesetzt|gestoppt)|(listet|listing|gelistet|aufgenommen).{0,40}(coinbase|binance|robinhood|upbit|kraken|bithumb|bybit|okx)|(coinbase|binance|robinhood|upbit|kraken|bithumb|bybit|okx).{0,40}(listet|listing|gelistet|nimmt .{0,20} auf)/i },
  { id: 'firma', imp: 'high', re: /insolven|pleite|bankrott|konkurs/i },
  { id: 'etf', imp: 'medium', re: /\bET[FP]s?\b/i },
  { id: 'angebot', imp: 'medium', re: /escrow|unlock|freischaltung|token[- ]?burn|verbrenn|treasury|reserve/i },
  { id: 'regulierung', imp: 'medium', re: /\bmica\b|\bmicar\b|lizenz|regulier|gesetz/i },
  { id: 'firma', imp: 'medium', re: /übernahme|übernimmt|partnerschaft|kooperation|börsengang|\bIPO\b|nasdaq/i },
];
// Wichtigkeit einer Schlagzeile für einen Coin (oder null). Nennt sie zwei Coins, muss das Stichwort im selben Satzteil
// stehen wie dieser Coin – außer der Coin ist das Thema (vorn vor dem Doppelpunkt, z. B. „XRP: Bitget-Diebstahl …“).
// Ab drei genannten Coins gilt sie als Marktbericht und fällt weg.
export function gnClassify(title, sym) {
  const named = COINS.filter(c => mentions(title, c)).map(c => c[0]), coin = COINS.find(c => c[0] === sym);
  if (!coin || !named.includes(sym) || named.length >= 3 || NOISE.test(title)) return null;
  let parts = [title];
  if (named.length === 2) {
    const head = /^(.{1,40}?):\s/.exec(title)?.[1];
    if (!(head && mentions(head, coin))) parts = title.split(/[,;!?|–—]|:\s|\s-\s/).filter(p => mentions(p, coin));
  }
  const c = CATS.find(k => parts.some(p => k.re.test(p)));
  return c ? { cat: c.id, imp: c.imp } : null;
}
// RSS der Google-News-Suche → Schlagzeilen (Titel ohne angehängten Mediennamen)
export function gnParse(xml) {
  const dec = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  return [...String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => {
    const f = tag => dec((m[1].match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`)) || [])[1] || '').replace(/\s+/g, ' ').trim();
    const outlet = f('source').slice(0, 60);
    let title = f('title');
    if (outlet && title.endsWith(` - ${outlet}`)) title = title.slice(0, -(outlet.length + 3));
    title = title.replace(/\s+-\s+[\w.-]+\.(de|com|net|at|ch|io|org|info|news)$/i, '').trim();
    return { t: Date.parse(f('pubDate')), title: title.slice(0, 200), outlet, url: f('link') };
  }).filter(i => Number.isFinite(i.t) && i.title && /^https:\/\/news\.google\.com\/[\w./?=&%-]+$/.test(i.url) && i.url.length < 600);
}
// Gleiche Geschichte aus mehreren Medien zusammenfassen: gleicher Coin, höchstens 36 Stunden auseinander und mindestens
// ein gemeinsames markantes Wort (z. B. „Bitget“). Angezeigt wird die neueste der wichtigsten Schlagzeilen.
const STOP = new Set(('krypto kryptowährung kryptowährungen kryptomarkt aktuell aktuelle kurse preis dollar millionen milliarden ' +
  'prozent markt märkte anleger trader investoren token coins netzwerk blockchain nach doch noch jetzt warum wieder neue neuen neuer ' +
  'neues erste ersten erster diese dieser dieses einen einer nicht mehr über unter gegen wird werden wurde sind seit beim durch trotz ' +
  'damit steht stehen könnte könnten bringt macht zeigt sorgt droht kommt heute news update upgrade upgrades hacker gestohlen ' +
  'diebstahl klage urteil gericht zuflüsse abflüsse delisting listing börse börsen fork hardfork bitcoin ethereum ripple solana').split(' '));
const words = title => new Set(title.toLowerCase().split(/[^a-z0-9äöüß]+/).filter(w => w.length >= 5 && !STOP.has(w)));
export function gnCluster(items) {
  const clusters = [];
  for (const it of [...items].sort((a, b) => b.t - a.t)) {
    const w = words(it.title), key = it.title.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '');
    const c = clusters.find(k => k.first - it.t <= 36 * H && (k.keys.has(key) || [...w].some(x => k.words.has(x))));
    if (c) { c.members.push(it); c.keys.add(key); w.forEach(x => c.words.add(x)); c.first = it.t; }
    else clusters.push({ members: [it], words: w, keys: new Set([key]), first: it.t });
  }
  return clusters.map(({ members }) => {
    const top = members.find(m => m.imp === 'high') || members[0];
    return { ...top, more: new Set(members.map(m => m.outlet || m.url)).size - 1 };
  });
}
// Schlagzeilen eines Coins: nur wichtige, im Zeitfenster, zusammengefasst; sehr wichtige zuerst, dann die neuesten
export function gnForCoin(items, sym, now) {
  const hits = [];
  for (const it of items) {
    if (now - it.t > NEWS_WINDOW || it.t - now > H) continue;
    const c = gnClassify(it.title, sym);
    if (c) hits.push({ t: it.t, imp: c.imp, cat: c.cat, title: it.title, outlet: it.outlet, url: it.url });
  }
  return gnCluster(hits).sort((a, b) => (a.imp === b.imp ? b.t - a.t : a.imp === 'high' ? -1 : 1)).slice(0, PER_COIN);
}
export const gnUrl = c => `https://news.google.com/rss/search?q=${encodeURIComponent(`${c[1]} when:3d`)}&hl=de&gl=DE&ceid=DE:de`;

// ---------- Binance: Ankündigungen ----------
export const BN_CATALOGS = [48, 49, 161, 157]; // neue Listings, Neuigkeiten, Delistings, Wartung/Netzwerk-Upgrades
const BN_LIST = id => `https://www.binance.com/bapi/composite/v1/public/cms/article/catalog/list/query?catalogId=${id}&pageNo=1&pageSize=20`;
const BN_DETAIL = code => `https://www.binance.com/bapi/composite/v1/public/cms/article/detail/query?articleCode=${code}`;
const TICK = /^[A-Z0-9]{2,15}$/;
const NOT_COIN = new Set(['UTC', 'USD', 'API', 'APR', 'APY', 'VIP', 'KYC', 'FAQ', 'EU', 'UK', 'US', 'TR', 'NFT', 'DEX', 'CEX', 'P2P', 'OTC', 'ETF', 'IPO', 'TGE', 'BTTC']);
const uniq = a => [...new Set(a)];
const coinOf = s => s.replace(/^1000+(?=[A-Z])/, '');
const paren = s => [...s.matchAll(/\(([A-Z0-9]{2,15})\)/g)].map(m => m[1]);
const listOf = s => s.split(/,\s*|\s+and\s+|\s*&\s*/).map(x => x.trim()).filter(x => TICK.test(x));
// Netzwerke, die Binance ohne Kürzel nennt (z. B. „Ethereum Network Upgrade“)
const NETWORKS = [[/bitcoin cash/i, 'BCH'], [/ethereum classic/i, 'ETC'], [/bitcoin(?! cash)/i, 'BTC'], [/ethereum(?! classic)/i, 'ETH'],
  [/bnb (smart )?chain/i, 'BNB'], [/solana/i, 'SOL'], [/xrp ledger/i, 'XRP'], [/litecoin/i, 'LTC'], [/dogecoin/i, 'DOGE'], [/cardano/i, 'ADA'],
  [/polkadot/i, 'DOT'], [/avalanche/i, 'AVAX'], [/\btron\b/i, 'TRX'], [/stellar/i, 'XLM'], [/near protocol/i, 'NEAR'], [/cosmos/i, 'ATOM'],
  [/polygon/i, 'POL'], [/arbitrum/i, 'ARB'], [/aptos/i, 'APT'], [/toncoin|\bton network/i, 'TON'], [/hedera/i, 'HBAR'], [/filecoin/i, 'FIL'],
  [/algorand/i, 'ALGO'], [/internet computer/i, 'ICP'], [/injective/i, 'INJ'], [/\bsui\b/i, 'SUI']];
// Art und Wichtigkeit einer Ankündigung nach ihrem Titel (oder null, wenn sie nicht zählt)
export function bnKind(title) {
  const t = String(title);
  if (/\bHas Completed\b|\bCompletes?\b|\bCompleted\b/i.test(t)) return null;
  if (/^Introducing\b.*HODLer Airdrops/i.test(t)) return { kind: 'listing', imp: 'high' }; // neuer Coin, wird danach gelistet
  if (/TradFi|bStocks?|Stock Trading|Pre-Market|Pre-IPO|Delivery Contracts?|Binance Alpha|Launchpool|Megadrop|\bEarn\b|Convert|Buy Crypto|VIP Loan|Copy Trading|Trading Bots?|\bOptions?\b/i.test(t) && !/Delist/i.test(t)) return null;
  if (/Monitoring Tag/i.test(t)) return /Remov/i.test(t) ? { kind: 'monitor-off', imp: 'medium' } : { kind: 'monitor', imp: 'high' };
  if (/Removal of Spot Trading Pairs/i.test(t)) return { kind: 'pair', imp: 'high' };
  if (/Futures Will Delist/i.test(t)) return { kind: 'futures-delist', imp: 'medium' };
  if (/\bMargin\b/i.test(t) && /Delist/i.test(t) && !/Pairs?\b/i.test(t)) return { kind: 'margin', imp: 'medium' };
  if (/Will Delist/i.test(t)) return { kind: 'delist', imp: 'high' };
  if (/^Binance Futures Will Launch/i.test(t) && /USDT\b/.test(t) && !/Multiple/i.test(t)) return { kind: 'futures', imp: 'medium' };
  if (/^Binance Will List\b/i.test(t) && !/Futures/i.test(t)) return { kind: 'listing', imp: 'high' };
  if (/^Binance Will Support\b/i.test(t) && /Network Upgrade|Hard ?Fork|Migration|Token Swap|Token Merge|Redenomination|Rebranding|Contract Swap|Ticker Change|Mainnet/i.test(t)) return { kind: 'upgrade', imp: 'high' };
  return null;
}
// Betroffene Coins (und bei entfernten Handelspaaren die USDT-Paare)
export function bnCoins(kind, title, body) {
  let coins = [], pairs = [];
  if (kind === 'pair') { pairs = uniq([...body.matchAll(/\b([A-Z0-9]{2,15})\/USDT\b/g)].map(m => coinOf(m[1]))); coins = pairs; }
  else if (kind === 'margin') coins = [...body.matchAll(/^\s*([A-Z0-9]{2,15})\s+\(/gm)].map(m => m[1]);
  else if (kind === 'futures' || kind === 'futures-delist') coins = [...title.matchAll(/\b([A-Z0-9]{2,20})USDT\b/g)].map(m => m[1]);
  else if (kind === 'delist') coins = paren(title).length ? paren(title) : listOf(/Will Delist\s+(.+?)\s+on\s+\d{4}-\d{2}-\d{2}/i.exec(title)?.[1] || '');
  else {
    coins = paren(title);
    if (!coins.length && kind === 'upgrade') coins = NETWORKS.filter(([re]) => re.test(title)).map(([, c]) => c).slice(0, 1);
    if (!coins.length && kind.startsWith('monitor')) coins = [...body.matchAll(/^\s*([A-Z0-9]{2,15})\s+\(/gm)].map(m => m[1]).concat(paren(body.slice(0, 2000)));
  }
  coins = uniq(coins.map(coinOf)).filter(c => TICK.test(c) && !NOT_COIN.has(c)).slice(0, 30);
  return { coins, pairs: pairs.filter(c => coins.includes(c)).map(c => `${c}/USDT`) };
}
// Text einer Ankündigung (Binance liefert ihn als JSON-Baum, ersatzweise als HTML)
export function bodyText(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return '';
  let tree;
  try { tree = JSON.parse(raw); }
  catch { return raw.replace(/<br\s*\/?>|<\/(p|li|h\d|tr|div)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' '); }
  const walk = n => typeof n === 'string' ? n : Array.isArray(n) ? n.map(walk).join('')
    : n && typeof n === 'object' ? (n.node === 'text' ? String(n.text ?? '') : walk(n.child || []) + (/^(p|li|h\d|tr|br|div)$/.test(n.tag) ? '\n' : n.tag === 'td' ? ' | ' : '')) : '';
  return walk(tree).replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ');
}
// Zeitpunkt des Termins: die UTC-Zeit am Datum aus dem Titel, sonst die erste im Text (z. B. Handelsstart)
export function eventTime(title, body) {
  const times = [...body.matchAll(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::\d{2})?\s*\(?UTC\)?/g)]
    .map(m => ({ day: `${m[1]}-${m[2]}-${m[3]}`, t: Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) }));
  if (!times.length) return null;
  const day = /\d{4}-\d{2}-\d{2}/.exec(title)?.[0];
  return ((day && times.find(x => x.day === day)) || times[0]).t;
}
const keepBn = (b, now) => now - b.t <= BN_WINDOW && (b.at != null ? b.at >= now - BN_PAST : now - b.t <= 7 * D);
// Liste(n) und Texte → Ankündigungen mit Coins und Termin. getBody(code) lädt den Text, falls die Liste ihn nicht enthält.
export async function bnItems(articles, now, getBody) {
  const items = [], seen = new Set();
  for (const a of articles) {
    const t = Number(a?.publishDate ?? a?.releaseDate), code = String(a?.code || ''), title = String(a?.title || '').replace(/\s+/g, ' ').trim();
    if (!/^[0-9a-f]{32}$/.test(code) || seen.has(code) || !Number.isFinite(t) || now - t > BN_WINDOW) continue;
    seen.add(code);
    const k = bnKind(title);
    if (!k) continue;
    const body = bodyText(a.body) || bodyText(await getBody(code));
    const { coins, pairs } = bnCoins(k.kind, title, body);
    if (!coins.length) continue;
    const item = { code, t, at: eventTime(title, body), kind: k.kind, imp: k.imp, coins, title: title.slice(0, 200) };
    if (pairs.length) item.pairs = pairs;
    if (keepBn(item, now)) items.push(item);
  }
  return items.sort((a, b) => b.t - a.t);
}

// ---------- Zusammenführen ----------
export function assemble({ now, binance, news, prev, state }) {
  const bn = (binance ?? (Array.isArray(prev?.binance) ? prev.binance : [])).filter(b => keepBn(b, now));
  const out = {};
  for (const [sym] of COINS) {
    const list = news[sym] ?? prev?.news?.[sym] ?? [];
    const fresh = list.filter(i => now - i.t <= NEWS_WINDOW);
    if (fresh.length) out[sym] = fresh;
  }
  return { v: 1, fetchedAt: new Date(now).toISOString(), covered: COINS.map(c => c[0]), state, binance: bn, news: out };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (compatible; ScalpDesk-News; +https://github.com/NicoAHB/wx-widget)';
async function get(url, tries = 3) {
  for (let i = 1; ; i++) {
    let why;
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'de-DE,de;q=0.9,en;q=0.8' }, signal: AbortSignal.timeout(20000) });
      if (r.ok) return await r.text();
      why = `HTTP ${r.status}`;
      if (r.status !== 429 && r.status < 500) throw Object.assign(new Error(why), { final: true });
    } catch (e) { if (e.final) throw e; why = why || e.message; }
    if (i >= tries) throw new Error(why);
    console.log(`${url.split('?')[0]}: Versuch ${i}, ${why}`);
    await sleep(5000 * i);
  }
}
async function main([prevFile, outFile]) {
  let prev = null;
  try { if (prevFile && existsSync(prevFile)) { const p = JSON.parse(readFileSync(prevFile, 'utf8')); if (p?.v === 1) prev = p; } }
  catch { console.log('Vorige Datei unlesbar – weiter ohne sie.'); }
  const now = Date.now(), state = {};
  let binance = null;
  try {
    const articles = [];
    for (const id of BN_CATALOGS) {
      const list = JSON.parse(await get(BN_LIST(id)))?.data?.articles;
      if (!Array.isArray(list)) throw new Error(`Katalog ${id}: unerwartetes Format`);
      articles.push(...list);
      await sleep(400);
    }
    binance = await bnItems(articles, now, async code => {
      await sleep(400);
      try { return JSON.parse(await get(BN_DETAIL(code), 2))?.data?.body; } catch (e) { console.log(`Ankündigung ${code}: ${e.message}`); return ''; }
    });
    state.binance = 'ok';
  } catch (e) { state.binance = 'fehler'; console.log(`::warning::Binance-Ankündigungen nicht abrufbar (${e.message}) – bisheriger Stand bleibt.`); }
  const news = {};
  let ok = 0, fail = 0, stop = '';
  for (const c of COINS) {
    if (stop) { fail++; continue; }
    try { news[c[0]] = gnForCoin(gnParse(await get(gnUrl(c), 2)), c[0], now); ok++; }
    catch (e) { fail++; console.log(`Google News ${c[0]}: ${e.message}`); if (/HTTP (403|429|503)/.test(e.message)) stop = e.message; }
    await sleep(1200);
  }
  state.google = !fail ? 'ok' : ok ? 'teilweise' : 'fehler';
  if (fail) console.log(`::warning::Google News: ${fail} von ${COINS.length} Suchen fehlgeschlagen${stop ? ` (abgebrochen nach ${stop})` : ''} – für diese Coins bleibt der bisherige Stand.`);
  if (!binance && !ok) { console.log('::warning::Keine Quelle erreichbar – der bisherige Stand bleibt.'); process.exit(3); }
  const out = assemble({ now, binance, news, prev, state });
  writeFileSync(outFile, JSON.stringify(out));
  const n = Object.values(out.news).reduce((s, l) => s + l.length, 0);
  console.log(`Binance: ${out.binance.length} Ankündigungen (${state.binance}); Google News: ${n} Meldungen zu ${Object.keys(out.news).length} Coins (${state.google}); Stand ${out.fetchedAt}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(e => { console.error(`Abbruch: ${e.stack || e.message}`); process.exit(1); });
}
