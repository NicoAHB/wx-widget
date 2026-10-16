// Ereignisse statt Zustände: geschlossene Kerzen, Bestätigung, Ablauf und echte Gegenbefunde.
const assert=require('node:assert/strict');let passed=0,failed=0;
const check=(name,test)=>{try{test();passed++;console.log('✓ '+name);}catch(e){failed++;console.error('✗ '+name+' — '+e.message);}};
(async()=>{
 const {macdFindings:F,macdPaneLayout:L,MACD_CHART:C}=await import('../shared/macd-chart.mjs'),step=60000;
 const rows=(n=80)=>Array.from({length:n},(_,i)=>({time:i*step,closeTime:(i+1)*step-1,high:20,low:10,close:15}));
 const series=n=>({line:Array(n).fill(-1),signal:Array(n).fill(0)});
 function cross(direction=1,age=0){const r=rows(),s=series(r.length),index=r.length-1-age;for(let i=0;i<r.length;i++)s.line[i]=direction*(i<index?-1:1);return{r,s,options:{now:r.length*step}};}
 const run=x=>F(x.r,x.s,x.options);
 check('35 Schlusskerzen als gemeinsamer Mindestbedarf',()=>assert.equal(C.minBars,35));
 for(const direction of[1,-1])for(const age of[0,1,2])check((direction>0?'Bullish':'Bearish')+'e Signal- und Nullkreuzung mit Alter '+age,()=>{const f=run(cross(direction,age));assert.equal(f.ready,true);for(const k of['signal','zero']){assert.equal(f.events[k].direction,direction);assert.equal(f.events[k].age,age);assert.equal(f.events[k].confirmedAt,(80-age)*step);}});
 check('Bloß oberhalb der Linie sein ist kein neuer Crossover',()=>{const x=cross(1,5);assert.deepEqual(run(x).events,{});});
 check('Drei Kerzen alte Kreuzung ist abgelaufen',()=>assert.deepEqual(run(cross(1,3)).events,{}));
 check('Neue Gegenkreuzung ersetzt den vorherigen Befund',()=>{const x=cross(1,2);x.s.line[79]=-1;assert.equal(run(x).events.signal.direction,-1);assert.equal(run(x).events.zero.direction,-1);});
 check('Rückkehr genau zur Signallinie hebt die Bestätigung auf',()=>{const x=cross(1,1);x.s.line[79]=0;assert.equal(run(x).events.signal,undefined);assert.equal(run(x).events.zero,undefined);});
 check('Start genau auf der Linie darf zur echten Kreuzung werden',()=>{const x=cross();x.s.line[78]=0;assert.equal(run(x).events.signal.direction,1);});
 check('Positives Histogramm unter null ist keine positive Nullkreuzung',()=>{const x=cross();x.s.line.fill(-2);x.s.signal.fill(-1);x.s.line[79]=-.5;const f=run(x);assert.equal(f.events.signal.direction,1);assert.equal(f.events.zero,undefined);assert.ok(f.current.line<0&&f.current.histogram>0);});
 check('Offene Kerze zählt nicht als Kreuzung',()=>{const x=cross();x.options.now=79*step+1000;assert.deepEqual(run(x).events,{});});
 check('Am exakten Kerzenschluss ist die Kerze noch offen',()=>{const x=cross();x.options.now=x.r[79].closeTime;assert.deepEqual(run(x).events,{});});
 check('Direkt nach Kerzenschluss wird sie bestätigt',()=>{const x=cross();x.options.now=x.r[79].closeTime+1;assert.equal(run(x).events.signal.direction,1);});
 check('Fehlende Signalwerte erzeugen keinen Ersatz-Crossover',()=>{const x=cross();x.s.signal[78]=null;assert.equal(run(x).ready,false);});
 check('Vorlauf unter 35 geschlossenen Kerzen ist nicht bereit',()=>assert.equal(F(rows(34),series(34),{now:35*step}).ready,false));
 check('Ungleiche Serienlängen sind nicht bereit',()=>assert.equal(F(rows(),series(79),{now:80*step}).ready,false));
 check('Kerzenlücke wird nicht überbrückt',()=>{const x=cross();x.r[60].time++;assert.equal(run(x).ready,false);});
 check('Ungültige Kurse sind nicht bereit',()=>{const x=cross();x.r[60].low=NaN;assert.equal(run(x).ready,false);});
 check('Pause/Offline/Datenfehler neutralisieren jedes Ereignis',()=>{for(const issue of['pausiert','offline','Datenfehler']){const x=cross();x.options.issue=issue;const f=run(x);assert.equal(f.ready,false);assert.deepEqual(f.events,{});assert.equal(f.reason,issue);}});
 check('Fehlende nächste Schlusskerze sperrt alte Befunde',()=>{const x=cross();x.options.expiresAt=x.options.now;assert.equal(run(x).ready,false);});
 function divergence(direction=1){const r=rows(),s=series(r.length),field=direction===1?'low':'high';r[70][field]=direction===1?8:22;r[77][field]=direction===1?7:23;s.line.fill(-2*direction);s.line[70]=-3*direction;s.line[77]=-direction;return{r,s,options:{now:80*step}};}
 for(const direction of[1,-1])check((direction>0?'Bullish':'Bearish')+'e Divergenz an denselben zwei bestätigten Preis-Pivots',()=>{const f=run(divergence(direction));assert.equal(f.events.divergence.direction,direction);assert.equal(f.events.divergence.first,70);assert.equal(f.events.divergence.second,77);assert.equal(f.events.divergence.index,79);assert.equal(f.events.divergence.confirmedAt,80*step);});
 check('Divergenz benötigt zwei geschlossene rechte Nachbarn',()=>{const x=divergence();x.options.now=79*step+1000;assert.equal(run(x).events.divergence,undefined);});
 check('Offene Nachbarkerze bestätigt keinen Pivot',()=>{const x=divergence();x.options.now=x.r[79].closeTime;assert.equal(run(x).events.divergence,undefined);});
 check('Gleiche Kurs-Tiefs sind keine bullishe Divergenz',()=>{const x=divergence();x.r[77].low=x.r[70].low;assert.equal(run(x).events.divergence,undefined);});
 check('Gleiche MACD-Tiefs sind keine Divergenz',()=>{const x=divergence();x.s.line[77]=x.s.line[70];assert.equal(run(x).events.divergence,undefined);});
 check('Ein Preis-Tief mit gleich tiefem Nachbarn ist kein strikter Pivot',()=>{const x=divergence();x.r[78].low=x.r[77].low;assert.equal(run(x).events.divergence,undefined);});
 check('Fehlender MACD am Preis-Pivot erzeugt keine Divergenz',()=>{const x=divergence();x.s.line[70]=null;assert.equal(run(x).events.divergence,undefined);});
 check('Späteres Unterschreiten des zweiten Tiefs entkräftet die Divergenz',()=>{const x=divergence();const c=rows(81).at(-1);c.low=6;x.r.push(c);x.s.line.push(-1);x.s.signal.push(0);x.options.now=81*step;assert.equal(run(x).events.divergence,undefined);});
 check('Alte Divergenz leuchtet nach drei Kerzen nicht mehr',()=>{const x=divergence();x.r.push(...rows(83).slice(80));x.s.line.push(-1,-1,-1);x.s.signal.push(0,0,0);x.options.now=83*step;assert.equal(run(x).events.divergence,undefined);});
 check('Weiter zurückliegende Pivots außerhalb des Fensters zählen nicht',()=>{const x=divergence();x.r[5].low=x.r[70].low;x.s.line[5]=x.s.line[70];x.r[70].low=10;assert.equal(run(x).events.divergence,undefined);});
 check('Zukünftige/offene Kerzen beeinflussen den geschlossenen Befund nicht',()=>{const x=divergence(),expected=run(x);x.r.push(...rows(90).slice(80));x.s.line.push(...Array(10).fill(100));x.s.signal.push(...Array(10).fill(-100));assert.deepEqual(run(x),expected);});
 check('Analyse verändert weder Kerzen noch Indikatorwerte',()=>{const x=divergence(),before=JSON.stringify(x);run(x);assert.equal(JSON.stringify(x),before);});
 check('Ausgeschaltet bleibt die bisherige Preisgeometrie exakt erhalten',()=>{for(const h of[240,300,500,900])assert.deepEqual(L(h,false),{priceBottom:h-77,height:0});});
 check('MACD, Kurs, Volumen und Zeitachse überlappen nicht',()=>{for(const h of[240,300,500,900]){const q=L(h,true);assert.ok(q.priceBottom>18);assert.ok(q.priceBottom<q.top);assert.ok(q.top<q.plotTop&&q.plotTop<q.plotBottom);assert.ok(q.plotBottom<q.bottom&&q.bottom<h-63);}});
 console.log(passed+'/'+(passed+failed)+' bestanden');process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
