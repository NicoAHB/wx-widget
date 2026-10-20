import { scanMarketStrategies } from './market-strategy-history.mjs';
globalThis.onmessage=async event=>{try{const value=await scanMarketStrategies(event.data);globalThis.postMessage({done:true,value});}catch(error){globalThis.postMessage({error:error.message});}};
