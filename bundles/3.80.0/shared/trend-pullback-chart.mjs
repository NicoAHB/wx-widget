import { PULLBACK, PULLBACK_OUTCOME } from './trend-pullback-core.mjs';
import { INTERVAL_MS } from './market-intervals.mjs';
// Gleiche SVG-Gruppen, Geometrie, Gesten und ProjectionInspector wie im Hauptchart.
export function drawPullbackChart({node,svg,under,over,result:r,geometry:g,palette:p,price,explain,inspector,interval='15m'}) {
  const {left,pw,top,bottom,min,max,timeX,y,data}=g,right=left+pw,s=r?.signal,setup=r?.setup,impulse=s?.impulse||setup?.impulse,zone=s?.zone||setup?.zone,color=r?.direction===-1?p.down:p.up;
  const back=node('g',{class:'analysis-chart pullback-chart'}),front=node('g',{class:'analysis-chart pullback-chart'});under.append(back);over.append(front);
  const why=`Trendfolge-Rücksetzer · ${r?.reason||'Wartet auf geschlossene Kerzen.'} 4h: Kurs und EMA 21/50/200 in Trendrichtung, höhere/tiefere bestätigte Hochs und Tiefs, ADX mindestens ${PULLBACK.minADX}. 1h: Fibonacci ${PULLBACK.fibLow*100}–${PULLBACK.fibHigh*100} %, Berührung von EMA 21–50 oder vorhandener 4h-Zone; RSI Long über ${PULLBACK.rsiLongFloor}, Short unter ${PULLBACK.rsiShortCeiling}. 15m: mindestens ${PULLBACK.confirmations} von 3 (Umkehrkerze, EMA-21-Schluss, MACD-Drehung). ${s?`Einstieg ${price(s.entry)}, Stop ${price(s.stop)}, Ziel 1 ${price(s.target1)}, Ziel 2 ${price(s.target2)}, CRV ${s.rr.toFixed(2)}. ${s.probabilityText}; erwartete Dauer ${Math.round(s.expectedMinutes)} Minuten (${s.durationSource}).`:''} Ziel 1 beendet das aktive Signal; Ziel 2 wird separat statistisch weiterbeobachtet. Gestrichelte Linien antippen: Kurs und Zeitpunkt. Modellhinweise, keine Orderausführung.`;
  const status=node('g',{class:'analysis-chart-button pullback-chart-info',role:'button',tabindex:0,'aria-label':why}),width=Math.min(pw-8,310);status.__analysisExplanation=why;
  status.append(node('rect',{x:left+4,y:top,width,height:44,fill:'transparent'}),node('rect',{x:left+4,y:top+8,width,height:25,rx:5,fill:'#10151c',stroke:color,'stroke-width':.6}),node('text',{x:left+10,y:top+25,fill:color,'font-size':10,'font-weight':700},`Rücksetzer · ${!r?.ready?'Daten fehlen':r?.phase==='signal'?'Signal':r?.phase==='watch'?'Beobachten':r?.direction?'Trend aktiv':'Kein Trend'} · ${s?.probabilityText||'Lernphase'} ⓘ`));
  status.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();explain(why);}});svg.append(status);
  for(const [key,label,col]of [['ema21','EMA 21 · 4h',p.up],['ema50','EMA 50 · 4h',p.ema],['ema200','EMA 200 · 4h',p.zero]]){
    let path='',lastValue=null;
    for(const v of r?.emaSeries||[]){if(!Number.isFinite(v[key]))continue;const xx=timeX(v.at);if(xx<left){lastValue=v[key];continue;}if(xx>right)break;
      if(!path&&lastValue!==null)path=`M${left},${y(lastValue)}`;
      path+=path?`H${xx}V${y(v[key])}`:`M${xx},${y(v[key])}`;lastValue=v[key];}
    if(lastValue!==null){if(!path)path=`M${left},${y(lastValue)}`;path+=`H${right}`;front.append(node('path',{d:path,fill:'none',stroke:col,'stroke-width':key==='ema200'?1.5:1.15,class:'pullback-ema','data-pullback-ema':key}));
      if(lastValue>=min&&lastValue<=max)front.append(node('text',{x:left+5,y:Math.max(top+54,Math.min(bottom-8,y(lastValue)-4)),fill:col,'font-size':9,class:'axis-label'},`${label} ${price(lastValue)}`));}
  }
  function box(z,cls,alpha){if(!z)return;const a=Math.max(left,timeX(z.time??impulse?.to.time??data[0].time)),ya=Math.max(top,y(z.high)),yb=Math.min(bottom,y(z.low));if(a<right&&yb>=ya)back.append(node('rect',{x:a,y:ya,width:right-a,height:Math.max(1,yb-ya),fill:color,'fill-opacity':alpha,stroke:color,'stroke-opacity':.4,class:cls}));}
  if(impulse){box({...impulse,time:impulse.to.time},'pullback-fib',.05);
    front.append(node('line',{x1:timeX(impulse.from.time),y1:y(impulse.from.price),x2:timeX(impulse.to.time),y2:y(impulse.to.price),stroke:color,'stroke-width':1.2,'stroke-dasharray':'3 3',class:'pullback-impulse'}));
    for(const [v,text]of [[impulse.low,'Fib-Zone'],[impulse.high,'38,2–61,8 %']])if(v>=min&&v<=max)front.append(node('text',{x:Math.min(right-6,Math.max(left+5,timeX(impulse.to.time)+5)),y:y(v)-4,fill:color,'font-size':9},text));
  }box(zone,'pullback-zone',.14);
  if(!s)return;
  const start=Math.max(left,timeX(s.at)),end=right,base=data.at(-1).time,ms=INTERVAL_MS[interval]||900000,dx=timeX(base+ms)-timeX(base),t0=base+(start-timeX(base))/dx*ms,toTime=base+(end-timeX(base))/dx*ms;
  const labels=[];
  for(const [value,label,col,kind]of [[s.entry,'Einstieg',color,'entry'],[s.stop,'Stop',p.down,'stop'],[s.target1,'Ziel 1',p.up,'target1'],[s.target2,'Ziel 2',p.up,'target2']]){
    const yy=y(value);if(start>=end)continue;
    if(value>=min&&value<=max){front.append(node('line',{x1:start,x2:end,y1:yy,y2:yy,stroke:col,'stroke-width':1.2,'stroke-dasharray':'6 4',class:'pullback-level','data-pullback-level':kind}));
      if(kind!=='entry'&&toTime>t0){const hit=node('line',{x1:start,x2:end,y1:yy,y2:yy,class:'pat-projection-hit','aria-hidden':'true'});front.append(hit);inspector.add({key:`pullback|${s.setupId}|${kind}`,family:'pullback',label:'Rücksetzer · '+label,color:col,element:hit,x1:start,x2:end,y1:yy,y2:yy,fromPrice:value,price:value,timeAt:f=>t0+(toTime-t0)*f,fractionAt:t=>(t-t0)/(toTime-t0)});}}
    labels.push({value,label,col,yy,kind});
  }
  labels.sort((a,b)=>a.yy-b.yy);const gap=Math.min(18,(bottom-top-85)/Math.max(1,labels.length-1));let previous=top+62-gap;
  for(const tag of labels){tag.labelY=Math.max(top+62,tag.yy,previous+gap);previous=tag.labelY;}
  const shift=Math.max(0,previous-bottom+12);
  for(const tag of labels)front.append(node('text',{x:right-7,y:tag.labelY-shift,fill:tag.col,'font-size':10,'font-weight':700,'text-anchor':'end','pointer-events':'none',class:'axis-label pullback-level-label'},`${tag.label} ${price(tag.value)}${tag.value>max?' ↑':tag.value<min?' ↓':''}`));
  const x0=timeX(s.at),y0=y(s.entry);if(x0>=left&&x0<=right&&y0>=top&&y0<=bottom)front.append(node('circle',{cx:x0,cy:y0,r:4,fill:color,class:'pullback-entry'}));
  if(r.record?.outcome?.first){const o=r.record.outcome.first;front.append(node('title',{},PULLBACK_OUTCOME[o.status]));}
}
