// Begrenzte UTC-Fenster über denselben historischen Börsen-Client wie die vorhandenen Backtests.
import { createMusterClient } from './muster-bot-feed.mjs';
import { INTERVAL_MS } from './market-intervals.mjs';
import { NY_OPEN } from './ny-open-core.mjs';
const INDEX='scalpdesk.idb.ny-open.cache-index.v1', PREFIX='scalpdesk.idb.ny-open.cache.';
const cancelled=s=>{if(s?.aborted)throw s.reason||new globalThis.DOMException('Abgebrochen','AbortError');};
export function nyWait(ms,signal){return new Promise((resolve,reject)=>{cancelled(signal);const t=setTimeout(done,ms);function done(){signal?.removeEventListener('abort',stop);resolve();}function stop(){clearTimeout(t);reject(signal.reason||new globalThis.DOMException('Abgebrochen','AbortError'));}signal?.addEventListener('abort',stop,{once:true});});}
export function createNyHistory({read=()=>null,write=()=>{},remove=()=>{},fetcher=fetch,now=Date.now,sleep=nyWait,peek=()=>null}={}){
  let tail=Promise.resolve(),last=-Infinity;
  const limited=(url,options)=>{const job=tail.catch(()=>{}).then(async()=>{cancelled(options.signal);await sleep(Math.max(0,NY_OPEN.requestSpacingMs-(now()-last)),options.signal);cancelled(options.signal);last=now();return fetcher(url,options);});tail=job.then(()=>{},()=>{});return job;};
  const client=createMusterClient({fetcher:limited,sleep});
  return async function history(q){
    cancelled(q.signal);const ms=INTERVAL_MS[q.timeframe],from=Math.floor(q.from/ms)*ms,to=Math.floor(q.to/ms)*ms;
    if(!(to>from))return[];
    const key=PREFIX+[q.symbol,q.market,q.timeframe,from,to].join('|'),valid=rows=>Array.isArray(rows)&&rows.length===(to-from)/ms&&rows.every((c,i)=>c.time===from+i*ms&&c.end===c.time+ms);
    const saved=read(key);if(valid(saved))return saved;
    const cached=await peek(q.symbol,q.market,q.timeframe);cancelled(q.signal);
    const slice=cached?.filter(c=>c.time>=from&&c.end<=to);if(valid(slice))return slice;
    const rows=await client.history({...q,from,to});cancelled(q.signal);
    if(!valid(rows))throw Error(`${q.timeframe}: unvollständiges NY-Datenfenster (${rows.length}/${(to-from)/ms}).`);
    write(key,rows);const keys=[...(read(INDEX)||[]).filter(k=>k!==key),key];while(keys.length>NY_OPEN.cacheEntries)remove(keys.shift());write(INDEX,keys);return rows;
  };
}
