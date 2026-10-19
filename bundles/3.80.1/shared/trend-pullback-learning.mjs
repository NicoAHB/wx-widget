// Lokale logistische Regression. Die festen Signalregeln werden niemals verändert.
import { PULLBACK } from './trend-pullback-core.mjs';
import { nyNetR } from './ny-open-backtest.mjs';
export const PULLBACK_FEATURES=Object.freeze(['adx','depthPct','rsi','volumeRatio','atrPct','keyDistanceATR']);
const finite=Number.isFinite,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),sigmoid=v=>1/(1+Math.exp(-clamp(v,-35,35)));
const completed=records=>records.filter(r=>r.signal?.version===PULLBACK.version&&r.outcome?.first&&r.outcome.status!=='gap'&&finite(r.outcome.first.grossR)).sort((a,b)=>a.signal.at-b.signal.at||a.signal.symbol.localeCompare(b.signal.symbol));
export function pullbackVector(s,coins) {
  const f=s.features||{},v=[];
  for(const key of PULLBACK_FEATURES){v.push(finite(f[key])?f[key]:0,finite(f[key])?0:1);}
  const hour=finite(f.hourUTC)?f.hourUTC:0;v.push(Math.sin(hour/24*2*Math.PI),Math.cos(hour/24*2*Math.PI),s.direction);
  for(const coin of coins)v.push(s.symbol===coin?1:0);return v;
}
const outcomeY=r=>r.outcome.first.status==='target1'||r.outcome.first.status==='target2'?1:0;
function predictRaw(model,s){const x=pullbackVector(s,model.coins);return sigmoid(model.weights[0]+x.reduce((sum,v,i)=>sum+model.weights[i+1]*clamp((v-model.mean[i])/model.scale[i],-10,10),0));}
function brier(rows,predict){return rows.reduce((n,r)=>n+(predict(r.signal)-outcomeY(r))**2,0)/rows.length;}
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
  const rows=completed(records),base={...previous,version:PULLBACK.version},newest=rows.at(-1)?.signal.at||0;
  if(!force&&previous.lastCount!=null&&rows.length-previous.lastCount<PULLBACK.retrainEvery&&!(previous.lastCount<PULLBACK.learningMin&&rows.length>=PULLBACK.learningMin))return previous;
  const result={...base,lastCount:rows.length,trainedAt:now,latestSample:newest,active:previous.active||null,versions:[...(previous.versions||[])],reason:''};
  if(rows.length<PULLBACK.learningMin)return {...result,reason:`Mindestens ${PULLBACK.learningMin} abgeschlossene Signale nötig.`};
  const split=Math.floor(rows.length*PULLBACK.trainShare),cut=rows[split].signal.at,train=rows.filter(r=>r.signal.at<cut&&r.outcome.first.at<cut),test=rows.filter(r=>r.signal.at>=cut);
  const counts=sample=>[sample.filter(r=>outcomeY(r)).length,sample.filter(r=>!outcomeY(r)).length];
  if(!train.length||!test.length||[...counts(train),...counts(test)].some(n=>n<PULLBACK.minClassSamples))return {...result,active:null,reason:'Zeitlich getrennter Test enthält noch zu wenige Gewinne oder Verluste.'};
  const coins=[...new Set(train.map(r=>r.signal.symbol))].sort(),vectors=train.map(r=>pullbackVector(r.signal,coins)),width=vectors[0].length,
    mean=Array.from({length:width},(_,i)=>vectors.reduce((n,x)=>n+x[i],0)/vectors.length),scale=mean.map((m,i)=>Math.sqrt(vectors.reduce((n,x)=>n+(x[i]-m)**2,0)/vectors.length)||1),xs=vectors.map(x=>x.map((v,i)=>clamp((v-mean[i])/scale[i],-10,10))),ys=train.map(outcomeY),rate=ys.reduce((n,y)=>n+y,0)/ys.length,weights=Array(width+1).fill(0);
  weights[0]=Math.log(rate/(1-rate));
  for(let epoch=0;epoch<PULLBACK.modelEpochs;epoch++){
    const gradient=Array(width+1).fill(0);
    for(let i=0;i<xs.length;i++){const x=xs[i],error=sigmoid(weights[0]+x.reduce((n,v,j)=>n+v*weights[j+1],0))-ys[i];gradient[0]+=error;for(let j=0;j<width;j++)gradient[j+1]+=error*x[j];}
    for(let j=0;j<weights.length;j++)weights[j]-=PULLBACK.learningRate*(gradient[j]/xs.length+(j?PULLBACK.regularization*weights[j]:0));
  }
  const candidate={id:`tp-logit:${now}:${rows.length}`,version:PULLBACK.version,at:now,trainThrough:Math.max(...train.map(r=>r.outcome.first.at)),validatedThrough:Math.max(...test.map(r=>r.outcome.first.at)),testFrom:cut,trainN:train.length,testN:test.length,coins,mean,scale,weights,rate,valid:false},baseline=brier(test,()=>rate),score=brier(test,s=>predictRaw(candidate,s));
  candidate.brier=score;candidate.baselineBrier=baseline;candidate.valid=score+PULLBACK.brierImprovement<baseline;
  const old=previous.active,oldCanCompare=old?.valid&&old.version===PULLBACK.version&&old.trainThrough<cut&&old.weights?.length===old.mean?.length+1,
    oldScore=oldCanCompare?brier(test,s=>predictRaw(old,s)):Infinity;
  result.versions=[...result.versions,candidate].slice(-PULLBACK.modelVersions);
  if(oldCanCompare&&oldScore<=score&&oldScore+PULLBACK.brierImprovement<baseline){result.active={...old,brier:oldScore,baselineBrier:baseline,testFrom:cut,testN:test.length,validatedThrough:candidate.validatedThrough};result.reason='Neue Version im selben Prüffenster schlechter; bisherige Version beibehalten.';}
  else {result.active=candidate.valid?candidate:null;result.reason=candidate.valid?'Auf den neuesten 30 % besser als die konstante Trainings-Trefferquote.':'Kein nachgewiesener Vorteil gegenüber der konstanten Trefferquote; Lernphase.';}
  result.validation={from:cut,train:train.length,test:test.length,brier:score,baselineBrier:baseline,oldBrier:finite(oldScore)?oldScore:null};return result;
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
