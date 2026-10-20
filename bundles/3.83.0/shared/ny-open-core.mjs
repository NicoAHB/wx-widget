// 3.79.0: Startwerte zentral. Reine Signale/Modellwerte, keine Broker-Aufträge.
import { nyLearningFeatures } from './analysis-learning-features.mjs';
import { nyDay, nyTime, nyTradingDay } from './ny-open-time.mjs';
import { detectFvgs } from './fvg.mjs';
import { musterCandles, musterIndicators } from './muster-bot-core.mjs';
import { topDownBias, analysisClosed, TOP_DOWN } from './analysis-top-down.mjs';
export const NY_OPEN = Object.freeze({ id:'ny-open', version:'ny-open-1', timezone:'America/New_York', rangeHour:9, rangeMinute:30, rangeMinutes:5, endHour:10, endMinute:30,
  minRangePct:.15, bodyRatio:.60, atrPeriod:14, atrWarmup:30, fvgATR:.3, stopBufferATR:.1, rewardRisk:2, breakevenR:1, minStopPct:.15, maxStopPct:1,
  limitMinutes:15, holdMinutes:120, maxSignalsPerDay:1, signalAgeMs:60000, closeGraceMs:60000, requestSpacingMs:750,outcomeRetries:3,retryMaxMs:300000,
  futureShare:.25,futureSlotsMin:6,futureSlotsMax:60, backtestDays:60, feePct:.05, slippagePct:.02, cacheEntries:128, journalDays:90, maxCoins:30 });
export const NY_JOURNAL_KEY='scalpdesk.idb.ny-open.journal.v1', NY_BACKTEST_KEY='scalpdesk.idb.ny-open.backtest.v1';
export const NY_DEFAULT_OPTIONS=Object.freeze({skipHolidays:true,biasFilter:true,limitEntry:false,breakeven:true});
export function nyOptions(value={}) { return Object.fromEntries(Object.entries(NY_DEFAULT_OPTIONS).map(([k,v])=>[k,typeof value?.[k]==='boolean'?value[k]:v])); }
export function nySession(at, options={}) { const day=nyDay(at), rangeStart=nyTime(day,NY_OPEN.rangeHour,NY_OPEN.rangeMinute);return{day,rangeStart,rangeEnd:rangeStart+NY_OPEN.rangeMinutes*60000,windowEnd:nyTime(day,NY_OPEN.endHour,NY_OPEN.endMinute),...nyTradingDay(day,nyOptions(options).skipHolidays)}; }
export const nyRecordKey=(symbol,day)=>`${symbol}|${day}`;
export const nyDailySignalKey=s=>`${NY_OPEN.id}|${s.symbol}|${s.nyDay}`;
export function nyRange(candles,session,asOf) {
  const rows=musterCandles(candles||[],'5m',asOf),c=rows.find(c=>c.time===session.rangeStart);
  return c ? {time:c.time,end:c.end,high:c.high,low:c.low,close:c.close,pct:(c.high-c.low)/c.close*100} : null;
}
export function evaluateNyOpen({candles={},now,symbol,market='spot',options={},record=null}) {
  const cfg=nyOptions(options),session=nySession(now,cfg), old=record?.day===session.day?record:null;
  const common={ready:true,analysisId:NY_OPEN.id,symbol,market,session,at:Math.floor(now/60000)*60000,expiresAt:session.windowEnd+NY_OPEN.closeGraceMs,stage:0,direction:0,signal:null,range:null,phase:'before',reason:'NY-Range noch nicht geschlossen.'};
  if(!session.eligible)return{...common,phase:'closed-day',reason:session.reason};
  if(now<session.rangeEnd)return common;
  const range=nyRange(candles['5m'],session,now)||old?.range;
  if(!range)return{...common,ready:false,phase:'data',reason:'Die geschlossene 09:30–09:35-NY-Kerze fehlt.'};
  const base={...common,range,stage:1,phase:'waiting',reason:'Range steht; bestätigten 1m-Ausbruch mit FVG abwarten.'};
  if(old?.signal)return{...base,signal:old.signal,direction:old.signal.direction,stage:3,phase:'signal',reason:'Heutiges Signal bereits protokolliert; kein zweites Signal.'};
  if(now>session.windowEnd+NY_OPEN.closeGraceMs)return{...base,phase:'closed',reason:'NY-Signalfenster beendet; heute keine neuen Signale.'};
  if(range.pct<NY_OPEN.minRangePct)return{...base,phase:'range-small',reason:`Range ${range.pct.toFixed(3)} %: Mindestbreite ${NY_OPEN.minRangePct} % nicht erreicht. Heute kein Signal.`};
  const asOf=Math.min(now,session.windowEnd),rows=musterCandles(candles['1m']||[],'1m',asOf);
  if(rows.length<NY_OPEN.atrPeriod+2)return{...base,ready:false,phase:'data',reason:'Geschlossene 1m-Kerzen einschließlich ATR-Vorlauf fehlen.'};
  if(rows[0].time>session.rangeEnd-NY_OPEN.atrWarmup*60000)return{...base,ready:false,phase:'data',reason:'ATR-Vorlauf ist unvollständig.'};
  const values=musterIndicators(rows,{atrPeriod:NY_OPEN.atrPeriod,emaPeriod:NY_OPEN.atrPeriod,volumePeriod:NY_OPEN.atrPeriod}), gaps=detectFvgs(rows), gapMap=new Map(gaps.map(g=>[g.i,g])), biases=new Map();
  let phase='waiting',reason=base.reason,bias=null;
  for(let i=1;i<rows.length;i++){
    const m=rows[i];if(m.time<session.rangeEnd||m.end>session.windowEnd)continue;
    const dir=m.close>range.high&&m.close>m.open?1:m.close<range.low&&m.close<m.open?-1:0;
    if(!dir)continue;
    if(!(m.high>m.low)||Math.abs(m.close-m.open)/(m.high-m.low)<NY_OPEN.bodyRatio){phase='weak';reason=`Ausbruchskörper kleiner als ${NY_OPEN.bodyRatio*100} % der Kerzenlänge.`;continue;}
    if(cfg.biasFilter){const key=Math.floor(m.time/14400000);if(!biases.has(key)){const high=analysisClosed(candles['4h']||[],'4h',m.time).slice(-TOP_DOWN.history);biases.set(key,high.length>=TOP_DOWN.warmup?topDownBias(high):null);}bias=biases.get(key);if(!bias){phase='bias-data';reason='Geschlossener 4h-Vorlauf für den Top-Down-Bias fehlt.';continue;}if(bias.direction!==dir){phase='bias';reason=bias.direction?'Ausbruch entgegen dem 4h-Bias – kein Signal.':'4h-Bias neutral – kein Signal.';continue;}}
    const c=rows[i+1],atr=values[i]?.atr;phase='fvg';reason='Starker Ausbruch; FVG-Bestätigung der Folgekerze fehlt.';
    if(!c||c.end>session.windowEnd||c.time!==m.end)continue;
    const gap=gapMap.get(i+1);if(!gap||gap.dir!==(dir===1?'bull':'bear')||!(atr>0)||gap.top-gap.bottom<NY_OPEN.fvgATR*atr){reason=`Kein gleichgerichtetes FVG mit mindestens ${NY_OPEN.fvgATR.toLocaleString('de-DE')} ATR.`;continue;}
    const fvg={low:gap.bottom,high:gap.top,time:rows[gap.start].time,knownAt:c.end},entry=cfg.limitEntry?(gap.bottom+gap.top)/2:c.close,stop=dir===1?m.low-NY_OPEN.stopBufferATR*atr:m.high+NY_OPEN.stopBufferATR*atr,risk=dir*(entry-stop),riskPct=risk/entry*100;
    if(!(entry>0&&stop>0&&risk>0)||riskPct<NY_OPEN.minStopPct||riskPct>NY_OPEN.maxStopPct){phase='risk';reason=`Stopabstand außerhalb ${NY_OPEN.minStopPct}–${NY_OPEN.maxStopPct} % – kein Signal.`;continue;}
    const signal={analysisId:NY_OPEN.id,analysisName:'NY Open Killzone',version:NY_OPEN.version,symbol,market,nyDay:session.day,setupId:'ny:'+session.day,side:dir===1?'long':'short',direction:dir,at:c.end,expiresAt:Math.min(c.end+NY_OPEN.signalAgeMs,session.windowEnd+NY_OPEN.closeGraceMs),
      range,fvg,session,entry,stop,target:entry+dir*risk*NY_OPEN.rewardRisk,oneR:entry+dir*risk*NY_OPEN.breakevenR,rr:NY_OPEN.rewardRisk,riskPct,atr,entryMode:cfg.limitEntry?'limit':'market',limitUntil:cfg.limitEntry?c.end+NY_OPEN.limitMinutes*60000:null,options:cfg,
      breakout:{time:m.time,end:m.end,open:m.open,close:m.close,high:m.high,low:m.low},bias:cfg.biasFilter?bias?.direction:null,chart:rows.slice(Math.max(0,i+2-60),i+2)};
    signal.learningFeatures=nyLearningFeatures(signal,rows,values,i);
    return{...base,stage:3,direction:dir,signal,bias,phase:'signal',reason:cfg.limitEntry?`FVG bestätigt; Limit in der FVG-Mitte gültig für ${NY_OPEN.limitMinutes} Minuten.`:'FVG bestätigt; Einstieg zum Schlusskurs der Bestätigungskerze.'};
  }
  return{...base,stage:['fvg','risk'].includes(phase)?2:1,phase,reason,bias};
}

export function nyOutcome(signal, candles, now, breakeven=signal.options?.breakeven!==false) {
  const s=signal,rows=musterCandles(candles||[],'1m',now).filter(c=>c.time>=s.at),risk=Math.abs(s.entry-s.stop);let filledAt=s.entryMode==='limit'?null:s.at,stop=s.stop,oneRAt=null,checkedAt=s.at,lastClose=null;
  const finish=(status,c,exit)=>({status,filledAt,checkedAt:c.end,at:c.end,exit,stop,oneRAt,grossR:s.direction*(exit-s.entry)/risk});
  for(const c of rows){
    if(filledAt!==null&&c.time>=filledAt+NY_OPEN.holdMinutes*60000)break;
    if(filledAt===null&&c.time>=s.limitUntil)break;
    if(c.time!==checkedAt)return{status:'data-gap',filledAt,checkedAt,stop,oneRAt,reason:'1m-Kerzenlücke; kein Ergebnis behauptet.'};checkedAt=c.end;lastClose=c.close;
    let justFilled=false,atOpen=false;
    if(filledAt===null){if(c.end>s.limitUntil)break;const touched=s.direction===1?c.low<=s.entry:c.high>=s.entry;if(!touched)continue;atOpen=s.direction===1?c.open<=s.entry:c.open>=s.entry;filledAt=c.time;justFilled=true;}
    const deadline=filledAt+NY_OPEN.holdMinutes*60000;if(c.time>=deadline)break;
    const stopHit=s.direction===1?c.low<=stop:c.high>=stop,targetHit=s.direction===1?c.high>=s.target:c.low<=s.target;
    if(stopHit){const gap=s.direction===1?c.open<stop:c.open>stop;return finish(stop===s.entry?'breakeven':'stop',c,gap?c.open:stop);}
    if(justFilled&&!atOpen)continue; // Bei Limit-Berührung innerhalb derselben Kerze keinen zeitlich unbekannten Zieltreffer behaupten.
    if(breakeven&&(s.direction===1?c.high>=s.oneR:c.low<=s.oneR)){oneRAt??=c.end;stop=s.entry;if(s.direction===1?c.low<=stop:c.high>=stop)return finish('breakeven',c,stop);}
    if(targetHit)return finish('target',c,s.target);
  }
  if(filledAt===null)return{status:now>=s.limitUntil?(checkedAt>=s.limitUntil?'expired':'data-gap'):'pending',filledAt,checkedAt,stop,oneRAt};
  const deadline=filledAt+NY_OPEN.holdMinutes*60000;
  if(now>=deadline&&checkedAt<deadline)return{status:'data-gap',filledAt,checkedAt,stop,oneRAt,reason:'Ergebnisfenster nicht vollständig geladen.'};
  // 3.83.0: nach Ablauf der Haltedauer zum Schlusskurs an der Frist bewerten (wie Top-Down „Zeit abgelaufen“) – vorher fehlten diese
  // Trades in Trefferquote, Ø-R und Lernen (rechtszensiert); die Kerzen bis zur Frist sind vollständig geprüft
  if(now>=deadline&&Number.isFinite(lastClose))return{status:'open_2h',filledAt,checkedAt,at:deadline,exit:lastClose,stop,oneRAt,grossR:s.direction*(lastClose-s.entry)/risk};
  return{status:now>=deadline?'open_2h':'open',filledAt,checkedAt,stop,oneRAt};
}
export const nyTerminal=o=>!!o&&(['target','stop','breakeven','expired','open_2h'].includes(o.status)||o.status==='data-gap'&&o.final===true);
export function compactNySignal(s){const out={...s};delete out.chart;return out;}
export function nyRecord(result, previous={}, candles=[], now){const s=previous.signal||result.signal;return{...previous,day:result.session.day,symbol:result.symbol,market:result.market,range:result.range||previous.range,session:result.session,signal:s?compactNySignal(s):null,outcome:s?nyOutcome(s,candles,now):null,updatedAt:now};}
export function nyLiveRange(price,range){if(!(price>0)||!range)return{kind:'none',text:'Live-Kurs fehlt.'};const dir=price>range.high?1:price<range.low?-1:0,pct=dir?(price/(dir===1?range.high:range.low)-1)*100:0;return{kind:dir===1?'above':dir===-1?'below':'inside',direction:dir,text:dir?`${dir===1?'Über Range-Hoch':'Unter Range-Tief'} (${pct>=0?'+':'−'}${Math.abs(pct).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})} %)`:'Im Range'};}
