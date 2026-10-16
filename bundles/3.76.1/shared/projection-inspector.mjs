// Reine Darstellung der bereits gezeichneten Musterlinien; keine neue Prognose.
import { projectionTime } from './pattern-projection.mjs';
import { timeIndex } from './chart-detail.mjs';
export function projectionIndexTime(candles, interval, index) {
  const last=candles.length-1;
  if(index>=last)return projectionTime(candles[last].time,interval,index-last);
  const i=Math.floor(index),a=candles[i]?.time,b=candles[i+1]?.time;
  return Number.isFinite(a)&&Number.isFinite(b)?a+(b-a)*(index-i):null;
}
export function projectionTimeIndex(candles, interval, time) {
  const last=candles.length-1,base=candles[last].time;
  if(interval!=='1M'||time<=base)return timeIndex(candles,time,interval);
  let slot=1;while(slot<101&&projectionTime(base,interval,slot)<time)slot++;
  const a=projectionTime(base,interval,slot-1),b=projectionTime(base,interval,slot);
  return last+slot-1+(time-a)/(b-a);
}
export function projectionPrice(value) {
  if (!Number.isFinite(value)) return '–';
  const v = Math.abs(value), digits = v >= 1000 ? 0 : v >= 100 ? 2 : v >= 1 ? 4 : v >= .01 ? 6 : 8;
  // Hohe Kurse wie gewünscht nur kürzen: 82.468,78 → 82.468; Rohwerte bleiben unverändert.
  return (v>=1000?Math.trunc(value):value).toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
// Trefferprüfung in CSS-Pixeln: auch bei SVG-Skalierung/Zoom bleibt das Fingerziel 26 px breit.
export function nearestProjection(lines, point, radius = 13) {
  let best = null;
  for (const line of lines) {
    const dx = line.b.x - line.a.x, dy = line.b.y - line.a.y, length2 = dx * dx + dy * dy;
    if (!(length2 > 0) || point.x < Math.min(line.a.x, line.b.x) - radius || point.x > Math.max(line.a.x, line.b.x) + radius) continue;
    const near = Math.max(0, Math.min(1, ((point.x-line.a.x)*dx+(point.y-line.a.y)*dy)/length2));
    const distance = Math.hypot(point.x-line.a.x-near*dx, point.y-line.a.y-near*dy);
    if (distance <= radius && (!best || distance < best.distance)) best = { line, distance, fraction: dx ? Math.max(0, Math.min(1, (point.x-line.a.x)/dx)) : near };
  }
  return best;
}
export function projectionValues(lines, selection) {
  const touched = lines.find(r => r.key === selection?.key);
  if (!touched) return null;
  const sample = r => { const f = r.fractionAt(selection.time); return Number.isFinite(f) && f >= -1e-8 && f <= 1+1e-8 ? { price: r.fromPrice+(r.price-r.fromPrice)*f, x: r.x1+(r.x2-r.x1)*f, y: r.y1+(r.y2-r.y1)*f } : null; };
  const point = sample(touched); if (!point) return null;
  // Der sichtbare Korridor kann auch aus zwei unterschiedlichen Mustern stammen.
  // Nur tatsächlich bis zu dieser Uhrzeit gezeichnete Linien verwenden; bei mehr
  // als zwei Linien bezeichnen „Oben/Unten“ die äußeren Grenzen.
  const prices=lines.map(sample).filter(Boolean).map(r=>r.price);
  const top=prices.length>=2?Math.max(...prices):null,bottom=prices.length>=2?Math.min(...prices):null;
  return { touched, point, top, bottom, spread: top !== null && bottom !== null ? Math.abs(top-bottom) : null };
}
export function placeProjectionLabel(point, size, bounds, obstacles = []) {
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v)), gap = 15;
  const overlap = (a,b) => Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
  const candidates = [];
  for (const x of [point.x+gap,point.x-size.width-gap]) for (const y of [point.y-size.height-gap,point.y+gap,point.y-size.height/2]) {
    const box = { x:clamp(x,bounds.left,bounds.right-size.width),y:clamp(y,bounds.top,bounds.bottom-size.height),...size };
    const covered = obstacles.reduce((n,o)=>n+overlap(box,o),0);
    const distance = Math.hypot(Math.max(box.x-point.x,0,point.x-box.x-size.width),Math.max(box.y-point.y,0,point.y-box.y-size.height));
    candidates.push({box,score:covered*100+distance});
  }
  return candidates.sort((a,b)=>a.score-b.score)[0].box;
}
export function createProjectionInspector(host) {
  const document=host.ownerDocument,win=document.defaultView;
  let rows = [], scope = '', selected = null, label = null, frame = null, obstacles = [];
  // Alle Labelkoordinaten liegen im Chart. Auch dessen vorhandene iPhone-90°-Drehung
  // und die Matrix des flüssigen Zooms werden über die echten SVG-Matrizen abgebildet.
  const transform=(m,x,y)=>({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f});
  function space() {
    const svg=host.querySelector(':scope > svg'),m=svg?.getScreenCTM();if(!m)return null;
    const inverse=m.inverse(),sx=host.clientWidth/svg.viewBox.baseVal.width,sy=host.clientHeight/svg.viewBox.baseVal.height;
    const physical=(x,y)=>{const p=transform(inverse,x,y);return{x:p.x*sx,y:p.y*sy};};
    const local=(element,x,y)=>{const p=transform(inverse.multiply(element.getScreenCTM()),x,y);return{x:p.x*sx,y:p.y*sy};};
    const rect=r=>{const points=[[r.left,r.top],[r.right,r.top],[r.right,r.bottom],[r.left,r.bottom]].map(([x,y])=>physical(x,y)),xs=points.map(p=>p.x),ys=points.map(p=>p.y);return{x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};};
    return{svg,sx,sy,physical,local,rect};
  }
  function close() { selected=null;label?.remove();label=null; }
  function begin(next) { rows=[];frame=null;label?.remove();label=null;if(scope!==next){selected=null;scope=next;} }
  function add(row) { rows.push(row); }
  function position() {
    if (!label || !frame || !selected) return;
    const values=projectionValues(rows,selected);if(!values){label.remove();label=null;return;}
    const s=space();if(!s)return;
    const anchor=s.local(values.touched.element,values.point.x,values.point.y);
    const viewport=win.visualViewport, vl=viewport?.offsetLeft||0,vt=viewport?.offsetTop||0;
    const visible=s.rect({left:vl,top:vt,right:vl+(viewport?.width||win.innerWidth),bottom:vt+(viewport?.height||win.innerHeight)});
    const right=Math.min(host.clientWidth,visible.x+visible.width)-7,bottom=Math.min(host.clientHeight,visible.y+visible.height)-7,left=Math.max(0,visible.x)+7,top=Math.max(0,visible.y)+7;
    label.hidden=false;label.style.maxWidth=Math.min(236,Math.max(0,right-left))+'px';
    if(!anchor||anchor.x<Math.max(frame.left*s.sx,left)||anchor.x>Math.min(frame.right*s.sx,right)||anchor.y<frame.top*s.sy||anchor.y>frame.bottom*s.sy||right-left<100||bottom-top<label.offsetHeight){label.hidden=true;return;}
    const p=placeProjectionLabel(anchor,{width:label.offsetWidth,height:label.offsetHeight},{left,top,right,bottom},obstacles);
    label.style.left=p.x+'px';label.style.top=p.y+'px';
  }
  function draw(svg,bounds) {
    frame=bounds;label?.remove();label=null;
    const values=selected&&projectionValues(rows,selected);if(!values)return;
    label=document.createElement('div');label.className='projection-inspector';label.setAttribute('role','status');label.style.setProperty('--projection-color',values.touched.color);
    const title=document.createElement('strong'),time=new Date(selected.time),fmt=v=>projectionPrice(v)+' $';
    title.textContent=projectionPrice(values.point.price)+' · '+time.toLocaleTimeString('de-DE',{timeZone:'UTC',hour:'2-digit',minute:'2-digit'});label.append(title);
    for(const [name,value] of [['Oben',values.top],['Unten',values.bottom],['Abstand',values.spread]]){const row=document.createElement('span'),key=document.createElement('span'),val=document.createElement('b');key.textContent=name;val.textContent=value===null?'–':fmt(value);row.append(key,val);label.append(row);}
    const note=document.createElement('small');note.textContent=time.toLocaleDateString('de-DE',{timeZone:'UTC',day:'2-digit',month:'2-digit'})+' · UTC · Linienprojektion';label.append(note);
    label.dataset.lineKey=selected.key;label.dataset.time=String(selected.time);label.dataset.price=String(values.point.price);host.append(label);
    const s=space();obstacles=s?[...svg.querySelectorAll('.axis-label,.last-tag,.magnet-g')].filter(n=>n.getAttribute('visibility')!=='hidden'&&n.style.display!=='none').map(n=>{const r=s.rect(n.getBoundingClientRect());return{x:r.x-3,y:r.y-3,width:r.width+6,height:r.height+6};}):[];position();
  }
  function tap(event,inspect=true,target=event.target) {
    const s=space();if(!s||!frame){close();return false;}
    const point=event.__chartTurned?{x:event.clientX,y:event.clientY}:s.physical(event.clientX,event.clientY);
    const inside=point.x>=frame.left*s.sx&&point.x<=frame.right*s.sx&&point.y>=frame.top*s.sy&&point.y<=frame.bottom*s.sy;
    // Deutlich beschriftete/antippbare bestehende Chart-Elemente behalten Vorrang.
    const blocked=target?.closest?.('[data-pat],[data-pat-ghost],[data-kiz],[data-zsig],.last-tag,.axis-label');
    const segments=inspect&&inside&&!blocked ? rows.map(row=>({a:s.local(row.element,row.x1,row.y1),b:s.local(row.element,row.x2,row.y2),row})).filter(l=>l.a&&l.b) : [];
    const nearest=nearestProjection(segments,point);if(!nearest){close();return false;}
    const row=nearest.line.row;selected={key:row.key,time:row.timeAt(nearest.fraction)};draw(s.svg,frame);return true;
  }
  win.addEventListener('scroll',position,{passive:true});
  win.visualViewport?.addEventListener('resize',position,{passive:true});
  win.visualViewport?.addEventListener('scroll',position,{passive:true});
  return {begin,add,draw,tap,position,close};
}
