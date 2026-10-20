// Reine Information. Keine zusätzlichen Punkte, Signalfilter oder Telegram-Empfänger.
import { PHASE_NAMES } from './market-phase-core.mjs';
export const ANALYSIS_CONTEXT=Object.freeze({eventWindowMs:30*60000});
export function analysisSuitability(id,phase,direction=0){if(!phase?.ready)return {state:'unknown',label:'Marktphase noch nicht verfügbar',text:phase?.reason||'Geschlossene 1H-Kerzen werden geladen.'};
  const name=PHASE_NAMES[phase.phase],base=`Feste 1H-Phase: ${name}. `;let state='limited',text='';
  if(id==='relative-strength')return {state:'information',label:`1H · ${name}`,text:base+'Relative Stärke vergleicht Coins; sie bestätigt keinen Einstieg.'};
  if(id==='range-return'){state=phase.phase===0?'fit':'unfavorable';text=phase.phase===0?'Seitwärts passt zur Rückkehr an Range-Grenzen.':'Gerichtete Phase: erhöhtes Risiko, dass eine Range-Grenze dauerhaft bricht.';}
  else if(id==='breakout-retest'){state=!direction||phase.phase===0||phase.phase===direction?'fit':'unfavorable';text=phase.phase===0?'Eine Verdichtung kann in einen Trend übergehen. Ausbruch und Rücktest bleiben erforderlich.':phase.phase===direction?'Ausbruch und bestätigte Phase zeigen in dieselbe Richtung.':'Ausbruch gegen die bestätigte Phase: ungünstig.';}
  else{state=phase.phase===0?'limited':direction&&phase.phase!==direction?'unfavorable':'fit';text=phase.phase===0?'Seitwärts: Trend-Einstiege sind weniger günstig.':direction&&phase.phase!==direction?'1H-Phase und Modellrichtung widersprechen sich. Die Modellregeln bleiben unverändert.':'Gerichtete Phase unterstützt die Suche in Trendrichtung.';}
  const label={fit:'Modell passt zur Marktphase',limited:'Eingeschränkt geeignet',unfavorable:'Aktuell ungünstig'}[state];
  return {state,label,at:phase.at,text:base+text+' Dies ist eine Einordnung; sie verändert die bisherigen Regeln und Zähler nicht. Die 1H-Phase bestätigt einen Wechsel erst nach zwei Kerzenschlüssen.'};
}
export function groupAnalysisEvents(signals,now){const valid=signals.filter(s=>s&&s.at<=now&&now<s.expiresAt),groups=[];
  for(const s of [...valid].sort((a,b)=>a.at-b.at||a.analysisId.localeCompare(b.analysisId))){let group=groups.find(g=>g.symbol===s.symbol&&g.market===s.market&&g.direction===s.direction&&Math.abs(s.at-g.at)<=ANALYSIS_CONTEXT.eventWindowMs);
    if(!group){group={symbol:s.symbol,market:s.market,direction:s.direction,at:s.at,models:[]};groups.push(group);}if(!group.models.some(m=>m.id===s.analysisId))group.models.push({id:s.analysisId,name:s.analysisName||s.analysisId,at:s.at});}
  return groups.filter(g=>g.models.length>1||valid.some(s=>s.symbol===g.symbol&&s.market===g.market&&s.direction!==g.direction)).map(g=>({...g,conflict:valid.some(s=>s.symbol===g.symbol&&s.market===g.market&&s.direction!==g.direction)}));
}
