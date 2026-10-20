// Trendfolge-Rücksetzer: feste, kausale Regeln. Alle Startwerte hier anpassen.
import { ema, createIndicatorState, advanceIndicators, confirmedPivots, macdInDirection } from './indicators.mjs';
import { analysisClosed } from './analysis-top-down.mjs';
import { computeKiZones } from './ki-zones.mjs';
import { INTERVAL_MS } from './market-intervals.mjs';
import { directionalMovement } from './directional-movement.mjs';

export const PULLBACK = Object.freeze({ id:'trend-pullback', name:'Trendfolge-Rücksetzer', version:'trend-pullback-1',
  history:500, warmup4h:220, setupWarmup:80, emaFast:21, emaMiddle:50, emaSlow:200, adxPeriod:14, minADX:20,
  structureBars:120, impulseBars:100, fibLow:.382, fibHigh:.618, extension:1.272,
  rsiLongFloor:35, rsiShortCeiling:65, maxSetupHours:24, confirmationHours:6,
  confirmations:2, hammerWick:2, hammerOppositeWick:1, bodyFloor:.05, stopBufferATR:.1,
  minRR:1.5, minStopPct:.2, maxStopPct:1.5, holdMs:24*3600000, cooldownMs:4*3600000,
  closeGraceMs:2500, retryMs:30000, maxRetryMs:300000, forecastBars:25, pulseSeconds:1.2,
  backtestMonths:6, historyChunkDays:14, feePct:.05, slippagePct:.02,
  learningMin:100, retrainEvery:20, trainShare:.7, modelEpochs:350, learningRate:.08, regularization:.01,
  minClassSamples:5, brierImprovement:.001, modelVersions:5, suggestionMin:10, weekMs:7*86400000,
  bootstrapDelayMs:12000, bootstrapRetryMs:15*60000, bootstrapMaxAttempts:3, probabilityDefault:60, probabilityStep:5, maxRecords:20000, maxHistoryDays:450,
  minEstimateBars:1, maxEstimateBars:96 });
export const PULLBACK_DATA_KEY='scalpdesk.idb.trend-pullback.data.v1';
export const PULLBACK_MODEL_KEY='scalpdesk.idb.trend-pullback.model.v1';
export const PULLBACK_BACKTEST_KEY='scalpdesk.idb.trend-pullback.backtest.v1';
export const PULLBACK_ACK_KEY='scalpdesk.trend-pullback.ack.v1';
export const PULLBACK_DELIVERY_KEY='scalpdesk.trend-pullback.delivery.v1';
export const PULLBACK_OUTCOME=Object.freeze({open:'Offen',target1:'Ziel 1 erreicht',target2:'Ziel 2 erreicht',stop:'Stop erreicht',trend:'4h-Trend beendet',timeout:'24 Stunden abgelaufen',gap:'Ergebnisdaten fehlen'});
const Q=INTERVAL_MS['15m'],H=INTERVAL_MS['1h'],H4=INTERVAL_MS['4h'], finite=Number.isFinite;
export const pullbackOptions=v=>({ minProbability:finite(v?.minProbability)&&v.minProbability>=0&&v.minProbability<=100?v.minProbability:0 });
export const pullbackRecordKey=s=>`${s.version}|${s.symbol}|${s.market}|${s.direction}|${s.setupId}`;
export function lastAt(rows,at,field='end') { let lo=0,hi=rows.length;while(lo<hi){const mid=(lo+hi)>>>1;if(rows[mid][field]<=at)lo=mid+1;else hi=mid;}return lo-1; }

// Wilder-ADX; keine Nullwerte als Ersatz für den noch fehlenden Vorlauf.
export function pullbackADX(rows,period=PULLBACK.adxPeriod) {
  return directionalMovement(rows,period).map(v=>v.adx);
}
export function pullbackSeries(rows,interval) {
  if(!rows.length)return[];
  const values=advanceIndicators(createIndicatorState({time:rows[0].time,periodMs:INTERVAL_MS[interval]}),rows,rows.at(-1).end).values,
    prices=rows.map(c=>c.close),fast=ema(prices,PULLBACK.emaFast),middle=ema(prices,PULLBACK.emaMiddle),slow=ema(prices,PULLBACK.emaSlow),adx=pullbackADX(rows);
  return values.map((v,i)=>({...v,ema21:fast[i],ema50:middle[i],ema200:slow[i],adx:adx[i]}));
}
export function preparePullback(candles,asOf) {
  const frames={};
  for(const iv of ['4h','1h','15m']){const rows=analysisClosed(candles[iv],iv,asOf);frames[iv]={rows,values:pullbackSeries(rows,iv),pivots:confirmedPivots(rows,asOf,INTERVAL_MS[iv])};}
  return {frames,biasCache:new Map(),zoneCache:new Map()};
}
export function pullbackTrend(prepared,at) {
  const f=prepared.frames['4h'],index=lastAt(f.rows,at);if(prepared.biasCache.has(index))return prepared.biasCache.get(index);
  if(index+1<PULLBACK.warmup4h)return {direction:0,ready:false,reason:'4h-Vorlauf für EMA 200 und ADX fehlt.'};
  const c=f.rows[index],v=f.values[index],p=f.pivots.filter(p=>p.knownAt<=c.end&&p.index>=index-PULLBACK.structureBars),highs=p.filter(p=>p.type==='high').slice(-2),lows=p.filter(p=>p.type==='low').slice(-2);
  const structure=highs.length===2&&lows.length===2?(highs[1].price>highs[0].price&&lows[1].price>lows[0].price?1:highs[1].price<highs[0].price&&lows[1].price<lows[0].price?-1:0):0;
  const order=v.ema21>v.ema50&&v.ema50>v.ema200&&c.close>v.ema200?1:v.ema21<v.ema50&&v.ema50<v.ema200&&c.close<v.ema200?-1:0;
  const direction=structure===order&&v.adx>=PULLBACK.minADX?order:0;
  const reason=direction?`${direction===1?'Long':'Short'}: Struktur, EMA 21/50/200 und ADX stimmen überein.`:
    [`Struktur ${structure===1?'Long':structure===-1?'Short':'uneindeutig'}`,`EMA-Reihenfolge ${order===1?'Long':order===-1?'Short':'uneindeutig'}`,`ADX ${finite(v.adx)?v.adx.toFixed(1).replace('.',','):'–'} (mindestens ${PULLBACK.minADX})`].join(' · ');
  const result={ready:true,direction,structure,order,adx:v.adx,ema21:v.ema21,ema50:v.ema50,ema200:v.ema200,close:c.close,at:c.end,index,highs,lows,reason};prepared.biasCache.set(index,result);return result;
}
export function pullbackImpulse(prepared,at,direction) {
  const f=prepared.frames['1h'],last=lastAt(f.rows,at),p=f.pivots.filter(p=>p.knownAt<=at&&p.index>=last-PULLBACK.impulseBars),endType=direction===1?'high':'low';
  const to=p.filter(p=>p.type===endType).at(-1),from=to&&p.filter(p=>p.type!==endType&&p.time<to.time).at(-1);
  if(!from||direction*(to.price-from.price)<=0)return null;
  const length=Math.abs(to.price-from.price),a=to.price-direction*PULLBACK.fibLow*length,b=to.price-direction*PULLBACK.fibHigh*length;
  return {from,to,length,low:Math.min(a,b),high:Math.max(a,b),target1:to.price,target2:from.price+direction*PULLBACK.extension*length,knownAt:Math.max(from.knownAt,to.knownAt)};
}
const overlap=(c,z)=>c.low<=z.high&&c.high>=z.low;
export function pullbackSetup(prepared,at,trend) {
  const direction=trend.direction,frame=prepared.frames['1h'],index=lastAt(frame.rows,at),v=frame.values[index],impulse=pullbackImpulse(prepared,at,direction);
  const empty=reason=>({valid:false,reason,impulse});
  if(!impulse)return empty('Noch kein bestätigtes 1h-Impulsbein in Trendrichtung.');
  const tail=frame.rows.slice(impulse.to.index+1,index+1);if(!tail.length||at-impulse.to.time>PULLBACK.maxSetupHours*H)return empty('Auf einen frischen 1h-Rücksetzer nach dem bestätigten Impuls warten.');
  const extreme=direction===1?Math.min(...tail.map(c=>c.low)):Math.max(...tail.map(c=>c.high)),depth=direction*(impulse.to.price-extreme)/impulse.length;
  if(depth<PULLBACK.fibLow||depth>PULLBACK.fibHigh)return {...empty(`Rücksetzer ${Math.round(depth*1000)/10} %; nötig ${PULLBACK.fibLow*100}–${PULLBACK.fibHigh*100} %.`),depth,extreme};
  const rv=frame.values.slice(impulse.to.index+1,index+1).map(v=>v.rsi);
  if(!rv.every(r=>finite(r)&&(direction===1?r>PULLBACK.rsiLongFloor:r<PULLBACK.rsiShortCeiling)))return {...empty('1h-RSI verlässt den erlaubten Rücksetzer-Bereich; möglicher Trendbruch.'),depth,extreme};
  // Jede Berührung wird mit dem EMA-Band ihrer eigenen abgeschlossenen 1h-Kerze geprüft.
  const candidates=tail.map((c,j)=>{const x=frame.values[impulse.to.index+1+j];return {low:Math.min(x.ema21,x.ema50),high:Math.max(x.ema21,x.ema50),label:'1h EMA 21–50',touch:c};}).reverse();
  // Die vorhandene lokale KI-Zonenberechnung wird nur bei Bedarf und je 4h-Schluss einmal verwendet.
  if(!candidates.some(z=>z.touch.end>=impulse.knownAt&&overlap(z.touch,z)&&overlap(z.touch,impulse))){
    if(!prepared.zoneCache.has(trend.index)){const k=prepared.frames['4h'].rows.slice(Math.max(0,trend.index+1-PULLBACK.history),trend.index+1);prepared.zoneCache.set(trend.index,computeKiZones({candles:k,interval:'4h',ema200:trend.ema200}).zones.filter(z=>!z.broken));}
    candidates.push(...prepared.zoneCache.get(trend.index).filter(z=>z.side===(direction===1?'buy':'sell')).map(z=>({...z,label:'4h '+(direction===1?'Unterstützung':'Widerstand'),knownAt:trend.at})));
  }
  for(const z of candidates){
    const low=Math.max(impulse.low,z.low),high=Math.min(impulse.high,z.high);if(high<low)continue;
    const touch=(z.touch?[z.touch]:tail).filter(c=>c.end>=impulse.knownAt&&c.end>=(z.knownAt||0)&&overlap(c,{low,high})).at(-1);if(!touch||at-touch.end>PULLBACK.confirmationHours*H)continue;
    const impulseRows=frame.rows.slice(impulse.from.index,impulse.to.index+1),mean=a=>a.reduce((n,c)=>n+c.volume,0)/a.length,iv=mean(impulseRows),volumeRatio=iv>0?mean(tail)/iv:null;
    return {valid:true,reason:`${z.label} im Fibonacci-Rücksetzer berührt; 15m-Bestätigung abwarten.`,impulse,depth,extreme,touchAt:touch.end,knownAt:Math.max(impulse.knownAt,touch.end),zone:{low,high,knownAt:Math.max(impulse.knownAt,touch.end),time:impulse.to.time,labels:[z.label,'Fibonacci 38,2–61,8 %']},ema21:v.ema21,ema50:v.ema50,rsi:v.rsi,atr:v.atr,volumeRatio};
  }return {...empty('Fibonacci-Tiefe passt; Berührung von 1h-EMA-Band oder bestehender 4h-Zone fehlt.'),depth,extreme};
}
export function pullbackConfirmation(rows,values,index,direction) {
  const c=rows[index],p=rows[index-1],v=values[index];if(!p||!v)return {count:0,checks:[]};
  const body=Math.max(Math.abs(c.close-c.open),(c.high-c.low)*PULLBACK.bodyFloor),wick=direction===1?Math.min(c.open,c.close)-c.low:c.high-Math.max(c.open,c.close),opposite=direction===1?c.high-Math.max(c.open,c.close):Math.min(c.open,c.close)-c.low;
  const hammer=direction*(c.close-c.open)>0&&wick>=PULLBACK.hammerWick*body&&opposite<=PULLBACK.hammerOppositeWick*body,
    engulf=direction*(p.close-p.open)<0&&direction*(c.close-c.open)>0&&direction*(c.close-p.open)>=0&&direction*(c.open-p.close)<=0;
  const checks=[{label:'Hammer / Engulfing',ok:hammer||engulf},{label:'Schluss jenseits der EMA 21',ok:finite(v.ema21)&&direction*(c.close-v.ema21)>0},{label:'MACD-Histogramm dreht',ok:macdInDirection(values.slice(Math.max(0,index-5),index+1).map(v=>v.histogram),direction)===true}];
  return {count:checks.filter(c=>c.ok).length,checks};
}
export function evaluatePreparedPullback(prepared,{now,symbol,market='spot',historical=false}) {
  const f=prepared.frames['15m'],index=lastAt(f.rows,now),last=f.rows[index],blank={ready:false,analysisId:PULLBACK.id,symbol,market,direction:0,stage:0,phase:'waiting',signal:null};
  if(index+1<PULLBACK.setupWarmup)return {...blank,reason:'15m-Vorlauf fehlt.'};
  const at=last.end,trend=pullbackTrend(prepared,at),hi=prepared.frames['4h'],hour=prepared.frames['1h'],h=lastAt(hour.rows,at),four=lastAt(hi.rows,at);
  if(!trend.ready||h+1<PULLBACK.setupWarmup)return {...blank,reason:'Geschlossene 4h-/1h-Vorlaufkerzen fehlen.'};
  if((!historical&&at!==Math.floor(now/Q)*Q)||four<0||hi.rows[four].end!==Math.floor(at/H4)*H4||hour.rows[h].end!==Math.floor(at/H)*H)return {...blank,reason:'Neue Schlusskerzen fehlen; kein aktuelles Signal.'};
  const common={...blank,ready:true,at,expiresAt:at+Q,trend,bias:trend,direction:trend.direction,stage:trend.direction?1:0,
    emaSeries:hi.values.slice(Math.max(0,four-PULLBACK.structureBars),four+1).map(v=>({at:v.end,ema21:v.ema21,ema50:v.ema50,ema200:v.ema200}))};
  if(!trend.direction)return {...common,reason:trend.reason};
  const setup=pullbackSetup(prepared,at,trend);if(!setup.valid)return {...common,setup,reason:setup.reason};
  const confirmation=pullbackConfirmation(f.rows,f.values,index,trend.direction),watch={...common,setup,confirmation,stage:2,phase:'watch',reason:setup.reason};
  if(last.time<setup.knownAt||confirmation.count<PULLBACK.confirmations)return {...watch,reason:`Beobachten · ${confirmation.count}/${PULLBACK.confirmations} nötigen Bestätigungen im 15m. ${setup.reason}`};
  const direction=trend.direction,after=f.rows.slice(Math.max(0,lastAt(f.rows,setup.impulse.to.time+H,'time')),index+1),extreme=direction===1?Math.min(setup.extreme,...after.map(c=>c.low)):Math.max(setup.extreme,...after.map(c=>c.high)),entry=last.close,stop=extreme-direction*PULLBACK.stopBufferATR*setup.atr,risk=direction*(entry-stop),stopPct=risk/entry*100,target1=setup.impulse.target1,target2=setup.impulse.target2,rr=direction*(target1-entry)/risk,rr2=direction*(target2-entry)/risk;
  if(![entry,stop,target1,target2].every(v=>finite(v)&&v>0)||!(risk>0)||stopPct<PULLBACK.minStopPct||stopPct>PULLBACK.maxStopPct||rr<PULLBACK.minRR||!(direction*(target2-target1)>0))return {...watch,phase:'risk',reason:`Bestätigung vorhanden; CRV/Stop unzulässig (CRV ${finite(rr)?rr.toFixed(2):'–'}, Stop ${finite(stopPct)?stopPct.toFixed(2):'–'} %).`};
  const signal={analysisId:PULLBACK.id,analysisName:PULLBACK.name,version:PULLBACK.version,symbol,market,direction,side:direction===1?'long':'short',at,expiresAt:at+PULLBACK.holdMs,
    setupId:`impulse:${setup.impulse.from.time}:${setup.impulse.to.time}`,zone:setup.zone,impulse:setup.impulse,entry,stop,target1,target2,rr,rr2,setup:setup.zone.labels,confirmation:confirmation.checks,
    features:{adx:trend.adx,depthPct:setup.depth*100,rsi:setup.rsi,volumeRatio:setup.volumeRatio,atrPct:setup.atr/entry*100,keyDistanceATR:Math.abs(target1-entry)/setup.atr,hourUTC:new Date(at).getUTCHours(),symbol,direction},
    trendAnchorAt:prepared.frames['4h'].rows[0].time,
    atr15m:f.values[index].atr,chart:f.rows.slice(Math.max(0,index-59),index+1).map(c=>({time:c.time,open:c.open,high:c.high,low:c.low,close:c.close,volume:c.volume}))};
  return {...watch,stage:3,phase:'signal',signal,reason:`Signal · ${confirmation.count}/3 Bestätigungen; CRV ${rr.toFixed(2).replace('.',',')}.`};
}
export function evaluatePullback(input) { return evaluatePreparedPullback(preparePullback(input.candles,input.now),input); }

// Stop hat Vorrang bei unbekannter Reihenfolge innerhalb derselben OHLC-Kerze.
// Ziel 1 beendet das aktive Signal. Ziel 2 wird getrennt bis Stop/24h weiterbeobachtet.
export function pullbackOutcome(s,rows,now,trendAt=()=>s.direction,holdMs=PULLBACK.holdMs) {
  const risk=Math.abs(s.entry-s.stop),direction=s.direction,end=s.at+holdMs;
  let cursor=s.at,mfeR=0,maeR=0,first=null,target2At=null,followEnded=false;
  for(const c of rows){if(c.time<s.at||c.end>now||c.time>=end)continue;
    if(c.time!==cursor)return {status:first?.status||'gap',first,target2At,mfeR,maeR,checkedAt:cursor,complete:false,reason:'Kerzenlücke; kein Treffer erfunden.'};
    cursor=c.end;
    const stop=direction===1?c.low<=s.stop:c.high>=s.stop,t1=direction===1?c.high>=s.target1:c.low<=s.target1,t2=direction===1?c.high>=s.target2:c.low<=s.target2;
    const favorable=direction===1?c.high:c.low,adverse=direction===1?c.low:c.high;
    // Für den terminalen Stop-Bar keine günstige Reihenfolge der Dochte unterstellen.
    if(!first){const stopExit=direction===1?Math.min(s.stop,c.open):Math.max(s.stop,c.open),gain=direction*((stop?c.open:favorable)-s.entry)/risk;mfeR=Math.max(mfeR,stop?Math.max(0,gain):Math.min(s.rr,gain));maeR=Math.min(maeR,direction*((stop?stopExit:adverse)-s.entry)/risk);}
    if(stop){if(!first){const exit=direction===1?Math.min(s.stop,c.open):Math.max(s.stop,c.open);first={status:'stop',at:c.end,exit,grossR:direction*(exit-s.entry)/risk};}followEnded=true;}
    else {
      if(t1&&!first)first={status:'target1',at:c.end,exit:s.target1,grossR:s.rr};
      if(t2){target2At=c.end;followEnded=true;if(!first)first={status:'target2',at:c.end,exit:s.target2,grossR:s.rr2};}
    }
    if(trendAt(c.end)!==direction){if(!first)first={status:'trend',at:c.end,exit:c.close,grossR:direction*(c.close-s.entry)/risk};followEnded=true;}
    if(first&&['stop','trend'].includes(first.status))followEnded=true;
    if(followEnded)break;
  }
  if(cursor<Math.min(Math.floor(now/Q)*Q,end)&&!followEnded)return {status:first?.status||'gap',first,target2At,mfeR,maeR,checkedAt:cursor,complete:false,reason:'Ergebniskerzen fehlen; Beobachtung wird fortgesetzt.'};
  if(now>=end&&cursor>=end){if(!first){const c=rows.find(c=>c.end===end);if(c)first={status:'timeout',at:end,exit:c.close,grossR:direction*(c.close-s.entry)/risk};}followEnded=true;}
  return {status:first?.status||'open',first,target2At,mfeR,maeR,checkedAt:cursor,complete:followEnded,reason:first?PULLBACK_OUTCOME[first.status]:'Offenes Signal'};
}
export const pullbackEnded=r=>!!r?.outcome?.first;
export const pullbackEligible=(s,model,options)=>{const threshold=pullbackOptions(options).minProbability;return !threshold||finite(s?.probability)&&model?.valid===true&&s.probability*100>=threshold;};
