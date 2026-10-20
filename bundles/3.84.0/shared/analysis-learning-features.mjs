// Keine Daten der Signal-Kerze nach ihrem Schluss; keine laufenden Heikin-Ashi-Kerzen.
export function topDownLearningFeatures(s,rows,values){const v=values.at(-1),atr=v.atr,last=rows.at(-1),before=rows.slice(-21,-1),volume=before.reduce((n,c)=>n+c.volume,0)/before.length;return{
  atrPct:atr/last.close*100,riskPct:Math.abs(s.entry-s.stop)/s.entry*100,rr:s.rr,zoneATR:(s.zone.high-s.zone.low)/atr,entryZoneATR:Math.abs(s.entry-(s.zone.high+s.zone.low)/2)/atr,
  confluence:s.zone.kinds.length,rsi:v.rsi,macdATR:(v.macd-v.signal)/atr,volumeRatio:volume>0?last.volume/volume:null,biasAligned:1};}
export function nyLearningFeatures(s,rows,values,index){const m=rows[index],c=rows[index+1],prior=rows.slice(Math.max(0,index-20),index),volume=prior.reduce((n,k)=>n+k.volume,0)/prior.length;return{
  atrPct:s.atr/c.close*100,riskPct:s.riskPct,rr:s.rr,zoneATR:(s.fvg.high-s.fvg.low)/s.atr,entryZoneATR:Math.abs(s.entry-(s.fvg.high+s.fvg.low)/2)/s.atr,
  rangePct:s.range.pct,bodyRatio:Math.abs(m.close-m.open)/(m.high-m.low),fvgATR:(s.fvg.high-s.fvg.low)/s.atr,volumeRatio:volume>0?m.volume/volume:null,biasAligned:s.bias===s.direction?1:0};}

