// Startwerte beider Beobachtungsmodelle. Keine Parameteroptimierung im laufenden Betrieb.
import { analysisClosed } from './analysis-top-down.mjs';
import { confirmedPivots } from './indicators.mjs';
import { musterIndicators } from './muster-bot-core.mjs';
import { pullbackOutcome, PULLBACK_OUTCOME } from './trend-pullback-core.mjs';
export const MARKET_STRATEGY = Object.freeze({ version:'market-strategy-1', history:400, bars15:320, atrPeriod:14, emaPeriod:20,
  rangeBars:48, breakoutBars:24, minRangeATR:1.5, maxRangeATR:8, maxBreakoutATR:6, minRangePct:.4,
  touches:2, touchSpacing:3, touchATR:.25, sweepATR:.05, breakBufferATR:.05, retestATR:.25, retestFailureATR:.5,
  retestBars:8, bodyRatio:.55, volumeBars:20, volumeFactor:1.2, stopBufferATR:.15,
  minStopPct:.15, maxStopPct:2, minRR:1.5, minNetRR:1.2, holdMs:86400000, alertAgeMs:900000, cooldownMs:14400000,
  feePct:.05, slippagePct:.02, backtestDays:180, testShare:.3, chunkDays:7, maxRecords:20000,
  closeGraceMs:2500, requestSpacingMs:750, retryMs:15000, maxRetryMs:300000, forecastBars:12 });
export const STRATEGY_IDS=Object.freeze(['range-return','breakout-retest']);
export const STRATEGY_NAMES=Object.freeze({'range-return':'Range-Rückkehr','breakout-retest':'Ausbruch mit Rücktest'});
export const STRATEGY_DATA_KEY='scalpdesk.idb.market-strategies.v1';
export const STRATEGY_REPORT_KEY='scalpdesk.idb.market-strategy-tests.v1';
export const STRATEGY_OUTCOME=PULLBACK_OUTCOME;
export const strategyAlertCurrent=(signal,now)=>now>=signal.at&&now<signal.at+MARKET_STRATEGY.alertAgeMs;
const H=3600000,Q=900000,finite=Number.isFinite;
export function strategyClosedIndex(rows,at){let low=0,high=rows.length;while(low<high){const middle=(low+high)>>>1;if(rows[middle].end<=at)low=middle+1;else high=middle;}return low-1;}
export const strategyKey=s=>[s.version,s.analysisId,s.symbol,s.market,s.direction,s.setupId].join('|');
export const strategyOptions=v=>({days:Number.isInteger(v?.days)?Math.max(30,Math.min(365,v.days)):MARKET_STRATEGY.backtestDays,
  feePct:finite(v?.feePct)?Math.max(0,Math.min(5,v.feePct)):MARKET_STRATEGY.feePct,
  slippagePct:finite(v?.slippagePct)?Math.max(0,Math.min(5,v.slippagePct)):MARKET_STRATEGY.slippagePct});
export function prepareStrategy(candles,now){const frames={};for(const iv of ['1h','15m']){const rows=analysisClosed(candles[iv]||[],iv,now);frames[iv]={rows,values:musterIndicators(rows,{atrPeriod:MARKET_STRATEGY.atrPeriod,emaPeriod:MARKET_STRATEGY.emaPeriod,volumePeriod:MARKET_STRATEGY.volumeBars})};}return frames;}
// Grenzen werden ausschließlich aus Stundenkerzen gebildet, die VOR dem Auslöser bekannt waren.
export function strategyRange(frame,asOf,breakout=false){const c=MARKET_STRATEGY,n=breakout?c.breakoutBars:c.rangeBars,last=strategyClosedIndex(frame.rows,asOf),rows=frame.rows.slice(Math.max(0,last+1-n),last+1),atr=frame.values[last]?.atr;
  if(rows.length<n||!(atr>0))return null;
  const high=Math.max(...rows.map(b=>b.high)),low=Math.min(...rows.map(b=>b.low)),width=high-low,pct=width/rows.at(-1).close*100;
  if(width<c.minRangeATR*atr||width>(breakout?c.maxBreakoutATR:c.maxRangeATR)*atr||pct<c.minRangePct)return null;
  const touches=(key,edge)=>{const hits=[];for(let i=0;i<rows.length;i++)if(Math.abs(rows[i][key]-edge)<=c.touchATR*atr&&(!hits.length||i-hits.at(-1)>=c.touchSpacing))hits.push(i);return hits;};
  const highs=touches('high',high),lows=touches('low',low);if(highs.length<c.touches||lows.length<c.touches)return null;
  const highAt=rows.find(b=>b.high===high).time,lowAt=rows.find(b=>b.low===low).time;
  return {id:`${highAt}:${lowAt}`,low,high,width,pct,atr,knownAt:rows.at(-1).end,time:rows[0].time,highAt,lowAt,touches:[highs.length,lows.length],labels:['Bestätigte Range']};
}
function makeSignal(common,id,d,setup,entry,stop,target1,target2,at,chart,options){const c=MARKET_STRATEGY,risk=d*(entry-stop),stopPct=risk/entry*100,rr=d*(target1-entry)/risk,rr2=d*(target2-entry)/risk,costRate=(options.feePct+options.slippagePct)/100,netRR=(d*(target1-entry)-(entry+target1)*costRate)/(risk+(entry+stop)*costRate);
  if(![entry,stop,target1,target2].every(v=>finite(v)&&v>0)||!(risk>0)||stopPct<c.minStopPct||stopPct>c.maxStopPct||rr<c.minRR||netRR<c.minNetRR||rr2<=rr)return {...common,stage:2,phase:'risk',reason:`Bestätigung vorhanden; Stop ${stopPct.toFixed(2)} %, CRV brutto ${rr.toFixed(2)}, nach Kosten ${netRR.toFixed(2)}. Mindestwerte nicht erreicht.`};
  const signal={analysisId:id,analysisName:STRATEGY_NAMES[id],version:c.version,symbol:common.symbol,market:common.market,direction:d,side:d===1?'long':'short',at,expiresAt:at+c.holdMs,setupId:setup.id,entry,stop,target1,target2,rr,rr2,netRR,zone:setup.zone,range:setup.range,
    setup:setup.labels,reason:setup.reason,stageNames:id==='range-return'?['1H Seitwärts','15m Rückkehr','15m bestätigt']:['1H Verdichtung','15m Ausbruch','Rücktest bestätigt'],
    timeframe:'15m',zoneLabel:id==='range-return'?'Range-Rückkehrzone':'Rücktestzone',footer:'Beobachtungsmodell · 1h → 15m · feste Regeln',phaseSnapshot:common.phaseSnapshot,costs:{feePct:options.feePct,slippagePct:options.slippagePct},chart};
  return {...common,stage:3,phase:'signal',direction:d,setup,signal,reason:setup.reason+` CRV ${rr.toFixed(2)} brutto / ${netRR.toFixed(2)} nach Kosten.`};
}
export function evaluatePreparedStrategy(frames,{id,symbol,market,now,phase,options={},index=frames['15m'].rows.length-1,historical=false}){const c=MARKET_STRATEGY,f=frames['15m'],bar=f.rows[index],previous=f.rows[index-1],v=f.values[index],opts=strategyOptions(options),blank={ready:false,stage:0,signal:null,direction:0,symbol,market,reason:'Geschlossene 1h-/15m-Kerzen werden benötigt.'};
  if(!STRATEGY_IDS.includes(id)||index<c.volumeBars+2||!bar||!(v?.atr>0))return blank;
  const at=bar.end,hourEnd=Math.floor(at/H)*H,lastHour=strategyClosedIndex(frames['1h'].rows,at);
  if(lastHour<0||frames['1h'].rows[lastHour].end!==hourEnd||!historical&&at!==Math.floor(now/Q)*Q)return {...blank,reason:'Neueste geschlossene Kerze fehlt.'};
  if(!phase?.ready||phase.at!==hourEnd)return {...blank,reason:'Die feste 1H-Marktphase ist noch nicht aktuell.'};
  const common={...blank,ready:true,at,expiresAt:at+Q,stage:0,phase:'waiting',phaseSnapshot:{phase:phase.phase,count:phase.count,at:phase.at,version:phase.version}},chart=f.rows.slice(Math.max(0,index-59),index+1),atr=v.atr;
  if(id==='range-return'){
    if(phase.phase!==0)return {...common,reason:'Keine Seitwärtsphase: Range-Rückkehr bleibt gesperrt.'};
    const range=strategyRange(frames['1h'],previous.time);if(!range)return {...common,reason:'Noch keine ausreichend oft bestätigte, ausreichend enge 1h-Range.'};
    const base={...common,stage:1,range,reason:'Range steht; auf kurzen Ausflug und Rückkehr mit Schlussbestätigung warten.'};
    for(const d of [1,-1]){const sweep=d===1?previous.low<range.low-c.sweepATR*atr&&previous.close>range.low:previous.high>range.high+c.sweepATR*atr&&previous.close<range.high;
      if(!sweep||previous.close>=range.high||previous.close<=range.low)continue;
      const zone={low:d===1?Math.min(previous.low,range.low):range.high-c.touchATR*atr,high:d===1?range.low+c.touchATR*atr:Math.max(previous.high,range.high),time:previous.time,knownAt:previous.end,labels:['Range-Grenze','Rückkehr nach Sweep']},watch={...base,direction:d,stage:2,phase:'watch',setup:{zone,range},reason:'Rückkehr in die Range erkannt; anschließender Schlussbruch noch offen.'};
      if(d*(bar.close-bar.open)<=0||d*(bar.close-(d===1?previous.high:previous.low))<=0||bar.close<=range.low||bar.close>=range.high)return watch;
      const stop=(d===1?previous.low:previous.high)-d*c.stopBufferATR*atr,setup={id:`range:${range.id}:${d}`,zone,range,labels:zone.labels,reason:'Seitwärtsphase, mehrfach getestete Range, Sweep und anschließende 15m-Schlussbestätigung.'};
      return makeSignal(base,id,d,setup,bar.close,stop,(range.low+range.high)/2,d===1?range.high:range.low,at,chart,opts);
    }return base;
  }
  let pending={...common,reason:'Auf Verdichtung, Volumenausbruch und gehaltenen Rücktest warten.'};
  for(let b=index-2;b>=Math.max(c.volumeBars,index-c.retestBars-1);b--){const breakout=f.rows[b],range=strategyRange(frames['1h'],breakout.time,true);if(!range)continue;
    const before=f.rows[b-1],mean=f.rows.slice(b-c.volumeBars,b).reduce((n,x)=>n+x.volume,0)/c.volumeBars,ba=f.values[b]?.atr,span=breakout.high-breakout.low;
    if(!(mean>0)||!ba||!(span>0)||Math.abs(breakout.close-breakout.open)/span<c.bodyRatio||breakout.volume<mean*c.volumeFactor)continue;
    for(const d of [1,-1]){const edge=d===1?range.high:range.low;
      if(d*(before.close-edge)>0||d*(breakout.close-edge)<=c.breakBufferATR*ba||d*(breakout.close-breakout.open)<=0)continue;
      if(phase.phase!==0&&phase.phase!==d){pending={...common,range,stage:1,reason:'Ausbruch entgegen der bestätigten 1H-Marktphase; kein Einstieg.'};continue;}
      const after=f.rows.slice(b+1,index);if(after.some(x=>d*(x.close-edge)<-c.retestFailureATR*ba))continue;
      const touched=d===1?previous.low<=edge+c.retestATR*ba:previous.high>=edge-c.retestATR*ba;
      const zone={low:edge-c.retestATR*ba,high:edge+c.retestATR*ba,time:breakout.time,knownAt:breakout.end,labels:['Ausbruchsniveau','Rücktest']},base={...common,range,direction:d,stage:1,setup:{range,zone},reason:'Volumenausbruch erkannt; auf gehaltenen Rücktest warten.'};pending=base;
      if(!touched||d*(previous.close-edge)<0)continue;
      pending={...base,stage:2,phase:'watch',reason:'Rücktest berührt; 15m-Schlussbestätigung noch offen.'};
      if(d*(bar.close-bar.open)<=0||d*(bar.close-(d===1?previous.high:previous.low))<=0||d*(bar.close-edge)<=0||d*(bar.close-v.ema)<=0||d*(v.ema-f.values[index-1].ema)<=0)continue;
      const stop=(d===1?Math.min(previous.low,edge):Math.max(previous.high,edge))-d*c.stopBufferATR*ba;
      const pivots=confirmedPivots(frames['1h'].rows.slice(Math.max(0,lastHour+1-c.history),lastHour+1),at,H),levels=pivots.filter(p=>p.type===(d===1?'high':'low')&&d*(p.price-bar.close)>0).map(p=>p.price).sort((a,b)=>d*(a-b));
      const measured=edge+d*range.width,target1=levels.length?d===1?Math.min(levels[0],measured):Math.max(levels[0],measured):measured,target2=edge+d*2*range.width;
      const setup={id:`break:${range.id}:${breakout.time}:${d}`,zone,range,labels:['Verdichtung',`Volumen ${(breakout.volume/mean).toFixed(2)}×`,'Gehaltener Rücktest'],reason:'Geschlossener Volumenausbruch, anschließender Rücktest und bestätigter Schluss in Ausbruchsrichtung.'};
      return makeSignal(base,id,d,setup,bar.close,stop,target1,target2,at,chart,opts);
    }
  }return pending;
}
export function evaluateStrategy(input){return evaluatePreparedStrategy(prepareStrategy(input.candles,input.now),input);}
// Bestehende konservative Ergebnisbeobachtung: Stop vor Ziel, Gaps bleiben offen, Ziel 2 separat.
export const strategyOutcome=(s,rows,now)=>pullbackOutcome(s,rows,now,()=>s.direction,MARKET_STRATEGY.holdMs);
export function strategyData(v){return v?.version===1&&v.records&&typeof v.records==='object'?v:{version:1,records:{}};}
export function mergeStrategyData(a,b){const records={...strategyData(a).records};for(const [k,r]of Object.entries(strategyData(b).records)){const old=records[k];if(old&&old.signal.at!==r.signal.at){if(old.signal.at<r.signal.at)continue;records[k]=r;continue;}if(old?.outcome.first&&!r.outcome.first||old?.outcome.complete&&!r.outcome.complete)continue;if(!old||old.source!=='live'&&r.source==='live'||old.source===r.source&&(r.updatedAt||0)>=(old.updatedAt||0))records[k]=r;}const rows=Object.entries(records).sort((a,b)=>a[1].signal.at-b[1].signal.at),open=rows.filter(([,r])=>!r.outcome.complete),done=rows.filter(([,r])=>r.outcome.complete).slice(-Math.max(0,MARKET_STRATEGY.maxRecords-open.length));return {version:1,records:Object.fromEntries([...done,...open])};}
export function validateStrategyData(v){if(v?.version!==1||!v.records||Array.isArray(v.records)||Object.keys(v.records).length>MARKET_STRATEGY.maxRecords)throw Error('Ungültiges Strategie-Protokoll.');for(const [k,r]of Object.entries(v.records)){const s=r?.signal;if(!s||!STRATEGY_IDS.includes(s.analysisId)||k!==strategyKey(s)||!/^[A-Z0-9]{2,20}USDT$/.test(s.symbol)||!['spot','futures'].includes(s.market)||![1,-1].includes(s.direction)||!Number.isSafeInteger(s.at)||![s.entry,s.stop,s.target1,s.target2].every(x=>finite(x)&&x>0)||s.direction*(s.entry-s.stop)<=0||!r.outcome)throw Error('Ungültiges Strategie-Signal.');}return v;}
