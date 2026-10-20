const fs=require('fs'),assert=require('assert/strict');let pass=0,fail=0;
const check=(name,fn)=>{try{fn();pass++;console.log('✓ '+name);}catch(e){fail++;console.log('✗ '+name+' '+e.message);}};
(async()=>{
 const I=await import('../shared/indicators.mjs'),W=await import('../shared/watch-model-core.mjs'),{rsiSignal}=await import('../shared/rsi-momentum.mjs');
 const html=fs.readFileSync(__dirname+'/../weather-widget-v2.html','utf8');
 const app=new Function('rsiSignal','rsi','ema','macd',html.slice(html.indexOf('function signalRating('),html.indexOf('\nfunction overallRating('))+'\nreturn signalRating;')(rsiSignal,I.rsi,I.ema,I.macd); // 3.84.0: rsi/ema/macd stammen aus shared/indicators.mjs
 for(const[base,delta]of[[200,1],[80000,20],[.0002,.000001]])for(const d of[1,-1]){
  const c=Array.from({length:100},(_,i)=>({time:i*60000,closeTime:(i+1)*60000-1,open:base+d*i*delta,close:base+d*i*delta,high:base+d*i*delta+delta/10,low:base+d*i*delta-delta/10,volume:100}));
  check(base+' / '+d+': Rundungsreste geben keine MACD-Richtung',()=>assert.equal(W.watchClassicRating(c).rules[3].score,0));
  check(base+' / '+d+': Live und Backtest identisch',()=>assert.deepEqual(app(c),W.watchClassicRating(c)));
 }
 check('Echte Abstände bleiben in beiden Richtungen erhalten',()=>assert.deepEqual(I.neutralMacdSignal([7,7],[7.000001,6.999999],[80000,80000]),[7.000001,6.999999]));
 check('Kleine Coins erhalten echte kleine Abstände',()=>assert.deepEqual(I.neutralMacdSignal([1e-8],[1e-8+1e-15],[1e-5]),[1e-8+1e-15]));
 check('Fehlende Signalwerte bleiben fehlend',()=>assert.deepEqual(I.neutralMacdSignal([null,0],[null,NaN],[100,100]),[null,NaN]));
 check('Eingaben bleiben unverändert',()=>{const a=[7],b=[7+Number.EPSILON*8],p=[200],before=JSON.stringify([a,b,p]);I.neutralMacdSignal(a,b,p);assert.equal(JSON.stringify([a,b,p]),before);});
 check('Berechnungsstand hat eine eigene Kennung',()=>assert.equal(W.WATCH_CALCULATION_REVISION,'macd-neutral-1'));
 console.log(`${pass}/${pass+fail} bestanden`);process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
