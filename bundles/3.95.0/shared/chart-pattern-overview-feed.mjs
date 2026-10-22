// 3.65.0: serieller, flüchtiger Anzeige-Cache. Keine Signale buchen, kein Telegram/Lernen.
import { INTERVAL_MS, intervalEnd } from './market-intervals.mjs';
import { PATTERN_QUALITY_CONFIG } from './chart-pattern-quality.mjs';
export function createPatternOverviewFeed({ request, detect, changed = () => {}, now = () => Date.now(), intervals = PATTERN_QUALITY_CONFIG.overviewIntervals }) {
  const s = { key: '', context: null, entries: new Map(), busy: false, runs: 0, requests: 0 }, cache = new Map();
  let epoch = 0, controller = null, task = null;
  const notify = () => changed(s);
  function cancel() { epoch++;controller?.abort();controller=null;task=null;s.busy=false; }
  function context(ctx) {
    const key = ctx && /^[A-Z0-9]{2,24}USDT$/.test(ctx.symbol) && ['spot','futures'].includes(ctx.source) ? `${ctx.symbol}|${ctx.source}|${!!ctx.gap}` : '';
    if (key === s.key) return;
    if(s.key) { cache.delete(s.key);cache.set(s.key,s.entries);while(cache.size>3)cache.delete(cache.keys().next().value); }
    cancel();s.key=key;s.context=key?{...ctx}:null;s.entries=cache.get(key)||new Map();cache.delete(key);notify();
  }
  function usable(entry, iv) { return !!entry && !entry.error && entry.closedAt + INTERVAL_MS[iv] + 2500 >= now(); }
  async function tick(ctx, enabled = true) {
    context(ctx);
    if (!enabled || !s.key) { if(s.busy)cancel();return; }
    if(task)return task;
    const due=intervals.filter(iv=>!s.entries.has(iv)||s.entries.get(iv).nextAt<=now());if(!due.length)return;
    const token=epoch, captured={...s.context}, ctrl=new AbortController();controller=ctrl;s.busy=true;notify();
    const promise=(async()=>{
      for(const iv of due) {
        if(token!==epoch||ctrl.signal.aborted)break;
        const old=s.entries.get(iv);
        try {
          s.requests++;const result=await request(captured,iv,500,ctrl.signal);
          if(token!==epoch||ctrl.signal.aborted)break;
          if(result.source!==captured.source)throw Error('Marktquelle stimmt nicht mit dem Chart überein.');
          const c=result.candles?.filter(c=>c.closeTime<now()).slice(-500);
          if(!c?.length||c.length<60)throw Object.assign(Error('Weniger als 60 geschlossene Kerzen; nächste Prüfung am Kerzenschluss.'),{nextAt:c?.length?intervalEnd(c.at(-1).closeTime+1,iv)+2500:now()+INTERVAL_MS[iv]});
          if(c.some((v,i)=>![v.time,v.closeTime,v.open,v.high,v.low,v.close,v.volume].every(Number.isFinite)||v.low<=0||v.high<Math.max(v.open,v.close)||v.low>Math.min(v.open,v.close)||v.volume<0||v.closeTime!==intervalEnd(v.time,iv)-1||i>0&&v.time!==c[i-1].closeTime+1))throw Error('Unvollständige geschlossene Kerzen.');
          const last=c.at(-1);if(last.closeTime+INTERVAL_MS[iv]+2500<now())throw Error('Geschlossene Kerzen fehlen; Gesamtbild noch unvollständig.');
          let hits=old?.hits;
          // Wiederholte Abrufe / laufende Kerzen erzeugen keine weitere Analyse.
          if(old?.closedAt!==last.closeTime||old?.firstAt!==c[0].time) {
            s.runs++;const result=await detect(c,iv,ctrl.signal,captured);
            if(token!==epoch||ctrl.signal.aborted)break;
            const T=i=>c[Math.max(0,Math.min(c.length-1,i))]?.time;
            hits=result.hits.filter(h=>h.kind==='form').map(h=>({...h,lines:(h.lines||[]).map(([a,p,b,q,k])=>[T(a),p,T(b),q,k])}));
          }
          s.entries.set(iv,{candles:c,hits:hits||[],closedAt:last.closeTime,firstAt:c[0].time,at:now(),error:'',attempts:0,nextAt:intervalEnd(last.closeTime+1,iv)+2500});
        } catch(e) {
          if(token!==epoch||ctrl.signal.aborted)break;
          const attempts=(old?.attempts||0)+1, retry=Math.max(Math.min(300000,15000*2**Math.min(attempts-1,4)),Number(e.retryAfterMs)||Number(e.retryMs)||0);
          s.entries.set(iv,{...old,error:e.message||'Musteranalyse nicht verfügbar.',attempts,nextAt:Number.isFinite(e.nextAt)?Math.max(now()+retry,e.nextAt):now()+retry});
          // Ein Rate-Limit gilt auch für die übrigen Zeitebenen: kein Abrufsturm.
          if(e.rate||e.status===429||e.code===429||e.status===418) { for(const other of intervals)if(other!==iv){const v=s.entries.get(other);s.entries.set(other,{...v,error:v?.error||'API-Pause nach Anfrage-Limit.',nextAt:now()+retry});}break; }
        }
        notify();
      }
    })();
    task=promise;
    try{await promise;}finally{if(token===epoch){task=null;controller=null;s.busy=false;notify();}}
  }
  return { state:s,tick,cancel,usable };
}
