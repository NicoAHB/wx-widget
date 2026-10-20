import { NY_OPEN, nyOptions, nySession, evaluateNyOpen, nyOutcome } from './ny-open-core.mjs';
import { nyDay, nyTime, shiftNyDay } from './ny-open-time.mjs';
import { TOP_DOWN } from './analysis-top-down.mjs';
export function nyBacktestSessions(now,options){const sessions=[];for(let i=NY_OPEN.backtestDays-1;i>=0;i--){const day=shiftNyDay(nyDay(now),-i),s=nySession(nyTime(day,12),options);if(s.eligible&&s.windowEnd+(NY_OPEN.holdMinutes+(options.limitEntry?NY_OPEN.limitMinutes:0))*60000<=now)sessions.push(s);}return sessions;}
export function nyNetR(s,o,feePct,slippagePct){return Number.isFinite(o.grossR)?o.grossR-(s.entry+o.exit)*(feePct+slippagePct)/100/Math.abs(s.entry-s.stop):null;}
export function nyStatistics(trades,policy,feePct,slippagePct){const rows=trades.map(t=>({s:t.signal,o:t[policy]})),resolved=rows.filter(t=>Number.isFinite(t.o.grossR)).sort((a,b)=>a.o.at-b.o.at||a.s.symbol.localeCompare(b.s.symbol));let losses=0,maxLosses=0,net=0,wins=0;for(const {s,o}of resolved){const r=nyNetR(s,o,feePct,slippagePct);net+=r;if(r>0){wins++;losses=0;}else if(r<0)maxLosses=Math.max(maxLosses,++losses);else losses=0;}return{signals:rows.length,filled:rows.filter(t=>t.o.filledAt!==null).length,resolved:resolved.length,wins,winrate:resolved.length?wins/resolved.length*100:null,averageR:resolved.length?net/resolved.length:null,netR:net,maxLosses,expired:rows.filter(t=>t.o.status==='expired').length,open:rows.filter(t=>t.o.status==='open_2h').length,missing:rows.filter(t=>t.o.status==='data-gap').length};}
// Gleiche Signale, gleiche Kurse, gleiche Kosten; nur die Stop-Verwaltung unterscheidet sich.
export async function runNyBacktest({symbols,history,now=Date.now(),options={},feePct=NY_OPEN.feePct,slippagePct=NY_OPEN.slippagePct,signal,progress=()=>{}}){
  if(![feePct,slippagePct].every(v=>Number.isFinite(v)&&v>=0&&v<=5))throw Error('Kosten je Seite müssen zwischen 0 und 5 % liegen.');
  const cfg=nyOptions(options),sessions=nyBacktestSessions(now,cfg),trades=[],errors=[],coins=symbols;let done=0,checked=0;const total=coins.length*sessions.length;
  const stop=()=>{if(signal?.aborted)throw signal.reason||new globalThis.DOMException('Abgebrochen','AbortError');};
  for(const coin of coins){stop();let higher=[];if(!coin.market){errors.push({symbol:coin.symbol,text:'Börsenmarkt aus Vorauswahl noch nicht verfügbar.'});done+=sessions.length;continue;}
    if(cfg.biasFilter&&sessions.length){try{higher=await history({...coin,timeframe:'4h',from:Math.floor(sessions[0].rangeStart/14400000)*14400000-TOP_DOWN.history*14400000,to:Math.floor(sessions.at(-1).windowEnd/14400000)*14400000,signal});}catch(e){stop();errors.push({symbol:coin.symbol,text:e.message});done+=sessions.length;continue;}}
    for(const session of sessions){stop();progress({done,total,symbol:coin.symbol,day:session.day});try{
      const one=await history({...coin,timeframe:'1m',from:session.atrFrom,to:session.windowEnd+(NY_OPEN.holdMinutes+(cfg.limitEntry?NY_OPEN.limitMinutes:0))*60000,signal});stop();
      const r=evaluateNyOpen({candles:{'1m':one,'4h':higher},now:session.windowEnd,symbol:coin.symbol,market:coin.market,options:cfg});
      if(!r.ready||r.phase==='bias-data')throw Error(r.reason);
      checked++;if(r.signal){const s=r.signal,end=one.at(-1).end;trades.push({signal:s,fixed:nyOutcome(s,one,end,false),breakeven:nyOutcome(s,one,end,true)});delete s.chart;}
    }catch(e){stop();errors.push({symbol:coin.symbol,day:session.day,text:e.message});}finally{done++;progress({done,total,symbol:coin.symbol,day:session.day});}}
  }
  return{version:NY_OPEN.version,at:now,days:NY_OPEN.backtestDays,from:sessions[0]?.day,to:sessions.at(-1)?.day,options:cfg,feePct,slippagePct,symbols:coins,sessions:sessions.length,checked,errors,trades,fixed:nyStatistics(trades,'fixed',feePct,slippagePct),breakeven:nyStatistics(trades,'breakeven',feePct,slippagePct)};
}
