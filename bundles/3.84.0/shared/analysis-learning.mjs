// Startwerte: separate Lerndaten je Analyse; die festen Handelsregeln bleiben unverändert.
import { trainTemporalLogit, predictLogit } from './signal-learning.mjs';
import { nyOutcome, NY_OPEN, nyOptions } from './ny-open-core.mjs';
import { nyParts } from './ny-open-time.mjs';
import { nyNetR } from './ny-open-backtest.mjs';
import { analysisClosed, TOP_DOWN } from './analysis-top-down.mjs';
export const ANALYSIS_LEARNING=Object.freeze({learningMin:100,retrainEvery:20,trainShare:.7,modelEpochs:350,learningRate:.08,regularization:.01,minClassSamples:5,brierImprovement:.001,modelVersions:5,
  topDownHoldMs:24*3600000,maxRecords:20000,suggestionMin:20,backtestDays:60,historyChunkDays:7,feePct:.05,slippagePct:.02,weekMs:7*86400000});
export const ANALYSIS_LEARNING_KEY='scalpdesk.idb.analysis-learning.v1';
export const LEARNING_IDS=Object.freeze(['top-down','ny-open']);
export const ANALYSIS_FEATURES=Object.freeze(['atrPct','riskPct','rr','zoneATR','entryZoneATR','confluence','rsi','macdATR','volumeRatio','rangePct','bodyRatio','fvgATR','biasAligned']);
const finite=Number.isFinite,clone=v=>globalThis.structuredClone(v);
export const learningData=v=>v?.version===1&&v.analyses&&typeof v.analyses==='object'?v:{version:1,analyses:{}};
export const learningKey=s=>`${s.version}|${s.symbol}|${s.market}|${s.direction}|${s.setupId}|${s.at}`;
// 3.83.0: NY learn-2 – Zeitüberschreitung nach 2 h zählt (wie Top-Down) als „Ziel nicht erreicht“ mit echtem R, Uhrzeit in New-York-Zeit
export function learningVersion(id,options={}){return id==='top-down'?`${TOP_DOWN.version}:learn-1`:`${NY_OPEN.version}:learn-2:${JSON.stringify(nyOptions(options))}`;}
export function learningVector(s,coins){const f=s.learningFeatures||{},v=[];for(const k of ANALYSIS_FEATURES)v.push(finite(f[k])?f[k]:0,finite(f[k])?0:1);const ny=s.analysisId===NY_OPEN.id?nyParts(s.at):null,hour=ny?ny.hour+ny.minute/60:new Date(s.at).getUTCHours();v.push(Math.sin(hour/24*2*Math.PI),Math.cos(hour/24*2*Math.PI),s.direction,s.market==='futures'?1:0);for(const coin of coins)v.push(s.symbol===coin?1:0);return v;}
// Ergebnisziel Top-Down: Ziel 1 vor dem ursprünglichen Stop, maximal 24 Stunden.
// Ziel 2 wird unabhängig weiterbeobachtet. Stop gewinnt bei unbekannter Intrabar-Reihenfolge.
export function topDownLearningOutcome(s,candles,now){const deadline=s.at+ANALYSIS_LEARNING.topDownHoldMs,rows=analysisClosed(candles,'15m',Math.min(now,deadline)).filter(c=>c.time>=s.at),risk=Math.abs(s.entry-s.stop);
  let checkedAt=s.at,first=null,second=null,mfeR=0,maeR=0;
  for(const c of rows){if(c.time!==checkedAt)return{status:'gap',checkedAt,first,second,complete:false,mfeR,maeR};checkedAt=c.end;
    const hitStop=s.direction===1?c.low<=s.stop:c.high>=s.stop,t1=s.direction===1?c.high>=s.target1:c.low<=s.target1,t2=s.direction===1?c.high>=s.target2:c.low<=s.target2,
      exit=hitStop?(s.direction===1?Math.min(c.open,s.stop):Math.max(c.open,s.stop)):null,
      done=(status,price)=>({status,at:c.end,exit:price,grossR:s.direction*(price-s.entry)/risk});
    mfeR=Math.max(mfeR,s.direction*((s.direction===1?c.high:c.low)-s.entry)/risk);maeR=Math.min(maeR,s.direction*((s.direction===1?c.low:c.high)-s.entry)/risk);
    if(!first){if(hitStop)first=done('stop',exit);else if(t1)first=done('target1',s.target1);}
    if(!second){if(hitStop)second=done('stop',exit);else if(t2)second=done('target2',s.target2);}
    if(second)return{status:second.status,checkedAt,first,second,complete:true,mfeR,maeR};
  }
  if(now>=deadline&&checkedAt<deadline)return{status:'gap',checkedAt,first,second,complete:false,mfeR,maeR};
  if(now>=deadline){const c=rows.at(-1),o={status:'timeout',at:deadline,exit:c.close,grossR:s.direction*(c.close-s.entry)/risk};first??=o;second??=o;}
  return{status:second?.status||'open',checkedAt,first,second,complete:!!second,mfeR,maeR};
}
export function nyLearningOutcome(s,rows,now){const fixed=nyOutcome(s,rows,now,false),breakeven=nyOutcome(s,rows,now,true),current=s.options?.breakeven!==false?breakeven:fixed;
  const finished=['target','stop','breakeven','expired','open_2h'].includes(current.status);
  return{status:current.status,first:nyFirst(current),complete:finished,fixed,breakeven,checkedAt:current.checkedAt};}
// Erstes Ergebnis für das Lernen: Ziel → target1, Stop/Einstieg wie gemeldet, nach 2 h offen → timeout mit dem Schlusskurs an der Frist
// (3.83.0, wie Top-Down; Label „Ziel nicht erreicht“, kein erfundener Verlust – das R-Ergebnis ist das tatsächliche)
export function nyFirst(o){if(['target','stop','breakeven'].includes(o.status))return{...o,status:o.status==='target'?'target1':o.status};return o.status==='open_2h'&&finite(o.grossR)?{...o,status:'timeout'}:null;}
export function compactLearningSignal(s){const out=clone(s);delete out.chart;delete out.components;if(out.zone?.components)delete out.zone.components;return out;}
export function mergeLearningData(a,b){a=learningData(a);b=learningData(b);const analyses={...a.analyses};for(const id of LEARNING_IDS){const old=a.analyses[id]||{},next=b.analyses[id];if(!next)continue;const records={...old.records};
    for(const [key,r]of Object.entries(next.records||{})){const prev=records[key];if(!prev||prev.source!=='live'&&r.source==='live'||prev.source===r.source&&(!prev.outcome?.complete||r.outcome?.complete)&&(r.updatedAt||0)>=(prev.updatedAt||0))records[key]=r;}
    const sorted=Object.entries(records).sort((a,b)=>a[1].signal.at-b[1].signal.at),open=sorted.filter(([,r])=>!r.outcome?.complete),done=sorted.filter(([,r])=>r.outcome?.complete).slice(-Math.max(0,ANALYSIS_LEARNING.maxRecords-open.length));
    const models={...old.models};for(const [version,model]of Object.entries(next.models||{}))if(!models[version]||(model.trainedAt||0)>=(models[version].trainedAt||0))models[version]=model;
    analyses[id]={...old,...next,models,records:Object.fromEntries([...done,...open])};
  }return{version:1,analyses};}
export function learningRecords(data,id,options={},asOf=Infinity){const version=learningVersion(id,options);return Object.values(learningData(data).analyses[id]?.records||{}).filter(r=>r.signal.learningVersion===version&&r.signal.at<=asOf);}
export function completedLearning(records,asOf=Infinity){return records.filter(r=>r.signal.learningFeatures&&r.outcome?.first&&r.outcome.status!=='gap'&&r.outcome.status!=='data-gap'&&finite(r.outcome.first.grossR)&&r.outcome.first.at<=asOf).sort((a,b)=>a.signal.at-b.signal.at||a.signal.symbol.localeCompare(b.signal.symbol));}
const label=r=>r.outcome.first.status==='target1'?1:0;
export function trainAnalysis(records,previous={},now=Date.now(),force=false){const rows=completedLearning(records,now);const version=records[0]?.signal.learningVersion||previous.version;
  // Ein vorheriges Modell mit anderen Options-/Regelversionen niemals übernehmen.
  return trainTemporalLogit({rows,previous:previous.version===version?previous:{},now,force,config:ANALYSIS_LEARNING,version,vector:learningVector,label,idPrefix:'analysis-logit'});}
export function analysisPrediction(s,records,state={}){const rows=completedLearning(records,s.at),m=state.active,valid=rows.length>=ANALYSIS_LEARNING.learningMin&&m?.valid&&m.version===s.learningVersion&&m.trainThrough<s.at&&m.validatedThrough<s.at;
  const probability=valid?predictLogit(m,learningVector(s,m.coins)):null,wins=rows.filter(r=>label(r)&&r.signal.direction===s.direction).map(r=>(r.outcome.first.at-r.signal.at)/60000).sort((a,b)=>a-b),expectedMinutes=wins.length?wins[Math.floor(wins.length/2)]:null;
  return{probability,probabilityText:finite(probability)?`${Math.round(probability*100)} %`:`Lernphase (${rows.length}/${ANALYSIS_LEARNING.learningMin})`,modelId:valid?m.id:null,learningCount:rows.length,expectedMinutes,durationSource:wins.length?'Median abgeschlossener Zielfälle':null};}
export function analysisLearningStatistics(records){const done=completedLearning(records),ratio=(a,test)=>a.length?a.filter(test).length/a.length*100:null,net=(r,o=r.outcome.first)=>nyNetR(r.signal,o,ANALYSIS_LEARNING.feePct,ANALYSIS_LEARNING.slippagePct),mean=a=>a.length?a.reduce((n,r)=>n+net(r),0)/a.length:null;
  const t2=records.filter(r=>r.outcome?.complete&&r.outcome.second);
  return{signals:records.length,completed:done.length,winrate:ratio(done,label),averageR:mean(done),averageR2:t2.length?t2.reduce((n,r)=>n+net(r,r.outcome.second),0)/t2.length:null,winrate2:ratio(t2,r=>r.outcome.second.status==='target2'),open:records.filter(r=>!r.outcome?.complete).length,
    censored:records.filter(r=>r.outcome?.status==='expired'||r.outcome?.status==='open_2h'&&!r.outcome.first).length,gaps:records.filter(r=>['gap','data-gap'].includes(r.outcome?.status)).length,
    coins:[...new Set(records.map(r=>r.signal.symbol))].sort().map(symbol=>{const a=done.filter(r=>r.signal.symbol===symbol);return{symbol,count:a.length,winrate:ratio(a,label),averageR:mean(a)};}),
    exits:['fixed','breakeven'].map(policy=>{const a=records.filter(r=>finite(r.outcome?.[policy]?.grossR));return{policy,count:a.length,averageR:a.length?a.reduce((n,r)=>n+net(r,r.outcome[policy]),0)/a.length:null};})};}
export function learningSuggestions(records,previous={},now=Date.now()){if(previous.at&&now-previous.at<ANALYSIS_LEARNING.weekMs)return previous;const done=completedLearning(records,now),groups=[['Long',r=>r.signal.direction===1],['Short',r=>r.signal.direction===-1],['CRV unter 2',r=>r.signal.rr<2],['CRV ab 2',r=>r.signal.rr>=2],['Zone bis 1 ATR',r=>r.signal.learningFeatures.zoneATR<=1],['Zone über 1 ATR',r=>r.signal.learningFeatures.zoneATR>1],['Mindestens 3 Bausteine',r=>r.signal.learningFeatures.confluence>=3],['Einstieg bis 1 ATR von der Zone',r=>r.signal.learningFeatures.entryZoneATR<=1],['Einstieg weiter als 1 ATR von der Zone',r=>r.signal.learningFeatures.entryZoneATR>1],['Order-Block-Zone',r=>r.signal.zone?.kinds?.includes('order-block')],['FVG-Zone',r=>r.signal.zone?.kinds?.includes('fvg')||!!r.signal.fvg],['Supply-/Demand-Zone',r=>r.signal.zone?.kinds?.includes('supply-demand')],['Ausbruchskörper ab 80 %',r=>r.signal.learningFeatures.bodyRatio>=.8],...new Set(done.map(r=>r.signal.symbol))].map(g=>typeof g==='string'?[g,r=>r.signal.symbol===g]:g);
  return{at:now,items:groups.map(([name,filter])=>{const sample=done.filter(filter);return{name,count:sample.length,statistics:analysisLearningStatistics(sample)};}).filter(g=>g.count>=ANALYSIS_LEARNING.suggestionMin).map(g=>({label:`${g.name}: ${g.count} Fälle · Ziel vor Stop ${Math.round(g.statistics.winrate)} % · Ø ${g.statistics.averageR.toFixed(2).replace('.',',')} R netto. Vergleichshinweis, keine automatische Änderung.`}))};}
export function validateLearningData(v){if(v?.version!==1||!v.analyses||typeof v.analyses!=='object')throw Error('Ungültiger Analyse-Lernstand.');for(const [id,group]of Object.entries(v.analyses)){if(!LEARNING_IDS.includes(id)||!group||!group.records||typeof group.records!=='object'||Object.keys(group.records).length>ANALYSIS_LEARNING.maxRecords)throw Error('Ungültiges Lernarchiv.');for(const [key,r]of Object.entries(group.records)){const s=r?.signal;if(!s||s.analysisId!==id||key!==learningKey(s)||!s.learningVersion||typeof s.learningVersion!=='string'||s.learningVersion.length>300||!s.learningFeatures||Object.values(s.learningFeatures).some(v=>v!==null&&!finite(v))||!/^[A-Z0-9]{2,20}USDT$/.test(s.symbol)||!['spot','futures'].includes(s.market)||![1,-1].includes(s.direction)||!Number.isSafeInteger(s.at)||![s.entry,s.stop,id==='ny-open'?s.target:s.target1].every(x=>finite(x)&&x>0)||s.direction*(s.entry-s.stop)<=0||!r.outcome)throw Error('Ungültiges Lernsignal.');const o=r.outcome.first;if(o&&(!Number.isSafeInteger(o.at)||o.at<=s.at||!finite(o.grossR)||!(o.exit>0)))throw Error('Ungültiges Lernergebnis.');}
    if(group.models&&(typeof group.models!=='object'||Array.isArray(group.models)||Object.keys(group.models).length>32))throw Error('Ungültige Modellkohorten.');
    const variants=[group.model,...Object.values(group.models||{})].filter(Boolean);
    for(const m of variants.flatMap(v=>[v.active,...v.versions||[]]).filter(Boolean)){const width=2*ANALYSIS_FEATURES.length+4+m.coins?.length;if(!Array.isArray(m.coins)||m.coins.length>30||![m.weights,m.mean,m.scale].every(a=>Array.isArray(a)&&a.length<128&&a.every(finite))||m.mean.length!==width||m.scale.length!==width||m.weights.length!==width+1||m.scale.some(n=>n<=0)||!finite(m.trainThrough)||!finite(m.validatedThrough)||m.trainThrough>=m.testFrom)throw Error('Ungültiges Analyse-Lernmodell.');}}
  return v;}
