// Gemeinsamer lokaler Lernkern. Training und Prüfung sind zeitlich getrennt.
const finite=Number.isFinite,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),sigmoid=v=>1/(1+Math.exp(-clamp(v,-35,35)));
export function predictLogit(model,x){return sigmoid(model.weights[0]+x.reduce((sum,v,i)=>sum+model.weights[i+1]*clamp((v-model.mean[i])/model.scale[i],-10,10),0));}
function brier(rows,predict,label){return rows.reduce((n,r)=>n+(predict(r.signal)-label(r))**2,0)/rows.length;}
export function trainTemporalLogit({rows,previous={},now=Date.now(),force=false,config,version,vector,label,idPrefix}) {
  const base={...previous,version},newest=rows.at(-1)?.signal.at||0;
  if(!force&&previous.lastCount!=null&&rows.length-previous.lastCount<config.retrainEvery&&!(previous.lastCount<config.learningMin&&rows.length>=config.learningMin))return previous;
  const result={...base,lastCount:rows.length,trainedAt:now,latestSample:newest,active:previous.active||null,versions:[...(previous.versions||[])],reason:''};
  if(rows.length<config.learningMin)return {...result,reason:`Mindestens ${config.learningMin} abgeschlossene Signale nötig.`};
  const split=Math.floor(rows.length*config.trainShare),cut=rows[split].signal.at,train=rows.filter(r=>r.signal.at<cut&&r.outcome.first.at<cut),test=rows.filter(r=>r.signal.at>=cut);
  const counts=sample=>[sample.filter(r=>label(r)).length,sample.filter(r=>!label(r)).length];
  if(!train.length||!test.length||[...counts(train),...counts(test)].some(n=>n<config.minClassSamples))return {...result,active:null,reason:'Zeitlich getrennter Test enthält noch zu wenige Gewinne oder Verluste.'};
  const coins=[...new Set(train.map(r=>r.signal.symbol))].sort(),vectors=train.map(r=>vector(r.signal,coins)),width=vectors[0].length,
    mean=Array.from({length:width},(_,i)=>vectors.reduce((n,x)=>n+x[i],0)/vectors.length),scale=mean.map((m,i)=>Math.sqrt(vectors.reduce((n,x)=>n+(x[i]-m)**2,0)/vectors.length)||1),xs=vectors.map(x=>x.map((v,i)=>clamp((v-mean[i])/scale[i],-10,10))),ys=train.map(label),rate=ys.reduce((n,y)=>n+y,0)/ys.length,weights=Array(width+1).fill(0);
  weights[0]=Math.log(rate/(1-rate));
  for(let epoch=0;epoch<config.modelEpochs;epoch++){
    const gradient=Array(width+1).fill(0);
    for(let i=0;i<xs.length;i++){const x=xs[i],error=sigmoid(weights[0]+x.reduce((n,v,j)=>n+v*weights[j+1],0))-ys[i];gradient[0]+=error;for(let j=0;j<width;j++)gradient[j+1]+=error*x[j];}
    for(let j=0;j<weights.length;j++)weights[j]-=config.learningRate*(gradient[j]/xs.length+(j?config.regularization*weights[j]:0));
  }
  const candidate={id:`${idPrefix}:${now}:${rows.length}`,version:version,at:now,trainThrough:Math.max(...train.map(r=>r.outcome.first.at)),validatedThrough:Math.max(...test.map(r=>r.outcome.first.at)),testFrom:cut,trainN:train.length,testN:test.length,coins,mean,scale,weights,rate,valid:false},baseline=brier(test,()=>rate,label),score=brier(test,s=>predictLogit(candidate,vector(s,candidate.coins)),label);
  candidate.brier=score;candidate.baselineBrier=baseline;candidate.valid=score+config.brierImprovement<baseline;
  const old=previous.active,oldCanCompare=old?.valid&&old.version===version&&old.trainThrough<cut&&old.weights?.length===old.mean?.length+1,
    oldScore=oldCanCompare?brier(test,s=>predictLogit(old,vector(s,old.coins)),label):Infinity;
  result.versions=[...result.versions,candidate].slice(-config.modelVersions);
  if(oldCanCompare&&oldScore<=score&&oldScore+config.brierImprovement<baseline){result.active={...old,brier:oldScore,baselineBrier:baseline,testFrom:cut,testN:test.length,validatedThrough:candidate.validatedThrough};result.reason='Neue Version im selben Prüffenster schlechter; bisherige Version beibehalten.';}
  else {result.active=candidate.valid?candidate:null;result.reason=candidate.valid?'Auf den neuesten 30 % besser als die konstante Trainings-Trefferquote.':'Kein nachgewiesener Vorteil gegenüber der konstanten Trefferquote; Lernphase.';}
  result.validation={from:cut,train:train.length,test:test.length,brier:score,baselineBrier:baseline,oldBrier:finite(oldScore)?oldScore:null};return result;
}
