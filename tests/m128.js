// 3.77.7: Deutsche Anzeigezeit bei unveränderten Börsenzeitstempeln.
const h=require('./harness'),fs=require('fs'),path=require('path');
let pass=0,fail=0;const check=(name,ok)=>{ok?pass++:fail++;console.log((ok?'✓ ':'✗ ')+name);};
async function routedWebkit(){const {webkit}=require('playwright'),https=require('https'),{WebSocket}=require('ws'),b=await webkit.launch(),original=b.newContext.bind(b),ca=fs.readFileSync(path.join(__dirname,'cert.pem'));
 b.newContext=async options=>{const c=await original({...options,serviceWorkers:'block'});
 await c.route('**/*',async route=>{const u=new URL(route.request().url());if(['127.0.0.1','localhost'].includes(u.hostname))return route.continue();if(!/binance\.(com|vision)$|bybit\.com$|raw\.githubusercontent\.com$|api\.(coingecko|coinpaprika|coinlore)\.(com|net)$|api\.telegram\.org$/.test(u.hostname))return route.abort();try{const response=await new Promise((resolve,reject)=>{const r=https.request({hostname:'127.0.0.1',servername:'localhost',port:9443,path:'/_h/'+u.hostname+u.pathname+u.search,ca,method:route.request().method(),headers:{host:u.host}},res=>{const chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});r.on('error',reject);r.end(route.request().postData()||undefined);});await route.fulfill(response);}catch{await route.abort();}});
 await c.routeWebSocket('**/*',r=>{const u=new URL(r.url()),ws=new WebSocket('wss://127.0.0.1:9443'+u.pathname+u.search,{ca,servername:'localhost',headers:{host:u.host}}),q=[];r.onMessage(m=>{if(ws.readyState===1)ws.send(m);else q.push(m);});ws.on('open',()=>q.splice(0).forEach(m=>ws.send(m)));ws.on('message',(m,binary)=>{try{r.send(binary?m:m.toString());}catch{}});ws.on('error',()=>{});r.onClose(()=>ws.close());});return c;};return b;}


(async()=>{let b;try{await h.setup();await h.ctl('/walk?on=0');b=process.env.WX_BROWSER==='webkit'?await routedWebkit():await h.launch({workspace:'fresh'});const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,timezoneId:'America/New_York'}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto(h.URL_BASE+'/weather-widget-v2.html');await p.waitForFunction(()=>window.__watchModels&&document.querySelector('#chart-signal-model')?.textContent.includes('Chart-Tendenzen'));await p.click('[data-workspace-target=chart]');
const time=await p.evaluate(async()=>{const {displayTimeParts}=await import('./bundles/3.77.7/shared/display-time.mjs');return displayTimeParts(Date.parse('2026-07-15T12:00Z'));});
check('Deutsche Uhrzeit trotz amerikanischer Gerätezeitzone',time.clock==='14:00'&&time.zone==='MESZ');
await p.evaluate(()=>__intervals.setMarket('BTCUSDT','1h'));await p.locator('#chart').scrollIntoViewIfNeeded();await p.waitForFunction(()=>!__g05.state.busy&&__g05.state.interval==='1h'&&__chartDetail.geometry);
check('Chart nennt deutsche Zeit',await p.locator('#chart-caption').textContent().then(t=>t.includes('MEZ/MESZ')));
check('Stundenkerzen bleiben UTC-verankert',await p.evaluate(()=>__g05.state.candles.length>100&&__g05.state.candles.every(c=>c.time%3600000===0&&c.closeTime===c.time+3600000-1)));
check('Live-Daten behalten unveränderte Börsen-Zeitstempel',await p.evaluate(()=>Math.abs(__g05.state.candles.at(-1).time-Math.floor(Date.now()/3600000)*3600000)<1));
const result=await p.evaluate(async()=>{const {chartTimeTicks}=await import('./bundles/3.77.7/shared/chart-time-axis.mjs');const rows=[{time:Date.parse('2026-07-15T12:00Z')}];return chartTimeTicks(rows,{intervalMs:3600000,left:0,right:400,x:()=>200})[0].label;});
check('Zeitachse übersetzt die Anzeige statt den Zeitstempel',result==='15.07. 14:00');
for(const width of[320,390,768,1440]){await p.setViewportSize({width,height:1000});await p.locator('#chart').scrollIntoViewIfNeeded();check(width+'px: Chart ohne Überlauf',await p.locator('#chart').evaluate(n=>n.scrollWidth<=n.clientWidth+1)&&await p.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1));}
await p.setViewportSize({width:390,height:844});await p.locator('#chart-full').click();check('Vollbild bleibt frei vom langen Modellhinweis',!await p.locator('#chart-signal-model').isVisible());await p.locator('#fb-exit').click();
check('Keine Laufzeitfehler',!errors.length);await ctx.close();
}catch(e){check('Abbruch: '+e.stack,false);}finally{await b?.close();await h.teardown();console.log(pass+'/'+(pass+fail)+' bestanden');if(fail)process.exitCode=1;}})();
