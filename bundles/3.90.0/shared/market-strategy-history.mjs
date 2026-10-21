import { MARKET_STRATEGY as C, STRATEGY_IDS, prepareStrategy, evaluatePreparedStrategy, strategyOutcome, strategyKey, strategyOptions } from './market-strategy-core.mjs';
import { prepareMarketPhase, marketPhaseAt, phaseHistoryBars } from './market-phase-core.mjs';
import { nyNetR } from './ny-open-backtest.mjs';
import { nyWait } from './ny-open-history.mjs';
import { pullbackWorkerJob } from './trend-pullback-backtest.mjs';
const H=3600000,Q=900000;
const cancelled=s=>{if(s?.aborted)throw s.reason||new globalThis.DOMException('Abgebrochen','AbortError');};
export function strategyStatistics(records,feePct,slippagePct){const done=records.filter(r=>r.outcome.first&&r.outcome.status!=='gap'&&Number.isFinite(r.outcome.first.grossR)).sort((a,b)=>a.outcome.first.at-b.outcome.first.at||a.signal.symbol.localeCompare(b.signal.symbol));
  let sum=0,peak=0,drawdown=0,gains=0,losses=0,streak=0,maxLosses=0,wins=0;
  for(const r of done){const net=nyNetR(r.signal,r.outcome.first,feePct??r.signal.costs?.feePct??C.feePct,slippagePct??r.signal.costs?.slippagePct??C.slippagePct);sum+=net;peak=Math.max(peak,sum);drawdown=Math.max(drawdown,peak-sum);if(net>0){wins++;gains+=net;streak=0;}else if(net<0){losses-=net;maxLosses=Math.max(maxLosses,++streak);}else streak=0;}
  return {signals:records.length,completed:done.length,open:records.filter(r=>!r.outcome.first).length,gaps:records.filter(r=>r.outcome.status==='gap').length,winrate:done.length?wins/done.length*100:null,averageR:done.length?sum/done.length:null,netR:sum,profitFactor:losses?gains/losses:null,noLosses:done.length>0&&losses===0,drawdown,maxLosses};
}
export function strategyReport(records,options,from,to){const o=strategyOptions(options),split=from+(to-from)*(1-C.testShare),group=rows=>strategyStatistics(rows,o.feePct,o.slippagePct),outcomesBefore=(rows,limit)=>rows.filter(r=>r.outcome.first&&r.outcome.first.at<=limit);
  // Kein Ergebnis, das erst im Prüfzeitraum bekannt wurde, gehört zur Entwicklungsauswertung.
  const earlier=records.filter(r=>r.signal.at<split),later=records.filter(r=>r.signal.at>=split),purged=earlier.filter(r=>!r.outcome.first||r.outcome.first.at>split);
  return {from,to,split,options:o,total:group(records),development:group(outcomesBefore(earlier,split)),validation:group(later),purged:purged.length,
    coins:[...new Set(records.map(r=>r.signal.symbol))].sort().map(symbol=>({symbol,...group(records.filter(r=>r.signal.symbol===symbol))})),
    phases:[0,1,-1].map(phase=>({phase,...group(records.filter(r=>r.signal.phaseSnapshot?.phase===phase))})),
    warning:'Ergebnis: vollständiger Ausstieg am ersten Ziel oder Stop, spätestens nach 24h. Theoretischer Einstieg am Bestätigungsschluss mit angegebenen Kosten, keine Füllgarantie. Zeitlich getrennte Diagnose, keine automatische Optimierung. Rückgang aus realisierten R, kein Kontodrawdown. Gleichzeitige Coins/Modelle sind abhängig. Short auf Spot ist hypothetisch; Funding ist nicht enthalten.'};
}
export async function scanMarketStrategies({id,candles,symbol,market,from,to,options={},signal}){const frames=prepareStrategy(candles,to),phase=prepareMarketPhase(candles['1h'],to),records=[],seen=new Set(),locks={1:0,'-1':0};let hour=-1;
  for(let i=C.volumeBars+2;i<frames['15m'].rows.length;i++){cancelled(signal);const b=frames['15m'].rows[i];if(b.end<from||b.end>to)continue;if(i%64===0)await nyWait(0,signal);
    while(hour+1<phase.rows.length&&phase.rows[hour+1].end<=b.end)hour++;
    const snapshot=marketPhaseAt(phase,hour),r=evaluatePreparedStrategy(frames,{id,symbol,market,index:i,now:b.end,phase:snapshot,historical:true,options}),s=r.signal;
    if(!s||seen.has(strategyKey(s))||s.at<locks[s.direction])continue;
    const outcome=strategyOutcome(s,frames['15m'].rows.slice(i+1,i+1+Math.ceil(C.holdMs/Q)),to),saved={...s};delete saved.chart;
    records.push({signal:saved,outcome,source:'backtest',updatedAt:to});seen.add(strategyKey(s));locks[s.direction]=(outcome.first?.at||s.expiresAt)+C.cooldownMs;
  }return records;
}
export async function runMarketStrategyBacktest({id,symbols,history,options={},now=Date.now(),signal,workerFactory,progress=()=>{},completed=()=>{},from,to}){if(!STRATEGY_IDS.includes(id))throw Error('Unbekanntes Beobachtungsmodell.');const o=strategyOptions(options);to??=Math.floor(now/Q)*Q;from??=Math.floor((to-o.days*86400000)/H)*H;
  const records=[],errors=[];let checked=0;
  for(const coin of symbols){cancelled(signal);try{if(!coin.market)throw Error('Börsenmarkt fehlt in der Vorauswahl.');const candles={};
    for(const [iv,ms,warmup]of [['1h',H,phaseHistoryBars()],['15m',Q,C.bars15]]){const end=Math.floor(to/ms)*ms,start=Math.floor(from/ms)*ms-warmup*ms;let all=[];
      for(let cursor=start;cursor<end;){cancelled(signal);const next=Math.min(end,cursor+C.chunkDays*86400000);progress({checked,total:symbols.length,symbol:coin.symbol,interval:iv});const rows=await history({...coin,timeframe:iv,from:cursor,to:next,signal});if(rows.length!==(next-cursor)/ms||rows.some((b,i)=>b.time!==cursor+i*ms||b.end!==b.time+ms))throw Error(iv+': historische Kerzenlücke.');all=all.concat(rows);cursor=next;}candles[iv]=all;}
    const job={type:'scan',id,...coin,candles,from,to,options:o},batch=workerFactory?await pullbackWorkerJob(workerFactory,job,signal):await scanMarketStrategies({...job,signal});cancelled(signal);await completed(batch);records.push(...batch);checked++;
  }catch(e){cancelled(signal);errors.push({symbol:coin.symbol,text:e.message});}}
  return {id,version:C.version,at:now,from,to,checked,symbols,errors,records,...strategyReport(records,o,from,to)};
}
