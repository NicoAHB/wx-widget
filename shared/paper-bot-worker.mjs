// Eigener öffentlicher Demo-Scanner. Originalmodelle, keine Archive/privaten API-Aufrufe.
import { createBitgetPublicClient } from './bitget-public.mjs';
import { evaluateLive } from './confluence-live.mjs';
import { loadPo3Phase } from './po3-feed.mjs';
import { loadAdaptiveGridMarket } from './adaptive-grid-feed.mjs';
const client=createBitgetPublicClient();let cache=null,journal=[],scopeKey=null,busy=false;
globalThis.onmessage=async({data:job})=>{
 if(busy||job?.type!=='scan')return;busy=true;
 try{
  const {instrument,config:c,runId}=job,key=runId+'|'+instrument+'|'+JSON.stringify(c);if(key!==scopeKey){cache=null;journal=[];scopeKey=key;}
  let result;
  if(c.strategy==='adaptive-grid'){
   // Geschlossene 14-Tage-Historie je Viertelstunde wiederverwenden; Quote/Volumen bleiben frisch.
   cache??={};const gridClient={...client,range:async args=>{const key=args.from+'|'+args.to;if(cache.history?.key===key)return cache.history.value;const value=await client.range(args);if(value.complete)cache.history={key,value};return value;},contract:async args=>{if(cache.contract&&Date.now()-cache.contract.knownAt<86400000)return cache.contract;return cache.contract=await client.contract(args);}};
   const gridMarket=await loadAdaptiveGridMarket({client:gridClient,instrument,runId,config:c.grid});
   const funding=await client.currentFunding({symbol:instrument,source:gridMarket.scope});result={gridMarket,contract:gridMarket.contract,funding,signals:[],reason:'Grid-Range und Limits geprüft.'};
  }else if(c.strategy==='po3'){
   const phase=await loadPo3Phase({client,instrument,config:c.po3,windowMode:'today',saved:cache,journal,originPrefix:'papierdemo|'});cache=phase.stream;journal=phase.journal.slice(-1000);
   const contract=phase.stream.contract,funding=await client.currentFunding({symbol:instrument,source:phase.stream.source});
   const signals=phase.complete?journal.filter(x=>x.plan.availableAt>=job.startedAt&&x.score.eligible).map(x=>({id:x.id,instrument,model:'po3',direction:x.direction,eligible:x.score.eligible,score:x.score.score,knownAt:x.plan.availableAt,expiresAt:x.plan.entryExpiryAt,entry:x.plan.levels.entry,sl:x.plan.levels.sl,tp:x.plan.levels.tps[0],entryMode:x.plan.entryMode,maxHoldMs:x.plan.maxHoldMs})):[];
   result={contract,funding,signals,complete:phase.complete,reason:phase.complete?(phase.stream.checklist?.action||'PO3: auf Sweep, Retest und Impuls warten.'):'PO3-Historie wird nachgeladen.'};
  }else{
   const periods={'1h':3600000,'4h':14400000,'1d':86400000},at=Date.now(),tf=c.timeframe||'1h',higher=c.contextTimeframe||'4h';
   const selection={instrument,timeframe:tf,contextTimeframe:higher,horizon:'short',maxHoldMs:c.maxHoldMs,slippageBps:c.slippageBps,indicatorAnchors:cache?.anchors||{base:Math.floor(at/periods[tf])*periods[tf]-260*periods[tf],context:Math.floor(at/periods[higher])*periods[higher]-260*periods[higher]}};
   const loaded=await client.load({selection,config:c.confluence,saved:cache?.saved});if(loaded.saved)cache={saved:loaded.saved,anchors:selection.indicatorAnchors};
   if(!loaded.data)result={signals:[],complete:loaded.status!=='nachladen',reason:loaded.reason||'Konfluenz-Daten nicht bewertbar.'};
   else{
    const quote=await client.quote({symbol:instrument,decisionAt:loaded.data.scope.asOf}),live=evaluateLive({...loaded,quote,planningAt:Date.now(),config:c.confluence,options:{anchorPolicy:c.anchorPolicy,fundingMode:'current-rate',leverage:c.leverage}});
    result={contract:loaded.data.contract,funding:loaded.data.funding,signals:live.cards.map(card=>({id:card.id,instrument,model:'confluence',direction:card.scope.direction,eligible:card.eligible,score:card.score.score,knownAt:card.decisionAt,expiresAt:card.expiresAt,original:card})),reason:live.eligible.length?'Konfluenz-Kandidat: aktuellen Einstieg prüfen.':live.cards.map(x=>x.reason).filter(Boolean).join(' · ')||'Konfluenz: noch kein geprüftes Signal.',complete:true};
   }
  }
  globalThis.postMessage({id:job.id,runId,instrument,result});
 }catch(e){globalThis.postMessage({id:job.id,runId:job.runId,instrument:job.instrument,error:e.message,retryAt:e.retryAt??null});}finally{busy=false;}
};
