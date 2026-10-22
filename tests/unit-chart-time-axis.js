// Zeitachse: Datumsregeln, Tageswechsel, Kollisionsabstände und unveränderte Daten.
const assert=require('node:assert/strict');let passed=0,failed=0;
const check=(name,test)=>{try{test();passed++;console.log('✓ '+name);}catch(e){failed++;console.error('✗ '+name+' — '+e.message);}};
(async()=>{
 const {chartTimeTicks:T}=await import('../shared/chart-time-axis.mjs');
 const rows=(start,intervalMs,n=80)=>Array.from({length:n},(_,i)=>({time:Date.parse(start)+i*intervalMs}));
 const ticks=(r,iv,width=360)=>T(r,{intervalMs:iv,left:15,right:width-15,x:i=>15+(i+.5)*(width-30)/r.length});
 const EPS=1e-9,fits=(t,width)=>t.every((n,i)=>n.x-n.width/2>=15-EPS&&n.x+n.width/2<=width-15+EPS&&(!i||n.x-n.width/2>=t[i-1].x+t[i-1].width/2+11.99));   // EPS: Gleitkomma (z. B. 305,00000000000006)
 check('Leere Daten und fehlender Platz ergeben keine Beschriftung',()=>{assert.deepEqual(ticks([],36e5),[]);assert.deepEqual(ticks(rows('2026-10-15T19:00Z',36e5),36e5,30),[]);});
 for(const iv of[36e5,72e5,144e5,864e5])check(iv+'ms: ab einer Stunde immer Datum und Uhrzeit (innerhalb eines Jahres ohne Jahr)',()=>{const t=ticks(rows('2026-10-15T19:00Z',iv),iv,820);assert.ok(t.length>1);t.forEach(n=>assert.match(n.label,/^\d{2}\.\d{2}\. \d{2}:\d{2}$/));});
 // 3.95.0: Das Jahr (zweistellig) steht dabei, sobald die sichtbare Spanne ein Jahr erreicht oder die Kerzen Monate lang sind (bis 3.77.1 so; m92)
 check('Monatskerzen: immer mit zweistelligem Jahr',()=>{const t=ticks(rows('2026-10-15T19:00Z',2592e6),2592e6,820);assert.ok(t.length>1);t.forEach(n=>assert.match(n.label,/^\d{2}\.\d{2}\.\d{2} \d{2}:\d{2}$/));});
 check('Spanne ab einem Jahr (Wochenkerzen über mehrere Jahre): zweistelliges Jahr, sonst ist „06.04.“ mehrdeutig',()=>{const t=ticks(rows('2020-03-30T00:00Z',6048e5,343),6048e5,820);assert.ok(t.length>=3);t.forEach(n=>assert.match(n.label,/^\d{2}\.\d{2}\.\d{2} \d{2}:\d{2}$/));assert.ok(new Set(t.map(n=>n.label.slice(6,8))).size>=3);});
 check('Spanne unter einem Jahr: weiter ohne Jahr (28 Wochen, 80 Tage, 80 Stunden)',()=>{for(const [s,iv,n]of[['2026-04-06T00:00Z',6048e5,28],['2026-07-01T00:00Z',864e5,80],['2026-10-15T19:00Z',36e5,80]])ticks(rows(s,iv,n),iv,820).forEach(x=>assert.match(x.label,/^\d{2}\.\d{2}\. \d{2}:\d{2}$/));});
 check('Jahreswechsel im Kurzzeitrahmen bleibt ohne Jahr (nur Tag und Monat, wie bisher)',()=>{const t=ticks(rows('2026-12-31T22:30Z',3e5),3e5);assert.ok(t.some(n=>n.label==='01.01. 00:00'));});
 check('Das Jahr macht die Labels breiter, sie bleiben trotzdem innerhalb der Achse und überschneiden sich nicht',()=>{for(const width of[320,390,820,1440]){const t=ticks(rows('2020-03-30T00:00Z',6048e5,343),6048e5,width);assert.ok(fits(t,width),String(width));}});
 for(const iv of[6e4,3e5,9e5])check(iv+'ms: am selben Tag ausschließlich Uhrzeit',()=>{const t=ticks(rows('2026-10-15T00:00Z',iv,20),iv);assert.ok(t.length>1);t.forEach(n=>assert.match(n.label,/^\d{2}:\d{2}$/));});
 for(const iv of[6e4,3e5,9e5])check(iv+'ms: Tageswechsel ergänzt Datum, übrige Ticks bleiben kurz',()=>{const r=rows('2026-10-15T21:30Z',iv),t=ticks(r,iv,820);assert.ok(t.some(n=>/^16\.10\. 00:00$/.test(n.label)));assert.ok(t.some(n=>/^\d{2}:\d{2}$/.test(n.label)));});
 check('Mitternacht nahe am linken Rand wird sicher innerhalb der Achse platziert',()=>{const t=ticks(rows('2026-10-15T21:55Z',3e5),3e5,320);assert.ok(t.some(n=>n.label==='16.10. 00:00'));assert.ok(fits(t,320));});
 check('Monatswechsel verwendet den neuen Tag und Monat',()=>assert.ok(ticks(rows('2026-10-31T22:30Z',3e5),3e5).some(n=>n.label==='01.11. 00:00')));
 check('Jahreswechsel verwendet den neuen Tag und Monat',()=>assert.ok(ticks(rows('2026-12-31T22:30Z',3e5),3e5).some(n=>n.label==='01.01. 00:00')));
 for(const width of[180,280,320,390,768,820,1440])check(width+'px: Labels bleiben innerhalb der Fläche und überschneiden sich nicht',()=>{for(const iv of[6e4,3e5,9e5,36e5,144e5,864e5])for(const n of[1,2,50,500]){const t=ticks(rows('2026-10-15T21:30Z',iv,n),iv,width);assert.ok(t.length>0);assert.ok(fits(t,width));}});
 check('Schmale Achse reduziert die Anzahl statt Überlappungen zu erzeugen',()=>{const r=rows('2026-10-15T19:00Z',36e5);assert.ok(ticks(r,36e5,320).length<ticks(r,36e5,1440).length);});
 check('3.82.2: doppelte Stunde am 25.10. – jeder Tick darin trägt MESZ bzw. MEZ, sonst keiner',()=>{const r=rows('2026-10-24T23:00Z',3e5,48),t=ticks(r,3e5,1440),dup=n=>{const h=new Date(r[n.index].time).getUTCHours();return new Date(r[n.index].time).getUTCDate()===25&&h<2;};assert.ok(t.filter(dup).length>=2);t.forEach(n=>assert.equal(/ ME(S)?Z$/.test(n.label),dup(n),n.label));assert.ok(t.some(n=>/^02:\d\d MESZ$/.test(n.label))&&t.some(n=>/^02:\d\d MEZ$/.test(n.label)));});
 check('3.82.2: Frühjahr (29.03.) bekommt keinen Zonenzusatz',()=>{const r=rows('2026-03-28T23:00Z',3e5,48);ticks(r,3e5,1440).forEach(n=>assert.doesNotMatch(n.label,/ME(S)?Z/));});
 check('Ungültige Zeitwerte erzeugen kein ungültiges Label',()=>assert.deepEqual(ticks([{time:NaN}],36e5),[]));
 check('Eingangsdaten bleiben unverändert',()=>{const r=rows('2026-10-15T19:00Z',36e5),before=JSON.stringify(r);ticks(r,36e5);assert.equal(JSON.stringify(r),before);});
 console.log(passed+'/'+(passed+failed)+' bestanden');process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
