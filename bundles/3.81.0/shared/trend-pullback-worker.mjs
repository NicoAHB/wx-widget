import { scanPullbackHistory } from './trend-pullback-backtest.mjs';
import { trainPullback } from './trend-pullback-learning.mjs';
globalThis.onmessage=async event=>{try{const j=event.data,value=j.type==='train'?trainPullback(j.records,j.previous,j.now,j.force):await scanPullbackHistory(j);globalThis.postMessage({done:true,value});}catch(e){globalThis.postMessage({error:e.message||'Rücksetzer-Berechnung fehlgeschlagen.'});}};
