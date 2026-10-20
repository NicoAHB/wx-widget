import { NY_OPEN, NY_RANGE_IDS, NY_JOURNAL_KEY, nySettings, nySession, nyRecordKey, nyRecord, nyRecordRanges, nyRangeText, nyClock, nyTerminal, evaluateNyOpen } from './ny-open-core.mjs';
import { TOP_DOWN } from './analysis-top-down.mjs';
const MINUTE=60000,H4=14400000;
export function nyJournal(value={}){return {records:Object.fromEntries(Object.entries(value?.records||{}).filter(([,r])=>r&&r.symbol&&r.day&&r.range).slice(-NY_OPEN.journalDays*NY_OPEN.maxCoins))};}
export function createNyRuntime({context,now,changed,signal,log,history,read=()=>null,write=()=>{},learning}){
  const state={entries:new Map(),busy:false,requests:0,evaluations:0};let controller=null,signature='',generation=0;
  const options=()=>nySettings(context().options?.[NY_OPEN.id]);
  function sync(){
    const c=context(),key=JSON.stringify([!c.paused&&!c.hidden&&c.online!==false,(c.symbols||[]).filter(s=>s.analyses.includes(NY_OPEN.id)),options()]);
    if(key!==signature){signature=key;generation++;controller?.abort();controller=null;state.busy=false;for(const e of state.entries.values())e.wanted=false;
      for(const s of c.symbols||[])if(s.analyses.includes(NY_OPEN.id)){const k=s.symbol+'|'+s.market,e=state.entries.get(k);if(e){e.wanted=true;e.next=0;}else state.entries.set(k,{...s,wanted:true,next:0,rows:{},attempted:new Set()});}
    }
    // Bereits bestätigte Signale werden auch nach dem Stummschalten noch bis zum Ergebnis geprüft.
    const journal=nyJournal(read(NY_JOURNAL_KEY));for(const r of Object.values(journal.records))if(r.signal&&!nyTerminal(r.outcome)){const k=r.symbol+'|'+r.market;if(!state.entries.has(k))state.entries.set(k,{symbol:r.symbol,market:r.market,wanted:false,next:0,rows:{},attempted:new Set()});}
    for(const [k,e] of state.entries)if(!e.wanted&&!Object.values(journal.records).some(r=>r.symbol===e.symbol&&r.market===e.market&&r.signal&&!nyTerminal(r.outcome)))state.entries.delete(k);
    return !c.paused&&!c.hidden&&c.online!==false&&state.entries.size>0;
  }
  function outstanding(e){return Object.values(nyJournal(read(NY_JOURNAL_KEY)).records).filter(r=>r.symbol===e.symbol&&r.market===e.market&&r.signal&&!nyTerminal(r.outcome)).sort((a,b)=>a.day.localeCompare(b.day));}
  function record(e){return Object.values(nyJournal(read(NY_JOURNAL_KEY)).records).filter(r=>r.symbol===e.symbol&&r.market===e.market).sort((a,b)=>b.day.localeCompare(a.day))[0];}
  function result(symbol,market){const e=state.entries.get(symbol+'|'+market),s=nySession(now(),options()),r=record({symbol,market}),today=r?.day===s.day?r:null,known=nyRecordRanges(r)[s.rangeLength]||null,base={ready:true,analysisId:NY_OPEN.id,symbol,market,session:s,range:known,record:r,signal:r?.signal||null,direction:r?.signal?.direction||0,stage:0,expiresAt:Infinity,at:Math.floor(now()/MINUTE)*MINUTE};
    const c=context();if(c.paused||c.hidden||c.online===false)return{...base,ready:false,signal:null,reason:'Analyse pausiert oder offline.'};
    if(e?.error)return{...base,ready:false,signal:null,reason:e.error};
    const range=today&&nyRecordRanges(today)[s.rangeLength];
    if(today&&(today.signal||range&&now()>=s.rangeEnd&&range.pct<NY_OPEN.minRangePct)){const value=evaluateNyOpen({now:now(),symbol,market,options:options(),record:today});if(value.signal&&e?.rows['1m'])value.signal={...value.signal,chart:e.rows['1m'].filter(c=>c.end<=value.signal.at).slice(-60)};return{...value,record:today,expiresAt:Infinity};}
    // 3.86.0: nach dem Umschalten der Range-Länge sofort aus den schon geladenen 1m-Kerzen neu bewerten (kein neuer Abruf, nicht erst im nächsten Takt)
    if(e?.result&&e.rows['1m']&&e.result.session.day===s.day&&e.result.session.rangeLength!==s.rangeLength){try{e.result=evaluateNyOpen({candles:e.rows,now:now(),symbol,market,options:options(),record:today});}catch{e.result=null;}}
    if(e?.result&&e.result.session.day===s.day&&now()<=s.windowEnd+NY_OPEN.closeGraceMs)return{...e.result,record:r,expiresAt:Infinity};
    return{...base,phase:!s.eligible?'closed-day':now()<s.rangeStart?'before':now()<s.rangeEnd?'forming':'closed',reason:!s.eligible?s.reason:now()<s.rangeStart?`Nächste Range: ${nyRangeText(s)} New York.`:now()<s.rangeEnd?`Range wird gebildet: ${nyRangeText(s)}.`:r?.day===s.day?'Signalfenster beendet; die heutige Range bleibt sichtbar.':`Keine heutige Range gespeichert; Abrufe und neue Signale nur ${nyClock(s.rangeEnd)}–${nyClock(s.windowEnd)} New York.`};
  }
  function save(r){const j=nyJournal(read(NY_JOURNAL_KEY)),key=nyRecordKey(r.symbol,r.day),existing=j.records[key];if(existing?.signal&&r.market!==existing.market)return;if(existing?.signal&&r.signal?.at!==existing.signal.at)r={...r,signal:existing.signal,outcome:existing.outcome};j.records[key]=r;const cutoff=now()-NY_OPEN.journalDays*86400000;for(const [k,v]of Object.entries(j.records))if(v.range.end<cutoff)delete j.records[k];write(NY_JOURNAL_KEY,j);}
  // 3.82.2: schon während des Versands als versucht markieren (der Tick wartet nicht mehr darauf); bei false oder Fehler wieder frei
  async function send(e,s){if(!s||now()<s.at||now()>=s.expiresAt)return;const key=nyRecordKey(s.symbol,s.nyDay);if(e.attempted.has(key))return;e.attempted.add(key);let ok=false;try{ok=await signal(s)!==false;}finally{if(!ok)e.attempted.delete(key);}}
  async function tick(){
    if(!sync()||state.busy||!history)return;const e=[...state.entries.values()].filter(e=>now()>=e.next).sort((a,b)=>a.next-b.next)[0];if(!e)return;
    const gen=generation,at=now(),cfg=options(),session=nySession(at,cfg),old=record(e);e.next=Math.floor(at/MINUTE)*MINUTE+MINUTE+2500;
    const daily=nyJournal(read(NY_JOURNAL_KEY)).records[nyRecordKey(e.symbol,session.day)];
    // 3.86.0: ab Ende der 5m-Range laufend 1m-Kerzen laden (alle Range-Längen entstehen daraus). Mit festgeschriebenem Signal nur noch, solange eine abgeschlossene Länge noch nicht gespeichert ist.
    const stored=nyRecordRanges(daily),missing=NY_RANGE_IDS.some(id=>!stored[id]&&at>=session.rangeStart+NY_OPEN.ranges[id].minutes*MINUTE);
    const form=e.wanted&&session.eligible&&at>=session.baseRangeEnd&&at<=session.windowEnd+NY_OPEN.closeGraceMs&&(!daily?.signal||missing);
    const monitoring=outstanding(e).length>0;
    if(!form&&!monitoring){e.result=null;changed();return;}
    controller=new AbortController();const abort=controller.signal;state.busy=true;
    const get=async(timeframe,from,to)=>{state.requests++;return history({symbol:e.symbol,market:e.market,timeframe,from,to,signal:abort});};
    let checkedRecord=null;
    try{
      if(e.day!==session.day){e.rows={};e.day=session.day;}
      const closed=Math.floor(at/MINUTE)*MINUTE;
      if(form){
        const from=session.atrFrom,to=Math.min(closed,session.windowEnd),last=e.rows['1m']?.at(-1)?.end||from;
        if(to>last)e.rows['1m']=[...(e.rows['1m']||[]),...await get('1m',last,to)];
        const hEnd=Math.floor(at/H4)*H4;if(cfg.biasFilter&&e.rows['4h']?.at(-1)?.end!==hEnd)e.rows['4h']=await get('4h',hEnd-TOP_DOWN.history*H4,hEnd);
        if(abort.aborted||gen!==generation)return;
        const existing=old?.day===session.day?old:null,r=evaluateNyOpen({candles:e.rows,now:at,symbol:e.symbol,market:e.market,options:cfg,record:existing});state.evaluations++;e.result=r;
        if(r.signal&&learning)r.signal=learning.capture(r.signal);
        if(r.range||Object.keys(r.ranges||{}).length){const saved=nyRecord(r,existing||{},e.rows['1m'],at);save(saved);if(saved.signal)learning?.observeNy(saved.signal,e.rows['1m'],at);e.result.record=saved;}
        // 3.82.2: nicht abwarten – ein Signal gilt nur 60 s; ein langsamer Telegram-Versand hielt sonst alle anderen Coins auf
        if(r.signal)void send(e,r.signal).catch(error=>log({kind:'error',symbol:e.symbol,text:`${e.symbol} · NY Open: Versand fehlgeschlagen – ${error?.message||error}`}));
      }
      for(const current of outstanding(e)){
        checkedRecord=current;
        const s=current.signal,to=Math.min(closed,s.at+(NY_OPEN.holdMinutes+(s.entryMode==='limit'?NY_OPEN.limitMinutes:0))*MINUTE);
        if(to>s.at){
          const key=nyRecordKey(s.symbol,s.nyDay);e.observed??=new Map();let rows=e.observed.get(key)||[],from=rows.at(-1)?.end||s.at;
          if(to>from)rows=[...rows,...await get('1m',from,to)];if(abort.aborted||gen!==generation)return;
          e.observed.set(key,rows);const updated=nyRecord({...current,session:current.session,signal:s},current,rows,at);save(updated);learning?.observeNy(s,rows,at);if(nyTerminal(updated.outcome))e.observed.delete(key);
        }
      }
      e.error='';e.failures=0;
    }catch(error){if(!abort.aborted&&gen===generation){
      // 3.82.2: im Signalfenster nach 5/10/15 s erneut (ein Signal gilt nur 60 s) – sonst wie bisher ab 1 Minute aufsteigend
      e.error=error.message||'NY-Kerzen fehlen.';e.failures=(e.failures||0)+1;e.next=now()+(form?Math.min(15000,5000*e.failures):Math.min(NY_OPEN.retryMaxMs,MINUTE*2**Math.min(e.failures-1,3)));
      const current=checkedRecord,s=current?.signal;
      if(s&&now()>=s.at+(NY_OPEN.holdMinutes+(s.entryMode==='limit'?NY_OPEN.limitMinutes:0))*MINUTE){const retries=(current.outcome?.retries||0)+1;save({...current,updatedAt:now(),outcome:{...current.outcome,status:'data-gap',retries,final:retries>=NY_OPEN.outcomeRetries,reason:'Ergebnisdaten unvollständig; kein Ziel-/Stop-Treffer behauptet.'}});}
      log({kind:'error',symbol:e.symbol,text:`${e.symbol} · NY Open: ${e.error} Coin übersprungen.`});
    }}
    finally{if(gen===generation){state.busy=false;controller=null;changed();}}
  }
  async function dispatch(){if(!sync())return;for(const e of state.entries.values())if(e.wanted)await send(e,result(e.symbol,e.market).signal);}
  return{state,sync,tick,result,dispatch};
}

export function mergeNyJournals(a,b){const records={...nyJournal(a).records};for(const [k,r]of Object.entries(nyJournal(b).records)){const old=records[k];if(!old){records[k]=r;continue;}if(old.signal&&r.signal&&old.signal.at!==r.signal.at){records[k]=old.signal.at<r.signal.at?old:r;continue;}if(old.signal&&!r.signal)continue;if(r.signal&&!old.signal){records[k]=r;continue;}const terminalOld=nyTerminal(old.outcome),terminalNew=nyTerminal(r.outcome);records[k]=terminalOld&&!terminalNew?old:terminalNew&&!terminalOld?r:(r.updatedAt||0)>(old.updatedAt||0)?r:old;}return nyJournal({records});}
