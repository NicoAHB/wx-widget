import { ANALYSIS_LEARNING, compactLearningSignal, learningVersion, topDownLearningOutcome } from './analysis-learning.mjs';
import { evaluateTopDown, TOP_DOWN } from './analysis-top-down.mjs';
import { runNyBacktest } from './ny-open-backtest.mjs';
import { nyWait } from './ny-open-history.mjs';
import { INTERVAL_MS } from './market-intervals.mjs';
const cancelled=s=>{if(s?.aborted)throw s.reason||new globalThis.DOMException('Abgebrochen','AbortError');};
export async function scanTopDownLearning({candles,symbol,market,from,to,signal}){const records=[],used=new Set(),cache={},locks={1:0,'-1':0},indices={'4h':0,'1h':0,'15m':0};
  const rows=candles['15m'];for(let i=0;i<rows.length;i++){cancelled(signal);const c=rows[i];if(c.end<from||c.end>to)continue;if(i%32===0)await nyWait(0,signal);const frames={};
    for(const iv of ['4h','1h','15m']){const all=candles[iv];while(indices[iv]<all.length&&all[indices[iv]].end<=c.end)indices[iv]++;frames[iv]=all.slice(Math.max(0,indices[iv]-TOP_DOWN.history),indices[iv]);}
    const r=evaluateTopDown({candles:frames,now:c.end,symbol,market,cache}),s=r.signal;if(!s)continue;const setup=[s.version,s.symbol,s.market,s.direction,s.setupId].join('|');if(used.has(setup)||s.at<locks[s.direction])continue;
    s.learningVersion=learningVersion('top-down');const outcome=topDownLearningOutcome(s,rows.slice(i+1,i+1+ANALYSIS_LEARNING.topDownHoldMs/900000),to);used.add(setup);locks[s.direction]=s.at+TOP_DOWN.cooldownMs;
    records.push({signal:compactLearningSignal(s),outcome,source:'backtest',updatedAt:to});
  }return records;}
export async function runAnalysisLearningBacktest({id,symbols,options,history,now=Date.now(),signal,worker,progress=()=>{},completed=()=>{},from=Math.floor((now-ANALYSIS_LEARNING.backtestDays*86400000)/900000)*900000,to=Math.floor(now/900000)*900000}){
  if(id==='ny-open'){const report=await runNyBacktest({symbols,options,history,now,signal,progress});const records=report.trades.map(t=>{const s={...t.signal,learningVersion:learningVersion(id,t.signal.options)};return{signal:compactLearningSignal(s),outcome:nyLearningOutcomeFromTrade(t),source:'backtest',updatedAt:now};});return{...report,records};}
  const records=[],errors=[];let done=0;for(const coin of symbols){cancelled(signal);try{if(!coin.market)throw Error('Börsenmarkt aus der Vorauswahl fehlt.');const candles={};
    for(const iv of ['4h','1h','15m']){const ms=INTERVAL_MS[iv],end=Math.floor(to/ms)*ms,start=Math.floor(from/ms)*ms-TOP_DOWN.history*ms;let rows=[];for(let cursor=start;cursor<end;){cancelled(signal);const next=Math.min(end,cursor+ANALYSIS_LEARNING.historyChunkDays*86400000);progress({done,total:symbols.length,symbol:coin.symbol,interval:iv});const batch=await history({...coin,timeframe:iv,from:cursor,to:next,signal});if(batch.length!==(next-cursor)/ms||batch.some((c,i)=>c.time!==cursor+i*ms||c.end!==c.time+ms))throw Error(iv+': historisches Fenster unvollständig.');rows=rows.concat(batch);cursor=next;}candles[iv]=rows;}
    const job={type:'scan',candles,...coin,from,to},batch=worker?await worker(job,signal):await scanTopDownLearning({...job,signal});records.push(...batch);done++;await completed(batch);
  }catch(e){cancelled(signal);errors.push({symbol:coin.symbol,text:e.message});}}return{id,at:now,from,to,checked:done,symbols,errors,records};}
export function nyLearningOutcomeFromTrade(t){const o=t.signal.options?.breakeven!==false?t.breakeven:t.fixed;return{status:o.status,first:['target','stop','breakeven'].includes(o.status)?{...o,status:o.status==='target'?'target1':o.status}:null,complete:['target','stop','breakeven','expired','open_2h'].includes(o.status),fixed:t.fixed,breakeven:t.breakeven,checkedAt:o.checkedAt};}
