const assert=require('assert/strict');let passed=0,failed=0;const check=(n,fn)=>{try{fn();passed++;console.log('✓ '+n);}catch(e){failed++;console.log('✗ '+n+' — '+e.message);}};
(async()=>{const {rsiDeltaStats:stats,rsiSignal,RSI_MOMENTUM}=await import('../shared/rsi-momentum.mjs');
const fromDeltas=(d,start=50)=>d.reduce((a,v)=>[...a,a.at(-1)+v],[start]),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
check('Feste Definition: 20 Veränderungen, 2σ, Population, aktuelle Kerze, positiver Anstieg',()=>assert.deepEqual(RSI_MOMENTUM,{periods:20,deviations:2,ddof:0,includeCurrent:true,positiveOnly:true}));
const spike=[...Array(20).fill(40),50],s=stats(spike);
check('Handrechnung: Delta 10, Mittel 0,5, σ √4,75',()=>{near(s.delta,10);near(s.mean,.5);near(s.sigma,Math.sqrt(4.75));near(s.threshold,.5+2*Math.sqrt(4.75));assert.equal(s.exceeds,true);});
check('RSI 50 erhält Long durch Momentum oberhalb von 30',()=>{const r=rsiSignal(spike);assert.equal(r.score,1);assert.equal(r.oversoldLong,false);assert.equal(r.momentumLong,true);});
const edge=[...Array(7).fill(1),...Array(9).fill(-1),0,0,0,2];
check('Strikt >: Delta genau 2 bei Mittel 0 und σ 1 reicht nicht',()=>{const x=stats(fromDeltas(edge));assert.equal(x.delta,2);assert.equal(x.mean,0);assert.equal(x.sigma,1);assert.equal(x.threshold,2);assert.equal(x.exceeds,false);});
for(const [change,yes]of[[1e-6,true],[-1e-6,false]])check('Grenze um '+change+' wird ungerundet geprüft',()=>{const d=edge.slice();d[19]+=change;assert.equal(stats(fromDeltas(d)).exceeds,yes);});
for(const delta of[0,1,-1,.25])check('Konstante Veränderungen '+delta+': kein künstlicher Momentum-Trigger',()=>{const x=stats(fromDeltas(Array(20).fill(delta)));assert.equal(x.sigma,0);assert.equal(x.exceeds,false);assert.equal(rsiSignal(fromDeltas(Array(20).fill(delta))).momentumLong,false);});
check('Negative Statistik-Ausnahme wird durch positiven Zusatzfilter gesperrt',()=>{const values=fromDeltas([...Array(19).fill(-1),-.9],75),x=rsiSignal(values);assert.equal(x.momentum.exceeds,true);assert.ok(x.momentum.delta<0);assert.equal(x.momentumLong,false);assert.equal(x.score,0);});
check('Short über 70 und fallend bleibt auch bei negativer Statistik-Ausnahme erhalten',()=>{const x=rsiSignal(fromDeltas([...Array(19).fill(-1),-.9],95));assert.equal(x.current>70,true);assert.equal(x.momentum.exceeds,true);assert.equal(x.score,-1);});
check('Vorhandene Erholung unter 30 funktioniert ohne 20-Deltas-Vorlauf',()=>{const x=rsiSignal([25,26]);assert.equal(x.score,1);assert.equal(x.oversoldLong,true);assert.equal(x.momentum.ready,false);});
check('Erholung und Momentum zusammen zählen weiterhin nur einen RSI-Punkt',()=>{const x=rsiSignal([...Array(20).fill(20),25]);assert.equal(x.oversoldLong,true);assert.equal(x.momentumLong,true);assert.equal(x.score,1);});
check('Short erhält keinen neuen spiegelbildlichen Momentum-Trigger',()=>{const x=rsiSignal([...Array(20).fill(60),50]);assert.equal(x.score,0);assert.equal(x.momentumLong,false);});
for(const [name,values]of[['zu kurz',Array(20).fill(50)],['null',[null,...Array(20).fill(50)]],['NaN',[NaN,...Array(20).fill(50)]],['Infinity',[Infinity,...Array(20).fill(50)]],['Text',['50',...Array(20).fill(50)]],['außerhalb RSI',[101,...Array(20).fill(50)]],['Lücke',new Array(21)],['kein Array',{}]])check(name+' sperrt Statistik ohne Ersatznullen',()=>{const x=stats(values);assert.equal(x.ready,false);assert.equal(x.delta,null);assert.equal(x.exceeds,false);assert.equal(rsiSignal(values).momentumLong,false);});
check('Ältere Werte außerhalb des 20er-Fensters ändern nichts',()=>assert.deepEqual(stats([NaN,null,99,...spike]),s));
check('Vergangene Entscheidung verwendet keine spätere Veränderung',()=>{const input=[...spike,40],before=JSON.stringify(input);assert.deepEqual(stats(input.slice(0,-1)),s);assert.equal(JSON.stringify(input),before);});
const current=await import('../shared/watch-model-core.mjs'),old=await import('../bundles/3.75.1/shared/watch-model-core.mjs');
const rows=prices=>prices.map((close,i)=>({time:i*900000,end:(i+1)*900000,closeTime:(i+1)*900000-1,open:close,high:close+.1,low:close-.1,close,volume:100}));
const prices=Array.from({length:198},(_,i)=>100+Math.sin(i/3)*.3+i*.005);prices.push(prices.at(-1)+4);const candles=rows(prices),rating=current.watchClassicRating(candles),baseline=old.watchClassicRating(candles);
check('Echte OHLCV: Momentum erzeugt zusätzlichen RSI-Punkt über 30',()=>{assert.ok(rating.rsiRule.current>30);assert.equal(rating.rsiRule.momentumLong,true);assert.equal(rating.rules[2].score,1);assert.equal(baseline.rules[2].score,0);assert.equal(rating.score,baseline.score+1);});
check('EMA-Trend, Kursfilter und MACD bleiben exakt gleich',()=>{for(const i of[0,1,3])assert.deepEqual(rating.rules[i],baseline.rules[i]);});
check('500 weitere OHLCV-Fälle: nur zusätzliche RSI-Long-Punkte, alle bisherigen Long/Short-Punkte erhalten',()=>{
 let seed=1234567;for(let sample=0;sample<500;sample++){const price=[];let p=100;for(let i=0;i<199;i++){seed=(1664525*seed+1013904223)>>>0;p+=((seed/2**32)-.5)*.8;price.push(p);}const a=current.watchClassicRating(rows(price)),b=old.watchClassicRating(rows(price));for(const i of[0,1,3])assert.deepEqual(a.rules[i],b.rules[i]);if(b.rules[2].score!==0)assert.equal(a.rules[2].score,b.rules[2].score);else assert.ok(a.rules[2].score===0||a.rules[2].score===1);}
});
check('Modellkennungen unterscheiden neue Standardregel und unveränderten 5/5-Test',()=>{assert.equal(current.WATCH_MODELS.classic,'watch-classic-2');assert.equal(current.WATCH_MODELS.strict,old.WATCH_MODELS.strict);});
console.log(passed+'/'+(passed+failed)+' bestanden');process.exitCode=failed?1:0;})().catch(e=>{console.error(e);process.exitCode=1;});
