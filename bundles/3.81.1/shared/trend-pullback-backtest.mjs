import { PULLBACK, preparePullback, evaluatePreparedPullback, pullbackTrend, pullbackOutcome, pullbackRecordKey } from './trend-pullback-core.mjs';
import { compactPullbackSignal } from './trend-pullback-store.mjs';
import { pullbackStatistics } from './trend-pullback-learning.mjs';
import { INTERVAL_MS } from './market-intervals.mjs';
import { nyWait } from './ny-open-history.mjs';
export function pullbackBacktestRange(now) {
  const d=new Date(now),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-PULLBACK.backtestMonths);
  const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));
  return {from:Math.floor(d.getTime()/900000)*900000,to:Math.floor(now/900000)*900000};
}
const cancelled=s=>{if(s?.aborted)throw s.reason||new globalThis.DOMException('Abgebrochen','AbortError');};
export async function scanPullbackHistory({candles,symbol,market,from,to,signal,progress=()=>{}}) {
  const prepared=preparePullback(candles,to),rows=prepared.frames['15m'].rows,records=[],used=new Set(),locks={1:0,'-1':0};
  for(let i=0;i<rows.length;i++){
    cancelled(signal);const c=rows[i];if(c.end<from||c.end>to)continue;
    if(i%128===0){progress({bars:i,total:rows.length});await nyWait(0,signal);}
    const result=evaluatePreparedPullback(prepared,{now:c.end,symbol,market,historical:true}),s=result.signal;
    if(!s||c.end<locks[s.direction]||used.has(pullbackRecordKey(s)))continue;
    const future=rows.slice(i+1,i+1+Math.ceil(PULLBACK.holdMs/900000)),outcome=pullbackOutcome(s,future,to,at=>pullbackTrend(prepared,at).direction);
    used.add(pullbackRecordKey(s));locks[s.direction]=(outcome.first?.at||s.expiresAt)+PULLBACK.cooldownMs;
    records.push({signal:compactPullbackSignal(s),outcome,source:'backtest',updatedAt:to});
  }
  return records;
}
// CPU-Arbeit im bestehenden Modul-Worker-Muster; Netzwerk/Cache bleiben im gemeinsamen Historienclient.
export function pullbackWorkerJob(factory,job,signal) {
  if(!factory)return job.type==='train'?Promise.reject(Error('Lern-Worker fehlt.')):scanPullbackHistory({...job,signal});
  return new Promise((resolve,reject)=>{cancelled(signal);let worker;const finish=(error,value)=>{signal?.removeEventListener('abort',abort);worker?.terminate();error?reject(error):resolve(value);},abort=()=>finish(signal.reason||new globalThis.DOMException('Abgebrochen','AbortError'));
    try{worker=factory();worker.onmessage=e=>{if(e.data.error)finish(Error(e.data.error));else if(e.data.done)finish(null,e.data.value);};worker.onerror=()=>finish(Error('Rücksetzer-Worker konnte nicht ausgeführt werden.'));signal?.addEventListener('abort',abort,{once:true});worker.postMessage(job);}catch(e){finish(e);}
  });
}
export async function loadPullbackHistory({history,symbol,market,from,to,signal,progress=()=>{}}) {
  const candles={};
  for(const iv of ['4h','1h','15m']){
    const ms=INTERVAL_MS[iv],start=Math.floor(from/ms)*ms-PULLBACK.history*ms,end=Math.floor(to/ms)*ms;let rows=[];
    for(let cursor=start;cursor<end;){cancelled(signal);const next=Math.min(end,cursor+PULLBACK.historyChunkDays*86400000);progress({symbol,interval:iv,from:cursor,to:next});
      const batch=await history({symbol,market,timeframe:iv,from:cursor,to:next,signal});cancelled(signal);
      if(batch.length!==(next-cursor)/ms||batch.some((c,i)=>c.time!==cursor+i*ms||c.end!==c.time+ms))throw Error(`${iv}: historische Kerzen fehlen; Coin wird nicht als vollständig geprüft gewertet.`);
      rows=rows.concat(batch);cursor=next;
    }candles[iv]=rows;
  }return candles;
}
export async function runPullbackBacktest({symbols,history,now=Date.now(),from,to,signal,workerFactory,progress=()=>{},completed=()=>{},feePct=PULLBACK.feePct,slippagePct=PULLBACK.slippagePct}) {
  const window={...pullbackBacktestRange(now),...(from!=null?{from}:{}),...(to!=null?{to}:{})};
  if(![feePct,slippagePct].every(v=>Number.isFinite(v)&&v>=0&&v<=5)||!(window.to>window.from)||window.to-window.from>PULLBACK.maxHistoryDays*86400000)throw Error('Ungültiger Rücksetzer-Testzeitraum oder Kosten.');
  const records=[],errors=[];let checked=0;
  for(const coin of symbols){cancelled(signal);progress({done:checked,total:symbols.length,symbol:coin.symbol});try{
    if(!coin.market)throw Error('Börsenmarkt aus der Vorauswahl noch nicht verfügbar.');
    const candles=await loadPullbackHistory({...coin,...window,history,signal,progress:p=>progress({done:checked,total:symbols.length,...p})});
    const batch=await pullbackWorkerJob(workerFactory,{type:'backtest',...coin,...window,candles},signal);cancelled(signal);records.push(...batch);checked++;await completed(coin,batch,window);
  }catch(e){cancelled(signal);errors.push({symbol:coin.symbol,text:e.message});} }
  return {version:PULLBACK.version,at:now,...window,symbols,checked,errors,records,feePct,slippagePct,statistics:pullbackStatistics(records,feePct,slippagePct)};
}
