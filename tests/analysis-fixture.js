// Deterministische OHLCV-Daten: Aufwärtstrend auf 4h, FVG/POC-Konfluenz auf 1h,
// danach zwei Umkehrkerzen und ein Schlussbruch auf 15m. Keine laufende Kerze.
const H=3600000,Q=900000,CUT=Date.UTC(2026,9,18,10),LAST=CUT+2*Q;
function rows(n,step,end,trend=false){return Array.from({length:n},(_,i)=>{const close=trend?80+i*.08+Math.sin(i*.4)*1.2:100+Math.sin(i*.28)*2+Math.sin(i*.05)*.7,open=close-Math.cos(i*.28)*.12,time=end-(n-i)*step;return{time,end:time+step,knownAt:time+step,open,close,high:Math.max(open,close)+.23,low:Math.min(open,close)-.23,volume:100+Math.sin(i)*20};});}
function fixture(direction=1){const high=rows(500,4*H,Math.floor(LAST/(4*H))*4*H,true),hour=rows(500,H,CUT),low=rows(250,Q,LAST+Q),price=98.62363748682321;
for(let i=low.length-5;i<low.length;i++){const offset=i-low.length+5,open=price+.8-offset*.15;low[i]={...low[i],open,close:open-.05,high:open+.1,low:open-.15};}
const i=low.length-3;low[i]={...low[i],open:price+.2,close:price+.1,high:price+.4,low:price};low[i+1]={...low[i+1],open:price+.1,close:price+.3,high:price+.35,low:price};low[i+2]={...low[i+2],open:price+.3,close:price+1.1,high:price+1.3,low:price+.25};
const candles={'4h':high,'1h':hour,'15m':low};if(direction===-1)for(const cs of Object.values(candles))for(const c of cs){const{high,low}=c;c.open=400-c.open;c.close=400-c.close;c.high=400-low;c.low=400-high;}
return{candles,now:LAST+Q+5000,symbol:'BTCUSDT',market:'spot'};}
module.exports={fixture,rows,H,Q};
// 3.78.2: bestätigte steigende Struktur nach langer Abwärtsphase; EMA-Lage bleibt bearish.
function mixedFixture(){const f=fixture();f.candles['4h']=f.candles['4h'].map((c,i)=>{const close=(i<400?200-i*.2:120+(i-400)*.08)+Math.sin(i*.4)*1.2,open=close-Math.cos(i*.28)*.12;return{...c,open,close,high:Math.max(open,close)+.23,low:Math.min(open,close)-.23};});return f;}
module.exports.mixedFixture=mixedFixture;
