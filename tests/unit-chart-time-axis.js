// Zeitachse: Datumsregeln, Tageswechsel, Kollisionsabstände und unveränderte Daten.
const assert=require('node:assert/strict');let passed=0,failed=0;
const check=(name,test)=>{try{test();passed++;console.log('✓ '+name);}catch(e){failed++;console.error('✗ '+name+' — '+e.message);}};
(async()=>{
 const {chartTimeTicks:T}=await import('../shared/chart-time-axis.mjs');
 const rows=(start,intervalMs,n=80)=>Array.from({length:n},(_,i)=>({time:Date.parse(start)+i*intervalMs}));
 const ticks=(r,iv,width=360)=>T(r,{intervalMs:iv,left:15,right:width-15,x:i=>15+(i+.5)*(width-30)/r.length});
 const fits=(t,width)=>t.every((n,i)=>n.x-n.width/2>=15&&n.x+n.width/2<=width-15&&(!i||n.x-n.width/2>=t[i-1].x+t[i-1].width/2+11.99));
 check('Leere Daten und fehlender Platz ergeben keine Beschriftung',()=>{assert.deepEqual(ticks([],36e5),[]);assert.deepEqual(ticks(rows('2026-10-15T19:00Z',36e5),36e5,30),[]);});
 for(const iv of[36e5,72e5,144e5,864e5,2592e6])check(iv+'ms: ab einer Stunde immer Datum und Uhrzeit',()=>{const t=ticks(rows('2026-10-15T19:00Z',iv),iv,820);assert.ok(t.length>1);t.forEach(n=>assert.match(n.label,/^\d{2}\.\d{2}\. \d{2}:\d{2}$/));});
 for(const iv of[6e4,3e5,9e5])check(iv+'ms: am selben Tag ausschließlich Uhrzeit',()=>{const t=ticks(rows('2026-10-15T00:00Z',iv,20),iv);assert.ok(t.length>1);t.forEach(n=>assert.match(n.label,/^\d{2}:\d{2}$/));});
 for(const iv of[6e4,3e5,9e5])check(iv+'ms: Tageswechsel ergänzt Datum, übrige Ticks bleiben kurz',()=>{const r=rows('2026-10-15T21:30Z',iv),t=ticks(r,iv,820);assert.ok(t.some(n=>/^16\.10\. 00:00$/.test(n.label)));assert.ok(t.some(n=>/^\d{2}:\d{2}$/.test(n.label)));});
 check('Mitternacht nahe am linken Rand wird sicher innerhalb der Achse platziert',()=>{const t=ticks(rows('2026-10-15T21:55Z',3e5),3e5,320);assert.ok(t.some(n=>n.label==='16.10. 00:00'));assert.ok(fits(t,320));});
 check('Monatswechsel verwendet den neuen Tag und Monat',()=>assert.ok(ticks(rows('2026-10-31T22:30Z',3e5),3e5).some(n=>n.label==='01.11. 00:00')));
 check('Jahreswechsel verwendet den neuen Tag und Monat',()=>assert.ok(ticks(rows('2026-12-31T22:30Z',3e5),3e5).some(n=>n.label==='01.01. 00:00')));
 for(const width of[180,280,320,390,768,820,1440])check(width+'px: Labels bleiben innerhalb der Fläche und überschneiden sich nicht',()=>{for(const iv of[6e4,3e5,9e5,36e5,144e5,864e5])for(const n of[1,2,50,500]){const t=ticks(rows('2026-10-15T21:30Z',iv,n),iv,width);assert.ok(t.length>0);assert.ok(fits(t,width));}});
 check('Schmale Achse reduziert die Anzahl statt Überlappungen zu erzeugen',()=>{const r=rows('2026-10-15T19:00Z',36e5);assert.ok(ticks(r,36e5,320).length<ticks(r,36e5,1440).length);});
 check('Ungültige Zeitwerte erzeugen kein ungültiges Label',()=>assert.deepEqual(ticks([{time:NaN}],36e5),[]));
 check('Eingangsdaten bleiben unverändert',()=>{const r=rows('2026-10-15T19:00Z',36e5),before=JSON.stringify(r);ticks(r,36e5);assert.equal(JSON.stringify(r),before);});
 console.log(passed+'/'+(passed+failed)+' bestanden');process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
