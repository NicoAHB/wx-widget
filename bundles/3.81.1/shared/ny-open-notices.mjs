import { analysisSignalKey } from './analysis-delivery.mjs';
import { NY_OPEN, nyTerminal } from './ny-open-core.mjs';
import { NY_OUTCOME_TEXT } from './ny-open-view.mjs';
// Kurze, eindeutige Ereignisse statt dauerhaft blinkender Richtungsanzeigen.
export function nyNoticeEvents(journal,now){const events=[];for(const r of Object.values(journal?.records||{})){const s=r.signal;if(!s)continue;const key=analysisSignalKey(s),o=r.outcome;
  const add=(type,at,tone,reason)=>{if(now>=at&&now<at+NY_OPEN.signalAgeMs)events.push({id:key+'|'+type,analysisId:NY_OPEN.id,symbol:s.symbol,market:s.market,type,at,until:at+NY_OPEN.signalAgeMs,tone,reason,signal:s,acknowledged:false});};
  if(now<s.expiresAt&&!nyTerminal(o))add('entry',s.at,s.direction===1?'long':'short',`${s.symbol.replace(/USDT$/,'/USDT')} · ${s.direction===1?'Long':'Short'}: NY-Range-Ausbruch + Displacement + bestätigtes FVG. ${s.entryMode==='limit'?'Limit wartet in der FVG-Mitte.':'Schlusskurs-Einstieg bestätigt.'}`);
  if(['target','stop','breakeven'].includes(o?.status))add('ny-'+o.status,o.at,o.status==='target'?'long':'short',`${s.symbol.replace(/USDT$/,'/USDT')} · NY Open: ${NY_OUTCOME_TEXT[o.status]}. Geschlossene 1m-Kerze; Modellhinweis, keine Ausführungsbestätigung.`);
}return events;}
export function nyNoticeCurrent(e,r,now){if(e.type==='entry')return !!r.signal&&!nyTerminal(r.record?.outcome)&&now<r.signal.expiresAt&&e.id===analysisSignalKey(r.signal)+'|entry';return e.at===r.record?.outcome?.at&&e.type==='ny-'+r.record?.outcome?.status;}
