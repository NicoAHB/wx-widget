// 3.77.5: Rücktest, echte Invalidierung und Terminalreihenfolge aller 19 Formationen.
let pass=0,fail=0;const check=(name,ok)=>{ok?pass++:fail++;console.log(`${ok?'✓':'✗'} ${name}`);};
(async()=>{
 const {confirmedPatternLifecycle:L,PATTERN_RETEST_CONFIG:C}=await import('../shared/pattern-lifecycle.mjs');
 const {patternChipState}=await import('../shared/chart-pattern-chips.mjs');
 const {chartPatternQuality,patternOverview,repricePatternQuality}=await import('../shared/chart-pattern-quality.mjs');
 const {projectPatternLines}=await import('../shared/pattern-projection.mjs');
 const step=7200000,base=Date.UTC(2026,9,1);
 const bar=(i,p=102)=>({time:base+i*step,closeTime:base+(i+1)*step-1,open:p,high:p+1,low:p-1,close:p,volume:100});
 const rows=()=>Array.from({length:25},(_,i)=>bar(i));
 const families={double_top:['bear'],double_bottom:['bull'],triple_top:['bear'],triple_bottom:['bull'],head_shoulders:['bear'],inv_head_shoulders:['bull'],
  asc_triangle:['bull'],desc_triangle:['bear'],sym_triangle:['bull','bear'],rising_wedge:['bear'],falling_wedge:['bull'],asc_channel:['bull','bear'],desc_channel:['bull','bear'],rectangle:['bull','bear'],flag_bull:['bull'],flag_bear:['bear'],pennant_bull:['bull'],pennant_bear:['bear'],cup_handle:['bull']};
 const hit=(id,dir)=>({id,dir,kind:'form',q:90,status:'Ausbruch bestätigt',t0:base+10*step,t1:base+24*step,levels:{brk:100,inv:90,tgt:120},lines:[[base+10*step,101.4,base+24*step,100,'res'],[base+10*step,90,base+24*step,90,'sup']]});
 const mirror=(h,c)=>{const r=structuredClone(h);r.levels=Object.fromEntries(Object.entries(r.levels).map(([k,v])=>[k,200-v]));r.lines=r.lines.map(([a,p,b,q,k])=>[a,200-p,b,200-q,k==='res'?'sup':'res']);return[r,c.map(x=>({...x,open:200-x.open,close:200-x.close,high:200-x.low,low:200-x.high}))];};
 const calc=(h,c,opt={})=>L(h,c,{now:c.at(-1).closeTime+1,...opt});
 check('Konstanten: ATR14, 0,25 ATR Puffer, 0,5 ATR Rücktest, zwei Schlusskerzen',C.atrPeriod===14&&C.bufferAtr===.25&&C.retestAtr===.5&&C.failureCloses===2&&Object.isFrozen(C));
 for(const[id,directions]of Object.entries(families))for(const dir of directions){
  const go=extra=>{const h=hit(id,dir),c=[...rows(),...extra];return dir==='bear'?mirror(h,c):[h,c];};
  const cases=[['Ausbruch',[], 'bestätigt'],['normaler Rücktest',[bar(25,99)],'rücktest'],['Erholung',[bar(25,99),bar(26,103)],'bestätigt'],['ein Strukturbruch',[bar(25,85)],'rücktest'],['zwei Strukturbrüche',[bar(25,85),bar(26,84)],'gescheitert'],['Struktur hält nach Erholung',[bar(25,85),bar(26,99),bar(27,85)],'rücktest'],['Ziel erreicht',[bar(25,121)],'erfüllt']];
  for(const[name,extra,expected]of cases){const[h,c]=go(extra),v=calc(h,c),before=JSON.stringify([h,c]);const q=chartPatternQuality(h,c,{now:c.at(-1).closeTime+1,interval:'2h'}),chip=patternChipState(h,c,c.at(-1).closeTime+1);
   check(`${id} ${dir}: ${name}, Status/Chip/Score einheitlich`,v.status===expected&&q.status===expected&&chip.status===expected&&q.disabled===['gescheitert','erfüllt'].includes(expected)&&before===JSON.stringify([h,c]));
   if(name==='normaler Rücktest')check(`${id} ${dir}: auswählbar, Projektion und Gesamtbild bleiben aktiv`,!v.disabled&&projectPatternLines(h,c,{timeframe:'2h',now:c.at(-1).closeTime+1}).length===2&&patternOverview([{...q,hit:h,interval:'2h'}]).count===1);
  }
 }
 const h=hit('double_bottom','bull'),tail=extra=>[...rows(),...extra];
 const justClosed=tail([bar(25,85),bar(26,85)]);
 check('Laufende zweite Bruchkerze bestätigt kein Scheitern',calc(h,justClosed,{now:justClosed.at(-1).closeTime}).status==='rücktest');
 check('Dochte unter der Struktur reichen nicht',calc(h,tail([{...bar(25),low:50},{...bar(26),low:50}])).status==='bestätigt');
 check('Exakte Puffergrenze bleibt gültig',calc(h,tail([bar(25,89.5),bar(26,89.5)])).status==='rücktest');
 check('Zwei kleine Brüche innerhalb des ATR-Puffers bleiben gültig',calc(h,tail([bar(25,89.6),bar(26,89.6)])).status==='rücktest');
 check('Lücke darf zwei Bruchschlüsse nicht verbinden',calc(h,tail([bar(25,85),bar(27,85)])).status==='rücktest');
 check('Ungültiger Schluss unterbricht die Bestätigungsserie',calc(h,tail([bar(25,85),{...bar(26),close:NaN},bar(27,85)])).status==='rücktest');
 check('Nach Lücke sind zwei neue Schlusskerzen nötig',calc(h,tail([bar(25,85),bar(27,85),bar(28,85)])).status==='gescheitert');
 check('Erholung nach bestätigtem Scheitern reaktiviert nicht',calc(h,tail([bar(25,85),bar(26,85),bar(27,125)])).status==='gescheitert');
 check('Erfüllung bleibt trotz späterem Strukturbruch erhalten',calc(h,tail([bar(25,121),bar(26,85),bar(27,85)])).status==='erfüllt');
 check('Zielwick vor zweitem Bruchschluss erfüllt das Muster',calc(h,tail([{...bar(25,85),high:125},bar(26,85)])).status==='erfüllt');
 check('Zielwick zugleich mit bestätigtem Strukturbruch konservativ gescheitert',calc(h,tail([bar(25,85),{...bar(26,85),high:125}])).status==='gescheitert');
 check('Bestätigungskerzenwick zählt nicht als späteres Ziel',calc(h,rows().map((c,i)=>i===24?{...c,high:125}:c)).status==='bestätigt');
 const shock=calc(h,tail([{...bar(25,85),high:119,low:1},bar(26,85)]));
 check('Spätere große Spanne erweitert den eingefrorenen Puffer nicht',shock.atrAtBreakout===2&&shock.structureBuffer===.5&&shock.status==='gescheitert');
 check('Hintergrundcache und Hauptchart mit offener Kerze haben gleiche Live-Grenzen',calc(h,tail([bar(25,99)]),{liveOffset:1}).breakoutBoundary===calc(h,tail([bar(25,99),bar(26)]),{now:base+26*step}).breakoutBoundary);
 check('Altersgrenze unverändert zehn Kerzen',calc(h,tail(Array.from({length:11},(_,i)=>bar(25+i)))).status==='abgelaufen');
 const missing=rows().map(c=>({...c,high:undefined,low:undefined}));
 check('Fehlende ATR wird ehrlich ausgewiesen statt erfunden',calc(h,missing).atrAtBreakout===null&&calc(h,missing).structureBuffer===0);
 check('ATR der Formation als bekannter Fallback nutzbar',calc({...h,vals:{ATR:4}},missing).structureBuffer===1);
 check('Null-Volatilität ist verfügbar und kein fehlender Wert',calc(h,rows().map(c=>({...c,high:102,low:102}))).atrAtBreakout===0);
 check('Vorläufige/unbestätigte/neutrale Treffer bleiben im bisherigen Weg',[{...h,prelim:true},{...h,status:'nicht bestätigt'},{...h,dir:'neutral'},{...h,status:'ungültig'}].every(x=>calc(x,rows())===null));
 // Benutzerbeispiel: 58,20 liegt unter dem alten Ausbruch 58,29, aber über
 // der inzwischen gefallenen oberen Keillinie 58,10. Kein Strukturbruch.
 const w={...h,id:'falling_wedge',levels:{brk:58.29,tgt:62.558,inv:57},lines:[[base+20*step,59.05,base+24*step,58.29,'res'],[base+20*step,57.6,base+24*step,57,'sup']]};
 const wc=rows().map(c=>({...c,open:58.5,close:58.5,high:58.9,low:58.1})),wb=(i,p)=>({...bar(i,p),high:p+.1,low:p-.1});
 const wr=calc(w,[...wc,wb(25,58.2)]),rec=calc(w,[...wc,wb(25,58.2),wb(26,59.63)]);
 check('Fallender Keil: Rücklauf unter 58,29 bleibt gültig an schräger Grenze 58,10',wr.status==='rücktest'&&!wr.disabled&&Math.abs(wr.breakoutBoundary-58.10)<1e-9);
 check('Fallender Keil: anschließende Erholung 59,63 bleibt bestätigt',rec.status==='bestätigt'&&!rec.disabled);
 const closedWedge=[...wc,wb(25,58.2)],liveWedge=[...closedWedge,wb(26,59.63)],bg=chartPatternQuality(w,closedWedge,{now:base+26*step,interval:'2h',ageOffset:1}),main=chartPatternQuality(w,liveWedge,{now:base+26*step,interval:'2h'});
 check('Keil im Hintergrund rechnet die schräge Live-Grenze eine Kerze weiter',Math.abs(bg.breakoutBoundary-57.91)<1e-9&&bg.breakoutBoundary===main.breakoutBoundary&&bg.age===main.age&&bg.status===main.status);
 const q=chartPatternQuality(w,[...wc,wb(25,59)],{now:base+26*step,interval:'2h'});
 check('Live-Warnung nutzt schräge Grenze, nicht starr 58,29',!repricePatternQuality(q,w,58.2).breakoutPending&&repricePatternQuality(q,w,58).breakoutPending);
 const sw={...h,id:'rising_wedge',dir:'bear'};const[mw,mc]=mirror({...w,id:sw.id,dir:sw.dir},[...wc,wb(25,58.2)]);
 check('Steigender Keil: spiegelbildlicher Rücktest bleibt gültig',calc(mw,mc).status==='rücktest');
 const pastApex={...h,id:'sym_triangle',lines:[[base+20*step,104,base+24*step,100,'res'],[base+20*step,86,base+24*step,90,'sup']]};
 const ap=calc(pastApex,tail(Array.from({length:8},(_,i)=>bar(25+i,96))));
 check('Nach Dreiecksspitze kreuzen die Strukturgrenzen nicht weiter',ap.breakoutBoundary===95&&ap.invalidationBoundary===95&&ap.status==='rücktest');
 console.log(`\n${pass}/${pass+fail} bestanden`);process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
