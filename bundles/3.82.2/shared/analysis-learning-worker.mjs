import { trainAnalysis } from './analysis-learning.mjs';
import { scanTopDownLearning } from './analysis-learning-history.mjs';
globalThis.onmessage=async e=>{try{const j=e.data,value=j.type==='train'?trainAnalysis(j.records,j.previous,j.now,j.force):await scanTopDownLearning(j);globalThis.postMessage({done:true,value});}catch(error){globalThis.postMessage({error:error.message||'Analyse-Lernen fehlgeschlagen.'});}};
