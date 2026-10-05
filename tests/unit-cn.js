// 3.20.0 – Coin-News ohne Browser: Auswahl im GitHub-Job (.github/news/build.mjs) mit echten Schlagzeilen und
// Binance-Ankündigungen aus dem Probelauf vom 29.09.2026, Zusammenfassen gleicher Meldungen, Zeitfenster, Übernahme des
// vorigen Stands bei Ausfällen; dazu die App-Seite (js/coinnews.js): Prüfen der Datei, Auswahl je Coin, Reihenfolge, Texte.
// Aufruf: node unit-cn.js (JOB=… und SRC=… für andere Pfade)
const fs = require('fs'), path = require('path');
const JOB = process.env.JOB || require('path').join(__dirname, '..', '.github/news/build.mjs');
const SRC = process.env.SRC || path.join(__dirname, 'js', 'coinnews.js');
let pass = 0, fail = 0; const check = (n, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${info ? ' — ' + info : ''}`); };
const min = 60e3, h = 60 * min, d = 24 * h, NOW = Date.parse('2026-09-29T19:30:00Z');
(async () => {
  const job = await import(JOB);
  // ---- Schlagzeilen: was zählt für welchen Coin ----
  const cls = (title, sym) => { const c = job.gnClassify(title, sym); return c ? `${c.cat}/${c.imp}` : '–'; };
  const cases = [
    ['XRP', 'XRP News heute: Bitget-Hack kostet 157 Mio. Dollar in XRP, doch der Kurs hält 1,47 Dollar', 'sicherheit/high'],
    ['XRP', 'XRP: Bitget-Diebstahl schlägt durch?', 'sicherheit/high'],
    ['XRP', 'Bitget-Hack: Verdächtiger Geldwäscher fordert XRP an', 'sicherheit/high'],
    ['XRP', 'XRP: Batch-Update für 9. Oktober bestätigt', 'netz/high'],
    ['NEAR', 'NEAR-Protokoll stoppt $503K an gestohlenen Geldern nach', 'sicherheit/high'],
    ['NEAR', 'Bitwise bringt ersten US-Spot-ETF auf NEAR mit 0,75 % Verwaltungsgebühr', 'etf/high'],
    ['ETH', 'Ethereum nach Hegotá: Was der letzte Fork bedeutet', 'netz/high'],
    ['ETH', 'Krypto News: Ethereum legt 71 % in einem Quartal zu, doch das Glamsterdam-Upgrade könnte alles verändern', 'netz/high'],
    ['LINK', 'Wie beeinflusst das CCIP-2.0-Upgrade von Chainlink den LINK-Kurs?', 'netz/high'],
    ['SOL', 'Bitcoin-ETFs mit Rekordzuflüssen, Solana testet Alpenglow-Upgrade', 'netz/high'],
    ['BTC', 'Bitcoin-ETFs mit Rekordzuflüssen, Solana testet Alpenglow-Upgrade', 'etf/medium'],
    ['XRP', 'Krypto News: $75 Millionen fließen in XRP-ETFs — warum der Kurs trotzdem nicht steigt', 'etf/medium'],
    ['ETH', 'BitMine erwirbt 17.362 ETH, womit seine Reserven nun 6 Millionen Token überschreiten', 'angebot/medium'],
    ['XRP', '473 Millionen XRP: Diese Abstimmung könnte Evernorth an die Nasdaq bringen', 'firma/medium'],
    ['XRP', 'SEC genehmigt ersten XRP-Spot-ETF', 'etf/high'],
    ['XRP', 'Gericht weist Klage gegen Ripple ab', 'recht/high'],
    ['BCH', 'Bitcoin Cash: Hard Fork am 15. November – was Anleger wissen müssen', 'netz/high'],
    ['LTC', 'Coinbase listet Litecoin-Futures für US-Kunden', 'boerse/high'],
    // aus dem Probelauf auf GitHub (29.09.2026, 19:55 UTC)
    ['XRP', 'XRP: Notfall-Update schließt Protokoll-Schwachstellen', 'sicherheit/high'],
    ['ATOM', 'Cosmos fällt um rund 8,5 %, da ein Exploit des Neutron-Protokolls einen Netzwerkausfall und einen Notfall-Patch auslöst', 'sicherheit/high'],
    ['NEAR', 'Erster NEAR Spot-ETF in den USA: Bitwise macht den Anfang', 'etf/high'],
    ['ALGO', 'Algorand Upgrade auf v5.0 erweitert Funktionen', 'netz/high'],
    ['HYPE', 'HYPE-Unlock am 29. September: 700 Mio. außer Umlauf', 'angebot/medium'],
    ['BTC', 'Han-ETF startet ersten Euro-gehedgten Bitcoin-ETC', 'etf/medium'],
    ['HYPE', 'Krypto-News: Bitcoin über 80.000, Robinhood-Boom & Hyperliquid-Allzeithoch Carnival Pricing Glitch Outage (lDLvSh99Ml)', '–'],
    // fällt weg: Kursprognosen, Marktberichte über viele Coins, fremde Themen, Kursbewegungen ohne Anlass
    ['XRP', 'XRP Prognose: Escrow-Freigabe am 1. Oktober', '–'],
    ['XRP', 'Crypto Today: Bitcoin, Ethereum, XRP correct upward amid declining ETF inflows', '–'],
    ['BTC', 'Bitcoin, Ethereum, Solana: Hacker haben leichtes Spiel – niemand zieht die Notbremse', '–'],
    ['BTC', 'bitcoin.de: Handel ruht, MiCAR-Lizenz fehlt weiter', '–'],
    ['BTC', 'Bitcoin Group in den roten Zahlen: Neustart von bitcoin.de hängt an MiCAR-Lizenz', '–'],
    ['ETH', 'Ethereum am Scheideweg - schwache Derivate bremsen den Angriff auf 3.000 Dollar', '–'],
    ['ETH', 'Ethereum Gas und Etherscan: Gebühren verstehen, ERC20 senden, Freigaben prüfen', '–'],
    ['XRP', 'XRP: SWIFT startet konkurrierendes Blockchain-Ledger', '–'],
    ['XRP', 'Ripple und Stellar: Warum XRP und XLM jetzt kämpfen müssen', '–'],
    ['XRP', 'XRP-Kurs springt an – jetzt rückt dieses Kursziel näher', '–'],
    ['BCH', 'Crypto Weekly: BCH und NEAR legen um 34 % zu, während Altcoins Bitcoin übertreffen', '–'],
    ['BCH', 'Bitcoin Cash: Wie viel Gewinn eine Investition von vor 3 Jahren eingebracht hätte', '–'],
    ['ETC', 'Han-ETF startet ersten Euro-gehedgten Bitcoin-ETC', '–'],
    ['ADA', 'Ada Lovelace: Die erste Programmiererin der Welt', '–'],
  ];
  const wrong = cases.filter(([s, t, want]) => cls(t, s) !== want).map(([s, t, want]) => `${s} „${t.slice(0, 50)}“: ${cls(t, s)} statt ${want}`);
  check(`Schlagzeilen: ${cases.length} echte und typische Fälle richtig eingestuft (sehr wichtig, wichtig, fällt weg)`, !wrong.length, wrong.join(' | '));
  // ---- RSS lesen ----
  const rss = `<?xml version="1.0"?><rss><channel><title>x</title>
    <item><title>XRP: Bitget-Diebstahl schlägt durch? - Börse Global</title><link>https://news.google.com/rss/articles/CBMiAAA?oc=5</link><pubDate>Mon, 28 Sep 2026 09:18:00 GMT</pubDate><source url="https://boerse-global.de">Börse Global</source></item>
    <item><title>Bitcoin, Ethereum, Ripple &amp;amp; Co.: Wie sich die Kryptokurse entwickeln - finanzen.ch</title><link>https://news.google.com/rss/articles/CBMiBBB?oc=5</link><pubDate>Tue, 29 Sep 2026 15:22:48 GMT</pubDate><source url="https://finanzen.ch">finanzen.ch</source></item>
    <item><title>Gericht &amp; SEC: Ripple &#8211; Urteil - btc-echo.de - BTC-ECHO</title><link>https://news.google.com/rss/articles/CBMiCCC?oc=5</link><pubDate>Tue, 29 Sep 2026 10:00:00 GMT</pubDate><source url="https://btc-echo.de">BTC-ECHO</source></item>
    <item><title>Falscher Link</title><link>javascript:alert(1)</link><pubDate>Tue, 29 Sep 2026 10:00:00 GMT</pubDate><source>x</source></item>
    <item><title>Ohne Datum</title><link>https://news.google.com/rss/articles/CBMiDDD</link><source>x</source></item></channel></rss>`;
  const items = job.gnParse(rss);
  check('RSS: Titel ohne Mediennamen, Zeichen dekodiert, nur sichere Links mit Datum', items.length === 3 && items[0].title === 'XRP: Bitget-Diebstahl schlägt durch?' && items[0].outlet === 'Börse Global'
    && items[1].title === 'Bitcoin, Ethereum, Ripple &amp; Co.: Wie sich die Kryptokurse entwickeln' && items[2].title === 'Gericht & SEC: Ripple – Urteil' && items[2].t === Date.parse('2026-09-29T10:00:00Z'), JSON.stringify(items.map(i => i.title)));
  // ---- Zusammenfassen: dieselbe Geschichte aus mehreren Medien ----
  const at = (hAgo, title, outlet, imp = 'high', cat = 'sicherheit') => ({ t: NOW - hAgo * h, imp, cat, title, outlet, url: `https://news.google.com/rss/articles/${outlet.replace(/\W/g, '')}` });
  const raw = [at(23, 'XRP: Bitget-Diebstahl schlägt durch?', 'Börse Global'), at(5, 'Bitget-Hack: Verdächtiger Geldwäscher fordert XRP an', 'Coinfomania'),
    at(0.1, 'XRP News heute: Bitget-Hack kostet 157 Mio. Dollar in XRP, doch der Kurs hält 1,47 Dollar', 'FinanzNachrichten.de'),
    at(2, 'XRP: Batch-Update für 9. Oktober bestätigt', 'CryptoTicker', 'high', 'netz'), at(30, 'Krypto News: $75 Millionen fließen in XRP-ETFs', 'Wallstreet Online', 'medium', 'etf'),
    at(3, 'XRP: Batch-Update für 9. Oktober bestätigt', 'CryptoTicker', 'high', 'netz')];
  const cl = job.gnCluster(raw);
  const bitget = cl.find(c => /Bitget/.test(c.title)), batch = cl.find(c => /Batch/.test(c.title));
  check('Gleiche Geschichte (Bitget-Hack, 3 Medien) wird eine Meldung mit „+2“, die neueste steht vorn', cl.length === 3 && bitget.more === 2 && /^XRP News heute/.test(bitget.title), JSON.stringify(cl.map(c => [c.title.slice(0, 30), c.more])));
  check('Doppelte Meldung desselben Mediums zählt nicht als weitere Quelle', batch && batch.more === 0, JSON.stringify(batch));
  const cl2 = job.gnCluster([at(40, 'XRP vor wichtigen Terminen: ETF-Zuflüsse treffen auf Upgrade-Verzögerungen und Token-Freigabe', 'Coin Kurier', 'high', 'netz'),
    at(4, 'XRP unter Druck: Upgrade-Verzögerung trifft auf ETF-Zuflüsse und Angebotsrisiken', 'Krypto Magazin', 'high', 'netz'), at(95, 'XRP: Verzögerung beim Ledger', 'Alt', 'high', 'netz')]);
  check('Zusammenfassen über Wortstämme („Verzögerungen“ = „Verzögerung“), höchstens 48 Stunden auseinander', cl2.length === 2 && cl2[0].more === 1 && /^XRP unter Druck/.test(cl2[0].title) && cl2[1].more === 0, JSON.stringify(cl2.map(c => [c.title.slice(0, 20), c.more])));
  // ---- je Coin: Zeitfenster, Reihenfolge, Obergrenze ----
  const feed = [
    { t: NOW - 2 * h, title: 'XRP: Batch-Update für 9. Oktober bestätigt', outlet: 'CryptoTicker', url: 'https://news.google.com/rss/articles/A' },
    { t: NOW - 1 * h, title: 'Krypto News: $75 Millionen fließen in XRP-ETFs — warum der Kurs trotzdem nicht steigt', outlet: 'WO', url: 'https://news.google.com/rss/articles/B' },
    { t: NOW - 20 * h, title: 'XRP: Bitget-Diebstahl schlägt durch?', outlet: 'BG', url: 'https://news.google.com/rss/articles/C' },
    { t: NOW - 4 * d, title: 'Gericht weist Klage gegen Ripple ab', outlet: 'Alt', url: 'https://news.google.com/rss/articles/D' },
    { t: NOW - 3 * h, title: 'XRP Prognose: Kommt jetzt der Sprung über das Hoch?', outlet: 'SD', url: 'https://news.google.com/rss/articles/E' }];
  const mine = job.gnForCoin(feed, 'XRP', NOW);
  check('Je Coin: nur wichtige der letzten 3 Tage, sehr wichtige zuerst (neueste oben), dann wichtige', mine.map(m => m.title.slice(0, 12)).join('|') === 'XRP: Batch-U|XRP: Bitget-|Krypto News:' && mine.every(m => m.url && m.outlet),
    mine.map(m => `${m.imp} ${m.title.slice(0, 20)}`).join(' | '));
  const many = Array.from({ length: 12 }, (_, i) => ({ t: NOW - i * h, title: `Gericht verhandelt Klage Nummer${i} gegen Ripple`, outlet: `M${i}`, url: `https://news.google.com/rss/articles/${i}` }));
  check(`Höchstens ${job.PER_COIN} Meldungen je Coin`, job.gnForCoin(many.map((m, i) => ({ ...m, title: `${['Gericht', 'Urteil', 'Klage', 'Richter'][i % 4]} ${['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliett', 'Kilo', 'Lima'][i]}xx: Ripple` })), 'XRP', NOW).length === job.PER_COIN);
  check('Suchanfrage: deutsch, letzte 3 Tage, Coin-Name', job.gnUrl(job.COINS.find(c => c[0] === 'BCH')) === 'https://news.google.com/rss/search?q=%22Bitcoin%20Cash%22%20when%3A3d&hl=de&gl=DE&ceid=DE:de', job.gnUrl(job.COINS.find(c => c[0] === 'BCH')));

  // ---- Binance: Art nach Titel ----
  const kind = t => job.bnKind(t)?.kind || '–';
  const titles = [
    ['Binance Will List Hyperliquid (HYPE) with Seed Tag Applied', 'listing'], ['Notice of Removal of Spot Trading Pairs - 2026-10-02', 'pair'],
    ['Binance Margin And Loans Token Delist on 2026-10-02', 'margin'], ['Binance Will Delist ICX, SCRT, STORJ on 2026-09-03', 'delist'],
    ['Binance Will Support the Injective (INJ) Network Upgrade & Hard Fork - 2026-09-24', 'upgrade'], ['Binance Will Support the Zilliqa (ZIL) Network Migration', 'upgrade'],
    ['Binance Will Support the Stargate Finance (STG) Token Merge to LayerZero (ZRO)', 'upgrade'], ['Binance Will Extend the Monitoring Tag to Include Alpaca Finance (ALPACA)', 'monitor'],
    ['Binance Will Remove the Monitoring Tag for Terra (LUNA)', 'monitor-off'], ['Binance Futures Will Delist USDⓈ-Margined ALPACAUSDT Perpetual Contract', 'futures-delist'],
    ['Binance Futures Will Launch USDⓈ-Margined HYPEUSDT Perpetual Contract', 'futures'], ['Introducing Avantis (AVNT) on Binance HODLer Airdrops! Earn AVNT With Retroactive BNB Simple Earn Subscriptions', 'listing'],
    // zählen nicht
    ['Binance Futures Will Launch Multiple TradFi USDⓈ-Margined Perpetual Contracts (2026-09-29)', '–'], ['Binance Will Add Hyperliquid (HYPE) on Earn, Buy Crypto, Convert, VIP Loan & Margin', '–'],
    ['Binance Futures Will Launch OURAUSDT USDⓈ-Margined Perpetual Contract Pre-IPO Trading (2026-09-23)', '–'], ['Binance Completes the USDT Contract Swap on Optimism Network - 2026-09-18', '–'],
    ['Binance Will Close UAH Deposits and Withdrawals via Fiat Trade UAH and Delist USDT/UAH Spot Trading Pair', '–'], ['Notice of Removal of Margin Trading Pairs - 2026-09-25', '–'],
    ['Binance Wallet System Upgrade Notice (2026-09-22)', '–'], ['Binance Will Support Scheduled Upgrade for Stock Trading Services - 2026-09-26', '–'],
    ['Binance Futures Will List USDⓈ-M & COIN-M Quarterly 0326 Delivery Contracts', '–'], ['Update on the Margin Tiers of USDⓈ-M Perpetual Contracts (2026-10-02)', '–'],
    ['Binance Will Support the SpaceX (SPCXB) Airdrop for MarsCoin (MARSCOIN) Holders', '–'], ['ALGO Trading Tournament: Trade to Share Up to 200,000 USDC Token Vouchers', '–'],
  ];
  const kw = titles.filter(([t, k]) => kind(t) !== k).map(([t, k]) => `„${t.slice(0, 50)}“: ${kind(t)} statt ${k}`);
  check(`Binance: ${titles.length} Titel richtig eingeordnet (Listing, Delisting, Paar, Margin, Futures, Upgrade, Beobachtungsliste, zählt nicht)`, !kw.length, kw.join(' | '));
  // ---- Binance: Coins und Termin aus dem Text ----
  const mBody = 'Fellow Binancians,\nBinance Margin and Loans will delist and cease trading on all trading pairs for the following token(s) at 2026-10-02 10:00 (UTC):\nREQ (Request Network)\nWIN (WINkLink)\nGNS (Gains Network)\nTFUEL (Theta Fuel)\nLoans\nAt 2026-10-02 10:00 (UTC) and without further notice to you, Flexible Loans will close all outstanding loan positions\nMargin\nBinance Margin will suspend new borrowing at 2026-09-30 10:00 (UTC).';
  const mc = job.bnCoins('margin', 'Binance Margin And Loans Token Delist on 2026-10-02', mBody), mt = job.eventTime('Binance Margin And Loans Token Delist on 2026-10-02', mBody);
  check('Margin-Delisting: Coins aus der Liste im Text, Termin = Zeit am Datum aus dem Titel', mc.coins.join() === 'REQ,WIN,GNS,TFUEL' && mt === Date.UTC(2026, 9, 2, 10, 0), `${mc.coins} ${new Date(mt).toISOString()}`);
  const pBody = 'Based on our most recent reviews, Binance will remove and cease trading on the following spot trading pairs:\nAt 2026-10-02 03:00 (UTC): AUCTION/USDC, XRP/TRY, 1000CAT/USDT and VANA/USDT';
  const pc = job.bnCoins('pair', 'Notice of Removal of Spot Trading Pairs - 2026-10-02', pBody), pc2 = job.bnCoins('pair', 'x', 'At 2026-10-02 03:00 (UTC): AUCTION/USDC and XRP/TRY');
  check('Entfernte Handelspaare: nur USDT-Paare zählen (die App handelt USDT-Paare)', pc.coins.join() === 'CAT,VANA' && pc.pairs.join() === 'CAT/USDT,VANA/USDT' && !pc2.coins.length, JSON.stringify([pc, pc2]));
  const lBody = 'Binance will list Hyperliquid (HYPE) and open trading for the following spot trading pairs at 2026-09-24 11:00 (UTC).\nNew Spot Trading Pairs: HYPE/USDT, HYPE/USDC\nWithdrawals will open at 2026-09-25 11:00 (UTC).';
  check('Listing: Coin aus dem Titel, Termin = Handelsstart', job.bnCoins('listing', 'Binance Will List Hyperliquid (HYPE) with Seed Tag Applied', lBody).coins.join() === 'HYPE' && job.eventTime('Binance Will List Hyperliquid (HYPE) with Seed Tag Applied', lBody) === Date.UTC(2026, 8, 24, 11, 0));
  check('Delisting: mehrere Coins aus dem Titel; Upgrade ohne Kürzel: bekanntes Netzwerk oder keins', job.bnCoins('delist', 'Binance Will Delist ICX, SCRT, STORJ on 2026-09-03', '').coins.join() === 'ICX,SCRT,STORJ'
    && job.bnCoins('delist', 'Binance Will Delist Wrapped Beacon ETH (WBETH) on 2026-10-09', '').coins.join() === 'WBETH'
    && job.bnCoins('upgrade', 'Binance Will Support the Ethereum Network Upgrade (Fusaka) - 2026-12-03', '').coins.join() === 'ETH'
    && !job.bnCoins('upgrade', 'Binance Will Support the Base Network Upgrade & Hard Fork - 2026-09-30', '').coins.length
    && job.bnCoins('futures', 'Binance Futures Will Launch USDⓈ-Margined 1000PEPEUSDT Perpetual Contract', '').coins.join() === 'PEPE');
  const tree = JSON.stringify({ node: 'root', child: [{ node: 'element', tag: 'p', child: [{ node: 'text', text: 'Binance will suspend deposits and withdrawals from 2026-09-24 06:00 (UTC).' }] }, { node: 'element', tag: 'p', child: [{ node: 'text', text: 'Trading is not affected.' }] }] });
  check('Text aus dem JSON-Baum von Binance (und aus HTML)', job.bodyText(tree) === 'Binance will suspend deposits and withdrawals from 2026-09-24 06:00 (UTC).\nTrading is not affected.\n' && /deposits\n/.test(job.bodyText('<p>deposits</p><p>x</p>')) && job.bodyText(null) === '', JSON.stringify(job.bodyText(tree)));
  // ---- Binance: Liste → Einträge, Zeitfenster, Text nur bei Bedarf laden ----
  const art = (code, title, daysAgo, body) => ({ code: code.padEnd(32, '0'), title, publishDate: NOW - daysAgo * d, body });
  const loaded = [];
  const bodies = { ['a1'.padEnd(32, '0')]: JSON.stringify({ node: 'root', child: [{ node: 'text', text: 'Trading starts at 2026-09-30 11:00 (UTC).' }] }),
    ['a2'.padEnd(32, '0')]: 'Binance will delist at 2026-09-03 03:00 (UTC).', ['a3'.padEnd(32, '0')]: 'suspend from 2026-10-01 06:00 (UTC)', ['a5'.padEnd(32, '0')]: 'At 2026-09-10 03:00 (UTC)' };
  const bn = await job.bnItems([
    art('a1', 'Binance Will List Hyperliquid (HYPE) with Seed Tag Applied', 2), art('a2', 'Binance Will Delist ICX, SCRT, STORJ on 2026-09-03', 12),
    art('a3', 'Binance Will Support the Injective (INJ) Network Upgrade & Hard Fork - 2026-10-01', 1), art('a4', 'Binance Will Add 3 bStocks Tokenized Securities', 1),
    art('a5', 'Binance Will Support the Terra (LUNA) Network Upgrade - 2026-09-10', 19), art('a6', 'Binance Will List Old (OLD)', 30),
    art('a3', 'Binance Will Support the Injective (INJ) Network Upgrade & Hard Fork - 2026-10-01', 1), { code: 'kaputt', title: 'Binance Will List X (X1)', publishDate: NOW }], NOW,
  async code => { loaded.push(code.slice(0, 2)); return bodies[code] || ''; });
  check('Binance-Einträge: kommende Termine und frische Listings; Vergangenes, Altes, Doppeltes, Kaputtes fällt weg', bn.map(b => b.coins.join()).join('|') === 'INJ|HYPE' && bn[0].at === Date.UTC(2026, 9, 1, 6, 0) && bn[1].kind === 'listing',
    JSON.stringify(bn.map(b => [b.coins, b.kind, b.at && new Date(b.at).toISOString()])));
  check('Text wird nur für zählende Ankündigungen geladen', loaded.join() === 'a1,a2,a3,a5', loaded.join());
  // Liste mit gekürztem Text: der vollständige Text zählt; scheitert das Laden, der aus der Liste
  const full = 'Binance Margin and Loans will delist at 2026-10-02 10:00 (UTC):\nREQ (Request Network)\nWIN (WINkLink)', st = {};
  const mg = await job.bnItems([{ code: 'b1'.padEnd(32, '0'), title: 'Binance Margin And Loans Token Delist on 2026-10-02', publishDate: NOW - 2 * h, body: 'Binance Margin and Loans will delist and cease trading on all trading pairs for the following token(s) at 2026-10-02 10:00 (UTC): REQ (Request…' },
    { code: 'b2'.padEnd(32, '0'), title: 'Binance Will Delist ABC on 2026-10-06', publishDate: NOW - h, body: 'Binance will delist ABC at 2026-10-06 03:00 (UTC).' }, { code: 'b3'.padEnd(32, '0'), title: 'Binance Will Support the Base Network Upgrade & Hard Fork - 2026-09-30', publishDate: NOW - h }], NOW,
  async code => (code.startsWith('b1') ? full : ''), st);
  check('Gekürzter Text in der Liste: Coins aus dem vollständigen Text; Laden gescheitert: Text aus der Liste; Zähler', mg.map(b => b.coins.join()).join('|') === 'ABC|REQ,WIN' && mg[0].at === Date.UTC(2026, 9, 6, 3, 0)
    && JSON.stringify(st) === JSON.stringify({ read: 3, relevant: 3, old: 0, noCoins: 1, past: 0 }), JSON.stringify([mg.map(b => b.coins), st]));
  // Liste ohne Datum (Kategorie-Liste von Binance): Datum aus der vollständigen Ankündigung
  const st2 = {}, nd = await job.bnItems([{ code: 'c1'.padEnd(32, '0'), title: 'Binance Will Delist ABC on 2026-10-06', publishDate: null },
    { code: 'c2'.padEnd(32, '0'), title: 'Binance Will Delist DEF on 2026-10-07', publishDate: null }, { code: 'c3'.padEnd(32, '0'), title: 'Binance Will Delist GHI on 2026-10-08' }], NOW,
  async code => ({ c1: { body: 'at 2026-10-06 03:00 (UTC)', publishDate: NOW - h }, c2: { body: 'at 2026-10-07 03:00 (UTC)', publishDate: String(NOW - 30 * d) }, c3: { body: 'at 2026-10-08 03:00 (UTC)' } }[code.slice(0, 2)]), st2);
  check('Liste ohne Datum: Datum aus der Ankündigung; zu alt oder ohne Datum fällt weg', nd.map(b => b.coins.join()).join() === 'ABC' && nd[0].t === NOW - h && st2.old === 2, JSON.stringify([nd.map(b => b.coins), st2]));
  // ---- Zusammenführen mit dem vorigen Stand ----
  const prev = { v: 1, binance: [{ code: 'p'.repeat(32), t: NOW - 2 * d, at: NOW + d, kind: 'upgrade', imp: 'high', coins: ['XRP'], title: 'alt' }],
    news: { XRP: [{ t: NOW - 10 * h, imp: 'high', cat: 'recht', title: 'alt XRP', outlet: 'o', url: 'https://news.google.com/rss/articles/p', more: 0 }], BCH: [{ t: NOW - 5 * d, imp: 'high', cat: 'netz', title: 'zu alt', outlet: 'o', url: 'https://news.google.com/rss/articles/q', more: 0 }] } };
  const out = job.assemble({ now: NOW, binance: null, news: { BTC: [{ t: NOW - h, imp: 'high', cat: 'etf', title: 'neu', outlet: 'o', url: 'https://news.google.com/rss/articles/n', more: 0 }] }, prev, state: { binance: 'fehler', google: 'teilweise' } });
  check('Ausfall: Binance und fehlgeschlagene Suchen aus dem vorigen Stand (nur im Zeitfenster), neue Suchen ersetzen ihn', out.v === 1 && out.binance.length === 1 && out.binance[0].title === 'alt'
    && out.news.BTC[0].title === 'neu' && out.news.XRP[0].title === 'alt XRP' && !out.news.BCH && out.covered.length === job.COINS.length && out.fetchedAt === new Date(NOW).toISOString(), JSON.stringify(Object.keys(out.news)));
  const out2 = job.assemble({ now: NOW, binance: [], news: { XRP: [] }, prev, state: {} });
  check('Neuer leerer Stand ersetzt den alten (keine Meldungen mehr zu XRP)', !out2.binance.length && !out2.news.XRP);

  // ---- App (js/coinnews.js) ----
  if (fs.existsSync(SRC)) await require('./unit-cn-app.js')({ check, job, SRC, NOW });
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('✗ Abbruch — ' + e.stack); process.exit(1); });
