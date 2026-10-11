// Native Detail-Kerzen und Formationschips: isolierte Anzeige, Paging, Touch und reale pat-1-Geometrie.
const h=require('./harness'),fs=require('fs'),vm=require('vm');
let pass=0,fail=0;const check=(name,ok,extra='')=>{ok?pass++:fail++;console.log(`${ok?'✓':'✗'} ${name}${!ok&&extra?' '+JSON.stringify(extra):''}`);};
(async()=>{
  await h.setup();const browser=await h.launch();
  try{
    await h.ctl('/walk?on=0');await h.ctl('/silent?on=1');
    const ctx=await browser.newContext({viewport:{width:390,height:844}}),page=await ctx.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
    const I=await import('../shared/market-intervals.mjs'),D=await import('../shared/chart-detail.mjs');let reject=false,fixture=null;
    await ctx.route(/https:\/\/(?:data-api\.binance\.vision|api\.binance\.com|fapi\.binance\.com)\/.*klines\?/,async route=>{
      const u=new URL(route.request().url()),q=u.searchParams,iv=q.get('interval'),symbol=q.get('symbol'),limit=+(q.get('limit')||500),fine=q.has('endTime')||q.has('startTime');
      if(fixture&&symbol==='BTCUSDT'&&iv==='1h'&&!fine)return route.fulfill({json:fixture,headers:{'access-control-allow-origin':'*'}});
      if(!fine||symbol==='EURUSDT'||!['1m','5m','15m','30m','1h','2h','4h','1d','1w'].includes(iv))return route.continue();
      requests.push({symbol,iv,limit,source:u.hostname.startsWith('fapi')?'futures':'spot',end:q.get('endTime'),start:q.get('startTime')});
      if(reject)return route.fulfill({status:400,json:{code:-1121,msg:'Test-Ausfall'},headers:{'access-control-allow-origin':'*'}});
      const ms=I.INTERVAL_MS[iv],last=D.candleStart(Date.now(),iv),base=symbol==='BTCUSDT'?64000:symbol==='BSVUSDT'?32:70;
      let end=q.has('endTime')?Math.min(last,D.candleStart(+q.get('endTime'),iv)):Math.min(last,D.candleStart(+q.get('startTime'),iv)+(limit-1)*ms);
      let start=q.has('startTime')?D.candleStart(+q.get('startTime'),iv):end-(limit-1)*ms;
      const rows=[];for(let t=start;t<=end&&rows.length<limit;t+=ms){const p=base*(1+Math.sin(t/ms/9)*.001);rows.push([t,p,p+base*.001,p-base*.001,p,10,I.intervalEnd(t,iv)-1]);}
      return route.fulfill({json:rows,headers:{'access-control-allow-origin':'*'}});
    });
    await page.goto(h.URL_BASE+'/weather-widget-v2.html');await page.waitForFunction(()=>window.__chartDetail&&__g05.state.candles.length>200);
    check('Unter 1h bleibt Auflösungswahl unsichtbar',!await page.locator('#chart-detail-control').isVisible());
    await page.evaluate(()=>__intervals.setMarket('BTCUSDT','1h'));await page.waitForFunction(()=>__g05.state.interval==='1h'&&!__g05.state.busy&&__g05.state.candles.length>200);
    await page.locator('#chart').scrollIntoViewIfNeeded();
    check('1h zeigt nur Aus/1m/5m/15m/30m',await page.locator('#chart-detail-resolution option').evaluateAll(nodes=>nodes.map(n=>n.value).join(','))===',1m,5m,15m,30m');
    const before=await page.evaluate(()=>({candles:JSON.stringify(__g05.state.candles),rating:JSON.stringify(__intervals.ratingFor('1h')),positions:JSON.stringify(__g05.state.positions),alarms:JSON.stringify(__g05.state.alarms)}));
    await page.selectOption('#chart-detail-resolution','1m');await page.waitForFunction(()=>__chartDetail.state.candles.length>=1500&&!__chartDetail.state.busy&&document.querySelector('#chart .detail-candles canvas'));
    const loaded=await page.evaluate(()=>({length:__chartDetail.state.candles.length,geometry:__chartDetail.geometry.data.length,iv:__g05.state.interval,caption:document.getElementById('chart-caption').textContent,note:document.getElementById('chart-detail-status').textContent}));
    check('1m-Detaildarstellung begrenzt auf 1500, Hauptintervall bleibt 1h',loaded.geometry===1500&&loaded.iv==='1h'&&loaded.caption.includes('Haupt-Zeitrahmen 1h')&&loaded.note.includes('1500'),loaded);
    check('Historie wird tatsächlich in mehreren Binance-Seiten geladen',requests.filter(r=>r.symbol==='BTCUSDT'&&r.iv==='1m'&&r.end).length>=2&&requests.every(r=>r.limit<=1000));
    check('Hauptkerzen, Trendbewertung, Positionen und Alarme unverändert',await page.evaluate(b=>b.candles===JSON.stringify(__g05.state.candles)&&b.rating===JSON.stringify(__intervals.ratingFor('1h'))&&b.positions===JSON.stringify(__g05.state.positions)&&b.alarms===JSON.stringify(__g05.state.alarms),before));
    const paint=await page.locator('#chart .detail-candles canvas').evaluate(c=>{const bytes=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<bytes.length;i+=4)if(bytes[i])n++;return{pixels:n,width:c.width,height:c.height};});
    check('Detail-Kerzen samt Volumen werden wirklich gezeichnet',paint.pixels>1000&&paint.width>0&&paint.height>0,paint);
    await page.evaluate(()=>{const s=__chartDetail.state,k=s.candles.at(-1);__pdf1.onLive({t:'k',m:'spot',s:'BTCUSDT',i:'1m',E:Date.now(),k:{t:k.time,T:k.closeTime,o:k.open,h:k.high+10,l:k.low,c:k.close+5,v:k.volume+1}});});
    check('Echtzeit aktualisiert letzte Detail-Kerze statt Hauptanalyse',await page.evaluate(b=>__chartDetail.state.candles.at(-1).volume===11&&JSON.stringify(__g05.state.candles)===b.candles,before));
    const oldPrice=await page.evaluate(()=>__chartDetail.state.candles.at(-1).close);
    await page.evaluate(()=>{const k=__chartDetail.state.candles.at(-1);__pdf1.onLive({t:'k',m:'futures',s:'BTCUSDT',i:'1m',E:Date.now(),k:{t:k.time,T:k.closeTime,o:100,h:200,l:99,c:150,v:999}});});
    check('Futures-Livekurse verändern keine Spot-Detail-Kerze',await page.evaluate(p=>__chartDetail.state.candles.at(-1).close===p,oldPrice));
    const first=await page.evaluate(()=>__chartDetail.state.candles[0].time);await page.evaluate(()=>__chartDetail.pan(__chartDetail.state.candles.length-__chartDetail.state.count+50));await page.waitForFunction(t=>!__chartDetail.state.busy&&__chartDetail.state.candles[0].time<t,first);
    check('Nach links scrollen lädt ältere Kerzen und erhält Zeitanker',await page.evaluate(()=>__chartDetail.state.pan>0&&__chartDetail.state.anchorTime!==null&&__chartDetail.state.candles.length>2000));
    const historicScale=await page.evaluate(()=>__g09.chartScale());
    await page.click('#zz-fc');await page.evaluate(()=>{__g05.state.overlays.ewfc=true;__chartDetail.pan(__chartDetail.state.pan);});await page.locator('#chart').scrollIntoViewIfNeeded();await page.waitForTimeout(200);
    check('Historische Detail-Kerzen zeigen keine aktuellen Zukunftsprognosen',await page.locator('#chart .zz-fc,#chart .zz-fc-note,#chart .ew-fc').count()===0);
    check('Historische Preisachse bleibt beim Einschalten der Zukunftsprognose gleich',await page.evaluate(old=>{const next=__g09.chartScale();return old.min===next.min&&old.max===next.max;},historicScale));
    await page.click('#zz-fc');await page.evaluate(()=>{__g05.state.overlays.ewfc=false;__chartDetail.pan(__chartDetail.state.pan);});
    for(const [width,height]of [[320,844],[390,844],[768,1024],[1440,1000]]){
      await page.setViewportSize({width,height});await page.locator('#chart-detail-control').scrollIntoViewIfNeeded();await page.waitForTimeout(200);
      const layout=await page.evaluate(()=>{const s=document.getElementById('chart-detail-resolution').getBoundingClientRect(),r=document.getElementById('chart-pattern-row').getBoundingClientRect();return{overflow:document.documentElement.scrollWidth>innerWidth+1,selectWidth:s.width,selectHeight:s.height,right:Math.max(s.right,r.right),width:innerWidth};});
      check(`${width}px: Auswahl und Musterbereich ohne Seitenüberlauf, mindestens 44px hoch`,!layout.overflow&&layout.selectHeight>=44&&layout.right<=layout.width+1,layout);
    }
    await page.setViewportSize({width:390,height:844});await page.reload();await page.waitForFunction(()=>window.__chartDetail&&__chartDetail.resolution==='1m'&&!__chartDetail.state.busy&&__chartDetail.state.candles.length>1000);
    check('Auflösung wird nach Neuladen wiederhergestellt',await page.evaluate(()=>__g05.state.interval==='1h'&&__chartDetail.resolution==='1m'));
    await page.evaluate(()=>__intervals.setMarket('LTCUSDT','1h'));await page.waitForFunction(()=>__g05.state.loadedSymbol==='LTCUSDT'&&__chartDetail.state.context?.symbol==='LTCUSDT'&&!__chartDetail.state.busy&&__chartDetail.state.candles.length>1000);
    check('Coinwechsel berechnet neu und enthält ausschließlich LTC-Kurse',await page.evaluate(()=>__chartDetail.state.candles.every(c=>c.close<100)));
    await page.evaluate(()=>__intervals.setMarket('LTCUSDT','4h'));await page.waitForFunction(()=>__g05.state.interval==='4h'&&!__g05.state.busy&&__g05.state.candles.length>200);
    check('Unerlaubtes 1m bei 4h fällt auf normale Kerzen zurück',await page.evaluate(()=>__chartDetail.resolution===''&&!__chartDetail.state.candles.length&&!document.querySelector('#chart .detail-candles')));
    reject=true;await page.selectOption('#chart-detail-resolution','5m');await page.waitForFunction(()=>__chartDetail.state.error&&!__chartDetail.state.busy);
    check('Detail-API-Fehler zeigt Hinweis und lässt Hauptchart benutzbar',await page.locator('#chart-detail-retry').isVisible()&&await page.locator('#chart svg').count()===1&&await page.evaluate(()=>__g05.state.candles.length>200&&!__g05.state.marketError));
    reject=false;await page.click('#chart-detail-retry');await page.waitForFunction(()=>!__chartDetail.state.error&&!__chartDetail.state.busy&&__chartDetail.state.candles.length>1000);
    check('Erneut laden stellt Detail-Chart nach Ausfall wieder her',!!await page.locator('#chart .detail-candles canvas').count());
    await page.selectOption('#chart-detail-resolution','');
    await page.evaluate(()=>__intervals.setMarket('BSVUSDT','1h'));await page.waitForFunction(()=>__g05.state.loadedSymbol==='BSVUSDT'&&__g05.state.source==='futures'&&!__g05.state.busy);
    await page.selectOption('#chart-detail-resolution','5m');await page.waitForFunction(()=>__chartDetail.state.context?.source==='futures'&&!__chartDetail.state.busy&&__chartDetail.state.candles.length>500);
    check('Futures-Coin nutzt ausschließlich Futures-Detailquelle',requests.filter(r=>r.symbol==='BSVUSDT'&&r.iv==='5m').every(r=>r.source==='futures')&&await page.evaluate(()=>__chartDetail.state.candles.every(c=>c.close<40)));
    await page.selectOption('#chart-detail-resolution','');
    // Tatsächliche pat-1-Erkennung: Ascending-Triangle-Fixture erzeugt mehrere verschiedene Formationen.
    const src=fs.readFileSync(__dirname+'/m58.js','utf8'),B=vm.runInNewContext(src.slice(src.indexOf('const BUILD = () => {'),src.indexOf('\nconst tests = {'))+'\nBUILD()'),shape=B.path(B.F.asc_triangle),ms=3600000,base=Math.floor(Date.now()/ms)*ms-500*ms;
    const k=[...Array.from({length:500-shape.length},()=>({o:85,h:85.1,l:84.9,c:85,v:100})),...shape,{o:97,h:97.1,l:96.9,c:97,v:1}];fixture=k.map((c,i)=>[base+i*ms,c.o,c.h,c.l,c.c,c.v,base+(i+1)*ms-1]);
    await page.evaluate(()=>__intervals.setMarket('BTCUSDT','1h'));await page.waitForFunction(()=>__g05.state.loadedSymbol==='BTCUSDT'&&!__g05.state.busy&&__g09.chipRows().filter(r=>!r.disabled).length>=2);
    const chip=await page.evaluate(()=>__g09.chipRows().filter(r=>!r.disabled).map(r=>({key:r.key,id:r.hit.id,q:r.hit.q})));
    check('Chips stammen aus regelbasierter Engine im gewählten Haupt-Timeframe',chip.length>=2&&chip.every(r=>r.q>=60)&&await page.evaluate(()=>__g09.pat.res.key.endsWith('|1h')&&__g09.pat.viaWorker>0));
    check('Muster-Leiste steht im markierten Kursbereich beim Alarm, BTC-Anzeige bleibt erhalten',await page.evaluate(()=>document.getElementById('chart-pattern-row').contains(document.getElementById('alarm-here'))&&document.getElementById('chart-pattern-row').contains(document.getElementById('of-btc-chart'))));
    await page.locator(`button[data-pattern-key="${chip[0].key}"]`).click();await page.waitForFunction(()=>!!document.querySelector('#chart .pat-chip-drawing'));
    check('Tippen zeichnet Grenzen, Schlüsselpunkte und Label',await page.locator('#chart .pat-chip-line').count()>0&&await page.locator('#chart .pat-chip-point').count()>0&&await page.locator('#chart .pat-chip-label').count()>0);
    await page.locator(`button[data-pattern-key="${chip[1].key}"]`).click();await page.waitForFunction(()=>document.querySelectorAll('#chart .pat-chip-drawing').length===2);
    check('Mehrere Muster gleichzeitig mit verschiedenen Zeichenfarben',await page.locator('#chart .pat-chip-drawing').evaluateAll(groups=>new Set(groups.map(g=>g.querySelector('line')?.getAttribute('stroke'))).size===2));
    check('Keine Doppelungen in Leiste, Grenzen der Zonen gezeichnet',new Set(chip.map(c=>c.id)).size===chip.length&&await page.locator('#chart .pat-chip-zone').count()>0);
    check('Ausbruchslinie nutzt echtes Engine-Level brk',await page.locator('#chart .pat-chip-level[data-level="brk"]').count()>0);
    const nodes=await page.evaluate(()=>{window.m92ChipNodes=[...document.querySelectorAll('.chart-pattern-chip')];__g09.chipPaint();return window.m92ChipNodes.every((n,i)=>document.querySelectorAll('.chart-pattern-chip')[i]===n);});
    check('Live-Aktualisierung ersetzt keine Chip-Knoten und verliert keine Auswahl',nodes&&await page.evaluate(()=>__g09.chipSelection().length===2));
    await page.locator(`button[data-pattern-key="${chip[0].key}"]`).click();await page.waitForFunction(()=>document.querySelectorAll('#chart .pat-chip-drawing').length===1);
    check('Erneutes Tippen blendet genau dieses Muster aus',await page.locator('#chart .pat-chip-drawing').count()===1);
    const invalid=await page.evaluate(key=>{const row=__g09.chipRows().find(r=>r.key===key);row.hit.status='ungültig';__g09.chipPaint();return {selected:__g09.chipSelection().length,disabled:document.querySelector(`button[data-pattern-key="${key}"]`).disabled};},chip[1].key);
    check('Ungültiges Muster gedimmt, nicht auswählbar und Zeichnung entfernt',invalid.disabled&&invalid.selected===0);
    await page.evaluate(()=>{__g09.pat.minQ=101;__g09.chipPaint();});
    check('Leere Liste zeigt Keine Muster erkannt',await page.locator('#chart-pattern-empty').innerText()==='Keine Muster erkannt'&&await page.locator('.chart-pattern-chip').count()===0);
    await page.evaluate(()=>__intervals.setMarket('LTCUSDT','1m'));await page.waitForFunction(()=>__g05.state.loadedSymbol==='LTCUSDT'&&!__g05.state.busy);
    check('Coin-/Timeframewechsel entfernt alte Muster-Auswahl',await page.evaluate(()=>__g09.chipSelection().length===0&&(!__g09.pat.res||__g09.pat.res.key.startsWith('LTCUSDT|'))));
    if(errors.length)console.log('Laufzeitfehler',errors);check('Keine JavaScript-Laufzeitfehler',errors.length===0);
    await ctx.close();
  }finally{await browser.close();await h.teardown();}
  console.log(`\n${pass}/${pass+fail} bestanden`);process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
