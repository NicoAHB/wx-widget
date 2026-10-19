// Ein gemeinsamer Lern-Lebenszyklus für Top-Down und NY Open. Kein eigener Telegram-Sender.
import { ANALYSIS_LEARNING, ANALYSIS_LEARNING_KEY, LEARNING_IDS, learningData, mergeLearningData, learningRecords, learningKey, learningVersion, compactLearningSignal, topDownLearningOutcome, nyLearningOutcome, analysisPrediction, trainAnalysis, learningSuggestions } from './analysis-learning.mjs';
import { TOP_DOWN } from './analysis-top-down.mjs';
import { runAnalysisLearningBacktest, nyLearningOutcomeFromTrade } from './analysis-learning-history.mjs';
import { pullbackWorkerJob } from './trend-pullback-backtest.mjs';
const Q=900000;
export function createAnalysisLearning({read,write,now=Date.now,available=()=>true,history,symbols=()=>[],options=()=>({}),changed=()=>{},log=()=>{},workerFactory}){
  const state={training:new Set(),backtests:new Map(),busy:false};let next=0;
  const data=()=>learningData(read(ANALYSIS_LEARNING_KEY)),group=id=>data().analyses[id]||{},records=id=>learningRecords(data(),id,options(id)),modelFor=id=>{const g=group(id),v=learningVersion(id,options(id));return g.models?.[v]||(g.model?.version===v?g.model:{});};
  function save(id,patch){const root=data(),value=mergeLearningData(root,{version:1,analyses:{[id]:{...group(id),...patch}}});if(JSON.stringify(root)===JSON.stringify(value))return root;if(write(ANALYSIS_LEARNING_KEY,value)===false)throw Error('Analyse-Lernstand konnte nicht gespeichert werden.');return value;}
  function saveRecord(r){return save(r.signal.analysisId,{records:{...group(r.signal.analysisId).records,[learningKey(r.signal)]:r}});}
  function capture(s){if(!LEARNING_IDS.includes(s.analysisId)||!s.learningFeatures)return s;const id=s.analysisId,signal={...s,learningVersion:learningVersion(id,s.options)},old=group(id).records?.[learningKey(signal)];
    if(old)return{...s,...Object.fromEntries(['learningVersion','probability','probabilityText','modelId','learningCount','expectedMinutes','durationSource'].map(k=>[k,old.signal[k]]))};
    // Derselbe Top-Down-Anker darf die Lerndaten nicht durch wiederholte Bestätigungen aufblasen.
    const duplicate=Object.values(group(id).records||{}).some(r=>r.signal.symbol===s.symbol&&r.signal.market===s.market&&r.signal.version===s.version&&(id==='top-down'?r.signal.direction===s.direction&&(r.signal.setupId===s.setupId||r.signal.at<=s.at&&s.at<r.signal.at+TOP_DOWN.cooldownMs):r.signal.nyDay===s.nyDay));
    const predicted={...signal,...analysisPrediction(signal,records(id),modelFor(id))};
    if(!duplicate)saveRecord({signal:compactLearningSignal(predicted),outcome:id==='top-down'?topDownLearningOutcome(predicted,[],s.at):nyLearningOutcome(predicted,[],s.at),source:'live',updatedAt:now()});
    return predicted;
  }
  // 3.82.2: nur speichern, wenn sich das Ergebnis wirklich ändert – vorher schrieb jede Minute (neues checkedAt) den gesamten Lernstand
  // (bis zu 20.000 Einträge) neu, samt Abgleich mit anderen Tabs
  function observeNy(s,rows,at=now()){if(!s?.learningFeatures)return;const key=learningKey(s),old=group('ny-open').records?.[key];if(!old||old.source!=='live'||old.outcome.complete)return;const outcome=nyLearningOutcome(old.signal,rows,at),{checkedAt:a,...next}=outcome,{checkedAt:b,...prev}=old.outcome;void a;void b;if(JSON.stringify(next)===JSON.stringify(prev))return;saveRecord({...old,outcome,updatedAt:at});void train('ny-open');}
  function observeTopDown(symbol,market,rows,at=now()){for(const old of Object.values(group('top-down').records||{})){if(old.source!=='live'||old.signal.symbol!==symbol||old.signal.market!==market||old.outcome.complete||!rows.length||rows[0].time>old.signal.at)continue;
    const outcome=topDownLearningOutcome(old.signal,rows,at);if(JSON.stringify(outcome)!==JSON.stringify(old.outcome))saveRecord({...old,outcome,updatedAt:at});}void train('top-down');}
  const worker=(job,abort)=>pullbackWorkerJob(workerFactory,job,abort);
  async function train(id,force=false){if(!available()||state.training.has(id))return;const a=records(id),old=modelFor(id),n=a.filter(r=>r.outcome?.first&&r.outcome.status!=='gap'&&r.outcome.status!=='data-gap').length,version=learningVersion(id,options(id));
    if(!force&&old.version===version&&old.lastCount!=null&&n-old.lastCount<ANALYSIS_LEARNING.retrainEvery&&!(old.lastCount<ANALYSIS_LEARNING.learningMin&&n>=ANALYSIS_LEARNING.learningMin))return;
    state.training.add(id);const abort=new AbortController();try{const model=workerFactory?await worker({type:'train',records:a,previous:old,now:now(),force},abort.signal):trainAnalysis(a,old,now(),force);if(available()&&version===learningVersion(id,options(id))){const fitted={...model,version,suggestions:learningSuggestions(a,old.suggestions,now())};save(id,{model:fitted,models:{...group(id).models,[version]:fitted}});};
    }catch(e){log({kind:'error',text:'Analyse-Lernmodell: '+e.message});}finally{state.training.delete(id);changed();}}
  async function tick(){for(const run of state.backtests.values())if(!available())run.controller.abort();if(!available()||state.busy||now()<next||!history)return;next=Math.floor(now()/Q)*Q+Q+2500;
    const pending=Object.values(group('top-down').records||{}).filter(r=>r.source==='live'&&!r.outcome.complete&&r.signal.at<Math.floor(now()/Q)*Q);state.busy=true;
    try{for(const r of pending){if(!available())break;const s=r.signal,to=Math.min(Math.floor(now()/Q)*Q,s.at+ANALYSIS_LEARNING.topDownHoldMs);if(r.outcome.checkedAt>=to)continue;try{const rows=await history({symbol:s.symbol,market:s.market,timeframe:'15m',from:s.at,to});observeTopDown(s.symbol,s.market,rows,now());}catch(e){
      // 3.82.2: begrenzt wie bei NY Open – nach Ablauf des Fensters und drei Fehlversuchen als Datenlücke abschließen (vorher alle 15 Minuten
      // ein neuer Abruf und Protokolleintrag, ohne Ende)
      const retries=(r.outcome.retries||0)+1,final=now()>=s.at+ANALYSIS_LEARNING.topDownHoldMs&&retries>=3;saveRecord({...r,outcome:{...r.outcome,retries,...(final?{status:'data-gap',complete:true,final:true,reason:'Ergebnisdaten unvollständig; kein Treffer behauptet.'}:{})},updatedAt:now()});
      log({kind:'error',symbol:s.symbol,text:'Lernergebnis fehlt: '+e.message+(final?' – als Datenlücke abgeschlossen.':'')});}}for(const id of LEARNING_IDS)void train(id);
    }finally{state.busy=false;changed();}}
  async function backtest(id){if(state.backtests.get(id)?.busy||!available()||!history)return;const controller=new AbortController(),run={controller,busy:true,text:'Historische Signale werden geprüft …'};state.backtests.set(id,run);changed();const config=globalThis.structuredClone(options(id));
    const merge=rows=>{const before=group(id).records||{},batch=Object.fromEntries(rows.map(r=>[learningKey(r.signal),r]));save(id,{records:{...before,...batch}});};
    try{const report=await runAnalysisLearningBacktest({id,symbols:symbols(),history,now:now(),options:config,signal:controller.signal,worker:workerFactory?worker:null,completed:merge,progress:p=>{run.text=`${p.done}/${p.total} · ${p.symbol} ${p.interval||p.day||''}`;changed();}});merge(report.records);const {records:ignored,trades:ignoredTrades,...summary}=report;void ignored;void ignoredTrades;save(id,{report:summary});run.text=`Test abgeschlossen · ${report.errors.length} Datenfehler · Startdaten gespeichert.`;await train(id,true);
    }catch(e){run.text=controller.signal.aborted?'Test pausiert; bereits geprüfte Top-Down-Coins bleiben gespeichert.':e.message;}finally{run.busy=false;changed();}}
  function importNyReport(report){const records={};for(const t of report?.trades||[]){if(!t.signal?.learningFeatures)continue;const s={...t.signal,learningVersion:learningVersion('ny-open',t.signal.options)};records[learningKey(s)]={signal:compactLearningSignal(s),outcome:nyLearningOutcomeFromTrade(t),source:'backtest',updatedAt:now()};}if(Object.keys(records).length){save('ny-open',{records:{...group('ny-open').records,...records}});void train('ny-open',true);}}
  const reported=new Set(),guard=(fn,fallback)=> (...args)=>{try{return fn(...args);}catch(error){if(!reported.has(error.message)){reported.add(error.message);log({kind:'error',text:'Lernstand vorübergehend nicht verfügbar: '+error.message});}return fallback?.(...args);}};
  return{state,importNyReport:guard(importNyReport),capture:guard(capture,s=>s),observeNy:guard(observeNy),observeTopDown:guard(observeTopDown),tick,train,backtest,abort:id=>state.backtests.get(id)?.controller.abort(),records,group};
}
