import { PULLBACK, PULLBACK_DELIVERY_KEY, PULLBACK_OUTCOME, pullbackRecordKey } from './trend-pullback-core.mjs';
// Bestehende sendPhoto-Pipeline für den Einstieg; nur Antworten auf sicher bestätigte Foto-Nachrichten.
export function createPullbackReplies({read,write,destination,allowed,claim,sendReply,now=Date.now,log=()=>{}}) {
  const pending=new Set();
  function remember(s,response,target=destination()){if(s.analysisId!==PULLBACK.id||!response.ok||!response.id)return;if(!target)return;
    const saved=read(PULLBACK_DELIVERY_KEY)||{};write(PULLBACK_DELIVERY_KEY,{...saved,[pullbackRecordKey(s)]:{messageId:response.id,chat:target.chat,thread:target.thread||'',botId:target.token.split(':')[0],at:now(),sent:[]}});
  }
  // 3.82.2: läuft jede Sekunde – zuerst billig filtern (nur Live-Datensätze mit zugestellter Einstiegsnachricht), Zustellliste und Ziel
  // einmal lesen statt je Datensatz (bis zu 20.000 inklusive Rücktest)
  async function reconcile(records){const delivered=read(PULLBACK_DELIVERY_KEY)||{};if(!Object.keys(delivered).length)return;const target=destination();if(!target)return;
   for(const r of records){if(r.source!=='live')continue;const s=r.signal,key=pullbackRecordKey(s),saved=delivered[key];
    if(!saved||!allowed(s)||saved.chat!==target.chat||saved.thread!==(target.thread||'')||saved.botId!==target.token.split(':')[0])continue;
    const events=[];if(r.outcome.first)events.push({kind:r.outcome.first.status,at:r.outcome.first.at,r:r.outcome.first.grossR});
    if(r.outcome.target2At&&r.outcome.first?.status!=='target2')events.push({kind:'target2',at:r.outcome.target2At,r:s.rr2});
    for(const e of events){const eventKey=key+'|'+e.kind;if(saved.sent.includes(e.kind)||pending.has(eventKey))continue;pending.add(eventKey);
      let claimed=false;
      try{if(!await claim('analysis:pullback-reply:'+eventKey,PULLBACK.maxHistoryDays*86400000))continue;claimed=true;
        if(!allowed(s)||JSON.stringify(destination())!==JSON.stringify(target))continue;
        const text=`${s.symbol.replace(/USDT$/,'/USDT')} · ${PULLBACK_OUTCOME[e.kind]} · ${e.r>=0?'+':''}${e.r.toFixed(2).replace('.',',')} R brutto${e.kind==='target2'&&r.outcome.first?.status==='target1'?' · Weiterbeobachtung nach Ziel 1':''}`;
        const response=await sendReply(target,saved.messageId,text);
        if(!response?.ok)log({kind:'error',symbol:s.symbol,text:'Rücksetzer-Ergebnisantwort unbestätigt; kein blinder Doppelversand.'});
        markSent(key,e.kind);claimed=false;
      }catch(error){log({kind:'error',symbol:s.symbol,text:'Rücksetzer-Ergebnisantwort unbestätigt ('+(error?.message||error)+'); kein blinder Doppelversand.'});}
      // 3.82.2: auch nach einer Ausnahme als erledigt merken – sonst wurde die verbrauchte Sperre jede Sekunde erneut geprüft und nach
      // ihrem Ablauf doch doppelt gesendet
      finally{if(claimed)markSent(key,e.kind);pending.delete(eventKey);}
    }
  }}
  function markSent(key,kind){const data=read(PULLBACK_DELIVERY_KEY)||{};if(data[key])write(PULLBACK_DELIVERY_KEY,{...data,[key]:{...data[key],sent:[...new Set([...(data[key].sent||[]),kind])]}});}
  return {remember,reconcile};
}
