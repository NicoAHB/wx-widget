import { NY_OPEN, nyLiveRange, nyTerminal } from './ny-open-core.mjs';
import { NY_OUTCOME_TEXT } from './ny-open-view.mjs';
// Verwendet Geometrie und die bestehende Touch-/Info-Behandlung des Hauptcharts.
export function drawNyChart({node,svg,under,over,result:r,geometry:g,palette:p,price,explain,livePrice}){
  const {left,pw,top,bottom,min,max,timeX,y}=g,right=left+pw,rx=Math.min(g.rx||right-8,right-8),range=r?.range,s=r?.signal,o=r?.record?.outcome;
  const back=node('g',{class:'analysis-chart ny-chart'}),front=node('g',{class:'analysis-chart ny-chart'});under.append(back);over.append(front);
  const why=`NY Open Killzone · ${r?.reason||'Wartet auf NY-Range.'} 09:30–09:35 America/New_York definiert Hoch/Tief; neue Signale 09:35–10:30. Körper mindestens ${NY_OPEN.bodyRatio*100} %, FVG mindestens ${NY_OPEN.fvgATR} ATR. Einstieg erst nach Schluss der Folgekerze. Range mindestens ${NY_OPEN.minRangePct} %. Optionaler Richtungsfilter: vorhandener 4h-Top-Down-Bias; bei neutralem Bias kein Einstieg. Stop hinter Ausbruchskerze mit ${NY_OPEN.stopBufferATR} ATR Puffer; Stopabstand ${NY_OPEN.minStopPct}–${NY_OPEN.maxStopPct} %. Ziel ${NY_OPEN.rewardRisk}R. ${s?`${s.direction===1?'Long':'Short'} · Einstieg ${price(s.entry)} · Stop ${price(o?.stop||s.stop)} · Ziel ${price(s.target)}. ${NY_OUTCOME_TEXT[o?.status]||''}.`:''} ${s?.probabilityText?'Ziel vor Stop: '+s.probabilityText+'. ':''}Modellhinweise, keine Orderausführung.`;
  function button(x,yy,text,color,width=230){const w=Math.min(width,pw-8),xx=Math.max(left+4,Math.min(right-w-4,x)),cy=Math.max(top+22,Math.min(bottom-22,yy)),b=node('g',{class:'analysis-chart-button ny-chart-info',role:'button',tabindex:0,'aria-label':why});b.__analysisExplanation=why;b.append(node('rect',{x:xx,y:cy-22,width:w,height:44,fill:'transparent'}),node('rect',{x:xx,y:cy-11,width:w,height:24,rx:5,fill:'#10151c',opacity:.95,stroke:color,'stroke-width':.6}),node('text',{x:xx+6,y:cy+5,fill:color,'font-size':10,'font-weight':700},text));b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();explain(why);}});svg.append(b);return b;}
  const live=nyLiveRange(livePrice,range),status=button(left+4,top+22,`NY Open · ${live.text} ⓘ`,live.direction===-1?p.down:p.up,Math.min(330,pw-8));status.dataset.nyChartStatus='';
  if(!range)return;
  const x0=Math.max(left,Math.min(right,timeX(range.time))),y0=Math.max(top,y(range.high)),y1=Math.min(bottom,y(range.low));
  if(x0<right&&y1>=y0)back.append(node('rect',{x:x0,y:y0,width:right-x0,height:Math.max(1,y1-y0),fill:p.up,'fill-opacity':.065,class:'ny-range-box'}));
  const session=r.record?.session||r.session;
  if(session){const a=Math.max(left,timeX(session.rangeEnd)),b=Math.min(right,timeX(session.windowEnd));if(b>a)back.append(node('rect',{x:a,y:top,width:b-a,height:bottom-top,fill:p.up,'fill-opacity':.035,class:'ny-window'}));}
  const tags=[];
  function line(value,label,color,start=range.time,end=null,kind=''){
    const xx=Math.max(left,timeX(start)),xe=end?Math.min(right,timeX(end)):right;if(xx>=xe)return;
    const yy=y(value);if(value>=min&&value<=max)front.append(node('line',{x1:xx,x2:xe,y1:yy,y2:yy,stroke:color,'stroke-width':1.15,'stroke-dasharray':'6 4',class:'ny-level','data-ny-level':kind}));
    tags.push({value,label,color,yy,kind});
  }
  function labels(){const rows=tags.sort((a,b)=>a.yy-b.yy),gap=Math.min(18,(bottom-top-76)/Math.max(1,rows.length-1));let previous=top+62-gap;
    for(const t of rows){t.labelY=Math.max(top+62,t.yy,previous+gap);previous=t.labelY;}
    const shift=Math.max(0,previous-(bottom-10));
    for(const t of rows){const yy=t.labelY-shift,actual=Math.max(top,Math.min(bottom,t.yy));if(Math.abs(yy-actual)>7)front.append(node('path',{d:`M${rx+4} ${actual}L${rx-2} ${yy}`,fill:'none',stroke:t.color,'stroke-opacity':.55}));front.append(node('text',{x:rx-5,y:yy,fill:t.color,'font-size':10,'font-weight':700,'text-anchor':'end',class:'ny-level-label','data-ny-label':t.kind},`${t.label} ${price(t.value)}${t.value>max?' ↑':t.value<min?' ↓':''}`));}
  }
  line(range.high,'Range-Hoch',p.up,range.time,null,'range-high');line(range.low,'Range-Tief',p.down,range.time,null,'range-low');
  if(!s||s.nyDay!==session?.day){labels();return;}
  const color=s.direction===1?p.up:p.down,terminal=nyTerminal(o),end=terminal?o.at||o.checkedAt:null;
  if(s.fvg){const z=s.fvg,a=Math.max(left,timeX(z.knownAt)),b=end?Math.min(right,timeX(end)):right,ya=Math.max(top,y(z.high)),yb=Math.min(bottom,y(z.low));if(b>a&&yb>=ya)back.append(node('rect',{x:a,y:ya,width:b-a,height:Math.max(2,yb-ya),fill:color,'fill-opacity':.14,stroke:color,'stroke-opacity':.6,class:'ny-fvg-box'}));}
  for(const [v,label,col,kind]of [[s.entry,s.entryMode==='limit'?'Limit-Einstieg':'Einstieg',color,'entry'],[o?.stop||s.stop,'Stop',p.down,'stop'],[s.target,'Ziel 2R',p.up,'target']])line(v,label,col,s.at,end,kind);
  labels();
  const xx=timeX(s.at),yy=y(s.entry);if(xx>=left&&xx<=right&&yy>=top&&yy<=bottom)front.append(node('circle',{cx:xx,cy:yy,r:4,fill:color,stroke:'#10151c','stroke-width':1.5,class:'ny-entry-mark'}));
  if(terminal&&o.at&&o.exit){const ex=timeX(o.at),ey=y(o.exit);if(ex>=left&&ex<=right&&ey>=top&&ey<=bottom)front.append(node('circle',{cx:ex,cy:ey,r:4,fill:o.status==='target'?p.up:p.down,class:'ny-exit-mark'}));}
}
