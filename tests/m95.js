// position-1: echte App, getrennte mobile Tippziele und passende Futures trotz Spot-Chart.
const h=require('./harness');let pass=0,fail=0;
const check=(name,ok,detail='')=>{ok?pass++:fail++;console.log(`${ok?'✓':'✗'} ${name}${!ok&&detail?' '+JSON.stringify(detail):''}`);};
(async()=>{
  await h.setup();const browser=await h.launch({workspace:'fresh'});
  try{
    await h.ctl('/walk?on=0');const sentBefore=(await h.ctl('/sent')).length;
    let time=Date.now(),high=false,low=false,failRatio=false,delayed=null;const requests=[];
    const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date(time));
    await ctx.route(/https:\/\/fapi\.binance\.com\/(?:fapi\/v1\/(?:premiumIndex|fundingRate)|futures\/data\/globalLongShortAccountRatio)\?/,async route=>{
      const u=new URL(route.request().url()),p=u.searchParams,sym=p.get('symbol');
      if(u.pathname.includes('globalLongShort')&&p.get('period')!=='4h')return route.continue();
      requests.push({path:u.pathname,sym,p:Object.fromEntries(p),host:u.hostname});
      if(sym==='PAXGUSDT')return route.fulfill({status:400,json:{code:-1121,msg:'Invalid symbol'},headers:{'access-control-allow-origin':'*'}});
      if(u.pathname.includes('globalLongShort')&&failRatio)return route.fulfill({status:500,json:{msg:'Test-Ausfall'},headers:{'access-control-allow-origin':'*'}});
      if(u.pathname.includes('globalLongShort')&&delayed?.symbol===sym){const hold=delayed;hold.started=true;await new Promise(r=>hold.resolve=r);}
      let rows;
      if(u.pathname.endsWith('premiumIndex'))rows={symbol:sym,lastFundingRate:String(sym==='ETHUSDT'?.0001:sym==='LTCUSDT'?(low?-.001:-.0001):high?.001:.0001),time,markPrice:sym==='BTCUSDT'?'64000':'70',nextFundingTime:time+28800000};
      else if(u.pathname.endsWith('fundingRate')){const last=Math.floor(time/28800000)*28800000;rows=Array.from({length:90},(_,i)=>({symbol:sym,fundingTime:last-(89-i)*28800000,fundingRate:String(sym==='ETHUSDT'?.0001:(i%5-2)/10000)})).filter(r=>r.fundingTime>=Number(p.get('startTime'))&&r.fundingTime<=Number(p.get('endTime'))).slice(0,Number(p.get('limit')));}
      else{const last=Math.floor(time/14400000)*14400000,offset=sym==='LTCUSDT'?2:4;rows=Array.from({length:180},(_,i)=>({symbol:sym,timestamp:last-(179-i)*14400000,longShortRatio:String(sym==='ETHUSDT'?1:.8+((i+offset)%5)/10)}));if(high&&sym==='BTCUSDT')rows.at(-1).longShortRatio='1.5';if(low&&sym==='LTCUSDT')rows.at(-1).longShortRatio='0.1';if(p.get('limit')==='1')rows=rows.slice(-1);}
      return route.fulfill({json:rows,headers:{'access-control-allow-origin':'*'}}).catch(()=>{});
    });
    const I=await import('../shared/market-intervals.mjs'),D=await import('../shared/chart-detail.mjs');
    await ctx.route(/https:\/\/(?:data-api\.binance\.vision|api\.binance\.com|fapi\.binance\.com)\/.*klines\?/,route=>{
      const p=new URL(route.request().url()).searchParams,sym=p.get('symbol'),iv=p.get('interval'),prices={BTCUSDT:64000,LTCUSDT:70,ETHUSDT:2500,PAXGUSDT:2600,NEARUSDT:2.4};
      if(!prices[sym]||!I.INTERVAL_MS[iv]||iv==='1M')return route.continue();
      const n=Math.min(Number(p.get('limit'))||500,1000),step=I.INTERVAL_MS[iv],last=D.candleStart(time,iv),price=prices[sym];
      return route.fulfill({json:Array.from({length:n},(_,i)=>{const t=last-(n-1-i)*step;return[t,price,price*1.001,price*.999,price,100,I.intervalEnd(t,iv)-1];}),headers:{'access-control-allow-origin':'*'}});
    });
    await page.goto(h.URL_BASE+'/weather-widget-v2.html');await page.waitForFunction(()=>window.__positioning&&__g05.state.loadedSymbol==='BTCUSDT'&&!__g05.state.busy);await page.locator('.chart-pattern-overview-card').evaluate(n=>n.scrollIntoView({block:'end'}));
    await page.waitForFunction(()=>__positioning.feed.usable()?.symbol==='BTCUSDT');
    check('Sichtbare Karte lädt auch bei noch unsichtbarem Plot',await page.evaluate(()=>{const card=document.querySelector('.chart-pattern-overview-card').getBoundingClientRect(),plot=document.getElementById('chart').getBoundingClientRect();return card.bottom<=innerHeight+1&&plot.top>=innerHeight&&__positioning.feed.usable()?.symbol==='BTCUSDT';}));
    check('BTC-SPOT verwendet BTCUSDT-Perpetual',await page.evaluate(()=>__g05.state.source==='spot'&&__positioning.feed.usable().symbol==='BTCUSDT')&&requests.filter(r=>r.path.endsWith('fundingRate')||r.p.period==='4h').every(r=>r.host==='fapi.binance.com'&&r.sym==='BTCUSDT'));
    check('70 Punkte / Long-lastig aus beiden Rangwerten 70',await page.locator('#positioning-value').innerText()==='70 · Long-lastig'&&await page.evaluate(()=>__positioning.feed.usable().fundingPercentile===70&&__positioning.feed.usable().ratioPercentile===70));
    check('Marker bei 70; Squeeze-Hinweis nicht voreilig',await page.locator('#positioning-score').evaluate(n=>n.style.getPropertyValue('--position')==='70%')&&!await page.locator('#positioning-warning').isVisible());
    const snapshot=await page.evaluate(()=>JSON.stringify({positions:__g05.state.positions,trades:__g05.state.trades,alarms:__g05.state.alarms,candles:__g05.state.candles}));
    const n=await page.evaluate(()=>__positioning.feed.state.requests),ownHistory=requests.filter(r=>r.path.endsWith('fundingRate')||r.p.period==='4h').length;await page.evaluate(()=>{for(let i=0;i<40;i++)__positioning.tick();});await page.waitForTimeout(100);
    check('Wiederholte Anzeige-Ticks erzeugen keine neuen Abrufe',await page.evaluate(n=>__positioning.feed.state.requests===n,n)&&requests.filter(r=>r.path.endsWith('fundingRate')||r.p.period==='4h').length===ownHistory);
    check('Score hat keine eigene Handels-/Alarm-/Preiswirkung',await page.evaluate(s=>JSON.stringify({positions:__g05.state.positions,trades:__g05.state.trades,alarms:__g05.state.alarms,candles:__g05.state.candles})===s,snapshot));
    await page.click('#positioning-info');check('Antippbare Erklärung, 50/50 und keine Kursprognose',await page.locator('#positioning-dialog').isVisible()&&/Positionierung am Markt, keine Kursprognose/.test(await page.locator('#positioning-body').innerText())&&/je 50 %/.test(await page.locator('#positioning-body').innerText()));
    check('Tatsächliche Teilwerte und Datenumfang erklärt',/Funding-Perzentil.*70,0 \/ 100.*Long\/Short-Perzentil.*70,0 \/ 100/s.test(await page.locator('#positioning-body').innerText())&&/90 Funding · 180 × 4h/.test(await page.locator('#positioning-body').innerText()));
    await page.mouse.click(4,4);check('Tippen neben Erklärung schließt',!await page.locator('#positioning-dialog').isVisible());
    await page.click('#chart-pattern-overview');check('Muster-Gesamtbild bleibt ein getrenntes Tippziel',await page.locator('#pat-overview-info').isVisible()&&!await page.locator('#positioning-dialog').isVisible());await page.click('#pat-overview-close');
    for(const width of [320,390,768,1440]){
      await page.setViewportSize({width,height:900});await page.locator('.chart-pattern-overview-card').scrollIntoViewIfNeeded();
      const layout=await page.evaluate(()=>{const card=document.querySelector('.chart-pattern-overview-card'),left=document.getElementById('chart-pattern-overview'),right=document.getElementById('positioning-score'),info=document.getElementById('positioning-info'),value=document.getElementById('positioning-value'),r=card.getBoundingClientRect(),l=left.getBoundingClientRect(),p=right.getBoundingClientRect(),i=info.getBoundingClientRect();const original=left.textContent;left.textContent='Muster-Gesamtbild · 5m–1w\n62 % bullisch · 38 % bärisch\n7/7 Ebenen · Widersprüchlich';const range=document.createRange();range.selectNodeContents(left);const text=range.getBoundingClientRect(),longFits=text.bottom<=l.bottom-7&&text.top>=l.top+2&&text.right<=l.right-3;left.textContent=original;return{inside:r.left>=0&&r.right<=innerWidth+1,separate:l.right<=p.left+1,readable:value.scrollWidth<=value.clientWidth&&left.scrollHeight<=left.clientHeight,longFits,info44:i.width>=44&&i.height>=44,noOverflow:document.documentElement.scrollWidth<=innerWidth+1};});
      check(width+'px: nebeneinander, ganze Texte, 44px und kein Überlauf',Object.values(layout).every(Boolean),layout);
    }
    await page.setViewportSize({width:390,height:844});await page.locator('.chart-pattern-overview-card').screenshot({path:'/tmp/scalpdesk-positionierung-dark.png'});
    const modes=[{name:'Hell',mode:'light'},{name:'Dunkel',mode:'dark'},...await page.evaluate(()=>__sdAppearance.palette.map(p=>({...p,mode:'custom'})))];
    for(const mode of modes){await page.click('#view-menu');await page.click(`[data-theme-set="${mode.mode}"]`);if(mode.color)await page.click(`[data-background-color="${mode.color}"]`);await page.click('#view-menu');
      const result=await page.locator('#positioning-score').evaluate(box=>{const hex=s=>'#'+s.match(/[\d.]+/g).slice(0,3).map(n=>Math.round(+n).toString(16).padStart(2,'0')).join(''),bg=hex(getComputedStyle(box.parentElement).backgroundColor);return [...box.querySelectorAll('.positioning-head>span,button,output,.positioning-warning')].map(n=>__sdAppearance.contrast(hex(getComputedStyle(n).color),bg));});
      check(mode.name+': Zahlen, Info und Hinweis mit AA-Kontrast',result.every(v=>v>=4.5),result);
    }
    await page.click('[data-workspace-target="chart"]');
    await page.evaluate(()=>__intervals.setMarket('LTCUSDT','1h'));await page.locator('.chart-pattern-overview-card').scrollIntoViewIfNeeded();await page.waitForFunction(()=>__positioning.feed.usable()?.symbol==='LTCUSDT');
    check('LTC: eigene Daten und Short-lastig statt BTC-Wert',await page.locator('#positioning-value').innerText()==='30 · Short-lastig'&&requests.some(r=>r.sym==='LTCUSDT'&&r.path.endsWith('fundingRate')));
    const ltcFunding=requests.filter(r=>r.sym==='LTCUSDT'&&r.path.endsWith('fundingRate')).length;await page.evaluate(()=>__intervals.setMarket('LTCUSDT','4h'));await page.waitForTimeout(1200);check('Timeframewechsel nutzt dieselbe Perpetual-Positionierung',await page.locator('#positioning-value').innerText()==='30 · Short-lastig'&&requests.filter(r=>r.sym==='LTCUSDT'&&r.path.endsWith('fundingRate')).length===ltcFunding);
    await page.evaluate(()=>__intervals.setMarket('ETHUSDT','1h'));await page.locator('.chart-pattern-overview-card').scrollIntoViewIfNeeded();await page.waitForFunction(()=>__positioning.feed.usable()?.symbol==='ETHUSDT');check('Gleichbleibende Daten ergeben Neutral 50',await page.locator('#positioning-value').innerText()==='50 · Neutral');
    await page.evaluate(()=>__intervals.setMarket('BTCUSDT','1h'));await page.locator('.chart-pattern-overview-card').scrollIntoViewIfNeeded();await page.waitForFunction(()=>__positioning.feed.usable()?.symbol==='BTCUSDT');const oldRequests=requests.length;
    check('Rückkehr zu BTC lädt den Verlauf nicht erneut',await page.locator('#positioning-value').innerText()==='70 · Long-lastig'&&requests.filter(r=>r.sym==='BTCUSDT'&&r.path.endsWith('fundingRate')).length===1);
    high=true;time+=300001;await page.clock.setFixedTime(new Date(time));await page.evaluate(()=>__positioning.feed.tick(__g05.state.symbol));
    check('Nach 5 Minuten aktualisiert; keine erneute 30-Tage-Historie',requests.length>oldRequests&&requests.filter(r=>r.sym==='BTCUSDT'&&r.path.endsWith('fundingRate')).length===1&&requests.some(r=>r.sym==='BTCUSDT'&&r.p.limit==='1'&&r.p.period==='4h'));
    check('Extremer Score mit Squeeze-Risiko und Marker rechts',await page.locator('#positioning-value').innerText()==='100 · Long-lastig'&&await page.locator('#positioning-warning').isVisible()&&await page.locator('#positioning-score').evaluate(n=>n.style.getPropertyValue('--position')==='100%'));
    const height=await page.locator('.chart-pattern-overview-card').evaluate(n=>n.offsetHeight);failRatio=true;time+=300001;await page.clock.setFixedTime(new Date(time));await page.evaluate(()=>__positioning.feed.tick(__g05.state.symbol));
    check('API-Fehler: Strich statt alter Punkte; Höhe stabil',await page.locator('#positioning-value').innerText()==='-'&&await page.locator('#positioning-score').getAttribute('data-ready')==='false'&&await page.locator('.chart-pattern-overview-card').evaluate(n=>n.offsetHeight)===height);
    await page.click('#positioning-info');check('Fehler bleibt auf Positionierungs-Erklärung begrenzt',/Fehler 500/.test(await page.locator('#positioning-body').innerText())&&await page.locator('#alarm-here').isEnabled());await page.click('#positioning-close');failRatio=false;
    await page.evaluate(()=>__intervals.setMarket('PAXGUSDT','1h'));await page.locator('.chart-pattern-overview-card').scrollIntoViewIfNeeded();await page.waitForFunction(()=>__positioning.feed.state.symbol==='PAXGUSDT'&&!!__positioning.feed.state.error);check('Spot-Coin ohne Perpetual: Strich, keine Ausnahme',await page.locator('#positioning-value').innerText()==='-'&&/kein Binance-USDT-Perpetual/.test(await page.evaluate(()=>__positioning.feed.state.error)));
    low=true;await page.evaluate(()=>__intervals.setMarket('LTCUSDT','1h'));await page.locator('.chart-pattern-overview-card').scrollIntoViewIfNeeded();await page.waitForFunction(()=>__g05.state.loadedSymbol==='LTCUSDT'&&!__g05.state.busy);await page.locator('#chart').scrollIntoViewIfNeeded();await page.waitForFunction(()=>__positioning.feed.usable()?.symbol==='LTCUSDT');
    check('Auch Short-Extrem zeigt Squeeze-Risiko',await page.locator('#positioning-value').innerText()==='0 · Short-lastig'&&await page.locator('#positioning-warning').isVisible());
    await page.click('#chart-full');await page.click('#fb-tools');await page.click('#positioning-info');check('Info im vergrößerten Chart erreichbar',await page.locator('#positioning-dialog').isVisible());await page.click('#positioning-close');await page.click('#fb-exit');
    await page.click('#pause');const beforePause=requests.length;time+=300001;await page.clock.setFixedTime(new Date(time));await page.evaluate(()=>__positioning.tick());check('Pause verhindert weitere Positionierungs-Abrufe',requests.length===beforePause);await page.click('#pause');
    delayed={symbol:'NEARUSDT',started:false};await page.evaluate(()=>__intervals.setMarket('NEARUSDT','1h'));await page.locator('.chart-pattern-overview-card').scrollIntoViewIfNeeded();await page.waitForFunction(()=>__positioning.feed.state.symbol==='NEARUSDT'&&__positioning.feed.state.busy);for(let i=0;i<30&&!delayed.started;i++)await page.waitForTimeout(100);
    await page.evaluate(()=>__intervals.setMarket('ETHUSDT','1h'));await page.locator('.chart-pattern-overview-card').scrollIntoViewIfNeeded();await page.waitForFunction(()=>__positioning.feed.usable()?.symbol==='ETHUSDT');if(delayed.resolve)delayed.resolve();await page.waitForTimeout(150);
    check('Verspätete fremde Antwort verdrängt aktuellen Coin nicht',await page.evaluate(()=>__positioning.feed.usable()?.symbol==='ETHUSDT')&&await page.locator('#positioning-value').innerText()==='50 · Neutral');
    check('Keine JavaScript-Laufzeitfehler',errors.length===0,errors);check('Keine Telegram-Nachricht aus Positionierungsanalyse',(await h.ctl('/sent')).length===sentBefore);
    await ctx.close();
  }finally{await browser.close();await h.teardown();}
  console.log(`\n${pass}/${pass+fail} bestanden`);process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
