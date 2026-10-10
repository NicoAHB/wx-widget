// 3.61.0: Lokale Papierausführung, ausschließlich eigene Demo-Bücher und öffentliche Quotes.
import { floorQuantity } from './confluence-risk-view.mjs';
import { tradeLevels, costFilter } from './confluence-core.mjs';
import { fundingScenario } from './confluence-live.mjs';
import { AdaptiveAIGridStrategy, gridSettings } from './adaptive-grid.mjs';
import { decimal, decimalText } from './bot-limits.mjs';
export const PAPER_VERSION = 'paper-1', PAPER_MAX_TRADES = 2000;
const copy = x => JSON.parse(JSON.stringify(x)), positive = x => Number.isFinite(x) && x > 0;
const time = x => Number.isSafeInteger(x) && x >= 0, sum = (xs, f) => xs.reduce((s, x) => s + f(x), 0);
// Mengen und Budgetvergleiche exakt auf dem Börsenraster, Anzeige weiterhin als Zahl.
function plain(x) { const [m,e='0']=String(x).toLowerCase().split('e');if(!Number(e))return m;const sign=m.startsWith('-')?'-':'',[whole,tail='']=m.replace('-','').split('.'),digits=whole+tail,point=whole.length+Number(e);return sign+(point<=0?'0.'+'0'.repeat(-point)+digits:point>=digits.length?digits+'0'.repeat(point-digits.length):digits.slice(0,point)+'.'+digits.slice(point)); }
const rat=x=>decimal(typeof x==='number'?plain(x):x),add=(a,b)=>({n:a.n*b.d+b.n*a.d,d:a.d*b.d}),sub=(a,b)=>add(a,{n:-b.n,d:b.d}),mul=(a,b)=>({n:a.n*b.n,d:a.d*b.d}),div=(a,b)=>({n:a.n*b.d,d:a.d*b.n}),cmp=(a,b)=>{const n=a.n*b.d-b.n*a.d;return n<0n?-1:n>0n?1:0;},zero=()=>rat('0'),total=(xs,f)=>xs.reduce((a,x)=>add(a,f(x)),zero());
const quantity=p=>rat(p.quantityText??plain(Number(p.quantity))),value=r=>Number(decimalText(r));
function positionOK(p) { return p && typeof p.id==='string' && typeof p.signalId==='string' && /^[A-Z0-9]{2,20}USDT$/.test(p.instrument) && [1,-1].includes(p.direction) && [p.entry,p.quantity,p.margin,p.sl,p.tp,p.initialRisk].every(positive) && Number.isInteger(p.leverage) && p.leverage>=1 && p.leverage<=125 && [p.entryFee,p.feeExit].every(x=>Number.isFinite(x)&&x>=0) && time(p.openedAt) && time(p.maxHoldMs) && fundingOK(p.funding,p.openedAt) && typeof p.quantityText==='string' && Number(p.quantityText)===p.quantity; }
export function paperBook(raw = null) {
  if (raw == null) return { version: PAPER_VERSION, revision: 0, run: null, closed: [] };
  if (raw.version !== PAPER_VERSION || !Number.isSafeInteger(raw.revision) || raw.revision < 0 || !Array.isArray(raw.closed) || raw.closed.length > PAPER_MAX_TRADES
    || raw.closed.some(p=>!positionOK(p)||!time(p.closedAt)||!positive(p.exit)||!p.result||!['net','gross','fees','funding','roe'].every(k=>Number.isFinite(p.result[k])))
    || raw.run && (!Array.isArray(raw.run.positions) || raw.run.positions.length>100 || raw.run.positions.some(p=>!positionOK(p)||p.instrument!==raw.run.instrument) || !Array.isArray(raw.run.orders) || raw.run.orders.length>30 || raw.run.orders.some(o=>typeof o.id!=='string'||![o.entry,o.sl,o.tp,Number(o.quantity)].every(positive)||!time(o.createdAt)) || !Array.isArray(raw.run.seen) || raw.run.seen.length>10000 || raw.run.seen.some(x=>typeof x!=='string') || !['running','paused','ended'].includes(raw.run.status) || !Number.isFinite(raw.run.realized) || !time(raw.run.startedAt) || !/^[A-Z0-9]{2,20}USDT$/.test(raw.run.instrument))) throw new Error('Demo-Buch ist beschädigt; nicht überschrieben.');
  if(raw.run)paperConfig(raw.run.config);
  const ids=[...raw.closed,...(raw.run?.positions||[])].map(p=>p.id);if(new Set(ids).size!==ids.length)throw new Error('Demo-Buch enthält doppelte Positionen; nicht überschrieben.');
  return copy(raw);
}
export function paperConfig(input) {
  const c = copy(input);
  if (!['confluence', 'po3', 'adaptive-grid'].includes(c.strategy) || !['long', 'short', 'both'].includes(c.direction)
    || ![c.referenceUSDT, c.exposureUSDT, c.riskPercent].every(positive) || c.riskPercent > 100 || c.exposureUSDT > c.referenceUSDT * c.leverage
    || !Number.isInteger(c.leverage) || c.leverage < 1 || c.leverage > 125 || !Number.isInteger(c.maxPositions) || c.maxPositions < 1 || c.maxPositions > 10
    || !Number.isFinite(c.minimumScore) || c.minimumScore < 70 || c.minimumScore > 100 || !time(c.cooldownMs)
    || ![c.feeEntry, c.feeExit, c.slippageBps].every(x => Number.isFinite(x) && x >= 0) || c.feeEntry >= .05 || c.feeExit >= .05 || c.slippageBps > 100
    || !Number.isFinite(c.rewardRisk) || c.rewardRisk < 2 || !time(c.maxHoldMs) || c.maxHoldMs < 60000 || c.maxHoldMs > 604800000) throw new Error('Strategie, eigene Übungsbasis, Exposition, Risiko, Hebel und Kosten prüfen.');
  for (const k of ['gain', 'loss']) if (c[k]?.enabled && (!positive(c[k].amountUSDT) || !['entries', 'close'].includes(c[k].action))) throw new Error('Gewinn-/Verlustgrenze und Einheit prüfen.');
  if (c.strategy === 'adaptive-grid') { c.grid = gridSettings(c.grid); if (c.direction !== 'long') throw new Error('Grid handelt nur eigene Longs.'); }
  return c;
}
export function paperStart(raw, { instrument, config, id }, at) {
  const b = paperBook(raw), cfg = paperConfig(config);
  if (!/^[A-Z0-9]{2,20}USDT$/.test(instrument) || !time(at) || typeof id !== 'string' || !id || id.length > 100) throw new Error('Demo-Coin/Laufkennung fehlt.');
  if (b.run?.positions.length) throw new Error('Vorhandene Demo-Positionen zuerst fortsetzen oder beenden.');
  b.run = { id, instrument, config: cfg, startedAt: at, status: 'running', reason: 'Öffentliche Marktdaten und Modell laden.', positions: [], orders: [], seen: [], realized: 0, lastEntryAt: null, lastQuoteAt: null, quote: null, limit: null, gridState: null };
  return b;
}
export function paperQuote(quote, instrument, asOf) {
  return quote?.venue === 'bitget' && quote.product === 'USDT-FUTURES' && quote.instrument === instrument && [quote.bid, quote.ask].every(positive) && quote.ask >= quote.bid
    && time(asOf) && time(quote.at) && time(quote.knownAt) && quote.at <= quote.knownAt && quote.knownAt <= asOf && asOf - quote.at <= 5000;
}
function fundingCost(p, at) {
  const f = p.funding; if (!f || at < f.nextAt) return 0;
  const n = Math.min(1024, Math.floor((at - f.nextAt) / (f.intervalHours * 3600000)) + 1);
  return p.direction * p.entry * p.quantity * f.rate * n;
}
export function paperResult(p, quote, at) {
  if (!p) return null;
  const price = p.exit ?? (p.direction === 1 ? quote?.bid : quote?.ask);
  if (!positive(price)) return null;
  const gross = p.direction * (price - p.entry) * p.quantity, fees = p.entryFee + price * p.quantity * p.feeExit, funding = fundingCost(p, p.closedAt ?? at), net = gross - fees - funding;
  return { price, gross, fees, funding, net, roe: net / p.margin * 100 };
}
function exitPosition(b, p, quote, at, reason) {
  const r = b.run, price = (p.direction === 1 ? quote.bid : quote.ask) * (1 - p.direction * r.config.slippageBps / 10000);
  const closed = { ...p, exit: price, closedAt: at, reason, runId: r.id, instrument: r.instrument };
  closed.result = paperResult(closed, null, at); r.realized += closed.result.net; b.closed.push(closed); r.positions = r.positions.filter(x => x.id !== p.id); r.lastEntryAt = at;
}
function fundingOK(f, at) { return f?.kind === 'current' && Number.isFinite(f.rate) && positive(f.intervalHours) && time(f.nextAt) && f.nextAt > at && time(f.knownAt) && f.knownAt <= at && at - f.knownAt <= 120000 && f.positiveMeans === 'long-pays'; }
function entry(b, signal, quote, contract, funding, at, quantity = null, maker = false) {
  const r = b.run, c = r.config, d = signal.direction, price = maker ? signal.entry : (d === 1 ? quote.ask : quote.bid) * (1 + d * c.slippageBps / 10000);
  if (!positive(price) || !positive(signal.sl) || !positive(signal.tp) || d * (price - signal.sl) <= 0 || d * (signal.tp - price) <= 0 || !fundingOK(funding, at)) { r.reason = 'Aktueller Preisplan oder Funding-Szenario fehlt.'; return false; }
  const feeEntry = c.strategy === 'adaptive-grid' ? (maker ? c.grid.makerFeePct : c.grid.takerFeePct) / 100 : c.feeEntry, feeExit = c.strategy === 'adaptive-grid' ? c.grid.takerFeePct / 100 : c.feeExit;
  const hold=signal.maxHoldMs??c.maxHoldMs,fundingEvents=at+hold<funding.nextAt?0:Math.floor((at+hold-funding.nextAt)/(funding.intervalHours*3600000))+1;
  const fundingReserve=mul(rat(price),rat(Math.max(0,d*funding.rate)*fundingEvents));
  const loss = add(fundingReserve,add(mul(rat(d),sub(rat(price),rat(signal.sl))),add(mul(rat(price),rat(feeEntry)),add(mul(rat(signal.sl),rat(feeExit)),div(mul(rat(price),rat(c.slippageBps)),rat(10000)))))),lossUnit=value(loss);
  const exposure = sub(rat(c.exposureUSDT),total(r.positions,p=>mul(quantity(p),rat(Math.max(p.entry,quote.ask)))));
  const risk = sub(div(mul(rat(c.referenceUSDT),rat(c.riskPercent)),rat(100)),total(r.positions,p=>rat(p.initialRiskText??plain(p.initialRisk))));
  const equity=c.referenceUSDT+r.realized+sum(r.positions,p=>paperResult(p,quote,at).net);
  const margin = sub(rat(Math.min(c.referenceUSDT,Math.max(0,equity),c.strategy==='adaptive-grid'?Number(c.grid.capitalUSDT):c.referenceUSDT)),total(r.positions,p=>rat(p.marginText??plain(p.margin))));
  if([exposure,risk,margin].some(x=>cmp(x,zero())<=0)){r.reason='Eigene Exposition, Stoprisiko oder Margin ausgeschöpft.';return false;}
  const max = Math.min(value(div(exposure,rat(price))),value(div(risk,loss)),value(div(mul(margin,rat(c.leverage)),rat(price))));
  const q = floorQuantity(Math.min(quantity ?? max, max), contract.quantityStep);
  if (!q || !positive(q.quantity) || q.quantity < contract.minQuantity || cmp(mul(rat(q.text),rat(price)),rat(contract.minNotional))<0 || cmp(mul(rat(q.text),loss),risk)>0 || cmp(mul(rat(q.text),rat(price)),exposure)>0 || cmp(div(mul(rat(q.text),rat(price)),rat(c.leverage)),margin)>0
    || lossUnit >= price / c.leverage || c.strategy !== 'adaptive-grid' && r.positions.length >= c.maxPositions) { r.reason = 'Kein Einstieg: Mengenraster, Mindestwert, Exposition, Stoprisiko oder Margin reichen nicht.'; return false; }
  if (c.strategy !== 'adaptive-grid' && (cmp(mul(rat(d),sub(rat(signal.tp),rat(price))),mul(rat(c.rewardRisk*d),sub(rat(price),rat(signal.sl))))<0 || cmp(mul(rat(d),sub(mul(rat(signal.tp),sub(rat(1),rat(d*feeExit))),mul(rat(price),add(rat(1),rat(d*feeEntry))))),zero())<=0)) { r.reason = 'Aktuelles Ziel reicht nach Kursänderung und Kosten nicht.'; return false; }
  r.positions.push({ id: r.id + '|' + signal.id, signalId: signal.id, instrument: r.instrument, strategy: c.strategy, direction: d, entry: price, quantity: q.quantity, quantityText: q.text, margin: price * q.quantity / c.leverage, leverage: c.leverage, sl: signal.sl, tp: signal.tp,
    openedAt: at, maxHoldMs: signal.maxHoldMs ?? c.maxHoldMs, entryFee: price * q.quantity * feeEntry, feeExit, initialRisk: q.quantity * lossUnit, initialRiskText:decimalText(mul(rat(q.text),loss)),marginText:decimalText(div(mul(rat(q.text),rat(price)),rat(c.leverage))), funding: copy(funding), score: signal.score ?? null, costsKind: 'Gebührenmodell; Fundingrate und Takt beim Einstieg konstant angenommen' });
  r.seen.push(signal.id); r.lastEntryAt = at; r.reason = 'Demo-Einstieg zum öffentlichen Kurs modelliert.'; return true;
}
function contractOK(c, instrument, at) { return c?.venue === 'bitget' && c.product === 'USDT-FUTURES' && c.instrument === instrument && [c.tickSize, c.quantityStep].every(positive) && Number.isFinite(c.minQuantity) && c.minQuantity >= 0 && Number.isFinite(c.minNotional) && c.minNotional >= 0 && time(c.knownAt) && c.knownAt <= at && at - c.knownAt < 86400000; }
export function paperStep(raw, { quote, contract, funding, signals = [], gridMarket = null, modelReason = 'Warten auf ein vollständig geprüftes Signal.', asOf }) {
  const b = paperBook(raw), r = b.run; if (!r || r.status === 'ended') return b;
  if (!paperQuote(quote, r.instrument, asOf) || quote.at < r.startedAt || r.lastQuoteAt !== null && quote.at < r.lastQuoteAt) { r.status = 'paused'; r.reason = 'Kursdaten fehlen; neue Einstiege pausiert.'; return b; }
  r.quote = copy(quote); const c = r.config; r.status = 'running';
  // Bekannter Schutz kommt vor Modell, Entry, Rangeverschiebung und Datenfehlern des Signal-Workers.
  for (const p of [...r.positions]) {
    const price = p.direction === 1 ? quote.bid : quote.ask, stop = p.direction * (price - p.sl) <= 0, target = p.direction * (price - p.tp) >= 0;
    if (stop || paperResult(p, quote, asOf).gross <= -p.margin || asOf - p.openedAt >= p.maxHoldMs || target && c.strategy!=='adaptive-grid') exitPosition(b, p, quote, asOf, stop ? 'Stop erreicht' : paperResult(p, quote, asOf).gross <= -p.margin ? 'Margin verbraucht · Modell' : asOf-p.openedAt>=p.maxHoldMs ? 'Maximale Haltedauer' : 'Ziel erreicht');
  }
  const net = r.realized + sum(r.positions, p => paperResult(p, quote, asOf).net);
  for (const k of ['loss', 'gain']) if (!r.limit && c[k]?.enabled && (k === 'loss' ? net <= -c[k].amountUSDT : net >= c[k].amountUSDT)) { r.limit = { kind: k, at: asOf, net, action: c[k].action }; r.orders = []; }
  if (r.limit?.action === 'close') for (const p of [...r.positions]) exitPosition(b, p, quote, asOf, 'Laufgrenze ' + r.limit.kind);
  if(c.referenceUSDT+net<=0){r.orders=[];r.status='paused';r.reason='Übungsbasis rechnerisch verbraucht; keine neuen Einstiege. Bestehender Schutz bleibt.';r.lastQuoteAt=quote.at;return b;}
  if (b.closed.length + r.positions.length >= PAPER_MAX_TRADES || r.seen.length >= 10000) { r.orders = []; r.status = 'paused'; r.reason = 'Demo-Speichergrenze erreicht; beenden und Demo-Daten löschen.'; return b; }
  if (c.strategy === 'adaptive-grid') {
    try { if (gridMarket?.scope?.instrument === r.instrument && gridMarket.scope.runId === r.id && gridMarket.asOf <= asOf && asOf - gridMarket.asOf <= 120000 && contractOK(contract, r.instrument, asOf)) {
      const strategy = new AdaptiveAIGridStrategy({ scope: gridMarket.scope, config: c.grid, saved: r.gridState });
      const qty=total(r.positions,quantity),fees=rat(Math.max(c.grid.makerFeePct,c.grid.takerFeePct)/100),buffer=div(add(rat(c.grid.slippageReservePct),rat(c.grid.fundingReservePct)),rat(100));
      const inventory = { confirmed: true, instrument: r.instrument, product: 'USDT-FUTURES', leg: 'long', owner: r.id, quantity: decimalText(qty), averageEntry: r.positions.length ? decimalText(div(total(r.positions,p=>mul(quantity(p),rat(p.entry))),qty)) : '0', reservedSellQuantity: '0', reservedBuyNotional: decimalText(total(r.orders,o=>mul(rat(o.quantity),mul(rat(o.entry),add(rat(1),fees))))), reservedBuyRiskUSDT: decimalText(total(r.orders,o=>mul(rat(o.quantity),add(sub(rat(o.entry),rat(o.sl)),add(mul(rat(o.entry),add(fees,buffer)),mul(rat(o.sl),fees)))))), openOrders: r.orders.length };
      const plan = strategy.place_grid_orders({ candidate: gridMarket.range, quote, contract, inventory, asOf, leverage: c.leverage, exposureUSDT: String(c.exposureUSDT), riskUSDT: String(c.referenceUSDT*c.riskPercent/100), guard: { entries: !r.limit, closes: true, keepExistingProtection: true }, liveVolume: gridMarket.liveVolume });
      r.gridState = plan.state; r.reason = plan.reason;
      for (const p of r.positions) if (positive(plan.stop || plan.trailingStop)) p.sl = Math.max(p.sl,plan.stop || plan.trailingStop);
      if (plan.action === 'close') for (const p of [...r.positions]) exitPosition(b,p,quote,asOf,'Grid-Ausbruchschutz');
      // Pump zuerst bewerten: bekannte Stops bleiben vorrangig, TP erst nach dem Trendurteil.
      if(plan.mode!=='TREND')for(const p of [...r.positions])if(quote.bid>=p.tp)exitPosition(b,p,quote,asOf,'Ziel erreicht');
      if (plan.mode !== 'GRID' || plan.capitalExceeded || plan.riskExceeded || r.limit) r.orders = [];
      else {
        // Erst alte Limits an einer späteren Quote prüfen, danach den Plan ergänzen.
        for (const o of [...r.orders]) if (quote.at > o.createdAt && quote.ask <= o.entry) { if (entry(b,o,quote,contract,funding,asOf,Number(o.quantity),true)) r.orders = r.orders.filter(x=>x.id!==o.id); }
        const known = new Set([...r.seen,...r.orders.map(x=>x.id)]);
        for (const o of plan.orders.filter(x=>x.side==='buy')) { const tp=plan.contingent.find(x=>x.afterFillOf===o.intentId); if (tp && !known.has(o.intentId)) r.orders.push({ id:o.intentId,direction:1,entry:Number(o.price),sl:plan.stop,tp:Number(tp.price),quantity:o.quantity,createdAt:quote.at }); }
      }
    } else { r.reason = 'Grid-Momentaufnahme fehlt; keine neuen Käufe.'; r.orders = []; } } catch(e) { r.orders=[]; r.status='paused'; r.reason=e.message; }
  } else if (!r.limit && contractOK(contract,r.instrument,asOf) && (r.lastEntryAt === null || asOf - r.lastEntryAt >= c.cooldownMs)) {
    r.reason = modelReason;
    for (const s of Array.isArray(signals)?signals:[]) {
      if (!s || s.instrument !== r.instrument || s.model !== c.strategy || !s.eligible || ![1,-1].includes(s.direction) || c.direction !== 'both' && c.direction !== (s.direction===1?'long':'short') || !Number.isFinite(s.score) || s.score < c.minimumScore
        || !time(s.knownAt) || s.knownAt < r.startedAt || s.knownAt > asOf || !time(s.expiresAt) || s.expiresAt <= asOf || r.seen.includes(s.id)) continue;
      try { let signal = s;
      if (s.model === 'confluence') {
        const card = s.original, d=s.direction, price=(d===1?quote.ask:quote.bid)*(1+d*c.slippageBps/10000);
        const levels=tradeLevels({ entry:price,anchor:card.anchor?.price,atr:card.context.base.atr,direction:d,tickSize:contract.tickSize },card.config);
        const scenario=fundingScenario({current:funding,entryAt:asOf,exitAt:asOf+c.maxHoldMs,entry:price,mode:'current-rate'});
        const costs=costFilter({levels,direction:d,entryAt:asOf,tpAt:asOf+c.maxHoldMs,slAt:asOf+c.maxHoldMs,fundingTP:scenario,fundingSL:scenario,slippageBps:c.slippageBps},card.config);
        if (!costs.passed) { r.reason='Aktuelle Konfluenz-Kostenprüfung sperrt den Einstieg.'; continue; }
        signal={...s,entry:levels.entry,sl:levels.sl,tp:levels.tp};
      } else if (s.entryMode === 'limit' && (s.direction===1 ? quote.ask>s.entry : quote.bid<s.entry)) { r.reason='PO3: auf Berührung des ursprünglichen Limits warten.'; continue; }
      if (entry(b,signal,quote,contract,funding,asOf,null,s.entryMode==='limit')) break;
      } catch(e) { r.reason='Signalmodell nicht bewertbar: '+e.message; }
    }
  } else if (!r.limit) r.reason = contractOK(contract,r.instrument,asOf) ? 'Pause zwischen Einstiegen; vorhandene Positionen weiter begleiten.' : 'Passendes Kontraktraster fehlt; keine neuen Einstiege.';
  if (r.limit) r.reason = (r.limit.kind==='loss'?'Verlust':'Gewinn')+'grenze verriegelt; '+(r.limit.action==='close'?'Demo-Positionen geschlossen.':'nur vorhandenen Schutz begleiten.');
  r.lastQuoteAt = quote.at; return b;
}
export function paperEnd(raw, quote, asOf) {
  const b=paperBook(raw),r=b.run;if(!r)return b;r.orders=[];
  if (paperQuote(quote,r.instrument,asOf)) for(const p of [...r.positions])exitPosition(b,p,quote,asOf,'Demo beendet');
  r.status='ended';r.endedAt=asOf;r.reason=r.positions.length?'Demo beendet; Restbestand ohne frischen Kurs erhalten. Bewusst fortsetzen.':'Demo beendet.';return b;
}
