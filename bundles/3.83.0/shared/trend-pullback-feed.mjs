import { PULLBACK, PULLBACK_DATA_KEY, PULLBACK_MODEL_KEY, PULLBACK_BACKTEST_KEY, PULLBACK_ACK_KEY, pullbackRecordKey, pullbackOptions, pullbackEligible, preparePullback, evaluatePreparedPullback, pullbackOutcome, pullbackTrend } from './trend-pullback-core.mjs';
import { pullbackData, mergePullbackData, compactPullbackSignal } from './trend-pullback-store.mjs';
import { pullbackPrediction, trainPullback, pullbackSuggestions, pullbackStatistics } from './trend-pullback-learning.mjs';
import { runPullbackBacktest, pullbackBacktestRange, pullbackWorkerJob } from './trend-pullback-backtest.mjs';
import { analysisClosed } from './analysis-top-down.mjs';
import { INTERVAL_MS } from './market-intervals.mjs';
const Q=INTERVAL_MS['15m'];
export function createPullbackRuntime({context,fetchRows,now,changed,signal,log,history,read=()=>null,write=()=>{},symbols=()=>[],pullbackWorkerFactory}) {
  const state={entries:new Map(),busy:false,requests:0,evaluations:0,backtest:{busy:false,text:''},training:false};
  let generation=0,signature='',controller=null,backtestController=null,trainController=null,nextBootstrap=now()+PULLBACK.bootstrapDelayMs,manualStop=false;
  const data=()=>pullbackData(read(PULLBACK_DATA_KEY)),all=()=>Object.values(data().records),options=()=>pullbackOptions(context().options?.[PULLBACK.id]),available=()=>{const c=context();return !c.paused&&!c.hidden&&c.online!==false;};
  function saveData(next){const merged=mergePullbackData(data(),next);if(write(PULLBACK_DATA_KEY,merged)===false)throw Error('Rücksetzer-Lerndaten konnten nicht gespeichert werden.');return merged;}
  function liveRecords(e){return all().filter(r=>r.source==='live'&&r.signal.symbol===e.symbol&&r.signal.market===e.market);}
  function active(e){return liveRecords(e).filter(r=>!r.outcome.first&&now()<r.signal.expiresAt).sort((a,b)=>b.signal.at-a.signal.at)[0];}
  function sync(){
    const c=context(),wanted=(c.symbols||[]).filter(s=>s.analyses.includes(PULLBACK.id)),key=JSON.stringify([available(),wanted.map(s=>[s.symbol,s.market]),options()]);
    if(key!==signature){signature=key;generation++;controller?.abort();controller=null;state.busy=false;for(const e of state.entries.values())e.wanted=false;
      for(const s of wanted){const k=s.symbol+'|'+s.market,e=state.entries.get(k);if(e)e.wanted=true;else state.entries.set(k,{...s,wanted:true,next:0,rows:{},attempted:new Set()});}
    }
    for(const r of all())if(r.source==='live'&&!r.outcome.complete){const s=r.signal,k=s.symbol+'|'+s.market;if(!state.entries.has(k))state.entries.set(k,{symbol:s.symbol,market:s.market,wanted:false,next:0,rows:{},attempted:new Set()});}
    for(const [k,e]of state.entries)if(!e.wanted&&!liveRecords(e).some(r=>!r.outcome.complete))state.entries.delete(k);
    if(!available()){backtestController?.abort();trainController?.abort();}
    return available()&&state.entries.size>0;
  }
  function result(symbol,market){
    const e=state.entries.get(symbol+'|'+market),r=e?.result;
    if(!available())return {ready:false,signal:null,stage:0,reason:'Analyse pausiert oder offline.'};
    if(e?.error)return {ready:false,signal:null,stage:0,reason:e.error};
    if(!r||now()>=r.expiresAt)return {ready:false,signal:null,stage:0,reason:r?'Neue Schlusskerzen werden geladen.':'Geschlossene Rücksetzer-Kerzen werden geladen.'};
    const record=active({symbol,market}),s=record?.signal;
    if(s){const prediction=s.probabilityText?{}:pullbackPrediction(s,all(),read(PULLBACK_MODEL_KEY)),current={...s,...prediction,chart:e.rows['15m']?.filter(c=>c.end<=s.at).slice(-60)};
      return {...r,stage:3,phase:'signal',signal:current,record,direction:s.direction,eligible:pullbackEligible(current,read(PULLBACK_MODEL_KEY)?.active,options()),reason:'Signal aktiv · '+(s.direction===1?'Long':'Short')+' · '+current.probabilityText};}
    return {...r,signal:null,stage:Math.min(2,r.stage),phase:r.phase==='signal'?'cooldown':r.phase,reason:r.phase==='signal'?'Dieses Impuls-Setup ist bereits protokolliert oder in der Sperrzeit.':r.reason};
  }
  function saveRecord(record){const root=data();return saveData({...root,records:{...root.records,[pullbackRecordKey(record.signal)]:record}});}
  async function maybeTrain(force=false){
    const records=all(),previous=read(PULLBACK_MODEL_KEY)||{},count=records.filter(r=>r.outcome.first&&r.outcome.status!=='gap').length;
    if(available()&&previous.suggestions?.at&&now()-previous.suggestions.at>=PULLBACK.weekMs)write(PULLBACK_MODEL_KEY,{...previous,suggestions:pullbackSuggestions(records,previous.suggestions,now())});
    if(state.training||!available()||!force&&previous.lastCount!=null&&count-previous.lastCount<PULLBACK.retrainEvery&&!(previous.lastCount<PULLBACK.learningMin&&count>=PULLBACK.learningMin))return;
    state.training=true;trainController=new AbortController();const abort=trainController.signal;
    try{const fitted=pullbackWorkerFactory?await pullbackWorkerJob(pullbackWorkerFactory,{type:'train',records,previous,now:now(),force},abort):trainPullback(records,previous,now(),force);
      if(!abort.aborted){fitted.suggestions=pullbackSuggestions(records,previous.suggestions,now());write(PULLBACK_MODEL_KEY,fitted);}
    }catch(e){if(!abort.aborted)log({kind:'error',text:'Rücksetzer-Lernmodell: '+e.message});}
    finally{state.training=false;trainController=null;changed();}
  }
  async function send(e,s){if(!s||e.attempted.has(pullbackRecordKey(s)))return;
    const current=result(e.symbol,e.market);if(current.signal&&current.eligible&&await signal(current.signal)!==false)e.attempted.add(pullbackRecordKey(s));
  }
  async function tick(){
    sync();void bootstrap();if(!sync()||state.busy)return;
    const e=[...state.entries.values()].filter(e=>now()>=e.next).sort((a,b)=>a.next-b.next)[0];if(!e)return;
    const gen=generation,at=now();state.busy=true;controller=new AbortController();const abort=controller.signal;e.next=Math.floor(at/Q)*Q+Q+PULLBACK.closeGraceMs;
    try{
      for(const iv of ['4h','1h','15m']){
        const ms=INTERVAL_MS[iv],end=Math.floor(at/ms)*ms;if(e.rows[iv]?.at(-1)?.end===end)continue;
        state.requests++;const fetched=await fetchRows(e.symbol,iv,PULLBACK.history+2,abort);if(abort.aborted||gen!==generation)return;
        if(fetched.source!==e.market)throw Error('Rücksetzer-Zeitrahmen müssen denselben Börsenmarkt verwenden.');
        const rows=analysisClosed(fetched.candles,iv,at);if(rows.at(-1)?.end!==end)throw Error(`${iv}: neueste geschlossene Kerze fehlt.`);
        if(iv==='4h'){
          const anchors=liveRecords(e).filter(r=>!r.outcome.complete).map(r=>r.signal.trendAnchorAt).filter(Number.isSafeInteger),start=Math.min(rows[Math.max(0,rows.length-PULLBACK.history)].time,...anchors),merged=[...new Map([...(e.rows[iv]||[]),...rows].map(c=>[c.time,c])).values()].sort((a,b)=>a.time-b.time);
          e.rows[iv]=merged.filter(c=>c.time>=start);
        }else e.rows[iv]=rows.slice(-PULLBACK.history);
      }
      const prepared=preparePullback(e.rows,at),r=evaluatePreparedPullback(prepared,{now:at,symbol:e.symbol,market:e.market});state.evaluations++;e.result=r;
      // 3.82.2: Fehler je Datensatz abfangen – eine dauerhafte Lücke im Ergebnisfenster eines alten Signals sperrte sonst den ganzen Coin
      // (auch für neue Signale); nach Ablauf des Fensters und drei Fehlversuchen endgültig als Lücke abschließen
      for(const old of liveRecords(e).filter(r=>!r.outcome.complete))try{
        let rows=e.rows['15m'].filter(c=>c.time>=old.signal.at);
        // Längere App-Pause: den bereits vorhandenen Historienclient für fehlende Ergebnis-Kerzen nutzen.
        if((rows[0]?.time??Infinity)>old.signal.at&&at>old.signal.at){const to=Math.min(Math.floor(at/Q)*Q,old.signal.expiresAt);if(history&&to>old.signal.at){state.requests++;rows=await history({symbol:e.symbol,market:e.market,timeframe:'15m',from:old.signal.at,to,signal:abort});}}
        if(abort.aborted||gen!==generation)return;
        let outcomePrepared=prepared;
        const needed=old.signal.trendAnchorAt??Math.floor(old.signal.at/INTERVAL_MS['4h'])*INTERVAL_MS['4h']-PULLBACK.history*INTERVAL_MS['4h'];
        if(needed<e.rows['4h'][0].time){if(!history)throw Error('Historische 4h-Ergebniskerzen fehlen.');state.requests++;const higher=await history({symbol:e.symbol,market:e.market,timeframe:'4h',from:needed,to:Math.floor(Math.min(at,old.signal.expiresAt)/INTERVAL_MS['4h'])*INTERVAL_MS['4h'],signal:abort});outcomePrepared=preparePullback({'4h':higher,'1h':[], '15m':rows},at);}
        if(abort.aborted||gen!==generation)return;
        const outcome=pullbackOutcome(old.signal,rows,at,t=>pullbackTrend(outcomePrepared,t).direction);
        saveRecord({...old,outcome,updatedAt:at});
      }catch(error){if(abort.aborted||gen!==generation)return;const retries=(old.outcome.retries||0)+1,final=at>=old.signal.expiresAt&&retries>=3;
        saveRecord({...old,outcome:{...old.outcome,retries,...(final?{status:'gap',complete:true,reason:'Ergebnisdaten dauerhaft unvollständig; kein Treffer erfunden.'}:{})},updatedAt:at});
        log({kind:'error',symbol:e.symbol,text:`${e.symbol} · Rücksetzer-Ergebnis nicht prüfbar (${error.message||error})${final?' – als Datenlücke abgeschlossen.':'.'}`});}
      const s=r.signal,existing=s&&data().records[pullbackRecordKey(s)],last=s&&liveRecords(e).filter(x=>x.signal.direction===s.direction).sort((a,b)=>b.signal.at-a.signal.at)[0];
      const locked=last&&at<(last.outcome.first?.at||last.signal.expiresAt)+PULLBACK.cooldownMs;
      if(s&&e.wanted&&!existing&&!locked){const current={...s,...pullbackPrediction(s,all(),read(PULLBACK_MODEL_KEY))};saveRecord({signal:compactPullbackSignal(current),outcome:pullbackOutcome(current,[],current.at),source:'live',updatedAt:at});log({kind:'signal',symbol:e.symbol,text:`${e.symbol} · Rücksetzer ${s.side} bestätigt; Einstieg ${s.entry}, Stop ${s.stop}, Ziel 1 ${s.target1}, Ziel 2 ${s.target2}.`});}
      e.error='';e.failures=0;await send(e,active(e)?.signal);void maybeTrain();
    }catch(error){if(!abort.aborted&&gen===generation){e.error=error.message||'Rücksetzer-Daten fehlen.';e.failures=(e.failures||0)+1;e.next=now()+Math.min(PULLBACK.maxRetryMs,PULLBACK.retryMs*2**Math.min(e.failures,3));log({kind:'error',symbol:e.symbol,text:`${e.symbol} · Rücksetzer: ${e.error} Coin übersprungen.`});}}
    finally{if(gen===generation){state.busy=false;controller=null;changed();}}
  }
  async function dispatch(){if(!sync())return;for(const e of state.entries.values())if(e.wanted)await send(e,active(e)?.signal);}
  async function startBacktest(automatic=false){
    if(backtestController||!available()||!history)return;
    const current=data(),boot=current.bootstrap||{},window=automatic&&boot.from?{from:boot.from,to:boot.to}:pullbackBacktestRange(now()),coins=symbols().filter(s=>s.market),done=automatic?new Set(boot.completed||[]):new Set(),pending=coins.filter(c=>!done.has(c.symbol+'|'+c.market));
    if(!pending.length)return;
    backtestController=new AbortController();const abort=backtestController.signal;manualStop=false;state.backtest.busy=true;state.backtest.text='Sechs Monate werden begrenzt geladen …';
    saveData({...current,bootstrap:{...boot,...window,runId:automatic?boot.runId||'initial:'+window.from+':'+window.to:'manual:'+now()+':'+Math.random().toString(36).slice(2),completed:automatic?boot.completed||[]:[],errors:[],status:'running',attempts:automatic?(boot.attempts||0)+1:1,updatedAt:now()}});changed();
    try{const report=await runPullbackBacktest({symbols:pending,history,now:now(),...window,signal:abort,workerFactory:pullbackWorkerFactory,
      progress:p=>{state.backtest.text=`${p.done}/${p.total} Coins · ${p.symbol}${p.interval?' · '+p.interval:''} · historische Prüfung`;changed();},
      completed:async(coin,records)=>{const root=data(),key=coin.symbol+'|'+coin.market;saveData({...root,records:{...root.records,...Object.fromEntries(records.map(r=>[pullbackRecordKey(r.signal),r]))},bootstrap:{...root.bootstrap,completed:[...new Set([...(root.bootstrap?.completed||[]),key])],updatedAt:now()}});}
    });
      if(abort.aborted)return;
      const root=data(),errors=report.errors,allChecked=symbols().every(c=>c.market&&root.bootstrap.completed.includes(c.symbol+'|'+c.market));
      saveData({...root,bootstrap:{...root.bootstrap,status:allChecked?'done':'partial',errors,updatedAt:now()}});
      const cohort=Object.values(root.records).filter(r=>r.signal.at>=window.from&&r.signal.at<=window.to&&coins.some(c=>c.symbol===r.signal.symbol&&c.market===r.signal.market));
      write(PULLBACK_BACKTEST_KEY,{...report,symbols:coins,checked:coins.filter(c=>root.bootstrap.completed.includes(c.symbol+'|'+c.market)).length,statistics:pullbackStatistics(cohort,report.feePct,report.slippagePct),records:undefined});state.backtest.text=errors.length?`Historie teilweise geprüft · ${errors.length} Coins mit Datenfehlern. Fehler stehen im Lernstand.`:'Sechs-Monats-Test abgeschlossen; Startdaten lokal gespeichert.';
      for(const e of errors)log({kind:'error',symbol:e.symbol,text:'Rücksetzer-Ersttest: '+e.text});await maybeTrain(true);
    }catch(e){const root=data();saveData({...root,bootstrap:{...root.bootstrap,status:manualStop?'paused':'partial',attempts:abort.aborted&&!manualStop?Math.max(0,(root.bootstrap.attempts||1)-1):root.bootstrap.attempts,updatedAt:now()}});state.backtest.text=abort.aborted?'Test pausiert; abgeschlossene Coins bleiben gespeichert.':e.message;}
    finally{state.backtest.busy=false;backtestController=null;nextBootstrap=now()+(abort.aborted&&!manualStop?0:PULLBACK.bootstrapRetryMs);changed();}
  }
  async function bootstrap(){if(!available()||now()<nextBootstrap||backtestController)return;const b=data().bootstrap;
    if(b?.status==='paused'||b?.status==='partial'&&b.attempts>=PULLBACK.bootstrapMaxAttempts)return;
    const list=symbols();if(!list.length||list.some(s=>!s.market))return;
    if(b?.status==='done'&&list.every(s=>(b.completed||[]).includes(s.symbol+'|'+s.market)))return;
    nextBootstrap=now()+PULLBACK.bootstrapRetryMs;await startBacktest(true);
  }
  function acknowledge(symbol=null){const ack=read(PULLBACK_ACK_KEY)||{coins:{},row:[]},records=all().filter(r=>r.source==='live'&&!r.outcome.first&&now()<r.signal.expiresAt),keys=records.filter(r=>!symbol||r.signal.symbol===symbol).map(r=>pullbackRecordKey(r.signal));
    if(symbol)ack.coins={...ack.coins,[symbol]:keys};else ack.row=[...new Set([...(ack.row||[]),...keys])].slice(-PULLBACK.maxRecords);write(PULLBACK_ACK_KEY,ack);changed();
  }
  return {state,sync,tick,result,dispatch,acknowledge,retrain:()=>maybeTrain(true),startBacktest:()=>startBacktest(false),abortBacktest:()=>{manualStop=true;backtestController?.abort();},confirmSuggestion:id=>{const model=read(PULLBACK_MODEL_KEY);if(!model)return;const copy=globalThis.structuredClone(model);for(const s of copy.suggestions?.items||[])if(s.id===id)s.confirmed=true;write(PULLBACK_MODEL_KEY,copy);changed();}};
}
