// Prognose-Linien: echte Formationskerzen, native Chart-Gesten und Label auf Touch/Desktop.
const h=require('./harness'),fs=require('fs'),vm=require('vm'),path=require('path');
const results=[],check=(name,ok,detail='')=>{results.push({name,ok:!!ok});console.log((ok?'✓ ':'✗ ')+name+(detail?' — '+detail:''));};
const out=path.join(__dirname,'out','projection-inspector');fs.mkdirSync(out,{recursive:true});
async function routedWebkit(){const {webkit}=require('playwright'),https=require('https'),{WebSocket}=require('ws'),b=await webkit.launch(),original=b.newContext.bind(b),ca=fs.readFileSync(path.join(__dirname,'cert.pem'));
 b.newContext=async options=>{const c=await original({...options,serviceWorkers:'block'});
 await c.route('**/*',async route=>{const u=new URL(route.request().url());if(['127.0.0.1','localhost'].includes(u.hostname))return route.continue();if(!/binance\.(com|vision)$|bybit\.com$|raw\.githubusercontent\.com$|api\.(coingecko|coinpaprika|coinlore)\.(com|net)$|api\.telegram\.org$/.test(u.hostname))return route.abort();try{const response=await new Promise((resolve,reject)=>{const r=https.request({hostname:'127.0.0.1',servername:'localhost',port:9443,path:'/_h/'+u.hostname+u.pathname+u.search,ca,method:route.request().method(),headers:{host:u.host}},res=>{const chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});r.on('error',reject);r.end(route.request().postData()||undefined);});await route.fulfill(response);}catch{await route.abort();}});
 await c.routeWebSocket('**/*',r=>{const u=new URL(r.url()),ws=new WebSocket('wss://127.0.0.1:9443'+u.pathname+u.search,{ca,servername:'localhost',headers:{host:u.host}}),q=[];r.onMessage(m=>{if(ws.readyState===1)ws.send(m);else q.push(m);});ws.on('open',()=>q.splice(0).forEach(m=>ws.send(m)));ws.on('message',(m,binary)=>{try{r.send(binary?m:m.toString());}catch{}});ws.on('error',()=>{});r.onClose(()=>ws.close());});return c;};return b;}
(async()=>{let browser;try{
 await h.setup();await h.ctl('/reset');await h.ctl('/walk?on=0');await h.ctl('/silent?on=1');
 browser=process.env.WX_BROWSER==='webkit'?await routedWebkit():await h.launch({workspace:'fresh'});
 const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 const I=await import('../shared/market-intervals.mjs'),D=await import('../shared/chart-detail.mjs'),src=fs.readFileSync(path.join(__dirname,'m58.js'),'utf8');
 const B=vm.runInNewContext(src.slice(src.indexOf('const BUILD = () => {'),src.indexOf('\nconst tests = {'))+'\nBUILD()'),shape=B.path(B.F.rectangle),now=Date.now();
 await p.clock.setFixedTime(new Date(now));
 await ctx.addInitScript(()=>{localStorage.setItem('scalpdesk.symbol.v1','"BTCUSDT"');localStorage.setItem('scalpdesk.interval.v1','"5m"');});
 const fixtureRoute=route=>{const q=new URL(route.request().url()).searchParams,iv=q.get('interval'),sym=q.get('symbol');if(!['BTCUSDT','ETCUSDT'].includes(sym)||!I.INTERVAL_MS[iv]||iv==='1M')return route.fallback();const ms=I.INTERVAL_MS[iv],start=D.candleStart(now,iv)-499*ms;
 const rows=[...Array.from({length:499-shape.length},()=>({o:90,h:90.1,l:89.9,c:90,v:100})),...shape,{o:94,h:94.1,l:93.9,c:94,v:1}],price=v=>sym==='BTCUSDT'?80000+(v-90)*246.878:7+(v-80)*.05;
 return route.fulfill({json:rows.map((r,i)=>[start+i*ms,price(r.o),price(r.h),price(r.l),price(r.c),r.v,I.intervalEnd(start+i*ms,iv)-1])});};
 await ctx.route(/https:\/\/(?:data-api\.binance\.vision|api\.binance\.com)\/.*klines\?/,fixtureRoute);
 await p.goto(h.URL_BASE+'/weather-widget-v2.html');await p.waitForFunction(()=>window.__g09&&__g05.state.candles.length>200);
 await p.click('[data-workspace-target=chart]');await p.evaluate(()=>__intervals.setMarket('BTCUSDT','5m'));await p.locator('#chart').scrollIntoViewIfNeeded();
 await p.waitForFunction(()=>!__g05.state.busy&&__g09.chipRows().some(r=>r.hit.id==='rectangle'&&!r.disabled));
 const key=await p.evaluate(()=>{const r=__g09.chipRows().find(r=>r.hit.id==='rectangle'&&!r.disabled);__g09.chipToggle(r.key);return r.key;});
 await p.waitForFunction(()=>document.querySelectorAll('#chart .pat-projection-hit').length>=2);
 const label=p.locator('#chart .projection-inspector'),lineCount=()=>p.locator('#chart .pat-projection').count();
 const books=await p.evaluate(()=>JSON.stringify([__g05.state.positions,__g05.state.alarms,__g05.state.trades]));
 const signature=()=>p.locator('#chart .pat-projection').evaluateAll(ns=>ns.map(n=>[n.getAttribute('x1'),n.getAttribute('x2'),n.getAttribute('y1'),n.getAttribute('y2'),n.getAttribute('stroke-dasharray')]).sort().join('|'));
 async function point(kind,f=.6,page=p){return page.locator('#chart .pat-projection-hit').evaluateAll((ns,{kind,f})=>{const n=ns[kind==='upper'?0:1],r=n.getBoundingClientRect(),up=+n.getAttribute('y2')<+n.getAttribute('y1'),turned=getComputedStyle(document.getElementById('chart-sec')).transform!=='none';return turned?{x:up?r.left+r.width*f:r.right-r.width*f,y:r.top+r.height*f}:{x:r.left+r.width*f,y:up?r.bottom-r.height*f:r.top+r.height*f};},{kind,f});}
 async function tap(kind,dy=0){const q=await point(kind);await p.touchscreen.tap(q.x,q.y+dy);await p.waitForTimeout(80);return q;}
 const original=await signature();await tap('upper',10);
 check('26px-Fingerziel trifft die obere Linie auch 10px daneben',await label.count()===1&&/82\.493/.test(await label.textContent()),await label.textContent());
 check('Label enthält beide Grenzen, Abstand und UTC-Uhrzeit',/Oben82\.493 \$Unten79\.975 \$Abstand2\.518 \$/.test(await label.textContent())&&/\d{2}:\d{2}/.test(await label.textContent())&&/UTC/.test(await label.textContent()));
 check('Farbe kommt direkt von der ausgewählten Linie',await label.evaluate(n=>{const line=document.querySelector('#chart .pat-projection');return n.style.getPropertyValue('--projection-color')===line.getAttribute('stroke');}));
 check('Antippen verändert weder Linien noch deren Sichtbarkeit',await signature()===original&&await lineCount()===2);
 const upperKey=await label.getAttribute('data-line-key');await tap('lower');
 check('Andere Linie verschiebt dasselbe einzelne Label',await label.count()===1&&await label.getAttribute('data-line-key')!==upperKey&&/^79\.975 ·/.test(await label.textContent()));
 const selectedTime=await label.getAttribute('data-time');
 // Dieselbe native Musterprojektion wird mit neuer Steigung gezeichnet, nicht nur DOM-Text ersetzt.
 await p.evaluate(key=>{const h=__g09.pat.res.hits.find(h=>`${h.id}|${h.t0}`===key);h.lines=h.lines.map(l=>l[4]==='sup'?[l[0],l[1]+25,l[2],l[3]+25,l[4]]:l);document.getElementById('pat-project-bars').dispatchEvent(new Event('change'));},key);
 await p.waitForTimeout(200);
 check('Offenes Label aktualisiert beide Werte live am gleichen Zeitpunkt',await label.count()===1&&await label.getAttribute('data-time')===selectedTime&&/^80\.000 ·/.test(await label.textContent())&&/Abstand2\.493 \$/.test(await label.textContent()),await label.textContent());
 for(const width of[320,390,768,820,1440]){
   await p.setViewportSize({width,height:width>=768?1180:900});await p.waitForTimeout(250);await p.locator('#chart').scrollIntoViewIfNeeded();await tap('upper');
   check(width+'px: ein Label vollständig innerhalb Bildschirm und Chart',await label.evaluate(n=>{const a=n.getBoundingClientRect(),b=document.getElementById('chart').getBoundingClientRect();return a.width>0&&a.left>=Math.max(0,b.left)&&a.right<=Math.min(innerWidth,b.right)+1&&a.top>=Math.max(0,b.top)&&a.bottom<=Math.min(innerHeight,b.bottom)+1&&document.documentElement.scrollWidth<=innerWidth+1;}));
 }
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(250);await p.locator('#chart').scrollIntoViewIfNeeded();await tap('upper');
 await p.locator('#chart').screenshot({path:path.join(out,(process.env.WX_BROWSER||'chromium')+'-btc.png')});
 const empty=await p.locator('#chart').evaluate(n=>{const r=n.getBoundingClientRect();return{x:r.left+25,y:r.top+35};});await p.touchscreen.tap(empty.x,empty.y);
 check('Tipp an anderer Chartstelle schließt nur das Label',await label.count()===0&&await lineCount()===2);
 // Bestehende Touch-Gesten: Maus-Drag-Pointerfolge und echte Zwei-Finger-Ereignisse.
 await tap('upper');const q=await point('upper'),before=await p.evaluate(()=>__g05.state.count);
 await p.locator('#chart').dispatchEvent('pointerdown',{pointerId:21,pointerType:'touch',clientX:q.x-35,clientY:q.y,bubbles:true});
 await p.locator('#chart').dispatchEvent('pointerdown',{pointerId:22,pointerType:'touch',clientX:q.x+35,clientY:q.y,bubbles:true});
 await p.locator('#chart').dispatchEvent('pointermove',{pointerId:22,pointerType:'touch',clientX:q.x+100,clientY:q.y,bubbles:true});
 await p.locator('#chart').dispatchEvent('pointerup',{pointerId:22,pointerType:'touch',clientX:q.x+100,clientY:q.y,bubbles:true});
 await p.locator('#chart').dispatchEvent('pointerup',{pointerId:21,pointerType:'touch',clientX:q.x-35,clientY:q.y,bubbles:true});await p.waitForTimeout(400);
 check('Zwei-Finger-Zoom bleibt aktiv und erzeugt kein zweites Label',await p.evaluate(n=>__g05.state.count!==n,before)&&await label.count()<=1);
 if(await p.locator('#pan-now').isVisible())await p.click('#pan-now');await p.waitForTimeout(200);await p.locator('#chart').scrollIntoViewIfNeeded();
 const panBefore=await p.evaluate(()=>__g05.state.pan),a=await point('upper');
 await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(a.x+80,a.y,{steps:12});await p.waitForTimeout(120);await p.mouse.up();await p.waitForTimeout(550);
 check('Wischen ab der Prognoselinie verschiebt weiterhin den Chart',await p.evaluate(n=>__g05.state.pan>n,panBefore));
 if(await p.locator('#pan-now').isVisible())await p.click('#pan-now');await p.waitForTimeout(200);await p.locator('#chart').scrollIntoViewIfNeeded();
 const nowState=await p.evaluate(()=>({count:__g05.state.count,pan:__g05.state.pan}));await tap('upper');await tap('lower');
 check('Schneller Wechsel zwischen den Linien löst keinen Doppeltipp-Reset aus',await p.evaluate(s=>s.count===__g05.state.count&&s.pan===__g05.state.pan,nowState)&&await label.count()===1);
 await p.click('#chart-full');await p.waitForTimeout(250);await tap('upper');await p.locator('#chart-sec').screenshot({path:path.join(out,(process.env.WX_BROWSER||'chromium')+'-fullscreen.png')});
 check('Vollbild-Chart zeigt das Label innerhalb seiner Ränder',await label.evaluate(n=>{const r=n.getBoundingClientRect();return !n.hidden&&r.width>0&&r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;}),JSON.stringify(await label.evaluate(n=>{const host=document.getElementById('chart'),svg=host.querySelector('svg'),hit=host.querySelector('.pat-projection-hit'),m=x=>{const s=x.getScreenCTM();return{s:s.a,b:s.b,c:s.c,d:s.d,e:s.e,f:s.f};};return{hidden:n.hidden,style:n.getAttribute('style'),width:host.clientWidth,height:host.clientHeight,vb:svg.getAttribute('viewBox'),root:m(svg),hit:m(hit),line:[hit.getAttribute('x1'),hit.getAttribute('y1'),hit.getAttribute('x2'),hit.getAttribute('y2')],time:n.dataset.time,box:n.getBoundingClientRect().toJSON()};})));await p.click('#fb-exit');
 await p.evaluate(()=>__intervals.setMarket('ETCUSDT','5m'));await p.waitForFunction(()=>__g05.state.symbol==='ETCUSDT'&&!__g05.state.busy&&__g09.chipRows().some(r=>r.hit.id==='rectangle'&&!r.disabled));
 check('Coinwechsel übernimmt kein altes BTC-Label',await label.count()===0);
 await p.evaluate(()=>__g09.chipToggle(__g09.chipRows().find(r=>r.hit.id==='rectangle'&&!r.disabled).key));await p.locator('#chart').scrollIntoViewIfNeeded();await p.waitForFunction(()=>document.querySelectorAll('#chart .pat-projection-hit').length>=2);await tap('upper');
 check('ETC behält vier Nachkommastellen',/^8,0050 ·/.test(await label.textContent()),await label.textContent());
 await p.locator('#chart').screenshot({path:path.join(out,(process.env.WX_BROWSER||'chromium')+'-etc.png')});
 check('Positionen, Alarme und Trades bleiben unverändert',await p.evaluate(()=>JSON.stringify([__g05.state.positions,__g05.state.alarms,__g05.state.trades]))===books);
 check('Keine JavaScript-Fehler oder Telegram-Nachrichten',errors.length===0&&(await h.ctl('/sent')).length===0,errors.join(' | '));await ctx.close();
 const desktopCtx=await browser.newContext({viewport:{width:1440,height:1000},hasTouch:false}),desktop=await desktopCtx.newPage();desktop.on('pageerror',e=>errors.push(e.message));
 await desktopCtx.route(/https:\/\/(?:data-api\.binance\.vision|api\.binance\.com)\/.*klines\?/,fixtureRoute);
 await desktop.goto(h.URL_BASE+'/weather-widget-v2.html');await desktop.bringToFront();await desktop.waitForFunction(()=>window.__g09&&__g05.state.candles.length>200);await desktop.click('[data-workspace-target=chart]');await desktop.evaluate(()=>__intervals.setMarket('BTCUSDT','5m'));await desktop.locator('#chart').scrollIntoViewIfNeeded();
 await desktop.waitForFunction(()=>!__g05.state.busy&&__g09.chipRows().some(r=>r.hit.id==='rectangle'&&!r.disabled));await desktop.evaluate(()=>__g09.chipToggle(__g09.chipRows().find(r=>r.hit.id==='rectangle'&&!r.disabled).key));await desktop.waitForFunction(()=>document.querySelectorAll('#chart .pat-projection-hit').length>=2);
 const pcPoint=await point('upper',.6,desktop);await desktop.mouse.click(pcPoint.x,pcPoint.y);check('Desktop: echter Mausklick öffnet genau ein Label',await desktop.locator('.projection-inspector').count()===1);
 await desktop.evaluate(()=>{window.testWheels=[];document.getElementById('chart').addEventListener('wheel',e=>testWheels.push({ctrl:e.ctrlKey,delta:e.deltaY}));});const count=await desktop.evaluate(()=>__g05.state.count);await desktop.keyboard.down('Control');await desktop.mouse.wheel(0,-40);if(process.env.WX_BROWSER==='webkit')await desktop.locator('#chart').dispatchEvent('wheel',{clientX:pcPoint.x,clientY:pcPoint.y,deltaY:-40,ctrlKey:true,bubbles:true});await desktop.keyboard.up('Control');await desktop.screenshot();await desktop.waitForFunction(n=>__g05.state.count!==n,count,{timeout:3000}).catch(()=>{});
 check('Desktop: Strg+Mausrad zoomt bei offenem Label weiter',await desktop.evaluate(n=>__g05.state.count!==n,count),JSON.stringify(await desktop.evaluate(n=>({before:n,after:__g05.state.count,wheels:testWheels,live:__chartLive.on,stats:__chartLive.stats}),count)));
 await desktop.locator('#chart').screenshot({path:path.join(out,(process.env.WX_BROWSER||'chromium')+'-desktop.png')});check('Desktop bleibt fehlerfrei',errors.length===0,errors.join(' | '));await desktopCtx.close();
 }catch(e){check('Abbruch',false,e.stack);}finally{await browser?.close();await h.teardown();fs.writeFileSync(path.join(out,(process.env.WX_BROWSER||'chromium')+'.json'),JSON.stringify(results,null,2));const n=results.filter(r=>r.ok).length;console.log(n+'/'+results.length+' bestanden');if(n!==results.length)process.exitCode=1;}})();
