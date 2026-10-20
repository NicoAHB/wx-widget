import { PULLBACK, pullbackRecordKey } from './trend-pullback-core.mjs';
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v),finite=Number.isFinite;
export function validatePullbackData(value) {
  if(!plain(value)||value.version!==1||!plain(value.records))throw Error('Ungültige Rücksetzer-Lerndaten.');
  const records=Object.values(value.records);if(records.length>PULLBACK.maxRecords)throw Error('Zu viele Rücksetzer-Signale.');
  for(const r of records){const s=r?.signal;if(!s||s.analysisId!==PULLBACK.id||s.version!==PULLBACK.version||!/^\w{2,20}USDT$/.test(s.symbol)||!['spot','futures'].includes(s.market)||![1,-1].includes(s.direction)||![s.at,s.expiresAt].every(Number.isSafeInteger)||s.expiresAt!==s.at+PULLBACK.holdMs||![s.entry,s.stop,s.target1,s.target2,s.rr,s.rr2].every(v=>finite(v)&&v>0)||s.direction*(s.entry-s.stop)<=0||s.direction*(s.target1-s.entry)<=0||s.direction*(s.target2-s.target1)<=0||!plain(s.features))throw Error('Ungültiges Rücksetzer-Signal im Archiv.');
    if(!plain(r.outcome)||!['open','gap','target1','target2','stop','trend','timeout'].includes(r.outcome.status))throw Error('Ungültiges Rücksetzer-Ergebnis.');
    const o=r.outcome.first;if(o&&(!['target1','target2','stop','trend','timeout'].includes(o.status)||!Number.isSafeInteger(o.at)||o.at<=s.at||o.at>s.expiresAt||!finite(o.exit)||o.exit<=0||!finite(o.grossR)))throw Error('Ungültiger Rücksetzer-Abschluss.');
  }
  return value;
}
export function pullbackData(value) { return plain(value)&&value.version===1&&plain(value.records)?value:{version:1,records:{},bootstrap:{status:'pending',completed:[],errors:[]}}; }
export function compactPullbackSignal(s) {const copy=globalThis.structuredClone(s);delete copy.chart;return copy;}
export function mergePullbackData(a,b) {
  a=pullbackData(a);b=pullbackData(b);const records={...a.records};
  for(const r of Object.values(b.records)){const k=pullbackRecordKey(r.signal),old=records[k];if(!old){records[k]=r;continue;}
    if(old.source==='live'&&r.source!=='live')continue;
    if(r.source==='live'&&old.source!=='live'){records[k]=r;continue;}
    // Derselbe Impuls: früheste Bestätigung bleibt das Original, kein später umgerechneter Einstieg.
    if(old.signal.at!==r.signal.at){records[k]=old.signal.at<r.signal.at?old:r;continue;}
    if(old.outcome?.first&&!r.outcome?.first)continue;
    if(old.outcome?.complete&&!r.outcome?.complete)continue;
    if((r.updatedAt||0)>(old.updatedAt||0))records[k]=r;
  }
  const sorted=Object.values(records).sort((a,b)=>a.signal.at-b.signal.at),trimmed=sorted.length>PULLBACK.maxRecords?sorted.filter(r=>!r.outcome?.complete).concat(sorted.filter(r=>r.outcome?.complete).slice(-(PULLBACK.maxRecords-sorted.filter(r=>!r.outcome?.complete).length))):sorted;
  const ba=a.bootstrap||{},bb=b.bootstrap||{},latest=(bb.updatedAt||0)>=(ba.updatedAt||0)?bb:ba,
    sameRun=ba.runId===bb.runId&&ba.from===bb.from&&ba.to===bb.to,
    completed=[...new Set(sameRun?[...(ba.completed||[]),...(bb.completed||[])]:latest.completed||[])];
  return {version:1,records:Object.fromEntries(trimmed.map(r=>[pullbackRecordKey(r.signal),r])),bootstrap:{...latest,completed}};
}
export function pullbackBackupData(value) {
  const copy=globalThis.structuredClone(pullbackData(value));for(const r of Object.values(copy.records)){delete r.message;delete r.telegram;delete r.claim;}
  return copy;
}
export function validatePullbackModel(value){
  if(!plain(value)||value.version!==PULLBACK.version)throw Error('Ungültiges Rücksetzer-Lernmodell.');
  for(const m of [value.active,...(value.versions||[])].filter(Boolean)){
    if(m.version!==PULLBACK.version||!Array.isArray(m.coins)||!m.coins.every(s=>/^[A-Z0-9]{2,20}USDT$/.test(s))||![m.weights,m.mean,m.scale].every(a=>Array.isArray(a)&&a.length<128&&a.every(finite))||m.weights.length!==m.mean.length+1||m.mean.length!==m.scale.length||m.scale.some(v=>v<=0)||!finite(m.trainThrough)||!finite(m.testFrom)||m.trainThrough>=m.testFrom)throw Error('Ungültige Koeffizienten oder zeitliche Trennung im Lernmodell.');
  }return value;
}
