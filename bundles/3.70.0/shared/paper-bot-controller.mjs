// Ein lokaler Executor je Gerät. Bestätigte IDB-Buchung vor UI, Epochen vor verspäteten Antworten.
import { paperBook, paperConfig, paperStart, paperStep, paperEnd, paperQuote } from './paper-bot.mjs';
export function createPaperBotController({read,write,quote,workerFactory,currentSymbol,settings,available=()=>true,changed=()=>{},now=Date.now,locks=globalThis.navigator?.locks}){
 const state={book:paperBook(),active:false,busy:false,message:'Demo aus. Eigene Übungswerte wählen und bewusst starten.',error:'',modelError:'',quote:null};
 let epoch=0,timer=null,abort=null,worker=null,pending=null,workerId=0,release=null,lockTask=null,model=null,nextScan=0,serial=Promise.resolve();
 const emit=()=>changed(state),enqueue=fn=>{const p=serial.then(fn);serial=p.catch(()=>{});return p;};
 async function commit(next,ticket=epoch){const result=await write(next,state.book.revision,()=>ticket===epoch);if(ticket===epoch){state.book=result;emit();}return result;}
 function cancel(){clearTimeout(timer);timer=null;abort?.abort();abort=null;worker?.terminate();worker=null;if(pending){clearTimeout(pending.timeout);pending=null;}model=null;}
 function fail(e){state.error=e.message;state.active=false;epoch++;cancel();release?.();release=null;emit();}
 async function refresh(){if(state.active)return;try{state.book=await read();state.error='';emit();}catch(e){state.error=e.message;emit();}}
 function scan(ticket){if(pending||!state.active||!available()||now()<nextScan)return;const r=state.book.run;if(!r)return;
  if(!worker){worker=workerFactory();worker.onmessage=({data})=>{
   if(!pending||data.id!==pending.id||data.runId!==state.book.run?.id||data.instrument!==state.book.run.instrument||pending.epoch!==epoch)return;
   clearTimeout(pending.timeout);pending=null;
   if(data.error){state.modelError=data.error;model=null;nextScan=Math.max(now()+30000,data.retryAt||0);}
   else{model=data.result;state.modelError='';nextScan=now()+(model.complete===false?1000:r.config.strategy==='adaptive-grid'?15000:60000);}
   emit();
  };worker.onerror=()=>{if(!pending)return;clearTimeout(pending.timeout);pending=null;state.modelError='Demo-Modell konnte nicht berechnet werden. Schutz wird mit verfügbaren Kursen weiter geprüft.';worker.terminate();worker=null;model=null;nextScan=now()+30000;emit();};}
  const id=++workerId;pending={id,epoch:ticket,timeout:setTimeout(()=>{if(pending?.id!==id)return;pending=null;worker?.terminate();worker=null;model=null;state.modelError='Modell-Abfrage dauert zu lange; Schutz bleibt vorrangig.';nextScan=now()+30000;emit();},120000)};
  worker.postMessage({type:'scan',id,runId:r.id,instrument:r.instrument,startedAt:r.startedAt,config:r.config});
 }
 async function tick(ticket){if(ticket!==epoch||!state.active)return;
  if(!available()){state.message='Demo pausiert: App verdeckt, angehalten oder ohne Netz.';state.quote=null;emit();timer=setTimeout(()=>void tick(ticket),5000);return;}
  try{
   scan(ticket);abort=new AbortController();const q=await quote(state.book.run.instrument,abort.signal);if(ticket!==epoch||!state.active||!available())return;
   if(!paperQuote(q,state.book.run.instrument,now()))throw new Error('Passender Live-Kurs fehlt; Demo pausiert neue Einstiege.');
   state.quote=q;state.message='';state.error='';await enqueue(async()=>{if(ticket!==epoch||!state.active||!available())return;const next=paperStep(state.book,{...model,quote:q,asOf:now(),modelReason:state.modelError||model?.reason||'Modell wird geladen; noch kein Einstieg.'});await commit(next,ticket);});
  }catch(e){if(ticket===epoch&&state.active){if(/Speicher|Speicherung|beschädigt/.test(e.message)){fail(e);return;}state.quote=null;state.message=e.message;emit();}}
  finally{abort=null;if(ticket===epoch&&state.active)timer=setTimeout(()=>void tick(ticket),5000);}
 }
 async function start(resume=false){if(state.busy||state.active)return;if(!locks?.request){state.error='Dieser Browser unterstützt die sichere Demo-Tab-Sperre nicht.';emit();return;}if(!available()){state.error='Für den Demo-Start App sichtbar und online fortsetzen.';emit();return;}
  let selected;try{selected=resume?null:{instrument:currentSymbol(),config:paperConfig(settings()),id:'paper-'+now().toString(36)+'-'+Math.random().toString(36).slice(2,8)};}catch(e){state.error=e.message;emit();return;}
  state.busy=true;state.error='';emit();const ticket=++epoch;
  await new Promise(resolve=>{lockTask=locks.request('scalpdesk-paper-executor',{ifAvailable:true},async lock=>{
   if(!lock){state.error='Demo läuft in einem anderen Tab. Dort beenden oder diesen Tab später erneut starten.';state.busy=false;emit();resolve();return;}
   try{
    await enqueue(async()=>{state.book=await read();let b;
     if(resume){if(!state.book.run)throw new Error('Kein Demo-Lauf zum Fortsetzen.');b=paperBook(state.book);paperConfig(b.run.config);b.run.status='running';b.run.reason='Bewusst fortgesetzt; auf neue aktuelle Daten warten.';}
     else b=paperStart(state.book,selected,now());await commit(b,ticket);});
    if(ticket!==epoch){resolve();return;}state.active=true;state.busy=false;state.message='Demo gestartet; öffentliche Daten werden geprüft.';emit();
    const held=new Promise(r=>{release=r;});resolve();void tick(ticket);await held;
   }catch(e){state.error=e.message;state.busy=false;state.active=false;emit();resolve();}
   finally{if(ticket===epoch){state.active=false;cancel();emit();}}
  }).catch(e=>{fail(e);state.busy=false;resolve();});});
 }
 async function stop(){if(state.busy)return;state.busy=true;state.active=false;const ticket=++epoch;cancel();emit();
  const end=async()=>{state.book=await read();let q=null;try{if(available()&&state.book.run)q=await quote(state.book.run.instrument,new AbortController().signal);}catch{}
   const b=paperEnd(state.book,q,now());await commit(b,ticket);state.quote=q;state.message=b.run?.reason||'Demo aus.';};
  try{if(release)await enqueue(end);else if(locks?.request)await locks.request('scalpdesk-paper-executor',{ifAvailable:true},async lock=>{if(!lock)throw new Error('Demo im anderen Tab beenden.');await enqueue(end);});else throw new Error('Demo-Sperre nicht verfügbar. Restbestand bleibt erhalten.');}
  catch(e){state.error=e.message;}finally{release?.();if(release)await lockTask;release=null;lockTask=null;state.busy=false;emit();}
 }
 async function clear(){if(state.busy||state.active)throw new Error('Demo zuerst beenden.');if(!locks?.request)throw new Error('Demo-Sperre nicht verfügbar.');state.busy=true;emit();try{await locks.request('scalpdesk-paper-executor',{ifAvailable:true},async lock=>{if(!lock)throw new Error('Demo läuft in einem anderen Tab.');await enqueue(async()=>{state.book=await read();await commit(paperBook());state.quote=null;state.message='Nur lokale Bot-Demo-Trade-Daten gelöscht.';});});}finally{state.busy=false;emit();}}
 function suspend(){if(!state.active)return;epoch++;cancel();state.quote=null;state.message='Demo pausiert; vorhandene Modellpositionen bleiben erhalten.';emit();void tick(epoch);}
 return{state,start,stop,clear,refresh,suspend,render:emit};
}
