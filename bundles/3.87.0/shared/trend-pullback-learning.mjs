// Lokale logistische Regression. Die festen Signalregeln werden niemals verändert.
import { PULLBACK } from './trend-pullback-core.mjs';
import { trainTemporalLogit, predictLogit } from './signal-learning.mjs';
import { nyNetR } from './ny-open-backtest.mjs';
export const PULLBACK_FEATURES=Object.freeze(['adx','depthPct','rsi','volumeRatio','atrPct','keyDistanceATR']);
const finite=Number.isFinite,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const completed=records=>records.filter(r=>r.signal?.version===PULLBACK.version&&r.outcome?.first&&r.outcome.status!=='gap'&&finite(r.outcome.first.grossR)).sort((a,b)=>a.signal.at-b.signal.at||a.signal.symbol.localeCompare(b.signal.symbol));
export function pullbackVector(s,coins) {
  const f=s.features||{},v=[];
  for(const key of PULLBACK_FEATURES){v.push(finite(f[key])?f[key]:0,finite(f[key])?0:1);}
  const hour=finite(f.hourUTC)?f.hourUTC:0;v.push(Math.sin(hour/24*2*Math.PI),Math.cos(hour/24*2*Math.PI),s.direction);
  for(const coin of coins)v.push(s.symbol===coin?1:0);return v;
}
const outcomeY=r=>r.outcome.first.status==='target1'||r.outcome.first.status==='target2'?1:0;
// 3.84.0: abgeschlossene Signale mit der beim Signal gespeicherten Wahrscheinlichkeit (für die Kalibrierung)
export const pullbackCalibrationSamples=records=>completed(records).filter(r=>finite(r.signal.probability)).map(r=>({p:r.signal.probability,y:outcomeY(r),live:r.source==='live'}));
function predictRaw(model,s){return predictLogit(model,pullbackVector(s,model.coins));}
export function pullbackLearningStatus(records,model={}) {
  const done=completed(records),valid=done.length>=PULLBACK.learningMin&&model.active?.valid===true&&model.active.version===PULLBACK.version;
  return {count:done.length,minimum:PULLBACK.learningMin,valid,model:valid?model.active:null,text:valid?'Modell geprüft':`Lernphase (${done.length}/${PULLBACK.learningMin})`};
}
export function pullbackPrediction(s,records,state={}) {
  const info=pullbackLearningStatus(records,state),candidate=info.model,model=candidate&&candidate.trainThrough<=s.at&&(candidate.validatedThrough||0)<=s.at?candidate:null,p=model?predictRaw(model,s):null;
  // Die angezeigte Version ist ausschließlich auf älteren Daten trainiert; keine nachträglich "passenden" Trainingslabels.
  const eligible=completed(records).filter(r=>r.signal.direction===s.direction&&r.outcome.first.at<=s.at&&['target1','target2'].includes(r.outcome.first.status)),durations=eligible.map(r=>(r.outcome.first.at-r.signal.at)/60000).sort((a,b)=>a-b);
  const median=durations.length?(durations[Math.floor((durations.length-1)/2)]+durations[Math.ceil((durations.length-1)/2)])/2:null,
    estimate=clamp(Math.ceil(Math.abs(s.target1-s.entry)/Math.max(s.atr15m||0,Number.MIN_VALUE)),PULLBACK.minEstimateBars,PULLBACK.maxEstimateBars)*15;
  return {probability:finite(p)?p:null,probabilityText:finite(p)?`${Math.round(p*100)} %`:info.text,modelId:model?.id||null,
    expectedMinutes:median??estimate,durationSource:median===null?'ATR-Schätzung':'Median abgeschlossener Ziel-1-Fälle',learningCount:info.count};
}
export function trainPullback(records,previous={},now=Date.now(),force=false) {
  return trainTemporalLogit({rows:completed(records),previous,now,force,config:PULLBACK,version:PULLBACK.version,vector:pullbackVector,label:outcomeY,idPrefix:'tp-logit'});
}
export function pullbackStatistics(records,fee=PULLBACK.feePct,slippage=PULLBACK.slippagePct) {
  const done=completed(records).sort((a,b)=>a.outcome.first.at-b.outcome.first.at),t2=records.filter(r=>r.outcome?.complete&&r.outcome.status!=='gap'),rates=a=>a.length?a.filter(r=>outcomeY(r)).length/a.length*100:null;
  let losing=0,maxLosses=0,sum=0;for(const r of done){const n=nyNetR(r.signal,r.outcome.first,fee,slippage);sum+=n;losing=n<0?losing+1:0;maxLosses=Math.max(maxLosses,losing);}
  const coins=[...new Set(records.map(r=>r.signal.symbol))].sort().map(symbol=>{const a=done.filter(r=>r.signal.symbol===symbol);return{symbol,count:a.length,winrate:rates(a),averageR:a.length?a.reduce((n,r)=>n+nyNetR(r.signal,r.outcome.first,fee,slippage),0)/a.length:null};});
  return {signals:records.length,completed:done.length,winrate1:rates(done),winrate2:t2.length?t2.filter(r=>r.outcome.target2At).length/t2.length*100:null,target2Completed:t2.length,
    averageR:done.length?sum/done.length:null,netR:sum,maxLosses,open:records.filter(r=>!r.outcome?.first).length,gaps:records.filter(r=>r.outcome?.status==='gap'||r.outcome?.complete===false&&r.outcome?.status!=='open').length,coins};
}
export function pullbackSuggestions(records,previous={},now=Date.now()) {
  if(previous.at&&now-previous.at<PULLBACK.weekMs)return previous;
  const done=completed(records),groups=[['Rücksetzer 38–50 %',r=>r.signal.features.depthPct<50],['Rücksetzer 50–62 %',r=>r.signal.features.depthPct>=50],...new Set(done.map(r=>r.signal.symbol))].map(g=>typeof g==='string'?[g,r=>r.signal.symbol===g]:g),items=[];
  for(const [label,filter]of groups){const sample=done.filter(filter);if(sample.length<PULLBACK.suggestionMin)continue;const mean=sample.reduce((n,r)=>n+r.outcome.first.grossR,0)/sample.length;items.push({id:`${Math.floor(now/PULLBACK.weekMs)}:${label}`,label:`${label}: ${sample.length} Fälle, Ø ${mean.toFixed(2).replace('.',',')} R brutto. Nur Prüfvorschlag; keine Regeländerung.`,confirmed:false});}
  return {at:now,items};
}
