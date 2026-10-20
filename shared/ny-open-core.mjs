// 3.79.0: Startwerte zentral. Reine Signale/Modellwerte, keine Broker-Aufträge.
import { nyLearningFeatures } from './analysis-learning-features.mjs';
import { nyDay, nyParts, nyTime, nyTradingDay } from './ny-open-time.mjs';
import { detectFvgs } from './fvg.mjs';
import { musterCandles, musterIndicators } from './muster-bot-core.mjs';
import { topDownBias, analysisClosed, TOP_DOWN } from './analysis-top-down.mjs';
export const NY_OPEN = Object.freeze({ id:'ny-open', version:'ny-open-1', timezone:'America/New_York', rangeHour:9, rangeMinute:30, rangeMinutes:5, endHour:10, endMinute:30,
  // 3.86.0: wählbare Range-Länge ab 09:30 New York; das Signalfenster endet bei 5m/15m um 10:30, bei 1h um 11:30 (die 1h-Range endet selbst erst 10:30)
  ranges:Object.freeze({'5m':Object.freeze({minutes:5,endHour:10,endMinute:30}),'15m':Object.freeze({minutes:15,endHour:10,endMinute:30}),'1h':Object.freeze({minutes:60,endHour:11,endMinute:30})}), defaultRange:'5m',
  minRangePct:.15, bodyRatio:.60, atrPeriod:14, atrWarmup:30, fvgATR:.3, stopBufferATR:.1, rewardRisk:2, breakevenR:1, minStopPct:.15, maxStopPct:1,
  limitMinutes:15, holdMinutes:120, maxSignalsPerDay:1, signalAgeMs:60000, closeGraceMs:60000, requestSpacingMs:750,outcomeRetries:3,retryMaxMs:300000,
  futureShare:.25,futureSlotsMin:6,futureSlotsMax:60, backtestDays:60, feePct:.05, slippagePct:.02, cacheEntries:128, journalDays:90, maxCoins:30, pastShown:5 });
export const NY_JOURNAL_KEY='scalpdesk.idb.ny-open.journal.v1', NY_BACKTEST_KEY='scalpdesk.idb.ny-open.backtest.v1';
export const NY_DEFAULT_OPTIONS=Object.freeze({skipHolidays:true,biasFilter:true,limitEntry:false,breakeven:true});
export const NY_RANGE_IDS=Object.freeze(Object.keys(NY_OPEN.ranges));
// Die vier Schalter bleiben unverändert eigenständig (die Lernversion hängt an ihnen); Range-Länge und NY-Tag der Wahl stehen nur in den gespeicherten Einstellungen, und erst wenn gewählt wurde
export function nyOptions(value={}) { return Object.fromEntries(Object.entries(NY_DEFAULT_OPTIONS).map(([k,v])=>[k,typeof value?.[k]==='boolean'?value[k]:v])); }
export function nySettings(value={}) { const out=nyOptions(value);return NY_RANGE_IDS.includes(value?.rangeLength)&&/^\d{4}-\d{2}-\d{2}$/.test(value?.rangeDay||'')?{...out,rangeLength:value.rangeLength,rangeDay:value.rangeDay}:out; }
const nyRangeStart=at=>nyTime(nyDay(at),NY_OPEN.rangeHour,NY_OPEN.rangeMinute);
// Freischaltung nacheinander: 5m immer, 15m ab Ende der 5m-Range (09:35), 1h ab Ende der 15m-Range (09:45)
export function nyRangeUnlockAt(id,at){const i=NY_RANGE_IDS.indexOf(id);return i<=0?-Infinity:nyRangeStart(at)+NY_OPEN.ranges[NY_RANGE_IDS[i-1]].minutes*60000;}
export const nyRangeUnlocked=(id,at)=>NY_RANGE_IDS.includes(id)&&at>=nyRangeUnlockAt(id,at);
// Wirksame Länge: nur die am selben NY-Tag gewählte, sonst 5m; ist sie (noch) nicht freigeschaltet, die längste freigeschaltete kürzere
export function nyRangeChoice(options,at){const cfg=nySettings(options);let i=cfg.rangeDay===nyDay(at)?NY_RANGE_IDS.indexOf(cfg.rangeLength):0;while(i>0&&!nyRangeUnlocked(NY_RANGE_IDS[i],at))i--;return NY_RANGE_IDS[i];}
export const nyClock=at=>{const p=nyParts(at);return String(p.hour).padStart(2,'0')+':'+String(p.minute).padStart(2,'0');};
export const nyRangeText=session=>`${session.rangeLength} Range, ${nyClock(session.rangeStart)}–${nyClock(session.rangeEnd)}`;
export function nySession(at, options={}) { const cfg=nyOptions(options),day=nyDay(at),rangeStart=nyTime(day,NY_OPEN.rangeHour,NY_OPEN.rangeMinute),id=nyRangeChoice(options,at),def=NY_OPEN.ranges[id];return{day,rangeStart,rangeLength:id,rangeEnd:rangeStart+def.minutes*60000,baseRangeEnd:rangeStart+NY_OPEN.rangeMinutes*60000,atrFrom:rangeStart+NY_OPEN.rangeMinutes*60000-NY_OPEN.atrWarmup*60000,windowEnd:nyTime(day,def.endHour,def.endMinute),...nyTradingDay(day,cfg.skipHolidays)}; }
export const nyRecordKey=(symbol,day)=>`${symbol}|${day}`;
export const nyDailySignalKey=s=>`${NY_OPEN.id}|${s.symbol}|${s.nyDay}`;
// 3.86.0: Hoch/Tief aller drei Längen aus denselben geschlossenen 1m-Kerzen ab 09:30 (lückenlos, sonst fehlt die Länge) – Umschalten braucht keine Abfrage
export function nyRanges(candles,session,asOf) {
  const rows=musterCandles(candles||[],'1m',asOf).filter(c=>c.time>=session.rangeStart),out={};
  for(const [id,def] of Object.entries(NY_OPEN.ranges)){const end=session.rangeStart+def.minutes*60000,part=rows.filter(c=>c.end<=end);if(part.length!==def.minutes||part[0].time!==session.rangeStart)continue;
    const last=part.at(-1),high=Math.max(...part.map(c=>c.high)),low=Math.min(...part.map(c=>c.low));out[id]={time:session.rangeStart,end,high,low,close:last.close,pct:(high-low)/last.close*100,length:id};}
  return out;
}
export const nyRange=(candles,session,asOf,id=session.rangeLength)=>nyRanges(candles,session,asOf)[id]||null;
// Gespeicherte Ranges eines Protokolleintrags je Länge (ältere Einträge kennen nur die 5m-Range in `range`)
export const nyRecordRanges=r=>({...(r?.range&&!r.ranges?.[r.range.length||'5m']?{[r.range.length||'5m']:r.range}:{}),...(r?.ranges||{})});
export function evaluateNyOpen({candles={},now,symbol,market='spot',options={},record=null}) {
  const cfg=nyOptions(options),session=nySession(now,options), old=record?.day===session.day?record:null,label=nyRangeText(session);
  const common={ready:true,analysisId:NY_OPEN.id,symbol,market,session,at:Math.floor(now/60000)*60000,expiresAt:session.windowEnd+NY_OPEN.closeGraceMs,stage:0,direction:0,signal:null,range:null,ranges:{},phase:'before',reason:'NY-Range noch nicht geschlossen.'};
  if(!session.eligible)return{...common,phase:'closed-day',reason:session.reason};
  let found={},gap='';try{found=nyRanges(candles['1m'],session,now);}catch(e){gap=e.message;/* Lücke in den 1m-Kerzen: Länge entfällt, unten steht der Grund */}
  const ranges={...nyRecordRanges(old),...found},range=ranges[session.rangeLength]||null;
  // Ein bereits protokolliertes Signal bleibt festgeschrieben (ein Signal je Coin und Tag), auch wenn eine andere Range-Länge gewählt ist
  if(old?.signal){const other=(old.signal.rangeLength||NY_OPEN.defaultRange)!==session.rangeLength;return{...common,ranges,range,signal:old.signal,direction:old.signal.direction,stage:3,phase:'signal',reason:`Heutiges Signal bereits protokolliert${other?` (${old.signal.rangeLength||NY_OPEN.defaultRange} Range)`:''}; kein zweites Signal.`};}
  if(now<session.rangeEnd)return now<session.rangeStart?{...common,ranges}:{...common,ranges,phase:'forming',reason:`Range wird gebildet: ${label}.`};
  if(!range)return{...common,ranges,ready:false,phase:'data',reason:gap||`Die geschlossenen 1m-Kerzen der ${label} fehlen.`};
  const base={...common,range,ranges,stage:1,phase:'waiting',reason:'Range steht; bestätigten 1m-Ausbruch mit FVG abwarten.'};
  if(now>session.windowEnd+NY_OPEN.closeGraceMs)return{...base,phase:'closed',reason:'NY-Signalfenster beendet; heute keine neuen Signale.'};
  if(range.pct<NY_OPEN.minRangePct)return{...base,phase:'range-small',reason:`Range ${range.pct.toFixed(3)} %: Mindestbreite ${NY_OPEN.minRangePct} % nicht erreicht. Heute kein Signal.`};
  const asOf=Math.min(now,session.windowEnd),rows=musterCandles(candles['1m']||[],'1m',asOf);
  if(rows.length<NY_OPEN.atrPeriod+2)return{...base,ready:false,phase:'data',reason:'Geschlossene 1m-Kerzen einschließlich ATR-Vorlauf fehlen.'};
  if(rows[0].time>session.atrFrom)return{...base,ready:false,phase:'data',reason:'ATR-Vorlauf ist unvollständig.'};
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
      range,rangeLength:session.rangeLength,fvg,session,entry,stop,target:entry+dir*risk*NY_OPEN.rewardRisk,oneR:entry+dir*risk*NY_OPEN.breakevenR,rr:NY_OPEN.rewardRisk,riskPct,atr,entryMode:cfg.limitEntry?'limit':'market',limitUntil:cfg.limitEntry?c.end+NY_OPEN.limitMinutes*60000:null,options:cfg,
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
// 3.87.1: frühere Signale eines Coins aus dem Journal (neueste zuerst), ohne das gerade angezeigte – für die blassen Linien im Chart
export function nyPastSignals(journal,{symbol,market,exclude=null,limit=NY_OPEN.pastShown}={}){
  return Object.values(journal?.records||{})
    .filter(r=>r?.signal&&r.symbol===symbol&&r.market===market&&Number.isFinite(r.signal.at)&&r.signal.at!==exclude?.at)
    .sort((a,b)=>b.signal.at-a.signal.at).slice(0,limit)
    .map(r=>({day:r.day,signal:r.signal,outcome:r.outcome||null}));
}
export const nyTerminal=o=>!!o&&(['target','stop','breakeven','expired','open_2h'].includes(o.status)||o.status==='data-gap'&&o.final===true);
export function compactNySignal(s){const out={...s};delete out.chart;return out;}
export function nyRecord(result, previous={}, candles=[], now){const s=previous.signal||result.signal,ranges={...nyRecordRanges(previous),...result.ranges};return{...previous,day:result.session.day,symbol:result.symbol,market:result.market,range:result.range||previous.range||Object.values(ranges)[0],ranges,session:result.session,signal:s?compactNySignal(s):null,outcome:s?nyOutcome(s,candles,now):null,updatedAt:now};}
export function nyLiveRange(price,range){if(!(price>0)||!range)return{kind:'none',text:'Live-Kurs fehlt.'};const dir=price>range.high?1:price<range.low?-1:0,pct=dir?(price/(dir===1?range.high:range.low)-1)*100:0;return{kind:dir===1?'above':dir===-1?'below':'inside',direction:dir,text:dir?`${dir===1?'Über Range-Hoch':'Unter Range-Tief'} (${pct>=0?'+':'−'}${Math.abs(pct).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})} %)`:'Im Range'};}
