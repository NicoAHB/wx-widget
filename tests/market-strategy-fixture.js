const H=3600000,Q=900000,AT=Date.UTC(2026,9,20,10,45);
function wave(n,ms,end){return Array.from({length:n},(_,i)=>{const close=100+1.5*Math.sin(i*Math.PI/4),open=close-.05;return {time:end-(n-i)*ms,end:end-(n-i-1)*ms,open,close,high:Math.max(open,close)+.2,low:Math.min(open,close)-.2,volume:100};});}
function strategyFixture(id='range-return',direction=1){const hour=wave(500,H,Math.floor(AT/H)*H),low=wave(500,Q,AT),n=low.length,levels={high:Math.max(...hour.slice(-48).map(c=>c.high)),low:Math.min(...hour.slice(-48).map(c=>c.low))};
 if(id==='range-return'){const edge=levels.low;Object.assign(low[n-2],{open:edge+.25,close:edge+.2,high:edge+.35,low:edge-.12});Object.assign(low[n-1],{open:edge+.2,close:edge+.4,high:edge+.5,low:edge+.15});}
 else {const edge=levels.high;for(let j=n-24;j<n;j++)Object.assign(low[j],{open:edge-.4,close:edge-.35,high:edge-.2,low:edge-.6,volume:100});Object.assign(low[n-3],{open:edge-.2,close:edge+.45,high:edge+.5,low:edge-.25,volume:180});Object.assign(low[n-2],{open:edge+.4,close:edge+.2,high:edge+.45,low:edge-.05,volume:85});Object.assign(low[n-1],{open:edge+.2,close:edge+.55,high:edge+.65,low:edge+.15,volume:120});}
 const candles={'1h':hour,'15m':low};if(direction===-1)for(const rows of Object.values(candles))for(const c of rows){const {high,low}=c;c.open=200-c.open;c.close=200-c.close;c.high=200-low;c.low=200-high;}
 return {id,direction,candles,symbol:'BTCUSDT',market:'spot',now:AT+5000,phase:{ready:true,phase:0,at:Math.floor(AT/H)*H,count:3,version:'market-phase-1'}};
}
module.exports={wave,strategyFixture,H,Q,AT};
