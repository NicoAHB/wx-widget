import { PULLBACK, pullbackRecordKey } from './trend-pullback-core.mjs';
export function pullbackHighlights({symbols,settings,result,ack={},available=true}) {
  const coins=[],row=settings.rows?.[PULLBACK.id];if(!available||!row)return {coins,count:0,pulse:false};
  for(const symbol of symbols){if(row.coins?.[symbol]===false)continue;const r=result(symbol);if(!r?.ready)continue;
    if(r.phase==='signal'&&r.signal&&r.eligible){const key=pullbackRecordKey(r.signal);coins.push({symbol,kind:'signal',direction:r.signal.direction,key,pulse:!(ack.coins?.[symbol]||[]).includes(key),rowPulse:!(ack.row||[]).includes(key)});}
    else if(r.phase==='watch')coins.push({symbol,kind:'watch',direction:r.direction,pulse:false});
  }
  const active=coins.filter(c=>c.kind==='signal');return {coins,count:active.length,pulse:active.some(c=>c.rowPulse)};
}
