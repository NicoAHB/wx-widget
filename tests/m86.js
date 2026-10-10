// 3.61.0: echte Grid-Ausführung, native Speicherkonkurrenz und Coinbindung der Orderflow-Demo.
const h=require('./harness');let pass=0,fail=0;
const check=(name,ok,detail='')=>{ok?pass++:fail++;console.log(`${ok?'✓':'✗'} ${name}${detail?' — '+JSON.stringify(detail).slice(0,600):''}`);};
(async()=>{let browser;try{
 const {responseBody}=await import('./fixtures/bitget.mjs');await h.setup();await h.ctl('/walk?on=0');await h.ctl('/orderflow?mult=100');browser=await h.launch({workspace:'fresh'});
 const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),p=await ctx.newPage(),errors=[],calls=[];p.on('pageerror',e=>errors.push(e.message));let currentPrice=100;
 await ctx.route('https://api.bitget.com/**',async route=>{const u=new URL(route.request().url()),at=Date.now(),body=responseBody(u.href,at),symbol=u.searchParams.get('symbol');calls.push({path:u.pathname,symbol,at});
  if(u.pathname.endsWith('/contracts'))body.data[0].symbol=symbol;
  else if(u.pathname.endsWith('/ticker'))body.data=[{symbol,bidPr:String(currentPrice-.01),askPr:String(currentPrice),markPrice:String(currentPrice),ts:String(at)}];
  else if(u.pathname.endsWith('/current-fund-rate'))body.data=[{symbol,fundingRate:'0',fundingRateInterval:'8',nextUpdate:String(at+3600000)}];
  else if(u.pathname.endsWith('/history-candles'))body.data=body.data.map(row=>[row[0],'100','101','99','100','100','10000']);
  else if(u.pathname.endsWith('/candles'))body.data=[[String(Math.floor(at/900000)*900000),'100','101','99','100','1','100']];
  await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
 });
 await p.goto(h.URL_BASE+'/weather-widget-v2.html');await p.waitForFunction(()=>window.__paper&&__g12?.view.state.confirmed);await p.tap('#workspace-bot');await p.tap('#paper-settings>summary');await p.selectOption('#bot-strategy','adaptive-grid');await p.tap('#bot-preset');await p.fill('#bot-leverage','3');await p.fill('#bot-exposureUSDT','1000');await p.tap('#paper-start');
 try{await p.waitForFunction(()=>__paper.controller.state.book.run?.orders.length>0,null,{timeout:60000});}catch(e){console.log('Grid-Diagnose',await p.evaluate(()=>({book:__paper.controller.state.book,error:__paper.controller.state.error,modelError:__paper.controller.state.modelError})));throw e;}
 const first=await p.evaluate(()=>__paper.controller.state.book.run.orders.at(-1));
 check('Öffentlicher Worker lädt 14 Tage und legt echte eigene Grid-Limits an',await p.evaluate(()=>__paper.controller.state.book.run.gridState.range.bars===1344&&!__paper.controller.state.book.run.positions.length)&&calls.filter(x=>x.path.endsWith('/history-candles')).length===7);
 await p.tap('#paper-orders>summary');check('Grid-Limits und bedingte Ziele sichtbar und klappbar',await p.locator('#paper-orders p').count()>0&&/Ziel nach Fill/.test(await p.textContent('#paper-orders')));
 currentPrice=first.entry;await p.waitForFunction(()=>__paper.controller.state.book.run.positions.length>0,null,{timeout:20000});
 check('Spätere echte Quote füllt ursprüngliches Limit, nur Long mit Stop und Ziel',await p.evaluate(o=>__paper.controller.state.book.run.positions.some(x=>x.signalId===o.id&&x.entry===o.entry&&x.direction===1&&x.sl<x.entry&&x.tp>x.entry),first));
 const historyCalls=calls.filter(x=>x.path.endsWith('/history-candles')).length,volumeCalls=calls.filter(x=>x.path.endsWith('/candles')).length;await p.waitForFunction(()=>__paper.controller.state.book.run.quote.at>Date.now()-5000);await p.waitForTimeout(16000);
 check('Geschlossene Historie wiederverwendet; laufendes Volumen erneut öffentlich geprüft',calls.filter(x=>x.path.endsWith('/history-candles')).length===historyCalls&&calls.filter(x=>x.path.endsWith('/candles')).length>volumeCalls);
 await p.tap('#paper-stop');await p.waitForFunction(()=>!__paper.controller.state.busy&&__paper.controller.state.book.run.status==='ended');
 check('Stop schließt bestätigte Grid-Demo und erhält tatsächliche Abschlüsse',await p.evaluate(async()=>!__paper.controller.state.active&&(await __paper.read()).closed.length>0&&!(await __paper.read()).run.positions.length));
 const cas=await p.evaluate(async()=>{const m=await import('./bundles/3.61.0/shared/paper-bot-store.mjs'),before=await m.readPaperBook(),out=await Promise.allSettled([m.writePaperBook(before,before.revision),m.writePaperBook(before,before.revision)]),after=await m.readPaperBook();return{success:out.filter(x=>x.status==='fulfilled').length,rejected:out.filter(x=>x.status==='rejected').length,revision:after.revision-before.revision,preserved:JSON.stringify(before.closed)===JSON.stringify(after.closed)};});
 check('Native IDB bestätigt genau einen konkurrierenden Schreibauftrag ohne Tradeverlust',cas.success===1&&cas.rejected===1&&cas.revision===1&&cas.preserved,cas);
 check('Widerrufene Speicher-Epoche schreibt gar nichts',await p.evaluate(async()=>{const m=await import('./bundles/3.61.0/shared/paper-bot-store.mjs'),b=await m.readPaperBook();let denied=false;try{await m.writePaperBook(b,b.revision,()=>false);}catch{denied=true;}return denied&&JSON.stringify(b)===JSON.stringify(await m.readPaperBook());}));
 check('Grid-Trades nicht in persönlicher Sicherung',await p.evaluate(()=>!JSON.stringify(__g05.backupPayload()).includes(__paper.controller.state.book.closed[0].id)));
 await ctx.close();
 const local=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),phone=await local.newPage();phone.on('pageerror',e=>errors.push(e.message));
 await local.addInitScript(()=>{if(localStorage.getItem('m86seed'))return;localStorage.setItem('m86seed','1');localStorage.setItem('scalpdesk.watchlist.v1',JSON.stringify(['LTC','BTC','ETH']));const at=Date.now()-86400000,pos={id:'M86-ECHT',symbol:'BTCUSDT',side:'long',mode:'isolated',entry:60000,leverage:5,qty:.01,margin:120,openedAt:at,source:'spot',liqExchange:null,preRealized:0,sl:50000,tp:80000,ack:{sl:false,tp:false}};localStorage.setItem('scalpdesk.positions.v1',JSON.stringify([pos]));localStorage.setItem('scalpdesk.demopositions.v1',JSON.stringify([{...pos,id:'M86-ALTE-DEMO'}]));});
 await phone.goto(h.URL_BASE+'/weather-widget-v2.html');await phone.waitForFunction(()=>window.__pdf1?.view.quote()?.fresh);await phone.tap('#workspace-orderflow>summary');await phone.tap('#of-demo>summary');await phone.fill('#of-demo-margin','100');await phone.fill('#of-demo-leverage','5');
 const original=await phone.evaluate(()=>JSON.stringify([__g05.state.positions,__g05.state.demoPositions])),changes=await phone.evaluate(()=>localStorage.getItem('scalpdesk.changes.v1'));
 for(const coin of['LTC','BTC','ETH']){await phone.locator(`#watchlist [data-watch="${coin}"]`).tap();await phone.waitForFunction(symbol=>__g05.state.loadedSymbol===symbol&&__pdf1.view.state.symbol===symbol&&__pdf1.view.quote()?.fresh,coin+'USDT');await phone.tap('#of-demo-price');await phone.waitForFunction(()=>!document.getElementById('of-demo-close').hidden);
  check(coin+': Übungskauf nimmt genau die Vorauswahl und deren Markt/Kurs',await phone.evaluate(symbol=>{const x=__pdf1.readDemo().active.find(x=>x.symbol===symbol),q=__pdf1.view.quote();return !!x&&x.symbol===__g05.state.symbol&&x.entry===q.price&&x.source===q.source;},coin+'USDT'));
  await phone.tap('#of-demo-close');await phone.waitForFunction(()=>document.getElementById('of-demo-close').hidden);
 }
 check('Demoübung löst keine neue Sicherungsänderung aus',await phone.evaluate(before=>localStorage.getItem('scalpdesk.changes.v1')===before,changes));
 check('Persönliche und alte Demo-Positionen bleiben unverändert vorhanden',await phone.evaluate(raw=>JSON.stringify([__g05.state.positions,__g05.state.demoPositions])===raw&&__g05.state.positions.length===1&&__g05.state.demoPositions.length===1,original));
 const exclusion=await phone.evaluate(()=>{const b=__g05.backupPayload(),s=JSON.stringify(b),ids=['M86-ALTE-DEMO',...__pdf1.readDemo().closed.map(x=>x.id)];return{real:b.positions.some(x=>x.id==='M86-ECHT'),empty:!b.demoPositions.length&&!b.demoHistory.length&&!b.prefs['scalpdesk.orderflow-demo.v1'],leaking:Object.keys(b).filter(k=>ids.some(id=>JSON.stringify(b[k]).includes(id)))};});
 check('Neue persönliche Sicherung schließt alle lokalen Demo-Trades aus',exclusion.real&&exclusion.empty&&!exclusion.leaking.length,exclusion);
 const stale=await phone.evaluate(()=>{const v=__pdf1.view,before=JSON.stringify(v.state.series),result=v.acceptRest({symbol:'LTCUSDT',interval:'1m',rows:[[Date.now(),'100','101','99','100','1',Date.now()+60000,'100']],startedAt:Date.now()-60000});return{unchanged:before===JSON.stringify(v.state.series),ignored:result===undefined||result===false,symbol:v.state.symbol};});
 check('Verspätete LTC-Antwort ersetzt nach ETH-Wechsel keine Kerze und keinen Kurs',stale.unchanged&&stale.ignored&&stale.symbol==='ETHUSDT',stale);
 await phone.tap('#of-demo-clear');check('Orderflow-Löschung erst nach eigener klarer Bestätigung',await phone.locator('#of-demo-clear-confirm').isVisible()&&await phone.evaluate(()=>__pdf1.readDemo().closed.length===3));await phone.tap('#of-demo-clear-yes');
 check('Nur Orderflow-Übungen gelöscht, echte und persönliche alte Demo-Position erhalten',await phone.evaluate(raw=>!__pdf1.readDemo().active.length&&!__pdf1.readDemo().closed.length&&JSON.stringify([__g05.state.positions,__g05.state.demoPositions])===raw,original));
 check('Keine JavaScript-Fehler',!errors.length,errors);await local.close();
 }finally{await browser?.close();await h.teardown();}console.log(`${pass}/${pass+fail} bestanden`);process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
