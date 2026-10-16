const assert=require('assert/strict'),fs=require('fs');let pass=0,fail=0;
const check=(name,fn)=>{try{fn();pass++;console.log('✓ '+name);}catch(e){fail++;console.log('✗ '+name+' '+e.message);}};
(async()=>{
 const {displayTimeParts:P,DISPLAY_TIME_ZONE}=await import('../shared/display-time.mjs');
 const {chartTimeTicks:T}=await import('../shared/chart-time-axis.mjs');
 check('Explizit Europe/Berlin statt Gerätezeitzone',()=>assert.equal(DISPLAY_TIME_ZONE,'Europe/Berlin'));
 for(const[t,clock,day,zone]of[
 ['2026-01-15T12:00Z','13:00','15.01.2026','MEZ'],['2026-07-15T12:00Z','14:00','15.07.2026','MESZ'],
 ['2026-03-29T00:59Z','01:59','29.03.2026','MEZ'],['2026-03-29T01:00Z','03:00','29.03.2026','MESZ'],
 ['2026-10-25T00:59Z','02:59','25.10.2026','MESZ'],['2026-10-25T01:00Z','02:00','25.10.2026','MEZ'],
 ['2026-12-31T23:30Z','00:30','01.01.2027','MEZ'],['2026-10-15T22:00Z','00:00','16.10.2026','MESZ']]){
  check(t+' → '+clock+' '+zone,()=>assert.deepEqual(P(Date.parse(t)),{clock,day,zone}));
 }
 check('Ungültige Anzeigezeit bleibt fehlend',()=>assert.equal(P(NaN),null));
 const times=['2026-10-25T00:00Z','2026-10-25T01:00Z'].map(t=>({time:Date.parse(t)}));
 check('Doppelte Herbststunde wird auf der Achse unterschieden',()=>{const t=T(times,{intervalMs:3600000,left:0,right:800,x:i=>100+i*500});assert.equal(t.length,2);assert.notEqual(t[0].label,t[1].label);assert.ok(t[1].label.endsWith('MEZ'));});
 const before=JSON.stringify(times);T(times,{intervalMs:3600000,left:0,right:800,x:i=>100+i*500});
 check('Originale Millisekunden bleiben bitgenau erhalten',()=>assert.equal(JSON.stringify(times),before));
 for(const name of['market-intervals','chart-detail','watch-model-core','watch-model-feed','pattern-lifecycle'])check(name+': Rechen-/Abrufkern gegenüber 3.77.6 unverändert',()=>{const root=__dirname+'/../';assert.ok(fs.readFileSync(root+'shared/'+name+'.mjs').equals(fs.readFileSync(root+'bundles/3.77.6/shared/'+name+'.mjs')));});
 const html=fs.readFileSync(__dirname+'/../weather-widget-v2.html','utf8');
 check('UTC-Kerzenanker und UTC-BTC-Puls bleiben unverändert',()=>{assert.ok(html.includes("function pulseSlot(t) { const d = new Date(t - 1), wd = d.getUTCDay(); return { h: d.getUTCHours()"));assert.ok(html.includes('Math.floor(Date.now() / 864e5) * 864e5'));});
 console.log(`${pass}/${pass+fail} bestanden`);process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
