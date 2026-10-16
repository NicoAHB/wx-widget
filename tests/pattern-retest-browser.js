// Dieselben nativen UI-Prüfungen lokal in Chromium/WebKit und im veröffentlichten Paket.
module.exports=async function({moduleUrl,catalog=[]}){
 const output={},mark=(name,value)=>output[name]=!!value;
 const {patternLifecycle}=await import(moduleUrl),state=__g05.state,pat=__g09.pat;
 const saved={candles:state.candles,res:pat.res},books=JSON.stringify([state.positions,state.alarms,state.trades,localStorage.getItem('scalpdesk.patknow.v1')]);
 const step=state.candles.at(-1).time-state.candles.at(-2).time,end=state.candles.at(-1).time,start=end-499*step;
 const bar=(i,p)=>({time:start+i*step,closeTime:start+(i+1)*step-1,open:p,close:p,high:p+.1,low:p-.1,volume:100});
 function install(mode,dir='bull',id='falling_wedge'){
  const c=Array.from({length:500},(_,i)=>bar(i,58.5));
  const hit={id,kind:'form',dir,status:'Ausbruch bestätigt',q:88,t0:c[480].time,t1:c[496].time,i0:480,i1:496,
   levels:{brk:58.29,tgt:62.558,inv:57},lines:[[c[492].time,59.05,c[496].time,58.29,'res'],[c[492].time,57.6,c[496].time,57,'sup']],rules:[{k:'Kontrollierte bestätigte Formation',w:1,ok:true}],vals:{}};
  const prices={retest:[58.2,58],recovery:[58.2,59.63],firstBreak:[58,55],failure:[55,54.9],fulfilled:[62.7,54.9]}[mode];
  c[497]=bar(497,prices[0]);c[498]=bar(498,prices[1]);
  if(dir==='bear'){hit.levels=Object.fromEntries(Object.entries(hit.levels).map(([k,v])=>[k,120-v]));hit.lines=hit.lines.map(([a,p,b,q,k])=>[a,120-p,b,120-q,k==='res'?'sup':'res']);for(const x of c){const low=x.low;x.open=120-x.open;x.close=120-x.close;x.low=120-x.high;x.high=120-low;}}
  state.candles=c;pat.res={...pat.res,hits:[hit]};__g09.chipPaint();return __g09.chipRows()[0];
 }
 try{
  mark('all19StillRecognized',catalog.length===19&&catalog.every(({id,candles})=>__g09.engine().detect(candles,{from:15,step:3600000}).hits.some(h=>h.id===id)));
  for(const[dir,id]of[['bull','falling_wedge'],['bear','rising_wedge'],['bull','asc_triangle'],['bear','double_top']]){
   let row=install('retest',dir,id),button=document.querySelector('.chart-pattern-chip');
   mark(id+'RetestSelectable',row.status==='rücktest'&&!row.disabled&&!button.disabled&&button.textContent.includes('rücktest'));
   button.click();mark(id+'RetestCanDraw',__g09.chipSelection().includes(row.key));
   if(id!=='double_top')mark(id+'ProjectionKept',__g09.projectionRows().length===2);
   document.querySelector('.chart-pattern-info').click();
   const text=document.querySelector('#pat-quality').textContent;
   mark(id+'InfoExplains',document.querySelector('#pat-info').open&&text.includes('2 aufeinanderfolgenden Kerzenschlüssen')&&text.includes('0,25 × ATR')&&text.includes('Rücktest')&&!text.includes('mögliche Falle'));
   document.querySelector('#pat-info-x').click();
   row=install('recovery',dir,id);mark(id+'RecoveryConfirmed',row.status==='bestätigt'&&!row.disabled);
   row=install('firstBreak',dir,id);mark(id+'FirstBreakPending',row.status==='rücktest'&&row.failureCount===1&&!row.disabled);
   document.querySelector('.chart-pattern-info').click();mark(id+'PendingExplained',document.querySelector('#pat-quality').textContent.includes('1/2 Kerzenschlüsse bestätigt'));document.querySelector('#pat-info-x').click();
   row=install('failure',dir,id);mark(id+'TrueFailureDisabled',row.status==='gescheitert'&&row.disabled&&document.querySelector('.chart-pattern-chip').disabled&&!__g09.chipSelection().includes(row.key));
   document.querySelector('.chart-pattern-info').click();mark(id+'FailureStillInspectable',document.querySelector('#pat-info-zoom').textContent==='Ausgegraut im Chart zeigen'&&document.querySelector('#pat-quality').textContent.includes('Strukturbruch mit 2 Kerzenschlüssen'));document.querySelector('#pat-info-x').click();
   row=install('fulfilled',dir,id);mark(id+'FulfilledRemainsTerminal',row.status==='erfüllt'&&row.score===0&&row.disabled);
  }
  const row=install('retest');const before=patternLifecycle(row.hit,state.candles),c=state.candles.at(-1),old={...c};c.close=1;c.low=1;const after=patternLifecycle(row.hit,state.candles);Object.assign(c,old);
  mark('openCandleCannotFail',before.status===after.status&&before.failureCount===after.failureCount);
  const stamp=performance.now();for(let i=0;i<100;i++)__g09.chipPaint();mark('cachedPaintFast',performance.now()-stamp<1200);
  mark('booksUntouched',JSON.stringify([state.positions,state.alarms,state.trades,localStorage.getItem('scalpdesk.patknow.v1')])===books);
 }finally{
  for(const key of __g09.chipSelection())__g09.chipToggle(key);
  if(document.querySelector('#pat-info').open)document.querySelector('#pat-info-x').click();
  state.candles=saved.candles;pat.res=saved.res;__g09.chipPaint();__g05.scheduleDraw?.();
 }
 return output;
};
