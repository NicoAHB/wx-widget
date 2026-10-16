// Gemeinsame Browser-Prüfung des tatsächlichen Info-Moduls und seiner CSS-Regeln.
module.exports=async function({moduleUrl}){
 const {createMacdHelp}=await import(moduleUrl),out={};let at=Date.now(),saved=[];
 const event=direction=>({direction,age:0,confirmedAt:at,originTime:at-300000,delayBars:1,distance:1,threshold:.02});
 const c={symbol:'BTCUSDT',source:'spot',interval:'5m',analysisInterval:'5m',enabled:true,findings:{ready:true,current:{closeTime:at-1,line:1,signal:0,histogram:1},events:{},pending:{signal:{direction:1,observedAt:at,waitingBars:1}}}};
 function mount(){const frame=document.createElement('iframe');document.body.append(frame);const d=frame.contentDocument;for(const style of document.querySelectorAll('style'))d.head.append(style.cloneNode(true));const pair=d.createElement('span');pair.className='overlay-toggles';const button=d.createElement('button');button.className='macd-info';button.textContent='i';pair.append(button);d.body.append(pair);const ui=createMacdHelp({document:d,button,read:()=>c,now:()=>at,loadNotices:()=>saved,saveNotices:v=>saved=v}),css=()=>frame.contentWindow.getComputedStyle(button);return{frame,d,button,ui,css};}
 const q=mount();q.ui.update();
 out.earlyQuiet=q.button.dataset.macdTone==='pending'&&q.button.dataset.macdBlink==='false'&&q.css().animationName==='none'&&q.button.getAttribute('aria-label').includes('Noch unbestätigt');
 q.button.click();out.earlyExplained=q.ui.dialog.open&&q.d.querySelectorAll('.macd-direction.is-active').length===0&&q.d.querySelector('[data-strategy=signal] .macd-strategy-state').textContent.includes('1/2');q.ui.dialog.close();
 c.findings.pending={};c.findings.events={signal:event(1),zero:event(1)};q.ui.update();
 out.confirmedPulse=q.button.dataset.macdTone==='bull'&&q.button.dataset.macdBlink==='true'&&q.css().animationName==='macd-info-pulse';
 out.fiveSeconds=parseFloat(q.css().animationDuration)*Number(q.css().animationIterationCount)===5;
 const animation=q.button.getAnimations()[0];animation.pause();animation.currentTime=0;const a=q.css().opacity;animation.currentTime=625;out.visiblePulse=q.css().opacity!==a;
 q.button.click();out.matches=q.ui.dialog.open&&q.d.querySelectorAll('.macd-direction.is-active').length===2&&q.d.querySelector('.macd-found').textContent.includes('Folgekerze');q.ui.dialog.close();
 at+=5001;q.ui.update();out.steadyAfterFive=q.button.dataset.macdTone==='bull'&&q.button.dataset.macdBlink==='false'&&q.css().animationName==='none';
 q.button.click();out.openDoesNotReplay=q.button.dataset.macdBlink==='false';q.ui.dialog.close();
 c.findings.events.signal=event(-1);q.ui.update();out.mixed=q.button.dataset.macdTone==='mixed'&&q.css().animationName==='macd-info-mixed'&&q.button.getAttribute('aria-label').includes('Bullishe und bearishe Befunde');
 const mix=q.button.getAnimations()[0];mix.pause();mix.currentTime=0;const green=q.css().color;mix.currentTime=1300;out.mixedColors=green!==q.css().color;
 at+=5001;q.ui.update();out.mixedSteady=q.css().animationName==='none'&&q.css().backgroundImage.includes('linear-gradient');
 const r=mount();r.ui.update();out.reloadDoesNotReplay=r.button.dataset.macdBlink==='false'&&r.button.dataset.macdTone==='mixed';r.frame.remove();
 c.findings.ready=false;q.ui.update();out.offlineStops=q.button.dataset.macdTone==='neutral'&&q.button.dataset.macdBlink==='false';
 c.findings.ready=true;q.ui.update();out.resumeDoesNotReplay=q.button.dataset.macdBlink==='false';
 c.findings.events={divergence:{...event(1),confirmedAt:at-31000,originTime:at-60000}};q.ui.update();out.lateQuiet=q.button.dataset.macdTone==='bull'&&q.button.dataset.macdBlink==='false';
 c.findings.events={};q.ui.update();out.expired=q.button.dataset.macdTone==='neutral'&&q.css().animationName==='none';
 q.frame.remove();return out;
};
